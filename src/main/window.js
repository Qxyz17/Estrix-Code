/**
 * 上下文管理（兼容"多窗口"与"标签页"两种模型）
 *
 * - 多窗口模型：每个 BrowserWindow 注册为一个上下文（历史行为）。
 * - 标签页模型：每个标签的"窗口代理"（tab-manager 的 handle）注册为一个上下文，
 *   其 webContents 指向该标签的 WebContentsView.webContents。
 *
 * 对外接口保持不变，ipc.js / session-store.js 无需感知底层是窗口还是标签。
 */
const contexts = new Map(); // id -> { win, profileId, providerId, sessionStore }
let lastActiveId = null;

/**
 * 注册一个上下文。
 * @param {object} win 窗口或标签句柄（需提供 id、webContents、isDestroyed 等）
 * @param {string} profileId 账号 id
 * @param {string} providerId 平台 id（可为空）
 * @param {object} sessionStore 会话存储实例
 */
function addContext(win, profileId, providerId, sessionStore) {
  const id = win && win.id != null ? win.id : ('ctx-' + Date.now());
  contexts.set(id, { win, profileId, providerId, sessionStore });
  lastActiveId = id;
  if (win && typeof win.on === 'function') {
    win.on('closed', () => {
      contexts.delete(id);
      if (lastActiveId === id) {
        const remaining = Array.from(contexts.keys());
        lastActiveId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
      }
    });
  }
  return id;
}

// 兼容旧名
function addWindow(win, profileId, providerId, sessionStore) {
  return addContext(win, profileId, providerId, sessionStore);
}

function removeContext(id) {
  contexts.delete(id);
  if (lastActiveId === id) {
    const remaining = Array.from(contexts.keys());
    lastActiveId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
  }
}

// 兼容旧名
function removeWindow(id) {
  removeContext(id);
}

function getContext(id) {
  return contexts.get(id) || null;
}

// 兼容旧名
function getWindowContext(id) {
  return getContext(id);
}

function getContextByWebContents(webContents) {
  if (!webContents) return null;
  for (const ctx of contexts.values()) {
    const wc = ctx.win && ctx.win.webContents;
    if (wc === webContents) return ctx;
  }
  return null;
}

function getMainContext() {
  if (!lastActiveId) return null;
  return contexts.get(lastActiveId) || null;
}

function getMainWindow() {
  const ctx = getMainContext();
  if (!ctx) return null;
  return ctx.win || null;
}

function setMainWindow(win) {
  if (!win) {
    lastActiveId = null;
    return;
  }
  // 若该对象已在上下文中，直接置为活跃；否则仅记录 id
  if (win.id != null && contexts.has(win.id)) {
    lastActiveId = win.id;
  } else if (win.id != null) {
    lastActiveId = win.id;
  }
}

function getAllContexts() {
  return Array.from(contexts.values());
}

function getAllWindows() {
  return getAllContexts().map(ctx => ctx.win);
}

function getWindowByProfileId(profileId) {
  for (const ctx of contexts.values()) {
    if (ctx.profileId === profileId) return ctx;
  }
  return null;
}

module.exports = {
  addContext,
  addWindow,
  removeContext,
  removeWindow,
  getContext,
  getWindowContext,
  getContextByWebContents,
  getMainWindow,
  getMainContext,
  setMainWindow,
  getAllWindows,
  getAllContexts,
  getWindowByProfileId,
};
