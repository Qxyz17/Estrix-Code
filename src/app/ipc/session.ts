/**
 * IPC：会话列表与导航
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as windowState from '../window.js';
import { getProviderByUrl, getProvider } from '../../providers/registry.js';
import { initProject } from '../../session/project-context.js';

const require = createRequire(import.meta.url);
const { ipcMain } = require('electron');

// 文件树：忽略的目录 + 节点上限（防超大项目）
const TREE_IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'build', 'coverage', '.estrixCode', '.playwright-mcp', '.idea', '.vscode', 'wyp', 'release', 'dist-verify']);
const TREE_MAX_NODES = 5000;
const TREE_MAX_DEPTH = 12;

/** 递归构建文件树（目录在前、各自按名排序） */
function buildFileTree(root: string, rel: string, depth: number, counter: { n: number }): any[] {
  if (depth > TREE_MAX_DEPTH || counter.n > TREE_MAX_NODES) return [];
  let entries: any[];
  try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch (_) { return []; }
  const dirs: any[] = [];
  const files: any[] = [];
  for (const e of entries) {
    if (counter.n > TREE_MAX_NODES) break;
    if (e.isDirectory() && TREE_IGNORE_DIRS.has(e.name)) continue;
    const childRel = rel ? rel + '/' + e.name : e.name;
    counter.n++;
    if (e.isDirectory()) {
      dirs.push({ name: e.name, path: childRel, type: 'dir', children: buildFileTree(root, childRel, depth + 1, counter) });
    } else {
      files.push({ name: e.name, path: childRel, type: 'file' });
    }
  }
  // 自然排序：让 v0.8.10 排在 v0.8.9 之后（而非按字符串排在 v0.8.1 后）
  dirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return dirs.concat(files);
}

