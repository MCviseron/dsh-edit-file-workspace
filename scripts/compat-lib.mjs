/**
 * Shared helpers for the DSH compatibility tooling.
 *
 * Both scripts answer "can this plugin still talk to the host?" by reading the
 * published host bundles inside their npm tarballs — no DSH install required,
 * so the check works from CI and from a machine without a desktop app.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
export const BASELINE_FILE = join(ROOT, 'docs', 'dsh-compat.json')
export const CACHE_DIR = join(ROOT, '.dsh-compat-cache')
export const REGISTRY = 'https://registry.npmjs.org'
export const FEED = 'https://download.deepseek.com/dsh-desk/feeds/win-x64'

/** Minimal ustar reader: returns `Map<path, Buffer>` for regular files. */
export function untar(buffer) {
  const files = new Map()
  let offset = 0
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512)
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '')
    if (name === '') break
    const size = Number.parseInt(header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim() || '0', 8)
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '')
    const path = prefix === '' ? name : prefix + '/' + name
    const body = buffer.subarray(offset + 512, offset + 512 + size)
    if (header[156] === 48 || header[156] === 0) files.set(path, body)
    offset += 512 + Math.ceil(size / 512) * 512
  }
  return files
}

/** Files of one published `@deepseek-ai/*` package version (cached on disk). */
export async function fetchPackageFiles(pkg, version) {
  mkdirSync(CACHE_DIR, { recursive: true })
  const cache = join(CACHE_DIR, `${pkg}-${version}.tgz`)
  if (existsSync(cache)) return untar(gunzipSync(readFileSync(cache)))
  const response = await fetch(`${REGISTRY}/@deepseek-ai/${pkg}/-/${pkg}-${version}.tgz`)
  if (!response.ok) throw new Error(`${pkg}@${version}: HTTP ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  writeFileSync(cache, bytes)
  return untar(gunzipSync(bytes))
}

/** Latest version advertised by the desktop update feed. */
export async function latestFromFeed(channel) {
  const response = await fetch(`${FEED}/${channel}.yml`)
  if (!response.ok) throw new Error(`update feed: HTTP ${response.status}`)
  const match = (await response.text()).match(/^version:\s*'?([^'\n]+)'?/m)
  if (match === null) throw new Error('update feed has no version line')
  return match[1].trim()
}

/** Short, stable file hash for the baseline map. */
export function sha(buffer) {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 16)
}
