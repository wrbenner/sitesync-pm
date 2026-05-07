-- ═══════════════════════════════════════════════════════════════
-- Migration: RFI P2c — cross-module + settings + reports
-- Version:   20260507000040
--
-- Drives:    P2c phases 1-4 from the mega prompt.
--
-- Scope (DB only; UI lives in src/):
--
--   1. rfi_links              — cross-module links to submittal /
--                               drawing / schedule / budget / punch /
--                               daily_log / meeting / rfi /
--                               change_order with link_kind enum.
--   2. rfi_drawing_pins       — pin coords (x, y, drawing_id) per RFI.
--   3. project_spec_book      — CSI section catalog per project +
--                               responsible_party for Iris.
--   4. Settings tables (Phase 3):
--        project_rfi_workflows         — workflow templates
--        project_rfi_response_types    — response type config
--        project_rfi_custom_fields     — custom field defs
--        rfi_custom_values             — per-RFI custom values
--        project_rfi_permissions       — role × action matrix
--        project_rfi_settings          — numbering rules
--        project_rfi_notification_prefs — per-event × per-channel
--        user_rfi_notification_overrides — per-user override
--   5. Reports tables (Phase 4):
--        rfi_custom_reports     — saved custom report defs
--        rfi_scheduled_reports  — scheduled email deliveries
--
-- Idempotent: safe to rerun.
-- ═══════════════════════════════════════════════════════════════

