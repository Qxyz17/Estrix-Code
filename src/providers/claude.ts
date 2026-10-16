/**
 * Claude Provider 定义
 * 基于 claude.ai 页面结构，输入框为 ProseMirror（contenteditable）。
 */

import { CLAUDE_HOOK } from './generated/hook-sources.js';

const claude = {
  id: 'claude',
  name: 'Claude',
  // 使用网络请求拦截方式获取 AI 回复（替代 DOM 抓取）
  useIntercept: true,
  homeUrl: 'https://claude.ai/new',
  sessionUrlBase: 'https://claude.ai/chat/',

  // 判断元素是否可见（offsetWidth/offsetHeight > 0）
  isElementVisible(el: any) {
    if (!el) return false;
    return el.offsetWidth > 0 && el.offsetHeight > 0;
  },

  // 查找可见的聊天输入框（Claude 用 ProseMirror contenteditable）
  findInput() {
    const selectors = [
      'div[role="textbox"].tiptap',
      'div[role="textbox"]',
      'div.ProseMirror',
      'div[contenteditable="true"]',
      'textarea',
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
      'button[aria-label="Send message"]',
      '[data-testid="chat-input-send"]',
      'button[aria-label*="send"]',
      'button[aria-label*="Send"]',
    ];
    for (const sel of selectors) {
      try {
        const btn = document.querySelector(sel) as any;
        if (this.isElementVisible(btn) && !btn.disabled) return btn;
      } catch (_) {}
    }
    return null;
  },

  // 提取当前用户信息文本（左下角账号名）
  extractUserInfo() {
    const el = document.querySelector('.df-user-menu-btn span.whitespace-nowrap.text-secondary');
    return el ? el.textContent.trim() : '';
  },

  // 首页判断正则（https://claude.ai/new 或 https://claude.ai/）
  homeUrlPattern: /^https:\/\/claude\.ai(\/new)?\/?(\?.*)?$/,

  // 从 URL 提取会话 ID（Claude 是 /chat/xxx 格式）
  extractSessionId(url: string): string | null {
    if (!url) return null;
    const match = url.match(/\/chat\/([a-zA-Z0-9_-]+)/i);
    if (match) return match[1];
    return null;
  },

  // 判断 URL 是否属于本平台
  matchesUrl(url: string) {
    return url.includes('claude.ai');
  },

  // 返回注入主世界的网络拦截器源码（拦截模式使用）
  // 源码由 scripts/build-hooks.mjs 从 hooks/claude.ts 打包生成（自包含 IIFE）
  getHookSource() {
    return CLAUDE_HOOK;
  },
};

export { claude };

