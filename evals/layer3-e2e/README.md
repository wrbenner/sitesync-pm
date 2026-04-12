# Layer 3 — End-to-End Workflow Tests

## Purpose

Layer 3 tests validate complete business workflows from the user's perspective:
creating an entity, transitioning it through its state machine, and verifying
all side effects. These tests exercise the full stack (UI → API → DB).

## Status: PLACEHOLDER

All Layer 3 tests are placeholders. They define expected behavior and will be
activated once the following prerequisites are met:

1. **Kernel hooks exist** (`useRfi`, `useSubmittal`, `useDailyLog`, `usePunchItem`)
   implementing state machine transitions with proper permission checks
2. **Status enum types** created in the database schema
3. **State machine enforcement** via CHECK constraints or triggers
4. **Audit log triggers** firing on all mutations
5. **E2E test framework** configured (Playwright or Cypress)

## Gold-Standard Fixtures Covered

| Fixture | Test File | Description |
|---------|-----------|-------------|
| #4 — RFI Lifecycle | `test_rfi_lifecycle.spec.ts` | Full happy-path: draft→open→under_review→answered→closed |
| #5 — RFI Void | `test_rfi_lifecycle.spec.ts` | Only owner/admin can void an RFI |
| #6 — Submittal Resubmission | `test_submittal_lifecycle.spec.ts` | Reject + resubmit with new revision |
| #7 — Change Order Promotion | `test_rfi_lifecycle.spec.ts` | PCO→COR→CO pipeline |
| #8 — Daily Log Rejection | `test_daily_log_lifecycle.spec.ts` | Submit, reject, resubmit, approve |
| #9 — Punch Item Verification | `test_punch_item_lifecycle.spec.ts` | Resolved→rejected→reopened |
| #10 — Pay Application | `test_rfi_lifecycle.spec.ts` | Draft→submitted→certified→paid |
| #11 — Drawing Supersession | `test_submittal_lifecycle.spec.ts` | Rev A superseded by Rev B |
| #13 — Permit Lifecycle | `test_punch_item_lifecycle.spec.ts` | Full permit + inspection flow |

## Running

```bash
# Via the runner (reports as skipped):
../run-evals.sh --layer 3

# When activated:
npx playwright test evals/layer3-e2e/
```
