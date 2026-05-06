# Production-bug fixes — 2026-05-06

**Branch:** `fix/entity-audit-viewer-render-loop-2026-05-06`
**Base:** `test/coverage-slice-e-2026-05-05`

Four real production bugs surfaced from the user's running dev server console
(EntityAuditViewer infinite-render loop, profile-lookup 500 cascade, submittal
create + approval-list 400s, color-contrast WCAG-AA failure on tab labels).
This branch fixes them at the architecturally correct layer — no client-side
error swallowing, no `as any` widening, no symptomatic patches.

---

## 1. EntityAuditViewer infinite render loop (most severe)

**Symptom (console):**
```
EntityAuditViewer.tsx:57 Maximum update depth exceeded.
... (repeated dozens of times until React or the runtime gave up)
```

**Root cause:** the component used a JS default-destructure default value:
```tsx
const { data: rows = [], isPending } = useQuery({...});
```
JavaScript re-evaluates the default `[]` literal on every destructure pass.
While `data` was `undefined` (loading or error retry state), `rows` was a
fresh array reference each render. That re-fired `useMemo([rows])`, produced
a new `orderedRows` reference, re-fired `useEffect([orderedRows])`, which
called `setChain({ ok: true, total: 0, gaps: [] })` with a fresh object
literal — React's `Object.is` check failed, state updated, component
re-rendered, effect re-fired, ad infinitum.

**Fix (architectural, not patch):**
- Moved `EMPTY_ROWS` and `EMPTY_CHAIN` to module scope as `Object.freeze`'d
  constants so reference equality holds across renders for both the
  empty-data and empty-chain cases.
- Removed the destructure default. `useMemo<AuditLogRow[]>` now reads `data`
  directly and returns `EMPTY_ROWS` when `data` is undefined or empty,
  preserving reference stability through loading/error/refetch.
- `setChain(EMPTY_CHAIN)` now passes the same frozen object on repeat calls,
  so React's bail-out short-circuits the would-be re-render entirely.

**Regression test:**
`src/components/audit/__tests__/EntityAuditViewer.loop.test.tsx`. Wraps the
component in a `CountingHarness` that throws after 50 renders. On the
pre-fix code the harness either trips the cap or vitest hangs (the worker
spins). On the fix it stabilises in <100ms. The test runs in 97ms total
across both loading and empty-data scenarios.

**File:** `src/components/audit/EntityAuditViewer.tsx`

---

## 2. `/rest/v1/profiles` 500 cascade — RLS infinite recursion

