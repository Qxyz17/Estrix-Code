/**
 * 工作区（会话）页：按项目目录分组，列出会话，点击导航。
 * 数据：listAllSessions() → [{ sessionId, projectDir, title, createdAt, updatedAt }]
 */
import { api, escapeHtml, escapeAttr, ckPrompt } from '../shared.js';

/** 项目目录 → 显示名（取最后一段） */
function baseName(dir: string): string {
  if (!dir) return '未命名';
  const parts = String(dir).replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || dir;
}

/** 时间：显示"刚刚/N分钟前/N小时前/N天前/N个月前"，无时间返回空 */
function relTime(iso: string | null): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return min + '分钟前';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + '小时前';
  const day = Math.floor(hr / 24);
  if (day < 30) return day + '天前';
  const mon = Math.floor(day / 30);
  if (mon < 12) return mon + '个月前';
  return Math.floor(mon / 12) + '年前';
}

/** 当前项目目录（默认展开，但不置顶）；用户手动展开的组记在 expandedDirs；已归档组记在 archivedOpen */
let currentDir: string | null = null;
let archivedProjects: string[] = [];
const expandedDirs = new Set<string>();
const archivedOpen = new Set<string>();
const archivedProjectsOpen = { v: false };
/** 已展开"子节点"的对话（sessionId）——展开后可见 子代理 / 压缩历史 */
const expandedNodes = new Set<string>();
/** 已展开的子分组（key = sessionId + ':sub' | ':hist'）——默认收起 */
const expandedSubgroups = new Set<string>();

/** 找某对话的"压缩历史"（沿 parentId 往上追，返回 [上一版, 上上版, ...]） */
function collectCompactionHistory(byId: Record<string, any>, session: any): any[] {
  const out: any[] = [];
  let cur = session && session.parentId;
  let guard = 0;
  while (cur && guard++ < 50) {
    const p = byId[cur];
    if (!p) break;
    if (p.kind === 'subagent') break; // 父链里混入子代理关系 → 停
    out.push(p);
    cur = p.parentId;
  }
  return out;
}

/** 取一组会话里最新的时间戳（毫秒）；全无时间返回 0 */
function latestTs(list: any[]): number {
  let max = 0;
  for (const s of list) {
    const t = s.updatedAt ? Date.parse(s.updatedAt) : 0;
    if (Number.isFinite(t) && t > max) max = t;
  }
  return max;
}

/** 按更新时间倒序（无时间排后面） */
function byTimeDesc(a: any, b: any): number {
  const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
  const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
  return tb - ta;
}

/** 渲染单个会话项（archived=true 时按钮为"取消归档"）
 *  hasChildren=true 时前面显示"展开三角"（子代理/压缩历史）
 *  sub=true 表示这是子节点（缩进、无归档按钮、显示"返回当前"）*/
function renderItem(s: any, currentSessionId: string | null, archived: boolean = false, hasChildren: boolean = false, sub: boolean = false): string {
  const label = (s.kind === 'subagent' && s.agentName) ? ('子代理: ' + s.agentName) : (s.title || s.sessionId);
  const time = relTime(s.updatedAt);
  const isCur = s.sessionId === currentSessionId;
  const renameBtn = '<span class="ck-ws-act" data-act="rename" title="重命名">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>' +
  '</span>';
  const act = archived
    ? '<span class="ck-ws-act" data-act="unarchive" title="取消归档">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M12 10v6"/><path d="M9 13l3-3 3 3"/></svg>' +
      '</span>'
    : (sub
        // 子节点：无"归档"按钮（避免把子代理/旧版归档），改为"切到该会话"提示
        ? ''
        : '<span class="ck-ws-act" data-act="archive" title="归档">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>' +
          '</span>');
  const open = hasChildren && expandedNodes.has(s.sessionId);
  const caret = hasChildren
    ? '<span class="ck-ws-expand' + (open ? ' open' : '') + '">' +
        '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3l5 5-5 5"/></svg>' +
      '</span>'
    : (sub ? '<span class="ck-ws-expand ck-ws-expand-hidden"></span>' : '<span class="ck-ws-expand ck-ws-expand-hidden"></span>');
  return '<div class="ck-ws-item' + (isCur ? ' current' : '') + (sub ? ' sub' : '') + '" data-session-id="' + escapeAttr(s.sessionId) + '" data-name="' + escapeAttr(label) + '" title="' + escapeAttr(s.sessionId) + '">' +
    caret +
    '<span class="ck-ws-name">' + escapeHtml(label) + '</span>' +
    (time ? '<span class="ck-ws-time">' + escapeHtml(time) + '</span>' : '') +
    '<span class="ck-ws-acts">' + renameBtn + act + '</span>' +
  '</div>';
}

