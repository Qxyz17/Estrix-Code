/**
 * 自定义平台 Provider —— 模板（对齐内置 provider 写法）
 *
 * 用法：
 *   1. 复制本文件，改名成你的平台 id（如 my-platform.js）
 *   2. 改 id / name / homeUrl / sessionUrlBase
 *   3. 按目标平台的 DOM 结构，写 findInput / findSendButton 的【选择器数组】
 *   4. 改 matchesUrl / extractSessionId / homeUrlPattern
 *   5. （可选，推荐）需要拿到"完整、结构化的回复"时，启用网络拦截：
 *      设 useIntercept: true，并实现 getHookSource()
 *   6. 写完后：在「平台选择页」点「导入自定义 Provider」选这个 .js 文件
 *
 * 校验（必须全部满足，否则导入失败）：
 *   id、name、homeUrl、sessionUrlBase 是非空字符串；
 *   matchesUrl、extractSessionId 是函数。
 *
 * 注意：本文件是"单文件上传"，getHookSource 里返回的字符串必须【自包含】，
 *       不能 require 外部文件（下面的示例是内联的）。
 */
/** @type {import('../../src/providers/types.js').Provider} */
module.exports = {
  // ===== 必需字段 =====
  id: 'my-platform',                 // 唯一标识（英文，无空格）
  name: '我的平台',                   // 显示名
  homeUrl: 'https://example.com/',   // 首页（新建窗口默认打开）
  sessionUrlBase: 'https://example.com/chat/', // 会话 URL 前缀

  // 是否用"网络拦截"拿回复：
  //   false（默认）= DOM 抓取（简单，但可能拿不到完整 markdown）
  //   true = 拦截 fetch/XHR 的 SSE 流（推荐，需实现 getHookSource）
  useIntercept: false,

  // ===== 输入框 =====
  // 返回一个"可见的"输入元素。按优先级逐个试，命中即返回。
  // 输入框可能是 textarea，也可能是 contenteditable（ProseMirror 等）。
  findInput() {
    var selectors = [
      'textarea[placeholder*="输入"]',
      'textarea[placeholder*="消息"]',
      'textarea[placeholder*="message"]',
      'textarea',
      'div[contenteditable="true"]',
      'div[role="textbox"]',
    ];
    for (var i = 0; i < selectors.length; i++) {
      try {
        var el = document.querySelector(selectors[i]);
        if (this.isElementVisible(el)) return el;
      } catch (e) { /* 忽略无效选择器 */ }
    }
    return null;
  },

  // ===== 发送按钮 =====
  // 返回"可见且未禁用"的发送按钮。
  findSendButton() {
    var selectors = [
      'button[type="submit"]',
      'button[aria-label*="发送"]',
      'button[aria-label*="send" i]',
      'button[data-testid*="send" i]',
    ];
    for (var i = 0; i < selectors.length; i++) {
      try {
        var btn = document.querySelector(selectors[i]);
        if (this.isElementVisible(btn) && !btn.disabled) return btn;
      } catch (e) { /* 忽略 */ }
    }
    return null;
  },

  // ===== 用户信息（可选）=====
  // 返回当前登录用户的显示名（用于窗口标题）。拿不到就返回空串。
  extractUserInfo() {
    var el = document.querySelector('.user-name');
    return el ? (el.textContent || '').trim() : '';
  },

  // ===== URL 判定 =====
  // 首页判断正则（用于"首页模式"：隐藏侧栏、显示"初始化项目"提示）
  homeUrlPattern: /^https:\/\/example\.com\/?$/,

  // 从 URL 提取会话 ID（用于会话列表/切换）
  extractSessionId(url) {
    if (!url) return null;
    var m = url.match(/\/chat\/([a-zA-Z0-9_-]+)/i);
    return m ? m[1] : null;
  },

  // 判断某个 URL 是否属于本平台（用于平台识别）
  matchesUrl(url) {
    return url.indexOf('example.com') !== -1;
  },

  // ===== 工具方法（复制即可）=====
  // 元素是否可见
  isElementVisible(el) {
    if (!el) return false;
    return el.offsetWidth > 0 && el.offsetHeight > 0;
  },

  // ===== 网络拦截（可选，进阶）=====
  // 如果你需要"完整、结构化"的 AI 回复（含 markdown、思考过程、token 统计），
  // 就打开 useIntercept: true 并实现下面的 getHookSource()。
  //
  // 参考：examples/intercept.js 里有可直接套用的最小实现。
  //
  // getHookSource() 返回一段【自包含】的 JS 源码字符串，会被注入到 AI 网页的
  // "主世界"执行。它负责：
  //   1. 包装 window.fetch / XMLHttpRequest，监听目标接口的 SSE 流
  //   2. 从流里拼出完整回复
  //   3. 派发事件通知宿主：
  //      window.dispatchEvent(new CustomEvent('estrix-ai-response', {
  //        detail: { text: '完整回复', finished: true,
  //                  tokenUsage: { accumulatedTokens: 123 } } // 可选
  //      }));
  //      // 失败时派发 'estrix-ai-error'
  //      // 流式增量（可选，供纯净模式实时渲染）派发 'estrix-ai-stream'
  //      //   detail: { think, text, finished }
  //
  // useIntercept: true,
  // getHookSource() {
  //   return '(' + function () {
  //     // 这里写主世界拦截逻辑（window/document/fetch 等可用，但不能引用本文件其它变量）
  //   }.toString() + ')();';
  // },
};