-- ── Phase 1.1 — rfi_links ──────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfi_link_target') THEN
    CREATE TYPE public.rfi_link_target AS ENUM (
      'submittal', 'drawing', 'schedule_phase', 'budget_item',
      'punch_item', 'daily_log', 'meeting', 'rfi', 'change_order'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfi_link_kind') THEN
    CREATE TYPE public.rfi_link_kind AS ENUM (
      'blocks', 'blocked_by', 'related', 'derived_from', 'converts_to'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.rfi_links (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id       UUID NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  target_type  public.rfi_link_target NOT NULL,
  target_id    UUID NOT NULL,
  link_kind    public.rfi_link_kind NOT NULL DEFAULT 'related',
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rfi_id, target_type, target_id, link_kind)
);

CREATE INDEX IF NOT EXISTS idx_rfi_links_rfi ON public.rfi_links(rfi_id);
CREATE INDEX IF NOT EXISTS idx_rfi_links_target ON public.rfi_links(target_type, target_id);

ALTER TABLE public.rfi_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rfi_links_select ON public.rfi_links;
CREATE POLICY rfi_links_select ON public.rfi_links FOR SELECT
  USING (is_project_member((SELECT project_id FROM rfis WHERE rfis.id = rfi_id)));

DROP POLICY IF EXISTS rfi_links_insert ON public.rfi_links;
CREATE POLICY rfi_links_insert ON public.rfi_links FOR INSERT
  WITH CHECK (is_project_role((SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
                              ARRAY['owner','admin','member']));

DROP POLICY IF EXISTS rfi_links_delete ON public.rfi_links;
CREATE POLICY rfi_links_delete ON public.rfi_links FOR DELETE
  USING (
    created_by = (SELECT auth.uid())
    OR is_project_role((SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
                       ARRAY['owner','admin'])
  );


-- ── Phase 2.1 — rfi_drawing_pins ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.rfi_drawing_pins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id      UUID NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  drawing_id  UUID NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  x           NUMERIC NOT NULL,            -- 0-1 normalized
  y           NUMERIC NOT NULL,            -- 0-1 normalized
  page        INTEGER DEFAULT 1,
  note        TEXT,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rfi_drawing_pins_rfi ON public.rfi_drawing_pins(rfi_id);
CREATE INDEX IF NOT EXISTS idx_rfi_drawing_pins_drawing ON public.rfi_drawing_pins(drawing_id);

ALTER TABLE public.rfi_drawing_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rfi_drawing_pins_select ON public.rfi_drawing_pins;
CREATE POLICY rfi_drawing_pins_select ON public.rfi_drawing_pins FOR SELECT
  USING (is_project_member((SELECT project_id FROM rfis WHERE rfis.id = rfi_id)));

DROP POLICY IF EXISTS rfi_drawing_pins_insert ON public.rfi_drawing_pins;
CREATE POLICY rfi_drawing_pins_insert ON public.rfi_drawing_pins FOR INSERT
  WITH CHECK (is_project_role((SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
                              ARRAY['owner','admin','member']));

DROP POLICY IF EXISTS rfi_drawing_pins_delete ON public.rfi_drawing_pins;
CREATE POLICY rfi_drawing_pins_delete ON public.rfi_drawing_pins FOR DELETE
  USING (
    created_by = (SELECT auth.uid())
    OR is_project_role((SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
                       ARRAY['owner','admin'])
  );


-- ── Phase 2.2 — project_spec_book ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_spec_book (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_code        TEXT NOT NULL,                  -- "09 30 00"
  section_title       TEXT NOT NULL,
  division            TEXT,                            -- "09 — Finishes"
  responsible_party   TEXT,                            -- firm name (free text)
  responsible_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes               TEXT,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, section_code)
);

CREATE INDEX IF NOT EXISTS idx_project_spec_book_project
  ON public.project_spec_book(project_id, section_code);

ALTER TABLE public.project_spec_book ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_spec_book_select ON public.project_spec_book;
CREATE POLICY project_spec_book_select ON public.project_spec_book FOR SELECT
  USING (is_project_member(project_id));

DROP POLICY IF EXISTS project_spec_book_insert ON public.project_spec_book;
CREATE POLICY project_spec_book_insert ON public.project_spec_book FOR INSERT
  WITH CHECK (is_project_role(project_id, ARRAY['owner','admin']));

DROP POLICY IF EXISTS project_spec_book_update ON public.project_spec_book;
CREATE POLICY project_spec_book_update ON public.project_spec_book FOR UPDATE
  USING (is_project_role(project_id, ARRAY['owner','admin']))
  WITH CHECK (is_project_role(project_id, ARRAY['owner','admin']));

DROP POLICY IF EXISTS project_spec_book_delete ON public.project_spec_book;
CREATE POLICY project_spec_book_delete ON public.project_spec_book FOR DELETE
  USING (is_project_role(project_id, ARRAY['owner','admin']));


-- ── Phase 3.1 — project_rfi_workflows ──────────────────────────
CREATE TABLE IF NOT EXISTS public.project_rfi_workflows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  -- stages: array of { name, sla_days, ball_in_court_role, response_type_filter[] }
  stages      JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

ALTER TABLE public.project_rfi_workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_rfi_workflows_select ON public.project_rfi_workflows;
CREATE POLICY project_rfi_workflows_select ON public.project_rfi_workflows FOR SELECT
  USING (is_project_member(project_id));

DROP POLICY IF EXISTS project_rfi_workflows_admin ON public.project_rfi_workflows;
CREATE POLICY project_rfi_workflows_admin ON public.project_rfi_workflows FOR ALL
  USING (is_project_role(project_id, ARRAY['owner','admin']))
  WITH CHECK (is_project_role(project_id, ARRAY['owner','admin']));


-- ── Phase 3.2 — project_rfi_response_types ─────────────────────
CREATE TABLE IF NOT EXISTS public.project_rfi_response_types (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type_code              TEXT NOT NULL,
  label                  TEXT NOT NULL,
  color                  TEXT,
  counts_as_answered     BOOLEAN NOT NULL DEFAULT true,
  requires_resubmittal   BOOLEAN NOT NULL DEFAULT false,
  sort_order             INTEGER NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, type_code)
);

ALTER TABLE public.project_rfi_response_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_rfi_response_types_select ON public.project_rfi_response_types;
CREATE POLICY project_rfi_response_types_select ON public.project_rfi_response_types FOR SELECT
  USING (is_project_member(project_id));
DROP POLICY IF EXISTS project_rfi_response_types_admin ON public.project_rfi_response_types;
CREATE POLICY project_rfi_response_types_admin ON public.project_rfi_response_types FOR ALL
  USING (is_project_role(project_id, ARRAY['owner','admin']))
  WITH CHECK (is_project_role(project_id, ARRAY['owner','admin']));


-- ── Phase 3.3 — project_rfi_custom_fields + rfi_custom_values ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfi_custom_field_type') THEN
    CREATE TYPE public.rfi_custom_field_type AS ENUM ('text','number','date','select','user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.project_rfi_custom_fields (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  field_code               TEXT NOT NULL,                -- stable id used by rfi_custom_values
  label                    TEXT NOT NULL,
  field_type               public.rfi_custom_field_type NOT NULL,
  options                  TEXT[] NOT NULL DEFAULT '{}',  -- for select
  required                 BOOLEAN NOT NULL DEFAULT false,
  applies_to_workflow_id   UUID REFERENCES public.project_rfi_workflows(id) ON DELETE SET NULL,
  sort_order               INTEGER NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, field_code)
);

ALTER TABLE public.project_rfi_custom_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_rfi_custom_fields_select ON public.project_rfi_custom_fields;
CREATE POLICY project_rfi_custom_fields_select ON public.project_rfi_custom_fields FOR SELECT
  USING (is_project_member(project_id));
DROP POLICY IF EXISTS project_rfi_custom_fields_admin ON public.project_rfi_custom_fields;
CREATE POLICY project_rfi_custom_fields_admin ON public.project_rfi_custom_fields FOR ALL
  USING (is_project_role(project_id, ARRAY['owner','admin']))
  WITH CHECK (is_project_role(project_id, ARRAY['owner','admin']));

CREATE TABLE IF NOT EXISTS public.rfi_custom_values (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id      UUID NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  field_code  TEXT NOT NULL,
  value       JSONB,
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rfi_id, field_code)
);

CREATE INDEX IF NOT EXISTS idx_rfi_custom_values_rfi ON public.rfi_custom_values(rfi_id);

ALTER TABLE public.rfi_custom_values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rfi_custom_values_select ON public.rfi_custom_values;
CREATE POLICY rfi_custom_values_select ON public.rfi_custom_values FOR SELECT
  USING (is_project_member((SELECT project_id FROM rfis WHERE rfis.id = rfi_id)));
DROP POLICY IF EXISTS rfi_custom_values_write ON public.rfi_custom_values;
CREATE POLICY rfi_custom_values_write ON public.rfi_custom_values FOR ALL
  USING (is_project_role((SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
                         ARRAY['owner','admin','member']))
  WITH CHECK (is_project_role((SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
                              ARRAY['owner','admin','member']));


-- ── Phase 3.4 — project_rfi_permissions matrix ─────────────────
-- One row per (project_id, role, action) cell. Boolean `allowed` is
-- the sole truth. Defaults seeded below to mirror the prior hardcoded
-- gates so existing flows don't break the moment this lands.
CREATE TABLE IF NOT EXISTS public.project_rfi_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,        -- 'owner' | 'admin' | 'manager' | 'member' | 'sub' | 'external' | 'viewer'
  action      TEXT NOT NULL,        -- 'create' | 'respond' | 'mark_official' | 'close' | 'reopen'
                                    -- | 'see_private' | 'distribute' | 'export' | 'change_settings' | 'delete'
  allowed     BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, role, action)
);

ALTER TABLE public.project_rfi_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_rfi_permissions_select ON public.project_rfi_permissions;
CREATE POLICY project_rfi_permissions_select ON public.project_rfi_permissions FOR SELECT
  USING (is_project_member(project_id));
DROP POLICY IF EXISTS project_rfi_permissions_admin ON public.project_rfi_permissions;
CREATE POLICY project_rfi_permissions_admin ON public.project_rfi_permissions FOR ALL
  USING (is_project_role(project_id, ARRAY['owner','admin']))
  WITH CHECK (is_project_role(project_id, ARRAY['owner','admin']));


-- ── Phase 3.5 — project_rfi_settings (numbering + misc) ────────
CREATE TABLE IF NOT EXISTS public.project_rfi_settings (
  project_id          UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  number_prefix       TEXT NOT NULL DEFAULT 'RFI-',
  number_suffix       TEXT NOT NULL DEFAULT '',
  number_padding      INTEGER NOT NULL DEFAULT 3,
  per_trade_sequences BOOLEAN NOT NULL DEFAULT false,
  manual_override     BOOLEAN NOT NULL DEFAULT false,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_rfi_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_rfi_settings_select ON public.project_rfi_settings;
CREATE POLICY project_rfi_settings_select ON public.project_rfi_settings FOR SELECT
  USING (is_project_member(project_id));
DROP POLICY IF EXISTS project_rfi_settings_admin ON public.project_rfi_settings;
CREATE POLICY project_rfi_settings_admin ON public.project_rfi_settings FOR ALL
  USING (is_project_role(project_id, ARRAY['owner','admin']))
  WITH CHECK (is_project_role(project_id, ARRAY['owner','admin']));


-- ── Phase 3.6 — notifications config ───────────────────────────
CREATE TABLE IF NOT EXISTS public.project_rfi_notification_prefs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event       TEXT NOT NULL,         -- created | assigned | responded | closed | overdue | mention | distribute_delivered | distribute_bounced
  channel     TEXT NOT NULL,         -- email | in_app | sms
  enabled     BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (project_id, event, channel)
);

ALTER TABLE public.project_rfi_notification_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_rfi_notification_prefs_select ON public.project_rfi_notification_prefs;
CREATE POLICY project_rfi_notification_prefs_select ON public.project_rfi_notification_prefs FOR SELECT
  USING (is_project_member(project_id));
DROP POLICY IF EXISTS project_rfi_notification_prefs_admin ON public.project_rfi_notification_prefs;
CREATE POLICY project_rfi_notification_prefs_admin ON public.project_rfi_notification_prefs FOR ALL
  USING (is_project_role(project_id, ARRAY['owner','admin']))
  WITH CHECK (is_project_role(project_id, ARRAY['owner','admin']));

CREATE TABLE IF NOT EXISTS public.user_rfi_notification_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event       TEXT NOT NULL,
  channel     TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL,
  UNIQUE (user_id, project_id, event, channel)
);

