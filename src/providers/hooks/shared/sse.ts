/**
 * SSE 帧解码（hook 共享）
 *
 * 本模块被 esbuild 打包进各平台 hook 的自包含 IIFE 源码（注入 AI 网页主世界执行）。
 * 不得依赖任何运行时模块，只能引用同 bundle 内容。
 */

/** 创建 SSE 帧解码器：按空行切帧（\n\n 或 \r\n\r\n） */
function createFrameDecoder() {
  var buffer = '', scanFrom = 0;
  return {
    push: function (text: string) {
      buffer += text;
      var frames: string[] = [], re = /\r?\n\r?\n/g, offset = 0, m;
      re.lastIndex = scanFrom;
      while ((m = re.exec(buffer)) !== null) {
        frames.push(buffer.slice(offset, m.index));
        offset = m.index + m[0].length;
      }
      buffer = buffer.slice(offset);
      scanFrom = Math.max(0, buffer.length - 3);
      return frames;
    },
    finish: function () {
      var frames: string[] = [];
      if (buffer) frames.push(buffer);
      buffer = ''; scanFrom = 0;
      return frames;
    }
  };
}

/** 提取 SSE 块的 data: 行内容（多行以 \n 拼接），无则 null */
function extractData(block: string) {
  if (!block || !block.trim()) return null;
  var data: string | null = null;
  var lines = block.split(/\r\n|\r|\n/);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.indexOf('data:') === 0) {
      var d = line.slice(5).trim();
      data = data == null ? d : data + '\n' + d;
    }
  }
  return data;
}

/** 提取并 JSON.parse（deepseek/claude 用），失败返回 null */
function parseBlock(block: string) {
  var data = extractData(block);
  if (data == null) return null;
  try { return JSON.parse(data); } catch (e) { return null; }
}

export { createFrameDecoder, extractData, parseBlock };
