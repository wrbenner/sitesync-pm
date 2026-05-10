# ADR-022 — Self-host Langfuse for Iris trace observability
**Date:** 2026-05-08
**Status:** Accepted

## Context

The Iris eval pipeline (PR `iris-eval-pipeline-langfuse`) catches regressions before merge. We also need **production** trace visibility — every Iris call in pilot, with input, output, latency, cost, and user feedback (accept/reject/reword) — so a bad change that slips through CI surfaces in the dashboard rather than as a Brad Cameron text on Day 53.

Langfuse is the obvious tool: open-source, free for OSS use, AI SDK + Anthropic integrations, score events for user feedback, OTEL-compatible. The choice isn't whether to use Langfuse but **where it runs**.

## Decision

**Self-host Langfuse on Fly.io** (single-region web app + managed Postgres). Walker manages credentials.

## Alternatives considered

### A. Langfuse Cloud (SaaS)
**Pros:** Set up in 30 min. Free tier covers solo founder + early pilot. No ops burden.
**Cons:** Pilot trace data leaves SiteSync infra. Conflicts with ADR-006 (pilot data isolation) — the soft-pilot agreement template promises "no third-party trace processor for your data without explicit opt-in." Brad's draft outputs would land on Langfuse's infra; the lawyers reading the deposition-grade audit story would flag it.

### B. Self-host on Fly.io (chosen)
**Pros:** Walker controls the Postgres. SOC 2 evidence: "trace data lives on $5/mo Fly machine in Walker's account, no third-party processor." Aligns with the deposition-grade narrative we sell to Brad and Carleton. Fly's managed PG handles backups + HA.
**Cons:** Ops surface — Walker has to keep the Fly app + PG running. Mitigated: documented restore drill in `infra/langfuse/README.md`, monthly cadence matching the existing `restore-drill.yml` pattern. ~$5/mo at pilot volume; ~$15/mo when traces exceed 100k/month.

### C. Self-host on Supabase
**Pros:** No new infra surface — re-uses existing Supabase project.
**Cons:** Supabase doesn't support arbitrary container deploys for Langfuse's Next.js app. Would require a separate edge function that reimplements Langfuse's UI — orders of magnitude more work than Fly.

### D. Skip Langfuse entirely; build on `ai_cost_tracking`
**Pros:** Zero new infra. We already have token + cost + latency on every call.
**Cons:** Loses Langfuse's session/trace UX, prompt versioning, score events, OTEL output. Walker would re-implement a trace UI in SiteSync, which is a 2-week distraction from Lap 2.

## Consequences

### Positive
- ✓ Pilot data stays on Walker-controlled infra → ADR-006 alignment, deposition-grade story intact.
- ✓ One trace dashboard covers eval pipeline + production (both tag `audit_id`).
- ✓ Score events let us correlate model output with user accept/reject in a single tool — the foundation for the "real signal beats lab-only signal" measurement loop.
- ✓ Eval pipeline (`evals/iris/`) and production (`iris-call` edge function) point at the same self-host instance — debugging a bad ship goes from "diff prompts in git" to "filter traces by `is_soft_pilot=true` for last 24h."

### Negative
- ✗ Walker is on the hook for Fly.io uptime + monthly restore drill.
- ✗ Browser-side score writes (accept/reject) require a new edge function (cannot put `LANGFUSE_SECRET_KEY` in the Vite bundle). Tracked as follow-up — for now, browser writes use the existing `recordCorrection` → `training_corrections` table; that data is bridged into Langfuse as a follow-up edge function.
- ✗ No Langfuse SDK update channel — we hand-rolled a minimal REST client (no transitive deps to reduce bundle bloat). Locks us into the public ingestion API contract; if Langfuse breaks it (unlikely — it's well-versioned), we patch the client.

### Costs
- Fly app: ~$2/mo (`shared-cpu-1x` 512MB)
- Fly Postgres `pg-tiny`: ~$3/mo
- Total at pilot volume: ~$5/mo
- Total at post-pilot scale (100k+ traces/mo): ~$15/mo

## Compliance hooks

- `is_soft_pilot` tag on every trace → enables retention policy split (24mo for pilot per ADR-008, then anonymize).
- `audit_id` correlation → traces are joinable to the canonical hash-chained audit log; depositions can pull "this exact AI moment" from both sides.
- No third-party data processor → no DPA needed for the pilot agreement.

## Implementation references

- `infra/langfuse/fly.toml`, `docker-compose.yml`, `README.md`
- `src/lib/observability/langfuse.ts` — browser-safe, no-op when keys absent
- `supabase/functions/shared/langfuse.ts` — Deno mirror for edge functions
- `supabase/functions/iris-call/index.ts` — first call site (line ~545)
- `src/lib/aiObservability.ts` — `traceLLM` Langfuse mirror

## Reversibility

If Walker decides to switch to Langfuse Cloud (e.g. for SOC 2 attestation that hosted is fine), the change is:
1. Update `LANGFUSE_HOST` secret to `https://cloud.langfuse.com`
2. Re-issue keys in Cloud, set `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY`
3. Decom Fly app

The trace data on Fly's PG is exportable via Langfuse's standard CSV export. Switching the other way (Cloud → self-host) is symmetric.
