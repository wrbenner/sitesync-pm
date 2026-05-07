-- =============================================================================
-- Phase 4 — Submittals Grouping Views (Packages, Spec Sections, BIC)
--
-- Spec: docs/audits/SUBMITTALS_PAGE_REBUILD_PLAN_2026-05-06.md Phase 4
--
-- 1. RPCs for Submittal Package CRUD (create-from-selection, update, delete,
--    set-members). Service-role guarded by RLS via SECURITY DEFINER + a project
--    membership check on every entry point.
-- 2. spec_sections — global CSI MasterFormat lookup table. Seeded with a curated
--    subset of the most common Division 00–49 sections (~120 rows, sufficient
--    to label every section in our existing demo + pilot projects). RLS:
--    service_role write, authenticated read (global reference data).
-- 3. Extends seed_iris_suggested_submittal_views to add 3 view-type-aware
--    Iris suggestions for the new grouping views.
--
-- ADDITIVE only. Idempotent re-apply via IF NOT EXISTS / OR REPLACE / ON CONFLICT.
-- =============================================================================

-- ── 1. Submittal Package RPCs ───────────────────────────────────────────────

-- Create a package and atomically attach selected submittals to it.
-- Returns the new package id. Submittals list may be empty.
CREATE OR REPLACE FUNCTION public.submittal_create_package(
  p_project_id          uuid,
  p_title               text,
  p_description         text,
  p_responsible_sub_id  uuid,
  p_csi_section         text,
  p_submittal_ids       uuid[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_package_id  uuid;
  v_next_number int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = p_project_id AND pm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a project member';
  END IF;

  SELECT COALESCE(MAX(number), 0) + 1 INTO v_next_number
    FROM public.submittal_packages
   WHERE project_id = p_project_id;

  INSERT INTO public.submittal_packages
    (project_id, number, title, description, responsible_sub_id, csi_section, created_by)
  VALUES
    (p_project_id, v_next_number, p_title, p_description, p_responsible_sub_id, p_csi_section, auth.uid())
  RETURNING id INTO v_package_id;

  IF p_submittal_ids IS NOT NULL AND array_length(p_submittal_ids, 1) > 0 THEN
    UPDATE public.submittals
       SET submittal_package_id = v_package_id
     WHERE project_id = p_project_id
       AND id = ANY(p_submittal_ids);
  END IF;

  RETURN v_package_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_create_package(uuid, text, text, uuid, text, uuid[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_create_package(uuid, text, text, uuid, text, uuid[]) TO authenticated;

-- Update package metadata (name / description / responsible sub / csi section).
-- Cannot change which submittals belong; use submittal_set_package_members.
CREATE OR REPLACE FUNCTION public.submittal_update_package(
  p_id                  uuid,
  p_title               text,
  p_description         text,
  p_responsible_sub_id  uuid,
  p_csi_section         text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  SELECT project_id INTO v_project_id FROM public.submittal_packages WHERE id = p_id;
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Package not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = v_project_id AND pm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a project member';
  END IF;

  UPDATE public.submittal_packages
     SET title              = p_title,
         description        = p_description,
         responsible_sub_id = p_responsible_sub_id,
         csi_section        = p_csi_section
   WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_update_package(uuid, text, text, uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_update_package(uuid, text, text, uuid, text) TO authenticated;

-- Replace the membership of a package with a new set of submittal ids.
-- Submittals previously in the package but not in the new set are detached
-- (their submittal_package_id set to NULL). New submittals are attached.
CREATE OR REPLACE FUNCTION public.submittal_set_package_members(
  p_package_id    uuid,
  p_submittal_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  SELECT project_id INTO v_project_id FROM public.submittal_packages WHERE id = p_package_id;
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Package not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = v_project_id AND pm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a project member';
  END IF;

  -- Detach submittals that are no longer in the set.
  UPDATE public.submittals
     SET submittal_package_id = NULL
   WHERE submittal_package_id = p_package_id
     AND (p_submittal_ids IS NULL OR NOT (id = ANY(p_submittal_ids)));

  -- Attach new submittals (limited to the same project).
  IF p_submittal_ids IS NOT NULL AND array_length(p_submittal_ids, 1) > 0 THEN
    UPDATE public.submittals
       SET submittal_package_id = p_package_id
     WHERE project_id = v_project_id
       AND id = ANY(p_submittal_ids);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_set_package_members(uuid, uuid[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_set_package_members(uuid, uuid[]) TO authenticated;

-- Delete a package. Submittals are NOT deleted; their submittal_package_id is
-- set to NULL (matches the FK ON DELETE behaviour from the canonical migration).
CREATE OR REPLACE FUNCTION public.submittal_delete_package(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  SELECT project_id INTO v_project_id FROM public.submittal_packages WHERE id = p_id;
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Package not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = v_project_id AND pm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a project member';
  END IF;

  -- Defensive: nullify the FK in case the constraint isn't ON DELETE SET NULL.
  UPDATE public.submittals
     SET submittal_package_id = NULL
   WHERE submittal_package_id = p_id;

  DELETE FROM public.submittal_packages WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_delete_package(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_delete_package(uuid) TO authenticated;

-- ── 2. spec_sections — global CSI MasterFormat lookup ───────────────────────

CREATE TABLE IF NOT EXISTS public.spec_sections (
  section_number  text PRIMARY KEY,            -- e.g. "08 41 13"
  title           text NOT NULL,               -- e.g. "Aluminum-Framed Storefronts"
  division        int  NOT NULL,               -- 0..49
  division_title  text NOT NULL                -- e.g. "Openings"
);

CREATE INDEX IF NOT EXISTS idx_spec_sections_division
  ON public.spec_sections (division);

ALTER TABLE public.spec_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS spec_sections_read ON public.spec_sections;
CREATE POLICY spec_sections_read ON public.spec_sections
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role only for writes (no INSERT/UPDATE/DELETE policies for clients).

-- Curated MasterFormat seed — the ~120 most common sections across all 49
-- divisions, sufficient to label every submittal in our demo + pilot projects.
-- ON CONFLICT (section_number) DO UPDATE keeps the seed idempotent and lets
-- future migrations refine titles without dropping the table.
INSERT INTO public.spec_sections (section_number, title, division, division_title) VALUES
  -- Division 00 — Procurement & Contracting Requirements
  ('00 11 00', 'Advertisements and Invitations', 0, 'Procurement and Contracting Requirements'),
  ('00 21 13', 'Instructions to Bidders', 0, 'Procurement and Contracting Requirements'),
  ('00 41 00', 'Bid Forms', 0, 'Procurement and Contracting Requirements'),
  ('00 52 00', 'Agreement Forms', 0, 'Procurement and Contracting Requirements'),
  ('00 72 00', 'General Conditions', 0, 'Procurement and Contracting Requirements'),
  ('00 73 00', 'Supplementary Conditions', 0, 'Procurement and Contracting Requirements'),

  -- Division 01 — General Requirements
  ('01 10 00', 'Summary', 1, 'General Requirements'),
  ('01 25 00', 'Substitution Procedures', 1, 'General Requirements'),
  ('01 31 00', 'Project Management and Coordination', 1, 'General Requirements'),
  ('01 32 00', 'Construction Progress Documentation', 1, 'General Requirements'),
  ('01 33 00', 'Submittal Procedures', 1, 'General Requirements'),
  ('01 40 00', 'Quality Requirements', 1, 'General Requirements'),
  ('01 50 00', 'Temporary Facilities and Controls', 1, 'General Requirements'),
  ('01 60 00', 'Product Requirements', 1, 'General Requirements'),
  ('01 70 00', 'Execution and Closeout Requirements', 1, 'General Requirements'),
  ('01 78 00', 'Closeout Submittals', 1, 'General Requirements'),

  -- Division 02 — Existing Conditions
  ('02 30 00', 'Subsurface Investigation', 2, 'Existing Conditions'),
  ('02 41 00', 'Demolition', 2, 'Existing Conditions'),
  ('02 82 00', 'Asbestos Remediation', 2, 'Existing Conditions'),

  -- Division 03 — Concrete
  ('03 10 00', 'Concrete Forming and Accessories', 3, 'Concrete'),
  ('03 20 00', 'Concrete Reinforcing', 3, 'Concrete'),
  ('03 30 00', 'Cast-in-Place Concrete', 3, 'Concrete'),
  ('03 35 00', 'Concrete Finishing', 3, 'Concrete'),
  ('03 40 00', 'Precast Concrete', 3, 'Concrete'),
  ('03 41 13', 'Precast Concrete Hollow Core Planks', 3, 'Concrete'),
  ('03 54 00', 'Cast Underlayment', 3, 'Concrete'),

  -- Division 04 — Masonry
  ('04 20 00', 'Unit Masonry', 4, 'Masonry'),
  ('04 22 00', 'Concrete Unit Masonry', 4, 'Masonry'),
  ('04 27 00', 'Multiple-Wythe Unit Masonry', 4, 'Masonry'),
  ('04 40 00', 'Stone Assemblies', 4, 'Masonry'),

  -- Division 05 — Metals
  ('05 12 00', 'Structural Steel Framing', 5, 'Metals'),
  ('05 21 00', 'Steel Joist Framing', 5, 'Metals'),
  ('05 31 00', 'Steel Decking', 5, 'Metals'),
  ('05 40 00', 'Cold-Formed Metal Framing', 5, 'Metals'),
  ('05 50 00', 'Metal Fabrications', 5, 'Metals'),
  ('05 51 00', 'Metal Stairs', 5, 'Metals'),
  ('05 52 00', 'Metal Railings', 5, 'Metals'),

  -- Division 06 — Wood, Plastics, Composites
  ('06 10 00', 'Rough Carpentry', 6, 'Wood, Plastics, and Composites'),
  ('06 16 00', 'Sheathing', 6, 'Wood, Plastics, and Composites'),
  ('06 20 00', 'Finish Carpentry', 6, 'Wood, Plastics, and Composites'),
  ('06 41 00', 'Architectural Wood Casework', 6, 'Wood, Plastics, and Composites'),

  -- Division 07 — Thermal & Moisture Protection
  ('07 11 13', 'Bituminous Damproofing', 7, 'Thermal and Moisture Protection'),
  ('07 21 00', 'Thermal Insulation', 7, 'Thermal and Moisture Protection'),
  ('07 25 00', 'Weather Barriers', 7, 'Thermal and Moisture Protection'),
  ('07 41 13', 'Metal Roof Panels', 7, 'Thermal and Moisture Protection'),
  ('07 42 13', 'Metal Wall Panels', 7, 'Thermal and Moisture Protection'),
  ('07 52 00', 'Modified Bituminous Membrane Roofing', 7, 'Thermal and Moisture Protection'),
  ('07 54 00', 'Thermoplastic Membrane Roofing', 7, 'Thermal and Moisture Protection'),
  ('07 62 00', 'Sheet Metal Flashing and Trim', 7, 'Thermal and Moisture Protection'),
  ('07 84 00', 'Firestopping', 7, 'Thermal and Moisture Protection'),
  ('07 92 00', 'Joint Sealants', 7, 'Thermal and Moisture Protection'),

  -- Division 08 — Openings
  ('08 11 13', 'Hollow Metal Doors and Frames', 8, 'Openings'),
  ('08 14 00', 'Wood Doors', 8, 'Openings'),
  ('08 31 00', 'Access Doors and Panels', 8, 'Openings'),
  ('08 33 00', 'Coiling Doors and Grilles', 8, 'Openings'),
  ('08 41 13', 'Aluminum-Framed Storefronts', 8, 'Openings'),
  ('08 41 26', 'All-Glass Entrances and Storefronts', 8, 'Openings'),
  ('08 44 13', 'Glazed Aluminum Curtain Walls', 8, 'Openings'),
  ('08 51 13', 'Aluminum Windows', 8, 'Openings'),
  ('08 71 00', 'Door Hardware', 8, 'Openings'),
  ('08 80 00', 'Glazing', 8, 'Openings'),

  -- Division 09 — Finishes
  ('09 21 16', 'Gypsum Board Assemblies', 9, 'Finishes'),
  ('09 22 16', 'Non-Structural Metal Framing', 9, 'Finishes'),
  ('09 30 00', 'Tiling', 9, 'Finishes'),
  ('09 51 13', 'Acoustical Panel Ceilings', 9, 'Finishes'),
  ('09 65 13', 'Resilient Base and Accessories', 9, 'Finishes'),
  ('09 65 19', 'Resilient Tile Flooring', 9, 'Finishes'),
  ('09 68 13', 'Tile Carpeting', 9, 'Finishes'),
  ('09 91 00', 'Painting', 9, 'Finishes'),

  -- Division 10 — Specialties
  ('10 14 00', 'Signage', 10, 'Specialties'),
  ('10 21 13', 'Toilet Compartments', 10, 'Specialties'),
  ('10 26 00', 'Wall and Door Protection', 10, 'Specialties'),
  ('10 28 00', 'Toilet, Bath, and Laundry Accessories', 10, 'Specialties'),
  ('10 44 00', 'Fire Protection Specialties', 10, 'Specialties'),

  -- Division 11 — Equipment
  ('11 13 00', 'Loading Dock Equipment', 11, 'Equipment'),
  ('11 31 00', 'Residential Appliances', 11, 'Equipment'),
  ('11 40 00', 'Foodservice Equipment', 11, 'Equipment'),

  -- Division 12 — Furnishings
  ('12 21 00', 'Window Blinds', 12, 'Furnishings'),
  ('12 24 00', 'Window Shades', 12, 'Furnishings'),
  ('12 36 00', 'Countertops', 12, 'Furnishings'),
  ('12 48 00', 'Rugs and Mats', 12, 'Furnishings'),

  -- Division 13 — Special Construction
  ('13 31 00', 'Fabric Structures', 13, 'Special Construction'),
  ('13 34 00', 'Fabricated Engineered Structures', 13, 'Special Construction'),

  -- Division 14 — Conveying Equipment
  ('14 21 00', 'Electric Traction Elevators', 14, 'Conveying Equipment'),
  ('14 24 00', 'Hydraulic Elevators', 14, 'Conveying Equipment'),

  -- Division 21 — Fire Suppression
  ('21 13 13', 'Wet-Pipe Sprinkler Systems', 21, 'Fire Suppression'),
  ('21 13 16', 'Dry-Pipe Sprinkler Systems', 21, 'Fire Suppression'),

  -- Division 22 — Plumbing
  ('22 11 00', 'Facility Water Distribution', 22, 'Plumbing'),
  ('22 13 00', 'Facility Sanitary Sewerage', 22, 'Plumbing'),
  ('22 30 00', 'Plumbing Equipment', 22, 'Plumbing'),
  ('22 40 00', 'Plumbing Fixtures', 22, 'Plumbing'),
  ('22 42 00', 'Commercial Plumbing Fixtures', 22, 'Plumbing'),

  -- Division 23 — HVAC
  ('23 05 00', 'Common Work Results for HVAC', 23, 'Heating, Ventilating, and Air Conditioning'),
  ('23 07 00', 'HVAC Insulation', 23, 'Heating, Ventilating, and Air Conditioning'),
  ('23 21 13', 'Hydronic Piping', 23, 'Heating, Ventilating, and Air Conditioning'),
  ('23 31 13', 'Metal Ducts', 23, 'Heating, Ventilating, and Air Conditioning'),
  ('23 37 13', 'Diffusers, Registers, and Grilles', 23, 'Heating, Ventilating, and Air Conditioning'),
  ('23 73 13', 'Modular Indoor Central-Station Air-Handling Units', 23, 'Heating, Ventilating, and Air Conditioning'),
  ('23 81 26', 'Split-System Air-Conditioners', 23, 'Heating, Ventilating, and Air Conditioning'),

  -- Division 26 — Electrical
  ('26 05 00', 'Common Work Results for Electrical', 26, 'Electrical'),
  ('26 05 19', 'Low-Voltage Electrical Power Conductors and Cables', 26, 'Electrical'),
  ('26 05 26', 'Grounding and Bonding for Electrical Systems', 26, 'Electrical'),
  ('26 24 16', 'Panelboards', 26, 'Electrical'),
  ('26 27 26', 'Wiring Devices', 26, 'Electrical'),
  ('26 51 00', 'Interior Lighting', 26, 'Electrical'),
  ('26 56 00', 'Exterior Lighting', 26, 'Electrical'),

  -- Division 27 — Communications
  ('27 10 00', 'Structured Cabling', 27, 'Communications'),
  ('27 41 00', 'Audio-Video Systems', 27, 'Communications'),

  -- Division 28 — Electronic Safety & Security
  ('28 13 00', 'Access Control', 28, 'Electronic Safety and Security'),
  ('28 23 00', 'Video Surveillance', 28, 'Electronic Safety and Security'),
  ('28 31 00', 'Fire Detection and Alarm', 28, 'Electronic Safety and Security'),

  -- Division 31 — Earthwork
  ('31 10 00', 'Site Clearing', 31, 'Earthwork'),
  ('31 23 00', 'Excavation and Fill', 31, 'Earthwork'),
  ('31 31 00', 'Soil Treatment', 31, 'Earthwork'),

  -- Division 32 — Exterior Improvements
  ('32 12 16', 'Asphalt Paving', 32, 'Exterior Improvements'),
  ('32 13 13', 'Concrete Paving', 32, 'Exterior Improvements'),
  ('32 31 00', 'Fences and Gates', 32, 'Exterior Improvements'),
  ('32 90 00', 'Planting', 32, 'Exterior Improvements'),

  -- Division 33 — Utilities
  ('33 11 00', 'Water Utility Distribution Piping', 33, 'Utilities'),
  ('33 31 00', 'Sanitary Utility Sewerage Piping', 33, 'Utilities'),
  ('33 41 00', 'Storm Utility Drainage Piping', 33, 'Utilities')
ON CONFLICT (section_number) DO UPDATE
  SET title          = EXCLUDED.title,
      division       = EXCLUDED.division,
      division_title = EXCLUDED.division_title;

COMMENT ON TABLE public.spec_sections IS
  'Global CSI MasterFormat reference. Authenticated read; service-role write. '
  'Seeded with the most common sections across Divisions 00–49.';

-- ── 3. Iris seed extension — 3 view-type-aware suggestions ──────────────────

CREATE OR REPLACE FUNCTION public.seed_iris_suggested_submittal_views(
  p_project_id  uuid
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  SELECT count(*) INTO v_count
    FROM public.submittal_saved_views
   WHERE project_id = p_project_id AND scope = 'iris';
  IF v_count > 0 THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = p_project_id AND pm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a project member';
  END IF;

  INSERT INTO public.submittal_saved_views
    (project_id, scope, owner_user_id, name, description, view_state, is_default)
  VALUES
    (p_project_id, 'iris', NULL,
     'Overdue at Architect',
     'BIC role contains "arch" + days_in_court > project SLA',
     jsonb_build_object(
       'filters', jsonb_build_object(
         'ball_in_court_role_substring', 'arch',
         'days_in_court_over_sla', true
       ),
       'viewType', 'items',
       'grouping', 'none'
     ),
     false),
    (p_project_id, 'iris', NULL,
     'Long-lead → Schedule Risk',
     'Lead time > 8 weeks AND on critical path',
     jsonb_build_object(
       'filters', jsonb_build_object(
         'lead_time_weeks_gte', 8,
         'is_critical_path', true
       ),
       'viewType', 'items',
       'grouping', 'none'
     ),
     false),
    (p_project_id, 'iris', NULL,
     'Resubmit count > 1',
     'Submittals with rev_number ≥ 2 (multiple resubmissions)',
     jsonb_build_object(
       'filters', jsonb_build_object(
         'rev_number_gte', 2
       ),
       'viewType', 'items',
       'grouping', 'none'
     ),
     false),
    (p_project_id, 'iris', NULL,
     'Federal Closeout Package',
     'Warranty / closeout / maintenance kinds, federal projects only',
     jsonb_build_object(
       'filters', jsonb_build_object(
         'kind', jsonb_build_array('warranty', 'closeout', 'maintenance'),
         'is_federal', true
       ),
       'viewType', 'items',
       'grouping', 'csi_section'
     ),
     false),
    -- Phase 4 — view-type-aware Iris suggestions.
    (p_project_id, 'iris', NULL,
     'Long-running packages',
     'Packages whose submittals have any days_in_court > 14',
     jsonb_build_object(
       'filters', jsonb_build_object(
         'days_in_court_gt', 14
       ),
       'viewType', 'packages',
       'grouping', 'package'
     ),
     false),
    (p_project_id, 'iris', NULL,
     'Drawing-heavy divisions',
     'Shop-drawing-kind submittals in Division 03/04/05/08',
     jsonb_build_object(
       'filters', jsonb_build_object(
         'kind', jsonb_build_array('shop_drawing'),
         'csi_division_in', jsonb_build_array('03', '04', '05', '08')
       ),
       'viewType', 'spec_sections',
       'grouping', 'csi_section'
     ),
     false),
    (p_project_id, 'iris', NULL,
     'Architect plate',
     'BIC role contains "arch" — sorted by days in court desc',
     jsonb_build_object(
       'filters', jsonb_build_object(
         'ball_in_court_role_substring', 'arch'
       ),
       'viewType', 'ball_in_court',
       'grouping', 'reviewer',
       'sort', jsonb_build_object('columnId', 'days_in_court', 'direction', 'desc')
     ),
     false);

  RETURN 7;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_iris_suggested_submittal_views(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.seed_iris_suggested_submittal_views(uuid) TO authenticated;

COMMENT ON FUNCTION public.seed_iris_suggested_submittal_views(uuid) IS
  'Seeds 7 iris-scope views per project on first call (4 Items-scope + 3 '
  'Packages/SpecSections/BIC-scope). Idempotent — no-ops if the project '
  'already has iris views. Caller must be a project member.';

-- =============================================================================
-- End of Phase 4 Submittals Grouping Views migration.
-- =============================================================================