ALTER TABLE public.user_rfi_notification_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_rfi_notification_overrides_self ON public.user_rfi_notification_overrides;
CREATE POLICY user_rfi_notification_overrides_self ON public.user_rfi_notification_overrides FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));


-- ── Phase 4 — Reports ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rfi_custom_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  -- definition: { chart, x_axis, y_axis, filters, group_by }
  definition  JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_shared   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rfi_custom_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rfi_custom_reports_select ON public.rfi_custom_reports;
CREATE POLICY rfi_custom_reports_select ON public.rfi_custom_reports FOR SELECT
  USING (
    is_project_member(project_id) AND (
      is_shared = true OR owner_id = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS rfi_custom_reports_write ON public.rfi_custom_reports;
CREATE POLICY rfi_custom_reports_write ON public.rfi_custom_reports FOR ALL
  USING (
    owner_id = (SELECT auth.uid())
    OR is_project_role(project_id, ARRAY['owner','admin'])
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR is_project_role(project_id, ARRAY['owner','admin'])
  );

CREATE TABLE IF NOT EXISTS public.rfi_scheduled_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_id     UUID REFERENCES public.rfi_custom_reports(id) ON DELETE CASCADE,
  -- canned report key (when report_id is null)
  canned_key    TEXT,
  cadence       TEXT NOT NULL,                 -- daily | weekly | monthly
  recipients    TEXT[] NOT NULL DEFAULT '{}',  -- emails
  subject_tmpl  TEXT,
  last_sent_at  TIMESTAMPTZ,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (report_id IS NOT NULL OR canned_key IS NOT NULL)
);

ALTER TABLE public.rfi_scheduled_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rfi_scheduled_reports_select ON public.rfi_scheduled_reports;
CREATE POLICY rfi_scheduled_reports_select ON public.rfi_scheduled_reports FOR SELECT
  USING (is_project_member(project_id));
DROP POLICY IF EXISTS rfi_scheduled_reports_admin ON public.rfi_scheduled_reports;
CREATE POLICY rfi_scheduled_reports_admin ON public.rfi_scheduled_reports FOR ALL
  USING (is_project_role(project_id, ARRAY['owner','admin']))
  WITH CHECK (is_project_role(project_id, ARRAY['owner','admin']));


-- ── Default seeds (one row per project for the small tables) ───

-- 5 default workflow templates per project.
INSERT INTO public.project_rfi_workflows (project_id, name, stages, is_default)
SELECT p.id, 'Standard',
  '[{"name":"Open","sla_days":7,"ball_in_court_role":"member"},{"name":"Under Review","sla_days":3,"ball_in_court_role":"admin"},{"name":"Answered","sla_days":2,"ball_in_court_role":"member"},{"name":"Closed","sla_days":0,"ball_in_court_role":"admin"}]'::jsonb,
  true
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM public.project_rfi_workflows w WHERE w.project_id = p.id AND w.name = 'Standard');

