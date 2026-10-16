/**
 * 设置弹窗：加载/保存/恢复默认，以及自动压缩与 token 显示
 * 由 events.ts 拆分而来（P4.5），逻辑保持不变。
 */
import { showToast } from '../panel.js';
import { state } from '../state.js';

/** 打开设置弹窗：从 localStorage 加载配置到输入框 */
function openSettings() {
  function setVal(id: string, v: any) {
    const el = document.getElementById(id);
    if (el) (el as any).value = v;
  }
  // localStorage 存毫秒，UI 显示秒（毫秒/1000）
  const msToSec = (ms: any, dft: any) => {
    const n = parseInt(ms, 10);
    return String(Number.isFinite(n) ? n / 1000 : dft);
  };
  try {
    const en = localStorage.getItem('estrix-retry-enabled');
    const enEl = document.getElementById('estrix-retry-enabled');
    if (enEl) (enEl as any).checked = en === null ? true : en === '1';
    setVal('estrix-retry-delay-min', msToSec(localStorage.getItem('estrix-retry-delay-min') || '4000', 4));
    setVal('estrix-retry-delay-max', msToSec(localStorage.getItem('estrix-retry-delay-max') || '10000', 10));
    setVal('estrix-retry-count', localStorage.getItem('estrix-retry-count') || '10');
    setVal('estrix-retry-429-delay', msToSec(localStorage.getItem('estrix-retry-429-delay') || '120000', 120));
    setVal('estrix-retry-429-count', localStorage.getItem('estrix-retry-429-count') || '40');
    setVal('estrix-retry-prompt', localStorage.getItem('estrix-retry-prompt') || '刚才的回复似乎中断了，请重新完整回答上一个问题。');
    setVal('estrix-xhr-idle-timeout', msToSec(localStorage.getItem('estrix-xhr-idle-timeout') || '300000', 300));
    setVal('estrix-watchdog-prompt', localStorage.getItem('estrix-watchdog-prompt') || '请继续');
    setVal('estrix-watchdog-count', localStorage.getItem('estrix-watchdog-count') || '3');
    setVal('estrix-attach-delay-min', msToSec(localStorage.getItem('estrix-attach-delay-min') || '500', 0.5));
    setVal('estrix-attach-delay-max', msToSec(localStorage.getItem('estrix-attach-delay-max') || '1000', 1));
  } catch (_) {}
  setVal('estrix-delay-min', state.sendDelayMin / 1000);
  setVal('estrix-delay-max', state.sendDelayMax / 1000);
  const panel = document.getElementById('estrix-settings');
  if (panel) panel.classList.remove('estrix-hidden');
}

/** 关闭设置弹窗 */
function closeSettings() {
  const panel = document.getElementById('estrix-settings');
  if (panel) panel.classList.add('estrix-hidden');
}

/** 恢复默认：删除所有相关 localStorage 键，重置内存 state，刷新弹窗 */
function resetSettings() {
  const KEYS = [
    'estrix-retry-enabled', 'estrix-retry-delay-min', 'estrix-retry-delay-max',
    'estrix-retry-count', 'estrix-retry-429-delay', 'estrix-retry-429-count',
    'estrix-retry-prompt', 'estrix-xhr-idle-timeout', 'estrix-watchdog-prompt',
    'estrix-watchdog-count', 'estrix-send-delay-min', 'estrix-send-delay-max',
    'estrix-attach-delay-min', 'estrix-attach-delay-max',
  ];
  try {
    for (const k of KEYS) localStorage.removeItem(k);
  } catch (_) {}
  state.sendDelayMin = 2000;
  state.sendDelayMax = 4000;
  showToast('已恢复默认设置', 2500);
  openSettings(); // 重新加载默认值到输入框
}

