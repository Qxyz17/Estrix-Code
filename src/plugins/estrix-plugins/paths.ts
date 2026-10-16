/**
 * Estrix 插件（DSH 兼容）的目录约定。
 * 纯 node，无 electron 依赖。
 *
 * 目录：
 *  - 用户根：~/.estrix（ESTRIX_HOME 可覆盖）
 *  - 插件目录：<root>/estrix-plugins/<id>/（每个插件一个 npm 包目录）
 *  - 启用状态：<root>/estrix-plugins-state.json
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PLUGIN_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

function isValidPluginId(id: unknown): id is string {
  return typeof id === 'string' && PLUGIN_ID_RE.test(id);
}

function getUserDir(): string {
  const override = process.env.ESTRIX_HOME;
  return override ? override : path.join(os.homedir(), '.estrix');
}

/** Estrix 插件（DSH 兼容）根目录 */
function getEstrixPluginsDir(): string {
  return path.join(getUserDir(), 'estrix-plugins');
}

/** 某个插件的安装目录 */
function getEstrixPluginDir(id: string): string {
  return path.join(getEstrixPluginsDir(), id);
}

function getEstrixPluginsStateFile(): string {
  return path.join(getUserDir(), 'estrix-plugins-state.json');
}

/** 列出已安装的 Estrix 插件目录（含 package.json 的目录） */
function listEstrixPluginDirs(): string[] {
  const root = getEstrixPluginsDir();
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const dir = path.join(root, ent.name);
    if (fs.existsSync(path.join(dir, 'package.json'))) out.push(dir);
  }
  return out;
}

export {
  isValidPluginId,
  getUserDir,
  getEstrixPluginsDir,
  getEstrixPluginDir,
  getEstrixPluginsStateFile,
  listEstrixPluginDirs,
};
