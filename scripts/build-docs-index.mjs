/**
 * 生成 docs/requirements/INDEX.md（需求总览表）
 * 扫描 docs/requirements/*.md 的 YAML frontmatter，按 id 排序输出表格。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'docs', 'requirements');
const OUT = path.join(DIR, 'INDEX.md');

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const obj = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    // 去掉 YAML 值两侧的引号（手写/不同 AI 可能加引号，统一剥掉）
    if (v.length >= 2 && ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'"))) {
      v = v.slice(1, -1);
    }
    if (k) obj[k] = v;
  }
  return obj;
}

const rows = [];
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.md')) continue;
  if (f === 'README.md' || f === 'INDEX.md') continue;
  const text = fs.readFileSync(path.join(DIR, f), 'utf8');
  const fm = parseFrontmatter(text);
  if (!fm) continue;
  rows.push({
    id: fm.id || '',
    type: fm.type || '',
    title: fm.title || f,
    status: fm.status || '',
    branch: fm.branch || '',
    updated: fm.updated || '',
    file: f,
  });
}

rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));

const lines = [];
lines.push('# 需求索引');
lines.push('');
lines.push('> 本文件由 scripts/build-docs-index.mjs 自动生成，请勿手改。');
lines.push('> 新增/更新需求后运行：npm run docs:index');
lines.push('');
lines.push('| ID | 类型 | 标题 | 状态 | 分支 | 更新 |');
lines.push('|---|---|---|---|---|---|');
for (const r of rows) {
  const link = '[' + r.title + '](./' + r.file + ')';
  lines.push('| ' + r.id + ' | ' + r.type + ' | ' + link + ' | ' + r.status + ' | ' + r.branch + ' | ' + r.updated + ' |');
}
lines.push('');
lines.push('共 ' + rows.length + ' 个需求。');

fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
console.log('[docs:index] 生成 ' + path.relative(ROOT, OUT) + '（' + rows.length + ' 个需求）');
