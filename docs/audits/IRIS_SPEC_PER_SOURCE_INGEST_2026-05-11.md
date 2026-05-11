# Iris Spec — Per-Source Ingest

Tier: 1 (foundation surface; every specialist depends on the corpus it produces)
Status: Phase 3b scaffold (drawing/spec/rfi); chunkers complete, workers are scaffolds
Spec source: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
Ratifies: ADR-017 (text-embedding-3-large @ 1536), ADR-020 (Context Fabric retrieval entrypoint), ADR-021 (within-tenant only Phase 3)

## What this is

Every source artifact (drawing, spec section, RFI, daily log, photo, conversation, contract, change order, submittal, spreadsheet, bulletin/ASI, pay app, lien waiver, punch item) flows through one canonical pipeline:

```
source row inserted/updated
    -> per-table AFTER INSERT/UPDATE trigger
    -> public.iris_enqueue_ingest(source_type, source_id, project_id, org_id, version_hash)
    -> pgmq.send('iris_ingest', payload)
    -> pg_cron dispatcher heartbeat (lands in Phase 3c)
    -> per-source-type worker (1 of 10 edge fns)
    -> chunker (pure fn: text -> Chunk[])
    -> OpenAI embed (3-large @ 1536)
    -> iris_kb_chunks upsert (RLS-guarded by project + persona × sensitivity)
    -> iris_kb_sources tracker row updated (last_version_hash, chunk_count, status)
```

The contract is: **anything that reaches iris_kb_chunks went through routeArtifact + a chunker + an embed call. No raw inserts.** Enforced by the `sitesync/no-raw-ingest` ESLint rule.

## Why ten workers, not one

A single mega-worker was tempting. We rejected it because:

1. **Chunking strategy differs catastrophically per source.** A drawing chunks per sheet/region; a spec chunks per CSI section; an RFI chunks per response. Mixing them yields uniformly bad chunks.
2. **Source_anchor shape is per-source.** The discriminated union in `KbSourceAnchor` has 16 arms; the worker proves which arm at write time.
3. **Cost caps are per-source.** Photos cap at 500/project/day; spreadsheets cap on cell count; conversations on thread depth. Mixing caps in one worker yields tangled budgets.
4. **Retries are per-source.** OCR failure on a drawing retries with a different OCR engine; PDF parse failure on a contract retries by clause; OpenAI quota failure on a photo enters cooldown. One worker can't reason about these uniformly.

10 workers, each ~200 LOC, beats one 2,000-LOC worker on every axis (test surface, blast radius, retry semantics).

## The chunker contract

Pure functions: `text + metadata -> Chunk[]`. No DB. No network. Deterministic.

```ts
interface Chunk {
  ordinal: number         // 0-indexed, dense within a single source
  text: string            // 32..4800 chars (CHUNK_TOKEN_FLOOR..CEILING × ~4 chars/token)
  source_anchor: KbSourceAnchor  // 16-arm discriminated union
  metadata: Record<string, unknown>
  estimated_token_count: number  // approxTokens(text)
}
```

The shared `splitByTokenBudget()` helper handles over-budget chunks: paragraph -> sentence -> hard char-boundary split. Same algorithm reused by drawing/spec/RFI chunkers.

## Source-anchor shapes

The `source_anchor` jsonb column makes citations clickable. Each kind carries the minimum info needed to render a side panel and re-resolve to the source artifact.

| Source type | source_anchor fields |
|---|---|
| `drawing` | `{ source_type: 'drawing', source_id, sheet_id?, page_no?, region_id?, bbox? }` |
| `spec_section` | `{ source_type: 'spec_section', source_id, csi_section, subsection? }` |
| `rfi` | `{ source_type: 'rfi', source_id, response_idx? }` |
| `daily_log` | `{ source_type: 'daily_log', source_id, section: 'manpower'|'equipment'|'weather'|'narrative' }` |
| `photo` | `{ source_type: 'photo', source_id, caption_hash }` |
| `conversation` | `{ source_type: 'conversation', source_id, message_idx, thread_id? }` |
| `contract` | `{ source_type: 'contract', source_id, clause_number, article? }` |
| `change_order` | `{ source_type: 'change_order', source_id, line_item_idx? }` |
| `submittal` | `{ source_type: 'submittal', source_id, sub_item_idx?, satisfies_spec? }` |
| `spreadsheet` | `{ source_type: 'spreadsheet', source_id, sheet_name, range_a1 }` |
| `bulletin`/`asi` | `{ source_type: 'bulletin'|'asi', source_id, section_idx? }` |
| `pay_app` | `{ source_type: 'pay_app', source_id, line_idx? }` |
| `lien_waiver` | `{ source_type: 'lien_waiver', source_id }` |
| `punch_item` | `{ source_type: 'punch_item', source_id, item_idx? }` |
| `unclassified` | `{ source_type: 'unclassified', source_id }` |

Phase 3d wires three new citation kinds (`spreadsheet_cell`, `contract_clause`, `punch_item`) to side panels that read these anchors and resolve to the source artifact.

## Re-ingest idempotency (version_hash)

When a source row changes, the trigger fires again. The worker computes the same `version_hash` it would have computed on first ingest. If the tracker row (`iris_kb_sources`) already has that hash:

- **No-op.** Skip the chunker + embed. Saves OpenAI tokens.

If the hash differs:

