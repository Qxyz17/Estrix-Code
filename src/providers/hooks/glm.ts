/**
 * GLM (Z.ai) 网络拦截器（注入 AI 网页主世界执行）
 * 观察 /api/v2/chat/completions 的 SSE 响应，提取 AI 回复文本。
 */
import { createFrameDecoder, parseBlock } from './shared/sse.js';

function install(): void {
  var MARKER = '__estrixGlmHookInstalled__';
  if (window[MARKER]) return;
  window[MARKER] = true;

  var COMPLETION_PATH = '/api/v2/chat/completions';

  function isCompletion(url, method) {
    if (!url) return false;
    if (String(method || 'GET').toUpperCase() !== 'POST') return false;
    try {
      var u = new URL(url, document.baseURI);
      return u.pathname === COMPLETION_PATH;
    } catch (e) {
      return String(url).indexOf(COMPLETION_PATH) !== -1;
    }
  }

  function dispatchStream(think, text, finished) {
    try {
      window.dispatchEvent(new CustomEvent('estrix-ai-stream', {
        detail: { think: think || '', text: text || '', finished: !!finished, accumulatedTokens: null }
      }));
    } catch (e) { /* ignore */ }
  }

  function dispatch(text, status) {
    try {
      window.dispatchEvent(new CustomEvent('estrix-ai-response', {
        detail: { text: text || '', finished: status === 'finished', status: status, tokenUsage: null, msgIds: null }
      }));
    } catch (e) { /* ignore */ }
  }

  function createExtractor() {
    var text = '', think = '', finished = false;
    function consume(parsed) {
      if (!parsed || typeof parsed !== 'object') return;
      var d = parsed.data;
      if (!d || typeof d !== 'object') return;
      if (d.phase === 'done' || d.done === true) { finished = true; return; }
      if (typeof d.delta_content === 'string') {
        if (d.phase === 'thinking') think += d.delta_content;
        else text += d.delta_content;
      }
    }
    return {
      consume: consume,
      get text() { return text; },
      get think() { return think; },
      get finished() { return finished; }
    };
  }

  function observeBody(body) {
    if (!body) return;
    var reader = body.getReader();
    var decoder = new TextDecoder();
    var frameDecoder = createFrameDecoder();
    var extractor = createExtractor();
    var dispatched = false;
    var lastStreamAt = 0;

    function feed(chunk) {
      var frames = frameDecoder.push(chunk);
      for (var i = 0; i < frames.length; i++) {
        var parsed = parseBlock(frames[i]);
        if (parsed) extractor.consume(parsed);
      }
      var now = Date.now();
      if (!extractor.finished && now - lastStreamAt >= 80) {
        lastStreamAt = now;
        dispatchStream(extractor.think, extractor.text, false);
      }
      if (extractor.finished && !dispatched) {
        dispatched = true;
        dispatchStream(extractor.think, extractor.text, true);
        dispatch(extractor.text, 'finished');
      }
    }

    function pump() {
      reader.read().then(function (r) {
        if (r.done) {
          var tail = decoder.decode();
          if (tail) feed(tail);
          var rest = frameDecoder.finish();
          for (var i = 0; i < rest.length; i++) {
            var parsed = parseBlock(rest[i]);
            if (parsed) extractor.consume(parsed);
          }
          if (!dispatched) { dispatched = true; dispatchStream(extractor.think, extractor.text, true); dispatch(extractor.text, 'finished'); }
          return;
        }
        feed(decoder.decode(r.value, { stream: true }));
        pump();
      }).catch(function () {
        if (!dispatched) { dispatched = true; dispatchStream(extractor.think, extractor.text, true); dispatch(extractor.text, 'finished'); }
      });
    }
    pump();
  }

  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) ? input.url : (input && input.href) ? input.href : '';
      var method = (init && init.method) || (input && input.method) || 'GET';
      var p = origFetch.apply(this, arguments);
      if (!isCompletion(url, method)) return p;
      return p.then(function (response) {
        try { if (response && response.body) observeBody(response.clone().body); } catch (e) {}
        return response;
      });
    };
  }

  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  var xhrInfo = new WeakMap();
  XMLHttpRequest.prototype.open = function (method, url) {
    try { xhrInfo.set(this, { url: url, method: method }); } catch (e) {}
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    var info = xhrInfo.get(this);
    if (info && isCompletion(info.url, info.method)) {
      try { observeXhr(this); } catch (e) {}
    }
    return origSend.apply(this, arguments);
  };

  function observeXhr(xhr) {
    var lastLen = 0;
    var frameDecoder = createFrameDecoder();
    var extractor = createExtractor();
    var dispatched = false;

    function consumeChunk() {
      var raw;
      try { raw = xhr.responseText; } catch (e) { return; }
      if (typeof raw !== 'string' || raw.length <= lastLen) return;
      var chunk = raw.slice(lastLen);
      lastLen = raw.length;
      var frames = frameDecoder.push(chunk);
      for (var i = 0; i < frames.length; i++) {
        var parsed = parseBlock(frames[i]);
        if (parsed) extractor.consume(parsed);
      }
      if (!extractor.finished) dispatchStream(extractor.think, extractor.text, false);
      if (extractor.finished && !dispatched) {
        dispatched = true;
        dispatchStream(extractor.think, extractor.text, true);
        dispatch(extractor.text, 'finished');
      }
    }

    xhr.addEventListener('readystatechange', function () {
      if (xhr.readyState === 3 || xhr.readyState === 4) consumeChunk();
      if (xhr.readyState === 4 && !dispatched) {
        var rest = frameDecoder.finish();
        for (var i = 0; i < rest.length; i++) {
          var parsed = parseBlock(rest[i]);
          if (parsed) extractor.consume(parsed);
        }
        dispatched = true;
        dispatchStream(extractor.think, extractor.text, true);
        dispatch(extractor.text, 'finished');
      }
    });
  }
}

export { install };
