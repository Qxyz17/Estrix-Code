/**
 * 飞书同步页：配置、群绑定、推送选项。
 */
import { api, ckAlert } from '../shared.js';

function renderFeishuStatus(status: string, detail: string): void {
  const dot = document.getElementById('fs-dot');
  const txt = document.getElementById('fs-status-text');
  if (dot) {
    dot.className = 'fs-dot' + (status === 'connected' ? ' connected' : status === 'error' ? ' error' : status === 'connecting' ? ' connecting' : '');
  }
  if (txt) {
    const label = status === 'connected' ? '已连接' : status === 'connecting' ? '连接中…' : status === 'error' ? ('错误：' + (detail || '')) : '未连接';
    txt.textContent = label;
  }
}

export async function loadFeishu(): Promise<void> {
  if (!api.getFeishuConfig) return;
  try {
    const r = await api.getFeishuConfig();
    if (!r || !r.success) return;
    const c = r.config || {};
    await loadFeishuBinding();
    const appIdEl = document.getElementById('fs-app-id') as any;
    const secretEl = document.getElementById('fs-app-secret') as any;
    const enabledEl = document.getElementById('fs-enabled') as any;
    const uEl = document.getElementById('fs-push-user') as any;
    const aEl = document.getElementById('fs-push-ai') as any;
    const tEl = document.getElementById('fs-push-tool') as any;
    const tnEl = document.getElementById('fs-push-toolname') as any;
    if (appIdEl) appIdEl.value = c.appId || '';
    if (secretEl) { secretEl.value = c.appSecret || ''; secretEl.placeholder = c.hasSecret ? '（已保存，留空则不变）' : '填写应用的 App Secret'; }
    if (enabledEl) enabledEl.checked = c.enabled === true;
    if (uEl) uEl.checked = c.pushUserMessage !== false;
    if (aEl) aEl.checked = c.pushAiReply !== false;
    if (tEl) tEl.checked = c.pushToolStatus !== false;
    if (tnEl) tnEl.checked = c.pushToolName === true;
    renderFeishuStatus(r.status, r.statusDetail);
  } catch (_) { /* ignore */ }
}

async function loadFeishuBinding(): Promise<void> {
  if (!api.getFeishuBinding) return;
  try {
    const b = await api.getFeishuBinding();
    const sel = document.getElementById('fs-chat-select') as any;
    const st = document.getElementById('fs-chat-status');
    if (sel && api.listFeishuChats) {
      const lr = await api.listFeishuChats();
      const chats = (lr && lr.success && lr.chats) || [];
      let html = '<option value="">（未绑定 —— 该窗口飞书功能关闭）</option>';
      for (const chat of chats) {
        const selected = (b && b.chatId === chat.chatId) ? ' selected' : '';
        html += '<option value="' + chat.chatId + '"' + selected + '>' + chat.name + '</option>';
      }
      sel.innerHTML = html;
      if (b && b.chatId) sel.value = b.chatId;
    }
    if (st) st.textContent = (b && b.chatId) ? ('已绑定：' + (b.chatName || b.chatId)) : '未绑定';
  } catch (_) { /* ignore */ }
}

const fsChatSel = document.getElementById('fs-chat-select') as any;
if (fsChatSel) fsChatSel.addEventListener('change', async () => {
  if (!api.bindFeishuChat) return;
  const chatId = fsChatSel.value;
  const chatName = chatId ? fsChatSel.options[fsChatSel.selectedIndex].text : '';
  try { await api.bindFeishuChat(chatId, chatName); await loadFeishuBinding(); } catch (_) { /* ignore */ }
});

const fsSavePush = document.getElementById('fs-save-push') as any;
if (fsSavePush) fsSavePush.addEventListener('click', async () => {
  if (!api.saveFeishuConfig) return;
  const data = {
    pushUserMessage: !!((document.getElementById('fs-push-user') as any) || {}).checked,
    pushAiReply: !!((document.getElementById('fs-push-ai') as any) || {}).checked,
    pushToolStatus: !!((document.getElementById('fs-push-tool') as any) || {}).checked,
    pushToolName: !!((document.getElementById('fs-push-toolname') as any) || {}).checked,
  };
  fsSavePush.disabled = true;
  try {
    const r = await api.saveFeishuConfig(data);
    if (r && r.success) {
      fsSavePush.textContent = '已保存';
      setTimeout(() => { fsSavePush.textContent = '保存推送设置'; }, 1200);
    } else { await ckAlert((r && r.error) || '保存失败'); }
  } catch (e: any) { await ckAlert('保存失败: ' + (e.message || e)); }
  fsSavePush.disabled = false;
});

document.getElementById('fs-refresh-chats')?.addEventListener('click', () => { loadFeishuBinding(); });
document.getElementById('fs-unbind-chat')?.addEventListener('click', async () => {
  if (!api.bindFeishuChat) return;
  try { await api.bindFeishuChat('', ''); await loadFeishuBinding(); } catch (_) { /* ignore */ }
});

async function saveFeishu(): Promise<void> {
  if (!api.saveFeishuConfig) return;
  const data = {
    appId: ((document.getElementById('fs-app-id') as any) || {}).value || '',
    appSecret: ((document.getElementById('fs-app-secret') as any) || {}).value || '',
    enabled: !!((document.getElementById('fs-enabled') as any) || {}).checked,
    pushUserMessage: !!((document.getElementById('fs-push-user') as any) || {}).checked,
    pushAiReply: !!((document.getElementById('fs-push-ai') as any) || {}).checked,
    pushToolStatus: !!((document.getElementById('fs-push-tool') as any) || {}).checked,
    pushToolName: !!((document.getElementById('fs-push-toolname') as any) || {}).checked,
  };
  const btn = document.getElementById('fs-save') as any;
  if (btn) btn.disabled = true;
  try {
    const r = await api.saveFeishuConfig(data);
    if (r && r.success) {
      await loadFeishu();
      if (btn) { btn.textContent = '已保存'; setTimeout(() => { btn.textContent = '保存并连接'; }, 1200); }
    } else { await ckAlert((r && r.error) || '保存失败'); }
  } catch (e: any) { await ckAlert('保存失败: ' + (e.message || e)); }
  if (btn) btn.disabled = false;
}

document.getElementById('fs-setup-link')?.addEventListener('click', (e: any) => {
  e.preventDefault();
  if (api.openFeishuSetup) api.openFeishuSetup();
});
document.getElementById('fs-save')?.addEventListener('click', saveFeishu);
document.getElementById('fs-disconnect')?.addEventListener('click', async () => {
  if (!api.disconnectFeishu) return;
  try { await api.disconnectFeishu(); } catch (_) { /* ignore */ }
  await loadFeishu();
});
