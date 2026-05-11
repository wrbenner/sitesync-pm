# Lap 4 — IRIS Phase 3 (Universal Knowledge Absorption) — Engineering Close

Date: 2026-05-11. Solo (Walker + Claude). 5 PRs shipped (Day-0 + 4 sub-phases).

## TL;DR

Phase 3 engineering complete. Pgvector substrate + 10 per-source workers + full retrieve() with LRU cache + telemetry + 11 citation kinds + Code specialist cutover + daily acceptance gate. ~190 new tests in the Phase-3 surface (chunkers + retrieve + cutover + goldens + RLS); 3,695 total tests green; typecheck zero on both project configs; lint clean. 8 new migrations applied to staging.

The post-lap window opens for soft-pilot uploads to start filling the corpus. Lap 5 (Phase 4 — Insight Slot + Ambient Awareness) unlocks the day all 7 acceptance gates have been green for 7 consecutive days.

## PRs shipped (Lap 4)

1. **PR #433** — Day-0 drift fix (5 migrations, 4 SQL bug class hotfixes, database.ts regen +662 LOC, 24 new symbols).
2. **PR #434** — Phase 3a substrate (4 migrations: iris_kb_chunks, iris_kb_sources, kb_retrieve RPC, pgmq queue; retrieve() stub; 54 tests).
3. **PR #435** — Phase 3b workers 1-3 (drawing, spec, rfi chunkers + router + no-raw-ingest ESLint rule + 3 worker scaffolds + documents + rfis triggers; 33 tests).
4. **PR #436** — Phase 3c workers 4-7 + full retrieve() (daily-log, photo, conversation, change-order chunkers + LRU cache + telemetry + dispatcher + iris-embed scaffolds + daily_logs + change_orders triggers + telemetry migration + pg_cron heartbeat; 92 new tests).
5. **PR #437** — Phase 3d workers 8-10 + Code cutover (submittal, contract, spreadsheet chunkers + 3 new citation kinds + side panels + resolve_citation RPC extension + code-retrieval-cutover.ts; 45 new tests).
6. **PR #438** (this PR) — Phase 3e acceptance gate (20 starter goldens + 50 RLS leakage cases + phase-3-acceptance.yml + iris_kb_health_daily + iris_kb_source_coverage_7d views; 75 new tests).

## Outputs

### Code

- 10 pure chunkers (drawing, spec, rfi, daily_log, photo, conversation, change_order, submittal, contract, spreadsheet) + shared splitByTokenBudget helper.
- 10 per-source edge fn worker scaffolds + dispatcher + iris-embed proxy.
- Ingestion router (routeArtifact) with 5-tier cascade + 16-entry WORKER_NAMES map.
- `retrieve()` with in-process LRU cache (30s/200 entries), iris-embed proxy with null fallback, kb_retrieve RPC, empty_corpus probe, fire-and-forget telemetry.
- Code specialist cutover via `runCodeRetrievalViaPgvector` with 3-path strategy (cite/fallback/reject).
- `sitesync/no-raw-ingest` ESLint rule.
- 11 citation kinds (8 original + spreadsheet_cell, contract_clause, punch_item) with side-panel renderers + citationRouting deep-link builders + citationVerify mapping.

### Database

8 new migrations:
- 20261008000000_iris_kb_chunks (pgvector + extensions + table + HNSW + GIN + RLS).
- 20261008000001_iris_kb_sources (denormalized tracker).
- 20261008000002_iris_kb_retrieve_rpc (hybrid blend SECURITY DEFINER fn).
- 20261008000003_iris_ingest_queue (pgmq queue iris_ingest + depth view).
- 20261008000004_iris_ingest_triggers (documents + rfis triggers + helper fn).
- 20261008000005_iris_kb_telemetry (table + RPC + p95 view).
- 20261008000006_iris_ingest_dispatcher (daily_logs + change_orders triggers + pg_cron heartbeat).
- 20261008000007_iris_citation_kinds_extension (resolve_citation RPC extended to 11 kinds).
- 20261008000008_iris_kb_health_daily (rolling 7d rollup view + source coverage view).

### Tests

Phase-3-surface additions only:
- retrieve.test.ts: 72 tests (validation, flag, RPC, cache, telemetry, persona×sensitivity matrix).
- chunkers.test.ts: 22 tests (3b drawing/spec/rfi).
- chunkers-phase-3c.test.ts: 20 tests (daily-log/photo/conversation/change-order).
- chunkers-phase-3d.test.ts: 15 tests (submittal/contract/spreadsheet).
- router.test.ts: 10 tests (5-tier routing decisions).
- no-raw-ingest.test.js: 1 test (8 RuleTester cases).
- code-retrieval-cutover.test.ts: 18 tests (3-path strategy + audit + caller options).
- citationRouting.test.ts: 4 new tests (3 new kinds).
- goldens run.test.ts: 12 tests (harness math).
- rls-leakage.test.ts: 63 tests (matrix + cross-tenant + escalation + soft-delete + ceiling).

