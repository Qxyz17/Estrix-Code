# MCP 配置与使用

> MCP（Model Context Protocol）让 AI 调用**外部工具**——文件系统、数据库、浏览器、第三方服务等。
> Estrix Code 采用 **Claude Desktop 兼容格式**，配置可直接分享 / 导入。

## 一、它是什么

MCP 是一个开放协议：**MCP server** 对外暴露一组工具，**MCP client**（Estrix Code）连接它、把工具交给 AI 调用。

举例：装一个 filesystem server，AI 就能读你指定目录的文件；装一个 mysql server，AI 就能查数据库。

连接后，AI 通过三个工具使用 MCP：

| 工具 | 作用 |
|---|---|
| `mcpListServers()` | 列出所有已配置的 server（含启用/连接状态）|
| `mcpGetTools(server)` | 查看某 server 提供的工具与参数 |
| `mcpCall(server, tool, args)` | 调用某个工具 |

> AI 会**先查列表 → 再看工具 → 再调用**（提示词里已引导）。

## 二、配置文件位置

| 作用域 | 配置路径 | 说明 |
|---|---|---|
| **项目级** | `<项目根>/.estrix/mcp.json` | 随仓库走，团队共享 |
| **用户级** | `~/.estrix/mcp.json` | 所有项目通用 |
| **插件级** | 插件目录的 `mcp.json` | 随插件安装（需授权），命名带 `<插件id>:` 前缀 |

- **同名时优先级：项目级 > 用户级 > 插件级**
- 启用状态**单独存**（不污染主配置）：`mcp-state.json`（同级目录）
- 首次启动会把旧的 `userData/mcp.json` **自动迁移**到 `~/.estrix/mcp.json`（旧文件保留）

## 三、配置格式

Claude Desktop 兼容：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:/my-project"]
    },
    "remote-db": {
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer xxx" }
    }
  }
}
```

### 两种类型

| 类型 | 判别 | 字段 |
|---|---|---|
| **stdio** | 有 `command` | `command`（必填）、`args`、`env`、`cwd` |
| **http** | 有 `url` | `url`（必填）、`headers` |

### 字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `command` | string | stdio：启动命令（如 `npx`、`node`、`python`）|
| `args` | string[] | stdio：命令参数 |
| `env` | object | stdio：额外环境变量 |
| `cwd` | string | stdio：工作目录 |
| `url` | string | http：server 地址 |
| `headers` | object | http：请求头（如鉴权）|

## 四、常见示例

### 文件系统（stdio）

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:/my-project"]
    }
  }
}
```

### 远程 HTTP server

```json
{
  "mcpServers": {
    "my-service": {
      "url": "https://mcp.example.com/sse",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

### 带环境变量（如数据库连接）

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-mysql"],
      "env": { "MYSQL_URL": "mysql://user:pass@localhost:3306/db" }
    }
  }
}
```

## 五、启用 / 禁用

启用状态存在同级的 `mcp-state.json`：

```json
{ "filesystem": false }
```

- **默认启用**（没记录的 = 启用）
- 设为 `false` 则禁用（不连接、不暴露给 AI）
- 在侧栏「MCP」页可视化开关

## 六、在 UI 里管理

侧栏「**MCP**」页：

- 列出所有 server（名称 / 类型 / 来源 / 连接状态）
- **启用 / 禁用**开关
- **编辑 JSON**（用户级配置）
- 查看工具列表

## 七、安全提示

- **stdio 会 spawn 子进程**——等于在本机运行第三方代码，请**只装可信 server**
- **http 的 headers** 可能含密钥，注意不要提交到仓库（项目级 `mcp.json` 若含密钥，建议放用户级或加 `.gitignore`）
- **插件来源的 MCP** 需**显式授权**才会加载（可执行内容默认不落盘）

## 八、排错

| 现象 | 排查 |
|---|---|
| server 连不上 | 检查 `command` 是否在 PATH、`args` 是否正确；stdio 首次可能需下载（npx）|
| 工具列表为空 | 调 `mcpGetTools(server)` 看是否报错；server 可能启动失败 |
| 同名冲突 | 项目级会覆盖用户级；检查两处是否同名 |
| 改了配置没生效 | 重新初始化项目 / 重启窗口 |
