# DSH 兼容性

本插件只通过一组很窄的宿主接口工作，所以「还兼容吗」是一个**字节问题**而不是版本号问题：
把宿主真实发布的 `lib/` 打包哈希下来，逐文件比对。

## 版本矩阵

| DSH 桌面 | 宿主包版本 | 本插件 | 结论 | 依据 |
| --- | --- | --- | --- | --- |
| 0.2.0-rc.2 | `@deepseek-ai/dsh-*@0.2.0-rc.2` | 0.3.0 | ✅ 实测通过 | 本机真实安装，route + 日志改写 + 缓存身份全部核对 |
| 0.2.1-rc.2 | `@deepseek-ai/dsh-*@0.2.1-rc.2` | 0.3.0 | ✅ 契约无变化 | 11 个契约文件逐个 sha256 比对；`SESSION_FORMAT_VERSION` 仍为 4 |
| 0.1.5-rc.2（CLI） | `@deepseek-ai/dsh-*@0.1.5-rc.2` | 未验证 | ⚠️ 仅供参照 | 投影缓存的 `cachedSnapshot(meta, inheritedEventCount, keys)` 多一个参数，本插件按 0.2.x 的 `cachedSnapshot(meta)` 调用（多传参数无害，但未实测） |

## 依赖的契约面

| 宿主文件 | 本插件用到的符号 | 为什么依赖 |
| --- | --- | --- |
| `dsh-workspace/lib/index.js` | `WorkspaceRegistry.indexHeader`、`WorkspaceEntity.attachSession/detachSession`、`list/get/create/resolveByPath` | 工作区成员判定与写路径 |
| `dsh-session-persistence/lib/index.js` | `list()`、`stat()`、`locate()` | 读取头、定位日志 |
| `dsh-session-persistence-jsonl/lib/index.js` | `locate()` 的路径规则 | 迁移目录名 |
| `dsh-session-projection-cache/lib/index.js` | `cachedSnapshot`、`coldSnapshot`、`recordFor`、`put`、身份函数 | 标题/时间的来源与重建 |
| `dsh-session-query/lib/index.js` | `readSession()` | 取完整日志用于重新折投影 |
| `dsh-api-session-controller/lib/types/list.js` | `updatedAt()`、`projectionsFor()` | 会话列表时间/标题的**呈现口径**（读取，不调用） |
| `dsh-host-webserver/lib/index.js` | `WebRoute{kind,path,handler}`、`register()` | 路由挂载 |
| `dsh-session/lib/index.js` | 会话头字段与 `SESSION_FORMAT_VERSION` | 头行改写必须保真 |
| `dsh-client-store/lib/index.js` | `createSnapshotStore` | 客户端状态容器（**构建期内联**） |
| `dsh-client-ui-slots/lib/client.js` | `slots.register/inject` | 设置卡槽位 |
| `dsh-client-locale/lib/client.js` | `locale.register/bind` | 文案 |

## 0.2.0-rc.2 → 0.2.1-rc.2 的实际差异（2026-10-17 核对）

**本插件依赖的接口没有变化**，只有内部实现改动：

| 文件 | 变化 | 对本插件的影响 |
| --- | --- | --- |
| `dsh-workspace` | `indexHeader` 多记一个 `missingSessionPaths`（cwd 解析失败且路径合法时标记）；`sessionIds` getter 由 `sessionPath` 改为 `candidateMatches`；移除 `./invariant` 子路径导出 | 无（不引用）；`indexHeader` 入参/语义不变 |
| `dsh-session-persistence-jsonl` | `list()` 改为并发 stat（`settleLimited`） | 无，返回值形状不变（仍是 `{header, revision, sizeBytes}`） |
| `dsh-session-projection-cache` | 内部重构（`lifecycleIdentityOf` 抽函数、`hydratePrepared` 路径） | 无，`cachedSnapshot(meta)`/`coldSnapshot(meta,cut,events)` 签名与身份字段不变 |
| `dsh-session-query` / `dsh-api-session-controller` | 内部调整 | 无，`readSession()` 返回 `{session, inheritedEventCount, events}` 不变 |
| `dsh-session` | 移除 `./invariant`、`known-event-types`/`surface` 调整 | 无（不引用）；格式版本仍为 **4** |
| `dsh-client-*` | `ui-settings`/`ui-renderer` 内部（偏好持久化、槽位渲染更宽容） | 无 |

