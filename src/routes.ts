import type { Context } from '@deepseek-ai/cordis'
import type { ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { realpath } from 'node:fs/promises'
import { basename } from 'node:path'
import { isLoopbackRequest } from './loopback.ts'
import { moveSessionArtifacts } from './move.ts'
import {
  findHeader,
  listHeaders,
  type SessionPersistenceLike,
  type StoredSessionHeader,
} from './persistence.ts'
import { rebindProjectionCache, type ProjectionRebind } from './projection.ts'

export const EDIT_FILE_WORKSPACE_API = {
  describe: '/api/dsh-edit-file-workspace/describe',
  move: '/api/dsh-edit-file-workspace/move',
  selftest: '/api/dsh-edit-file-workspace/selftest',
} as const

const MAX_BODY_BYTES = 64 * 1024

interface WorkspaceSummary {
  workspaceId: string
  path: string
  title: string
  sessionIds: string[]
}

interface SessionSummary {
  sessionId: string
  title?: string
  cwd?: string
  workspaceId: string | null
  live: boolean
}

interface DescribeState {
  workspaces: WorkspaceSummary[]
  sessions: SessionSummary[]
  move?: { projection: ProjectionRebind }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' })
  res.end(JSON.stringify(body))
}

async function readJsonBody(req: Parameters<WebRoute['handler']>[0]): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > MAX_BODY_BYTES) return undefined
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return undefined
  }
}

function titleOf(block: { values?: Record<string, unknown> } | undefined): string | undefined {
  const title = block?.values?.title
  return typeof title === 'string' && title.trim() !== '' ? title : undefined
}

function liveTitle(ctx: Context, session: unknown): string | undefined {
  const projections = (ctx as any).get?.('sessionProjections')
  if (projections === undefined) return undefined
  try {
    return titleOf(projections.snapshot?.(session))
  } catch {
    return undefined
  }
}

function storedTitle(ctx: Context, header: StoredSessionHeader): string | undefined {
  const cache = (ctx as any).get?.('sessionProjectionCache')
  if (cache === undefined) return undefined
  try {
    return titleOf(cache.cachedSnapshot?.(header))
  } catch {
    return undefined
  }
}

async function describeState(ctx: Context, move?: { projection: ProjectionRebind }): Promise<DescribeState> {
  const anyCtx = ctx as any
  const registry = anyCtx.workspaceRegistry
  const persistence = anyCtx.sessionPersistence as SessionPersistenceLike
  const sessions = anyCtx.sessions

  const workspaces: WorkspaceSummary[] = registry.list().map((workspace: any) => ({
    workspaceId: String(workspace.id),
    path: workspace.path,
    title: workspace.title,
    sessionIds: [...workspace.sessionIds].map(String),
  }))

  const seen = new Set<string>()
  const items: SessionSummary[] = []

  for (const session of sessions.list()) {
    const id = String(session.id)
    seen.add(id)
    const workspace = workspaces.find(candidate => candidate.sessionIds.includes(id))
    items.push({
      sessionId: id,
      title: liveTitle(ctx, session),
      cwd: session.header.cwd,
      workspaceId: workspace === undefined ? null : workspace.workspaceId,
      live: true,
    })
  }

  for (const header of await listHeaders(persistence)) {
    if (seen.has(header.id)) continue
    seen.add(header.id)
    const workspace = workspaces.find(candidate => candidate.sessionIds.includes(header.id))
    items.push({
      sessionId: header.id,
      title: storedTitle(ctx, header),
      cwd: header.cwd,
      workspaceId: workspace === undefined ? null : workspace.workspaceId,
      live: false,
    })
  }

  items.sort((left, right) => {
    const a = left.title ?? left.sessionId
    const b = right.title ?? right.sessionId
    return a.localeCompare(b)
  })

  return move === undefined ? { workspaces, sessions: items } : { workspaces, sessions: items, move }
}

async function canonicalPath(path: string): Promise<string> {
  try {
    return await realpath(path)
  } catch {
    return path
  }
}

function samePath(left: string, right: string): boolean {
  if (left === right) return true
  return process.platform === 'win32' && left.toLowerCase() === right.toLowerCase()
}

async function reindexHeader(registry: any, header: StoredSessionHeader): Promise<void> {
  if (typeof registry.indexHeader === 'function') {
    await registry.indexHeader(header)
    return
  }
  if (typeof registry.indexHeaders === 'function') {
    await registry.indexHeaders([header])
    return
  }
  throw new Error('当前 DSH 版本的 workspaceRegistry 不提供头索引更新，无法移动会话')
}

