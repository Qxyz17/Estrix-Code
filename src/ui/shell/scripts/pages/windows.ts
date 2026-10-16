/**
 * 窗口列表页：列出/新建/切换/删除窗口、默认打开。
 */
import { api, ckConfirm, ckPrompt, escapeHtml, escapeAttr } from '../shared.js';

const PROVIDER_COLORS: Record<string, string> = {
  deepseek: 'linear-gradient(135deg, #4d6bfe, #3b5bdb)',
  claude: 'linear-gradient(135deg, #d97757, #c05a3a)',
  chatgpt: 'linear-gradient(135deg, #10a37f, #0d8a6b)',
};

function providerAvatarStyle(providerId: string): string {
  return PROVIDER_COLORS[providerId] || '';
}

/** 渲染单个窗口卡片（窗口组内外共用） */
function renderWindowItem(p: any, providerMap: Record<string, string>): string {
  const pname = providerMap[p.providerId] || '未选平台';
  const checked = p.autoOpen === true ? ' checked' : '';
  const initial = (p.name || '?').trim().charAt(0).toUpperCase();
  const avatarStyle = providerAvatarStyle(p.providerId);
  return '<div class="ck-win-item" data-profile-id="' + escapeHtml(p.id) + '">' +
    '<div class="ck-win-top">' +
      '<span class="ck-win-avatar"' + (avatarStyle ? ' style="background:' + avatarStyle + '"' : '') + '>' + escapeHtml(initial) + '</span>' +
      '<span class="ck-win-name">' + escapeHtml(p.name) + '</span>' +
      '<span class="ck-win-del" data-profile-id="' + escapeHtml(p.id) + '" title="删除窗口">✕</span>' +
    '</div>' +
    '<div class="ck-win-bottom">' +
      '<span class="ck-win-provider">' + escapeHtml(pname) + '</span>' +
      '<label class="ck-win-check' + (p.autoOpen === true ? ' ck-win-check-on' : '') + '" title="启动时默认打开">' +
        '<input type="checkbox" data-profile-id="' + escapeHtml(p.id) + '"' + checked + ' />默认打开' +
      '</label>' +
    '</div>' +
  '</div>';
}

