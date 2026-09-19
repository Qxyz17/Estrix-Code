/**
 * GLM（Z.ai）Provider 定义
 * 基于 chat.z.ai 页面结构，输入框为 textarea.input-scroll。
 */
module.exports = {
  id: 'glm',
  name: 'GLM',
  // 使用网络请求拦截方式获取 AI 回复
  useIntercept: true,
  homeUrl: 'https://chat.z.ai/',
  sessionUrlBase: 'https://chat.z.ai/c/',

  // 判断元素是否可见
  isElementVisible(el) {
    if (!el) return false;
    return el.offsetWidth > 0 && el.offsetHeight > 0;
  },

  // 查找可见的聊天输入框（Z.ai 用 textarea.input-scroll）
  findInput() {
    const selectors = [
      'textarea.input-scroll',
      'textarea#chat-input',
      'form textarea',
      'textarea[placeholder]',
      'textarea',
      'div[contenteditable="true"]',
      '[role="textbox"]',
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (this.isElementVisible(el)) return el;
      } catch (_) {}
    }
    return null;
  },

  // 查找可见且未禁用的发送按钮
  findSendButton() {
    const selectors = [
      'button[type="submit"].sendMessageButton',
      'button[type="submit"]',
      'form button[type="submit"]',
    ];
    for (const sel of selectors) {
      try {
        const btn = document.querySelector(sel);
        if (this.isElementVisible(btn) && !btn.disabled) return btn;
      } catch (_) {}
    }
    return null;
  },

  // 提取当前用户信息文本（预留）
  extractUserInfo() {
    try {
      const el = document.querySelector('[class*="user"] [class*="name"]');
      return el ? el.textContent.trim() : '';
    } catch (_) { return ''; }
  },

  // 首页判断正则
  homeUrlPattern: /^https:\/\/chat\.z\.ai\/?(\?.*)?$/,

  // 从 URL 提取会话 ID（Z.ai 是 /c/{uuid} 格式）
  extractSessionId(url) {
    if (!url) return null;
    const match = url.match(/\/c\/([a-f0-9-]{36})/i);
    if (match) return match[1];
    const genericMatch = url.match(/\/c\/([a-zA-Z0-9_-]+)/i);
    return genericMatch ? genericMatch[1] : null;
  },

  // 判断 URL 是否属于本平台
  matchesUrl(url) {
    return url.includes('chat.z.ai');
  },

  // ========== 自动解析相关方法 ==========

  // 拦截模式下由 hook 判定完成，这里兜底
  async isResponseComplete() {
    return false;
  },

  // 获取当前页面所有 AI 消息容器
  getMessageCandidates() {
    return Array.from(document.querySelectorAll('[class*="message"]')).filter(el => !this.isUserMessage(el));
  },

  // 从消息容器中取回复内容根节点
  getMessageMarkdown(messageEl) {
    return messageEl.querySelector('[class*="markdown"]') || messageEl;
  },

  // 判断节点是否位于用户消息区域内
  isUserMessage(node) {
    let current = node;
    while (current) {
      const role = current.getAttribute?.('data-role') || current.getAttribute?.('data-author') || '';
      if (role === 'user' || role === 'human') return true;
      current = current.parentElement;
    }
    const text = (node.textContent || node.innerText || '').substring(0, 200);
    return text.includes('我已选择目录：') || text.includes('系统提示词：') || text.includes('工具使用规则：');
  },

  // 提取代码块的语言标记
  getCodeBlockLanguage(pre) {
    if (!pre) return '';
    const codeEl = pre.querySelector('code');
    const els = [codeEl, pre].filter(Boolean);
    for (const el of els) {
      const cls = el.className || '';
      if (typeof cls === 'string') {
        const langMatch = cls.match(/language-([\w-]+)/);
        if (langMatch) return langMatch[1].toLowerCase();
      }
    }
    return '';
  },
};
