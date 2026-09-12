/**
 * DOM 监测：代码块语言识别、cmd 命令与工具调用扫描
 * 由原 preload.js 拆分而来，逻辑保持不变。
 */
const { tryParseToolCall } = require('./tool-parser');
const { getProviderByUrl } = require('../../../src/providers');

// ========== DOM 监测：检测 ```cmd 代码块 ==========

/**
 * 从代码块元素中提取语言标记（兼容多种 DeepSeek DOM 结构）
 * 1. pre[data-language] / div[data-language]（旧结构）
 * 2. language-* class（如 language-cmd）
 * 3. .md-code-block > .md-code-block-banner 里的语言 span（新结构，语言为纯文本，如 "estrix"）
 * 注意：不依赖 d813de27 这类 hash class，只依赖语义化 class
 * @param {Element} pre - pre 元素（或其祖先容器）
 * @returns {string} 小写语言标记，找不到返回 ''
 */
function getCodeBlockLanguage(pre) {
  const provider = getProviderByUrl(window.location.href);
  if (provider && typeof provider.getCodeBlockLanguage === 'function') {
    return provider.getCodeBlockLanguage(pre);
  }
  return '';
}

/**
 * 从代码块元素中检测并提取 cmd/powershell/batch 命令
 * 支持多种语言标记方式：data-language 属性、language-* class、md-code-block banner、第一行标记
 * @param {Element} element - 要检测的 DOM 元素
 * @returns {string|null} 提取的命令内容，如果未检测到则返回 null
 */
function detectCmdInCodeBlock(element) {
  // 新 DOM 结构中代码在 pre > span 里，没有 code 元素
  const codeEl = element.tagName === 'CODE' ? element : element.querySelector('code');
  const pre = codeEl
    ? codeEl.closest('pre')
    : (element.tagName === 'PRE' ? element : element.querySelector('pre'));
  if (!pre) return null;
  const contentEl = codeEl || pre;

  // 统一语言识别
  let language = getCodeBlockLanguage(pre);

  // 兜底：代码第一行标记（```cmd 等）
  const text = contentEl.textContent || '';
  const firstLine = text.split('\n')[0].trim();
  if (!language) {
    const langMatch = firstLine.match(/^(```|;;|#|<!--)\s*(cmd|powershell|pwsh|batch|bat|dos)\s*/i);
    if (langMatch) language = langMatch[2].toLowerCase();
  }

  // 判断是否为支持的脚本语言
  const validLangs = ['cmd', 'powershell', 'pwsh', 'batch', 'bat', 'dos'];
  if (!language || !validLangs.includes(language.toLowerCase())) return null;

  // 提取命令内容
  const lines = text.split('\n');
  if (lines[0].match(/^(```|;;|#|<!--)\s*(cmd|powershell|pwsh|batch|bat|dos)/i)) {
    lines.shift();
  }
  if (lines.length > 0 && lines[lines.length - 1].trim() === '```') {
    lines.pop();
  }

  return lines.join('\n').trim() || null;
}

/**
 * 用于记录已检测过的节点，避免重复处理
 */
const detectedSet = new WeakSet();

/**
 * 扫描给定的 DOM 节点列表，提取其中的命令
 * @param {NodeList|Array} nodes - 要扫描的 DOM 节点列表
 * @returns {string[]} 提取到的命令数组
 */
function scanForCommands(nodes) {
  const commands = [];
  for (const node of nodes) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    // 检查节点本身
    if (['PRE', 'CODE', 'DIV'].includes(node.tagName)) {
      if (!detectedSet.has(node)) {
        detectedSet.add(node);
        const cmd = detectCmdInCodeBlock(node);
        if (cmd) commands.push(cmd);
      }
    }

    // 检查子节点
    const codeBlocks = node.querySelectorAll('pre, code');
    for (const block of codeBlocks) {
      if (!detectedSet.has(block)) {
        detectedSet.add(block);
        const cmd = detectCmdInCodeBlock(block);
        if (cmd) commands.push(cmd);
      }
    }
  }
  return commands;
}

/**
 * 扫描工具调用
 * 专门用于检测 AI 回复中的工具调用
 */
function scanForToolCalls(nodes) {
  const toolCalls = [];
  for (const node of nodes) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    // 跳过用户消息区域：用户消息中包含系统提示词的示例 JSON，不应被当作工具调用
    if (isInsideUserMessage(node)) {
      continue;
    }

    // 检查 pre/code 代码块
    if (['PRE', 'CODE'].includes(node.tagName)) {
      if (!detectedSet.has(node)) {
        detectedSet.add(node);
        const text = (node.textContent || node.innerText || '').trim();
        console.log(text);
        if (text.includes('toolName') || text.includes('"tool"') || text.includes('file_write')) {
          const toolCall = tryParseToolCall(text);
          if (toolCall) toolCalls.push(toolCall);
        }
      }
    }

    // 检查子节点中的 pre/code
    const codeBlocks = node.querySelectorAll('pre, code');
    for (const block of codeBlocks) {
      if (!detectedSet.has(block)) {
        detectedSet.add(block);
        const text = (block.textContent || block.innerText || '').trim();
        console.log(text);
        if (text.includes('toolName') || text.includes('"tool"') || text.includes('file_write')) {
          const toolCall = tryParseToolCall(text);
          if (toolCall) toolCalls.push(toolCall);
        }
      }
    }

    // 检查 markdown 渲染后的内容（仅限 AI 回复区域）
    if (node.tagName === 'DIV') {
      const text = (node.textContent || node.innerText || '').trim();
      if (text.includes('toolName') || text.includes('"tool"') || text.includes('file_write')) {
        console.log(text);
        const toolCall = tryParseToolCall(text);
        if (toolCall) toolCalls.push(toolCall);
      }
    }
  }
  return toolCalls;
}

/**
 * 检查节点是否在用户消息区域内
 * 用户消息中包含系统提示词示例 JSON，应被排除
 */
function isInsideUserMessage(node) {
  const provider = getProviderByUrl(window.location.href);
  if (provider && typeof provider.isUserMessage === 'function') {
    return provider.isUserMessage(node);
  }
  return false;
}

module.exports = {
  getCodeBlockLanguage,
  detectCmdInCodeBlock,
  scanForCommands,
  scanForToolCalls,
  isInsideUserMessage,
};
