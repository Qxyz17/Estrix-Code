/**
 * 统一的工具执行结果
 */
class ToolResult {
  success: boolean;
  data: any;
  error: any;

  constructor(success: boolean, data: any, error: any) {
    this.success = success;
    this.data = data;
    this.error = error;
  }

  static success(data: any): ToolResult {
    return new ToolResult(true, data, null);
  }

  static error(error: any): ToolResult {
    return new ToolResult(false, null, error);
  }

  toString(): string {
    return this.success
      ? '✅ 成功: ' + JSON.stringify(this.data)
      : '❌ 失败: ' + this.error;
  }
}

export { ToolResult };
