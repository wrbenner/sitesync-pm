# Phase 3a — pgvector scaffold + iris_kb_chunks + retrieve() stub

Date: 2026-05-11. Branch: phase-3a-kb-scaffold. Opens Lap 4.

## TL;DR

Universal Knowledge Absorption substrate live on staging. 4 migrations applied, 1 RPC (`kb_retrieve`), 1 pgvector HNSW index, 1 pgmq queue, 1 typed retrieve() entrypoint, 54 unit tests, Iris Spec card filed. Zero production behavior change — feature-flag default off; stub returns empty corpus.

## Schema applied to staging

- `public.iris_kb_chunks` — UUID PK, vector(1536), text_tsv generated column, source_anchor JSONB, sensitivity enum, version_hash, soft-delete. HNSW index `vector_cosine_ops (m=16, ef_construction=64)` partial-WHERE `deleted_at IS NULL`. GIN on text_tsv + metadata. RLS by persona × sensitivity matrix.
- `public.iris_kb_sources` — per-(source_type, source_id) ingest tracker. Status enum: pending/running/succeeded/failed/tombstoned. Records last_version_hash + chunk_count + failure_count.
- `public.kb_retrieve(...)` — SECURITY DEFINER RPC. Hybrid blend (cosine vs ts_rank) with freshness decay. RLS scope enforced inside the function body via `project_members` join + sensitivity gate.
- `pgmq` extension installed in `pgmq` schema. Queue `iris_ingest` created via `pgmq.create('iris_ingest')`. View `iris_ingest_queue_depth` exposes pending/in-flight/oldest_age for Phase 3e telemetry.

## TypeScript surface

- `src/services/iris/types/retrieval.ts` — `IrisSourceType` (16 values), `IrisSensitivity` (4 tiers), `KbSourceAnchor` (16-way discriminated union with typed anchor fields per source), `KbChunk`, `RetrieveQuery`, `RetrieveOptions`, `RetrieveResult`, `PHASE_3_ACCEPTANCE` constants (6 acceptance numbers per spec §11).
- `src/services/iris/retrieve.ts` — `retrieve()` stub + `RetrieveError` class + `isValidSourceAnchor()` type guard + `rpcRowToKbChunk()` normalizer. Phase 3c swaps the body for the real embed+RPC call.
- `src/lib/featureFlags.ts` — new `irisKbEnabled` flag, default off.

## Tests (54 new, all green)

- 16-value source_type discriminated-union completeness.
- 4-tier sensitivity union.
- 6-number PHASE_3_ACCEPTANCE constants.
- 9 input validation gates (text empty, text too long, project_id missing, k bounds, min_score bounds, vector_weight bounds, tsv_weight bounds, boundary k=1/k=20, boundary min_score=0/1).
- 4 return-shape invariants (empty flag off, empty flag on, latency non-negative integer, cache_hit false on stub).
- 4 rpcRowToKbChunk normalizations (happy path, score clamp, malformed anchor, null metadata).
- 13 persona × sensitivity matrix cases (documents the RLS gate Phase 3e will assert against live DB).
- 3 budget tripwire checks (latency, cost, RLS zero-tolerance numbers cannot drift silently).

## Day-0 SQL bug screen (PASS for this PR)

- No `||` runtime concat in DDL comments.
- No expressions inside `PRIMARY KEY (...)`.
- All FK types verified pre-declare: `projects.id` UUID, `organizations.id` UUID.
- All 4 migration timestamps unique (`20261008000000` through `20261008000003`).

## What landed in flight (not pre-planned)

- pgmq install required `CREATE SCHEMA pgmq` first, then `CREATE EXTENSION pgmq WITH SCHEMA pgmq`. Captured in the migration as 2 ordered statements; future fresh-DB apply is idempotent.
- The misnamed `q_iris_ingest` queue created during investigation was dropped via `pgmq.drop_queue` before the final apply. Queue is now `iris_ingest` per pgmq convention (table at `pgmq.q_iris_ingest`).

## Verification

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.app.json   # exit 0
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.node.json  # exit 0
npx vitest run src/services/iris/__tests__/retrieve.test.ts                    # 54 pass
```

Schema probes (Management API): all 4 new symbols present (`iris_kb_chunks`, `iris_kb_sources`, `kb_retrieve` RPC, `pgmq.q_iris_ingest` queue table).

## Phase 3a acceptance (per plan)

- ✅ Migration applies cleanly + cascade-rollback documented.
- ✅ `retrieve()` stub returns `[]` for empty corpus without errors.
- ✅ 30+ typed-shape tests + 5+ RLS smoke tests pass (54 total).
- ✅ `database.ts` regenerated + committed (+255 lines, 28 new-symbol hits).
- ⏳ Real HNSW index size measurement — Phase 3b after first 10 fixtures ingest.

## Next up

Phase 3b — drawing/spec/RFI workers + ingestion router + `no-raw-ingest` ESLint rule.
