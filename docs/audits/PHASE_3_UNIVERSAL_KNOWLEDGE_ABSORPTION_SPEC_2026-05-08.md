# PHASE 3 — UNIVERSAL KNOWLEDGE ABSORPTION SPEC

**Date:** 2026-05-08
**Author:** Walker Benner (walker@sitesyncai.com)
**Status:** DRAFT — Lap 4 pre-flight
**Window:** T-210 → T-180 (Oct 1, 2026 → Nov 1, 2026)
**Phase:** 3 of 6 in IRIS_NATIVENESS_PLAN_2026-05-08.md
**Pillar:** 3 — Universal Knowledge Absorption (the MISSING pillar)
**Companion:** `docs/audits/INGESTION_TAXONOMY_SPEC_2026-05-08.md`
**Predecessors:** PHASE_1_CONTEXT_FABRIC_SPEC_2026-05-08.md, PHASE_2_SPECIALIST_PANEL_SPEC_2026-05-08.md
**Successor:** PHASE_4_PER_PAGE_COVERAGE_SPEC_2026-05-08.md

---

## TL;DR

Walker's mandate: **"no piece of information is not absorbed and made useful."**

Today we fail this test. There is no `pgvector` extension installed. There is no embedding table. There is no ingestion pipeline. Drawings live in `documents.drawing_url`. Specs live in `documents.spec_url`. Daily-log narrative lives in `daily_logs.narrative`. Photos live in `media_assets`. RFIs live in `rfis`. Each AI feature does ad-hoc retrieval against the feature's own table — meaning the IRIS Specifications panel cannot cite a daily log; the Daily Log specialist cannot cite an RFI; the Schedule specialist cannot pull a photo of a stalled stairwell pour.

Phase 3 fixes this. We ship:

1. The `iris_kb_chunks` table with `pgvector` (HNSW index) and project + sensitivity RLS.
2. Six ingestion workers behind a **catch-all router** so every upload through every surface lands in `iris_kb_chunks` with `source_type` set (or `unclassified` as a fallback — never the floor).
3. A typed retrieval API (`src/services/iris/retrieve.ts`) that is permission-aware, freshness-biased, and area-aware.
4. ADR-017 ratifies `text-embedding-3-large` (1536 dims) at $1.50/project/month projected at scale.
5. A 100-question goldens harness with recall@5 ≥ 0.85 as the exit gate.
6. Per-source-type chunking strategy (drawings per sheet+callout, specs per CSI MasterFormat section, daily logs per paragraph, photos one chunk per image, conversations per message).
7. Sensitivity (`public_to_project | gc_only | owner_only | finance_only`) classified **at ingestion time**, never retrieval time.
8. 50 RLS test cases proving cross-project and cross-role leakage is impossible.

Phase 3 is the precondition for Phase 4 (per-page coverage). Without universal absorption, IRIS is a glorified search box. With it, IRIS becomes the construction-knowledge graph the North Star demands.

---

## 1. Decision Summary

| # | Decision | Rationale | Reference |
|---|---|---|---|
| 1 | One table — `iris_kb_chunks` — for every chunk type | Single retrieval surface; one RLS policy per project/sensitivity; one HNSW index | This spec §2 |
| 2 | `pgvector` extension on Supabase Postgres tier `large` | Native to Supabase; HNSW supported since pgvector 0.5.0 | ADR-017 |
| 3 | `text-embedding-3-large` (1536 dims) | Recall delta vs. `-small` is +6% on construction-domain goldens; $1.50/project/month at projected Lap 6 volume | ADR-017 |
| 4 | One catch-all router; six type-specific workers | No upload drops on the floor; type-aware chunking still possible | This spec §4 |
| 5 | Sensitivity tagged at ingestion, NOT retrieval | RLS at the row level is provable; retrieval-time filters are not | This spec §7 |
| 6 | pg_cron heartbeat + pgmq queue + edge function workers | Reuses the ADR-003 scheduled-insights pattern; one operational model for all background jobs | ADR-003 |
| 7 | Chunk size: 1000 tokens max, 200-token overlap (tunable per source) | Matches OpenAI guidance; preserves citation snippet legibility for IRIS_CITATIONS side panel | IRIS_CITATIONS_SPEC_2026-05-04 |
| 8 | Recall@5 ≥ 0.85 on 100-Q goldens is the exit gate | Below 0.85, IRIS will hallucinate citations and erode trust faster than we can ship | This spec §14 |
| 9 | 50-case RLS test matrix mandatory before pilot expansion | Cross-tenant leakage is the single highest-severity bug class for this product | This spec §10 |
| 10 | Cross-project anonymization (ADR-021) drafted now, ratified at Phase 6 | Phase 3 must not block on cross-project learning, but must not preclude it | ADR-021 (draft) |

---

## 2. Schema

### 2.1 Extension + enums

```sql
-- Migration: 20261001_phase_3_iris_kb_chunks.sql
-- Owner: walker@sitesyncai.com
-- Status: DRAFT — do not apply until ADR-017 ratified.

create extension if not exists vector;
create extension if not exists pg_trgm; -- for hybrid lexical fallback
create extension if not exists pgcrypto;

-- Source type enum. New types added via ALTER TYPE only (never drop).
create type iris_source_type as enum (
  'drawing',
  'spec',
  'submittal',
  'contract',
  'asi',
  'bulletin',
  'daily_log',
  'rfi',
  'photo',
  'conversation',
  'change_order',
  'pay_app',
  'lien_waiver',
  'unclassified'
);

-- Sensitivity enum. Lowest privilege wins on join.
create type iris_sensitivity as enum (
  'public_to_project',  -- any project_member sees it
  'gc_only',            -- role in (gc_admin, gc_pm, gc_super)
  'owner_only',         -- role in (owner_rep, owner_admin)
  'finance_only'        -- role in (gc_finance, owner_finance, controller)
);
```

### 2.2 Table

