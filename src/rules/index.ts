/**
 * 规则模块入口
 */
export { scanRules, getUnscopedRules, getScopedRules } from './scanner.js';
export { getInjectedSet, markInjected, clearSession } from './injection.js';
export { matchRulesForPath, ruleMatchesPath } from './matcher.js';
export { buildUnscopedRulesSection, renderRuleFull, renderRulePointer } from './prompt.js';
export { parseRuleFrontmatter } from './frontmatter.js';
export type { RuleMeta, RuleSource } from './types.js';
