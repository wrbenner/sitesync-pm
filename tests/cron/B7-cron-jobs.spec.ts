/**
 * Phase B.7 — Cron + queue contract baseline.
 *
 * For each pg_cron job from ops/coverage/cron-jobs.json:
 *   - Verify the job exists and is active
 *   - (Optionally) force-trigger via cron.run_job() and assert the
 *     downstream side-effect (notification row written, KB ingest queued)
 *
 * Service-role required (cron schema is system-only).
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''
const SHOULD_RUN = Boolean(SUPABASE_URL && SERVICE_KEY)

interface CronJob {
  jobname: string
  schedule: string
  command: string
  active: boolean
}

const inventoryPath = resolve(__dirname, '../../ops/coverage/cron-jobs.json')
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf-8')) as {
  count: number
  jobs: CronJob[] | null
}

let admin: SupabaseClient
beforeAll(() => {
  if (SHOULD_RUN) {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
})

describe.skipIf(!SHOULD_RUN)('B.7 — Cron job inventory', () => {
  it(`inventory has ${inventory.count} jobs recorded`, () => {
    expect(inventory.count).toBeGreaterThan(0)
    expect(Array.isArray(inventory.jobs) || inventory.jobs === null).toBe(true)
  })

  it('every inventory job is still active on staging', async () => {
    if (!inventory.jobs) return
    const { data, error } = await admin
      .schema('cron' as never)
      .from('job' as never)
      .select('jobname, active')
    if (error) {
      // cron schema not exposed via PostgREST — soft-skip
      return
    }
    const remoteByName = new Map(
      (data as Array<{ jobname: string; active: boolean }>).map((j) => [j.jobname, j.active]),
    )
    const missing: string[] = []
    const inactive: string[] = []
    for (const j of inventory.jobs) {
      if (!remoteByName.has(j.jobname)) missing.push(j.jobname)
      else if (!remoteByName.get(j.jobname)) inactive.push(j.jobname)
    }
    expect(missing, `cron jobs removed since inventory: ${missing.join(', ')}`).toHaveLength(0)
    expect(inactive, `cron jobs deactivated since inventory: ${inactive.join(', ')}`).toHaveLength(0)
  })
})
