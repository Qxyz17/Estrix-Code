/**
 * 本地 API 服务器配置：存 api-config.json { apiKey, enabled }
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { app } = require('electron');

function getConfigFile(): string { return path.join(app.getPath('userData'), 'api-config.json'); }

function readConfig(): any {
  try {
    const file = getConfigFile();
    if (fs.existsSync(file)) {
      let raw = fs.readFileSync(file, 'utf-8');
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      return JSON.parse(raw);
    }
  } catch (err: any) { console.error('[API] 读取配置失败:', err.message); }
  return { apiKey: '', enabled: true };
}
function writeConfig(config: any): boolean {
  try { fs.writeFileSync(getConfigFile(), JSON.stringify(config, null, 2), 'utf-8'); return true; }
  catch (err: any) { console.error('[API] 写入配置失败:', err.message); return false; }
}
function getApiKey(): string { return readConfig().apiKey || ''; }
function setApiKey(key: string): boolean { const c = readConfig(); c.apiKey = key || ''; return writeConfig(c); }

export { getConfigFile, readConfig, writeConfig, getApiKey, setApiKey };