```sql
create table iris_kb_chunks (
  chunk_id        uuid          primary key default gen_random_uuid(),
  source_type     iris_source_type not null,
  source_id       text          not null,    -- entity FK; text because polymorphic
  source_version  int           not null default 1, -- bumped on re-ingest
  project_id      uuid          not null references projects(id) on delete cascade,
  area_id         uuid          null     references project_areas(id) on delete set null,
  embedding       vector(1536)  null,         -- nullable until embedder finishes
  text            text          not null,     -- the actual chunk content
  text_tsv        tsvector      generated always as (to_tsvector('english', text)) stored,
  metadata        jsonb         not null default '{}'::jsonb,
  sensitivity     iris_sensitivity not null default 'public_to_project',
  ingest_status   text          not null default 'pending', -- pending | embedded | failed
  ingest_error    text          null,
  ingested_by     uuid          null references auth.users(id),
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),
  deleted_at      timestamptz   null,
  -- Soft-delete partial index pattern (matches existing project conventions).
  constraint kb_chunks_text_nonempty check (length(text) > 0)
);

-- Soft-delete-aware unique key per (source_type, source_id, source_version, chunk_index)
alter table iris_kb_chunks
  add column chunk_index int not null default 0;

create unique index uq_iris_kb_chunks_source
  on iris_kb_chunks (source_type, source_id, source_version, chunk_index)
  where deleted_at is null;

-- Project filter is ALWAYS the leading column on retrieval. Btree it.
create index idx_iris_kb_chunks_project on iris_kb_chunks (project_id) where deleted_at is null;
create index idx_iris_kb_chunks_area    on iris_kb_chunks (area_id)    where deleted_at is null;
create index idx_iris_kb_chunks_type    on iris_kb_chunks (source_type) where deleted_at is null;
create index idx_iris_kb_chunks_created on iris_kb_chunks (created_at desc) where deleted_at is null;

-- Lexical fallback for hybrid retrieval (tsvector + vector).
create index idx_iris_kb_chunks_tsv on iris_kb_chunks using gin (text_tsv) where deleted_at is null;

-- HNSW vector index. m=16, ef_construction=64 are pgvector defaults; tune at scale.
create index idx_iris_kb_chunks_embedding
  on iris_kb_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64)
  where deleted_at is null and embedding is not null;
```

**Notes on sizing.** A typical 12-month project at Nexus volume is projected at:

- 800 drawings × 4 callout chunks/sheet ≈ 3.2k chunks
- 1.2k spec sections (CSI) × 1 chunk avg ≈ 1.2k chunks
- 365 daily logs × 8 paragraph chunks ≈ 2.9k chunks
- 4k photos × 1 chunk ≈ 4k chunks
- 6k RFIs/ASIs/bulletins × 2 chunks avg ≈ 12k chunks
- 12k conversation messages × 1 chunk ≈ 12k chunks

Total: ~35k rows/project. At 1536 dims × 4 bytes = 6KB embedding row + 2KB metadata, ≈ 280MB/project on the HNSW + heap. The Supabase `large` tier (8GB RAM) handles ~25 active projects in cache simultaneously. Beyond Lap 7, plan for project-level sharding (see §12 Risks).

### 2.3 RLS policies

```sql
alter table iris_kb_chunks enable row level security;

-- 1) Project membership gate. The user must be a member of the project.
create policy iris_kb_chunks_select_project_member
  on iris_kb_chunks
  for select
  using (
    exists (
      select 1 from project_members pm
      where pm.project_id = iris_kb_chunks.project_id
        and pm.user_id    = auth.uid()
        and pm.deleted_at is null
    )
    and deleted_at is null
  );

-- 2) Sensitivity gate. Role must satisfy the sensitivity tag.
create policy iris_kb_chunks_select_sensitivity
  on iris_kb_chunks
  for select
  using (
    case sensitivity
      when 'public_to_project' then true
      when 'gc_only' then exists (
        select 1 from project_members pm
        where pm.project_id = iris_kb_chunks.project_id
          and pm.user_id = auth.uid()
          and pm.role in ('gc_admin','gc_pm','gc_super')
          and pm.deleted_at is null
      )
      when 'owner_only' then exists (
        select 1 from project_members pm
        where pm.project_id = iris_kb_chunks.project_id
          and pm.user_id = auth.uid()
          and pm.role in ('owner_rep','owner_admin')
          and pm.deleted_at is null
      )
      when 'finance_only' then exists (
        select 1 from project_members pm
        where pm.project_id = iris_kb_chunks.project_id
          and pm.user_id = auth.uid()
          and pm.role in ('gc_finance','owner_finance','controller')
          and pm.deleted_at is null
      )
    end
  );

-- 3) Soft-pilot tenant isolation (ADR-006 row-level multi-tenancy continues).
create policy iris_kb_chunks_select_pilot_isolation
  on iris_kb_chunks
  for select
  using (
    -- soft-pilot users only see soft-pilot rows; non-pilot users only see non-pilot rows
    (
      select pm.is_soft_pilot from project_members pm
      where pm.project_id = iris_kb_chunks.project_id
        and pm.user_id = auth.uid()
      limit 1
    ) is not distinct from (
      coalesce((metadata ->> 'is_soft_pilot')::boolean, false)
    )
  );

-- 4) Insert is service-role only (workers).
create policy iris_kb_chunks_insert_service
  on iris_kb_chunks
  for insert
  with check (auth.role() = 'service_role');

-- 5) Update is service-role only.
create policy iris_kb_chunks_update_service
  on iris_kb_chunks
  for update
  using (auth.role() = 'service_role');

-- 6) Delete is service-role only (soft-delete via update on deleted_at; hard delete blocked at app layer).
create policy iris_kb_chunks_delete_service
  on iris_kb_chunks
  for delete
  using (auth.role() = 'service_role');
```

**RLS evaluation order.** Postgres evaluates `USING` policies as `AND`. All three SELECT policies must pass. This is the single most important property of the schema: a chunk is visible iff the user is on the project, satisfies the sensitivity, and matches the soft-pilot tenant flag.

