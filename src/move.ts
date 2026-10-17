import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib'
import type { StoredSessionHeader } from './persistence.ts'
import { locateLogPath, type SessionPersistenceLike } from './persistence.ts'

const ZSTD_MAGIC = 0xfd2fb528
const LF = 0x0a

/** Byte length of the leading zstd frame (the one carrying the header line). */
export function firstFrameEnd(buf: Buffer): number {
  if (buf.length < 4 || buf.readUInt32LE(0) !== ZSTD_MAGIC) throw new Error('会话日志不是 zstd 格式')
  let offset = 4
  const descriptor = buf.readUInt8(offset++)
  const contentSizeFlag = descriptor >>> 6
  const singleSegment = (descriptor & 32) !== 0
  const checksum = (descriptor & 4) !== 0
  const dictFlag = descriptor & 3
  const dictBytes = dictFlag === 3 ? 4 : dictFlag
  const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : (1 << contentSizeFlag)
  offset += (singleSegment ? 0 : 1) + dictBytes + contentSizeBytes
  for (;;) {
    if (buf.length - offset < 3) throw new Error('会话日志帧头被截断')
    const blockHeader = buf.readUIntLE(offset, 3)
    offset += 3
    const lastBlock = (blockHeader & 1) !== 0
    const blockType = (blockHeader >>> 1) & 3
    const blockSize = blockHeader >>> 3
    const payloadBytes = blockType === 1 ? 1 : blockSize
    if (buf.length - offset < payloadBytes) throw new Error('会话日志帧内容被截断')
    offset += payloadBytes
    if (lastBlock) break
  }
  if (checksum) offset += 4
  if (offset > buf.length) throw new Error('会话日志帧长度超出文件范围')
  return offset
}

interface ParsedLog {
  buf: Buffer
  /** Byte length of the first frame. */
  end: number
  /** Decompressed first frame. */
  plain: Buffer
  /** Offset of the first newline in `plain`. */
  lineEnd: number
  header: StoredSessionHeader
}

/** Decode and validate the header line of one generation log. Read-only. */
function parseLog(filePath: string, expectedId: string): ParsedLog {
  const buf = readFileSync(filePath)
  const end = firstFrameEnd(buf)
  const plain = zstdDecompressSync(buf.subarray(0, end))
  const lineEnd = plain.indexOf(LF)
  if (lineEnd < 0) throw new Error('会话日志缺少头行: ' + filePath)
  let header: unknown
  try {
    header = JSON.parse(plain.subarray(0, lineEnd).toString('utf8'))
  } catch {
    throw new Error('会话日志头行不是合法 JSON: ' + filePath)
  }
  if (typeof header !== 'object' || header === null || String((header as { id?: unknown }).id) !== expectedId) {
    throw new Error('会话日志头行与会话 ID 不匹配: ' + filePath)
  }
  const record = header as StoredSessionHeader
  if (typeof record.version !== 'number') throw new Error('会话日志头行缺少格式版本: ' + filePath)
  return { buf, end, plain, lineEnd, header: record }
}

/**
 * Read the header of one generation log without writing anything.
 *
 * Used as the pre-flight of a move: every check that can reject a file runs
 * before the directory is renamed, so a rejected move never leaves the session
 * half-relocated.
 */
export function readHeaderLine(filePath: string, expectedId: string): StoredSessionHeader {
  return parseLog(filePath, expectedId).header
}

/**
 * Replace only the first line (the JSON header) of a zstd JSONL session log.
 *
 * The first frame may carry more than the header line; whatever follows the
 * header inside that frame is re-emitted verbatim so no event is ever dropped
 * when the frame is recompressed.
 */
export function rewriteHeaderCwd(filePath: string, expectedId: string, cwd: string): void {
  const { buf, end, plain, lineEnd, header } = parseLog(filePath, expectedId)
  header.cwd = cwd
  const rewritten = Buffer.concat([Buffer.from(JSON.stringify(header) + '\n', 'utf8'), plain.subarray(lineEnd + 1)])
  const out = Buffer.concat([zstdCompressSync(rewritten), buf.subarray(end)])
  const tmp = filePath + '.tmp-' + process.pid + '-' + Date.now()
  writeFileSync(tmp, out)
  try {
    renameSync(tmp, filePath)
  } catch {
    // Never unlink the log before the replacement is in place: overwrite in
    // place instead, so a failure can never lose the session.
    writeFileSync(filePath, out)
    rmSync(tmp, { force: true })
  }
}

export interface MoveArtifactsResult {
  /** Directory that used to hold the log. */
  from: string
  /** Directory that holds it now. */
  to: string
  /** Format generations whose header was rewritten. */
  rewritten: number
}

/** Canonical format-generation log names: `session.jsonl.zstd`, `session.v4.jsonl.zstd`, ... */
const GENERATION_LOG = /^session(?:\.v[1-9]\d*)?\.jsonl(?:\.[a-z0-9]+)?$/

/** Every format generation in one session directory, as absolute paths. */
function generationLogs(dir: string): string[] {
  return readdirSync(dir).filter(name => GENERATION_LOG.test(name)).map(name => join(dir, name))
}

/**
 * Move one session's artifact directory to the layout its new `cwd` implies and
 * rewrite the stored header to that `cwd`.
 *
 * The directory rename keeps every sibling artifact (the log generations and
 * the backend's lock file) together; only the header line inside each log is
 * rewritten. Every generation is validated *before* the rename — a session that
 * was never re-opened may still sit at an older generation, and leaving any of
 * them on the old `cwd` would let a later migration move the session back.
 */
export function moveSessionArtifacts(
  persistence: SessionPersistenceLike,
  oldHeader: StoredSessionHeader,
  newHeader: StoredSessionHeader,
): MoveArtifactsResult {
  if (oldHeader.cwd === undefined) throw new Error('该会话没有 cwd，无法移动')
  if (newHeader.cwd === undefined) throw new Error('目标路径为空')
  const oldFile = locateLogPath(persistence, oldHeader)
  const newFile = locateLogPath(persistence, newHeader)
  const oldDir = dirname(oldFile)
  const newDir = dirname(newFile)
  if (oldFile === newFile) return { from: oldDir, to: newDir, rewritten: 0 }
  if (oldDir === newDir) throw new Error('目标路径与当前路径解析到了同一会话目录')
  if (!existsSync(oldDir)) throw new Error('会话日志目录不存在: ' + oldDir)
  if (existsSync(newDir)) throw new Error('目标位置已存在同名会话目录: ' + newDir)

  const logs = generationLogs(oldDir)
  if (logs.length === 0) throw new Error('会话目录里没有可改写的日志: ' + oldDir)
  for (const file of logs) readHeaderLine(file, newHeader.id)

  mkdirSync(dirname(newDir), { recursive: true })
  renameSync(oldDir, newDir)
  const done: string[] = []
  try {
    for (const name of readdirSync(newDir)) {
      if (!GENERATION_LOG.test(name)) continue
      const file = join(newDir, name)
      rewriteHeaderCwd(file, newHeader.id, newHeader.cwd)
      done.push(file)
    }
  } catch (error) {
    // Undo the partial rewrite first, then the rename: a failure must leave the
    // session exactly where it was, not half-relocated.
    for (const file of done) {
      try { rewriteHeaderCwd(file, newHeader.id, oldHeader.cwd) } catch { /* best effort */ }
    }
    try { renameSync(newDir, oldDir) } catch { /* keep the moved directory rather than lose it */ }
    throw error
  }
  return { from: oldDir, to: newDir, rewritten: done.length }
}
