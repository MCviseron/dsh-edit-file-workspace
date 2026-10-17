/**
 * Version-tolerant access to `ctx.sessionPersistence`.
 *
 * The backend contract returns `SessionPersistenceSnapshot` objects
 * (`{ header, revision, sizeBytes }`), not bare headers. Older plugin builds
 * read `.id` off the snapshot and silently produced `undefined`, so every
 * read here normalizes both shapes and refuses anything that is neither.
 */

export interface StoredSessionHeader {
  id: string
  cwd?: string
  version?: number
  createdAt?: number
  isSeeded?: boolean
  [key: string]: unknown
}

export interface SessionPersistenceLike {
  list(options?: { signal?: AbortSignal }): Promise<readonly unknown[]>
  stat?(id: string, options?: { signal?: AbortSignal }): Promise<unknown>
  locate?(header: StoredSessionHeader): { path?: string; kind?: string } | undefined
}

function hasStringId(value: unknown): value is StoredSessionHeader {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { id?: unknown }).id === 'string'
}

/** Unwrap a snapshot (`{ header }`) or a bare header; `undefined` for anything else. */
export function headerOf(value: unknown): StoredSessionHeader | undefined {
  if (hasStringId(value)) return value
  if (typeof value === 'object' && value !== null) {
    const inner = (value as { header?: unknown }).header
    if (hasStringId(inner)) return inner
  }
  return undefined
}

/** Every stored header, in the backend's own (unordered) listing order. */
export async function listHeaders(persistence: SessionPersistenceLike): Promise<StoredSessionHeader[]> {
  const snapshots = await persistence.list()
  const headers: StoredSessionHeader[] = []
  for (const snapshot of snapshots) {
    const header = headerOf(snapshot)
    if (header !== undefined) headers.push(header)
  }
  return headers
}

/**
 * One stored header by id: `stat` when the backend has it (no full listing),
 * otherwise a listing scan. `undefined` only when the session is truly absent.
 */
export async function findHeader(persistence: SessionPersistenceLike, sessionId: string): Promise<StoredSessionHeader | undefined> {
  if (typeof persistence.stat === 'function') {
    let statted: unknown
    try {
      statted = await persistence.stat(sessionId)
    } catch {
      statted = undefined
    }
    const header = headerOf(statted)
    if (header !== undefined) return header
  }
  return (await listHeaders(persistence)).find(header => header.id === sessionId)
}

/**
 * The physical artifact path for one header. Only the JSONL backend exposes
 * `locate`; a backend without it cannot have its log moved in place.
 */
export function locateLogPath(persistence: SessionPersistenceLike, header: StoredSessionHeader): string {
  if (typeof persistence.locate !== 'function') {
    throw new Error('当前会话存储后端不支持定位日志文件，无法移动该会话')
  }
  const location = persistence.locate(header)
  const path = typeof location?.path === 'string' ? location.path : ''
  if (path === '') throw new Error('当前会话存储后端未能给出日志路径，无法移动该会话')
  return path
}