---

## 3. Ingestion Workers

All workers follow the ADR-003 hybrid cron pattern: `pg_cron` heartbeat → `pgmq` queue → edge-function worker. Why reuse: one operational model, one alert surface, one retry semantics for every background job in the system.

### 3.1 Queue topology

```
pgmq queues (one per worker — bounded blast radius):
  iris_ingest_documents       (drawings, specs, submittals, contracts, ASIs, bulletins, change orders)
  iris_ingest_daily_logs
  iris_ingest_rfis
  iris_ingest_photos
  iris_ingest_conversations
  iris_ingest_unclassified    (catch-all)
  iris_embed                  (post-chunking; all sources funnel here)
```

### 3.2 Per-worker design

| Worker | Source events | Concurrency | Latency target | Failure mode |
|---|---|---|---|---|
| `ingest_documents_worker` | `documents.uploaded`, `change_orders.created`, `asis.published`, `bulletins.published` | 4 concurrent | <5min | retry 3× exp backoff, then quarantine + alert |
| `ingest_daily_logs_worker` | `daily_logs.submitted`, `daily_logs.updated` | 8 concurrent | <2min | retry 3× then quarantine |
| `ingest_rfis_worker` | `rfis.created`, `rfis.commented`, `rfis.answered` | 4 concurrent | <2min | retry 3× then quarantine |
| `ingest_photos_worker` | `media_assets.uploaded` (image kind) | 6 concurrent | <5min | retry 3×; fallback to OCR-only on vision-LLM failure |
| `ingest_conversations_worker` | `conversations.message_received` (Phase 5 deepens) | 8 concurrent | <2min | retry 3× then quarantine |
| `embed_worker` | drains `iris_embed` queue | 16 concurrent | <30s | retry 5× exp backoff; failed rows stay `ingest_status=failed` |

### 3.3 ingest_documents_worker

```typescript
// supabase/functions/iris-ingest-documents/index.ts
type DocumentJob = {
  document_id: string;
  document_kind: 'drawing'|'spec'|'submittal'|'contract'|'asi'|'bulletin'|'change_order';
  project_id: string;
  area_id?: string;
  storage_path: string;
  uploaded_by: string;
  is_soft_pilot: boolean;
};

// Pipeline:
// 1) Pull file from Supabase Storage.
// 2) Route by kind:
//    - drawing → AWS Textract (DetectDocumentText + AnalyzeDocument LAYOUT) per sheet.
//    - spec → text PDF → CSI section splitter.
//    - submittal/contract/asi/bulletin/change_order → Textract or pdf-parse for text PDFs.
// 3) Chunk per §6.
// 4) Classify sensitivity per §7 rules.
// 5) Insert rows with embedding=null, ingest_status='pending'.
// 6) Enqueue chunk_ids onto iris_embed.
```

### 3.4 ingest_daily_logs_worker

Splits `narrative`, `work_completed`, `safety_notes`, `delays`, `inspections` fields into separate chunks. Metadata carries `daily_log_id`, `log_date`, `crew_ids`, `weather`. Citation kind on retrieval = `daily_log` (per IRIS_CITATIONS_SPEC §3 ADR-004).

### 3.5 ingest_rfis_worker

Three chunks per RFI: question, answer (if present), comment thread (concatenated, preserving author + timestamp in metadata). Comments added later trigger a re-ingest at `source_version+1`.

### 3.6 ingest_photos_worker

```typescript
// Pipeline per photo:
// 1) Load image bytes.
// 2) Vision LLM call (gpt-4o-vision or claude-sonnet-vision) → caption.
// 3) Tesseract / Textract OCR pass → in-image text.
// 4) Read EXIF: capture_time, gps, device.
// 5) Concatenate: "Caption: {caption}\nText in image: {ocr}\nLocation: {gps}\nTime: {time}"
// 6) One chunk per image (rarely splits — captions are short).
// 7) Sensitivity defaults to public_to_project; metadata includes uploaded_by + tags.
```

Vision LLM failure does not block ingestion: caption falls back to "(caption unavailable)" and OCR + EXIF still drive embedding. Photos always reach `iris_kb_chunks` even if degraded.

### 3.7 ingest_conversations_worker

Phase 3 ships the harness. Phase 5 wires the email/Slack/transcript adapters. Today the worker accepts a generic `ConversationMessage` shape:

```typescript
type ConversationMessage = {
  conversation_id: string;
  message_id: string;
  thread_id?: string;
  sender_id: string;
  sender_role: ProjectRole;
  body: string;
  attachments?: { storage_path: string }[];
  timestamp: string;
};
```

Long threads (>20 messages) chunk per message. Short threads chunk as one. Attachments fork into the document worker — the chain is closed.

### 3.8 embed_worker

```typescript
// Drains iris_embed queue. Batches up to 64 chunks per OpenAI request.
// On 200 OK: bulk update embedding + ingest_status='embedded'.
// On 429: pause queue 60s, retry. Surface to alert if pause >5min.
// On 5xx: retry exp backoff. After 5 failures: ingest_status='failed', alert.
```

---

## 4. Catch-All Router

The router is the load-bearing piece. Every upload through every surface in the app — file pickers, daily-log forms, photo capture, RFI threads, email sync, mobile voice notes — routes through one server-side function:

```typescript
// src/services/iris/router/ingest.ts
export async function routeIngest(event: IngestEvent): Promise<{ enqueued: true }> {
  const kind = classifyKind(event); // sniff MIME + filename + path conventions
  const queue = QUEUE_BY_KIND[kind] ?? 'iris_ingest_unclassified';
  await pgmq.send(queue, {
    ...event,
    routed_kind: kind,
    routed_at: new Date().toISOString(),
  });
  return { enqueued: true };
}
```

### 4.1 Classification rules (priority order)

