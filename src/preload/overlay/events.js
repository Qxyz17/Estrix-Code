/**
 * 覆盖层按钮事件绑定
 * 由原 preload.js 拆分而来，逻辑保持不变。
 */
const state = require('../dom/state');
const { hideOverlay, showOverlay, renderHistory, commandHistory, showToast, showConfirmDialog, hideFirstTimeDialog } = require('./ui');
const { handleInitProject, renderSessions } = require('../dom/session-list');
const { handleManualParse } = require('../dom/observer');
const { sendToChat } = require('../dom/chat-input');

/**
 * 渲染窗口列表（浮动管理面板内）
 */
async function renderWindowList() {
  const list = document.getElementById('estrix-window-list');
  if (!list) return;
  try {
    const res = await window.electronAPI.listProfiles();
    const profiles = res && res.success ? res.profiles : [];
    if (!profiles || profiles.length === 0) {
      list.innerHTML = '<div class="estrix-session-empty">暂无账号</div>';
      return;
    }
    // 获取平台名映射
    const providerMap = {};
    try {
      const pvRes = await window.electronAPI.listProviders();
      if (pvRes && pvRes.success) {
        (pvRes.providers || []).forEach(pv => { providerMap[pv.id] = pv.name; });
      }
    } catch (_) {}

    list.innerHTML = profiles.map(p => {
      const pname = providerMap[p.providerId] || '平台';
      return '<div class="estrix-window-item" data-profile-id="' + p.id + '">' +
        '<span class="estrix-window-left">' +
          '<span class="estrix-window-name">' + p.name + '</span>' +
          '<span class="estrix-window-sep">|</span>' +
          '<span class="estrix-window-status">' + pname + '</span>' +
        '</span>' +
        '<span class="estrix-window-del" data-profile-id="' + p.id + '" title="删除窗口">删除</span>' +
      '</div>';
    }).join('');
    list.querySelectorAll('.estrix-window-item').forEach(el => {
      el.addEventListener('click', async (e) => {
        // 点击删除按钮不触发切换
        if (e.target.classList.contains('estrix-window-del')) return;
        const profileId = el.dataset.profileId;
        try {
          const r = await window.electronAPI.openProfileWindow(profileId);
          if (r && r.success) {
            showToast(r.focused ? '已切换到该账号' : '已打开账号', 2000);
            closeWindowManager();
          } else {
            showToast((r && r.error) || '打开失败', 3000);
          }
        } catch (err) {
          showToast('打开账号失败: ' + (err.message || err), 3000);
        }
      });
    });
    // 绑定删除按钮
    list.querySelectorAll('.estrix-window-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const profileId = btn.dataset.profileId;
        const nameEl = btn.closest('.estrix-window-item')?.querySelector('.estrix-window-name');
        const name = nameEl ? nameEl.textContent : '该账号';
        // 删除账号会清除其登录数据，不可恢复，先确认
        const confirmed = await showConfirmDialog(
          '确定删除「' + name + '」吗？\n\n该账号的登录状态与本地数据将被清除，且不可恢复。',
          { okText: '删除', showCancel: true, cancelText: '取消' }
        );
        if (!confirmed) return;
        try {
          const r = await window.electronAPI.deleteProfileWindow(profileId);
          if (r && r.success) {
            showToast('已删除账号', 2000);
            await renderWindowList();
          } else {
            showToast((r && r.error) || '删除失败', 3000);
          }
        } catch (err) {
          showToast('删除失败: ' + (err.message || err), 3000);
        }
      });
    });
  } catch (err) {
    list.innerHTML = '<div class="estrix-session-empty">加载失败</div>';
  }
}

/**
 * 打开窗口管理浮动面板
 */
function openWindowManager() {
  const panel = document.getElementById('estrix-window-manager');
  if (panel) {
    panel.classList.remove('estrix-hidden');
    renderWindowList();
  }
}

/**
 * 关闭窗口管理浮动面板
 */
function closeWindowManager() {
  const panel = document.getElementById('estrix-window-manager');
  if (panel) panel.classList.add('estrix-hidden');
}

/**
 * 生成项目说明文档按钮点击处理
 */
function handleGenerateDoc() {
  const message = '根据当前项目生成一个类似 claude.md 的项目说明文件，并将文件放到当前项目 .estrixCode/ESTRIX.md';
  if (!sendToChat(message, '生成文档', 300)) {
    showToast('未找到输入框，请确保已打开聊天界面', 3000);
  }
}

/**
 * 加载配置到 JSON 框
 */
