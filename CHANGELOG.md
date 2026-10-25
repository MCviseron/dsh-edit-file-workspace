# 变更记录

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.3.0] - 2026-10-17

**主题：修好「移动会话后标题/时间丢失」，并把与 DSH 的兼容性变成可检测的。**

### 修复

- **列表里出现 `sessionId: "undefined"` 的假条目，且任何冷会话都无法移动**（严重）
  `ctx.sessionPersistence.list()` 返回的是快照 `{ header, revision, sizeBytes }`，不是裸 header。
  旧代码直接读 `snapshot.id` / `snapshot.cwd`，于是每个冷会话都被当成同一个 `undefined`，
  `move` 永远以「未找到该会话」失败。
  现在统一经 `src/persistence.ts` 归一化（同时接受快照与裸 header），单条查询优先走 `stat`。
  实测证据：修复前 `/describe` 的冷会话分支只返回一条 `{"sessionId":"undefined","live":false}`。

- **移动会话后标题变成空/工作区名、时间退回创建时间，打开会话才恢复正常**（严重）
  投影缓存把每条记录绑定到生命周期身份 `formatVersion + createdAt + cwd + isSeeded + 继承事件数`。
  迁移改的是 `cwd`，身份失配 → 会话列表拿不到 `title` 与 `sessionListMetadata.lastPromptAt`，
  `updatedAt` 退化成 `createdAt`。列表本身是零 I/O 的缓存读，不会自愈。
  现在迁移后由 `src/projection.ts` 按**新身份**重建缓存：
  先用 `sessionQuery.readSession` 取完整日志、经文档化的 `coldSnapshot` 重新折一遍并写回（最准），
  失败则把旧记录的 rows 重新打上新身份（不读日志），再失败就如实上报，由 UI 提示「打开会话一次即可恢复」。

- **日志头改写有丢事件的风险**
  旧实现假定「第一帧只含头行」，重新压缩时把帧内其余内容丢掉了。
  现在解析出第一帧完整明文，只替换第一行，其余明文原样并入同一帧后再压缩；
  同时校验头行 `id` 与格式版本，写临时文件后原子换入。
  真实日志验证：6.6 MB / 9678 帧 / 23209 行 → 帧数、后续帧字节、行数、可解析性全部保持。
  迁移前先**校验目录内全部代际日志**，任何一份不合法就在重命名前中止；
  重命名后若改写失败，先把已改写的头行改回旧 `cwd`，再回滚目录重命名 —— 不会留下「移动了一半」的会话。

- **没迁移到最新格式代际的会话无法移动**
  `locate()` 给的是当前代际路径，而目录里可能只有旧代际（`session.jsonl.zstd`）。
  现在按目录迁移，并逐个改写目录内所有代际日志的头行。

- **先摘旧工作区、再挂新工作区**：第二步失败会让会话从两边都消失。
  改为先挂后摘，失败时仍留在旧工作区可见。

- **`.dsh-client-store` 版本漂移**：客户端 `createSnapshotStore` 是构建期内联的，与宿主版本无关；
  已在 peer 声明里显式列出各版本区间。

### 新增

- **批量修复「旧版本留下的伤」**：`POST /api/dsh-edit-file-workspace/repair` + 设置卡工具栏按钮。
  0.3.0 之前的版本改 `cwd` 时没有重建投影缓存，这些会话的缓存行身份永远失配 ——
  表现为「未命名 + 创建时间」，且只有逐个打开才会自愈。现在一次请求按各自日志重折并写回，
  **不动机任何日志、不改归属**；实时会话跳过（它们的投影本来就是实时算的）。

  首次在真机（DSH 0.2.1-rc.2）上体检到的现状：83 个会话 / 冷会话 71 / 标题缺失 32 /
  缓存未绑定 18 —— 这批「未绑定」正是旧版本造成的。

### 变更

- 移动成功后不再强制整页刷新：客户端调用 `sessions.refresh()` 重新拉会话列表基线；
  只有拿不到 `sessions` 服务时才退回整页刷新。
- 新增只读体检路由 `GET/POST /api/dsh-edit-file-workspace/selftest`：
  报告存储层形状归一化结果、标题可用数、投影缓存绑定数/未绑定数、相关服务是否在位。
- 新增 `MoveReport`（`projection: bound | folded | retagged | unavailable | failed`），
  设置卡按结果显示绿色或红色提示并说明后果。

### 兼容性

- **DSH 0.2.0-rc.2 → 0.2.1-rc.2：本插件依赖的宿主契约逐文件哈希无变化**
  （`dsh-workspace` 的 `indexHeader`/`attachSession`、`dsh-session-persistence` 的 `list`/`stat`/`locate`、
   `dsh-session-projection-cache` 的 `cachedSnapshot`/`coldSnapshot`/身份函数、`dsh-session-query` 的 `readSession`、
   `dsh-host-webserver` 的 `register` 等；0.2.1 只有内部实现变化）。
- 新增 `scripts/check-dsh-version.mjs`（退出码 0/2/3/1）与 `docs/dsh-compat.json`（11 个契约文件指纹）。
- peer 范围：`^0.2.0-rc.2 || ^0.2.1-rc.2`。
- **0.2.1-rc.3 核对（2026-10-25）**：11 个契约文件与 rc.2 逐字节相同 → 无需改代码；
  `0.2.1-rc.3` 已被 `^0.2.1-rc.2` 这个 peer 段覆盖（semver 实测 `satisfies('0.2.1-rc.3','^0.2.1-rc.2') = true`）。
- **工具修正**：指纹表曾把 `dsh-client-ui-slots` 记为 `lib/client.js`（0.2.x 里只有 `lib/index.js`），
  导致周检误报 `review-required`；已修正并补齐三版指纹。
- **真机验证（2026-10-18）**：DSH 桌面已升级到 `0.2.1-rc.2`，本插件在该版本上实测：
  `selftest` → `listed=83 / normalized=83 / unreadable=0`；`describe` → `83 个会话、0 条 `sessionId:"undefined"``；
  `sessionQuery` / `sessionProjectionCache` / `sessionProjections` 三个服务均在场。

### 工程

- 新增宿主半边类型检查（`tsconfig.host.json`）、两组单测、`pnpm check`。
- 新增 `scripts/verify-log-rewrite.mjs`：拿真实会话日志副本验证头行改写不损坏其余内容。
- 新增 `docs/dsh-compat.md`、`docs/release.md`，补齐 README（中英）、LICENSE、`.gitignore`、`.gitattributes`。

## [0.2.0] - 2026-10-14

- 首个可用版本：设置卡 + `describe` / `move` 两个 loopback 路由，支持「移到工作区」与「移出工作区」。
