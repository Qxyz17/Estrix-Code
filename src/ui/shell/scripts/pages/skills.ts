/**
 * 技能页：列出技能，点击追加"请使用 xxx 技能"。
 */
import { api, escapeHtml } from '../shared.js';
import { addRecent } from '../recent.js';

export async function loadSkills(): Promise<void> {
  const listEl = document.getElementById('skill-list');
  if (!listEl || !api.listSkills) return;
  try {
    const r = await api.listSkills();
    const skills = (r && r.success) ? r.skills : [];
    if (!skills || skills.length === 0) {
      listEl.innerHTML = '<div class="ck-list-empty">未发现技能<br>（.estrix/skills/ 或 ~/.estrix/skills/）</div>';
      return;
    }
    const skillCard = (s: any) =>
      '<div class="ck-skill-item" data-name="' + escapeHtml(s.name) + '">' +
        '<div class="ck-skill-top"><span class="ck-skill-name">' + escapeHtml(s.name) + '</span></div>' +
        '<div class="ck-skill-desc">' + escapeHtml(s.description || '（无描述）') + '</div>' +
      '</div>';
    const userSkills = skills.filter((s: any) => s.source !== 'project');
    const projSkills = skills.filter((s: any) => s.source === 'project');
    let html = '';
    if (userSkills.length) html += '<div class="ck-mcp-group-title">用户级</div>' + userSkills.map(skillCard).join('');
    if (projSkills.length) html += '<div class="ck-mcp-group-title">项目级</div>' + projSkills.map(skillCard).join('');
    listEl.innerHTML = html;
    listEl.querySelectorAll('.ck-skill-item').forEach((el: any) => {
      el.addEventListener('click', async () => {
        if (api.appendSnippet) {
          try { await api.appendSnippet('请使用 ' + el.dataset.name + ' 技能'); } catch (_) { /* ignore */ }
        }
        addRecent('skill', el.dataset.name);
      });
    });
  } catch (_) {
    listEl.innerHTML = '<div class="ck-list-empty">加载失败</div>';
  }
}

document.getElementById('skill-refresh')?.addEventListener('click', loadSkills);
