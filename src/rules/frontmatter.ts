/**
 * 解析规则 frontmatter（在通用 key:value 基础上，额外支持 `paths` 数组）
 *
 * 支持两种写法：
 *   paths:
 *     - "src/api/**"
 *     - "src/routes/**"
 *   paths: ["src/api/**"]        （单行数组，也支持）
 */
import { parseFrontmatter } from '../skills/frontmatter.js';

/** 从 markdown 原文提取规则 frontmatter（含 paths 数组） */
export function parseRuleFrontmatter(content: string): { name: string; paths: string[]; body: string } {
  // 先用通用解析拿 key:value（name 在这里）
  const { data, body } = parseFrontmatter(content);
  const name = (data.name || '').trim();

  // 单独解析 paths（数组，通用解析器不支持）
  const paths = parsePaths(content);

  return { name, paths, body };
}

/** 从原文的 frontmatter 块中提取 paths 数组 */
function parsePaths(content: string): string[] {
  const text = content.replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return [];
  const endIdx = text.indexOf('\n---', 3);
  if (endIdx === -1) return [];
  const fmText = text.slice(4, endIdx);

  const lines = fmText.split('\n');
  const out: string[] = [];
  let inPaths = false;
  let baseIndent = 0;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    const trimmed = line.trim();

    // 进入 paths 块：`paths:` 或 `paths: [ ... ]`
    const m = trimmed.match(/^paths\s*:\s*(.*)$/);
    if (m) {
      const inline = m[1].trim();
      if (inline.startsWith('[')) {
        // 单行数组：["a", "b"]
        const items = inline.replace(/^\[/, '').replace(/\]$/, '').split(',');
        for (const it of items) {
          const v = stripQuotes(it.trim());
          if (v) out.push(v);
        }
        inPaths = false;
      } else if (inline) {
        // paths: xxx （单个值）
        const v = stripQuotes(inline);
        if (v) out.push(v);
        inPaths = false;
      } else {
        inPaths = true;
        baseIndent = line.length - line.trimStart().length;
      }
      continue;
    }

    if (inPaths) {
      const indent = line.length - line.trimStart().length;
      // 缩进回到 <= baseIndent（新顶层键）→ 退出 paths
      if (trimmed && indent <= baseIndent) { inPaths = false; }
      else if (trimmed.startsWith('-')) {
        const v = stripQuotes(trimmed.slice(1).trim());
        if (v) out.push(v);
        continue;
      } else if (trimmed) {
        inPaths = false;
      }
    }
  }
  return out;
}

function stripQuotes(v: string): string {
  if (v.length >= 2) {
    const f = v[0], l = v[v.length - 1];
    if ((f === '"' && l === '"') || (f === "'" && l === "'")) return v.slice(1, -1);
  }
  return v;
}
