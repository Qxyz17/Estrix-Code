'use strict';
/**
 * infra/user-agent 测试（纯函数）
 *
 * 关键：UA 里的 Chrome 版本必须来自 process.versions.chrome（真实内核），
 * 否则与 sec-ch-ua 矛盾，会被 Google 判定"浏览器不安全"。
 */
import { test } from 'vitest';
import assert from 'node:assert';
import { buildChromeUserAgent, chromeMajor } from '../../src/infra/user-agent.js';

test('chromeMajor 取主版本号', () => {
  const prev = process.versions.chrome;
  try {
    Object.defineProperty(process.versions, 'chrome', { value: '152.0.7977.130', configurable: true });
    assert.strictEqual(chromeMajor(), '152');
  } finally {
    Object.defineProperty(process.versions, 'chrome', { value: prev, configurable: true });
  }
});

test('chromeMajor 无版本时回退 0', () => {
  const prev = process.versions.chrome;
  try {
    Object.defineProperty(process.versions, 'chrome', { value: '', configurable: true });
    assert.strictEqual(chromeMajor(), '0');
  } finally {
    Object.defineProperty(process.versions, 'chrome', { value: prev, configurable: true });
  }
});

test('buildChromeUserAgent 使用真实内核版本（非写死）', () => {
  const prev = process.versions.chrome;
  try {
    Object.defineProperty(process.versions, 'chrome', { value: '152.0.7977.130', configurable: true });
    const ua = buildChromeUserAgent();
    assert.ok(ua.includes('Chrome/152.0.0.0'), 'UA 应含真实主版本 152');
    assert.ok(!ua.includes('Electron'), 'UA 不应含 Electron 标识');
    assert.ok(ua.includes('Safari/537.36'));
  } finally {
    Object.defineProperty(process.versions, 'chrome', { value: prev, configurable: true });
  }
});

test('buildChromeUserAgent 随内核版本变化（防写死回归）', () => {
  const prev = process.versions.chrome;
  try {
    Object.defineProperty(process.versions, 'chrome', { value: '160.1.2.3', configurable: true });
    assert.ok(buildChromeUserAgent().includes('Chrome/160.0.0.0'));
  } finally {
    Object.defineProperty(process.versions, 'chrome', { value: prev, configurable: true });
  }
});
