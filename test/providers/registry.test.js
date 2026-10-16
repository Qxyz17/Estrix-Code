'use strict';
import { test } from 'vitest';
import assert from 'node:assert';
import { providers, getProvider, getAllProviders, getProviderByUrl } from '../../src/providers/registry.js';

test('providers 是非空数组', () => {
  assert.ok(Array.isArray(providers));
  assert.ok(providers.length >= 3);
});

test('getAllProviders 含三个内置平台', () => {
  const all = getAllProviders();
  const ids = all.map((p) => p.id);
  assert.ok(ids.includes('deepseek'));
  assert.ok(ids.includes('claude'));
  assert.ok(ids.includes('chatgpt'));
});

test('getProvider 返回对应 provider', () => {
  assert.strictEqual(getProvider('deepseek').id, 'deepseek');
  assert.strictEqual(getProvider('claude').id, 'claude');
  assert.strictEqual(getProvider('chatgpt').id, 'chatgpt');
});

test('getProvider 未知 id 返回 null（失败路径）', () => {
  assert.strictEqual(getProvider('no-such-provider'), null);
  assert.strictEqual(getProvider(''), null);
});

test('getProviderByUrl 识别 DeepSeek', () => {
  assert.strictEqual(getProviderByUrl('https://chat.deepseek.com/').id, 'deepseek');
  assert.strictEqual(getProviderByUrl('https://chat.deepseek.com/a/chat/s/abc123').id, 'deepseek');
});

test('getProviderByUrl 识别 Claude', () => {
  assert.strictEqual(getProviderByUrl('https://claude.ai/new').id, 'claude');
  assert.strictEqual(getProviderByUrl('https://claude.ai/chat/abc123').id, 'claude');
});

test('getProviderByUrl 识别 ChatGPT', () => {
  assert.strictEqual(getProviderByUrl('https://chatgpt.com/').id, 'chatgpt');
  assert.strictEqual(getProviderByUrl('https://chat.openai.com/c/abc').id, 'chatgpt');
});

test('getProviderByUrl 未知 URL 返回 null（失败路径）', () => {
  assert.strictEqual(getProviderByUrl('https://example.com'), null);
  assert.strictEqual(getProviderByUrl('not a url'), null);
});

test('getProviderByUrl 空字符串 / null（失败路径）', () => {
  assert.strictEqual(getProviderByUrl(''), null);
  assert.strictEqual(getProviderByUrl(null), null);
  assert.strictEqual(getProviderByUrl(undefined), null);
});

test('内置 provider 均通过字段校验（有匹配方法）', () => {
  for (const p of getAllProviders()) {
    assert.strictEqual(typeof p.matchesUrl, 'function', p.id + ' 应有 matchesUrl');
    assert.strictEqual(typeof p.extractSessionId, 'function', p.id + ' 应有 extractSessionId');
  }
});
