/**
 * 应用设置（settings.json）
 * 统一读写用户设置：闲置卸载、安全策略等。
 */
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  idleUnload: { enabled: false, timeoutMin: 10 },
  security: { level: 'default' }, // strict | default | bypass
};

function getSettingsFile() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readSettings() {
  try {
    const file = getSettingsFile();
    if (fs.existsSync(file)) {
      let raw = fs.readFileSync(file, 'utf-8');
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); // 去 BOM
      const parsed = JSON.parse(raw);
      // 深合并默认值
      return {
        ...DEFAULTS,
        ...parsed,
        idleUnload: { ...DEFAULTS.idleUnload, ...(parsed.idleUnload || {}) },
        security: { ...DEFAULTS.security, ...(parsed.security || {}) },
      };
    }
  } catch (err) {
    console.error('[Settings] 读取失败:', err.message);
  }
  return JSON.parse(JSON.stringify(DEFAULTS));
}

function writeSettings(settings) {
  try {
    fs.writeFileSync(getSettingsFile(), JSON.stringify(settings, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[Settings] 写入失败:', err.message);
    return false;
  }
}

module.exports = { getSettingsFile, readSettings, writeSettings, DEFAULTS };
