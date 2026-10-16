'use strict';
/**
 * profile 飞书群绑定测试
 *
 * 隔离：createRequire mock 指向临时 userData（外部边界），其余跑真实读写。
 * 覆盖：绑定/解绑、按 chatId 反查、profile 不存在时的容错。
 */
import { test, beforeEach, afterEach, vi } from 'vitest';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const TMP = path.join(os.tmpdir(), 'estrix-profile-feishu-test');
const USER_DATA = path.join(TMP, 'userdata');

vi.mock('node:module', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createRequire: () => (id) => {
      if (id === 'electron') return { app: { getPath: () => USER_DATA } };
      throw new Error('unexpected require: ' + id);
    },
  };
});

let profile;

beforeEach(async () => {
  vi.resetModules();
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(USER_DATA, { recursive: true });
  profile = await import('../../src/app/profile.js');
});

afterEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('createProfile 带空的飞书群字段', () => {
  const p = profile.createProfile('窗口A', 'deepseek');
  assert.strictEqual(p.feishuChatId, '');
  assert.strictEqual(p.feishuChatName, '');
});

test('setProfileFeishuChat 绑定群并持久化', () => {
  const p = profile.createProfile('窗口A', 'deepseek');
  const updated = profile.setProfileFeishuChat(p.id, 'oc_abc', '项目A群');
  assert.strictEqual(updated.feishuChatId, 'oc_abc');
  assert.strictEqual(updated.feishuChatName, '项目A群');
  // 重新读取（持久化验证）
  const p2 = profile.getProfileById(p.id);
  assert.strictEqual(p2.feishuChatId, 'oc_abc');
  assert.strictEqual(p2.feishuChatName, '项目A群');
});

test('setProfileFeishuChat 传空串=解绑', () => {
  const p = profile.createProfile('窗口A', 'deepseek');
  profile.setProfileFeishuChat(p.id, 'oc_abc', '群');
  profile.setProfileFeishuChat(p.id, '', '');
  const p2 = profile.getProfileById(p.id);
  assert.strictEqual(p2.feishuChatId, '');
  assert.strictEqual(p2.feishuChatName, '');
});

test('setProfileFeishuChat 对不存在的 profile 返回 null', () => {
  const r = profile.setProfileFeishuChat('不存在', 'oc_x', '群');
  assert.strictEqual(r, null);
});

test('getProfileByFeishuChat 按 chatId 反查窗口', () => {
  const a = profile.createProfile('窗口A', 'deepseek');
  const b = profile.createProfile('窗口B', 'claude');
  profile.setProfileFeishuChat(a.id, 'oc_aaa', '群A');
  profile.setProfileFeishuChat(b.id, 'oc_bbb', '群B');
  assert.strictEqual(profile.getProfileByFeishuChat('oc_aaa').id, a.id);
  assert.strictEqual(profile.getProfileByFeishuChat('oc_bbb').id, b.id);
});

test('getProfileByFeishuChat 未绑定/空 chatId 返回 null', () => {
  profile.createProfile('窗口A', 'deepseek');
  assert.strictEqual(profile.getProfileByFeishuChat('oc_不存在'), null);
  assert.strictEqual(profile.getProfileByFeishuChat(''), null);
  assert.strictEqual(profile.getProfileByFeishuChat(null), null);
});