INSERT INTO public.project_rfi_workflows (project_id, name, stages, is_default)
SELECT p.id, 'Design',
  '[{"name":"Open","sla_days":5,"ball_in_court_role":"member"},{"name":"Designer Review","sla_days":7,"ball_in_court_role":"member"},{"name":"Answered","sla_days":2,"ball_in_court_role":"member"},{"name":"Closed","sla_days":0,"ball_in_court_role":"admin"}]'::jsonb,
  false
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM public.project_rfi_workflows w WHERE w.project_id = p.id AND w.name = 'Design');

INSERT INTO public.project_rfi_workflows (project_id, name, stages, is_default)
SELECT p.id, 'Cost Impact',
  '[{"name":"Open","sla_days":3,"ball_in_court_role":"admin"},{"name":"Cost Review","sla_days":5,"ball_in_court_role":"admin"},{"name":"Owner Approval","sla_days":7,"ball_in_court_role":"owner"},{"name":"Closed","sla_days":0,"ball_in_court_role":"admin"}]'::jsonb,
  false
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM public.project_rfi_workflows w WHERE w.project_id = p.id AND w.name = 'Cost Impact');

INSERT INTO public.project_rfi_workflows (project_id, name, stages, is_default)
SELECT p.id, 'Owner Approval',
  '[{"name":"Open","sla_days":3,"ball_in_court_role":"admin"},{"name":"Owner Review","sla_days":7,"ball_in_court_role":"owner"},{"name":"Closed","sla_days":0,"ball_in_court_role":"admin"}]'::jsonb,
  false
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM public.project_rfi_workflows w WHERE w.project_id = p.id AND w.name = 'Owner Approval');

