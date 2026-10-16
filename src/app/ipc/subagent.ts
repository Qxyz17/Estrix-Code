/**
 * IPC：子代理回复上报
 */
import { createRequire } from 'node:module';
import * as windowState from '../window.js';
import { onSubagentResponse } from '../subagent.js';

const require = createRequire(import.meta.url);
const { ipcMain } = require('electron');

function registerSubagentIpc(): void {
  // 子代理 bridge 上报最终文本
  ipcMain.handle('subagent-response', async (event: any, { text }: any) => {
    const ctx = windowState.getContextByWebContents(event.sender);
    if (ctx && ctx.win && !ctx.win.isDestroyed()) {
      onSubagentResponse(ctx.win.id, text || '');
    }
    return { success: true };
  });
}

export { registerSubagentIpc };
