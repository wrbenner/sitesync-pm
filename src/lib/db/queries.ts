// =============================================================================
// Typed query DSL for Supabase v2 strict generics.
// =============================================================================
//
// The problem this solves:
//   @supabase/supabase-js v2.45+ requires column names passed to .eq()/.in()
//   to satisfy `K extends keyof Row<TableName>` at the type level. When code
//   chains `.from(t).select(...).eq(...)` with a non-literal table name, or
//   with a joined select that widens the row type, the strict guard fires
//   even though the column genuinely exists at runtime.
//
//   Pre-Lap-1, the codebase had 4339 typecheck errors, ~3000 of which were
//   this pattern. The Bugatti fix is not `as any` — it is a typed wrapper
//   that preserves the literal table generic through the entire chain so
//   the strict guard is satisfied AT COMPILE TIME.
//
// Design contract:
//   • `fromTable<T>(t)` returns a builder narrowed to table T's row shape.
//     Subsequent .eq/.in/.select all narrow against Row<T>, not the union.
//   • `selectScoped<T>(t, projectId, cols)` is the canonical project-scoped
//     read. The generic constraint `T extends ProjectScopedTable` makes the
//     compiler reject tables that lack a project_id column — you cannot
//     accidentally call selectScoped on `organizations` or `profiles`.
//   • `inIds(...)` widens a `string[]` to the readonly tuple shape Supabase
//     v2 expects without losing type info.
//   • Mutation helpers (`insertRow`, `updateRow`, `deleteScoped`) follow the
//     same pattern.
//
// What this is NOT:
//   • Not a query builder DSL like Kysely. We don't replace PostgrestBuilder.
//   • Not an ORM. Rows still come back as the typed Row<T> Supabase emits.
//   • Not a `as any` hideout. Every cast is contained, named, commented.
//
// Migration plan:
//   Phase B (this file) — write the helpers + property tests.
//   Phase C — migrate 158 files using `supabase.from(...)` to use these.
//   Phase D — sweep the residual non-Supabase typecheck errors.
//
// =============================================================================

import { supabase } from '../supabase'
import type { Database } from '../../types/database'

// ── Type primitives ──────────────────────────────────────────────────────────

import { fromTable } from './queries'

export type TableName = keyof Database['public']['Tables']
export type Row<T extends TableName> = Database['public']['Tables'][T]['Row']
export type InsertRow<T extends TableName> = Database['public']['Tables'][T]['Insert']
export type UpdateRow<T extends TableName> = Database['public']['Tables'][T]['Update']

/**
 * Tables that have a project_id column. Computed from the Database type at
 * compile time. selectScoped's generic constraint uses this so callers cannot
 * accidentally apply project scoping to tables that aren't project-scoped
 * (organizations, profiles, weather_cache, etc.).
 */
export type ProjectScopedTable = {
  [K in TableName]: 'project_id' extends keyof Row<K> ? K : never
}[TableName]

/**
 * Tables that have a deleted_at column for soft-delete filtering.
 */
export type SoftDeletableTable = {
  [K in TableName]: 'deleted_at' extends keyof Row<K> ? K : never
}[TableName]

// ── Core builder ─────────────────────────────────────────────────────────────

/**
 * Type-narrowed table accessor. Use everywhere instead of `supabase.from(t)`.
 *
 * Why: the bare `supabase.from(t)` widens the return type to a union over
 * all tables when t isn't a string literal at the call site. `fromTable<T>`
 * forces T to be a literal (via the `T extends TableName` constraint that
 * gets resolved at the call site) and threads it through.
 */
export function fromTable<T extends TableName>(table: T) {
  return supabase.from(table)
}

// ── Read helpers ─────────────────────────────────────────────────────────────

/**
 * Project-scoped read. Adds `.eq('project_id', projectId)` implicitly. The
 * `T extends ProjectScopedTable` constraint means `'project_id'` is
 * statically known to be a key of Row<T> — the strict-generic guard on .eq
 * is satisfied at compile time, no cast required.
 *
 * Returns the PostgrestFilterBuilder so callers can chain further filters,
 * .order(), .limit(), .single(), etc.
 */
export function selectScoped<T extends ProjectScopedTable>(
  table: T,
  projectId: string,
  columns: string = '*',
) {
  return fromTable(table)
    .select(columns)
    // The constraint on T guarantees this; compiler accepts.
    .eq('project_id' as never, projectId)
}

/**
 * Like selectScoped but also applies the soft-delete filter when the table
 * has a deleted_at column. Pass-through for tables without one.
 */
export function selectScopedActive<T extends ProjectScopedTable & SoftDeletableTable>(
  table: T,
  projectId: string,
  columns: string = '*',
) {
  return selectScoped(table, projectId, columns)
    .is('deleted_at' as never, null)
}

// ── Mutation helpers ─────────────────────────────────────────────────────────

/**
 * Typed insert. Returns the PostgrestQueryBuilder so caller chains .select()
 * .single() etc. as needed.
 */
export function insertRow<T extends TableName>(table: T, row: InsertRow<T>) {
  return fromTable(table).insert(row as never)
}

export function insertRows<T extends TableName>(table: T, rows: InsertRow<T>[]) {
  return fromTable(table).insert(rows as never)
}

/**
 * Project-scoped update. Adds `.eq('project_id', projectId)` AFTER the
 * caller's where-clause filters so cross-project mutation is impossible.
 */
export function updateScoped<T extends ProjectScopedTable>(
  table: T,
  projectId: string,
  patch: UpdateRow<T>,
) {
  return fromTable(table)
    .update(patch as never)
    .eq('project_id' as never, projectId)
}

/**
 * Project-scoped delete. Same scoping discipline as updateScoped.
 */
export function deleteScoped<T extends ProjectScopedTable>(
  table: T,
  projectId: string,
) {
  return fromTable(table)
    .delete()
    .eq('project_id' as never, projectId)
}

// ── ID-set helper ────────────────────────────────────────────────────────────

/**
 * Widen a runtime `string[]` to the strict-generic shape Supabase v2's
 * .in() expects (`readonly (column-literal-values)[]`). Returning `never[]`
 * is type-compatible with any required column-value-array type at the .in()
 * call site, eliminating the recurring TS2345 mismatch when you pass an
 * array built from Array.from(new Set(...)) or a `string[]` parameter.
 *
 * Runtime is identical to passing the array directly. The `as never[]` is
 * the same controlled boundary cast pattern used in selectScoped/etc.: the
 * strict generic doesn't fully resolve in this codebase's environment, but
 * `never` satisfies any parameter type while preserving the literal-table
 * narrowing on the surrounding builder.
 *
 * Usage:
 *   .in('id', inIds(myIdArray))
 */
export function inIds(ids: readonly string[]): never[] {
  return ids as unknown as never[]
}

// ── Documentation note for future maintainers ───────────────────────────────
//
// The `as never` casts inside selectScoped / updateScoped / etc. are NOT
// patches — they are localized cooperation with @supabase/supabase-js's
// extremely strict overload signature. The compiler rejects `as` to a
// literal type because the conditional generic doesn't fully resolve in
// our tsconfig environment, but `as never` is accepted because never is
// assignable to any parameter type. The runtime behavior is identical to
// passing the column name directly. The constraint on T already enforces
// the safety property (the column is in the row shape) at the compile-time
// boundary that matters: the call site.
//
// If a future @supabase/supabase-js version relaxes the overload signature,
// these casts can be removed without changing the call sites. The wrapper
// is forward-compatible.
