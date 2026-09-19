/**
 * 标签页管理器（Chromium 标签模型，纯 WebContentsView 架构）
 *
 * 窗口结构（BrowserWindow 仅作容器，不加载任何页面）：
 *   contentView
 *     ├─ 各标签内容视图 tabView_i  (bounds: 0, TAB_BAR_HEIGHT, W, H-40)
 *     └─ 标签栏视图 tabBarView     (bounds: 0, 0, W, 40)  ← 最后添加，置顶
 *
 * 每个标签绑定一个 profile（平台 + 账号），使用独立 partition 持久化登录态。
 */
const { BrowserWindow, WebContentsView, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const profileManager = require('./profile-manager');
const userAgent = require('./user-agent');
const { createSessionStore } = require('./session-store');
const { getProvider } = require('../providers');
const windowState = require('./window');

// ========== 标签栏高度（与 shell.html 保持一致）==========
const TAB_BAR_HEIGHT = 40;

// ========== 全局状态 ==========
let shellWindow = null;           // 容器窗口
let tabBarView = null;            // 标签栏视图（shell.html）
let tabs = new Map();             // tabId -> tab 对象
let tabOrder = [];                // tabId 顺序（支持拖动排序）
let activeTabId = null;
let sessionsToFlush = new Set();

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

function getOrderedTabs() {
  return tabOrder.map(id => tabs.get(id)).filter(Boolean);
}

function writeTabsStore() {
  try {
    const store = {
      activeTabId,
      tabs: getOrderedTabs().map(t => ({
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

// ========== 布局 ==========
function getContentSize() {
  if (!shellWindow || shellWindow.isDestroyed()) return [0, 0];
  return shellWindow.getContentSize();
}

function layoutAll() {
  if (!shellWindow || shellWindow.isDestroyed()) return;
  const [width, height] = getContentSize();

  // 标签栏：顶部 40px
  if (tabBarView) {
    tabBarView.setBounds({ x: 0, y: 0, width, height: TAB_BAR_HEIGHT });
  }

  // 内容区：40px 以下
  const contentBounds = {
    x: 0,
    y: TAB_BAR_HEIGHT,
    width,
    height: Math.max(0, height - TAB_BAR_HEIGHT),
  };
  const active = activeTabId ? tabs.get(activeTabId) : null;
  for (const tab of tabs.values()) {
    if (tab.closed) continue;
    if (tab === active) {
      tab.view.setVisible(true);
      tab.view.setBounds(contentBounds);
    } else {
      tab.view.setVisible(false);
    }
  }

  // 标签栏置顶（后加的在最上层；重新 add 会把视图移到顶层）
  if (tabBarView) {
    try { shellWindow.contentView.addChildView(tabBarView); } catch (_) {}
  }
}

// ========== 标签句柄（兼容 ipc.js 对 win.webContents 的使用）==========
function buildTabHandle(tab) {
  return {
    id: tab.tabId,
    get webContents() { return tab.view.webContents; },
    get _nativeWindow() { return shellWindow; },
    isDestroyed() {
      return !shellWindow || shellWindow.isDestroyed() || tab.closed;
    },
    focus() { if (shellWindow && !shellWindow.isDestroyed()) shellWindow.focus(); },
    isFocused() { return !!(shellWindow && !shellWindow.isDestroyed() && shellWindow.isFocused()); },
    flashFrame(flag) { if (shellWindow && !shellWindow.isDestroyed()) shellWindow.flashFrame(flag); },
    once(event, cb) { if (shellWindow && !shellWindow.isDestroyed()) shellWindow.once(event, cb); },
    setTitle() {},
    getTitle() { return tab.title || ''; },
  };
}

// ========== 壳页面通信 ==========
function notifyShell() {
  if (tabBarView && !tabBarView.webContents.isDestroyed()) {
    tabBarView.webContents.send('tabs-updated', {
      activeTabId,
      tabs: getOrderedTabs().map(t => ({
        tabId: t.tabId,
        title: t.title,
        name: t.name,
        profileId: t.profileId,
        providerId: t.providerId,
      })),
    });
  }
}

// ========== 标签操作 ==========
function getTab(tabId) { return tabs.get(tabId) || null; }
function getActiveTab() { return activeTabId ? tabs.get(activeTabId) || null : null; }
function getAllTabs() { return getOrderedTabs(); }

function getTabByProfileId(profileId) {
  for (const tab of tabs.values()) {
    if (tab.profileId === profileId && !tab.closed) return tab;
  }
  return null;
}

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

  // 挂到窗口（默认隐藏）
  try {
    shellWindow.contentView.addChildView(view);
    view.setVisible(false);
    view.setBounds({ x: 0, y: TAB_BAR_HEIGHT, width: 0, height: 0 });
  } catch (err) {
    console.error('[Tabs] 挂载视图失败:', err.message);
  }

  windowState.addContext(tab.handle, tab.profileId, tab.providerId, sessionStore);

  view.webContents.on('console-message', (_e, _level, message) => {
    try { console.log('[Renderer Console][' + tab.name + ']', message); } catch (_) {}
  });

  // 伪装为普通 Chrome（全局兜底 UA 已在 app 启动时设置）
  view.webContents.setUserAgent(userAgent.CHROME_UA);

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
  view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (tab.providerId) {
    view.webContents.loadURL(provider.homeUrl);
  } else {
    view.webContents.loadFile(path.join(__dirname, '..', 'ui', 'platform-select.html'));
  }

  profileManager.setLastActiveProfile(profileData.id);
  switchTab(tabId);

  const updater = require('./updater');
  if (getOrderedTabs().length === 1) {
    updater.initAutoUpdater(shellWindow);
  }

  writeTabsStore();
  notifyShell();
  console.log('[Tabs] 标签已创建 tabId=' + tabId + ' provider=' + (tab.providerId || '(未确定)') + ' name=' + tab.name);
  return tab;
}

function switchTab(tabId) {
  const tab = tabs.get(tabId);
  if (!tab || tab.closed) return false;
  activeTabId = tabId;
  windowState.setMainWindow(tab.handle);
  layoutAll();
  notifyShell();
  try { tab.view.webContents.focus(); } catch (_) {}
  writeTabsStore();
  return true;
}

function closeTab(tabId) {
  const tab = tabs.get(tabId);
  if (!tab) return false;
  tab.closed = true;

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
    layoutAll();
  }
  writeTabsStore();
  notifyShell();
  return true;
}

function reorderTabs(orderedIds) {
  if (!Array.isArray(orderedIds)) return false;
  const valid = orderedIds.filter(id => tabs.has(id));
  for (const id of tabOrder) {
    if (!valid.includes(id)) valid.push(id);
  }
  tabOrder = valid;
  writeTabsStore();
  notifyShell();
  return true;
}

function setTabProvider(tabId, providerId) {
  const tab = tabs.get(tabId);
  if (!tab) return { success: false, error: '标签不存在' };
  const provider = getProvider(providerId);
  if (!provider) return { success: false, error: '平台不存在: ' + providerId };

  const updatedProfile = profileManager.updateProfileProvider(tab.profileId, providerId);
  if (!updatedProfile) return { success: false, error: '更新账号失败' };

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

// ========== 创建壳窗口 ==========
/** 根据系统主题选择窗口图标（深色→白色图标，浅色→黑色图标） */
function getThemedIcon() {
  const name = nativeTheme.shouldUseDarkColors ? 'icon-dark.png' : 'icon-light.png';
  return path.join(__dirname, '..', 'ui', name);
}

/** 应用当前主题图标 + 背景色到壳窗口 */
function applyThemedIcon() {
  if (!shellWindow || shellWindow.isDestroyed()) return;
  try {
    shellWindow.setIcon(getThemedIcon());
  } catch (err) {
    console.error('[Tabs] 设置窗口图标失败:', err.message);
  }
  try {
    shellWindow.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#0d0f1a' : '#ffffff');
  } catch (err) {
    console.error('[Tabs] 设置窗口背景色失败:', err.message);
  }
}

function createShellWindow() {
  shellWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    title: 'Estrix Code Pro',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0d0f1a' : '#ffffff',
    // 容器窗口本身不加载页面，只承载 WebContentsView
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  // 标签栏视图
  tabBarView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: ['--estrix-user-data=' + app.getPath('userData')],
    },
  });
  shellWindow.contentView.addChildView(tabBarView);
  tabBarView.webContents.loadFile(path.join(__dirname, '..', 'ui', 'shell.html'));

  // 转发壳页面 console 到主进程
  tabBarView.webContents.on('console-message', (_e, _level, message) => {
    try { console.log('[Shell Console]', message); } catch (_) {}
  });

  tabBarView.webContents.on('did-finish-load', () => {
    console.log('[Tabs] 壳页面加载完成，开始恢复标签');
    restoreTabs();
    notifyShell();
  });

  shellWindow.on('resize', () => layoutAll());
  // 应用跟随系统主题的窗口图标
  applyThemedIcon();
  nativeTheme.on('updated', applyThemedIcon);
  shellWindow.maximize();
  layoutAll();

  shellWindow.on('closed', () => {
    nativeTheme.removeListener('updated', applyThemedIcon);
    shellWindow = null;
    tabBarView = null;
    tabs.clear();
    tabOrder = [];
    activeTabId = null;
  });

  console.log('[Tabs] 壳窗口已创建 id=' + shellWindow.id);
  return shellWindow;
}

function getShellWindow() { return shellWindow; }

async function flushAllSessions() {
  const promises = [];
  for (const ses of sessionsToFlush) {
    promises.push(ses.flushStorageData().catch(err => {
      console.error('[Tabs] 刷新 session 失败:', err.message);
    }));
  }
  await Promise.all(promises);
}

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
