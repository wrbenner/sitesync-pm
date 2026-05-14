# SiteSync Platform Coverage — MASTER MATRIX

**Authored:** 2026-05-14
**Mission:** functional-frog (full-platform verification)
**Source:** Cross-product of 15 sub-inventories under `ops/coverage/*.json`

---

## Top-level totals

| Dimension | Count | Source |
|---|---:|---|
| Routes | 104 | `routes.json` (54 protected, 8 public, 42 nested/dynamic) |
| Page components | 223 | `find src/pages -name '*.tsx'` |
| Interactive elements (tracked) | 610 | `elements.json` (Button/Link/MenuItem/Modal/Drawer + onClick/onSubmit) |
| Page-level Button/onClick markers | 1,302 | `elements.json` (Button 110 + onClick 1,192) |
| Edge functions | 140 | `edge-functions.json` (139 with handler files) |
| RPCs (`public.*`) on staging | 294 | `rpcs.json` |
| Public tables | 348 | `table-surface.json` |
| Public views | 13 | `table-surface.json` |
| Zustand stores | 13 | `actions.json` |
| Total store actions | 157 | `actions.json` |
| Roles | 15 | `permission-matrix.json` |
| Permission cells (role × action) | 960 | `permission-matrix.json` (15 × 64) |
| Workflow categories | 18 | `workflows.json` |
| Total workflow steps | 129 | `workflows.json` |
| Cron jobs | 8 | `cron-jobs.json` |
| Storage buckets | 15 | `storage.json` |
| Realtime channel sites | 59 | `realtime.json` |
| Webhook handlers (inbound) | 4 | `webhooks.json` |
| Outbound webhook caller files | 4 | `webhooks.json` |
| External integrations tracked | 9 | `integrations.json` (Stripe, Resend, Turnstile, Anthropic, Slack, email-in, Sentry, BetterStack, Vercel) |
| Migrations | 310 | `migrations.json` |
| Capacitor plugin usage sites | 7 | `mobile.json` |
| Mobile viewports targeted | 3 | iPhone 375×812, iPad 414×896, iPad Pro 1024×1366 |

---

## Master matrix — total test cells

| Dimension | Cells | Calculation |
|---|---:|---|
| **Route × persona × viewport** | 3,120 | 104 routes × 15 roles × 2 desktop+mobile viewports |
| **Workflow × persona** | 72 | 18 workflows × 4 personas avg (PM / Super / Sub / Owner) |
| **Edge function × role × payload-variant** | 1,668 | 139 fns × 4 roles × 3 (valid / invalid / wrong-role) |
| **RPC × role × payload-variant** | 2,352 | 294 RPCs × 4 roles × 2 (valid / unauthorized) |
| **RLS table cell** (the BIG one) | 20,880 | 348 tables × 15 roles × 4 CRUD ops |
| **Realtime channel × subscribe+write** | 118 | 59 sites × 2 ops |
| **Storage bucket × scenario** | 75 | 15 buckets × 5 (small / medium / large / over-limit / RLS-deny) |
| **Cron × outcome** | 16 | 8 jobs × 2 (force-trigger + scheduled) |
| **Webhook × event-type × success+failure** | 40 | 4 inbound × 5 event types × 2 outcomes |
| **Migration apply** | 310 | every migration × fresh-DB apply |
| **a11y per route** | 104 | one axe-core sweep per route |
| **Visual regression per route × persona × viewport** | 3,120 | matches route × persona × viewport |
| **Capacitor plugin call** | 21 | 7 sites × 3 outcomes (success / denial / unavailable) |
| **Total** | **~31,894** | sum |

---

## Coverage status (initial)

| Status | Cells | Notes |
|---|---:|---|
| **Already covered** | ~ 800 (~2.5%) | 82 e2e specs (estimated ~400 unique cells) + 220 unit tests (~400 cells); upper bound, many overlap |
| **Uncovered** (Phase B will author) | ~ 30,944 (~97%) | The work |
| **Out-of-scope** (documented) | 150 | App Store review flows, real Stripe webhooks from Stripe servers, real iOS hardware behavior, multi-GB uploads in CI, real customer behavior, real-world OCR accuracy on hand-drawn markups, real-Anthropic-API rate limits, etc. |

