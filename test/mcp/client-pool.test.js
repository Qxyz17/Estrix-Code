'use strict';
/**
 * mcp/client 连接池 + 引用计数测试
 *
 * 策略：mock 掉外部边界（electron、MCP SDK、config），驱动真实 client 的
 * 引用/释放逻辑，通过"空闲断开后连接是否还在"来观察。
 */
import { test, beforeEach, afterEach, vi } from 'vitest';
import assert from 'node:assert';

const PROJ1 = 'C:/proj1';
const PROJ2 = 'C:/proj2';

vi.mock('node:module', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createRequire: () => (id) => {
      if (id === 'electron') return { app: { isPackaged: false, getPath: () => 'C:/ud', getAppPath: () => 'C:/app' } };
      throw new Error('unexpected require: ' + id);
    },
  };
});

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {
    async connect() {}
    async listTools() { return { tools: [{ name: 't1', description: 'd', inputSchema: {} }] }; }
    async callTool() { return { content: [] }; }
    async close() {}
  },
}));
vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: class { constructor() {} },
}));
vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: class { constructor() {} },
}));

const userServer = () => ({ name: 'u', source: 'user', type: 'stdio', command: 'x', args: [], cwd: 'C:/tmp', enabled: true });
const projServer = () => ({ name: 'p', source: 'project', type: 'stdio', command: 'x', args: [], cwd: 'C:/tmp', enabled: true });
vi.mock('../../src/mcp/config.js', () => ({
  getServers: (dir) => (dir === PROJ1 ? [userServer(), projServer()] : [userServer()]),
  getEnabledServers: (dir) => (dir === PROJ1 ? [userServer(), projServer()] : [userServer()]),
  getUserServers: () => [userServer()],
}));

let client;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  client = await import('../../src/mcp/client.js');
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

/** 该 server 当前是否已连接 */
function isConnected(dir, name) {
  const s = client.listConfiguredServers(dir).find(x => x.name === name);
  return !!(s && s.connected);
}

/** 推进定时器并让所有 async 回调完成 */
async function advance(ms) {
  await vi.advanceTimersByTimeAsync(ms);
  await Promise.resolve();
}

test('同项目两窗口复用同一连接实例（引用计数 2）', async () => {
  const e1 = await client.connectServerByName('p', PROJ1, 1);
  const e2 = await client.connectServerByName('p', PROJ1, 2);
  assert.strictEqual(e1, e2, '同 key 应复用同一 entry');
});

test('释放一个窗口：连接保留（还有其它窗口在用）', async () => {
  await client.connectServerByName('p', PROJ1, 1);
  await client.connectServerByName('p', PROJ1, 2);
  client.releaseWindow(1);
  await advance(61000);
  assert.strictEqual(isConnected(PROJ1, 'p'), true, '还有窗口 2 在用，不应断开');
});

test('释放所有窗口：空闲 60 秒后断开', async () => {
  await client.connectServerByName('p', PROJ1, 1);
  await client.connectServerByName('p', PROJ1, 2);
  client.releaseWindow(1);
  client.releaseWindow(2);
  await advance(61000);
  assert.strictEqual(isConnected(PROJ1, 'p'), false, '引用归零 + 空闲超时 → 应断开');
});

test('空闲计时被"再引用"取消（不误断）', async () => {
  await client.connectServerByName('p', PROJ1, 1);
  client.releaseWindow(1);
  await advance(30000);
  await client.connectServerByName('p', PROJ1, 3);
  await advance(61000);
  assert.strictEqual(isConnected(PROJ1, 'p'), true, '中途被引用，不应断');
});

test('releaseProject：切到别的项目时释放旧项目引用', async () => {
  await client.connectServerByName('p', PROJ1, 1);
  client.releaseProject(1, PROJ2);
  await advance(61000);
  assert.strictEqual(isConnected(PROJ1, 'p'), false, '旧项目引用应释放');
});

test('releaseProject：切到同项目不释放', async () => {
  await client.connectServerByName('p', PROJ1, 1);
  client.releaseProject(1, PROJ1);
  await advance(61000);
  assert.strictEqual(isConnected(PROJ1, 'p'), true, '同项目不应释放');
});

test('releaseProject 只影响项目级，不动用户级', async () => {
  await client.connectServerByName('u', PROJ1, 1);
  await client.connectServerByName('p', PROJ1, 1);
  client.releaseProject(1, PROJ2);
  await advance(61000);
  assert.strictEqual(isConnected(PROJ2, 'u'), true, '用户级不受 releaseProject 影响');
  assert.strictEqual(isConnected(PROJ1, 'p'), false, '项目级应释放');
});

test('forgetWindow：窗口关闭时清记录 + 释放引用', async () => {
  await client.connectServerByName('p', PROJ1, 1);
  client.forgetWindow(1);
  await advance(61000);
  assert.strictEqual(isConnected(PROJ1, 'p'), false, '窗口关闭应释放其引用');
});

test('disconnectAll：强制断开所有连接', async () => {
  await client.connectServerByName('p', PROJ1, 1);
  await client.connectServerByName('u', PROJ1, 1);
  await client.disconnectAll();
  assert.strictEqual(isConnected(PROJ1, 'p'), false);
  assert.strictEqual(isConnected(PROJ1, 'u'), false);
});