INSERT INTO public.project_rfi_workflows (project_id, name, stages, is_default)
SELECT p.id, 'Field-Only',
  '[{"name":"Open","sla_days":1,"ball_in_court_role":"member"},{"name":"Closed","sla_days":0,"ball_in_court_role":"member"}]'::jsonb,
  false
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM public.project_rfi_workflows w WHERE w.project_id = p.id AND w.name = 'Field-Only');

-- 7 default response types per project (mirrors the P1b enum).
INSERT INTO public.project_rfi_response_types (project_id, type_code, label, color, counts_as_answered, requires_resubmittal, sort_order)
SELECT p.id, 'answered', 'Answered', '#2D8A6E', true, false, 1
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM public.project_rfi_response_types t WHERE t.project_id = p.id AND t.type_code = 'answered');

INSERT INTO public.project_rfi_response_types (project_id, type_code, label, color, counts_as_answered, requires_resubmittal, sort_order)
SELECT p.id, 'approved_as_noted', 'Approved as Noted', '#0E7C66', true, false, 2
FROM projects p WHERE NOT EXISTS (SELECT 1 FROM public.project_rfi_response_types t WHERE t.project_id = p.id AND t.type_code = 'approved_as_noted');

INSERT INTO public.project_rfi_response_types (project_id, type_code, label, color, counts_as_answered, requires_resubmittal, sort_order)
SELECT p.id, 'revise_and_resubmit', 'Revise & Resubmit', '#C4850C', false, true, 3
FROM projects p WHERE NOT EXISTS (SELECT 1 FROM public.project_rfi_response_types t WHERE t.project_id = p.id AND t.type_code = 'revise_and_resubmit');

