/**
 * Estrix Code preload 入口
 * 原 preload.js 的全部逻辑拆分为本目录下的模块，此处负责组装与初始化，
 * 初始化时序与原文件保持一致。
 */
console.log('[Estrix Code] Preload script 开始执行');

// 暴露 electronAPI 到渲染进程（contextBridge + window 兜底）
require('./api');

// 壳页面（标签栏 shell.html）：只需要 electronAPI，不注入平台扩展 UI/拦截器
const isShellPage = typeof window !== 'undefined' &&
  window.location && /shell\.html$/i.test(window.location.pathname || '');
if (isShellPage) {
  console.log('[Estrix Code] 壳页面，跳过平台扩展初始化');
  // 提前结束，避免注入悬浮球/覆盖层等
  module.exports = {};
} else {

const { webFrame } = require('electron');
const ui = require('./overlay/ui');
const projectDir = require('./overlay/project-dir');
const bindEvents = require('./overlay/events');
const observer = require('./dom/observer');
const chatInput = require('./dom/chat-input');
const { getProviderByUrl } = require('../providers');

// ========== 平台识别 ==========
// 在 init 之前先判断当前平台，决定走"网络拦截"还是"DOM 抓取"模式
const currentProvider = getProviderByUrl(window.location.href);
const useIntercept = !!(currentProvider && currentProvider.useIntercept);
console.log('[Estrix Code] 平台=' + (currentProvider ? currentProvider.id : 'unknown') +
  ', 模式=' + (useIntercept ? '网络拦截' : 'DOM 抓取'));

// ========== 主世界注入（拦截模式）==========
// 必须在页面脚本执行前把 hook 注入到主世界，才能覆盖到 window.fetch / XHR。
// preload 早于页面脚本执行，此处的 executeJavaScript 落在主世界。
if (useIntercept) {
  try {
    const hookByProvider = {
      deepseek: () => require('../interceptor/deepseek-hook').deepseekHookSource(),
      claude: () => require('../interceptor/claude-hook').claudeHookSource(),
      chatgpt: () => require('../interceptor/chatgpt-hook').chatgptHookSource(),
      glm: () => require('../interceptor/glm-hook').glmHookSource(),
    };
    const getSource = hookByProvider[currentProvider.id];
    if (getSource) {
      webFrame.executeJavaScript(getSource()).then(
        () => console.log('[Estrix Code] 主世界拦截器注入成功 (' + currentProvider.id + ')'),
        (err) => console.error('[Estrix Code] 主世界拦截器注入失败:', err && err.message)
      );
    } else {
      console.warn('[Estrix Code] 未找到 ' + currentProvider.id + ' 的拦截器实现');
    }
  } catch (err) {
    console.error('[Estrix Code] 加载拦截器失败:', err);
  }
}

// 注册主进程消息监听（与原 preload.js 顶层注册时机一致）
chatInput.registerIpcListeners();

// ========== 初始化 ==========

/**
 * 初始化 Estrix Code 扩展
 * 注入样式、覆盖层 HTML，绑定事件，启动回复监听（拦截或 DOM 观察）
 */
function init() {
  try {
    ui.injectCSS();
    ui.injectOverlay();
    projectDir.initProjectDirSection();
    bindEvents();
    ui.updateHomeMode();

    // 监听 URL 变化（SPA 路由）
    window.addEventListener('popstate', ui.updateHomeMode);
    window.addEventListener('hashchange', ui.updateHomeMode);
    setInterval(ui.updateHomeMode, 1500);
    // 首次延迟执行，确保 overlay 已注入
    setTimeout(ui.updateHomeMode, 500);

    // 默认显示覆盖层 - 兜底强制显示
    ui.forceShowOverlay();

    if (useIntercept) {
      // 拦截模式：监听主世界注入器派发的 'estrix-ai-response' 事件
      const interceptObserver = require('./dom/intercept-observer');
      interceptObserver.startInterceptObserver();
    } else {
      // DOM 抓取模式（延迟启动观察器，等待页面框架渲染）
      setTimeout(observer.startObserver, 2000);
    }
  } catch (err) {
    console.error('[Estrix Code] init() 出错:', err);
    // 兜底：即使出错也强制显示面板
    ui.forceShowOverlay();
  }

  // 定期巡检：防止面板被意外隐藏
  ui.startOverlayWatcher();

  // 定期提取当前平台用户信息并更新窗口名
  let lastSentUserName = '';
  setInterval(() => {
    try {
      const provider = getProviderByUrl(window.location.href);
      if (!provider || typeof provider.extractUserInfo !== 'function') return;
      const text = provider.extractUserInfo();
      if (text && text !== lastSentUserName) {
        lastSentUserName = text;
        window.electronAPI.updateWindowName(text).catch(() => {});
      }
    } catch (e) {
      console.error('[Estrix Code] 轮询用户名异常:', e.message);
    }
  }, 3000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

} // end else (非壳页面)
