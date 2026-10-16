/**
 * MCP（连接器）页：列出 server，点击追加"请使用 xxx 这个 MCP"。
 */
import { api, escapeHtml } from '../shared.js';
import { addRecent } from '../recent.js';

export async function loadMcpServers(): Promise<void> {
  const listEl = document.getElementById('mcp-list');
  if (!listEl || !api.listMcpServers) return;
  try {
    const r = await api.listMcpServers();
    const servers = (r && r.success) ? r.servers : [];
    if (!servers || servers.length === 0) {
      listEl.innerHTML = '<div class="ck-list-empty">未配置 MCP server</div>';
      return;
    }
    const cardHtml = (s: any) => {
      const dotCls = s.connected ? 'ck-mcp-dot on' : 'ck-mcp-dot';
      return '<div class="ck-mcp-item" data-name="' + escapeHtml(s.name) + '">' +
        '<div class="ck-mcp-top">' +
          '<span class="' + dotCls + '"></span>' +
          '<span class="ck-mcp-name">' + escapeHtml(s.name) + '</span>' +
        '</div>' +
        '<div class="ck-mcp-bottom">' +
          '<span class="ck-mcp-tag">' + escapeHtml(s.type || 'stdio') + '</span>' +
          '<span class="ck-mcp-tag">' + (s.toolCount || 0) + ' 工具</span>' +
        '</div>' +
      '</div>';
    };
    const userServers = servers.filter((s: any) => s.source !== 'project');
    const projServers = servers.filter((s: any) => s.source === 'project');
    let html = '';
    if (userServers.length) html += '<div class="ck-mcp-group-title">用户级</div>' + userServers.map(cardHtml).join('');
    if (projServers.length) html += '<div class="ck-mcp-group-title">项目级</div>' + projServers.map(cardHtml).join('');
    listEl.innerHTML = html;
    listEl.querySelectorAll('.ck-mcp-item').forEach((el: any) => {
      el.addEventListener('click', async () => {
        if (api.appendSnippet) {
          try { await api.appendSnippet('请使用 ' + el.dataset.name + ' 这个 MCP'); } catch (_) { /* ignore */ }
        }
        addRecent('mcp', el.dataset.name);
      });
    });
  } catch (_) {
    listEl.innerHTML = '<div class="ck-list-empty">加载失败</div>';
  }
}

document.getElementById('mcp-refresh')?.addEventListener('click', loadMcpServers);
