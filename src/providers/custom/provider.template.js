/**
 * 自定义平台 Provider 模板
 * 使用方法：
 *   1. 复制本文件，改名为你的平台 id（如 my-platform.js）
 *   2. 修改 id、name、homeUrl 等字段
 *   3. 根据目标平台 DOM 结构，填写 inputSelectors、sendButtonSelectors 等选择器
 *   4. 实现 extractSessionId、matchesUrl、isResponseComplete 等方法
 *
 * 类型提示：在顶部加一行（本文件已加）：
 *   /** @type {import('./custom/provider.d.ts').Provider} */
 */
/** @type {import('./custom/provider.d.ts').Provider} */
module.exports = {
  id: 'my-platform',
  name: '我的平台',
  homeUrl: 'https://example.com/',
  sessionUrlBase: 'https://example.com/chat/',

  // 输入框选择器（按优先级）
  inputSelectors: [
    'textarea[placeholder*="输入"]',
    'textarea',
    'div[contenteditable="true"]',
    '[role="textbox"]',
  ],
  inputKeywords: ['输入', '消息', 'message'],

  // 发送按钮选择器
  sendButtonSelectors: [
    'button[type="submit"]',
    'button[aria-label*="send"]',
    'button[aria-label*="发送"]',
  ],

  // 用户信息选择器
  userInfoSelector: '.user-name',

  // 首页判断正则
  homeUrlPattern: /^https:\/\/example\.com\/?$/,

  // 从 URL 提取会话 ID
  extractSessionId(url) {
    if (!url) return null;
    const m = url.match(/\/chat\/([a-zA-Z0-9_-]+)/i);
    return m ? m[1] : null;
  },

  // 判断 URL 是否属于本平台
  matchesUrl(url) {
    return url.includes('example.com');
  },

  // 判断元素是否可见
  isElementVisible(el) {
    if (!el) return false;
    return el.offsetWidth > 0 && el.offsetHeight > 0;
  },

  // 查找输入框
  findInput() {
    for (const sel of this.inputSelectors) {
      const el = document.querySelector(sel);
      if (this.isElementVisible(el)) return el;
    }
    return null;
  },

  // 查找发送按钮
  findSendButton() {
    for (const sel of this.sendButtonSelectors) {
      const btn = document.querySelector(sel);
      if (this.isElementVisible(btn) && !btn.disabled) return btn;
    }
    return null;
  },

  // 提取用户信息
  extractUserInfo() {
    const el = document.querySelector(this.userInfoSelector);
    return el ? el.textContent.trim() : '';
  },

  // 判断 AI 是否完成回复（需根据目标平台调整）
  isResponseComplete() {
    // 示例：检测停止按钮消失
    const stopBtn = document.querySelector('button[aria-label="Stop"]');
    return !stopBtn;
  },

  // 获取 AI 消息容器（排除用户消息）
  getMessageCandidates() {
    return Array.from(document.querySelectorAll('[class*="message-row"]'))
      .filter(el => !this.isUserMessage(el));
  },

  // 取回复内容根节点
  getMessageMarkdown(messageEl) {
    return messageEl.querySelector('[class*="markdown"]') || messageEl;
  },

  // 判断是否用户消息
  isUserMessage(node) {
    let current = node;
    while (current) {
      const testid = current.getAttribute?.('data-testid') || '';
      if (testid === 'user-message') return true;
      const role = current.getAttribute?.('data-role') || '';
      if (role === 'user') return true;
      current = current.parentElement;
    }
    return false;
  },

  // 提取代码块语言
  getCodeBlockLanguage(pre) {
    if (!pre) return '';
    const codeEl = pre.querySelector('code');
    const cls = codeEl ? (codeEl.className || '') : (pre.className || '');
    const m = cls.match(/language-([\w-]+)/);
    return m ? m[1].toLowerCase() : '';
  },
};