export async function renderWindowList(): Promise<void> {
  const listEl = document.getElementById('win-list');
  if (!listEl || !api.listProfiles) return;
  try {
    const res = await api.listProfiles();
    const profiles = (res && res.success) ? res.profiles : [];
    if (!profiles || profiles.length === 0) {
      listEl.innerHTML = '<div class="ck-list-empty">暂无窗口</div>';
      return;
    }
    const providerMap: Record<string, string> = {};
    try {
      const pvRes = await (api as any).listProviders?.();
      if (pvRes && pvRes.success) (pvRes.providers || []).forEach((p: any) => { providerMap[p.id] = p.name; });
    } catch (_) { /* ignore */ }
    // 取窗口组
    let groups: any[] = [];
    try { const gr = await (api as any).wgList?.(); if (gr && gr.success) groups = gr.groups || []; } catch (_) { /* ignore */ }
    const inGroup = new Set<string>();
    for (const g of groups) for (const w of (g.windowIds || [])) inGroup.add(w);
    const byId: Record<string, any> = {};
    for (const p of profiles) byId[p.id] = p;

    let html = '';
    // 已分组的窗口
    for (const g of groups) {
      const members = (g.windowIds || []).map((w: string) => byId[w]).filter(Boolean);
      // "最后一次继续"：窗口名 + 对话标题（可点击跳转）
      let lastLine = '';
      if (g.lastWindowId) {
        const lastWin = byId[g.lastWindowId];
        const winName = lastWin ? lastWin.name : g.lastWindowId;
        lastLine = '<div class="ck-wg-last" data-group-id="' + escapeAttr(g.id) +
          '" data-window-id="' + escapeAttr(g.lastWindowId) +
          '" data-session-id="' + escapeAttr(g.lastSessionId || '') +
          '" title="点击跳到该窗口的最近对话">' +
          '最近：' + escapeHtml(winName) + (g.lastSessionId ? '' : '') +
        '</div>';
      }
      html += '<div class="ck-wg" data-group-id="' + escapeAttr(g.id) + '">' +
        '<div class="ck-wg-head">' +
          '<span class="ck-wg-name">' + escapeHtml(g.name) + '</span>' +
          '<span class="ck-wg-switch" data-group-id="' + escapeAttr(g.id) + '" title="转移当前对话到下一窗口">转移对话</span>' +
          '<span class="ck-wg-manage" data-group-id="' + escapeAttr(g.id) + '" title="管理组（改名、增删窗口）">管理</span>' +
          '<span class="ck-wg-del" data-group-id="' + escapeAttr(g.id) + '" title="删除组">✕</span>' +
        '</div>' +
        lastLine +
        '<div class="ck-wg-body">' + members.map((p: any) => renderWindowItem(p, providerMap)).join('') + '</div>' +
      '</div>';
    }
    // 未分组的窗口
    const ungrouped = profiles.filter((p: any) => !inGroup.has(p.id));
    if (ungrouped.length) {
      html += '<div class="ck-wg ck-wg-ungrouped">' +
        '<div class="ck-wg-head"><span class="ck-wg-name">未分组</span></div>' +
        '<div class="ck-wg-body">' + ungrouped.map((p: any) => renderWindowItem(p, providerMap)).join('') + '</div>' +
      '</div>';
    }
    listEl.innerHTML = html;

    listEl.querySelectorAll('.ck-win-check input').forEach((cb: any) => {
      cb.addEventListener('click', (e: any) => e.stopPropagation());
      cb.addEventListener('change', async () => {
        const pid = cb.dataset.profileId;
        const on = cb.checked;
        const label = cb.closest('.ck-win-check');
        try {
          const r = await api.setProfileAutoOpen?.(pid, on);
          if (!r || !r.success) cb.checked = !on;
          else if (label) label.classList.toggle('ck-win-check-on', on);
        } catch (_) { cb.checked = !on; }
      });
    });
    listEl.querySelectorAll('.ck-win-item').forEach((el: any) => {
      el.addEventListener('click', async (e: any) => {
        if (e.target.classList.contains('ck-win-del')) return;
        if (e.target.closest('.ck-win-check')) return;
        try { await api.openProfileWindow?.(el.dataset.profileId); } catch (_) { /* ignore */ }
      });
    });
    listEl.querySelectorAll('.ck-win-del').forEach((btn: any) => {
      btn.addEventListener('click', async (e: any) => {
        e.stopPropagation();
        const pid = btn.dataset.profileId;
        const name = (btn.closest('.ck-win-item').querySelector('.ck-win-name') || {}).textContent || '该窗口';
        if (!(await ckConfirm('确定删除窗口「' + name + '」？此操作不可恢复。'))) return;
        try {
          const r = await api.deleteProfileWindow?.(pid);
          if (r && r.success) renderWindowList();
        } catch (_) { /* ignore */ }
      });
    });
    // 组：切换（分享当前对话给组内下一个窗口）
    listEl.querySelectorAll('.ck-wg-switch').forEach((btn: any) => {
      btn.addEventListener('click', async (e: any) => {
        e.stopPropagation();
        const gid = btn.dataset.groupId;
        if (!(api as any).wgSwitch) return;
        const oldText = btn.textContent;
        btn.textContent = '转移中…';
        (btn as any).style.pointerEvents = 'none';
        try {
          const r = await (api as any).wgSwitch(gid);
          if (!r || !r.success) {
            alert('切换失败：' + ((r && r.error) || '未知错误'));
          }
        } catch (err: any) {
          alert('切换失败：' + (err.message || String(err)));
        } finally {
          btn.textContent = oldText;
          (btn as any).style.pointerEvents = '';
          renderWindowList();
        }
      });
    });
    // 组：删除组
    listEl.querySelectorAll('.ck-wg-del').forEach((btn: any) => {
      btn.addEventListener('click', async (e: any) => {
        e.stopPropagation();
        const gid = btn.dataset.groupId;
        if (!(await ckConfirm('确定删除该窗口组？（窗口本身不删）'))) return;
        try { await (api as any).wgDelete?.(gid); renderWindowList(); } catch (_) { /* ignore */ }
      });
    });
    // 组：管理（改名 + 增删组内窗口）
    listEl.querySelectorAll('.ck-wg-manage').forEach((btn: any) => {
      btn.addEventListener('click', async (e: any) => {
        e.stopPropagation();
        const gid = btn.dataset.groupId;
        const g = groups.find((x: any) => x.id === gid);
        if (g) await openGroupManager(g, profiles);
      });
    });
    // 组：「最近」→ 跳到该窗口的最近对话
    listEl.querySelectorAll('.ck-wg-last').forEach((el: any) => {
      el.addEventListener('click', async (e: any) => {
        e.stopPropagation();
        const wid = el.dataset.windowId;
        const sid = el.dataset.sessionId;
        if (!wid) return;
        try {
          await api.openProfileWindow?.(wid);
          if (sid && api.navigateSession) { try { await api.navigateSession(sid); } catch (_) { /* ignore */ } }
        } catch (_) { /* ignore */ }
      });
    });
  } catch (_) {
    listEl.innerHTML = '<div class="ck-list-empty">加载失败</div>';
  }
}

