/**
 * 账号（Profile）管理模块
 * 每个账号对应一个独立的 partition（persist:<平台>__<账号id>），
 * 实现同平台内多账号隔离，以及跨平台隔离——登录态（cookies/session）
 * 由 Electron 自动持久化到 userData 目录，下次打开自动复用。
 * 账号列表 + 上次使用的账号持久化在 userData/profile-list.json。
 */
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

let PROFILE_FILE = null;

function getProfileFile() {
  if (!PROFILE_FILE) {
    PROFILE_FILE = path.join(app.getPath('userData'), 'profile-list.json');
  }
  return PROFILE_FILE;
}

/**
 * 读取存储文件，兼容旧格式（纯数组）与新格式（{ lastActiveProfileId, profiles }）
 */
function readStore() {
  try {
    const file = getProfileFile();
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (Array.isArray(raw)) {
        return { lastActiveProfileId: null, profiles: raw };
      }
      return {
        lastActiveProfileId: raw.lastActiveProfileId || null,
        profiles: Array.isArray(raw.profiles) ? raw.profiles : [],
      };
    }
  } catch (err) {
    console.error('[Profile] 读取账号列表失败:', err.message);
  }
  return { lastActiveProfileId: null, profiles: [] };
}

function writeStore(store) {
  try {
    const file = getProfileFile();
    fs.writeFileSync(file, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Profile] 写入账号列表失败:', err.message);
  }
}

function readProfiles() {
  return readStore().profiles;
}

function writeProfiles(profiles) {
  const store = readStore();
  store.profiles = profiles;
  writeStore(store);
}

/**
 * 生成 partition 名：平台 + 账号，体现归属，避免跨平台/跨账号互通。
 * @param {string} providerId 平台 id，可为空（平台未确定）
 * @param {string} profileId 账号 id
 */
function buildPartition(providerId, profileId) {
  return 'persist:' + (providerId ? providerId + '__' : '') + profileId;
}

/**
 * 创建新账号
 * @param {string} name 显示名称
 * @param {string} providerId 平台 id（默认 deepseek）
 */
function createProfile(name, providerId) {
  const store = readStore();
  const profiles = store.profiles;
  // providerId 为空表示平台未确定，首次打开会显示平台选择页
  const pid = providerId || '';
  const id = 'profile-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const profile = {
    id,
    providerId: pid,
    name: name || ('账号' + (profiles.length + 1)),
    partition: buildPartition(pid, id),
    createdAt: new Date().toISOString(),
  };
  profiles.push(profile);
  store.profiles = profiles;
  store.lastActiveProfileId = id;
  writeStore(store);
  console.log('[Profile] 已创建账号:', profile.id, profile.name, 'provider=' + (pid || '(未确定)'));
  return profile;
}

/**
 * 获取默认账号，若不存在则创建
 */
function getDefaultProfile() {
  const profiles = readProfiles();
  if (profiles.length > 0) return profiles[0];
  return createProfile('默认账号', '');
}

/**
 * 根据 id 获取账号
 */
function getProfileById(id) {
  return readProfiles().find(p => p.id === id) || null;
}

/**
 * 记录"上次使用的账号"
 */
function setLastActiveProfile(id) {
  const store = readStore();
  store.lastActiveProfileId = id || null;
  writeStore(store);
}

/**
 * 获取"上次使用的账号"（若已被删除则返回 null）
 */
function getLastActiveProfile() {
  const store = readStore();
  if (!store.lastActiveProfileId) return null;
  const found = store.profiles.find(p => p.id === store.lastActiveProfileId) || null;
  return found;
}

/**
 * 删除账号
 */
function deleteProfile(id) {
  const store = readStore();
  const idx = store.profiles.findIndex(p => p.id === id);
  if (idx === -1) return false;
  store.profiles.splice(idx, 1);
  if (store.lastActiveProfileId === id) {
    store.lastActiveProfileId = store.profiles.length > 0 ? store.profiles[0].id : null;
  }
  writeStore(store);
  return true;
}

/**
 * 更新账号平台
 */
function updateProfileProvider(id, providerId) {
  const store = readStore();
  const p = store.profiles.find(x => x.id === id);
  if (!p || !providerId) return null;
  p.providerId = providerId;
  p.partition = buildPartition(providerId, id);
  writeStore(store);
  return p;
}

/**
 * 更新账号显示名称
 */
function updateProfileName(id, name) {
  const store = readStore();
  const p = store.profiles.find(x => x.id === id);
  if (!p || !name || !name.trim()) return null;
  p.name = name.trim();
  writeStore(store);
  return p;
}

module.exports = {
  readProfiles,
  writeProfiles,
  createProfile,
  getDefaultProfile,
  getProfileById,
  updateProfileName,
  updateProfileProvider,
  deleteProfile,
  setLastActiveProfile,
  getLastActiveProfile,
};
