/**
 * 子代理页：列表、新建、编辑改名、删除。
 */
import { api, ckAlert, ckConfirm, escapeHtml, escapeAttr } from '../shared.js';
import { addRecent } from '../recent.js';

export async function loadAgents(): Promise<void> {
  const listEl = document.getElementById('agent-list');
  if (!listEl || !api.listAgents) return;
  try {
    const r = await api.listAgents();
    const agents = (r && r.success) ? r.agents : [];
    if (!agents || agents.length === 0) {
      listEl.innerHTML = '<div class="ck-list-empty">未发现子代理<br>（.estrix/agents/ 或 ~/.estrix/agents/）</div>';
      return;
    }
    const agentCard = (a: any) =>
      '<div class="ck-skill-item ck-agent-item" data-name="' + escapeHtml(a.name) + '" data-path="' + escapeAttr(a.agentPath) + '">' +
        '<div class="ck-skill-top">' +
          '<span class="ck-skill-name">' + escapeHtml(a.name) + '</span>' +
          '<div class="ck-agent-actions">' +
            '<button class="ck-snip-icon-btn" data-edit-agent="' + escapeAttr(a.agentPath) + '" title="编辑">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>' +
            '</button>' +
            '<button class="ck-snip-icon-btn danger" data-del-agent="' + escapeAttr(a.agentPath) + '" title="删除">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="ck-skill-desc">' + escapeHtml(a.description || '（无描述）') + '</div>' +
      '</div>';
    const userAgents = agents.filter((a: any) => a.source !== 'project');
    const projAgents = agents.filter((a: any) => a.source === 'project');
    let html = '';
    if (userAgents.length) html += '<div class="ck-mcp-group-title">用户级</div>' + userAgents.map(agentCard).join('');
    if (projAgents.length) html += '<div class="ck-mcp-group-title">项目级</div>' + projAgents.map(agentCard).join('');
    listEl.innerHTML = html;
    listEl.querySelectorAll('.ck-skill-item').forEach((el: any) => {
      el.addEventListener('click', async (e: any) => {
        if (e.target.closest('[data-edit-agent]') || e.target.closest('[data-del-agent]')) return;
        if (api.appendSnippet) {
          try { await api.appendSnippet('请使用 ' + el.dataset.name + ' 子代理'); } catch (_) { /* ignore */ }
        }
        addRecent('agent', el.dataset.name);
      });
    });
    listEl.querySelectorAll('[data-edit-agent]').forEach((btn: any) => {
      btn.addEventListener('click', (e: any) => {
        e.stopPropagation();
        const cardEl = btn.closest('.ck-agent-item');
        openAgentEditModal(btn.dataset.editAgent, cardEl ? cardEl.dataset.name : '');
      });
    });
    listEl.querySelectorAll('[data-del-agent]').forEach((btn: any) => {
      btn.addEventListener('click', async (e: any) => {
        e.stopPropagation();
        if (!(await ckConfirm('确定删除该子代理文件？此操作不可恢复。'))) return;
        if (!api.deleteAgentFile) return;
        try {
          const r = await api.deleteAgentFile(btn.dataset.delAgent);
          if (r && r.success) loadAgents();
          else await ckAlert((r && r.error) || '删除失败');
        } catch (err: any) { await ckAlert('删除失败: ' + (err.message || err)); }
      });
    });
  } catch (_) {
    listEl.innerHTML = '<div class="ck-list-empty">加载失败</div>';
  }
}

// ===== 新建 / 编辑 弹窗 =====
let agentEditPath = '';

function openAgentModal(): void {
  const modal = document.getElementById('agent-modal');
  if (!modal) return;
  agentEditPath = '';
  const title = document.getElementById('agent-modal-title');
  if (title) title.textContent = '新建子代理';
  const nameEl = document.getElementById('agent-name') as any;
  if (nameEl) nameEl.value = '';
  const scopeField = document.getElementById('agent-scope-field');
  if (scopeField) scopeField.style.display = '';
  const tip = document.getElementById('agent-modal-tip');
  if (tip) tip.textContent = '生成模板后，会用系统默认程序打开，你直接编辑保存即可。';
  const createBtn = document.getElementById('agent-create');
  if (createBtn) createBtn.textContent = '创建并打开';
  document.getElementById('agent-open-file')?.classList.add('estrix-hidden');
  modal.classList.remove('estrix-hidden');
  nameEl?.focus();
}

function openAgentEditModal(agentPath: string, curName: string): void {
  const modal = document.getElementById('agent-modal');
  if (!modal) return;
  agentEditPath = agentPath || '';
  const title = document.getElementById('agent-modal-title');
  if (title) title.textContent = '编辑子代理';
  const nameEl = document.getElementById('agent-name') as any;
  if (nameEl) nameEl.value = curName || '';
  const scopeField = document.getElementById('agent-scope-field');
  if (scopeField) scopeField.style.display = 'none';
  const tip = document.getElementById('agent-modal-tip');
  if (tip) tip.textContent = '改名会重命名文件；「打开正文」用系统程序编辑提示词。';
  const createBtn = document.getElementById('agent-create');
  if (createBtn) createBtn.textContent = '保存名称';
  document.getElementById('agent-open-file')?.classList.remove('estrix-hidden');
  modal.classList.remove('estrix-hidden');
  nameEl?.focus();
}

function closeAgentModal(): void {
  document.getElementById('agent-modal')?.classList.add('estrix-hidden');
}

document.getElementById('agent-new')?.addEventListener('click', openAgentModal);
document.getElementById('agent-cancel')?.addEventListener('click', closeAgentModal);
document.getElementById('agent-refresh')?.addEventListener('click', loadAgents);

document.getElementById('agent-open-file')?.addEventListener('click', async () => {
  if (!agentEditPath || !api.openAgentFile) return;
  try {
    const r = await api.openAgentFile(agentEditPath);
    if (r && !r.success) await ckAlert((r && r.error) || '打开失败');
  } catch (err: any) { await ckAlert('打开失败: ' + (err.message || err)); }
});

document.getElementById('agent-create')?.addEventListener('click', async (e: any) => {
  const btn = e.currentTarget;
  const name = ((document.getElementById('agent-name') as any) || {}).value || '';
  if (!name.trim()) { await ckAlert('请填写名称'); return; }
  btn.disabled = true;
  try {
    if (agentEditPath) {
      if (!api.renameAgent) return;
      const rr = await api.renameAgent(agentEditPath, name.trim());
      if (rr && rr.success) { closeAgentModal(); loadAgents(); }
      else await ckAlert((rr && rr.error) || '保存失败');
    } else {
      if (!api.createAgentFile) return;
      const scope = ((document.getElementById('agent-scope') as any) || {}).value || 'project';
      const r = await api.createAgentFile(name.trim(), scope);
      if (r && r.success) {
        closeAgentModal();
        await ckAlert('已创建：' + r.name + '.md\n（已用系统默认程序打开，编辑保存后点「刷新」即可看到）');
        loadAgents();
      } else {
        await ckAlert((r && r.error) || '创建失败');
      }
    }
  } catch (e2: any) {
    await ckAlert('操作失败: ' + (e2.message || e2));
  }
  btn.disabled = false;
});
