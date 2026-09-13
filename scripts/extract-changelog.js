/**
 * 从 CHANGELOG.md 提取指定版本的更新段落。
 * 用法：node scripts/extract-changelog.js <version>
 * 输出到 stdout。
 */
const fs = require('fs');
const path = require('path');

const version = (process.argv[2] || '').replace(/^v/, '').trim();
const file = path.join(__dirname, '..', 'CHANGELOG.md');

if (!version || !fs.existsSync(file)) {
  console.log('（本版暂无详细更新说明）');
  process.exit(0);
}

const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/);
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const startRe = new RegExp('^##\\s*\\[' + escaped + '\\]');
const nextRe = /^##\s*\[/;

let capturing = false;
const out = [];
for (const line of lines) {
  if (startRe.test(line)) { capturing = true; continue; }
  if (capturing && nextRe.test(line)) break;
  if (capturing) out.push(line);
}

console.log(out.join('\n').trim() || '（本版暂无详细更新说明）');
