/**
 * Provider 注册表
 * 加载所有内置的 AI 平台 Provider（并校验），以及用户导入的自定义 Provider。
 */
import { loadCustomProviders } from './custom/loader.js';
import { deepseek } from './deepseek.js';
import { claude } from './claude.js';
import { chatgpt } from './chatgpt.js';
import { glm } from './glm.js';
import { validateProvider } from './validate.js';

function loadBuiltinProviders(): any[] {
  const list: any[] = [];
  for (const p of [deepseek, claude, chatgpt, glm]) {
    const err = validateProvider(p);
    if (err) {
      console.warn('[Provider] 内置 provider 校验失败，跳过:', (p && p.id) || '?', err);
      continue;
    }
    list.push(p);
  }
  return list;
}

const builtinProviders = loadBuiltinProviders();

function getAllProviders(): any[] {
  return [...builtinProviders, ...loadCustomProviders()];
}

function getProvider(id: string): any {
  return getAllProviders().find((p) => p.id === id) || null;
}

/** 根据 URL 自动识别所属平台 */
function getProviderByUrl(url: string): any {
  if (!url) return null;
  return getAllProviders().find((p) => typeof p.matchesUrl === 'function' && p.matchesUrl(url)) || null;
}

const providers = getAllProviders();

export { providers, getProvider, getAllProviders, getProviderByUrl };