/** 保存设置弹窗的所有配置 */
function saveSettings() {
  const val = (id: string) => { const el = document.getElementById(id); return el ? (el as any).value : ''; };
  // UI 输入为秒，存储转毫秒
  const secToMs = (s: any) => Math.round(parseFloat(s) * 1000);
  const dmin = secToMs(val('estrix-retry-delay-min'));
  const dmax = secToMs(val('estrix-retry-delay-max'));
  if (Number.isNaN(dmin) || dmin < 0) { showToast('普通失败最小间隔必须是非负数字（秒）', 3000); return; }
  if (Number.isNaN(dmax) || dmax < dmin) { showToast('普通失败最大间隔不能小于最小间隔', 3000); return; }
  const cnt = parseInt(val('estrix-retry-count'), 10);
  if (Number.isNaN(cnt)) { showToast('普通失败重试次数必须是整数', 3000); return; }
  const d429 = secToMs(val('estrix-retry-429-delay'));
  if (Number.isNaN(d429) || d429 < 0) { showToast('操作频繁重试间隔必须是非负数字（秒）', 3000); return; }
  const c429 = parseInt(val('estrix-retry-429-count'), 10);
  if (Number.isNaN(c429)) { showToast('操作频繁重试次数必须是整数', 3000); return; }
  const prompt = val('estrix-retry-prompt').trim();
  if (!prompt) { showToast('重试提示词不能为空', 3000); return; }
  const idleTimeout = secToMs(val('estrix-xhr-idle-timeout'));
  if (Number.isNaN(idleTimeout) || idleTimeout < 0) { showToast('挂起超时必须是非负数字（秒）', 3000); return; }
  const watchdogPrompt = val('estrix-watchdog-prompt').trim();
  if (!watchdogPrompt) { showToast('工具循环超时提示词不能为空', 3000); return; }
  const watchdogCount = parseInt(val('estrix-watchdog-count'), 10);
  if (Number.isNaN(watchdogCount)) { showToast('工具循环催继续次数必须是整数', 3000); return; }
  const smin = secToMs(val('estrix-delay-min'));
  const smax = secToMs(val('estrix-delay-max'));
  if (Number.isNaN(smin) || smin < 0) { showToast('发送延迟最小值必须是非负数字（秒）', 3000); return; }
  if (Number.isNaN(smax) || smax < smin) { showToast('发送延迟最大值不能小于最小值', 3000); return; }
  const amin = secToMs(val('estrix-attach-delay-min'));
  const amax = secToMs(val('estrix-attach-delay-max'));
  if (Number.isNaN(amin) || amin < 0) { showToast('附件上传间隔最小值必须是非负数字（秒）', 3000); return; }
  if (Number.isNaN(amax) || amax < amin) { showToast('附件上传间隔最大值不能小于最小值', 3000); return; }
  if (amax > 60000) { showToast('附件上传间隔最大值不能超过 60 秒', 3000); return; }

  const enEl = document.getElementById('estrix-retry-enabled');
  try {
    localStorage.setItem('estrix-retry-enabled', (enEl && (enEl as any).checked) ? '1' : '0');
    localStorage.setItem('estrix-retry-delay-min', String(dmin));
    localStorage.setItem('estrix-retry-delay-max', String(dmax));
    localStorage.setItem('estrix-retry-count', String(cnt));
    localStorage.setItem('estrix-retry-429-delay', String(d429));
    localStorage.setItem('estrix-retry-429-count', String(c429));
    localStorage.setItem('estrix-retry-prompt', prompt);
    localStorage.setItem('estrix-xhr-idle-timeout', String(idleTimeout));
    localStorage.setItem('estrix-watchdog-prompt', watchdogPrompt);
    localStorage.setItem('estrix-watchdog-count', String(watchdogCount));
    localStorage.setItem('estrix-send-delay-min', String(smin));
    localStorage.setItem('estrix-send-delay-max', String(smax));
    localStorage.setItem('estrix-attach-delay-min', String(amin));
    localStorage.setItem('estrix-attach-delay-max', String(amax));
  } catch (_) {}
  state.sendDelayMin = smin;
  state.sendDelayMax = smax;
  showToast('设置已保存', 2500);
  closeSettings();
}

// ========== 纯数据读写（供 IPC：壳页面设置页调用） ==========
// 设置仍以 localStorage 为唯一数据源（AI 页面 loop / hook 需同步读，不能搬走）。
// 本组函数只负责"读 → 返回 UI 单位值" / "校验 → 写回 localStorage + 更新 state"。

/** 安全读 localStorage */
function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}