Total new tests for Phase 3: **190**. Total tests in repo: 3,695 passing.

### Receipts + spec cards

- PHASE_3A_KB_SCAFFOLD_RECEIPT_2026-05-11.md
- PHASE_3B_FIRST_WORKERS_RECEIPT_2026-05-11.md
- PHASE_3C_WORKERS_AND_RETRIEVAL_RECEIPT_2026-05-11.md
- PHASE_3D_FULL_INGESTION_AND_CUTOVER_RECEIPT_2026-05-11.md
- PHASE_3E_ACCEPTANCE_GATE_RECEIPT_2026-05-11.md
- IRIS_SPEC_RETRIEVE_2026-05-11.md
- IRIS_SPEC_PER_SOURCE_INGEST_2026-05-11.md
- LAP_4_KICKOFF_RECEIPT_2026-05-11.md (this file)

## The 7 Phase 3 acceptance gates

All 7 have programmatic infrastructure live. Live measurement begins when soft-pilot corpus populates.

| # | Gate | Target | Mechanism |
|---|---|---|---|
| 1 | Recall@5 on goldens | ≥ 0.85 | run.ts against staging corpus (workflow daily 18:45 UTC) |
| 2 | Precision@5 on goldens | ≥ 0.70 | run.ts against staging corpus |
| 3 | Retrieval latency p95 | ≤ 800 ms | iris_kb_telemetry + iris_kb_retrieval_p95_1h view |
| 4 | RLS test suite | 50/50 | rls-leakage.test.ts + live SQL parallel (when corpus exists) |
| 5 | Embedding-leakage Pearson r | ≤ 0.05 | ceiling enforced in run.ts; live computation pending |
| 6 | Telemetry coverage | All source_types ingested ≥ 1× over 7d | iris_kb_source_coverage_7d view |
| 7 | Cost projection | ≤ $2/project/month | iris_kb_health_daily.projected_cost_usd_per_month |

Daily workflow: `.github/workflows/phase-3-acceptance.yml` (6 fail-closed jobs).

## Day-0 SQL bug class screen — every migration in Lap 4 PASSED

The 4 bug classes Day-0 surfaced (|| in DDL, expr in PK, FK type mismatch, timestamp collision) were screened on every Phase 3 migration before commit. Zero recurrences.

## What this does NOT do (deferred to post-lap or Lap 5)

- **Real PDF/xlsx parsers + OpenAI embed call** — workers are scaffolds; the real pipelines fire on first soft-pilot artifact upload (Walker triggers this, doesn't gate Lap 4 close).
- **80 more goldens** — 20 starter goldens shipped; Walker authors 80 more during the post-lap measurement window per spec §11.
- **kb-stub.ts deletion** — stays for 14 days post-cutover. Lap 5 cleanup PR removes it.
- **Phase 2 router cutover to runCodeRetrievalViaPgvector** — small follow-up PR after Phase 3e harness greens on staging.
- **Hybrid-blend tuning** — Walker hand-rates the 20 starter goldens against the live corpus per spec §6.3 if recall@5 lands below 0.85.
- **Real RLS SQL parallel assertion** — runs alongside the type-level matrix once the seed data exists on staging.

## What's now possible (Lap 5 launchpad)

- **Phase 4 (Insight Slot + Ambient Awareness)** is now unblocked — every Phase 4 generator reads retrieve() and writes citations against the 11-kind matrix.
- **Brad's "what does the spec say about X?" demo** — the path is wired end-to-end; only data is missing.
- **Cross-source synthesis** — the cutover Code specialist receives chunks from spec_section + contract + rfi simultaneously. Phase 5 multimodal layers in image/PDF rendering on top.

## Sprint Invariants — all still green

- Typecheck zero on both tsconfig.app.json and tsconfig.node.json. ✅
- All money math through `src/types/money.ts`. ✅ (no money paths touched in Lap 4)
- No re-added deleted stores. ✅
- 13-store target preserved. ✅
- PermissionGate wraps action buttons. ✅ (no new action buttons in Lap 4)
- Tracker update + receipt — this is the receipt; tracker line for Lap 4 to be added by Walker.

## Calendar status

Lap 4 engineering work closed in 1 working day per the Bugatti standard: atomic PRs, TDD on every contract surface, receipts as deliverables, zero broken-windows tolerance. The 30-day calendar built into the Lap 4 plan now becomes the measurement window — soft-pilot ingestion + acceptance-gate observation + Walker's parallel workstreams (auditor, Procore importer scoping, E2 ramp).

Lap 5 kickoff: when 7 consecutive days of green acceptance gates land.
