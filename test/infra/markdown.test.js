'use strict';
import { test } from 'vitest';
import assert from 'node:assert';
import { BT, FENCE } from '../../src/infra/markdown.js';

test('BT 是单个反引号', () => {
  assert.strictEqual(BT, '\u0060');
});

test('FENCE 是三个反引号', () => {
  assert.strictEqual(FENCE, '\u0060\u0060\u0060');
});

test('FENCE 长度为 3', () => {
  assert.strictEqual(FENCE.length, 3);
});
