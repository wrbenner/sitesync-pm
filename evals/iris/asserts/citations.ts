/**
 * evals/iris/asserts/citations.ts
 *
 * Citation assertion for the Iris eval pipeline. Two checks:
 *
 *   1. Coverage. If the row's `expected.citationKinds` is non-empty,
 *      the response must contain at least one citation of each listed
 *      kind. Synthetic rows assert "MEP RFI prompts should produce an
 *      rfi_reference citation"; the assert fails when Iris answers
 *      with zero citations.
 *
 *   2. Resolvability. Every citation Iris emits is sent through the
 *      `resolve_citation` RPC. The assert fails on any `not_found`
 *      response (the canonical "Iris hallucinated an RFI ID" failure
 *      mode). `forbidden` and `stale` are warnings — they're real
 *      responses for valid IDs the user can't see right now.
 *
 * The resolver requires a Supabase service-role client because eval
 * runs aren't authenticated as a normal user. We connect via env vars
 * the workflow injects (STAGING_SUPABASE_URL / STAGING_SERVICE_ROLE_KEY).
 *
 * Reference: docs/audits/IRIS_CITATIONS_SPEC_2026-05-04.md § Phase 2
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { EvalCorpusRow, IrisProviderOutput, ExpectedCitationKind } from '../types'
import { isCitationKind } from '../../../src/lib/iris/citationRouting'

export interface CitationAssertResult {
  passed: boolean
  missingKinds: ExpectedCitationKind[]
  unresolvedRefs: Array<{ kind: string; ref: string; status: string }>
  reason: string
}

let cached: SupabaseClient | null = null
function getResolverClient(): SupabaseClient | null {
  if (cached) return cached
  const url = process.env.STAGING_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cached
}

export async function assertCitations(
  row: EvalCorpusRow,
  out: IrisProviderOutput,
): Promise<CitationAssertResult> {
  const expectedKinds = new Set(row.expected.citationKinds)
  const emittedKindCounts = new Map<string, number>()
  for (const c of out.citations) {
    emittedKindCounts.set(c.kind, (emittedKindCounts.get(c.kind) ?? 0) + 1)
  }

  const missingKinds = [...expectedKinds].filter((k) => !emittedKindCounts.has(k))

  // Resolve each emitted citation. Skip when no client (e.g. local
  // smoke-run without staging creds) — return a "no resolver"
  // soft-pass so the eval can run end-to-end.
  const client = getResolverClient()
  const unresolved: Array<{ kind: string; ref: string; status: string }> = []
  if (client) {
    for (const c of out.citations) {
      if (!isCitationKind(c.kind) || !c.ref) continue
      try {
        const { data, error } = await client.rpc('resolve_citation', {
          p_kind: c.kind,
          p_ref: c.ref,
          p_payload: c.x != null && c.y != null ? { x: c.x, y: c.y } : {},
        })
        const status = (data as { status?: string } | null)?.status ?? (error ? 'error' : 'unknown')
        if (status !== 'ok' && status !== 'stale' && status !== 'forbidden') {
          unresolved.push({ kind: c.kind, ref: c.ref, status })
        }
      } catch (err) {
        unresolved.push({ kind: c.kind, ref: c.ref, status: `exception: ${(err as Error).message}` })
      }
    }
  }

  const passed = missingKinds.length === 0 && unresolved.length === 0
  const parts: string[] = []
  if (missingKinds.length > 0) parts.push(`missing kinds: ${missingKinds.join(', ')}`)
  if (unresolved.length > 0) {
    parts.push(`unresolved: ${unresolved.map((u) => `${u.kind}:${u.ref}=${u.status}`).join(', ')}`)
  }
  const reason = passed ? 'citations ok' : parts.join('; ')

  return { passed, missingKinds, unresolvedRefs: unresolved, reason }
}
