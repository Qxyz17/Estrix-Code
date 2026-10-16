/**
 * Gitee 地址构造与校验（纯 node，零依赖）
 *
 * 与 github.ts 平行：Gitee 的下载/raw 通道格式不同，且分支名可含中文。
 * 仓库以 "gitee:owner/repo" 前缀标识来源（见 installer/market 的解析）。
 */

/** Gitee 用户名：字母数字开头，允许 . _ - */
const OWNER_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** 仓库名校验：允许字母数字与 . _ - */
const REPO_NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;

/** Gitee 站点与 API 基址 */
const GITEE_BASE = 'https://gitee.com';
const GITEE_API = 'https://gitee.com/api/v5';

/** 来源前缀 */
const GITEE_PREFIX = 'gitee:';

/** 是否 Gitee 来源（"gitee:owner/repo"） */
function isGiteeRepo(repo: unknown): boolean {
  return typeof repo === 'string' && repo.startsWith(GITEE_PREFIX);
}

/** 去掉来源前缀，返回纯 "owner/repo" */
function stripGiteePrefix(repo: string): string {
  return repo.startsWith(GITEE_PREFIX) ? repo.slice(GITEE_PREFIX.length) : repo;
}

/** 给纯 owner/repo 加 Gitee 前缀 */
function withGiteePrefix(repo: string): string {
  return repo.startsWith(GITEE_PREFIX) ? repo : GITEE_PREFIX + repo;
}

/** owner/repo 校验（Gitee 规则） */
function isValidGiteeRepo(repo: unknown): boolean {
  if (typeof repo !== 'string') return false;
  const parts = repo.split('/');
  if (parts.length !== 2) return false;
  const [owner, name] = parts;
  if (!OWNER_RE.test(owner)) return false;
  if (name === '.' || name === '..') return false;
  return REPO_NAME_RE.test(name);
}

/**
 * Gitee 分支名校验：允许中文等，但排除路径分隔符、.. 与控制字符。
 * （Gitee 默认分支可为中文，如 "稳定喵"，故不能沿用 GitHub 的 ASCII 限制。）
 */
function isValidGiteeBranch(branch: unknown): boolean {
  if (typeof branch !== 'string') return false;
  const b = branch.trim();
  if (!b || b.length > 200) return false;
  if (b.includes('/') || b.includes('\\') || b.includes('..')) return false;
  if (/\s/.test(b)) return false;
  for (let i = 0; i < b.length; i++) {
    if (b.charCodeAt(i) < 32) return false;
  }
  return true;
}

/** Gitee 归档下载地址（tar.gz，匿名可下） */
function buildGiteeArchiveUrl(repo: string, branch: string): string {
  return GITEE_BASE + '/' + repo + '/repository/archive/' + encodeURIComponent(branch) + '.tar.gz';
}

/** Gitee raw 文件地址（读远端 plugin.json 用） */
function buildGiteeRawUrl(repo: string, branch: string, file: string): string {
  return GITEE_BASE + '/' + repo + '/raw/' + encodeURIComponent(branch) + '/' + file;
}

/** Gitee 搜索 API 地址（需 token；无 token 时 Gitee 返回空） */
function buildGiteeSearchUrl(keyword: string, token?: string): string {
  const q = encodeURIComponent(keyword);
  let url = GITEE_API + '/search/repositories?q=' + q + '&per_page=100';
  if (token) url += '&access_token=' + encodeURIComponent(token);
  return url;
}

/** Gitee 用户仓库列表地址（匿名可读） */
function buildGiteeUserReposUrl(user: string): string {
  return GITEE_API + '/users/' + encodeURIComponent(user) + '/repos?per_page=100';
}

export {
  OWNER_RE,
  REPO_NAME_RE,
  GITEE_BASE,
  GITEE_API,
  GITEE_PREFIX,
  isGiteeRepo,
  stripGiteePrefix,
  withGiteePrefix,
  isValidGiteeRepo,
  isValidGiteeBranch,
  buildGiteeArchiveUrl,
  buildGiteeRawUrl,
  buildGiteeSearchUrl,
  buildGiteeUserReposUrl,
};
