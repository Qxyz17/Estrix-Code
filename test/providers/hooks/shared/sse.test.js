'use strict';
import { test } from 'vitest';
import assert from 'node:assert';
import { createFrameDecoder, extractData, parseBlock } from '../../../../src/providers/hooks/shared/sse.js';

// ===== createFrameDecoder =====

test('createFrameDecoder 按空行切帧（\n\n）', () => {
  const d = createFrameDecoder();
  const frames = d.push('data: a\n\ndata: b\n\n');
  assert.deepStrictEqual(frames, ['data: a', 'data: b']);
});

test('createFrameDecoder 按 \r\n\r\n 切帧', () => {
  const d = createFrameDecoder();
  const frames = d.push('data: a\r\n\r\ndata: b\r\n\r\n');
  assert.deepStrictEqual(frames, ['data: a', 'data: b']);
});

test('createFrameDecoder 分块到达：半帧不输出，凑齐才输出', () => {
  const d = createFrameDecoder();
  assert.deepStrictEqual(d.push('data: he'), []);
  assert.deepStrictEqual(d.push('llo\n'), []);
  const frames = d.push('\n');
  assert.deepStrictEqual(frames, ['data: hello']);
});

test('createFrameDecoder 一次 push 多个完整帧 + 残留', () => {
  const d = createFrameDecoder();
  const frames = d.push('data: 1\n\ndata: 2\n\ndata: 3');
  assert.deepStrictEqual(frames, ['data: 1', 'data: 2']);
  // 残留 data: 3 未凑齐空行，由 finish 输出
  assert.deepStrictEqual(d.finish(), ['data: 3']);
});

test('createFrameDecoder finish 无残留返回空数组', () => {
  const d = createFrameDecoder();
  d.push('data: a\n\n');
  assert.deepStrictEqual(d.finish(), []);
});

test('createFrameDecoder finish 后状态重置', () => {
  const d = createFrameDecoder();
  d.push('partial');
  assert.deepStrictEqual(d.finish(), ['partial']);
  assert.deepStrictEqual(d.finish(), []);
});

test('createFrameDecoder 空 push', () => {
  const d = createFrameDecoder();
  assert.deepStrictEqual(d.push(''), []);
  assert.deepStrictEqual(d.finish(), []);
});

test('createFrameDecoder 帧内保留换行', () => {
  const d = createFrameDecoder();
  const frames = d.push('event: x\ndata: 1\n\n');
  assert.deepStrictEqual(frames, ['event: x\ndata: 1']);
});

// ===== extractData =====

test('extractData 提取单行 data', () => {
  assert.strictEqual(extractData('data: hello'), 'hello');
});

test('extractData 多行 data 用 \n 拼接', () => {
  assert.strictEqual(extractData('data: a\ndata: b'), 'a\nb');
});

test('extractData 忽略非 data 行', () => {
  assert.strictEqual(extractData('event: x\ndata: v\nid: 1'), 'v');
});

test('extractData data: 后无空格', () => {
  assert.strictEqual(extractData('data:hello'), 'hello');
});

test('extractData 空块返回 null', () => {
  assert.strictEqual(extractData(''), null);
  assert.strictEqual(extractData('   '), null);
  assert.strictEqual(extractData(null), null);
  assert.strictEqual(extractData(undefined), null);
});

test('extractData 无 data 行返回 null', () => {
  assert.strictEqual(extractData('event: x\nid: 1'), null);
});

test('extractData 保留 [DONE] 原文', () => {
  assert.strictEqual(extractData('data: [DONE]'), '[DONE]');
});

test('extractData 兼容 \r\n 分隔行', () => {
  assert.strictEqual(extractData('event: x\r\ndata: v'), 'v');
});

// ===== parseBlock =====

test('parseBlock 解析合法 JSON', () => {
  assert.deepStrictEqual(parseBlock('data: {"a":1}'), { a: 1 });
});

test('parseBlock 坏 JSON 返回 null', () => {
  assert.strictEqual(parseBlock('data: {not json}'), null);
});

test('parseBlock 无 data 返回 null', () => {
  assert.strictEqual(parseBlock('event: x'), null);
  assert.strictEqual(parseBlock(''), null);
});

test('parseBlock 多行 data 拼接后解析', () => {
  assert.deepStrictEqual(parseBlock('data: {"a":\ndata: 1}'), { a: 1 });
});

test('parseBlock [DONE] 非法 JSON 返回 null', () => {
  assert.strictEqual(parseBlock('data: [DONE]'), null);
});
