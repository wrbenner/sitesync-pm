# Iris Spec — retrieve() universal knowledge retrieval

**Date filed:** 2026-05-11
**Status:** Phase 3a — typed contract live, stub returns empty corpus.
**Owner:** Walker. Skill: `/iris-spec` template (Phase 3 entry).

## Entrypoint

`src/services/iris/retrieve.ts` exports `retrieve(query, opts)`. Phase 3a ships the stub + the typed shape; Phase 3c (workers 4–7) swaps the body for a real OpenAI embed + `kb_retrieve()` RPC call. Contract is stable across the cutover.

## Persona

All 5 personas call `retrieve()` indirectly via their specialist (Drafter / Money / Schedule / Code). The persona is passed as a discriminant for the sensitivity-tier gate inside `kb_retrieve()`.

## Specialist boundary surface

| Field | Value |
|---|---|
| Entrypoint | `retrieve(query: RetrieveQuery, opts?: RetrieveOptions)` |
| Returns | `Promise<RetrieveResult>` with `{ chunks, latency_ms, cache_hit, empty_corpus }` |
| Errors | `RetrieveError` with codes: `invalid_args`, `empty_query`, `rls_blocked`, `rpc_failed` |
| LLM scope | None at retrieve layer — pure retrieval. Specialists synthesize on top. |
| Write scope | `[]` — read-only |
| Tools | `query_kb`, plus all `cite_*` kinds that callers emit downstream |

## Context Fabric inputs (ADR-020)

`query.persona` and `query.project_id` come from the Fabric's WHO + WHERE slots. The text is the user's question (verbatim) or the specialist-synthesized search string.

## Citation kinds

`retrieve()` doesn't emit citations directly — it returns chunks. Callers (Code specialist, Drafter, future Phase 4 generators) map `source_type` → `citation_kind` via `src/lib/iris/citationRouting.ts` (Lap 2 surface; Phase 3d extends with 3 new kinds: `spreadsheet_cell`, `contract_clause`, `punch_item`).

## Voice rules

`retrieve()` is a typed boundary, not a generative surface. Voice linter applies to callers' synthesized output, not the chunks themselves.

## Auto-execute risk

**None.** `retrieve()` is read-only. The chunks it returns feed into specialist narratives; the executor layer (Phase 2e) is where auto-execute risk lives.

## Telemetry

Each call logs to `iris_kb_telemetry` (Phase 3e migration): `caller_tag`, `latency_ms`, `cache_hit`, `chunks_returned`, `top_score`, `empty_corpus`. The 7 acceptance metrics in `PHASE_3_ACCEPTANCE` (recall@5, precision@5, latency p95, RLS pass, embedding leakage, telemetry coverage, cost) are asserted nightly by `phase-3-acceptance.yml`.

## Acceptance (Phase 3a)

- ✅ `retrieve()` typed surface stable (RetrieveQuery / RetrieveOptions / RetrieveResult / KbChunk / KbSourceAnchor discriminated unions).
- ✅ Stub returns `{ chunks: [], empty_corpus: true }` for any project; latency_ms always ≥ 0.
- ✅ 54 tests pass: 16-value source_type union, 4 sensitivity tiers, input validation gates, return-shape invariants, `rpcRowToKbChunk` normalization, persona-sensitivity matrix documentation.
- ⏳ Real embed + RPC call — Phase 3c.
- ⏳ LRU cache — Phase 3c.
- ⏳ Code specialist cutover from `kb-stub` to `retrieve()` — Phase 3d.
- ⏳ 50 RLS leakage cases against live DB — Phase 3e.
