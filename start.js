/**
 * 跨平台启动脚本
 * 1) 编译 TS → out/
 * 2) 启动 Electron（读取 package.json main = out/src/main/index.js）
 * 3) 捕获 stdout/stderr 写入日志文件
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const isWin = process.platform === 'win32';

// ========== 1. 编译 ==========
console.log('[start.js] 编译中（tsc -p tsconfig.build.json）...');
const build = spawnSync('npx', ['tsc', '-p', 'tsconfig.build.json'], {
  shell: true,
  stdio: 'inherit',
  cwd: import.meta.dirname,
});
if (build.status !== 0) {
  console.error('[start.js] 编译失败，退出。');
  process.exit(build.status ?? 1);
}
console.log('[start.js] 编译完成，启动 Electron...');

// ========== 2. 日志目录 ==========
const logDir = path.join(import.meta.dirname, 'wyp', 'log');
fs.mkdirSync(logDir, { recursive: true });

// 清空旧日志
try {
  for (const f of fs.readdirSync(logDir)) {
    if (f.endsWith('.log')) fs.writeFileSync(path.join(logDir, f), '', 'utf-8');
  }
} catch (err) {
  console.warn('[start.js] 清空日志失败:', err.message);
}

const logFile = path.join(logDir, 'electron.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// ========== 3. 启动 Electron ==========
// 远程调试端口（供 Playwright/CDP 连接，仅开发用）。
// 默认 9334；设 ESTRIX_DEBUG_PORT=off（或 0）可关闭。
const envPort = process.env.ESTRIX_DEBUG_PORT;
const debugPort = (envPort === 'off' || envPort === '0') ? '' : (envPort || '9334');
const debugArg = debugPort ? ' --remote-debugging-port=' + debugPort : '';
if (debugPort) console.log('[start.js] 开启远程调试端口: ' + debugPort + '（CDP；ESTRIX_DEBUG_PORT=off 可关）');
// 开关必须在应用路径（.）之前，否则会被当成应用参数
const cmd = isWin ? ('chcp 65001 > nul && electron' + debugArg + ' .') : ('electron' + debugArg + ' .');
const child = spawn(cmd, { shell: true, stdio: ['inherit', 'pipe', 'pipe'] });

child.stdout.pipe(logStream);
child.stderr.pipe(logStream);
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

child.on('close', (code) => {
  logStream.end();
  process.exit(code ?? 0);
});
child.on('error', (err) => {
  console.error('启动失败:', err.message);
  process.exit(1);
});