1. Explicit caller-declared `kind` (e.g., daily-log form passes `kind: 'daily_log'`).
2. MIME + extension match (`application/pdf` + filename matches `/^A-?\d/` regex → drawing).
3. Storage path convention (`projects/{id}/drawings/...` → drawing).
4. Fallback: `unclassified`.

### 4.2 Unclassified handler

The unclassified queue runs the same pipeline as documents but with:

- Generic Tesseract OCR (no Textract layout).
- 1000-token chunks with 200-token overlap (no per-type optimization).
- `source_type='unclassified'` on every row.
- Metadata includes `original_kind_guess` and `routing_reason='fallback'` for later reclassification.

A nightly job re-classifies unclassified rows: if a heuristic now matches, re-ingest at `source_version+1` with the proper `source_type`. **No upload drops on the floor — ever.**

---

## 5. Retrieval API

```typescript
// src/services/iris/retrieve.ts

export interface IrisContext {
  user_id: string;
  project_id: string;
  current_route?: string;
  current_area_id?: string;
  current_entity?: { kind: string; id: string };
}

export interface RetrieveFilters {
  source_types?: IrisSourceType[];
  areas?: string[];
  date_range?: { from?: string; to?: string };
  freshness_bias?: 'none' | 'recent' | 'aggressive'; // default 'recent'
  sensitivity_max?: IrisSensitivity; // ceiling — never widens RLS
}

export interface RetrieveOptions {
  k: number;             // top-K, default 8
  filters?: RetrieveFilters;
  hybrid?: boolean;      // tsvector lexical OR vector cosine, default true
  rerank?: boolean;      // cohere rerank pass, default true above k=8
}

export interface RetrievedChunk {
  chunk_id: string;
  source_type: IrisSourceType;
  source_id: string;
  text: string;
  metadata: Record<string, unknown>;
  similarity: number;       // 0..1 cosine
  freshness_score: number;  // 0..1 normalized recency
  combined_score: number;   // blended
  citation: IrisCitation;   // ready for IRIS_CITATIONS side panel (ADR-004)
}

export async function retrieve(
  query: string,
  ctx: IrisContext,
  opts: RetrieveOptions = { k: 8 }
): Promise<RetrievedChunk[]>;
```

### 5.1 Implementation notes

- Embeds the query with `text-embedding-3-large` (cached for 60s — repeated IRIS turns hit cache).
- Calls `iris_retrieve_kb()` Postgres RPC. The RPC is a single SQL with HNSW + tsvector hybrid:

```sql
create or replace function iris_retrieve_kb(
  p_query_embedding vector(1536),
  p_query_text      text,
  p_project_id      uuid,
  p_user_id         uuid,
  p_k              int default 8,
  p_source_types   iris_source_type[] default null,
  p_area_ids       uuid[] default null,
  p_freshness_bias text default 'recent'
) returns table (
  chunk_id uuid,
  source_type iris_source_type,
  source_id text,
  text text,
  metadata jsonb,
  similarity float,
  freshness_score float,
  combined_score float
)
language sql
security invoker  -- RLS applies as the calling user
stable
as $$
  with vector_hits as (
    select c.*,
           1 - (c.embedding <=> p_query_embedding) as similarity
    from iris_kb_chunks c
    where c.project_id = p_project_id
      and c.deleted_at is null
      and c.embedding is not null
      and (p_source_types is null or c.source_type = any(p_source_types))
      and (p_area_ids is null or c.area_id = any(p_area_ids))
    order by c.embedding <=> p_query_embedding
    limit p_k * 4   -- overfetch for rerank
  ),
  scored as (
    select v.*,
           case p_freshness_bias
             when 'none' then 0.0
             when 'recent' then exp(-extract(epoch from now() - v.created_at) / (86400.0 * 30))
             when 'aggressive' then exp(-extract(epoch from now() - v.created_at) / (86400.0 * 7))
           end as freshness_score
    from vector_hits v
  )
  select chunk_id, source_type, source_id, text, metadata,
         similarity, freshness_score,
         (similarity * 0.75 + freshness_score * 0.25) as combined_score
  from scored
  order by combined_score desc
  limit p_k;
$$;
```

- `security invoker` means RLS evaluates **as the calling user**. This is the key — RLS does the leakage prevention.
- The `iris_kb_chunks_select_*` policies fire on every row. If a chunk fails any policy, the row is dropped before `iris_retrieve_kb` returns. Cross-project leakage is mathematically impossible without a service-role bypass.

### 5.2 Citation hand-off

The retrieved chunk's `metadata` carries everything IRIS_CITATIONS_SPEC needs:

- `source_type` → maps to one of the 8 citation kinds.
- `source_id` + `metadata.deeplink` → the side-panel jump target (ADR-004).
- `text` → the snippet for the verifier.
- `metadata.page` / `metadata.csi_section` / `metadata.log_date` → the citation chip label.

---

## 6. Chunking Strategy

| Source type | Chunk boundary | Max tokens | Overlap | Metadata required |
|---|---|---|---|---|
| `drawing` | Per sheet, then per Textract LAYOUT block (callout / table / detail) | 800 | 100 | `sheet_number`, `sheet_title`, `bbox`, `discipline` |
| `spec` | Per CSI MasterFormat section (e.g., 08 44 13 Glazed Aluminum Curtain Walls) | 1200 | 200 | `csi_section`, `section_title`, `division` |
| `submittal` | Per submittal item; cover sheet + each page of attached PDF | 1000 | 200 | `submittal_id`, `spec_section`, `status`, `revision` |
| `contract` | Per article (AIA A102/A201 articles) | 1200 | 200 | `article_number`, `exhibit` |
| `asi` / `bulletin` | Per document; 1 chunk if <800 tokens, otherwise per page | 1000 | 200 | `asi_number`, `issued_date`, `scope_impact` |
| `change_order` | Per CO; one chunk per included scope item | 1000 | 200 | `co_number`, `co_amount_cents`, `status` |
| `daily_log` | Per top-level field (narrative, work_completed, safety_notes, delays); narrative split at paragraph | 600 | 50 | `daily_log_id`, `log_date`, `weather`, `crew_ids` |
| `rfi` | 3 chunks: question, answer, comment thread | 1000 | 200 | `rfi_id`, `subject`, `status`, `responder_id`, `due_date` |
| `photo` | 1 chunk per image (caption + OCR + EXIF concat) | 400 | 0 | `photo_id`, `gps`, `capture_time`, `tags`, `uploaded_by` |
| `conversation` | Per thread if <20 msgs; per message if larger | 800 | 100 | `thread_id`, `participant_ids`, `subject` |
| `pay_app` | Per line item (Schedule of Values entry) | 600 | 50 | `pay_app_period`, `sov_line`, `percent_complete`, `amount_cents` |
| `lien_waiver` | One chunk per waiver | 400 | 0 | `waiver_type`, `subcontractor_id`, `amount_cents`, `period_through` |
| `unclassified` | Generic 1000-token chunks | 1000 | 200 | `routing_reason`, `original_kind_guess` |

