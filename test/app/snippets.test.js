'use strict';
/**
 * snippets（快捷提示词）数据层测试
 *
 * 隔离：用环境变量 ESTRIX_HOME 把"用户级目录"指向临时目录（外部边界）。
 */
import { test, beforeEach, afterEach, vi } from 'vitest';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const TMP = path.join(os.tmpdir(), 'estrix-snippets-test');
const FAKE_HOME = path.join(TMP, 'home');

let snip;
let oldHome;

function snippetsFile() { return path.join(FAKE_HOME, 'snippets.json'); }

beforeEach(async () => {
  vi.resetModules();
  oldHome = process.env.ESTRIX_HOME;
  process.env.ESTRIX_HOME = FAKE_HOME;
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(FAKE_HOME, { recursive: true });
  snip = await import('../../src/app/snippets.ts');
});

afterEach(() => {
  if (oldHome === undefined) delete process.env.ESTRIX_HOME;
  else process.env.ESTRIX_HOME = oldHome;
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('首次读取：文件不存在 → 写入 3 条默认', () => {
  const list = snip.listSnippets();
  assert.strictEqual(list.length, 3);
  assert.ok(fs.existsSync(snippetsFile()), '应写入 snippets.json');
  // 默认都 autoSend=true
  assert.ok(list.every((s) => s.autoSend === true));
  // 名称含三条默认
  const names = list.map((s) => s.name);
  assert.ok(names.includes('生成项目说明'));
  assert.ok(names.includes('沉浸式交流'));
  assert.ok(names.includes('卡住了?点我'));
});

test('保存后读取：内容持久化且顺序保持', () => {
  snip.saveSnippets([
    { id: 'a', name: 'A', content: 'aaa', autoSend: false },
    { id: 'b', name: 'B', content: 'bbb', autoSend: true },
  ]);
  const list = snip.listSnippets();
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].name, 'A');
  assert.strictEqual(list[0].autoSend, false);
  assert.strictEqual(list[1].autoSend, true);
});

test('saveSnippets 过滤掉非法项（缺 name / 缺 content）', () => {
  snip.saveSnippets([
    { id: 'ok', name: '正常', content: '正文', autoSend: true },
    { id: 'no-name', name: '', content: 'x' },
    { id: 'no-content', name: 'x', content: '   ' },
    null,
    'string',
    { name: '只缺 content', content: '' },
  ]);
  const list = snip.listSnippets();
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].name, '正常');
});

test('autoSend 缺省视为 true（非 false 即 true）', () => {
  snip.saveSnippets([{ id: 'x', name: 'X', content: 'xx' }]);
  const list = snip.listSnippets();
  assert.strictEqual(list[0].autoSend, true);
});

test('id 缺失时自动生成', () => {
  snip.saveSnippets([{ name: 'X', content: 'xx', autoSend: true }]);
  const list = snip.listSnippets();
  assert.ok(list[0].id && typeof list[0].id === 'string');
});

test('保存空数组：读取返回空（不回退默认）', () => {
  snip.saveSnippets([]);
  const list = snip.listSnippets();
  assert.strictEqual(list.length, 0);
});

test('文件内容损坏（非数组）：回退到默认并重写', () => {
  fs.writeFileSync(snippetsFile(), '{ not an array }', 'utf-8');
  const list = snip.listSnippets();
  assert.strictEqual(list.length, 3);
});
