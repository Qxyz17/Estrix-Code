// @ts-nocheck
/**
 * GLM (Z.ai) Provider 定义
 */
import { GLM_HOOK } from './generated/hook-sources.js';
const glm = {
  id: 'glm',
  name: 'GLM',
  useIntercept: true,
  homeUrl: 'https://chat.z.ai/',
  sessionUrlBase: 'https://chat.z.ai/c/',
  findInput() {
    const sels = ['textarea.input-scroll','textarea#chat-input','form textarea','textarea[placeholder]','textarea','div[contenteditable="true"]','[role="textbox"]'];
    for (const s of sels) { try { const el = document.querySelector(s); if (this.isElementVisible(el)) return el; } catch (_) {} }
    return null;
  },
  findSendButton() {
    const sels = ['button[type="submit"].sendMessageButton','button[type="submit"]','form button[type="submit"]'];
    for (const s of sels) { try { const b = document.querySelector(s); if (this.isElementVisible(b) && !b.disabled) return b; } catch (_) {} }
    return null;
  },
  extractUserInfo() { try { const el = document.querySelector('[class*="user"] [class*="name"]'); return el ? el.textContent.trim() : ''; } catch (_) { return ''; } },
  homeUrlPattern: /^https:\/\/chat\.z\.ai\/?(\?.*)?$/,
  extractSessionId(url) { if (!url) return null; const m = url.match(/\/c\/([a-f0-9-]{36})/i); if (m) return m[1]; const g = url.match(/\/c\/([a-zA-Z0-9_-]+)/i); return g ? g[1] : null; },
  matchesUrl(url) { return url.includes('chat.z.ai'); },
  isElementVisible(el) { if (!el) return false; return el.offsetWidth > 0 && el.offsetHeight > 0; },
  isResponseComplete() { return false; },
  getMessageCandidates() { return Array.from(document.querySelectorAll('[class*="message"]')).filter((el) => !this.isUserMessage(el)); },
  getMessageMarkdown(el) { return el.querySelector('[class*="markdown"]') || el; },
  isUserMessage(node) { let c = node; while (c) { const r = c.getAttribute?.('data-role') || c.getAttribute?.('data-author') || ''; if (r === 'user' || r === 'human') return true; c = c.parentElement; } const t = (node.textContent || node.innerText || '').substring(0, 200); return t.includes('我已选择目录：') || t.includes('系统提示词：') || t.includes('工具使用规则：'); },
  getCodeBlockLanguage(pre) { if (!pre) return ''; const els = [pre.querySelector('code'), pre].filter(Boolean); for (const el of els) { const cls = el.className || ''; if (typeof cls === 'string') { const m = cls.match(/language-([\w-]+)/); if (m) return m[1].toLowerCase(); } } return ''; },
  getHookSource() { return GLM_HOOK; },
};
export { glm };
