/**
 * serviceClient — service-role Supabase factory for the lifecycle smoke spec.
 *
 * The lifecycle spec asserts against the entire dataset the seed wrote;
 * RLS would scope us to a single user. Service role is the right tool for
 * a smoke test we own end-to-end.
 *
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the environment so
 * the same env wiring as `scripts/seed-90-day-lifecycle.ts` applies.
 *
 * NEVER use this client from app code — RLS is the security boundary, and
 * a service-role key in the browser leaks access. This module is e2e-only.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient<unknown> | null = null

export function getServiceClient(): SupabaseClient<unknown> {
  if (cached) return cached
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'serviceClient: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. ' +
      'Source .env or pass them on the command line before running the lifecycle spec.',
    )
  }
  cached = createClient<unknown>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
