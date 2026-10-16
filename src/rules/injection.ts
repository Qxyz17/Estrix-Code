/**
 * 规则注入状态（主进程内存，按会话去重）
 *
 * 记录"某会话已注入过哪些规则（按规则文件路径）"。
 * Claude Code 用 sentinel 文件；我们用内存 Map（应用重启即清空，够用）。
 */

// sessionId -> Set<rulePath>
const injected = new Map<string, Set<string>>();

/** 取某会话"已注入规则路径"集合 */
export function getInjectedSet(sessionId: string): Set<string> {
  let s = injected.get(sessionId);
  if (!s) {
    s = new Set<string>();
    injected.set(sessionId, s);
  }
  return s;
}

/** 标记某规则已注入 */
export function markInjected(sessionId: string, rulePath: string): void {
  getInjectedSet(sessionId).add(rulePath);
}

/** 会话切换/清理时移除（可选，防止无限增长） */
export function clearSession(sessionId: string): void {
  injected.delete(sessionId);
}