- **Tombstone old.** `UPDATE iris_kb_chunks SET deleted_at = NOW() WHERE source_id = ? AND deleted_at IS NULL`. RLS-aware partial HNSW index drops these from retrieval.
- **Insert new.** Fresh chunks land with new ordinals.
- **Update tracker.** `last_version_hash`, `chunk_count`, `last_ingested_at`.

The hash is computed from the **source content** (body text, status, response array), not from `updated_at`. That way a no-op write (e.g. someone re-saves a record without changing anything) doesn't churn the corpus.

For documents: `version_hash = COALESCE(checksum, id || updated_at)`. For RFIs: `md5(title || description || status || updated_at)`. Each worker documents its hash recipe in its index.ts header.

## Routing decision tree

`routeArtifact()` is the single classifier. It runs both:
- Database-side as a coarse-grained hint inside the trigger (mime/checksum patterns only).
- Worker-side as the source of truth (full filename + parent_entity + caller hint logic).

Cascading priority:

1. **Caller hint** — if the upload form knows the destination (e.g. "this PDF is a submittal"), trust it (confidence 0.95).
2. **Parent entity** — if the upload happened in an RFI thread, route to rfi (confidence 0.85).
3. **MIME** — image/* -> photo; spreadsheetml -> spreadsheet; message/rfc822 -> conversation (confidence 0.80).
4. **Filename keywords** — CSI numeric pattern (`\b\d{2}\s\d{2}\s\d{2}\b`) -> spec; "drawing"/"sheet"/"elevation" -> drawing; etc. (confidence 0.5-0.85).
5. **Unclassified** — fallback to catch-all worker (confidence 0).

Filename normalizer folds `_` and `-` to spaces so word-boundary regexes match snake_case + kebab-case. Order matters: spec patterns run before drawing patterns because "section 03 30 00" is a CSI signal that would otherwise match "section" in drawing keywords.

## RLS gate (re-stated for ingestion)

The worker writes `iris_kb_chunks` with explicit `project_id`, `org_id`, and `sensitivity`. RLS policies (Phase 3a migration) enforce:

- **Project isolation** — chunks are visible only inside their `project_id`.
- **Persona × sensitivity matrix** — `public_to_project` visible to all project members; `gc_only` blocked from owner-side personas; `owner_only` blocked from GC-side personas; `finance_only` requires the finance role on the requesting persona.
- **Soft-delete invisible** — partial HNSW index excludes `deleted_at IS NOT NULL`.

50 RLS leakage cases in Phase 3e prove the matrix. Two-engineer review on every `retrieve()`/`kb_retrieve()`/RLS-policy change — solo means Walker is engineer #2.

## What ships per phase

| Phase | Workers | Citation kinds | Migrations |
|---|---|---|---|
| 3a | (none — substrate only) | (none — existing 8 only) | iris_kb_chunks, iris_kb_sources, kb_retrieve RPC, pgmq queue |
| 3b | drawing, spec, rfi (3) | (none new) | iris_ingest_triggers (documents + rfis) |
| 3c | daily_log, photo, conversation, change_order (4) | (none new — extends retrieve()) | iris_kb_telemetry events |
| 3d | submittal, contract, spreadsheet (3) | spreadsheet_cell, contract_clause, punch_item | citation_kinds_extension |
| 3e | (none — acceptance only) | (none) | iris_kb_health_daily matview |

Total at Lap 4 close: 10 workers, 11 citation kinds, 6 migrations, 1 RPC, 1 ESLint rule, 1 telemetry matview.

## Decisions ratified by this card

- **D1.** One chunker per source type. Not one chunker that branches on type.
- **D2.** Source_anchor is the citation contract — every chunk carries one.
- **D3.** version_hash recipes are documented per worker. Workers dedupe their own re-ingests.
- **D4.** Trigger failures are non-fatal. Dispatcher reconcile (Phase 3c) sweeps missed enqueues.
- **D5.** routeArtifact runs DB-side AND worker-side. DB-side is the coarse hint; worker-side is the source of truth.
- **D6.** No raw inserts into iris_kb_chunks or iris_kb_sources outside the worker allow-list. ESLint rule enforces.
- **D7.** Soft-delete via `deleted_at`, never DELETE. Partial HNSW index gives the same query semantics with full audit trail.

## Open items (resolved in subsequent phases)

- Photo cost cap enforcement (3c).
- OCR fallback tier for drawings (Tesseract in 3b -> Document AI in 3c if needed).
- PII scrubber for conversation worker (3c).
- pg_cron dispatcher heartbeat + DLQ replay (3c).
- spreadsheet named-range detection algorithm (3d).
- Code specialist cutover from kb-stub.ts to retrieve() (3d).

## Cross-references

- `docs/audits/IRIS_SPEC_RETRIEVE_2026-05-11.md` — the read side of the same pipeline.
- `docs/audits/INGESTION_TAXONOMY_SPEC_2026-05-08.md` — the 16 source types + sensitivity tiers.
- `docs/audits/ADR_017_EMBEDDING_MODEL_2026-05-08.md` — why 3-large @ 1536.
- `docs/audits/ADR_020_CONTEXT_FABRIC_AS_RETRIEVAL_ENTRYPOINT_2026-05-08.md` — why Context Fabric resolves persona before retrieve() is called.
- `src/services/iris/ingestion/router.ts` — implementation.
- `src/services/iris/ingestion/chunkers/{drawing,spec,rfi}.ts` — Phase 3b chunkers.
- `supabase/migrations/20261008000004_iris_ingest_triggers.sql` — Phase 3b triggers.
