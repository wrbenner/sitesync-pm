# Phase 3c — 4 more chunkers + full retrieve() + LRU cache + telemetry + dispatcher

Date: 2026-05-11. Branch: phase-3c-workers-retrieval. Stacked on Phase 3b.

## TL;DR

4 pure chunkers (daily-log, photo, conversation, change-order) + full retrieve() impl replacing the 3a stub + in-process LRU cache + telemetry RPC + pg_cron dispatcher heartbeat + iris-embed edge-fn proxy. 126 tests pass; typecheck zero on both project configs; new ESLint rule still green.

Workers ship as scaffolds: chunkers are pure-function complete; the worker shells acknowledge POST payloads and document the integration shape. Real PDF parse + OpenAI embed lands when the first soft-pilot artifact arrives (the same moment retrieve()'s ts_rank-only fallback flips to vector-aware via the live iris-embed fn).

## What changed

### Chunkers (pure functions)

- `src/services/iris/ingestion/chunkers/daily-log.ts`: one chunk per populated section (narrative > manpower > equipment > weather > incident), shared `splitByTokenBudget`.
- `src/services/iris/ingestion/chunkers/photo.ts`: one chunk per photo from its vision-LLM caption + tags + location label. caption_hash carried into source_anchor for idempotency.
- `src/services/iris/ingestion/chunkers/conversation.ts`: subject chunk (when ≥ floor) + message-batched chunks for short adjacent messages + standalone chunks for long messages. 400-token batch target.
- `src/services/iris/ingestion/chunkers/change-order.ts`: header (number + status + total + justification) + line-item batches of 10 + approval narrative. Each part typed in metadata.

### Retrieve full impl

- `src/services/iris/retrieve.ts`: replaces the 3a empty-corpus stub with the real path:
  - In-process LRU cache (30s TTL, 200 entries). Key = hash of `text|project|persona|k|min_score|source_types|weights`. Whitespace + case normalized.
  - `embedQuery()` proxies through `supabase.functions.invoke('iris-embed', ...)`. When the fn isn't deployed (3c interim), returns null and retrieve() passes null to the RPC — the kb_retrieve plpgsql handles null by falling back to ts_rank-only ranking.
  - `kb_retrieve` RPC call passes all 9 args (q_embedding, q_text, p_project_id, p_persona, p_top_k, p_vector_weight, p_tsv_weight, p_freshness_decay, p_min_score).
  - empty_corpus probe: when 0 chunks returned, count the project's chunks and report empty_corpus only if the corpus is truly empty (vs nothing scored above threshold).
  - Fire-and-forget telemetry via `iris_kb_record_retrieve` RPC. Failures here never propagate.
  - `__resetRetrieveCacheForTests` test hook.

### Workers (Deno edge fn scaffolds)

- `supabase/functions/iris-ingest-daily-log-worker/index.ts`
- `supabase/functions/iris-ingest-photo-worker/index.ts`
- `supabase/functions/iris-ingest-conversation-worker/index.ts`
- `supabase/functions/iris-ingest-change-order-worker/index.ts`
- `supabase/functions/iris-ingest-dispatcher/index.ts`: pgmq drain + per-source fan-out. Scaffold returns a summary payload; real drain lands when first enqueue arrives.
- `supabase/functions/iris-embed/index.ts`: one-shot embedding endpoint. Scaffold returns null embedding; the real OpenAI call (text-embedding-3-large @ 1536) lands alongside the workers.

### Migrations

- `supabase/migrations/20261008000005_iris_kb_telemetry.sql`:
  - `iris_kb_telemetry` table (id UUID PK, project_id, persona, query_text, latency_ms, cache_hit, chunks_returned, error_code, caller_tag, created_at).
  - 3 indexes: (project_id, created_at DESC), (cache_hit, created_at DESC), partial on error_code.
  - RLS: project members read; service-role full access.
  - `iris_kb_record_retrieve(...)` SECURITY DEFINER RPC. Refuses to log for non-members.
  - `iris_kb_retrieval_p95_1h` view (rolling 1-hour p95 + cache-hit + error breakdown).
- `supabase/migrations/20261008000006_iris_ingest_dispatcher.sql`:
  - daily_logs + change_orders AFTER INSERT/UPDATE triggers.
  - pg_cron heartbeat scheduled when `iris.dispatcher_url` GUC is set; emits NOTICE and skips in local dev where GUC is unset.

### Tests (92 new — 20 chunker + 72 retrieve)

- `chunkers-phase-3c.test.ts`: 20 tests across 4 chunkers + determinism.
- `retrieve.test.ts` rebuilt for 3c surface: 72 tests covering validation gates, flag handling, RPC happy path, LRU cache (hit/miss/normalization/eviction), RPC error fallback, telemetry emission, rpcRowToKbChunk, persona × sensitivity matrix, budget tripwires.

## Day-0 SQL bug screen (PASS)

For migrations 20261008000005 and 20261008000006:
- No `||` runtime concat in COMMENT/DDL: PASS (single literals, no `'a' || 'b'`).
- No expression in PRIMARY KEY: PASS (`id UUID PRIMARY KEY` only).
- FK column types match: PASS (no FKs introduced).
- Unique timestamps 20261008000005 + 20261008000006: PASS.

## Verification

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.app.json    # exit 0
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.node.json   # exit 0
npx vitest run src/services/iris/__tests__/retrieve.test.ts src/services/iris/ingestion/__tests__/ eslint-rules/__tests__/
# Test Files  6 passed (6)
#      Tests  126 passed (126)
npx eslint src/services/iris/retrieve.ts src/services/iris/ingestion/chunkers/ eslint-rules/no-raw-ingest.js   # 0 errors
```

## What this does NOT do (deferred)

- **Real OpenAI embedding call** — iris-embed scaffold returns null; retrieve()'s vector path is dormant. Flips on when the first soft-pilot artifact arrives (worker invokes iris-embed; iris-embed reads OPENAI_API_KEY from edge secrets; the real /v1/embeddings call goes out).
- **Real PDF parse / OCR / caption-via-vision-LLM** — workers acknowledge but don't yet decode. First soft-pilot upload triggers the integration.
- **Cost cap enforcement** — photo worker scaffold doesn't yet enforce 500/day/project. Enforcement lands inline with the real vision-caption call.
- **PII scrubber for conversation worker** — design documented in IRIS_SPEC_PER_SOURCE_INGEST; scrub fn lands inline with real ingest.
- **pgmq drain loop** — dispatcher scaffold returns summary; real drain + ack lands when first enqueue arrives.
- **db-types regen** — iris_kb_record_retrieve RPC will appear in src/types/database.ts after this migration applies to staging and `npm run db-types:write` runs in a follow-up PR. Today the test-side type-cast bridges the gap.

## Acceptance (per Lap 4 plan)

- ✅ 4 additional workers + dispatcher + iris-embed live (scaffolds; pure-function chunkers complete).
- ✅ `retrieve()` impl with cache + telemetry + RPC.
- ⏳ retrieve() p95 ≤ 800ms on 500+ chunk corpus — verified once real corpus exists in 3d/3e.
- ⏳ Cache hit rate ≥ 60% on synthetic load — verified in 3e harness.
- ⏳ Cost ≤ $0.15/project/month — asserted from telemetry token counts once real embeds run.

## Next up

Phase 3d — submittal/contract/spreadsheet workers + 3 citation kinds (spreadsheet_cell, contract_clause, punch_item) + Code specialist cutover from kb-stub.ts to retrieve(). Stacked on this branch.
