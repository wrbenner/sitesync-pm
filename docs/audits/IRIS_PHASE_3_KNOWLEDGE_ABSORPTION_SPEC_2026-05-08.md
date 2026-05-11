# IRIS Phase 3 — Universal Knowledge Absorption (Spec)

**Date:** 2026-05-08
**Author:** Walker (with Claude as engineering partner)
**Status:** Draft. Target Lap 4, ~Oct–Nov 2026 (T-210 → T-180).
**Phase:** 3 of 8 in `IRIS_NATIVENESS_PLAN_2026-05-08.md`. Closes Pillar 3 ("Universal Knowledge Absorption — the missing pillar").
**Companion (sub-spec):** `INGESTION_TAXONOMY_SPEC_2026-05-08.md` (artifact-by-artifact catalog — to be authored at phase open).
**Format references:** `IRIS_TELEMETRY_SPEC_2026-05-04.md` (multi-phase plan + DDL), `ADR_007_AUTO_WITHDRAW_POLICY_2026-05-04.md` (decision-doc voice), `SCHEDULED_INSIGHTS_SPEC_2026-05-04.md` (worker pattern reused exactly).
**Reuses:** ADR-003 (pg_cron + pgmq + edge function pattern), ADR-006 (RLS multi-tenancy), ADR-008 (telemetry retention). Citations spec (`IRIS_CITATIONS_SPEC_2026-05-04.md`) is the consumer of the chunks this spec produces.
**Predecessors:** Phase 1 (Context Fabric provides `IrisContext` to retrieval), Phase 2 (specialists consume retrieved chunks).
**Successors:** Phase 4 (per-page insights query the KB), Phase 5 (multi-modal extends ingestion to photo/voice anchors), Phase 6 (firm memory aggregates over this).

---

## 1. Status

Draft. Lap 4 pre-flight. Migration sits unapplied until ADR-017 (embedding model) is ratified and Engineer #2 is onboarded. Target apply window: 2026-10-08 (Lap 4 Day 1). Target backfill complete: 2026-10-29 (Day 22). Target acceptance gate green: 2026-11-04 (Day 28).

This spec assumes Phase 0 (citations, voice, scheduled insights, telemetry) is shipped and Phase 1 (Context Fabric, 5 personas) is in production. Without `IrisContext`, retrieval has no permission scope to apply.

---

## 2. The Promise Being Kept

Walker's standard from 2026-05-08:

> *"All information needs to be accessible — then personalized, then have actionable insights across every page and piece of information — no piece of information is not absorbed and made useful."*

Today's reality (per the `IRIS_NATIVENESS_PLAN` scorecard):

- **0 chunks indexed** for retrieval. No `pgvector` extension, no embeddings table, no ingestion pipeline.
- Drawings live in `documents.drawing_url`. Specs live in `documents.spec_url`. Daily-log narrative lives in `daily_logs.narrative`. Photos live in `media_assets`. RFIs live in `rfis`. Conversations live nowhere.
- Each AI feature does **ad-hoc retrieval** against the feature's own table. The Iris Specifications panel cannot cite a daily log. The Daily Log specialist cannot cite an RFI. The Schedule specialist cannot pull a photo of a stalled stairwell pour.

After Phase 3:

- Every doc, log, photo, conversation chunk, contract clause, change-order narrative, and spreadsheet cell range is **searchable, permission-aware, citation-producing**.
- One retrieval API. One RLS policy. One HNSW index. One catch-all router so no upload drops on the floor.
- The 8-kind citation system (per `IRIS_CITATIONS_SPEC`) graduates from "8 kinds wired into 5 entity types" to "any chunk in any source type produces a citation that resolves through the side-panel."

This is the missing pillar. Phase 3 is where "AI-native" stops being a slogan and becomes an indexed, retrievable, RLS-gated, citation-emitting graph.

---

## 3. Schema

### 3.1 Extensions and enums

```sql
-- Migration: supabase/migrations/20261008000000_iris_kb_chunks.sql
-- Owner: walker@sitesyncai.com
-- Status: DRAFT — do not apply until ADR-017 ratified.

create extension if not exists vector;     -- pgvector ≥ 0.6 for HNSW
create extension if not exists pg_trgm;    -- hybrid lexical fallback
create extension if not exists pgcrypto;   -- gen_random_uuid()
-- pg_cron + pgmq already enabled per ADR-003.

create type iris_source_type as enum (
  'drawing',
  'spec_section',
  'submittal',
  'rfi',
  'daily_log',
  'photo',
  'conversation',
  'contract',
  'change_order',
  'bulletin',
  'asi',
  'spreadsheet',
  'pay_app',
  'lien_waiver',
  'unclassified'
);

create type iris_sensitivity as enum (
  'public_to_project',  -- any project_member
  'gc_only',            -- gc_admin, gc_pm, gc_super
  'owner_only',         -- owner_rep, owner_admin
  'finance_only'        -- gc_finance, owner_finance, controller
);
```

### 3.2 `iris_kb_chunks` table — the single retrieval surface

```sql
create table iris_kb_chunks (
  chunk_id        uuid           primary key default gen_random_uuid(),
  source_type     iris_source_type not null,
  source_id       uuid           not null,        -- FK target varies by type
  source_anchor   jsonb          not null default '{}'::jsonb,
                                                  -- drawing: { sheet_id, page, bbox: [x0,y0,x1,y1] }
                                                  -- spec:    { csi_section, paragraph_no, line_range: [a,b] }
                                                  -- photo:   { frame_id, bbox, exif: {...} }
                                                  -- log:     { line_range: [a,b] }
                                                  -- spreadsheet: { sheet_name, cell_ref: "A1:C12" }
                                                  -- conversation: { thread_id, message_id, ts }
  project_id      uuid           not null references projects(id) on delete cascade,
  area_id         uuid           null    references project_areas(id) on delete set null,
  sensitivity     iris_sensitivity not null default 'public_to_project',
  embedding       vector(1536)   null,            -- nullable until embedder finishes
  embedding_model_version text   not null default 'oai-text-embedding-3-large-v1',
  text            text           not null,
  text_tsv        tsvector       generated always as (to_tsvector('english', text)) stored,
  metadata        jsonb          not null default '{}'::jsonb,
  tokens          int            not null,
  chunk_index     int            not null default 0,
  source_version_hash text       not null,        -- sha256 of source content at ingest
  ingest_status   text           not null default 'pending'
                                  check (ingest_status in ('pending','embedded','failed','tombstoned')),
  ingest_error    text           null,
  ingested_by     uuid           null references auth.users(id),
  created_at      timestamptz    not null default now(),
  updated_at      timestamptz    not null default now(),
  deleted_at      timestamptz    null,
  constraint kb_chunks_text_nonempty check (length(text) > 0)
);
```

