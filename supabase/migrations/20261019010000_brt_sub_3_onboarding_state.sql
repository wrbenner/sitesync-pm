-- BRT sub-3 §4.1 — onboarding state + sample-data seeder.
--
-- 1. profiles.onboarding_step int default 0 — resumable wizard state
-- 2. seed_sample_data(org_id, role) — role-tailored seeder that marks
--    every insert is_demo=true (using the existing is_demo column added
--    by 20261009000002_is_demo_extension during Day 3 catch-up).
--    Idempotent (no-op if any is_demo=true project exists for the org).
--
-- The is_demo column + clear_demo_data() were shipped in the Day 3
-- catch-up migration; this file adds the populator side that was missing.
-- The 4 role-specific data sets are inlined here; YAML reference files
-- live at supabase/fixtures/sample_data/*.yaml for human editing.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_step int NOT NULL DEFAULT 0;

COMMENT ON COLUMN profiles.onboarding_step IS
  'BRT sub-3 §4.1: 0=not-started, 1-5=current step, 6=completed. Read/written by useOnboardingState hook.';

CREATE OR REPLACE FUNCTION seed_sample_data(p_org_id uuid, p_role text)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_existing int;
  v_proj_id uuid;
  v_inserted int := 0;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'seed_sample_data: p_org_id required' USING ERRCODE='22023';
  END IF;
  IF p_role NOT IN ('gc','sub','owner','architect') THEN
    RAISE EXCEPTION 'seed_sample_data: p_role must be gc|sub|owner|architect' USING ERRCODE='22023';
  END IF;
  IF v_user IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM organization_members
     WHERE user_id = v_user AND organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'seed_sample_data: not a member of org %', p_org_id USING ERRCODE='42501';
  END IF;

  SELECT count(*) INTO v_existing FROM projects WHERE organization_id = p_org_id AND is_demo = true;
  IF v_existing > 0 THEN
    RETURN 0;
  END IF;

  v_proj_id := gen_random_uuid();
  INSERT INTO projects (id, organization_id, name, description, status, is_demo)
  VALUES (v_proj_id, p_org_id,
          CASE p_role
            WHEN 'gc' THEN 'Sample — Riverside Medical Office Building'
            WHEN 'sub' THEN 'Sample — Drywall Scope, Riverside MOB'
            WHEN 'owner' THEN 'Sample — Riverside MOB (Owner View)'
            ELSE 'Sample — Riverside MOB (Architect View)'
          END,
          'Sample data for exploring SiteSync. Delete anytime from Settings → Sample Data.',
          'active', true);
  v_inserted := v_inserted + 1;

  INSERT INTO rfis (project_id, number, title, description, question, priority, status, is_demo)
  VALUES
    (v_proj_id, 'RFI-001',
     CASE p_role
       WHEN 'gc' THEN 'Clarify slab depression at elevator pit'
       WHEN 'sub' THEN 'Drywall thickness at corridor 102'
       WHEN 'owner' THEN 'Budget impact of finish upgrade in lobby'
       ELSE 'Window mullion spacing per A-301'
     END,
     'Auto-generated RFI for sample data.',
     CASE p_role
       WHEN 'gc' THEN 'Drawing S-201 shows 4" depression but spec calls for 6". Which governs?'
       WHEN 'sub' THEN 'Spec calls for 5/8" Type X but corridor noted as 1/2" on plans. Confirm.'
       WHEN 'owner' THEN 'Proposed upgrade from porcelain to terrazzo adds $34k. Approve?'
       ELSE 'Mullion spacing on A-301 does not match elevation B/A-501. Which is correct?'
     END,
     'high', 'open', true),
    (v_proj_id, 'RFI-002', 'Confirm rebar grade for footings',
     'Auto-generated RFI for sample data.',
     'Plan note says Grade 60; spec section 03 20 00 says Grade 75. Reconcile.',
     'medium', 'pending_response', true);
  v_inserted := v_inserted + 2;

  INSERT INTO submittals (project_id, number, title, status, is_demo)
  VALUES (v_proj_id, 'SUB-001',
          CASE p_role
            WHEN 'architect' THEN 'Window assembly — A-301 type 4'
            ELSE 'Concrete mix design — 4500 psi'
          END,
          'pending_review', true);
  v_inserted := v_inserted + 1;

  INSERT INTO daily_logs (project_id, log_date, summary, weather, is_demo)
  VALUES (v_proj_id, current_date - 1,
          'Crew of 12. Pour at footings A-D complete. No injuries. Inspector signed off on rebar inspection.',
          'Sunny, 72°F, light winds from W', true);
  v_inserted := v_inserted + 1;

  INSERT INTO punch_items (project_id, number, title, description, priority, status, is_demo)
  VALUES
    (v_proj_id, 'PI-001', 'Touch-up paint, corridor 102', 'North wall paint touch-up needed near electrical panel.', 'low', 'open', true),
    (v_proj_id, 'PI-002', 'Replace damaged door hardware', 'Damaged latch at room 201 — replace with matching ANSI grade-1 hardware.', 'medium', 'open', true);
  v_inserted := v_inserted + 2;

  RETURN v_inserted;
END $$;

COMMENT ON FUNCTION seed_sample_data(uuid, text) IS
  'BRT sub-3 §4.2: role-tailored sample data seeder. Idempotent. Marks every insert is_demo=true. Counterpart of clear_demo_data() shipped Day 3.';
REVOKE EXECUTE ON FUNCTION seed_sample_data(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION seed_sample_data(uuid, text) TO authenticated, service_role;
