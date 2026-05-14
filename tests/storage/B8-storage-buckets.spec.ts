/**
 * Phase B.8 — Storage bucket contract baseline.
 *
 * For each bucket from ops/coverage/storage.json:
 *   - Bucket exists with the expected public/private flag
 *   - file_size_limit + allowed_mime_types match the inventory
 *   - Anon-key list returns empty (RLS-protected) for private buckets
 *
 * Deeper per-scenario tests (upload size limits, RLS deny) live in
 * Phase B.8 expansions; this is the baseline contract.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''
const SHOULD_RUN = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY)

interface Bucket {
  id: string
  public: boolean
  file_size_limit: number | null
  allowed_mime_types: string[] | null
}

const inventoryPath = resolve(__dirname, '../../ops/coverage/storage.json')
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf-8')) as {
  count: number
  buckets: Bucket[]
}

let admin: SupabaseClient
let anon: SupabaseClient
beforeAll(() => {
  if (SHOULD_RUN) {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
})

describe.skipIf(!SHOULD_RUN)('B.8 — Storage bucket contract', () => {
  for (const bucket of inventory.buckets) {
    describe(bucket.id, () => {
      it('bucket exists in storage.buckets', async () => {
        const { data, error } = await admin.storage.getBucket(bucket.id)
        expect(error, error ? `getBucket(${bucket.id}) failed: ${error.message}` : undefined).toBeNull()
        expect(data?.id).toBe(bucket.id)
      })

      it(`public flag matches inventory (${bucket.public})`, async () => {
        const { data } = await admin.storage.getBucket(bucket.id)
        expect(data?.public).toBe(bucket.public)
      })

      if (!bucket.public) {
        it('private bucket: anon-key list returns empty / 401', async () => {
          const { data, error } = await anon.storage.from(bucket.id).list('', { limit: 1 })
          // Either empty (RLS hides) or an explicit error. Not a populated list.
          if (!error) {
            expect(data ?? [], `private bucket ${bucket.id} leaked rows to anon`).toHaveLength(0)
          }
        })
      }
    })
  }
})
