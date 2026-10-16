/**
 * IPC：快捷提示词（Snippets）管理
 * 壳页面通过 window.shellAPI 调用：
 *  - list-snippets  ：列出全部
 *  - save-snippets  ：整体覆盖保存
 *  - trigger-snippet：把某条提示词填入 AI 页面输入框（可选自动发送）
 */
import { createRequire } from 'node:module';
import * as windowState from '../window.js';
import { listSnippets, saveSnippets } from '../snippets.js';

const require = createRequire(import.meta.url);
const { ipcMain } = require('electron');

function registerSnippetsIpc(): void {
  // 列出全部提示词
  ipcMain.handle('list-snippets', async () => {
    return { success: true, snippets: listSnippets() };
  });

  // 整体覆盖保存 → 广播给所有窗口的壳页面，让它们重新加载（多窗口同步）
  ipcMain.handle('save-snippets', async (_event: any, { snippets }: any) => {
    const ok = saveSnippets(snippets);
    if (ok) {
      for (const ctx of windowState.getAllContexts()) {
        try {
          if (ctx && ctx.win && !ctx.win.isDestroyed()) {
            ctx.win.webContents.send('shell-snippets-changed');
          }
        } catch (_) {}
      }
    }
    return { success: ok, error: ok ? null : '保存失败' };
  });

  // 追加文本到 AI 输入框末尾（不发送）：MCP 名等
  ipcMain.handle('append-to-input', async (event: any, { text }: any) => {
    if (typeof text !== 'string' || !text) return { success: false, error: '文本为空' };
    const ctx = windowState.getContextByWebContents(event.sender);
    if (!ctx || !ctx.view || !ctx.view.webContents || ctx.view.webContents.isDestroyed()) {
      return { success: false, error: '未找到 AI 页面' };
    }
    try {
      ctx.view.webContents.send('estrix-append-input', { text });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 触发某条提示词：通知对应窗口的 AI 页面填入输入框（+ 可选发送）
  ipcMain.handle('trigger-snippet', async (event: any, { content, autoSend }: any) => {
    if (typeof content !== 'string' || !content) {
      return { success: false, error: '内容为空' };
    }
    // event.sender 是壳页面 → 反查所属窗口的 AI 页面 view
    const ctx = windowState.getContextByWebContents(event.sender);
    if (!ctx || !ctx.view || !ctx.view.webContents || ctx.view.webContents.isDestroyed()) {
      return { success: false, error: '未找到 AI 页面' };
    }
    try {
      ctx.view.webContents.send('estrix-trigger-snippet', { content, autoSend: autoSend !== false });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}

export { registerSnippetsIpc };
