import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib'
import { firstFrameEnd, moveSessionArtifacts, rewriteHeaderCwd } from '../src/move.ts'

const ROOT = join(process.cwd(), '.tmp-test')

function scratch(name: string): string {
  const dir = join(ROOT, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Decompress a concatenation of zstd frames, one frame at a time. */
function readAllFrames(buf: Buffer): string[] {
  const frames: string[] = []
  let offset = 0
  while (offset < buf.length) {
    const end = firstFrameEnd(buf.subarray(offset))
    frames.push(zstdDecompressSync(buf.subarray(offset, offset + end)).toString('utf8'))
    offset += end
  }
  return frames
}

function headerLine(id: string, cwd: string): string {
  return JSON.stringify({ type: 'session', version: 4, id, createdAt: 1792248209090, cwd, isSeeded: false, delegationDepth: 0, agentPreset: 'standard' }) + '\n'
}

test('rewrites only the header line and keeps the following frames byte-identical', () => {
  const dir = scratch('frames')
  const file = join(dir, 'session.v4.jsonl.zstd')
  const head = zstdCompressSync(Buffer.from(headerLine('session-a', 'C:\\old')))
  const body = zstdCompressSync(Buffer.from('{"seq":0}\n{"seq":1}\n'))
  writeFileSync(file, Buffer.concat([head, body]))

  rewriteHeaderCwd(file, 'session-a', 'C:\\new')

  const frames = readAllFrames(readFileSync(file))
  assert.equal(frames.length, 2)
  assert.deepEqual(JSON.parse(frames[0].trim()), {
    type: 'session', version: 4, id: 'session-a', createdAt: 1792248209090,
    cwd: 'C:\\new', isSeeded: false, delegationDepth: 0, agentPreset: 'standard',
  })
  assert.equal(frames[1], '{"seq":0}\n{"seq":1}\n')
})

test('keeps events that share the first frame with the header', () => {
  const dir = scratch('shared-frame')
  const file = join(dir, 'session.v4.jsonl.zstd')
  writeFileSync(file, zstdCompressSync(Buffer.from(headerLine('session-b', 'C:\\old') + '{"seq":0}\n{"seq":1}\n')))

  rewriteHeaderCwd(file, 'session-b', 'D:\\moved')

  const frames = readAllFrames(readFileSync(file))
  assert.equal(frames.length, 1)
  const lines = frames[0].split('\n').filter(line => line !== '')
  assert.equal(lines.length, 3)
  assert.equal(JSON.parse(lines[0]).cwd, 'D:\\moved')
  assert.equal(lines[1], '{"seq":0}')
  assert.equal(lines[2], '{"seq":1}')
})

test('refuses a log whose header belongs to another session', () => {
  const dir = scratch('mismatch')
  const file = join(dir, 'session.v4.jsonl.zstd')
  writeFileSync(file, zstdCompressSync(Buffer.from(headerLine('session-c', 'C:\\old'))))
  assert.throws(() => rewriteHeaderCwd(file, 'session-other', 'C:\\new'), /不匹配/)
})

test('refuses a log without a format version', () => {
  const dir = scratch('no-version')
  const file = join(dir, 'session.v4.jsonl.zstd')
  writeFileSync(file, zstdCompressSync(Buffer.from(JSON.stringify({ id: 'session-d', cwd: 'C:\\old' }) + '\n')))
  assert.throws(() => rewriteHeaderCwd(file, 'session-d', 'C:\\new'), /格式版本/)
})

function fakePersistence(root: string) {
  const encode = (cwd: string): string => '--' + cwd.replace(/[\\:]/g, '-') + '--'
  return {
    async list() { return [] },
    locate(header: { id: string; cwd?: string }) {
      return { path: join(root, encode(header.cwd ?? ''), 'session-' + header.id, 'session.v4.jsonl.zstd') }
    },
  }
}

test('moves the artifact directory and rewrites the stored cwd', () => {
  const root = scratch('artifacts')
  const persistence = fakePersistence(root)
  const oldHeader = { id: 'session-e', cwd: 'C:\\from' }
  const newHeader = { id: 'session-e', cwd: 'C:\\to' }
  const fromFile = persistence.locate(oldHeader).path
  mkdirSync(dirname(fromFile), { recursive: true })
  writeFileSync(fromFile, zstdCompressSync(Buffer.from(headerLine('session-e', 'C:\\from'))))

  const moved = moveSessionArtifacts(persistence, oldHeader, newHeader)

  assert.equal(existsSync(fromFile), false)
  assert.equal(existsSync(moved.from), false)
  const toFile = persistence.locate(newHeader).path
  assert.equal(existsSync(toFile), true)
  assert.equal(JSON.parse(readAllFrames(readFileSync(toFile))[0].trim()).cwd, 'C:\\to')
})

test('refuses to overwrite an existing target directory', () => {
  const root = scratch('collision')
  const persistence = fakePersistence(root)
  const oldHeader = { id: 'session-f', cwd: 'C:\\from' }
  const newHeader = { id: 'session-f', cwd: 'C:\\to' }
  for (const header of [oldHeader, newHeader]) {
    const file = persistence.locate(header).path
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, zstdCompressSync(Buffer.from(headerLine('session-f', header.cwd))))
  }
  assert.throws(() => moveSessionArtifacts(persistence, oldHeader, newHeader), /已存在/)
})

test('same resolved path is a no-op', () => {
  const root = scratch('noop')
  const persistence = fakePersistence(root)
  const header = { id: 'session-g', cwd: 'C:\\same' }
  const file = persistence.locate(header).path
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, zstdCompressSync(Buffer.from(headerLine('session-g', 'C:\\same'))))
  const moved = moveSessionArtifacts(persistence, header, { ...header })
  assert.equal(moved.from, moved.to)
  assert.equal(existsSync(file), true)
})