### 3.3 Indexes

```sql
-- Soft-delete-aware uniqueness: a given chunk position in a given source version is unique.
create unique index uq_iris_kb_chunks_source_position
  on iris_kb_chunks (source_type, source_id, source_version_hash, chunk_index)
  where deleted_at is null;

-- Project always leads (tenant scope is the hot filter).
create index idx_iris_kb_chunks_project_type_area_alive
  on iris_kb_chunks (project_id, source_type, area_id)
  where deleted_at is null;

-- Recency-biased retrieval: created_at desc.
create index idx_iris_kb_chunks_created_alive
  on iris_kb_chunks (project_id, created_at desc)
  where deleted_at is null;

-- BM25-ish lexical fallback for hybrid retrieval.
create index idx_iris_kb_chunks_tsv
  on iris_kb_chunks using gin (text_tsv)
  where deleted_at is null;

-- HNSW vector index. m=16, ef_construction=64 are sane defaults; revisit at 1M chunk scale.
create index idx_iris_kb_chunks_embedding_hnsw
  on iris_kb_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64)
  where deleted_at is null and embedding is not null;
```

### 3.4 RLS policies

```sql
alter table iris_kb_chunks enable row level security;

-- A user can SELECT a chunk iff:
-- (1) they are a member of the chunk's project, AND
-- (2) the chunk's sensitivity is at or below their effective clearance for that project.
create policy "kb_chunks_select_member_with_clearance"
  on iris_kb_chunks
  for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1
        from project_members pm
        where pm.project_id = iris_kb_chunks.project_id
          and pm.user_id    = auth.uid()
    )
    and (
      sensitivity = 'public_to_project'
      or (sensitivity = 'gc_only'        and is_gc_role(auth.uid(), iris_kb_chunks.project_id))
      or (sensitivity = 'owner_only'     and is_owner_role(auth.uid(), iris_kb_chunks.project_id))
      or (sensitivity = 'finance_only'   and is_finance_role(auth.uid(), iris_kb_chunks.project_id))
    )
  );

-- INSERT/UPDATE/DELETE go through SECURITY DEFINER worker RPCs only.
-- No direct mutation by authenticated users.
create policy "kb_chunks_no_direct_write"
  on iris_kb_chunks
  for all
  to authenticated
  using (false)
  with check (false);
```

