# Iris-eval pipeline follow-ups — receipt
**Date:** 2026-05-09
**Branch:** `iris-eval-followups` (stacked on `iris-eval-pipeline-langfuse` / PR #383)
**Status:** Ready for review.

## Why

PR #383 stood up the Iris eval pipeline + Langfuse self-host instrumentation for the canonical `iris-call` edge function. Two follow-ups were explicitly deferred there:

1. **Three direct-Anthropic edge functions had no trace coverage** (`draft-daily-log`, `voice-extract`, `agent-orchestrator`). Production calls flowing through these pipelines never appeared in the Langfuse dashboard, so a regression slipping through one of them stayed invisible.
2. **No browser-side score path.** Accept/reject/reword in the Iris Inbox didn't emit Langfuse `score-create` events, so the dashboard couldn't grade real Iris output against PM behavior.

This branch closes both. After it lands, every Iris LLM call (canonical or direct) writes a Langfuse trace, every accept/reject mutation emits a score against the originating trace, and the trace dashboard becomes the single grade-the-model surface.

## What ships

### 1. Migration: `drafted_actions.iris_audit_id`

`supabase/migrations/20260509000010_drafted_actions_iris_audit_id.sql` — nullable uuid column. No backfill (forward-only). The `iris-score` edge fn looks up this column to find the trace id.

`src/types/database.ts` updated to mirror (Row + Insert + Update); typegen will land on the next `npm run db-types:write` against staging.

### 2. Direct-Anthropic edge fn instrumentation

| Function | Trace pattern | Tag |
|---|---|---|
| `draft-daily-log/index.ts` | `recordIrisTrace` after successful polish; trace id pre-allocated and persisted on `drafted_actions.iris_audit_id`. Token usage now extracted from response (was discarded). | `daily_log.draft` |
| `voice-extract/index.ts` | `recordIrisTrace` after `messages.create`; usage from `response.usage`. | `voice_extract` |
| `agent-orchestrator/index.ts` | `recordIrisTraceMeta` once at request start (parent), `recordIrisGeneration` per call: intent → specialist(s) → synthesis. Inline coordinator-direct path also instrumented. | `orchestrator:intent`, `orchestrator:specialist:<domain>`, `orchestrator:synthesis`, `orchestrator:coordinator` |

All three wrap the trace write in try/catch — a Langfuse outage never affects the user-facing response (matches the iris-call pattern from PR #383).

### 3. Browser score path

| Component | Path |
|---|---|
| Edge fn | `supabase/functions/iris-score/index.ts` — auth + RLS-scoped lookup of `drafted_actions.iris_audit_id` + call `recordIrisScore`. Returns `{ ok: false, reason: 'no_trace_id' \| 'forbidden' }` for null trace id or RLS denial; never 5xx for those cases. |
| Browser helper | `src/services/iris/score.ts` — `submitIrisScore({ draftedActionId, kind, value, comment })` calling `supabase.functions.invoke('iris-score', ...)`. Best-effort; never throws. |
| Wiring | `src/hooks/queries/draftedActions.ts` — `useApproveDraftedAction.onSuccess` and `useRejectDraftedAction.onSuccess` fire `submitIrisScore` (`accept` value=1, `reject` value=0). Reword UI doesn't exist yet (Lap 3); the schema accepts it for forward-compat. |

### 4. New Langfuse helpers

`recordIrisTraceMeta(ctx)` (added to both `src/lib/observability/langfuse.ts` and `supabase/functions/shared/langfuse.ts`) — emits a `trace-create` event with no associated generation, used when a single user request fans out to multiple LLM calls (the orchestrator pattern).

`recordIrisGeneration(traceId, generation)` — emits a child `generation-create` event under an existing trace.

### 5. IrisDraft type extension

`src/services/iris/types.ts` — `IrisDraft.auditId` field. `generateIrisDraft` (`src/services/iris/drafts.ts`) populates it from `IrisCallDone.auditId`. Forward-compat: callers persisting a generated draft to `drafted_actions` can now pass `iris_audit_id` through `draftAction({ ..., iris_audit_id })`.

`src/types/draftedActions.ts` — `DraftedActionInsert.iris_audit_id?: string` field. `draftAction()` forwards it to the row.

## What's deliberately NOT in scope

- **Backfilling iris_audit_id on pre-existing drafts.** Pre-PR-#383 drafts have null. Cannot retroactively score them. Acceptable.
- **Other server-side draft writers** (`inbound-email`, `draft-change-order`) don't yet thread iris_audit_id. They'll get it in a follow-up when their own LLM call paths are instrumented.
- **Reword UI**. Placeholder in `IrisApprovalGate`. Lap 3.
- **Cross-project anonymization** (ADR-021) — separate.

## Verification

| Check | Result |
|---|---|
| Typecheck on this branch | App + Node tsconfigs both pass on the files I touched. Two pre-existing errors in `src/lib/telemetry/__tests__/track.test.ts` (unrelated to this PR — file was modified by a background session). |
| Migration sqlfmt | New migration follows the BEGIN/COMMIT pattern + IF NOT EXISTS guard. |
| iris-score edge fn auth | Uses `authenticateRequest` + RLS-scoped `auth.supabase.from('drafted_actions')` lookup — matches the iris-call pattern. |
| Trace correlation | `draft-daily-log` writes `iris_audit_id` on the row only when polish succeeded. `iris-score` returns `{ ok: false, reason: 'no_trace_id' }` for unsuccessful drafts. |
| Browser security | `LANGFUSE_SECRET_KEY` never reaches the browser. The browser-side helper calls the edge fn, which holds the secret server-side. |

## Files

### New (4)
- `supabase/migrations/20260509000010_drafted_actions_iris_audit_id.sql`
- `supabase/functions/iris-score/index.ts`
- `src/services/iris/score.ts`
- `docs/audits/IRIS_EVAL_PIPELINE_FOLLOWUPS_RECEIPT_2026-05-09.md` (this file)

### Modified (10)
- `src/types/database.ts` — added `iris_audit_id` to drafted_actions Row/Insert/Update
- `src/types/draftedActions.ts` — added `iris_audit_id` to `DraftedActionInsert`
- `src/services/iris/types.ts` — added `auditId` to `IrisDraft`
- `src/services/iris/drafts.ts` — populate `auditId` from `IrisCallDone`
- `src/services/iris/draftAction.ts` — forward `iris_audit_id` to row
- `src/hooks/queries/draftedActions.ts` — fire `submitIrisScore` on accept/reject
- `src/lib/observability/langfuse.ts` — added `recordIrisTraceMeta` + `recordIrisGeneration`
- `supabase/functions/shared/langfuse.ts` — added same helpers
- `supabase/functions/draft-daily-log/index.ts` — Langfuse trace + iris_audit_id persistence + token extraction
- `supabase/functions/voice-extract/index.ts` — Langfuse trace
- `supabase/functions/agent-orchestrator/index.ts` — parent trace + 3+ generation events
