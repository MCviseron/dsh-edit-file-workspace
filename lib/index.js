// src/routes.ts
import { realpath } from "node:fs/promises";
import { basename } from "node:path";

// src/loopback.ts
function isIPv4Loopback(value) {
  const parts = value.split(".");
  return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
function isLoopbackAddress(address) {
  if (address === void 0) return false;
  const normalized = address.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("::ffff:")) return isIPv4Loopback(normalized.slice("::ffff:".length));
  return isIPv4Loopback(normalized);
}
function isLoopbackHostname(hostname) {
  if (hostname === "localhost" || hostname === "[::1]") return true;
  return isIPv4Loopback(hostname);
}
function isLoopbackRequest(request) {
  if (!isLoopbackAddress(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (typeof host !== "string") return false;
  let hostUrl;
  try {
    hostUrl = new URL("http://" + host);
  } catch {
    return false;
  }
  if (!isLoopbackHostname(hostUrl.hostname)) return false;
  if (request.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = request.headers.origin;
  if (origin === void 0) return true;
  try {
    return new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

// src/move.ts
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { zstdCompressSync, zstdDecompressSync } from "node:zlib";

// src/persistence.ts
function hasStringId(value) {
  return typeof value === "object" && value !== null && typeof value.id === "string";
}
function headerOf(value) {
  if (hasStringId(value)) return value;
  if (typeof value === "object" && value !== null) {
    const inner = value.header;
    if (hasStringId(inner)) return inner;
  }
  return void 0;
}
async function listHeaders(persistence) {
  const snapshots = await persistence.list();
  const headers = [];
  for (const snapshot of snapshots) {
    const header = headerOf(snapshot);
    if (header !== void 0) headers.push(header);
  }
  return headers;
}
async function findHeader(persistence, sessionId) {
  if (typeof persistence.stat === "function") {
    let statted;
    try {
      statted = await persistence.stat(sessionId);
    } catch {
      statted = void 0;
    }
    const header = headerOf(statted);
    if (header !== void 0) return header;
  }
  return (await listHeaders(persistence)).find((header) => header.id === sessionId);
}
function locateLogPath(persistence, header) {
  if (typeof persistence.locate !== "function") {
    throw new Error("\u5F53\u524D\u4F1A\u8BDD\u5B58\u50A8\u540E\u7AEF\u4E0D\u652F\u6301\u5B9A\u4F4D\u65E5\u5FD7\u6587\u4EF6\uFF0C\u65E0\u6CD5\u79FB\u52A8\u8BE5\u4F1A\u8BDD");
  }
  const location = persistence.locate(header);
  const path = typeof location?.path === "string" ? location.path : "";
  if (path === "") throw new Error("\u5F53\u524D\u4F1A\u8BDD\u5B58\u50A8\u540E\u7AEF\u672A\u80FD\u7ED9\u51FA\u65E5\u5FD7\u8DEF\u5F84\uFF0C\u65E0\u6CD5\u79FB\u52A8\u8BE5\u4F1A\u8BDD");
  return path;
}

// src/move.ts
var ZSTD_MAGIC = 4247762216;
var LF = 10;
function firstFrameEnd(buf) {
  if (buf.length < 4 || buf.readUInt32LE(0) !== ZSTD_MAGIC) throw new Error("\u4F1A\u8BDD\u65E5\u5FD7\u4E0D\u662F zstd \u683C\u5F0F");
  let offset = 4;
  const descriptor = buf.readUInt8(offset++);
  const contentSizeFlag = descriptor >>> 6;
  const singleSegment = (descriptor & 32) !== 0;
  const checksum = (descriptor & 4) !== 0;
  const dictFlag = descriptor & 3;
  const dictBytes = dictFlag === 3 ? 4 : dictFlag;
  const contentSizeBytes = contentSizeFlag === 0 ? singleSegment ? 1 : 0 : 1 << contentSizeFlag;
  offset += (singleSegment ? 0 : 1) + dictBytes + contentSizeBytes;
  for (; ; ) {
    if (buf.length - offset < 3) throw new Error("\u4F1A\u8BDD\u65E5\u5FD7\u5E27\u5934\u88AB\u622A\u65AD");
    const blockHeader = buf.readUIntLE(offset, 3);
    offset += 3;
    const lastBlock = (blockHeader & 1) !== 0;
    const blockType = blockHeader >>> 1 & 3;
    const blockSize = blockHeader >>> 3;
    const payloadBytes = blockType === 1 ? 1 : blockSize;
    if (buf.length - offset < payloadBytes) throw new Error("\u4F1A\u8BDD\u65E5\u5FD7\u5E27\u5185\u5BB9\u88AB\u622A\u65AD");
    offset += payloadBytes;
    if (lastBlock) break;
  }
  if (checksum) offset += 4;
  if (offset > buf.length) throw new Error("\u4F1A\u8BDD\u65E5\u5FD7\u5E27\u957F\u5EA6\u8D85\u51FA\u6587\u4EF6\u8303\u56F4");
  return offset;
}
function rewriteHeaderCwd(filePath, expectedId, cwd) {
  const buf = readFileSync(filePath);
  const end = firstFrameEnd(buf);
  const plain = zstdDecompressSync(buf.subarray(0, end));
  const lineEnd = plain.indexOf(LF);
  if (lineEnd < 0) throw new Error("\u4F1A\u8BDD\u65E5\u5FD7\u7F3A\u5C11\u5934\u884C: " + filePath);
  let header;
  try {
    header = JSON.parse(plain.subarray(0, lineEnd).toString("utf8"));
  } catch {
    throw new Error("\u4F1A\u8BDD\u65E5\u5FD7\u5934\u884C\u4E0D\u662F\u5408\u6CD5 JSON: " + filePath);
  }
  if (typeof header !== "object" || header === null || String(header.id) !== expectedId) {
    throw new Error("\u4F1A\u8BDD\u65E5\u5FD7\u5934\u884C\u4E0E\u4F1A\u8BDD ID \u4E0D\u5339\u914D: " + filePath);
  }
  const record = header;
  if (typeof record.version !== "number") throw new Error("\u4F1A\u8BDD\u65E5\u5FD7\u5934\u884C\u7F3A\u5C11\u683C\u5F0F\u7248\u672C: " + filePath);
  record.cwd = cwd;
  const rewritten = Buffer.concat([Buffer.from(JSON.stringify(record) + "\n", "utf8"), plain.subarray(lineEnd + 1)]);
  const out = Buffer.concat([zstdCompressSync(rewritten), buf.subarray(end)]);
  const tmp = filePath + ".tmp-" + process.pid + "-" + Date.now();
  writeFileSync(tmp, out);
  try {
    renameSync(tmp, filePath);
  } catch {
    rmSync(filePath, { force: true });
    renameSync(tmp, filePath);
  }
}
var GENERATION_LOG = /^session(?:\.v[1-9]\d*)?\.jsonl(?:\.[a-z0-9]+)?$/;
function rewriteGenerationHeaders(dir, expectedId, cwd) {
  let rewritten = 0;
  for (const name of readdirSync(dir)) {
    if (!GENERATION_LOG.test(name)) continue;
    rewriteHeaderCwd(join(dir, name), expectedId, cwd);
    rewritten += 1;
  }
  return rewritten;
}
function moveSessionArtifacts(persistence, oldHeader, newHeader) {
  if (oldHeader.cwd === void 0) throw new Error("\u8BE5\u4F1A\u8BDD\u6CA1\u6709 cwd\uFF0C\u65E0\u6CD5\u79FB\u52A8");
  if (newHeader.cwd === void 0) throw new Error("\u76EE\u6807\u8DEF\u5F84\u4E3A\u7A7A");
  const oldFile = locateLogPath(persistence, oldHeader);
  const newFile = locateLogPath(persistence, newHeader);
  const oldDir = dirname(oldFile);
  const newDir = dirname(newFile);
  if (oldFile === newFile) return { from: oldDir, to: newDir, rewritten: 0 };
  if (oldDir === newDir) throw new Error("\u76EE\u6807\u8DEF\u5F84\u4E0E\u5F53\u524D\u8DEF\u5F84\u89E3\u6790\u5230\u4E86\u540C\u4E00\u4F1A\u8BDD\u76EE\u5F55");
  if (!existsSync(oldDir)) throw new Error("\u4F1A\u8BDD\u65E5\u5FD7\u76EE\u5F55\u4E0D\u5B58\u5728: " + oldDir);
  if (existsSync(newDir)) throw new Error("\u76EE\u6807\u4F4D\u7F6E\u5DF2\u5B58\u5728\u540C\u540D\u4F1A\u8BDD\u76EE\u5F55: " + newDir);
  mkdirSync(dirname(newDir), { recursive: true });
  renameSync(oldDir, newDir);
  const rewritten = rewriteGenerationHeaders(newDir, newHeader.id, newHeader.cwd);
  if (rewritten === 0) throw new Error("\u79FB\u52A8\u540E\u672A\u627E\u5230\u53EF\u6539\u5199\u7684\u4F1A\u8BDD\u65E5\u5FD7: " + newDir);
  return { from: oldDir, to: newDir, rewritten };
}

// src/projection.ts
function identityOf(header, inheritedEventCount) {
  return {
    formatVersion: header.version,
    createdAt: header.createdAt,
    ...header.cwd === void 0 ? {} : { cwd: header.cwd },
    isSeeded: header.isSeeded ?? false,
    inheritedEventCount
  };
}
function isBound(cache, header, inheritedEventCount) {
  if (typeof cache.recordFor === "function") {
    return cache.recordFor(header.id, identityOf(header, inheritedEventCount)) !== void 0;
  }
  return cache.cachedSnapshot?.(header) !== void 0;
}
async function waitForBound(cache, header, inheritedEventCount) {
  const deadline = Date.now() + 2500;
  for (; ; ) {
    if (isBound(cache, header, inheritedEventCount)) return true;
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
async function rebindProjectionCache(host, header, previous) {
  const cache = host.get("sessionProjectionCache");
  if (cache === void 0 || cache === null) return "unavailable";
  const inherited = typeof header.isSeeded === "boolean" && header.isSeeded ? void 0 : 0;
  if (inherited !== void 0 && isBound(cache, header, inherited)) return "bound";
  const query = host.get("sessionQuery");
  if (typeof query?.readSession === "function" && typeof cache.coldSnapshot === "function") {
    try {
      const snapshot = await query.readSession(header.id);
      const loadedHeader = headerOf(snapshot.session) ?? header;
      const cut = typeof snapshot.inheritedEventCount === "number" ? snapshot.inheritedEventCount : 0;
      const events = Array.isArray(snapshot.events) ? snapshot.events : void 0;
      if (events !== void 0) {
        cache.coldSnapshot(loadedHeader, cut, events);
        if (await waitForBound(cache, loadedHeader, cut)) return "folded";
      }
    } catch {
    }
  }
  if (previous.isSeeded === true) return "failed";
  if (typeof cache.recordFor === "function" && typeof cache.put === "function") {
    try {
      const stored = cache.recordFor(previous.id, identityOf(previous, 0));
      const rows = stored?.rows;
      if (rows !== void 0) {
        await cache.put(header.id, identityOf(header, 0), rows);
        if (await waitForBound(cache, header, 0)) return "retagged";
      }
    } catch {
    }
  }
  return "failed";
}

// src/routes.ts
var EDIT_FILE_WORKSPACE_API = {
  describe: "/api/dsh-edit-file-workspace/describe",
  move: "/api/dsh-edit-file-workspace/move",
  selftest: "/api/dsh-edit-file-workspace/selftest"
};
var MAX_BODY_BYTES = 64 * 1024;
function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" });
  res.end(JSON.stringify(body));
}
async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) return void 0;
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return void 0;
  }
}
function titleOf(block) {
  const title = block?.values?.title;
  return typeof title === "string" && title.trim() !== "" ? title : void 0;
}
function liveTitle(ctx, session) {
  const projections = ctx.get?.("sessionProjections");
  if (projections === void 0) return void 0;
  try {
    return titleOf(projections.snapshot?.(session));
  } catch {
    return void 0;
  }
}
function storedTitle(ctx, header) {
  const cache = ctx.get?.("sessionProjectionCache");
  if (cache === void 0) return void 0;
  try {
    return titleOf(cache.cachedSnapshot?.(header));
  } catch {
    return void 0;
  }
}
async function describeState(ctx, move) {
  const anyCtx = ctx;
  const registry = anyCtx.workspaceRegistry;
  const persistence = anyCtx.sessionPersistence;
  const sessions = anyCtx.sessions;
  const workspaces = registry.list().map((workspace) => ({
    workspaceId: String(workspace.id),
    path: workspace.path,
    title: workspace.title,
    sessionIds: [...workspace.sessionIds].map(String)
  }));
  const seen = /* @__PURE__ */ new Set();
  const items = [];
  for (const session of sessions.list()) {
    const id = String(session.id);
    seen.add(id);
    const workspace = workspaces.find((candidate) => candidate.sessionIds.includes(id));
    items.push({
      sessionId: id,
      title: liveTitle(ctx, session),
      cwd: session.header.cwd,
      workspaceId: workspace === void 0 ? null : workspace.workspaceId,
      live: true
    });
  }
  for (const header of await listHeaders(persistence)) {
    if (seen.has(header.id)) continue;
    seen.add(header.id);
    const workspace = workspaces.find((candidate) => candidate.sessionIds.includes(header.id));
    items.push({
      sessionId: header.id,
      title: storedTitle(ctx, header),
      cwd: header.cwd,
      workspaceId: workspace === void 0 ? null : workspace.workspaceId,
      live: false
    });
  }
  items.sort((left, right) => {
    const a = left.title ?? left.sessionId;
    const b = right.title ?? right.sessionId;
    return a.localeCompare(b);
  });
  return move === void 0 ? { workspaces, sessions: items } : { workspaces, sessions: items, move };
}
async function canonicalPath(path) {
  try {
    return await realpath(path);
  } catch {
    return path;
  }
}
function samePath(left, right) {
  if (left === right) return true;
  return process.platform === "win32" && left.toLowerCase() === right.toLowerCase();
}
async function reindexHeader(registry, header) {
  if (typeof registry.indexHeader === "function") {
    await registry.indexHeader(header);
    return;
  }
  if (typeof registry.indexHeaders === "function") {
    await registry.indexHeaders([header]);
    return;
  }
  throw new Error("\u5F53\u524D DSH \u7248\u672C\u7684 workspaceRegistry \u4E0D\u63D0\u4F9B\u5934\u7D22\u5F15\u66F4\u65B0\uFF0C\u65E0\u6CD5\u79FB\u52A8\u4F1A\u8BDD");
}
async function moveSession(ctx, body) {
  const anyCtx = ctx;
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (sessionId === "") throw new Error("\u7F3A\u5C11 sessionId");
  const sessions = anyCtx.sessions;
  if (sessions.get(sessionId) !== void 0) {
    throw new Error("\u8BE5\u4F1A\u8BDD\u6B63\u5728\u4F7F\u7528\u4E2D\uFF0C\u65E0\u6CD5\u79FB\u52A8\u3002\u8BF7\u5148\u5173\u95ED\u6216\u5F52\u6863\u8BE5\u4F1A\u8BDD\uFF0C\u518D\u91CD\u8BD5\u3002");
  }
  const registry = anyCtx.workspaceRegistry;
  const persistence = anyCtx.sessionPersistence;
  const oldHeader = await findHeader(persistence, sessionId);
  if (oldHeader === void 0) throw new Error("\u672A\u627E\u5230\u8BE5\u4F1A\u8BDD");
  if (oldHeader.cwd === void 0) throw new Error("\u8BE5\u4F1A\u8BDD\u6CA1\u6709 cwd\uFF0C\u65E0\u6CD5\u79FB\u52A8");
  const oldWorkspace = registry.list().find((workspace) => [...workspace.sessionIds].map(String).includes(sessionId));
  const rawWorkspaceId = body.workspaceId;
  const rawPath = typeof body.path === "string" ? body.path.trim() : "";
  const wantsUngrouped = rawPath === "" && (rawWorkspaceId === null || rawWorkspaceId === void 0 || rawWorkspaceId === "");
  if (wantsUngrouped) {
    if (oldWorkspace !== void 0) await oldWorkspace.detachSession(sessionId);
    return describeState(ctx);
  }
  let targetPath;
  let targetWorkspace;
  if (rawPath !== "") {
    targetPath = await realpath(rawPath);
  } else {
    targetWorkspace = registry.get(String(rawWorkspaceId));
    if (targetWorkspace === void 0) throw new Error("\u76EE\u6807\u5DE5\u4F5C\u533A\u4E0D\u5B58\u5728");
    targetPath = targetWorkspace.path;
  }
  let projection;
  if (!samePath(targetPath, await canonicalPath(oldHeader.cwd))) {
    const newHeader = { ...oldHeader, cwd: targetPath };
    moveSessionArtifacts(persistence, oldHeader, newHeader);
    await reindexHeader(registry, newHeader);
    projection = await rebindProjectionCache(anyCtx, newHeader, oldHeader);
  }
  if (targetWorkspace === void 0) targetWorkspace = await registry.resolveByPath(targetPath);
  if (targetWorkspace === void 0) targetWorkspace = await registry.create(targetPath, basename(targetPath));
  await targetWorkspace.attachSession(sessionId);
  if (oldWorkspace !== void 0 && String(oldWorkspace.id) !== String(targetWorkspace.id)) {
    await oldWorkspace.detachSession(sessionId);
  }
  return describeState(ctx, projection === void 0 ? void 0 : { projection });
}
async function selfTest(ctx) {
  const anyCtx = ctx;
  const persistence = anyCtx.sessionPersistence;
  const raw = await persistence.list();
  const headers = await listHeaders(persistence);
  const sessions = anyCtx.sessions.list();
  const liveIds = new Set(sessions.map((session) => String(session.id)));
  const cache = anyCtx.get?.("sessionProjectionCache");
  let titled = 0;
  let bound = 0;
  let unbound = 0;
  for (const header of headers) {
    if (storedTitle(ctx, header) !== void 0) titled += 1;
    if (cache?.recordFor === void 0) continue;
    try {
      const identity = { formatVersion: header.version, createdAt: header.createdAt, ...header.cwd === void 0 ? {} : { cwd: header.cwd }, isSeeded: header.isSeeded ?? false, inheritedEventCount: 0 };
      if (header.isSeeded === true) continue;
      if (cache.recordFor(header.id, identity) !== void 0) bound += 1;
      else unbound += 1;
    } catch {
      unbound += 1;
    }
  }
  return {
    persistence: {
      listed: raw.length,
      normalized: headers.length,
      unreadable: raw.length - headers.length
    },
    sessions: {
      live: sessions.length,
      cold: headers.filter((header) => !liveIds.has(header.id)).length,
      titled,
      titleMissing: headers.length - titled,
      projectionBound: bound,
      projectionUnbound: unbound
    },
    workspaces: anyCtx.workspaceRegistry.list().length,
    services: {
      sessionQuery: anyCtx.get?.("sessionQuery") !== void 0,
      sessionProjectionCache: cache !== void 0,
      sessionProjections: anyCtx.get?.("sessionProjections") !== void 0
    }
  };
}
function makeEditFileWorkspaceRoutes(ctx) {
  const describe = {
    kind: "exact",
    path: EDIT_FILE_WORKSPACE_API.describe,
    handler: async (req, res) => {
      if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false, error: "method-not-allowed" });
      if (!isLoopbackRequest(req)) return json(res, 403, { ok: false, error: "forbidden" });
      try {
        json(res, 200, { ok: true, value: await describeState(ctx) });
      } catch (error) {
        json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
  };
  const move = {
    kind: "exact",
    path: EDIT_FILE_WORKSPACE_API.move,
    handler: async (req, res) => {
      if (req.method !== "POST") return json(res, 405, { ok: false, error: "method-not-allowed" });
      if (!isLoopbackRequest(req)) return json(res, 403, { ok: false, error: "forbidden" });
      const body = await readJsonBody(req);
      if (body === void 0 || typeof body !== "object" || body === null) {
        return json(res, 400, { ok: false, error: "unreadable JSON body" });
      }
      try {
        json(res, 200, { ok: true, value: await moveSession(ctx, body) });
      } catch (error) {
        json(res, 200, { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
  };
  const selftest = {
    kind: "exact",
    path: EDIT_FILE_WORKSPACE_API.selftest,
    handler: async (req, res) => {
      if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false, error: "method-not-allowed" });
      if (!isLoopbackRequest(req)) return json(res, 403, { ok: false, error: "forbidden" });
      try {
        json(res, 200, { ok: true, value: await selfTest(ctx) });
      } catch (error) {
        json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
  };
  return [describe, move, selftest];
}

// src/index.ts
var inject = ["webServer", "workspaceRegistry", "sessionPersistence", "sessions"];
function apply(ctx) {
  ctx.effect(() => {
    const disposers = makeEditFileWorkspaceRoutes(ctx).map((route) => ctx.webServer.register(route));
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, "dsh-edit-file-workspace: routes");
}
export {
  apply,
  inject
};