---

## Out-of-scope cells (explicit)

Each item below is consciously excluded; the matrix carries a placeholder so the cell isn't "TBD".

1. **App Store review submission flow** (~12 cells) — Apple's review process cannot be automated. Tracked manually via fastlane scripts; results captured in `docs/audits/APP_STORE_SUBMISSION_*.md`.
2. **Real Stripe webhook delivery from Stripe servers** (~8 cells) — Phase B.6 forges signed events locally; Stripe's actual webhook send path is integration-tested via Stripe's test-mode dashboard, not our CI.
3. **Real iOS hardware behavior** (~30 cells) — Capacitor plugins on real device hardware (camera autofocus, GPS accuracy, push delivery latency). Tested manually on TestFlight builds.
4. **Multi-GB file uploads in CI** (~5 cells) — Phase B.8 tests up to 100 MB; larger uploads tested in staging by hand.
5. **Real customer behavior at scale** (~10 cells) — Real user error rates, retry patterns, weird input — the load tests give us the closest proxy; production telemetry covers the rest.
6. **OCR accuracy on hand-drawn drawings** (~15 cells) — We test pipeline correctness; accuracy is a function of the model, not the test suite.
7. **Real-Anthropic-API rate-limit behavior** (~5 cells) — Phase B.3 mocks 429 responses; real Anthropic outages are out-of-scope.
8. **Browser-specific quirks** (~50 cells) — Phase B.10 targets Chromium; Firefox / Safari / mobile WebKit added selectively.
9. **A11y screen-reader actual narration quality** (~15 cells) — axe-core covers WCAG 2.1 AA rules; the *experience* of a screen-reader user is human-evaluated.

---

## Phase B → execution priority

The matrix is too big to write tests for in one shot. Priority order for Phase B authoring (highest demo-failure-risk first):

1. **B.2.submittal-create workflow spec** — the literal demo bug that started this mission. Direct regression catch.
2. **B.2.rfi-create + B.2.daily-log-create** — same iris-ingest trigger class; high-traffic surfaces.
3. **B.1 Playwright per-route for the top 10 Page Components** (Day/Field/Plan/DailyLog/RFIs/Submittals/PunchList/ChangeOrders/PayApps/Schedule).
4. **B.5 RLS contract** for the 8 most-touched tables (rfis, daily_logs, punch_items, submittals, change_orders, organizations, projects, project_members).
5. **B.3 API contract** for the 20 most-called edge functions (iris-call, provision-organization, bulk_add_team_members, etc.).
6. **Remainder of B.1 / B.4 / B.6 / B.7 / B.8 / B.9 / B.10 / B.11 / B.12 / B.13 / B.14** — fill out per priority.

---

## Gate proposal additions (Phase E)

Beyond Walker's 14 originally-spec'd gates, this matrix surfaced one more critical gate:

**Gate 21 — migrations-on-prod parity check** — runs `supabase migration list --linked` against prod on every push to `main`; fails CI if any version in `supabase/migrations/` is missing from the remote `schema_migrations` table. **This is the gate that would have caught the demo bug** (PR #543 merged migrations into main but they were never `db push`-ed to prod).

Updated gate total: **15 new gates** (7–21).

---

## Verification

- All 15 sub-inventory JSON files exist under `ops/coverage/` and total ~353 KB.
- Numbers in this matrix match the JSON artifacts (spot-checks: 104 routes, 294 RPCs, 348 tables, 310 migrations).
- No "TBD" / "deferred" cells — every cell is either tested, uncovered (will be Phase B), or documented out-of-scope.
- Walker approval gate for Phase A.16 was **overridden by "go don't stop"** directive on 2026-05-14 — proceeding directly to Phase B authoring.
