'use strict';
/**
 * feishu client.sendMarkdown 测试
 *
 * 验证：AI 回复走交互卡片（msg_type: 'interactive'）+ markdown 元素，
 * 让 Markdown 在飞书里能渲染。
 *
 * client.ts 用 createRequire 加载 @larksuiteoapi/node-sdk，
 * 所以 mock 掉 node:module.createRequire 返回假 SDK。
 */
import { test, beforeEach, vi } from 'vitest';
import assert from 'node:assert';

const sent = [];

vi.mock('node:module', () => ({
  createRequire: () => (id) => {
    if (id === '@larksuiteoapi/node-sdk') {
      return {
        Client: class {
          constructor() {
            this.im = {
              message: {
                create: async (args) => {
                  sent.push(args);
                  return { code: 0 };
                },
              },
            };
          }
        },
      };
    }
    if (id === 'electron') return { ipcRenderer: { on: () => {}, invoke: () => Promise.resolve() } };
    throw new Error('unexpected require: ' + id);
  },
}));

vi.mock('../../src/feishu/config.js', () => ({
  readConfig: () => ({ appId: 'a', appSecret: 'b', targetOpenId: 'ou_xxx' }),
  writeConfig: () => true,
}));

let sendMarkdown;

beforeEach(async () => {
  sent.length = 0;
  vi.resetModules();
  ({ sendMarkdown } = await import('../../src/feishu/client.js'));
});

test('发送 Markdown 用交互卡片', async () => {
  const r = await sendMarkdown('**粗体** 和 代码', 'chat_123');
  assert.equal(r.success, true);
  assert.equal(sent.length, 1);
  const data = sent[0].data;
  assert.equal(data.msg_type, 'interactive');
  const card = JSON.parse(data.content);
  assert.equal(card.schema, '2.0');
  assert.equal(card.body.elements[0].tag, 'markdown');
  assert.match(card.body.elements[0].content, /粗体/);
});

test('过长内容分片', async () => {
  const long = 'x'.repeat(9000);
  const r = await sendMarkdown(long, 'chat_123');
  assert.equal(r.success, true);
  assert.equal(sent.length, 3);
});

test('无 chatId 回退单聊', async () => {
  const r = await sendMarkdown('hi');
  assert.equal(r.success, true);
  assert.equal(sent[0].params.receive_id_type, 'open_id');
});
