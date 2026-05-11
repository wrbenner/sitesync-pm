# ADR-017 — Embedding Model for IRIS Knowledge Base

**Date:** 2026-05-08
**Status:** Accepted (in advance of Phase 3 open)
**Decider:** Walker
**Related:** `IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md`, `INGESTION_TAXONOMY_SPEC_2026-05-08.md`, `IRIS_NATIVENESS_PLAN_2026-05-08.md`, `ADR_008_TELEMETRY_RETENTION_2026-05-04.md`

---

## Decision

Phase 3 ships with **OpenAI `text-embedding-3-large` (1536 dimensions)** as the embedding model for `iris_kb_chunks`. Every chunk row stores `embedding_model_version` so future migrations are non-destructive. The model decision is revisited at Phase 7 open (Lap 7, ~May 2027) for cost / latency / sovereignty.

---

## Why text-embedding-3-large for Phase 3

Five candidates were evaluated:

| Model | Dim | Per-1M tokens | Quality (MTEB avg) | Hosting | Sovereignty |
|---|---|---|---|---|---|
| **OpenAI text-embedding-3-large** ✅ | 1536 (or 3072) | $0.13 | 64.6 | API | OpenAI |
| OpenAI text-embedding-3-small | 1536 | $0.02 | 62.3 | API | OpenAI |
| Voyage voyage-3 | 1024 | $0.06 | 63.0 | API | Voyage |
| Cohere embed-v3.0 | 1024 | $0.10 | 64.0 | API | Cohere |
| BAAI bge-large-en-v1.5 | 1024 | self-hosted | 64.2 | Self-host | Us |

**Why OpenAI 3-large wins for Phase 3:**

1. **Quality envelope is good enough that we never have to second-guess the model in Phase 3.** Construction documents are unusually long-tailed (CSI MasterFormat phrasing, jobsite slang, mixed text/diagram). 3-large's MTEB head-room buys us margin against jobsite noise. Saving $0.04/1M tokens is irrelevant against the cost of a bad retrieval at pilot.
2. **Operational simplicity.** Phase 3 is the missing-pillar quarter — we are not also debugging a self-hosted GPU pool. Defer self-hosting to Phase 7 when cost matters at scale and the platform is stable.
3. **Dimension flexibility.** 3-large supports 256 / 1024 / 1536 / 3072 via Matryoshka truncation. We start at 1536 (HNSW sweet spot for pgvector at our scale), retain the option to truncate down for cost or expand to 3072 for quality without re-embedding.
4. **Existing OpenAI relationship.** We already pay OpenAI for caption/Whisper/Sonnet via the IRIS surface. One vendor relationship is one less thing for the Phase-3 spike to catch on.

**Why not text-embedding-3-small:** The 2.3-pt MTEB delta on long-tail retrievals matters more than the 6× cost difference at our volumes (see cost math below). Construction-domain terminology recall@5 in our pilot eval gap was 0.72 (3-small) vs 0.86 (3-large) on a 50-Q internal goldens — significant.

**Why not self-hosted bge:** Quality is comparable, but we own a GPU box, monitoring, redundancy, and on-call for it. Saving $50/month at pilot scale and adding a critical-path failure surface is a bad trade. Revisit at Phase 7.

---

## Cost math at projected pilot volume

Phase 3 ingestion volume estimate (Nexus + Carleton pilot, 2 active projects):

| Source | Avg/day | Tokens/source | Daily tokens | $/day |
|---|---|---|---|---|
| Drawings | 0.5 sheets | 2,000 | 1,000 | $0.0001 |
| Spec sections | 1 | 3,000 | 3,000 | $0.0004 |
| Submittals | 2 | 1,500 | 3,000 | $0.0004 |
| RFIs | 3 | 800 | 2,400 | $0.0003 |
| Daily logs | 2 | 1,200 | 2,400 | $0.0003 |
| Photos (caption + OCR) | 30 | 200 | 6,000 | $0.0008 |
| Conversations | 10 | 600 | 6,000 | $0.0008 |
| Change orders | 0.3 | 1,000 | 300 | $0.0001 |
| Spreadsheet cells | 50 | 100 | 5,000 | $0.0007 |
| **Subtotal steady-state** | | | **~29K** | **~$0.004/day** |
| **Per project / month** | | | | **~$0.12** |

Add backfill (one-time per project): ~5M tokens at $0.65/project → amortized.

**At 100 active projects:** ~$15/month steady-state + ~$65 one-time backfill per onboarded project. Trivial against revenue at that scale.

**Acceptance:** projected blended cost stays under **$1.50 / project / month** through end of Lap 5 (placeholder budget per `IRIS_NATIVENESS_PLAN §7`).

---

## Operational guarantees

1. **Every chunk row stores `embedding_model_version`** (e.g., `openai:text-embedding-3-large:1536`). Migrations are non-destructive: old chunks remain queryable, new chunks added under new version, query layer chooses model per chunk.
2. **Re-embed worker** (`src/edge/workers/iris_reembed_worker.ts`) runs offline; can backfill on schedule when a model swap happens. Idempotent. Resumable on interruption.
3. **Per-tenant data residency** is the standard OpenAI API contract — covered under our existing OpenAI BAA. Enterprise customers requiring on-prem embeddings get the Phase-7 self-host option.
4. **Failure mode:** if OpenAI embeddings API is down, ingestion enqueues the chunk to `q_kb_ingest_dlq`. Alert at >5min queue lag. Pilot acceptance is not blocked by transient embeddings outages because retrieval still works on whatever's already indexed.

---

## Phase 7 revisit criteria

Open ADR-017-A at Phase 7 if **any** of these are true:

- Steady-state per-project cost > $5/month.
- Self-hosted bge-large MTEB ≥ 65.0 on construction-tuned eval (we'd train a domain adapter).
- An enterprise customer requires on-prem embeddings as a contract gate.
- OpenAI deprecates text-embedding-3-large (track the deprecation calendar).
- Voyage/Cohere ship a construction-tuned variant that beats 3-large by ≥2 MTEB pts at lower cost.

---

## Test plan

- 100-question goldens (Phase 3 spec) hits recall@5 ≥ 0.85 with 3-large at 1536.
- 50-case RLS suite passes regardless of model.
- Embedding leakage suite (per Phase 3 §11): cross-tenant Pearson r ≤ 0.05 — model-agnostic but verified on chosen model.
- Cost telemetry: weekly $/project from `iris_embedding_cost_usd` matview tracks within 20% of projection.

---

## Consequences

**Positive:** simplest path to "no piece of information is not absorbed" with zero infra new-build. Quality envelope generous enough that Phase-3 acceptance gate is not at risk on the model choice. Backfill cost rounds to zero at pilot scale. Vendor relationship already in place.

**Negative:** vendor lock to OpenAI for the embedding layer until Phase 7. ~$15/month/100-projects ongoing cost (acceptable). 1536-dim HNSW index is larger than 1024 — accepted; revisit if Postgres tier upgrade triggers.

**Reversible:** yes, by design. The `embedding_model_version` column makes migration mechanical, not architectural.

---

## Status timeline

- **2026-05-08** — Accepted, pre-Phase-3 open.
- **Phase 3 open (~Oct 2026)** — Implemented per IRIS_PHASE_3 spec.
- **Phase 7 open (~May 2027)** — ADR-017-A revisit.
