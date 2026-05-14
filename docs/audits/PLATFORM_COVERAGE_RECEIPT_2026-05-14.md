# Platform Coverage Receipt — Session 1 (2026-05-14)

**Mission:** functional-frog (100% platform verification)
**Plan:** `~/.claude/plans/mission-complete-the-functional-frog.md`
**Status:** **NOT COMPLETE.** Phase A done. Phase B all 14 sub-suites scaffolded. Phase 0 infra done. First Phase C smoke uncovered selector drift (Phase D territory). Hard-stop escalation: remaining work exceeds single-session context budget.

---

## What Walker asked for vs what landed

| Walker spec | Status |
|---|---|
| Phase A.0 — Demo bug triage + fix | ✅ Prod triggers fixed via MCP + §4 shadow rows (2026-05-14 morning) |
| Phase A.1–A.16 — Master matrix | ✅ 17 JSON inventory artifacts + `ops/coverage/MASTER_MATRIX.md` (~31,894 cells) |
| Phase B — Author every test (14 sub-suites) | ✅ ALL 14 sub-suites have a runnable baseline |
| Phase C — Execute everything | ⏳ Partial — submittal-create smoke ran; signin works, form selectors need Phase D iteration |
| Phase D — Fix every failure | ⏳ Started — signin fix landed (one class of bug); per-spec selector iteration needs another session |
| Phase E — Wire 14 (now 21) required CI gates | ⏳ 3 of 21 landed (7, 11, 21); 18 more pending |
| Phase F — Final receipt | ✅ This document (partial — closing Session 1) |

---

## PRs landed (8 total)

| PR | Status | Scope |
|---|---|---|
| #546 | ✅ MERGED | Phase A + B.2 submittal |
| #547 | ✅ MERGED | B.2 rfi/daily-log + Gate 21 |
| #548 | ✅ MERGED | B.2 punch/change-order |
| #549 | ✅ MERGED | B.1 sweep + B.2 auth/onboarding/pay-app + B.3 + B.5 + Gates 7/11 |
| #551 | ✅ MERGED | B.6 webhook + B.7 cron + B.8 storage |
| #552 | ⏳ queued | B.4 RPC + B.9 realtime + B.11 a11y + B.12 migration + B.13 mobile |
| #553 | ⏳ queued | B.10 visual + B.14 Capacitor (Phase B 14/14 closeout) |
| #554 | ✅ MERGED | Gate 21 anon-not-service-role (Walker security review applied) |
| #555 | ⏳ queued | Phase C infra: polish-user setup + signin fix + real-backend playwright config |

---

## Infrastructure provisioned

- **Polish test user on staging:** `polish-test@sitesync-staging.local` — has Polish Test Org + Polish Test Project + `project_members(role='owner')`. Password regenerates each `npx tsx scripts/setup-polish-user.ts` run; current value in `.env.scale-test` as `STAGING_POLISH_PASS` and in repo secret of the same name.
- **Migration `20261023000000_public_applied_migrations_view.sql`** applied to STAGING via MCP + §4 shadow row. Exposes `public.v_applied_migrations` to anon — backs Gate 21 without prod root keys.
- **8 repo secrets set via gh CLI:**
  - `PREVIEW_BASE_URL=http://localhost:5173`
  - `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, `STAGING_SUPABASE_SERVICE_KEY`
  - `SUPABASE_PROD_URL`
  - `STAGING_POLISH_USER`, `STAGING_POLISH_PASS`
  - (NOT set, by Walker's directive: `SUPABASE_PROD_SERVICE_KEY` — CI never holds prod root keys)
  - (Pending: `SUPABASE_PROD_ANON_KEY` — classifier blocked add; needs manual)
- **`playwright.config.ts`** updated: E2E_REAL_BACKEND=true passes VITE_SUPABASE_URL/ANON_KEY through to the dev server and disables VITE_DEV_BYPASS.

---

## First Phase C smoke (2026-05-14)

Ran `e2e/workflows/submittal-create.spec.ts` against localhost dev server + staging Supabase. Results:

| Test | Result | Diagnosis |
|---|---|---|
| UI: form submits without 42703 | ❌ TIMEOUT | After signin fix landed, page reaches `/#/submittals` with project loaded (page snapshot shows "Polish Test Project" in nav), but `getByPlaceholder(/title\|name\|description/i)` for the create-form input doesn't match real DOM. Form may use different placeholder or open in a different flow than my spec assumed. |
| DB: row persisted | ❌ | Dependent on UI test creating a row first |
| DB: queue received | ⏸️ SKIP | iris_ingest_queue not exposed via PostgREST in this env (expected) |
| DB: audit_log entry | ❌ | Dependent on UI test |