/** 格式化创建时间：YYYY年M月D日 HH:mm */
function fmtCreatedAt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const p2 = (n: number) => (n < 10 ? '0' + n : String(n));
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
}

/** 项目悬停卡片：显示全路径 + 创建时间 */
function showDirTip(dir: string, anchor: HTMLElement): void {
  const tip = document.getElementById('ws-tip');
  if (!tip) return;
  tip.innerHTML = '<div class="ck-tip-name">' + escapeHtml(baseName(dir)) + '</div>' +
    '<div class="ck-tip-path">' + escapeHtml(dir) + '</div>' +
    '<div class="ck-tip-time" id="ws-tip-time">读取中…</div>';
  tip.style.display = 'block';
  const rect = anchor.getBoundingClientRect();
  const top = rect.bottom + 6;
  // 约束在侧边栏宽度内（超出会被 AI 页面的 WebContentsView 盖住）
  const sidebar = document.getElementById('ck-sidebar');
  const sbw = (sidebar && sidebar.offsetWidth) ? sidebar.offsetWidth : 320;
  const maxLeft = sbw - tip.offsetWidth - 6;
  let left = Math.min(rect.left, Math.max(6, maxLeft));
  if (left < 6) left = 6;
  tip.style.top = top + 'px';
  tip.style.left = left + 'px';
  if (api.getDirInfo) {
    api.getDirInfo(dir).then((r: any) => {
      const t = document.getElementById('ws-tip-time');
      if (!t) return;
      if (r && r.success && r.createdAt) t.textContent = '创建于 ' + fmtCreatedAt(r.createdAt);
      else t.textContent = '（无法读取创建时间）';
    }).catch(() => {
      const t = document.getElementById('ws-tip-time');
      if (t) t.textContent = '（无法读取创建时间）';
    });
  }
}

/** 隐藏项目悬停卡片 */
function hideDirTip(): void {
  const tip = document.getElementById('ws-tip');
  if (tip) tip.style.display = 'none';
}

