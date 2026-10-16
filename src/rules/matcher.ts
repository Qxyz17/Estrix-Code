/**
 * 规则路径匹配（picomatch）
 */
import picomatch from 'picomatch';
import type { RuleMeta } from './types.js';

/** 把项目内相对路径（正斜杠）与规则的 glob 匹配 */
export function ruleMatchesPath(rule: RuleMeta, relPath: string): boolean {
  if (rule.paths.length === 0) return false;
  const normalized = relPath.replace(/\\/g, '/');
  return rule.paths.some((p) => {
    try {
      return picomatch.isMatch(normalized, p, { dot: true });
    } catch {
      return false;
    }
  });
}

/**
 * 从给定文件列表中，找出命中的规则。
 * @param rules 所有"有 paths"的规则
 * @param relPath 项目内相对路径（正斜杠）
 */
export function matchRulesForPath(rules: RuleMeta[], relPath: string): RuleMeta[] {
  return rules.filter((r) => ruleMatchesPath(r, relPath));
}
