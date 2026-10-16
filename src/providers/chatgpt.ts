/**
 * ChatGPT Provider 定义
 * 基于 chatgpt.com 页面结构，输入框为 ProseMirror（contenteditable）。
 */
import { CHATGPT_HOOK } from './generated/hook-sources.js';

const chatgpt = {
  id: 'chatgpt',
  name: 'ChatGPT',
  // 使用网络请求拦截方式获取 AI 回复（替代 DOM 抓取）
  useIntercept: true,
  homeUrl: 'https://chatgpt.com/',
  sessionUrlBase: 'https://chatgpt.com/c/',

  // 判断元素是否可见（offsetWidth/offsetHeight > 0）
  isElementVisible(el: any) {
    if (!el) return false;
    return el.offsetWidth > 0 && el.offsetHeight > 0;
  },

  // 查找可见的聊天输入框（ChatGPT 用 ProseMirror contenteditable）
  // ⚠️ 页面可能同时存在**多个** .ProseMirror（如首页有隐藏的模板编辑器），
  //    querySelector 只返回第一个匹配 → 可能命中隐藏元素 → insertText 静默失败。
  //    故用 querySelectorAll 遍历，返回第一个**可见**的。
  findInput() {
    const selectors = [
      'div[contenteditable="true"].ProseMirror',
      'div[role="textbox"]',
      'div.ProseMirror',
      'div[contenteditable="true"]',
      'textarea',
    ];
    for (const sel of selectors) {
      try {
        const els = document.querySelectorAll(sel);
        for (let i = 0; i < els.length; i++) {
          if (this.isElementVisible(els[i])) return els[i];
        }
      } catch (_) {}
    }
    return null;
  },

  // 查找可见且未禁用的发送按钮
  findSendButton() {
    const selectors = [
      'button[data-testid="send-button"]',
      'button[aria-label="发送提示词"]',
      'button[aria-label*="发送"]',
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

  // 填入输入框：ChatGPT 的 ProseMirror 会把 ClipboardEvent('paste') 识别为
  // "粘贴的文件"附件（出现 .txt 卡片），文本区却为空 → 发送空内容。
  // 改用 execCommand('insertText') 直接写文本节点，与真实打字等价。
  fillInput(input: any, text: string) {
    // ChatGPT 的 ProseMirror：合成 ClipboardEvent('paste') 会被识别为附件，故用 execCommand('insertText')。
    // 写完读回校验（去空白长度 ≥ 期望的 90%）——编辑器可能拒收，不能无条件返回 true。
    try {
      input.focus();
      // 清空现有内容
      try {
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(input);
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand('delete', false, undefined);
        }
      } catch (_) {}
      // 分段插入（长文本 execCommand 单次可能失败）
      const CHUNK = 5000;
      for (let i = 0; i < text.length; i += CHUNK) {
        document.execCommand('insertText', false, text.slice(i, i + CHUNK));
      }
      // 触发一次 input 让框架感知
      try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
      // 读回校验
      const probe = text.replace(/\s+/g, '');
      const written = String(input.innerText || input.textContent || '').replace(/\s+/g, '');
      if (!written || written.length < probe.length * 0.9) {
        console.warn('[Estrix Code][chatgpt.fillInput] 写入校验失败：期望 ' + probe.length + ' 字，实际 ' + written.length + ' 字');
        return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  },

  // 触发发送。ChatGPT 的 ProseMirror 免疫合成 KeyboardEvent；
  // 且**主进程 sendInputEvent 的键盘事件依赖页面有焦点**——用户焦点在壳窗口/别的窗口时
  // （document.hasFocus() === false），Enter 会送不到页面 → 消息发不出去。
  // 故优先用**真实鼠标点击发送按钮**（sendInputEvent 鼠标事件不受焦点影响），
  // 点击后校验输入框是否被清空（发送成功的标志），失败再回退 Enter / DOM click。
  async triggerSend(input: any) {
    const api = (window as any).electronAPI;
    // 重新查找**最新的**输入框与发送按钮（3 秒发送延迟期间，React 可能替换 DOM，
    // 旧引用会脱离文档 → 点击后校验读成空 → 误判成功）。
    const findInput = () => {
      const sels = ['div[contenteditable="true"].ProseMirror', 'div[role="textbox"]', 'div.ProseMirror', 'div[contenteditable="true"]', 'textarea'];
      for (const s of sels) { const els = document.querySelectorAll(s); for (let i = 0; i < els.length; i++) { const e: any = els[i]; if (e.offsetWidth > 0 && e.offsetHeight > 0) return e; } }
      return null;
    };
    const lenOf = (el: any) => String((el && (el.innerText || el.value || el.textContent)) || '').replace(/\s+/g, '').length;

    // 发送：循环 10 次（每次 ~600ms，共约 6 秒），每次用最新 DOM，交替尝试 点击 / Enter。
    // ⚠️ 实测：填入后 ProseMirror 处理需要时间，按钮可能短暂不存在/禁用；且 Enter 依赖页面焦点。
    //    故必须「等按钮就绪 + 多方式兜底 + 长重试」，不能一次失败就放弃。
    const canSim = api && typeof api.simulateMouse === 'function';
    for (let attempt = 0; attempt < 10; attempt++) {
      const curInput = findInput() || input;
      const btn = this.findSendButton ? this.findSendButton() : null;
      // A) 有按钮 → 真实鼠标点击
      if (btn && canSim) {
        try {
          if (curInput && typeof curInput.focus === 'function') { try { curInput.focus(); } catch (_) {} }
          const rect = btn.getBoundingClientRect();
          const x = Math.round(rect.left + rect.width / 2);
          const y = Math.round(rect.top + rect.height / 2);
          await api.simulateMouse('click', x, y);
          await new Promise((res) => setTimeout(res, 400));
          const remaining = lenOf(findInput());
          console.log('[Estrix Code][chatgpt.triggerSend] 点击#' + (attempt + 1) + ' @(' + x + ',' + y + ') 后输入框剩余=' + remaining);
          if (remaining <= 2) return true;
        } catch (err: any) {
          console.warn('[Estrix Code][chatgpt.triggerSend] 鼠标点击失败:', err && err.message);
        }
      } else {
        // B) 没按钮 → 尝试 Enter（先聚焦输入框）
        try {
          if (curInput && typeof curInput.focus === 'function') { try { curInput.focus(); } catch (_) {} }
          if (api && typeof api.sendEnterToChat === 'function') {
            await api.sendEnterToChat();
            await new Promise((res) => setTimeout(res, 400));
            const remaining = lenOf(findInput());
            console.log('[Estrix Code][chatgpt.triggerSend] 第' + (attempt + 1) + '次无按钮→Enter 后剩余=' + remaining);
            if (remaining <= 2) return true;
          }
        } catch (_) { /* ignore */ }
      }
      await new Promise((res) => setTimeout(res, 200));
    }

    // 最后兜底：DOM click
    const btn2 = this.findSendButton ? this.findSendButton() : null;
    if (btn2) { (btn2 as any).click(); return true; }
    return false;
  },

  // 提取当前用户信息文本
  // 优先从 localStorage 的 accountSwitchSessions 读取（稳定，不受 DOM 渲染影响）；
  // 失败再回退到侧边栏 DOM 提取。
  extractUserInfo() {
    // 1. localStorage: oai/apps/accountSwitchSessions -> [0].name
    try {
      const raw = localStorage.getItem('oai/apps/accountSwitchSessions');
      if (raw) {
        const sessions = JSON.parse(raw);
        if (Array.isArray(sessions) && sessions.length > 0 && sessions[0].name) {
          return String(sessions[0].name).trim();
        }
      }
    } catch (_) {}

    // 2. 优先用常见按钮选择器
    const btn = document.querySelector('[data-testid="profile-button"]') ||
      document.querySelector('button[aria-label*="profile" i]') ||
      document.querySelector('button[aria-label*="account" i]');
    if (btn) {
      const aria = btn.getAttribute('aria-label') || '';
      if (aria) return aria.trim();
    }

    // 3. 侧边栏底部用户区：class 含 z-30 的底部固定容器
    const containers = document.querySelectorAll('nav div[class*="z-30"]');
    for (const el of containers) {
      const clone = el.cloneNode(true) as any;
      clone.querySelectorAll('button').forEach((b: any) => b.remove());
      const text = (clone.textContent || '').trim();
      if (text && text !== 'ChatGPT' && text.length <= 40) {
        return text;
      }
    }
    return '';
  },

  // 首页判断正则（https://chatgpt.com/ 或 https://chatgpt.com）
  homeUrlPattern: /^https:\/\/chatgpt\.com\/?$/,

  // 从 URL 提取会话 ID（ChatGPT 正式会话是 /c/{uuid} 格式）。
  // 注意：创建会话过程中 URL 有中间态 /c/WEB:xxx、/c/local-chatgpt 等，
  // 这些不是真实会话 ID。若误把它们当会话 ID 返回，session-store 会据此
  // 绑定 projectDir 并清空 pendingProjectDir，导致真正会话 ID 出现时
  // 项目目录丢失（表现为"初始化后 GPT 拿不到项目目录"）。
  // 故此处只认完整 UUID，中间态一律返回 null。
  extractSessionId(url: string): string | null {
    if (!url) return null;
    const uuidMatch = url.match(/\/c\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    return uuidMatch ? uuidMatch[1] : null;
  },

  // 判断 URL 是否属于本平台
  matchesUrl(url: string) {
    return url.includes('chatgpt.com') || url.includes('chat.openai.com');
  },

  // 返回注入主世界的网络拦截器源码（拦截模式使用）
  // 源码由 scripts/build-hooks.mjs 从 hooks/chatgpt.ts 打包生成（自包含 IIFE）
  getHookSource() {
    return CHATGPT_HOOK;
  },
};

export { chatgpt };

