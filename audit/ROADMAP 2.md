# SiteSync PM — Production-Readiness Roadmap

_Generated from the comprehensive audit performed in session `01EQdhR6`. Complements `audit/PAGE_HEALTH.md` (CRUD/Export compliance) and `audit/PAGE_HEALTH.json` (machine-readable state)._

## Current state (baseline)

| Dimension | Status | Evidence |
|---|---|---|
| CRUD coverage | ✅ 55/55 routes @ 100% | `npm run audit:static` |
| Mutation permission + audit gating | ✅ All 26 critical mutations audited | `useAuditedMutation` enforcement |
| Zod validation at mutation boundary | ✅ Core entities + newly-scaffolded | `src/components/forms/schemas.ts` |
| State-machine enforcement | ✅ RFI / Submittal / Task / Punch / DailyLog / CO | `state-machine-validation-helpers.ts` |
| Type safety | ✅ `as any` = 1 (supabase generic), `@ts-ignore` = 2 (tests only) | `npx tsc --noEmit` clean |
| WCAG 2.4.3 focus management | ✅ FormModal fixed; Radix default behavior | `FormPrimitives.tsx` |
| Project-creation crash | ✅ Fixed; ErrorBoundary resets on nav | `App.tsx`, `api/endpoints/projects.ts` |
| Unit test coverage (mutation hooks) | 🔴 0 / 28 | `src/test/hooks/mutations/` empty |
| Page test coverage | 🔴 2 / 103 | `src/test/pages/` has 2 files |
| Skeleton loaders | 🟡 5 pages missing | AIAgents, AICopilot, Activity, Contracts, Deliveries |
| Touch targets | 🟡 RFI/Submittal view toggles 44px | should be 56px per CLAUDE.md |
| Hex-color violations | 🟡 ~200 instances | `src/pages/**`, `src/components/**` |
| Soft-delete RLS filtering | 🟡 6 tables columns added, RLS not filtered | `20260413000004_soft_delete_groundwork.sql` |
| `audit_log` RLS policies | 🟡 RLS enabled, no policies | `00002_audit_trail.sql` |
| User deletion cascade | 🟡 Orphans `project_members` on `auth.users` delete | no trigger exists |
| `api_keys` UPDATE/DELETE RLS | 🟡 SELECT/INSERT only | `00022_integration_framework.sql` |
| Offline sync manifest | 🟡 Missing `budget_line_items` | `src/lib/offlineDb.ts:66` |
| Accounting integration | 🔵 Not started | SPEC.md P0-GTM |
| Schedule import (P6/MSP) | 🔵 Basic CSV only | `src/pages/schedule/ScheduleUpload.tsx` |
| Drawing viewer markup → RFI | 🔵 Components exist, wiring partial | `src/pages/drawings/DrawingDetail.tsx` |
| Email notification triggers | 🔵 Edge function exists, not wired | `supabase/functions/send-email/` |
| AI pipeline frontend wiring | 🔵 Edge functions exist, UI partial | multiple `ai-*` edge functions |

Legend: ✅ done · 🟡 deferred · 🔴 real gap · 🔵 roadmap item

## Priority framework

Work is sequenced by four criteria:

1. **Regression insurance first** — tests before risky migrations. Every schema change needs a safety net.
2. **Cheap polish parallel** — UX items with no dependencies run alongside deeper work.
3. **Database before app-layer rewiring** — schema changes cascade; do them once.
4. **Enterprise integrations last** — green-field work that doesn't block other shipping.

Each phase is **independently mergeable**. Any single phase can be paused without blocking others.

---

## Phase A — Test Coverage Foundation · `npm run test:run`

**Goal**: Every audited mutation hook has a Vitest unit test. Every production page has a smoke-render test. CI fails PRs that regress either.

**Why first**: Database migrations (Phase C) are high-risk. Today we'd ship blind. Tests give us confidence for everything after.

