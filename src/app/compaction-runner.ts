/**
 * 上下文压缩（主进程编排）。
 *
 * 触发：对话1 上下文耗尽。
 * 流程：
 *  1. 刷新对话1 页面，从 IDB 读全量消息正文（fragments[].content）
 *  2. 开对话2（子代理窗口）：发全量 + 强压缩提示 → 取压缩结果 a
 *  3. 开对话3（子代理窗口）：发 a + 用户最后一句话
 *  4. 删除对话1（页面 DOM 链路：hover → 菜单 → 删除 → 确认）
 *
 * IDB 记录结构（实测）：
 *  data.chat_messages[] = { message_id, parent_id, role, fragments: [{type, content}] }
 *  role: USER / ASSISTANT；fragments[].type: REQUEST / RESPONSE，content 为正文。
 *  IDB 只在页面刷新后补齐，故读前先 reload。
 */
import * as windowState from './window.js';
import { runAgent } from './subagent.js';

/** 页面内：读指定会话的全量消息正文（按 message_id 排序） */
const READ_MESSAGES_SCRIPT = (sessionId: string) => `(async () => {
  const result = await new Promise((resolve) => {
    const req = indexedDB.open('deepseek-chat');
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('history-message', 'readonly');
      const gr = tx.objectStore('history-message').get(${JSON.stringify(sessionId)});
      gr.onsuccess = () => {
        const val = gr.result;
        const data = val && val.data;
        const msgs = data && data.chat_messages;
        db.close();
        if (!Array.isArray(msgs)) { resolve(null); return; }
        const list = msgs
          .filter(m => typeof m.message_id === 'number')
          .map(m => {
            const frags = Array.isArray(m.fragments) ? m.fragments : [];
            const text = frags.map(f => (f && f.content) || '').join('\n').trim();
            return { id: m.message_id, parent: m.parent_id, role: m.role || '', text: text };
          })
          .filter(m => m.text)
          .sort((a, b) => a.id - b.id);
        resolve(list);
      };
      gr.onerror = () => { db.close(); resolve(null); };
    };
  });
  return result;
})()`;

/** 页面内：删除当前会话（hover 会话项 → 菜单 → 删除 → 确认） */
const DELETE_CONVERSATION_SCRIPT = (sessionId: string) => `(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const click = (el) => {
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, clientX: r.left + r.width/2, clientY: r.top + r.height/2, view: window };
    el.dispatchEvent(new MouseEvent('mouseover', o));
    el.dispatchEvent(new MouseEvent('mouseenter', o));
    el.dispatchEvent(new MouseEvent('mousedown', o));
    el.dispatchEvent(new MouseEvent('mouseup', o));
    el.dispatchEvent(new MouseEvent('click', o));
  };
  const a = document.querySelector('a[href*="' + ${JSON.stringify(sessionId)} + '"]');
  if (!a) return { ok: false, error: '会话项未找到' };
  const btn = a.querySelector('div._254829d div.ds-button');
  if (!btn) return { ok: false, error: '菜单按钮未找到' };
  click(a);
  await sleep(400);
  click(btn);
  await sleep(700);
  const opts = Array.from(document.querySelectorAll('.ds-dropdown-menu-option'));
  const del = opts.find(o => (o.innerText || '').trim() === '删除');
  if (!del) return { ok: false, error: '删除菜单项未找到' };
  click(del);
  await sleep(700);
  const btns = Array.from(document.querySelectorAll('.ds-modal-content__footer [role=button]'));
  const confirm = btns.find(b => (b.innerText || '').trim() === '删除该对话');
  if (!confirm) return { ok: false, error: '确认按钮未找到' };
  click(confirm);
  await sleep(1200);
  return { ok: true };
})()`;

/** 把消息列表拼成给 AI 的文本 */
function formatMessages(msgs: Array<{ role: string; text: string }>): string {
  return msgs.map(m => '【' + (m.role === 'USER' ? '用户' : 'AI') + '】\n' + m.text).join('\n\n');
}

