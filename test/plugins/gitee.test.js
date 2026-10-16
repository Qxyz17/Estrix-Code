'use strict';
/**
 * Gitee 地址构造与校验测试
 *
 * 安全关键：repo/branch 会拼进 URL，必须严格校验（防路径逃逸）。
 * Gitee 分支名可含中文（实测"稳定喵"），故不能沿用 GitHub 的 ASCII 限制。
 */
import { test } from 'vitest';
import assert from 'node:assert';

import {
  isGiteeRepo,
  stripGiteePrefix,
  withGiteePrefix,
  isValidGiteeRepo,
  isValidGiteeBranch,
  buildGiteeArchiveUrl,
  buildGiteeRawUrl,
  buildGiteeSearchUrl,
  buildGiteeUserReposUrl,
  GITEE_PREFIX,
} from '../../src/plugins/gitee.js';

// ===== 来源前缀 =====

test('isGiteeRepo: 识别 gitee: 前缀', () => {
  assert.strictEqual(isGiteeRepo('gitee:owner/repo'), true);
  assert.strictEqual(isGiteeRepo('owner/repo'), false);
  assert.strictEqual(isGiteeRepo(null), false);
});

test('stripGiteePrefix / withGiteePrefix', () => {
  assert.strictEqual(stripGiteePrefix('gitee:owner/repo'), 'owner/repo');
  assert.strictEqual(stripGiteePrefix('owner/repo'), 'owner/repo');
  assert.strictEqual(withGiteePrefix('owner/repo'), 'gitee:owner/repo');
  assert.strictEqual(withGiteePrefix('gitee:owner/repo'), 'gitee:owner/repo');
});

// ===== repo 校验 =====

test('isValidGiteeRepo: 接受合法', () => {
  assert.strictEqual(isValidGiteeRepo('owner/repo'), true);
  assert.strictEqual(isValidGiteeRepo('jiangcheng-cat-AI/ai-proxy-gateway'), true);
  assert.strictEqual(isValidGiteeRepo('a/b.c_d-e'), true);
});

test('isValidGiteeRepo: 拒绝路径逃逸', () => {
  assert.strictEqual(isValidGiteeRepo('..'), false);
  assert.strictEqual(isValidGiteeRepo('a/b/c'), false);
  assert.strictEqual(isValidGiteeRepo('a/..'), false);
  assert.strictEqual(isValidGiteeRepo('/repo'), false);
  assert.strictEqual(isValidGiteeRepo('owner/'), false);
});

// ===== branch 校验（关键：允许中文，拒绝逃逸）=====

test('isValidGiteeBranch: 接受常规与中文分支', () => {
  assert.strictEqual(isValidGiteeBranch('master'), true);
  assert.strictEqual(isValidGiteeBranch('main'), true);
  assert.strictEqual(isValidGiteeBranch('v1.0.0'), true);
  assert.strictEqual(isValidGiteeBranch('稳定喵'), true);
});

test('isValidGiteeBranch: 拒绝路径分隔与控制字符', () => {
  assert.strictEqual(isValidGiteeBranch('a/b'), false);
  assert.strictEqual(isValidGiteeBranch('..'), false);
  assert.strictEqual(isValidGiteeBranch('a..b'), false);
  assert.strictEqual(isValidGiteeBranch('a b'), false);
  assert.strictEqual(isValidGiteeBranch(''), false);
  assert.strictEqual(isValidGiteeBranch(null), false);
  assert.strictEqual(isValidGiteeBranch('a\u0001b'), false);
});

// ===== URL 构造 =====

test('buildGiteeArchiveUrl: 中文分支正确编码', () => {
  assert.strictEqual(
    buildGiteeArchiveUrl('owner/repo', 'master'),
    'https://gitee.com/owner/repo/repository/archive/master.tar.gz'
  );
  const u = buildGiteeArchiveUrl('owner/repo', '稳定喵');
  assert.ok(u.includes('%E7%A8%B3%E5%AE%9A%E5%96%B5'));
  assert.ok(u.endsWith('.tar.gz'));
});

test('buildGiteeRawUrl', () => {
  assert.strictEqual(
    buildGiteeRawUrl('owner/repo', 'master', 'plugin.json'),
    'https://gitee.com/owner/repo/raw/master/plugin.json'
  );
});

test('buildGiteeSearchUrl: 带/不带 token', () => {
  assert.ok(buildGiteeSearchUrl('estrix-plugin').indexOf('access_token') === -1);
  assert.ok(buildGiteeSearchUrl('estrix-plugin', 'abc').indexOf('access_token=abc') !== -1);
});

test('buildGiteeUserReposUrl', () => {
  assert.strictEqual(
    buildGiteeUserReposUrl('someuser'),
    'https://gitee.com/api/v5/users/someuser/repos?per_page=100'
  );
});