/** 打开"管理窗口组"弹窗：改名 + 增删组内窗口 */
async function openGroupManager(group: any, profiles: any[]): Promise<void> {
  const mask = document.getElementById('wg-modal');
  const nameEl = document.getElementById('wg-modal-name') as any;
  const membersEl = document.getElementById('wg-modal-members');
  const addSel = document.getElementById('wg-modal-add') as any;
  const cancelBtn = document.getElementById('wg-modal-cancel') as any;
  const saveBtn = document.getElementById('wg-modal-save') as any;
  if (!mask || !nameEl || !membersEl || !addSel) return;

  let members: string[] = Array.isArray(group.windowIds) ? group.windowIds.slice() : [];
  const byId: Record<string, any> = {};
  for (const p of profiles) byId[p.id] = p;

  const renderMembers = () => {
    membersEl.innerHTML = members.length
      ? members.map((id: string) => {
          const w = byId[id];
          return '<div class="ck-wg-member" data-id="' + escapeAttr(id) + '">' +
            '<span class="ck-wg-member-name">' + escapeHtml(w ? w.name : id) + '</span>' +
            '<span class="ck-wg-member-del" data-id="' + escapeAttr(id) + '" title="移除">✕</span>' +
          '</div>';
        }).join('')
      : '<div class="ck-wg-member-empty">（暂无窗口）</div>';
    membersEl.querySelectorAll('.ck-wg-member-del').forEach((b: any) => {
      b.addEventListener('click', () => {
        members = members.filter((x) => x !== b.dataset.id);
        renderMembers(); renderAddOptions();
      });
    });
  };
  const renderAddOptions = () => {
    const avail = profiles.filter((p: any) => !members.includes(p.id));
    addSel.innerHTML = '<option value="">（选择要加入的窗口…）</option>' +
      avail.map((p: any) => '<option value="' + escapeAttr(p.id) + '">' + escapeHtml(p.name) + '</option>').join('');
  };

  nameEl.value = group.name || '';
  renderMembers();
  renderAddOptions();
  mask.classList.remove('estrix-hidden');
  setTimeout(() => nameEl.focus(), 50);

  const onAdd = () => {
    const id = addSel.value;
    if (id && !members.includes(id)) { members.push(id); renderMembers(); renderAddOptions(); }
  };
  const cleanup = () => {
    mask!.classList.add('estrix-hidden');
    cancelBtn.removeEventListener('click', onCancel);
    saveBtn.removeEventListener('click', onSave);
    addSel.removeEventListener('change', onAdd);
    mask!.removeEventListener('click', onMask);
  };
  const onCancel = () => { cleanup(); };
  const onMask = (e: any) => { if (e.target === mask) cleanup(); };
  const onSave = async () => {
    try {
      const newName = String(nameEl.value || '').trim();
      if (newName && newName !== group.name) await (api as any).wgRename?.(group.id, newName);
      // 同步组内窗口：先把现有成员逐个移除，再按新顺序加入
      const cur = (group.windowIds || []).slice();
      for (const id of cur) {
        if (!members.includes(id)) await (api as any).wgRemoveWindow?.(group.id, id);
      }
      for (const id of members) {
        if (!cur.includes(id)) await (api as any).wgAddWindow?.(group.id, id);
      }
      cleanup();
      renderWindowList();
    } catch (_) { cleanup(); }
  };
  addSel.addEventListener('change', onAdd);
  cancelBtn.addEventListener('click', onCancel);
  saveBtn.addEventListener('click', onSave);
  mask.addEventListener('click', onMask);
}

document.getElementById('win-new')?.addEventListener('click', async () => {
  try { await api.createProfileWindow?.(); renderWindowList(); } catch (_) { /* ignore */ }
});
document.getElementById('win-refresh')?.addEventListener('click', renderWindowList);
// 新建窗口组（只需输入组名，之后把窗口加进去）
document.getElementById('wg-new')?.addEventListener('click', async () => {
  const name = await ckPrompt({ title: '新建窗口组', placeholder: '组名（如：主力账号组）', value: '' });
  if (name === null) return;
  try {
    await (api as any).wgCreate?.(name.trim() || undefined);
    renderWindowList();
  } catch (_) { /* ignore */ }
});
