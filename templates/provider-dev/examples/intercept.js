/**
 * 示例 2：带网络拦截的 Provider（进阶）
 *
 * 适用：需要"完整、结构化"的 AI 回复（markdown、思考过程、token 统计），
 *       或回复是流式渲染、DOM 抓取不稳定。
 *
 * 原理：包装 window.fetch，观察目标接口返回的 SSE 流，拼出完整文本后派发事件。
 *
 * ⚠️ getHookSource 返回的代码会被注入"主世界"独立执行：
 *   - 可以用 window / document / fetch / console 等浏览器全局
 *   - 不能引用本文件里的其它变量/函数（要全部内联在那个 function 里）
 *   - 该 function 的 toString() 会被包成 IIFE 执行
 *
 * 下面是一个最小可用实现。改造要点：
 *   1. TARGET 改成你平台"发消息"的接口路径（用浏览器 F12 → Network 找）
 *   2. 解析 SSE：每个 data: 行是一段 JSON，从中取增量文本
 *   3. 完成时（看到结束标记 / 流结束）派发 estrix-ai-response
 */
/** @type {import('../../src/providers/types.js').Provider} */
module.exports = {
  id: 'example-intercept',
  name: '示例平台（拦截版）',
  homeUrl: 'https://chat.example.com/',
  sessionUrlBase: 'https://chat.example.com/c/',

  // 启用网络拦截
  useIntercept: true,

  findInput() {
    var selectors = ['textarea', 'div[contenteditable="true"]', 'div[role="textbox"]'];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (this.isElementVisible(el)) return el;
    }
    return null;
  },

  findSendButton() {
    var selectors = ['button[type="submit"]', 'button[aria-label*="send" i]'];
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

  // ===== 网络拦截：返回自包含源码 =====
  getHookSource() {
    return '(' + function () {
      // 防重复安装
      if (window.__myPlatformHookInstalled__) return;
      window.__myPlatformHookInstalled__ = true;

      // 改成你要监听的接口（F12 → Network 里找"发消息"那条请求的路径）
      var TARGET = '/api/chat/completions';

      function isTarget(url, method) {
        if (!url) return false;
        if (String(method || 'GET').toUpperCase() !== 'POST') return false;
        return String(url).indexOf(TARGET) !== -1;
      }

      // ---- SSE 帧解码：按空行切帧，取 data: 行 ----
      function makeDecoder() {
        var buf = '';
        return {
          push: function (chunk) {
            buf += chunk;
            var frames = [], parts = buf.split(/\r?\n\r?\n/);
            buf = parts.pop() || '';
            for (var i = 0; i < parts.length; i++) frames.push(parts[i]);
            return frames;
          },
          finish: function () { var f = buf ? [buf] : []; buf = ''; return f; },
        };
      }
      function parseFrame(block) {
        if (!block) return null;
        var lines = block.split(/\r?\n/);
        for (var i = 0; i < lines.length; i++) {
          if (lines[i].indexOf('data:') === 0) {
            var d = lines[i].slice(5).trim();
            if (d === '[DONE]') return { __done: true };
            try { return JSON.parse(d); } catch (e) { return null; }
          }
        }
        return null;
      }

      // 从一帧里取"增量文本"（按你平台的实际结构改）
      function pickDelta(j) {
        if (!j) return '';
        if (typeof j.delta === 'string') return j.delta;
        if (j.choices && j.choices[0] && j.choices[0].delta && typeof j.choices[0].delta.content === 'string') {
          return j.choices[0].delta.content;
        }
        return '';
      }

      function dispatch(text, finished) {
        try {
          window.dispatchEvent(new CustomEvent('estrix-ai-response', {
            detail: { text: text, finished: !!finished }
          }));
        } catch (e) { /* ignore */ }
      }
      function dispatchStream(text) {
        try {
          window.dispatchEvent(new CustomEvent('estrix-ai-stream', {
            detail: { think: '', text: text, finished: false }
          }));
        } catch (e) { /* ignore */ }
      }

      // ---- 观察一个 ReadableStream ----
      function observeBody(body) {
        var reader = body.getReader();
        var dec = new TextDecoder();
        var decoder = makeDecoder();
        var acc = '';
        var done = false;

        function feed(chunk) {
          var frames = decoder.push(chunk);
          for (var i = 0; i < frames.length; i++) {
            var j = parseFrame(frames[i]);
            if (!j) continue;
            if (j.__done) { if (!done) { done = true; dispatch(acc, true); } continue; }
            var d = pickDelta(j);
            if (d) { acc += d; dispatchStream(acc); }
          }
        }
        function pump() {
          reader.read().then(function (r) {
            if (r.done) {
              var tail = dec.decode();
              if (tail) feed(tail);
              var rest = decoder.finish();
              for (var i = 0; i < rest.length; i++) {
                var j = parseFrame(rest[i]);
                var d = j ? pickDelta(j) : '';
                if (d) acc += d;
              }
              if (!done) { done = true; dispatch(acc, true); }
              return;
            }
            feed(dec.decode(r.value, { stream: true }));
            pump();
          }).catch(function (e) {
            if (!done) {
              done = true;
              try {
                window.dispatchEvent(new CustomEvent('estrix-ai-error', {
                  detail: { text: acc, status: 'error', reason: 'stream', name: e && e.name }
                }));
              } catch (_) {}
            }
          });
        }
        pump();
      }

      // ---- 包装 window.fetch ----
      var origFetch = window.fetch;
      if (typeof origFetch === 'function') {
        window.fetch = function (input, init) {
          var url = typeof input === 'string' ? input : (input && (input.url || input.href)) || '';
          var method = (init && init.method) || (input && input.method) || 'GET';
          var p = origFetch.apply(this, arguments);
          if (!isTarget(url, method)) return p;
          return p.then(function (resp) {
            try {
              if (resp && resp.body) observeBody(resp.clone().body);
            } catch (e) { /* ignore */ }
            return resp;
          });
        };
      }

      // （可选）XHR 拦截：有些平台用 XMLHttpRequest，参考内置 deepseek hook 的 observeXhr。
      console.log('[my-provider] hook installed');
    }.toString() + ')();';
  },
};
