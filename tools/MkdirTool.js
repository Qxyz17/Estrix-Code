const { Tool, ToolResult } = require('./ToolRegistry');
const fs = require('fs');
const path = require('path');

/**
 * 目录创建工具
 * 创建目录（支持递归创建多级目录）
 */
class MkdirTool extends Tool {
  constructor() {
    super(
      'mkdir',
      '创建目录（默认递归创建多级父目录，已存在不报错）。返回 { message, path }，其中 path 为被创建目录的绝对路径。',
      {
        type: 'object',
        properties: {
          dir_path: { type: 'string', description: '要创建的目录路径（相对于项目目录）' },
          recursive: { type: 'boolean', description: '是否递归创建父目录，默认 true' }
        },
        required: ['dir_path']
      },
      'mkdir(dir_path)'
    );
  }

  getPromptSection() {
    return {
      name: 'tool:mkdir',
      order: 113,
      text: '使用 mkdir 工具创建目录。默认递归创建多级父目录，目录已存在时静默成功。返回 { message, path }，path 为被创建目录的绝对路径。'
    };
  }

  async execute(params) {
    const { dir_path, projectDir, recursive } = params;
    if (!dir_path) {
      return ToolResult.error('缺少参数 dir_path');
    }

    // 解析绝对路径
    let absolutePath = dir_path;
    if (!path.isAbsolute(absolutePath) && projectDir) {
      absolutePath = path.join(projectDir, dir_path);
    } else if (!path.isAbsolute(absolutePath)) {
      absolutePath = path.resolve(dir_path);
    }

    const useRecursive = recursive !== false;

    try {
      // 已存在且是目录 → 直接成功
      try {
        const stat = await fs.promises.stat(absolutePath);
        if (stat.isDirectory()) {
          return ToolResult.success({ message: `目录已存在: ${absolutePath}`, path: absolutePath });
        }
        return ToolResult.error(`路径已存在且不是目录: ${absolutePath}`);
      } catch (_) {
        // 不存在，继续创建
      }

      await fs.promises.mkdir(absolutePath, { recursive: useRecursive });
      return ToolResult.success({ message: `目录已创建: ${absolutePath}`, path: absolutePath });
    } catch (err) {
      return ToolResult.error(`创建目录失败: ${err.message}`);
    }
  }
}

module.exports = { MkdirTool };
