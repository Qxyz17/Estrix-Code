'use strict';
import { test } from 'vitest';
import assert from 'node:assert';
import { parseWriteArgs, formatWriteOutput } from '../../src/tools/impl/write.js';

test('parseWriteArgs 正常', () => {
  assert.deepStrictEqual(parseWriteArgs('a.txt', 'hello'), { filePath: 'a.txt', content: 'hello' });
  assert.deepStrictEqual(parseWriteArgs('a.txt', ''), { filePath: 'a.txt', content: '' });
});

test('parseWriteArgs 非法路径', () => {
  assert.throws(() => parseWriteArgs('', 'x'), /filePath must be a non-empty string/);
  assert.throws(() => parseWriteArgs('   ', 'x'), /filePath must be a non-empty string/);
});

test('parseWriteArgs content 非字符串', () => {
  assert.throws(() => parseWriteArgs('a.txt', 123), /content must be a string/);
  assert.throws(() => parseWriteArgs('a.txt', null), /content must be a string/);
});

test('formatWriteOutput create/update', () => {
  assert.match(formatWriteOutput('a.txt', 'create'), /Created file/);
  assert.match(formatWriteOutput('a.txt', 'update'), /Updated file/);
  assert.match(formatWriteOutput('a.txt', 'create'), /<path>a.txt<\/path>/);
});

