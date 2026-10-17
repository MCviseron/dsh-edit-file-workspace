# dsh-edit-file-workspace

A settings card for DeepSeek Harness (DSH): reassign an **existing stored conversation** to another workspace, or take it out of every workspace.

> The important part: after the move the session keeps its **title and timestamp**. That is not free — see *Why this plugin exists*.

## Why this plugin exists

Workspace membership in DSH is not an editable table; it is derived from `cwd` in the session log header:

- membership = `realpath(header.cwd) === workspace.path` (filtered by `ctx.workspaceRegistry` on every read);
- the log lives at `<DSH_HOME>/sessions/<encoded cwd>/<sessionId>/session[.vN].jsonl.zstd`;
- the **title** and the **time** in the session list come from `ctx.sessionProjectionCache`, whose every record is bound to a lifecycle identity: `formatVersion + createdAt + cwd + isSeeded + inheritedEventCount`.

So "change the workspace" means **move the log directory and rewrite the header's `cwd`**. Once `cwd` changes:

- the cache identity no longer matches → the `title` projection is gone (blank / "Untitled" row);
- `sessionListMetadata.lastPromptAt` is gone too → `updatedAt` falls back to `createdAt` (looks like a lost or wrong timestamp);
- opening the session fixes it, because opening folds live projections instead of reading the cache.

This plugin closes that loop: after the move it re-folds the projections under the new identity and writes them back.

## Install

### A. From a local clone (development)

```powershell
cd "$env:DSH_HOME\profiles\desktop"
pnpm add "dsh-edit-file-workspace@link:D:/path/to/dsh-edit-file-workspace"
# then add "dsh-edit-file-workspace" to dsh.profile.bundles in that profile's package.json
```

A cross-drive `link:` can produce an invalid junction (after a restart *no* local plugin loads). Prefer a real junction first:

```powershell
cmd /c mklink /J "%USERPROFILE%\.dsh\dsh-edit-file-workspace-plugin" "D:\path\to\dsh-edit-file-workspace"
# then depend on link:C:/Users/<you>/.dsh/dsh-edit-file-workspace-plugin
```

### B. From npm

```powershell
cd "$env:DSH_HOME\profiles\desktop"
pnpm add dsh-edit-file-workspace
```

The plugin row is inserted by the package's own `cordis.patch.yml`; nothing to hand-write. Restart DSH afterwards.

## Usage

Settings → **Session Workspace Affiliation**:

- filter by title / session id / path;
- pick a target workspace in the row's dropdown → the move happens immediately;
- *Ungrouped* removes the session from every workspace without touching `cwd` (it survives a restart);
- **a live session cannot be moved** — close or archive it first.

After a successful move the card refreshes and the DSH session list re-pulls its baseline (no page reload).

## Routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/dsh-edit-file-workspace/describe` | GET/POST | workspaces + sessions (`{ ok, value: { workspaces, sessions } }`) |
| `/api/dsh-edit-file-workspace/move` | POST | `{ sessionId, workspaceId \| path }`; `value.move.projection` reports how the cache was re-bound |
| `/api/dsh-edit-file-workspace/selftest` | GET/POST | read-only health report: storage shapes, title/time cache binding, mounted services |

All three require a loopback peer and same-origin Host.

## Behaviour and limits

- **Cold sessions only**: the artifact directory is renamed as a whole, so siblings (every format generation, the backend's `session.lock`) travel with it.
- **Header line only**: the first JSON line of the zstd frame is rewritten; the rest of that frame and every later frame stay byte-identical (`scripts/verify-log-rewrite.mjs` verifies 6.6 MB / 9 678 frames / 23 209 lines end to end).
- **Every format generation is rewritten**; a session that was never re-opened may still sit at an older generation, and a later migration would otherwise restore the old `cwd`.
- **Attach before detach**: if the second step fails the session stays visible in its old workspace instead of disappearing from both.
- The target directory must exist; a workspace whose directory was deleted fails with a clear error.

## Compatibility

| DSH desktop | host `@deepseek-ai/dsh-*` | Status |
| --- | --- | --- |
| 0.2.0-rc.2 | 0.2.0-rc.2 | ✅ tested on a real install |
| 0.2.1-rc.2 | 0.2.1-rc.2 | ✅ contract files byte-identical |

```powershell
node scripts/check-dsh-version.mjs   # exit 0=no change needed, 2=widen ranges only, 3=contract changed, review
```

See [`docs/dsh-compat.md`](docs/dsh-compat.md) for the mechanism, fingerprints and the upgrade procedure.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Plugin service unavailable" | host half not loaded (pre-restart, or missing from `dsh.profile.bundles`) | add it to bundles, restart DSH |
| Blank title / created-at time after a move | the projection cache could not be re-bound | check `projectionUnbound` in `/selftest`; opening the session once restores it |
| "session is in use" | the session is attached in this process | close/archive it, retry |
| Full page reload after a move | the client could not reach the `sessions` service | expected fallback |

## Development

```powershell
pnpm install
pnpm typecheck   # host half only (tsconfig.host.json)
pnpm test        # log-frame rewrite, persistence shapes, projection re-bind
pnpm build       # lib/index.js (host) + lib/client.js (browser)
pnpm check       # typecheck + test + build
```

Real-log verification (works on a copy, never on the original):

```powershell
node --experimental-strip-types scripts/verify-log-rewrite.mjs "$env:USERPROFILE\.dsh\sessions\<project>\<session-id>\session.v4.jsonl.zstd"
```

Release process: [`docs/release.md`](docs/release.md).

## License

MIT
