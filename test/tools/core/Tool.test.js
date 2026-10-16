'use strict';
import { test } from 'vitest';
import assert from 'node:assert';
import { Tool } from '../../../src/tools/core/Tool.js';

test('Tool 构造函数设置字段', () => {
  const t = new Tool('demo', 'desc', { type: 'object' }, 'demo()');
  assert.strictEqual(t.name, 'demo');
  assert.strictEqual(t.description, 'desc');
  assert.deepStrictEqual(t.parameters, { type: 'object' });
  assert.strictEqual(t.jsApi, 'demo()');
});

test('Tool jsApi 缺省为 null', () => {
  const t = new Tool('demo', 'desc', {});
  assert.strictEqual(t.jsApi, null);
});

test('Tool jsApi 传空字符串回退 null', () => {
  const t = new Tool('demo', 'desc', {}, '');
  assert.strictEqual(t.jsApi, null);
});

test('Tool.getDescription 返回完整描述', () => {
  const t = new Tool('demo', 'desc', { p: 1 }, 'demo()');
  assert.deepStrictEqual(t.getDescription(), {
    name: 'demo',
    description: 'desc',
    parameters: { p: 1 },
    jsApi: 'demo()',
  });
});

test('Tool.getPromptSection 默认返回 null', () => {
  const t = new Tool('demo', 'desc', {});
  assert.strictEqual(t.getPromptSection(), null);
});

test('Tool.execute 基类抛错', async () => {
  const t = new Tool('demo', 'desc', {});
  await assert.rejects(() => t.execute({}), /必须由子类实现/);
});

test('Tool 子类可覆写 execute', async () => {
  class MyTool extends Tool {
    async execute(params) { return params.x * 2; }
  }
  const t = new MyTool('m', 'd', {});
  assert.strictEqual(await t.execute({ x: 3 }), 6);
});
