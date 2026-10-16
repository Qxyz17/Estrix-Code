'use strict';
import { test } from 'vitest';
import assert from 'node:assert';
import { McpListServersTool, McpGetToolsTool } from '../../src/tools/impl/mcp-query.js';

test('McpListServersTool 构造器', () => {
  const t = new McpListServersTool();
  assert.strictEqual(t.name, 'mcpListServers');
  assert.strictEqual(t.jsApi, 'mcpListServers()');
});

test('McpListServersTool getPromptSection', () => {
  const t = new McpListServersTool();
  const s = t.getPromptSection();
  assert.strictEqual(s.name, 'tool:mcpListServers');
  assert.strictEqual(s.order, 119);
  assert.match(s.text, /mcpListServers/);
});

test('McpGetToolsTool 构造器', () => {
  const t = new McpGetToolsTool();
  assert.strictEqual(t.name, 'mcpGetTools');
  assert.strictEqual(t.jsApi, 'mcpGetTools(serverName)');
  assert.ok(t.parameters.required.includes('server'));
});

test('McpGetToolsTool getPromptSection', () => {
  const t = new McpGetToolsTool();
  const s = t.getPromptSection();
  assert.strictEqual(s.name, 'tool:mcpGetTools');
  assert.strictEqual(s.order, 120);
  assert.match(s.text, /mcpGetTools/);
});

test('McpGetToolsTool 缺 server 返回错误', async () => {
  const t = new McpGetToolsTool();
  const r = await t.execute({});
  assert.strictEqual(r.success, false);
  assert.match(r.error, /server 不能为空/);
});

