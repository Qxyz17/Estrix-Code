/**
 * 窗口组管理（多账号限流轮换）
 *
 * 独立文件 userData/window-groups.json：
 * {
 *   "groups": [
 *     { "id", "name", "windowIds": [...], "lastWindowId", "lastSessionId" }
 *   ]
 * }
 *
 * 约定：
 *  - 一个窗口只属于一个组（windowIds 全局唯一）
 *  - windowIds 顺序 = 轮换顺序（按添加进组的先后）
 *  - lastWindowId/lastSessionId：最后一次继续的窗口与对话（便于定位最新进展）
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { app } = require("electron");

let GROUPS_FILE: string | null = null;
function getGroupsFile(): string {
  if (!GROUPS_FILE) GROUPS_FILE = path.join(app.getPath("userData"), "window-groups.json");
  return GROUPS_FILE;
}

function readGroups(): any[] {
  try {
    const file = getGroupsFile();
    if (!fs.existsSync(file)) return [];
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    return (data && Array.isArray(data.groups)) ? data.groups : [];
  } catch (_) {
    return [];
  }
}

function writeGroups(groups: any[]): void {
  try {
    fs.mkdirSync(path.dirname(getGroupsFile()), { recursive: true });
    fs.writeFileSync(getGroupsFile(), JSON.stringify({ groups }, null, 2), "utf-8");
  } catch (err: any) {
    console.error("[WindowGroups] 写入失败:", err.message);
  }
}

function genId(): string {
  return "wg-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

/** 列出所有组 */
function listGroups(): any[] {
  return readGroups();
}

/** 新建组（name 可空，默认"窗口组 N"） */
function createGroup(name?: string): any {
  const groups = readGroups();
  const g = {
    id: genId(),
    name: (name && String(name).trim()) || ("窗口组 " + (groups.length + 1)),
    windowIds: [],
    lastWindowId: null,
    lastSessionId: null,
  };
  groups.push(g);
  writeGroups(groups);
  return g;
}

/** 取某窗口所属的组（不在任何组返回 null） */
function getGroupByWindowId(windowId: string): any {
  if (!windowId) return null;
  for (const g of readGroups()) {
    if (Array.isArray(g.windowIds) && g.windowIds.includes(windowId)) return g;
  }
  return null;
}

/** 把窗口加入组（先从原组移除，保证一个窗口只属于一个组） */
function addWindowToGroup(groupId: string, windowId: string): boolean {
  if (!groupId || !windowId) return false;
  const groups = readGroups();
  // 先从其他组移除
  for (const g of groups) {
    if (g.id !== groupId && Array.isArray(g.windowIds)) {
      g.windowIds = g.windowIds.filter((x: string) => x !== windowId);
    }
  }
  const target = groups.find(g => g.id === groupId);
  if (!target) return false;
  if (!Array.isArray(target.windowIds)) target.windowIds = [];
  if (!target.windowIds.includes(windowId)) target.windowIds.push(windowId);
  writeGroups(groups);
  return true;
}

/** 从组移除窗口（组空则删除该组） */
function removeWindowFromGroup(groupId: string, windowId: string): boolean {
  if (!groupId || !windowId) return false;
  let groups = readGroups();
  const target = groups.find(g => g.id === groupId);
  if (!target || !Array.isArray(target.windowIds)) return false;
  target.windowIds = target.windowIds.filter((x: string) => x !== windowId);
  if (target.windowIds.length === 0) {
    groups = groups.filter(g => g.id !== groupId);
  }
  writeGroups(groups);
  return true;
}

/** 重命名组 */
function renameGroup(groupId: string, name: string): boolean {
  if (!groupId || !name || !String(name).trim()) return false;
  const groups = readGroups();
  const target = groups.find(g => g.id === groupId);
  if (!target) return false;
  target.name = String(name).trim();
  writeGroups(groups);
  return true;
}

/** 删除组（不删窗口本身） */
function deleteGroup(groupId: string): boolean {
  if (!groupId) return false;
  const groups = readGroups();
  const next = groups.filter(g => g.id !== groupId);
  if (next.length === groups.length) return false;
  writeGroups(next);
  return true;
}

/**
 * 取组内"下一个窗口"（按添加顺序循环）。
 * @param currentWindowId 当前窗口；为空则取第一个
 */
function getNextWindow(groupId: string, currentWindowId: string): string | null {
  const groups = readGroups();
  const g = groups.find(x => x.id === groupId);
  if (!g || !Array.isArray(g.windowIds) || g.windowIds.length === 0) return null;
  const ids: string[] = g.windowIds;
  if (!currentWindowId) return ids[0];
  const idx = ids.indexOf(currentWindowId);
  if (idx < 0) return ids[0];
  return ids[(idx + 1) % ids.length];
}

/** 记录"最后一次继续"的窗口与对话 */
function setLastContinue(groupId: string, windowId: string, sessionId: string | null): void {
  if (!groupId) return;
  const groups = readGroups();
  const target = groups.find(g => g.id === groupId);
  if (!target) return;
  target.lastWindowId = windowId || null;
  target.lastSessionId = sessionId || null;
  writeGroups(groups);
}

/** 清理已不存在的窗口（删除窗口后调用；组空则删组） */
function pruneWindow(windowId: string): void {
  if (!windowId) return;
  let groups = readGroups();
  let changed = false;
  for (const g of groups) {
    if (Array.isArray(g.windowIds) && g.windowIds.includes(windowId)) {
      g.windowIds = g.windowIds.filter((x: string) => x !== windowId);
      changed = true;
    }
    if (g.lastWindowId === windowId) { g.lastWindowId = null; g.lastSessionId = null; changed = true; }
  }
  groups = groups.filter(g => Array.isArray(g.windowIds) && g.windowIds.length > 0);
  if (changed) writeGroups(groups);
}

export {
  listGroups,
  createGroup,
  getGroupByWindowId,
  addWindowToGroup,
  removeWindowFromGroup,
  renameGroup,
  deleteGroup,
  setLastContinue,
  pruneWindow,
  getNextWindow,
};
