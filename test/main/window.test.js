import { test, beforeEach, vi } from 'vitest';
import assert from 'node:assert';

// window 模块是单例，用 resetModules + 动态 import 隔离前先重置
let windowState;

beforeEach(async () => {
  vi.resetModules();
  windowState = await import('../../src/app/window.js');
});

test('getMainWindow 初始为 null', () => {
  assert.strictEqual(windowState.getMainWindow(), null);
});

test('getMainContext 初始为 null', () => {
  assert.strictEqual(windowState.getMainContext(), null);
});

test('addWindow 与 getWindowContext 往返', () => {
  const fakeWin = { id: 1, on: () => {}, isDestroyed: () => false };
  const fakeStore = { state: { selectedProjectDir: 'C:/x' } };
  windowState.addWindow(fakeWin, 'p1', 'deepseek', fakeStore);
  const ctx = windowState.getWindowContext(1);
  assert.ok(ctx);
  assert.strictEqual(ctx.profileId, 'p1');
  assert.strictEqual(ctx.providerId, 'deepseek');
  assert.strictEqual(ctx.sessionStore, fakeStore);
  assert.strictEqual(ctx.win, fakeWin);
});

test('getContextByWebContents 查找对应上下文', () => {
  const wcA = { id: 'wc-a' };
  const wcB = { id: 'wc-b' };
  const winA = { id: 'a', on: () => {}, webContents: wcA, isDestroyed: () => false };
  const winB = { id: 'b', on: () => {}, webContents: wcB, isDestroyed: () => false };
  windowState.addWindow(winA, 'p1', 'deepseek', { a: 1 });
  windowState.addWindow(winB, 'p2', 'claude', { b: 2 });
  assert.strictEqual(windowState.getContextByWebContents(wcA).profileId, 'p1');
  assert.strictEqual(windowState.getContextByWebContents(wcB).profileId, 'p2');
  assert.strictEqual(windowState.getContextByWebContents({ id: 'nope' }), null);
});

test('getWindowByProfileId 查找窗口', () => {
  const winA = { id: 'wa', on: () => {}, isDestroyed: () => false };
  windowState.addWindow(winA, 'pA', 'deepseek', {});
  assert.strictEqual(windowState.getWindowByProfileId('pA').win, winA);
  assert.strictEqual(windowState.getWindowByProfileId('missing'), null);
});

test('removeWindow 后 getWindowContext 返回 null', () => {
  const fakeWin = { id: 2, on: () => {}, isDestroyed: () => false };
  windowState.addWindow(fakeWin, 'p1', 'deepseek', {});
  assert.ok(windowState.getWindowContext(2));
  windowState.removeWindow(2);
  assert.strictEqual(windowState.getWindowContext(2), null);
});

test('getAllWindows 返回窗口数组', () => {
  const winA = { id: 'a', on: () => {}, isDestroyed: () => false };
  const winB = { id: 'b', on: () => {}, isDestroyed: () => false };
  windowState.addWindow(winA, 'p1', 'deepseek', {});
  windowState.addWindow(winB, 'p2', 'claude', {});
  const all = windowState.getAllWindows();
  assert.strictEqual(all.length, 2);
  assert.ok(all.includes(winA));
  assert.ok(all.includes(winB));
});
