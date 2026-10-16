// 第三方模块类型声明（无官方 @types 的包）
declare module 'turndown' {
  interface TurndownOptions {
    headingStyle?: string;
    codeBlockStyle?: string;
    [key: string]: any;
  }
  class TurndownService {
    constructor(options?: TurndownOptions);
    use(plugin: any): TurndownService;
    addRule(key: string, rule: any): TurndownService;
    remove(filter: any): TurndownService;
    keep(filter: any): TurndownService;
    turndown(html: string): string;
  }
  export default TurndownService;
}

declare module '@joplin/turndown-plugin-gfm' {
  const gfm: any;
  export { gfm };
}
