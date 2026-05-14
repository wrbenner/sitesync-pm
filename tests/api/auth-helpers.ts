/**
 * Minimal auth helpers shared by B.3 / B.4 / B.5 generated spec files.
 *
 * If/when B.4 + B.5 codegen agents land their own `tests/{rpc,rls}/auth-helpers.ts`,
 * those can be promoted and this file thin-wrapped or removed. Until then,
 * this is the canonical source for staging-credential resolution + role-token
 * resolution used by the generated edge-fn role matrix.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
export const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''

/**
 * Four roles we exercise per edge function:
 *   anon         — no Authorization header (just apikey: ANON_KEY)
 *   authed       — any valid signed-in JWT (SCALE_TEST_JWT env)
 *   owner        — org owner JWT (SCALE_TEST_OWNER_JWT or fall back to authed)
 *   service_role — bypass-RLS service key
 */
export type Role = 'anon' | 'authed' | 'owner' | 'service_role'
export const ROLES: readonly Role[] = ['anon', 'authed', 'owner', 'service_role']

/** Resolve the bearer token for a given role. Empty string for anon. */
export function tokenFor(role: Role): string {
  switch (role) {
    case 'anon':
      return ''
    case 'authed':
      return process.env.SCALE_TEST_JWT ?? ''
    case 'owner':
      return process.env.SCALE_TEST_OWNER_JWT ?? process.env.SCALE_TEST_JWT ?? ''
    case 'service_role':
      return SERVICE_KEY
  }
}

/**
 * True if the staging env is wired and tests should run. The generated spec
 * gates every describe block on this so the file is a no-op when env is
 * absent (local dev, CI without secrets, etc.).
 */
export function shouldRun(): boolean {
  return Boolean(SUPABASE_URL && ANON_KEY)
}

/** Build the headers for an edge-function POST as a given role. */
export function headersFor(role: Role): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    'Content-Type': 'application/json',
  }
  const token = tokenFor(role)
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

/** Service-role Supabase client (RLS-bypass) for catalog probes if needed. */
export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Bounded concurrency runner — caps in-flight promises at `limit`. The
 * generated spec uses this to keep the edge-fn rate-limit happy when running
 * the full 1,668-cell matrix.
 */
export async function withConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

/**
 * POST to an edge function as a given role with the given JSON body.
 * Returns the raw Response so callers can assert status + parse body.
 */
export async function callEdgeFn(
  fnName: string,
  role: Role,
  body: unknown,
): Promise<Response> {
  return fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: headersFor(role),
    body: JSON.stringify(body),
  })
}
