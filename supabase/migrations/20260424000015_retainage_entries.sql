-- Retainage Entries — per-contract retainage ledger with held + released balances.
-- Separate from the legacy retainage_ledger table in 00010_accounting_module.sql
-- so the pay-apps flow can track held/released amounts at the contract level
-- without coupling to the historical G702/G703 staging pipeline.

CREATE TABLE IF NOT EXISTS retainage_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE NOT NULL,
  pay_app_id uuid REFERENCES payment_applications(id) ON DELETE SET NULL,
  percent_held numeric(5,2) CHECK (percent_held >= 0 AND percent_held <= 100),
  amount_held numeric(14,2) NOT NULL,
  released_amount numeric(14,2) NOT NULL DEFAULT 0,
  released_at timestamptz,
  released_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retainage_entries_project
  ON retainage_entries(project_id);

CREATE INDEX IF NOT EXISTS idx_retainage_entries_contract
  ON retainage_entries(contract_id);

CREATE INDEX IF NOT EXISTS idx_retainage_entries_pay_app
  ON retainage_entries(pay_app_id);

-- Partial index: the common query pattern is "open retainage per contract".
CREATE INDEX IF NOT EXISTS idx_retainage_entries_contract_open
  ON retainage_entries(contract_id)
  WHERE released_at IS NULL;

-- Keep updated_at fresh on mutation (shared helper from earlier migrations).
DROP TRIGGER IF EXISTS set_retainage_entries_updated_at ON retainage_entries;
CREATE TRIGGER set_retainage_entries_updated_at
  BEFORE UPDATE ON retainage_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: project members can SELECT. Only owner/admin/project_manager can
-- INSERT/UPDATE (release). DELETE only for owner/admin.
ALTER TABLE retainage_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS retainage_entries_select ON retainage_entries;
CREATE POLICY retainage_entries_select ON retainage_entries FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS retainage_entries_insert ON retainage_entries;
CREATE POLICY retainage_entries_insert ON retainage_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = retainage_entries.project_id
        AND pm.user_id = (select auth.uid())
        AND pm.role IN ('owner', 'admin', 'project_manager')
    )
  );

-- Release (UPDATE) is gated to owner/admin/project_manager per spec.
DROP POLICY IF EXISTS retainage_entries_update ON retainage_entries;
CREATE POLICY retainage_entries_update ON retainage_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = retainage_entries.project_id
        AND pm.user_id = (select auth.uid())
        AND pm.role IN ('owner', 'admin', 'project_manager')
    )
  );

DROP POLICY IF EXISTS retainage_entries_delete ON retainage_entries;
CREATE POLICY retainage_entries_delete ON retainage_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = retainage_entries.project_id
        AND pm.user_id = (select auth.uid())
        AND pm.role IN ('owner', 'admin')
    )
  );
