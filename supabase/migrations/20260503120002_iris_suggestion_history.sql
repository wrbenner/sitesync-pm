-- =============================================================================
-- Iris suggestion history — drives 24h dedup in suggestPolicy
-- =============================================================================

CREATE TABLE IF NOT EXISTS iris_suggestion_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  suggestion_kind text NOT NULL,
  suggested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decision text CHECK (decision IN ('approved','rejected','dismissed','ignored'))
);

CREATE INDEX IF NOT EXISTS idx_iris_sugg_history_user_kind_entity
  ON iris_suggestion_history (user_id, entity_id, suggestion_kind, suggested_at DESC);
CREATE INDEX IF NOT EXISTS idx_iris_sugg_history_recent
  ON iris_suggestion_history (suggested_at DESC);

ALTER TABLE iris_suggestion_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS iris_sugg_history_owner_read ON iris_suggestion_history;
CREATE POLICY iris_sugg_history_owner_read ON iris_suggestion_history
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS iris_sugg_history_owner_write ON iris_suggestion_history;
CREATE POLICY iris_sugg_history_owner_write ON iris_suggestion_history
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
