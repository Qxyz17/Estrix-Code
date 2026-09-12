/**
 * 标签页管理器（Chromium 标签模型）
 * 单个 BrowserWindow（壳，承载标签栏）+ 多个 WebContentsView（每个标签一个页面）。
 * 每个标签绑定一个 profile（平台 + 账号），使用其独立 partition 持久化登录态。
 *
 * 标签句柄（ctx.win）：为了让既有 ipc.js / session-store.js 无需大改，
 * 这里暴露一个"窗口代理"对象，转发 BrowserWindow 级别的操作，
 * 而 webContents 指向该标签自己的 WebContentsView.webContents。
 */
const { BrowserWindow, WebContentsView } = require('electron');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const profileManager = require('./profile-manager');
const { createSessionStore } = require('./session-store');
const { getProvider } = require('../providers');
const windowState = require('./window');

// ========== 标签栏高度（与 shell.html 保持一致）==========
const TAB_BAR_HEIGHT = 40;

// ========== 全局状态 ==========
let shellWindow = null;           // 承载标签栏的壳窗口
let tabs = new Map();             // tabId -> tab 对象
let activeTabId = null;
let sessionsToFlush = new Set();  // 需要 flush 的 session

function getTabsFile() {
  return path.join(app.getPath('userData'), 'tabs.json');
}

function readTabsStore() {
  try {
    const file = getTabsFile();
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return {
        activeTabId: raw.activeTabId || null,
        tabs: Array.isArray(raw.tabs) ? raw.tabs : [],
      };
    }
  } catch (err) {
    console.error('[Tabs] 读取标签布局失败:', err.message);
  }
  return { activeTabId: null, tabs: [] };
}

function writeTabsStore() {
  try {
    const ordered = getOrderedTabs();
    const store = {
      activeTabId,
      tabs: ordered.map(t => ({
        tabId: t.tabId,
        profileId: t.profileId,
        providerId: t.providerId,
      })),
    };
    fs.writeFileSync(getTabsFile(), JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Tabs] 写入标签布局失败:', err.message);
  }
}

/**
 * 构造标签"窗口代理"：既兼容 ipc.js 对 win.webContents 的使用，
 * 也把窗口级操作转发到真正的壳窗口。
 */
function buildTabHandle(tab) {
  const handle = {
    id: tab.tabId,
    // 关键：webContents 指向本标签自己的视图
    get webContents() { return tab.view.webContents; },
    get _nativeWindow() { return shellWindow; },
    isDestroyed() {
      return !shellWindow || shellWindow.isDestroyed() || tab.closed;
    },
    focus() { if (shellWindow && !shellWindow.isDestroyed()) shellWindow.focus(); },
    isFocused() { return !!(shellWindow && !shellWindow.isDestroyed() && shellWindow.isFocused()); },
    flashFrame(flag) { if (shellWindow && !shellWindow.isDestroyed()) shellWindow.flashFrame(flag); },
    once(event, cb) { if (shellWindow && !shellWindow.isDestroyed()) shellWindow.once(event, cb); },
    setTitle(title) { /* 单窗口模型下标题由 shell 统一管理，忽略 */ },
    getTitle() { return tab.title || ''; },
  };
  return handle;
}

/**
 * 计算指定标签内容区的边界（标签栏下方占满剩余空间）
 */
function computeViewBounds() {
  if (!shellWindow || shellWindow.isDestroyed()) return { x: 0, y: 0, width: 0, height: 0 };
  const [width, height] = shellWindow.getContentSize();
  return {
    x: 0,
    y: TAB_BAR_HEIGHT,
    width,
    height: Math.max(0, height - TAB_BAR_HEIGHT),
  };
}

/**
 * 把标签视图按当前激活状态摆放：激活的显示并置于顶层，其余隐藏。
 */
function layoutViews() {
  if (!shellWindow || shellWindow.isDestroyed()) return;
  const bounds = computeViewBounds();
  const active = activeTabId ? tabs.get(activeTabId) : null;
  for (const tab of tabs.values()) {
    if (tab.closed) continue;
    if (tab.tabId === activeTabId) {
      tab.view.setVisible(true);
      tab.view.setBounds(bounds);
    } else {
      tab.view.setVisible(false);
    }
  }
  // 仅在切换时把激活视图置顶，避免每次 resize 都重排
  if (active && !active.closed) {
    try { shellWindow.contentView.addChildView(active.view); } catch (_) {}
  }
}

/** 按插入顺序返回标签数组（Map 保持插入顺序；支持重排时用数组顺序） */
let tabOrder = []; // tabId 顺序，用于拖动排序
function getOrderedTabs() {
  return tabOrder
    .map(id => tabs.get(id))
    .filter(Boolean);
}

function getTab(tabId) {
  return tabs.get(tabId) || null;
}

function getActiveTab() {
  return activeTabId ? tabs.get(activeTabId) || null : null;
}

function getAllTabs() {
  return getOrderedTabs();
}

