/**
 * personaAuth.ts — Resolve a Playwright storageState file per persona.
 *
 * For now, every persona reuses e2e/.auth/state.json (the single signed-in
 * superintendent session). Role-switching personas (PM vs Compliance vs IT
 * admin) require server-side seeding to flip the user's project_role —
 * which depends on SUPABASE_SERVICE_ROLE_KEY. When that env var is unset,
 * the persona test should call requireServiceRoleOrSkip() to skip with
 * kind=seed_unavailable.
 *
 * Two-context tests (presence/conflict) clone the same state for both
 * contexts; in real deployment they'd use separate accounts, but the
 * presence machinery is observable from a single account writing twice.
 */
import * as path from 'path'
import * as fs from 'fs'
import { test, type TestInfo } from '@playwright/test'
import { logFindingOnce } from './findings'

export const STATE_PATH = path.resolve(process.cwd(), 'e2e/.auth/state.json')

export type PersonaRole =
  | 'super'
  | 'pm'
  | 'compliance'
  | 'owner'
  | 'it-admin'

export function authStateFor(_role: PersonaRole): string {
  // Single shared storage state today. Role differentiation lives in
  // server-side seed (see seedPersonaProject.ts).
  return STATE_PATH
}

export function hasServiceRole(): boolean {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  )
}

export function hasCronSecret(): boolean {
  return Boolean(process.env.CRON_SECRET)
}

/**
 * Skip the surrounding test with a logged finding when we lack the
 * service-role key needed to seed the persona's project shape.
 */
export function requireServiceRoleOrSkip(
  persona: string,
  step: string,
  citation = 'docs/PERSONA_AUDIT.md (seeding)',
): void {
  if (hasServiceRole()) return
  logFindingOnce({
    persona,
    step,
    kind: 'seed_unavailable',
    citation,
    notes: 'SUPABASE_SERVICE_ROLE_KEY not set in test env',
  })
  test.skip(true, `seed_unavailable: ${persona} :: ${step}`)
}

export function requireCronSecretOrSkip(
  persona: string,
  step: string,
  citation = 'docs/STATUS.md (Cron schedules)',
): void {
  if (hasCronSecret()) return
  logFindingOnce({
    persona,
    step,
    kind: 'cron_unavailable',
    citation,
    notes: 'CRON_SECRET not set in test env',
  })
  test.skip(true, `cron_unavailable: ${persona} :: ${step}`)
}

/** Confirm the auth state file exists. */
export function ensureAuthStateExists(_info?: TestInfo): boolean {
  return fs.existsSync(STATE_PATH)
}
