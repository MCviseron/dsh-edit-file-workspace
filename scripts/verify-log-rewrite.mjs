/**
 * Verify the session-log header rewrite against a real DSH log.
 *
 * Copies the log into a scratch directory, rewrites only the header line, and
 * proves the result is byte-identical apart from that line: same frame count,
 * same decompressed payload after the header, every JSONL line still parses.
 *
 * Usage: node --experimental-strip-types scripts/verify-log-rewrite.mjs <log> [...more]
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'
import { firstFrameEnd, rewriteHeaderCwd } from '../src/move.ts'

const SCRATCH = join(process.cwd(), '.tmp-verify')

function frames(buf) {
  const out = []
  let offset = 0
  while (offset < buf.length) {
    const end = firstFrameEnd(buf.subarray(offset))
    out.push(buf.subarray(offset, offset + end))
    offset += end
  }
  return out
}

function plainTexts(buf) {
  return frames(buf).map(frame => zstdDecompressSync(frame).toString('utf8'))
}

const paths = process.argv.slice(2)
if (paths.length === 0) {
  console.error('usage: node --experimental-strip-types scripts/verify-log-rewrite.mjs <log> [...]')
  process.exit(2)
}

let failures = 0
rmSync(SCRATCH, { recursive: true, force: true })
mkdirSync(SCRATCH, { recursive: true })

for (const [index, source] of paths.entries()) {
  const before = readFileSync(source)
  const copy = join(SCRATCH, index + '-' + basename(source))
  copyFileSync(source, copy)

  const beforeFrames = plainTexts(before)
  const header = JSON.parse(beforeFrames[0].split('\n')[0])
  const target = 'D:\\__verify__\\' + index

  rewriteHeaderCwd(copy, header.id, target)

  const after = readFileSync(copy)
  const afterFrames = plainTexts(after)
  const newHeader = JSON.parse(afterFrames[0].split('\n')[0])
  const { cwd: oldCwd, ...restBefore } = header
  const { cwd: newCwd, ...restAfter } = newHeader

  const linesBefore = beforeFrames.join('').split('\n').filter(line => line !== '')
  const linesAfter = afterFrames.join('').split('\n').filter(line => line !== '')
  let parseable = true
  for (const line of linesAfter) {
    try { JSON.parse(line) } catch { parseable = false }
  }
  const headerTailBefore = beforeFrames[0].slice(beforeFrames[0].indexOf('\n'))
  const headerTailAfter = afterFrames[0].slice(afterFrames[0].indexOf('\n'))

  const checks = [
    ['frame count kept', frames(after).length === frames(before).length],
    ['later frames identical', afterFrames.slice(1).join('') === beforeFrames.slice(1).join('')],
    ['first-frame tail identical', headerTailAfter === headerTailBefore],
    ['cwd rewritten', newCwd === target && oldCwd !== newCwd],
    ['other header fields kept', JSON.stringify(restBefore) === JSON.stringify(restAfter)],
    ['JSONL line count kept', linesBefore.length === linesAfter.length],
    ['every line parses', parseable],
  ]

  const failed = checks.filter(([, ok]) => !ok).length
  failures += failed
  console.log(`\n${basename(source)}  ${statSync(source).size} B -> ${after.length} B | ${frames(before).length} frames | ${linesBefore.length} lines | cwd ${oldCwd} -> ${newCwd}`)
  for (const [name, ok] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`)
}

rmSync(SCRATCH, { recursive: true, force: true })
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
