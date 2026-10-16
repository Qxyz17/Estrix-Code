/**
 * 把 monaco-editor 的 min/vs 复制到 src/ui/vendor/monaco/vs
 * （Monaco 体积大，不进 git；由本脚本在 install / 启动 / 编译时补上）
 */
import fs from 'node:fs';
import path from 'node:path';

const root = import.meta.dirname ? path.join(import.meta.dirname, '..') : process.cwd();
const src = path.join(root, 'node_modules', 'monaco-editor', 'min', 'vs');
const dest = path.join(root, 'src', 'ui', 'vendor', 'monaco', 'vs');

if (!fs.existsSync(src)) {
  console.warn('[copy-monaco] 未找到 node_modules/monaco-editor/min/vs，跳过（请先 npm install）');
  process.exit(0);
}
try {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log('[copy-monaco] 已复制 monaco → src/ui/vendor/monaco/vs');
} catch (err) {
  console.error('[copy-monaco] 复制失败:', err.message);
  process.exit(1);
}
