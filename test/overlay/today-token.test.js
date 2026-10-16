'use strict';
/**
 * 今日窗口 token 统计测试（v3 口径：每天累加"当轮完整 acc"，跨天归零；子代理不参与）
 * 纯逻辑复刻 events.ts 的实现（不 import 真实模块，避免拉入浏览器环境依赖）。
 *
 * 口径示例（acc 为服务端返回的"当轮总量"）：
 *  9-26 第1轮 acc=100 → 今日 100
 *  9-27 打开         → 今日 0（跨天归零）
 *  9-27 第1轮 acc=200 → 今日 200
 *  9-27 第2轮 acc=500 → 今日 700
 *  9-28 打开         → 今日 0
 */
import { test, beforeEach } from 'vitest';
import assert from 'node:assert';

const TOKEN_DAILY_KEY = 'estrix-token-daily';
const DAILY_VERSION_KEY = 'estrix-token-daily-version';
const DAILY_VERSION = '3';

let mockDate = '2026-09-26';
function todayKey() { return mockDate; }

let isSubagentWindow = false;
function setIsSubagentWindow(v) { isSubagentWindow = !!v; }

function migrateDailyVersion() {
  if (localStorage.getItem(DAILY_VERSION_KEY) !== DAILY_VERSION) {
    localStorage.removeItem(TOKEN_DAILY_KEY);
    localStorage.setItem(DAILY_VERSION_KEY, DAILY_VERSION);
  }
}

function addDailyToken(acc) {
  if (typeof acc !== 'number' || acc <= 0) return;
  const raw = localStorage.getItem(TOKEN_DAILY_KEY);
  const obj = raw ? JSON.parse(raw) : {};
  const map = (obj && typeof obj === 'object') ? obj : {};
  const k = todayKey();
  map[k] = (typeof map[k] === 'number' ? map[k] : 0) + acc;
  localStorage.setItem(TOKEN_DAILY_KEY, JSON.stringify(map));
}

function getTodayCumulative() {
  migrateDailyVersion();
  const raw = localStorage.getItem(TOKEN_DAILY_KEY);
  const obj = raw ? JSON.parse(raw) : {};
  const v = obj ? obj[todayKey()] : 0;
  return typeof v === 'number' ? v : 0;
}

const cache = {};
function saveTokenForSession(sessionId, acc) {
  if (!sessionId || typeof acc !== 'number') return;
  if (isSubagentWindow) return;
  let entry = cache[sessionId] || { context: 0, cumulative: 0, lastAcc: 0 };
  const lastAcc = entry.lastAcc || 0;
  if (acc > lastAcc) {
    entry.cumulative = (entry.cumulative || 0) + acc;
    addDailyToken(acc); // v3：累加完整 acc
  }
  entry.context = acc;
  entry.lastAcc = acc;
  cache[sessionId] = entry;
}

beforeEach(() => {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
  // 模拟应用已初始化（版本已迁移），避免读取时误触发清空
  localStorage.setItem(DAILY_VERSION_KEY, DAILY_VERSION);
  for (const k of Object.keys(cache)) delete cache[k];
  isSubagentWindow = false;
  mockDate = '2026-09-26';
});

test('9-26 用 100，9-27 打开应为 0', () => {
  mockDate = '2026-09-26';
  saveTokenForSession('s1', 100);
  assert.strictEqual(getTodayCumulative(), 100);

  mockDate = '2026-09-27';
  assert.strictEqual(getTodayCumulative(), 0); // 新的一天，今日归零
});

test('今天第 1 次对话 200，今日 = 200', () => {
  mockDate = '2026-09-27';
  saveTokenForSession('s1', 200);
  assert.strictEqual(getTodayCumulative(), 200);
});

test('今天第 2 次对话 acc=500，今日 = 700（累加完整 acc）', () => {
  mockDate = '2026-09-27';
  saveTokenForSession('s1', 200);
  saveTokenForSession('s1', 500);
  assert.strictEqual(getTodayCumulative(), 700); // 200 + 500
});

test('今天第 3 次对话 acc=900，今日 = 1600', () => {
  mockDate = '2026-09-27';
  saveTokenForSession('s1', 200);
  saveTokenForSession('s1', 500);
  saveTokenForSession('s1', 900);
  assert.strictEqual(getTodayCumulative(), 1600); // 200+500+900
});

test('子代理窗口不计入今日', () => {
  mockDate = '2026-09-27';
  setIsSubagentWindow(true);
  saveTokenForSession('sub', 9999);
  assert.strictEqual(getTodayCumulative(), 0);
});

test('旧口径数据（v2）触发迁移清空', () => {
  mockDate = '2026-09-27';
  // 模拟旧版本（未迁移）
  localStorage.removeItem(DAILY_VERSION_KEY);
  localStorage.setItem(TOKEN_DAILY_KEY, JSON.stringify({ '2026-09-26': 99999999 }));
  assert.strictEqual(getTodayCumulative(), 0); // 版本不对 → 清空
  assert.strictEqual(localStorage.getItem(DAILY_VERSION_KEY), '3');
});

test('同一天多会话共享今日累计', () => {
  mockDate = '2026-09-27';
  saveTokenForSession('s1', 200);
  saveTokenForSession('s2', 300);
  assert.strictEqual(getTodayCumulative(), 500); // 200 + 300
});
