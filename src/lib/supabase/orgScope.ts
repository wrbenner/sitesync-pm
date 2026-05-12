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

// Structural shape: any builder with .eq. We intentionally type .eq loosely
// (any column, any value) so PostgrestFilterBuilder's strongly-typed
// .eq<K extends keyof Row>(...) still satisfies the constraint — supabase
// builders narrow .eq to their own column union, which is stricter than
// (string, unknown) and would fail contravariance otherwise.
//
// The trade-off: callers don't get compile-time verification that the table
// has an `organization_id` column. RLS at the DB layer is the authoritative
// gate — every org-scoped public table is covered by find_unprotected_tables()
// (BRT sub-1 §4.2), and the read-only-mode restrictive sweep (BRT sub-4 §4.6)
// closes the mutation side.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BuilderWithEq = { eq: (column: any, value: any) => unknown }

/**
 * Adds .eq('organization_id', orgId) to a Supabase query. Throws if orgId
 * is empty/null — the caller should have checked.
 */
export function scoped<Q extends BuilderWithEq>(query: Q, orgId: string | null | undefined): Q {
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
export function scopedBy<Q extends BuilderWithEq>(query: Q, column: string, value: string | null | undefined): Q {
  if (!value) {
    throw new Error(`orgScope: value is required for column "${column}".`)
  }
  return query.eq(column, value) as Q
}