function getTabByProfileId(profileId) {
  for (const tab of tabs.values()) {
    if (tab.profileId === profileId && !tab.closed) return tab;
  }
  return null;
}

/**
 * 通知壳页面刷新标签栏
 */
function notifyShell() {
  if (shellWindow && !shellWindow.isDestroyed()) {
    shellWindow.webContents.send('tabs-updated', {
      activeTabId,
      tabs: getOrderedTabs().map(t => ({
        tabId: t.tabId,
        title: t.title,
        profileId: t.profileId,
        providerId: t.providerId,
        name: t.name,
      })),
    });
  }
}

/**
 * 创建标签
 * @param {object} profile profile 对象（含 id/providerId/partition/name）
 * @returns {object} tab
 */
function createTab(profile) {
  if (!shellWindow || shellWindow.isDestroyed()) {
    throw new Error('壳窗口不存在，无法创建标签');
  }
  const profileData = profile || profileManager.getDefaultProfile();
  const provider = getProvider(profileData.providerId || 'deepseek') || getProvider('deepseek');
  const storeDir = app.getPath('userData');
  const sessionStore = createSessionStore(profileData.id, storeDir, windowState);

  const tabId = 'tab-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

  const view = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: profileData.partition,
      backgroundThrottling: false,
      additionalArguments: ['--estrix-user-data=' + storeDir],
    },
  });

  const tab = {
    tabId,
    view,
    profileId: profileData.id,
    providerId: profileData.providerId || '',
    name: profileData.name || provider.name,
    title: profileData.name || provider.name,
    sessionStore,
    closed: false,
    session: view.webContents.session,
    handle: null,
  };
  tab.handle = buildTabHandle(tab);

  tabs.set(tabId, tab);
  tabOrder.push(tabId);
  sessionsToFlush.add(tab.session);

  // 把视图挂到壳窗口（初始隐藏，switchTab 时显示）
  try {
    shellWindow.contentView.addChildView(view);
    view.setVisible(false);
    view.setBounds(computeViewBounds());
  } catch (err) {
    console.error('[Tabs] 挂载视图失败:', err.message);
  }

  // 注册到全局上下文表，供 ipc.js 通过 event.sender 反查
  windowState.addContext(tab.handle, tab.profileId, tab.providerId, sessionStore);

  // 渲染进程 console 转发 + 平台日志
  view.webContents.on('console-message', (_e, _level, message) => {
    try { console.log('[Renderer Console][' + tab.name + ']', message); } catch (_) {}
  });

  // 统一的 UA
  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  view.webContents.setUserAgent(userAgent);

  // 导航事件：交给 sessionStore 处理会话/目录绑定
  view.webContents.on('did-finish-load', () => {
    if (tab.closed) return;
    tab.sessionStore.tryRestoreSessionFromUrl(tab.handle);
    notifyShell();
  });
  view.webContents.on('did-navigate', (_e, url) => {
    if (tab.closed) return;
    tab.sessionStore.handleUrlChange(url, tab.handle);
  });
  view.webContents.on('did-navigate-in-page', (_e, url) => {
    if (tab.closed) return;
    tab.sessionStore.handleUrlChange(url, tab.handle);
  });
  view.webContents.on('page-title-updated', (_e, title) => {
    tab.title = title || tab.title;
    notifyShell();
  });
  view.webContents.on('before-input-event', (_e, input) => {
    if (input.key === 'F12') view.webContents.toggleDevTools();
  });

  // 打开新窗口（target=_blank 等）：在本应用内新开标签不方便，直接阻止并忽略
  view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // 加载内容：平台已确定 → 首页；未确定 → 平台选择页
  if (tab.providerId) {
    view.webContents.loadURL(provider.homeUrl);
  } else {
    view.webContents.loadFile(path.join(__dirname, '..', 'ui', 'platform-select.html'));
  }

  // 记录为最后使用的账号
  profileManager.setLastActiveProfile(profileData.id);

  // 激活新标签
  switchTab(tabId);

  // 自动更新仅初始化一次
  const updater = require('./updater');
  if (getOrderedTabs().length === 1) {
    updater.initAutoUpdater(shellWindow);
  }

  writeTabsStore();
  notifyShell();
  console.log('[Tabs] 标签已创建 tabId=' + tabId + ' provider=' + (tab.providerId || '(未确定)') + ' name=' + tab.name);
  return tab;
}

/**
 * 切换激活标签
 */
function switchTab(tabId) {
  const tab = tabs.get(tabId);
  if (!tab || tab.closed) return false;
  activeTabId = tabId;
  // 同步全局活跃上下文（getMainContext / ipc 兜底会用到）
  windowState.setMainWindow(tab.handle);
  layoutViews();
  // 通知壳页面高亮
  notifyShell();
  // 让平台页面获得焦点
  try { tab.view.webContents.focus(); } catch (_) {}
  writeTabsStore();
  return true;
}

/**
 * 关闭标签（不删除 profile/账号，仅关闭界面，保留 cookie）
 */