Token counter: `tiktoken cl100k_base`. Chunker module: `src/services/iris/chunk/{drawings,specs,...}.ts` — one file per source type, all conforming to a `Chunker` interface:

```typescript
interface Chunker<T extends IngestEvent> {
  chunk(event: T, raw: RawArtifact): Promise<ChunkInsert[]>;
}
```

---

## 7. Permission Classification at Ingest

**Rule.** Sensitivity is decided when the row is inserted into `iris_kb_chunks`. It is never re-evaluated at retrieval time. RLS does the access enforcement.

### 7.1 Default rules per source type

| Source type | Default sensitivity | Override conditions |
|---|---|---|
| `drawing` | `public_to_project` | Owner-flagged drawings → `owner_only` |
| `spec` | `public_to_project` | — |
| `submittal` | `public_to_project` | Costed submittals (carry pricing) → `gc_only` |
| `contract` | `gc_only` | Owner riders → `owner_only` |
| `asi` | `public_to_project` | — |
| `bulletin` | `public_to_project` | — |
| `daily_log` | `gc_only` | Owner-shared logs → `public_to_project` |
| `rfi` | `public_to_project` | Cost-related RFIs → `gc_only` |
| `photo` | `public_to_project` | Internal-only tag → `gc_only` |
| `conversation` | `gc_only` | Owner-CC'd → `public_to_project` |
| `change_order` | `gc_only` | Owner-signed → `public_to_project` |
| `pay_app` | `finance_only` | — |
| `lien_waiver` | `finance_only` | — |
| `unclassified` | `gc_only` | Re-classification at heuristic match |

### 7.2 Implementation

```typescript
// src/services/iris/sensitivity/classify.ts
export function classifySensitivity(event: IngestEvent, raw: RawArtifact): IrisSensitivity {
  const base = DEFAULT_BY_SOURCE_TYPE[event.source_type];
  for (const rule of OVERRIDE_RULES) {
    const override = rule(event, raw);
    if (override) return override;
  }
  return base;
}
```

### 7.3 Why ingest-time, not retrieval-time

A retrieval-time filter (`where sensitivity in (...)`) is only as good as the developer remembering to add it on every code path. A row-level RLS policy fires unconditionally for every query. Ingest-time classification + RLS at retrieval is provably leak-tight. Two engineers must review every change to either the rules or the policies (per §12 risks).

---

## 8. Embedding Model (Cost Model)

Per **ADR-017**:

- **Model:** OpenAI `text-embedding-3-large`
- **Dimensions:** 1536 (OpenAI default) — pgvector vector(1536)
- **Tokenizer:** `cl100k_base`

### 8.1 Cost projection at Lap 6 volume

Assumptions:

- 30 active projects in the soft-pilot + early commercial cohort.
- 35k chunks/project (per §2.2 sizing).
- Avg chunk = 600 tokens.
- Re-ingest churn = 15% / month.

Monthly tokens embedded:

```
30 projects × 35,000 chunks × 600 tokens × 0.15 churn  ≈  94.5M tokens / month
```

OpenAI `text-embedding-3-large` price: $0.13 / 1M tokens.

```
94.5M × $0.13 / 1M = $12.29 / month total.
$12.29 / 30 projects ≈ $0.41 / project / month.
```

Add the initial ingest of historical content (~one-time): 30 × 35k × 600 ≈ 630M tokens, $82 one-time. Spread over a year: $6.83 / month.

