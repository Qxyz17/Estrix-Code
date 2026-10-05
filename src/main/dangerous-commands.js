/**
 * 危险命令检测
 * 覆盖 cmd / powershell / bash 的破坏性操作。
 * 匹配到的命令在"默认"策略下需确认，"严格"下所有命令都确认。
 */

// 危险命令正则（覆盖 cmd / pwsh / bash）
const DANGEROUS_CMDS = [
  // ---- 文件删除（递归/强制）----
  /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\b/i,   // rm -rf / rm -fr
  /\brm\s+-r\b/i,                                    // rm -r
  /\bRemove-Item\b.*-Recurse/i,                       // pwsh Remove-Item -Recurse
  /\bRemove-Item\b.*-Force/i,                         // pwsh Remove-Item -Force
  /\bdel\s+\/f/i,                                     // cmd del /f
  /\bdel\s+\/s/i,
  /\brd\s+\/s/i,                                      // cmd rd /s
  /\brmdir\s+\/s/i,
  // ---- 磁盘/分区 ----
  /\bformat\s+/i,
  /\bdiskpart\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bdd\s+of=\/dev\//i,
  // ---- 系统关机/重启 ----
  /\bshutdown\b/i,
  /\bRestart-Computer\b/i,
  /\bStop-Computer\b/i,
  /\breboot\b/i,
  // ---- 进程终止 ----
  /\btaskkill\b/i,
  /\bStop-Process\b/i,
  /\bkill\s+-9\b/i,
  /\bpkill\b/i,
  // ---- 注册表 ----
  /\breg\s+delete\b/i,
  /\bRemove-ItemProperty\b/i,
  // ---- 权限/安全 ----
  /\bchmod\s+-R\s+777\b/i,
  /\bchown\s+-R\b/i,
  /\bcipher\s+\/w/i,
  /\bicacls\b.*\/grant/i,
  // ---- 危险重定向/覆盖 ----
  />\s*\/dev\/(sd|hd|nvme)/i,
  /\bgit\s+push\s+.*--force\b/i,
  /\bgit\s+reset\s+--hard\b/i,
];

// 白名单：常见安全命令（"默认"策略下直接放行，不弹窗）
// 注意：这是"快速放行"优化，命中危险规则仍会确认。
function isDangerous(cmd) {
  if (!cmd || typeof cmd !== 'string') return false;
  return DANGEROUS_CMDS.some((pattern) => pattern.test(cmd.trim()));
}

module.exports = { DANGEROUS_CMDS, isDangerous };
