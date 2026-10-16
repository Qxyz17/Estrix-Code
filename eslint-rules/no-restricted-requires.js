/**
 * 自定义 ESLint 规则：限制 CommonJS 的 require() 路径。
 *
 * 背景：项目用 CommonJS（非 ESM），eslint-plugin-import 的规则只识别
 * import 语句，不识别 require()，故自建此规则。
 *
 * 配置格式（options[0]）：
 * {
 *   zones: [{
 *     target: 'tools',                 // 被约束的目录（相对项目根）
 *     from: 'src/main',                // 禁止 target 引用的目录
 *     except: ['mcp-client.js'],       // 豁免的相对路径片段（可空）
 *     reason: 'P4 待解耦',              // 报错信息
 *   }]
 * }
 */
import path from 'node:path';

export default {
  rules: {
    'no-restricted-requires': {
      meta: {
        type: 'problem',
        schema: [{
          type: 'object',
          properties: {
            zones: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  target: { type: 'string' },
                  from: { type: 'string' },
                  except: { type: 'array', items: { type: 'string' } },
                  reason: { type: 'string' },
                },
                required: ['target', 'from'],
              },
            },
          },
        }],
      },
      create(context) {
        const options = context.options[0] || {};
        const zones = options.zones || [];
        // 统一解析为绝对路径（eslint 单文件/全量传参时 filename 形式不一致）
        const rawName = context.filename || context.getFilename();
        const filename = path.resolve(rawName).replace(/\\/g, '/');

        return {
          CallExpression(node) {
            if (!node.callee || node.callee.name !== 'require') return;
            const arg = node.arguments[0];
            if (!arg || arg.type !== 'Literal' || typeof arg.value !== 'string') return;
            const reqPath = arg.value;
            if (!reqPath.startsWith('.')) return;

            // 解析成相对项目根的路径
            const abs = path.resolve(path.dirname(filename), reqPath).replace(/\\/g, '/');
            // 相对项目根的路径
            const root = process.cwd().replace(/\\/g, '/');
            const rel = abs.startsWith(root) ? abs.slice(root.length + 1) : abs;

            for (const z of zones) {
              if (!filename.startsWith(root + '/' + z.target.replace(/\\/g, '/'))) continue;
              if (!rel.startsWith(z.from.replace(/\\/g, '/'))) continue;
              if ((z.except || []).some(e => rel.includes(e))) continue;
              context.report({
                node: arg,
                message: '禁止 {{target}} 引用 {{from}}：{{reqPath}}{{reason}}',
                data: {
                  target: z.target,
                  from: z.from,
                  reqPath,
                  reason: z.reason ? '（' + z.reason + '）' : '',
                },
              });
            }
          },
        };
      },
    },
  },
};
