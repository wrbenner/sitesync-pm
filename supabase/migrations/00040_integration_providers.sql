-- Add new integration provider types: Slack, Teams, SharePoint, Primavera P6

-- Drop and recreate the CHECK constraint to include new provider types
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_type_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_type_check
  CHECK (type IN (
    'quickbooks', 'sage', 'procore_import', 'ms_project',
    'google_drive', 'dropbox', 'autodesk_bim360', 'bluebeam',
    'docusign', 'zapier_webhook', 'email_resend',
    'slack', 'teams', 'sharepoint', 'primavera_p6'
  ));

-- Add syncing status to allowed statuses
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_status_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_status_check
  CHECK (status IN ('connected', 'disconnected', 'error', 'syncing'));

-- Add project_id column (some integrations are project-scoped, not org-scoped)
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id);
CREATE INDEX IF NOT EXISTS idx_integrations_project ON integrations(project_id);

-- RLS: project members can view integrations for their projects
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY integrations_select ON integrations FOR SELECT
    USING (
      organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (select auth.uid()))
      OR project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid()))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY integrations_insert ON integrations FOR INSERT
    WITH CHECK (
      organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin'))
      OR project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin', 'project_manager'))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY integrations_update ON integrations FOR UPDATE
    USING (
      organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin'))
      OR project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin', 'project_manager'))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY integrations_delete ON integrations FOR DELETE
    USING (
      organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin'))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add RLS for integration_sync_log
ALTER TABLE integration_sync_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY integration_sync_log_select ON integration_sync_log FOR SELECT
    USING (
      integration_id IN (SELECT id FROM integrations WHERE
        organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (select auth.uid()))
        OR project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid()))
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Helper: increment webhook failure count
CREATE OR REPLACE FUNCTION increment_webhook_failures(webhook_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE webhooks
  SET failure_count = failure_count + 1, updated_at = now()
  WHERE id = webhook_id;

  -- Auto-disable after 10 consecutive failures
  UPDATE webhooks
  SET active = false
  WHERE id = webhook_id AND failure_count >= 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
