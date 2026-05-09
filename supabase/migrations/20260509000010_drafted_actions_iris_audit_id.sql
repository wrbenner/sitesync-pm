-- drafted_actions.iris_audit_id — correlation field for Langfuse traces.
--
-- When a draft is produced via callIris (browser → iris-call edge fn), the
-- iris-call function returns an audit_id that names the canonical row in
-- audit_log + the trace id used for the Langfuse self-host instance. We
-- persist that id here so the browser can later emit accept/reject score
-- events against the same trace.
--
-- For drafts produced by edge functions that call Anthropic directly
-- (draft-daily-log etc.), the function generates its own uuid trace id
-- before the LLM call and writes that here too.
--
-- Forward-only — pre-existing drafts have NULL and cannot emit scores.
-- Acceptable: those drafts shipped before trace observability existed.
--
-- Reference: docs/audits/IRIS_EVAL_PIPELINE_FOLLOWUPS_RECEIPT_2026-05-09.md
--            docs/audits/ADR_022_LANGFUSE_SELF_HOST_2026-05-08.md

BEGIN;

ALTER TABLE public.drafted_actions
  ADD COLUMN IF NOT EXISTS iris_audit_id uuid;

-- B-tree index — small (most rows null), but the iris-score edge fn does
-- a point lookup on draft_id then reads iris_audit_id, so the column
-- doesn't actually need its own index. Add only if a future query
-- filters by iris_audit_id directly. (Keeping schema minimal.)

COMMENT ON COLUMN public.drafted_actions.iris_audit_id IS
  'Correlates this draft to the audit_log row for the iris-call (or trace id ' ||
  'for direct-Anthropic edge fns) that produced it. Used by iris-score edge ' ||
  'fn to emit Langfuse score events against the originating trace.';

COMMIT;
