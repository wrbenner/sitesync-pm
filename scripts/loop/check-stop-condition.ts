#!/usr/bin/env tsx
/**
 * check-stop-condition.ts — evaluate the 4 stop-condition checks for the
 * functional-frog self-heal loop and update .agent/loop-state.json.
 *
 * Stop when ALL hold:
 *   1. two_consecutive_passes — last 2 iterations both fully green
 *   2. coverage_threshold_met — coverage_percent >= coverage_target_percent
 *   3. no_stale_loop_issues   — no loop-opened GH issue waiting > 7 days
 *   4. cost_budget_intact     — cost_today_usd < cost_cap_usd_per_day
 *
 * Exit codes:
 *   0  = continue looping
 *   10 = stop (mission_complete)
 *   11 = stop (cost_paused)
 *
 * Uses execFileSync (no shell) to call gh; validates inputs.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../..')
const STATE_PATH = resolve(REPO_ROOT, '.agent/loop-state.json')
const MATRIX_PATH = resolve(REPO_ROOT, 'ops/coverage/MASTER_MATRIX.md')

interface LoopState {
  consecutive_passes: number
  iterations: number
  stop_reason: string | null
  stop_condition_checks: {
    two_consecutive_passes: boolean
    coverage_threshold_met: boolean
    no_stale_loop_issues: boolean
    cost_budget_intact: boolean
  }
  cost_today_usd: number
  cost_cap_usd_per_day: number
  cost_pause_until: string | null
  coverage_percent: number
  coverage_target_percent: number
  issue_queue: { open_issues_from_loop: string[]; stale_threshold_days: number }
}

function readState(): LoopState {
  return JSON.parse(readFileSync(STATE_PATH, 'utf-8')) as LoopState
}

function writeState(s: LoopState): void {
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2) + '\n', 'utf-8')
}

function computeCoveragePercent(): number {
  const md = readFileSync(MATRIX_PATH, 'utf-8')
  const tableStart = md.indexOf('### Baseline coverage by sub-suite')
  if (tableStart === -1) return 0
  const after = md.slice(tableStart)
  const totalRx = /\|\s*\*\*Total baselines\*\*[^|]*\|[^|]*\|[^~]*~([\d,]+)/i
  const m = totalRx.exec(after)
  if (!m) return 0
  const covered = parseInt(m[1].replace(/,/g, ''), 10)
  const inScope = 31_744
  return Math.round((covered / inScope) * 1000) / 10
}

function countStaleLoopIssues(staleThresholdDays: number): number {
  try {
    const raw = execFileSync(
      'gh',
      [
        'issue',
        'list',
        '--repo',
        'wrbenner/sitesync-pm',
        '--label',
        'loop-detected',
        '--state',
        'open',
        '--json',
        'number,createdAt',
        '--limit',
        '100',
      ],
      { encoding: 'utf-8' },
    )
    const issues = JSON.parse(raw) as Array<{ number: number; createdAt: string }>
    const cutoff = Date.now() - staleThresholdDays * 86_400_000
    return issues.filter((i) => new Date(i.createdAt).getTime() < cutoff).length
  } catch {
    return 0
  }
}

function main(): void {
  const state = readState()

  const twoPass = state.consecutive_passes >= 2

  const coverage = computeCoveragePercent()
  state.coverage_percent = coverage
  const coverageMet = coverage >= state.coverage_target_percent

  const stale = countStaleLoopIssues(state.issue_queue.stale_threshold_days)
  const noStale = stale === 0

  const budgetOk = state.cost_today_usd < state.cost_cap_usd_per_day

  state.stop_condition_checks = {
    two_consecutive_passes: twoPass,
    coverage_threshold_met: coverageMet,
    no_stale_loop_issues: noStale,
    cost_budget_intact: budgetOk,
  }

  if (twoPass && coverageMet && noStale && budgetOk) {
    state.stop_reason = 'mission_complete'
    writeState(state)
    console.log('STOP: mission_complete')
    process.exit(10)
  }

  if (!budgetOk && state.cost_pause_until == null) {
    const tomorrow = new Date()
    tomorrow.setUTCHours(24, 0, 0, 0)
    state.cost_pause_until = tomorrow.toISOString()
    writeState(state)
    console.log(`STOP: cost_paused until ${state.cost_pause_until}`)
    process.exit(11)
  }

  writeState(state)
  console.log(
    `CONTINUE: pass=${state.consecutive_passes}/2 cov=${coverage}/${state.coverage_target_percent}% stale=${stale} budget=${state.cost_today_usd}/${state.cost_cap_usd_per_day}USD`,
  )
}

main()