async function moveSession(ctx: Context, body: Record<string, unknown>): Promise<DescribeState> {
  const anyCtx = ctx as any
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
  if (sessionId === '') throw new Error('缺少 sessionId')

  const sessions = anyCtx.sessions
  if (sessions.get(sessionId) !== undefined) {
    throw new Error('该会话正在使用中，无法移动。请先关闭或归档该会话，再重试。')
  }

  const registry = anyCtx.workspaceRegistry
  const persistence = anyCtx.sessionPersistence as SessionPersistenceLike

  const oldHeader = await findHeader(persistence, sessionId)
  if (oldHeader === undefined) throw new Error('未找到该会话')
  if (oldHeader.cwd === undefined) throw new Error('该会话没有 cwd，无法移动')

  const oldWorkspace = registry.list().find((workspace: any) => [...workspace.sessionIds].map(String).includes(sessionId))
  const rawWorkspaceId = body.workspaceId
  const rawPath = typeof body.path === 'string' ? body.path.trim() : ''
  const wantsUngrouped = rawPath === '' && (rawWorkspaceId === null || rawWorkspaceId === undefined || rawWorkspaceId === '')

  if (wantsUngrouped) {
    if (oldWorkspace !== undefined) await oldWorkspace.detachSession(sessionId)
    return describeState(ctx)
  }

  let targetPath: string
  let targetWorkspace: any
  if (rawPath !== '') {
    targetPath = await realpath(rawPath)
  } else {
    targetWorkspace = registry.get(String(rawWorkspaceId))
    if (targetWorkspace === undefined) throw new Error('目标工作区不存在')
    targetPath = targetWorkspace.path
  }

  let projection: ProjectionRebind | undefined
  if (!samePath(targetPath, await canonicalPath(oldHeader.cwd))) {
    const newHeader: StoredSessionHeader = { ...oldHeader, cwd: targetPath }
    moveSessionArtifacts(persistence, oldHeader, newHeader)
    await reindexHeader(registry, newHeader)
    projection = await rebindProjectionCache(anyCtx as { get(name: string): unknown }, newHeader, oldHeader)
  }

  if (targetWorkspace === undefined) targetWorkspace = await registry.resolveByPath(targetPath)
  if (targetWorkspace === undefined) targetWorkspace = await registry.create(targetPath, basename(targetPath))

  // Attach first: a failed attach leaves the session visible under its old
  // workspace instead of orphaning it everywhere.
  await targetWorkspace.attachSession(sessionId)
  if (oldWorkspace !== undefined && String(oldWorkspace.id) !== String(targetWorkspace.id)) {
    await oldWorkspace.detachSession(sessionId)
  }

  return describeState(ctx, projection === undefined ? undefined : { projection })
}

/**
 * Read-only health report: proves the persistence shapes this build normalizes
 * and whether the projection cache is bound to every listed session (a binding
 * miss is exactly what made a moved session lose its title and timestamp).
 */
async function selfTest(ctx: Context): Promise<Record<string, unknown>> {
  const anyCtx = ctx as any
  const persistence = anyCtx.sessionPersistence as SessionPersistenceLike
  const raw = await persistence.list()
  const headers = await listHeaders(persistence)
  const sessions = anyCtx.sessions.list()
  const liveIds = new Set(sessions.map((session: any) => String(session.id)))

  const cache = anyCtx.get?.('sessionProjectionCache')
  let titled = 0
  let bound = 0
  let unbound = 0
  for (const header of headers) {
    if (storedTitle(ctx, header) !== undefined) titled += 1
    if (cache?.recordFor === undefined) continue
    try {
      const identity = { formatVersion: header.version, createdAt: header.createdAt, ...header.cwd === undefined ? {} : { cwd: header.cwd }, isSeeded: header.isSeeded ?? false, inheritedEventCount: 0 }
      if (header.isSeeded === true) continue
      if (cache.recordFor(header.id, identity) !== undefined) bound += 1
      else unbound += 1
    } catch {
      unbound += 1
    }
  }

  return {
    persistence: {
      listed: raw.length,
      normalized: headers.length,
      unreadable: raw.length - headers.length,
    },
    sessions: {
      live: sessions.length,
      cold: headers.filter(header => !liveIds.has(header.id)).length,
      titled,
      titleMissing: headers.length - titled,
      projectionBound: bound,
      projectionUnbound: unbound,
    },
    workspaces: anyCtx.workspaceRegistry.list().length,
    services: {
      sessionQuery: anyCtx.get?.('sessionQuery') !== undefined,
      sessionProjectionCache: cache !== undefined,
      sessionProjections: anyCtx.get?.('sessionProjections') !== undefined,
    },
  }
}

export function makeEditFileWorkspaceRoutes(ctx: Context): WebRoute[] {
  const describe: WebRoute = {
    kind: 'exact',
    path: EDIT_FILE_WORKSPACE_API.describe,
    handler: async (req, res): Promise<void> => {
      if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' })
      if (!isLoopbackRequest(req)) return json(res, 403, { ok: false, error: 'forbidden' })
      try {
        json(res, 200, { ok: true, value: await describeState(ctx) })
      } catch (error) {
        json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }

  const move: WebRoute = {
    kind: 'exact',
    path: EDIT_FILE_WORKSPACE_API.move,
    handler: async (req, res): Promise<void> => {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' })
      if (!isLoopbackRequest(req)) return json(res, 403, { ok: false, error: 'forbidden' })
      const body = await readJsonBody(req)
      if (body === undefined || typeof body !== 'object' || body === null) {
        return json(res, 400, { ok: false, error: 'unreadable JSON body' })
      }
      try {
        json(res, 200, { ok: true, value: await moveSession(ctx, body as Record<string, unknown>) })
      } catch (error) {
        json(res, 200, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }

  const selftest: WebRoute = {
    kind: 'exact',
    path: EDIT_FILE_WORKSPACE_API.selftest,
    handler: async (req, res): Promise<void> => {
      if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' })
      if (!isLoopbackRequest(req)) return json(res, 403, { ok: false, error: 'forbidden' })
      try {
        json(res, 200, { ok: true, value: await selfTest(ctx) })
      } catch (error) {
        json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }

  return [describe, move, selftest]
}