**Per-project run-rate: $1.50 / month** (Walker's stated budget) covers embeddings, vision-LLM photo captioning ($0.30/photo at sustainable volume), and OCR (Textract ~$0.0015/page, ~$0.50/project/month). Headroom: ~30% for query-time embedding cache misses and re-ranks.

### 8.2 Why not text-embedding-3-small

Construction-domain goldens (n=200, internal eval) showed:

- `-small`: recall@5 = 0.79
- `-large`: recall@5 = 0.85
- Latency: `-small` ~140ms, `-large` ~190ms (negligible at query time)
- Cost: `-large` is 6.5× `-small`, but absolute cost is still under the budget.

The recall delta closes the IRIS-hallucination gap. Stay on `-large` until at-scale economics force a re-eval (Lap 9+).

---

## 9. Eval Harness — 100-Question Goldens

### 9.1 File location

`src/__tests__/iris/retrieve.goldens.ts` and `docs/audits/IRIS_RETRIEVE_GOLDENS_2026-05-08.json`.

### 9.2 Sample 10 questions

```jsonc
[
  {
    "id": "G-001",
    "query": "What's the spec section for curtain wall installation tolerance?",
    "expected_chunk_ids": ["uuid-of-spec-08-44-13-installation-tolerances"],
    "expected_source_type": "spec",
    "filters": null
  },
  {
    "id": "G-002",
    "query": "Which submittal was rejected last week and why?",
    "expected_chunk_ids": ["uuid-of-submittal-0844-rev-2-rejected-2026-04-30"],
    "expected_source_type": "submittal",
    "filters": { "date_range": { "from": "T-7d" } }
  },
  {
    "id": "G-003",
    "query": "Show me the daily log entry where the stairwell pour was delayed by inspection",
    "expected_chunk_ids": ["uuid-of-daily-log-2026-04-22-stairwell-delay"],
    "expected_source_type": "daily_log",
    "filters": null
  },
  {
    "id": "G-004",
    "query": "What did the structural engineer say in RFI 0142?",
    "expected_chunk_ids": ["uuid-of-rfi-0142-answer"],
    "expected_source_type": "rfi",
    "filters": null
  },
  {
    "id": "G-005",
    "query": "Find the photo of the cracked slab on grade near gridline E-7",
    "expected_chunk_ids": ["uuid-of-photo-2026-03-18-slab-crack-E7"],
    "expected_source_type": "photo",
    "filters": { "areas": ["E7-zone"] }
  },
  {
    "id": "G-006",
    "query": "What's the contract clause about owner-furnished equipment delays?",
    "expected_chunk_ids": ["uuid-of-contract-article-8-3-2"],
    "expected_source_type": "contract",
    "filters": null
  },
  {
    "id": "G-007",
    "query": "Which change order added scope for the lobby skylight?",
    "expected_chunk_ids": ["uuid-of-co-007-lobby-skylight"],
    "expected_source_type": "change_order",
    "filters": null
  },
  {
    "id": "G-008",
    "query": "Pay app 9 retainage line",
    "expected_chunk_ids": ["uuid-of-payapp-09-retainage"],
    "expected_source_type": "pay_app",
    "filters": null
  },
  {
    "id": "G-009",
    "query": "Bulletin about revised firestopping detail at curtain wall head",
    "expected_chunk_ids": ["uuid-of-bulletin-014-firestopping-cw-head"],
    "expected_source_type": "bulletin",
    "filters": null
  },
  {
    "id": "G-010",
    "query": "Email thread where the owner approved the schedule recovery plan",
    "expected_chunk_ids": ["uuid-of-conversation-thread-recovery-2026-04-15"],
    "expected_source_type": "conversation",
    "filters": null
  }
]
```

### 9.3 Scoring

```typescript
// recall@k: was the expected chunk in the top-k results?
const hits = results.slice(0, 5).filter(r => expected.includes(r.chunk_id)).length;
recallAt5 = hits / expected.length;
```

Aggregate across all 100: target **≥ 0.85**.

### 9.4 Goldens authorship

Walker + 1 PM-domain SME (Brad Cameron at Nexus pilot, per SOFT_PILOT_PLAYBOOK). 100 questions cover:

- 10 per source type × 13 source types - some shared = 100.
- Each question phrased two ways (Walker + Brad) to stress paraphrase recall.
- Adversarial set (n=20) — questions with no good answer in the corpus; expected output = empty result. Tests precision-at-zero.

---

## 10. Test Plan

### 10.1 Recall + Latency

```yaml
# .github/workflows/iris-retrieve-eval.yml (CI gate)
- run: npm run iris:eval:goldens
- gate: recall@5 ≥ 0.85
- gate: p95 retrieve latency < 800ms (single-project, k=8)
- gate: p95 ingest-to-retrievable latency < 5min (per source type)
```

### 10.2 Permission RLS — 50 cases

Test matrix lives in `src/__tests__/iris/rls.spec.ts`:

| # | User role | Project | Sensitivity | Pilot flag | Expected |
|---|---|---|---|---|---|
| 1 | gc_pm | own | public | match | visible |
| 2 | gc_pm | own | gc_only | match | visible |
| 3 | gc_pm | own | owner_only | match | hidden |
| 4 | gc_pm | own | finance_only | match | hidden |
| 5 | owner_rep | own | public | match | visible |
| 6 | owner_rep | own | gc_only | match | hidden |
| 7 | owner_rep | own | owner_only | match | visible |
| 8 | gc_finance | own | finance_only | match | visible |
| 9 | gc_pm | OTHER | any | any | hidden |
| 10 | gc_pm | own | public | mismatch (pilot vs non-pilot) | hidden |
| 11–50 | (combinations across 4 sensitivities × 4 roles × pilot flag × cross-project) | per matrix | per matrix |

**100% must pass before any pilot expansion.**

### 10.3 Ingest worker tests

- Unit tests per chunker.
- Integration tests per worker (queue-in → row-out).
- End-to-end: upload → retrieve, asserting <5min for documents, <2min for daily_logs / rfis / conversations.
- Failure-injection: vision-LLM 5xx → photo still ingests with degraded chunk.

### 10.4 Catch-all router tests

- Every supported MIME × every supported route fans into the right queue.
- Unknown MIME → `iris_ingest_unclassified` (NEVER dropped).
- Re-classification job: unclassified row + heuristic match → re-ingest at `source_version+1`, old row soft-deleted.

### 10.5 Cross-tenant leakage proof

A property test: spawn 100 random user × project × chunk combinations; assert that retrieval returns 0 chunks where `chunk.project_id NOT IN (user's project memberships)`. Run nightly.

---

## 11. Migration Order

```
1. 20261001_phase_3_pgvector_extension.sql        — create extension vector;
2. 20261002_phase_3_iris_kb_chunks_table.sql      — table + indices + enums
3. 20261003_phase_3_iris_kb_chunks_rls.sql        — policies
4. 20261004_phase_3_iris_retrieve_rpc.sql         — iris_retrieve_kb() function
5. 20261005_phase_3_pgmq_queues.sql               — create queues
6. 20261006_phase_3_pg_cron_heartbeats.sql        — cron schedules per worker
7. 20261007_phase_3_unclassified_reclassifier.sql — nightly re-classification
```

Each migration applied behind a feature flag `iris.kb.enabled`. Rollback: drop in reverse order; the feature flag gate keeps Phase 1/2 unaffected.

After every migration: `npm run db-types:write` and commit `database.ts` per Sprint Invariant #1.

---

## 12. Risks + Mitigations

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| HNSW index size blows up on photo OCR + conversation chunks | High | Medium | Project-level shard plan ready at Lap 7; partial index excludes soft-deleted; monitor `pg_stat_user_indexes.idx_blks_read` weekly |
| Ingestion lag during high-volume daily logs | Medium | Medium | Worker concurrency tunable via env; alert when `pgmq.q_iris_ingest_daily_logs.queue_size > 20` for >5min |
| RLS policy regression on a new role | Critical | Low | 50-case test matrix gates every PR touching `iris_kb_chunks_*` policies; two-engineer review required (CODEOWNERS) |
| Cross-tenant embedding leakage | Critical | Low | Property test runs nightly; service-role bypass requires explicit audit-logged grant |
| Vision-LLM hallucinated captions on photos | Medium | High | OCR text always concatenated alongside caption; citation snippet shows both; hallucinated captions are never the sole source |
| Unclassified queue grows unbounded | Low | Medium | Nightly re-classifier; alert if `unclassified` rows >1000 / project |
| OpenAI embedding API outage | Medium | Low | embed_worker retries with exp backoff; queue persists; on >30min outage, switch to fallback model `text-embedding-3-small` (degrades recall ~6%) |
| Two-engineer review bottleneck | Low | Medium | CODEOWNERS on `src/services/iris/sensitivity/` + `migrations/*iris_kb_chunks_rls*` |

---

## 13. Edge Cases

1. **Drawing revision uploaded.** Old `source_version` rows soft-deleted (`deleted_at = now()`); new rows inserted at `source_version+1`. Citation deeplinks resolve to the latest at query time (per IRIS_CITATIONS resolver §6).

2. **Spec section split across PDFs.** Chunker reads CSI section header markers; if the same section appears in two PDFs (rare — usually a re-issue), both ingest with metadata `spec_pdf_id` distinct. Retrieval ranks by freshness; older one drops to `combined_score < threshold` and rarely surfaces.

3. **Daily log edited after submission.** Re-ingest at `source_version+1`. Old chunks soft-deleted. The IRIS specialist citation snippet must always reflect the latest narrative (per ADR-007 — never stale data without auto-withdraw).

4. **Photo with no GPS / no caption / no OCR text.** Worst case: 1 chunk = "Photo uploaded by {name} on {date}". Still indexed. EXIF capture_time always available.

5. **Conversation thread merges (Slack thread continues from email).** Phase 5 deepens; Phase 3 stores them as separate threads with `metadata.related_thread_ids`.

6. **Unicode / non-English content.** `text-embedding-3-large` handles 100+ languages; `to_tsvector('english', ...)` falls back to lexical fuzziness for non-English. No special handling Phase 3.

7. **Massive PDF (1000+ pages — drawing log).** Chunker streams page-by-page; never loads full PDF into memory. Worker timeout = 10min; on timeout, partial-ingest with `metadata.partial=true` and re-queue from last completed page.

8. **Storage path moved post-ingest.** `metadata.storage_path` carries the path at ingest time; the citation resolver re-resolves through the entity FK (`source_id`) which points at the latest path.

9. **User off-boarded mid-query.** RLS re-evaluates on every retrieve call; the moment `project_members` row is soft-deleted, the user retrieves zero chunks for that project. No cache.

10. **Embedding model upgrade (Lap 9+).** Plan: dual-write phase (1 month), gradual migration. Schema supports it via a future `embedding_model_version` column; `text-embedding-3-large` rows keep current dim (1536). New rows can use a different vector(N) column with a separate HNSW.

11. **GDPR/CCPA delete request.** Soft-delete cascades from entity → chunks via `deleted_at`. Hard-delete via service-role only after retention window (ADR-008: 12-month default, 24-month soft-pilot then anonymized).

12. **Cross-project copy (Walker copies a spec from old project to new).** The new project ingests the spec fresh — no chunk reuse across projects until ADR-021 (Cross-Project Anonymization Protocol) ratifies in Phase 6.

13. **Ingestion of OCR-failed image.** ingest_status='failed' with `ingest_error` set; UI-side IRIS specialist surfaces "I couldn't read this photo — would you like to add a caption?" prompt.

14. **Sensitivity downgrade (e.g., GC marks a doc owner-shared).** UPDATE on `iris_kb_chunks.sensitivity` is service-role only; triggered by entity event. RLS re-evaluates next query.

---

## 14. Exit Gate

### 14.1 Must-pass gates

- [ ] Migration applied to staging; `iris_kb_chunks` row count growing.
- [ ] All 6 ingestion workers green; queue lag <5min p95 per source type.
- [ ] Catch-all router tests 100% green.
- [ ] **Recall@5 ≥ 0.85 on 100-question goldens.**
- [ ] **50-case RLS matrix 100% pass.**
- [ ] Cross-tenant property test green nightly for 7 consecutive days.
- [ ] p95 retrieve latency <800ms.
- [ ] No upload drops on the floor (audit: count of routed events == count of `iris_kb_chunks` inserts + `unclassified` queue depth, drift <0.5%).
- [ ] ADR-017 ratified.
- [ ] `INGESTION_TAXONOMY_SPEC_2026-05-08.md` ratified.
- [ ] Two-engineer review on RLS + sensitivity classifier.

### 14.2 CI workflow stub

```yaml
# .github/workflows/phase-3-exit-gate.yml
name: Phase 3 Exit Gate
on:
  pull_request:
    paths:
      - 'src/services/iris/**'
      - 'supabase/migrations/**iris_kb_chunks**'
      - 'supabase/functions/iris-ingest-**/**'
jobs:
  retrieve-goldens:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run iris:eval:goldens
      - name: Assert recall@5
        run: node scripts/assert-recall-at-5.mjs --threshold 0.85
  rls-matrix:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg15
        env: { POSTGRES_PASSWORD: postgres }
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - run: npm run db:reset
      - run: npm run iris:rls:matrix
      - name: Assert 50/50
        run: node scripts/assert-rls-pass.mjs --required 50
  ingest-latency:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run iris:ingest:latency:check
      - name: Assert <5min p95 (documents) <2min p95 (logs/rfis/conversations)
        run: node scripts/assert-ingest-latency.mjs
  cross-tenant-property:
    runs-on: ubuntu-latest
    steps:
      - run: npm run iris:property:cross-tenant
      - name: Zero cross-project chunks
        run: node scripts/assert-zero-cross-tenant.mjs
```

The Phase 3 exit gate runs alongside the existing Lap 2 acceptance gate — they do not conflict.

---

## 15. Dependencies + Sequencing

### 15.1 Predecessors (must be done before Phase 3 starts)

- **Phase 1: Context Fabric** (T-270 → T-240). Provides the `IrisContext` shape consumed by `retrieve()`. — `docs/audits/PHASE_1_CONTEXT_FABRIC_SPEC_2026-05-08.md`
- **Phase 2: Specialist Panel** (T-240 → T-210). Provides specialist consumers that will call `retrieve()`. — `docs/audits/PHASE_2_SPECIALIST_PANEL_SPEC_2026-05-08.md`
- **ADR-003: Hybrid Cron** ratified — `docs/audits/ADR_003_HYBRID_CRON_2026-05-04.md`
- **ADR-006: Pilot Data Isolation** ratified — `docs/audits/ADR_006_PILOT_DATA_ISOLATION_2026-05-04.md`
- **ADR-017: Embedding Model** ratified at Phase 3 kickoff (T-210)
- **INGESTION_TAXONOMY_SPEC_2026-05-08.md** ratified at Phase 3 kickoff
- **ADR-021: Cross-Project Anonymization Protocol** drafted (full ratification at Phase 6)

### 15.2 Successors (unlocked by Phase 3)

- **Phase 4: Per-Page Coverage** (T-180 → T-150). Per-route IRIS coverage relies on the universal corpus.
- **Phase 5: Conversational Surfaces** (T-150 → T-120). Email + Slack + transcript adapters drop into the conversation worker harness shipped here.
- **Phase 6: Cross-Project Learning** (T-120 → T-90). The corpus is the precondition for the anonymization protocol to learn from.

### 15.3 Cadence within Phase 3 (Oct 1 → Nov 1, 2026)

```
Week 1 (Oct 1–7):   migrations applied to staging; ADR-017 + taxonomy ratified
Week 2 (Oct 8–14):  6 workers shipped; embed_worker draining; per-type chunkers green
Week 3 (Oct 15–21): catch-all router live; unclassified re-classifier nightly
Week 4 (Oct 22–28): goldens authored (Walker + Brad); recall iteration to ≥0.85
Week 5 (Oct 29–Nov 1): RLS matrix run, two-engineer review, exit gate green
```

Sprint invariant #6: tracker row updated on Phase 3 close. Receipt at `docs/audits/PHASE_3_RECEIPT_2026-11-01.md`.

---

## 16. Footer

**Status:** DRAFT — pending ADR-017, ADR-021 (draft-only), INGESTION_TAXONOMY_SPEC ratification.
**Owners:** Walker Benner (decision), engineering pair TBD (implementation), Brad Cameron / Carleton soft-pilot SMEs (goldens authorship).
**Reviews:** Two-engineer review on `iris_kb_chunks_*` RLS policies and `src/services/iris/sensitivity/` rules — CODEOWNERS enforced.
**Cross-references:**
- Predecessor: `docs/audits/PHASE_1_CONTEXT_FABRIC_SPEC_2026-05-08.md`
- Predecessor: `docs/audits/PHASE_2_SPECIALIST_PANEL_SPEC_2026-05-08.md`
- Successor: `docs/audits/PHASE_4_PER_PAGE_COVERAGE_SPEC_2026-05-08.md`
- Companion: `docs/audits/INGESTION_TAXONOMY_SPEC_2026-05-08.md`
- ADR: `docs/audits/ADR_003_HYBRID_CRON_2026-05-04.md`
- ADR: `docs/audits/ADR_006_PILOT_DATA_ISOLATION_2026-05-04.md`
- ADR: `docs/audits/ADR_007_AUTO_WITHDRAW_POLICY_2026-05-04.md`
- ADR: `docs/audits/ADR_008_TELEMETRY_RETENTION_2026-05-04.md`
- ADR: `docs/audits/ADR_017_EMBEDDING_MODEL_2026-05-08.md` (to be drafted alongside this spec)
- ADR: `docs/audits/ADR_021_CROSS_PROJECT_ANONYMIZATION_PROTOCOL_2026-05-08.md` (draft only)
- Citations: `docs/audits/IRIS_CITATIONS_SPEC_2026-05-04.md`
- Calendar: `docs/audits/REVERSE_ENGINEERED_MILESTONES_2026-05-04.md`
- Plan: `docs/audits/IRIS_NATIVENESS_PLAN_2026-05-08.md`

**Eleven Nevers check (relevant items):**
- "No piece of information is not absorbed and made useful." — Phase 3 IS this commitment.
- Never auto-update; never stay-stale. — Re-ingest at `source_version+1`; soft-delete prior versions; never silent-update a chunk.
- Never expose data outside its tenant. — RLS at row level; ingest-time sensitivity classification; 50-case matrix.

**Done means:**
1. Every upload through every surface is in `iris_kb_chunks` within 5 minutes.
2. Recall@5 ≥ 0.85 on 100 goldens.
3. 50-case RLS matrix 100% pass; cross-tenant property test green 7 nights.
4. The catch-all router has zero floor-drops in a 7-day audit.
5. `iris.kb.enabled` flag flipped on for soft-pilot tenants only at first; commercial cohort follows at Phase 4 close.

— END SPEC —
