/**
 * 悬浮球拖动：支持鼠标拖动并持久化位置
 * 由 events.ts 拆分而来（P4.5），逻辑保持不变。
 */
/**
 * 让悬浮球支持鼠标拖动，并持久化位置
 * 拖动超过阈值视为移动，否则视为点击（保留切换面板功能）
 * @param badge 悬浮球元素
 */
function makeFabDraggable(badge: any) {
  const THRESHOLD = 4;
  const POS_KEY = 'estrix-fab-pos';
  let dragging = false;
  let moved = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;

  function applyPos(left: number, top: number) {
    const w = badge.offsetWidth || 48;
    const h = badge.offsetHeight || 48;
    left = Math.max(0, Math.min(left, window.innerWidth - w));
    top = Math.max(0, Math.min(top, window.innerHeight - h));
    badge.style.left = left + 'px';
    badge.style.top = top + 'px';
    badge.style.right = 'auto';
    badge.style.bottom = 'auto';
  }

  // 恢复保存的位置
  try {
    const saved = localStorage.getItem(POS_KEY);
    if (saved) {
      const p = JSON.parse(saved);
      if (typeof p.left === 'number' && typeof p.top === 'number') {
        applyPos(p.left, p.top);
      }
    }
  } catch (_) { /* ignore */ }

  badge.addEventListener('pointerdown', (e: any) => {
    if (e.button !== 0) return;
    const rect = badge.getBoundingClientRect();
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    try { badge.setPointerCapture(e.pointerId); } catch (_) {}
  });

  badge.addEventListener('pointermove', (e: any) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved && Math.abs(dx) + Math.abs(dy) < THRESHOLD) return;
    moved = true;
    applyPos(startLeft + dx, startTop + dy);
  });

  function endDrag(e: any) {
    if (!dragging) return;
    dragging = false;
    try { badge.releasePointerCapture(e.pointerId); } catch (_) {}
    if (moved) {
      try {
        const rect = badge.getBoundingClientRect();
        localStorage.setItem(POS_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
      } catch (_) { /* ignore */ }
    }
  }
  badge.addEventListener('pointerup', endDrag);
  badge.addEventListener('pointercancel', endDrag);

  // 拖动后拦截本次 click，避免误触切换面板（捕获阶段优先执行）
  badge.addEventListener('click', (e: any) => {
    if (moved) {
      e.stopImmediatePropagation();
      e.preventDefault();
      moved = false;
    }
  }, true);

  // 窗口尺寸变化时把悬浮球约束回视口
  window.addEventListener('resize', () => {
    const rect = badge.getBoundingClientRect();
    applyPos(rect.left, rect.top);
  });
}

export { makeFabDraggable };
