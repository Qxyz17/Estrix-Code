/**
 * 快捷提示词（Snippets）管理
 *
 * 存储：~/.estrix/snippets.json（用户级，所有项目通用）
 * 可用环境变量 ESTRIX_HOME 覆盖（测试隔离）。
 *
 * 数据模型：
 *   { id: string, name: string, content: string, autoSend: boolean }
 *
 * 首次读写时若文件不存在，写入 3 条默认提示词。
 * 之后完全由用户掌控（可增/删/改）。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface Snippet {
  id: string;
  name: string;
  content: string;
  autoSend: boolean;
}

/** 用户级目录（可用 ESTRIX_HOME 覆盖，供测试隔离） */
function getUserDir(): string {
  const override = process.env.ESTRIX_HOME;
  return override ? override : path.join(os.homedir(), '.estrix');
}

function getSnippetsFile(): string {
  return path.join(getUserDir(), 'snippets.json');
}

/** 三条默认提示词（原文取自旧 overlay 实现） */
function defaultSnippets(): Snippet[] {
  return [
    {
      id: 'default-gen-doc',
      name: '生成项目说明',
      content: '根据当前项目生成一个类似 claude.md 的项目说明文件，并将文件放到当前项目 .estrix/ESTRIX.md',
      autoSend: true,
    },
    {
      id: 'default-immersive',
      name: '沉浸式交流',
      content: '现在你的任何疑问,或没有疑问的选择都需要和我确认 , 确认的方式是 你问一个问题我回答一个问题,然后你再问下一个问题, 最好给我选项, 也要给我个其他的选项, 谢谢 爱你哦',
      autoSend: true,
    },
    {
      id: 'default-continue',
      name: '卡住了?点我',
      content: '刚才卡住了请继续 爱你哦',
      autoSend: true,
    },
  ];
}

/** 校验并规整单条 snippet */
function normalizeSnippet(raw: any): Snippet | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const content = typeof raw.content === 'string' ? raw.content : '';
  if (!name || !content.trim()) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : 'snip-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    name,
    content,
    autoSend: raw.autoSend !== false, // 默认 true
  };
}

/**
 * 读取全部 snippets。
 * 文件不存在 → 写入 3 条默认并返回。
 */
function listSnippets(): Snippet[] {
  const file = getSnippetsFile();
  try {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (Array.isArray(raw)) {
        const list = raw.map(normalizeSnippet).filter(Boolean) as Snippet[];
        return list;
      }
    }
  } catch (err: any) {
    console.error('[Snippets] 读取失败:', err.message);
  }
  // 首次：写入默认
  const defaults = defaultSnippets();
  saveSnippets(defaults);
  return defaults;
}

/** 整体覆盖写入 */
function saveSnippets(list: any): boolean {
  const file = getSnippetsFile();
  try {
    const arr = Array.isArray(list) ? list : [];
    const clean = arr.map(normalizeSnippet).filter(Boolean) as Snippet[];
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(clean, null, 2), 'utf-8');
    console.log('[Snippets] 已写入:', file);
    return true;
  } catch (err: any) {
    console.error('[Snippets] 写入失败:', err.message);
    return false;
  }
}

export { listSnippets, saveSnippets, getSnippetsFile, defaultSnippets };
