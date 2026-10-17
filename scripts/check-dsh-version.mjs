#!/usr/bin/env node
/**
 * Check whether this plugin still matches the DeepSeek Harness it runs on.
 *
 * The plugin reaches the host through a small, explicit API surface
 * (`ctx.sessionPersistence.list/stat/locate`, `ctx.workspaceRegistry`,
 * `ctx.sessionProjectionCache`, `ctx.sessionQuery.readSession`,
 * `ctx.webServer.register`). Those live in `lib/` bundles that ship inside the
 * desktop app, so "is it still compatible?" is a byte question, not a version
 * question: we fingerprint the exact files and compare.
 *
 * Verdicts (also the exit code):
 *   0  compatible      — every tracked file matches a verified release
 *   2  widen-ranges    — new release, contracts byte-identical → only widen peer ranges
 *   3  review-required — a tracked contract file changed → read the diff before shipping
 *   1  check-failed    — the feed, npm or the install could not be read
 *
 * Usage:
 *   node scripts/check-dsh-version.mjs [--json] [--no-download] [--channel nightly]
 *                                      [--installed <version>] [--app-dir <dir>]
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BASELINE_FILE, fetchPackageFiles, latestFromFeed, sha } from './compat-lib.mjs'

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const option = (name, fallback) => {
  const at = argv.indexOf(name)
  return at >= 0 && argv[at + 1] !== undefined ? argv[at + 1] : fallback
}

function installedVersion(appDir) {
  const candidates = [
    join(appDir, '..', '..', 'dsh-runtimes', 'dsh-primary-runtime', 'runtime.json'),
    join(process.env.DSH_HOME ?? '.', 'dsh-runtimes', 'dsh-primary-runtime', 'runtime.json'),
  ]
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    try {
      const parsed = JSON.parse(readFileSync(candidate, 'utf8'))
      if (typeof parsed.desktopVersion === 'string') return parsed.desktopVersion
    } catch {
      // Keep looking: a half-written runtime.json must not fail the check.
    }
  }
  return undefined
}

async function main() {
  const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'))
  const channel = option('--channel', 'nightly')
  const installed = option('--installed', installedVersion(option('--app-dir', 'D:\\DeepSeek Harness')))
  const latest = await latestFromFeed(channel)
  const verified = [...baseline.verifiedVersions]
  const reference = verified.at(-1)

  const report = { channel, installed, latest, reference, verified, verdict: 'compatible', changed: [], missing: [], exit: 0 }

  if (verified.includes(latest)) {
    report.verdict = 'compatible'
    report.exit = 0
  } else if (flag('--no-download')) {
    report.verdict = 'review-required'
    report.exit = 3
    report.changed = [`(downloads disabled: cannot fingerprint ${latest})`]
  } else {
    const expected = baseline.fingerprints[reference]
    for (const [key, hash] of Object.entries(expected)) {
      const slash = key.indexOf('/')
      const pkg = key.slice(0, slash)
      const file = key.slice(slash + 1)
      try {
        const files = await fetchPackageFiles(pkg, latest)
        const body = files.get('package/' + file)
        if (body === undefined) {
          report.missing.push(key)
          continue
        }
        if (sha(body) !== hash) report.changed.push(key)
      } catch (error) {
        report.verdict = 'check-failed'
        report.exit = 1
        report.error = String(error)
        break
      }
    }
    if (report.verdict !== 'check-failed') {
      const clean = report.changed.length === 0 && report.missing.length === 0
      report.verdict = clean ? 'widen-ranges' : 'review-required'
      report.exit = clean ? 2 : 3
    }
  }

  if (flag('--json')) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(`DSH installed  : ${installed ?? 'unknown'}`)
    console.log(`DSH latest     : ${latest} (${channel})`)
    console.log(`Verified with  : ${verified.join(', ')}`)
    console.log(`Verdict        : ${report.verdict}`)
    if (report.changed.length > 0) {
      console.log('Changed contract files:')
      for (const file of report.changed) console.log('  - ' + file)
    }
    if (report.missing.length > 0) {
      console.log('Files no longer published:')
      for (const file of report.missing) console.log('  - ' + file)
    }
    if (report.error !== undefined) console.log('Error          : ' + report.error)
    console.log(report.exit === 0
      ? '\nNo action needed: this plugin needs no change for the latest release.'
      : report.exit === 2
        ? '\nAction: widen the peer ranges, record the fingerprints, rebuild, release a patch.'
        : report.exit === 3
          ? '\nAction: read the diff for the files above before changing anything.'
          : '\nAction: fix the check environment (feed / npm / install path).')
  }
  process.exit(report.exit)
}

main().catch((error) => {
  console.error('check failed: ' + (error instanceof Error ? error.message : String(error)))
  process.exit(1)
})
