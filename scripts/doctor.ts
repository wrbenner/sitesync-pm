/**
 * scripts/doctor.ts — single-command dev-environment self-diagnostic.
 *
 * Run when something feels weird or you're new to the repo:
 *
 *   npm run doctor
 *
 * Reports a green/red checklist for every common failure mode in this
 * repo's dev loop. When something is red, prints the fix command (or
 * offers to run it for you with --fix).
 *
 * Reference: docs/audits/DEV_DOCTOR_RECEIPT_2026-05-10.md
 *
 * Note on execSync: this is a maintenance script run only by Walker /
 * CI; all command inputs are hardcoded constants. The execFileNoThrow
 * helper in src/utils/ is for browser surfaces taking user input — not
 * applicable here.
 */

import { execSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = resolve(__dirname, '..')

interface CheckResult {
  name: string
  ok: boolean
  detail: string
  fix?: string
}

const args = new Set(process.argv.slice(2))
const QUIET = args.has('--quiet')
const FIX = args.has('--fix')
const JSON_OUT = args.has('--json')

function sh(command: string, cwd = REPO_ROOT): string {
  try {
    return execSync(command, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim()
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer }
    return (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '')
  }
}

// ── Checks ──────────────────────────────────────────────────────────────────

function checkNotInIcloud(): CheckResult {
  const inIcloud =
    REPO_ROOT.includes('/Library/Mobile Documents/') ||
    REPO_ROOT.includes('/Desktop/') ||
    REPO_ROOT.includes('/Documents/')
  return {
    name: 'Repo NOT in iCloud Drive',
    ok: !inIcloud,
    detail: inIcloud
      ? `Repo is at ${REPO_ROOT} — iCloud will regenerate * N.ext duplicates`
      : `Repo at ${REPO_ROOT}`,
    fix: inIcloud ? 'bash scripts/relocate-out-of-icloud.sh' : undefined,
  }
}

function checkHuskyInstalled(): CheckResult {
  const hookPath = resolve(REPO_ROOT, '.husky/pre-commit')
  const exists = existsSync(hookPath)
  if (!exists) {
    return {
      name: 'Husky pre-commit hook installed',
      ok: false,
      detail: '.husky/pre-commit not found',
      fix: 'npm install',
    }
  }
  const stat = statSync(hookPath)
  const executable = (stat.mode & 0o111) !== 0
  return {
    name: 'Husky pre-commit hook installed',
    ok: executable,
    detail: executable
      ? '.husky/pre-commit present + executable'
      : '.husky/pre-commit present but not executable',
    fix: executable ? undefined : 'chmod +x .husky/pre-commit',
  }
}

function checkLintStagedConfig(): CheckResult {
  const path = resolve(REPO_ROOT, '.lintstagedrc.json')
  return {
    name: 'lint-staged config present',
    ok: existsSync(path),
    detail: existsSync(path) ? '.lintstagedrc.json found' : '.lintstagedrc.json missing',
    fix: existsSync(path) ? undefined : 'See PR #401 for canonical config',
  }
}

function checkNoIcloudDuplicates(): CheckResult {
  const out = sh(
    'find . -type f -name "* [0-9].*" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.worktrees/*" 2>/dev/null | wc -l',
  )
  const count = parseInt(out.trim(), 10) || 0
  return {
    name: 'No iCloud duplicates in working tree',
    ok: count === 0,
    detail: count === 0 ? 'Zero duplicates' : `${count} duplicates polluting working tree`,
    fix: count > 0 ? 'bash scripts/cleanup-icloud-duplicates.sh' : undefined,
  }
}

function checkBranchProtection(): CheckResult {
  const out = sh(
    "gh api repos/wrbenner/sitesync-pm/branches/main/protection --jq '.required_status_checks.contexts | length' 2>&1",
  )
  const count = parseInt(out.trim(), 10)
  if (Number.isNaN(count)) {
    return {
      name: 'Branch protection on main',
      ok: false,
      detail: `Could not read protection: ${out.slice(0, 80)}`,
      fix: 'gh auth login + verify repo permissions',
    }
  }
  return {
    name: 'Branch protection on main',
    ok: count >= 6,
    detail: `${count} required status checks configured`,
    fix:
      count < 6
        ? 'Update branch protection in GitHub UI; expected 6+ checks (Gate 1-4 + Eval Layer 1-2)'
        : undefined,
  }
}

function checkStaleAutoBranches(): CheckResult {
  const out = sh('bash scripts/sweep-stale-auto-branches.sh --dry-run 2>&1 | grep "stale branches"')
  const match = /stale branches.*: (\d+)/.exec(out)
  const count = match ? parseInt(match[1], 10) : 0
  return {
    name: 'Stale auto/* branches',
    ok: count <= 5,
    detail:
      count === 0
        ? 'Zero stale auto-worker branches'
        : `${count} stale branches (>7d, no open PR)`,
    fix: count > 5 ? 'bash scripts/sweep-stale-auto-branches.sh   # then drop --dry-run' : undefined,
  }
}

function checkPreCommitFast(): CheckResult {
  const cacheApp = resolve(REPO_ROOT, 'node_modules/.tmp/tsconfig.app.tsbuildinfo')
  const cacheNode = resolve(REPO_ROOT, 'node_modules/.tmp/tsconfig.node.tsbuildinfo')
  const warm = existsSync(cacheApp) || existsSync(cacheNode)
  return {
    name: 'Pre-commit incremental cache warm',
    ok: warm,
    detail: warm
      ? 'tsbuildinfo cache present (pre-commit will run fast)'
      : 'tsbuildinfo cache missing (first pre-commit will be ~30s)',
    fix: warm ? undefined : 'Run `npm run typecheck` once to warm the cache',
  }
}

function checkPrStatus(): CheckResult | null {
  const branch = sh('git rev-parse --abbrev-ref HEAD')
  if (branch === 'main' || branch === 'master' || branch === 'develop') return null

  const out = sh(`gh pr list --head ${branch} --state open --limit 1 --json number 2>/dev/null`)
  const match = /"number":(\d+)/.exec(out)
  if (!match) return null

  const prNumber = match[1]
  const checks = sh(`gh pr checks ${prNumber} --required 2>&1`)
  const failedRequired = (checks.match(/\bfail\b/g) ?? []).length
  return {
    name: `PR #${prNumber} required checks`,
    ok: failedRequired === 0,
    detail:
      failedRequired === 0
        ? 'All required checks green (or pending)'
        : `${failedRequired} required check(s) failing`,
    fix:
      failedRequired > 0
        ? `gh pr checks ${prNumber}   # see which`
        : undefined,
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

function runChecks(): CheckResult[] {
  const checks: CheckResult[] = [
    checkNotInIcloud(),
    checkHuskyInstalled(),
    checkLintStagedConfig(),
    checkNoIcloudDuplicates(),
    checkBranchProtection(),
    checkStaleAutoBranches(),
    checkPreCommitFast(),
  ]
  const pr = checkPrStatus()
  if (pr) checks.push(pr)
  return checks
}

function applyFixes(results: CheckResult[]): void {
  for (const r of results) {
    if (!r.ok && r.fix) {
      // Only auto-run safe fixes — skip anything destructive.
      const safe = r.fix.startsWith('npm install') || r.fix.startsWith('chmod')
      if (!safe) {
        console.log(`  ⚠ skipping risky auto-fix: ${r.fix}`)
        continue
      }
      console.log(`  → running: ${r.fix}`)
      try {
        execSync(r.fix, { cwd: REPO_ROOT, stdio: 'inherit' })
      } catch {
        console.log(`  ✗ fix failed`)
      }
    }
  }
}

function main(): void {
  const results = runChecks()

  if (JSON_OUT) {
    console.log(JSON.stringify(results, null, 2))
    process.exit(results.some((r) => !r.ok) ? 1 : 0)
  }

  if (!QUIET) console.log('\n[doctor] dev-environment diagnostic:\n')

  for (const r of results) {
    const icon = r.ok ? '✓' : '✗'
    const colorOpen = r.ok ? '\x1b[32m' : '\x1b[31m'
    const colorClose = '\x1b[0m'
    if (!QUIET || !r.ok) {
      console.log(`  ${colorOpen}${icon}${colorClose} ${r.name}: ${r.detail}`)
      if (!r.ok && r.fix) {
        console.log(`      fix: ${r.fix}`)
      }
    }
  }

  const failures = results.filter((r) => !r.ok)
  if (FIX && failures.length > 0) {
    console.log('\n[doctor] applying safe auto-fixes...\n')
    applyFixes(results)
  }

  if (!QUIET) {
    console.log('')
    if (failures.length === 0) {
      console.log('\x1b[32m[doctor] all checks green — dev environment is healthy.\x1b[0m\n')
    } else {
      console.log(
        `\x1b[33m[doctor] ${failures.length} of ${results.length} checks need attention. Run with --fix for safe auto-fixes.\x1b[0m\n`,
      )
    }
  }

  process.exit(failures.length === 0 ? 0 : 1)
}

main()
