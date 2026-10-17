# dsh-edit-file-workspace

给 DeepSeek Harness（DSH）加一张设置卡：把**已有的历史会话**改到另一个工作区，或从工作区里移出。

> 关键点：改归属之后，会话的**标题和时间保持不变**。这不是天然的 —— 见下面的「为什么需要这个插件」。

## 为什么需要它

DSH 的会话归属不是一张可编辑的表，而是由**日志头里的 `cwd`** 推导出来的：

- 工作区成员 = `realpath(会话头.cwd) === 工作区.path`（`ctx.workspaceRegistry` 每次读都按这条规则过滤）；
- 会话日志按 `cwd` 落在 `<DSH_HOME>/sessions/<编码后的 cwd>/<sessionId>/session[.vN].jsonl.zstd`；
- 会话列表里的**标题**和**时间**都来自投影缓存 `ctx.sessionProjectionCache`，而该缓存把每条记录绑定到一个「生命周期身份」：`formatVersion + createdAt + cwd + isSeeded + 继承事件数`。

所以「换工作区」= **迁移日志目录 + 改写头行 `cwd`**。一旦 `cwd` 变了：

- 缓存身份不匹配 → 列表读不到 `title` 投影（标题变空/未命名）；
- 也读不到 `sessionListMetadata.lastPromptAt` → 时间退化成 `createdAt`（看起来「丢了时间」「时间是错的」）；
- 打开会话后才恢复正常 —— 因为打开走的是实时投影，不读缓存。

**这个插件做的事情就是把这最后一步补上**：迁移完成后，按新身份重新折一遍投影并写回缓存。

## 安装

### A. 从本地仓库（开发用，可热改）

```powershell
cd "$env:DSH_HOME\profiles\desktop"
pnpm add "dsh-edit-file-workspace@link:D:/Program/DSH-Plugin-Class/dsh-edit-file-workspace"
# 再把 "dsh-edit-file-workspace" 加进该 profile package.json 的 dsh.profile.bundles
```

`link:` 跨盘时 pnpm 可能生成无效联接（重启后所有本地插件都不加载）。稳妥做法是先建目录联接：

```powershell
cmd /c mklink /J "%USERPROFILE%\.dsh\dsh-edit-file-workspace-plugin" "D:\Program\DSH-Plugin-Class\dsh-edit-file-workspace"
# 然后把依赖写成 link:C:/Users/<你>/.dsh/dsh-edit-file-workspace-plugin
```

### B. 从 npm

```powershell
cd "$env:DSH_HOME\profiles\desktop"
pnpm add dsh-edit-file-workspace
```

插件行由包自带的 `cordis.patch.yml` 自动插入，**不需要手写**。

装完重启 DSH。

## 使用

设置 → **会话工作区附属**：

- 列表按标题排序，可按标题 / 会话 ID / 路径筛选；
- 每行右侧的下拉框选择目标工作区 → 立即迁移；
- 「未分组」= 移出所有工作区（`cwd` 不变，只是从工作区记录里摘掉，重启后仍然有效）；
- **正在使用的会话不能移动**（会拒绝），请先关闭或归档该会话。

迁移成功后：设置卡列表刷新，侧栏会话列表也会重新拉一次基线（不需要整页刷新）。

## 接口

宿主半边在 loopback 上提供三个路由（都要求回环地址 + 同源）：

| 路由 | 方法 | 说明 |
| --- | --- | --- |
| `/api/dsh-edit-file-workspace/describe` | GET/POST | 工作区 + 会话清单（`{ ok, value: { workspaces, sessions } }`） |
| `/api/dsh-edit-file-workspace/move` | POST | `{ sessionId, workspaceId \| path }` → 迁移并返回新的清单；`value.move.projection` 报告缓存重建结果 |
| `/api/dsh-edit-file-workspace/selftest` | GET/POST | 只读体检：存储层形状、标题/时间缓存绑定情况、服务在位情况 |

```powershell
curl.exe -s -X POST http://127.0.0.1:<端口>/api/dsh-edit-file-workspace/selftest
```

端口是该 DSH 进程监听的 loopback 端口（`Get-NetTCPConnection -State Listen` 里 OwningProcess 属于 DSH 的那个）。

## 行为与边界

- **只迁移冷会话**：日志目录整体 `rename`，因此同目录的兄弟文件（各格式代际日志、后端的 `session.lock`）一起搬走；
- **只改头行**：改写的是 zstd 帧里的第一行 JSON，帧内其余内容与后续帧**逐字节保留**（`scripts/verify-log-rewrite.mjs` 用真实日志验证过：6.6 MB / 9678 帧 / 23209 行全部保持不变）；
- **所有格式代际都改**：没被重新打开过的会话可能还在旧代际（`session.jsonl.zstd`），目录里也可能有多代；逐个改，避免以后迁移时把 `cwd` 改回去；
- **先挂新工作区，再摘旧工作区**：第二步失败时，会话仍在旧工作区可见，而不是两边都没有；
- 目标目录必须真实存在（工作区记录指向的目录被删掉时会明确报错）。

## 兼容性

| DSH 桌面 | 宿主 `@deepseek-ai/dsh-*` | 状态 |
| --- | --- | --- |
| 0.2.0-rc.2 | 0.2.0-rc.2 | ✅ 已实测（本机） |
| 0.2.1-rc.2 | 0.2.1-rc.2 | ✅ 契约逐文件比对无变化 |

```powershell
node scripts/check-dsh-version.mjs      # 退出码 0=无需改动 2=只需放宽范围 3=契约变了要人工评估
```

机制、指纹清单与升级流程见 [`docs/dsh-compat.md`](docs/dsh-compat.md)。

## 排障

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 设置卡显示「插件服务不可用」 | 宿主半边没加载（DSH 重启前 / 插件未进 `dsh.profile.bundles`） | 确认 profile 的 bundles 里有本插件，重启 DSH |
| 移动后标题为空、时间退回创建时间 | 投影缓存没能按新身份重建 | `/selftest` 看 `projectionUnbound`；打开该会话一次即恢复 |
| 「该会话正在使用中」 | 会话仍挂在当前进程 | 关闭/归档该会话后重试 |
| 移动整页刷新 | 客户端拿不到 `sessions` 服务，退回整页刷新 | 正常兜底，不影响结果 |

## 开发

```powershell
pnpm install
pnpm typecheck     # 仅宿主半边（tsconfig.host.json）
pnpm test          # 单测：日志帧改写、persistence 形状、投影缓存重建
pnpm build         # lib/index.js（宿主）+ lib/client.js（浏览器）
pnpm check         # typecheck + test + build
```

真实日志校验（会把日志复制到 `.tmp-verify/`，不动原文件）：

```powershell
node --experimental-strip-types scripts/verify-log-rewrite.mjs "$env:USERPROFILE\.dsh\sessions\<项目>\<session-id>\session.v4.jsonl.zstd"
```

发布流程见 [`docs/release.md`](docs/release.md)。

## 许可

MIT
