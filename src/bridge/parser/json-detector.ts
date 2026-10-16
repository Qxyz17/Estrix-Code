/**
 * JSON 工具调用识别（D11：已废除 JSON 执行模式）
 *
 * 历史上支持 AI 输出 {"toolName":"...","params":{...}} 形式的工具调用。
 * D11 决定只保留 JS（estrix 代码块）一种调用方式。本模块仅保留"识别"能力：
 * 检测到 JSON 工具调用时，由调用方发提示引导 AI 改用 estrix 代码块。
 */

// 匹配 {"toolName": 或 {"tool": （允许前后空白、可带引号）
const JSON_TOOL_CALL_RE = /\{\s*["']?tool(?:Name)?["']?\s*:/;

/**
 * 判断文本是否像 JSON 工具调用（仅识别，不解析）。
 * 用于检测到旧格式时向 AI 发提示，引导其改用 estrix 代码块。
 */
function looksLikeJsonToolCall(text: any): boolean {
  if (!text || typeof text !== 'string') return false;
  return JSON_TOOL_CALL_RE.test(text);
}

export { looksLikeJsonToolCall };
