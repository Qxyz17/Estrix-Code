'use strict';
import { test } from 'vitest';
import assert from 'node:assert';

// 只测纯函数：generateId、formatTime、truncate
// escapeHtml 等需要 DOM 的函数单独 mock

// 用简单 DOM stub
const mkEl = () => ({ textContent: '', innerHTML: '', style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } });
global.document = {
  createElement: () => mkEl(),
  getElementById: () => null,
  head: { appendChild: () => {} },
  body: { appendChild: () => {} },
};
global.requestAnimationFrame = (fn) => fn();
global.window = { location: { href: 'https://chat.deepseek.com/' } };
global.setInterval = () => 0;
global.clearInterval = () => {};
global.setTimeout = (_fn, _ms) => 0;
global.clearTimeout = () => {};

const ui = await import('../../src/overlay/panel.js');
const { state } = await import('../../src/overlay/state.js');

test('generateId 格式', () => {
  const id1 = ui.generateId();
  const id2 = ui.generateId();
  assert.match(id1, /^cmd_\d+_\d+$/);
  assert.notStrictEqual(id1, id2);
});

test('formatTime 格式 HH:mm:ss', () => {
  const s = ui.formatTime(new Date(2026, 0, 1, 9, 5, 3).getTime());
  assert.strictEqual(s, '09:05:03');
});

test('truncate 基本与默认长度', () => {
  assert.strictEqual(ui.truncate('hello'), 'hello');
  assert.strictEqual(ui.truncate('abcdefghij', 5), 'abcde...');
  assert.strictEqual(ui.truncate(''), '');
  assert.strictEqual(ui.truncate(null), '');
  const long = 'x'.repeat(60);
  assert.strictEqual(ui.truncate(long).length, 53);
});

test('escapeHtml 返回字符串', () => {
  assert.strictEqual(typeof ui.escapeHtml('<script>'), 'string');
});

test('updateHomeMode 首页模式', () => {
  assert.doesNotThrow(() => ui.updateHomeMode());
});

// 回归：曾因 updateHomeMode 依赖已被删除的 #estrix-overlay 元素，
// 导致 if(overlay) 整块跳过 → 首次初始化提示框永不显示。
function makeFakeDialog() {
  const classes = new Set(['estrix-hidden']);
  return {
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
    },
    _has: (c) => classes.has(c),
  };
}

test('updateHomeMode：首页显示初始化提示框（回归）', () => {
  const dialog = makeFakeDialog();
  const prevGet = global.document.getElementById;
  const prevHref = global.window.location.href;
  global.document.getElementById = (id) => (id === 'estrix-first-time-dialog' ? dialog : null);
  global.window.location.href = 'https://chat.deepseek.com/';
  try {
    ui.updateHomeMode();
    assert.strictEqual(dialog._has('estrix-hidden'), false, '首页应移除 estrix-hidden（显示提示框）');
  } finally {
    global.document.getElementById = prevGet;
    global.window.location.href = prevHref;
  }
});

test('updateHomeMode：非首页隐藏初始化提示框', () => {
  const dialog = makeFakeDialog();
  const prevGet = global.document.getElementById;
  const prevHref = global.window.location.href;
  global.document.getElementById = (id) => (id === 'estrix-first-time-dialog' ? dialog : null);
  global.window.location.href = 'https://chat.deepseek.com/chat/s/abc';
  try {
    ui.updateHomeMode();
    assert.strictEqual(dialog._has('estrix-hidden'), true, '非首页应加回 estrix-hidden（隐藏提示框）');
  } finally {
    global.document.getElementById = prevGet;
    global.window.location.href = prevHref;
  }
});

test('updateHomeMode：已选项目时首页不显示提示框（由 state.currentProjectDir 控制）', () => {
  const dialog = makeFakeDialog();
  const prevGet = global.document.getElementById;
  const prevHref = global.window.location.href;
  global.document.getElementById = (id) => (id === 'estrix-first-time-dialog' ? dialog : null);
  global.window.location.href = 'https://chat.deepseek.com/';
  const prevDir = state.currentProjectDir;
  state.currentProjectDir = 'C:/proj';
  try {
    ui.updateHomeMode();
    assert.strictEqual(dialog._has('estrix-hidden'), true, '已选项目时应保持隐藏');
  } finally {
    state.currentProjectDir = prevDir;
    global.document.getElementById = prevGet;
    global.window.location.href = prevHref;
  }
});

test('showToast 不抛错', () => {
  assert.doesNotThrow(() => ui.showToast('test'));
});

test('setTaskStatus 不抛错', () => {
  assert.doesNotThrow(() => ui.setTaskStatus(true));
});

test('showOverlay/hideOverlay/forceShowOverlay 不抛错', () => {
  assert.doesNotThrow(() => ui.showOverlay());
  assert.doesNotThrow(() => ui.hideOverlay());
  assert.doesNotThrow(() => ui.forceShowOverlay());
});

test('displayCommand 更新预览', () => {
  assert.doesNotThrow(() => ui.displayCommand({ command: 'echo hi' }));
});

test('handleExecute/handleIgnore 不抛错', async () => {
  await ui.handleExecute();
  ui.handleIgnore();
});

test('addHistory 添加记录', () => {
  ui.commandHistory.length = 0;
  ui.addHistory({ id: '1', command: 'echo', success: true, canceled: false, output: 'x', timestamp: Date.now() });
  assert.strictEqual(ui.commandHistory.length, 1);
  assert.strictEqual(ui.commandHistory[0].id, '1');
});

test('renderHistory 空列表', () => {
  ui.commandHistory.length = 0;
  assert.doesNotThrow(() => ui.renderHistory());
});

test('flashBadge 不抛错', () => {
  assert.doesNotThrow(() => ui.flashBadge('test'));
});

test('startOverlayWatcher 不抛错', () => {
  assert.doesNotThrow(() => ui.startOverlayWatcher());
});

