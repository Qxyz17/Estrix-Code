/**
 * Estrix Code 自定义 Provider 接口定义
 * 用户编写自定义平台 Provider 时，可参考本文件获得类型提示。
 *
 * 使用方式（在用户 JS 文件顶部）：
 *   /** @type {import('./custom/provider.d.ts').Provider} */
 *   module.exports = { ... }
 */

/**
 * 输入框元素
 */
interface InputElement {
  tagName?: string;
  isContentEditable?: boolean;
  disabled?: boolean;
  focus?: () => void;
  click?: () => void;
}

/**
 * 平台 Provider 接口
 */
export interface Provider {
  /** 平台唯一标识，如 'my-platform' */
  id: string;
  /** 显示名称 */
  name: string;
  /** 首页地址 */
  homeUrl: string;
  /** 会话 URL 前缀 */
  sessionUrlBase: string;

  /** 输入框查找选择器（按优先级排序） */
  inputSelectors?: string[];
  /** 发送按钮查找选择器 */
  sendButtonSelectors?: string[];
  /** 用户信息选择器 */
  userInfoSelector?: string;
  /** 首页判断正则 */
  homeUrlPattern?: RegExp;
  /** 输入框关键词兜底 */
  inputKeywords?: string[];

  /** 从 URL 提取会话 ID */
  extractSessionId(url: string): string | null;
  /** 判断 URL 是否属于本平台 */
  matchesUrl(url: string): boolean;

  /** 判断 AI 是否已完成回复 */
  isResponseComplete(): boolean | Promise<boolean>;
  /** 获取当前页面所有 AI 消息容器（排除用户消息） */
  getMessageCandidates(): Element[];
  /** 从消息容器中取回复内容根节点 */
  getMessageMarkdown(messageEl: Element): Element | null;
  /** 判断节点是否位于用户消息区域内 */
  isUserMessage(node: Element): boolean;
  /** 提取代码块的语言标记 */
  getCodeBlockLanguage(pre: Element): string;

  /** 返回自定义提示词模板（优先级最高；返回空则回退到文件模板） */
  getPromptTemplate?(): string;

  /** 查找可见输入框（可选实现） */
  findInput?(): InputElement | null;
  /** 查找发送按钮（可选实现） */
  findSendButton?(): InputElement | null;
  /** 提取用户信息文本（可选实现） */
  extractUserInfo?(): string;
  /** 判断元素可见（可选实现） */
  isElementVisible?(el: Element): boolean;
}
