/**
 * 本地 API 服务器配置
 * 存 api-config.json：{ apiKey: "...", enabled: true }
 */
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

function getConfigFile() {
  return path.join(app.getPath('userData'), 'api-config.json');
}

function readConfig() {
  try {
    const file = getConfigFile();
    if (fs.existsSync(file)) {
      let raw = fs.readFileSync(file, 'utf-8');
      // 去掉 UTF-8 BOM（PowerShell Set-Content -Encoding utf8 会加）
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('[API] 读取配置失败:', err.message);
  }
  return { apiKey: '', enabled: true };
}

function writeConfig(config) {
  try {
    fs.writeFileSync(getConfigFile(), JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[API] 写入配置失败:', err.message);
    return false;
  }
}

function getApiKey() {
  return readConfig().apiKey || '';
}

function setApiKey(key) {
  const cfg = readConfig();
  cfg.apiKey = key || '';
  return writeConfig(cfg);
}

module.exports = { getConfigFile, readConfig, writeConfig, getApiKey, setApiKey };
