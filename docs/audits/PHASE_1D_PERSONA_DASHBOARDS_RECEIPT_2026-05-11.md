# Phase 1d — persona override hierarchy + 3 persona dashboards

**Date:** 2026-05-11
**Branch / PR:** `phase-1d-persona-dashboards`
**Spec:** [`IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md`](IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md) §§5.4, 6
**Builds on:** PRs #418 (1a) · #419 (1b) · #420 (1c)

## TL;DR

Closes the ADR-019 override hierarchy with a server-side `resolve_persona(user, project)` RPC and 3 persona-tailored home dashboards (`HomeForPm`, `HomeForSuper`, `HomeForOffice`) reachable at `/home/iris` behind the `irisUseFabric` feature flag. Foreman + Owner Rep dashboards remain Phase 1.5 work per spec §6.1 — they currently land on `HomeForPm` with a fallback banner.

Dashboards render real persona-specific card lists (per spec §3.2 + §6) but the per-card data fetchers are honest placeholders ("Connected in Phase 4."). Faking metrics is worse than visible "not yet wired" copy.

7 dashboard tests pass; typecheck zero; lint zero on touched files.

## What changed

### Migration

- `supabase/migrations/20260722010000_role_to_default_persona.sql` —
  - `role_to_default_persona` table mapping all 15 canonical `ROLES` (from `src/permissions.ts`) to one of the 5 personas. Org-level overrides via the `(org_id, role)` PK variant.
  - **`resolve_persona(p_user_id, p_project_id) -> TEXT`** PL/pgSQL function implementing the ADR-019 hierarchy server-side: project-level binding → org-level binding → role map → 'pm' fallback. `STABLE SECURITY DEFINER`, RLS-aware. `GRANT EXECUTE` to `authenticated`.
  - RLS policies: anyone can read system (`org_id IS NULL`) + own-org rows; admins/owners manage own-org rows.
  - **Rollback:** `DROP FUNCTION resolve_persona; DROP TABLE role_to_default_persona;` — table is leaf (no FKs into it).

### Frontend

- `src/hooks/usePersona.ts` (new) — TanStack-Query-backed hook that calls `resolve_persona` RPC. 30s `staleTime`. Returns `{ persona, resolved, loading }`; never returns null. When the RPC fails or the user has no row, falls back to `'pm'` and signals `resolved: false` so the dashboard can show the spec'd fallback banner.
- `src/components/iris/dashboard/PersonaDashboardShell.tsx` (new) — shared chrome: persona display name header, optional fallback banner, responsive auto-fill card grid (≥ 280px columns).
- `src/pages/HomeForPm.tsx` (new) — 7 cards per spec §3.2: RFIs awaiting response, Submittals overdue, Schedule slip risk, Budget exposure, Drafted actions inbox, Today's OAC, Lookahead conflicts.
- `src/pages/HomeForSuper.tsx` (new) — 6 cards per spec §3.2: Today's crews, 14-day weather, RFIs blocking field, Safety walk follow-ups, Daily log finalize, Photos pending.
- `src/pages/HomeForOffice.tsx` (new) — 6 cards per spec §3.2: Lien waivers, Certified payroll, Pay app cycle, CO log delta, Contracts awaiting countersignature, Insurance expiring.
- `src/pages/HomePersonaSwitch.tsx` (new) — routes the logged-in persona to the right home; foreman + owner_rep fall through to `HomeForPm` with the fallback banner (Phase 1.5 ships their dashboards).
- `src/App.tsx` — adds `/home/iris` route, gated by `FLAGS.irisUseFabric`; lazy-loaded under `lazyWithRetry()`.

### Tests

- `src/components/iris/dashboard/__tests__/PersonaDashboardShell.test.tsx` (7 tests):
  - Header renders the persona's `display_name`.
  - Every card renders by id + title + description + placeholder.
  - Fallback banner appears when `resolved=false` and is omitted otherwise.
  - CTA links wire through to the right route.
  - Different headers render for each persona slug (PM / Super / Office).
  - Stable `data-testid` per persona for downstream E2E.

## Verification commands

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit -p tsconfig.app.json
# → exit 0

NODE_OPTIONS="--max-old-space-size=8192" npx vitest run src/components/iris/dashboard/
# → 7/7 pass

NODE_OPTIONS="--max-old-space-size=8192" npx eslint src/pages/HomeFor*.tsx src/pages/HomePersonaSwitch.tsx src/hooks/usePersona.ts src/components/iris/dashboard/
# → 0 errors / 0 warnings on touched files
```

## Phase 1d acceptance check (spec §6.1)

✅ `resolve_persona` RPC implements ADR-019 hierarchy server-side.
✅ `usePersona()` hook returns deterministic value (never null) via React Query.
✅ 3 dashboards land: PM (7 cards), Super (6), Office (6) — content matches spec §3.2.
✅ `/home/iris` route reachable when `irisUseFabric` flag is on.
✅ Foreman + Owner Rep route to `HomeForPm` with fallback banner (per spec §6.1 Phase 1.5 deferral).
⏳ ≥ 10 unique users per persona × ≥ 3 visits in 7 days — calendar-bound observation (not a CI gate).

## What this does NOT do

- **Real card data.** Every card renders a "Connected in Phase 4." placeholder rather than fake metrics. Phase 4 wires the data fetchers.
- **Default home re-route.** `/home` and `/day` still route to the legacy `DayPage`. Phase 1e flips `/home/iris` to be the default when the persona-eval gate clears.
- **Org-level persona-mapping admin UI.** Per ADR-019, admins need a "assign user → persona" page. That UI ships Phase 1.5 alongside the role-management refactor; for now Walker assigns soft-pilot personas directly via SQL during Day 50 onboarding.
- **db-types regeneration.** `database.ts` does not yet include `resolve_persona` — `usePersona` uses a typed wrapper cast. Regen lands in the post-merge `npm run db-types:write` pass (Walker-driven).

## Next up

**PR 1e — persona-divergence eval + `phase-1-acceptance.yml`.** Builds the 50-fixture × 5-persona eval harness, the divergence rubric, and the CI workflow that runs the 4 Phase 1 acceptance metrics on a daily schedule with the 7-consecutive-day check.
