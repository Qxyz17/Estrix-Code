/**
 * Estrix 插件启用状态（~/.estrix/estrix-plugins-state.json）
 * 结构：{ "<id>": { "enabled": boolean } }
 */
import fs from 'node:fs';
import path from 'node:path';
import { getEstrixPluginsStateFile, isValidPluginId } from './paths.js';

function readTable(): Record<string, { enabled: boolean }> {
  try {
    const file = getEstrixPluginsStateFile();
    if (!fs.existsSync(file)) return {};
    let text = fs.readFileSync(file, 'utf-8');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const raw = JSON.parse(text);
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch { return {}; }
}

function writeTable(table: Record<string, { enabled: boolean }>): boolean {
  try {
    const file = getEstrixPluginsStateFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(table, null, 2), 'utf-8');
    return true;
  } catch { return false; }
}

/** 是否已启用（默认关闭） */
function isEstrixPluginEnabled(id: string): boolean {
  const st = readTable()[id];
  return !!(st && typeof st === 'object' && st.enabled === true);
}

/** 设置启用状态 */
function setEstrixPluginEnabled(id: string, enabled: boolean): boolean {
  if (!isValidPluginId(id)) return false;
  const table = readTable();
  table[id] = { enabled: !!enabled };
  return writeTable(table);
}

/** 清除状态 */
function clearEstrixPluginState(id: string): void {
  const table = readTable();
  delete table[id];
  writeTable(table);
}

export { isEstrixPluginEnabled, setEstrixPluginEnabled, clearEstrixPluginState, readTable };