INSERT INTO public.project_rfi_response_types (project_id, type_code, label, color, counts_as_answered, requires_resubmittal, sort_order)
SELECT p.id, 'returned_for_clarification', 'Returned for Clarification', '#B8472E', false, false, 4
FROM projects p WHERE NOT EXISTS (SELECT 1 FROM public.project_rfi_response_types t WHERE t.project_id = p.id AND t.type_code = 'returned_for_clarification');

INSERT INTO public.project_rfi_response_types (project_id, type_code, label, color, counts_as_answered, requires_resubmittal, sort_order)
SELECT p.id, 'answered_with_cost_impact', 'Answered (Cost Impact)', '#C93B3B', true, false, 5
FROM projects p WHERE NOT EXISTS (SELECT 1 FROM public.project_rfi_response_types t WHERE t.project_id = p.id AND t.type_code = 'answered_with_cost_impact');

INSERT INTO public.project_rfi_response_types (project_id, type_code, label, color, counts_as_answered, requires_resubmittal, sort_order)
SELECT p.id, 'no_comment', 'No Comment', '#8C857E', true, false, 6
FROM projects p WHERE NOT EXISTS (SELECT 1 FROM public.project_rfi_response_types t WHERE t.project_id = p.id AND t.type_code = 'no_comment');

INSERT INTO public.project_rfi_response_types (project_id, type_code, label, color, counts_as_answered, requires_resubmittal, sort_order)
SELECT p.id, 'forwarded', 'Forwarded', '#4F46E5', false, false, 7
FROM projects p WHERE NOT EXISTS (SELECT 1 FROM public.project_rfi_response_types t WHERE t.project_id = p.id AND t.type_code = 'forwarded');

-- Default permissions matrix per project. Mirror existing hardcoded
-- gates so the runtime check doesn't change behavior on day 1.
DO $$
DECLARE
  p_id UUID;
  role_name TEXT;
  action_name TEXT;
  allowed_default BOOLEAN;
BEGIN
  FOR p_id IN SELECT id FROM projects LOOP
    FOREACH role_name IN ARRAY ARRAY['owner','admin','manager','member','sub','external','viewer'] LOOP
      FOREACH action_name IN ARRAY ARRAY['create','respond','mark_official','close','reopen','see_private','distribute','export','change_settings','delete'] LOOP
        allowed_default := CASE
          WHEN role_name IN ('owner','admin') THEN true
          WHEN role_name = 'manager' AND action_name IN ('create','respond','mark_official','close','distribute','export') THEN true
          WHEN role_name = 'member' AND action_name IN ('create','respond','mark_official','distribute','export') THEN true
          WHEN role_name = 'sub' AND action_name IN ('respond','export') THEN true
          WHEN role_name = 'external' AND action_name = 'respond' THEN true
          WHEN role_name = 'viewer' AND action_name = 'export' THEN true
          ELSE false
        END;
        INSERT INTO public.project_rfi_permissions (project_id, role, action, allowed)
        VALUES (p_id, role_name, action_name, allowed_default)
        ON CONFLICT (project_id, role, action) DO NOTHING;
      END LOOP;
    END LOOP;

    -- Default settings row.
    INSERT INTO public.project_rfi_settings (project_id) VALUES (p_id)
    ON CONFLICT (project_id) DO NOTHING;
  END LOOP;
END $$;

COMMENT ON TABLE public.rfi_links IS 'Cross-module RFI links to submittal/drawing/schedule/budget/punch/etc.';
COMMENT ON TABLE public.rfi_drawing_pins IS 'Pin coordinates per RFI on a drawing sheet (0-1 normalized).';
COMMENT ON TABLE public.project_spec_book IS 'Per-project CSI section catalog with responsible_party for Iris pass 4.';
COMMENT ON TABLE public.project_rfi_permissions IS 'Project-scoped role × action permission matrix; PermissionGate references this at runtime.';