/** 绑定工作区列表事件（展开/收起、归档、导航、悬停） */
function bindWorkspaceEvents(listEl: HTMLElement): void {
  // 组标题：展开/收起
  listEl.querySelectorAll('.ck-ws-group-title').forEach((el: any) => {
    el.addEventListener('click', () => {
      const groupEl = el.closest('.ck-ws-group');
      if (!groupEl) return;
      const dir = groupEl.dataset.dir;
      const open = groupEl.classList.toggle('open');
      if (open) expandedDirs.add(dir); else expandedDirs.delete(dir);
    });
  });
  // 已归档：展开/收起
  listEl.querySelectorAll('.ck-ws-archived-title').forEach((el: any) => {
    el.addEventListener('click', (e: any) => {
      e.stopPropagation();
      const boxEl = el.closest('.ck-ws-archived');
      if (!boxEl) return;
      const dir = boxEl.dataset.dir;
      const open = boxEl.classList.toggle('open');
      if (open) archivedOpen.add(dir); else archivedOpen.delete(dir);
    });
  });
  // 已归档项目：展开/收起
  listEl.querySelectorAll('.ck-ws-archived-projects-title').forEach((el: any) => {
    el.addEventListener('click', () => {
      const boxEl = el.closest('.ck-ws-archived-projects');
      if (!boxEl) return;
      archivedProjectsOpen.v = boxEl.classList.toggle('open');
    });
  });
  // 组标题：悬停显示项目信息卡片
  listEl.querySelectorAll('.ck-ws-group-title').forEach((el: any) => {
    el.addEventListener('mouseenter', () => {
      const groupEl = el.closest('.ck-ws-group');
      if (groupEl) showDirTip(groupEl.dataset.dir, el);
    });
    el.addEventListener('mouseleave', hideDirTip);
  });
  // 组按钮：新建 / 归档项目
  listEl.querySelectorAll('.ck-ws-gact').forEach((btn: any) => {
    btn.addEventListener('click', async (e: any) => {
      e.stopPropagation();
      const groupEl = btn.closest('.ck-ws-group');
      if (!groupEl) return;
      const dir = groupEl.dataset.dir;
      const act = btn.dataset.gact;
      if (act === 'new') {
        if (!api.newConversationForProject) return;
        try { await api.newConversationForProject(dir); } catch (_) { /* ignore */ }
      } else if (act === 'archive') {
        if (!api.setProjectArchived) return;
        try { await api.setProjectArchived(dir, true); } catch (_) { /* ignore */ }
        loadWorkspaces();
      } else if (act === 'unarchive') {
        if (!api.setProjectArchived) return;
        try { await api.setProjectArchived(dir, false); } catch (_) { /* ignore */ }
        loadWorkspaces();
      }
    });
  });
  // 展开三角：展开/收起子节点（子代理 / 压缩历史）
  listEl.querySelectorAll('.ck-ws-expand').forEach((el: any) => {
    if (el.classList.contains('ck-ws-expand-hidden')) return;
    el.addEventListener('click', (e: any) => {
      e.stopPropagation();
      const itemEl = el.closest('.ck-ws-item');
      if (!itemEl) return;
      const id = itemEl.dataset.sessionId;
      if (!id) return;
      if (expandedNodes.has(id)) expandedNodes.delete(id); else expandedNodes.add(id);
      loadWorkspaces();
    });
  });
  // 子分组标题（子代理/压缩历史）：展开/收起
  listEl.querySelectorAll('.ck-ws-subgroup-title').forEach((el: any) => {
    el.addEventListener('click', (e: any) => {
      e.stopPropagation();
      const key = el.dataset.subgroup;
      if (!key) return;
      if (expandedSubgroups.has(key)) expandedSubgroups.delete(key); else expandedSubgroups.add(key);
      loadWorkspaces();
    });
  });
  // 会话项：点击导航
  listEl.querySelectorAll('.ck-ws-item').forEach((el: any) => {
    el.addEventListener('click', async (e: any) => {
      // 重命名按钮
      if (e.target.closest('[data-act="rename"]')) {
        e.stopPropagation();
        const id = el.dataset.sessionId;
        if (!id || !api.setSessionTitle) return;
        const cur = el.dataset.name || '';
        const name = await ckPrompt({ title: '重命名对话', placeholder: '输入对话名称', value: cur === id ? '' : cur });
        if (!name) return;
        try { await api.setSessionTitle(id, name); } catch (_) { /* ignore */ }
        loadWorkspaces();
        return;
      }
      // 归档 / 取消归档按钮
      if (e.target.closest('[data-act="archive"]')) {
        e.stopPropagation();
        const id = el.dataset.sessionId;
        if (!id || !api.setSessionArchived) return;
        try { await api.setSessionArchived(id, true); } catch (_) { /* ignore */ }
        loadWorkspaces();
        return;
      }
      if (e.target.closest('[data-act="unarchive"]')) {
        e.stopPropagation();
        const id = el.dataset.sessionId;
        if (!id || !api.setSessionArchived) return;
        try { await api.setSessionArchived(id, false); } catch (_) { /* ignore */ }
        loadWorkspaces();
        return;
      }
      const id = el.dataset.sessionId;
      if (!id || !api.navigateSession) return;
      try { await api.navigateSession(id); } catch (_) { /* ignore */ }
    });
  });
}

