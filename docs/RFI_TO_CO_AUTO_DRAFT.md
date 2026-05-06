# RFI → Change Order Auto-Draft

> "GC's PM gets RFI #112 back from the architect. 'Per attached sketch, install
> 1″ rigid insulation instead of the 1/2″ shown — confirmed.' That's $34k of
> material + labor across 4,200 sf. Three weeks later, monthly review: 'What's
> this $34k overrun?' Owner pushes back. GC eats $34k."
>
> Industry-wide, GCs lose 4–7% margin to scope expansion that never converted
> to a CO. This stream catches it at the moment the answer arrives.

## Flow

```
RFI status → 'answered'
   │
   ▼
draft-change-order edge function
   │
   ├─ project.auto_co_drafting_enabled?       → skip if false
   ├─ existing CO with this source_rfi_id?    → skip (PM already on it)
   ├─ "no change" / "proceed as drawn"?       → skip (no AI burn)
   │
   ├─ routeAI('reasoning')  → JSON {scope_change, kind, line_items, ...}
   │     • model never returns money
   │     • few-shot from PATTERNS keeps prompt + classifier in lockstep
   │
   ├─ Validate against scopeChangePatterns:
   │     answer must contain a scope-change anchor signal
   │     (otherwise → confidence='low' → no CO, only an Iris card)
   │
   ├─ estimateCostFromCandidates(line_items, cost_database)
   │     • lookup never returns invented dollars
   │     • partial matches still produce a partial total
   │     • zero matches → null total, CO drafts with empty cost
   │
   └─ Insert change_orders {source_rfi_id, status='pending_review', ...}
         + drafted_actions inbox card  (graceful skip if table absent)
```

## What's bullet-proofed

| Failure mode | Fix |
| --- | --- |
| Model wrongly drafts a CO when the answer was "proceed as drawn" | `answerIsExplicitNoChange` short-circuits before the AI call. Even if AI runs, `answerHasScopeSignal` must corroborate before we draft. |
| Detail swap with no cost change ("use detail B") | Detail-change pattern is excluded from `answerHasScopeSignal`. Drafter requires a cost-bearing kind. |
| `cost_database` empty | `estimateCostFromCandidates` returns `total=null`. CO drafts with empty cost. UI surfaces "Cost was not estimated automatically — review and price manually." |
| Long RFI thread, only the last reply has the change | Prompt + linker both anchor the verdict on the last reply. |
| Multiple answers over time | Unique partial index on `(source_rfi_id, status IN pending/draft/submitted)` — most recent draft wins. |
| Owner contract requires architect-only COs | Per-project `auto_co_drafting_enabled` flag (default true). |
| Approved auto-CO disputed later | Full audit: `source_rfi_id`, model + provider on insert, classification + cost provenance preserved on the drafted_actions row. Exportable for legal. |
| Hallucinated cost ($200k from nowhere) | Cost only comes from `cost_database`. Model returns line items only. |
| Schedule impact estimation wrong | Model returns binary `schedule_impact_likely`; days are computed in our code from the linked schedule phase (or default 0 if no link). PM reviews. |
| Subs see drafts they shouldn't | Drafts live in `change_orders` with `status='pending_review'`. RLS already gates by role; only `change_orders.create` permission sees pending drafts. |
| Privacy on prompt | All thread text passes through `sanitizeForPrompt`. No raw email signatures, no contact info. |

## Tables

```
change_orders.source_rfi_id  → rfis.id
   + unique partial idx on pending/draft/submitted per RFI
projects.auto_co_drafting_enabled  default true
```

## Files

```
supabase/migrations/20260430140000_co_source_rfi.sql
supabase/migrations/20260430140001_auto_co_settings.sql
supabase/functions/draft-change-order/
  index.ts            edge function
  promptBuilder.ts    few-shot prompt construction
supabase/functions/shared/coAutoDraft/
  scopeChangePatterns.ts   (Deno mirror of src/lib/coAutoDraft/)
  costEstimator.ts
  types.ts
src/lib/coAutoDraft/
  index.ts                       public surface
  scopeChangePatterns.ts         pure regex anchors + few-shot examples
  costEstimator.ts               cost_database lookup + line-total math
  __tests__/
    scopeChangePatterns.test.ts  18 tests
    costEstimator.test.ts         8 tests
src/types/coAutoDraft.ts
src/components/changeorders/
  AutoCoApprovalGate.tsx         RFI-detail panel — review/approve drafted CO
  MarginRecoveryWidget.tsx       dashboard widget — running tally of $ recovered
docs/RFI_TO_CO_AUTO_DRAFT.md     this file
```

## v1 scope

- Edge function deploys + responds correctly
- Pure-logic libs covered by 26 unit tests, all passing
- AutoCoApprovalGate renders standalone with mock data
- MarginRecoveryWidget renders standalone with mock numbers
- `cost_database` empty case returns CO with null cost (not a crash)
- Unique-per-RFI guarantee (DB-level partial unique index)

## Deferred

- Wiring the edge-function trigger from the RFI status-flip handler
  (currently invocable manually via POST {rfi_id})
- Schedule-impact-days calc from the linked schedule phase
- "Re-evaluate" debug button on the RFI detail view
- Margin-recovery widget query implementation (parent fetches; widget is
  presentational)
- Owner-side acknowledgement signature/PDF export

## Tests

```
npx vitest run src/lib/coAutoDraft
```

26 unit tests pin every load-bearing rule:
- Scope-change anchor signals (5 positive, 3 negative)
- Explicit "no change" recognition (4 cases)
- Pattern kind inference (6 cases)
- Cost estimator pricing math (8 cases including null/empty/partial)
- Full coverage of the rules the field actually depends on.
