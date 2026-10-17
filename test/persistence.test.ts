import test from 'node:test'
import assert from 'node:assert/strict'
import { findHeader, headerOf, listHeaders, locateLogPath } from '../src/persistence.ts'
import { rebindProjectionCache } from '../src/projection.ts'

const header = { id: 'session-a', cwd: 'C:\\w', version: 4, createdAt: 1 }

test('reads a header from a persistence snapshot and from a bare header', () => {
  assert.deepEqual(headerOf({ header, revision: 'r', sizeBytes: 10 }), header)
  assert.deepEqual(headerOf({ ...header, revision: 'r' }), { ...header, revision: 'r' })
  assert.equal(headerOf({ revision: 'r' }), undefined)
  assert.equal(headerOf(undefined), undefined)
})

test('lists only entries that carry a header', async () => {
  const persistence = { list: async () => [{ header }, { header: { cwd: 'C:\\x' } }, 42] }
  assert.deepEqual(await listHeaders(persistence), [header])
})

test('findHeader prefers stat and falls back to the listing', async () => {
  let listed = 0
  const viaStat = {
    stat: async () => ({ header }),
    list: async () => { listed += 1; return [] },
  }
  assert.deepEqual(await findHeader(viaStat, 'session-a'), header)
  assert.equal(listed, 0)

  const staleStat = {
    stat: async () => undefined,
    list: async () => [{ header }],
  }
  assert.deepEqual(await findHeader(staleStat, 'session-a'), header)

  const throwingStat = {
    stat: async () => { throw new Error('boom') },
    list: async () => [{ header }],
  }
  assert.deepEqual(await findHeader(throwingStat, 'session-a'), header)
  assert.equal(await findHeader({ list: async () => [] }, 'session-a'), undefined)
})

test('locateLogPath refuses a backend without locate', () => {
  assert.equal(locateLogPath({ locate: () => ({ path: 'C:\\a\\b.zstd' }) }, header), 'C:\\a\\b.zstd')
  assert.throws(() => locateLogPath({}, header), /不支持/)
  assert.throws(() => locateLogPath({ locate: () => undefined }, header), /日志路径/)
})

function fakeCache(bindOnWrite: boolean) {
  const bound = new Set<string>()
  const key = (identity: unknown): string => JSON.stringify(identity)
  const cache = {
    written: 0,
    coldSnapshot(candidate: { id: string; cwd?: string; version?: number; createdAt?: number }, _cut: number, events: readonly unknown[]) {
      cache.written += 1
      if (events.length >= 0 && bindOnWrite) bound.add(candidate.id + '@' + key({ formatVersion: candidate.version, createdAt: candidate.createdAt, cwd: candidate.cwd, isSeeded: false, inheritedEventCount: 0 }))
    },
    recordFor(id: string, identity: unknown) {
      // Only rows written under this identity are visible.
      return bound.has(id + '@' + key(identity)) ? { rows: { title: { ver: 1, seq: 0, val: 'hi' } } } : undefined
    },
    cachedSnapshot() { return undefined },
    async put(id: string, identity: unknown) {
      bound.add(id + '@' + key(identity))
    },
  }
  return cache
}

test('folds the log through the documented cold path and confirms the new identity', async () => {
  const cache = fakeCache(true)
  const host = {
    get(name: string) {
      if (name === 'sessionProjectionCache') return cache
      if (name === 'sessionQuery') return { readSession: async () => ({ session: header, inheritedEventCount: 0, events: [] }) }
      return undefined
    },
  }
  assert.equal(await rebindProjectionCache(host, header, { ...header, cwd: 'C:\\old' }), 'folded')
  assert.equal(cache.written, 1)
})

test('falls back to re-tagging the previous checkpoint when the log cannot be re-read', async () => {
  const cache = fakeCache(false)
  const oldHeader = { ...header, cwd: 'C:\\old' }
  const rows = { title: { ver: 1, seq: 0, val: 'hi' } }
  const identityOfOld = JSON.stringify({ formatVersion: 4, createdAt: 1, cwd: 'C:\\old', isSeeded: false, inheritedEventCount: 0 })
  let retagged = false
  const tagger = {
    recordFor: (id: string, identity: unknown) => {
      if (id !== 'session-a') return undefined
      if (retagged) return { rows }
      return JSON.stringify(identity) === identityOfOld ? { rows } : undefined
    },
    put: async () => { retagged = true },
    cachedSnapshot: () => undefined,
  }
  const host = { get: (name: string) => name === 'sessionProjectionCache' ? tagger : undefined }
  assert.equal(await rebindProjectionCache(host, header, oldHeader), 'retagged')
})

test('reports unavailable without a projection cache and bound when already correct', async () => {
  assert.equal(await rebindProjectionCache({ get: () => undefined }, header, header), 'unavailable')

  const already = { recordFor: () => ({ rows: {} }) }
  const host = { get: (name: string) => name === 'sessionProjectionCache' ? already : undefined }
  assert.equal(await rebindProjectionCache(host, header, header), 'bound')
})