/** 设置数据（UI 单位：时间类为"秒"；count 为整数；prompt 为文本） */
interface SettingsData {
  retryEnabled: boolean;
  retryDelayMin: number;
  retryDelayMax: number;
  retryCount: number;
  retry429Delay: number;
  retry429Count: number;
  retryPrompt: string;
  xhrIdleTimeout: number;
  watchdogPrompt: string;
  watchdogCount: number;
  sendDelayMin: number;
  sendDelayMax: number;
  attachDelayMin: number;
  attachDelayMax: number;
  goalMaxIterations: number;
  /** 拒绝 webFetch 访问内网/保留地址（默认关闭） */
  ssrfGuard: boolean;
}

/** 读取当前设置（UI 单位：秒） */
function getSettingsData(): SettingsData {
  const sec = (raw: string | null, dft: number) => {
    const n = parseInt(raw || '', 10);
    return Number.isFinite(n) ? n / 1000 : dft;
  };
  const int = (raw: string | null, dft: number) => {
    const n = parseInt(raw || '', 10);
    return Number.isFinite(n) ? n : dft;
  };
  const enRaw = lsGet('estrix-retry-enabled');
  return {
    retryEnabled: enRaw === null ? true : enRaw === '1',
    retryDelayMin: sec(lsGet('estrix-retry-delay-min'), 4),
    retryDelayMax: sec(lsGet('estrix-retry-delay-max'), 10),
    retryCount: int(lsGet('estrix-retry-count'), 10),
    retry429Delay: sec(lsGet('estrix-retry-429-delay'), 120),
    retry429Count: int(lsGet('estrix-retry-429-count'), 40),
    retryPrompt: lsGet('estrix-retry-prompt') || '刚才的回复似乎中断了，请重新完整回答上一个问题。',
    xhrIdleTimeout: sec(lsGet('estrix-xhr-idle-timeout'), 300),
    watchdogPrompt: lsGet('estrix-watchdog-prompt') || '请继续',
    watchdogCount: int(lsGet('estrix-watchdog-count'), 3),
    sendDelayMin: sec(lsGet('estrix-send-delay-min'), 2),
    sendDelayMax: sec(lsGet('estrix-send-delay-max'), 4),
    attachDelayMin: sec(lsGet('estrix-attach-delay-min'), 0.5),
    attachDelayMax: sec(lsGet('estrix-attach-delay-max'), 1),
    goalMaxIterations: int(lsGet('estrix-goal-max-iterations'), 50),
    ssrfGuard: lsGet('estrix-ssrf-guard') === '1',
  };
}

/**
 * 校验并写回设置（UI 单位 → 存储毫秒）。
 * @returns { success, error? }
 */
