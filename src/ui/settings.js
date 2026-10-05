/**
 * 设置页逻辑 —— 读写 app-settings / api-config，渲染各设置区块。
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const content = $('content');
  const api = window.electronAPI || {};

  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    if (children) (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  function section(title, ...cards) {
    const s = h('div', { class: 'section' }, [h('div', { class: 'section-title' }, title), ...cards]);
    return s;
  }

  function card(...rows) {
    return h('div', { class: 'card' }, rows);
  }

  function row(label, desc, control) {
    const left = h('div', {}, [h('div', { class: 'row-label' }, label), desc ? h('div', { class: 'row-desc' }, desc) : null]);
    return h('div', { class: 'row' }, [left, control]);
  }

  function select(options, value, onchange) {
    const s = h('select');
    for (const o of options) {
      const opt = h('option', { value: o.value }, o.label);
      if (o.value === value) opt.selected = true;
      s.appendChild(opt);
    }
    s.addEventListener('change', () => onchange(s.value));
    return s;
  }

  function numberInput(value, min, max, onchange) {
    const i = h('input', { type: 'number', value: String(value), min: String(min), max: String(max) });
    i.addEventListener('change', () => onchange(Number(i.value)));
    return i;
  }

  function toggle(checked, onchange) {
    const i = h('input', { type: 'checkbox' });
    i.checked = !!checked;
    i.style.cssText = 'width:18px;height:18px;accent-color:var(--accent);cursor:pointer;';
    i.addEventListener('change', () => onchange(i.checked));
    return i;
  }

  function button(text, onclick) {
    const b = h('button', {}, text);
    b.style.cssText = 'padding:7px 14px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:13px;cursor:pointer;transition:background .16s var(--ease);';
    b.addEventListener('mouseenter', () => b.style.background = 'var(--surface-hover)');
    b.addEventListener('mouseleave', () => b.style.background = 'var(--surface)');
    b.addEventListener('click', onclick);
    return b;
  }

  async function save(patch) {
    const r = await api.setAppSettings(patch);
    if (r && !r.success) console.error('保存设置失败:', r.error);
  }

  async function render() {
    content.innerHTML = '';
    const r = await api.getAppSettings();
    const s = (r && r.success && r.settings) || { idleUnload: {}, security: {} };
    const idle = s.idleUnload || {};
    const sec = s.security || {};

    // 安全策略
    content.appendChild(section('安全策略',
      card(row('命令审查级别', '严格=全部确认 · 默认=危险命令确认 · 绕过=全部放行',
        select([
          { value: 'strict', label: '严格' },
          { value: 'default', label: '默认' },
          { value: 'bypass', label: '绕过' },
        ], sec.level || 'default', (v) => save({ security: { level: v } })))),
    ));

    // 闲置卸载
    content.appendChild(section('闲置标签卸载',
      card(
        row('启用', '后台标签闲置超时后卸载，切回自动重载（省内存）',
          toggle(idle.enabled, (v) => save({ idleUnload: { enabled: v } }))),
        row('超时（分钟）', '多久未使用后卸载',
          numberInput(idle.timeoutMin || 10, 1, 1440, (v) => save({ idleUnload: { timeoutMin: v } }))),
      ),
    ));

    // 发送延迟
    content.appendChild(section('发送延迟',
      card(row('延迟范围（毫秒）', '消息填入后随机延迟再发送',
        (() => {
          const min = numberInput(s.sendDelayMin || 2000, 0, 10000, (v) => save({ sendDelayMin: v }));
          const max = numberInput(s.sendDelayMax || 4000, 0, 10000, (v) => save({ sendDelayMax: v }));
          const wrap = h('div', {}, [min, document.createTextNode(' ~ '), max]);
          wrap.style.cssText = 'display:flex;align-items:center;gap:8px;';
          return wrap;
        })())),
    ));

    // 本地 API
    const apiCfg = (await api.getApiConfig().catch(() => null)) || {};
    const cfg = (apiCfg && apiCfg.config) || {};
    content.appendChild(section('本地 API 服务',
      card(
        row('API Key', '客户端调用本地 OpenAI 兼容接口时的认证（留空则不校验）',
          (() => {
            const i = h('input', { type: 'text', value: cfg.apiKey || '', placeholder: '自定义 key' });
            i.style.width = '220px';
            i.addEventListener('change', async () => {
              await api.setApiConfig({ apiKey: i.value.trim() });
            });
            return i;
          })()),
        row('接口地址', 'OpenAI 兼容：POST /v1/chat/completions',
          h('span', { class: 'row-desc' }, 'http://127.0.0.1:11434')),
      ),
    ));

    // 项目目录
    content.appendChild(section('项目',
      card(row('当前项目目录', 'AI 感知的工程目录',
        button('修改…', async () => { await api.updateProjectDir && api.updateProjectDir(); }))),
    ));

    // 账号
    content.appendChild(section('账号',
      card(row('账号管理', '新建 / 删除平台账号',
        button('打开…', async () => {
          if (api.openProfileWindow) {
            const r2 = await api.listProfiles();
            if (r2 && r2.success) {
              // 简单提示：账号列表
              alert('账号：' + (r2.profiles || []).map(p => p.name).join('、') || '（无）');
            }
          }
        }))),
    ));

    // MCP
    content.appendChild(section('MCP 工具',
      card(row('MCP 配置', '在 settings.json / mcp.json 中编辑，或通过 AI 工具管理',
        button('刷新列表', async () => {
          const r3 = await api.listMcpServers();
          if (r3 && r3.success) alert('MCP Servers：' + ((r3.servers || []).map(x => x.name).join('、') || '（无）'));
        }))),
    ));
  }

  render().catch((e) => {
    content.innerHTML = '<div class="empty">加载失败：' + (e && e.message) + '</div>';
  });
})();