### Exit criteria
- [ ] `src/test/hooks/mutations/*.test.ts` — one file per mutation hook (28 files)
- [ ] Every test asserts: permission check calls, schema validates on bad input, audit entry written, cache invalidated
- [ ] `src/test/pages/*.test.tsx` smoke test for every production route (55 files)
- [ ] Vitest coverage threshold bumped from current 43% → 65% statements
- [ ] `npm run test:run` exits 0 in CI on every PR; coverage delta posted as PR comment

### Scope & sequence

| Section | Files | Effort | Risk |
|---|---|---|---|
| A1 — Mutation-hook test scaffold (shared mocks: supabase, auth, audit) | `src/test/hooks/mutations/_helpers.ts` (new) | 0.5 day | Low |
| A2 — Core-entity mutation tests (RFI, Submittal, Task, PunchItem, DailyLog, CO, Meeting) — 7 hooks × 3 operations each = 21 tests | `src/test/hooks/mutations/{entity}.test.ts` | 2 days | Low |
| A3 — Scaffolded-entity mutation tests (Vendor, Contract, Permit, PayApp, Budget, Project, Crew, Contact) — 8 hooks × 3 ops | same pattern | 2 days | Low |
| A4 — Page smoke-render tests (render each route with mocked providers, assert no throw + main landmark present) | `src/test/pages/*.smoke.test.tsx` × 55 | 2 days | Low |
| A5 — CI wiring: coverage threshold + PR comment action | `vitest.config.ts`, `.github/workflows/*` | 0.5 day | Low |

**Dependencies**: None. Can start immediately.

**Rollback plan**: Pure additive; no product code changes.

**Shippable in**: 3 sessions (A1+A2, A3, A4+A5).

---

## Phase B — UX Polish Pass · low-risk visibility wins

**Goal**: Close cosmetic CLAUDE.md violations and the 5 pages missing loading states.

### Exit criteria
- [ ] All list pages render a `<Skeleton>` or `<MetricCardSkeleton>` during `isPending`
- [ ] Every interactive element ≥ 56px for gloved use (current minimum: 44px on a few toggles)
- [ ] `grep -rn "#[0-9a-fA-F]\{3,8\}" src/pages/ src/components/` returns ≤ 10 (down from ~200), all in justified contexts (charts / brand gradients)
- [ ] New ESLint rule `no-hex-colors-in-jsx` ratchets the count downward automatically

### Scope & sequence

| Section | Files | Effort | Risk |
|---|---|---|---|
| B1 — Add skeleton loaders to 5 pages | `AIAgents.tsx`, `AICopilot.tsx`, `Activity.tsx`, `Contracts.tsx`, `Deliveries.tsx` | 0.5 day | Low |
| B2 — Bump RFI/Submittal view-mode toggles to 56px | `src/pages/RFIs.tsx:596-601`, `src/pages/submittals/SubmittalsTable.tsx` | 0.5 day | Low |
| B3 — Centralize remaining hex colors to `theme.ts` tokens | ~200 occurrences across 25 files; codemod-assisted | 2 days | Medium (visual diff) |
| B4 — ESLint rule: `no-hex-colors` (custom rule or `eslint-plugin-tailwind-css`) | `eslint.config.js` | 0.5 day | Low |
| B5 — Audit harness detector: track touch-target violations | `audit/harness/static-audit.ts` — new `detectTouchTargets` | 0.5 day | Low |

**Dependencies**: None. Can run in parallel with Phase A.

**Rollback plan**: B3 carries visual-regression risk. Before/after screenshots per page via Playwright visual snapshots; revert individual files if palette drift detected.

**Shippable in**: 2 sessions (B1+B2+B4, B3+B5).

---

## Phase C — Database Hardening · Supabase migrations + RLS

**Goal**: Close RLS gaps, wire cascade integrity, finish soft-delete, extend offline sync.

