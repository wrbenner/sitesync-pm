/**
 * seedPersonaProject.ts — Idempotent seed helper for persona-day specs.
 *
 * Strategy:
 *   1. If SUPABASE_SERVICE_ROLE_KEY is set, POST a deterministic seed
 *      bundle to a test-only RPC at the supabase project URL. The seed
 *      bundle lives at __fixtures__/personaSeed.json and mirrors
 *      supabase/seed/avery-oaks.sql.
 *   2. Otherwise, return null — callers should already have called
 *      requireServiceRoleOrSkip() before reaching here.
 *
 * Idempotency: the test-only RPC is responsible for upserting on
 * project.code; reruns must not duplicate rows. If no RPC exists, the
 * helper falls back to logging seed_unavailable and returning null.
 *
 * Tab C constraint: this helper does NOT call into src/ — it talks to
 * Supabase directly via fetch.
 */
import * as fs from 'fs'
import * as path from 'path'
import { hasServiceRole } from './personaAuth'

const SEED_PATH = path.resolve(
  process.cwd(),
  'e2e/personas/__fixtures__/personaSeed.json',
)

export interface SeedResult {
  projectId: string
  projectCode: string
  /** True when the seed RPC accepted the bundle; false when it was skipped. */
  applied: boolean
  /** Raw response message for logs; never thrown. */
  message: string
}

const NAMESPACE = `personas-${Date.now()}`

export async function seedPersonaProject(): Promise<SeedResult | null> {
  if (!hasServiceRole()) return null
  if (!fs.existsSync(SEED_PATH)) return null

  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'))
  const url =
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    'https://hypxrmcppjfbtlwuoafc.supabase.co'
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ??
    ''

  try {
    const res = await fetch(`${url}/rest/v1/rpc/seed_persona_project`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ namespace: NAMESPACE, seed }),
    })
    if (!res.ok) {
      return {
        projectId: seed.project.id,
        projectCode: seed.project.code,
        applied: false,
        message: `seed RPC returned ${res.status}; treating as expected_unwired`,
      }
    }
    return {
      projectId: seed.project.id,
      projectCode: seed.project.code,
      applied: true,
      message: 'seed RPC accepted',
    }
  } catch (err) {
    return {
      projectId: seed.project.id,
      projectCode: seed.project.code,
      applied: false,
      message: `seed RPC unreachable: ${(err as Error).message}`,
    }
  }
}

export async function teardownPersonaProject(_namespace = NAMESPACE): Promise<void> {
  // No-op today. The seed RPC is expected to namespace via the supplied
  // namespace argument; teardown is a no-op so reruns don't fail when
  // the RPC isn't installed.
}