function closeTab(tabId) {
  const tab = tabs.get(tabId);
  if (!tab) return false;
  tab.closed = true;

  // 从壳窗口移除视图并销毁
  try {
    if (shellWindow && !shellWindow.isDestroyed()) {
      shellWindow.contentView.removeChildView(tab.view);
    }
  } catch (_) {}
  try { tab.view.webContents.close(); } catch (_) {}

  tabs.delete(tabId);
  tabOrder = tabOrder.filter(id => id !== tabId);
  sessionsToFlush.delete(tab.session);
  windowState.removeContext(tabId);

  if (activeTabId === tabId) {
    const remaining = getOrderedTabs();
    activeTabId = remaining.length > 0 ? remaining[remaining.length - 1].tabId : null;
    layoutViews();
  }

  writeTabsStore();
  notifyShell();
  return true;
}

/**
 * 重排标签
 */
function reorderTabs(orderedIds) {
  if (!Array.isArray(orderedIds)) return false;
  const valid = orderedIds.filter(id => tabs.has(id));
  // 补齐未出现在列表中的标签
  for (const id of tabOrder) {
    if (!valid.includes(id)) valid.push(id);
  }
  tabOrder = valid;
  writeTabsStore();
  notifyShell();
  return true;
}

/**
 * 在标签内切换平台（对应原 select-platform）：
 * 更新 profile 的 providerId/partition，然后重建该标签的 view。
 */
function setTabProvider(tabId, providerId) {
  const tab = tabs.get(tabId);
  if (!tab) return { success: false, error: '标签不存在' };
  const provider = getProvider(providerId);
  if (!provider) return { success: false, error: '平台不存在: ' + providerId };

  const updatedProfile = profileManager.updateProfileProvider(tab.profileId, providerId);
  if (!updatedProfile) return { success: false, error: '更新账号失败' };

  // 重建标签（partition 变更必须重建 view）
  const index = tabOrder.indexOf(tabId);
  closeTab(tabId);
  const newTab = createTab(updatedProfile);
  if (index >= 0) {
    tabOrder = tabOrder.filter(id => id !== newTab.tabId);
    tabOrder.splice(index, 0, newTab.tabId);
    writeTabsStore();
    notifyShell();
  }
  return { success: true, tabId: newTab.tabId };
}

function setTabName(tabId, name) {
  const tab = tabs.get(tabId);
  if (!tab) return null;
  const updated = profileManager.updateProfileName(tab.profileId, name);
  if (updated) {
    tab.name = updated.name;
    tab.title = updated.name;
    notifyShell();
  }
  return updated;
}

/**
 * 创建壳窗口（承载标签栏），并恢复上次的标签布局
 */
function createShellWindow() {
  shellWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    title: 'Estrix Code Pro',
    backgroundColor: '#0d0f1a',
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: ['--estrix-user-data=' + app.getPath('userData')],
    },
  });

  shellWindow.loadFile(path.join(__dirname, '..', 'ui', 'shell.html'));
  shellWindow.maximize();
  console.log('[Tabs] 壳窗口已创建 id=' + shellWindow.id);

  shellWindow.on('resize', () => layoutViews());

  shellWindow.on('closed', () => {
    shellWindow = null;
    tabs.clear();
    tabOrder = [];
    activeTabId = null;
  });

  return shellWindow;
}

function getShellWindow() {
  return shellWindow;
}

async function flushAllSessions() {
  const promises = [];
  for (const ses of sessionsToFlush) {
    promises.push(ses.flushStorageData().catch(err => {
      console.error('[Tabs] 刷新 session 失败:', err.message);
    }));
  }
  await Promise.all(promises);
}

/**
 * 启动时恢复标签布局：读取 tabs.json，重建标签。
 * 若无历史标签，则打开上次使用的账号（或创建默认）。
 */
function restoreTabs() {
  const store = readTabsStore();
  const profiles = profileManager.readProfiles();
  const valid = store.tabs.filter(t => profiles.some(p => p.id === t.profileId));

  if (valid.length > 0) {
    for (const t of valid) {
      const profile = profileManager.getProfileById(t.profileId);
      if (profile) createTab(profile);
    }
    if (store.activeTabId && tabs.has(store.activeTabId)) {
      switchTab(store.activeTabId);
    }
    return;
  }

  // 无历史：回退到"上次使用账号 / 第一个账号 / 新建默认"
  const lastActive = profileManager.getLastActiveProfile();
  if (lastActive) {
    createTab(lastActive);
  } else if (profiles.length > 0) {
    createTab(profiles[0]);
  } else {
    createTab(null);
  }
}

module.exports = {
  TAB_BAR_HEIGHT,
  createShellWindow,
  getShellWindow,
  createTab,
  closeTab,
  switchTab,
  reorderTabs,
  setTabProvider,
  setTabName,
  getTab,
  getActiveTab,
  getAllTabs,
  getTabByProfileId,
  getOrderedTabs,
  notifyShell,
  restoreTabs,
  flushAllSessions,
  readTabsStore,
  writeTabsStore,
};
