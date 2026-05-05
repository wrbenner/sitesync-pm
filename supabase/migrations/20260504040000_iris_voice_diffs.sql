-- iris_voice_diffs — paired (raw LLM output, linted output) corpus.
--
-- Every successful iris-call response gets post-processed through
-- voiceLinter.ts; the diff (when the linter changed something) is
-- logged here. This serves three purposes:
--
--   1. Telemetry — Walker's daily 5:30 PM standup runs a query that
--      groups by rule id to see which rules fire most. A rule that
--      fires on > 50% of drafts means the prompt isn't sticking and
--      the system message needs strengthening.
--   2. Training corpus — sentence-by-sentence (raw, linted) pairs
--      become the ground truth set when fine-tuning lands (Q2 2027
--      per the North Star).
--   3. Auditability — when a pilot user rejects a draft on tone,
--      Walker can pull the diff and see exactly what the linter
--      changed before the user saw it.
--
-- Reference: docs/audits/IRIS_VOICE_GUIDE_SPEC_2026-05-04.md § Phase 4
--            docs/audits/ADR_005_VOICE_ENFORCEMENT_2026-05-04.md

BEGIN;

CREATE TABLE IF NOT EXISTS public.iris_voice_diffs (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  drafted_action_id uuid          REFERENCES public.drafted_actions(id) ON DELETE CASCADE,
  raw_text          text          NOT NULL,
  linted_text       text          NOT NULL,
  failed_rule_ids   text[]        NOT NULL DEFAULT '{}',
  /* Identifies which output bucket this diff belongs to so the dashboard
     can group by action_type + detector + tone — drift in any single
     bucket is the leading indicator of a regression. */
  action_type       text,
  detector_kind     text,
  recorded_at       timestamptz   NOT NULL DEFAULT NOW()
);

-- "Which rule fires most this week" is a GIN-indexed array search.
CREATE INDEX IF NOT EXISTS idx_iris_voice_diffs_rules
  ON public.iris_voice_diffs USING GIN (failed_rule_ids);

-- "Show me the last 50 drafts that tripped any rule" — recency drill.
CREATE INDEX IF NOT EXISTS idx_iris_voice_diffs_recent
  ON public.iris_voice_diffs (recorded_at DESC);

-- Per-action-type drill-down for the diagnostic dashboard.
CREATE INDEX IF NOT EXISTS idx_iris_voice_diffs_action
  ON public.iris_voice_diffs (action_type, recorded_at DESC)
  WHERE action_type IS NOT NULL;

COMMENT ON TABLE public.iris_voice_diffs IS
  'Per-iris-call (raw, linted) text pairs. Telemetry for the voice linter; training corpus for future fine-tuning.';

-- ── RLS ───────────────────────────────────────────────────────────
-- Read access: org admins of the related project's org. Service role
-- bypasses RLS so the linter can insert during iris-call.
ALTER TABLE public.iris_voice_diffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iris_voice_diffs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS iris_voice_diffs_select_admin ON public.iris_voice_diffs;
CREATE POLICY iris_voice_diffs_select_admin ON public.iris_voice_diffs
  FOR SELECT
  USING (
    drafted_action_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.drafted_actions da
       JOIN public.projects p ON p.id = da.project_id
       JOIN public.organization_members om ON om.organization_id = p.organization_id
       WHERE da.id = iris_voice_diffs.drafted_action_id
         AND om.user_id = auth.uid()
         AND om.role IN ('owner','admin')
    )
  );

-- INSERT/UPDATE/DELETE: service-role only (no policy → FORCE RLS denies authenticated).

-- ── Retention prune (60 days) ─────────────────────────────────────
-- Voice diffs are training corpus; we keep them longer than scheduled-
-- insights logs (30d) because the value compounds. 60d is enough to
-- cover a full pilot rotation. Lap 3 may extend further when fine-
-- tuning needs > 30k samples.

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed — skipping iris-voice-diffs-prune schedule.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'iris-voice-diffs-prune') THEN
    PERFORM cron.unschedule('iris-voice-diffs-prune');
  END IF;

  PERFORM cron.schedule(
    'iris-voice-diffs-prune',
    '17 4 * * *',  -- 04:17 UTC daily, off-peak, after the insights-log prune
    $cron$
      DELETE FROM public.iris_voice_diffs
       WHERE recorded_at < NOW() - INTERVAL '60 days';
    $cron$
  );

  RAISE NOTICE 'iris-voice-diffs-prune scheduled daily at 04:17 UTC.';
END $do$;

COMMIT;
