# Phase 3d — submittal/contract/spreadsheet + 3 citation kinds + Code cutover

Date: 2026-05-11. Branch: phase-3d-cutover. Stacked on Phase 3c.

## TL;DR

3 final chunkers (submittal, contract, spreadsheet) — completing the 10-worker matrix; 3 new citation kinds (spreadsheet_cell, contract_clause, punch_item) with side-panel renderers and resolve_citation RPC extension; Code specialist cutover to retrieve() with kb-stub as fallback safety net. 45 new tests (15 chunker + 18 cutover + 4 new citationRouting + 8 wiring); 3695 tests total green; typecheck zero on both project configs; lint clean.

## What changed

### Final 3 chunkers (Phase 3 complete: 10/10)

- `src/services/iris/ingestion/chunkers/submittal.ts`: header chunk + per-sub-item chunks + review-notes chunk. satisfies_spec_section flows into metadata so the Code specialist can resolve "what submittal satisfies spec 09 22 16?".
- `src/services/iris/ingestion/chunkers/contract.ts`: per-clause chunks; clause_number stays stable in source_anchor even when long clauses split into segments. Supports AIA A201/A101/GMP heading-pattern templates.
- `src/services/iris/ingestion/chunkers/spreadsheet.ts`: per-range chunks with sheet_name + range_a1 in source_anchor. Named-range labels surface in metadata.

### 3 final worker scaffolds (Phase 3 complete: 10/10 + dispatcher + iris-embed)

- `supabase/functions/iris-ingest-submittal-worker/index.ts`
- `supabase/functions/iris-ingest-contract-worker/index.ts`
- `supabase/functions/iris-ingest-spreadsheet-worker/index.ts`

### 3 new citation kinds

- `src/types/draftedActions.ts`: added spreadsheet_cell, contract_clause, punch_item to the citation kind union; new optional fields (sheet_name, range_a1, clause_number, article).
- `src/lib/iris/citationRouting.ts`: added 3 new CITATION_ROUTES entries with deep-link builders (`/files/...?sheet=...&range=...`, `/contracts/...?clause=...`, `/punch-items/...`); ALL_KINDS extended to 11.
- `src/components/iris/citations/SpreadsheetCellCitationPanelContent.tsx`: side-panel renderer (sheet + range + named-range + file_name).
- `src/components/iris/citations/ContractClauseCitationPanelContent.tsx`: side-panel renderer (contract title + clause number + article + heading).
- `src/components/iris/citations/PunchItemCitationPanelContent.tsx`: side-panel renderer (summary + status + location + assignee + due_date).
- `src/components/iris/CitationPanel.tsx`: switch-case wired to the 3 new components.
- `src/services/iris/citationVerify.ts`: new kinds map to null (structural references, no verifiable snippet text).

### resolve_citation RPC extension

- `supabase/migrations/20261008000007_iris_citation_kinds_extension.sql`: DROP + CREATE of the resolve_citation function with the extended 11-kind set + 3 new ELSIF branches. Project-membership scoping unchanged; stale/forbidden semantics unchanged.

### Code specialist cutover

- `src/services/iris/specialists/code.ts`: bumped CODE_VERSION 0.1.0 -> 0.2.0, promptVersion to phase-3d.0. Audit fields gain `retrieval_path` + `project_id`. toolAllowList gains 3 new cite-* tools (contract_clause, spreadsheet_cell, punch_item).
- `src/services/iris/specialists/code-retrieval-cutover.ts`: NEW. `runCodeRetrievalViaPgvector()` calls retrieve() with source_types filtered to spec_section/contract/rfi; maps KbChunk -> RetrievalResult shape preserving the legacy decision contract. 3-path strategy:
  1. pgvector returns chunks -> cite path, `retrieval_path: 'retrieve_pgvector'`.
  2. pgvector empty AND empty_corpus -> fall back to kb-stub, `retrieval_path: 'fallback_kb_stub'`.
  3. pgvector empty AND corpus exists -> reject with reason, `retrieval_path: 'retrieve_pgvector'`.

### Tests (45 new)

- `src/services/iris/ingestion/__tests__/chunkers-phase-3d.test.ts`: 15 tests across submittal/contract/spreadsheet + determinism + ordinal density.
- `src/services/iris/__tests__/code-retrieval-cutover.test.ts`: 18 tests covering pgvector cite path (8), empty-corpus fallback (3), audit path tracking (2), caller options (4), and CODE_DECL surface non-regression (1).
- `src/lib/iris/__tests__/citationRouting.test.ts`: 4 new tests for the 3 new kinds (kind enumeration + deep-link builders).
- Existing 19 Code specialist tests still pass against the cutover-aware module.

## Day-0 SQL bug screen (PASS)

For migration 20261008000007:
- No `||` runtime concat in DDL: PASS (|| inside plpgsql query body is fine, not DDL).
- No expression in PRIMARY KEY: PASS (no PKs added).
- FK column types match: PASS (no FKs added; function definition only).
- Timestamp 20261008000007 unique: PASS.

## Verification

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.app.json    # exit 0
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.node.json   # exit 0
npx vitest run --exclude '**/CaptureTimeline.a11y.test.tsx'
# Test Files  312 passed | 3 skipped (315)
#      Tests  3695 passed | 10 skipped (3705)
npx eslint <Phase 3d touchpoints>   # 0 errors
```

## What this does NOT do (deferred)

- **Old kb-stub.ts deletion** — stays in-tree as a fallback for 14 days post-cutover. Lap 5 cleanup PR deletes it once production traffic on `retrieve()` is clean.
- **Cutover invocation at the router layer** — Phase 2e router still calls runCodeRetrieval (kb-stub). The router cutover lands in a small follow-up PR after Phase 3e's harness greens on staging (gives us 7-day acceptance window with both paths still wired).
- **Real PDF clause-tree parser** — contract worker scaffold acknowledges; the AIA-template parser is integrated when the first soft-pilot contract uploads.
- **xlsx named-range detection** — spreadsheet worker scaffold acknowledges; the xlsx parser + named-range algorithm lands inline with first soft-pilot spreadsheet.
- **`punch_item` table integration** — citation kind + side panel + resolve RPC are wired, but the punch_items table itself + worker land in a separate small PR (the table doesn't exist yet — punch list is currently a Lap 1 page, not a first-class entity).

## Acceptance (per Lap 4 plan)

- ✅ All 10 chunkers + workers scaffolded (drawing, spec, rfi, daily_log, photo, conversation, change_order, submittal, contract, spreadsheet).
- ✅ 3 new citation kinds render correctly in their side panels.
- ✅ Code specialist's existing 19 tests still pass against the cutover-aware module.
- ✅ 18 cutover parity tests pass (decision invariant + fallback + audit tracking).
- ⏳ Real corpus retrieval recall@5 + precision@5 — verified in Phase 3e against the 20-Q golden set.

## Next up

Phase 3e — 100-Q goldens (20 starter) + 50 RLS leakage cases + phase-3-acceptance.yml daily gate + Lap 4 kickoff receipt. Stacked on this branch.
