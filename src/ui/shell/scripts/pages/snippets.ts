/**
 * 提示词（Snippets）页：列表、增删改、触发。
 */
import { api, ckAlert, ckConfirm, escapeHtml, escapeAttr } from '../shared.js';
import { addRecent } from '../recent.js';

let snippets: any[] = [];
let editingSnipId: string | null = null;

export async function loadSnippets(): Promise<void> {
  if (!api.listSnippets) return;
  try {
    const res = await api.listSnippets();
    snippets = (res && res.success && Array.isArray(res.snippets)) ? res.snippets : [];
  } catch (_) { snippets = []; }
  renderSnippets();
}

function renderSnippets(): void {
  const listEl = document.getElementById('snip-list');
  if (!listEl) return;
  if (!snippets.length) {
    listEl.innerHTML = '<div class="ck-list-empty">还没有提示词，点上方新建</div>';
    return;
  }
  listEl.innerHTML = snippets.map((s: any) => {
    const badge = s.autoSend ? '<span class="ck-snip-badge">自动发送</span>' : '';
    return '<div class="ck-snip-item" data-id="' + escapeAttr(s.id) + '">' +
      '<div class="ck-snip-top">' +
        '<span class="ck-snip-name">' + escapeHtml(s.name) + badge + '</span>' +
        '<div class="ck-snip-actions">' +
          '<button class="ck-snip-icon-btn" data-edit="' + escapeAttr(s.id) + '" title="编辑">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>' +
          '</button>' +
          '<button class="ck-snip-icon-btn danger" data-del="' + escapeAttr(s.id) + '" title="删除">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<span class="ck-snip-preview">' + escapeHtml(s.content) + '</span>' +
    '</div>';
  }).join('');

  listEl.querySelectorAll('.ck-snip-item').forEach((el: any) => {
    el.addEventListener('click', async (e: any) => {
      if (e.target.closest('[data-edit]') || e.target.closest('[data-del]')) return;
      const s = snippets.filter((x: any) => x.id === el.dataset.id)[0];
      if (!s || !api.triggerSnippet) return;
      try { await api.triggerSnippet(s.content, s.autoSend); } catch (_) { /* ignore */ }
      addRecent('snippet', s.name, { payload: s.content, autoSend: s.autoSend });
    });
  });
  listEl.querySelectorAll('[data-edit]').forEach((btn: any) => {
    btn.addEventListener('click', (e: any) => {
      e.stopPropagation();
      const s = snippets.filter((x: any) => x.id === btn.dataset.edit)[0];
      if (s) openSnipModal(s);
    });
  });
  listEl.querySelectorAll('[data-del]').forEach((btn: any) => {
    btn.addEventListener('click', async (e: any) => {
      e.stopPropagation();
      const id = btn.dataset.del;
      const s = snippets.filter((x: any) => x.id === id)[0];
      if (!(await ckConfirm('确定删除提示词「' + (s ? s.name : '') + '」？'))) return;
      snippets = snippets.filter((x: any) => x.id !== id);
      if (api.saveSnippets) { try { await api.saveSnippets(snippets); } catch (_) { /* ignore */ } }
      renderSnippets();
    });
  });
}

function openSnipModal(s: any): void {
  editingSnipId = s ? s.id : null;
  const modal = document.getElementById('snip-modal');
  const titleEl = document.getElementById('snip-modal-title');
  if (titleEl) titleEl.textContent = s ? '编辑提示词' : '新建提示词';
  (document.getElementById('snip-name') as any).value = s ? s.name : '';
  (document.getElementById('snip-content') as any).value = s ? s.content : '';
  (document.getElementById('snip-autosend') as any).checked = s ? s.autoSend !== false : true;
  if (modal) modal.classList.remove('estrix-hidden');
  setTimeout(() => { document.getElementById('snip-name')?.focus(); }, 50);
}
function closeSnipModal(): void {
  const modal = document.getElementById('snip-modal');
  if (modal) modal.classList.add('estrix-hidden');
}
async function saveSnipModal(): Promise<void> {
  const name = (document.getElementById('snip-name') as any).value.trim();
  const content = (document.getElementById('snip-content') as any).value;
  const autoSend = (document.getElementById('snip-autosend') as any).checked;
  if (!name) { await ckAlert('请填写名称'); return; }
  if (!content.trim()) { await ckAlert('请填写内容'); return; }
  if (editingSnipId) {
    snippets = snippets.map((x: any) => x.id === editingSnipId ? { id: x.id, name, content, autoSend } : x);
  } else {
    snippets.push({ id: 'snip-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), name, content, autoSend });
  }
  if (api.saveSnippets) { try { await api.saveSnippets(snippets); } catch (_) { /* ignore */ } }
  renderSnippets();
  closeSnipModal();
}

document.getElementById('snip-init-project')?.addEventListener('click', async (e: any) => {
  if (!api.initProject) return;
  const btn = e.currentTarget;
  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = '初始化中…';
  try { await api.initProject(); } catch (_) { /* ignore */ }
  btn.textContent = old;
  btn.disabled = false;
});
document.getElementById('snip-add')?.addEventListener('click', () => openSnipModal(null));
document.getElementById('snip-cancel')?.addEventListener('click', closeSnipModal);
document.getElementById('snip-save')?.addEventListener('click', saveSnipModal);
document.getElementById('snip-refresh')?.addEventListener('click', loadSnippets);
