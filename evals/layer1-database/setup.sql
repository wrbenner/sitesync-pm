-- =============================================================================
-- SiteSync PM — Eval Harness Layer 1: Test Data Setup
-- =============================================================================
-- Creates a known test environment with deterministic UUIDs.
-- Run BEFORE any Layer 1 test. Run teardown.sql AFTER.
--
-- Test Topology (current DB roles — pre-migration):
--   Org A ("Acme Construction")
--     └── Project Alpha
--           ├── Eve     — owner
--           ├── Alice   — admin   (future: project_manager)
--           ├── Sam     — member  (future: superintendent)
--           ├── Charlie — member  (future: subcontractor)
--           └── Vic     — viewer
--   Org B ("Beta Builders")
--     └── Project Beta
--           └── Bob — admin (future: project_manager)
--
-- All UUIDs are deterministic so tests can reference them by name.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Known UUIDs
-- ---------------------------------------------------------------------------
-- We use uuid_generate_v5 with a fixed namespace to get deterministic UUIDs,
-- but for clarity we define them as constants.

DO $$
DECLARE
  -- Organizations
  v_org_a_id     uuid := 'a0000000-0000-0000-0000-000000000001';
  v_org_b_id     uuid := 'b0000000-0000-0000-0000-000000000002';

  -- Projects
  v_project_alpha_id uuid := 'a1000000-0000-0000-0000-000000000001';
  v_project_beta_id  uuid := 'b1000000-0000-0000-0000-000000000002';

  -- Users (auth.users IDs — these must exist in auth.users for RLS to work)
  v_alice_id   uuid := 'aa000000-0000-0000-0000-000000000001'; -- PM on Alpha
  v_bob_id     uuid := 'bb000000-0000-0000-0000-000000000002'; -- PM on Beta
  v_sam_id     uuid := 'cc000000-0000-0000-0000-000000000003'; -- Superintendent on Alpha
  v_charlie_id uuid := 'dd000000-0000-0000-0000-000000000004'; -- Subcontractor on Alpha
  v_vic_id     uuid := 'ee000000-0000-0000-0000-000000000005'; -- Viewer on Alpha
  v_eve_id     uuid := 'ff000000-0000-0000-0000-000000000006'; -- Owner on Alpha

BEGIN

  -- ---------------------------------------------------------------------------
  -- 2. Create test users in auth.users (Supabase auth schema)
  -- ---------------------------------------------------------------------------
  -- NOTE: In a real Supabase environment, you may need to use the admin API
  -- or service_role to create auth.users rows. This SQL works with direct DB
  -- access to the test environment.
  INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at, instance_id, aud, role)
  VALUES
    (v_alice_id,   'alice@test.sitesync.dev', '{"full_name":"Alice PM"}',       now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (v_bob_id,     'bob@test.sitesync.dev',   '{"full_name":"Bob PM"}',         now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (v_sam_id,     'sam@test.sitesync.dev',   '{"full_name":"Sam Super"}',      now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (v_charlie_id, 'charlie@test.sitesync.dev','{"full_name":"Charlie Sub"}',   now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (v_vic_id,     'vic@test.sitesync.dev',   '{"full_name":"Vic Viewer"}',     now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (v_eve_id,     'eve@test.sitesync.dev',   '{"full_name":"Eve Owner"}',      now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 3. Organizations
  -- ---------------------------------------------------------------------------
  INSERT INTO organizations (id, name, created_at, updated_at)
  VALUES
    (v_org_a_id, 'Acme Construction (TEST)', now(), now()),
    (v_org_b_id, 'Beta Builders (TEST)',     now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 4. Organization Members
  -- ---------------------------------------------------------------------------
  INSERT INTO organization_members (organization_id, user_id, role, created_at)
  VALUES
    (v_org_a_id, v_alice_id,   'admin',  now()),
    (v_org_a_id, v_sam_id,     'member', now()),
    (v_org_a_id, v_charlie_id, 'member', now()),
    (v_org_a_id, v_vic_id,     'member', now()),
    (v_org_a_id, v_eve_id,     'owner',  now()),
    (v_org_b_id, v_bob_id,     'admin',  now())
  ON CONFLICT DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 5. Projects
  -- ---------------------------------------------------------------------------
  INSERT INTO projects (id, organization_id, name, status, created_at, updated_at)
  VALUES
    (v_project_alpha_id, v_org_a_id, 'Project Alpha (TEST)', 'active', now(), now()),
    (v_project_beta_id,  v_org_b_id, 'Project Beta (TEST)',  'active', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 6. Project Members
  -- ---------------------------------------------------------------------------
  -- IMPORTANT: The current DB CHECK constraint allows only:
  --   owner, admin, member, viewer
  -- The kernel spec (§7) defines 6 roles:
  --   owner, admin, project_manager, superintendent, subcontractor, viewer
  -- After the project_members.role migration (Step 4, Phase 1), update
  -- these inserts to use kernel roles and uncomment the role-specific
  -- test assertions in Layer 1 tests.
  INSERT INTO project_members (project_id, user_id, role, created_at)
  VALUES
    (v_project_alpha_id, v_alice_id,   'admin',   now()),  -- future: project_manager
    (v_project_alpha_id, v_sam_id,     'member',  now()),  -- future: superintendent
    (v_project_alpha_id, v_charlie_id, 'member',  now()),  -- future: subcontractor
    (v_project_alpha_id, v_vic_id,     'viewer',  now()),
    (v_project_alpha_id, v_eve_id,     'owner',   now()),
    (v_project_beta_id,  v_bob_id,     'admin',   now())   -- future: project_manager
  ON CONFLICT DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 7. Seed data: RFIs in Project Alpha (for tenant isolation tests)
  -- ---------------------------------------------------------------------------
  INSERT INTO rfis (id, project_id, title, status, created_by, created_at, updated_at)
  VALUES
    ('aaa00000-0000-0000-0000-000000000001', v_project_alpha_id, 'Test RFI Alpha-1', 'open', v_alice_id, now(), now()),
    ('aaa00000-0000-0000-0000-000000000002', v_project_alpha_id, 'Test RFI Alpha-2', 'open', v_alice_id, now(), now()),
    ('aaa00000-0000-0000-0000-000000000003', v_project_alpha_id, 'Test RFI Alpha-3', 'open', v_sam_id,   now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- Seed data: RFIs in Project Beta (for isolation tests)
  INSERT INTO rfis (id, project_id, title, status, created_by, created_at, updated_at)
  VALUES
    ('bbb00000-0000-0000-0000-000000000001', v_project_beta_id, 'Test RFI Beta-1', 'open', v_bob_id, now(), now()),
    ('bbb00000-0000-0000-0000-000000000002', v_project_beta_id, 'Test RFI Beta-2', 'open', v_bob_id, now(), now())
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Layer 1 setup complete: 2 orgs, 2 projects, 6 users, 5 RFIs';

END $$;

COMMIT;
