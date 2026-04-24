-- ═══════════════════════════════════════════════════════════════
-- Migration: communication_logs
-- Version: 20260424000008
-- Purpose: Track interactions with directory contacts (email, calls,
--          meetings, notes). Consumed by /directory's per-contact
--          Communications panel and the "Not Contacted 30+ Days"
--          filter.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS communication_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contact_id   uuid NOT NULL REFERENCES directory_contacts(id) ON DELETE CASCADE,
  channel      text NOT NULL
    CHECK (channel IN ('email', 'phone', 'meeting', 'note')),
  subject      text,
  summary      text NOT NULL DEFAULT '',
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  logged_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_communication_logs_contact_time
  ON communication_logs (contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_logs_project_time
  ON communication_logs (project_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_logs_channel
  ON communication_logs (project_id, channel);

-- ── updated_at trigger ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_communication_logs_updated_at ON communication_logs;
CREATE TRIGGER trg_communication_logs_updated_at
  BEFORE UPDATE ON communication_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communication_logs_select ON communication_logs;
CREATE POLICY communication_logs_select ON communication_logs FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS communication_logs_insert ON communication_logs;
CREATE POLICY communication_logs_insert ON communication_logs FOR INSERT
  WITH CHECK (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS communication_logs_update ON communication_logs;
CREATE POLICY communication_logs_update ON communication_logs FOR UPDATE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS communication_logs_delete ON communication_logs;
CREATE POLICY communication_logs_delete ON communication_logs FOR DELETE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ));