**Symptom (console):**
```
GET https://.../rest/v1/profiles?select=user_id,full_name,avatar_url
    &user_id=in.(...) 500 (Internal Server Error)
```
Repeated 3× per affected query (react-query's default retry budget).

**Root cause:** the `profiles_select_org` RLS policy from
`20260416000002_create_profiles.sql` selects from `profiles` inside its own
USING clause:
```sql
CREATE POLICY profiles_select_org ON profiles FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = (select auth.uid())
    )
  );
```
The inner SELECT triggers the same policy, which re-runs the inner SELECT,
recursively. Postgres aborts the query and PostgREST returns 500.

**Fix (architectural, not patch):**
New migration `20260506000001_fix_profiles_rls_recursion.sql` adds a
SECURITY DEFINER helper:
```sql
CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
$$;
```
And rewrites the policy to call it:
```sql
CREATE POLICY profiles_select_org ON profiles FOR SELECT
  USING (organization_id = public.current_user_organization_id());
```
The function executes as its owner (postgres), so the lookup bypasses
RLS — no more recursion. EXECUTE permission is restricted to `authenticated`
and `service_role` (revoked from PUBLIC) and `search_path` is fixed to
neutralise the SECURITY DEFINER + search_path injection class.

**File:** `supabase/migrations/20260506000001_fix_profiles_rls_recursion.sql`

---

## 3. `submittals` POST 400 — missing `project_id`

**Symptom (console):**
```
POST https://.../rest/v1/submittals?select=* 400 (Bad Request)
```
On `SubmittalCreateWizard` submit.

**Root cause:** `useCreateSubmittal.mutationFn` called
`from('submittals').insert(sanitizeSubmittalData(params.data))`. The
sanitizer whitelists columns from `params.data`, but `project_id` lives on
`params.projectId`. The submittals table requires `project_id NOT NULL`,
so PostgREST rejected the insert. The offline-queue branch (`offlineQueue.getData`)
already injected `project_id` correctly — only the live path had drifted out
of sync.

**Fix:** merge `project_id` into the insert payload at call time, mirroring
the offline branch:
```ts
const insertData = { ...sanitizeSubmittalData(params.data), project_id: params.projectId }
```

**File:** `src/hooks/mutations/submittals.ts`

---

## 4. `submittal_approvals` GET 400 — non-existent ORDER column

**Symptom (console):**
```
GET https://.../rest/v1/submittal_approvals?select=*
    &submittal_id=eq.<uuid>&order=created_at.asc 400 (Bad Request)
```
On every Submittal detail-page mount.

**Root cause:** `useSubmittalReviewers` ordered by `created_at`, but the
`submittal_approvals` table has no `created_at` column. Per `database.ts`
the table columns are: `id, submittal_id, approver_id, chain_order, role,
status, stamp, comments, reviewed_at, revision_number`.

**Fix:** order by `chain_order` (the deliberate workflow position the UI
actually wants to surface), with `nullsFirst: false` so any null-positions
fall to the end rather than the top.

**File:** `src/hooks/queries/submittals.ts`

---

## 5. Color-contrast WCAG-AA failure (textTertiary token)

**Symptom (axe-core, console):**
```
Element has insufficient color contrast of 3.36 (foreground: #8c857e,
background: #f6f6f4, font size: 9.8pt) — Expected 4.5:1
Element has insufficient color contrast of 3.3 (foreground: #8c857e,
background: #f4f4f2, font size: 7.5pt) — Expected 4.5:1
```

**Root cause:** the `--color-textTertiary` and `--color-ink-3` tokens are
both `#8C857E` (relative luminance ≈ 0.239). On the app's primary light
surfaces (`#F4F4F2`, `#F6F6F4`, luminance ≈ 0.92) that yields 3.3–3.4:1
contrast — fails WCAG AA (4.5:1) for normal text. Field workers in
gloves/glare cannot read it reliably.

**Fix:** darken both tokens to `#6F6862` (luminance ≈ 0.135), which yields
~5.25:1 contrast on the same surfaces — comfortably above AA — while
preserving the warm-gray tertiary feel and the `ink-2 / ink-3 / ink-4`
hierarchy step size. Hardcoded `'#8C857E'` constants in 14 component/page
files (which mirror the token semantically: `INK_3`, `ink3`, urgency-tier
`low: '...'` in cockpit views) were also updated for consistency.

**Files:**
- `src/styles/tokens.css`
- 14 `.tsx` consumers updated via grep+sed pass

---

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` — clean (no errors introduced)
- `npx vitest run src/components/audit/__tests__/EntityAuditViewer.loop.test.tsx` — 2/2 pass in 97ms
- The pre-fix code on the same test hangs vitest (worker spins indefinitely),
  empirically proving the test catches the regression.

## What this PR does NOT do

Strict scope discipline. This PR fixes only the four production-correctness
bugs visible in the dev console + the WCAG-AA contrast failure. It does
not:
- Rebase, retry, or unblock other open PRs.
- Touch the polish PR triage (#321 + the four duplicate auto/polish-* PRs).
- Update the `.quality-floor.json` ratchet.
- Propose an auto-ratchet workflow.

Those moves are valuable but separate; bundling them here would defeat the
focused-PR review locality the Bugatti standard rewards.
