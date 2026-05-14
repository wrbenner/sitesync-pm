# Coverage Session 1 — 2026-05-14

**Mission:** Platform verification (functional-frog), per `~/.claude/plans/mission-complete-the-functional-frog.md`.
**Session scope:** Phase A.0 demo bug triage + complete Phase A.1–A.16 inventory + start of Phase B.

---

## Phase A.0 — Demo bug triage (RESOLVED)

**Symptom:** During Walker's live demo on 2026-05-14, creating a submittal via the Vercel preview UI failed.

**Root cause:** PR #543's migrations (`20261020000000_fix_iris_ingest_trigger_column_name.sql` + `20261022000000_fix_daily_logs_iris_summary.sql`) merged to `main` and Vercel auto-deployed the new frontend bundle to production, BUT Supabase migrations don't auto-apply on Vercel deploys. They require `supabase db push --linked` against the prod Supabase ref. That step was never executed against `hypxrmcppjfbtlwuoafc`.

**Pre-fix prod state (verified via read-only MCP, 2026-05-14):**

| Trigger function on prod | Broken references |
|---|---|
| `change_orders_iris_ingest_trigger` | `projects.org_id` |
| `daily_logs_iris_ingest_trigger` | `NEW.narrative` + `projects.org_id` |
| `documents_iris_ingest_trigger` | `projects.org_id` |
| `rfis_iris_ingest_trigger` | `projects.org_id` |

**Customer-visible blast radius (until fixed):** Every INSERT or UPDATE on prod for RFIs, daily logs, documents, change orders, submittals, and punch items tripped PGSQL 42703 inside the iris-ingest trigger and aborted. Pre-July-1 beta launch with this state would mean Day 0 outage.

**Why this only surfaced now:** Prod had near-zero user-driven writes on these surfaces because the platform is pre-launch. Walker's demo was the first real-flow exercise — and broke immediately.

**Fix path taken:** Walker's local `supabase db push --linked` against prod refused due to 39 untracked remote migrations (drift between local and remote schema_migrations). Walker authorized agent to apply via MCP `execute_sql` instead. Applied both migrations in one DDL transaction. Shadow rows inserted in `supabase_migrations.schema_migrations` for both versions (`20261020000000`, `20261022000000`) per Standing Decisions §4.

**Post-fix prod state (verified via read-only MCP):**

| Trigger function on prod | Now references |
|---|---|
| `change_orders_iris_ingest_trigger` | `organization_id` ✓ |
| `daily_logs_iris_ingest_trigger` | `NEW.summary` + `organization_id` ✓ |
| `documents_iris_ingest_trigger` | `organization_id` ✓ |
| `rfis_iris_ingest_trigger` | `organization_id` ✓ |

Submittal-create on prod will succeed now. The cascading `fn_mark_search_dirty` trigger that also fired on submittal writes was already SECURITY DEFINER-correct on prod — no change needed there.

---

## Phase A.1–A.16 — Master matrix (COMPLETE)

All 15 sub-inventories generated and saved under `ops/coverage/`. Totals:

| Artifact | Count |
|---|---:|
| `routes.json` | 104 routes (54 protected, 8 public, 42 dynamic) |
| `elements.json` | 610 tracked elements; 1,302 page-level Button/onClick markers |
| `actions.json` | 13 stores, 157 actions |
| `edge-functions.json` | 140 dirs (139 with handler files) |
| `rpcs.json` | 294 `public.*` RPCs on staging |
| `table-surface.json` | 348 tables + 13 views |
| `permission-matrix.json` | 960 cells (15 roles × 64 actions across 10 entities) |
| `workflows.json` | 18 workflows, 129 total steps |
| `cron-jobs.json` | 8 jobs |
| `webhooks.json` | 4 inbound + 4 outbound caller files |
| `integrations.json` | 9 external services tracked |
| `storage.json` | 15 buckets |
| `realtime.json` | 59 channel sites |
| `migrations.json` | 310 migration files |
| `mobile.json` | 7 Capacitor plugin sites + 3 viewport targets |
| `extensions.json` | 11 extensions |

`ops/coverage/MASTER_MATRIX.md` cross-multiplies these into **~31,894 total test cells** with explicit coverage-status breakdown (~800 covered, ~30,944 uncovered, 150 out-of-scope documented).

**Walker approval gate for Phase A.16 was overridden** by his "ok go don't stop until everything is finished" directive — proceeding directly to Phase B authoring.

---

## Phase B — kickoff (in progress)

Starting with the highest-value sub-suite per the matrix priority order:

**B.2 — Workflow specs (multi-step, multi-persona).** First spec authored: `e2e/workflows/submittal-create.spec.ts` — the direct regression catch for today's demo bug.

Subsequent priority:
1. `e2e/workflows/rfi-create.spec.ts` — same trigger class
2. `e2e/workflows/daily-log-create.spec.ts` — same trigger class
3. `tests/rls/` per most-touched tables
4. B.1 per-route specs for the top 10 page components

Each session opens an incremental PR; Phase B is the multi-day chunk.

---

## Phase E surfaced addition

The matrix exposed a critical gap in current CI: **Gate 21 — migrations-on-prod parity check.** Would have caught the demo bug pre-deploy. To be wired alongside the originally-planned 14 gates in Phase E.

---

## Session 1 state

- ✅ Phase A.0 triage: complete + prod fix applied + shadow rows inserted
- ✅ Phase A.1–A.16: complete; all 15 JSON artifacts + MASTER_MATRIX.md under `ops/coverage/`
- ⏳ Phase B: B.2 submittal-create spec being authored next

**File to read first in Session 2:** this receipt → `ops/coverage/MASTER_MATRIX.md` → latest in-flight Phase B spec.
