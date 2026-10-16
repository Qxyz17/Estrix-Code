/**
 * Provider 运行时字段校验（D14）
 * TS 类型运行时被擦除，"必须实现接口"的真正强制靠此函数。
 * 内置与自定义 provider 都必须通过。
 */
import type { Provider } from './types.js';

/** 校验 provider；返回错误描述，通过返回 null */
export function validateProvider(p: any): string | null {
  if (!p || typeof p !== 'object') return '必须是对象';
  if (!p.id || typeof p.id !== 'string') return '缺少 id';
  if (!p.name || typeof p.name !== 'string') return '缺少 name';
  if (!p.homeUrl || typeof p.homeUrl !== 'string') return '缺少 homeUrl';
  if (!p.sessionUrlBase || typeof p.sessionUrlBase !== 'string') return '缺少 sessionUrlBase';
  if (typeof p.matchesUrl !== 'function') return '缺少 matchesUrl 方法';
  if (typeof p.extractSessionId !== 'function') return '缺少 extractSessionId 方法';
  return null;
}

/** 校验并断言（不通过则抛错），返回原对象 */
export function assertProvider(p: any): Provider {
  const err = validateProvider(p);
  if (err) throw new Error(err);
  return p as Provider;
}