async function loadMcpConfigToJson() {
  const res = await window.electronAPI.listMcpServers();
  const servers = res && res.success ? res.servers : [];
  // 转成主流 mcpServers 格式
  const mcpServers = {};
  for (const s of servers) {
    const def = {};
    if (s.type === 'http') {
      if (s.url) def.url = s.url;
      if (s.headers) def.headers = s.headers;
    } else {
      if (s.command) def.command = s.command;
      if (s.args && s.args.length) def.args = s.args;
      if (s.env) def.env = s.env;
    }
    mcpServers[s.name] = def;
  }
  const jsonInput = document.getElementById('estrix-mcp-json');
  if (jsonInput) jsonInput.value = JSON.stringify({ mcpServers }, null, 2);
}

/**
 * 渲染 MCP server 列表
 */
async function renderMcpList() {
  const list = document.getElementById('estrix-mcp-list');
  if (!list) return;
  try {
    const res = await window.electronAPI.listMcpServers();
    const servers = res && res.success ? res.servers : [];
    if (!servers || servers.length === 0) {
      list.innerHTML = '<div class="estrix-session-empty">暂无 MCP Server</div>';
      return;
    }
    list.innerHTML = servers.map(s => {
      const status = s.connected ? '已连接' : (s.enabled ? '未连接' : '已禁用');
      const statusColor = s.connected ? '#4ade80' : (s.enabled ? '#ffc107' : '#5d6280');
      return '<div class="estrix-window-item estrix-mcp-item" data-mcp-name="' + s.name + '">' +
        '<span class="estrix-window-name">' + s.name + '</span>' +
        '<span class="estrix-mcp-dot" style="width:8px;height:8px;border-radius:50%;background:' + statusColor + ';flex-shrink:0;" title="' + status + '"></span>' +
      '</div>';
    }).join('');

    list.querySelectorAll('.estrix-mcp-item').forEach(el => {
      el.addEventListener('click', async () => {
        const name = el.dataset.mcpName;
        const server = servers.find(s => s.name === name);
        if (!server) return;

        // 点击后立即显示 loading
        const dot = el.querySelector('.estrix-mcp-dot');
        if (dot) dot.style.background = '#ffc107';
        el.style.pointerEvents = 'none';

        try {
          if (server.connected || server.enabled) {
            // 已连接或已启用 → 断开/禁用
            await window.electronAPI.disableMcpServer(name);
            showToast('已断开 ' + name, 2000);
          } else {
            // 未启用 → 连接
            await window.electronAPI.enableMcpServer(name);
            showToast('已连接 ' + name, 2000);
          }
          await renderMcpList();
          await loadMcpConfigToJson();
        } catch (err) {
          showToast('操作失败: ' + (err.message || err), 3000);
          await renderMcpList();
        }
      });
    });
  } catch (err) {
    list.innerHTML = '<div class="estrix-session-empty">加载失败</div>';
  }
}

/**
 * 打开 MCP 管理面板
 */
function openMcpManager() {
  const panel = document.getElementById('estrix-mcp-manager');
  if (panel) {
    panel.classList.remove('estrix-hidden');
    renderMcpList();
    loadMcpConfigToJson();
  }
}

/**
 * 关闭 MCP 管理面板
 */
function closeMcpManager() {
  const panel = document.getElementById('estrix-mcp-manager');
  if (panel) panel.classList.add('estrix-hidden');
}

/**
 * 绑定覆盖层所有 UI 事件
 * 包括按钮点击、键盘快捷键、状态徽章点击等
 */
let eventsBound = false;
let mcpSending = false; // 防止 MCP 信息重复发送

