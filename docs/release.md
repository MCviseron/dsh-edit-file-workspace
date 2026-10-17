# 发布流程（维护者）

## 版本约定

- `package.json` 的 `version`、git tag `v<version>`、CHANGELOG 顶部条目**三者必须一致**；
- 修 bug → patch，新增能力 → minor，破坏性改动 → major；
- `lib/` 是**构建产物并且提交进仓库**：`link:` 安装的用户不跑构建，DSH 直接加载 `lib/index.js`。

## 发布前检查

```powershell
pnpm check                                              # typecheck + test + build
node scripts/check-dsh-version.mjs                      # 兼容性结论应为 0
git status --short                                      # 工作区干净（lib/ 已重建并提交）
npm pack --dry-run                                      # 确认 tarball 内容
```

`files` 字段只放运行所需内容：`lib`、`src`、`test`、`cordis.patch.yml`、
`README.md`、`README.en.md`、`CHANGELOG.md`、`docs`。

## 发布

`dependencies` 为空、宿主 bundle 自包含，用户装完即用，不需要构建工具链。

```powershell
npm login --registry=https://registry.npmjs.org
npm publish --access public --registry=https://registry.npmjs.org --otp=<6 位动态码>
```

⚠️ 三个必须知道的坑：

1. **必须显式 `--registry=https://registry.npmjs.org`** —— 国内默认 `registry.npmmirror.com` 是只读镜像，不能发布；
2. **npm 现在要求发布时提供 2FA**。不带 `--otp` 时它不会直接发布，而是生成一个
   `0.0.0-stage` 占位版并把真实版本「暂存」待批准（`npm stage approve <stage-id>`，
   需要 npm ≥ 11.6；本地 npm 10.x 没有 `stage` 命令，用
   `npx --yes npm@12 stage list` / `stage approve`）；
3. **不要重复 bump 版本号**来处理发布失败：占位版会占住版本号，重发要换号或先 `unpublish` 占位版。

## CI 自动发布（推荐）

推荐配 npm **trusted publishing（OIDC）**，发布时无需 token 与动态码，并自动带 provenance：

npmjs.com → 该包 → Settings → Trusted Publisher → GitHub Actions：

| 字段 | 值 |
| --- | --- |
| Organization or user | `MCviseron` |
| Repository | `dsh-edit-file-workspace` |
| Workflow filename | `publish.yml` |
| Environment | 留空 |
| 允许 npm 发布 | ✅ 勾选（否则只能暂存） |
| 允许 npm dist-tag | ✅ 勾选（可在 CI 里修正 `latest`） |

之后发版流程：

```powershell
npm version patch          # 改 package.json + 提交 + 打 tag
git push --follow-tags     # tag 触发 CI → check + publish --provenance
```

## 账号冻结 / 403 时

- **发布被拒不重试**：立刻回退 tag（`git tag -d v<x>` + `git push origin :refs/tags/v<x>`），
  避免每次 push 都触发一次失败的 CI；
- 在 `docs/release-pending.md` 记录「版本 / 原因 / 预计可发时间」，冻结结束后先补发这一版；
- 只读操作（`npm view`、`npm pack`）不受影响。

## 国内镜像

发布成功后让 npmmirror 立刻同步：

```powershell
curl.exe -X PUT "https://registry.npmmirror.com/-/package/dsh-edit-file-workspace/syncs"
```

## 本地验证 npm 包（不要污染开发 profile）

开发 profile 里通常是 `link:` 到仓库；`pnpm add` 会覆盖那个联接。建议另开一个临时 profile：

```powershell
$tmp = Join-Path $env:TEMP "dsh-npm-check"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
cd $tmp
pnpm init
pnpm add dsh-edit-file-workspace
node -e "import('dsh-edit-file-workspace').then(m => console.log(Object.keys(m)))"
```

## 变更日志

每个版本都要在 `CHANGELOG.md` 顶部加一节，写清「现象 → 根因 → 修法 → 证据」，
不要只写「修复若干问题」。
