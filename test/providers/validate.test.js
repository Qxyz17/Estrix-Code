'use strict';
import { test } from 'vitest';
import assert from 'node:assert';
import { validateProvider, assertProvider } from '../../src/providers/validate.js';

function validProvider() {
  return {
    id: 'demo',
    name: 'Demo',
    homeUrl: 'https://demo.example.com',
    sessionUrlBase: 'https://demo.example.com/chat/',
    matchesUrl: () => true,
    extractSessionId: () => null,
  };
}

test('validateProvider 合法对象返回 null', () => {
  assert.strictEqual(validateProvider(validProvider()), null);
});

test('validateProvider 非对象返回错误', () => {
  assert.strictEqual(validateProvider(null), '必须是对象');
  assert.strictEqual(validateProvider(undefined), '必须是对象');
  assert.strictEqual(validateProvider('x'), '必须是对象');
  assert.strictEqual(validateProvider(42), '必须是对象');
});

test('validateProvider 缺 id', () => {
  const p = validProvider(); delete p.id;
  assert.strictEqual(validateProvider(p), '缺少 id');
});

test('validateProvider id 非字符串', () => {
  const p = validProvider(); p.id = 123;
  assert.strictEqual(validateProvider(p), '缺少 id');
});

test('validateProvider 空 id 字符串', () => {
  const p = validProvider(); p.id = '';
  assert.strictEqual(validateProvider(p), '缺少 id');
});

test('validateProvider 缺 name', () => {
  const p = validProvider(); delete p.name;
  assert.strictEqual(validateProvider(p), '缺少 name');
});

test('validateProvider 缺 homeUrl', () => {
  const p = validProvider(); delete p.homeUrl;
  assert.strictEqual(validateProvider(p), '缺少 homeUrl');
});

test('validateProvider 缺 sessionUrlBase', () => {
  const p = validProvider(); delete p.sessionUrlBase;
  assert.strictEqual(validateProvider(p), '缺少 sessionUrlBase');
});

test('validateProvider 缺 matchesUrl 方法', () => {
  const p = validProvider(); delete p.matchesUrl;
  assert.strictEqual(validateProvider(p), '缺少 matchesUrl 方法');
});

test('validateProvider matchesUrl 非函数', () => {
  const p = validProvider(); p.matchesUrl = 'nope';
  assert.strictEqual(validateProvider(p), '缺少 matchesUrl 方法');
});

test('validateProvider 缺 extractSessionId 方法', () => {
  const p = validProvider(); delete p.extractSessionId;
  assert.strictEqual(validateProvider(p), '缺少 extractSessionId 方法');
});

test('assertProvider 合法时返回原对象', () => {
  const p = validProvider();
  assert.strictEqual(assertProvider(p), p);
});

test('assertProvider 非法时抛错', () => {
  assert.throws(() => assertProvider({}), /缺少 id/);
  assert.throws(() => assertProvider(null), /必须是对象/);
});