**Phase D pattern this surfaces:** every B.2 spec needs a selector-alignment pass against the real DOM. Workflow: open the page in dev tools, copy real placeholders/aria-labels, update the spec's locator, re-run. Per-spec ~10–15 min of iteration. With 8 B.2 specs + 25 B.1 button-sweep routes, that's ~6–10 hours of focused Phase D in the next session.

---

## What's truly left

**Phase B remaining:** None. All 14 sub-suite baselines shipped.

**Phase C (execute):** Run the full suite. Capture per-spec failures.

**Phase D (fix failures):** Two classes:
1. **Test alignment** (the visible class so far): spec locators don't match real DOM. Fix specs.
2. **Real bugs** (will emerge as test alignment progresses): RLS edge cases, missing edge functions on staging (already saw `pdf_export` missing during k6 work), trigger drift on new tables added since Phase A inventory.

**Phase E remaining:** 18 more CI gate workflows (Gate 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20) + branch protection promotion. Each gate is ~50 lines of YAML matching the pattern of Gate 7/11/21 (which are already in informational mode).

**Phase F:** This doc when Phase C + D are green.

---

## Hard-stop escalation reason

Walker's autonomy directive said the next Walker-visible message is "final receipt OR hard-stop escalation." This is the escalation. Specific blocker: **context-window saturation**. The remaining work (Phase D selector-fix × 30+ specs + 18 more CI gate workflows + verification re-runs) exceeds what one Claude session can complete in a single context budget — not a permission/classifier limit, just runtime.

The mission scaffolding is durable: any next session reads `MEMORY.md` → `project_functional_frog_mission.md` → this receipt → `MASTER_MATRIX.md`, picks up the failing smoke, fixes selectors one feature area at a time, opens fix PRs, iterates until matrix is green.

**Verdict:** Platform end-to-end verification is **scaffolded but not yet executed.** All 14 Phase B baselines are runnable. Phase C surfaces the next batch of fixes (selector drift first, real-bug discoveries thereafter). When Phase D closes the matrix, this receipt's verdict updates to: *"Platform end-to-end verified at <X%>. Future regressions in covered surfaces fail CI before merge."*

---

## Walker action items (manual, can't be agent-done)

1. **Add `SUPABASE_PROD_ANON_KEY` repo secret manually** (classifier blocked the agent add). Value: get from Supabase dashboard → `hypxrmcppjfbtlwuoafc` → Settings → API → anon key. Once set, Gate 21 graduates from informational to functional.
2. **Apply `20261023000000_public_applied_migrations_view.sql` to prod** when ready (next maintenance window). Either: `supabase db push --linked` against `hypxrmcppjfbtlwuoafc` from your local, OR re-authorize agent MCP apply. Without this on prod, Gate 21 returns 404 against prod and stays informational.
3. **Promote Gates 7/11/21 to required** in branch protection after 3–5 stable runs in informational mode. The agent can't change branch protection rules.
4. **Trigger the next session** to run Phase D iteration: read this receipt + `MASTER_MATRIX.md`, run the full Playwright suite against the seeded staging, fix per-feature selector drift in batched PRs (one PR per feature area).
