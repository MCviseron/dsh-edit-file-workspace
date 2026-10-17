# 待补发版本

## v0.3.0 — 已就绪，尚未发布到 npm

| 项 | 状态 |
| --- | --- |
| 代码 / 构建 / 测试 | ✅ `pnpm check` 通过（typecheck + 2 组单测 + build） |
| git 提交 | ✅ `main`（提交信息见仓库历史） |
| 兼容性检查 | ✅ `node scripts/check-dsh-version.mjs` → `compatible`（0） |
| npm 包名 | ✅ `dsh-edit-file-workspace` 未被占用（registry 404） |
| 打 tag / 推送 tag | ❌ **刻意未做** |
| npm 发布 | ❌ 未发布 |

### 原因

npm 账号 `mcviseron` 处于 **72 小时冻结期**（用恢复码登录触发安全停用），
发布请求会被拒绝。冻结期内**故意不打 tag、不推送 tag**：
tag 会触发 `.github/workflows/publish.yml`，每次都失败，还会污染 release 历史。

### 解冻后怎么做（二选一）

**A. 走 CI（推荐，配好 trusted publisher 之后）**

```powershell
cd D:\Program\DSH-Plugin-Class\dsh-edit-file-workspace
git pull
git tag -a v0.3.0 -m "dsh-edit-file-workspace 0.3.0"
git push origin main v0.3.0
```

前提：npmjs.com → 该包 → Settings → Trusted Publisher 已按 `docs/release.md` 填好
（仓库 `MCviseron/dsh-edit-file-workspace`、workflow `publish.yml`、允许发布 + 允许 dist-tag）。

**B. 手工发布（首次发布只能这样，因为包还不存在，无法先配 trusted publisher）**

首次发布必须先手工把包创建出来：

```powershell
npm login --registry=https://registry.npmjs.org
npm publish --access public --registry=https://registry.npmjs.org --otp=<6 位动态码>
```

- 不带 `--otp` 会被「staged publishing」挡住：只会生成 `0.0.0-stage` 占位版，真实 tarball 404；
- 若已进入暂存，用 `npx --yes npm@12 stage list` / `stage approve <stage-id>` 批准；
- 发布成功后立刻触发国内镜像同步：
  `curl.exe -X PUT "https://registry.npmmirror.com/-/package/dsh-edit-file-workspace/syncs"`；
- 然后再去配 trusted publisher，之后按 A 走。

### 发布后要做的收尾

1. `npm view dsh-edit-file-workspace version dist.tarball --registry=https://registry.npmjs.org` 应为 `0.3.0`；
2. `curl.exe -sI https://registry.npmjs.org/dsh-edit-file-workspace/-/dsh-edit-file-workspace-0.3.0.tgz` 应为 200；
3. 删掉本文件的这段记录（或把状态改成「已发布 + 时间」）。
