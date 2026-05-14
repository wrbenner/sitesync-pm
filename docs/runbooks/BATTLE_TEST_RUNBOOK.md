# Battle-Test Runbook — Phase 1 BRT

**Owner:** BRT Track C / sub-8 §4.4
**Last updated:** 2026-05-13
**Status:** Ready for first run — pre-launch verification

A "battle test" simulates hundreds of real users exercising every page and
workflow concurrently, against a live deploy, with full observability rigged
to capture failures. Goal: find the breakages that only emerge under sustained
load (race conditions, RLS leaks at scale, perf cliffs, rate-limit ceilings,
error-handling gaps) before they hit real customers.

---

## What this is — and isn't

| Yes | No |
|-----|-----|
| Pre-launch / pre-customer verification | Routine CI |
| Run against live production deploy | Run against ephemeral preview |
| Synthetic data tagged `is_demo=true + settings.scale_test=true` | Real customer data |
| Walker-authorized spend (~$500 ceiling) | Free / unattended |
| Playwright personas as the centerpiece | k6 as the centerpiece (see below) |
| 2 hours of focused live monitoring | "Set and forget" |

## The two harnesses

Two complementary tools — they catch different classes of bug.

### A. Playwright persona suite — **primary battle test**

This is the load that matters. Real users sign in, navigate the app, fill
forms, click buttons. Every assertion runs through the same code path a
customer would, with real JWTs, real RLS context, real client-side state.

- `e2e/personas/` — 10 time-sliced personas (pm-morning, super-evening,
  owner-weekly, compliance-monthly, it-admin-onboarding, …). Each persona
  exercises a full "day in the life."
- `e2e/` — 62 additional spec files covering every page and workflow.
- `e2e/polish-audit.spec.ts` — visual crawler across 27 routes × 5 viewports.
- 4 Playwright configs: `playwright.config.ts` (default), `playwright.acceptance.config.ts`,
  `playwright.scenarios.config.ts`, `playwright.polish.config.ts`.

Run with `--workers=4` or higher to put real concurrent pressure on auth,
RLS, edge functions, and the front-end while the suite is in flight.

### B. k6 scaffold — **coarse infra-level smoke only**

`scripts/scale-test/run.ts` hammers a handful of REST + edge-fn endpoints with
the anon key. It's useful for floor-level latency, edge fn cold-start, 429
rate-limiter behavior, and timeout shaping.

**Known gap:** the current scaffold uses the anon key only, so under RLS every
read returns zero rows and every write 403s. It measures "permission-denied
throughput," not real feature throughput. Don't read its numbers as
production-ready signal — that's what the Playwright suite is for.

Fixing this properly requires (a) seed-orgs creating per-org auth.users and
(b) run.ts signing in per VU and threading the resulting JWT through every
request. ~4–6 hr of careful rewrite. Deferred until post-launch.

---

## Pre-flight checklist (15 min, $0)

Before burning the real budget:

