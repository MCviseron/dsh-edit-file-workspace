#!/usr/bin/env node
/**
 * Record the host contract fingerprints of one DSH release in docs/dsh-compat.json.
 *
 * Run this after verifying a new DSH desktop build end to end (see
 * docs/dsh-compat.md): it downloads that release's published host bundles,
 * hashes the files this plugin depends on, and appends the version to
 * `verifiedVersions` so scripts/check-dsh-version.mjs can answer "compatible"
 * without downloading anything again.
 *
 * Usage: node scripts/fingerprint-dsh-compat.mjs <version> [--label "text"]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { BASELINE_FILE, fetchPackageFiles, sha } from './compat-lib.mjs'

const TRACKED = {
  'dsh-workspace': ['lib/index.js'],
  'dsh-session-persistence': ['lib/index.js'],
  'dsh-session-persistence-jsonl': ['lib/index.js'],
  'dsh-session-projection-cache': ['lib/index.js'],
  'dsh-session-query': ['lib/index.js'],
  'dsh-api-session-controller': ['lib/types/list.js'],
  'dsh-host-webserver': ['lib/index.js'],
  'dsh-session': ['lib/index.js'],
  'dsh-client-store': ['lib/index.js'],
  'dsh-client-ui-slots': ['lib/client.js'],
  'dsh-client-locale': ['lib/client.js'],
}

const version = process.argv[2]
if (version === undefined || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error('usage: node scripts/fingerprint-dsh-compat.mjs <version> [--label "text"]')
  process.exit(2)
}
const labelAt = process.argv.indexOf('--label')
const label = labelAt >= 0 ? process.argv[labelAt + 1] : `DSH desktop ${version}`

const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'))
const fingerprints = {}
const missing = []

for (const [pkg, files] of Object.entries(TRACKED)) {
  const tarball = await fetchPackageFiles(pkg, version)
  for (const file of files) {
    const body = tarball.get('package/' + file)
    if (body === undefined) {
      missing.push(`${pkg}/${file}`)
      continue
    }
    fingerprints[`${pkg}/${file}`] = sha(body)
  }
}

if (missing.length > 0) {
  console.error(`not published in ${version}: ${missing.join(', ')}`)
  process.exit(1)
}

baseline.verifiedVersions = [...new Set([...baseline.verifiedVersions, version])].sort()
baseline.fingerprints[version] = fingerprints
baseline.desktop = { ...baseline.desktop, [version]: label }
writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n')
console.log(`recorded ${Object.keys(fingerprints).length} fingerprints for ${version}`)
