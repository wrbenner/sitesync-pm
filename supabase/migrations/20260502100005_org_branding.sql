-- ═══════════════════════════════════════════════════════════════
-- Migration: org_branding
-- Version: 20260502100005
--
-- Purpose: per-org brand surface for emails, magic links, sealed PDFs.
-- The sub gets a Procore-look-alike email with Suffolk's logo, not
-- ours.
--
-- organizations already has logo_url; we extend with primary color,
-- support URLs, etc., in a sister table to keep organizations lean.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_branding (
  organization_id   uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,

  -- Logo — preferred storage path inside our `org-branding` bucket.
  -- The presigner returns a public URL for emails / PDFs.
  logo_storage_path text,
  logo_url          text,
  -- Square favicon for the magic-link header.
  favicon_url       text,

  -- Brand tokens. The email template + PDF use these to color the
  -- header band and call-to-action buttons.
  primary_color     text CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color   text CHECK (secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$'),

  -- Customer-facing contact / support points. Magic-link emails
  -- include a "Reply" link auto-addressed back to support_email.
  support_email     text,
  support_url       text,
  legal_name        text,        -- shown in sealed-PDF footer
  privacy_url       text,
  terms_url         text,

  -- Sender identity for outbound emails. We respect this in the
  -- Resend "from" header (subject to domain verification).
  email_from_name   text,
  email_from_address text,

  -- Custom domain for the magic-link share URLs. Falls back to
  -- the platform domain when null.
  custom_domain     text CHECK (custom_domain IS NULL OR custom_domain ~ '^[a-z0-9.-]+$'),

  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid REFERENCES auth.users(id)
);

ALTER TABLE org_branding ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_branding_admin_rw') THEN
    CREATE POLICY org_branding_admin_rw ON org_branding
      FOR ALL
      USING (organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
      ))
      WITH CHECK (organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_branding_member_read') THEN
    CREATE POLICY org_branding_member_read ON org_branding
      FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;
