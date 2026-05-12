// src/lib/supabase/orgScope.ts — BRT subsystem 1 §4.3
//
// Typed chaining helpers so every Supabase query that touches an
// org-scoped table goes through a single .eq('organization_id', orgId)
// chokepoint. Reduces the chance that a future refactor accidentally
// drops the org filter.
//
// Usage:
//
//   import { scoped } from '~/lib/supabase/orgScope'
//   import { useRequiredActiveOrg } from '~/hooks/useActiveOrg'
//
//   const { orgId } = useRequiredActiveOrg()
//   const { data } = await scoped(supabase.from('rfis').select('*'), orgId)
//
// The function never silently no-ops on a falsy orgId — it throws. Callers
// that handle "no active org" must check before they call.

interface QueryWithEq {
  eq: (column: string, value: unknown) => QueryWithEq
}

/**
 * Adds .eq('organization_id', orgId) to a Supabase query. Throws if orgId
 * is empty/null — the caller should have checked.
 */
export function scoped<Q extends QueryWithEq>(query: Q, orgId: string | null | undefined): Q {
  if (!orgId) {
    throw new Error('orgScope: orgId is required. Use useRequiredActiveOrg or guard at the call site.')
  }
  return query.eq('organization_id', orgId) as Q
}

/**
 * Same shape, but with a configurable column name for tables that scope
 * via a different FK (e.g., audit_log uses organization_id; some legacy
 * tables use org_id — confirm before using a different column).
 */
export function scopedBy<Q extends QueryWithEq>(query: Q, column: string, value: string | null | undefined): Q {
  if (!value) {
    throw new Error(`orgScope: value is required for column "${column}".`)
  }
  return query.eq(column, value) as Q
}
