/**
 * Estrix Code 主进程入口（薄壳）
 * 实现位于 src/main/（参见 src/main/index.js）。
 * 保留此文件以维持 package.json "main" 与既有加载路径不变。
 */

// stdout/stderr 管道断开（EPIPE）时，Node 默认会抛出未捕获异常导致主进程崩溃。
// 常见于通过 start.js 启动后终端关闭、或输出重定向管道被关闭的场景。
// 这里吞掉这类写入错误，避免因日志输出而崩溃。
function ignoreEpipe(stream) {
  if (stream && typeof stream.on === 'function') {
    stream.on('error', (err) => {
      if (err && err.code === 'EPIPE') return;
      // 其他流错误保持原有行为（打印但不至于静默）
      try { process.stderr.write('stream error: ' + (err && err.message) + '\n'); } catch (_) {}
    });
  }
}
ignoreEpipe(process.stdout);
ignoreEpipe(process.stderr);

require('./src/main');