> 结论：0.2.1-rc.2 上**不需要改代码**，只需要把 peer 范围与指纹基线补上。

## 指纹机制

`docs/dsh-compat.json` 存的是每个版本下 11 个契约文件的 `sha256` 前 16 位，以及已验证版本列表。

```powershell
node scripts/check-dsh-version.mjs         # 人读报告
node scripts/check-dsh-version.mjs --json  # 机器读
```

流程：

1. 读本机已装版本（`<DSH_HOME>/dsh-runtimes/dsh-primary-runtime/runtime.json`）；
2. 读官方更新源 `https://download.deepseek.com/dsh-desk/feeds/win-x64/<channel>.yml` 的最新版本；
3. 最新版已在 `verifiedVersions` 里 → **compatible（退出码 0）**，不下载任何东西；
4. 否则下载该版本的 npm tarball，逐个比对契约文件：
   - 全部一致 → **widen-ranges（2）**：只放宽 peer 范围 + 记录指纹 + 补丁发版；
   - 有文件变化 → **review-required（3）**：先读 diff，再决定改不改代码；
5. 更新源 / npm / 安装路径读不到 → **check-failed（1）**。

## 升级流程（人工）

```powershell
# 1) 先看兼容性
node scripts/check-dsh-version.mjs

# 2) 按结论处理
#    exit 0 → 什么都不用做
#    exit 2 → 放宽 peer 范围 → node scripts/fingerprint-dsh-compat.mjs <new-version>
#             → 改 package.json 的 peer 范围 → pnpm check → 发补丁版
#    exit 3 → 逐个读变化文件的 diff（尤其是 projection-cache 的身份字段、
#             persistence 的 list/stat 形状、webserver 的 WebRoute 形状），再动代码

# 3) 真机验收（见下）
```

## 真机验收清单（升级 DSH 之后）

1. 重启 DSH，设置里能看到「会话工作区附属」；
2. `curl -s -X POST http://127.0.0.1:<port>/api/dsh-edit-file-workspace/selftest`：
   - `persistence.unreadable == 0`（存储层形状归一化成立）；
   - `sessions.cold > 0` 时 `sessions.titleMissing` 应为 0 或极少；
   - `services.sessionQuery / sessionProjectionCache / sessionProjections` 均为 `true`；
3. `/describe` 里**不应**出现 `sessionId: "undefined"`；
4. 任选一个冷会话移到另一个工作区：
   - 返回 `value.move.projection` 为 `folded` 或 `retagged`；
   - 侧栏里该会话的**标题与时间保持不变**（这是 0.3.0 修的核心问题）；
   - 打开该会话，历史消息完整（证明头行改写没损坏日志）；
5. 再把该会话移回原工作区，确认可重复迁移；
6. `pnpm test` 与 `node --experimental-strip-types scripts/verify-log-rewrite.mjs <某日志>` 均 PASS。

## 定时检测约定

会话内定时任务（官方 `schedule`，每周日 09:00 Asia/Shanghai）执行：

```powershell
git pull
node scripts/check-dsh-version.mjs
```

- `0` → 只报告；
- `2` → 自动放宽 peer、记录指纹、`pnpm check`、打补丁 tag（CI 自动发 npm），并报告；
- `3` → **不改代码**，把变化文件与 diff 摘要汇报给用户后等待决定；
- `1` → 报原因，不动代码。

> 定时任务的固有限制：只在 DSH 运行且本会话可用时投递；停机期间错过的那次不会补发。