const COMPACT_INSTRUCTION =
  '你现在唯一要做的事情是压缩上下文，不要用它来回答用户，不要调用任何工具。\n' +
  '以下是上一轮会话的全部对话记录。请把它压缩成一份尽可能完整保留关键信息的摘要：' +
  '保留背景、已完成的结论、未完成的事项、重要决定与约束；用中文；直接输出摘要正文，不要任何解释。\n\n' +
  '=== 对话记录开始 ===\n';

const APPLY_INSTRUCTION =
  '以下是你之前会话经压缩后的上下文摘要。请把它作为你的上下文，继续后续工作，不要复述、不要确认、不要调用工具，只需记住它。\n\n' +
  '=== 上下文摘要开始 ===\n';

/** 取当前会话 id（从 URL） */
function getSessionIdFromUrl(url: string): string | null {
  const m = String(url).match(/\/chat\/s\/([a-f0-9-]+)/i);
  return m ? m[1] : null;
}

/**
 * 执行一次完整压缩。
 * @param ctx 触发压缩的窗口上下文（对话1）
 * @returns { ok, error? }
 */
async function runCompactionFlow(ctx: any): Promise<{ ok: boolean; error?: string }> {
  if (!ctx || !ctx.view || ctx.view.webContents.isDestroyed()) {
    return { ok: false, error: '无有效窗口上下文' };
  }
  const view = ctx.view;
  const wc = view.webContents;
  const parentWindowId = ctx.win && ctx.win.id;
  const parentProfileId = ctx.profileId;

  try {
    // 1. 刷新对话1，等 IDB 补齐
    const curUrl = wc.getURL();
    const sessionId = getSessionIdFromUrl(curUrl);
    if (!sessionId) return { ok: false, error: '无法获取会话 ID' };
    console.log('[Compaction] 会话 ' + sessionId + '，刷新页面以补齐 IDB');
    await wc.reload();
    await new Promise(r => setTimeout(r, 4000));

    // 2. 读全量消息
    const msgs = await wc.executeJavaScript(READ_MESSAGES_SCRIPT(sessionId), true);
    if (!Array.isArray(msgs) || msgs.length === 0) {
      return { ok: false, error: '未读到会话消息' };
    }
    console.log('[Compaction] 读到 ' + msgs.length + ' 条消息');
    const fullText = formatMessages(msgs);

    // 3. 对话2：压缩
    const compacted = await runAgent({
      parentProfileId,
      parentWindowId,
      agentName: 'context-compact',
      task: COMPACT_INSTRUCTION + fullText + '\n=== 对话记录结束 ===',
      systemPrompt: '',
      timeoutMs: 300000,
    });
    if (!compacted || compacted === '__SUBAGENT_TIMEOUT__') {
      return { ok: false, error: '压缩超时' };
    }
    console.log('[Compaction] 压缩结果长度 ' + compacted.length);

    // 4. 对话3：应用压缩结果 + 最后一句用户话
    const lastUserMsg = [...msgs].reverse().find(m => m.role === 'USER');
    const lastUserText = lastUserMsg ? lastUserMsg.text : '';
    await runAgent({
      parentProfileId,
      parentWindowId,
      agentName: 'context-apply',
      task: APPLY_INSTRUCTION + compacted + '\n=== 上下文摘要结束 ===\n\n用户最后发送的消息：\n' + lastUserText,
      systemPrompt: '',
      timeoutMs: 120000,
    });

    // 5. 删除对话1
    await wc.executeJavaScript(DELETE_CONVERSATION_SCRIPT(sessionId), true).catch(() => {});

    return { ok: true };
  } catch (err: any) {
    console.error('[Compaction] 失败:', err && err.message);
    return { ok: false, error: err && err.message };
  }
}

export { runCompactionFlow };
