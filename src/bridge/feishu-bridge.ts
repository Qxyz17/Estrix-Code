/**
 * 飞书同步：bridge 侧逻辑（运行在 AI 页面 preload）
 *
 * 职责：
 *   1. 监听"用户消息已发出" → 上报主进程 → 飞书推送
 *   2. 监听 AI 回复完成 → 上报
 *   3. 监听工具调用（start/end）→ 上报（仅状态，不带参数/结果）
 *   4. 接收主进程转发的飞书来消息 → sendToChat 发给 AI
 *
 * 门控：主进程切换飞书启用状态时通知（enabled=false 时各回调立即返回，零开销）。
 */
import { createRequire } from 'node:module';
import { onInterceptedResponse, onToolCall } from './intercept/observer.js';
import { sendToChat, onUserMessageSent } from '../overlay/chat-input.js';

const require = createRequire(import.meta.url);
const { ipcRenderer } = require('electron');

/** 移除文本中的 estrix/js 工具代码块（工具调用另行上报，飞书只显示对话） */
export function stripToolBlocks(text: string): string {
  if (!text) return '';
  let out = text;
  out = out.replace(/```(?:estrix|javascript|js)\s*\n[\s\S]*?```/gi, '');
  out = out.replace(/```(?:estrix|javascript|js)\s*\n[\s\S]*$/gi, '');
  out = out.replace(/```(?:estrix|javascript|js)\s*$/gi, '');
  return out.trim();
}

function report(payload: any): void {
  try {
    ipcRenderer.invoke('feishu-report', payload).catch(() => {});
  } catch (_) { /* ignore */ }
}

let inited = false;
export function initFeishuBridge(): void {
  if (inited) return;
  inited = true;

  // 启用门控（主进程下发 + 初始化时主动查询，避免错过广播）
  let enabled = false;
  ipcRenderer.on('feishu-mode', (_e: any, payload: any) => {
    enabled = !!(payload && payload.enabled);
  });
  try {
    ipcRenderer.invoke('feishu-is-enabled').then((r: any) => {
      if (r) enabled = !!r.enabled;
    }).catch(() => {});
  } catch (_) {}

  // 本轮任务是否调用过工具（用户发新消息时重置）
  let usedToolThisTurn = false;

  // 1. 用户消息（经 Estrix 发送）→ 上报（并重置本轮工具标记）
  onUserMessageSent((text: string, tag?: string) => {
    if (!enabled || !text) return;
    usedToolThisTurn = false;
    report({ type: 'user-message', text: text, tag: tag || '' });
  });

  // 2. AI 回复完成 → 上报（剥离工具代码块，飞书只看对话）
  onInterceptedResponse((text: string) => {
    if (!enabled || !text) return;
    let clean = stripToolBlocks(text);
    if (!clean) return;
    // 本轮未调用任何工具 → 末尾附注（便于用户知道可以直接发下一步）
    if (!usedToolThisTurn) clean += '\n\n（本次AI没有调用任何工具）';
    report({ type: 'ai-reply', text: clean });
  });

  // 3. 工具调用状态 → 上报（仅状态；工具名是否带上由主进程按配置决定）
  onToolCall((ev: any) => {
    if (!enabled || !ev) return;
    usedToolThisTurn = true;
    if (ev.phase === 'start') report({ type: 'tool-start' });
    else if (ev.phase === 'end') report({ type: 'tool-end' });
  });

  // 4. 飞书来消息 → 主进程转发到此 → 发给 AI
  ipcRenderer.on('feishu-user-message', (_e: any, payload: any) => {
    const text = payload && payload.text;
    if (!text) return;
    sendToChat(text, '飞书', 300).catch(() => {});
  });
}
