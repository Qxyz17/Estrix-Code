/**
 * Estrix Code 主进程入口（单窗口 + 标签页版）
 * 由项目根目录 main.js 薄壳加载。
 *
 * 架构：一个壳窗口（BrowserWindow）承载标签栏（shell.html），
 * 每个标签是一个 WebContentsView，绑定独立 profile（平台+账号）与 partition，
 * 登录态由 Electron 自动持久化，重启后复用。
 */
const { app, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const windowState = require('./window');
const profileManager = require('./profile-manager');
const tabManager = require('./tab-manager');
const { getProvider, getAllProviders } = require('../providers');
const updater = require('./updater');

// ========== 持久化会话配置 ==========
console.log('[Estrix Code] Session 数据目录:', app.getPath('userData'));

// 渲染进程日志输出目录（仅开发环境持久化；打包版不写日志文件）
const RENDERER_LOG_DIR = app.isPackaged
  ? null
  : path.join(app.getPath('userData'), 'logs');
if (RENDERER_LOG_DIR) {
  fs.mkdirSync(RENDERER_LOG_DIR, { recursive: true });
  try {
    for (const f of fs.readdirSync(RENDERER_LOG_DIR)) {
      if (f.endsWith('.log')) fs.writeFileSync(path.join(RENDERER_LOG_DIR, f), '', 'utf-8');
    }
  } catch (err) {
    console.warn('[Estrix Code] 清空平台日志失败:', err.message);
  }
}

const { registerIpcHandlers } = require('./ipc');

// ========== 应用菜单 ==========
function setupAppMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建标签',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            const profiles = profileManager.readProfiles();
            tabManager.createTab(profileManager.createProfile('账号' + (profiles.length + 1), ''));
          }
        },
        {
          label: '关闭当前标签',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const tab = tabManager.getActiveTab();
            if (tab) tabManager.closeTab(tab.tabId);
          }
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'delete', label: '删除' },
        { type: 'separator' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '导航',
      submenu: [
        {
          label: '后退',
          accelerator: 'Alt+Left',
          click: () => {
            const tab = tabManager.getActiveTab();
            if (tab && !tab.closed) tab.view.webContents.navigationHistory.goBack();
          }
        },
        {
          label: '前进',
          accelerator: 'Alt+Right',
          click: () => {
            const tab = tabManager.getActiveTab();
            if (tab && !tab.closed) tab.view.webContents.navigationHistory.goForward();
          }
        },
        { type: 'separator' },
        {
          label: '重新加载',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            const tab = tabManager.getActiveTab();
            if (tab && !tab.closed) tab.view.webContents.reload();
          }
        },
        {
          label: '停止加载',
          accelerator: 'Esc',
          click: () => {
            const tab = tabManager.getActiveTab();
            if (tab && !tab.closed) tab.view.webContents.stop();
          }
        },
        { type: 'separator' },
        {
          label: '主页',
          click: () => {
            const tab = tabManager.getActiveTab();
            if (tab && tab.providerId) {
              const provider = getProvider(tab.providerId);
              if (provider) tab.view.webContents.loadURL(provider.homeUrl);
            }
          }
        }
      ]
    },
    {
      label: '查看',
      submenu: [
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '开发者工具' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        { type: 'separator' },
        { role: 'front', label: '全部置于顶层' },
        { type: 'separator' },
        { role: 'close', label: '关闭窗口' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '检查更新', click: () => updater.checkForUpdates() },
        { type: 'separator' },
        { role: 'about', label: '关于 Estrix Code' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ========== IPC 处理器 ==========
registerIpcHandlers();

// —— 标签相关 IPC ——
ipcMain.handle('tabs-list', async () => ({
  success: true,
  activeTabId: tabManager.getActiveTab() ? tabManager.getActiveTab().tabId : null,
  tabs: tabManager.getOrderedTabs().map(t => ({
    tabId: t.tabId, title: t.title, name: t.name,
    profileId: t.profileId, providerId: t.providerId,
  })),
}));

// 新建标签：
//  - 传 profileId：用已有账号打开（允许同账号多标签）
//  - 传 providerId（且无 profileId）：为该平台新建账号后打开
//  - 都不传：新建"未确定平台"账号（显示平台选择页）
ipcMain.handle('tabs-create', async (_event, { profileId, providerId } = {}) => {
  let profile = null;
  if (profileId) {
    profile = profileManager.getProfileById(profileId);
    if (!profile) return { success: false, error: '账号不存在' };
  } else {
    const profiles = profileManager.readProfiles();
    const pid = providerId || '';
    profile = profileManager.createProfile('账号' + (profiles.length + 1), pid);
  }
  // 记录该平台上次使用的账号
  if (profile.providerId) {
    profileManager.setLastProfileForProvider(profile.providerId, profile.id);
  }
  const tab = tabManager.createTab(profile);
  return { success: true, tabId: tab.tabId };
});

// 点"+ 新建标签"：弹出原生菜单（原生层浮于 WebContentsView 之上），选择账号/新建
ipcMain.handle('tabs-create-menu', async () => {
  const { Menu } = require('electron');
  const profiles = profileManager.readProfiles();
  const { getAllProviders } = require('../providers');

  const items = [];
  for (const p of getAllProviders()) {
    const accounts = profiles.filter(x => x.providerId === p.id);
    if (accounts.length === 0) continue;
    const last = profileManager.getLastProfileForProvider(p.id);
    items.push({ label: p.name, enabled: false });
    for (const a of accounts) {
      const isLast = last && last.id === a.id;
      items.push({
        label: '  ' + a.name + (isLast ? '  (上次)' : ''),
        click: () => {
          profileManager.setLastProfileForProvider(p.id, a.id);
          tabManager.createTab(a);
        },
      });
    }
    items.push({ type: 'separator' });
  }
  const unknown = profiles.filter(x => !x.providerId);
  if (unknown.length > 0) {
    items.push({ label: '未选平台', enabled: false });
    for (const a of unknown) {
      items.push({ label: '  ' + a.name, click: () => tabManager.createTab(a) });
    }
    items.push({ type: 'separator' });
  }
  items.push({
    label: '＋ 新建账号',
    click: () => {
      const all = profileManager.readProfiles();
      const profile = profileManager.createProfile('账号' + (all.length + 1), '');
      tabManager.createTab(profile);
    },
  });

  const win = tabManager.getShellWindow();
  Menu.buildFromTemplate(items).popup({ window: win });
  return { success: true };
});

// 账号列表（按平台分组 + 标记每平台上次使用的账号），供"+ 新建标签"选择
ipcMain.handle('accounts-list', async () => {
  const profiles = profileManager.readProfiles();
  const { getAllProviders } = require('../providers');
  const groups = getAllProviders().map(p => ({
    providerId: p.id,
    providerName: p.name,
    lastProfileId: (profileManager.getLastProfileForProvider(p.id) || {}).id || null,
    accounts: profiles
      .filter(x => x.providerId === p.id)
      .map(x => ({ id: x.id, name: x.name, providerId: x.providerId })),
  })).filter(g => g.accounts.length > 0);

  // 平台未确定的账号
  const unknown = profiles
    .filter(x => !x.providerId)
    .map(x => ({ id: x.id, name: x.name, providerId: '' }));

  return { success: true, groups, unknown };
});

ipcMain.handle('tabs-switch', async (_event, { tabId } = {}) => {
  return { success: tabManager.switchTab(tabId) };
});

ipcMain.handle('tabs-close', async (_event, { tabId } = {}) => {
  return { success: tabManager.closeTab(tabId) };
});

ipcMain.handle('tabs-reorder', async (_event, { orderedIds } = {}) => {
  return { success: tabManager.reorderTabs(orderedIds) };
});

// 平台选择（标签内）
ipcMain.handle('select-platform', async (event, { providerId } = {}) => {
  if (!providerId) return { success: false, error: '缺少平台ID' };
  const ctx = windowState.getContextByWebContents(event.sender);
  if (!ctx) return { success: false, error: '标签上下文不存在' };
  const tab = tabManager.getTab(ctx.win && ctx.win.id);
  if (!tab) return { success: false, error: '标签不存在' };
  return tabManager.setTabProvider(tab.tabId, providerId);
});

// 兼容旧接口：新建（标签）
ipcMain.handle('create-profile-window', async (_event, { providerId } = {}) => {
  const profiles = profileManager.readProfiles();
  const pid = providerId || '';
  const profile = profileManager.createProfile('账号' + (profiles.length + 1), pid);
  tabManager.createTab(profile);
  return { success: true };
});

ipcMain.handle('list-profiles', async () => ({
  success: true,
  profiles: profileManager.readProfiles(),
}));

// 打开指定账号的标签（允许同账号多标签，总是新开）
ipcMain.handle('open-profile-window', async (_event, { profileId } = {}) => {
  const profile = profileManager.getProfileById(profileId);
  if (!profile) return { success: false, error: '账号不存在' };
  if (profile.providerId) {
    profileManager.setLastProfileForProvider(profile.providerId, profile.id);
  }
  tabManager.createTab(profile);
  return { success: true, focused: false };
});

// 关闭标签（仅关界面，保留账号与登录态）
ipcMain.handle('close-profile-tab', async (_event, { profileId } = {}) => {
  if (!profileId) return { success: false, error: '缺少账号ID' };
  const tab = tabManager.getTabByProfileId(profileId);
  if (tab) tabManager.closeTab(tab.tabId);
  return { success: true };
});

// 删除账号（关闭其标签 + 删除 profile 记录 + 清除该账号 partition 的持久化数据）
ipcMain.handle('delete-profile', async (_event, { profileId } = {}) => {
  if (!profileId) return { success: false, error: '缺少账号ID' };
  const profile = profileManager.getProfileById(profileId);
  if (!profile) return { success: false, error: '账号不存在' };

  // 先取到该账号标签的 session，用于清空持久化数据（cookies/storage）
  const tab = tabManager.getTabByProfileId(profileId);
  const session = tab ? tab.session : null;

  // 关闭标签（若已打开）
  if (tab) tabManager.closeTab(tab.tabId);

  // 清空 partition 数据：优先用标签 session；否则按 partition 取
  try {
    let ses = session;
    if (!ses && profile.partition) {
      ses = require('electron').session.fromPartition(profile.partition);
    }
    if (ses) await ses.clearStorageData();
  } catch (err) {
    console.error('[Profile] 清除账号存储数据失败:', err.message);
  }

  const ok = profileManager.deleteProfile(profileId);
  return { success: ok, error: ok ? null : '账号不存在' };
});

// 更新标签/账号名称
ipcMain.handle('update-window-name', async (event, { displayName } = {}) => {
  if (!displayName || !displayName.trim()) return { success: false };
  const ctx = windowState.getContextByWebContents(event.sender);
  if (!ctx) return { success: false, error: '标签上下文不存在' };
  const tab = tabManager.getTab(ctx.win && ctx.win.id);
  if (!tab) return { success: false };
  const updated = tabManager.setTabName(tab.tabId, displayName);
  return { success: !!updated, name: updated ? updated.name : null };
});

// 平台列表
ipcMain.handle('list-providers', async () => ({
  success: true,
  providers: getAllProviders().map(p => ({
    id: p.id, name: p.name, custom: !!p._customPath, path: p._customPath || null,
  })),
}));

// 导入自定义 Provider
ipcMain.handle('import-provider', async (_event, { replace = false } = {}) => {
  const win = tabManager.getShellWindow();
  const result = dialog.showOpenDialogSync(win, {
    properties: ['openFile'],
    filters: [{ name: 'JavaScript', extensions: ['js'] }],
    title: '选择自定义 Provider 文件',
  });
  if (!result || result.length === 0) return { success: false, canceled: true };

  const filePath = result[0];
  const { importCustomProvider } = require('../providers/custom/loader');
  try {
    const res = importCustomProvider(filePath, { replace });
    if (res.exists && !replace) {
      const confirmRes = await dialog.showMessageBox(win, {
        type: 'question', buttons: ['取消', '替换'], defaultId: 0, cancelId: 0,
        title: 'Provider 已存在',
        message: '已导入过 id 为 "' + res.provider.id + '" 的 Provider，是否替换？',
      });
      if (confirmRes.response !== 1) return { success: false, canceled: true };
      const finalRes = importCustomProvider(filePath, { replace: true });
      return { success: true, provider: { id: finalRes.provider.id, name: finalRes.provider.name, path: finalRes.targetPath } };
    }
    return { success: true, provider: { id: res.provider.id, name: res.provider.name, path: res.targetPath } };
  } catch (err) {
    return { success: false, error: '加载失败: ' + err.message };
  }
});

// 删除自定义 Provider
ipcMain.handle('remove-provider', async (_event, { path: filePath, providerId } = {}) => {
  if (!filePath) return { success: false, error: '缺少文件路径' };
  const usingTabs = tabManager.getAllTabs().filter(t => t.providerId === providerId);
  if (usingTabs.length > 0) {
    return { success: false, error: '以下标签正在使用此 Provider，请先切换平台再删除：' + usingTabs.map(t => t.name).join('、') };
  }
  const { removeCustomProviderPath } = require('../providers/custom/loader');
  removeCustomProviderPath(filePath);
  return { success: true };
});

// 替换自定义 Provider
ipcMain.handle('replace-provider', async (_event, { providerId } = {}) => {
  if (!providerId) return { success: false, error: '缺少 providerId' };
  const win = tabManager.getShellWindow();
  const result = dialog.showOpenDialogSync(win, {
    properties: ['openFile'],
    filters: [{ name: 'JavaScript', extensions: ['js'] }],
    title: '选择新的 Provider 文件（id 必须为 ' + providerId + '）',
  });
  if (!result || result.length === 0) return { success: false, canceled: true };
  const filePath = result[0];
  const { replaceCustomProvider } = require('../providers/custom/loader');
  try {
    const res = replaceCustomProvider(providerId, filePath);
    return { success: true, provider: { id: res.provider.id, name: res.provider.name, path: res.targetPath } };
  } catch (err) {
    return { success: false, error: '替换失败: ' + err.message };
  }
});

// ========== MCP 相关 IPC ==========
const mcpConfig = require('./mcp-config');
const mcpClient = require('./mcp-client');

ipcMain.handle('list-mcp-servers', async () => {
  const servers = mcpConfig.getServers();
  const connected = new Set(mcpClient.getConnectedServers().map(s => s.name));
  return { success: true, servers: servers.map(s => ({ ...s, connected: connected.has(s.name) })) };
});
ipcMain.handle('upsert-mcp-server', async (_event, { server } = {}) => {
  if (!server || !server.name || !server.type) return { success: false, error: 'server 配置不完整（需要 name 和 type）' };
  mcpConfig.upsertServer(server);
  return { success: true };
});
ipcMain.handle('remove-mcp-server', async (_event, { name } = {}) => {
  await mcpClient.disconnectServerByName(name);
  mcpConfig.removeServer(name);
  return { success: true };
});
ipcMain.handle('enable-mcp-server', async (_event, { name } = {}) => {
  try {
    mcpConfig.setServerEnabled(name, true);
    await mcpClient.connectServerByName(name);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
ipcMain.handle('disable-mcp-server', async (_event, { name } = {}) => {
  mcpConfig.setServerEnabled(name, false);
  await mcpClient.disconnectServerByName(name);
  return { success: true };
});
ipcMain.handle('get-mcp-tools', async () => ({ success: true, tools: mcpClient.getMcpToolList() }));

// ========== 单实例锁 ==========
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = tabManager.getShellWindow();
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    setupAppMenu();
    tabManager.createShellWindow();
    // 壳页面加载完成后恢复标签布局
    const shell = tabManager.getShellWindow();
    shell.webContents.on('did-finish-load', () => {
      console.log('[Tabs] 壳页面加载完成，开始恢复标签');
      tabManager.restoreTabs();
      tabManager.notifyShell();
    });

    mcpClient.connectEnabledServers().catch(err => {
      console.error('[MCP] 初始化连接失败:', err.message);
    });
  });
}

app.on('window-all-closed', () => {
  app.quit();
});

// 退出前刷新所有 session 数据
let quitFlushed = false;
app.on('before-quit', (event) => {
  if (quitFlushed) return;
  event.preventDefault();
  quitFlushed = true;
  tabManager.flushAllSessions().finally(() => app.quit());
});

app.on('activate', () => {
  if (!tabManager.getShellWindow()) {
    tabManager.createShellWindow();
    const shell = tabManager.getShellWindow();
    shell.webContents.on('did-finish-load', () => {
      tabManager.restoreTabs();
      tabManager.notifyShell();
    });
  }
});
