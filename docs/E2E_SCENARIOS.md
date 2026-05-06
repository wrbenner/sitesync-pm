# E2E Integration Scenarios

> Owner's IT director: "Show me a test that proves an architect's email
> response actually closes the SLA loop and triggers the right
> auto-drafted CO."

Eight scenario specs. Each one tests a chain across multiple edge
functions, not a single unit. Together they prove the loops compose.

## The 8 scenarios

| # | Scenario | Status | What runs today |
| --- | --- | --- | --- |
| 1 | SLA loop (RFI → escalate → inbound reply → close) | **skipped** | requires inbound-email + sla-escalator (Tab A) |
| 2 | Scope-change loop (RFI answered → CO drafted → approved → finalized) | **partial** | logic-half runs (RFI→CO drafter shipped this session); UI approval + Pay App reconciliation deferred |
| 3 | Morning-briefing loop (cron → queue → email → app) | **skipped** | requires morning-briefing edge fn + notification-queue-worker |
| 4 | Walkthrough loop (voice/photo → punch → sub email → reply) | **partial** | linkage engine sub-test runs (this session's photoLinker); full loop deferred |
| 5 | Compliance pack loop (WH-347 generate → e-sign → archive → verify) | **partial** | WH-347 generation + deterministic hash + PDF render runs; archive + sealed-pack deferred |
| 6 | Migration loop (Procore + Sage 300 → portfolio + cross-project search) | **skipped** | Procore + Sage 300 importers not built |
| 7 | Signing loop (sign → chain → verify → tamper detect) | **full** | every dependency shipped this session |
| 8 | Realtime loop (two PMs co-edit RFI without data loss) | **skipped** | Liveblocks integration is Tab A territory |

`skipped` specs use `test.skip(...)` with the dependency reason as the test
title. Removing the `.skip` is the only change required when the dependency
ships.

## Performance gates

Per the spec:
- Each scenario completes in < 3 min real-time (`timeout: 180_000` in
  `playwright.scenarios.config.ts`)
- Setup + teardown < 30s combined (`SETUP_BUDGET_MS = 15_000` and
  `TEARDOWN_BUDGET_MS = 15_000` in `helpers/scenarioRunner.ts`)
- Total suite < 30 min on CI (`timeout-minutes: 35` in the workflow,
  with margin for setup)

## What's mocked at the boundary

- **Anthropic API** — `page.route('**://api.anthropic.com/**', ...)` returns
  a fixture-recorded response keyed by user-prompt prefix. Missing prefixes
  fail loud rather than silently hitting the real API.
- **Resend / outbound mail** — `page.route('**://api.resend.com/**', ...)`
  captures every outbound send. Specs assert against `ctx.emails`.
- **Cron / scheduler** — `ctx.triggerCron('<name>', payload)` POSTs to
  `/test/trigger-cron/<name>` which the dev server exposes when
  `ENABLE_TEST_HOOKS=1`. No wall-clock dependence.

## Database isolation

`helpers/dbReset.ts` wipes test-scoped rows by `DELETE WHERE project_id IN
(<3 fixture IDs>)`. The fixture project IDs are deterministic UUIDv4s so
the truncate is bounded — non-fixture data is never touched.

The spec called for "Supabase branch reset" — that requires Supabase
Branching with billing-tier support. v1 uses scoped truncate which gives
the same isolation guarantee for the test fixtures we own. Branching wires
in when the customer-facing branching feature is GA on our project.

## Running locally

```bash
# 1. Make sure local Supabase is up
supabase status

# 2. Apply all migrations
for f in supabase/migrations/*.sql; do
  psql 'postgres://postgres:postgres@127.0.0.1:54322/postgres' -f "$f"
done

# 3. Run the dev server with test hooks enabled
ENABLE_TEST_HOOKS=1 VITE_DEV_BYPASS=true bun run dev

# 4. In another terminal, run the scenarios
bunx playwright test -c playwright.scenarios.config.ts

# Run a single scenario
bunx playwright test -c playwright.scenarios.config.ts e2e/scenarios/07-signing-loop.spec.ts

# Run only the active (non-skipped) tests, see which scenarios pass today
bunx playwright test -c playwright.scenarios.config.ts --grep-invert "skip"
```

## Required env vars (CI)

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Connection string for the test Postgres. CI uses a service container. |
| `ENABLE_TEST_HOOKS` | `"1"` enables `/test/*` endpoints on the preview server. |
| `E2E_BASE_URL` | Base URL the scenarios hit. Defaults to local dev server. |

Anthropic + Resend keys are NOT required — both are mocked at the
boundary. Real-API calls in scenarios are an explicit anti-pattern: any
`route()` miss falls through to a "no AI fixture for prompt" error.

## Fixtures

`e2e/fixtures/projects/` — 3 project shapes: small (4 members, 6 RFIs,
12 punch), mid (12/35/180), enterprise (47/240/4200). The enterprise
fixture mirrors the Mortenson-scale failure case the spec calls out
(4,200 punch items).

`e2e/fixtures/identities/` — 6 user roles (owner, PM, super, architect,
compliance, sub). Their UUIDs are deterministic and used across every
scenario.

`e2e/fixtures/scenarios/` — per-scenario input payloads. Naming convention
matches the spec file: `02-scope-change.json` feeds
`02-scope-change-loop.spec.ts`. A spec without a fixture file is fine
(`scenarioRunner` returns `{}` rather than throwing).

## CI

`.github/workflows/e2e-scenarios.yml` runs the suite on every PR + push to
main. Service Postgres + dev preview server. Playwright report uploaded
as a 14-day artifact for failure investigation.

The workflow is environment-driven: removing `test.skip` from a scenario
will start exercising that scenario in CI without further config — the
mocks are global, the helpers are stable.

## When a deferred scenario unblocks

1. Remove `test.skip` from the scenario spec.
2. Confirm the required edge function / table is migrated against the
   test DB (CI applies all migrations before running).
3. Add fixture data if needed (`e2e/fixtures/scenarios/<n>-<name>.json`).
4. Add Anthropic / outbound-mail mock entries to the spec's
   `aiResponses` map.
5. Run locally; confirm under 3 min; PR.

## Failure modes documented

| Failure | Handling |
| --- | --- |
| Test depends on real Anthropic API | Mocked at the boundary; missing fixture fails loud, never silent. |
| Test depends on real Resend | Mocked at the SMTP/webhook boundary; spies in `ctx.emails`. |
| Flake on cron timing | Triggered manually via `/test/trigger-cron/<name>`; assert post-conditions, not wall-clock. |
| DB state leaks between tests | Per-scenario truncate scoped to the 3 fixture project IDs. Bounded blast radius. |
| Fixtures drift from real schema | Helper-level unit tests pin fixture IDs (`scenarioRunner.test.ts`). Type-checking the `Database` import would catch full schema drift; not wired today. |
| Tests pass locally but fail in CI | Required env vars documented above; CI workflow loads from secrets. |
