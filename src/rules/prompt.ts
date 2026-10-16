/**
 * 规则提示词生成：
 *  - 无 paths 规则 → 「## 项目规则」章节（初始化时注入）
 *  - 有 paths 规则 → 注入文本（首次全文 / 之后仅名字+路径）
 */
import type { RuleMeta } from './types.js';

/** 生成「## 项目规则」章节（无 paths 的规则）。无规则返回空串 */
export function buildUnscopedRulesSection(rules: RuleMeta[]): string {
  const list = rules || [];
  if (list.length === 0) return '';
  const lines: string[] = [];
  lines.push('## 项目规则');
  lines.push('');
  lines.push('以下规则始终适用，请遵守。');
  lines.push('');
  for (const r of list) {
    lines.push('### ' + r.name);
    lines.push('');
    lines.push(r.body);
    lines.push('');
  }
  return lines.join('\n');
}

/** 首次命中：规则全文 + 路径 */
export function renderRuleFull(r: RuleMeta): string {
  return '【规则「' + r.name + '」｜路径 ' + r.rulePath + '】\n' + r.body;
}

/** 之后命中：规则名 + 路径（提示 AI 自己 read） */
export function renderRulePointer(r: RuleMeta, matchedFile: string): string {
  return '【规则提醒】' + matchedFile + ' 适用规则「' + r.name + '」\n（需要时 read：' + r.rulePath + '）';
}
