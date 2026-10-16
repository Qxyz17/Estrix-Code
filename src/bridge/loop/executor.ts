/**
 * 工具/JS 脚本执行器（与回复获取方式无关）
 * 拦截模式和 DOM 模式共用的执行逻辑：执行工具调用、执行 JS 脚本、通知 UI。
 */
import { showToast, setTaskStatus, addHistory, truncate, flashBadge } from '../../overlay/panel.js';

// 是否正在执行命令或工具
let isExecuting = false;

/**
 * 通知用户检测到 JS 工具脚本（更新预览 + 闪烁徽章）
 */
function notifyJsScriptDetected(code: string): void {
  const preview = document.getElementById('estrix-cmd-preview');
  if (preview) {
    preview.textContent = '[JS 工具脚本]' + String.fromCharCode(10) + code;
  }
  flashBadge('Estrix Code - JS 工具脚本检测到');
}

/**
 * 执行检测到的 JS 工具脚本
 */
async function handleJsToolScript(code: string): Promise<{ code: string; result: any }> {
  isExecuting = true;
  notifyJsScriptDetected(code);
  setTaskStatus(true);

  const callId = 'js_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  console.log('[Estrix Code] [诊断] 即将执行的代码(JSON转义): ' + JSON.stringify(code));
  try {
    const result = await (window as any).electronAPI.executeJs(code, callId);

    const resultSection = document.getElementById('estrix-result-section');
    const resultStatus = document.getElementById('estrix-result-status');
    const resultOutput = document.getElementById('estrix-result-output');
    if (resultSection) resultSection.classList.remove('estrix-hidden');

    if (result.success) {
      if (resultStatus) {
        resultStatus.textContent = '✅ JS 脚本执行成功';
        resultStatus.className = 'estrix-result-status success';
      }
      if (resultOutput) {
        resultOutput.textContent = result.output || '(脚本执行完成，无输出)';
      }
    } else {
      if (resultStatus) {
        resultStatus.textContent = '❌ JS 脚本执行失败';
        resultStatus.className = 'estrix-result-status error';
      }
      if (resultOutput) {
        resultOutput.textContent = result.error || '未知错误';
      }
    }

    addHistory({
      id: callId,
      command: '[JS] ' + truncate((code.split(String.fromCharCode(10))[0] || code), 60),
      success: result.success,
      output: result.success ? (result.output || '') : (result.error || '未知错误'),
      timestamp: Date.now(),
    });

    return { code, result };
  } catch (err: any) {
    console.error('[Estrix Code] JS 工具脚本执行异常:', err);
    const resultSection = document.getElementById('estrix-result-section');
    const resultStatus = document.getElementById('estrix-result-status');
    const resultOutput = document.getElementById('estrix-result-output');
    if (resultSection) resultSection.classList.remove('estrix-hidden');
    if (resultStatus) {
      resultStatus.textContent = '❌ 系统错误';
      resultStatus.className = 'estrix-result-status error';
    }
    if (resultOutput) {
      resultOutput.textContent = err.message || String(err);
    }
    return { code, result: { success: false, error: '系统异常: ' + (err.message || String(err)) } };
  } finally {
    isExecuting = false;
    setTaskStatus(false);
  }
}

export {
  handleJsToolScript,
  notifyJsScriptDetected,
};

