-- ═══════════════════════════════════════════════════════════════
-- Migration: project_templates
-- Version: 20260502120003
--
-- Org-scoped templates that materialize into new projects. The
-- structural_payload mirrors `TemplatePayload` from
-- src/types/portfolio.ts.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS project_templates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                text NOT NULL,
  description         text,
  structural_payload  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_project_templates_org
  ON project_templates (organization_id);

ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_templates_select_org_member ON project_templates;
CREATE POLICY project_templates_select_org_member ON project_templates
  FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS project_templates_insert_org_admin ON project_templates;
CREATE POLICY project_templates_insert_org_admin ON project_templates
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS project_templates_update_org_admin ON project_templates;
CREATE POLICY project_templates_update_org_admin ON project_templates
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS project_templates_delete_org_admin ON project_templates;
CREATE POLICY project_templates_delete_org_admin ON project_templates
  FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );
