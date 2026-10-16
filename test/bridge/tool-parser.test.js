'use strict';
import { test } from 'vitest';
import assert from 'node:assert';
import { looksLikeJsonToolCall } from '../../src/bridge/parser/json-detector.js';

// D11：已废除 JSON 执行模式，json-detector 仅保留"识别"能力（用于发提示）。

test('looksLikeJsonToolCall 识别 toolName 格式', () => {
  assert.strictEqual(looksLikeJsonToolCall('{"toolName":"bash","params":{}}'), true);
});

test('looksLikeJsonToolCall 识别 tool 格式', () => {
  assert.strictEqual(looksLikeJsonToolCall('{"tool":"read","parameters":{}}'), true);
});

test('looksLikeJsonToolCall 允许前后空白与带引号键', () => {
  assert.strictEqual(looksLikeJsonToolCall('  { "tool" : {} }'), true);
  assert.strictEqual(looksLikeJsonToolCall('{"tool" : 1}'), true);
});

test('looksLikeJsonToolCall 普通文本返回 false', () => {
  assert.strictEqual(looksLikeJsonToolCall('hello world'), false);
  assert.strictEqual(looksLikeJsonToolCall('{"a":1}'), false);
  assert.strictEqual(looksLikeJsonToolCall(''), false);
  assert.strictEqual(looksLikeJsonToolCall(null), false);
});
