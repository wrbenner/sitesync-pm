-- =============================================================================
-- Submittals — Canonical schema migration (P0-D36)
--
-- Spec: docs/audits/SUBMITTALS_MODULE_BUILD_SPEC_2026-05-06.md
--   Part 3.2 (consolidated migration) — tables, indexes, RLS
--   Appendix B.2 (Procore A6 fields) — alter-table additions
-- Decisions: docs/audits/SUBMITTAL_OPEN_QUESTIONS_RESOLUTION_2026-05-06.md
--   #1 codeset has NO column default (project-setup wizard enforces)
--   #4 federal mode → Lap 3 UI; keep is_federal columns now
-- ADR: docs/audits/ADR_006_PILOT_DATA_ISOLATION_2026-05-04.md
--   Project-membership RLS + soft-pilot user gating via is_pilot_user()
--
-- Style: ADDITIVE only. CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- everywhere. Existing rows in `submittals` and `submittal_approvals` are
-- preserved verbatim. Net-new columns are nullable or have defaults so the
-- 16 live submittals + 6 live approvals don't trip CHECK / NOT NULL on apply.
--
-- Materialised view `submittals_log_mv` and the 6 RPCs in spec Part 3.3 are
-- INTENTIONALLY DEFERRED to D37 per the spec's day-by-day plan — D36 is the
-- structural floor only.
-- =============================================================================


-- ── Section 1: Enums ────────────────────────────────────────────────────────
-- CREATE TYPE has no IF NOT EXISTS; wrap each in DO/EXCEPTION so the
-- migration is idempotent across environments where some types may already
-- exist from prior partial migrations.

