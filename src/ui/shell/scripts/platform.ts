/**
 * 平台选择模式：隐藏侧边栏 + 项目选择器 + 地址栏导航。
 */
import { api } from './shared.js';

export function setPlatformSelectingMode(selecting: boolean): void {
  const sb = document.getElementById('ck-sidebar');
  if (sb) { if (selecting) sb.classList.add('estrix-hidden'); else sb.classList.remove('estrix-hidden'); }
  const picker = document.getElementById('project-picker');
  if (picker) (picker as any).style.display = selecting ? 'none' : '';
  const toolbar = document.querySelector('.toolbar');
  if (toolbar) toolbar.classList.toggle('ck-toolbar-plain', !!selecting);
}

if (api.onPlatformMode) api.onPlatformMode((d: any) => setPlatformSelectingMode(d && d.selecting));
