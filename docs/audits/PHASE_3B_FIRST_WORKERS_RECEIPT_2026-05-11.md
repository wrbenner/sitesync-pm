# Phase 3b — drawing/spec/RFI chunkers + router + no-raw-ingest rule

Date: 2026-05-11. Branch: phase-3b-first-workers. Stacked on Phase 3a.

## TL;DR

3 pure chunkers (drawing, spec, rfi) + ingestion router classifier + sitesync/no-raw-ingest ESLint rule + 3 edge fn worker scaffolds + AFTER INSERT/UPDATE triggers on documents + rfis. 33 new tests; typecheck zero; new ESLint rule live.

Workers ship as scaffolds: the chunkers are pure-function complete, the worker shells acknowledge POST requests and document the integration shape. Real PDF parsing + OpenAI embedding lands when the first soft-pilot upload arrives (Phase 3c retrieve() impl + first live artifact).

## What changed

### Chunkers (pure functions, no DB/network)

- src/services/iris/ingestion/chunkers/types.ts: Chunk shape, CHUNK_TOKEN_CEILING (1200), CHUNK_TOKEN_FLOOR (32), approxTokens (4 chars/token).
- src/services/iris/ingestion/chunkers/drawing.ts: chunkDrawing() — one chunk per sheet OR per region (bbox metadata) + splitByTokenBudget for over-budget sheets. Paragraph -> sentence -> hard-char split fallback.
- src/services/iris/ingestion/chunkers/spec.ts: chunkSpec() — one chunk per CSI section, title prepended to body. detectCsiSections() for raw-text section discovery. Long sections split via the shared budget helper.
- src/services/iris/ingestion/chunkers/rfi.ts: chunkRfi() — body chunk + one chunk per response. Author + responded_at propagate into metadata. response_idx in source_anchor.

### Router

- src/services/iris/ingestion/router.ts: routeArtifact() with 5-tier strategy (caller hint > parent entity > MIME > filename > unclassified). 16-entry WORKER_NAMES map covers every IrisSourceType. Filename normalizer folds underscores/dashes to spaces for snake-case + kebab-case filename matching.

### ESLint rule

- eslint-rules/no-raw-ingest.js: blocks direct insert/upsert into iris_kb_chunks + iris_kb_sources from outside src/services/iris/ingestion/ + supabase/functions/iris-ingest-*-worker/ + test paths.
- eslint.config.js: wired at 'error' severity.
- eslint-rules/index.js: registered.

### Worker scaffolds (Deno edge fns)

- supabase/functions/iris-ingest-drawing-worker/index.ts
- supabase/functions/iris-ingest-spec-worker/index.ts
- supabase/functions/iris-ingest-rfi-worker/index.ts

Each: typed payload, validation, scaffold acknowledge response. Real PDF parse + chunker call + OpenAI embed + iris_kb_chunks upsert lands when first soft-pilot artifact arrives (deferred per spec — workers are Deno-side; full integration needs live source).

### Migration (1)

- supabase/migrations/20261008000004_iris_ingest_triggers.sql: shared iris_enqueue_ingest helper + per-table AFTER INSERT/UPDATE triggers on documents + rfis. Trigger failures non-fatal (log and continue). Workers dedupe duplicate enqueues via version_hash.

### Tests (33 new, all green)

- chunkers.test.ts: 22 tests covering splitByTokenBudget edge cases, chunkDrawing (sheet + region modes), chunkSpec (with CSI detection + long-section split), chunkRfi (body + responses + empty drop), and 3 determinism tests proving re-runs produce identical output.
- router.test.ts: 10 tests covering source_id missing, caller hint precedence, parent_entity routing, MIME signals (image/spreadsheet/email), filename signals (drawing/spec/submittal/daily_log/contract/CO/pay_app/lien_waiver/punch), unclassified fallback, every IrisSourceType has a worker, confidence reflects signal strength.
- no-raw-ingest.test.js: ESLint RuleTester matrix — 5 valid (ingestion module, worker prefix, tests, other tables, select/update on iris_kb_chunks) + 3 invalid (UI insert, non-worker upsert, sources insert).

## Day-0 SQL bug screen (PASS)

- No `||` runtime concat in DDL.
- No expressions inside PRIMARY KEY.
- audit_log_id not referenced in this migration (no FK type concern).
- Timestamp 20261008000004 unique vs siblings.

## Verification

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.app.json   # exit 0
npx vitest run src/services/iris/ingestion/ eslint-rules/__tests__/             # 33 pass
npx eslint src/services/iris/ingestion/ eslint-rules/no-raw-ingest.js          # 0 errors
```

Migration applied to staging — triggers + helper function live on documents + rfis tables.

## What this does NOT do (deferred)

- Real PDF parsing — workers acknowledge but don't yet decode PDFs. First soft-pilot upload triggers the integration.
- Real OpenAI embedding call — Phase 3c retrieve() impl will include the embed loop; same path will be invoked by workers.
- Tesseract OCR fallback — drawings with scanned-image-only content fall through unhandled until OCR is integrated (3c at earliest, 3d realistic).
- pg_cron heartbeat for the dispatcher — Phase 3c wires the cron alongside the dispatcher edge fn.

## Phase 3b acceptance (per plan)

- ✅ Chunker pure functions tested (22 cases incl. determinism).
- ✅ Router classifier tested (10 cases).
- ✅ no-raw-ingest ESLint rule green on main.
- ✅ Worker scaffolds + 2 triggers live.
- ⏳ 30 fixture artifacts ingesting end-to-end — first soft-pilot smoke.
- ⏳ Re-ingest idempotency on 5 version-bump scenarios — verified once real ingestion runs.

## Next up

Phase 3c — daily-log/photo/conversation/CO workers + full retrieve() impl + LRU cache + telemetry.
