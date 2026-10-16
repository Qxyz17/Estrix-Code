'use strict';
import { test, vi, afterEach } from 'vitest';
import assert from 'node:assert';
import { withLog, withLogObject } from '../../src/infra/with-log.js';

afterEach(() => {
  vi.restoreAllMocks();
});

test('withLog 透传返回值', () => {
  const logs = [];
  vi.spyOn(console, 'log').mockImplementation((m) => logs.push(m));
  const fn = withLog(function add(a, b) { return a + b; }, 'add');
  assert.strictEqual(fn(1, 2), 3);
  assert.ok(logs.some((l) => String(l).includes('[AOP][add]')));
});

test('withLog 记录入参', () => {
  const logs = [];
  vi.spyOn(console, 'log').mockImplementation((m) => logs.push(m));
  const fn = withLog((x) => x, 'id');
  fn('hello');
  assert.ok(logs.some((l) => String(l).includes('hello')));
});

test('withLog 抛错时记录并重新抛出', () => {
  const logs = [];
  vi.spyOn(console, 'log').mockImplementation((m) => logs.push(m));
  const fn = withLog(() => { throw new Error('boom'); }, 'boomfn');
  assert.throws(() => fn(), /boom/);
  assert.ok(logs.some((l) => String(l).includes('抛错')));
});

test('withLog Promise 解析值记录', async () => {
  const logs = [];
  vi.spyOn(console, 'log').mockImplementation((m) => logs.push(m));
  const fn = withLog(async () => 'resolved');
  const v = await fn();
  assert.strictEqual(v, 'resolved');
  assert.ok(logs.some((l) => String(l).includes('Promise')));
});

test('withLog Promise 拒绝记录并抛出', async () => {
  const logs = [];
  vi.spyOn(console, 'log').mockImplementation((m) => logs.push(m));
  const fn = withLog(async () => { throw new Error('rejected'); }, 'pf');
  await assert.rejects(() => fn(), /rejected/);
  assert.ok(logs.some((l) => String(l).includes('拒绝')));
});

test('withLog 保留 this', () => {
  const obj = {
    v: 42,
    m: withLog(function () { return this.v; }, 'm'),
  };
  assert.strictEqual(obj.m(), 42);
});

test('withLog 长字符串截断', () => {
  const logs = [];
  vi.spyOn(console, 'log').mockImplementation((m) => logs.push(m));
  const fn = withLog((s) => s, 'long');
  const long = 'x'.repeat(300);
  fn(long);
  // 日志中不应包含完整 300 字符
  assert.ok(!logs.some((l) => String(l).includes(long)));
  assert.ok(logs.some((l) => String(l).includes('...')));
});

test('withLog 循环引用兜底', () => {
  const logs = [];
  vi.spyOn(console, 'log').mockImplementation((m) => logs.push(m));
  const a = {}; a.self = a;
  const fn = withLog((x) => x, 'circ');
  // 不应抛错
  fn(a);
});

test('withLogObject 包装对象所有函数', () => {
  const logs = [];
  vi.spyOn(console, 'log').mockImplementation((m) => logs.push(m));
  const mod = {
    add: (a, b) => a + b,
    sub: (a, b) => a - b,
    val: 5,
  };
  withLogObject(mod, 'math');
  assert.strictEqual(mod.add(2, 3), 5);
  assert.strictEqual(mod.sub(5, 1), 4);
  assert.strictEqual(mod.val, 5); // 非函数保持不变
  assert.ok(logs.some((l) => String(l).includes('[AOP][math.add]')));
  assert.ok(logs.some((l) => String(l).includes('[AOP][math.sub]')));
});

test('withLog 无 label 用函数名', () => {
  const logs = [];
  vi.spyOn(console, 'log').mockImplementation((m) => logs.push(m));
  const fn = withLog(function namedFn() { return 1; });
  fn();
  assert.ok(logs.some((l) => String(l).includes('[AOP][namedFn]')));
});
