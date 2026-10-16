/**
 * 构建期生成 hook 源码字符串（P4.4.1）
 *
 * 各平台网络拦截器（src/providers/hooks/*.ts）经 esbuild 打包为自包含 IIFE，
 * 产出到 src/providers/generated/hook-sources.ts，供 provider 的 getHookSource() 返回。
 * 这样 hook 内部可以正常 import 共享模块（shared/sse.ts），而运行时仍是单文件字符串。
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'src', 'providers', 'generated', 'hook-sources.ts');

// 平台 hook 入口（顺序即生成顺序）
const HOOKS = [
  ['DEEPSEEK', 'src/providers/hooks/deepseek.ts'],
  ['CLAUDE', 'src/providers/hooks/claude.ts'],
  ['CHATGPT', 'src/providers/hooks/chatgpt.ts'],
  ['GLM', 'src/providers/hooks/glm.ts'],
];

// 让 .js 后缀的 import 解析到 .ts 源文件（tsc 要求带 .js 后缀，esbuild 默认不认）
const tsJsResolve = {
  name: 'ts-js-resolve',
  setup(b) {
    b.onResolve({ filter: /\.js$/ }, (args) => {
      const p = path.resolve(args.resolveDir, args.path.replace(/\.js$/, '.ts'));
      if (fs.existsSync(p)) return { path: p };
      return null;
    });
  },
};

async function bundle(entry) {
  const result = await build({
    entryPoints: [path.join(ROOT, entry)],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: false,
    legalComments: 'none',
    logLevel: 'warning',
    plugins: [tsJsResolve],
  });
  return result.outputFiles[0].text;
}

const parts = [];
parts.push('// 本文件由 scripts/build-hooks.mjs 自动生成，请勿手动编辑。');
parts.push('// 内容为各平台网络拦截器的自包含 IIFE 源码（注入 AI 网页主世界执行）。');
parts.push('');
for (const [name, entry] of HOOKS) {
  const code = await bundle(entry);
  parts.push('const ' + name + '_HOOK = ' + JSON.stringify(code) + ';');
}
parts.push('');
parts.push('export { ' + HOOKS.map(([n]) => n + '_HOOK').join(', ') + ' };');
parts.push('');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, parts.join('\n'), 'utf8');
console.log('[build-hooks] 生成 ' + path.relative(ROOT, OUT) + '（' + HOOKS.length + ' 个 hook）');

// ========== 覆盖层模板（HTML/CSS 外置 → TS 字符串）==========
const TPL_DIR = path.join(ROOT, 'src', 'overlay', 'template');
const TPL_OUT = path.join(ROOT, 'src', 'overlay', 'template.generated.ts');
const html = fs.readFileSync(path.join(TPL_DIR, 'overlay.html'), 'utf8');
const css = fs.readFileSync(path.join(TPL_DIR, 'overlay.css'), 'utf8');
const tpl = [
  '// 本文件由 scripts/build-hooks.mjs 自动生成，请勿手动编辑。',
  '// 真源：src/overlay/template/overlay.html 与 overlay.css',
  'const OVERLAY_HTML: string = ' + JSON.stringify(html) + ';',
  'const OVERLAY_CSS: string = ' + JSON.stringify(css) + ';',
  'export { OVERLAY_HTML, OVERLAY_CSS };',
  '',
].join('\n');
fs.writeFileSync(TPL_OUT, tpl, 'utf8');
console.log('[build-hooks] 生成 ' + path.relative(ROOT, TPL_OUT));
