// Estrix Code — 注入层
// 职责：检测 AI 回复中的 estrix:bash / estrix:pwsh 代码块，调用 Tauri 执行，回传结果
// 平台无关，通过 window.__TAURI__ 与 Rust 通信

(function () {
  'use strict';

  const LOG = '[Estrix]';
  const MARKER_RE = /```estrix:(bash|pwsh|cmd)\s*\n([\s\S]*?)```/g;

  // 当前项目目录（Phase 1 由后端设置）
  let projectDir = null;

  // ---------- Tauri 通信 ----------
  async function invoke(cmd, args) {
    try {
      // Tauri 2 全局对象
      const t = window.__TAURI__;
      if (!t || !t.core || !t.core.invoke) {
        console.warn(LOG, 'Tauri API 不可用');
        return null;
      }
      return await t.core.invoke(cmd, args);
    } catch (e) {
      console.error(LOG, 'invoke 失败:', e);
      return null;
    }
  }

  // ---------- 覆盖层 UI ----------
  function ensureOverlay() {
    let el = document.getElementById('estrix-overlay');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'estrix-overlay';
    el.style.cssText = [
      'position:fixed', 'right:16px', 'bottom:16px', 'max-width:520px',
      'max-height:50vh', 'overflow:auto', 'z-index:2147483647',
      'background:rgba(20,22,42,0.96)', 'color:#e6e9ff',
      'font:12px/1.5 Consolas,Monaco,monospace', 'border-radius:8px',
      'padding:10px 12px', 'box-shadow:0 4px 20px rgba(0,0,0,0.4)',
      'display:none', 'white-space:pre-wrap', 'word-break:break-all'
    ].join(';');
    document.body.appendChild(el);
    return el;
  }

  function showOverlay(text) {
    const el = ensureOverlay();
    el.textContent = text;
    el.style.display = 'block';
  }

  // ---------- 执行命令块 ----------
  async function runBlock(shell, command) {
    const cmd = command.trim();
    if (!cmd) return;

    showOverlay('[Estrix] 执行 ' + shell + ':\n' + cmd + '\n--- 执行中 ---');

    const shellKind = shell === 'cmd' ? 'cmd' : (shell === 'pwsh' ? 'pwsh' : 'bash');
    const res = await invoke('execute_shell', {
      request: {
        command: cmd,
        shell: shellKind,
        timeout_ms: 60000
      },
      projectDir: projectDir
    });

    if (!res) {
      showOverlay('[Estrix] 执行失败：无法连接后端');
      return null;
    }

    const out = res.output || '(no output)';
    showOverlay('[Estrix] ' + shell + ' 执行结果:\n' + cmd + '\n--- 输出 ---\n' + out);
    return res;
  }

  // ---------- 检测 AI 回复中的命令块 ----------
  // 只扫描"最新"的 AI 消息，避免历史消息重复执行
  function scanForCommands() {
    const text = document.body ? document.body.innerText : '';
    if (!text) return;

    let m;
    MARKER_RE.lastIndex = 0;
    const found = [];
    while ((m = MARKER_RE.exec(text)) !== null) {
      found.push({ shell: m[1], command: m[2] });
    }

    // 去重：只执行"新出现"的
    for (const b of found) {
      const key = b.shell + '::' + b.command.trim();
      if (executed.has(key)) continue;
      executed.add(key);
      runBlock(b.shell, b.command);
    }
  }

  // 已执行集合（简单去重）
  const executed = new Set();

  // ---------- 启动 ----------
  function start() {
    console.log(LOG, '注入层已加载');
    // 轮询检测（Phase 1 先用简单轮询，后续可换 MutationObserver）
    setInterval(scanForCommands, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // 暴露给 Rust 设置项目目录
  window.__estrixSetProjectDir = function (dir) {
    projectDir = dir;
    console.log(LOG, '项目目录已设置:', dir);
  };
})();