export async function loadWorkspaces(): Promise<void> {
  const listEl = document.getElementById('ws-list');
  if (!listEl || !api.listAllSessions) return;
  try {
    if (api.getProjectDir) {
      try { const pr = await api.getProjectDir(); if (pr && pr.success) currentDir = pr.dir; } catch (_) { /* ignore */ }
    }
    const r = await api.listAllSessions();
    const sessions = (r && r.success && Array.isArray(r.sessions)) ? r.sessions : [];
    const currentSessionId = (r && r.currentSessionId) || null;
    archivedProjects = (r && Array.isArray(r.archivedProjects)) ? r.archivedProjects : [];
    if (sessions.length === 0) {
      listEl.innerHTML = '<div class="ck-list-empty">暂无会话</div>';
      return;
    }
    // 索引：sessionId -> 会话
    const byId: Record<string, any> = {};
    for (const s of sessions) byId[s.sessionId] = s;
    // 子代理：按父对话索引
    const subagentsByParent: Record<string, any[]> = {};
    for (const s of sessions) {
      if (s.kind === 'subagent' && s.parentId) {
        if (!subagentsByParent[s.parentId]) subagentsByParent[s.parentId] = [];
        subagentsByParent[s.parentId].push(s);
      }
    }
    // 主列表 = 排除"子代理"和"被压缩的旧版"
    const mainSessions = sessions.filter((s: any) => s.kind !== 'subagent' && !s.superseded);
    // 按项目目录分组；每组的非归档 / 归档分开
    const groups: Record<string, { active: any[]; archived: any[] }> = {};
    for (const s of mainSessions) {
      const dir = s.projectDir || '';
      if (!groups[dir]) groups[dir] = { active: [], archived: [] };
      if (s.archived) groups[dir].archived.push(s); else groups[dir].active.push(s);
    }
    // 渲染"一个对话 + 它的子节点（子代理/压缩历史）"
    const renderConversation = (s: any, archived: boolean): string => {
      const hist = collectCompactionHistory(byId, s);
      // 子代理：从"当前 + 压缩历史链"上收集（压缩后子代理仍挂在旧版下）
      const chainIds = [s.sessionId].concat(hist.map((x: any) => x.sessionId));
      const subs: any[] = [];
      for (const cid of chainIds) {
        const arr = subagentsByParent[cid];
        if (arr) for (const x of arr) subs.push(x);
      }
      const hasChildren = subs.length > 0 || hist.length > 0;
      let out = renderItem(s, currentSessionId, archived, hasChildren);
      if (hasChildren && expandedNodes.has(s.sessionId)) {
        out += '<div class="ck-ws-children">';
        if (subs.length) {
          const subKey = s.sessionId + ':sub';
          const subOpen = expandedSubgroups.has(subKey);
          out += '<div class="ck-ws-subgroup-title' + (subOpen ? ' open' : '') + '" data-subgroup="' + escapeAttr(subKey) + '">子代理（' + subs.length + '）</div>';
          if (subOpen) out += subs.map((x: any) => renderItem(x, currentSessionId, false, false, true)).join('');
        }
        if (hist.length) {
          const histKey = s.sessionId + ':hist';
          const histOpen = expandedSubgroups.has(histKey);
          out += '<div class="ck-ws-subgroup-title' + (histOpen ? ' open' : '') + '" data-subgroup="' + escapeAttr(histKey) + '">压缩历史（' + hist.length + '）</div>';
          if (histOpen) out += hist.map((x: any) => renderItem(x, currentSessionId, false, false, true)).join('');
        }
        out += '</div>';
      }
      return out;
    };
    // 组顺序：按最近活动时间倒序（无时间的排后面）
    const dirs = Object.keys(groups).sort((a, b) => {
      const ta = latestTs(groups[a].active.concat(groups[a].archived));
      const tb = latestTs(groups[b].active.concat(groups[b].archived));
      return tb - ta;
    });
    const renderGroup = (dir: string): string => {
      const g = groups[dir];
      g.active.sort(byTimeDesc);
      g.archived.sort(byTimeDesc);
      const isOpen = (dir === currentDir) || expandedDirs.has(dir);
      const isArchOpen = archivedOpen.has(dir);
      return '<div class="ck-ws-group' + (isOpen ? ' open' : '') + '" data-dir="' + escapeAttr(dir) + '">' +
        '<div class="ck-ws-group-title" title="' + escapeAttr(dir) + '">' +
          '<svg class="ck-ws-caret" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3l5 5-5 5"/></svg>' +
          '<svg class="ck-ws-folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' +
          '<span class="ck-ws-gname">' + escapeHtml(baseName(dir)) + '</span>' +
          '<span class="ck-ws-gacts">' +
            '<span class="ck-ws-gact" data-gact="new" title="用该项目新建对话">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>' +
            '</span>' +
            (archivedProjects.includes(dir)
              ? '<span class="ck-ws-gact" data-gact="unarchive" title="取消归档">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v5h5"/><path d="M3.5 12a8.5 8.5 0 1 0 2-5.4L3 9"/></svg>' +
                '</span>'
              : '<span class="ck-ws-gact" data-gact="archive" title="归档项目">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>' +
                '</span>') +
          '</span>' +
        '</div>' +
        '<div class="ck-ws-items">' +
          g.active.map((s: any) => renderConversation(s, false)).join('') +
          (g.archived.length ? (
            '<div class="ck-ws-archived' + (isArchOpen ? ' open' : '') + '" data-dir="' + escapeAttr(dir) + '">' +
              '<div class="ck-ws-archived-title">已归档 ' + g.archived.length + ' 对话</div>' +
              '<div class="ck-ws-archived-items">' +
                g.archived.map((s: any) => renderConversation(s, true)).join('') +
              '</div>' +
            '</div>'
          ) : '') +
        '</div>' +
      '</div>';
    };
    // 分开：活跃项目 / 已归档项目
    const activeDirs = dirs.filter((d) => !archivedProjects.includes(d));
    const archivedDirs = dirs.filter((d) => archivedProjects.includes(d));
    let html = '';
    for (const dir of activeDirs) html += renderGroup(dir);
    // 底部「已归档 N 项目」（折叠）
    if (archivedDirs.length) {
      html += '<div class="ck-ws-archived-projects' + (archivedProjectsOpen.v ? ' open' : '') + '">' +
        '<div class="ck-ws-archived-projects-title">已归档 ' + archivedDirs.length + ' 项目</div>' +
        '<div class="ck-ws-archived-projects-items">' +
          archivedDirs.map((d) => renderGroup(d)).join('') +
        '</div>' +
      '</div>';
    }
    listEl.innerHTML = html;
    bindWorkspaceEvents(listEl);
  } catch (_) {
    listEl.innerHTML = '<div class="ck-list-empty">加载失败</div>';
  }
}

document.getElementById('ws-refresh')?.addEventListener('click', loadWorkspaces);

// 当前项目目录变化 → 刷新（更新默认展开的组）
if (api.onProjectDir) {
  api.onProjectDir((dir: string | null) => {
    currentDir = dir;
    loadWorkspaces();
  });
}

// URL 变化（切换会话）→ 节流刷新，保证"当前对话"始终置顶
let wsRefreshTimer: any = null;
if (api.onUrlUpdated) {
  api.onUrlUpdated(() => {
    if (wsRefreshTimer) clearTimeout(wsRefreshTimer);
    wsRefreshTimer = setTimeout(() => { loadWorkspaces(); }, 600);
  });
}

// 会话标题/归档变化（如 AI 命名对话）→ 立即刷新
if (api.onSessionsChanged) {
  api.onSessionsChanged(() => { loadWorkspaces(); });
}
