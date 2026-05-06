# PLATINUM · Workflows

Configurable, versioned, deterministic state machines for RFIs, submittals, change orders, punch items, pay apps, inspections, and daily logs.

## Architecture

| Layer | Files | Responsibility |
| --- | --- | --- |
| Pure runner | `src/lib/workflows/runner.ts` | Given a definition + state + event, returns the next state. No I/O. |
| Validator | `src/lib/workflows/validators.ts` | Reachability, cycles, missing terminals, malformed expressions. |
| Default templates | `src/lib/workflows/definitions.ts` | Seed workflows for new projects (RFI, CO, submittal). |
| Types | `src/types/workflows.ts` | `WorkflowDefinition`, `EntityState`, `WorkflowEvent`, `WorkflowTransition`. |
| UI | `src/components/workflows/WorkflowBuilder.tsx` + `WorkflowStep.tsx` | Drag/drop visual builder using native pointer events. |
| Persistence | `supabase/migrations/20260503120000_workflow_definitions.sql` | `workflow_definitions` (versioned) + `workflow_runs` (per-entity log). |
| Admin page | `src/pages/admin/workflows/index.tsx` | Per-entity workflow editor. |

## Versioning contract

- Every workflow has a `version int`. Items in flight pin the `definition.id` and `version` they started under.
- Editing a workflow ALWAYS creates a new version row; the old row is never mutated. `archived_at` flags retired versions.
- Runner refuses to advance an entity whose pinned `id`/`version` doesn't match the supplied definition (returns a `ValidationError`).

## Conditional routing

`when` expressions like `cost_impact > 50000` use a hand-written safe parser (no dynamic-code evaluation):

- Operators: `> < >= <= == != && || !`
- Literals: numbers, strings (single or double quoted), booleans, `null`
- Dotted-path access into the entity payload (`entity.priority` or bare `priority`)
- Parentheses for grouping

Malformed expressions surface as a `BAD_EXPRESSION` validation issue at save-time AND a `ValidationError` at runtime if the entity payload is shaped such that the expression can't evaluate.

If multiple transitions match, the FIRST listed wins (definition order). A non-terminal step with no unconditional fallback emits a `NO_FALLBACK_BRANCH` warning.

## Wiring required (existing files)

- `src/App.tsx`: register route `/admin/workflows` → `<AdminWorkflowsPage />` (lazy-load to keep main bundle slim).
- Entity service-layer functions (e.g., `services/rfiService.ts`): on submit/approve/reject events, after the existing mutation, look up the active `workflow_definitions` row for the project + entity_type, call `transition()`, and append to `workflow_runs.history`. (Not implemented in this wave to avoid touching existing services.)

## Failure modes addressed

| Mode | Mitigation |
| --- | --- |
| Workflow definition mutated mid-flight | Pinned `id+version`. Editing creates a new row; in-flight items keep using the old row. |
| Cycle in workflow graph | `validateGraph` rejects cycles via DFS path-tracking. |
| Step unreachable | `validateGraph` warns + the UI Save button is disabled. |
| Stuck entity (no matching transition) | `runner.transition` returns `ValidationError("No transition matched event ...")` rather than silently advancing. |
| Privilege escalation | Source step `required_role` AND transition `required_role` are both enforced. |

## Failure modes deferred

| Mode | Reason / how to address later |
| --- | --- |
| Async approvals (e.g., owner offline >24h) | Add a `step.timeout_action` field; not in this wave. |
| Parallel branches (fan-out) | Current model is strictly sequential. Fan-out requires a new `branch` step type. |
| Workflow compilation (precomputing reachability for hot paths) | Premature; cache validation result instead if it shows up in profiling. |

## Conventions adopted

- `Result<T>` from `src/services/errors.ts` for all runner outputs.
- Pure logic in `lib/`, no Supabase imports.
- Inline-style React + atoms for UI.
- Discriminated-union `WorkflowEvent`.

## Known limitations

- Default workflows (`buildDefaultWorkflow`) only cover RFI, change_order, submittal. Punch / pay app / inspection workflows TBD.
- Workflow runs aren't yet wired into entity mutations — that's a Tab A integration step documented above.
- The visual builder is functional but not pretty: the auto-layout BFS doesn't try to minimize edge crossings.