### Exit criteria
- [ ] Every SELECT policy on a soft-deletable table filters `WHERE deleted_at IS NULL` for non-admin roles
- [ ] `audit_log` has an org-scoped SELECT policy for admins/owners, INSERT open to service role + authenticated user (for their own actions)
- [ ] `api_keys` has UPDATE (own org) and DELETE (own org admin) policies
- [ ] `ON DELETE` trigger on `auth.users` that cleans `project_members`, `organization_members`, notification subscriptions
- [ ] `budget_line_items` added to `src/lib/offlineDb.ts` sync manifest
- [ ] New migration `20260419000001_rls_completeness.sql` runs clean on production snapshot

### Scope & sequence

| Section | Files | Effort | Risk |
|---|---|---|---|
| C1 — Audit existing RLS against the 99-table inventory (read-only scan) | new script `scripts/audit-rls.ts` + `audit/RLS_MATRIX.md` | 1 day | Low |
| C2 — Write `20260419000001_rls_completeness.sql` — soft-delete filter, api_keys UPDATE/DELETE, audit_log policies | 1 migration file | 1 day | **High** (affects live queries) |
| C3 — Write `20260419000002_user_deletion_cascade.sql` — trigger on `auth.users` | 1 migration file | 0.5 day | Medium |
| C4 — Extend offline sync to include `budget_line_items` and any other financial tables | `src/lib/offlineDb.ts` | 0.5 day | Low |
| C5 — Vitest: `src/test/integration/rls.test.ts` — impersonate each role, assert expected read/write access | new test file | 1 day | Low |
| C6 — Staging-first rollout checklist + rollback migration | `docs/migrations/rls-completeness-rollout.md` | 0.5 day | Low |

**Dependencies**: Phase A must be in place first (regression insurance). Run Phase C1 (read-only audit) in parallel with Phase A.

**Rollback plan**: Each migration ships with an explicit `DOWN` (or superseding migration). C2 is the highest-risk — soft-delete filter affects every SELECT on the 6 tables; staging verification mandatory.

**Shippable in**: 3 sessions (C1, C2+C5+C6, C3+C4).

---

## Phase D — Enterprise Integrations · green-field

**Goal**: Unblock enterprise GC sales called out in `PRODUCTION_ROADMAP.md` (Sage Intacct, Primavera P6, MS Project).