The `is_gc_role`, `is_owner_role`, `is_finance_role` helpers are added alongside (or reuse the persona-derived role function from Phase 1's role layer; see ADR-019 stub in `IRIS_NATIVENESS_PLAN`).

### 3.5 `iris_kb_sources` — denormalized ingest tracker

```sql
create table iris_kb_sources (
  source_id            uuid        not null,
  source_type          iris_source_type not null,
  project_id           uuid        not null references projects(id) on delete cascade,
  last_ingested_at     timestamptz null,
  last_ingested_version_hash text  null,
  ingestion_status     text        not null default 'pending'
                        check (ingestion_status in ('pending','running','complete','failed','dlq')),
  error_log            jsonb       not null default '[]'::jsonb,
  attempt_count        int         not null default 0,
  primary key (source_type, source_id)
);

create index idx_iris_kb_sources_project_status
  on iris_kb_sources (project_id, ingestion_status, last_ingested_at);
```

One row per source artifact. The router's first job is to upsert into `iris_kb_sources`; workers update `ingestion_status` and `error_log` as they go. This is how the dashboard answers "how many drawings still need ingesting" without scanning `iris_kb_chunks`.

---

## 4. Ingestion Workers

### 4.1 Pattern (reused from ADR-003)

```
event (insert/update on source table)
   └─> trigger upserts iris_kb_sources row + pgmq.send('iris_ingest_jobs', {source_type, source_id, project_id})
        └─> pg_cron heartbeat (every 1 min in Lap 4) wakes the dispatcher
             └─> dispatcher pulls N jobs, fans out per source_type
                  └─> edge function worker (per type) chunks + embeds + writes iris_kb_chunks
```

The pattern is identical to `scheduled-insights-worker`. Only the queue name (`iris_ingest_jobs`) and the worker bodies differ.

### 4.2 Workers (one per source type, plus catch-all)

| Worker | Source tables | Trigger | Chunking | Embedding | Notes |
|---|---|---|---|---|---|
| `ingest_documents_worker` | `documents` (drawings, specs, submittals, contracts, ASIs, bulletins) | `AFTER INSERT/UPDATE` of file_url | Drawings: per-sheet OCR (Tesseract free tier; Document AI fallback for handwriting), one chunk per sheet+callout (max 1000 tokens, 200 overlap). Specs: chunked by CSI MasterFormat section heading. Contracts/ASIs/bulletins: 1000-token windows with 200-token overlap, semantic split on heading. | `text-embedding-3-large` | Page+region anchors stored in `source_anchor.bbox`. |
| `ingest_daily_logs_worker` | `daily_logs` | `AFTER INSERT/UPDATE` | One chunk per non-empty section (`narrative`, `work_completed`, `safety_notes`, `weather`, `attendees`). Long narratives split at 800 tokens with 100-overlap. | `text-embedding-3-large` | `metadata.section_kind` lets retrieval filter "only safety notes." |
| `ingest_rfis_worker` | `rfis`, `rfi_messages` | `AFTER INSERT/UPDATE` on either | One chunk for question, one for answer, one per comment. | `text-embedding-3-large` | `metadata.message_role` (question/answer/comment) preserved; `metadata.ball_in_court` tag at ingest time. |
| `ingest_photos_worker` | `media_assets` (kind = 'photo') | `AFTER INSERT/UPDATE` | One chunk per photo. `text` = `${caption}\n\n${ocr_text}\n\nEXIF: ${exif_summary}`. | `text-embedding-3-large` | Caption from vision LLM (Sonnet primary, 4o fallback). OCR via Tesseract. EXIF: GPS, time, device, orientation. Caption tagged `metadata.ai_generated = true`; user-correctable. |
| `ingest_conversations_worker` | `email_messages`, `slack_messages`, `meeting_transcripts` | `AFTER INSERT` | One chunk per message; transcripts split per speaker turn (max 1000 tokens). | `text-embedding-3-large` | Phase 3 ships email forwards (`*@projects.sitesync.ai`) and manual paste. Slack + meeting transcript ingestion is Phase 5 scope (worker exists, source tables Phase 5). |
| `ingest_change_orders_worker` | `change_orders`, `change_order_items` | `AFTER INSERT/UPDATE` | One chunk per CO with narrative + reason code; cents preserved as `metadata.amount_cents` (per Sprint Invariant #2 — no LLM math). | `text-embedding-3-large` | `text` is narrative ONLY. Dollar values live in metadata. |
| `ingest_spreadsheets_worker` | `spreadsheet_uploads` (Phase 3 new table) | `AFTER INSERT/UPDATE` | One chunk per named range or per logical block (detected via empty-row heuristic). `metadata.cell_ref` = "Sheet1!A1:C12". | `text-embedding-3-large` | Cell-level anchoring; retrieval can return "the budget table on Sheet 'Q4'". |
| `ingest_unclassified_worker` (catch-all) | `media_assets` (kind = 'document', no type-router match) | `AFTER INSERT` if no specific worker accepted | Generic OCR (Tesseract) + 1000-token windows. `source_type = 'unclassified'`. | `text-embedding-3-large` | **No upload drops on the floor.** A user → AI clarifier asks the user to classify; on classification, source_type changes and re-chunking is triggered. |

### 4.3 Per-worker contract

Each worker (in `supabase/functions/iris-ingest-<type>-worker/`) implements:

```typescript
interface IngestJob {
  source_type: IrisSourceType
  source_id: string
  project_id: string
  attempt: number
  scheduled_for: string
}

interface IngestResult {
  chunks_written: number
  chunks_replaced: number  // diff-aware re-ingest count
  tokens_total: number
  embedding_calls: number
  embedding_tokens: number
  duration_ms: number
}

async function processJob(job: IngestJob): Promise<IngestResult> {
  // 1. Compute source_version_hash. If unchanged from iris_kb_sources.last_ingested_version_hash → ack & return.
  // 2. Load source + extract text (OCR, parser, etc.).
  // 3. Chunk per the type's chunking strategy.
  // 4. Diff against existing chunks for this (source_id, source_type): which are unchanged, which are new, which are gone.
  // 5. Tombstone removed chunks (deleted_at = now()), insert new chunks (ingest_status='pending').
  // 6. Batch-embed pending chunks (OpenAI batch up to 2048 tokens/req, max 100 reqs concurrent).
  // 7. UPDATE chunks with embedding + ingest_status='embedded'.
  // 8. Update iris_kb_sources: last_ingested_at, last_ingested_version_hash, ingestion_status='complete'.
  // 9. Emit telemetry (see §10).
}
```

### 4.4 Error handling and DLQ

- Embedding API rate-limit → exponential backoff (1s, 2s, 4s, 8s, 16s); after 5 retries → DLQ.
- Worker poison message (parse error, malformed source) → DLQ after attempt > 3.
- DLQ table: `iris_ingest_dlq` (mirrors `scheduled_insights_log` pattern). Walker's daily standup feed surfaces DLQ counts.
- Source row deleted between enqueue and process → worker treats as a tombstone trigger: marks all `iris_kb_chunks` for that source `deleted_at = NOW()`, `ingest_status = 'tombstoned'`. Retrieval excludes within 60s.
- Source row updated mid-ingest (race) → worker writes against the version hash it computed at job start; if a fresher version exists, the next enqueued job re-runs (idempotent on hash).

### 4.5 Triggers (per source table)

```sql
-- Example: drawings
create or replace function enqueue_iris_ingest_for_document()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into iris_kb_sources (source_id, source_type, project_id, ingestion_status)
    values (new.id,
            case new.kind
              when 'drawing'   then 'drawing'::iris_source_type
              when 'spec'      then 'spec_section'::iris_source_type
              when 'contract'  then 'contract'::iris_source_type
              when 'asi'       then 'asi'::iris_source_type
              when 'bulletin'  then 'bulletin'::iris_source_type
              when 'submittal' then 'submittal'::iris_source_type
              else 'unclassified'::iris_source_type
            end,
            new.project_id,
            'pending')
    on conflict (source_type, source_id) do update
      set ingestion_status = 'pending',
          last_ingested_at = null;

  perform pgmq.send('iris_ingest_jobs',
    jsonb_build_object(
      'source_type', new.kind,
      'source_id',   new.id,
      'project_id',  new.project_id,
      'attempt',     1
    ));
  return new;
end;
$$;

create trigger trg_documents_enqueue_iris
  after insert or update of file_url, kind on documents
  for each row execute procedure enqueue_iris_ingest_for_document();
```

One trigger per source table (drawings via `documents`, daily_logs, rfis, rfi_messages, media_assets, change_orders, spreadsheet_uploads). The pattern repeats; the migration file lists all of them.

---

## 5. Retrieval API

### 5.1 Module: `src/services/iris/retrieve.ts`

The single retrieval entrypoint. Phase 1's `IrisContext` is the input; chunks are the output. No ad-hoc table queries from feature code allowed in Phase 4+.

```typescript
import type { IrisContext } from './contextFabric'

export type SourceTypeFilter = IrisSourceType | IrisSourceType[]

export interface RetrieveOptions {
  k: number
  filters?: {
    source_types?: SourceTypeFilter
    areas?: string[]
    date_range?: { from?: string; to?: string }
    freshness_bias?: 'off' | 'soft' | 'hard'  // default 'soft'
    sensitivity_max?: IrisSensitivity         // default = caller's clearance
  }
  hybrid?: boolean   // default true; combines vector + BM25
  cache?: boolean    // default true (5-min TTL)
}

export interface RetrievedChunk {
  chunk_id: string
  source_type: IrisSourceType
  source_id: string
  source_anchor: Record<string, unknown>
  project_id: string
  area_id: string | null
  text: string
  metadata: Record<string, unknown>
  similarity: number     // raw cosine
  bm25_score: number     // raw lexical
  blended_score: number  // hybrid, freshness-adjusted
  citation_kind: CitationKind  // mapped per §6
}

export async function retrieve(
  query: string,
  ctx: IrisContext,
  opts: RetrieveOptions
): Promise<RetrievedChunk[]>
```

### 5.2 Permission scope

`retrieve` runs through a SECURITY DEFINER RPC `kb_retrieve` that explicitly joins `project_members` and re-asserts the sensitivity clearance. RLS is the wall; `kb_retrieve` is a belt over the wall — defense-in-depth per ADR-006.

```sql
create or replace function kb_retrieve(
  p_query_embedding vector(1536),
  p_query_text       text,
  p_project_ids      uuid[],
  p_source_types     iris_source_type[] default null,
  p_area_ids         uuid[]              default null,
  p_from_date        timestamptz         default null,
  p_to_date          timestamptz         default null,
  p_sensitivity_max  iris_sensitivity    default 'public_to_project',
  p_k               int                  default 12,
  p_freshness_half_life_days numeric     default 30
) returns table (
  chunk_id uuid, source_type iris_source_type, source_id uuid,
  source_anchor jsonb, project_id uuid, area_id uuid,
  text text, metadata jsonb, similarity real, bm25_score real, blended_score real
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Auth required'; end if;

  return query
  with scope as (
    select c.*
      from iris_kb_chunks c
      join project_members pm on pm.project_id = c.project_id and pm.user_id = v_user
     where c.deleted_at is null
       and c.embedding is not null
       and c.project_id = any (p_project_ids)
       and (p_source_types is null or c.source_type = any(p_source_types))
       and (p_area_ids     is null or c.area_id     = any(p_area_ids))
       and (p_from_date    is null or c.created_at >= p_from_date)
       and (p_to_date      is null or c.created_at <= p_to_date)
       and sensitivity_at_or_below(c.sensitivity, p_sensitivity_max, v_user, c.project_id)
  ),
  vec as (
    select s.*, 1 - (s.embedding <=> p_query_embedding) as similarity
      from scope s
      order by s.embedding <=> p_query_embedding
      limit greatest(p_k * 4, 32)
  ),
  lex as (
    select s.*, ts_rank_cd(s.text_tsv, plainto_tsquery('english', p_query_text)) as bm25_score
      from scope s
      where s.text_tsv @@ plainto_tsquery('english', p_query_text)
      order by bm25_score desc
      limit greatest(p_k * 4, 32)
  ),
  blended as (
    select coalesce(v.chunk_id, l.chunk_id)               as chunk_id,
           coalesce(v.source_type, l.source_type)         as source_type,
           coalesce(v.source_id,   l.source_id)           as source_id,
           coalesce(v.source_anchor, l.source_anchor)     as source_anchor,
           coalesce(v.project_id,  l.project_id)          as project_id,
           coalesce(v.area_id,     l.area_id)             as area_id,
           coalesce(v.text,        l.text)                as text,
           coalesce(v.metadata,    l.metadata)            as metadata,
           coalesce(v.similarity,  0)::real               as similarity,
           coalesce(l.bm25_score,  0)::real               as bm25_score,
           coalesce(v.created_at,  l.created_at)          as created_at
      from vec v full outer join lex l using (chunk_id)
  )
  select chunk_id, source_type, source_id, source_anchor, project_id, area_id, text, metadata,
         similarity, bm25_score,
         (
           (0.7 * similarity + 0.3 * least(bm25_score, 1.0))
           * exp(- extract(epoch from (now() - created_at)) / (p_freshness_half_life_days * 86400))
         )::real as blended_score
    from blended
    order by blended_score desc
    limit p_k;
end;
$$;
```

### 5.3 Cache layer

5-minute TTL on `(query_hash, ctx_hash, options_hash) → top-k chunk_ids`. Cache lives in Redis (already provisioned for the staging env per the Reliability ADR) or in `iris_retrieve_cache` Postgres table for environments without Redis. Invalidation: a write to `iris_kb_chunks` for any project in the cache key flushes the matching entries. Phase 3 ships the Postgres-table fallback; Redis is a Phase 4 perf upgrade if latency demands it.

### 5.4 What Phase 3 deliberately does NOT do

- **No LLM rerank.** Phase 3's blend is deterministic (vector + BM25 + freshness). LLM rerank is a Phase 4 perf-vs-quality decision and tunable behind a feature flag.
- **No cross-project retrieval.** Phase 3 enforces single-tenant scoping. Cross-project memory is Phase 6 (firm playbook) and gated by ADR-021.
- **No multi-modal embedding.** Photos are text-only-embedded in Phase 3 (caption + OCR + EXIF). True image embeddings (CLIP class) are Phase 5 scope.

---

## 6. Citation Production

Every retrieved chunk produces a citation per `IRIS_CITATIONS_SPEC`. The `source_type → citation_kind` map:

| `source_type` | `citation_kind` | Resolver consumes |
|---|---|---|
| `drawing` | `drawing_coordinate` | `source_anchor.sheet_id`, `bbox` |
| `spec_section` | `spec_reference` | `source_anchor.csi_section`, `paragraph_no` |
| `submittal` | `submittal_reference` (existing) | `source_id` |
| `rfi` | `rfi_reference` | `source_id` + `metadata.message_role` |
| `daily_log` | `daily_log_excerpt` | `source_id` + `source_anchor.line_range` |
| `photo` | `photo_observation` | `source_id` + `source_anchor.bbox` |
| `change_order` | `change_order` | `source_id` |
| `contract` / `asi` / `bulletin` | `spec_reference` (extended) | `source_id` + `source_anchor` |
| `spreadsheet` | **new: `spreadsheet_cell`** | `source_id` + `source_anchor.cell_ref` |
| `conversation` | **new: `conversation_anchor` (Phase 5)** | `source_id` + `source_anchor.message_id` |
| `unclassified` | `document_excerpt` (new — generic) | `source_id` + `source_anchor` |

Two new citation kinds (`spreadsheet_cell`, `conversation_anchor`) require side-panel components in `src/components/iris/citations/`. `spreadsheet_cell` ships in Phase 3; `conversation_anchor` ships in Phase 5 alongside the conversation worker's GA.

---

## 7. Embedding Model Decision (ADR-017)

### 7.1 Recommendation

**OpenAI `text-embedding-3-large` (1536 dim) for Phase 3.** Revisit at Phase 7 for cost/latency.

### 7.2 Cost math at scale

Assumptions (Nexus-class 12-month project, projected at Lap 6 footprint):

- Drawings: 800 sheets × 4 callouts/sheet × 800 tokens/chunk = **2.56M tokens**
- Specs: 1.2k CSI sections × 1.5k tokens avg = **1.8M tokens**
- Daily logs: 365 logs × 8 paragraphs × 250 tokens = **730K tokens**
- RFIs: 6k entries × 2 chunks × 400 tokens = **4.8M tokens**
- Photos: 4k photos × 200 tokens (caption + OCR + EXIF) = **800K tokens**
- Conversations: 20k messages × 150 tokens = **3M tokens**
- Change orders / contracts / spreadsheets: ~**1M tokens**

**Per-project initial backfill:** ≈ **14.7M tokens**.
**OpenAI `text-embedding-3-large` price:** $0.13 / 1M tokens.
**Backfill cost:** 14.7 × $0.13 = **$1.91 one-time**.
**Steady-state delta (re-embed on update + new artifacts):** ≈ 12M tokens/project/year = **$1.56/project/year ≈ $0.13/project/month**.

The "$1.50/project/month" placeholder in `IRIS_NATIVENESS_PLAN` is conservative — actual is closer to **$0.15/project/month** at projected volumes. Even at 10× the projected volumes (worst-case enterprise GC with high-frequency conversation ingest), embedding cost is < **$2/project/month**.

### 7.3 Alternatives considered (deferred to Phase 7 review)

- **Voyage AI `voyage-3-large`** — competitive recall, cheaper, but adds a vendor.
- **Cohere `embed-english-v3.0`** — solid recall, more expensive than OpenAI at this point.
- **BAAI `bge-large-en-v1.5` (self-hosted)** — eliminates per-token cost but adds GPU infrastructure (~$2k/month minimum, not justified until ≥ 1000 active projects).

### 7.4 Backfill plan if model changes

Every chunk row stores `embedding_model_version`. A model change triggers:

1. New `embedding_model_version` constant deployed to workers.
2. Offline re-embed worker (`reembed_kb_chunks_worker`) walks chunks where `embedding_model_version != current`, re-embeds, atomically swaps embedding + version.
3. Retrieval rejects rows where `embedding_model_version != current` until re-embedded (configurable).
4. Re-embed ETA: ~14.7M tokens / project at OpenAI batch tier ≈ 12 minutes wall-clock per project.

### 7.5 ADR-017 status

Drafted alongside this spec. Ratified at Lap 4 Day 1 by Walker + Engineer #2 in writing. Lives at `docs/audits/ADR_017_EMBEDDING_MODEL_2026-10-01.md` (file created at phase open).

---

## 8. Eval Harness

### 8.1 Goldens corpus

100 question goldens authored by Walker + Brad Cameron (Nexus pilot PM) at Phase 3 kickoff. Distribution:

| Source type coverage | Count |
|---|---:|
| Drawing-anchored ("where's the curtain wall detail?") | 15 |
| Spec-anchored ("what's the spec section for concrete tolerance?") | 15 |
| RFI-anchored ("which RFI was answered last week about lobby ceiling?") | 15 |
| Daily-log-anchored ("did anyone note the rebar issue on 2026-09-12?") | 10 |
| Photo-anchored ("show photos of the 4th-floor mechanical room") | 10 |
| Submittal/CO/contract-anchored | 15 |
| Conversation-anchored (Phase 3 = email forwards only) | 10 |
| Spreadsheet-anchored | 5 |
| Cross-source ("what was the cause of the 8/14 delay?" — needs RFI + log + photo) | 5 |
| **Total** | **100** |

Each golden = `{ id, query, expected_chunk_ids: string[], persona: 'pm'|'super'|'foreman'|'owner_rep'|'office', notes }`.

### 8.2 Metrics

- `recall@5` = (# goldens where ≥ 1 expected chunk in top-5) / 100. **Gate: ≥ 0.85.**
- `precision@5` = (# top-5 chunks that are in expected set) / (5 × 100). **Gate: ≥ 0.70.**
- `mrr@10` (mean reciprocal rank): for trend monitoring; not gated.
- `latency_p95`: end-to-end `retrieve()` call. **Gate: ≤ 800 ms** (excluding the embedding call for the query, which is cached per-query).

### 8.3 Permission tests (50 cases)

50-case matrix in `tests/iris/retrieval/rls.spec.ts`:

| Case bucket | Count | Example |
|---|---:|---|
| Cross-tenant: user from project A queries → must return zero rows from project B | 15 | "owner_rep at Project A queries 'curtain wall'; result has no Project B chunks." |
| Cross-role within tenant: sub queries → cannot see `owner_only` or `finance_only` | 15 | "Subcontractor at Project A queries 'budget'; result excludes finance_only chunks." |
| Sensitivity escalation attempt: malformed `sensitivity_max` → defaults to caller's clearance, never higher | 10 | "PM passes `sensitivity_max='owner_only'` while owner_only role missing; RPC clamps." |
| Soft-delete leakage: tombstoned chunks → never returned | 5 | "Chunk for deleted RFI; retrieve must not return." |
| Embedding leakage: query vector from outside-tenant content scored against target tenant must score 0 retrievable | 5 | "Compute embedding from Project B's RFI #123; query Project A as user-of-A; expected chunks count = 0." |

**Gate: 50/50 pass. Zero tolerance.**

### 8.4 Embedding leakage suite (mathematical, not just behavioral)

For each pair of tenants `(A, B)`, sample 100 random chunks from B; compute their embeddings; query A's KB with each; assert that:

- No chunk from B appears in A's result set (RLS check).
- The top-1 similarity score from A's set is **uncorrelated** with the B-chunk content (Pearson r between (B chunk i text length) and (top-1 score from A) ≤ 0.05).

This catches the class of bug where RLS works but the index "leaks" by ranking via shared embedding vocabulary.

---

## 9. Migration Plan

### 9.1 Migration files

```
supabase/migrations/20261008000000_iris_kb_chunks.sql           -- table, indexes, RLS, enums
supabase/migrations/20261008000001_iris_kb_sources.sql          -- ingest tracker
supabase/migrations/20261008000002_iris_kb_retrieve_rpc.sql     -- kb_retrieve + helpers
supabase/migrations/20261008000003_iris_ingest_queue.sql        -- pgmq queue + dispatcher cron
supabase/migrations/20261008000004_iris_ingest_triggers.sql     -- per-source-table enqueue triggers
supabase/migrations/20261008000005_iris_kb_dlq.sql              -- DLQ + alerting
supabase/migrations/20261008000006_iris_kb_telemetry.sql        -- per-worker counters + matview
```

Apply in order. Each migration is idempotent (`CREATE ... IF NOT EXISTS`, `DROP ... IF EXISTS` patterns).

### 9.2 Backfill

One paginated backfill worker per source type. Checkpoint table `iris_kb_backfill_checkpoint` tracks `(source_type, project_id, last_source_id_processed)`.

Burst rate cap: max **500 chunks/minute/project** (≈ 6k tokens/sec embedding, well within OpenAI tier limits). At 14.7M tokens/project, full historical backfill ≈ **40–60 minutes/project** at burst; ~**1 hour** with safety margin.

Per-org strategy (in priority order):
1. Soft-pilot orgs (`is_soft_pilot = TRUE`) — backfilled Day 22–23 of Lap 4.
2. All other active orgs — backfilled Day 24–28.
3. Closed/archived projects — backfilled async over Lap 5 (no time pressure).

### 9.3 `database.ts` regeneration

Per Sprint Invariant #1: `npm run db-types:write` after migration applies; commit regenerated `src/types/database.ts` in the same PR. CI's `db-types:check` blocks merge if drift.

### 9.4 Rollback

If backfill or eval gate fails:
- Revert migrations 04, 05, 06 (workers/triggers/DLQ) — disables ingestion.
- Leave migrations 00, 01, 02 (table + RPC) — chunks remain queryable but stale.
- Investigate; re-enable workers after fix.

Full rollback (drop the table) requires explicit Walker sign-off because it loses backfilled chunks.

---

## 10. Telemetry (per ADR-008)

### 10.1 Counters

Every worker emits these to `iris_kb_telemetry` (one row per job):

```sql
create table iris_kb_telemetry (
  job_id            uuid primary key default gen_random_uuid(),
  source_type       iris_source_type not null,
  project_id        uuid not null,
  attempt           int not null,
  status            text not null,  -- 'success' | 'failed' | 'dlq'
  chunks_written    int not null default 0,
  chunks_replaced   int not null default 0,
  chunks_tombstoned int not null default 0,
  tokens_total      int not null default 0,
  embedding_calls   int not null default 0,
  embedding_cost_usd numeric(10,6) not null default 0,
  duration_ms       int not null default 0,
  enqueued_at       timestamptz not null,
  started_at        timestamptz,
  finished_at       timestamptz,
  error             text
);

create index idx_iris_kb_telemetry_proj_type_time
  on iris_kb_telemetry (project_id, source_type, finished_at desc);
```

### 10.2 Aggregated metrics (matview)

```sql
create materialized view iris_kb_health_daily as
select
  date_trunc('day', finished_at)        as day,
  source_type,
  count(*) filter (where status='success')                                      as jobs_succeeded,
  count(*) filter (where status='failed' or status='dlq')                       as jobs_failed,
  sum(chunks_written)                                                           as chunks_ingested_total,
  sum(embedding_cost_usd)                                                       as cost_usd,
  percentile_cont(0.95) within group (order by extract(epoch from (finished_at - enqueued_at)))
                                                                                as lag_seconds_p95,
  percentile_cont(0.95) within group (order by duration_ms)                     as duration_ms_p95
from iris_kb_telemetry
where finished_at is not null
group by 1, 2;
```

### 10.3 Retrieval-side metrics

Logged from `kb_retrieve` RPC into `iris_retrieve_log`:

- `retrieval_latency_p95` (per persona, per source-type filter)
- `retrieval_recall_at_5` (computed nightly against goldens)
- `cache_hit_rate`
- `deletion_propagation_lag` (time from source soft-delete to chunk tombstone seen at retrieval)

### 10.4 Dashboards (Walker's standup feed)

Two new sections in the existing daily standup digest:

- **Per-source-type ingest health**: jobs/day, lag p95, DLQ count, cost.
- **Retrieval quality**: recall@5 trend, latency p95, RLS test status (last nightly run).

### 10.5 Retention

- Telemetry rows: **12 months default** (per ADR-008). 24 months for `is_soft_pilot = TRUE` projects, then anonymized (drop `ingested_by`, keep aggregate counters).
- Retrieve log rows: same retention; anonymization drops `auth.uid()` reference and retains the (anonymized) query hash.

---

## 11. Test Plan

### 11.1 Unit (Vitest)

- Per-source chunker: drawings (PDF fixture → expected sheet+bbox chunks), specs (CSI fixture → section chunks), daily logs, RFIs, photos (caption+OCR+EXIF stub), spreadsheets (XLSX fixture → cell-range chunks), conversations.
- Embedding call wrapper: mock OpenAI; verify retry-with-backoff on 429.
- Diff-aware re-ingest: given an old set of chunks + new source content, verify exactly which chunks tombstone, which insert, which stay.

### 11.2 Integration (Postgres)

- Trigger fires on source insert → pgmq message lands → worker processes → chunks written → retrieval returns them.
- Tombstone propagation: source DELETE → chunks marked `deleted_at` within 60s → retrieval excludes.
- Source UPDATE with content change → version hash changes → re-ingest triggers; unchanged chunks not re-embedded (cost gate).
- `kb_retrieve` RPC: verify hybrid blend; verify freshness decay; verify RLS scoping.

### 11.3 RLS suite

The 50-case matrix from §8.3. Runs on every PR via `tests/iris/retrieval/rls.spec.ts`.

### 11.4 Embedding leakage suite

The 100-pair Pearson-correlation test from §8.4. Runs nightly; results posted to standup feed.

### 11.5 Load test

Synthetic 10K-chunk project; backfill worker target ≤ 60 min wall-clock; retrieval p95 ≤ 800 ms at 50 concurrent queries.

### 11.6 E2E (Playwright)

- Upload a drawing → wait 5 min → query "drawing" via Iris chat → side panel opens with the drawing-coordinate citation.
- Upload a CSV → query a cell value via Iris → side panel shows the cell.
- File a daily log → wait 5 min → query the log content; recent log appears top-1.

---

## 12. Failure Modes

| # | Mode | Detection | Mitigation |
|---|---|---|---|
| 1 | Worker stuck (poison message) | DLQ row appears | Alert via Walker's standup feed; manual triage; auto-DLQ after attempt > 3 |
| 2 | Embedding API rate limit | 429 from OpenAI | Exponential backoff (1, 2, 4, 8, 16s); DLQ after 5 retries; per-project token budget enforced |
| 3 | Source row deleted | Trigger fires `iris_kb_chunks` tombstone | All chunks for source set `deleted_at = now()` within 60s; retrieval excludes by RLS predicate |
| 4 | Source row updated | New `source_version_hash` mismatches | Diff-aware re-embed; only changed chunks call OpenAI; unchanged chunks stay (cost gate) |
| 5 | Vision LLM hallucinated caption | User flags caption | Caption rendered with "AI-generated" badge; user-correctable via inline edit; correction stored in `metadata.user_caption`; future retrieval prefers user_caption when present |
| 6 | pgvector HNSW build OOMs at scale | Migration fails or query times out at >10M chunks | Drop & rebuild HNSW with reduced `m`/`ef_construction`; or shard by project_id; or upgrade Postgres tier (Lap 5 contingency) |
| 7 | RLS bypass via similarity inference | Embedding leakage suite fails | Block deploy; forensic: compare distance distributions; tighten `kb_retrieve` filter order |
| 8 | Backfill exceeds token budget | Daily cost telemetry > $5/project alert | Pause backfill; investigate; resume with per-project rate cap |
| 9 | Catch-all worker accepts something it shouldn't have (e.g. an RFI typed as `unclassified`) | Iris clarifier UI nudges user to classify | On classify, re-trigger the proper worker; old `unclassified` chunks are tombstoned automatically |
| 10 | Conversation ingest receives spam (forwarded marketing email) | Heuristic filter (`from`, content score) | Drop pre-ingest; logged to `iris_ingest_dropped` for audit |

---

## 13. Acceptance Gate

The Phase 3 acceptance gate (CI workflow at `.github/workflows/phase-3-acceptance.yml`, modeled on `lap-2-acceptance.yml`) is green when **all** of the following hold:

1. **Latency:** All 5+ source types ingesting end-to-end (source insert → chunk queryable) in **< 5 min** at p95.
2. **Recall:** `recall@5 ≥ 0.85` on the 100-Q goldens corpus.
3. **Precision:** `precision@5 ≥ 0.70`.
4. **RLS:** All 50 RLS test cases pass — **100%**.
5. **Leakage:** Embedding leakage suite passes — **100% (zero cross-tenant retrievals; Pearson r ≤ 0.05)**.
6. **Coverage:** Soft-pilot data (Nexus + Carleton) fully indexed; verified by spot-check of 20 random source artifacts.
7. **Telemetry:** `iris_kb_health_daily` matview returns non-empty rows for all 8 source types over a 7-day window.
8. **Cost:** Per-project embedding cost ≤ $2/project/month at projected pilot volume.

Phase 3 closes when this gate goes green and Walker signs the receipt at `docs/audits/PHASE_3_KNOWLEDGE_ABSORPTION_RECEIPT_2026-11-XX.md`.

---

## 14. Cross-References

### Depends on (must be shipped before Phase 3 opens)

- **Phase 1 (Context Fabric):** `IrisContext` is the input to `retrieve()`. Without persona + permission scope, retrieval is unbounded.
- **Phase 2 (Specialists):** specialists call `retrieve()` to ground their reasoning. Phase 3 doesn't ship specialists; it ships the API specialists already use.
- **Phase 0 (Citations):** citation kinds, side-panel host, snippet verification — Phase 3 produces the chunks the existing 8-kind citation system resolves; adds 2 new kinds.

### Inputs to (depends on Phase 3)

- **Phase 4 (Per-page insights):** every per-page Insight Slot generator queries the KB.
- **Phase 5 (Multi-modal):** photo + voice ingestion deepens — true image embeddings, audio anchors. Same table; same RLS; new `source_type` enum values + new chunkers.
- **Phase 6 (Firm memory):** cross-project pattern detection runs **on top of** the KB after anonymization (ADR-021).

### ADRs

- **Created:** ADR-017 (embedding model). Ratified Lap 4 Day 1. ADR-021 (cross-project anonymization) drafted now, ratified at Phase 6.
- **Companion to:** ADR-008 (telemetry retention), ADR-006 (pilot RLS multi-tenancy), ADR-003 (pg_cron + pgmq + edge fn), ADR-018 (specialist sub-agent boundary).

### Reuses

- pg_cron + pgmq + edge function pattern (ADR-003).
- Citation routing table (`src/lib/iris/citationRouting.ts`).
- `record_*_view`/`record_*_decision` telemetry pattern from `IRIS_TELEMETRY_SPEC`.
- Soft-pilot RLS scope from ADR-006.

---

## 15. Sub-Spec Link

Detailed artifact-by-artifact catalog (per source type: file formats, parser libs, OCR fallbacks, chunking heuristics, metadata fields) lives in:

- **`docs/audits/INGESTION_TAXONOMY_SPEC_2026-05-08.md`** (companion; authored at Phase 3 open).

That spec is the implementation playbook; this spec is the architecture contract.

---

## 16. Day-by-Day Breakdown (~30 days, Lap 4)

| Day | Date (target) | Deliverable | Owner | Exit signal |
|---:|---|---|---|---|
| 1 | 2026-10-08 | ADR-017 ratified; migrations 00–02 applied to staging | Walker + E2 | `iris_kb_chunks` table exists; RPC compiles |
| 2 | 2026-10-09 | Migration 03 (queue) + dispatcher cron live in staging | E2 | pgmq queue receives test message |
| 3 | 2026-10-10 | `ingest_documents_worker` skeleton; spec-section chunker | E2 | One spec PDF chunked + embedded |
| 4 | 2026-10-11 | Drawing OCR + sheet/bbox chunker | E2 | One drawing PDF chunked with bbox anchors |
| 5 | 2026-10-12 | `ingest_daily_logs_worker` complete | E2 | Daily log chunks indexed |
| 6 | 2026-10-13 | `ingest_rfis_worker` complete | E2 | RFI question/answer/comments chunked |
| 7 | 2026-10-14 | `ingest_photos_worker` (caption + OCR + EXIF) | E2 | Photo chunks queryable |
| 8 | 2026-10-15 | `ingest_change_orders_worker` + `ingest_spreadsheets_worker` | E2 | CO + spreadsheet chunks |
| 9 | 2026-10-16 | `ingest_conversations_worker` (email forwards only) | E2 | Email forwards land in `email_messages` and chunk |
| 10 | 2026-10-17 | `ingest_unclassified_worker` (catch-all) | E2 | Unknown upload still chunks |
| 11 | 2026-10-18 | Triggers (migration 04) for all source tables | E2 | End-to-end: insert → chunk in <5 min |
| 12 | 2026-10-19 | DLQ + retry/backoff + telemetry rows | E2 | DLQ visible in standup |
| 13 | 2026-10-20 | `kb_retrieve` RPC + hybrid blend + freshness decay | E2 + Walker | RPC returns top-k for sample queries |
| 14 | 2026-10-21 | `src/services/iris/retrieve.ts` + Phase 1 `IrisContext` integration | Walker | Existing specialists pull from KB |
| 15 | 2026-10-22 | Goldens corpus authored (100 Q) | Walker + Brad | Goldens file committed |
| 16 | 2026-10-23 | Eval harness wired; first recall@5 measurement | Walker | Baseline recall reported |
| 17 | 2026-10-24 | Iterate chunking strategies; tune k, freshness half-life, blend weights | E2 + Walker | recall@5 ≥ 0.80 |
| 18 | 2026-10-25 | RLS test matrix (50 cases) authored + run | E2 | All 50 pass |
| 19 | 2026-10-26 | Embedding leakage suite | Walker | All 100 pairs pass |
| 20 | 2026-10-27 | Citation map: spreadsheet_cell side-panel component | Walker | New citation kind renders |
| 21 | 2026-10-28 | Retrieval cache layer (Postgres-backed) | E2 | Cache hit rate measured |
| 22 | 2026-10-29 | Backfill worker; soft-pilot orgs backfilled | E2 | Pilot KB ≥ 80% indexed |
| 23 | 2026-10-30 | All other active orgs backfilled | E2 | Backfill complete |
| 24 | 2026-10-31 | Telemetry matview + Walker standup feed sections | Walker | Daily ingest dashboard live |
| 25 | 2026-11-01 | Load test (10K-chunk synthetic project) | E2 | Backfill ≤ 60 min; retrieval p95 ≤ 800 ms |
| 26 | 2026-11-02 | E2E Playwright suite | Walker | All E2E green |
| 27 | 2026-11-03 | Acceptance-gate CI workflow `phase-3-acceptance.yml` | Walker | Workflow green on staging |
| 28 | 2026-11-04 | Phase 3 acceptance receipt | Walker | Receipt + tracker row updated |
| 29 | 2026-11-05 | Buffer / triage day | E2 + Walker | Open issues triaged |
| 30 | 2026-11-06 | Phase 4 kickoff prep | Walker | Per-page coverage spec opened |

E2 = Engineer #2 (must be onboarded before Day 1 per `IRIS_NATIVENESS_PLAN` § Risks #7).

---

## 17. Risks Specific to Phase 3

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **HNSW index size on photo OCR + conversation blows past Postgres tier limits** | Medium | Migration fails at scale; backfill stalls | Plan Postgres tier upgrade contingency; sharded HNSW (one index per project) is the fallback |
| 2 | **Ingestion lag during high-volume daily log periods (50+ logs/day across pilot)** | Medium | "Just-uploaded" chunk doesn't appear in retrieval for >5 min; trust hit | Per-source worker concurrency tunable; alert on backlog > 5 min; rate-limit non-pilot orgs to keep pilot at head of queue |
| 3 | **RLS on vector retrieval is non-obvious; subtle index-scan bug leaks cross-tenant** | High | Privacy incident; pilot trust evaporated | Defense-in-depth: RLS policy + SECURITY DEFINER RPC + leakage suite; two-engineer review on every retrieval RPC change |
| 4 | **Vision LLM caption cost overrun on photo backfill (8K photos × $0.01 = $80/project on backfill)** | Medium | Embedding budget blown | Cap photo backfill at 500 photos/day/project; user can flag "skip caption" for low-value photos; cache caption per content hash |
| 5 | **OCR quality on scanned drawings is below 70%** | Medium | Drawing-anchored citations are wrong location | Tesseract is tier-1; Document AI fallback for low-confidence pages; user can manually redo OCR per sheet |
| 6 | **Embedding model deprecated mid-pilot** | Low | Re-embed required across whole KB | Re-embed worker (§7.4) is the contract; deprecation doesn't break retrieval, just degrades freshness during re-embed window |
| 7 | **Catch-all worker over-classifies (everything ends up `unclassified`)** | Low–Medium | Type-specific chunking lost | Type-router has explicit MIME + filename heuristics; `unclassified` is the last resort, telemetry flags ratio > 5% |
| 8 | **Spreadsheet ingestion misreads complex multi-table sheets** | Medium | Cell-anchor citations point to wrong cells | Empty-row block detection + named-range detection; user can manually re-anchor; v0 documents the limitation |
| 9 | **Conversation worker pulls in PII (forwarded personal email)** | Medium | Privacy/compliance issue | Pre-ingest filter: domain allowlist for projects; PII scrubber pass; user can mark a thread "personal" → tombstoned |
| 10 | **Cost telemetry undercounts because OpenAI billing lags** | Low | Walker discovers $X overrun a week late | Per-job cost computed from token count × posted rate; reconcile weekly with OpenAI dashboard |

---

## 18. Footer — What to Do With This Doc

1. **At Phase 3 open (~2026-10-08):** ratify ADR-017 in writing. Open the companion `INGESTION_TAXONOMY_SPEC_2026-05-08.md` with parser-library and OCR-fallback choices per source type.
2. **At Phase 3 close (~2026-11-04):** drop a `PHASE_3_KNOWLEDGE_ABSORPTION_RECEIPT_2026-11-04.md` summarizing what shipped, recall@5 actual, RLS pass count, cost actual, and what's next (Phase 4: per-page coverage).
3. **Cross-spec sync:** when this spec updates, re-check `IRIS_NATIVENESS_PLAN_2026-05-08.md` § 7 (Phase 3 detail) for drift.
4. **Index entry:** add to `docs/audits/INDEX.md` under "Phase Specs" alongside the existing `PHASE_3_UNIVERSAL_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md` (the two specs are complementary — the existing one is implementation-detail; this one is architecture-contract).
5. **Tracker:** add a `Lap 4 — Universal Absorption` sheet to `SiteSync_90_Day_Tracker.xlsx` with the 30 day-rows from §16 at phase open.

---

*End of spec. The promise: no piece of information is not absorbed. Phase 3 is where that promise becomes a row count, a recall number, and a citation that resolves.*