function registerSessionIpc(): void {
  // 列出当前项目的文件树（只读浏览；忽略 node_modules/.git 等）
  ipcMain.handle('list-project-tree', async (event: any) => {
    const ctx = windowState.getContextByWebContents(event.sender);
    const store = ctx ? ctx.sessionStore : null;
    const dir = (store && store.state && store.state.selectedProjectDir) || null;
    if (!dir) return { success: false, error: '未选择项目目录' };
    try {
      const counter = { n: 0 };
      const tree = buildFileTree(dir, '', 0, counter);
      return { success: true, root: dir, tree, truncated: counter.n > TREE_MAX_NODES };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 读取项目文件内容（只读查看；带大小/二进制保护）
  ipcMain.handle('read-project-file', async (event: any, { relPath }: any) => {
    const ctx = windowState.getContextByWebContents(event.sender);
    const store = ctx ? ctx.sessionStore : null;
    const rootDir = (store && store.state && store.state.selectedProjectDir) || null;
    if (!rootDir) return { success: false, error: '未选择项目目录' };
    if (!relPath || typeof relPath !== 'string') return { success: false, error: '缺少文件路径' };
    // 防目录穿越：拼接后必须在 rootDir 内
    const abs = path.resolve(rootDir, relPath);
    const rootAbs = path.resolve(rootDir);
    if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) {
      return { success: false, error: '非法路径' };
    }
    try {
      const st = fs.statSync(abs);
      if (!st.isFile()) return { success: false, error: '不是文件' };
      const MAX = 2 * 1024 * 1024; // 2MB 上限
      if (st.size > MAX) return { success: false, error: '文件过大（>' + Math.round(MAX / 1024 / 1024) + 'MB），请用系统程序打开' };
      // 二进制检测：读前 4KB 看是否含 \0
      const fd = fs.openSync(abs, 'r');
      const buf = Buffer.alloc(Math.min(4096, st.size));
      fs.readSync(fd, buf, 0, buf.length, 0);
      fs.closeSync(fd);
      if (buf.includes(0)) return { success: false, error: '二进制文件，无法文本预览' };
      const content = fs.readFileSync(abs, 'utf-8');
      return { success: true, content, size: st.size };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 用系统默认程序打开文件
  ipcMain.handle('open-project-file-external', async (event: any, { relPath }: any) => {
    const ctx = windowState.getContextByWebContents(event.sender);
    const store = ctx ? ctx.sessionStore : null;
    const rootDir = (store && store.state && store.state.selectedProjectDir) || null;
    if (!rootDir || !relPath) return { success: false, error: '缺少参数' };
    const abs = path.resolve(rootDir, relPath);
    const rootAbs = path.resolve(rootDir);
    if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) return { success: false, error: '非法路径' };
    try {
      const { shell } = require('electron');
      await shell.openPath(abs);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 列出会话（返回 { sessionId, projectDir, title, createdAt, updatedAt }）
  ipcMain.handle('list-sessions', async (event: any) => {
    const ctx = windowState.getContextByWebContents(event.sender);
    const store = ctx ? ctx.sessionStore : null;
    if (!store || !store.state.selectedProjectDir) {
      return { success: true, sessions: [] };
    }
    const all = store.readSessionStore();
    const sessions = Object.keys(all)
      .map((id) => {
        const meta = store.getSessionMeta(id);
        return { sessionId: id, projectDir: meta.projectDir, title: meta.title, createdAt: meta.createdAt, updatedAt: meta.updatedAt };
      })
      .filter((s: any) => s.projectDir === store.state.selectedProjectDir);
    // 兼容旧调用（原本返回 string[]）：附纯 ID 列表
    return { success: true, sessions, sessionIds: sessions.map((s: any) => s.sessionId) };
  });

  // 列出所有会话（供壳页面侧边栏按项目目录分组显示）
  ipcMain.handle('list-all-sessions', async (event: any) => {
    const ctx = windowState.getContextByWebContents(event.sender);
    const store = ctx ? ctx.sessionStore : null;
    if (!store) return { success: true, sessions: [] };
    const all = store.readSessionStore();
    const sessions = Object.keys(all).map((id) => {
      const meta = store.getSessionMeta(id);
      return {
        sessionId: id, projectDir: meta.projectDir, title: meta.title,
        createdAt: meta.createdAt, updatedAt: meta.updatedAt, archived: meta.archived === true,
        // 血缘：子代理/压缩来源
        parentId: meta.parentId || null, kind: meta.kind || null,
        agentName: meta.agentName || null, superseded: meta.superseded === true,
      };
    }).filter((s: any) => !!s.projectDir);
    return { success: true, sessions, currentSessionId: store.state.currentSessionId || null, archivedProjects: store.getArchivedProjects() };
  });

  // 设置会话标题（用户手动重命名）
  ipcMain.handle('set-session-title', async (event: any, { sessionId, title }: any) => {
    const ctx = windowState.getContextByWebContents(event.sender);
    const store = ctx ? ctx.sessionStore : null;
    const t = String(title || '').trim();
    if (!store || !sessionId || !t) return { success: false, error: 'no-store-or-args' };
    store.updateSessionTitle(sessionId, t);
    return { success: true };
  });

  // 归档/取消归档项目
  ipcMain.handle('set-project-archived', async (event: any, { dir, archived }: any) => {
    const ctx = windowState.getContextByWebContents(event.sender);
    const store = ctx ? ctx.sessionStore : null;
    if (!store || !dir) return { success: false, error: 'no-store-or-dir' };
    store.setProjectArchived(dir, archived === true);
    return { success: true };
  });

  // 归档/取消归档会话
  ipcMain.handle('set-session-archived', async (event: any, { sessionId, archived }: any) => {
    const ctx = windowState.getContextByWebContents(event.sender);
    const store = ctx ? ctx.sessionStore : null;
    if (!store || !sessionId) return { success: false, error: 'no-store-or-id' };
    store.setSessionArchived(sessionId, archived === true);
    return { success: true };
  });

  // 取项目目录信息（全路径 + 创建时间），供侧边栏悬停卡片
  ipcMain.handle('get-dir-info', async (_event: any, { dir }: any) => {
    if (!dir) return { success: false, error: 'no-dir' };
    try {
      const st = fs.statSync(dir);
      const bt = st.birthtime && st.birthtime.getTime() > 0 ? st.birthtime.toISOString() : null;
      return { success: true, dir, createdAt: bt };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 用指定项目新建对话：导航到首页 + 自动初始化该项目（发系统提示词，不弹目录框）
  ipcMain.handle('new-conversation-for-project', async (event: any, { projectDir }: any) => {
    const ctx = windowState.getContextByWebContents(event.sender);
    if (!ctx || !ctx.view || ctx.view.webContents.isDestroyed()) return { success: false, error: 'no-view' };
    const provider = ctx.providerId ? getProvider(ctx.providerId) : null;
    const homeUrl = provider && provider.homeUrl ? provider.homeUrl : null;
    if (!homeUrl) return { success: false, error: '当前平台无首页地址' };
    const wc = ctx.view.webContents;
    console.log('[Estrix Code] 用项目新建对话 → ' + projectDir);
    // 页面加载完成后再初始化（等输入框就绪）
    const onLoad = () => {
      try { wc.off('did-finish-load', onLoad); } catch (_) { /* ignore */ }
      setTimeout(async () => {
        try {
          await initProject(false, ctx, projectDir, false, '', false);
        } catch (err: any) {
          console.log('[Estrix Code] 新建对话初始化项目失败: ' + (err && err.message));
        }
      }, 2000);
    };
    try { wc.on('did-finish-load', onLoad); } catch (_) { /* ignore */ }
    try { await wc.loadURL(homeUrl); } catch (err: any) { return { success: false, error: err.message }; }
    return { success: true };
  });

  // 上下文耗尽自动续接：从当前窗口 sessionStore 取 projectDir → 导航首页 + 初始化（保留项目目录）
  ipcMain.handle('context-exhausted-continue', async (event: any) => {
    const ctx = windowState.getContextByWebContents(event.sender);
    if (!ctx || !ctx.view || ctx.view.webContents.isDestroyed()) return { success: false, error: 'no-view' };
    const store = ctx.sessionStore;
    const projectDir = store && store.state ? store.state.selectedProjectDir : null;
    const provider = ctx.providerId ? getProvider(ctx.providerId) : null;
    const homeUrl = provider && provider.homeUrl ? provider.homeUrl : null;
    if (!homeUrl) return { success: false, error: '当前平台无首页地址' };
    const wc = ctx.view.webContents;
    console.log('[Estrix Code] 上下文耗尽 → 自动新会话续接，项目目录=' + (projectDir || '(无)'));
    const onLoad = () => {
      try { wc.off('did-finish-load', onLoad); } catch (_) { /* ignore */ }
      setTimeout(async () => {
        try {
          await initProject(false, ctx, projectDir, false, '', false);
        } catch (err: any) {
          console.log('[Estrix Code] 续接初始化项目失败: ' + (err && err.message));
        }
      }, 2000);
    };
    try { wc.on('did-finish-load', onLoad); } catch (_) { /* ignore */ }
    try { await wc.loadURL(homeUrl); } catch (err: any) { return { success: false, error: err.message }; }
    return { success: true, projectDir: projectDir || null };
  });

  // 导航到会话
  ipcMain.handle('navigate-session', async (event: any, { sessionId }: any) => {
    if (!sessionId) return { success: false, error: '缺少会话ID' };
    const ctx = windowState.getContextByWebContents(event.sender);
    const view = ctx ? ctx.view : null;
    if (!view || !view.webContents || view.webContents.isDestroyed()) {
      return { success: false, error: '窗口已关闭' };
    }
    // 按当前 provider 拼会话 URL（智谱 cid=、DeepSeek /chat/s/、Claude /chat/）
    let url = null;
    try {
      const provider = getProviderByUrl(view.webContents.getURL());
      if (provider && typeof provider.sessionUrlBase === 'string' && provider.sessionUrlBase) {
        url = provider.sessionUrlBase + sessionId;
      }
    } catch (_) { /* provider 未识别 */ }
    if (!url) return { success: false, error: '无法确定会话 URL（当前平台未提供 sessionUrlBase）' };
    try {
      await view.webContents.loadURL(url);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}

export { registerSessionIpc };
