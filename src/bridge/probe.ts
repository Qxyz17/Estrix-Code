/**
 * 窗口组探测：主进程把本窗口导航到 "首页?estrix-probe=1" 时，
 * 自动发一条测试消息，判断该账号是否被限流，并把结果上报主进程。
 *
 * 判定复用"限流检测"逻辑：
 *  - onAiError + reason=rate_limit / httpStatus=429 → limited（被限流）
 *  - onInterceptedResponse（完整回复）→ ok（正常）
 *  - 超时 → timeout
 */
import { createRequire } from "node:module";
import { sendToChat } from "../overlay/chat-input.js";
import { onAiError, onInterceptedResponse } from "./intercept/observer.js";

const require = createRequire(import.meta.url);
const { ipcRenderer } = require("electron");

const PROBE_FLAG = "estrix-probe";
const PROBE_TIMEOUT = 60000;

/** 若 URL 带探测标记，进入探测模式（幂等，只在探测页触发） */
export function initProbeIfNeeded(): boolean {
  let flag = "";
  try { flag = new URL(location.href).searchParams.get(PROBE_FLAG) || ""; } catch (_) { /* ignore */ }
  if (!flag) return false;
  console.log("[Estrix Probe] 进入探测模式");

  let done = false;
  const finish = (result: string) => {
    if (done) return;
    done = true;
    try { ipcRenderer.invoke("probe-result", { result }).catch(() => {}); } catch (_) { /* ignore */ }
    console.log("[Estrix Probe] 探测结果: " + result);
  };

  // 限流 → limited
  onAiError((detail: any) => {
    const isRL = detail && (detail.httpStatus === 429 || detail.reason === "rate_limit");
    if (isRL) finish("limited");
  });
  // 完整回复 → ok
  onInterceptedResponse(() => { finish("ok"); });
  // 超时兜底
  setTimeout(() => finish("timeout"), PROBE_TIMEOUT);

  // 等输入框就绪后发测试消息
  setTimeout(() => {
    try { sendToChat("你好", "探测", 300).catch(() => {}); } catch (_) { /* ignore */ }
  }, 2500);

  return true;
}
