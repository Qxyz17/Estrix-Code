/**
 * IPC：上下文压缩（bridge 触发 → 主进程执行）。
 */
import { createRequire } from 'node:module';
import * as windowState from '../window.js';
import { runCompactionFlow } from '../compaction-runner.js';

const require = createRequire(import.meta.url);
const { ipcMain } = require('electron');

function registerCompactionIpc(): void {
  ipcMain.handle('compaction-run', async (event: any) => {
    const ctx = windowState.getContextByWebContents(event.sender);
    if (!ctx) return { ok: false, error: '无窗口上下文' };
    return await runCompactionFlow(ctx);
  });
}

export { registerCompactionIpc };
