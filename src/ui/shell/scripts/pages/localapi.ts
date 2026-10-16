/**
 * 本地 API 页：OpenAI 兼容接口信息 + API Key 配置。
 */
import { api, ckAlert } from '../shared.js';

async function load(): Promise<void> {
  try {
    const r = await (api as any).getApiConfig();
    const cfg = (r && r.config) || {};
    const keyEl = document.getElementById('localapi-key') as any;
    if (keyEl) keyEl.value = cfg.apiKey || '';
  } catch (e) { /* ignore */ }
}

async function save(): Promise<void> {
  const keyEl = document.getElementById('localapi-key') as any;
  const key = keyEl ? keyEl.value : '';
  try {
    await (api as any).setApiConfig({ apiKey: key });
    ckAlert('已保存');
  } catch (e: any) { ckAlert('保存失败: ' + (e && e.message)); }
}

export function initLocalApi(): void {
  load();
  const btn = document.getElementById('localapi-save');
  if (btn) btn.addEventListener('click', save);
}
