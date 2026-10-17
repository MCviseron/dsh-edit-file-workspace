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

/**
 * Replace only the first line (the JSON header) of a zstd JSONL session log.
 *
 * The first frame may carry more than the header line; whatever follows the
 * header inside that frame is re-emitted verbatim so no event is ever dropped
 * when the frame is recompressed.
 */
export function rewriteHeaderCwd(filePath: string, expectedId: string, cwd: string): void {
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
  record.cwd = cwd
  const rewritten = Buffer.concat([Buffer.from(JSON.stringify(record) + '\n', 'utf8'), plain.subarray(lineEnd + 1)])
  const out = Buffer.concat([zstdCompressSync(rewritten), buf.subarray(end)])
  const tmp = filePath + '.tmp-' + process.pid + '-' + Date.now()
  writeFileSync(tmp, out)
  try {
    renameSync(tmp, filePath)
  } catch {
    rmSync(filePath, { force: true })
    renameSync(tmp, filePath)
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

/**
 * Rewrite the header of every format generation in one session directory.
 *
 * A session that was never re-opened may still sit at an older generation, and
 * its directory can hold several; leaving any of them on the old `cwd` would let
 * a later migration move the session back.
 */
function rewriteGenerationHeaders(dir: string, expectedId: string, cwd: string): number {
  let rewritten = 0
  for (const name of readdirSync(dir)) {
    if (!GENERATION_LOG.test(name)) continue
    rewriteHeaderCwd(join(dir, name), expectedId, cwd)
    rewritten += 1
  }
  return rewritten
}

/**
 * Move one session's artifact directory to the layout its new `cwd` implies and
 * rewrite the stored header to that `cwd`.
 *
 * The directory rename keeps every sibling artifact (the log generations and
 * the backend's lock file) together; only the header line inside each log is
 * rewritten.
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
  mkdirSync(dirname(newDir), { recursive: true })
  renameSync(oldDir, newDir)
  const rewritten = rewriteGenerationHeaders(newDir, newHeader.id, newHeader.cwd)
  if (rewritten === 0) throw new Error('移动后未找到可改写的会话日志: ' + newDir)
  return { from: oldDir, to: newDir, rewritten }
}
