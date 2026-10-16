'use strict';
/**
 * feishu-bridge.stripToolBlocks 测试
 *
 * 纯函数（隐私过滤核心）：剥离工具代码块，飞书只显示对话。
 * 无需 mock——直接 import 纯函数。注意：该模块顶层 require('electron')，
 * 但 stripToolBlocks 不触碰 electron，故 mock 一个空壳即可（外部边界）。
 */
import { test, beforeEach, vi } from 'vitest';
import assert from 'node:assert';

vi.mock('node:module', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createRequire: () => (id) => {
      if (id === 'electron') return { ipcRenderer: { on: () => {}, invoke: () => Promise.resolve() } };
      throw new Error('unexpected require: ' + id);
    },
  };
});

let stripToolBlocks;

beforeEach(async () => {
  vi.resetModules();
  ({ stripToolBlocks } = await import('../../src/bridge/feishu-bridge.js'));
});

test('剥离完整 estrix 代码块', () => {
  const input = '帮你看下\n\n' + '\u0060\u0060\u0060estrix\nconst a = 1;\nlog(a);\n\u0060\u0060\u0060' + '\n\n完成';
  const out = stripToolBlocks(input);
  assert.ok(!out.includes('estrix'));
  assert.ok(!out.includes('const a = 1'));
  assert.ok(out.includes('帮你看下'));
  assert.ok(out.includes('完成'));
});

test('剥离 javascript / js 代码块', () => {
  const js = '\u0060\u0060\u0060javascript\nconsole.log(1)\n\u0060\u0060\u0060';
  const short = '\u0060\u0060\u0060js\nlet x=1\n\u0060\u0060\u0060';
  assert.strictEqual(stripToolBlocks('前' + js + '后'), '前后');
  assert.strictEqual(stripToolBlocks('A' + short + 'B'), 'AB');
});

test('流式未闭合代码块：从开标记起全部隐藏', () => {
  const input = '这是回复\n\u0060\u0060\u0060estrix\nconst r = await read(';
  const out = stripToolBlocks(input);
  assert.strictEqual(out, '这是回复');
});

test('空输入返回空串', () => {
  assert.strictEqual(stripToolBlocks(''), '');
  assert.strictEqual(stripToolBlocks(null), '');
  assert.strictEqual(stripToolBlocks(undefined), '');
});

test('无工具代码块时原样保留（仅 trim）', () => {
  assert.strictEqual(stripToolBlocks('  你好，世界  '), '你好，世界');
});

test('多个代码块全部剥离', () => {
  const b = '\u0060\u0060\u0060estrix\nfoo()\n\u0060\u0060\u0060';
  const input = '开始' + b + '中间' + b + '结束';
  const out = stripToolBlocks(input);
  assert.ok(!out.includes('foo()'));
  assert.ok(out.includes('开始') && out.includes('中间') && out.includes('结束'));
});
