'use strict';
import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ReadLinesTool } from '../../src/tools/impl/read-lines.js';

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'estrix-readlines-'));
}

test('ReadLinesTool 返回结构化行', async () => {
  const dir = makeTmp();
  const file = path.join(dir, 'a.txt');
  fs.writeFileSync(file, ['line1', 'line2', 'line3'].join('\n'), 'utf8');

  const tool = new ReadLinesTool();
  const r = await tool.execute({ filePath: file });

  assert.strictEqual(r.success, true);
  assert.strictEqual(r.data.totalLines, 3);
  assert.strictEqual(r.data.offset, 1);
  assert.strictEqual(r.data.lines.length, 3);
  assert.deepStrictEqual(r.data.lines.map(l => l.number), [1, 2, 3]);
  assert.deepStrictEqual(r.data.lines.map(l => l.text), ['line1', 'line2', 'line3']);
});

test('ReadLinesTool offset/limit 分段', async () => {
  const dir = makeTmp();
  const file = path.join(dir, 'a.txt');
  fs.writeFileSync(file, ['a', 'b', 'c', 'd', ''].join('\n'), 'utf8');

  const tool = new ReadLinesTool();
  const r = await tool.execute({ filePath: file, offset: 2, limit: 2 });

  assert.strictEqual(r.success, true);
  assert.strictEqual(r.data.totalLines, 5);
  assert.strictEqual(r.data.offset, 2);
  assert.strictEqual(r.data.lines.length, 2);
  assert.deepStrictEqual(r.data.lines.map(l => l.text), ['b', 'c']);
  assert.deepStrictEqual(r.data.lines.map(l => l.number), [2, 3]);
});

test('ReadLinesTool 文件不存在', async () => {
  const tool = new ReadLinesTool();
  const r = await tool.execute({ filePath: path.join(os.tmpdir(), 'nonexistent-xyz.txt') });
  assert.strictEqual(r.success, false);
  assert.match(r.error, /文件不存在/);
});

test('ReadLinesTool 相对路径 + projectDir', async () => {
  const dir = makeTmp();
  fs.writeFileSync(path.join(dir, 'rel.txt'), ['x', 'y', ''].join('\n'), 'utf8');

  const tool = new ReadLinesTool();
  const r = await tool.execute({ filePath: 'rel.txt', projectDir: dir });

  assert.strictEqual(r.success, true);
  assert.strictEqual(r.data.lines.length, 3);
  assert.deepStrictEqual(r.data.lines.map(l => l.text), ['x', 'y', '']);
});

test('ReadLinesTool offset 越界', async () => {
  const dir = makeTmp();
  const file = path.join(dir, 'a.txt');
  fs.writeFileSync(file, 'only one line', 'utf8');

  const tool = new ReadLinesTool();
  const r = await tool.execute({ filePath: file, offset: 99 });
  assert.strictEqual(r.success, false);
  assert.match(r.error, /out of range/);
});

