/**
 * findings.ts — Append a structured finding to audit/persona-blockers.md.
 *
 * Findings have four kinds:
 *   - expected_unwired: a documented gap (cite docs/STATUS.md)
 *   - regression_candidate: a flow that should work but doesn't
 *   - seed_unavailable: SUPABASE_SERVICE_ROLE_KEY missing for seeded persona
 *   - cron_unavailable: CRON_SECRET missing for cron-triggered tests
 *
 * The file is append-only. The CI job MUST NOT fail on expected_unwired,
 * seed_unavailable, or cron_unavailable rows — only on regression_candidate
 * (which is itself a soft signal; loud failures live in test.fail / expect).
 */
import * as fs from 'fs'
import * as path from 'path'

export type FindingKind =
  | 'expected_unwired'
  | 'regression_candidate'
  | 'seed_unavailable'
  | 'cron_unavailable'

export interface Finding {
  persona: string
  step: string
  kind: FindingKind
  citation: string
  notes?: string
}

const BLOCKERS_PATH = path.resolve(process.cwd(), 'audit/persona-blockers.md')
const HEADER = `# Persona Blockers

This file is **append-only**. It catalogs friction discovered while running
the persona-day audit specs in \`e2e/personas/\`. Tab C is observational;
nothing here is a bug to fix in this wave — fixes happen in later waves
once the wiring backlog in [docs/STATUS.md](../docs/STATUS.md) is closed.

## Finding kinds

- \`expected_unwired\` — feature exists in the repo but a wire is missing
  (route, component mount, service call, cron). Cites \`docs/STATUS.md\`.
- \`regression_candidate\` — a flow that previously worked breaks; needs
  triage.
- \`seed_unavailable\` — \`SUPABASE_SERVICE_ROLE_KEY\` not set; the persona
  test couldn't seed required state.
- \`cron_unavailable\` — \`CRON_SECRET\` not set; couldn't trigger an
  edge-fn cron handler.

## Findings

| Persona | Step | Kind | Citation | Notes |
| --- | --- | --- | --- | --- |
`

function ensureHeader(): void {
  if (!fs.existsSync(BLOCKERS_PATH)) {
    fs.mkdirSync(path.dirname(BLOCKERS_PATH), { recursive: true })
    fs.writeFileSync(BLOCKERS_PATH, HEADER, 'utf8')
  }
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

export function logFinding(f: Finding): void {
  ensureHeader()
  const row = `| ${escapeCell(f.persona)} | ${escapeCell(f.step)} | ${f.kind} | ${escapeCell(f.citation)} | ${escapeCell(f.notes ?? '')} |\n`
  fs.appendFileSync(BLOCKERS_PATH, row, 'utf8')
}

export function logFindingOnce(f: Finding): void {
  ensureHeader()
  const existing = fs.readFileSync(BLOCKERS_PATH, 'utf8')
  const sig = `| ${escapeCell(f.persona)} | ${escapeCell(f.step)} | ${f.kind} |`
  if (existing.includes(sig)) return
  logFinding(f)
}
