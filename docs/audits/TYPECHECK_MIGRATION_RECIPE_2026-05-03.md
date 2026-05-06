# Typecheck Migration Recipe — Phase C

**Date:** 2026-05-03
**Status:** ACTIVE — Phase C (file migration) ~1/158 complete
**Foundation:** Phase A + Phase B committed (`54ac012`, `528c7e3`)

---

## Where we are

Lap 1 of the SiteSync 90-Day plan committed to a hard typecheck gate.
The historical baseline was 4339 errors (per `docs/audits/DAY_12_FRIDAY_*`).
This session moved it to 4123 (-216) and built the architectural wrapper
that makes the rest of the migration mechanical.

| Phase | Status | What it does |
|---|---|---|
| A | ✅ committed `54ac012` | `npm run typecheck` script + `db-types:check` staleness gate + CLAUDE.md elevated typecheck to load-bearing |
| B | ✅ committed `528c7e3` | `src/lib/db/queries.ts` — typed query DSL: `fromTable`, `selectScoped`, `selectScopedActive`, `insertRow`, `insertRows`, `updateScoped`, `deleteScoped`, `inIds`. Plus computed `ProjectScopedTable` + `SoftDeletableTable` types. |
| C | 🟡 in progress 1/158 | Per-file migration. activity.ts validated the recipe (104 → 0 errors). |
| D | ⏳ pending | Sweep residual non-Supabase errors: TS6133 unused (~310), TS2322/TS2352 narrowing (~600), misc (~300). Mechanical. |
| E | ⏳ pending | Verify zero errors. CI gate already wired in `test.yml`. |

**Current baseline: 4123 errors.** Goal: 0.

---

## The Phase C Recipe

For each file using `supabase.from(...)`, apply this transformation in order:

### 1. Update imports

```diff
- import { supabase, transformSupabaseError } from '../client'
+ import { transformSupabaseError } from '../errors'
+ import { fromTable, selectScoped, inIds } from '../../lib/db/queries'
```

Adjust the relative path depth based on the file's location. If the file
also uses `assertProjectAccess`, keep that import as-is.

### 2. Project-scoped reads

```diff
- supabase.from('rfis')
-   .select('id, number, title')
-   .eq('project_id', projectId)
-   .order('created_at', { ascending: false })
+ selectScoped('rfis', projectId, 'id, number, title')
+   .order('created_at', { ascending: false })
```

### 3. Project-scoped reads with soft delete

If the table is in the `SoftDeletableTable` type and the existing query
applies `.is('deleted_at', null)`, use `selectScopedActive` to apply
both filters in one call.

### 4. ID-set filters

```diff
- .in('id', someStringArray)
+ .in('id', inIds(someStringArray))
```

### 5. Inserts

```diff
- supabase.from('change_orders').insert({...})
+ insertRow('change_orders', {...} as never)
```

The `as never` is required because Supabase v2's RejectExcessProperties
generic doesn't fully resolve. The constraint on `insertRow<T>` already
enforces InsertRow<T> at the call site — the cast is contained.

### 6. Project-scoped updates / deletes

```diff
- supabase.from('change_orders')
-   .update({ status: 'approved' })
-   .eq('id', coId)
-   .eq('project_id', projectId)
+ updateScoped('change_orders', projectId, { status: 'approved' } as never)
+   .eq('id' as never, coId)
```

`.eq('id' as never, coId)` is the controlled-cast pattern for chained
filters where the column name is a generic literal. Same pattern works
for `.eq('contract_id' as never, ...)`, etc.

### 7. Joined-result narrowing

If the existing code uses `.select('*, user:profiles(...)')` and then
treats the result as a known shape:

**Option A (preferred): split into two queries.** Eliminates the
SelectQueryError union narrowing and is more resilient to missing FK
relationships.

**Option B: cast at boundary.** Use `as unknown as YourRowShape[]`. This
is acceptable because the joined select is at a clear boundary; the cast
is named, contained, commented.

### 8. PromiseLike vs Promise

Supabase's PostgrestBuilder is PromiseLike, not Promise. If your code
chains `.then(...).catch(...)` on it, that breaks because PromiseLike
has no `.catch`. Two fixes:

**Pattern 1**: replace with `await` + try/catch. Always do this for new
code.

**Pattern 2**: when passing the builder to a helper, the helper signature
should be `() => PromiseLike<unknown>` and cast the resolved value
inside. See `loadLabels` in `src/api/endpoints/activity.ts` for the
exemplar.

### 9. Result type assertions

When extracting a known shape from the typed result, the
`SelectQueryError` union forces a cast at the boundary:

```diff
- if (data) return data.title
+ if (data) return (data as unknown as { title: string }).title
```

Or, narrow in a helper that returns the typed shape (preferred).

---

## Per-file checklist