function applySettingsData(data: any): { success: boolean; error?: string } {
  const secToMs = (s: any) => Math.round(parseFloat(s) * 1000);
  const dmin = secToMs(data && data.retryDelayMin);
  const dmax = secToMs(data && data.retryDelayMax);
  if (!Number.isFinite(dmin) || dmin < 0) return { success: false, error: '普通失败最小间隔必须是非负数字' };
  if (!Number.isFinite(dmax) || dmax < dmin) return { success: false, error: '普通失败最大间隔不能小于最小间隔' };
  const cnt = parseInt(data && data.retryCount, 10);
  if (Number.isNaN(cnt)) return { success: false, error: '普通失败重试次数必须是整数' };
  const d429 = secToMs(data && data.retry429Delay);
  if (!Number.isFinite(d429) || d429 < 0) return { success: false, error: '操作频繁重试间隔必须是非负数字' };
  const c429 = parseInt(data && data.retry429Count, 10);
  if (Number.isNaN(c429)) return { success: false, error: '操作频繁重试次数必须是整数' };
  const prompt = String((data && data.retryPrompt) || '').trim();
  if (!prompt) return { success: false, error: '重试提示词不能为空' };
  const idleTimeout = secToMs(data && data.xhrIdleTimeout);
  if (!Number.isFinite(idleTimeout) || idleTimeout < 0) return { success: false, error: 'AI 回复超时必须是非负数字' };
  const watchdogPrompt = String((data && data.watchdogPrompt) || '').trim();
  if (!watchdogPrompt) return { success: false, error: '超时重试提示词不能为空' };
  const watchdogCount = parseInt(data && data.watchdogCount, 10);
  if (Number.isNaN(watchdogCount)) return { success: false, error: '超时重试次数必须是整数' };
  const smin = secToMs(data && data.sendDelayMin);
  const smax = secToMs(data && data.sendDelayMax);
  if (!Number.isFinite(smin) || smin < 0) return { success: false, error: '发送延迟最小值必须是非负数字' };
  if (!Number.isFinite(smax) || smax < smin) return { success: false, error: '发送延迟最大值不能小于最小值' };
  const amin = secToMs(data && data.attachDelayMin);
  const amax = secToMs(data && data.attachDelayMax);
  if (!Number.isFinite(amin) || amin < 0) return { success: false, error: '附件上传间隔最小值必须是非负数字' };
  if (!Number.isFinite(amax) || amax < amin) return { success: false, error: '附件上传间隔最大值不能小于最小值' };
  if (amax > 60000) return { success: false, error: '附件上传间隔最大值不能超过 60 秒' };
  // 目标最大迭代次数：属"纯净模式（harness）"自身设置（harness 页有独立入口）。
  // 壳页面设置页不提供此字段 → 仅在显式提供时才校验，缺失时保留原值（不清空、不报错）。
  let goalMax: number | null = null;
  if (data && data.goalMaxIterations !== undefined && data.goalMaxIterations !== null && data.goalMaxIterations !== '') {
    goalMax = parseInt(data.goalMaxIterations, 10);
    if (Number.isNaN(goalMax) || goalMax <= 0) return { success: false, error: '目标最大迭代次数必须是正整数' };
  }

  try {
    localStorage.setItem('estrix-retry-enabled', (data && data.retryEnabled) ? '1' : '0');
    localStorage.setItem('estrix-retry-delay-min', String(dmin));
    localStorage.setItem('estrix-retry-delay-max', String(dmax));
    localStorage.setItem('estrix-retry-count', String(cnt));
    localStorage.setItem('estrix-retry-429-delay', String(d429));
    localStorage.setItem('estrix-retry-429-count', String(c429));
    localStorage.setItem('estrix-retry-prompt', prompt);
    localStorage.setItem('estrix-xhr-idle-timeout', String(idleTimeout));
    localStorage.setItem('estrix-watchdog-prompt', watchdogPrompt);
    localStorage.setItem('estrix-watchdog-count', String(watchdogCount));
    localStorage.setItem('estrix-send-delay-min', String(smin));
    localStorage.setItem('estrix-send-delay-max', String(smax));
    localStorage.setItem('estrix-attach-delay-min', String(amin));
    localStorage.setItem('estrix-attach-delay-max', String(amax));
    if (goalMax !== null) localStorage.setItem('estrix-goal-max-iterations', String(goalMax));
    // ssrfGuard 仅当显式提供时才写（避免未传该字段的调用方把它清成 0）
    if (data && data.ssrfGuard !== undefined) localStorage.setItem('estrix-ssrf-guard', data.ssrfGuard ? '1' : '0');
  } catch (err: any) {
    return { success: false, error: '写入失败: ' + err.message };
  }
  state.sendDelayMin = smin;
  state.sendDelayMax = smax;
  return { success: true };
}

/** 恢复默认：清 key + 重置 state，返回默认值 */
function resetSettingsData(): SettingsData {
  const KEYS = [
    'estrix-retry-enabled', 'estrix-retry-delay-min', 'estrix-retry-delay-max',
    'estrix-retry-count', 'estrix-retry-429-delay', 'estrix-retry-429-count',
    'estrix-retry-prompt', 'estrix-xhr-idle-timeout', 'estrix-watchdog-prompt',
    'estrix-watchdog-count', 'estrix-send-delay-min', 'estrix-send-delay-max',
    'estrix-attach-delay-min', 'estrix-attach-delay-max',
    'estrix-goal-max-iterations', 'estrix-ssrf-guard',
  ];
  try { for (const k of KEYS) localStorage.removeItem(k); } catch (_) {}
  state.sendDelayMin = 2000;
  state.sendDelayMax = 4000;
  return getSettingsData();
}

export { openSettings, closeSettings, resetSettings, saveSettings, getSettingsData, applySettingsData, resetSettingsData };
export type { SettingsData };
