# Polish Receipt — Em-dash removal (remaining user-facing text)
**Date:** 2026-05-16  
**PR:** #637 — `auto/polish-20260516-0229`  
**Previous PRs in this series:** #632 (14 toasts), #633 (11 toasts)

## What changed

Removed every remaining em-dash from user-visible running text. PRs #632/#633 had
covered toast messages; this pass covered banners, labels, placeholder text, error
messages, confirm-dialog descriptions, inline annotations, and generated report output.

**21 source files · 31 substitutions.**

Substitution rules applied:
- `— ` separating a clause continuation → period + new sentence or colon
- `— ` introducing a list → colon
- `— ` as a parenthetical → parentheses or comma
- `' — overdue'` date suffix → `' (overdue)'`

## Deferred / out of scope

None. Em-dash sweep is now complete for all user-visible strings in `src/`.  
Future: any new string added should avoid em-dashes (CI lint rule could be added
if regressions appear).

## Quality floor

- TypeScript errors: 0 (both tsconfig.app.json and tsconfig.node.json)  
- `as any` count: 68 (floor 69)  
- Build: ✓  

## What's next

Lap 2 pre-flight continues per the readiness audit. Next items per
`LAP_2_READINESS_AUDIT_2026-05-04.md`:
- IRIS_TELEMETRY_SPEC migration (Day 31 deadline)
- SCHEDULED_INSIGHTS_SPEC (Days 31–35)