function bindEvents() {
  // 防止重复绑定（SPA 导航或 preload 重载时可能导致多次执行）
  if (eventsBound) return;
  eventsBound = true;

  // 从 localStorage 恢复延迟配置
  try {
    const savedMin = localStorage.getItem('estrix-send-delay-min');
    const savedMax = localStorage.getItem('estrix-send-delay-max');
    if (savedMin) state.sendDelayMin = parseInt(savedMin, 10) || 2000;
    if (savedMax) state.sendDelayMax = parseInt(savedMax, 10) || 4000;
    // 同步到输入框
    const minInput = document.getElementById('estrix-delay-min');
    const maxInput = document.getElementById('estrix-delay-max');
    if (minInput) minInput.value = state.sendDelayMin;
    if (maxInput) maxInput.value = state.sendDelayMax;
  } catch (e) {}

  const minimizeBtn = document.getElementById('estrix-btn-minimize');
  const initBtn = document.getElementById('estrix-btn-init');
  const clearBtn = document.getElementById('estrix-btn-clear');

  minimizeBtn?.addEventListener('click', hideOverlay);
  initBtn?.addEventListener('click', handleInitProject);

  // 首次使用提示浮窗：初始化按钮（与右侧初始化项目逻辑一致）
  const firstInitBtn = document.getElementById('estrix-btn-first-init');
  firstInitBtn?.addEventListener('click', handleInitProject);

  // 首次使用提示浮窗：关闭按钮
  const firstCloseBtn = document.getElementById('estrix-btn-first-close');
  firstCloseBtn?.addEventListener('click', hideFirstTimeDialog);
  clearBtn?.addEventListener('click', () => {
    commandHistory.length = 0;
    renderHistory();
  });

  // 手动解析按钮
  const manualParseBtn = document.getElementById('estrix-btn-manual-parse');
  manualParseBtn?.addEventListener('click', handleManualParse);

  // 窗口管理按钮：打开浮动管理面板
  const windowManagerBtn = document.getElementById('estrix-btn-window-manager');
  windowManagerBtn?.addEventListener('click', () => {
    openWindowManager();
  });

  // MCP 按钮：打开 MCP 管理面板
  const mcpBtn = document.getElementById('estrix-btn-mcp');
  mcpBtn?.addEventListener('click', openMcpManager);

  // MCP 面板：关闭
  const mcpCloseBtn = document.getElementById('estrix-mcp-close');
  mcpCloseBtn?.addEventListener('click', closeMcpManager);

  // MCP 面板：刷新
  const mcpRefreshBtn = document.getElementById('estrix-mcp-refresh');
  mcpRefreshBtn?.addEventListener('click', renderMcpList);

  // MCP 面板：保存配置
  const mcpSaveBtn = document.getElementById('estrix-mcp-save');
  mcpSaveBtn?.addEventListener('click', async () => {
    const jsonInput = document.getElementById('estrix-mcp-json');
    if (!jsonInput || !jsonInput.value.trim()) {
      showToast('请输入配置', 3000);
      return;
    }
    try {
      const parsed = JSON.parse(jsonInput.value);
      if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
        showToast('配置格式错误，需要 mcpServers 对象', 3000);
        return;
      }

      // 校验每个 server 定义是否完整合法（发现错误立即中止，不删旧配置、不覆盖编辑框）
      for (const [name, def] of Object.entries(parsed.mcpServers)) {
        if (!def || typeof def !== 'object' || Array.isArray(def)) {
          showToast('配置错误：server "' + name + '" 的定义必须是对象', 4000);
          return;
        }
        const hasUrl = def.url !== undefined;
        const hasCommand = def.command !== undefined;
        if (hasUrl) {
          if (typeof def.url !== 'string' || !def.url.trim()) {
            showToast('配置错误：server "' + name + '" 的 url 必须是非空字符串', 4000);
            return;
          }
          if (hasCommand) {
            showToast('配置错误：server "' + name + '" 不能同时指定 url 和 command', 4000);
            return;
          }
        } else if (hasCommand) {
          if (typeof def.command !== 'string' || !def.command.trim()) {
            showToast('配置错误：server "' + name + '" 的 command 必须是非空字符串', 4000);
            return;
          }
        } else {
          showToast('配置错误：server "' + name + '" 缺少 command 或 url', 4000);
          return;
        }
        if (def.args !== undefined && !Array.isArray(def.args)) {
          showToast('配置错误：server "' + name + '" 的 args 必须是数组', 4000);
          return;
        }
        if (def.env !== undefined && (typeof def.env !== 'object' || def.env === null || Array.isArray(def.env))) {
          showToast('配置错误：server "' + name + '" 的 env 必须是对象', 4000);
          return;
        }
        if (def.headers !== undefined && (typeof def.headers !== 'object' || def.headers === null || Array.isArray(def.headers))) {
          showToast('配置错误：server "' + name + '" 的 headers 必须是对象', 4000);
          return;
        }
      }

      // 先删除 JSON 里不存在的旧 server
      const oldRes = await window.electronAPI.listMcpServers();
      const oldServers = (oldRes && oldRes.success && oldRes.servers) || [];
      const newNames = new Set(Object.keys(parsed.mcpServers));
      for (const old of oldServers) {
        if (!newNames.has(old.name)) {
          await window.electronAPI.removeMcpServer(old.name);
        }
      }

      // 逐个 upsert 新配置
      for (const [name, def] of Object.entries(parsed.mcpServers)) {
        const server = {
          name,
          type: def && def.url ? 'http' : 'stdio',
          command: def && def.command,
          args: def && def.args || [],
          url: def && def.url,
          headers: def && def.headers,
          env: def && def.env,
        };
        await window.electronAPI.upsertMcpServer(server);
      }
      showToast('配置已保存', 2200);
      await renderMcpList();
      await loadMcpConfigToJson();
      // 询问用户是否将 MCP 更新通知发给 AI（不自动发送）
      try {
        const confirmed = await showConfirmDialog(
          'MCP 配置已保存。\n\n是否告诉 AI 配置已更新？\n（请确保 AI 当前没有正在进行其他操作）',
          { okText: '发送', showCancel: true, cancelText: '取消' }
        );
        if (!confirmed) return;

        const res = await window.electronAPI.getMcpTools();
        const tools = res && res.success ? res.tools : [];
        const serverNames = Array.from(new Set(tools.map(t => t.server)));
        let msg = '【MCP 配置已更新】\n\n';
        if (serverNames.length === 0) {
          msg += '当前没有已连接的 MCP server。';
        } else {
          msg += '可用的 MCP server：' + serverNames.join('、') + '。\n';
          msg += '需要时用 mcpListServers() 查看概览，或用 mcpGetTools(serverName) 查看具体工具。';
        }
        sendToChat(msg, 'MCP信息', 300);
      } catch (err) {
        console.error('[Estrix Code] 发送 MCP 信息失败:', err);
      }
    } catch (err) {
      showToast('保存失败: ' + (err.message || err), 3000);
    }
  });



  // 浮动面板：新建窗口（不指定平台，让窗口显示平台选择页）
  const wmNewWindowBtn = document.getElementById('estrix-wm-new-window');
  wmNewWindowBtn?.addEventListener('click', async () => {
    try {
      await window.electronAPI.createProfileWindow();
      showToast('已打开平台选择', 2200);
      await renderWindowList();
    } catch (err) {
      showToast('创建新窗口失败: ' + (err.message || err), 3000);
    }
  });

  // 浮动面板：关闭
  const wmCloseBtn = document.getElementById('estrix-wm-close');
  wmCloseBtn?.addEventListener('click', closeWindowManager);

  // 浮动面板：刷新列表
  const wmRefreshBtn = document.getElementById('estrix-wm-refresh');
  wmRefreshBtn?.addEventListener('click', renderWindowList);

  // 生成项目说明文档按钮
  const genDocBtn = document.getElementById('estrix-btn-gen-doc');
  genDocBtn?.addEventListener('click', handleGenerateDoc);

  // 沉浸式交流按钮
  const immersiveBtn = document.getElementById('estrix-btn-immersive');
  immersiveBtn?.addEventListener('click', () => {
    const message = '现在你的任何疑问,或没有疑问的选择都需要和我确认 , 确认的方式是 你问一个问题我回答一个问题,然后你再问下一个问题, 最好给我选项, 也要给我个其他的选项, 谢谢 爱你哦';
    if (!sendToChat(message, '沉浸式交流', 300)) {
      showToast('未找到输入框，请确保已打开聊天界面', 3000);
    } else {
      showToast('已发送沉浸式交流提示', 2200);
    }
  });

  // 刷新会话列表按钮
  const refreshSessionsBtn = document.getElementById('estrix-btn-refresh-sessions');
  refreshSessionsBtn?.addEventListener('click', renderSessions);

  // 保存延迟设置按钮
  const saveDelayBtn = document.getElementById('estrix-btn-save-delay');
  const delayMinInput = document.getElementById('estrix-delay-min');
  const delayMaxInput = document.getElementById('estrix-delay-max');
  saveDelayBtn?.addEventListener('click', () => {
    const min = parseInt(delayMinInput?.value, 10);
    const max = parseInt(delayMaxInput?.value, 10);
    if (Number.isNaN(min) || min < 0) { showToast('最小延迟必须是非负整数', 3000); return; }
    if (Number.isNaN(max) || max < min) { showToast('最大延迟不能小于最小延迟', 3000); return; }
    if (max > 10000) { showToast('最大延迟不能超过 10000ms', 3000); return; }
    state.sendDelayMin = min;
    state.sendDelayMax = max;
    // 保存到 localStorage
    try {
      localStorage.setItem('estrix-send-delay-min', String(min));
      localStorage.setItem('estrix-send-delay-max', String(max));
    } catch (e) {}
    showToast('延迟设置已保存：' + min + ' - ' + max + ' ms', 3000);
  });

  // 悬浮球点击切换面板显隐
  const statusBadge = document.getElementById('estrix-status-badge');
  statusBadge?.addEventListener('click', () => {
    const overlay = document.getElementById('estrix-overlay');
    if (!overlay) return;
    if (overlay.classList.contains('estrix-hidden')) {
      showOverlay();
    } else {
      hideOverlay();
    }
  });

  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+C 切换覆盖层显示
    if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
      e.preventDefault();
      const overlay = document.getElementById('estrix-overlay');
      if (overlay) {
        if (overlay.classList.contains('estrix-hidden')) {
          showOverlay();
        } else {
          hideOverlay();
        }
      }
    }
    // Esc 隐藏覆盖层和窗口管理面板
    if (e.key === 'Escape') {
      hideOverlay();
      closeWindowManager();
      closeMcpManager();
      hideFirstTimeDialog();
    }
  });
}

module.exports = bindEvents;