### Exit criteria
- [ ] Sage Intacct OAuth + base sync (contracts, invoices, pay apps read-through)
- [ ] Primavera P6 XER file import → `schedule_phases` with critical path preserved
- [ ] MS Project .mpp / .xml import → same target
- [ ] Integrations settings page lists each with connection status + last sync time
- [ ] Each import is idempotent (re-import doesn't duplicate rows)

### Scope & sequence

| Section | Files | Effort | Risk |
|---|---|---|---|
| D1 — Sage Intacct OAuth flow (edge function + settings UI) | `supabase/functions/intacct-oauth/`, `src/pages/Integrations.tsx` | 3 days | **High** (external OAuth + secret storage) |
| D2 — Intacct sync job (contracts → contracts table) | `supabase/functions/intacct-sync/` | 2 days | High |
| D3 — Primavera P6 XER parser | `src/lib/importers/primavera.ts` + Worker | 2 days | Medium |
| D4 — MS Project XML parser | `src/lib/importers/msproject.ts` | 2 days | Medium |
| D5 — Import UI consolidation (`ScheduleUpload` becomes `ScheduleImportHub`) | `src/pages/schedule/ScheduleImportHub.tsx` | 1 day | Low |
| D6 — Integration test fixtures (real XER, real MPP) | `src/test/integration/imports.test.ts` + fixtures | 1 day | Low |

**Dependencies**: Phase A (tests) before D3/D4 parser changes go live.

**Rollback plan**: D1/D2 behind a feature flag (`VITE_FEATURE_INTACCT=true`); if production issues, disable flag without code revert. D3/D4 are purely additive — new upload type, old path unaffected.

**Shippable in**: 4-5 sessions.

---

## Phase E — AI Pipeline Wiring · connect existing edge functions to UI

**Goal**: 49 edge functions exist; roughly half are unwired. Close the gap.

### Exit criteria
- [ ] Dashboard `AIInsightsBanner` shows real insights from `ai-insights` edge function
- [ ] `Project Brain` streams actual answers with citations from `query-brain`
- [ ] Safety photo upload auto-invokes `analyze-safety-photo` and annotates findings
- [ ] Daily log auto-summary calls `ai-daily-summary` on submit
- [ ] RFI ai-draft modal uses `ai-rfi-draft` (partially there)
- [ ] Conflict detection banner on schedule calls `ai-conflict-detection`
- [ ] Each AI call logs cost + latency to `aiObservability` for monitoring

### Scope & sequence

| Section | Files | Effort | Risk |
|---|---|---|---|
| E1 — Dashboard insights wiring (swap `useAiInsightsMeta` for actual-insights shape if needed) | `src/pages/dashboard/index.tsx`, verify `src/hooks/queries/ai-insights.ts` | 0.5 day | Low |
| E2 — Project Brain streaming client | `src/components/ai/ProjectBrain.tsx` | 1 day | Low |
| E3 — Safety photo AI trigger on upload | `src/pages/safety/IncidentForm.tsx` + `analyze-safety-photo` | 1 day | Medium |
| E4 — Daily log auto-summary | `src/pages/daily-log/index.tsx` submit handler | 0.5 day | Low |
| E5 — Schedule conflict banner | `src/pages/schedule/ScheduleCoordination.tsx` | 1 day | Low |
| E6 — `aiObservability` integration — log every AI call | `src/lib/aiObservability.ts` hooks | 0.5 day | Low |

**Dependencies**: Phase C (audit_log policies) must be in place before E6 writes to `ai_observability`.

**Rollback plan**: Each wiring is a single-page change; revertable per route.

**Shippable in**: 3 sessions.

---

## Phase F — Drawing Viewer + Email Notifications · user-facing features

**Goal**: Close two features that consistently show up in customer feedback and `PRODUCTION_ROADMAP.md`.

### Exit criteria
- [ ] Drawing viewer supports highlight/comment markup that creates a linked RFI with back-reference
- [ ] On RFI create / status change / overdue, email sent via `send-email` edge function using React Email templates
- [ ] Notification preferences page honors opt-in/opt-out per event type
- [ ] Digest emails for daily log approvals (morning summary)

### Scope & sequence

| Section | Files | Effort | Risk |
|---|---|---|---|
| F1 — Drawing markup tool (react-konva or SVG overlay on pdfjs canvas) | `src/pages/drawings/DrawingDetail.tsx` + new `DrawingMarkupLayer.tsx` | 3 days | Medium |
| F2 — Markup → RFI linkage (create RFI from markup selection) | `src/components/forms/CreateRFIModal.tsx` takes `drawingContext` prop | 1 day | Low |
| F3 — React Email templates (rfi-created, rfi-status-changed, rfi-overdue, daily-digest) | `supabase/functions/send-email/templates/` | 1 day | Low |
| F4 — Trigger hooks: RFI/Submittal/DailyLog audit events fan out to `send-email` | `supabase/functions/notification-dispatcher/` | 1 day | Medium |
| F5 — Notification preferences UI (already exists; wire to triggers) | `src/pages/Settings/NotificationSettings.tsx` | 0.5 day | Low |
| F6 — Daily digest cron job | `supabase/functions/daily-digest/` | 1 day | Low |

**Dependencies**: Phase C (soft-delete filtering) for digest queries to skip deleted records. Phase A (tests) for notification dispatcher confidence.

**Rollback plan**: F4 behind a feature flag per event type. Digest cron disabled via environment variable if issues detected.

**Shippable in**: 3-4 sessions.

---

## Cross-cutting infrastructure

### G — CI/CD hardening (continuous, 0.5 day total)

- GitHub Actions matrix: `npm run test:run`, `npm run test:e2e`, `npm run audit`, `npm run build`
- Coverage + bundle-size report posted as PR comments
- `npm run audit:static` runs on every PR and fails on any P0 regression
- PAGE_HEALTH.md diff shown inline

### H — Observability (1 day, depends on Phase E)

- Structured logs from edge functions → Supabase Logs
- Sentry release tagging on every merge-to-main
- Lighthouse CI on critical routes (Dashboard, RFIs, Budget)

---

## Session planning — suggested sprint breakdown

Each numbered bullet = one working session (~4–6 hours).

**Sprint 1 — Test foundation + low-risk polish (5 sessions)**
1. A1 + A2 (mutation-hook scaffold + core-entity tests)
2. A3 (scaffolded-entity mutation tests)
3. A4 (page smoke tests)
4. A5 (CI wiring)
5. B1 + B2 + B4 (skeleton loaders + touch targets + ESLint rule)

**Sprint 2 — Database + color pass (4 sessions)**
6. C1 (RLS audit + matrix)
7. C2 + C5 + C6 (RLS completeness migration + tests + rollout doc)
8. C3 + C4 (user-deletion cascade + offline sync manifest)
9. B3 + B5 (hex-color centralization + harness detector)

**Sprint 3 — AI pipeline wiring (3 sessions)**
10. E1 + E2 (Dashboard insights + Project Brain streaming)
11. E3 + E4 (Safety photo AI + daily log auto-summary)
12. E5 + E6 (Schedule conflict + observability)

**Sprint 4 — Drawing markup + email (3–4 sessions)**
13. F1 (drawing markup tool)
14. F2 + F3 (markup→RFI linkage + email templates)
15. F4 + F5 + F6 (notification dispatcher + preferences + daily digest)

**Sprint 5 — Enterprise integrations (4–5 sessions)**
16. D1 (Intacct OAuth)
17. D2 (Intacct sync)
18. D3 (Primavera P6 parser)
19. D4 (MS Project parser)
20. D5 + D6 (import hub + test fixtures)

**Total estimate: ~18–20 working sessions (~4–5 calendar weeks at 1 session/day).**

---

## Acceptance criteria for "production-ready"

The platform is ready for enterprise GC sales when:

- ✅ CRUD audit 55/55 @ 100% (**already achieved**)
- ✅ Every mutation audited + Zod-validated + permission-gated (**already achieved**)
- ⬜ Vitest coverage ≥ 65% statements, 55% branches
- ⬜ Zero P0 findings in static audit for 14 consecutive days
- ⬜ All 6 soft-delete tables filter RLS by `deleted_at IS NULL`
- ⬜ Sage Intacct integration GA'd behind feature flag, at least 1 pilot customer on it
- ⬜ Email notifications GA'd, opt-in tracked, bounce rate < 2%
- ⬜ Drawing markup → RFI linkage in production, used by ≥ 1 pilot
- ⬜ Lighthouse Performance ≥ 80 on Dashboard + RFIs + Budget

## How to use this document

- **Each phase is independently mergeable.** Pick what matters most given current business pressure.
- **Phase A is strongly recommended first** — every subsequent phase is safer once tests exist.
- **Phases B / C1 can run in parallel** with Phase A (no code overlap).
- **Before starting Phase C**, review `audit/RLS_MATRIX.md` (produced by C1) against product requirements with a DBA/senior dev.
- **Every commit during this roadmap should keep `npm run audit:static` at 55/55 @ 100%.** If it drops, stop and fix before continuing.
- **This document should be kept alive.** Check off completed items, add new findings, update estimates after each sprint.

_Next actionable step: create branch `claude/phase-a-test-foundation` and land section A1 (shared mutation-test helpers + fixtures)._
