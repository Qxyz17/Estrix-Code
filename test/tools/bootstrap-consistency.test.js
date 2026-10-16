'use strict';
import { test } from 'vitest';
import assert from 'node:assert';
import vm from 'node:vm';
import { TOOL_BOOTSTRAP } from '../../src/tools/runtime/bootstrap.generated.js';
import { registry } from '../../src/tools/index.js';

/**
 * 在隔离 vm 上下文运行工具 bootstrap，捕获 __call 调用。
 * 这是真实集成测试（无内部 mock）：跑真实生成的 bootstrap + 真实注册表。
 */
function makeSandbox() {
  const calls = [];
  const sandbox = {
    __call: async (name, args) => {
      calls.push({ name, args });
      return { success: true, data: null };
    },
  };
  vm.createContext(sandbox);
  vm.runInContext('"use strict";\n' + TOOL_BOOTSTRAP, sandbox);
  return { sandbox, calls };
}

function injectedNames(sandbox) {
  return Object.keys(sandbox).filter(
    (k) => k !== '__call' && typeof sandbox[k] === 'function'
  );
}

test('bootstrap 注入的函数都有同名注册工具', () => {
  const { sandbox } = makeSandbox();
  const injected = injectedNames(sandbox);
  const registered = registry.listNames();
  assert.ok(injected.length > 0, 'bootstrap 未注入任何函数');
  for (const name of injected) {
    assert.ok(registered.includes(name), '注入的函数 ' + name + ' 没有同名注册工具');
  }
});

test('调用注入函数时 __call 使用已注册的工具名', async () => {
  const { sandbox, calls } = makeSandbox();
  const injected = injectedNames(sandbox);
  const registered = registry.listNames();
  for (const name of injected) {
    await sandbox[name]();
  }
  assert.strictEqual(calls.length, injected.length, '__call 调用次数与注入函数数不符');
  for (const c of calls) {
    assert.ok(registered.includes(c.name), '__call 的工具名 ' + c.name + ' 未注册');
  }
});
