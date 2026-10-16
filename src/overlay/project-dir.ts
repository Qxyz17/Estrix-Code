/**
 * 项目目录显示与修改功能
 * 由原 preload.js 拆分而来，逻辑保持不变。
 */
import { createRequire } from 'node:module';
import { renderSessions } from './session-list.js';
import { state } from './state.js';
import { hideFirstTimeDialog } from './panel.js';

const require = createRequire(import.meta.url);
const { ipcRenderer } = require('electron');

/**
 * 初始化项目目录区域：默认隐藏、监听目录更新、绑定修改按钮
 */
function initProjectDirSection(): void {
  // 初始化隐藏（如果没有目录）
  updateProjectDirDisplay(null);

  // 监听主进程的目录更新事件
  ipcRenderer.on('project-dir-updated', (_event: any, dirPath: string) => {
    updateProjectDirDisplay(dirPath);
    // 目录更新后刷新会话列表
    renderSessions();
  });

  // 绑定修改按钮事件 - 直接绑定，阻止冒泡和默认行为
  setTimeout(() => {
    const changeBtn = document.getElementById('estrix-btn-change-dir');
    if (changeBtn) {
      changeBtn.addEventListener('click', async (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        // 使用 updateProjectDir 只更新目录映射，不重新发送初始提示
        const result = await (window as any).electronAPI.updateProjectDir();
        if (result && result.success) {
          // 主进程会发送 project-dir-updated 事件更新显示
          console.log('[Estrix Code] 目录已更新');
        } else {
          console.error('修改目录失败:', result?.message);
        }
      });
    }
  }, 100);
}

/**
 * 更新项目目录显示
 * @param dirPath - 目录路径
 */
function updateProjectDirDisplay(dirPath: string | null): void {
  state.currentProjectDir = dirPath || null;
  const display = document.getElementById('estrix-project-dir-display');
  const section = document.querySelector('.estrix-project-dir-section') as HTMLElement | null;
  if (display) {
    const span = display.querySelector('.estrix-dir-path');
    if (span) {
      span.textContent = dirPath || '未选择';
    }
  }
  // 控制整个section的显示隐藏
  if (section) {
    if (dirPath && dirPath.trim() !== '') {
      section.style.display = '';
      // 已初始化项目，隐藏首次使用提示浮窗
      hideFirstTimeDialog();
    } else {
      section.style.display = 'none';
    }
  }
}

export { initProjectDirSection, updateProjectDirDisplay };
