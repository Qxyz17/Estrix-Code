'use strict';
import { test, beforeEach, afterEach, vi } from 'vitest';
import assert from 'node:assert';

let executor;

function makeEl(id) {
  return {
    id,
    textContent: '',
    className: '',
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, f) { if (f) this._s.add(c); else this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
  };
}

let els;
function setupGlobals() {
  els = {};
  globalThis.document = {
    getElementById: (id) => els[id] || null,
    createElement: (t) => makeEl(t),
    querySelector: () => null,
    querySelectorAll: () => [],
    body: { appendChild() {} },
  };
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.window = {
    location: { href: 'https://chat.deepseek.com/' },
    addEventListener: () => {},
    electronAPI: {
      executeJs: vi.fn(async () => ({ success: true, output: 'ok' })),
    },
  };
}

beforeEach(async () => {
  vi.resetModules();
  setupGlobals();
  executor = await import('../../../src/bridge/loop/executor.js');
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('notifyJsScriptDetected 更新预览', () => {
  els['estrix-cmd-preview'] = makeEl('estrix-cmd-preview');
  executor.notifyJsScriptDetected('await bash("x")');
  assert.ok(els['estrix-cmd-preview'].textContent.includes('await bash("x")'));
  assert.ok(els['estrix-cmd-preview'].textContent.includes('[JS 工具脚本]'));
});

test('notifyJsScriptDetected 无预览元素不报错', () => {
  executor.notifyJsScriptDetected('code');
});

test('handleJsToolScript 成功返回结果', async () => {
  window.electronAPI.executeJs = vi.fn(async () => ({ success: true, output: '输出内容' }));
  const r = await executor.handleJsToolScript('const x = 1;');
  assert.strictEqual(r.code, 'const x = 1;');
  assert.strictEqual(r.result.success, true);
  assert.strictEqual(r.result.output, '输出内容');
});

test('handleJsToolScript 成功更新 UI', async () => {
  els['estrix-result-section'] = makeEl('estrix-result-section');
  els['estrix-result-status'] = makeEl('estrix-result-status');
  els['estrix-result-output'] = makeEl('estrix-result-output');
  window.electronAPI.executeJs = vi.fn(async () => ({ success: true, output: 'ok' }));
  await executor.handleJsToolScript('code');
  assert.ok(els['estrix-result-status'].textContent.includes('成功'));
  assert.strictEqual(els['estrix-result-output'].textContent, 'ok');
  assert.strictEqual(els['estrix-result-section'].classList.contains('estrix-hidden'), false);
});

test('handleJsToolScript 失败返回 error', async () => {
  window.electronAPI.executeJs = vi.fn(async () => ({ success: false, error: '执行出错' }));
  const r = await executor.handleJsToolScript('bad code');
  assert.strictEqual(r.result.success, false);
  assert.strictEqual(r.result.error, '执行出错');
});

test('handleJsToolScript 失败更新 UI', async () => {
  els['estrix-result-status'] = makeEl('estrix-result-status');
  els['estrix-result-output'] = makeEl('estrix-result-output');
  window.electronAPI.executeJs = vi.fn(async () => ({ success: false, error: '出错' }));
  await executor.handleJsToolScript('bad');
  assert.ok(els['estrix-result-status'].textContent.includes('失败'));
  assert.strictEqual(els['estrix-result-output'].textContent, '出错');
});

test('handleJsToolScript executeJs 抛异常被捕获', async () => {
  window.electronAPI.executeJs = vi.fn(async () => { throw new Error('系统崩溃'); });
  const r = await executor.handleJsToolScript('code');
  assert.strictEqual(r.result.success, false);
  assert.ok(r.result.error.includes('系统异常'));
  assert.ok(r.result.error.includes('系统崩溃'));
});

test('handleJsToolScript 成功但无 output', async () => {
  window.electronAPI.executeJs = vi.fn(async () => ({ success: true }));
  const r = await executor.handleJsToolScript('code');
  assert.strictEqual(r.result.success, true);
  assert.strictEqual(r.result.output, undefined);
});

test('handleJsToolScript 成功无 output 时 UI 显示占位', async () => {
  els['estrix-result-output'] = makeEl('estrix-result-output');
  window.electronAPI.executeJs = vi.fn(async () => ({ success: true }));
  await executor.handleJsToolScript('code');
  assert.ok(els['estrix-result-output'].textContent.includes('无输出'));
});