DO $$ BEGIN
  CREATE TYPE submittal_kind AS ENUM (
    'shop_drawing',
    'product_data',
    'sample',
    'mockup',
    'test_report',
    'certification',
    'qualification',
    'closeout',
    'warranty',
    'leed_credit',
    'coordination_drawing',
    'maintenance',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE submittal_codeset AS ENUM ('ejcdc', 'aia', 'ufgs', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE submittal_item_kind AS ENUM (
    'cut_sheet',
    'shop_drawing',
    'test_report',
    'sample_photo',
    'calculation',
    'certification',
    'spec_excerpt',
    'cover_letter',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── Section 2: ALTER TABLE submittals — Part 3.2 + Appendix B.2 ─────────────
-- Existing columns from earlier migrations are preserved. Net-new spec
-- columns added below. The legacy `status text CHECK(...)` constraint stays
-- in force; the spec's wider 9-state status set will be wired through the
-- state machine + service layer in D37/D38, not via a constraint swap here
-- (would invalidate the 16 live rows).

ALTER TABLE public.submittals
  -- Spec Part 3.2: classification + spec linking
  ADD COLUMN IF NOT EXISTS kind                       submittal_kind,
  ADD COLUMN IF NOT EXISTS csi_division               text,
  ADD COLUMN IF NOT EXISTS csi_section                text,
  ADD COLUMN IF NOT EXISTS spec_section_paragraph     text,
  ADD COLUMN IF NOT EXISTS spec_pdf_page              int,
  ADD COLUMN IF NOT EXISTS spec_pdf_highlight_rect    jsonb,
  -- Schedule walk-back inputs (existing required_onsite_date / submit_by_date
  -- from migration 14 are kept; the spec's `required_on_site_date` name is
  -- spelled identically so we do not duplicate)
  ADD COLUMN IF NOT EXISTS required_on_site_date      date,
  ADD COLUMN IF NOT EXISTS review_duration_days       int DEFAULT 10,
  ADD COLUMN IF NOT EXISTS buffer_days                int DEFAULT 5,
  ADD COLUMN IF NOT EXISTS schedule_activity_id       uuid,
  ADD COLUMN IF NOT EXISTS is_critical_path           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_federal                 boolean DEFAULT false,
  -- Reviewer + ball-in-court
  ADD COLUMN IF NOT EXISTS responsible_sub_id         uuid REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS current_reviewer_id        uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS current_reviewer_role      text,
  ADD COLUMN IF NOT EXISTS ball_in_court_since        timestamptz,
  -- Revisions (parent_submittal_id already exists from migration 14;
  --             rev_number is new — net new since the legacy column is
  --             `revision_number` which we keep as a synonym until D38)
  ADD COLUMN IF NOT EXISTS rev_number                 int NOT NULL DEFAULT 0,
  -- Pilot isolation per ADR-006
  ADD COLUMN IF NOT EXISTS is_soft_pilot              boolean DEFAULT false,
  -- Iris telemetry (per IRIS_TELEMETRY_SPEC + Day-60 gate)
  ADD COLUMN IF NOT EXISTS iris_preflight_score       numeric,
  ADD COLUMN IF NOT EXISTS iris_preflight_findings    jsonb,
  ADD COLUMN IF NOT EXISTS iris_drafted_by_human      boolean,
  ADD COLUMN IF NOT EXISTS iris_voice_score           numeric,
  -- Hash-chain (per Lap 1)
  ADD COLUMN IF NOT EXISTS hash_chain_prev            text,
  ADD COLUMN IF NOT EXISTS hash_chain_self            text,
  -- Closeout audit
  ADD COLUMN IF NOT EXISTS closed_at                  timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by                  uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS closed_reason              text,
  -- ── Appendix B.2 — Procore A6 form fields ─────────────────────────────
  ADD COLUMN IF NOT EXISTS is_private                 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmed_delivery_date    date,
  ADD COLUMN IF NOT EXISTS actual_delivery_date       date;

-- anticipated_delivery_date is a generated column. It is computed from
-- submit_by_date + lead_time_weeks * 7 days. ADD COLUMN IF NOT EXISTS does
-- not support GENERATED ALWAYS in all PG versions → guard with a catalog
-- existence check. We use lead_time_weeks (existing nullable int) and
-- coalesce to 0 to keep the expression tolerant of legacy nulls.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'submittals'
      AND column_name = 'anticipated_delivery_date'
  ) THEN
    ALTER TABLE public.submittals
      ADD COLUMN anticipated_delivery_date date
      GENERATED ALWAYS AS
        (submit_by_date + (COALESCE(lead_time_weeks, 0) * 7) * INTERVAL '1 day')
      STORED;
  END IF;
END $$;

-- Indexes for the log surface (Part 3.2). Existing primary-key + RLS
-- indexes from prior migrations stay.
CREATE INDEX IF NOT EXISTS idx_submittals_project_status
  ON public.submittals (project_id, status);
CREATE INDEX IF NOT EXISTS idx_submittals_project_csi_section
  ON public.submittals (project_id, csi_section);
CREATE INDEX IF NOT EXISTS idx_submittals_current_reviewer_active
  ON public.submittals (current_reviewer_id)
  WHERE status NOT IN ('approved', 'rejected', 'closed', 'void');
CREATE INDEX IF NOT EXISTS idx_submittals_required_on_site_active
  ON public.submittals (required_on_site_date)
  WHERE status NOT IN ('approved', 'closed', 'void');


-- ── Section 3: submittal_reviewers (the chain) ──────────────────────────────
-- Spec Part 3.2 §3. Net-new table; the legacy `submittal_approvals` (6 rows)
-- is left untouched here — D38 service refactor will migrate consumers and
-- decide on a data-copy + drop strategy then.

CREATE TABLE IF NOT EXISTS public.submittal_reviewers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id       uuid NOT NULL REFERENCES public.submittals(id) ON DELETE CASCADE,
  sequence           int NOT NULL,
  reviewer_id        uuid REFERENCES auth.users(id),
  reviewer_role      text,
  reviewer_org_id    uuid REFERENCES public.organizations(id),
  reviewer_email     text,
  parallel_group     int,
  due_date           date,
  received_at        timestamptz,
  responded_at       timestamptz,
  disposition        text,
  comments           text,
  stamp_url          text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submittal_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_submittal_reviewers_submittal
  ON public.submittal_reviewers (submittal_id);
CREATE INDEX IF NOT EXISTS idx_submittal_reviewers_reviewer
  ON public.submittal_reviewers (reviewer_id)
  WHERE responded_at IS NULL;

ALTER TABLE public.submittal_reviewers ENABLE ROW LEVEL SECURITY;


-- ── Section 4: submittal_items (file-level OCR'd package contents) ──────────

CREATE TABLE IF NOT EXISTS public.submittal_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id       uuid NOT NULL REFERENCES public.submittals(id) ON DELETE CASCADE,
  filename           text NOT NULL,
  storage_path       text NOT NULL,
  mime_type          text,
  size_bytes         bigint,
  kind               submittal_item_kind,
  manufacturer       text,
  product_name       text,
  product_model      text,
  ocr_text           text,
  page_count         int,
  uploaded_by        uuid REFERENCES auth.users(id),
  uploaded_via       text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submittal_items_submittal
  ON public.submittal_items (submittal_id);
CREATE INDEX IF NOT EXISTS idx_submittal_items_ocr_fts
  ON public.submittal_items USING gin (to_tsvector('english', coalesce(ocr_text, '')));

ALTER TABLE public.submittal_items ENABLE ROW LEVEL SECURITY;


-- ── Section 5: submittal_markup (annotations, separate from items) ──────────

CREATE TABLE IF NOT EXISTS public.submittal_markup (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_item_id  uuid NOT NULL REFERENCES public.submittal_items(id) ON DELETE CASCADE,
  rev_number         int NOT NULL,
  pdf_page           int NOT NULL,
  geometry           jsonb NOT NULL,
  kind               text NOT NULL,
  comment_md         text,
  created_by         uuid REFERENCES auth.users(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submittal_markup_item
  ON public.submittal_markup (submittal_item_id);

ALTER TABLE public.submittal_markup ENABLE ROW LEVEL SECURITY;


-- ── Section 6: ALTER TABLE transmittals — link to submittals ────────────────
-- The transmittals table already exists (no rows yet). Spec Part 3.2 §6
-- adds these columns.

ALTER TABLE public.transmittals
  ADD COLUMN IF NOT EXISTS submittal_id      uuid REFERENCES public.submittals(id),
  ADD COLUMN IF NOT EXISTS kind              text,
  ADD COLUMN IF NOT EXISTS pdf_url           text,
  ADD COLUMN IF NOT EXISTS email_message_id  text;


-- ── Section 7: submittal_magic_links ────────────────────────────────────────
-- Narrower-scope token than the generic magic_link_tokens table — bound to
-- a single submittal + intent, with explicit expiry + use audit.

CREATE TABLE IF NOT EXISTS public.submittal_magic_links (
  token              text PRIMARY KEY,
  submittal_id       uuid NOT NULL REFERENCES public.submittals(id) ON DELETE CASCADE,
  intent             text NOT NULL CHECK (intent IN ('sub_upload', 'reviewer_review')),
  email              text NOT NULL,
  expires_at         timestamptz NOT NULL,
  used_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submittal_magic_links_submittal
  ON public.submittal_magic_links (submittal_id);
CREATE INDEX IF NOT EXISTS idx_submittal_magic_links_active
  ON public.submittal_magic_links (expires_at)
  WHERE used_at IS NULL;

ALTER TABLE public.submittal_magic_links ENABLE ROW LEVEL SECURITY;


-- ── Section 8: submittal_packages (Procore parity, first-class) ─────────────

CREATE TABLE IF NOT EXISTS public.submittal_packages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  number              int NOT NULL,
  title               text NOT NULL,
  description         text,
  responsible_sub_id  uuid REFERENCES public.organizations(id),
  csi_section         text,
  status              text NOT NULL DEFAULT 'open',
  distribution_list   jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES auth.users(id),
  UNIQUE (project_id, number)
);

CREATE INDEX IF NOT EXISTS idx_submittal_packages_project
  ON public.submittal_packages (project_id);

ALTER TABLE public.submittal_packages ENABLE ROW LEVEL SECURITY;

-- Backref column on submittals
ALTER TABLE public.submittals
  ADD COLUMN IF NOT EXISTS submittal_package_id uuid REFERENCES public.submittal_packages(id);


-- ── Section 9: submittal_workflow_templates (per-trade defaults) ────────────

CREATE TABLE IF NOT EXISTS public.submittal_workflow_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id   uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name         text NOT NULL,
  trade        text,
  steps        jsonb NOT NULL,
  is_default   boolean DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- Either project-scoped OR company-scoped (not both null) — uniqueness
  -- key picks the scope that's set. Hand-roll the unique by using two
  -- partial indexes so a row can target one scope cleanly.
  CHECK (project_id IS NOT NULL OR company_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_submittal_workflow_templates_project_name
  ON public.submittal_workflow_templates (project_id, name)
  WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_submittal_workflow_templates_company_name
  ON public.submittal_workflow_templates (company_id, name)
  WHERE company_id IS NOT NULL AND project_id IS NULL;

ALTER TABLE public.submittal_workflow_templates ENABLE ROW LEVEL SECURITY;


-- ── Section 10: submittal_emails (Procore parity: Emails tab) ───────────────

CREATE TABLE IF NOT EXISTS public.submittal_emails (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id    uuid NOT NULL REFERENCES public.submittals(id) ON DELETE CASCADE,
  direction       text NOT NULL CHECK (direction IN ('in', 'out')),
  message_id      text NOT NULL,
  subject         text,
  from_addr       text,
  to_addrs        text[],
  cc_addrs        text[],
  body_html       text,
  body_text       text,
  attachments     jsonb,
  received_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id)
);

CREATE INDEX IF NOT EXISTS idx_submittal_emails_submittal
  ON public.submittal_emails (submittal_id);

ALTER TABLE public.submittal_emails ENABLE ROW LEVEL SECURITY;


-- ── Section 11: submittal_change_history (Procore parity, hash-chained) ─────

CREATE TABLE IF NOT EXISTS public.submittal_change_history (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id       uuid NOT NULL REFERENCES public.submittals(id) ON DELETE CASCADE,
  action_at          timestamptz NOT NULL DEFAULT now(),
  action_by          uuid REFERENCES auth.users(id),
  field              text,
  from_value         jsonb,
  to_value           jsonb,
  hash_chain_prev    text,
  hash_chain_self    text
);

CREATE INDEX IF NOT EXISTS idx_submittal_change_history_submittal
  ON public.submittal_change_history (submittal_id, action_at DESC);

ALTER TABLE public.submittal_change_history ENABLE ROW LEVEL SECURITY;


-- ── Section 12: submittal_distributions (every redistribute logs here) ──────

CREATE TABLE IF NOT EXISTS public.submittal_distributions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id       uuid NOT NULL REFERENCES public.submittals(id) ON DELETE CASCADE,
  distributed_at     timestamptz NOT NULL DEFAULT now(),
  distributed_by     uuid REFERENCES auth.users(id),
  to_user_ids        uuid[],
  to_emails          text[],
  message            text,
  pdf_url            text
);

CREATE INDEX IF NOT EXISTS idx_submittal_distributions_submittal
  ON public.submittal_distributions (submittal_id, distributed_at DESC);

ALTER TABLE public.submittal_distributions ENABLE ROW LEVEL SECURITY;


-- ── Section 13: submittal_settings (project-level config) ───────────────────
-- IMPORTANT — codeset has NO column default per OPEN_QUESTIONS_RESOLUTION
-- decision #1: the project-setup wizard added in P0-D39 must require the
-- admin to pick one of EJCDC / AIA / UFGS / Custom before submittals can
-- be created. Deliberately NULL-able is wrong (the constraint is "no value
-- without a wizard answer"); deliberately default-less is correct.
--
-- We make it NOT NULL so the wizard can't bypass it, and rely on the wizard
-- INSERT to satisfy the requirement. Existing projects (if any) need a
-- one-time wizard pass before they can use submittal settings — surfaced
-- by D39 work, not this migration.

CREATE TABLE IF NOT EXISTS public.submittal_settings (
  project_id                          uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  codeset                             submittal_codeset NOT NULL,
  custom_codes                        jsonb,
  default_sla_days                    int NOT NULL DEFAULT 10,
  default_buffer_days                 int NOT NULL DEFAULT 5,
  default_submittal_manager_id        uuid REFERENCES auth.users(id),
  default_distribution                jsonb NOT NULL DEFAULT '[]'::jsonb,
  include_spec_section_number         boolean NOT NULL DEFAULT true,
  numbering_format                    text NOT NULL DEFAULT '{spec_section}-{seq}',
  is_federal                          boolean NOT NULL DEFAULT false,
  ufgs_approving_authority            text,
  -- workflow toggles (Procore parity)
  allow_approvers_to_add_reviewers    boolean NOT NULL DEFAULT true,
  approvers_required_by_default       boolean NOT NULL DEFAULT true,
  enable_reject_workflow              boolean NOT NULL DEFAULT false,
  enable_dynamic_due_dates            boolean NOT NULL DEFAULT true,
  enable_schedule_linking             boolean NOT NULL DEFAULT true,
  private_by_default                  boolean NOT NULL DEFAULT false,
  enable_qr_codes                     boolean NOT NULL DEFAULT true,
  -- email matrix (Procore parity)
  email_notifications                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  enable_overdue_reminders            boolean NOT NULL DEFAULT true,
  allow_attachment_download_no_login  boolean NOT NULL DEFAULT true,
  -- AI / SiteSync-only
  ai_preflight_enabled                boolean NOT NULL DEFAULT true,
  ai_preflight_block_threshold        numeric,                       -- null = warn-only per resolution #2
  voice_review_enabled                boolean NOT NULL DEFAULT false,
  closeout_template                   jsonb,
  created_at                          timestamptz NOT NULL DEFAULT now(),
  updated_at                          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.submittal_settings ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN public.submittal_settings.codeset IS
  'Disposition codeset: ejcdc / aia / ufgs / custom. NO DEFAULT — the '
  'project-setup wizard (P0-D39) must explicitly pick one. See '
  'docs/audits/SUBMITTAL_OPEN_QUESTIONS_RESOLUTION_2026-05-06.md decision #1.';
COMMENT ON COLUMN public.submittal_settings.is_federal IS
  'Federal/UFGS toggle. Schema column kept for forward-compat per decision '
  '#4; UI / WH-347 / DBE-MBE wiring deferred to Lap 3.';


-- ── Section 14: RLS policies — ADR-006 (project-member + soft-pilot gate) ───
-- Pattern:
--   1. Caller must be a project_member of the row's project (standard wall).
--   2. If the project's organization has is_soft_pilot=TRUE, caller must
--      also be a named pilot user via is_pilot_user() (per ADR-006). This
--      keeps a non-pilot collaborator who happens to be on a pilot project's
--      member list from seeing pilot data.
-- Helper: public.is_pilot_project(uuid) — STABLE SECURITY DEFINER. Like
-- public.current_user_organization_id() in the profiles fix, the function
-- runs as its owner so the JOIN-to-organizations doesn't re-trigger any
-- caller-side RLS.

CREATE OR REPLACE FUNCTION public.is_pilot_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(o.is_soft_pilot, false)
  FROM public.projects p
  LEFT JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.id = p_project_id
$$;

REVOKE ALL ON FUNCTION public.is_pilot_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_pilot_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pilot_project(uuid) TO service_role;

COMMENT ON FUNCTION public.is_pilot_project(uuid) IS
  'TRUE iff the project belongs to a soft-pilot organization. Used by '
  'submittal_* RLS policies to add the pilot-user gate per ADR-006.';

-- 14a. submittal_reviewers — project-member + pilot-gate via parent submittal
DROP POLICY IF EXISTS submittal_reviewers_project_member ON public.submittal_reviewers;
CREATE POLICY submittal_reviewers_project_member ON public.submittal_reviewers
  FOR ALL
  USING (
    submittal_id IN (
      SELECT s.id FROM public.submittals s
      JOIN public.project_members pm
        ON pm.project_id = s.project_id AND pm.user_id = auth.uid()
      WHERE NOT public.is_pilot_project(s.project_id)
         OR public.is_pilot_user(auth.uid())
    )
  );

-- 14b. submittal_items — same gate via parent submittal
DROP POLICY IF EXISTS submittal_items_project_member ON public.submittal_items;
CREATE POLICY submittal_items_project_member ON public.submittal_items
  FOR ALL
  USING (
    submittal_id IN (
      SELECT s.id FROM public.submittals s
      JOIN public.project_members pm
        ON pm.project_id = s.project_id AND pm.user_id = auth.uid()
      WHERE NOT public.is_pilot_project(s.project_id)
         OR public.is_pilot_user(auth.uid())
    )
  );

-- 14c. submittal_markup — gate via grandparent submittal
DROP POLICY IF EXISTS submittal_markup_project_member ON public.submittal_markup;
CREATE POLICY submittal_markup_project_member ON public.submittal_markup
  FOR ALL
  USING (
    submittal_item_id IN (
      SELECT i.id FROM public.submittal_items i
      JOIN public.submittals s ON s.id = i.submittal_id
      JOIN public.project_members pm
        ON pm.project_id = s.project_id AND pm.user_id = auth.uid()
      WHERE NOT public.is_pilot_project(s.project_id)
         OR public.is_pilot_user(auth.uid())
    )
  );

-- 14d. submittal_magic_links — token holder access is via SECURITY DEFINER
-- redemption RPCs (not in this migration). For DDL-side, lock direct
-- access to authenticated project members of the parent submittal —
-- matches the pattern of the rest of the family.
DROP POLICY IF EXISTS submittal_magic_links_project_member ON public.submittal_magic_links;
CREATE POLICY submittal_magic_links_project_member ON public.submittal_magic_links
  FOR ALL
  USING (
    submittal_id IN (
      SELECT s.id FROM public.submittals s
      JOIN public.project_members pm
        ON pm.project_id = s.project_id AND pm.user_id = auth.uid()
      WHERE NOT public.is_pilot_project(s.project_id)
         OR public.is_pilot_user(auth.uid())
    )
  );

-- 14e. submittal_packages — direct project-member gate
DROP POLICY IF EXISTS submittal_packages_project_member ON public.submittal_packages;
CREATE POLICY submittal_packages_project_member ON public.submittal_packages
  FOR ALL
  USING (
    project_id IN (
      SELECT pm.project_id FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
    )
    AND (
      NOT public.is_pilot_project(project_id)
      OR public.is_pilot_user(auth.uid())
    )
  );

-- 14f. submittal_workflow_templates — project-scoped rows use the project
-- gate; company-scoped rows use organization_members. Soft-pilot gate
-- applies only to project-scoped rows.
DROP POLICY IF EXISTS submittal_workflow_templates_access ON public.submittal_workflow_templates;
CREATE POLICY submittal_workflow_templates_access ON public.submittal_workflow_templates
  FOR ALL
  USING (
    -- project-scoped
    (project_id IS NOT NULL
      AND project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
      )
      AND (
        NOT public.is_pilot_project(project_id)
        OR public.is_pilot_user(auth.uid())
      )
    )
    OR
    -- company-scoped (no pilot gate; templates are reusable definitions)
    (company_id IS NOT NULL AND project_id IS NULL
      AND company_id IN (
        SELECT om.organization_id::uuid FROM public.organization_members om
        WHERE om.user_id = auth.uid()
      )
    )
  );

-- 14g. submittal_emails — project-member + pilot gate via parent submittal
DROP POLICY IF EXISTS submittal_emails_project_member ON public.submittal_emails;
CREATE POLICY submittal_emails_project_member ON public.submittal_emails
  FOR ALL
  USING (
    submittal_id IN (
      SELECT s.id FROM public.submittals s
      JOIN public.project_members pm
        ON pm.project_id = s.project_id AND pm.user_id = auth.uid()
      WHERE NOT public.is_pilot_project(s.project_id)
         OR public.is_pilot_user(auth.uid())
    )
  );

-- 14h. submittal_change_history — same gate
DROP POLICY IF EXISTS submittal_change_history_project_member ON public.submittal_change_history;
CREATE POLICY submittal_change_history_project_member ON public.submittal_change_history
  FOR ALL
  USING (
    submittal_id IN (
      SELECT s.id FROM public.submittals s
      JOIN public.project_members pm
        ON pm.project_id = s.project_id AND pm.user_id = auth.uid()
      WHERE NOT public.is_pilot_project(s.project_id)
         OR public.is_pilot_user(auth.uid())
    )
  );

-- 14i. submittal_distributions — same gate
DROP POLICY IF EXISTS submittal_distributions_project_member ON public.submittal_distributions;
CREATE POLICY submittal_distributions_project_member ON public.submittal_distributions
  FOR ALL
  USING (
    submittal_id IN (
      SELECT s.id FROM public.submittals s
      JOIN public.project_members pm
        ON pm.project_id = s.project_id AND pm.user_id = auth.uid()
      WHERE NOT public.is_pilot_project(s.project_id)
         OR public.is_pilot_user(auth.uid())
    )
  );

-- 14j. submittal_settings — direct project-member gate
DROP POLICY IF EXISTS submittal_settings_project_member ON public.submittal_settings;
CREATE POLICY submittal_settings_project_member ON public.submittal_settings
  FOR ALL
  USING (
    project_id IN (
      SELECT pm.project_id FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
    )
    AND (
      NOT public.is_pilot_project(project_id)
      OR public.is_pilot_user(auth.uid())
    )
  );


-- ── Section 15: Pilot-gate hardening on the existing submittals policy ──────
-- The existing submittals_project_member policy from migration 00052 (or
-- equivalent) only checked project membership. Layer on the pilot gate so
-- new soft-pilot orgs respect ADR-006 even on pre-existing submittal rows.

DROP POLICY IF EXISTS submittals_project_member_pilot_gated ON public.submittals;
CREATE POLICY submittals_project_member_pilot_gated ON public.submittals
  FOR ALL
  USING (
    project_id IN (
      SELECT pm.project_id FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
    )
    AND (
      NOT public.is_pilot_project(project_id)
      OR public.is_pilot_user(auth.uid())
    )
  );


-- =============================================================================
-- End of canonical schema migration (P0-D36).
--
-- D37 (next PR): submittals_log_mv materialised view + pg_cron refresh +
--                the 6 RPCs in spec Part 3.3 (submittal_advance_status,
--                submittal_record_disposition, submittal_create_revision,
--                submittal_distribute, submittal_close,
--                submittal_compute_required_on_site).
--
-- D38 (later PR): service-layer refactor; data migration from
--                submittal_approvals → submittal_reviewers; legacy column
--                rename plan (revision_number → rev_number, current_reviewer
--                → current_reviewer_id/_role).
-- =============================================================================
