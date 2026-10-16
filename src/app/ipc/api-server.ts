/**
 * 本地 API 服务器：OpenAI 兼容，转发到指定窗口的 AI。支持真流式。
 * 一个窗口同时只服务一个请求（按 tabId 索引）。
 */
import http from 'node:http';
import crypto from 'node:crypto';
const PORT = 11434;
const HOST = '127.0.0.1';
const pending: any = new Map();
let server: any = null;
let getApiKey: () => string = () => '';
let sendToTab: (tabId: any, prompt: string) => void = () => {};
let listTabs: () => any[] = () => [];
function setHandlers(h: any) { if (h.getApiKey) getApiKey = h.getApiKey; if (h.sendToTab) sendToTab = h.sendToTab; if (h.listTabs) listTabs = h.listTabs; }
function checkAuth(req: any) { const k = getApiKey(); if (!k) return true; const a = req.headers['authorization'] || ''; const m = a.match(/^Bearer\s+(.+)$/i); return !!m && m[1] === k; }
function readBody(req: any): Promise<string> { return new Promise((resolve, reject) => { let d = ''; req.on('data', (c: any) => { d += c; if (d.length > 10485760) { reject(new Error('too large')); req.destroy(); } }); req.on('end', () => resolve(d)); req.on('error', reject); }); }
function jsonResponse(res: any, s: number, o: any) { const b = JSON.stringify(o); res.writeHead(s, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) }); res.end(b); }
function extractPrompt(messages: any) { if (!Array.isArray(messages)) return ''; for (let i = messages.length - 1; i >= 0; i--) { const m = messages[i]; if (m && m.role === 'user') { if (typeof m.content === 'string') return m.content; if (Array.isArray(m.content)) return m.content.filter((p: any) => p && p.type === 'text').map((p: any) => p.text).join('\n'); } } return ''; }
async function handleChat(req: any, res: any) {
  if (!checkAuth(req)) return jsonResponse(res, 401, { error: { message: 'Invalid API key' } });
  let body: any; try { body = JSON.parse(await readBody(req)); } catch (e) { return jsonResponse(res, 400, { error: { message: 'Invalid JSON' } }); }
  const model = body.model || ''; const prompt = extractPrompt(body.messages);
  if (!prompt) return jsonResponse(res, 400, { error: { message: 'No user message' } });
  const tabs = listTabs(); const target = tabs.find((t: any) => String(t.tabId) === String(model)) || tabs.find((t: any) => t.providerId === model) || tabs[0];
  if (!target) return jsonResponse(res, 503, { error: { message: 'No available tab' } });
  const tabId = target.tabId; const stream = !!body.stream;
  if (stream) res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  if (pending.has(tabId)) { const old = pending.get(tabId); try { clearTimeout(old.timer); if (!old.res.writableEnded) old.res.end(); } catch (_) {} }
  const rec: any = { res, model, stream, started: false, timer: null };
  rec.timer = setTimeout(() => { if (pending.get(tabId) === rec) { pending.delete(tabId); if (!res.writableEnded) { if (stream) { res.write('data: ' + JSON.stringify({ error: { message: 'timeout' } }) + '\n\n'); res.end(); } else jsonResponse(res, 504, { error: { message: 'AI 超时' } }); } } }, 120000);
  pending.set(tabId, rec);
  try { sendToTab(tabId, prompt); } catch (e: any) { clearTimeout(rec.timer); pending.delete(tabId); return jsonResponse(res, 500, { error: { message: 'send failed: ' + e.message } }); }
}
function onTabStream(tabId: any, text: string, finished: boolean) {
  const p = pending.get(tabId); if (!p || !p.stream) return;
  const id = 'chatcmpl-' + crypto.randomBytes(8).toString('hex'); const now = Math.floor(Date.now() / 1000);
  if (!p.started) { p.started = true; p.res.write('data: ' + JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: p.model, choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] }) + '\n\n'); }
  if (text) p.res.write('data: ' + JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: p.model, choices: [{ index: 0, delta: { content: text }, finish_reason: null }] }) + '\n\n');
  if (finished) { p.res.write('data: ' + JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: p.model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }) + '\n\n'); p.res.write('data: [DONE]\n\n'); p.res.end(); clearTimeout(p.timer); pending.delete(tabId); }
}
function onTabResponse(tabId: any, text: string) {
  const p = pending.get(tabId); if (!p) return;
  const id = 'chatcmpl-' + crypto.randomBytes(8).toString('hex'); const now = Math.floor(Date.now() / 1000);
  if (p.stream) {
    if (!p.started) { p.started = true; p.res.write('data: ' + JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: p.model, choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] }) + '\n\n'); }
    p.res.write('data: ' + JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: p.model, choices: [{ index: 0, delta: { content: text }, finish_reason: null }] }) + '\n\n');
    p.res.write('data: ' + JSON.stringify({ id, object: 'chat.completion.chunk', created: now, model: p.model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }) + '\n\n');
    p.res.write('data: [DONE]\n\n'); p.res.end();
  } else {
    jsonResponse(p.res, 200, { id, object: 'chat.completion', created: now, model: p.model, choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } });
  }
  clearTimeout(p.timer); pending.delete(tabId);
}
function start() {
  if (server) return;
  server = http.createServer(async (req: any, res: any) => {
    try {
      const url = (req.url || '').split('?')[0];
      if (req.method === 'POST' && url === '/v1/chat/completions') return await handleChat(req, res);
      if (req.method === 'GET' && url === '/v1/models') { if (!checkAuth(req)) return jsonResponse(res, 401, { error: { message: 'Invalid API key' } }); return jsonResponse(res, 200, { object: 'list', data: listTabs().map((t: any) => ({ id: String(t.tabId), object: 'model', owned_by: t.providerId || 'estrix', name: t.name })) }); }
      jsonResponse(res, 404, { error: { message: 'Not found' } });
    } catch (e: any) { if (!res.writableEnded) jsonResponse(res, 500, { error: { message: e.message } }); }
  });
  server.listen(PORT, HOST, () => console.log('[Estrix API] 本地 API 已启动: http://' + HOST + ':' + PORT));
  server.on('error', (e: any) => console.error('[Estrix API] 启动失败:', e.message));
}
function stop() { if (server) { try { server.close(); } catch (_) {} server = null; } }
export { start, stop, setHandlers, onTabResponse, onTabStream, PORT, HOST };