- [ ] `brew install k6` (or per https://k6.io/docs/get-started/installation/)
- [ ] `npx playwright install` (chromium at minimum)
- [ ] `.env.scale-test` populated (gitignored — never commit):
  ```
  SUPABASE_URL=https://hypxrmcppjfbtlwuoafc.supabase.co
  SUPABASE_ANON_KEY=<from Supabase dashboard>
  SUPABASE_SERVICE_KEY=<from Supabase dashboard — required for seed/teardown>
  ```
- [ ] Baseline snapshot via Supabase MCP `execute_sql`:
  ```sql
  SELECT count(*) AS orgs FROM organizations;
  SELECT count(*) AS rfis FROM rfis;
  SELECT count(*) AS logs FROM daily_logs;
  SELECT count(*) AS incidents FROM audit_incidents
    WHERE created_at > NOW() - interval '24 hours';
  ```
- [ ] Sentry baseline: error rate over the last hour (note the number).
- [ ] Advisor lint: `mcp get_advisors` — confirm ERROR count = 0.
- [ ] 1/10-scale dry run:
  ```bash
  set -a; source .env.scale-test; set +a
  npx tsx scripts/scale-test/seed-orgs.ts --count 5 > .scale-test-orgs.csv
  TEST_ORG_IDS=$(cat .scale-test-orgs.csv) \
    k6 run -e SUPABASE_URL=$SUPABASE_URL -e SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY \
           --vus 5 --duration 2m scripts/scale-test/run.ts
  npx tsx scripts/scale-test/teardown.ts
  ```
- [ ] Verify post-dry-run: org count, rfi count back to baseline.

**Abort the real run if** the dry-run produces unexpected 5xx errors or the
teardown leaves orphan rows. Fix locally first.

---

## Run plan — 6 phases

Each phase gated on the previous passing. Hard-abort on RLS leak detection
or sustained 5xx > 10%.

### Phase A — Pre-flight (15 min, $0)

See above. **Gate:** dry-run clean, baselines captured.

### Phase B — Full seed (20 min, ~$5)

The seed-orgs.ts harness was reworked on 2026-05-14 (Track 1b+1c) to write
per-VU auth credentials. Seed → mint tokens → seed storage:

```bash
set -a; source .env.scale-test; set +a
mkdir -p battle-test-results/$(date +%Y%m%d-%H%M)
export RUN_DIR=battle-test-results/$(date +%Y%m%d-%H%M)

# 1. Provision 50 orgs × 10 mixed-role members = 500 real users.
npx tsx scripts/scale-test/seed-orgs.ts \
  --count 50 \
  --members-per-org 10 \
  --out $RUN_DIR/fixture.ndjson

# 2. Hydrate project_members rows so RLS-write policies pass.
#    Idempotent: rewrites the fixture in place with projectId per org.
npx tsx scripts/scale-test/seed-projects.ts \
  --fixture $RUN_DIR/fixture.ndjson \
  --out $RUN_DIR/fixture.ndjson

# 3. Sign each user in, capture JWTs for k6's SharedArray.
#    `--owners-only` skips the 450 non-owner members for a smaller token
#    pool when the staging Supabase auth rate-limit is tight. Drop the flag
#    for a full 500-token pool. `--throttle 5` = 5 sign-ins/sec.
npx tsx scripts/scale-test/mint-vu-tokens.ts \
  --owners-only \
  --throttle 5 \
  --fixture $RUN_DIR/fixture.ndjson \
  --out $RUN_DIR/vu-tokens.ndjson

# 4. Seed Storage buckets so upload-dependent specs can run end-to-end.
#    `--per-project 9` = 3 drawings + 3 photos + 3 documents per project.
npx tsx scripts/scale-test/seed-storage.ts \
  --fixture $RUN_DIR/fixture.ndjson \
  --per-project 9
```

**Verify:**
```sql
SELECT count(*) FROM organizations WHERE settings->>'scale_test' = 'true';
-- expect: 50
SELECT count(*) FROM organization_members WHERE organization_id IN
  (SELECT id FROM organizations WHERE settings->>'scale_test' = 'true');
-- expect: ~500 (50 orgs × ~10 members each)
SELECT role, count(*) FROM organization_members WHERE organization_id IN
  (SELECT id FROM organizations WHERE settings->>'scale_test' = 'true')
GROUP BY role;
-- expect role mix matching the configured ROLE_MIX (default pm:1 super:2 sub:5 architect:1 + owner)
```

**Gate:** 500 users authenticated, fixture.ndjson + vu-tokens.json present, no
SQL exceptions in seed-orgs stderr.

### Phase B.1 — Verify recently-shipped fixes (3 min, $0)

Before the load run, confirm none of the 14 audit fixes have regressed:

```bash
npx playwright test e2e/audit/verify-pr-529-531.spec.ts --reporter=list
# Expect: 16 passed, 2 skipped (fixme + conditional). Any failure → halt.
```

### Phase C — Sustained load (2 hours, ~$400–500)

The main event. Three parallel runs.

**JWT-expiry caveat:** Supabase JWTs default to 1h. The heavy profile is
~2h 8m. Either (a) extend JWT expiry to 3h in the project's auth config
before kicking off, or (b) re-run mint-vu-tokens.ts at the 50-min mark and
restart k6 with the new token file.

**Terminal 1 — k6 heavy profile (per-VU auth):**
```bash
set -a; source .env.scale-test; set +a
k6 run -e PROFILE=heavy \
       -e SUPABASE_URL=$SUPABASE_URL \
       -e SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY \
       -e VU_TOKENS_FILE=$RUN_DIR/vu-tokens.ndjson \
       --out json=$RUN_DIR/k6.json \
       scripts/scale-test/run.ts
```

**Terminal 2 — Playwright persona suite (primary signal):**
```bash
npx playwright test e2e/personas/ \
  --config=playwright.scenarios.config.ts \
  --workers=4 \
  --reporter=html,json
```

**Live monitoring (parallel terminals):**

| What | How | Cadence |
|------|-----|---------|
| k6 throughput, p95, error rate | k6's built-in summary | continuous |
| Sentry errors | dashboard for the project | continuous |
| PostHog events | BRT funnel | every 5 min |
| `audit_incidents` | `SELECT * FROM audit_incidents WHERE created_at > NOW() - interval '5 min' ORDER BY created_at DESC;` via MCP | every 60s |
| `/health` heartbeat | `watch -n 30 curl -s $SUPABASE_URL/functions/v1/health` | every 30s |

**Hard-abort if:**
- `audit_incidents` row with `category='rls_leak'` → **STOP IMMEDIATELY** — this is the I1 ship-stopper.
- `/health` returns 503 for 2 consecutive minutes → **STOP** — investigate Supabase outage.
- 5xx rate > 10% sustained for 5 min → **STOP** — real degradation.

**Soft-degrade (record, don't abort):**
- p95 > 1500 ms sustained for 5 min → log as perf finding.
- Rate-limit 429s firing (200/hr `iris-call`, 50/hr `send-invite`) → confirms limiter works.
- Edge fn timeouts (>10 s) → record + investigate post-run.

### Phase D — Browser-level breadth sweep (runs DURING Phase C)

While Phase C is hammering the backend:

```bash
# All 62 non-persona specs at 4-worker parallelism:
npx playwright test --config=playwright.config.ts --workers=4

# CRUD round-trip suite (real backend, real auth — Track 3):
E2E_REAL_BACKEND=true \
POLISH_USER=$SCALE_TEST_OWNER_EMAIL POLISH_PASS=$SCALE_TEST_PASSWORD \
  npx playwright test e2e/scenarios/06-crud-roundtrip.spec.ts --workers=4

# Polish-audit visual crawler:
npx playwright test e2e/polish-audit.spec.ts --config=playwright.polish.config.ts
```

Capture: every screenshot, every console error, every network failure →
`battle-test-results/<ts>/`.

### Phase E — Adversarial RLS under load (runs AT the 60-min mark)

Mid-sustain, while 500 VUs are hammering the DB:

```bash
supabase test db --linked --file supabase/tests/database/sub_1_adversarial_rls_matrix.sql
```

Expect all 11 assertions to pass even with 500 concurrent JWT contexts in flight.

### Phase F — Results capture + teardown (30 min, $0)

```bash
# 1. Capture k6 summary, Playwright HTML report, screenshots
ls battle-test-results/$(date +%Y%m%d-%H%M)/

# 2. Audit incidents during the run window
psql ... -c "SELECT * FROM audit_incidents WHERE created_at BETWEEN <start> AND <end>;"

# 3. Advisor lint diff (before vs after)
# via Supabase MCP get_advisors

# 4. Teardown
npx tsx scripts/scale-test/teardown.ts

# 5. Verify baseline returned
psql ... -c "SELECT count(*) FROM organizations WHERE settings->>'scale_test' = 'true';"
# expect: 0
```

Write `docs/audits/BATTLE_TEST_RESULTS_<DATE>.md` using the template at
the bottom of this runbook.

---

## Spend envelope

Walker pre-authorized ~$500 (2026-05-13). Dominant line items:

| Cost line | Estimate |
|-----------|----------|
| Anthropic AI calls (iris-call × heavy VU mix) | $300–450 |
| Supabase pro tier overage (reads, edge fn invocations) | $30–80 |
| Vercel bandwidth (Playwright suite hitting prod deploy) | $5–20 |
| Stripe test-mode webhook flood | $0 (test mode) |
| **Total ceiling** | **~$500** |

If the real-time cost watch (Anthropic console) trends past $400 at the
75-min mark, abort early and capture what you have.

---

## Pre-launch readiness signals (8-check gate)

After Phase F, the run is **green** iff all 8 hold:

1. k6: p95 < 1500 ms across all ops, 5xx rate < 1% sustained.
2. Zero `audit_incidents` rows with `category in ('rls_leak', 'chain_break', 'key_leak')`.
3. Playwright (default + scenarios): pass rate ≥ 95% (visual flake allowance).
4. Persona suite: all 10 personas complete their workflow.
5. Polish-audit: zero NEW visual regressions vs `main` baseline.
6. Sentry: error rate during test ≤ 2× baseline (excluding expected 429s).
7. Advisor lint state unchanged (ERROR count still 0).
8. Teardown: synthetic org count returns to 0; table sizes within ±10 rows of baseline.

If all 8 pass → file `BATTLE_TEST_RESULTS_<DATE>.md` with a green status block;
Walker's go-for-launch is fully evidenced.

If any fail → document the failure mode, file a fix PR, re-run that specific
phase. Do not re-run the full 2h test for a single-phase fail.

---

## Risk register + mitigations

| Risk | Mitigation |
|------|------------|
| Anthropic workspace rate-limit | Reduce `iris-call` weight in run.ts before Phase C if pre-flight already 429s |
| Supabase tier ceiling | Confirm pro tier in dashboard before Phase C; pro handles 500 concurrent + 60k req/min |
| Stripe webhook flood | k6 doesn't hit Stripe directly; skip `start-trial-checkout` in op mix if needed |
| Turnstile bot detection | seed-orgs uses service role and bypasses `/signup`; Playwright uses Turnstile testing tokens |
| Synthetic data leaking cross-tenant | Double-tag (`is_demo=true` + `settings.scale_test=true`); RLS hides cross-tenant; teardown is idempotent |

---

## Results template

Copy this into `docs/audits/BATTLE_TEST_RESULTS_<YYYY-MM-DD>.md` post-run.

```markdown
# Battle Test Results — <DATE>

**Run window:** <start ISO> → <end ISO>
**Target:** production Supabase project hypxrmcppjfbtlwuoafc
**Authorized by:** Walker, 2026-05-13
**Spend actual:** $<X> / $500 ceiling

## 8-check gate

- [ ] k6 p95 < 1500ms; 5xx < 1%
- [ ] Zero P0 audit_incidents
- [ ] Playwright pass rate ≥ 95%
- [ ] 10/10 personas complete
- [ ] Zero NEW polish regressions
- [ ] Sentry error rate ≤ 2× baseline
- [ ] Advisor ERROR count unchanged
- [ ] Teardown returns to baseline ±10 rows

**Verdict:** GREEN / RED

## Findings

| # | Severity | Phase | Description | Repro | File / Line | Owner |
|---|----------|-------|-------------|-------|-------------|-------|

## Perf baseline (per op)

| Op | p50 | p95 | p99 | 5xx % |
|----|-----|-----|-----|-------|
| rfi_read | | | | |
| rfi_create | | | | |
| daily_log_create | | | | |
| iris-call | | | | |
| schedule_read | | | | |

## Recommendations (follow-up PRs)

- [ ] …
```

---

## Quick reference — every command in this runbook

```bash
# Install
brew install k6
npx playwright install chromium

# Env
set -a; source .env.scale-test; set +a

# Seed
npx tsx scripts/scale-test/seed-orgs.ts --count 500 > .scale-test-orgs.csv

# Smoke (default)
TEST_ORG_IDS=$(cat .scale-test-orgs.csv) \
  k6 run -e SUPABASE_URL=$SUPABASE_URL -e SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY \
         scripts/scale-test/run.ts

# Heavy
TEST_ORG_IDS=$(cat .scale-test-orgs.csv) \
  k6 run -e PROFILE=heavy \
         -e SUPABASE_URL=$SUPABASE_URL -e SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY \
         scripts/scale-test/run.ts

# Personas (primary)
npx playwright test e2e/personas/ --config=playwright.scenarios.config.ts --workers=4

# Full breadth sweep
npx playwright test --config=playwright.config.ts --workers=4

# Polish-audit
npx playwright test e2e/polish-audit.spec.ts --config=playwright.polish.config.ts

# Adversarial RLS
supabase test db --linked --file supabase/tests/database/sub_1_adversarial_rls_matrix.sql

# Teardown
npx tsx scripts/scale-test/teardown.ts
# or scoped:
npx tsx scripts/scale-test/teardown.ts --batch <batch_uuid>
# or dry-run:
npx tsx scripts/scale-test/teardown.ts --dry-run
```
