/**
 * 统一的 User-Agent 处理。
 *
 * 背景：为了让站点不暴露 Electron 标识（如 DeepSeek 会提示隐私风险），
 * 需要把 UA 伪装成普通 Chrome。
 *
 * 关键点：仅调用 webContents.setUserAgent 不够。ChatGPT 前置的 Cloudflare
 * 挑战会检查「所有」网络请求的 User-Agent，初始导航底层 / 预连接 / 挑战编排
 * 等请求仍会带上 Electron 默认 UA（含 "Electron/x.y.z"），被判定为自动化，
 * 挑战永不通过 → 页面停在「请稍候…」的空白页。
 * 因此还需要在 app ready 之前设置 app.userAgentFallback，覆盖整个网络栈。
 */

// 伪装用的 UA（Electron 33 => Chromium 130）
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/**
 * 在 app 就绪前设置全局兜底 UA，覆盖整个网络栈。
 * @param {Electron.App} app
 */
function applyGlobalUserAgent(app) {
  if (!app) return;
  app.userAgentFallback = CHROME_UA;
}

module.exports = { CHROME_UA, applyGlobalUserAgent };
