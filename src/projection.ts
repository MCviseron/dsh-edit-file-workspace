/**
 * Re-bind the persisted projection cache to a session header whose `cwd` changed.
 *
 * The cache binds every checkpoint to a lifecycle identity built from
 * `formatVersion`, `createdAt`, `cwd`, `isSeeded` and the inherited cut. A move
 * changes `cwd`, so the stored row stops matching and every listing surface
 * loses the projections it reads from it: the session title (blank row) and
 * `sessionListMetadata.lastPromptAt` (the list then falls back to `createdAt`,
 * i.e. the wrong timestamp). Nothing repairs that on its own — a listing is a
 * zero-I/O cache read — so the move has to re-checkpoint the new identity.
 */
import { headerOf, type StoredSessionHeader } from './persistence.ts'

export interface ProjectionCacheLike {
  cachedSnapshot?(header: StoredSessionHeader, keys?: readonly string[]): { values?: Record<string, unknown> } | undefined
  coldSnapshot?(header: StoredSessionHeader, inheritedEventCount: number, events: readonly unknown[]): unknown
  recordFor?(id: string, identity: unknown): { rows?: Record<string, unknown> } | undefined
  put?(id: string, identity: unknown, rows: Record<string, unknown>): Promise<void>
}

export interface SessionQueryLike {
  readSession?(id: string): Promise<{ session?: unknown; inheritedEventCount?: number; events?: unknown }>
}

export interface ProjectionHost {
  get(name: string): unknown
}

/** How the cache ended up bound to the moved header. */
export type ProjectionRebind = 'bound' | 'folded' | 'retagged' | 'unavailable' | 'failed'

/** The identity fields the cache binds a checkpoint to (see the projection cache's `identityOf`). */
function identityOf(header: StoredSessionHeader, inheritedEventCount: number): Record<string, unknown> {
  return {
    formatVersion: header.version,
    createdAt: header.createdAt,
    ...header.cwd === undefined ? {} : { cwd: header.cwd },
    isSeeded: header.isSeeded ?? false,
    inheritedEventCount,
  }
}

function isBound(cache: ProjectionCacheLike, header: StoredSessionHeader, inheritedEventCount: number): boolean {
  if (typeof cache.recordFor === 'function') {
    return cache.recordFor(header.id, identityOf(header, inheritedEventCount)) !== undefined
  }
  return cache.cachedSnapshot?.(header) !== undefined
}

async function waitForBound(cache: ProjectionCacheLike, header: StoredSessionHeader, inheritedEventCount: number): Promise<boolean> {
  const deadline = Date.now() + 2500
  for (;;) {
    if (isBound(cache, header, inheritedEventCount)) return true
    if (Date.now() > deadline) return false
    await new Promise(resolve => setTimeout(resolve, 25))
  }
}

/**
 * Bind the cache to `header`, preferring a fresh fold of the complete log (exact
 * title and timestamps) over re-tagging the previous checkpoint.
 *
 * @param host - context exposing `get`, so absent services read as `undefined`.
 * @param header - the stored header with its new `cwd`.
 * @param previous - the header as stored before the move (identity of the old row).
 */
export async function rebindProjectionCache(
  host: ProjectionHost,
  header: StoredSessionHeader,
  previous: StoredSessionHeader,
): Promise<ProjectionRebind> {
  const cache = host.get('sessionProjectionCache') as ProjectionCacheLike | undefined
  if (cache === undefined || cache === null) return 'unavailable'
  const inherited = typeof header.isSeeded === 'boolean' && header.isSeeded ? undefined : 0
  if (inherited !== undefined && isBound(cache, header, inherited)) return 'bound'

  const query = host.get('sessionQuery') as SessionQueryLike | undefined
  if (typeof query?.readSession === 'function' && typeof cache.coldSnapshot === 'function') {
    try {
      const snapshot = await query.readSession(header.id)
      const loadedHeader = headerOf(snapshot.session) ?? header
      const cut = typeof snapshot.inheritedEventCount === 'number' ? snapshot.inheritedEventCount : 0
      const events = Array.isArray(snapshot.events) ? snapshot.events : undefined
      if (events !== undefined) {
        cache.coldSnapshot(loadedHeader, cut, events)
        if (await waitForBound(cache, loadedHeader, cut)) return 'folded'
      }
    } catch {
      // The log could not be re-read (unsupported format, torn tail): fall through.
    }
  }

  if (previous.isSeeded === true) return 'failed'
  if (typeof cache.recordFor === 'function' && typeof cache.put === 'function') {
    try {
      const stored = cache.recordFor(previous.id, identityOf(previous, 0))
      const rows = stored?.rows
      if (rows !== undefined) {
        await cache.put(header.id, identityOf(header, 0), rows)
        if (await waitForBound(cache, header, 0)) return 'retagged'
      }
    } catch {
      // A lost write only costs a longer replay the next time the session opens.
    }
  }

  return 'failed'
}
