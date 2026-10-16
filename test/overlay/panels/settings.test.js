'use strict';
import { test, beforeEach, afterEach, vi } from 'vitest';
import assert from 'node:assert';

let settings;
let els;

// 简易 DOM 模拟（外部边界）：按 id 存取元素
function makeEl(id) {
  return {
    id,
    value: '',
    checked: false,
    textContent: '',
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, f) { if (f) this._s.add(c); else this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
  };
}

function setupGlobals() {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
  els = {};
  globalThis.document = {
    getElementById: (id) => els[id] || null,
    createElement: (tag) => makeEl('el-' + tag),
    querySelector: () => null,
    querySelectorAll: () => [],
    body: { appendChild() {} },
  };
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
}

beforeEach(async () => {
  vi.resetModules();
  setupGlobals();
  settings = await import('../../../src/overlay/panels/settings.js');
});

afterEach(() => {
  vi.useRealTimers();
});

test('openSettings 从 localStorage 加载到输入框', () => {
  const id = 'estrix-retry-count';
  els[id] = makeEl(id);
  localStorage.setItem('estrix-retry-count', '7');
  const panel = 'estrix-settings';
  els[panel] = makeEl(panel);
  els[panel].classList.add('estrix-hidden');
  settings.openSettings();
  assert.strictEqual(els[id].value, '7');
  assert.strictEqual(els[panel].classList.contains('estrix-hidden'), false);
});

test('openSettings 毫秒转秒', () => {
  const id = 'estrix-retry-delay-min';
  els[id] = makeEl(id);
  localStorage.setItem('estrix-retry-delay-min', '5000');
  settings.openSettings();
  assert.strictEqual(els[id].value, '5');
});

test('openSettings 无 localStorage 用默认值', () => {
  const id = 'estrix-retry-count';
  els[id] = makeEl(id);
  settings.openSettings();
  assert.strictEqual(els[id].value, '10');
});

test('closeSettings 加 hidden 类', () => {
  const panel = 'estrix-settings';
  els[panel] = makeEl(panel);
  settings.closeSettings();
  assert.strictEqual(els[panel].classList.contains('estrix-hidden'), true);
});

test('saveSettings 校验：最小间隔非法被拒绝', () => {
  els['estrix-retry-delay-min'] = makeEl('estrix-retry-delay-min');
  els['estrix-retry-delay-min'].value = 'abc';
  settings.saveSettings();
  // 未写入 → localStorage 无该键
  assert.strictEqual(localStorage.getItem('estrix-retry-delay-min'), null);
});

test('saveSettings 校验：最大间隔小于最小被拒绝', () => {
  els['estrix-retry-delay-min'] = makeEl('a'); els['estrix-retry-delay-min'].value = '5';
  els['estrix-retry-delay-max'] = makeEl('b'); els['estrix-retry-delay-max'].value = '3';
  settings.saveSettings();
  assert.strictEqual(localStorage.getItem('estrix-retry-delay-max'), null);
});

test('saveSettings 校验：重试次数非整数被拒绝', () => {
  els['estrix-retry-delay-min'] = makeEl('a'); els['estrix-retry-delay-min'].value = '4';
  els['estrix-retry-delay-max'] = makeEl('b'); els['estrix-retry-delay-max'].value = '10';
  els['estrix-retry-count'] = makeEl('c'); els['estrix-retry-count'].value = 'x';
  settings.saveSettings();
  assert.strictEqual(localStorage.getItem('estrix-retry-count'), null);
});

test('saveSettings 校验：提示词为空被拒绝', () => {
  els['estrix-retry-delay-min'] = makeEl('a'); els['estrix-retry-delay-min'].value = '4';
  els['estrix-retry-delay-max'] = makeEl('b'); els['estrix-retry-delay-max'].value = '10';
  els['estrix-retry-count'] = makeEl('c'); els['estrix-retry-count'].value = '10';
  els['estrix-retry-429-delay'] = makeEl('d'); els['estrix-retry-429-delay'].value = '60';
  els['estrix-retry-429-count'] = makeEl('e'); els['estrix-retry-429-count'].value = '20';
  els['estrix-retry-prompt'] = makeEl('f'); els['estrix-retry-prompt'].value = '   ';
  settings.saveSettings();
  assert.strictEqual(localStorage.getItem('estrix-retry-prompt'), null);
});

test('saveSettings 校验：发送延迟最大超 10 秒被拒绝', () => {
  fillValid();
  els['estrix-delay-min'] = makeEl('x'); els['estrix-delay-min'].value = '1';
  els['estrix-delay-max'] = makeEl('y'); els['estrix-delay-max'].value = '11';
  settings.saveSettings();
  assert.strictEqual(localStorage.getItem('estrix-send-delay-max'), null);
});

test('saveSettings 校验：附件间隔最大超 60 秒被拒绝', () => {
  fillValid();
  els['estrix-delay-min'] = makeEl('x'); els['estrix-delay-min'].value = '1';
  els['estrix-delay-max'] = makeEl('y'); els['estrix-delay-max'].value = '2';
  els['estrix-attach-delay-min'] = makeEl('z'); els['estrix-attach-delay-min'].value = '1';
  els['estrix-attach-delay-max'] = makeEl('w'); els['estrix-attach-delay-max'].value = '61';
  settings.saveSettings();
  assert.strictEqual(localStorage.getItem('estrix-attach-delay-max'), null);
});

function fillValid() {
  const map = {
    'estrix-retry-delay-min': '4',
    'estrix-retry-delay-max': '10',
    'estrix-retry-count': '10',
    'estrix-retry-429-delay': '60',
    'estrix-retry-429-count': '20',
    'estrix-retry-prompt': '请继续',
    'estrix-xhr-idle-timeout': '300',
    'estrix-watchdog-prompt': '请继续',
    'estrix-watchdog-count': '3',
  };
  for (const [k, v] of Object.entries(map)) {
    els[k] = makeEl(k);
    els[k].value = v;
  }
}

test('saveSettings 全部合法写入 localStorage', () => {
  fillValid();
  els['estrix-delay-min'] = makeEl('x'); els['estrix-delay-min'].value = '2';
  els['estrix-delay-max'] = makeEl('y'); els['estrix-delay-max'].value = '4';
  els['estrix-attach-delay-min'] = makeEl('z'); els['estrix-attach-delay-min'].value = '0.5';
  els['estrix-attach-delay-max'] = makeEl('w'); els['estrix-attach-delay-max'].value = '1';
  els['estrix-retry-enabled'] = makeEl('en'); els['estrix-retry-enabled'].checked = true;
  els['estrix-settings'] = makeEl('estrix-settings');

  settings.saveSettings();

  assert.strictEqual(localStorage.getItem('estrix-retry-delay-min'), '4000');
  assert.strictEqual(localStorage.getItem('estrix-retry-delay-max'), '10000');
  assert.strictEqual(localStorage.getItem('estrix-retry-count'), '10');
  assert.strictEqual(localStorage.getItem('estrix-retry-enabled'), '1');
  assert.strictEqual(localStorage.getItem('estrix-send-delay-min'), '2000');
  assert.strictEqual(localStorage.getItem('estrix-send-delay-max'), '4000');
});

test('resetSettings 清空 localStorage 键并回到默认', () => {
  localStorage.setItem('estrix-retry-count', '99');
  localStorage.setItem('estrix-send-delay-min', '999');
  const panel = 'estrix-settings';
  els[panel] = makeEl(panel);
  settings.resetSettings();
  assert.strictEqual(localStorage.getItem('estrix-retry-count'), null);
  assert.strictEqual(localStorage.getItem('estrix-send-delay-min'), null);
});
