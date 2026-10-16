/**
 * 示例 1：最简 Provider（DOM 抓取模式）
 *
 * 适用：目标平台结构简单、只需抓到文本回复。
 * 特点：不碰网络请求，实现成本最低。
 *
 * 用这个当起点：复制 → 改选择器 → 导入。
 */
/** @type {import('../../src/providers/types.js').Provider} */
module.exports = {
  id: 'example-simple',
  name: '示例平台（简单版）',
  homeUrl: 'https://chat.example.com/',
  sessionUrlBase: 'https://chat.example.com/c/',

  // 不启用网络拦截（走 DOM 抓取）
  useIntercept: false,

  findInput() {
    var selectors = ['textarea[placeholder*="输入"]', 'textarea', 'div[contenteditable="true"]'];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (this.isElementVisible(el)) return el;
    }
    return null;
  },

  findSendButton() {
    var selectors = ['button[type="submit"]', 'button[aria-label*="发送"]', 'button[aria-label*="send" i]'];
    for (var i = 0; i < selectors.length; i++) {
      var btn = document.querySelector(selectors[i]);
      if (this.isElementVisible(btn) && !btn.disabled) return btn;
    }
    return null;
  },

  extractUserInfo() { return ''; },

  homeUrlPattern: /^https:\/\/chat\.example\.com\/?$/,

  extractSessionId(url) {
    if (!url) return null;
    var m = url.match(/\/c\/([a-zA-Z0-9_-]+)/i);
    return m ? m[1] : null;
  },

  matchesUrl(url) {
    return url.indexOf('chat.example.com') !== -1;
  },

  isElementVisible(el) {
    if (!el) return false;
    return el.offsetWidth > 0 && el.offsetHeight > 0;
  },
};
