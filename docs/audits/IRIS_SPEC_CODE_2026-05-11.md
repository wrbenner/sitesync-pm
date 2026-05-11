# Iris Spec — Code specialist

**Date filed:** 2026-05-11
**Status:** Draft (Phase 2d contract surface + retrieval stub shipped)

## Entrypoint

`src/services/iris/specialists/code.ts` exports `CODE_DECL`. Retrieval stub at `src/services/iris/kb-stub.ts`. Corpus fixture at `tests/fixtures/code-kb/clauses.json` (30 representative clauses; 5K hand-curated target).

## Persona

PM (primary).

## Specialist (per ADR-018)

| Field | Value |
|---|---|
| name | `code` |
| version | `0.1.0` |
| llmScope | `synthesis` |
| modelTier | `sonnet` |
| latencyBudgetMs | p50 3000 / p95 5000 |
| writeScope | empty (read-only) |
| toolAllowList | `query_kb`, `cite_spec_reference`, `cite_drawing_coordinate`, `cite_rfi_reference` |

## Deterministic gates

- `question` non-empty + length < 4000 chars
- `corpus` non-empty
- `k` in `[1, 20]` when provided
- Jurisdiction filter must yield at least 1 clause
- Warning (not blocker): zero candidates above retrieval-score threshold

## Retrieval

- `retrieveClauses` — Jaccard similarity over word tokens + section-id exact-match boost (+0.5, capped at 1.0). Returns top-k above `min_score` (default 0.1).
- `citeOrReject` — `{ decision: 'cite' | 'reject', clauses, reason? }`. Reject fires when no clause clears the score threshold.
- Real pgvector retrieval lands Phase 3 per ADR-017.

## Cite-or-reject

Per spec § Code, the Code specialist must EITHER emit a citation OR refuse. The pipeline returns the decision; the prompt instructs the model to respond with the rejection narrative when no citations were retrieved.

## Auto-execute risk

**None.** Code is read-only.

## Telemetry

`iris_actions` fields: BASE + `corpus_size` + `retrieval_count` + `cite_or_reject` + `top_score`.

## Acceptance (Phase 2d)

- Contract surface conforms to ADR-018.
- Deterministic gates: question, corpus, k, jurisdiction filter, zero-candidate warning.
- Retrieval ranking + section-id boost + cite-or-reject path tested.
- Perf: 1000-iteration sweep over the corpus completes in well under 5s budget.
- 19 tests pass.
- Pending: 5K-clause corpus (SME-authored) and pgvector retrieval (Phase 3).
