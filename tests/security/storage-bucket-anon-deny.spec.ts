/**
 * FMEA L.BUCKET.1 — Storage bucket anon-deny contract
 *
 * Hazard: a storage bucket is accidentally created with `public = true`
 *         or RLS policies that allow anon listing, exposing every
 *         tenant's uploads to the open internet.
 *
 * This complements `tests/storage/B8-storage-buckets.spec.ts` (which
 * checks inventory consistency) by performing a *live* anon-key probe
 * against every bucket reported by the staging server, regardless of
 * what the inventory says — catches drift between inventory and reality.
 *
 * Attack model:
 *   - Attacker has the public anon key (it's in every web bundle by
 *     design).
 *   - For each bucket name they can enumerate, they call
 *     `storage.from(bucket).list('')`.
 *   - If a private bucket returns rows, that's a leak.
 *
 * For public buckets, we don't assert deny — public buckets are public
 * by definition — but we do assert the bucket truly is marked public
 * server-side (a defense-in-depth check against silent flag flips).
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, ANON_KEY, shouldRun } from '../api/auth-helpers'

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''
const FULLY_WIRED = Boolean(shouldRun() && SERVICE_KEY)

interface Bucket {
  id: string
  name: string
  public: boolean
}

let admin: SupabaseClient
let anon: SupabaseClient
let buckets: Bucket[] = []

beforeAll(async () => {
  if (!FULLY_WIRED) return
  admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await admin.storage.listBuckets()
  if (error) throw new Error(`listBuckets failed: ${error.message}`)
  buckets = (data ?? []) as Bucket[]
})

describe.skipIf(!FULLY_WIRED)('FMEA L.BUCKET.1 — anon bucket access policy', () => {
  it('at least one bucket is reachable (sanity)', () => {
    expect(buckets.length).toBeGreaterThan(0)
  })

  // We define the per-bucket tests inside the suite via a runtime loop.
  // Because `buckets` is populated in beforeAll, we generate the tests
  // dynamically through a single it.each-style block.
  it('every NON-public bucket denies anon list (no rows returned)', async () => {
    const privateBuckets = buckets.filter((b) => !b.public)
    const leaks: string[] = []
    for (const bucket of privateBuckets) {
      const { data, error } = await anon.storage.from(bucket.id).list('', { limit: 1 })
      // Acceptable outcomes for a private bucket:
      //   - error returned (RLS / 401)
      //   - empty array (RLS evaluated, no rows visible)
      // Disallowed:
      //   - non-empty array (leak)
      if (!error && Array.isArray(data) && data.length > 0) {
        leaks.push(bucket.id)
      }
    }
    expect(leaks, `Private buckets leaking to anon: ${leaks.join(', ')}`).toEqual([])
  })

  it('every public bucket is genuinely flagged public server-side', async () => {
    const publicBuckets = buckets.filter((b) => b.public)
    const mismatches: string[] = []
    for (const b of publicBuckets) {
      const { data } = await admin.storage.getBucket(b.id)
      if (data && data.public !== true) {
        mismatches.push(b.id)
      }
    }
    expect(
      mismatches,
      `Buckets flagged public in list but not in getBucket: ${mismatches.join(', ')}`,
    ).toEqual([])
  })

  it('no bucket allows anon to UPLOAD a probe file', async () => {
    // Try to upload a tiny file as anon into each bucket. Public buckets
    // typically still require RLS for INSERT — assert none of them
    // accepts an anon write.
    const writeAllowed: string[] = []
    for (const b of buckets) {
      const path = `fmea-probe/${Date.now()}.txt`
      const { error } = await anon.storage
        .from(b.id)
        .upload(path, new Blob(['fmea-probe']), { upsert: false })
      if (!error) {
        writeAllowed.push(b.id)
        // best-effort cleanup
        await admin.storage.from(b.id).remove([path])
      }
    }
    expect(
      writeAllowed,
      `Anon was able to write to bucket(s): ${writeAllowed.join(', ')}`,
    ).toEqual([])
  })
})
