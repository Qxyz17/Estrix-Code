'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

const { isAIResponseComplete } = require('../../src/preload/dom/ai-response');

function setupDeepseekDoc(messages) {
  global.window = { location: { href: 'https://chat.deepseek.com/' } };
  global.document = {
    querySelectorAll: (sel) => sel === '.ds-message' ? messages : [],
    querySelector: () => ({}),
  };
}

test('isAIResponseComplete 无消息返回 false', async () => {
  setupDeepseekDoc([]);
  assert.strictEqual(await isAIResponseComplete(), false);
});

test('isAIResponseComplete 有消息但无操作按钮返回 false', async () => {
  const msg = { parentElement: { querySelectorAll: () => [] } };
  setupDeepseekDoc([msg]);
  assert.strictEqual(await isAIResponseComplete(), false);
});

test('isAIResponseComplete 有操作按钮和停止按钮返回 true', async () => {
  const msg = { parentElement: { querySelectorAll: () => [{}, {}] } };
  setupDeepseekDoc([msg]);
  assert.strictEqual(await isAIResponseComplete(), true);
});