For each file:
1. Run `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep $FILE | wc -l` → record starting error count
2. Apply migrations in order (sections 1-9 above)
3. Re-run typecheck → confirm errors reduced for the file
4. Commit with message: `refactor(<file>): typecheck migration to typed query DSL`
5. If new errors appeared in OTHER files (rare but possible if the file exported types), address before next file

---

## Top 20 files by error count (as of 4123 baseline)

These are the highest-leverage targets. Migrating these alone clears
~60% of remaining errors.

| File | Errors |
|---|---|
| `src/api/endpoints/budget.ts` | 93 |
| `src/pages/Meetings.tsx` | 78 |
| `src/hooks/useDigitalTwin.ts` | 66 |
| `src/hooks/usePlatformIntel.ts` | 61 |
| `src/pages/SiteMap.tsx` | 52 |
| `src/api/endpoints/payApplications.ts` | 52 |
| `src/hooks/mutations/change-orders.ts` | 50 |
| `src/hooks/useReportData.ts` | 48 |
| `src/pages/Safety.tsx` | 47 |
| `src/services/projectMemberService.ts` | 46 |
| `src/services/documentService.ts` | 45 |
| `src/services/billing.ts` | 42 |
| `src/hooks/queries/precon-extended.ts` | 40 |
| `src/hooks/useFieldOperations.ts` | 38 |
| `src/services/teamService.ts` | 37 |
| `src/services/dailyLogService.ts` | 37 |
| `src/services/changeOrderService.ts` | 37 |
| `src/services/drawingService.ts` | 36 |
| `src/pages/compliance/HUDCompliancePage.tsx` | 56 |
| `src/api/endpoints/activity.ts` | 0 ✅ |

Run `grep "error TS" /tmp/typecheck.log | sed 's/(.*//' | sort | uniq -c | sort -rn | head -25` to refresh after each batch.

---

## Phase D — residual non-Supabase errors

After Phase C clears the Supabase cluster (~3000 errors), the remainder
is heterogeneous:

| Category | Count (estimate) | Fix shape |
|---|---|---|
| TS6133 unused vars | ~310 | Remove. `eslint-plugin-unused-imports` + `--fix` could automate. |
| TS2322 assignment narrowing | ~150 | Per-site type assertion or input validation. |
| TS2352 cast warnings | ~120 | Add `as unknown as` for two-step casts where intent is clear. |
| TS2304 cannot find name | ~14 | Missing imports — add. |
| TS7006 implicit any | ~63 | Add explicit type annotations. |
| TS18046 unknown narrowing | ~40 | Type guard or explicit narrow. |
| Other | ~300 | One-by-one. |

---

## Phase E — verify

```sh
npm run typecheck
# Expected output: zero errors.

# Then commit a "lap-1: typecheck zero" milestone receipt.
```

CI gate is already wired (`test.yml` runs `npx tsc --noEmit` on every
PR). Once at zero, branch protection in GitHub UI should require the
`Test + Audit` check before merge.

---

## When to use which helper

| Need | Helper |
|---|---|
| Read project-scoped table | `selectScoped(t, projectId, cols)` |
| Read project-scoped + soft delete | `selectScopedActive(t, projectId, cols)` |
| Read non-scoped table (organizations, profiles, etc.) | `fromTable(t).select(...)` |
| Insert row | `insertRow(t, row as never)` |
| Insert many rows | `insertRows(t, rows as never)` |
| Update project-scoped row | `updateScoped(t, projectId, patch as never).eq('id' as never, x)` |
| Delete project-scoped rows | `deleteScoped(t, projectId).eq(...)` |
| Filter by string-array | `.in('column' as never, inIds(arr))` |

---

## What this is NOT

- **Not an ORM.** Rows still come back as the typed Row<T> Supabase emits.
- **Not a query DSL like Kysely.** PostgrestBuilder is still the engine;
  the wrapper only fixes the strict-generic friction at boundaries.
- **Not a license to use `as any`.** Every contained cast is `as never`
  or `as unknown as`, named, with a comment, and forward-compatible with
  any future Supabase typing relaxation.
- **Not a substitute for proper RLS.** Server-side row-level-security is
  still the source of truth; the typed wrapper enforces project-scope
  at the *client side compile time* AND injects the explicit `.eq()` at
  runtime.

---

## Why this work matters

See `docs/audits/DAY_30_LAP_1_ACCEPTANCE_2026-05-03.md` and the user-set
"Bugatti standards" memory at
`/Users/walkerbenner/.claude/projects/.../memory/feedback_no_patches_bugatti_grade.md`.

Short version: 4339 typecheck errors made the gate fictional. Refactor
confidence, IDE autocomplete, schema-drift detection, and AI-assisted
coding effectiveness all collapse to zero in that environment. Clean
typecheck restores all of them. Bugatti grade requires it.
