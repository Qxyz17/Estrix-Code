/**
 * 本地 API 服务器：暴露 OpenAI 兼容接口，把请求转发到指定标签页的 AI。
 *
 * 端点：
 *   POST /v1/chat/completions   OpenAI 格式
 *   GET  /v1/models             列出可用标签页（作为 model）
 *
 * 认证：Authorization: Bearer <自定义 key>（应用设置里配置）
 * 指定标签页：请求的 model 字段（如 "deepseek" 或 tabId）
 */
const http = require('http');
const crypto = require('crypto');

const PORT = 11434;
const HOST = '127.0.0.1';

// 待响应的请求队列：requestId -> { res, tabId, buffer }
const pending = new Map();

let server = null;
let getApiKey = () => '';       // 由外部注入：读取配置的 key
let sendToTab = () => {};       // 由外部注入：把消息发到标签页
let listTabs = () => [];        // 由外部注入：列出标签页

function setHandlers(handlers) {
  if (handlers.getApiKey) getApiKey = handlers.getApiKey;
  if (handlers.sendToTab) sendToTab = handlers.sendToTab;
  if (handlers.listTabs) listTabs = handlers.listTabs;
}

function checkAuth(req) {
  const key = getApiKey();
  if (!key) return true; // 未配置 key 则放行（本地）
  const auth = req.headers['authorization'] || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return !!m && m[1] === key;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 10 * 1024 * 1024) { reject(new Error('body too large')); req.destroy(); } });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function jsonResponse(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

/** 从 OpenAI messages 里取最后一条 user 消息文本 */
function extractPrompt(messages) {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === 'user') {
      if (typeof m.content === 'string') return m.content;
      if (Array.isArray(m.content)) {
        return m.content.filter(p => p && p.type === 'text').map(p => p.text).join('\n');
      }
    }
  }
  return '';
}

/** 处理 /v1/chat/completions */
async function handleChatCompletions(req, res) {
  if (!checkAuth(req)) return jsonResponse(res, 401, { error: { message: 'Invalid API key', type: 'invalid_request_error' } });

  let body;
  try { body = JSON.parse(await readBody(req)); }
  catch (e) { return jsonResponse(res, 400, { error: { message: 'Invalid JSON body' } }); }

  const model = body.model || '';
  const prompt = extractPrompt(body.messages);
  if (!prompt) return jsonResponse(res, 400, { error: { message: 'No user message found' } });

  // 找目标标签页：model 匹配 tabId 或 providerId
  const tabs = listTabs();
  let target = tabs.find(t => t.tabId === model) || tabs.find(t => t.providerId === model) || tabs[0];
  if (!target) return jsonResponse(res, 503, { error: { message: 'No available tab' } });

  const requestId = 'req_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  const stream = !!body.stream;

  if (stream) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  }

  pending.set(requestId, { res, tabId: target.tabId, model, prompt, stream, created: Date.now() });

  // 超时保护（120s）
  const timer = setTimeout(() => {
    if (pending.has(requestId)) {
      pending.delete(requestId);
      if (!res.writableEnded) {
        if (stream) { res.write('data: ' + JSON.stringify({ error: { message: 'timeout' } }) + '\n\n'); res.end(); }
        else jsonResponse(res, 504, { error: { message: 'AI 响应超时' } });
      }
    }
  }, 120000);

  // 把消息发给标签页（由外部注入的实现）
  try {
    sendToTab(target.tabId, prompt, requestId);
  } catch (e) {
    clearTimeout(timer);
    pending.delete(requestId);
    return jsonResponse(res, 500, { error: { message: '发送到标签页失败: ' + e.message } });
  }
}

/** 标签页回复到达时调用（由 intercept-observer 上报） */
function onTabResponse(requestId, text) {
  const p = pending.get(requestId);
  if (!p) return;
  pending.delete(requestId);

  const id = 'chatcmpl-' + crypto.randomBytes(8).toString('hex');
  const now = Math.floor(Date.now() / 1000);

  if (p.stream) {
    // 模拟 OpenAI SSE：先发 role，再发 content，再发 stop，最后 [DONE]
    const chunk1 = { id, object: 'chat.completion.chunk', created: now, model: p.model, choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] };
    const chunk2 = { id, object: 'chat.completion.chunk', created: now, model: p.model, choices: [{ index: 0, delta: { content: text }, finish_reason: null }] };
    const chunk3 = { id, object: 'chat.completion.chunk', created: now, model: p.model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] };
    p.res.write('data: ' + JSON.stringify(chunk1) + '\n\n');
    p.res.write('data: ' + JSON.stringify(chunk2) + '\n\n');
    p.res.write('data: ' + JSON.stringify(chunk3) + '\n\n');
    p.res.write('data: [DONE]\n\n');
    p.res.end();
  } else {
    const obj = {
      id, object: 'chat.completion', created: now, model: p.model,
      choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
    jsonResponse(p.res, 200, obj);
  }
}

function start() {
  if (server) return;
  server = http.createServer(async (req, res) => {
    try {
      const url = (req.url || '').split('?')[0];
      if (req.method === 'POST' && url === '/v1/chat/completions') return await handleChatCompletions(req, res);
      if (req.method === 'GET' && url === '/v1/models') {
        if (!checkAuth(req)) return jsonResponse(res, 401, { error: { message: 'Invalid API key' } });
        const data = listTabs().map(t => ({ id: t.tabId, object: 'model', owned_by: t.providerId || 'estrix', name: t.name }));
        return jsonResponse(res, 200, { object: 'list', data });
      }
      jsonResponse(res, 404, { error: { message: 'Not found' } });
    } catch (e) {
      if (!res.writableEnded) jsonResponse(res, 500, { error: { message: e.message } });
    }
  });
  server.listen(PORT, HOST, () => {
    console.log('[Estrix API] 本地 API 已启动: http://' + HOST + ':' + PORT);
  });
  server.on('error', (e) => {
    console.error('[Estrix API] 启动失败:', e.message);
  });
}

function stop() {
  if (server) { try { server.close(); } catch (_) {} server = null; }
}

module.exports = { start, stop, setHandlers, onTabResponse, PORT, HOST };
