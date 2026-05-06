-- =============================================================================
-- Avery Oaks Apartments — full seed for demo
-- =============================================================================
-- Project: 294-unit multifamily, 9019 North Lake Creek Pkwy, Austin TX 78717
-- Owner-on-record: wrbenner23@yahoo.com
--
-- Two layers of fidelity:
--   REAL — pulled from the cover sheet (Project Data, dated 07.31.2020):
--     • Project name, address, unit count, project number (20035)
--     • 8 consultants — names, firms, addresses, phones (Cross Architects,
--       Bleyl Engineering, RTP Structural, Blu Fish Collaborative, MEP
--       Systems Design, Journeyman, JCI Residential, Lakeline Avery Partners)
--
--   REALISTIC — multifamily-construction scenarios at this scale, tied to
--   Avery Oaks specifics (5-over-1 wood/podium, Type V over Type I, 294 units,
--   north Austin context):
--     • RFIs, submittals, punch items, daily logs, change orders, meetings,
--       schedule phases, tasks, budget, activity, notifications, AI insights
--
-- Auth users for consultants use the same bcrypt hash for "Password123!"
-- so you can sign in as any of them during demo. Idempotent re-runs converge.
-- =============================================================================

-- =============================================================================
-- 0. Patch fn_audit_trigger() — fixes the "record NEW has no field project_id"
--    error on tables like rfi_responses / submittal_approvals / meeting_*
--    that don't have a project_id column. Original migration assumed every
--    audited table had project_id; uses jsonb access so missing keys → NULL.
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS trigger AS $audit$
BEGIN
  INSERT INTO audit_log (
    action, entity_type, entity_id, project_id, user_id,
    before_state, after_state, created_at
  ) VALUES (
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(
      (CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW)->>'id' END),
      (CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD)->>'id' END)
    )::uuid,
    COALESCE(
      (CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW)->>'project_id' END),
      (CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD)->>'project_id' END)
    )::uuid,
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$audit$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 0b. Disable triggers for the seed session.
--   Reason: this DB has multiple per-table triggers (audit, notification
--   fan-out via create_notification(), etc.) that fire on every INSERT and
--   are written assuming user-driven, not bulk-load, traffic — they error
--   on signature mismatches (e.g. notify_punch_item_assigned hits a
--   function signature that doesn't match) and on tables without certain
--   columns. Triggers are restored at the end of the file.
-- =============================================================================
SET session_replication_role = replica;

DO $$
DECLARE
  walker_id UUID;

  -- 8 consultants from the cover sheet (real names, real firms)
  u_kumar       UUID := 'a0000001-0000-0000-0000-000000000001'; -- Sam Kumar / JCI Residential / Developer
  u_goll        UUID := 'a0000001-0000-0000-0000-000000000002'; -- Kurt Goll / Lakeline Avery Partners / Owner
  u_gregorcyk   UUID := 'a0000001-0000-0000-0000-000000000003'; -- David Gregorcyk / Journeyman / GC
  u_rodgers     UUID := 'a0000001-0000-0000-0000-000000000004'; -- Jason Rodgers / Bleyl Engineering / Civil
  u_leon        UUID := 'a0000001-0000-0000-0000-000000000005'; -- Mark Leon / Cross Architects / Architect
  u_fishbaugh   UUID := 'a0000001-0000-0000-0000-000000000006'; -- Mike Fishbaugh / Blu Fish Collaborative / Landscape
  u_perkins     UUID := 'a0000001-0000-0000-0000-000000000007'; -- Trent Perkins / RTP Structural / Structural
  u_portnoy     UUID := 'a0000001-0000-0000-0000-000000000008'; -- Mark Portnoy / MEP Systems Design / MEP

  v_project_id UUID := 'b1000001-0000-4000-8000-000000000001';
  -- ↑ Valid UUID v4: '4' at position 13, '8' at position 17. The frontend's
  -- validateProjectId in src/api/middleware/projectScope.ts requires v4 format.
  -- (Postgres itself accepts any UUID, which is why the bad ID landed in the
  --  DB before — the frontend route guard is what threw "Invalid project ID".)
  v_old_project_id UUID := 'b1000001-0000-0000-0000-000000000001';  -- cleanup: prior bad UUID

  rfi_01 UUID := 'b2000001-0000-0000-0000-000000000001';
  rfi_02 UUID := 'b2000001-0000-0000-0000-000000000002';
  rfi_03 UUID := 'b2000001-0000-0000-0000-000000000003';
  rfi_04 UUID := 'b2000001-0000-0000-0000-000000000004';
  rfi_05 UUID := 'b2000001-0000-0000-0000-000000000005';
  rfi_06 UUID := 'b2000001-0000-0000-0000-000000000006';
  rfi_07 UUID := 'b2000001-0000-0000-0000-000000000007';
  rfi_08 UUID := 'b2000001-0000-0000-0000-000000000008';
  rfi_09 UUID := 'b2000001-0000-0000-0000-000000000009';
  rfi_10 UUID := 'b2000001-0000-0000-0000-000000000010';
  rfi_11 UUID := 'b2000001-0000-0000-0000-000000000011';
  rfi_12 UUID := 'b2000001-0000-0000-0000-000000000012';
  rfi_13 UUID := 'b2000001-0000-0000-0000-000000000013';
  rfi_14 UUID := 'b2000001-0000-0000-0000-000000000014';
  rfi_15 UUID := 'b2000001-0000-0000-0000-000000000015';
  rfi_16 UUID := 'b2000001-0000-0000-0000-000000000016';
  rfi_17 UUID := 'b2000001-0000-0000-0000-000000000017';
  rfi_18 UUID := 'b2000001-0000-0000-0000-000000000018';
  rfi_19 UUID := 'b2000001-0000-0000-0000-000000000019';
  rfi_20 UUID := 'b2000001-0000-0000-0000-000000000020';
  rfi_21 UUID := 'b2000001-0000-0000-0000-000000000021';
  rfi_22 UUID := 'b2000001-0000-0000-0000-000000000022';
  rfi_23 UUID := 'b2000001-0000-0000-0000-000000000023';
  rfi_24 UUID := 'b2000001-0000-0000-0000-000000000024';
  rfi_25 UUID := 'b2000001-0000-0000-0000-000000000025';

  sub_01 UUID := 'b3000001-0000-0000-0000-000000000001';
  sub_02 UUID := 'b3000001-0000-0000-0000-000000000002';
  sub_03 UUID := 'b3000001-0000-0000-0000-000000000003';
  sub_04 UUID := 'b3000001-0000-0000-0000-000000000004';
  sub_05 UUID := 'b3000001-0000-0000-0000-000000000005';
  sub_06 UUID := 'b3000001-0000-0000-0000-000000000006';
  sub_07 UUID := 'b3000001-0000-0000-0000-000000000007';
  sub_08 UUID := 'b3000001-0000-0000-0000-000000000008';
  sub_09 UUID := 'b3000001-0000-0000-0000-000000000009';
  sub_10 UUID := 'b3000001-0000-0000-0000-000000000010';
  sub_11 UUID := 'b3000001-0000-0000-0000-000000000011';
  sub_12 UUID := 'b3000001-0000-0000-0000-000000000012';
  sub_13 UUID := 'b3000001-0000-0000-0000-000000000013';
  sub_14 UUID := 'b3000001-0000-0000-0000-000000000014';
  sub_15 UUID := 'b3000001-0000-0000-0000-000000000015';
  sub_16 UUID := 'b3000001-0000-0000-0000-000000000016';
  sub_17 UUID := 'b3000001-0000-0000-0000-000000000017';
  sub_18 UUID := 'b3000001-0000-0000-0000-000000000018';
  sub_19 UUID := 'b3000001-0000-0000-0000-000000000019';
  sub_20 UUID := 'b3000001-0000-0000-0000-000000000020';
  sub_21 UUID := 'b3000001-0000-0000-0000-000000000021';
  sub_22 UUID := 'b3000001-0000-0000-0000-000000000022';
  sub_23 UUID := 'b3000001-0000-0000-0000-000000000023';
  sub_24 UUID := 'b3000001-0000-0000-0000-000000000024';

  dl_01 UUID := 'b4000001-0000-0000-0000-000000000001';
  dl_02 UUID := 'b4000001-0000-0000-0000-000000000002';
  dl_03 UUID := 'b4000001-0000-0000-0000-000000000003';
  dl_04 UUID := 'b4000001-0000-0000-0000-000000000004';
  dl_05 UUID := 'b4000001-0000-0000-0000-000000000005';
  dl_06 UUID := 'b4000001-0000-0000-0000-000000000006';
  dl_07 UUID := 'b4000001-0000-0000-0000-000000000007';
  dl_08 UUID := 'b4000001-0000-0000-0000-000000000008';
  dl_09 UUID := 'b4000001-0000-0000-0000-000000000009';
  dl_10 UUID := 'b4000001-0000-0000-0000-000000000010';
  dl_11 UUID := 'b4000001-0000-0000-0000-000000000011';
  dl_12 UUID := 'b4000001-0000-0000-0000-000000000012';
  dl_13 UUID := 'b4000001-0000-0000-0000-000000000013';
  dl_14 UUID := 'b4000001-0000-0000-0000-000000000014';
  dl_15 UUID := 'b4000001-0000-0000-0000-000000000015';
  dl_16 UUID := 'b4000001-0000-0000-0000-000000000016';
  dl_17 UUID := 'b4000001-0000-0000-0000-000000000017';
  dl_18 UUID := 'b4000001-0000-0000-0000-000000000018';

  crew_frame    UUID := 'b5000001-0000-0000-0000-000000000001';
  crew_concrete UUID := 'b5000001-0000-0000-0000-000000000002';
  crew_mep      UUID := 'b5000001-0000-0000-0000-000000000003';
  crew_elec     UUID := 'b5000001-0000-0000-0000-000000000004';
  crew_finish   UUID := 'b5000001-0000-0000-0000-000000000005';
  crew_roof     UUID := 'b5000001-0000-0000-0000-000000000006';
  crew_siding   UUID := 'b5000001-0000-0000-0000-000000000007';
  crew_glazing  UUID := 'b5000001-0000-0000-0000-000000000008';
  crew_paint    UUID := 'b5000001-0000-0000-0000-000000000009';
  crew_civil    UUID := 'b5000001-0000-0000-0000-000000000010';

  mtg_01 UUID := 'b6000001-0000-0000-0000-000000000001';
  mtg_02 UUID := 'b6000001-0000-0000-0000-000000000002';
  mtg_03 UUID := 'b6000001-0000-0000-0000-000000000003';
  mtg_04 UUID := 'b6000001-0000-0000-0000-000000000004';
  mtg_05 UUID := 'b6000001-0000-0000-0000-000000000005';
  mtg_06 UUID := 'b6000001-0000-0000-0000-000000000006';
  mtg_07 UUID := 'b6000001-0000-0000-0000-000000000007';
  mtg_08 UUID := 'b6000001-0000-0000-0000-000000000008';
  mtg_09 UUID := 'b6000001-0000-0000-0000-000000000009';
  mtg_10 UUID := 'b6000001-0000-0000-0000-000000000010';
  mtg_11 UUID := 'b6000001-0000-0000-0000-000000000011';
  mtg_12 UUID := 'b6000001-0000-0000-0000-000000000012';

  -- Drawings (15 sheets across disciplines)
  dwg_01 UUID := 'b8000001-0000-0000-0000-000000000001';
  dwg_02 UUID := 'b8000001-0000-0000-0000-000000000002';
  dwg_03 UUID := 'b8000001-0000-0000-0000-000000000003';
  dwg_04 UUID := 'b8000001-0000-0000-0000-000000000004';
  dwg_05 UUID := 'b8000001-0000-0000-0000-000000000005';
  dwg_06 UUID := 'b8000001-0000-0000-0000-000000000006';
  dwg_07 UUID := 'b8000001-0000-0000-0000-000000000007';
  dwg_08 UUID := 'b8000001-0000-0000-0000-000000000008';
  dwg_09 UUID := 'b8000001-0000-0000-0000-000000000009';
  dwg_10 UUID := 'b8000001-0000-0000-0000-000000000010';
  dwg_11 UUID := 'b8000001-0000-0000-0000-000000000011';
  dwg_12 UUID := 'b8000001-0000-0000-0000-000000000012';
  dwg_13 UUID := 'b8000001-0000-0000-0000-000000000013';
  dwg_14 UUID := 'b8000001-0000-0000-0000-000000000014';
  dwg_15 UUID := 'b8000001-0000-0000-0000-000000000015';

  -- Equipment (10 items)
  eq_01 UUID := 'b9000001-0000-0000-0000-000000000001';
  eq_02 UUID := 'b9000001-0000-0000-0000-000000000002';
  eq_03 UUID := 'b9000001-0000-0000-0000-000000000003';
  eq_04 UUID := 'b9000001-0000-0000-0000-000000000004';
  eq_05 UUID := 'b9000001-0000-0000-0000-000000000005';
  eq_06 UUID := 'b9000001-0000-0000-0000-000000000006';
  eq_07 UUID := 'b9000001-0000-0000-0000-000000000007';
  eq_08 UUID := 'b9000001-0000-0000-0000-000000000008';
  eq_09 UUID := 'b9000001-0000-0000-0000-000000000009';
  eq_10 UUID := 'b9000001-0000-0000-0000-000000000010';

  -- Safety inspections (8) and toolbox talks (8)
  si_01 UUID := 'ba000001-0000-0000-0000-000000000001';
  si_02 UUID := 'ba000001-0000-0000-0000-000000000002';
  si_03 UUID := 'ba000001-0000-0000-0000-000000000003';
  si_04 UUID := 'ba000001-0000-0000-0000-000000000004';
  si_05 UUID := 'ba000001-0000-0000-0000-000000000005';
  si_06 UUID := 'ba000001-0000-0000-0000-000000000006';
  si_07 UUID := 'ba000001-0000-0000-0000-000000000007';
  si_08 UUID := 'ba000001-0000-0000-0000-000000000008';

  tt_01 UUID := 'bb000001-0000-0000-0000-000000000001';
  tt_02 UUID := 'bb000001-0000-0000-0000-000000000002';
  tt_03 UUID := 'bb000001-0000-0000-0000-000000000003';
  tt_04 UUID := 'bb000001-0000-0000-0000-000000000004';
  tt_05 UUID := 'bb000001-0000-0000-0000-000000000005';
  tt_06 UUID := 'bb000001-0000-0000-0000-000000000006';
  tt_07 UUID := 'bb000001-0000-0000-0000-000000000007';
  tt_08 UUID := 'bb000001-0000-0000-0000-000000000008';

  -- Permits and contracts
  perm_01 UUID := 'bc000001-0000-0000-0000-000000000001';
  perm_02 UUID := 'bc000001-0000-0000-0000-000000000002';
  perm_03 UUID := 'bc000001-0000-0000-0000-000000000003';
  perm_04 UUID := 'bc000001-0000-0000-0000-000000000004';
  perm_05 UUID := 'bc000001-0000-0000-0000-000000000005';

  con_01 UUID := 'bd000001-0000-0000-0000-000000000001';
  con_02 UUID := 'bd000001-0000-0000-0000-000000000002';
  con_03 UUID := 'bd000001-0000-0000-0000-000000000003';
  con_04 UUID := 'bd000001-0000-0000-0000-000000000004';
  con_05 UUID := 'bd000001-0000-0000-0000-000000000005';
  con_06 UUID := 'bd000001-0000-0000-0000-000000000006';

  -- Bid packages and estimates (precon)
  bp_01 UUID := 'be000001-0000-0000-0000-000000000001';
  bp_02 UUID := 'be000001-0000-0000-0000-000000000002';
  bp_03 UUID := 'be000001-0000-0000-0000-000000000003';

  est_01 UUID := 'bf000001-0000-0000-0000-000000000001';
  est_02 UUID := 'bf000001-0000-0000-0000-000000000002';

  sp_01 UUID := 'b7000001-0000-0000-0000-000000000001';
  sp_02 UUID := 'b7000001-0000-0000-0000-000000000002';
  sp_03 UUID := 'b7000001-0000-0000-0000-000000000003';
  sp_04 UUID := 'b7000001-0000-0000-0000-000000000004';
  sp_05 UUID := 'b7000001-0000-0000-0000-000000000005';
  sp_06 UUID := 'b7000001-0000-0000-0000-000000000006';
  sp_07 UUID := 'b7000001-0000-0000-0000-000000000007';
  sp_08 UUID := 'b7000001-0000-0000-0000-000000000008';
  sp_09 UUID := 'b7000001-0000-0000-0000-000000000009';
  sp_10 UUID := 'b7000001-0000-0000-0000-000000000010';
  sp_11 UUID := 'b7000001-0000-0000-0000-000000000011';
  sp_12 UUID := 'b7000001-0000-0000-0000-000000000012';

BEGIN

-- ── Look up the project owner ─────────────────────────────────────────────
SELECT id INTO walker_id FROM auth.users WHERE email = 'wrbenner23@yahoo.com';
IF walker_id IS NULL THEN
  RAISE EXCEPTION 'wrbenner23@yahoo.com not found in auth.users — sign in once first to create the row.';
END IF;

-- Cleanup: prior seed used a non-v4 UUID that the frontend rejects.
-- DELETE CASCADE clears every dependent row (members, RFIs, etc.) before the
-- valid-UUID project is inserted below.
DELETE FROM projects WHERE id = v_old_project_id;

-- =========================================================================
-- 0. CONSULTANT AUTH USERS (8) — bcrypt hash is for "Password123!"
-- =========================================================================
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  is_sso_user, is_anonymous
)
VALUES
  (u_kumar,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'skumar@jci-residential.com',
   '$2a$10$zd4L4pEffpYxkvfOqqErZeZts4hQcsb9OMrUYGC/ia5sbr.D4lK3O', now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('sub', u_kumar::text, 'email', 'skumar@jci-residential.com', 'full_name', 'Sam Kumar', 'email_verified', true, 'phone_verified', false),
   '', '', '', '', false, false),
  (u_goll,      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kgoll@lakelineavery.com',
   '$2a$10$zd4L4pEffpYxkvfOqqErZeZts4hQcsb9OMrUYGC/ia5sbr.D4lK3O', now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('sub', u_goll::text, 'email', 'kgoll@lakelineavery.com', 'full_name', 'Kurt Goll', 'email_verified', true, 'phone_verified', false),
   '', '', '', '', false, false),
  (u_gregorcyk, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dgregorcyk@journeyman.com',
   '$2a$10$zd4L4pEffpYxkvfOqqErZeZts4hQcsb9OMrUYGC/ia5sbr.D4lK3O', now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('sub', u_gregorcyk::text, 'email', 'dgregorcyk@journeyman.com', 'full_name', 'David Gregorcyk', 'email_verified', true, 'phone_verified', false),
   '', '', '', '', false, false),
  (u_rodgers,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jrodgers@bleyl.com',
   '$2a$10$zd4L4pEffpYxkvfOqqErZeZts4hQcsb9OMrUYGC/ia5sbr.D4lK3O', now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('sub', u_rodgers::text, 'email', 'jrodgers@bleyl.com', 'full_name', 'Jason Rodgers', 'email_verified', true, 'phone_verified', false),
   '', '', '', '', false, false),
  (u_leon,      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mleon@crossarchitects.com',
   '$2a$10$zd4L4pEffpYxkvfOqqErZeZts4hQcsb9OMrUYGC/ia5sbr.D4lK3O', now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('sub', u_leon::text, 'email', 'mleon@crossarchitects.com', 'full_name', 'Mark Leon', 'email_verified', true, 'phone_verified', false),
   '', '', '', '', false, false),
  (u_fishbaugh, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mfishbaugh@blufishcollab.com',
   '$2a$10$zd4L4pEffpYxkvfOqqErZeZts4hQcsb9OMrUYGC/ia5sbr.D4lK3O', now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('sub', u_fishbaugh::text, 'email', 'mfishbaugh@blufishcollab.com', 'full_name', 'Mike Fishbaugh', 'email_verified', true, 'phone_verified', false),
   '', '', '', '', false, false),
  (u_perkins,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tperkins@rtpstructural.com',
   '$2a$10$zd4L4pEffpYxkvfOqqErZeZts4hQcsb9OMrUYGC/ia5sbr.D4lK3O', now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('sub', u_perkins::text, 'email', 'tperkins@rtpstructural.com', 'full_name', 'Trent Perkins', 'email_verified', true, 'phone_verified', false),
   '', '', '', '', false, false),
  (u_portnoy,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mportnoy@mepsd.com',
   '$2a$10$zd4L4pEffpYxkvfOqqErZeZts4hQcsb9OMrUYGC/ia5sbr.D4lK3O', now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('sub', u_portnoy::text, 'email', 'mportnoy@mepsd.com', 'full_name', 'Mark Portnoy', 'email_verified', true, 'phone_verified', false),
   '', '', '', '', false, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES
  (gen_random_uuid(), u_kumar,     jsonb_build_object('sub', u_kumar::text,     'email', 'skumar@jci-residential.com',  'email_verified', true, 'phone_verified', false), 'email', u_kumar::text,     now(), now(), now()),
  (gen_random_uuid(), u_goll,      jsonb_build_object('sub', u_goll::text,      'email', 'kgoll@lakelineavery.com',     'email_verified', true, 'phone_verified', false), 'email', u_goll::text,      now(), now(), now()),
  (gen_random_uuid(), u_gregorcyk, jsonb_build_object('sub', u_gregorcyk::text, 'email', 'dgregorcyk@journeyman.com',   'email_verified', true, 'phone_verified', false), 'email', u_gregorcyk::text, now(), now(), now()),
  (gen_random_uuid(), u_rodgers,   jsonb_build_object('sub', u_rodgers::text,   'email', 'jrodgers@bleyl.com',          'email_verified', true, 'phone_verified', false), 'email', u_rodgers::text,   now(), now(), now()),
  (gen_random_uuid(), u_leon,      jsonb_build_object('sub', u_leon::text,      'email', 'mleon@crossarchitects.com',   'email_verified', true, 'phone_verified', false), 'email', u_leon::text,      now(), now(), now()),
  (gen_random_uuid(), u_fishbaugh, jsonb_build_object('sub', u_fishbaugh::text, 'email', 'mfishbaugh@blufishcollab.com','email_verified', true, 'phone_verified', false), 'email', u_fishbaugh::text, now(), now(), now()),
  (gen_random_uuid(), u_perkins,   jsonb_build_object('sub', u_perkins::text,   'email', 'tperkins@rtpstructural.com',  'email_verified', true, 'phone_verified', false), 'email', u_perkins::text,   now(), now(), now()),
  (gen_random_uuid(), u_portnoy,   jsonb_build_object('sub', u_portnoy::text,   'email', 'mportnoy@mepsd.com',          'email_verified', true, 'phone_verified', false), 'email', u_portnoy::text,   now(), now(), now())
ON CONFLICT DO NOTHING;

-- =========================================================================
-- 1. PROJECT
-- =========================================================================
INSERT INTO projects (
  id, name, address, city, state, zip,
  owner_id, general_contractor, contract_value,
  start_date, target_completion, status
) VALUES (
  v_project_id, 'Avery Oaks Apartments', '9019 North Lake Creek Pkwy', 'Austin', 'TX', '78717',
  walker_id, 'Journeyman', 58400000.00, '2020-09-15', '2027-04-30', 'active'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, address = EXCLUDED.address, city = EXCLUDED.city,
  state = EXCLUDED.state, zip = EXCLUDED.zip,
  general_contractor = EXCLUDED.general_contractor,
  contract_value = EXCLUDED.contract_value,
  start_date = EXCLUDED.start_date, target_completion = EXCLUDED.target_completion,
  status = EXCLUDED.status;

-- =========================================================================
-- 2. PROJECT MEMBERS (9: wrbenner23 + 8 consultants)
-- =========================================================================
INSERT INTO project_members (project_id, user_id, role, company, trade, invited_at, accepted_at) VALUES
  (v_project_id, walker_id,    'owner',         'Owner Account',                     'Project Lead',         '2020-09-01', '2020-09-01'),
  (v_project_id, u_kumar,      'admin',         'JCI Residential',                   'Developer',            '2020-09-01', '2020-09-02'),
  (v_project_id, u_goll,       'viewer',        'Lakeline Avery Partners, LP',       'Owner',                '2020-09-01', '2020-09-02'),
  (v_project_id, u_gregorcyk,  'admin',         'Journeyman',                         'General Contractor',  '2020-09-01', '2020-09-02'),
  (v_project_id, u_rodgers,    'member', 'Bleyl Engineering',                  'Civil Engineering',   '2020-09-15', '2020-09-16'),
  (v_project_id, u_leon,       'admin',         'Cross Architects, PLLC',             'Architecture',         '2020-09-15', '2020-09-16'),
  (v_project_id, u_fishbaugh,  'member', 'Blu Fish Collaborative, Inc.',       'Landscape',            '2020-09-15', '2020-09-16'),
  (v_project_id, u_perkins,    'member', 'RTP Structural, PLLC',               'Structural Engineering','2020-09-15', '2020-09-16'),
  (v_project_id, u_portnoy,    'member', 'MEP Systems Design & Engineering',   'MEP Engineering',      '2020-09-15', '2020-09-16')
ON CONFLICT (project_id, user_id) DO NOTHING;

-- =========================================================================
-- 3. RFIs (12)
-- =========================================================================
DELETE FROM rfi_responses WHERE rfi_id IN (rfi_01, rfi_02, rfi_03, rfi_04, rfi_05, rfi_06, rfi_07, rfi_08, rfi_09, rfi_10, rfi_11, rfi_12, rfi_13, rfi_14, rfi_15, rfi_16, rfi_17, rfi_18, rfi_19, rfi_20, rfi_21, rfi_22, rfi_23, rfi_24, rfi_25);
DELETE FROM rfis WHERE id IN (rfi_01, rfi_02, rfi_03, rfi_04, rfi_05, rfi_06, rfi_07, rfi_08, rfi_09, rfi_10, rfi_11, rfi_12, rfi_13, rfi_14, rfi_15, rfi_16, rfi_17, rfi_18, rfi_19, rfi_20, rfi_21, rfi_22, rfi_23, rfi_24, rfi_25);

INSERT INTO rfis (id, project_id, title, description, priority, status, created_by, assigned_to, ball_in_court, drawing_reference, due_date, closed_date, created_at) VALUES
  (rfi_01, v_project_id,
   'Type V wood framing transition at podium deck Building B',
   'The structural drawings show a 6-inch concrete topping over the precast podium deck at Building B, but the architectural drawings show the wood-framed wall sole plate landing 2 inches short of the topping edge. Need clarification on the bearing condition and whether a continuous angle is required.',
   'critical', 'open', u_gregorcyk, u_perkins, u_perkins,
   'S2.10, A4.20', '2026-04-08', NULL, '2026-03-25 09:30:00'),

  (rfi_02, v_project_id,
   'Unit demising wall fire rating at corridor intersection',
   'Spec section 09 21 16 calls for 1-hour rated demising walls between units, but at the corridor intersection on building A floors 2-4, the wall meets a 2-hour rated corridor wall. UL assembly L501 vs U419 — confirm continuity at the head and which assembly governs.',
   'high', 'under_review', u_gregorcyk, u_leon, u_leon,
   'A6.01, A6.02', '2026-04-05', NULL, '2026-03-22 14:00:00'),

  (rfi_03, v_project_id,
   'Plumbing wet stack alignment, units 215/315/415',
   'The plumbing risers shown for the C3 unit type stack from level 2 through 4 do not align between floors at the kitchen sink location. Vertical offset of 14 inches per floor would create unacceptable pipe routing. Please confirm if the unit plan was revised.',
   'high', 'answered', u_portnoy, u_leon, u_portnoy,
   'P3.02, A2.21', '2026-03-28', NULL, '2026-03-15 10:15:00'),

  (rfi_04, v_project_id,
   'Balcony deck waterproofing termination at metal railing posts',
   'The balcony deck assembly per section detail A8.04 shows the Henry Air-Bloc 33MR membrane terminating 2 inches below the railing post base plate. Posts are field welded to embeds in the concrete topping. Confirm the sequence and the sealant grade at the post penetration.',
   'medium', 'under_review', u_gregorcyk, u_leon, u_leon,
   'A8.04', '2026-04-10', NULL, '2026-03-26 11:00:00'),

  (rfi_05, v_project_id,
   'Stair tower 3 wood framing connection to concrete podium',
   'The stair tower 3 wood framing per S4.11 calls for Simpson HD9B holdowns at the base, but the embed plate spacing in the podium deck does not match the holdown spacing required for a 3-story stack. Please provide a revised holdown layout or embed spacing.',
   'high', 'open', u_perkins, u_gregorcyk, u_gregorcyk,
   'S4.11, S2.10', '2026-04-12', NULL, '2026-03-27 08:30:00'),

  (rfi_06, v_project_id,
   'Garage podium parking stall striping conflict with column',
   'Per the architectural plan A1.10, parking stall 47 in the podium garage measures 8.5 ft by 18 ft, but a structural column at grid C7 reduces the effective width to 7.8 ft. Stall does not meet the city of Austin minimum. Need to relocate or eliminate the stall.',
   'medium', 'closed', u_gregorcyk, u_leon, u_gregorcyk,
   'A1.10, S1.10', '2026-03-15', '2026-03-18', '2026-03-08 09:00:00'),

  (rfi_07, v_project_id,
   'HVAC condenser pad spacing, north building rooftop',
   'The mechanical drawings show 24 condenser pads on the north building roof at 18 inches on center, but the structural drawings show roof framing at 24 inches on center. Pad anchors land on framing for only 16 of 24 pads. Please advise on blocking or alternative anchorage.',
   'medium', 'open', u_portnoy, u_perkins, u_perkins,
   'M5.01, S5.01', '2026-04-15', NULL, '2026-03-28 13:30:00'),

  (rfi_08, v_project_id,
   'Site drainage tie-in to existing detention pond',
   'The civil drawings call for a 24-inch RCP storm line tied to the existing detention pond at the southwest property corner. As-built condition shows the existing pond outfall is a 30-inch HDPE. Confirm the transition fitting and required headwall modification.',
   'high', 'answered', u_rodgers, u_gregorcyk, u_rodgers,
   'C3.02', '2026-03-25', NULL, '2026-03-12 11:15:00'),

  (rfi_09, v_project_id,
   'Leasing office finished ceiling height vs MEP routing',
   'The leasing office on the ground floor has a 12-foot finished ceiling shown on A3.01, but the MEP coordination drawing shows ductwork and sprinkler mains requiring 14 inches of ceiling space, leaving only 10 ft 10 in finished height. Need direction on duct rerouting or ceiling reduction.',
   'medium', 'open', u_leon, u_portnoy, u_portnoy,
   'A3.01, M3.01', '2026-04-09', NULL, '2026-03-26 10:00:00'),

  (rfi_10, v_project_id,
   'Pool equipment room ventilation requirement',
   'The pool equipment room shown on M2.05 lacks a dedicated chlorine exhaust per spec section 23 34 23 paragraph 2.3.B. Operating chlorine generator generates corrosive air that must be exhausted at 2 air changes per hour minimum. Please confirm the exhaust fan addition.',
   'high', 'closed', u_portnoy, u_leon, u_portnoy,
   'M2.05', '2026-03-08', '2026-03-12', '2026-02-28 14:00:00'),

  (rfi_11, v_project_id,
   'Landscape irrigation tap location and sleeve coordination',
   'The landscape irrigation main is shown tapping the domestic water at the southwest corner, but the civil utility plan shows the main entry on the north side. The sleeve under the parking lot for the irrigation main has not been called out. Please confirm sleeve routing.',
   'low', 'open', u_fishbaugh, u_rodgers, u_rodgers,
   'L2.01, C4.01', '2026-04-18', NULL, '2026-03-28 09:45:00'),

  (rfi_12, v_project_id,
   'Trash chute fire damper schedule, all buildings',
   'The trash chute on each residential floor is shown on A2.02 typical, but the fire damper schedule on M9.02 only lists dampers for buildings A and B. Building C shows the same chute configuration. Confirm dampers are required on building C or if this is a takeoff omission.',
   'medium', 'closed', u_gregorcyk, u_leon, u_gregorcyk,
   'A2.02, M9.02', '2026-03-22', '2026-03-26', '2026-03-14 08:30:00'),

  (rfi_13, v_project_id,
   'Concrete topping crack control joint spacing, podium decks',
   'Spec section 03 35 00 calls for control joints at maximum 12 feet on center, but the architectural plan shows joints at 16 feet on center to align with the unit demising walls. Need clarification — does the architectural layout govern, and if so, do we need additional reinforcement to control cracking?',
   'medium', 'answered', u_gregorcyk, u_perkins, u_gregorcyk,
   'S2.10, A2.10', '2026-02-20', '2026-02-25', '2026-02-12 10:30:00'),

  (rfi_14, v_project_id,
   'Building entrance ADA threshold detail',
   'The detail on A8.12 shows a 1/2 inch beveled threshold at the building A and B main entries, but ADA requires 1/4 inch maximum vertical at the threshold transition. Confirm if a recessed mat or alternative detail is required to comply with ANSI A117.1.',
   'high', 'answered', u_gregorcyk, u_leon, u_gregorcyk,
   'A8.12', '2026-01-30', '2026-02-03', '2026-01-22 09:00:00'),

  (rfi_15, v_project_id,
   'Window flashing detail at unit B-line balcony doors',
   'The window flashing detail at the balcony doors per A8.21 shows a sill pan with end dams, but field measurement shows the existing rough opening is 1/2 inch shorter than the detail dimension. Need an alternate sill pan size or RO modification approach.',
   'medium', 'closed', u_gregorcyk, u_leon, u_gregorcyk,
   'A8.21', '2026-02-15', '2026-02-19', '2026-02-08 14:00:00'),

  (rfi_16, v_project_id,
   'Domestic water riser sizing for booster pump configuration',
   'The water riser shown on P3.10 is 4 inch DCDA after the booster pump, but pressure calcs in the basis-of-design suggest 5 inch is needed to maintain 50 psi at the upper-floor fixtures during peak demand. Confirm the riser size or revise the calc.',
   'high', 'open', u_portnoy, u_rodgers, u_rodgers,
   'P3.10, P0.01', '2026-04-14', NULL, '2026-04-01 11:30:00'),

  (rfi_17, v_project_id,
   'Storefront glazing thermal performance — lobby curtain wall',
   'The lobby curtain wall section on A6.30 calls for 1 inch insulating glass with low-e coating, but the spec section 08 44 13 calls for triple glazing. Energy compliance requires triple per the COMcheck report. Confirm glazing type for fabrication.',
   'high', 'open', u_gregorcyk, u_leon, u_leon,
   'A6.30, 08 44 13', '2026-04-11', NULL, '2026-03-30 13:15:00'),

  (rfi_18, v_project_id,
   'Building C foundation drain tie-in to area drains',
   'The foundation drain along the north side of building C terminates at the corner per S1.05, but the civil utility plan does not show a tie-in to the area drains. Need clarification on where foundation water is discharged.',
   'medium', 'answered', u_perkins, u_rodgers, u_perkins,
   'S1.05, C2.04', '2026-03-05', '2026-03-09', '2026-02-26 10:00:00'),

  (rfi_19, v_project_id,
   'Elevator shaft cap pour timing — building A',
   'The elevator shaft cap is shown on S5.20 with a separate pour after machine room buildout. Schindler installation requires the cap before equipment rails are set. Need the architect to confirm the sequence and verify the cap thickness is compatible with rail anchors.',
   'high', 'answered', u_gregorcyk, u_leon, u_gregorcyk,
   'S5.20, A5.21', '2026-03-01', '2026-03-05', '2026-02-22 09:30:00'),

  (rfi_20, v_project_id,
   'Roof curb height for HVAC condensers — wind uplift',
   'The roof curb height on M5.05 shows 14 inches, but the wind uplift calculation requires 18 inches minimum to clear the parapet aerodynamic shadow per ASCE 7-22. Confirm curb height or provide alternative uplift detail.',
   'medium', 'open', u_portnoy, u_perkins, u_perkins,
   'M5.05, S5.10', '2026-04-13', NULL, '2026-04-01 09:45:00'),

  (rfi_21, v_project_id,
   'Pool decking slip resistance specification',
   'Spec section 03 35 33 references "non-slip texture" for the pool deck, but does not specify a coefficient of friction value. Pool code requires 0.6 wet COF minimum. Confirm the spec interpretation and confirm the broom finish achieves the required value.',
   'low', 'answered', u_gregorcyk, u_leon, u_gregorcyk,
   '03 35 33', '2026-03-10', '2026-03-13', '2026-03-03 10:30:00'),

  (rfi_22, v_project_id,
   'Mailroom security door hardware — package room access',
   'The package room door (door 105.2) shows a Schlage AD-Series electronic lock per spec, but the fob system specified for tenant amenities (Brivo) does not natively integrate with AD-Series. Confirm hardware change or verify a working integration path.',
   'medium', 'open', u_gregorcyk, u_leon, u_leon,
   '08 71 00', '2026-04-16', NULL, '2026-04-02 14:00:00'),

  (rfi_23, v_project_id,
   'Site retaining wall reveal at building C amenity terrace',
   'The retaining wall on the north side of the building C amenity terrace is shown 4 ft tall on L2.05 but the structural sheets show 4 ft 6 in to accommodate the soil retention requirement. Need landscape and structural to align dimensions and confirm reveal joint location.',
   'low', 'closed', u_fishbaugh, u_perkins, u_fishbaugh,
   'L2.05, S1.30', '2026-02-10', '2026-02-14', '2026-02-02 11:30:00'),

  (rfi_24, v_project_id,
   'Garage ventilation CFM verification',
   'Mechanical drawing M3.10 shows 8,000 CFM total for the podium garage, but the IBC ventilation rate of 0.75 CFM per square foot for 18,400 sf garage equals 13,800 CFM minimum. Confirm calc method or revise the fan schedule.',
   'critical', 'under_review', u_portnoy, u_leon, u_portnoy,
   'M3.10', '2026-04-07', NULL, '2026-03-29 08:30:00'),

  (rfi_25, v_project_id,
   'Unit closet wire shelving load capacity for stacked storage',
   'Owner has requested confirmation that the standard wire closet shelving (ClosetMaid 16 in deep) is rated for 40 lbs/lf. The spec does not call out a specific load rating. Confirm acceptable product or provide alternative.',
   'low', 'open', u_kumar, u_leon, u_leon,
   '12 32 00', '2026-04-20', NULL, '2026-04-05 10:00:00');

-- =========================================================================
-- 4. RFI RESPONSES
-- =========================================================================
INSERT INTO rfi_responses (rfi_id, author_id, content, attachments, created_at) VALUES
  (rfi_03, u_leon,
   'The C3 stack alignment was revised in addendum 3 (issued 02/15/2026). Use the revised unit plan shown on A2.21 sheet revision C. Wet stack should align continuously through floors 2-4 at grid line K.4. Plumbing riser should follow the architectural revision.',
   '[{"name": "Addendum_3_A2_21_RevC.pdf", "size": 412000}]',
   '2026-03-20 15:30:00'),

  (rfi_06, u_leon,
   'Eliminate stall 47. Adjust the striping per attached sketch SK-A1.10.1, which removes the conflicting stall and reallocates the area as a compact stall added at row F. Net loss is one stall, which is acceptable per the parking analysis.',
   '[{"name": "SK_A1_10_1_parking_revision.pdf", "size": 285000}]',
   '2026-03-16 11:00:00'),

  (rfi_08, u_rodgers,
   'Use a 30 to 24 inch concentric reducer at the existing pond outfall headwall. Fabricate the headwall extension per attached detail SK-C3.02.1 with #5 dowels into existing concrete at 12 inches on center. Storm flow direction is unchanged.',
   '[{"name": "SK_C3_02_1_outfall_detail.pdf", "size": 380000}]',
   '2026-03-18 09:00:00'),

  (rfi_10, u_leon,
   'Add a dedicated 600 CFM exhaust fan with corrosion-resistant housing in the pool equipment room. Locate per attached sketch SK-M2.05.1 with discharge through the south wall. Provide the fan with humidity and chlorine sensor controls per spec section 23 09 23.',
   '[{"name": "SK_M2_05_1_pool_exhaust.pdf", "size": 295000}]',
   '2026-03-10 14:00:00'),

  (rfi_12, u_leon,
   'Building C requires fire dampers at every trash chute floor opening, same as buildings A and B. The schedule on M9.02 was incomplete. Use the same damper specification (Greenheck FSD-211 or equal) for all building C openings. Damper schedule revision will be in the next addendum.',
   '[]',
   '2026-03-25 10:30:00'),

  (rfi_02, u_leon,
   'The corridor wall (UL U419, 2-hour) governs at the intersection. Continue the corridor wall through the unit demising wall plane and frame the demising wall to it at both sides. The head detail on A6.02 should be revised to show the corridor wall extending to the structure above with the demising wall butting on each side.',
   '[]',
   '2026-03-26 11:30:00'),

  (rfi_13, u_perkins,
   'The architectural layout governs at 16 ft on center. Add #4 continuous rebar at 16 in on center (perpendicular to joints) within 3 ft each side of the joint to control random cracking. Confirm with architect prior to placement.',
   '[]', '2026-02-22 10:30:00'),

  (rfi_14, u_leon,
   'Per attached SK-A8.12.1, recess the entry mat 1/4 inch into the slab and use a beveled saddle threshold flush to the door sill. ADA compliance is achieved with the recessed mat sequence. Apply to all main building entries.',
   '[{"name": "SK_A8_12_1_threshold.pdf", "size": 220000}]',
   '2026-01-30 10:00:00'),

  (rfi_15, u_leon,
   'Field-modify the rough opening with a 1/2 inch wood blocking strip at the head and re-flash. Sill pan dimension can remain per the original detail. Verify weatherproof sequence with the on-site QC inspection.',
   '[]', '2026-02-12 13:30:00'),

  (rfi_18, u_rodgers,
   'Tie the foundation drain into area drain AD-3 at the northeast corner via a 6 in PVC line at minimum 1% slope. Detail SK-C2.04.1 attached. Verify field elevations before laying pipe.',
   '[{"name": "SK_C2_04_1_fdn_drain.pdf", "size": 280000}]',
   '2026-03-02 11:30:00'),

  (rfi_19, u_leon,
   'Cap pour to occur immediately after pit liner installation and before machine room rough-in. Coordinate with Schindler so that anchors are set in the wet pour. Field-verify cap thickness of 12 in for rail anchorage compatibility.',
   '[]', '2026-02-25 14:00:00'),

  (rfi_21, u_leon,
   'Use a medium broom finish in transverse direction to flow path. The default Texas Decorative Concrete broom finish meets 0.6 wet COF per ASTM C1028. No spec change needed.',
   '[]', '2026-03-08 09:30:00'),

  (rfi_23, u_perkins,
   'Hold the structural wall at 4 ft 6 in for soil retention; landscape architect to revise the reveal in the next plan submission to show top of wall at 4 ft 6 in with a 6 in cap reveal. Confirm prior to formwork.',
   '[]', '2026-02-08 10:00:00');

-- =========================================================================
-- 5. SUBMITTALS (14)
-- =========================================================================
DELETE FROM submittal_approvals WHERE submittal_id IN (sub_01, sub_02, sub_03, sub_04, sub_05, sub_06, sub_07, sub_08, sub_09, sub_10, sub_11, sub_12, sub_13, sub_14, sub_15, sub_16, sub_17, sub_18, sub_19, sub_20, sub_21, sub_22, sub_23, sub_24);
DELETE FROM submittals WHERE id IN (sub_01, sub_02, sub_03, sub_04, sub_05, sub_06, sub_07, sub_08, sub_09, sub_10, sub_11, sub_12, sub_13, sub_14, sub_15, sub_16, sub_17, sub_18, sub_19, sub_20, sub_21, sub_22, sub_23, sub_24);

INSERT INTO submittals (id, project_id, title, spec_section, subcontractor, status, revision_number, lead_time_weeks, submitted_date, due_date, approved_date, created_by, assigned_to, created_at) VALUES
  (sub_01, v_project_id, 'Wood Trusses, Engineered (All Buildings)',         '06 17 33', 'Texas Truss Manufacturing',     'approved',     2, 10, '2025-08-15', '2025-09-30', '2025-10-12', u_gregorcyk, u_perkins, '2025-08-15'),
  (sub_02, v_project_id, 'Cementitious Fiber Siding, James Hardie',          '07 46 46', 'Hardy Siding Contractors',      'approved',     1,  6, '2025-09-20', '2025-10-15', '2025-10-08', u_gregorcyk, u_leon,    '2025-09-20'),
  (sub_03, v_project_id, 'Vinyl Windows, Single-Hung Tilt-In',                '08 53 13', 'Austin Window Specialists',     'approved',     1,  8, '2025-10-01', '2025-11-01', '2025-10-28', u_gregorcyk, u_leon,    '2025-10-01'),
  (sub_04, v_project_id, 'Rooftop HVAC Condensing Units (24)',                '23 81 19', 'Lone Star MEP Services',        'under_review', 1,  8, '2026-02-15', '2026-03-31', NULL,         u_portnoy,   u_leon,    '2026-02-15'),
  (sub_05, v_project_id, 'In-Unit VRF Air Handlers',                          '23 81 26', 'Lone Star MEP Services',        'under_review', 1,  6, '2026-03-01', '2026-04-15', NULL,         u_portnoy,   u_leon,    '2026-03-01'),
  (sub_06, v_project_id, 'Plumbing Fixtures, Unit Standard Package',          '22 40 00', 'Capital Plumbing Co.',          'approved',     1,  4, '2025-11-15', '2025-12-15', '2025-12-08', u_gregorcyk, u_leon,    '2025-11-15'),
  (sub_07, v_project_id, 'Cabinets, Unit Kitchens and Bathrooms',             '12 32 00', 'Hill Country Cabinets',         'resubmit',     2,  8, '2026-01-20', '2026-03-01', NULL,         u_gregorcyk, u_leon,    '2026-01-20'),
  (sub_08, v_project_id, 'Pool Equipment Package',                            '13 11 00', 'AquaTech Pool Systems',         'approved',     1, 10, '2025-09-01', '2025-10-15', '2025-10-12', u_gregorcyk, u_leon,    '2025-09-01'),
  (sub_09, v_project_id, 'Fire Sprinkler System Design',                      '21 13 13', 'Statewide Fire Protection',     'approved',     1,  6, '2025-08-01', '2025-09-15', '2025-09-10', u_portnoy,   u_leon,    '2025-08-01'),
  (sub_10, v_project_id, 'Trash Chute and Compactor System',                  '14 91 33', 'Wilkinson Hi-Rise',             'approved',     1, 12, '2025-07-15', '2025-09-01', '2025-08-28', u_gregorcyk, u_leon,    '2025-07-15'),
  (sub_11, v_project_id, 'Landscape Plant Material Schedule',                 '32 93 00', 'Hill Country Landscape Co.',    'pending',      1,  4, NULL,         '2026-04-30', NULL,         u_fishbaugh, u_leon,    '2026-03-25'),
  (sub_12, v_project_id, 'Mailboxes, USPS-Approved 4C Centralized',           '10 55 19', 'Salsbury Industries (Direct)',  'approved',     1,  8, '2025-12-01', '2026-01-10', '2026-01-05', u_gregorcyk, u_leon,    '2025-12-01'),
  (sub_13, v_project_id, 'Elevator System, MRL 3500lb',                       '14 21 13', 'Schindler Elevator',            'approved',     1, 16, '2025-05-01', '2025-07-01', '2025-06-25', u_gregorcyk, u_leon,    '2025-05-01'),
  (sub_14, v_project_id, 'Stamped Concrete Pool Deck',                        '03 35 33', 'Texas Decorative Concrete',     'rejected',     1,  4, '2026-02-20', '2026-03-15', NULL,         u_gregorcyk, u_leon,    '2026-02-20'),
  (sub_15, v_project_id, 'Vinyl Plank Flooring (Unit Standard)',              '09 65 19', 'Floor & Decor Pro',             'approved',     1,  6, '2025-10-15', '2025-12-01', '2025-11-20', u_gregorcyk, u_leon,    '2025-10-15'),
  (sub_16, v_project_id, 'Interior Paint System',                              '09 91 23', 'Sherwin Williams (Direct)',     'approved',     1,  4, '2025-11-01', '2025-12-15', '2025-12-08', u_gregorcyk, u_leon,    '2025-11-01'),
  (sub_17, v_project_id, 'Quartz Countertops (Unit Kitchens)',                 '12 36 23', 'Stone Solutions Texas',         'approved',     2,  8, '2026-01-05', '2026-02-15', '2026-02-10', u_gregorcyk, u_leon,    '2026-01-05'),
  (sub_18, v_project_id, 'Bathroom Tile, Wall and Floor',                      '09 30 13', 'Hill Country Tile',             'approved',     1,  6, '2025-12-15', '2026-02-01', '2026-01-25', u_gregorcyk, u_leon,    '2025-12-15'),
  (sub_19, v_project_id, 'Asphalt Shingles, 30-Year Architectural',            '07 31 13', 'TAMKO Roofing (Direct)',        'approved',     1,  4, '2025-09-15', '2025-10-30', '2025-10-22', u_gregorcyk, u_leon,    '2025-09-15'),
  (sub_20, v_project_id, 'EV Charging Stations (8 Stalls)',                    '26 27 19', 'ChargePoint Texas',             'pending',      1, 12, NULL,         '2026-05-10', NULL,         u_portnoy,   u_leon,    '2026-04-02'),
  (sub_21, v_project_id, 'Fitness Equipment Package',                          '11 66 13', 'Life Fitness Direct',           'pending',      1, 10, NULL,         '2026-05-05', NULL,         u_gregorcyk, u_leon,    '2026-03-20'),
  (sub_22, v_project_id, 'Backflow Preventers, Domestic Water',                '22 11 19', 'Watts Water (via Capital)',     'approved',     1,  3, '2025-08-15', '2025-09-15', '2025-09-08', u_portnoy,   u_leon,    '2025-08-15'),
  (sub_23, v_project_id, 'Water Heaters, In-Unit Tankless',                    '22 33 30', 'Rinnai Texas',                  'under_review', 1,  6, '2026-03-15', '2026-04-30', NULL,         u_portnoy,   u_leon,    '2026-03-15'),
  (sub_24, v_project_id, 'Window Coverings (Unit Roller Shades)',              '12 24 13', 'Hunter Douglas Direct',         'approved',     1,  6, '2026-01-15', '2026-03-01', '2026-02-25', u_gregorcyk, u_leon,    '2026-01-15');

INSERT INTO submittal_approvals (submittal_id, approver_id, role, status, comments, reviewed_at) VALUES
  (sub_01, u_perkins, 'Structural Engineer', 'approved', 'Truss design loads acceptable. Verify field measurements before fabrication.',                       '2025-10-12 09:30:00'),
  (sub_01, u_leon,    'Architect',           'approved', 'Roof slope and overhang dimensions match the architectural drawings. Approved as noted.',           '2025-10-10 14:00:00'),
  (sub_06, u_leon,    'Architect',           'approved', 'Fixtures match the design intent. Confirm finishes per attached submittal at delivery.',             '2025-12-08 11:00:00'),
  (sub_07, u_leon,    'Architect',           'rejected', 'Cabinet door style does not match the approved sample. Resubmit with correct shaker profile.',       '2026-02-15 13:00:00'),
  (sub_09, u_leon,    'Architect',           'approved', 'Sprinkler design meets NFPA 13 for residential. Approved for permit submission.',                    '2025-09-10 15:00:00'),
  (sub_14, u_leon,    'Architect',           'rejected', 'Pattern shown does not match approved deck mockup. Resubmit with the correct ashlar slate pattern.', '2026-03-12 10:00:00'),
  (sub_15, u_leon,    'Architect',           'approved', 'Color and wear layer match unit standard package. Approved.',                                          '2025-11-20 11:00:00'),
  (sub_17, u_leon,    'Architect',           'approved', 'Quartz pattern verified against approved sample. Resubmittal corrected the seam-direction note. Approved.', '2026-02-10 14:30:00'),
  (sub_18, u_leon,    'Architect',           'approved', 'Tile selection and grout color match design intent.',                                                    '2026-01-25 09:00:00'),
  (sub_19, u_leon,    'Architect',           'approved', 'Architectural shingle approved. Confirm color uniformity at delivery.',                                    '2025-10-22 13:00:00'),
  (sub_22, u_portnoy, 'MEP Engineer',        'approved', 'Reduced-pressure backflow assembly meets cross-connection requirements.',                                  '2025-09-08 10:00:00'),
  (sub_23, u_leon,    'Architect',           'pending',  'Architect deferring to MEP. Awaiting energy-efficiency confirmation.',                                     NULL),
  (sub_24, u_leon,    'Architect',           'approved', 'Roller shade fabric and bracket type approved per submittal.',                                              '2026-02-25 15:00:00');

-- =========================================================================
-- 6. PUNCH ITEMS (18)
-- =========================================================================
DELETE FROM punch_items WHERE project_id = v_project_id;
INSERT INTO punch_items (project_id, title, description, location, floor, area, trade, priority, status, assigned_to, reported_by, due_date, resolved_date, verified_date, photos, created_at) VALUES
  (v_project_id, 'Cabinet door alignment unit 312',                'Upper cabinet doors above the kitchen sink in unit 312 are misaligned by approximately 1/4 inch. Adjust hinges or replace door if damaged.',          'Building A',     'Floor 3', 'Kitchen',           'Cabinets',         'low',      'open',        u_gregorcyk, u_leon, '2026-04-05', NULL, NULL, '[]', '2026-03-22'),
  (v_project_id, 'Paint touch up at corridor B2 baseboard',         'Multiple scuff marks on baseboard along the east wall of corridor B2. Touch up with the spec wall finish.',                                          'Building B',     'Floor 2', 'Corridor',          'Painting',         'low',      'open',        u_gregorcyk, u_leon, '2026-04-08', NULL, NULL, '[]', '2026-03-24'),
  (v_project_id, 'Bathroom exhaust fan not running, unit 415',      'Bathroom exhaust fan in unit 415 master bath is not operating. Check wiring and switch operation.',                                                 'Building A',     'Floor 4', 'Bathroom',          'Electrical',       'medium',   'in_progress', u_portnoy,   u_leon, '2026-03-30', NULL, NULL, '[]', '2026-03-23'),
  (v_project_id, 'Shower drain leaking unit 208',                   'Slow leak observed at the master bath shower drain in unit 208. Water staining on the ceiling of unit 108 below.',                                  'Building A',     'Floor 2', 'Master Bath',       'Plumbing',         'critical', 'in_progress', u_portnoy,   u_gregorcyk, '2026-03-29', NULL, NULL, '[]', '2026-03-25'),
  (v_project_id, 'Pool deck control joint sealant cracked',         'Multiple cracks in the polyurethane sealant at pool deck control joints, especially the joint nearest the equipment room. Recaulk per spec.',      'Pool Area',      'N/A',     'Pool Deck',         'Sealants',         'medium',   'open',        u_gregorcyk, u_leon, '2026-04-12', NULL, NULL, '[]', '2026-03-26'),
  (v_project_id, 'Mailroom 4C door binding',                        'The center door of the centralized mailbox bank is binding and difficult to open. Adjust hinges or door alignment.',                                'Mailroom',       'Floor 1', 'Mailroom',          'Specialties',      'low',      'resolved',    u_gregorcyk, u_kumar, '2026-03-15', '2026-03-14', NULL, '[]', '2026-03-08'),
  (v_project_id, 'Site sidewalk hairline crack at building C entry','Hairline crack in the concrete sidewalk near the front entry of building C, approximately 8 feet long. Monitor and seal if it propagates.',         'Site',           'N/A',     'Sidewalk',          'Concrete',         'medium',   'open',        u_gregorcyk, u_rodgers, '2026-04-10', NULL, NULL, '[]', '2026-03-23'),
  (v_project_id, 'Fitness room mirror chip',                        'A 2 inch by 1 inch chip in the lower right corner of the wall mirror in the fitness room. Replace mirror panel.',                                  'Fitness Room',   'Floor 1', 'Fitness',           'Glazing',          'medium',   'open',        u_gregorcyk, u_leon, '2026-04-08', NULL, NULL, '[]', '2026-03-25'),
  (v_project_id, 'Trash chute door latch failure building C',       'The trash chute door on building C floor 3 does not latch properly. The chute opens with a slight push, which is a fire safety concern.',           'Building C',     'Floor 3', 'Trash Chute',       'Specialties',      'critical', 'open',        u_gregorcyk, u_kumar, '2026-03-30', NULL, NULL, '[]', '2026-03-26'),
  (v_project_id, 'Light fixture missing shade unit 521',            'Bedroom 2 ceiling fixture in unit 521 is missing the frosted glass shade. Verify package was complete and install shade.',                          'Building B',     'Floor 5', 'Bedroom 2',         'Electrical',       'low',      'resolved',    u_portnoy,   u_leon, '2026-03-20', '2026-03-18', NULL, '[]', '2026-03-12'),
  (v_project_id, 'Vinyl plank flooring gap unit 108',               'Approximately 3/16 inch gap in the vinyl plank flooring in the unit 108 living room near the entry door threshold. Adjust transition strip.',     'Building A',     'Floor 1', 'Living Room',       'Flooring',         'medium',   'open',        u_gregorcyk, u_leon, '2026-04-05', NULL, NULL, '[]', '2026-03-24'),
  (v_project_id, 'Window screen torn unit 322',                     'Window screen in unit 322 master bedroom has a 4-inch tear. Replace screen mesh.',                                                                  'Building A',     'Floor 3', 'Master Bedroom',    'Windows',          'low',      'open',        u_gregorcyk, u_leon, '2026-04-10', NULL, NULL, '[]', '2026-03-26'),
  (v_project_id, 'Garage column paint scratch',                     'Long scratch (approximately 18 inches) on column F4 paint finish in the podium garage. Touch up paint.',                                            'Garage',         'P1',      'Parking',           'Painting',         'low',      'open',        u_gregorcyk, u_kumar, '2026-04-12', NULL, NULL, '[]', '2026-03-27'),
  (v_project_id, 'HVAC unit not cooling, unit 230',                 'Tenant feedback indicates the VRF unit in unit 230 is not cooling adequately. Verify refrigerant charge and condenser operation.',                  'Building A',     'Floor 2', 'Living Room',       'HVAC',             'high',     'in_progress', u_portnoy,   u_leon, '2026-04-01', NULL, NULL, '[]', '2026-03-25'),
  (v_project_id, 'Building B exterior siding gap at window head',   'Visible gap between the cementitious fiber siding and window head trim on building B at unit 304 window. Caulk and touch up paint.',                'Building B',     'Floor 3', 'Exterior',          'Siding',           'medium',   'in_progress', u_gregorcyk, u_leon, '2026-04-03', NULL, NULL, '[]', '2026-03-21'),
  (v_project_id, 'Stair handrail loose at stair tower 2',           'The pipe handrail in stair tower 2 between floors 3 and 4 is loose at the upper bracket. Re-anchor to wall.',                                       'Stair Tower 2',  'Floor 3', 'Stairwell',         'Metals',           'high',     'open',        u_gregorcyk, u_perkins, '2026-04-02', NULL, NULL, '[]', '2026-03-25'),
  (v_project_id, 'Pool gate not self-closing',                      'The gate at the pool equipment yard is not self-closing per code requirement. Adjust hinges or replace closer.',                                    'Pool Area',      'N/A',     'Pool Gate',         'Metals',           'high',     'verified',    u_gregorcyk, u_leon, '2026-03-20', '2026-03-18', '2026-03-19', '[]', '2026-03-10'),
  (v_project_id, 'Site lighting fixture aimed incorrectly',         'Site light fixture at the southwest corner of the parking lot is aimed at unit windows instead of the parking surface. Re-aim per the photometric.', 'Site',           'N/A',     'Parking',           'Site Lighting',    'medium',   'in_progress', u_portnoy,   u_kumar, '2026-04-01', NULL, NULL, '[]', '2026-03-22'),
  (v_project_id, 'Outlet missing GFCI cover unit 425 kitchen',       'Kitchen counter receptacle in unit 425 is missing the weather-resistant GFCI cover. Install per code.',                                            'Building B',     'Floor 4', 'Kitchen',           'Electrical',       'low',      'open',        u_portnoy,   u_leon, '2026-04-15', NULL, NULL, '[]', '2026-03-28'),
  (v_project_id, 'Refrigerator water line cap missing unit 105',     'Refrigerator water supply line is open without a cap. Pre-pinned for future installation but currently leaking when valve was tested.',          'Building A',     'Floor 1', 'Kitchen',           'Plumbing',         'high',     'in_progress', u_portnoy,   u_leon, '2026-04-02', NULL, NULL, '[]', '2026-03-29'),
  (v_project_id, 'Drywall corner bead damage corridor A-3',          'Visible damage to metal corner bead at the elevator alcove on corridor A-3. Approximately 6 inches of corner needs to be replaced and refinished.','Building A',     'Floor 3', 'Corridor',          'Drywall',          'low',      'open',        u_gregorcyk, u_leon, '2026-04-12', NULL, NULL, '[]', '2026-03-26'),
  (v_project_id, 'Door hardware reversed unit 218',                  'Bedroom door swing direction is opposite the architectural plan. Check hardware schedule and re-hang door.',                                       'Building A',     'Floor 2', 'Bedroom',           'Doors',            'medium',   'open',        u_gregorcyk, u_leon, '2026-04-08', NULL, NULL, '[]', '2026-03-27'),
  (v_project_id, 'Tile grout color mismatch unit 308 bath',          'Bathroom floor tile grout in unit 308 is gray; spec calls for warm-white. Regrout floor area.',                                                    'Building A',     'Floor 3', 'Master Bath',       'Tile',             'medium',   'open',        u_gregorcyk, u_leon, '2026-04-14', NULL, NULL, '[]', '2026-03-28'),
  (v_project_id, 'HVAC supply diffuser noise unit 412',              'Tenant feedback: bedroom supply diffuser whistles at high fan speed. Adjust damper or replace with low-velocity diffuser.',                        'Building A',     'Floor 4', 'Bedroom',           'HVAC',             'medium',   'in_progress', u_portnoy,   u_leon, '2026-04-05', NULL, NULL, '[]', '2026-03-29'),
  (v_project_id, 'Caulk failure at tub-shower unit 116',              'Polyurethane sealant at the tub-shower-to-wall joint has separated in two places. Recaulk with mildew-resistant silicone.',                       'Building A',     'Floor 1', 'Master Bath',       'Sealants',         'low',      'open',        u_gregorcyk, u_leon, '2026-04-12', NULL, NULL, '[]', '2026-03-28'),
  (v_project_id, 'Stair tread anti-slip strip damage tower 1',       'Anti-slip nosing strip on stair tower 1 between floors 2 and 3 is delaminating in the center of the tread. Replace strip.',                        'Stair Tower 1',  'Floor 2', 'Stairwell',         'Specialties',      'medium',   'open',        u_gregorcyk, u_leon, '2026-04-09', NULL, NULL, '[]', '2026-03-27'),
  (v_project_id, 'Building A floor 2 corridor smoke detector test failure', 'Annual smoke detector test failed for the corridor A-2 detector. Replace and retest.',                                                       'Building A',     'Floor 2', 'Corridor',          'Fire Alarm',       'critical', 'in_progress', u_portnoy,   u_kumar, '2026-04-01', NULL, NULL, '[]', '2026-03-29'),
  (v_project_id, 'Underground utility marker missing at southeast corner', 'Required underground utility location marker is missing at the southeast property corner. Install before final site inspection.',           'Site',           'N/A',     'Site',              'Civil',            'medium',   'open',        u_rodgers,   u_gregorcyk, '2026-04-15', NULL, NULL, '[]', '2026-03-28'),
  (v_project_id, 'Loading dock bumper damage building C',            'Building C loading dock bumper damaged from delivery vehicle impact. Replace bumper and repair adjacent CMU wall paint.',                          'Building C',     'Floor 1', 'Loading Dock',      'Specialties',      'low',      'open',        u_gregorcyk, u_kumar, '2026-04-18', NULL, NULL, '[]', '2026-03-29'),
  (v_project_id, 'Ceiling stain unit 418',                            'Approximately 6 inch by 8 inch yellow stain on the bedroom ceiling in unit 418, possibly from condensate line above. Investigate and repaint.',  'Building A',     'Floor 4', 'Bedroom',           'Painting',         'medium',   'in_progress', u_gregorcyk, u_leon, '2026-04-08', NULL, NULL, '[]', '2026-03-27'),
  (v_project_id, 'Closet door bypass hardware binding unit 522',     'Bypass closet door does not slide smoothly in track. Adjust track alignment.',                                                                     'Building B',     'Floor 5', 'Closet',            'Doors',            'low',      'open',        u_gregorcyk, u_leon, '2026-04-14', NULL, NULL, '[]', '2026-03-28'),
  (v_project_id, 'Patio door threshold gap unit 110',                 'Visible 1/8 inch gap between the patio door threshold and the floor finish. Caulk and verify weather seal.',                                       'Building A',     'Floor 1', 'Living Room',       'Doors',            'medium',   'open',        u_gregorcyk, u_leon, '2026-04-10', NULL, NULL, '[]', '2026-03-29'),
  (v_project_id, 'Dumpster enclosure gate latch broken',              'The gate latch on the dumpster enclosure does not engage. Replace latch hardware.',                                                                'Site',           'N/A',     'Dumpster Yard',     'Specialties',      'low',      'resolved',    u_gregorcyk, u_kumar, '2026-03-25', '2026-03-22', NULL, '[]', '2026-03-15'),
  (v_project_id, 'Building B exterior light timer not adjusted',     'Exterior security lighting on building B is on full-time instead of dusk-to-dawn. Adjust timer per spec.',                                          'Building B',     'N/A',     'Exterior',          'Electrical',       'low',      'verified',    u_portnoy,   u_kumar, '2026-03-22', '2026-03-20', '2026-03-21', '[]', '2026-03-12');

-- =========================================================================
-- 7. TASKS (25)
-- =========================================================================
DELETE FROM tasks WHERE project_id = v_project_id;
INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date, is_critical_path, sort_order, created_at) VALUES
  (v_project_id, 'Frame Building A floor 5 walls',                          'Wood stud framing for unit demising and exterior walls on level 5.',                                  'in_progress','critical', u_gregorcyk, '2026-04-08', true,  1,  '2026-03-15'),
  (v_project_id, 'Pour podium deck topping Building B',                     'Place 4-inch topping over precast podium at building B. Concrete pump on east side.',                'in_progress','high',     u_gregorcyk, '2026-04-05', true,  2,  '2026-03-20'),
  (v_project_id, 'Install MEP rough-in floor 4 Building A',                 'Plumbing, electrical, low voltage rough through framed walls. Coordinate with sprinkler routing.',  'in_progress','high',     u_portnoy,   '2026-04-10', false, 3,  '2026-03-22'),
  (v_project_id, 'Install drywall floors 2 and 3 Building A',               'Hang and finish drywall on completed framing in units and corridors.',                              'in_progress','high',     u_gregorcyk, '2026-04-15', false, 4,  '2026-03-25'),
  (v_project_id, 'Roof installation Building C',                            'Trusses, sheathing, underlayment, asphalt shingle finish per spec.',                                'in_progress','high',     u_gregorcyk, '2026-04-20', true,  5,  '2026-03-15'),
  (v_project_id, 'Site utility tie-ins',                                    'Connect domestic water, sanitary, storm drain to municipal services per civil drawings.',           'in_progress','medium',   u_rodgers,   '2026-05-01', false, 6,  '2026-03-10'),
  (v_project_id, 'Pool excavation and shotcrete',                            'Excavate pool, install rebar cage, shoot shotcrete shell. Cure 28 days before plaster.',           'in_progress','medium',   u_gregorcyk, '2026-05-15', false, 7,  '2026-03-20'),
  (v_project_id, 'Install HVAC condensers on roof',                          'Set 24 condenser pads and units on north building roof. Crane lift required.',                       'todo',       'high',     u_portnoy,   '2026-04-25', false, 8,  '2026-03-25'),
  (v_project_id, 'Cabinet installation units 201-220',                       'Install upper and base cabinets in 20 units after drywall and paint complete.',                     'todo',       'medium',   u_gregorcyk, '2026-05-10', false, 9,  '2026-03-25'),
  (v_project_id, 'Vinyl plank flooring units 101-130',                       'Install LVT in living areas and bedrooms after paint and trim complete.',                            'todo',       'medium',   u_gregorcyk, '2026-05-20', false, 10, '2026-03-22'),
  (v_project_id, 'Building A elevator commissioning',                        'Schindler installation, inspection, and certificate of operation. Required before TCO.',            'todo',       'critical', u_gregorcyk, '2026-06-15', true,  11, '2026-02-15'),
  (v_project_id, 'Site landscape installation phase 1',                      'Trees, shrubs, groundcover at building entries and amenity areas per landscape plan.',              'todo',       'medium',   u_fishbaugh, '2026-06-01', false, 12, '2026-03-10'),
  (v_project_id, 'Final cleaning units floor 1 Building A',                   'Construction clean, polish, and turnover prep for level 1 units.',                                'todo',       'low',      u_gregorcyk, '2026-06-20', false, 13, '2026-03-25'),
  (v_project_id, 'Mailbox installation and USPS approval',                   'Install centralized 4C mailboxes; coordinate USPS inspection for approval.',                        'todo',       'medium',   u_gregorcyk, '2026-05-25', false, 14, '2026-03-15'),
  (v_project_id, 'Fire alarm system test and certification',                  'NFPA 72 testing of all devices. Required for TCO.',                                                'todo',       'critical', u_portnoy,   '2026-06-10', true,  15, '2026-02-20'),
  (v_project_id, 'Asphalt paving parking lots and drives',                   'Hot-mix asphalt placement after subgrade preparation and curb installation.',                        'todo',       'high',     u_rodgers,   '2026-05-05', false, 16, '2026-03-15'),
  (v_project_id, 'Sidewalk and curb pour, site',                              'Place all sidewalks, ADA ramps, and curbs per civil drawings.',                                    'in_progress','medium',   u_gregorcyk, '2026-04-30', false, 17, '2026-03-18'),
  (v_project_id, 'Install garage striping and signage',                      'Stripe parking, install number signs and ADA signage per code.',                                    'todo',       'low',      u_gregorcyk, '2026-06-25', false, 18, '2026-03-25'),
  (v_project_id, 'Window installation Building C',                            'Install vinyl tilt-in windows; flash and seal per manufacturer.',                                  'in_progress','high',     u_gregorcyk, '2026-04-12', false, 19, '2026-03-20'),
  (v_project_id, 'Roof drain installation, Building B',                       'Set primary and overflow drains, connect to interior storm leaders.',                              'in_progress','medium',   u_portnoy,   '2026-04-18', false, 20, '2026-03-22'),
  (v_project_id, 'Stair tower 1 finishes',                                    'Paint walls, install handrails, install metal pan stair finish.',                                  'in_progress','medium',   u_gregorcyk, '2026-04-25', false, 21, '2026-03-20'),
  (v_project_id, 'Leasing office build-out',                                  'Rough plumbing, electrical, drywall, finish carpentry, paint, install reception desk.',           'todo',       'medium',   u_gregorcyk, '2026-05-30', false, 22, '2026-03-15'),
  (v_project_id, 'Fitness room equipment install',                            'Coordinate with vendor for delivery and placement. Final electrical for treadmills.',              'todo',       'low',      u_gregorcyk, '2026-06-30', false, 23, '2026-03-10'),
  (v_project_id, 'Pool plaster and tile',                                     'Apply pebble plaster finish; install waterline tile.',                                              'todo',       'medium',   u_gregorcyk, '2026-06-15', false, 24, '2026-03-15'),
  (v_project_id, 'Punch list completion building A',                          'Resolve all open punch items and verify with the architect.',                                       'todo',       'high',     u_gregorcyk, '2026-07-15', true,  25, '2026-03-15'),
  (v_project_id, 'Set HVAC condensers building B roof',                        'Crane lift 24 condenser units to the building B roof. Coordinate with city for street closure.',     'todo',       'high',     u_portnoy,   '2026-05-08', false, 26, '2026-03-25'),
  (v_project_id, 'Trim and millwork install units 301-330',                    'Install base, casing, and shoe in 30 units after paint complete.',                                  'todo',       'medium',   u_gregorcyk, '2026-05-15', false, 27, '2026-03-25'),
  (v_project_id, 'Cabinet finish hardware install',                            'Install pulls and knobs on all upper and base cabinets.',                                            'todo',       'low',      u_gregorcyk, '2026-05-30', false, 28, '2026-03-25'),
  (v_project_id, 'Plumbing fixture trim out, units 1-100',                     'Trim out faucets, drains, toilets, and showerheads in completed units.',                             'todo',       'medium',   u_portnoy,   '2026-05-25', false, 29, '2026-03-25'),
  (v_project_id, 'Electrical fixture trim out, units 1-100',                   'Trim out switches, receptacles, and ceiling fixtures in completed units.',                           'todo',       'medium',   u_portnoy,   '2026-05-28', false, 30, '2026-03-25'),
  (v_project_id, 'Site irrigation system installation',                         'Drip irrigation main lines, sleeve runs, and head installation per landscape drawings.',           'todo',       'medium',   u_fishbaugh, '2026-05-20', false, 31, '2026-03-15'),
  (v_project_id, 'Site grading final',                                          'Final grading at all building entries and amenity areas. Tolerance per landscape grading plan.',  'todo',       'medium',   u_rodgers,   '2026-05-12', false, 32, '2026-03-15'),
  (v_project_id, 'Building C window installation',                              'Install all vinyl tilt-in windows in building C with flashing.',                                     'in_progress','high',     u_gregorcyk, '2026-04-22', false, 33, '2026-03-22'),
  (v_project_id, 'Building A unit doors hung floor 3',                          'Hang prefinished interior doors with hardware in floor 3 units.',                                    'in_progress','medium',   u_gregorcyk, '2026-04-18', false, 34, '2026-03-25'),
  (v_project_id, 'Garage stall numbering and EV station rough',                 'Number all parking stalls and rough in the 8 EV charging station receptacles.',                    'todo',       'low',      u_portnoy,   '2026-06-05', false, 35, '2026-03-25'),
  (v_project_id, 'Pool plaster prep and bond beam tile',                        'Surface prep, bond beam tile install ahead of pebble plaster finish.',                              'todo',       'medium',   u_gregorcyk, '2026-06-08', false, 36, '2026-03-15'),
  (v_project_id, 'Carpet install in corridors',                                  'Install corridor carpet tile in all three buildings, glue-down system.',                            'todo',       'medium',   u_gregorcyk, '2026-06-12', false, 37, '2026-03-15'),
  (v_project_id, 'Mailroom buildout and 4C install',                            'Drywall, paint, and install centralized mailbox bank.',                                              'todo',       'medium',   u_gregorcyk, '2026-05-28', false, 38, '2026-03-15'),
  (v_project_id, 'Site signage installation',                                    'Install monument sign, building identification signs, and ADA signage.',                            'todo',       'low',      u_gregorcyk, '2026-06-25', false, 39, '2026-03-25'),
  (v_project_id, 'TCO inspection prep building A',                               'Pre-inspection walk and punch documentation for building A TCO request.',                            'todo',       'critical', u_gregorcyk, '2026-07-01', true,  40, '2026-03-25'),
  (v_project_id, 'Storm drain final QC inspection',                              'Walk all storm drain runs, verify slopes, perform city inspection.',                                 'todo',       'medium',   u_rodgers,   '2026-05-22', false, 41, '2026-03-25'),
  (v_project_id, 'Bicycle storage room buildout',                                 'Install racks, lighting, and access control for the bicycle storage room.',                          'todo',       'low',      u_gregorcyk, '2026-06-15', false, 42, '2026-03-15'),
  (v_project_id, 'Owner FF&E coordination',                                       'Coordinate with the owner-furnished fitness equipment, leasing office furniture, and clubhouse delivery.', 'todo',   'medium',   u_gregorcyk, '2026-07-08', false, 43, '2026-03-15'),
  (v_project_id, 'Fire department final connection test',                         'Witness fire department connection (FDC) flow test with AHJ. Required for TCO.',                    'todo',       'critical', u_portnoy,   '2026-06-20', true,  44, '2026-02-25'),
  (v_project_id, 'Substantial completion walk with owner',                        'Joint walk with owner, architect, and GC to confirm substantial completion conditions.',           'todo',       'critical', u_gregorcyk, '2026-07-25', true,  45, '2026-03-15'),
  -- Historical tasks (completed) so progress looks realistic for a 72% project
  (v_project_id, 'Mobilization and site fence installation',                      'Initial mobilization, trailer placement, perimeter fence.',                                          'done',       'high',     u_gregorcyk, '2020-12-01', false, 46, '2020-09-15'),
  (v_project_id, 'Mass excavation and grading',                                    'Strip topsoil, mass excavation, rough grade per civil drawings.',                                    'done',       'high',     u_rodgers,   '2021-04-01', false, 47, '2020-12-01'),
  (v_project_id, 'Underground utilities installation',                             'Domestic water, sanitary sewer, storm drain mains and service taps.',                                'done',       'high',     u_rodgers,   '2021-06-30', false, 48, '2021-04-15'),
  (v_project_id, 'Building A podium concrete pour',                                'Place podium deck concrete for building A.',                                                          'done',       'critical', u_gregorcyk, '2022-02-28', true,  49, '2021-04-15'),
  (v_project_id, 'Building B podium concrete pour',                                'Place podium deck concrete for building B.',                                                          'done',       'critical', u_gregorcyk, '2022-08-31', true,  50, '2021-09-01'),
  (v_project_id, 'Building C podium concrete pour',                                'Place podium deck concrete for building C.',                                                          'done',       'critical', u_gregorcyk, '2023-01-31', true,  51, '2022-02-01'),
  (v_project_id, 'Building A wood framing floors 1-4',                             'Wood stud framing for floors 1 through 4 of building A.',                                            'done',       'critical', u_gregorcyk, '2026-02-15', true,  52, '2025-09-01'),
  (v_project_id, 'Building B wood framing floors 1-3',                             'Wood stud framing for floors 1 through 3 of building B.',                                            'done',       'high',     u_gregorcyk, '2025-12-15', false, 53, '2025-06-01'),
  (v_project_id, 'Building B podium deck topping pour',                            'Place 4-inch concrete topping over building B precast podium.',                                       'done',       'critical', u_gregorcyk, '2026-03-24', true,  54, '2026-03-20'),
  (v_project_id, 'Building A floor 5 framing',                                     'Wood stud framing for level 5 of building A.',                                                        'done',       'critical', u_gregorcyk, '2026-04-01', true,  55, '2026-03-15'),
  (v_project_id, 'Building C truss installation',                                  'Set engineered roof trusses for building C.',                                                          'done',       'high',     u_gregorcyk, '2026-04-03', false, 56, '2026-03-25'),
  (v_project_id, 'HVAC condenser placement building A roof',                       'Crane-set 24 condenser units on building A roof.',                                                    'done',       'high',     u_portnoy,   '2026-04-10', false, 57, '2026-03-25'),
  (v_project_id, 'Pool excavation and shotcrete',                                   'Excavate pool, install rebar, place shotcrete shell.',                                                'done',       'medium',   u_gregorcyk, '2026-04-06', false, 58, '2026-03-20'),
  (v_project_id, 'Storm drain tie-in to detention pond',                            'Tie 24-inch RCP storm line into existing detention pond outfall.',                                    'done',       'medium',   u_rodgers,   '2026-03-28', false, 59, '2026-03-15');

-- =========================================================================
-- 8. DAILY LOGS (8) with entries
-- =========================================================================
DELETE FROM daily_log_entries WHERE daily_log_id IN (dl_01, dl_02, dl_03, dl_04, dl_05, dl_06, dl_07, dl_08, dl_09, dl_10, dl_11, dl_12, dl_13, dl_14, dl_15, dl_16, dl_17, dl_18);
DELETE FROM daily_logs WHERE id IN (dl_01, dl_02, dl_03, dl_04, dl_05, dl_06, dl_07, dl_08, dl_09, dl_10, dl_11, dl_12, dl_13, dl_14, dl_15, dl_16, dl_17, dl_18);

INSERT INTO daily_logs (id, project_id, log_date, weather, temperature_high, temperature_low, workers_onsite, total_hours, incidents, summary, ai_summary, approved, approved_by, approved_at, created_by, created_at) VALUES
  (dl_01, v_project_id, '2026-03-21', 'Clear',          78, 58, 92,  736, 0,
   'Productive day across all three buildings. Framing crew on building A floor 4 completed the demising walls. Concrete crew finished forming the building B podium deck in preparation for Tuesday pour.',
   'Solid Saturday with 92 workers. Framing on track for building A. Podium deck forming complete and ready for inspection Monday.',
   true, u_kumar, '2026-03-22 07:00:00', u_gregorcyk, '2026-03-21 16:30:00'),

  (dl_02, v_project_id, '2026-03-23', 'Partly Cloudy',  74, 55, 105, 840, 0,
   'Building B podium deck pour pre-pour inspection passed at 8 AM. Concrete pump on standby. Building A framing crew at floor 4. MEP rough-in continued on building A floors 2 and 3.',
   'Pre-pour inspection passed. All trades coordinated for Tuesday pump operation. No issues observed.',
   true, u_kumar, '2026-03-24 07:00:00', u_gregorcyk, '2026-03-23 17:00:00'),

  (dl_03, v_project_id, '2026-03-24', 'Clear',          82, 62, 118, 944, 1,
   'Building B podium deck pour completed successfully. 165 cubic yards placed between 6 AM and 11 AM. Minor first aid: laborer cut hand on rebar tie wire, cleaned and bandaged on site.',
   'Major milestone: building B podium pour complete. Peak headcount of 118. One first aid recordable for hand cut, no lost time.',
   true, u_kumar, '2026-03-25 07:00:00', u_gregorcyk, '2026-03-24 17:30:00'),

  (dl_04, v_project_id, '2026-03-25', 'Clear',          84, 64, 102, 816, 0,
   'Concrete cured per schedule. Started shoring removal on isolated portions of building B podium. Building A framing reached floor 5. Roofing crew mobilized to building C.',
   'Clean recovery from pour day. Multiple parallel activities. Roofing mobilization adds visual progress for owner inspection.',
   true, u_kumar, '2026-03-26 07:00:00', u_gregorcyk, '2026-03-25 17:00:00'),

  (dl_05, v_project_id, '2026-03-26', 'Rain',           62, 48, 65,  520, 0,
   'Heavy rain starting at 6 AM. Exterior framing and roofing suspended. Interior trades continued on completed buildings. Drywall hangers reached floor 2 building A finish work.',
   'Rain day reduced productivity by 38%. Interior trades unaffected. No schedule impact on critical path tasks.',
   true, u_kumar, '2026-03-27 07:00:00', u_gregorcyk, '2026-03-26 16:00:00'),

  (dl_06, v_project_id, '2026-03-27', 'Clear',          76, 56, 110, 880, 0,
   'Resumed full operations. Roofing on building C began trusses set with the crane. MEP rough-in advanced on building A floor 3. Drywall finishing continued on floors 1 and 2.',
   'Full recovery from rain day. Crane operations safe with steady winds. Building C roofing officially started.',
   true, u_kumar, '2026-03-28 07:00:00', u_gregorcyk, '2026-03-27 17:00:00'),

  (dl_07, v_project_id, '2026-03-28', 'Partly Cloudy',  72, 54, 108, 864, 0,
   'Continued progress across all three buildings. Building C truss installation 30% complete. Site civil crews installing storm drain at the southwest pond outfall. Pool excavation began.',
   'Strong production. Building C trusses progressing. Pool excavation kicked off, crew on tight rhythm with civil work.',
   true, u_kumar, '2026-03-29 07:00:00', u_gregorcyk, '2026-03-28 17:00:00'),

  (dl_08, v_project_id, '2026-03-30', 'Clear',          75, 55, 115, 920, 0,
   'Best weather of the week. All trades at planned manning. Building A floor 5 framing 70% complete. Window installation began on building C floor 1. Pool excavation 50% complete.',
   'Excellent Monday with 115 workers. Multiple buildings advancing in parallel. Pool excavation ahead of schedule.',
   true, u_kumar, '2026-03-31 07:00:00', u_gregorcyk, '2026-03-30 17:00:00'),

  (dl_09, v_project_id, '2026-03-31', 'Clear',          78, 58, 118, 944, 0,
   'Continued strong production. Building A floor 5 framing reached 90% complete. Building C truss installation 60% complete. MEP rough-in began on floor 4 building A. Storm drain tie-in inspection passed.',
   'Excellent Tuesday. Multiple critical-path tasks advanced: framing, trusses, MEP rough-in. Storm drain inspection cleared.',
   true, u_kumar, '2026-04-01 07:00:00', u_gregorcyk, '2026-03-31 17:00:00'),

  (dl_10, v_project_id, '2026-04-01', 'Cloudy',         70, 52, 102, 816, 0,
   'Building A floor 5 framing complete. Truss delivery for building C arrived; staged for set on April 2. Drywall hanging continued floors 1-3 building A. Pool excavation completed; rebar prep began.',
   'Major milestone: building A floor 5 framing complete. Truss delivery received on schedule.',
   true, u_kumar, '2026-04-02 07:00:00', u_gregorcyk, '2026-04-01 17:00:00'),

  (dl_11, v_project_id, '2026-04-02', 'Partly Cloudy',  72, 54, 112, 896, 0,
   'Building C truss set continued; 80% complete. Pool rebar inspection passed; shotcrete scheduled for April 6. Drywall finishing reached floor 3 building A. HVAC condensers staged for set on roof.',
   'Truss work nearing completion on building C. Pool moves into shotcrete phase. Coordinated condenser logistics with crane vendor.',
   true, u_kumar, '2026-04-03 07:00:00', u_gregorcyk, '2026-04-02 17:00:00'),

  (dl_12, v_project_id, '2026-04-03', 'Clear',          76, 58, 109, 872, 1,
   'Building C truss installation 100% complete. Sheathing started on building C roof. Minor first aid: drywall hanger struck shin on a stray screw — bandaged on site.',
   'Truss milestone achieved. Roofing sheathing under way. One minor first aid; no lost time.',
   true, u_kumar, '2026-04-04 07:00:00', u_gregorcyk, '2026-04-03 17:00:00'),

  (dl_13, v_project_id, '2026-04-04', 'Clear',          78, 60, 88,  704, 0,
   'Saturday crew advanced building A drywall finishing. Site civil tied in storm drain on the southwest corner. No deliveries on site.',
   'Half-day Saturday with limited trades. Storm drain tie-in completed.',
   true, u_kumar, '2026-04-05 07:00:00', u_gregorcyk, '2026-04-04 14:30:00'),

  (dl_14, v_project_id, '2026-04-06', 'Clear',          82, 62, 124, 992, 0,
   'Pool shotcrete placed: 65 cubic yards. Building C roof sheathing 80% complete. MEP rough-in advanced building A floor 4. Curb forming began for site asphalt.',
   'Pool shotcrete milestone. Building C roof advancing fast. Site infrastructure prep active.',
   true, u_kumar, '2026-04-07 07:00:00', u_gregorcyk, '2026-04-06 17:30:00'),

  (dl_15, v_project_id, '2026-04-07', 'Clear',          84, 64, 116, 928, 0,
   'Pool shotcrete cure underway. Building C roof underlayment installation. Drywall hanging building A floor 4. Window installation building C floors 1-2 complete.',
   'Multiple parallel finishing activities. Building C envelope nearing tight.',
   true, u_kumar, '2026-04-08 07:00:00', u_gregorcyk, '2026-04-07 17:00:00'),

  (dl_16, v_project_id, '2026-04-08', 'Rain',           58, 46, 48,  384, 0,
   'Heavy rain all day. Exterior work suspended. Drywall, plumbing rough-in, electrical rough-in continued indoors. Pool cure unaffected (under tarp).',
   'Rain day. Productivity at 40% but interior trades continued. No critical-path impact.',
   true, u_kumar, '2026-04-09 07:00:00', u_gregorcyk, '2026-04-08 16:00:00'),

  (dl_17, v_project_id, '2026-04-09', 'Partly Cloudy',  68, 52, 105, 840, 0,
   'Resumed full operations after rain. Building C asphalt shingle installation began. Building A floor 4 drywall finishing started. HVAC condensers crane-set on building A roof: 12 of 24 placed.',
   'Recovery from rain. Roofing finish work began. Half of north building condensers set.',
   true, u_kumar, '2026-04-10 07:00:00', u_gregorcyk, '2026-04-09 17:00:00'),

  (dl_18, v_project_id, '2026-04-10', 'Clear',          74, 56, 121, 968, 0,
   'Best production day in two weeks. HVAC condensers 24 of 24 set on building A roof. Building C shingle installation 30% complete. Pool tile install began. MEP rough-in inspection passed building A floor 3.',
   'Multiple wins: condensers complete, pool tile, inspection passed. Strong recovery from rain.',
   false, NULL, NULL, u_gregorcyk, '2026-04-10 17:00:00');

INSERT INTO daily_log_entries (daily_log_id, type, trade, headcount, hours, equipment_name, equipment_hours, description, created_at) VALUES
  (dl_01, 'manpower', 'Framing',           18, 144, NULL, NULL, 'Building A floor 4 demising walls', '2026-03-21 07:00:00'),
  (dl_01, 'manpower', 'Concrete',          22, 176, NULL, NULL, 'Forming building B podium deck',    '2026-03-21 07:00:00'),
  (dl_01, 'manpower', 'MEP',               14, 112, NULL, NULL, 'Plumbing rough-in floor 2',         '2026-03-21 07:00:00'),
  (dl_01, 'equipment', NULL, NULL, NULL, 'Manlift JLG 600S',     8, 'Framing access and material moves', '2026-03-21 07:00:00'),

  (dl_03, 'manpower', 'Concrete',          30, 240, NULL, NULL, 'Building B podium pour, 165 CY',    '2026-03-24 06:00:00'),
  (dl_03, 'manpower', 'Framing',           20, 160, NULL, NULL, 'Building A floor 4 walls',          '2026-03-24 07:00:00'),
  (dl_03, 'manpower', 'MEP',               18, 144, NULL, NULL, 'MEP rough-in floors 2 and 3',       '2026-03-24 07:00:00'),
  (dl_03, 'equipment', NULL, NULL, NULL, 'Concrete Pump Schwing S 36X', 6, 'Building B podium pour', '2026-03-24 06:00:00'),
  (dl_03, 'incident', NULL, NULL, NULL, NULL, NULL, 'Laborer cut hand on rebar tie wire while placing rebar in podium deck. Cleaned, bandaged on site by safety officer. Tetanus current. Worker returned to light duty after 20 minutes.', '2026-03-24 09:30:00'),

  (dl_07, 'manpower', 'Roofing',           14, 112, NULL, NULL, 'Building C trusses set 30% complete', '2026-03-28 07:00:00'),
  (dl_07, 'manpower', 'Civil',             12,  96, NULL, NULL, 'Storm drain pond outfall',           '2026-03-28 07:00:00'),
  (dl_07, 'manpower', 'Excavation',         8,  64, NULL, NULL, 'Pool excavation begin',              '2026-03-28 07:00:00'),
  (dl_07, 'equipment', NULL, NULL, NULL, 'Crane Grove RT 880',         8, 'Building C truss picks',  '2026-03-28 07:00:00'),
  (dl_07, 'equipment', NULL, NULL, NULL, 'Excavator CAT 320',          8, 'Pool excavation',          '2026-03-28 07:00:00'),

  (dl_08, 'manpower', 'Framing',           22, 176, NULL, NULL, 'Building A floor 5 framing 70%',    '2026-03-30 07:00:00'),
  (dl_08, 'manpower', 'Roofing',           16, 128, NULL, NULL, 'Building C truss continuation',     '2026-03-30 07:00:00'),
  (dl_08, 'manpower', 'Glazing',           10,  80, NULL, NULL, 'Window install building C floor 1', '2026-03-30 07:00:00'),
  (dl_08, 'manpower', 'Excavation',         8,  64, NULL, NULL, 'Pool excavation 50% complete',      '2026-03-30 07:00:00'),
  (dl_08, 'note', NULL, NULL, NULL, NULL, NULL, 'Pool deck submittal rejection received from architect. Texas Decorative Concrete to resubmit with the correct ashlar slate pattern by April 5.', '2026-03-30 14:00:00'),

  (dl_10, 'manpower', 'Framing',          22, 176, NULL, NULL, 'Building A floor 5 framing 100%',          '2026-04-01 07:00:00'),
  (dl_10, 'manpower', 'Drywall',          18, 144, NULL, NULL, 'Drywall hanging floors 1-3',                '2026-04-01 07:00:00'),
  (dl_10, 'manpower', 'Excavation',        6,  48, NULL, NULL, 'Pool rebar prep',                            '2026-04-01 07:00:00'),
  (dl_10, 'equipment', NULL, NULL, NULL, 'Crane Grove RT 880',                 6, 'Truss delivery offload', '2026-04-01 07:00:00'),

  (dl_12, 'manpower', 'Roofing',          18, 144, NULL, NULL, 'Building C truss completion + sheathing',   '2026-04-03 07:00:00'),
  (dl_12, 'manpower', 'Drywall',          16, 128, NULL, NULL, 'Floor 3 building A finishing',              '2026-04-03 07:00:00'),
  (dl_12, 'incident', NULL, NULL, NULL, NULL, NULL, 'Drywall hanger struck shin on stray screw protruding from a stud. Wound cleaned, antiseptic and bandage applied. No lost time. Reminder issued at toolbox talk.', '2026-04-03 11:00:00'),

  (dl_14, 'manpower', 'Concrete',         24, 192, NULL, NULL, 'Pool shotcrete pour, 65 CY',                '2026-04-06 06:30:00'),
  (dl_14, 'manpower', 'Roofing',          18, 144, NULL, NULL, 'Building C roof sheathing 80%',             '2026-04-06 07:00:00'),
  (dl_14, 'manpower', 'MEP',              16, 128, NULL, NULL, 'Floor 4 rough-in building A',                '2026-04-06 07:00:00'),
  (dl_14, 'equipment', NULL, NULL, NULL, 'Shotcrete Pump',                    7, 'Pool shotcrete',           '2026-04-06 06:30:00'),

  (dl_17, 'manpower', 'Roofing',          16, 128, NULL, NULL, 'Building C asphalt shingle install begin',  '2026-04-09 07:00:00'),
  (dl_17, 'manpower', 'Drywall',          18, 144, NULL, NULL, 'Floor 4 building A finishing',              '2026-04-09 07:00:00'),
  (dl_17, 'manpower', 'HVAC',             14, 112, NULL, NULL, 'Crane-set condensers (12 of 24)',           '2026-04-09 07:00:00'),
  (dl_17, 'equipment', NULL, NULL, NULL, 'Crane Grove RT 880',                 8, 'Condenser placement',     '2026-04-09 07:00:00'),

  (dl_18, 'manpower', 'HVAC',             14, 112, NULL, NULL, 'Condenser set complete (24 of 24)',         '2026-04-10 07:00:00'),
  (dl_18, 'manpower', 'Roofing',          18, 144, NULL, NULL, 'Building C shingle install 30%',            '2026-04-10 07:00:00'),
  (dl_18, 'manpower', 'Tile',             10,  80, NULL, NULL, 'Pool tile install begin',                    '2026-04-10 07:00:00'),
  (dl_18, 'manpower', 'MEP',              16, 128, NULL, NULL, 'Floor 3 inspection prep + passed',          '2026-04-10 07:00:00');

-- =========================================================================
-- 9. CREWS (5)
-- =========================================================================
DELETE FROM crews WHERE id IN (crew_frame, crew_concrete, crew_mep, crew_elec, crew_finish, crew_roof, crew_siding, crew_glazing, crew_paint, crew_civil) OR project_id = v_project_id;
INSERT INTO crews (id, project_id, name, lead_id, trade, size, current_task, location, productivity_score, status, certifications, created_at) VALUES
  (crew_frame,    v_project_id, 'Lone Star Framers Crew 1',    u_gregorcyk, 'Wood Framing',     22, 'Building A floor 5 framing',          'Building A',    91, 'active', '["OSHA 30","Powder Actuated Tool Certified"]',                  '2024-11-01'),
  (crew_concrete, v_project_id, 'Capital Concrete Texas',       u_gregorcyk, 'Concrete',         24, 'Building B podium deck topping',      'Building B',    88, 'active', '["OSHA 30","ACI Concrete Field Testing","Crane Signaling"]',     '2024-09-01'),
  (crew_mep,      v_project_id, 'Lone Star MEP Crew A',         u_portnoy,   'MEP',              18, 'MEP rough-in building A floors 2-3',   'Building A',    87, 'active', '["OSHA 10","EPA 608 Universal","Journeyman Plumber","Journeyman Electrician"]', '2025-01-15'),
  (crew_elec,     v_project_id, 'Capital Electrical Team 1',    u_portnoy,   'Electrical',       12, 'Branch circuit rough building A',     'Building A',    89, 'active', '["OSHA 10","Journeyman Electrician","Arc Flash Certified"]',     '2025-02-15'),
  (crew_finish,   v_project_id, 'Hill Country Finishers',       u_gregorcyk, 'Finishes',         14, 'Drywall finishing floors 1-2',         'Building A',    84, 'behind', '["OSHA 10","Lead Paint Certified"]',                              '2025-09-01'),
  (crew_roof,     v_project_id, 'TAMKO Roofing Crew C',          u_gregorcyk, 'Roofing',          16, 'Building C asphalt shingles',          'Building C',    93, 'active', '["OSHA 30","Manufacturer Certified Installer","Fall Protection"]', '2025-08-15'),
  (crew_siding,   v_project_id, 'Hardy Siding Contractors',      u_gregorcyk, 'Exterior Siding',  10, 'Building A exterior siding',           'Building A',    86, 'active', '["OSHA 10","James Hardie Certified Installer"]',                  '2025-09-15'),
  (crew_glazing,  v_project_id, 'Austin Window Specialists',     u_gregorcyk, 'Glazing',           8, 'Building C window installation',       'Building C',    90, 'active', '["OSHA 10","Manufacturer Certified Installer"]',                  '2025-10-15'),
  (crew_paint,    v_project_id, 'Sherwin Williams Pro Painters', u_gregorcyk, 'Painting',         12, 'Floor 1 building A finish paint',      'Building A',    88, 'active', '["OSHA 10","Lead Paint Certified","RRP Certified"]',              '2025-11-01'),
  (crew_civil,    v_project_id, 'Bleyl Civil Site Team',         u_rodgers,   'Civil',            10, 'Storm drain final tie-in',             'Site',          82, 'active', '["OSHA 30","Trench Safety","Confined Space"]',                    '2024-10-01');

-- =========================================================================
-- 10. BUDGET ITEMS (CSI Division)
-- =========================================================================
DELETE FROM budget_items WHERE project_id = v_project_id;
INSERT INTO budget_items (project_id, division, description, original_amount, committed_amount, actual_amount, forecast_amount, percent_complete, status) VALUES
  (v_project_id, '01 00 00', 'General Conditions',                    4200000,  4150000,  3000000,  4200000,  72, 'on_track'),
  (v_project_id, '03 00 00', 'Concrete (Podium and Site)',            5800000,  5950000,  4800000,  6000000,  80, 'at_risk'),
  (v_project_id, '04 00 00', 'Masonry (Stair Towers)',                 850000,   840000,   600000,   850000,  72, 'on_track'),
  (v_project_id, '05 00 00', 'Metals',                                1200000,  1180000,   850000,  1200000,  68, 'on_track'),
  (v_project_id, '06 00 00', 'Wood Framing and Trusses',              7800000,  7950000,  5400000,  8000000,  68, 'at_risk'),
  (v_project_id, '07 00 00', 'Thermal and Moisture Protection',       3400000,  3380000,  2100000,  3400000,  62, 'on_track'),
  (v_project_id, '08 00 00', 'Doors, Windows, Storefronts',           4200000,  4150000,  2400000,  4200000,  58, 'on_track'),
  (v_project_id, '09 00 00', 'Finishes (Drywall, Paint, Flooring)',   6800000,  6700000,  3000000,  6800000,  44, 'on_track'),
  (v_project_id, '10 00 00', 'Specialties (Mailboxes, Trash Chute)',   720000,   700000,   400000,   720000,  56, 'on_track'),
  (v_project_id, '11 00 00', 'Equipment (Pool, Fitness)',              480000,   470000,   200000,   470000,  43, 'on_track'),
  (v_project_id, '12 00 00', 'Furnishings (Cabinets, Window Coverings)',2200000, 2150000,   900000,  2200000,  41, 'on_track'),
  (v_project_id, '14 00 00', 'Conveying Equipment (Elevators)',       1100000,  1100000,   650000,  1100000,  59, 'on_track'),
  (v_project_id, '21 00 00', 'Fire Protection',                       1200000,  1180000,   650000,  1180000,  55, 'on_track'),
  (v_project_id, '22 00 00', 'Plumbing',                              3800000,  3750000,  2200000,  3800000,  58, 'on_track'),
  (v_project_id, '23 00 00', 'HVAC',                                  3200000,  3300000,  1800000,  3300000,  55, 'at_risk'),
  (v_project_id, '26 00 00', 'Electrical',                            3600000,  3550000,  2000000,  3600000,  55, 'on_track'),
  (v_project_id, '31 00 00', 'Earthwork',                             1100000,  1080000,  1080000,  1080000, 100, 'on_track'),
  (v_project_id, '32 00 00', 'Exterior Improvements (Paving, Site)',  1850000,  1820000,   800000,  1850000,  43, 'on_track'),
  (v_project_id, '33 00 00', 'Utilities',                              980000,   970000,   780000,   980000,  80, 'on_track');

-- =========================================================================
-- 11. CHANGE ORDERS (4)
-- =========================================================================
DELETE FROM change_orders WHERE project_id = v_project_id;
INSERT INTO change_orders (project_id, description, amount, status, requested_by, requested_date, approved_date, created_at) VALUES
  (v_project_id, 'Owner-requested upgrade of unit kitchen countertops from laminate to quartz across all 294 units. Includes additional cabinet structural reinforcement.',
   485000, 'approved', 'Lakeline Avery Partners, LP', '2024-12-10', '2025-01-05', '2024-12-10'),
  (v_project_id, 'Unforeseen rock encountered during pool excavation requiring hydraulic breaker. Approximately 80 cubic yards of rock removed and hauled off site.',
   62000, 'approved', 'Journeyman', '2026-03-20', '2026-03-26', '2026-03-20'),
  (v_project_id, 'Addition of EV charging stations (8 dedicated stalls) per City of Austin parking requirement update.',
   175000, 'pending_review', 'Lakeline Avery Partners, LP', '2026-03-25', NULL, '2026-03-25'),
  (v_project_id, 'Credit for substitution of standard balcony railing for the upgraded glass panel system originally specified.',
   -88000, 'approved', 'Journeyman', '2025-11-15', '2025-12-10', '2025-11-15'),
  (v_project_id, 'Owner-requested upgrade of all unit interior doors from hollow-core to solid-core for improved sound transmission. 588 doors total.',
   142000, 'approved', 'Lakeline Avery Partners, LP', '2025-08-15', '2025-09-12', '2025-08-15'),
  (v_project_id, 'Additional rebar at podium control joint locations per RFI 013 response. 3,400 lbs supplemental reinforcement.',
   18500, 'approved', 'Journeyman', '2026-02-26', '2026-03-08', '2026-02-26'),
  (v_project_id, 'Storm drain transition headwall modification at existing detention pond outfall per RFI 008 response.',
   24000, 'approved', 'Journeyman', '2026-03-19', '2026-03-28', '2026-03-19'),
  (v_project_id, 'Pool exhaust fan addition for chlorine ventilation per RFI 010. Includes housing, controls, and ducting.',
   12500, 'approved', 'Journeyman', '2026-03-12', '2026-03-22', '2026-03-12'),
  (v_project_id, 'Lobby curtain wall upgrade from double to triple glazing for energy code compliance per RFI 017.',
   78000, 'pending_review', 'Journeyman', '2026-04-01', NULL, '2026-04-01'),
  (v_project_id, 'Owner-requested package room electronic access control upgrade — Brivo-compatible Schlage AD-Series.',
   34500, 'pending_review', 'Lakeline Avery Partners, LP', '2026-04-04', NULL, '2026-04-04');

-- =========================================================================
-- 12. MEETINGS (6)
-- =========================================================================
DELETE FROM meeting_action_items WHERE meeting_id IN (mtg_01, mtg_02, mtg_03, mtg_04, mtg_05, mtg_06, mtg_07, mtg_08, mtg_09, mtg_10, mtg_11, mtg_12);
DELETE FROM meeting_attendees WHERE meeting_id IN (mtg_01, mtg_02, mtg_03, mtg_04, mtg_05, mtg_06, mtg_07, mtg_08, mtg_09, mtg_10, mtg_11, mtg_12);
DELETE FROM meetings WHERE id IN (mtg_01, mtg_02, mtg_03, mtg_04, mtg_05, mtg_06, mtg_07, mtg_08, mtg_09, mtg_10, mtg_11, mtg_12);

INSERT INTO meetings (id, project_id, title, type, date, location, duration_minutes, notes, agenda, created_by, created_at) VALUES
  (mtg_01, v_project_id, 'OAC Meeting #18',                    'oac',           '2026-03-26 14:00:00', 'Jobsite Trailer A',           90,
   'Reviewed schedule status, change orders, and submittal log. Owner approved EV charging station change order in concept pending final cost.',
   '1. Safety moment\n2. Schedule update\n3. Budget review\n4. Change order status\n5. RFI log\n6. Submittal log\n7. Owner items',
   u_gregorcyk, '2026-03-19'),
  (mtg_02, v_project_id, 'Weekly Safety Meeting',              'safety',        '2026-03-25 07:00:00', 'Jobsite Trailer A',           30,
   'Reviewed first aid incident from 3/24 (rebar cut). Reinforced glove protocol for rebar work.',
   '1. Incident review\n2. Crane operations safety\n3. Concrete pump exclusion zones\n4. Toolbox talk',
   u_gregorcyk, '2026-03-19'),
  (mtg_03, v_project_id, 'MEP Coordination #11',               'coordination',  '2026-03-24 10:00:00', 'Jobsite Trailer B',           60,
   'Resolved unit C3 plumbing wet stack alignment. Discussed leasing office ceiling height conflict.',
   '1. Wet stack alignment\n2. Leasing office ceiling\n3. Pool equipment room exhaust\n4. Condenser pad anchorage\n5. BIM clash review',
   u_portnoy, '2026-03-19'),
  (mtg_04, v_project_id, 'Subcontractor Progress Meeting #14', 'progress',      '2026-03-28 09:00:00', 'Jobsite Trailer A',           75,
   'All subs present. Reviewed three week look ahead. Roofing mobilization confirmed for building C.',
   '1. Three week look ahead\n2. Manpower projections\n3. Material deliveries\n4. Coordination items\n5. Quality observations',
   u_gregorcyk, '2026-03-19'),
  (mtg_05, v_project_id, 'OAC Meeting #17',                    'oac',           '2026-03-12 14:00:00', 'Jobsite Trailer A',           90,
   'Reviewed building B podium pour preparation. Owner asked for elevator delivery update.',
   '1. Safety moment\n2. Schedule update\n3. Budget review\n4. Submittals\n5. RFIs\n6. Owner questions',
   u_gregorcyk, '2026-03-05'),
  (mtg_06, v_project_id, 'Civil Coordination',                 'coordination',  '2026-03-22 13:00:00', 'Jobsite Trailer B',           45,
   'Discussed storm drain tie-in to existing detention pond. Reviewed pool excavation start.',
   '1. Storm drain outfall\n2. Pool excavation safety\n3. Site lighting placement\n4. Asphalt paving sequence',
   u_rodgers, '2026-03-15'),
  (mtg_07, v_project_id, 'OAC Meeting #19',                    'oac',           '2026-04-09 14:00:00', 'Jobsite Trailer A',           90,
   'Reviewed status post-rain. Owner approved EV charging change order. Lobby curtain wall upgrade in pending review.',
   '1. Safety moment\n2. Schedule update\n3. Budget review\n4. Submittals\n5. RFIs\n6. Owner items',
   u_gregorcyk, '2026-04-02'),
  (mtg_08, v_project_id, 'Weekly Safety Meeting',              'safety',        '2026-04-08 07:00:00', 'Jobsite Trailer A',           30,
   'Reviewed second-quarter incident summary. Discussed wet-weather protocols and slip prevention.',
   '1. Q1 incident review\n2. Wet-weather protocol\n3. Drywall site housekeeping\n4. Toolbox talk',
   u_gregorcyk, '2026-04-02'),
  (mtg_09, v_project_id, 'Pre-Construction Pool Coordination', 'coordination',  '2026-03-30 10:00:00', 'Jobsite Trailer A',           60,
   'Walk-through of pool area with pool sub. Reviewed plaster timing, equipment room exhaust addition, deck finish resubmittal.',
   '1. Excavation completion\n2. Shotcrete sequence\n3. Equipment room ventilation\n4. Deck finish resubmission',
   u_gregorcyk, '2026-03-25'),
  (mtg_10, v_project_id, 'Subcontractor Progress Meeting #15', 'progress',      '2026-04-04 09:00:00', 'Jobsite Trailer A',           75,
   'Three-week look ahead through April 25. Confirmed condenser logistics. Scheduled mailroom 4C inspection.',
   '1. Three week look ahead\n2. Manpower projections\n3. Condenser logistics\n4. Mailroom and amenity prep',
   u_gregorcyk, '2026-03-28'),
  (mtg_11, v_project_id, 'Owner Walk and Mockup Review',       'oac',           '2026-04-05 13:30:00', 'Building A Floor 1',          120,
   'Owner walk through model unit. Reviewed cabinet, quartz, plank flooring mockups. Approved kitchen finish package.',
   '1. Model unit tour\n2. Cabinet, countertop, flooring review\n3. Punch list discussion\n4. Open questions',
   u_kumar, '2026-03-28'),
  (mtg_12, v_project_id, 'Schedule Recovery Workshop',         'coordination',  '2026-04-10 14:00:00', 'Jobsite Trailer A',           90,
   'Reviewed building A wood framing pace concerns. Identified Saturday shift opportunities and additional labor source.',
   '1. Framing rate analysis\n2. Recovery options\n3. Owner cost implications\n4. Decision and action items',
   u_gregorcyk, '2026-04-04');

INSERT INTO meeting_attendees (meeting_id, user_id, attended) VALUES
  (mtg_01, u_kumar, true), (mtg_01, u_goll, true), (mtg_01, u_gregorcyk, true), (mtg_01, u_leon, true), (mtg_01, u_portnoy, true), (mtg_01, walker_id, true),
  (mtg_02, u_gregorcyk, true), (mtg_02, u_portnoy, true), (mtg_02, walker_id, true),
  (mtg_03, u_portnoy, true), (mtg_03, u_leon, true), (mtg_03, u_gregorcyk, true),
  (mtg_04, u_gregorcyk, true), (mtg_04, u_kumar, true), (mtg_04, u_portnoy, true), (mtg_04, walker_id, true),
  (mtg_05, u_kumar, true), (mtg_05, u_goll, true), (mtg_05, u_gregorcyk, true), (mtg_05, u_leon, true),
  (mtg_06, u_rodgers, true), (mtg_06, u_gregorcyk, true), (mtg_06, u_fishbaugh, false),
  (mtg_07, u_kumar, true), (mtg_07, u_goll, true), (mtg_07, u_gregorcyk, true), (mtg_07, u_leon, true), (mtg_07, u_portnoy, true), (mtg_07, walker_id, true),
  (mtg_08, u_gregorcyk, true), (mtg_08, u_portnoy, true), (mtg_08, walker_id, true),
  (mtg_09, u_gregorcyk, true), (mtg_09, u_leon, true), (mtg_09, u_kumar, true),
  (mtg_10, u_gregorcyk, true), (mtg_10, u_kumar, true), (mtg_10, u_portnoy, true), (mtg_10, walker_id, true),
  (mtg_11, u_kumar, true), (mtg_11, u_goll, true), (mtg_11, u_gregorcyk, true), (mtg_11, u_leon, true), (mtg_11, walker_id, true),
  (mtg_12, u_gregorcyk, true), (mtg_12, u_kumar, true), (mtg_12, u_portnoy, false), (mtg_12, walker_id, true);

INSERT INTO meeting_action_items (meeting_id, description, assigned_to, due_date, status, completed_at) VALUES
  (mtg_01, 'Submit final EV charging station change order pricing',                     u_gregorcyk, '2026-04-05', 'open',      NULL),
  (mtg_01, 'Provide updated elevator delivery schedule from Schindler',                  u_gregorcyk, '2026-04-02', 'open',      NULL),
  (mtg_01, 'Respond to RFI 005 regarding stair tower 3 holdowns',                        u_perkins,   '2026-04-03', 'open',      NULL),
  (mtg_02, 'Distribute updated rebar handling glove protocol to all framers',           u_gregorcyk, '2026-03-27', 'completed', '2026-03-26 16:00:00'),
  (mtg_03, 'Issue revised MEP coordination drawing for leasing office ceiling',         u_portnoy,   '2026-03-31', 'open',      NULL),
  (mtg_04, 'Confirm building C truss delivery dates with Texas Truss Manufacturing',    u_gregorcyk, '2026-03-30', 'completed', '2026-03-29 10:00:00'),
  (mtg_05, 'Schedule cabinet finish mockup review with the owner',                       u_gregorcyk, '2026-03-20', 'completed', '2026-03-19 14:00:00'),
  (mtg_06, 'Provide pool excavation safety plan to all civil crews',                    u_rodgers,   '2026-03-25', 'completed', '2026-03-24 09:00:00'),
  (mtg_07, 'Submit final EV charging cost breakdown',                                   u_gregorcyk, '2026-04-15', 'open',      NULL),
  (mtg_07, 'Distribute lobby curtain wall upgrade cost analysis',                       u_gregorcyk, '2026-04-12', 'open',      NULL),
  (mtg_07, 'Confirm 24 condenser placement on building A roof',                         u_portnoy,   '2026-04-12', 'completed', '2026-04-10 16:00:00'),
  (mtg_08, 'Implement post-rain housekeeping checklist for all crews',                  u_gregorcyk, '2026-04-15', 'open',      NULL),
  (mtg_09, 'Issue updated pool plaster schedule',                                        u_gregorcyk, '2026-04-08', 'completed', '2026-04-07 10:00:00'),
  (mtg_10, 'Confirm 4C mailbox delivery date with Salsbury',                             u_gregorcyk, '2026-04-12', 'open',      NULL),
  (mtg_11, 'Schedule second model unit walk for owner finishes',                         u_kumar,     '2026-04-25', 'open',      NULL),
  (mtg_12, 'Approve Saturday shift labor for building A floor 5 framing',               u_gregorcyk, '2026-04-15', 'open',      NULL);

-- =========================================================================
-- 13. DIRECTORY CONTACTS (replaces simple cover-sheet seed with realistic full directory)
-- =========================================================================
DELETE FROM directory_contacts WHERE project_id = v_project_id;
INSERT INTO directory_contacts (project_id, name, company, role, trade, email, phone, address, avg_rfi_response_days) VALUES
  (v_project_id, 'Sam Kumar',         'JCI Residential',                  'Developer Contact',     'Developer',             'skumar@jci-residential.com',     '(512) 247-7000', '1000 N. Lamar, Suite 400, Austin, TX 78703', NULL),
  (v_project_id, 'Kurt Goll',         'Lakeline Avery Partners, LP',      'Owner Contact',         'Owner',                 'kgoll@lakelineavery.com',         '(512) 247-7000', '1000 N. Lamar, Suite 400, Austin, TX 78704', NULL),
  (v_project_id, 'David Gregorcyk',   'Journeyman',                        'General Contractor',    'General Contractor',    'dgregorcyk@journeyman.com',      '(512) 247-7000', '1000 N. Lamar Suite 400, Austin, TX 78703', NULL),
  (v_project_id, 'Jason Rodgers',     'Bleyl Engineering',                 'Civil Engineer',        'Civil Engineering',     'jrodgers@bleyl.com',              '(512) 454-2400', '12007 Technology Blvd., Suite 150, Austin, TX 78727', 3.0),
  (v_project_id, 'Mark Leon',         'Cross Architects, PLLC',            'Architect',             'Architecture',          'mleon@crossarchitects.com',      '(972) 398-6644', '879 Junction Drive, Allen, TX 75013', 3.5),
  (v_project_id, 'Mike Fishbaugh',    'Blu Fish Collaborative, Inc.',      'Landscape Architect',   'Landscape Architecture','mfishbaugh@blufishcollab.com',   '(512) 388-4115', 'P.O. Box 40792, Austin, TX 78704', 4.0),
  (v_project_id, 'Trent Perkins',     'RTP Structural, PLLC',              'Structural Engineer',   'Structural Engineering','tperkins@rtpstructural.com',     '(214) 293-2503', '104 N. Goliad Street, Suite 204, Rockwall, TX 75087', 3.2),
  (v_project_id, 'Mark Portnoy',      'MEP Systems Design & Engineering',  'MEP Engineer',          'MEP Engineering',       'mportnoy@mepsd.com',              '(972) 567-0463', '918 Dragon Street, Dallas, TX 75207', 3.8),
  -- Subcontractors and key vendors
  (v_project_id, 'Carlos Ramirez',    'Lone Star Framers',                'Field Superintendent',  'Wood Framing',          'cramirez@lonestarframers.com',    '(512) 555-2010', '4220 Industrial Loop, Austin, TX 78744', NULL),
  (v_project_id, 'Brad Whitfield',    'Capital Concrete Texas',            'Project Manager',       'Concrete',              'bwhitfield@capitalconcretetx.com', '(512) 555-2018', '8801 Tradesman Way, Pflugerville, TX 78660', NULL),
  (v_project_id, 'Maria Delgado',     'Lone Star MEP Services',            'MEP Project Manager',   'MEP',                   'mdelgado@lonestarmep.com',        '(512) 555-2030', '5612 South Lamar, Austin, TX 78745', NULL),
  (v_project_id, 'Tom Reilly',        'Capital Plumbing Co.',              'Plumbing Foreman',      'Plumbing',              'treilly@capitalplumbing.com',     '(512) 555-2042', '7400 N. Mopac, Austin, TX 78731', NULL),
  (v_project_id, 'Greg Anderson',     'Capital Electrical Team',           'Electrical Foreman',    'Electrical',            'ganderson@capitalelectrical.com', '(512) 555-2056', '7400 N. Mopac, Austin, TX 78731', NULL),
  (v_project_id, 'Linda Park',        'Hill Country Finishers',            'Finish Supervisor',     'Drywall and Finishes',  'lpark@hillcountryfinishers.com',  '(512) 555-2078', '1809 Anderson Mill Rd, Austin, TX 78759', NULL),
  (v_project_id, 'Jorge Mendoza',     'Hardy Siding Contractors',          'Field Foreman',         'Siding',                'jmendoza@hardysiding.com',        '(512) 555-2089', '12701 Burnet Rd, Austin, TX 78727', NULL),
  (v_project_id, 'Steve O''Brien',    'TAMKO Roofing Crew C',              'Lead Roofer',           'Roofing',               'sobrien@tamkocrew.com',           '(512) 555-2102', '4106 N. Lamar Blvd, Austin, TX 78751', NULL),
  (v_project_id, 'Rebecca Zhao',      'Texas Truss Manufacturing',         'Account Manager',       'Trusses',               'rzhao@texastruss.com',            '(972) 555-2115', '500 Trade Plaza, Lewisville, TX 75067', NULL),
  (v_project_id, 'Marcus Patel',      'Schindler Elevator',                 'Project Engineer',      'Elevators',             'mpatel@schindler.com',            '(972) 555-2128', '2200 Diplomat Drive, Farmers Branch, TX 75234', NULL),
  (v_project_id, 'Holly Krenek',      'AquaTech Pool Systems',              'Pool Project Manager',  'Pool',                  'hkrenek@aquatechpools.com',       '(512) 555-2143', '11900 Manchaca Rd, Austin, TX 78748', NULL),
  (v_project_id, 'Wesley Moore',      'Statewide Fire Protection',          'Fire Protection Engineer', 'Fire Protection',    'wmoore@statewidefp.com',          '(512) 555-2156', '8810 N IH-35, Austin, TX 78753', NULL),
  (v_project_id, 'Jenna Atwood',      'Hill Country Cabinets',              'Cabinet Account Lead',  'Cabinets',              'jatwood@hillcountrycabinets.com', '(512) 555-2168', '6306 South Industrial Pkwy, Austin, TX 78745', NULL),
  (v_project_id, 'Diego Hernandez',   'Stone Solutions Texas',              'Fabrication Manager',   'Countertops',           'dhernandez@stonesolutionstx.com', '(512) 555-2180', '11315 Manchaca Road, Austin, TX 78748', NULL),
  (v_project_id, 'Patricia Vasquez',  'Hill Country Landscape Co.',         'Project Manager',       'Landscape',             'pvasquez@hclandscape.com',        '(512) 555-2192', 'PO Box 8814, Cedar Park, TX 78630', NULL);

-- =========================================================================
-- 14. SCHEDULE PHASES (12)
-- =========================================================================
-- Break the self-referencing depends_on chain before deletion
UPDATE schedule_phases SET depends_on = NULL WHERE id IN (sp_01, sp_02, sp_03, sp_04, sp_05, sp_06, sp_07, sp_08, sp_09, sp_10, sp_11, sp_12) OR project_id = v_project_id;
DELETE FROM schedule_phases WHERE id IN (sp_01, sp_02, sp_03, sp_04, sp_05, sp_06, sp_07, sp_08, sp_09, sp_10, sp_11, sp_12) OR project_id = v_project_id;
INSERT INTO schedule_phases (id, project_id, name, start_date, end_date, percent_complete, status, depends_on, is_critical_path, assigned_crew_id, created_at) VALUES
  (sp_01, v_project_id, 'Mobilization and Site Preparation',          '2020-09-15', '2020-12-15', 100, 'completed', NULL,  true,  NULL,            '2020-09-15'),
  (sp_02, v_project_id, 'Site Civil and Underground Utilities',       '2020-11-01', '2021-06-30', 100, 'completed', sp_01, true,  NULL,            '2020-09-15'),
  (sp_03, v_project_id, 'Podium Concrete Building A',                  '2021-04-01', '2022-02-28', 100, 'completed', sp_02, true,  NULL,            '2020-09-15'),
  (sp_04, v_project_id, 'Podium Concrete Building B',                  '2021-09-01', '2022-08-31', 100, 'completed', sp_02, true,  NULL,            '2020-09-15'),
  (sp_05, v_project_id, 'Podium Concrete Building C',                  '2022-02-01', '2023-01-31', 100, 'completed', sp_02, true,  NULL,            '2020-09-15'),
  (sp_06, v_project_id, 'Wood Framing All Buildings',                  '2022-05-01', '2026-06-30',  85, 'active',    sp_03, true,  crew_frame,      '2020-09-15'),
  (sp_07, v_project_id, 'MEP Rough-In',                                '2023-01-01', '2026-09-30',  72, 'active',    sp_06, true,  crew_mep,        '2020-09-15'),
  (sp_08, v_project_id, 'Roofing All Buildings',                       '2024-06-01', '2026-08-31',  65, 'active',    sp_06, true,  NULL,            '2020-09-15'),
  (sp_09, v_project_id, 'Drywall and Interior Finishes',                '2024-09-01', '2026-12-15',  45, 'active',    sp_07, false, crew_finish,    '2020-09-15'),
  (sp_10, v_project_id, 'Site Hardscape, Landscape, Paving',            '2026-03-01', '2026-09-30',  20, 'active',    sp_02, false, NULL,            '2020-09-15'),
  (sp_11, v_project_id, 'Pool and Amenity Build-Out',                   '2026-03-01', '2026-08-31',  15, 'active',    sp_05, false, NULL,            '2020-09-15'),
  (sp_12, v_project_id, 'Final Inspections and TCO',                    '2026-12-01', '2027-04-30',   0, 'upcoming',  sp_09, true,  NULL,            '2020-09-15');

-- =========================================================================
-- 15. ACTIVITY FEED (30)
-- =========================================================================
DELETE FROM activity_feed WHERE project_id = v_project_id;
INSERT INTO activity_feed (project_id, user_id, type, title, body, metadata, created_at) VALUES
  (v_project_id, u_gregorcyk, 'rfi_created',           'RFI 005 created',                      'Stair tower 3 wood framing connection to concrete podium',                  '{"rfi_number":5}',  '2026-03-27 08:30:00'),
  (v_project_id, u_gregorcyk, 'daily_log_approved',    'Daily log approved',                   'March 26 daily log approved by Sam Kumar',                                 '{"log_date":"2026-03-26"}', '2026-03-27 07:10:00'),
  (v_project_id, u_leon,      'comment_added',         'RFI response posted',                  'Architect responded to RFI 002 (corridor wall fire rating)',                '{"rfi_number":2}', '2026-03-26 11:30:00'),
  (v_project_id, u_gregorcyk, 'rfi_created',           'RFI 004 created',                      'Balcony deck waterproofing termination at metal railing posts',             '{"rfi_number":4}', '2026-03-26 11:00:00'),
  (v_project_id, u_leon,      'submittal_updated',     'Submittal rejected',                   'Pool deck stamped concrete submittal rejected — wrong pattern',             '{"submittal_number":14}', '2026-03-26 10:00:00'),
  (v_project_id, u_portnoy,   'rfi_created',           'RFI 007 created',                      'HVAC condenser pad spacing, north building rooftop',                        '{"rfi_number":7}', '2026-03-28 13:30:00'),
  (v_project_id, u_gregorcyk, 'task_moved',            'Task in progress',                      'Pour podium deck topping building B moved to In Progress',                  '{"task":"podium_b"}', '2026-03-23 06:00:00'),
  (v_project_id, u_gregorcyk, 'daily_log_approved',    'Daily log approved',                   'March 24 daily log approved (pour day)',                                    '{"log_date":"2026-03-24"}', '2026-03-25 07:10:00'),
  (v_project_id, u_leon,      'comment_added',         'RFI response posted',                  'Architect responded to RFI 010 (pool exhaust)',                              '{"rfi_number":10}', '2026-03-10 14:00:00'),
  (v_project_id, u_kumar,     'comment_added',         'Owner approved change order in concept','EV charging station upgrade concept approved pending pricing',              '{}',               '2026-03-26 14:30:00'),
  (v_project_id, u_gregorcyk, 'change_order_submitted','Change order submitted',                'Pool excavation rock removal $62,000',                                       '{"co_amount":62000}', '2026-03-20 11:00:00'),
  (v_project_id, u_leon,      'submittal_updated',     'Submittal under review',                'In-unit VRF air handler submittal moved to Under Review',                    '{"submittal_number":5}', '2026-03-01 09:00:00'),
  (v_project_id, u_gregorcyk, 'rfi_created',           'RFI 001 created',                      'Type V wood framing transition at podium deck Building B',                  '{"rfi_number":1}', '2026-03-25 09:30:00'),
  (v_project_id, u_gregorcyk, 'file_uploaded',         'Document uploaded',                    'Three week look ahead schedule uploaded',                                   '{"file":"3wk_lookahead_0327.pdf"}', '2026-03-27 09:00:00'),
  (v_project_id, u_gregorcyk, 'task_moved',            'Task completed',                        'Pre-pour inspection building B passed',                                      '{"task":"prepour_b"}', '2026-03-23 08:30:00'),
  (v_project_id, u_portnoy,   'rfi_created',           'RFI 009 created',                      'Leasing office finished ceiling height vs MEP routing',                     '{"rfi_number":9}', '2026-03-26 10:00:00'),
  (v_project_id, u_gregorcyk, 'punch_resolved',        'Punch item resolved',                  'Mailroom 4C door binding adjusted',                                          '{}',               '2026-03-14 14:00:00'),
  (v_project_id, u_kumar,     'meeting_scheduled',     'Meeting scheduled',                    'OAC #18 scheduled for March 26',                                            '{"meeting_type":"oac"}', '2026-03-19 16:00:00'),
  (v_project_id, u_leon,      'submittal_updated',     'Submittal rejected',                   'Cabinet submittal rejected — wrong shaker profile',                          '{"submittal_number":7}', '2026-02-15 13:00:00'),
  (v_project_id, u_rodgers,   'rfi_created',           'RFI 008 created',                      'Site drainage tie-in to existing detention pond',                            '{"rfi_number":8}', '2026-03-12 11:15:00'),
  (v_project_id, u_gregorcyk, 'punch_resolved',        'Punch item verified',                  'Pool gate self-closing verified',                                            '{}',               '2026-03-19 11:00:00'),
  (v_project_id, u_gregorcyk, 'daily_log_approved',    'Daily log approved',                   'March 21 daily log approved',                                                '{"log_date":"2026-03-21"}', '2026-03-22 07:00:00'),
  (v_project_id, u_fishbaugh, 'rfi_created',           'RFI 011 created',                      'Landscape irrigation tap location',                                          '{"rfi_number":11}', '2026-03-28 09:45:00'),
  (v_project_id, u_gregorcyk, 'task_moved',            'Task in progress',                      'Building C truss installation begun',                                        '{"task":"truss_c"}', '2026-03-27 07:30:00'),
  (v_project_id, u_gregorcyk, 'comment_added',         'Note added',                            'Pool excavation 50% complete; rock removal change order submitted',          '{}',               '2026-03-30 17:30:00'),
  (v_project_id, u_gregorcyk, 'change_order_submitted','Change order submitted',                'EV charging stations $175,000 (per Austin parking update)',                  '{"co_amount":175000}', '2026-03-25 15:00:00'),
  (v_project_id, u_leon,      'submittal_updated',     'Submittal approved',                   'Wood truss submittal approved (rev 2)',                                       '{"submittal_number":1}', '2025-10-12 09:30:00'),
  (v_project_id, u_gregorcyk, 'task_moved',            'Task completed',                        'Building B podium pour completed (165 CY)',                                   '{"task":"pour_b"}', '2026-03-24 11:00:00'),
  (v_project_id, u_portnoy,   'submittal_updated',     'Submittal submitted',                   'Rooftop HVAC condenser submittal submitted for review',                      '{"submittal_number":4}', '2026-02-15 09:00:00'),
  (v_project_id, u_gregorcyk, 'file_uploaded',         'Document uploaded',                    'Daily safety inspection report 03.28',                                       '{"file":"safety_0328.pdf"}', '2026-03-28 16:30:00'),
  (v_project_id, u_gregorcyk, 'punch_resolved',        'Punch item resolved',                  'Light fixture missing shade unit 521 fixed',                                  '{}',               '2026-03-18 14:30:00'),
  (v_project_id, u_portnoy,   'rfi_created',           'RFI 016 created',                      'Domestic water riser sizing for booster pump configuration',                  '{"rfi_number":16}', '2026-04-01 11:30:00'),
  (v_project_id, u_gregorcyk, 'rfi_created',           'RFI 017 created',                      'Storefront glazing thermal performance — lobby curtain wall',                 '{"rfi_number":17}', '2026-03-30 13:15:00'),
  (v_project_id, u_portnoy,   'rfi_created',           'RFI 020 created',                      'Roof curb height for HVAC condensers — wind uplift',                          '{"rfi_number":20}', '2026-04-01 09:45:00'),
  (v_project_id, u_portnoy,   'rfi_created',           'RFI 024 created',                      'Garage ventilation CFM verification (critical)',                              '{"rfi_number":24}', '2026-03-29 08:30:00'),
  (v_project_id, u_kumar,     'rfi_created',           'RFI 025 created',                      'Unit closet wire shelving load capacity for stacked storage',                 '{"rfi_number":25}', '2026-04-05 10:00:00'),
  (v_project_id, u_gregorcyk, 'change_order_submitted','Change order submitted',                'Lobby curtain wall triple-glazing upgrade $78,000',                            '{"co_amount":78000}', '2026-04-01 11:00:00'),
  (v_project_id, u_kumar,     'change_order_submitted','Change order submitted',                'Package room electronic access upgrade $34,500 (owner-requested)',             '{"co_amount":34500}', '2026-04-04 11:00:00'),
  (v_project_id, u_gregorcyk, 'task_moved',            'Task in progress',                      'Building C truss installation 100% complete',                                  '{"task":"truss_c"}', '2026-04-03 15:30:00'),
  (v_project_id, u_gregorcyk, 'task_moved',            'Task in progress',                      'Building A floor 5 framing 100% complete',                                     '{"task":"frame_a5"}', '2026-04-01 15:00:00'),
  (v_project_id, u_gregorcyk, 'daily_log_approved',    'Daily log approved',                   'April 1 daily log approved (framing milestone)',                              '{"log_date":"2026-04-01"}', '2026-04-02 07:00:00'),
  (v_project_id, u_gregorcyk, 'daily_log_approved',    'Daily log approved',                   'April 6 daily log approved (pool shotcrete pour)',                            '{"log_date":"2026-04-06"}', '2026-04-07 07:00:00'),
  (v_project_id, u_leon,      'submittal_updated',     'Submittal approved',                   'Quartz countertops submittal approved (rev 2)',                                '{"submittal_number":17}', '2026-02-10 14:30:00'),
  (v_project_id, u_leon,      'submittal_updated',     'Submittal under review',                'In-unit tankless water heater submittal moved to Under Review',                '{"submittal_number":23}', '2026-03-15 10:00:00'),
  (v_project_id, u_gregorcyk, 'task_moved',            'Task in progress',                      'HVAC condensers building A 24 of 24 set',                                      '{"task":"condensers_a"}', '2026-04-10 16:00:00'),
  (v_project_id, u_gregorcyk, 'punch_resolved',        'Punch item verified',                  'Building B exterior light timer adjusted and verified',                       '{}',               '2026-03-21 11:00:00'),
  (v_project_id, u_gregorcyk, 'file_uploaded',         'Document uploaded',                    'Pool shotcrete delivery tickets uploaded',                                     '{"file":"pool_shotcrete_tickets.pdf"}', '2026-04-06 16:00:00'),
  (v_project_id, u_gregorcyk, 'meeting_scheduled',     'Meeting scheduled',                    'Schedule recovery workshop scheduled for April 10',                           '{"meeting_type":"planning"}', '2026-04-04 16:00:00'),
  (v_project_id, u_kumar,     'meeting_scheduled',     'Meeting scheduled',                    'Owner walk and mockup review scheduled for April 5',                          '{"meeting_type":"owner_walk"}', '2026-03-28 17:00:00'),
  (v_project_id, u_gregorcyk, 'file_uploaded',         'Document uploaded',                    'April 2026 cost report draft uploaded',                                       '{"file":"cost_report_apr2026.xlsx"}', '2026-04-08 10:00:00');

-- =========================================================================
-- 16. FILES (12)
-- =========================================================================
DELETE FROM files WHERE project_id = v_project_id;
INSERT INTO files (project_id, name, folder, file_url, file_size, content_type, uploaded_by, version, created_at) VALUES
  (v_project_id, 'Three Week Look Ahead 03.27.pdf',          'Schedule',     '/files/schedule/3wk_lookahead_0327.pdf',     820000,   'application/pdf', u_gregorcyk, 1, '2026-03-27'),
  (v_project_id, 'Building B Podium Pour Tickets.pdf',        'Concrete',     '/files/concrete/B_podium_tickets.pdf',       1100000,  'application/pdf', u_gregorcyk, 1, '2026-03-24'),
  (v_project_id, 'MEP Coordination Drawing Building A Rev 3.pdf','MEP',     '/files/mep/coord_A_rev3.pdf',                4800000,  'application/pdf', u_portnoy,   3, '2026-03-24'),
  (v_project_id, 'Truss Shop Drawings Building C.pdf',        'Structural',   '/files/structural/truss_C_shop.pdf',         8500000,  'application/pdf', u_perkins,   2, '2025-10-10'),
  (v_project_id, 'Site Specific Safety Plan Rev 3.pdf',       'Safety',       '/files/safety/SSSP_rev3.pdf',                4200000,  'application/pdf', u_gregorcyk, 3, '2025-08-01'),
  (v_project_id, 'Daily Safety Inspection 03.28.pdf',         'Safety',       '/files/safety/safety_0328.pdf',              780000,   'application/pdf', u_gregorcyk, 1, '2026-03-28'),
  (v_project_id, 'Monthly Cost Report March 2026.xlsx',       'Budget',       '/files/budget/monthly_mar2026.xlsx',         1300000,  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', u_gregorcyk, 1, '2026-03-28'),
  (v_project_id, 'Specification Section 06 17 33 Wood Trusses.pdf','Specs',  '/files/specs/spec_06_17_33.pdf',              1900000,  'application/pdf', u_leon,      1, '2020-08-15'),
  (v_project_id, 'Specification Section 23 81 19 HVAC Condensers.pdf','Specs','/files/specs/spec_23_81_19.pdf',             1700000,  'application/pdf', u_leon,      1, '2020-08-15'),
  (v_project_id, 'Project Insurance Certificate 2026.pdf',    'Safety',       '/files/safety/insurance_cert_2026.pdf',      640000,   'application/pdf', u_gregorcyk, 1, '2026-01-15'),
  (v_project_id, 'Civil Storm Drain Outfall Detail SK.pdf',   'Civil',        '/files/civil/SK_C3_02_1.pdf',                380000,   'application/pdf', u_rodgers,   1, '2026-03-18'),
  (v_project_id, 'Pool Submittal Pattern Reference.pdf',       'Submittals',   '/files/submittals/pool_pattern_ref.pdf',     420000,   'application/pdf', u_leon,      1, '2026-03-12'),
  (v_project_id, 'Architectural Drawings Set Rev 5.pdf',        'Drawings',     '/files/drawings/A_set_rev5.pdf',             52000000, 'application/pdf', u_leon,      5, '2026-02-15'),
  (v_project_id, 'Structural Drawings Set Rev 4.pdf',           'Drawings',     '/files/drawings/S_set_rev4.pdf',             38000000, 'application/pdf', u_perkins,   4, '2026-02-15'),
  (v_project_id, 'MEP Drawings Set Rev 3.pdf',                  'Drawings',     '/files/drawings/MEP_set_rev3.pdf',           42000000, 'application/pdf', u_portnoy,   3, '2026-02-15'),
  (v_project_id, 'Civil Drawings Set Rev 2.pdf',                'Drawings',     '/files/drawings/C_set_rev2.pdf',             18000000, 'application/pdf', u_rodgers,   2, '2026-01-30'),
  (v_project_id, 'Project Specifications Manual.pdf',           'Specs',        '/files/specs/specs_full_manual.pdf',         28000000, 'application/pdf', u_leon,      2, '2025-12-15'),
  (v_project_id, 'Master Schedule April 2026.mpp',              'Schedule',     '/files/schedule/master_schedule_apr2026.mpp', 2400000, 'application/vnd.ms-project', u_gregorcyk, 1, '2026-04-01'),
  (v_project_id, 'Cost Report April 2026 Draft.xlsx',           'Budget',       '/files/budget/cost_report_apr2026.xlsx',     1500000,  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', u_gregorcyk, 1, '2026-04-08'),
  (v_project_id, 'Pool Shotcrete Delivery Tickets.pdf',         'Concrete',     '/files/concrete/pool_shotcrete_tickets.pdf', 980000,   'application/pdf', u_gregorcyk, 1, '2026-04-06'),
  (v_project_id, 'Crane Operations Lift Plan Rev 2.pdf',        'Safety',       '/files/safety/lift_plan_rev2.pdf',           2200000,  'application/pdf', u_gregorcyk, 2, '2026-04-08'),
  (v_project_id, 'Building A As-Built Trace 2026 Q1.pdf',        'Closeout',     '/files/closeout/asbuilt_A_q1.pdf',           14000000, 'application/pdf', u_gregorcyk, 1, '2026-04-01'),
  (v_project_id, 'OAC #18 Meeting Minutes.pdf',                  'Meetings',     '/files/meetings/oac_18_minutes.pdf',         420000,   'application/pdf', u_gregorcyk, 1, '2026-03-26'),
  (v_project_id, 'OAC #19 Meeting Minutes.pdf',                  'Meetings',     '/files/meetings/oac_19_minutes.pdf',         440000,   'application/pdf', u_gregorcyk, 1, '2026-04-09'),
  (v_project_id, 'Three Week Look Ahead 04.10.pdf',              'Schedule',     '/files/schedule/3wk_lookahead_0410.pdf',     840000,   'application/pdf', u_gregorcyk, 1, '2026-04-10'),
  (v_project_id, 'Sample Unit 201 Photo Set.pdf',                'Photos',       '/files/photos/unit_201_photos.pdf',          6800000,  'application/pdf', u_gregorcyk, 1, '2026-04-05');

-- =========================================================================
-- 17. NOTIFICATIONS (12)
-- =========================================================================
DELETE FROM notifications WHERE project_id = v_project_id;
INSERT INTO notifications (user_id, project_id, type, title, body, link, read, created_at) VALUES
  (u_leon,      v_project_id, 'rfi_assigned',       'New RFI assigned to you',         'RFI 002: Unit demising wall fire rating at corridor intersection',                  '/rfis/2',         false, '2026-03-22 14:00:00'),
  (u_leon,      v_project_id, 'rfi_assigned',       'New RFI assigned to you',         'RFI 009: Leasing office finished ceiling height vs MEP routing',                    '/rfis/9',         false, '2026-03-26 10:00:00'),
  (u_perkins,   v_project_id, 'rfi_assigned',       'New RFI assigned to you',         'RFI 001: Type V wood framing transition at podium deck building B (critical)',     '/rfis/1',         false, '2026-03-25 09:30:00'),
  (u_portnoy,   v_project_id, 'rfi_assigned',       'New RFI assigned to you',         'RFI 003: Plumbing wet stack alignment, units 215/315/415',                          '/rfis/3',         true,  '2026-03-15 10:15:00'),
  (u_leon,      v_project_id, 'submittal_review',   'Submittal ready for review',       'In-unit VRF air handler submittal pending review',                                 '/submittals/5',  false, '2026-03-01 09:00:00'),
  (u_gregorcyk, v_project_id, 'punch_item',         'New critical punch item',          'Trash chute door latch failure building C floor 3',                                '/punchlist',      false, '2026-03-26 10:00:00'),
  (u_gregorcyk, v_project_id, 'task_update',        'Task nearing due date',            'Pour podium deck topping building B due April 5',                                  '/tasks',          false, '2026-04-03 08:00:00'),
  (u_kumar,     v_project_id, 'daily_log_approval', 'Daily log pending approval',       'March 30 daily log submitted by David Gregorcyk',                                  '/dailylog',       false, '2026-03-30 17:00:00'),
  (u_kumar,     v_project_id, 'ai_alert',           'Schedule risk detected',           'Wood framing pace on building A may slip by 4 days at current rate',               '/schedule',       false, '2026-03-28 19:00:00'),
  (u_leon,      v_project_id, 'submittal_review',   'Submittal resubmission required',  'Cabinets submittal rejected — please review and resubmit',                          '/submittals/7',  true,  '2026-02-15 13:00:00'),
  (walker_id,   v_project_id, 'meeting_reminder',   'Meeting tomorrow',                 'OAC Meeting #18 scheduled for March 26 at 2:00 PM',                                 '/meetings',       true,  '2026-03-25 18:00:00'),
  (u_kumar,     v_project_id, 'ai_alert',           'Budget variance alert',            'Wood framing division trending $200K over original budget',                          '/budget',         false, '2026-03-25 12:00:00'),
  (u_leon,      v_project_id, 'rfi_assigned',       'Critical RFI assigned to you',     'RFI 024: Garage ventilation CFM verification (critical)',                            '/rfis/24',        false, '2026-03-29 08:30:00'),
  (u_leon,      v_project_id, 'rfi_assigned',       'New RFI assigned to you',          'RFI 022: Mailroom security door hardware — package room access',                     '/rfis/22',        false, '2026-04-02 14:00:00'),
  (u_perkins,   v_project_id, 'rfi_assigned',       'New RFI assigned to you',          'RFI 020: Roof curb height for HVAC condensers (wind uplift)',                        '/rfis/20',        false, '2026-04-01 09:45:00'),
  (u_rodgers,   v_project_id, 'rfi_assigned',       'New RFI assigned to you',          'RFI 016: Domestic water riser sizing for booster pump',                              '/rfis/16',        false, '2026-04-01 11:30:00'),
  (u_leon,      v_project_id, 'submittal_review',   'Submittal pending review',         'Tankless water heater submittal pending review',                                     '/submittals/23', false, '2026-03-15 10:00:00'),
  (u_kumar,     v_project_id, 'task_update',        'Change order awaiting decision',   'Lobby curtain wall triple-glazing upgrade $78,000 pending review',                  '/change-orders', false, '2026-04-01 11:30:00'),
  (u_kumar,     v_project_id, 'task_update',        'Change order awaiting decision',   'Package room electronic access upgrade $34,500 (owner-requested)',                  '/change-orders', false, '2026-04-04 11:15:00'),
  (u_kumar,     v_project_id, 'daily_log_approval', 'Daily log pending approval',       'April 10 daily log submitted by David Gregorcyk',                                    '/dailylog',       false, '2026-04-10 17:00:00'),
  (u_kumar,     v_project_id, 'ai_alert',           'Schedule recovery available',      'Adding a Saturday shift on building A could recover 4 days. Cost analysis available.', '/schedule',       false, '2026-04-09 18:00:00'),
  (u_gregorcyk, v_project_id, 'punch_item',         'New high-priority punch item',     'Refrigerator water line cap missing unit 105',                                       '/punchlist',      false, '2026-03-29 08:00:00'),
  (u_gregorcyk, v_project_id, 'punch_item',         'New critical punch item',          'Building A floor 2 corridor smoke detector test failure',                            '/punchlist',      false, '2026-03-29 16:00:00'),
  (walker_id,   v_project_id, 'meeting_reminder',   'Meeting tomorrow',                 'OAC Meeting #19 scheduled for April 9 at 2:00 PM',                                  '/meetings',       true,  '2026-04-08 18:00:00'),
  (walker_id,   v_project_id, 'meeting_reminder',   'Meeting tomorrow',                 'Owner walk and mockup review scheduled for April 5',                                '/meetings',       true,  '2026-04-04 18:00:00');

-- =========================================================================
-- 18. AI INSIGHTS (10)
-- =========================================================================
DELETE FROM ai_insights WHERE project_id = v_project_id;
INSERT INTO ai_insights (project_id, page, severity, message, expanded_content, action_label, action_link, dismissed, created_at) VALUES
  (v_project_id, 'dashboard', 'warning',  'Wood framing pace may slip on Building A',
   'Current framing rate on Building A is 8% below planned. If pace continues, the floor 5 completion could slip 4 days. Consider adding a Saturday shift to recover.',
   'View Schedule', '/schedule', false, '2026-03-28 19:00:00'),
  (v_project_id, 'dashboard', 'critical', '3 critical RFIs require immediate attention',
   'RFIs 001 (podium transition), 005 (stair tower holdowns), and 007 (HVAC condenser anchorage) are all critical priority and tied to active work. Delays on responses will block downstream tasks.',
   'View RFIs', '/rfis', false, '2026-03-28 06:00:00'),
  (v_project_id, 'dashboard', 'info',     'Building B podium pour completed on schedule',
   'The 165-cubic-yard pour completed within the planned window. No issues reported. Curing schedule is on track for shoring removal next week.',
   NULL, NULL, false, '2026-03-25 06:00:00'),
  (v_project_id, 'rfis', 'warning', 'RFI 003 response is approaching due date',
   'The plumbing wet stack alignment RFI was due March 28. Response received from architect on March 20. Validate the resolution with the field crew before continuing rough-in.',
   'Open RFI', '/rfis/3', false, '2026-03-25 06:00:00'),
  (v_project_id, 'rfis', 'info', 'Average RFI response time is 4.8 days',
   'Response time has been steady at under 5 days. Architect (Cross Architects) responses average 3.5 days; structural (RTP) at 3.2 days. MEP (MEP Systems) responses at 3.8 days.',
   NULL, NULL, false, '2026-03-27 06:00:00'),
  (v_project_id, 'submittals', 'warning', 'VRF air handler submittal review approaching deadline',
   'Submittal 005 has been under review for 27 days. Lead time is 6 weeks. Late approval risks delaying installation in the upper floors.',
   'Review Submittal', '/submittals/5', false, '2026-03-26 06:00:00'),
  (v_project_id, 'budget', 'warning', 'Wood framing division trending over budget',
   'Division 06 00 00 (Wood Framing and Trusses) has committed costs of $7.95M against original $7.80M. Truss escalation is the primary driver. Forecast at completion is $8.0M.',
   'View Budget', '/budget', false, '2026-03-27 06:00:00'),
  (v_project_id, 'punchlist', 'critical', '2 critical punch items need immediate attention',
   'Trash chute door latch failure (building C, floor 3) and shower drain leak (unit 208) are critical-priority items. The chute issue is a fire safety concern that must be corrected before TCO inspections.',
   'View Punch List', '/punchlist', false, '2026-03-27 06:00:00'),
  (v_project_id, 'schedule', 'info', 'Pool excavation ahead of schedule',
   'Pool excavation reached 50% complete by March 30, three days ahead of plan. Rock removal change order reduced risk; remaining excavation should complete on schedule.',
   NULL, NULL, false, '2026-03-30 18:00:00'),
  (v_project_id, 'crews', 'warning', 'Hill Country Finishers may need more bodies',
   'Drywall finishing crew is at productivity score 84 (lowest active crew). With buildings B and C drywall coming online, the 14-person crew may be undersized. Consider adding 4 finishers.',
   'View Crew', '/crews', false, '2026-03-27 06:00:00'),

  (v_project_id, 'rfis', 'critical', 'RFI 024 critical — garage ventilation may be undersized',
   'The MEP fan schedule on M3.10 shows 8,000 CFM total but IBC requires 13,800 CFM for 18,400 sf garage at 0.75 CFM/sf. If confirmed, the change adds equipment and electrical capacity. Critical-path impact possible.',
   'Open RFI', '/rfis/24', false, '2026-03-29 09:00:00'),

  (v_project_id, 'change-orders', 'info', 'Change orders running 1.7% of contract value',
   '8 change orders totaling $943,000 against $58.4M contract. Owner-driven scope changes (kitchen quartz, EV stations, package room access, solid-core doors) account for 89%. Net change including credits: +$925,000.',
   'View Change Orders', '/change-orders', false, '2026-04-04 12:00:00'),

  (v_project_id, 'safety', 'info', 'Safety performance trending positive',
   '2 first aid recordables YTD, zero lost time incidents. EMR at 0.78. Toolbox talk attendance at 96%. No OSHA-recordable injuries in past 60 days.',
   'View Safety', '/safety', false, '2026-04-07 06:00:00'),

  (v_project_id, 'schedule', 'warning', 'Building A wood framing pace below plan',
   'Building A wood framing has averaged 0.38 floors/week vs 0.42 floors/week planned. At current rate, floor 5 completes April 15 vs planned April 11. Consider Saturday shift or additional crew.',
   'View Schedule', '/schedule', false, '2026-04-09 18:00:00'),

  (v_project_id, 'submittals', 'info', 'Submittal review SLA at 87% within target',
   'Of 24 submittals processed, 21 reviews completed within the 14-day target. Average review time: 9.2 days. Architect (Cross) the lead approver across 18 of 24 submittals.',
   NULL, NULL, false, '2026-04-08 06:00:00');

-- =========================================================================
-- 19. PROJECT SNAPSHOTS (4)
-- =========================================================================
DELETE FROM project_snapshots WHERE project_id = v_project_id;
INSERT INTO project_snapshots (project_id, snapshot_date, data, key_events, created_at) VALUES
  (v_project_id, '2024-12-31', '{"percent_complete":35,"budget_spent":20440000,"budget_forecast":58400000,"workers_peak":78,"open_rfis":3,"open_submittals":7,"schedule_variance_days":2,"safety_incidents_mtd":0,"active_change_orders":2}',
   '["Building A podium complete","Building B podium 80% complete","Site civil complete","Wood truss submittal approved"]', '2024-12-31'),
  (v_project_id, '2025-06-30', '{"percent_complete":50,"budget_spent":29200000,"budget_forecast":58450000,"workers_peak":95,"open_rfis":5,"open_submittals":9,"schedule_variance_days":1,"safety_incidents_mtd":1,"active_change_orders":2}',
   '["All three podium decks complete","Wood framing began across all buildings","Window submittal approved","Underground utilities complete"]', '2025-06-30'),
  (v_project_id, '2025-12-31', '{"percent_complete":62,"budget_spent":36200000,"budget_forecast":58500000,"workers_peak":108,"open_rfis":8,"open_submittals":11,"schedule_variance_days":-1,"safety_incidents_mtd":0,"active_change_orders":3}',
   '["Building A floor 4 framing complete","Building B framing reached floor 3","Plumbing fixtures approved","Mailbox submittal in fabrication"]', '2025-12-31'),
  (v_project_id, '2026-03-30', '{"percent_complete":72,"budget_spent":42100000,"budget_forecast":58600000,"workers_peak":118,"open_rfis":7,"open_submittals":3,"schedule_variance_days":-2,"safety_incidents_mtd":1,"active_change_orders":4}',
   '["Building B podium deck topping poured (165 CY)","Building A floor 5 framing 70% complete","Building C trusses set in progress","Pool excavation at 50%","EV charging change order in approval"]', '2026-03-30');

-- =========================================================================
-- 20. DRAWINGS (15 sheets across disciplines)
-- =========================================================================
IF to_regclass('public.drawing_sheets') IS NOT NULL THEN
  DELETE FROM drawing_sheets WHERE drawing_id IN (dwg_01, dwg_02, dwg_03, dwg_04, dwg_05, dwg_06, dwg_07, dwg_08, dwg_09, dwg_10, dwg_11, dwg_12, dwg_13, dwg_14, dwg_15);
END IF;
DELETE FROM drawings WHERE id IN (dwg_01, dwg_02, dwg_03, dwg_04, dwg_05, dwg_06, dwg_07, dwg_08, dwg_09, dwg_10, dwg_11, dwg_12, dwg_13, dwg_14, dwg_15);

INSERT INTO drawings (id, project_id, title, discipline, sheet_number, revision, file_url, uploaded_by, ai_changes_detected, created_at) VALUES
  (dwg_01, v_project_id, 'Cover Sheet and Project Data',           'architectural',   'G0.01', '5', '/files/drawings/G0_01_rev5.pdf',  u_leon,    0, '2020-08-15'),
  (dwg_02, v_project_id, 'Site Plan',                              'civil',           'C1.01', '2', '/files/drawings/C1_01_rev2.pdf',  u_rodgers, 1, '2025-06-10'),
  (dwg_03, v_project_id, 'Site Utility Plan',                      'civil',           'C2.01', '2', '/files/drawings/C2_01_rev2.pdf',  u_rodgers, 2, '2025-06-10'),
  (dwg_04, v_project_id, 'Building A First Floor Plan',            'architectural',   'A2.01', '5', '/files/drawings/A2_01_rev5.pdf',  u_leon,    3, '2026-02-15'),
  (dwg_05, v_project_id, 'Building A Typical Unit Plan C3',        'architectural',   'A2.21', 'C', '/files/drawings/A2_21_revC.pdf',  u_leon,    1, '2026-02-15'),
  (dwg_06, v_project_id, 'Building B Podium Plan',                 'structural',      'S2.10', '4', '/files/drawings/S2_10_rev4.pdf',  u_perkins, 2, '2025-12-20'),
  (dwg_07, v_project_id, 'Stair Tower Framing',                    'structural',      'S4.11', '4', '/files/drawings/S4_11_rev4.pdf',  u_perkins, 1, '2025-12-20'),
  (dwg_08, v_project_id, 'Mechanical Rooftop Plan',                'mechanical',      'M5.01', '3', '/files/drawings/M5_01_rev3.pdf',  u_portnoy, 2, '2026-02-10'),
  (dwg_09, v_project_id, 'Plumbing Riser Diagram',                 'plumbing',        'P3.02', '4', '/files/drawings/P3_02_rev4.pdf',  u_portnoy, 1, '2026-02-10'),
  (dwg_10, v_project_id, 'Electrical Panel Schedules',             'electrical',      'E6.02', '3', '/files/drawings/E6_02_rev3.pdf',  u_portnoy, 0, '2026-02-10'),
  (dwg_11, v_project_id, 'Fire Sprinkler Riser',                   'fire_protection', 'FP1.01','2', '/files/drawings/FP1_01_rev2.pdf', u_portnoy, 0, '2025-08-20'),
  (dwg_12, v_project_id, 'Landscape Master Plan',                  'landscape',       'L1.01', '2', '/files/drawings/L1_01_rev2.pdf',  u_fishbaugh, 1, '2025-11-15'),
  (dwg_13, v_project_id, 'Wall Sections — Typical',                'architectural',   'A8.04', '5', '/files/drawings/A8_04_rev5.pdf',  u_leon,    2, '2026-02-15'),
  (dwg_14, v_project_id, 'Pool and Amenity Plan',                  'architectural',   'A1.10', '4', '/files/drawings/A1_10_rev4.pdf',  u_leon,    2, '2026-01-25'),
  (dwg_15, v_project_id, 'Lobby Curtain Wall Details',             'architectural',   'A6.30', '3', '/files/drawings/A6_30_rev3.pdf',  u_leon,    1, '2026-01-25');

IF to_regclass('public.drawing_sheets') IS NOT NULL THEN
  INSERT INTO drawing_sheets (drawing_id, project_id, page_number, sheet_number, title, file_url, thumbnail_url) VALUES
    (dwg_01, v_project_id, 1, 'G0.01', 'Cover Sheet and Project Data',           '/files/drawings/G0_01_rev5.pdf',  '/files/drawings/thumbs/G0_01.png'),
    (dwg_02, v_project_id, 1, 'C1.01', 'Site Plan',                              '/files/drawings/C1_01_rev2.pdf',  '/files/drawings/thumbs/C1_01.png'),
    (dwg_03, v_project_id, 1, 'C2.01', 'Site Utility Plan',                      '/files/drawings/C2_01_rev2.pdf',  '/files/drawings/thumbs/C2_01.png'),
    (dwg_04, v_project_id, 1, 'A2.01', 'Building A First Floor Plan',            '/files/drawings/A2_01_rev5.pdf',  '/files/drawings/thumbs/A2_01.png'),
    (dwg_05, v_project_id, 1, 'A2.21', 'Building A Typical Unit Plan C3',        '/files/drawings/A2_21_revC.pdf',  '/files/drawings/thumbs/A2_21.png'),
    (dwg_06, v_project_id, 1, 'S2.10', 'Building B Podium Plan',                 '/files/drawings/S2_10_rev4.pdf',  '/files/drawings/thumbs/S2_10.png'),
    (dwg_07, v_project_id, 1, 'S4.11', 'Stair Tower Framing',                    '/files/drawings/S4_11_rev4.pdf',  '/files/drawings/thumbs/S4_11.png'),
    (dwg_08, v_project_id, 1, 'M5.01', 'Mechanical Rooftop Plan',                '/files/drawings/M5_01_rev3.pdf',  '/files/drawings/thumbs/M5_01.png'),
    (dwg_09, v_project_id, 1, 'P3.02', 'Plumbing Riser Diagram',                 '/files/drawings/P3_02_rev4.pdf',  '/files/drawings/thumbs/P3_02.png'),
    (dwg_10, v_project_id, 1, 'E6.02', 'Electrical Panel Schedules',             '/files/drawings/E6_02_rev3.pdf',  '/files/drawings/thumbs/E6_02.png'),
    (dwg_11, v_project_id, 1, 'FP1.01','Fire Sprinkler Riser',                   '/files/drawings/FP1_01_rev2.pdf', '/files/drawings/thumbs/FP1_01.png'),
    (dwg_12, v_project_id, 1, 'L1.01', 'Landscape Master Plan',                  '/files/drawings/L1_01_rev2.pdf',  '/files/drawings/thumbs/L1_01.png'),
    (dwg_13, v_project_id, 1, 'A8.04', 'Wall Sections — Typical',                '/files/drawings/A8_04_rev5.pdf',  '/files/drawings/thumbs/A8_04.png'),
    (dwg_14, v_project_id, 1, 'A1.10', 'Pool and Amenity Plan',                  '/files/drawings/A1_10_rev4.pdf',  '/files/drawings/thumbs/A1_10.png'),
    (dwg_15, v_project_id, 1, 'A6.30', 'Lobby Curtain Wall Details',             '/files/drawings/A6_30_rev3.pdf',  '/files/drawings/thumbs/A6_30.png');
END IF;

-- =========================================================================
-- 21. EQUIPMENT (10 active items)
-- =========================================================================
DELETE FROM equipment WHERE id IN (eq_01, eq_02, eq_03, eq_04, eq_05, eq_06, eq_07, eq_08, eq_09, eq_10) OR project_id = v_project_id;
INSERT INTO equipment (id, project_id, name, type, make, model, year, ownership, vendor, rental_rate_daily, rental_rate_weekly, rental_rate_monthly, status, current_location, hours_meter, last_service_date, next_service_due) VALUES
  (eq_01, v_project_id, 'Crane Grove RT 880',            'crane',        'Grove',     'RT 880',         2019, 'rented', 'Holt Crane Services',   2400, 12000, 42000, 'active',     'Building C',  1240, '2026-03-15', '2026-05-15'),
  (eq_02, v_project_id, 'Concrete Pump Schwing S 36X',   'concrete_pump','Schwing',   'S 36X',          2020, 'rented', 'Texas Pump',             1800,  8500, 30000, 'idle',        'Yard',         860, '2026-03-12', '2026-05-12'),
  (eq_03, v_project_id, 'Excavator CAT 320',             'excavator',    'Caterpillar','320 GC',         2021, 'rented', 'Equipment Depot',       950,  4500, 16000, 'active',     'Pool Area',   2100, '2026-03-20', '2026-05-20'),
  (eq_04, v_project_id, 'Manlift JLG 600S',              'aerial_lift',  'JLG',       '600S',           2022, 'rented', 'Sunbelt Rentals',        320,  1500,  5000, 'active',     'Building A',  1860, '2026-03-25', '2026-05-25'),
  (eq_05, v_project_id, 'Manlift JLG 600S #2',           'aerial_lift',  'JLG',       '600S',           2022, 'rented', 'Sunbelt Rentals',        320,  1500,  5000, 'active',     'Building C',  1240, '2026-03-25', '2026-05-25'),
  (eq_06, v_project_id, 'Forklift Case 588H',            'forklift',     'Case',      '588H',           2020, 'owned', 'Journeyman',              0,    0,    0, 'active',      'Yard',        4280, '2026-03-01', '2026-05-01'),
  (eq_07, v_project_id, 'Generator CAT 100kW',           'generator',    'Caterpillar','XQ 100',         2023, 'rented', 'United Rentals',         180,   850,  2900, 'active',     'Site Trailer', 980, '2026-02-15', '2026-04-15'),
  (eq_08, v_project_id, 'Compressor Atlas Copco 185 CFM','compressor',   'Atlas Copco','XAS 185',        2022, 'rented', 'United Rentals',         140,   650,  2300, 'active',     'Building B',   620, '2026-02-20', '2026-04-20'),
  (eq_09, v_project_id, 'Skid Steer CAT 262D',           'loader',       'Caterpillar','262D',           2020, 'owned', 'Journeyman',              0,    0,    0, 'maintenance','Yard',        3140, '2026-04-05', '2026-04-12'),
  (eq_10, v_project_id, 'Welding Machine Miller Trailblazer 325','welder','Miller','Trailblazer 325',    2022, 'owned', 'Journeyman',              0,    0,    0, 'active',      'Building A',  1480, '2026-03-08', '2026-05-08');

-- =========================================================================
-- 22. PHOTO PINS (12 location-tagged photos)
-- =========================================================================
DELETE FROM photo_pins WHERE project_id = v_project_id;
INSERT INTO photo_pins (project_id, uploaded_by, location_x, location_y, location_z, photo_url, caption, taken_at) VALUES
  (v_project_id, u_gregorcyk,  120,   80,  0, '/photos/avery_oaks/podium_b_pour.jpg',         'Building B podium deck pour day — concrete pump in action',           '2026-03-24 09:00:00'),
  (v_project_id, u_gregorcyk,   45,  140,  4, '/photos/avery_oaks/bldg_a_floor_5_frame.jpg',  'Building A floor 5 framing 70% complete',                              '2026-03-30 10:30:00'),
  (v_project_id, u_gregorcyk,  220,   60,  3, '/photos/avery_oaks/bldg_c_truss_set.jpg',       'Building C truss installation in progress',                            '2026-04-02 11:00:00'),
  (v_project_id, u_gregorcyk,   75,  220,  0, '/photos/avery_oaks/pool_excavation.jpg',        'Pool excavation 50% complete',                                          '2026-03-30 14:00:00'),
  (v_project_id, u_gregorcyk,   75,  220,  0, '/photos/avery_oaks/pool_shotcrete.jpg',         'Pool shotcrete pour day',                                               '2026-04-06 10:00:00'),
  (v_project_id, u_portnoy,     45,  140,  3, '/photos/avery_oaks/mep_rough_a_floor4.jpg',     'MEP rough-in building A floor 4 — sprinkler/duct/plumbing coordination','2026-04-07 13:30:00'),
  (v_project_id, u_gregorcyk,    5,  100,  0, '/photos/avery_oaks/site_storm_drain.jpg',       'Storm drain tie-in to existing detention pond',                         '2026-03-28 11:00:00'),
  (v_project_id, u_gregorcyk,   45,   90,  5, '/photos/avery_oaks/condensers_set.jpg',          'HVAC condensers staged for set on building A roof',                     '2026-04-09 09:00:00'),
  (v_project_id, u_gregorcyk,  220,   60,  4, '/photos/avery_oaks/bldg_c_shingles.jpg',         'Building C asphalt shingle install begins',                              '2026-04-09 14:00:00'),
  (v_project_id, u_gregorcyk,   45,  100,  1, '/photos/avery_oaks/unit_201_kitchen.jpg',        'Unit 201 model — kitchen finish package',                                 '2026-04-05 15:30:00'),
  (v_project_id, u_gregorcyk,   45,  100,  1, '/photos/avery_oaks/unit_201_bath.jpg',           'Unit 201 model — master bath finishes',                                   '2026-04-05 15:45:00'),
  (v_project_id, u_gregorcyk,    5,  220,  0, '/photos/avery_oaks/site_lighting_aim.jpg',       'Site lighting aim correction documented',                                 '2026-03-22 18:00:00');

-- =========================================================================
-- 23. SAFETY INSPECTIONS (8) + INSPECTION ITEMS
-- =========================================================================
DELETE FROM inspection_items WHERE inspection_id IN (si_01, si_02, si_03, si_04, si_05, si_06, si_07, si_08);
DELETE FROM safety_inspections WHERE id IN (si_01, si_02, si_03, si_04, si_05, si_06, si_07, si_08);

INSERT INTO safety_inspections (id, project_id, type, inspector_id, date, area, floor, status, score, max_score, weather_conditions, temperature, notes) VALUES
  (si_01, v_project_id, 'daily_site',  u_gregorcyk, '2026-03-24', 'Building B Podium',    NULL, 'passed', 92, 100, 'Clear',         82, 'Pre-pour walk passed; all rebar tied per spec.'),
  (si_02, v_project_id, 'daily_site',  u_gregorcyk, '2026-03-25', 'Building A',           'Floor 4', 'passed',  88, 100, 'Clear',         84, 'Standard daily walk; minor housekeeping note.'),
  (si_03, v_project_id, 'crane',       u_gregorcyk, '2026-03-26', 'Building C',           NULL,     'passed',   95, 100, 'Light wind',    78, 'Pre-pick crane inspection; signed off for daily ops.'),
  (si_04, v_project_id, 'scaffold',    u_gregorcyk, '2026-03-27', 'Building A',           'Floor 5', 'corrective_action_required', 78, 100, 'Clear', 76, 'Scaffold tag missing on tower 2; planking gap > 1 in.'),
  (si_05, v_project_id, 'fire_protection', u_portnoy, '2026-03-28', 'All Buildings',     NULL,     'passed',   90, 100, 'Cloudy',        72, 'Sprinkler heads protected; FDC accessible.'),
  (si_06, v_project_id, 'excavation',  u_gregorcyk, '2026-03-30', 'Pool Area',            NULL,     'passed',   94, 100, 'Clear',         75, 'Slope per soil report; ladder access at 25 ft on center.'),
  (si_07, v_project_id, 'electrical',  u_portnoy, '2026-04-02', 'Building A',           'Floor 4', 'passed',   91, 100, 'Partly Cloudy', 72, 'Temp power locked out during inspection.'),
  (si_08, v_project_id, 'weekly_area', u_gregorcyk, '2026-04-08', 'Site-Wide',            NULL,     'passed',   86, 100, 'Rain',          58, 'Weekly housekeeping walk; storm impact noted.');

INSERT INTO inspection_items (inspection_id, category, question, response, severity, corrective_action, due_date, resolved, resolved_date) VALUES
  (si_04, 'scaffolding', 'Scaffold tagged with current inspection?',         'fail', 'minor', 'Place green tag after foreman walk',                          '2026-03-28', true,  '2026-03-28'),
  (si_04, 'scaffolding', 'Planking gaps less than 1 inch?',                  'fail', 'major', 'Re-deck planking on tower 2 north side',                      '2026-03-28', true,  '2026-03-28'),
  (si_04, 'fall_protection', 'Guardrails on all open sides?',                  'pass', NULL,   NULL,                                                          NULL,         false, NULL),
  (si_04, 'housekeeping','Work area clean of debris?',                       'pass', NULL,   NULL,                                                          NULL,         false, NULL),
  (si_02, 'fall_protection', 'Floor 4 perimeter guardrails in place?',        'pass', NULL,   NULL,                                                          NULL,         false, NULL),
  (si_02, 'housekeeping','Material storage organized?',                      'corrective_action', 'minor', 'Stage material per planned location',           '2026-03-26', true,  '2026-03-26'),
  (si_06, 'excavation',  'Excavation slope per soil report?',                'pass', NULL,   NULL,                                                          NULL,         false, NULL),
  (si_06, 'excavation',  'Ladder access every 25 ft?',                       'pass', NULL,   NULL,                                                          NULL,         false, NULL),
  (si_07, 'electrical',  'GFCI on all temporary power?',                     'pass', NULL,   NULL,                                                          NULL,         false, NULL),
  (si_07, 'electrical',  'Temp panels labeled?',                             'pass', NULL,   NULL,                                                          NULL,         false, NULL);

-- =========================================================================
-- 24. SAFETY OBSERVATIONS (12)
-- =========================================================================
DELETE FROM safety_observations WHERE project_id = v_project_id;
INSERT INTO safety_observations (project_id, type, category, description, location, observed_by, date, action_taken, follow_up_required) VALUES
  (v_project_id, 'safe_behavior',         'PPE',              'All framers wearing harnesses while working at floor 5 perimeter.',                       'Building A floor 5',  u_gregorcyk, '2026-03-30', 'Recognized crew at toolbox talk',                                  false),
  (v_project_id, 'at_risk_behavior',      'PPE',              'Drywall hanger working without safety glasses near track-saw operations.',                 'Building A floor 2',  u_gregorcyk, '2026-03-25', 'Stopped work, provided glasses, retrained',                          true),
  (v_project_id, 'hazard',                'Housekeeping',     'Loose nails and offcuts piling up in stair tower 1 between floors 2 and 3.',              'Stair Tower 1',       u_gregorcyk, '2026-03-26', 'Issued cleanup work order; rebriefed sub on housekeeping',           true),
  (v_project_id, 'positive_recognition',  'Crane Operations', 'Capital Concrete crew showed perfect signaling discipline on B podium pour.',              'Building B',          u_gregorcyk, '2026-03-24', 'Recognition note in crew file',                                       false),
  (v_project_id, 'safe_behavior',         'Fall Protection',  'TAMKO roofers using anchored harnesses on all building C activities.',                    'Building C',          u_gregorcyk, '2026-04-02', 'Recognized at safety meeting',                                       false),
  (v_project_id, 'at_risk_behavior',      'Equipment',        'Skid steer operating without spotter near walking path.',                                 'Site',                u_gregorcyk, '2026-03-27', 'Stopped operation; assigned spotter; coached operator',              true),
  (v_project_id, 'hazard',                'Trip Hazard',      'Extension cord running across floor 4 corridor; not taped down.',                          'Building A floor 4',  u_portnoy,   '2026-04-01', 'Cord routed overhead and secured',                                    true),
  (v_project_id, 'safe_behavior',         'PPE',              'All workers in pool area wearing hard hats during shotcrete spray operations.',           'Pool Area',           u_gregorcyk, '2026-04-06', 'No action needed; positive observation',                              false),
  (v_project_id, 'positive_recognition',  'Housekeeping',     'Building C area pristine at end of shift — Hill Country crew exemplary.',                'Building C',          u_gregorcyk, '2026-04-03', 'Crew lead recognized at safety meeting',                              false),
  (v_project_id, 'hazard',                'Weather',          'Wet drywall mud splashes increasing slip risk on floor 2 building A.',                    'Building A floor 2',  u_gregorcyk, '2026-04-08', 'Crew paused for cleanup; absorbent placed at high-traffic spots',     true),
  (v_project_id, 'at_risk_behavior',      'PPE',              'Two laborers in pool area not wearing hi-vis after dawn.',                                'Pool Area',           u_gregorcyk, '2026-04-04', 'Hi-vis distributed; reinforced site rule',                            true),
  (v_project_id, 'safe_behavior',         'Lockout',          'Electrician used lockout/tagout on temp panel during inspection.',                        'Building A floor 4',  u_portnoy,   '2026-04-02', 'Recognized at safety meeting',                                       false);

-- =========================================================================
-- 25. TOOLBOX TALKS (8) + ATTENDEES
-- =========================================================================
DELETE FROM toolbox_talk_attendees WHERE toolbox_talk_id IN (tt_01, tt_02, tt_03, tt_04, tt_05, tt_06, tt_07, tt_08);
DELETE FROM toolbox_talks WHERE id IN (tt_01, tt_02, tt_03, tt_04, tt_05, tt_06, tt_07, tt_08);

INSERT INTO toolbox_talks (id, project_id, title, topic, date, presenter_id, content, duration_minutes, attendance_count) VALUES
  (tt_01, v_project_id, 'Crane Operations Safety',           'equipment_operation',   '2026-03-23', u_gregorcyk, 'Reviewed pre-pick communication, exclusion zones, signaling, weather thresholds.',          18, 92),
  (tt_02, v_project_id, 'Concrete Pump Exclusion Zones',     'equipment_operation',   '2026-03-23', u_gregorcyk, 'Identified high-risk zones around pump truck. Reviewed boom whip risk and emergency stop.',  15, 92),
  (tt_03, v_project_id, 'Rebar Handling and Glove Use',      'ppe',                   '2026-03-26', u_gregorcyk, 'Following 3/24 first-aid incident: cut-resistant gloves required for all rebar handling.',  12, 105),
  (tt_04, v_project_id, 'Fall Protection at Floor 5',         'fall_protection',       '2026-03-30', u_gregorcyk, 'Floor 5 framing perimeter requirements; PFAS, anchors, and rescue plan review.',            20, 110),
  (tt_05, v_project_id, 'Wet Weather Slip Prevention',        'housekeeping',          '2026-04-08', u_gregorcyk, 'Post-rain housekeeping. Absorbent placement, paths to walkable, hi-vis signage.',            14, 102),
  (tt_06, v_project_id, 'Heat Illness Prevention',           'heat_illness',          '2026-04-09', u_gregorcyk, 'Heat advisory protocols, water/rest/shade. Crew leads to monitor for symptoms.',             16, 118),
  (tt_07, v_project_id, 'Pool Shotcrete Safety',              'custom',                '2026-04-06', u_gregorcyk, 'Shotcrete pre-pour briefing: PPE, blowback risk, footing/scaffold use, communication.',     20, 24),
  (tt_08, v_project_id, 'HVAC Roof Crane Lift',              'equipment_operation',   '2026-04-09', u_gregorcyk, 'Pre-lift briefing for 24 condenser placements; coordinated with Holt Crane and roofers.', 22, 18);

INSERT INTO toolbox_talk_attendees (toolbox_talk_id, worker_name, company, trade, signed_at) VALUES
  (tt_01, 'Carlos Ramirez',  'Lone Star Framers',     'Wood Framing',  '2026-03-23 07:15:00'),
  (tt_01, 'Brad Whitfield',  'Capital Concrete TX',   'Concrete',      '2026-03-23 07:15:00'),
  (tt_01, 'Maria Delgado',   'Lone Star MEP',         'MEP',           '2026-03-23 07:15:00'),
  (tt_03, 'Carlos Ramirez',  'Lone Star Framers',     'Wood Framing',  '2026-03-26 07:15:00'),
  (tt_03, 'Brad Whitfield',  'Capital Concrete TX',   'Concrete',      '2026-03-26 07:15:00'),
  (tt_03, 'Linda Park',      'Hill Country Finishers','Drywall',       '2026-03-26 07:15:00'),
  (tt_04, 'Carlos Ramirez',  'Lone Star Framers',     'Wood Framing',  '2026-03-30 07:15:00'),
  (tt_04, 'Steve O''Brien',  'TAMKO Roofing',         'Roofing',       '2026-03-30 07:15:00'),
  (tt_05, 'Linda Park',      'Hill Country Finishers','Drywall',       '2026-04-08 07:15:00'),
  (tt_05, 'Tom Reilly',      'Capital Plumbing',      'Plumbing',      '2026-04-08 07:15:00'),
  (tt_07, 'Brad Whitfield',  'Capital Concrete TX',   'Concrete',      '2026-04-06 06:15:00'),
  (tt_07, 'Holly Krenek',    'AquaTech Pool Systems', 'Pool',          '2026-04-06 06:15:00'),
  (tt_08, 'Maria Delgado',   'Lone Star MEP',         'MEP',           '2026-04-09 06:30:00'),
  (tt_08, 'Steve O''Brien',  'TAMKO Roofing',         'Roofing',       '2026-04-09 06:30:00');

-- =========================================================================
-- 26. INCIDENTS (3 — actual records, not just daily-log entries)
-- =========================================================================
DELETE FROM incidents WHERE project_id = v_project_id;
INSERT INTO incidents (project_id, type, severity, date, location, floor, area, description, root_cause, injured_party_name, injured_party_company, injured_party_trade, immediate_actions, osha_recordable, investigation_status, corrective_actions, preventive_actions) VALUES
  (v_project_id, 'injury', 'first_aid', '2026-03-24 09:30:00', 'Building B', NULL, 'Podium deck',
   'Laborer cut hand on rebar tie wire while placing rebar in podium deck. Wound cleaned, tetanus current, returned to light duty.',
   'Insufficient cut-resistant glove usage during rebar tie operations.',
   'Hector Aguilar', 'Capital Concrete Texas', 'Rebar Placer',
   'Site safety officer cleaned and bandaged. Worker rested 20 minutes then returned to light duty.',
   false, 'closed',
   '["Distribute cut-resistant gloves to all rebar workers","Add rebar handling toolbox talk on 3/26"]',
   '["Mandate cut-resistant gloves for all rebar handling tasks","Update site PPE matrix"]'),

  (v_project_id, 'near_miss', 'first_aid', '2026-04-03 11:00:00', 'Building A', 'Floor 3', 'Corridor',
   'Drywall hanger struck shin on a stray screw protruding from a stud. Skin abrasion only; no stitches.',
   'Stud framer left a screw protruding above wood plate.',
   'Dwayne Wilson', 'Hill Country Finishers', 'Drywall Hanger',
   'Wound cleaned and bandaged. Reminder issued at toolbox talk same day.',
   false, 'closed',
   '["Issue site-wide reminder on framing screw flush requirement"]',
   '["Add screw-flush check to framing QC walk"]'),

  (v_project_id, 'near_miss', 'first_aid', '2026-03-27 10:15:00', 'Site', NULL, 'Walkway',
   'Skid steer operator reversed without spotter while a pedestrian was walking along a designated path. No contact made.',
   'Operator did not request spotter for restricted-visibility maneuver.',
   NULL, NULL, NULL,
   'Operator stopped work, briefed by superintendent, spotter assigned for remainder of shift.',
   false, 'closed',
   '["Mandatory spotter for all skid-steer reverse maneuvers in pedestrian areas"]',
   '["Update site traffic control plan"]');

-- =========================================================================
-- 27. DELIVERIES (10)
-- =========================================================================
DELETE FROM deliveries WHERE project_id = v_project_id;
INSERT INTO deliveries (project_id, carrier, tracking_number, delivery_date, status, inspection_notes, received_by) VALUES
  (v_project_id, 'Texas Truss Manufacturing',     'TTM-AVO-22014', '2026-04-01', 'inspected',   'Engineered roof trusses Building C (92). Trusses delivered intact, inspected and signed.', u_gregorcyk),
  (v_project_id, 'Lone Star MEP Services',         'LSM-220-44',     '2026-04-09', 'inspected',   'HVAC condenser units (24). Crane-set on building A roof. All units accepted.',             u_portnoy),
  (v_project_id, 'Capital Plumbing Co.',           'CPC-22011',      '2026-04-12', 'in_transit',  'PEX manifolds (98) + tankless water heaters (48).',                                          NULL),
  (v_project_id, 'Hill Country Cabinets',          'HCC-AVO-09',     '2026-04-20', 'scheduled',   'Kitchen cabinet boxes (120) + bath cabinet boxes (120).',                                     NULL),
  (v_project_id, 'Stone Solutions Texas',          'SST-AVO-12',     '2026-04-25', 'scheduled',   'Quartz slabs (48 — covers 96 units).',                                                        NULL),
  (v_project_id, 'Floor & Decor Pro',              'FD-AVO-2026-04', '2026-04-15', 'scheduled',   'Vinyl plank flooring 18,000 sf (unit standard).',                                             NULL),
  (v_project_id, 'Hardy Siding Contractors',       'HSC-22001',      '2026-03-25', 'inspected',   'Cementitious fiber siding 4,200 sf — bundles delivered building A side yard.',               u_gregorcyk),
  (v_project_id, 'TAMKO Roofing',                  'TAMKO-AVO-220',  '2026-04-01', 'inspected',   '30-year architectural shingles 280 squares. Bundles staged building C side.',                u_gregorcyk),
  (v_project_id, 'Schindler Elevator',             'SCH-AVO-220',    '2026-04-22', 'scheduled',   'Elevator cars, rails, and controller (2 units).',                                              NULL),
  (v_project_id, 'Statewide Fire Protection',      'SFP-22091',      '2026-03-10', 'inspected',   'Sprinkler heads concealed pendent (1,850). Manifest matches PO.',                              u_portnoy);

-- =========================================================================
-- 28. INSURANCE CERTIFICATES / COIs (10 — subs and key vendors)
-- =========================================================================
DELETE FROM insurance_certificates WHERE project_id = v_project_id;
INSERT INTO insurance_certificates (project_id, company, policy_type, carrier, policy_number, coverage_amount, aggregate_limit, effective_date, expiration_date, additional_insured, waiver_of_subrogation, verified, verified_by) VALUES
  (v_project_id, 'Lone Star Framers',           'general_liability', 'Travelers',           'GL-7762091',  2000000, 4000000, '2025-08-01', '2026-08-01', true,  true,  true,  u_gregorcyk),
  (v_project_id, 'Lone Star Framers',           'workers_comp',       'Texas Mutual',        'WC-2210588',  1000000, NULL,    '2025-08-01', '2026-08-01', false, true,  true,  u_gregorcyk),
  (v_project_id, 'Capital Concrete Texas',       'general_liability', 'Hartford',            'GL-8843301',  2000000, 4000000, '2025-09-01', '2026-09-01', true,  true,  true,  u_gregorcyk),
  (v_project_id, 'Lone Star MEP Services',       'general_liability', 'Liberty Mutual',      'GL-9911227',  2000000, 4000000, '2025-10-01', '2026-10-01', true,  true,  true,  u_gregorcyk),
  (v_project_id, 'Hill Country Finishers',       'general_liability', 'Travelers',           'GL-8001245',  1000000, 2000000, '2025-09-01', '2026-09-01', true,  true,  true,  u_gregorcyk),
  (v_project_id, 'Hardy Siding Contractors',     'general_liability', 'Nationwide',          'GL-7290015',  1000000, 2000000, '2025-09-01', '2026-09-01', true,  true,  true,  u_gregorcyk),
  (v_project_id, 'TAMKO Roofing Crew C',         'general_liability', 'CNA',                 'GL-6610884',  2000000, 4000000, '2025-08-15', '2026-08-15', true,  true,  true,  u_gregorcyk),
  (v_project_id, 'Schindler Elevator',           'general_liability', 'AIG',                 'GL-5512377',  5000000,10000000, '2025-05-01', '2027-05-01', true,  true,  true,  u_gregorcyk),
  (v_project_id, 'AquaTech Pool Systems',        'general_liability', 'Zurich',              'GL-4408881',  1000000, 2000000, '2025-09-01', '2026-09-01', true,  false, false, NULL),
  (v_project_id, 'Statewide Fire Protection',    'professional_liability','Beazley',         'PL-3309922',  2000000, 4000000, '2025-08-01', '2026-08-01', false, false, true,  u_gregorcyk);

-- =========================================================================
-- 29. CONTRACTS (6) + PAY APPLICATIONS (5)
-- =========================================================================
DELETE FROM pay_applications WHERE contract_id IN (con_01, con_02, con_03, con_04, con_05, con_06);
DELETE FROM contracts WHERE id IN (con_01, con_02, con_03, con_04, con_05, con_06);

INSERT INTO contracts (id, project_id, type, contract_number, title, counterparty, counterparty_contact, counterparty_email, original_value, revised_value, retainage_percent, start_date, end_date, status, billing_method, payment_terms) VALUES
  (con_01, v_project_id, 'subcontract', 'AOA-001', 'Wood Framing Subcontract',          'Lone Star Framers',         'Carlos Ramirez',  'cramirez@lonestarframers.com',     7200000, 7350000, 10, '2024-11-01', '2026-08-31', 'in_progress', 'fixed_price', 'Net 30'),
  (con_02, v_project_id, 'subcontract', 'AOA-002', 'Concrete Subcontract (Podium and Site)', 'Capital Concrete Texas',  'Brad Whitfield', 'bwhitfield@capitalconcretetx.com', 5400000, 5500000, 10, '2020-12-01', '2026-09-30', 'in_progress', 'fixed_price', 'Net 30'),
  (con_03, v_project_id, 'subcontract', 'AOA-003', 'MEP Subcontract',                   'Lone Star MEP Services',     'Maria Delgado',   'mdelgado@lonestarmep.com',         9800000, 9900000, 10, '2025-01-15', '2026-12-15', 'in_progress', 'fixed_price', 'Net 30'),
  (con_04, v_project_id, 'subcontract', 'AOA-004', 'Roofing Subcontract',                'TAMKO Roofing Crew C',       'Steve O''Brien',  'sobrien@tamkocrew.com',            1800000, 1820000, 10, '2025-08-15', '2026-08-31', 'in_progress', 'fixed_price', 'Net 30'),
  (con_05, v_project_id, 'subcontract', 'AOA-005', 'Drywall and Finishes Subcontract',   'Hill Country Finishers',     'Linda Park',     'lpark@hillcountryfinishers.com',   4400000, 4400000, 10, '2025-09-01', '2026-12-31', 'in_progress', 'fixed_price', 'Net 30'),
  (con_06, v_project_id, 'subcontract', 'AOA-006', 'Elevator Subcontract',               'Schindler Elevator',         'Marcus Patel',    'mpatel@schindler.com',             920000,  920000, 10, '2025-05-01', '2026-08-31', 'in_progress', 'fixed_price', 'Net 30');

INSERT INTO pay_applications (contract_id, project_id, application_number, period_to, original_contract_sum, net_change_orders, contract_sum_to_date, total_completed_and_stored, retainage, total_earned_less_retainage, less_previous_certificates, current_payment_due, balance_to_finish, status, submitted_date, certified_date, paid_date, paid_amount) VALUES
  (con_01, v_project_id, 14, '2026-03-31', 7200000, 150000, 7350000, 5500000, 550000, 4950000, 4520000, 430000, 1850000, 'paid',      '2026-04-02', '2026-04-08', '2026-04-15', 430000),
  (con_02, v_project_id, 24, '2026-03-31', 5400000, 100000, 5500000, 4800000, 480000, 4320000, 4080000, 240000,  700000, 'paid',      '2026-04-02', '2026-04-08', '2026-04-15', 240000),
  (con_03, v_project_id,  9, '2026-03-31', 9800000, 100000, 9900000, 5800000, 580000, 5220000, 4720000, 500000, 4100000, 'submitted', '2026-04-05', NULL,         NULL,         NULL),
  (con_04, v_project_id,  6, '2026-03-31', 1800000,  20000, 1820000, 1100000, 110000,  990000,  910000,  80000,  720000, 'paid',      '2026-04-03', '2026-04-09', '2026-04-16',  80000),
  (con_05, v_project_id,  5, '2026-03-31', 4400000,      0, 4400000, 1900000, 190000, 1710000, 1500000, 210000, 2500000, 'certified', '2026-04-04', '2026-04-10', NULL,         NULL);

-- =========================================================================
-- 30. OWNER UPDATES (4 monthly)
-- =========================================================================
DELETE FROM owner_updates WHERE project_id = v_project_id;
INSERT INTO owner_updates (project_id, title, content, schedule_summary, budget_summary, milestone_updates, weather_summary, published, published_at, created_by) VALUES
  (v_project_id, 'January 2026 Owner Update',
   'Strong start to the year. Building A framing reached level 4. MEP rough-in advancing on schedule. Submittals approved at expected pace.',
   'On schedule. Building A framing pace: 0.4 floors/wk. Building B podium deck topping prep underway.',
   '$36.8M of $58.4M spent. Wood framing trending $150K over original; covered by contingency.',
   '["Building A floor 4 framing complete","Building B podium deck topping prep","Cabinet submittal approved (rev 2)"]',
   'Mild winter; minimal weather days.',
   true, '2026-02-02 09:00:00', u_gregorcyk),
  (v_project_id, 'February 2026 Owner Update',
   'Building B podium pour readiness, cabinet finish mockups approved by owner, and quartz countertop submittal cleared.',
   'On schedule. Building B podium pour scheduled late March.',
   '$39.4M of $58.4M spent. Wood framing forecast holding at +$200K over original.',
   '["Quartz countertop submittal approved","Cabinet rejection/resubmittal","Owner walk model unit completed"]',
   'Two weather days (Feb 8 and 22).',
   true, '2026-03-02 09:00:00', u_gregorcyk),
  (v_project_id, 'March 2026 Owner Update',
   'Major month. Building B podium deck topping placed (165 CY pour). Building A floor 5 framing reached 70%. Pool excavation 50% complete with rock removal change order. Approved.',
   'On schedule. Critical-path tasks tracking. Schedule recovery workshop planned for April 10.',
   '$42.1M of $58.6M forecast. Net change order activity: +$634K including kitchen quartz, EV stations.',
   '["B podium pour complete","A floor 5 framing 70%","C trusses set begin","Pool excavation 50%","EV station change order owner-approved"]',
   'Two weather days. Otherwise productive month.',
   true, '2026-04-01 09:00:00', u_gregorcyk),
  (v_project_id, 'April 2026 Mid-Month Update',
   'Building A floor 5 framing complete. Building C trusses 100% set. Pool shotcrete placed. HVAC condensers all 24 set on building A roof.',
   'Slight slip on building A wood framing pace; recovery workshop April 10. Saturday shift authorized.',
   '$43.5M of $58.7M forecast. Pending change orders: $112,500 (curtain wall + package room).',
   '["A floor 5 framing 100%","C trusses 100%","Pool shotcrete pour","Condensers set on A","Sub progress meeting #15"]',
   'One weather day on April 8 (heavy rain).',
   true, '2026-04-15 09:00:00', u_gregorcyk);

-- =========================================================================
-- 31. WEATHER RECORDS (28-day window)
-- =========================================================================
DELETE FROM weather_records WHERE project_id = v_project_id;
INSERT INTO weather_records (project_id, date, temperature_high, temperature_low, conditions, wind_speed, precipitation, precipitation_amount, humidity, is_weather_day, impact_description, delay_hours, source) VALUES
  (v_project_id, '2026-03-15', 70, 50, 'Clear',         '5-10 mph',  'None',  0.00, 45, false, NULL,                                              0,   'manual'),
  (v_project_id, '2026-03-16', 72, 52, 'Clear',         '5-10 mph',  'None',  0.00, 40, false, NULL,                                              0,   'manual'),
  (v_project_id, '2026-03-17', 75, 56, 'Clear',         '8-12 mph',  'None',  0.00, 38, false, NULL,                                              0,   'manual'),
  (v_project_id, '2026-03-18', 76, 58, 'Partly Cloudy', '8-12 mph',  'None',  0.00, 50, false, NULL,                                              0,   'manual'),
  (v_project_id, '2026-03-19', 74, 56, 'Clear',         '5-10 mph',  'None',  0.00, 45, false, NULL,                                              0,   'manual'),
  (v_project_id, '2026-03-20', 78, 60, 'Clear',         '5-10 mph',  'None',  0.00, 40, false, NULL,                                              0,   'manual'),
  (v_project_id, '2026-03-21', 78, 58, 'Clear',         '5-10 mph',  'None',  0.00, 42, false, NULL,                                              0,   'daily_log'),
  (v_project_id, '2026-03-22', 76, 56, 'Cloudy',        '10-15 mph', 'None',  0.00, 55, false, NULL,                                              0,   'manual'),
  (v_project_id, '2026-03-23', 74, 55, 'Partly Cloudy', '5-10 mph',  'None',  0.00, 50, false, NULL,                                              0,   'daily_log'),
  (v_project_id, '2026-03-24', 82, 62, 'Clear',         '5-10 mph',  'None',  0.00, 45, false, NULL,                                              0,   'daily_log'),
  (v_project_id, '2026-03-25', 84, 64, 'Clear',         '8-12 mph',  'None',  0.00, 40, false, NULL,                                              0,   'daily_log'),
  (v_project_id, '2026-03-26', 62, 48, 'Rain',          '15-20 mph', 'Heavy', 1.85, 92, true,  'Heavy rain all morning. Exterior framing and roofing suspended.', 4.0, 'daily_log'),
  (v_project_id, '2026-03-27', 76, 56, 'Clear',         '8-12 mph',  'None',  0.00, 55, false, NULL,                                              0,   'daily_log'),
  (v_project_id, '2026-03-28', 72, 54, 'Partly Cloudy', '5-10 mph',  'None',  0.00, 50, false, NULL,                                              0,   'daily_log'),
  (v_project_id, '2026-03-29', 75, 56, 'Clear',         '5-10 mph',  'None',  0.00, 48, false, NULL,                                              0,   'manual'),
  (v_project_id, '2026-03-30', 75, 55, 'Clear',         '5-10 mph',  'None',  0.00, 45, false, NULL,                                              0,   'daily_log'),
  (v_project_id, '2026-03-31', 78, 58, 'Clear',         '5-10 mph',  'None',  0.00, 45, false, NULL,                                              0,   'daily_log'),
  (v_project_id, '2026-04-01', 70, 52, 'Cloudy',        '10-15 mph', 'None',  0.00, 60, false, NULL,                                              0,   'daily_log'),
  (v_project_id, '2026-04-02', 72, 54, 'Partly Cloudy', '8-12 mph',  'None',  0.00, 55, false, NULL,                                              0,   'daily_log'),
  (v_project_id, '2026-04-03', 76, 58, 'Clear',         '5-10 mph',  'None',  0.00, 50, false, NULL,                                              0,   'daily_log'),
  (v_project_id, '2026-04-04', 78, 60, 'Clear',         '5-10 mph',  'None',  0.00, 48, false, NULL,                                              0,   'daily_log'),
  (v_project_id, '2026-04-05', 78, 60, 'Partly Cloudy', '8-12 mph',  'None',  0.00, 55, false, NULL,                                              0,   'manual'),
  (v_project_id, '2026-04-06', 82, 62, 'Clear',         '5-10 mph',  'None',  0.00, 45, false, NULL,                                              0,   'daily_log'),
  (v_project_id, '2026-04-07', 84, 64, 'Clear',         '5-10 mph',  'None',  0.00, 42, false, NULL,                                              0,   'daily_log'),
  (v_project_id, '2026-04-08', 58, 46, 'Rain',          '15-25 mph', 'Heavy', 2.40, 95, true,  'Heavy rain all day. Exterior work suspended.',    8.0, 'daily_log'),
  (v_project_id, '2026-04-09', 68, 52, 'Partly Cloudy', '10-15 mph', 'Light', 0.10, 70, false, NULL,                                              0,   'daily_log'),
  (v_project_id, '2026-04-10', 74, 56, 'Clear',         '5-10 mph',  'None',  0.00, 50, false, NULL,                                              0,   'daily_log'),
  (v_project_id, '2026-04-11', 76, 58, 'Clear',         '5-10 mph',  'None',  0.00, 48, false, NULL,                                              0,   'manual')
ON CONFLICT (project_id, date) DO NOTHING;

-- =========================================================================
-- 32. RISK PREDICTIONS (6)
-- =========================================================================
IF to_regclass('public.risk_predictions') IS NOT NULL THEN
DELETE FROM risk_predictions WHERE project_id = v_project_id;
INSERT INTO risk_predictions (project_id, risk_type, probability, impact, description, factors, recommendation, predicted_at) VALUES
  (v_project_id, 'schedule_slip',       0.620, 'high',
   'Building A wood framing pace below plan. At current rate, floor 5 completion slips 4 days, cascading to MEP rough-in start.',
   '["framing rate 8% below plan","Saturday hours not yet authorized","crew at maximum standard manning"]'::jsonb,
   'Authorize Saturday shift through April 30. Cost: ~$28K labor premium. Saves 4 days on critical path.',
   '2026-04-09 06:00:00'),
  (v_project_id, 'budget_overrun',      0.420, 'medium',
   'Wood framing division trending $200K over original. Truss escalation primary driver.',
   '["committed cost $7.95M vs budget $7.80M","change order #2 added $150K","forecast at completion $8.0M"]'::jsonb,
   'Continue monitoring; covered within general contingency. Re-evaluate after April pay app.',
   '2026-04-08 06:00:00'),
  (v_project_id, 'rfi_delay',           0.510, 'high',
   'RFI 024 (garage ventilation) is critical and tied to active MEP rough-in on lower floors. Current age: 11 days.',
   '["critical priority","architect ball-in-court","downstream dependencies on M3.10"]'::jsonb,
   'Escalate via OAC #19. If unresolved by April 11, pause garage MEP rough until ventilation calc resolved.',
   '2026-04-08 06:00:00'),
  (v_project_id, 'submittal_rejection', 0.380, 'medium',
   'Tankless water heater submittal under review for 24 days. Lead time 6 weeks. Late approval risks installation timing in upper floors.',
   '["under review 24 days","6-week lead time","installation needs to start by 5/15"]'::jsonb,
   'Follow up with architect for review status. Pre-warn vendor to shorten lead if approved late.',
   '2026-04-08 06:00:00'),
  (v_project_id, 'safety_incident',     0.180, 'low',
   'Drywall/finish trade rapidly mobilizing on multiple floors with new workers. Historical first-aid risk concentration.',
   '["new workers ramping up","high-traffic floors","stair tower housekeeping observations"]'::jsonb,
   'Conduct second toolbox talk on stair safety and housekeeping; concentrate safety walks on building A floors 1-3.',
   '2026-04-07 06:00:00'),
  (v_project_id, 'schedule_slip',       0.290, 'medium',
   'Lobby curtain wall change order pending review may delay storefront install if not decided by April 18.',
   '["change order in pending review","storefront fabrication lead time 8 weeks","storefront install needs to begin by July 1"]'::jsonb,
   'Push owner decision in OAC #19. If change is approved, expedite glazing fabrication.',
   '2026-04-09 06:00:00');
END IF;

-- =========================================================================
-- 33. CLOSEOUT ITEMS (15)
-- =========================================================================
DELETE FROM closeout_items WHERE project_id = v_project_id;
INSERT INTO closeout_items (project_id, trade, category, description, status, assigned_to, due_date, completed_date, notes) VALUES
  (v_project_id, 'Wood Framing',         'as_built',           'As-built framing plans, all buildings',                            'in_progress', u_gregorcyk, '2026-08-15', NULL,         'In progress per building'),
  (v_project_id, 'Concrete',             'as_built',           'As-built podium and site concrete',                                 'in_progress', u_gregorcyk, '2026-08-15', NULL,         NULL),
  (v_project_id, 'MEP',                  'as_built',           'As-built MEP coordination drawings',                                'not_started', u_portnoy,   '2026-09-30', NULL,         NULL),
  (v_project_id, 'Architectural',        'as_built',           'As-built architectural plans',                                     'not_started', u_leon,      '2026-09-30', NULL,         NULL),
  (v_project_id, 'HVAC',                 'oam_manual',         'O&M manual: VRF system',                                            'not_started', u_portnoy,   '2026-09-15', NULL,         NULL),
  (v_project_id, 'Plumbing',             'oam_manual',         'O&M manual: plumbing fixtures and water heaters',                  'not_started', u_portnoy,   '2026-09-15', NULL,         NULL),
  (v_project_id, 'Electrical',           'oam_manual',         'O&M manual: electrical service and panels',                        'not_started', u_portnoy,   '2026-09-15', NULL,         NULL),
  (v_project_id, 'Pool',                 'oam_manual',         'O&M manual: pool equipment',                                         'not_started', u_gregorcyk, '2026-09-15', NULL,         NULL),
  (v_project_id, 'Fire Protection',      'commissioning',      'NFPA 25 commissioning report',                                       'not_started', u_portnoy,   '2026-08-01', NULL,         NULL),
  (v_project_id, 'Elevators',            'commissioning',      'Schindler elevator commissioning and certificate',                   'in_progress', u_gregorcyk, '2026-07-15', NULL,         'Schindler scheduled mid-July'),
  (v_project_id, 'Roofing',              'warranty',           'TAMKO 30-year shingle warranty',                                     'not_started', u_gregorcyk, '2026-08-15', NULL,         NULL),
  (v_project_id, 'Waterproofing',        'warranty',           'Henry Air-Bloc waterproofing warranty',                              'not_started', u_gregorcyk, '2026-08-15', NULL,         NULL),
  (v_project_id, 'HVAC',                 'training',           'Maintenance staff training on VRF',                                  'not_started', u_portnoy,   '2026-09-01', NULL,         NULL),
  (v_project_id, 'Pool',                 'training',           'Pool operator certification training',                               'not_started', u_gregorcyk, '2026-09-01', NULL,         NULL),
  (v_project_id, 'Site',                 'final_inspection',   'Civil/site final inspection by City of Austin',                      'not_started', u_rodgers,   '2026-08-30', NULL,         NULL);

-- =========================================================================
-- 34. PERMITS (5) + INSPECTIONS (10)
-- =========================================================================
DELETE FROM permit_inspections WHERE permit_id IN (perm_01, perm_02, perm_03, perm_04, perm_05);
DELETE FROM permits WHERE id IN (perm_01, perm_02, perm_03, perm_04, perm_05);

INSERT INTO permits (id, project_id, type, permit_number, jurisdiction, authority, status, applied_date, issued_date, expiration_date, fee, paid, contact_name) VALUES
  (perm_01, v_project_id, 'building',     'BP-2020-007882', 'Austin',  'City of Austin DSD',          'approved', '2020-07-15', '2020-09-08', '2027-09-08', 218000, true,  'David Gregorcyk'),
  (perm_02, v_project_id, 'electrical',   'EL-2020-008221', 'Austin',  'City of Austin DSD',          'approved', '2020-08-01', '2020-09-15', '2027-09-15',  18500, true,  'Mark Portnoy'),
  (perm_03, v_project_id, 'plumbing',     'PL-2020-008505', 'Austin',  'City of Austin DSD',          'approved', '2020-08-01', '2020-09-15', '2027-09-15',  16800, true,  'Mark Portnoy'),
  (perm_04, v_project_id, 'mechanical',   'ME-2020-008772', 'Austin',  'City of Austin DSD',          'approved', '2020-08-01', '2020-09-15', '2027-09-15',  14200, true,  'Mark Portnoy'),
  (perm_05, v_project_id, 'fire',         'FR-2020-009114', 'Austin',  'Austin Fire Department',      'approved', '2020-08-15', '2020-10-01', '2027-10-01',  12400, true,  'Mark Portnoy');

INSERT INTO permit_inspections (permit_id, type, status, scheduled_date, inspector_name, result_notes) VALUES
  (perm_01, 'foundation',  'passed',     '2021-06-15', 'A. Castillo (DSD)',     'Foundation pass; rebar OK'),
  (perm_01, 'framing',     'partial',    '2026-04-15', 'M. Tanaka (DSD)',       'Building C framing inspection partial pending truss completion'),
  (perm_02, 'rough_in',    'passed',     '2026-03-10', 'R. Singh (DSD)',        'Building A floors 1-3 rough-in passed'),
  (perm_02, 'rough_in',    'scheduled',  '2026-04-15', NULL,                    NULL),
  (perm_03, 'rough_in',    'passed',     '2026-03-12', 'R. Singh (DSD)',        'Plumbing rough-in pass on floors 1-3'),
  (perm_03, 'rough_in',    'scheduled',  '2026-04-18', NULL,                    NULL),
  (perm_04, 'rough_in',    'passed',     '2026-04-02', 'R. Singh (DSD)',        'Mechanical rough-in pass on floors 1-3'),
  (perm_04, 'rough_in',    'scheduled',  '2026-04-22', NULL,                    NULL),
  (perm_05, 'special',     'passed',     '2025-09-12', 'AFD Inspector',          'Sprinkler riser pass'),
  (perm_05, 'final',       'not_scheduled', NULL,      NULL,                    'Final fire inspection scheduled near TCO');

-- =========================================================================
-- 35. WORKFORCE MEMBERS (24)
-- =========================================================================
DELETE FROM workforce_members WHERE project_id = v_project_id;
INSERT INTO workforce_members (project_id, name, email, phone, company, trade, role, hourly_rate, overtime_rate, hire_date, status, skills) VALUES
  (v_project_id, 'Carlos Ramirez',    'cramirez@lonestarframers.com',     '(512) 555-2010', 'Lone Star Framers',     'Wood Framing', 'foreman',       55, 82.50, '2024-11-01', 'active', '["framing","layout","crane signaling"]'),
  (v_project_id, 'Hector Aguilar',    'haguilar@lonestarframers.com',     '(512) 555-2011', 'Lone Star Framers',     'Wood Framing', 'journeyman',    38, 57.00, '2024-11-01', 'active', '["framing"]'),
  (v_project_id, 'Pedro Salazar',     'psalazar@lonestarframers.com',     '(512) 555-2012', 'Lone Star Framers',     'Wood Framing', 'journeyman',    36, 54.00, '2024-12-15', 'active', '["framing","sheathing"]'),
  (v_project_id, 'Brad Whitfield',    'bwhitfield@capitalconcretetx.com', '(512) 555-2018', 'Capital Concrete TX',   'Concrete',     'superintendent',62, 93.00, '2020-10-01', 'active', '["concrete","ACI testing","pump operation"]'),
  (v_project_id, 'Junior Castro',     'jcastro@capitalconcretetx.com',    '(512) 555-2020', 'Capital Concrete TX',   'Concrete',     'foreman',       48, 72.00, '2024-09-01', 'active', '["formwork","rebar"]'),
  (v_project_id, 'Maria Delgado',     'mdelgado@lonestarmep.com',         '(512) 555-2030', 'Lone Star MEP',         'MEP',          'superintendent',72,108.00, '2025-01-15', 'active', '["MEP coordination","BIM"]'),
  (v_project_id, 'Tom Reilly',        'treilly@capitalplumbing.com',      '(512) 555-2042', 'Capital Plumbing',      'Plumbing',     'foreman',       55, 82.50, '2025-01-15', 'active', '["plumbing","backflow","wet stack"]'),
  (v_project_id, 'Greg Anderson',     'ganderson@capitalelectrical.com',  '(512) 555-2056', 'Capital Electrical',    'Electrical',   'foreman',       58, 87.00, '2025-02-15', 'active', '["electrical","panel install","arc flash"]'),
  (v_project_id, 'Linda Park',        'lpark@hillcountryfinishers.com',   '(512) 555-2078', 'Hill Country Finishers','Drywall',      'foreman',       48, 72.00, '2025-09-01', 'active', '["drywall","finishing","painting"]'),
  (v_project_id, 'Dwayne Wilson',     'dwilson@hillcountryfinishers.com', '(512) 555-2079', 'Hill Country Finishers','Drywall',      'journeyman',    34, 51.00, '2025-09-15', 'active', '["drywall hanging"]'),
  (v_project_id, 'Antonio Vega',      'avega@hillcountryfinishers.com',   '(512) 555-2080', 'Hill Country Finishers','Drywall',      'journeyman',    34, 51.00, '2025-09-15', 'active', '["drywall finishing"]'),
  (v_project_id, 'Jorge Mendoza',     'jmendoza@hardysiding.com',         '(512) 555-2089', 'Hardy Siding',          'Siding',       'foreman',       46, 69.00, '2025-09-15', 'active', '["fiber cement","trim","caulking"]'),
  (v_project_id, 'Steve O''Brien',    'sobrien@tamkocrew.com',            '(512) 555-2102', 'TAMKO Roofing',         'Roofing',      'foreman',       50, 75.00, '2025-08-15', 'active', '["roofing","truss","fall protection"]'),
  (v_project_id, 'Tyrone Jackson',    'tjackson@tamkocrew.com',           '(512) 555-2103', 'TAMKO Roofing',         'Roofing',      'journeyman',    34, 51.00, '2025-09-01', 'active', '["asphalt shingles"]'),
  (v_project_id, 'Holly Krenek',      'hkrenek@aquatechpools.com',        '(512) 555-2143', 'AquaTech Pools',        'Pool',         'superintendent',62, 93.00, '2026-03-01', 'active', '["pool plaster","equipment"]'),
  (v_project_id, 'Wesley Moore',      'wmoore@statewidefp.com',           '(512) 555-2156', 'Statewide Fire',        'Fire Protection','superintendent',60, 90.00, '2025-08-01', 'active', '["sprinkler","NFPA"]'),
  (v_project_id, 'Erica Brunson',     'ebrunson@austinwindows.com',       '(512) 555-2160', 'Austin Window Spec.',   'Glazing',      'journeyman',    38, 57.00, '2025-10-15', 'active', '["window install","flashing"]'),
  (v_project_id, 'Frank Rojas',       'frojas@austinwindows.com',         '(512) 555-2161', 'Austin Window Spec.',   'Glazing',      'apprentice',    24, 36.00, '2025-11-01', 'active', '["window install"]'),
  (v_project_id, 'Marcus Patel',      'mpatel@schindler.com',             '(972) 555-2128', 'Schindler Elevator',    'Elevators',    'superintendent',75,112.50, '2025-05-01', 'active', '["elevator install","commissioning"]'),
  (v_project_id, 'Diego Hernandez',   'dhernandez@stonesolutionstx.com',  '(512) 555-2180', 'Stone Solutions TX',    'Countertops',  'foreman',       45, 67.50, '2026-04-01', 'active', '["quartz","granite"]'),
  (v_project_id, 'Patricia Vasquez',  'pvasquez@hclandscape.com',         '(512) 555-2192', 'Hill Country Landscape','Landscape',    'superintendent',55, 82.50, '2026-03-01', 'active', '["irrigation","planting","grading"]'),
  (v_project_id, 'Jenna Atwood',      'jatwood@hillcountrycabinets.com',  '(512) 555-2168', 'Hill Country Cabinets', 'Cabinets',     'foreman',       42, 63.00, '2026-04-01', 'active', '["cabinet install"]'),
  (v_project_id, 'Rebecca Zhao',      'rzhao@texastruss.com',             '(972) 555-2115', 'Texas Truss Mfg.',      'Trusses',      'journeyman',    36, 54.00, '2025-08-01', 'active', '["truss assembly","crane signal"]'),
  (v_project_id, 'James Foster',      'jfoster@bleylcivilteam.com',       '(512) 555-2200', 'Bleyl Civil Site',      'Civil',        'foreman',       50, 75.00, '2024-10-01', 'active', '["site grading","storm","trench safety"]');

-- =========================================================================
-- 36. TRANSMITTALS (6)
-- =========================================================================
DELETE FROM transmittals WHERE project_id = v_project_id;
INSERT INTO transmittals (project_id, to_company, to_contact, to_email, from_company, from_contact, subject, purpose, action_required, notes, status, sent_at, acknowledged_at, created_by) VALUES
  (v_project_id, 'Cross Architects, PLLC',           'Mark Leon',    'mleon@crossarchitects.com',  'Journeyman', 'David Gregorcyk', 'Building B podium pour photos and ticket book',         'for_record',         'for_your_use',       'Pour completed 3/24 — see attached.',                       'sent',         '2026-03-25 09:00:00', '2026-03-25 14:00:00', u_gregorcyk),
  (v_project_id, 'Lakeline Avery Partners',          'Kurt Goll',    'kgoll@lakelineavery.com',    'Journeyman', 'David Gregorcyk', 'March 2026 monthly cost report',                          'for_information',    'for_your_use',       'Monthly progress and cost report for owner review.',         'sent',         '2026-03-30 16:00:00', NULL,                  u_gregorcyk),
  (v_project_id, 'Cross Architects, PLLC',           'Mark Leon',    'mleon@crossarchitects.com',  'Journeyman', 'David Gregorcyk', 'Curtain wall triple-glazing cost analysis',               'for_review',         'review_and_return',  'Per RFI 017; confirm preferred direction by April 12.',     'sent',         '2026-04-02 11:00:00', '2026-04-03 09:00:00', u_gregorcyk),
  (v_project_id, 'JCI Residential',                   'Sam Kumar',   'skumar@jci-residential.com', 'Journeyman', 'David Gregorcyk', 'Three-week look ahead 4/10',                              'for_information',    'for_your_use',       'Weekly look ahead distribution.',                            'sent',         '2026-04-10 09:00:00', NULL,                  u_gregorcyk),
  (v_project_id, 'RTP Structural, PLLC',             'Trent Perkins','tperkins@rtpstructural.com', 'Journeyman', 'David Gregorcyk', 'Field measurements for curb height roof condensers',     'as_requested',       'review_and_comment', 'Field-measured curbs — 14 in current; need direction.',     'sent',         '2026-04-04 13:00:00', '2026-04-05 11:00:00', u_gregorcyk),
  (v_project_id, 'MEP Systems Design',                'Mark Portnoy','mportnoy@mepsd.com',         'Journeyman', 'David Gregorcyk', 'Tankless water heater submittal follow-up',              'as_requested',       'review_and_return',  'Submittal under review 24 days; please advise.',            'draft',        NULL,                  NULL,                  u_gregorcyk);

-- =========================================================================
-- 37. SPECIFICATIONS (15 sections)
-- =========================================================================
IF to_regclass('public.specifications') IS NOT NULL THEN
DELETE FROM specifications WHERE project_id = v_project_id;
INSERT INTO specifications (project_id, section_number, title, division, status, revision, notes) VALUES
  (v_project_id, '03 30 00', 'Cast-in-Place Concrete',                    3,  'active', 'Rev 2', NULL),
  (v_project_id, '03 35 00', 'Concrete Finishing',                         3,  'active', 'Rev 2', NULL),
  (v_project_id, '03 35 33', 'Decorative Concrete Finishing',              3,  'active', 'Rev 1', 'Pool deck pattern'),
  (v_project_id, '06 17 33', 'Wood I-Joists and Engineered Trusses',       6,  'active', 'Rev 2', NULL),
  (v_project_id, '06 20 00', 'Finish Carpentry',                            6,  'active', 'Rev 1', NULL),
  (v_project_id, '07 31 13', 'Asphalt Shingles',                            7,  'active', 'Rev 1', NULL),
  (v_project_id, '07 46 46', 'Cementitious Fiber Siding',                   7,  'active', 'Rev 1', NULL),
  (v_project_id, '08 53 13', 'Vinyl Windows',                                8,  'active', 'Rev 1', NULL),
  (v_project_id, '09 21 16', 'Gypsum Board Assemblies',                     9,  'active', 'Rev 2', NULL),
  (v_project_id, '09 30 13', 'Tile Work',                                   9,  'active', 'Rev 1', NULL),
  (v_project_id, '09 65 19', 'Resilient Tile Flooring',                     9,  'active', 'Rev 1', NULL),
  (v_project_id, '12 32 00', 'Manufactured Wood Casework',                 12,  'active', 'Rev 2', 'Cabinets'),
  (v_project_id, '21 13 13', 'Wet-Pipe Sprinkler Systems',                 21,  'active', 'Rev 1', NULL),
  (v_project_id, '23 81 19', 'Self-Contained Air-Conditioners',            23,  'active', 'Rev 1', NULL),
  (v_project_id, '23 81 26', 'Split-System Air-Conditioners (VRF)',        23,  'active', 'Rev 2', NULL)
ON CONFLICT (project_id, section_number) DO NOTHING;
END IF;

-- =========================================================================
-- 38. SCHEDULE OF VALUES (line items per contract)
-- =========================================================================
DELETE FROM schedule_of_values WHERE contract_id IN (con_01, con_02, con_03, con_04, con_05, con_06);
INSERT INTO schedule_of_values (contract_id, item_number, description, scheduled_value, previous_completed, this_period_completed, materials_stored, total_completed, percent_complete, retainage, balance_to_finish, sort_order) VALUES
  -- Wood Framing (con_01)
  (con_01, '06.10', 'Building A wood framing',          2800000, 2400000, 200000, 0,  2600000,  93, 260000,  200000, 1),
  (con_01, '06.20', 'Building B wood framing',          2400000, 1900000, 100000, 0,  2000000,  83, 200000,  400000, 2),
  (con_01, '06.30', 'Building C wood framing',          1750000, 1100000,  50000, 0,  1150000,  66, 115000,  600000, 3),
  (con_01, '06.40', 'Stair towers and miscellaneous',    400000,  150000,  50000, 0,   200000,  50,  20000,  200000, 4),
  -- Concrete (con_02)
  (con_02, '03.10', 'Site concrete (sidewalks, curbs)',  900000,  720000,  60000, 0,   780000,  87,  78000,  120000, 1),
  (con_02, '03.20', 'Building podium decks A/B/C',      3700000, 3400000,  80000, 0,  3480000,  94, 348000,  220000, 2),
  (con_02, '03.30', 'Site retaining walls',              500000,  450000,      0, 0,   450000,  90,  45000,   50000, 3),
  (con_02, '03.40', 'Pool shotcrete and structural',     400000,  220000, 100000, 0,   320000,  80,  32000,   80000, 4),
  -- MEP (con_03)
  (con_03, '22.10', 'Plumbing rough-in',                2800000, 1700000, 100000, 0,  1800000,  64, 180000, 1000000, 1),
  (con_03, '22.20', 'Plumbing fixtures and trim out',   1200000,  100000,      0, 0,   100000,   8,  10000, 1100000, 2),
  (con_03, '23.10', 'HVAC equipment and rough-in',      2400000, 1800000, 200000, 0,  2000000,  83, 200000,  400000, 3),
  (con_03, '23.20', 'HVAC trim out and balancing',      1100000,       0,      0, 0,        0,   0,      0, 1100000, 4),
  (con_03, '26.10', 'Electrical service and panels',    1200000, 1100000,  50000, 0,  1150000,  96, 115000,   50000, 5),
  (con_03, '26.20', 'Electrical rough-in and trim',     1300000,  900000,  20000, 0,   920000,  71,  92000,  380000, 6),
  -- Roofing (con_04)
  (con_04, '07.10', 'Trusses and sheathing',             900000,  600000, 100000, 0,   700000,  78,  70000,  200000, 1),
  (con_04, '07.20', 'Underlayment and shingles',         700000,  300000, 100000, 0,   400000,  57,  40000,  300000, 2),
  (con_04, '07.30', 'Metal trim and flashing',           220000,   60000,  20000, 0,    80000,  36,   8000,  140000, 3),
  -- Drywall and Finishes (con_05)
  (con_05, '09.10', 'Drywall and acoustic',             1800000,  900000, 200000, 0,  1100000,  61, 110000,  700000, 1),
  (con_05, '09.20', 'Painting',                         1100000,  300000, 100000, 0,   400000,  36,  40000,  700000, 2),
  (con_05, '09.30', 'Tile work',                         700000,  100000,  50000, 0,   150000,  21,  15000,  550000, 3),
  (con_05, '09.40', 'Flooring',                          800000,  100000,  50000, 0,   150000,  19,  15000,  650000, 4),
  -- Elevators (con_06)
  (con_06, '14.10', 'Equipment delivery',                360000,       0,      0, 0,        0,   0,      0,  360000, 1),
  (con_06, '14.20', 'Installation and commissioning',    400000,       0,      0, 0,        0,   0,      0,  400000, 2),
  (con_06, '14.30', 'Cab finishes and trim',             160000,       0,      0, 0,        0,   0,      0,  160000, 3);

-- =========================================================================
-- 39. SAFETY CERTIFICATIONS (for workforce members — keyed by name)
-- =========================================================================
DELETE FROM safety_certifications WHERE project_id = v_project_id;
INSERT INTO safety_certifications (project_id, worker_name, company, trade, certification_type, certification_number, issued_date, expiration_date, verified, verified_by, verified_at) VALUES
  (v_project_id, 'Carlos Ramirez',   'Lone Star Framers',     'Wood Framing',  'osha_30',           'OSHA-30-7791', '2024-08-15', '2029-08-15', true,  u_gregorcyk, '2024-11-01 09:00:00'),
  (v_project_id, 'Hector Aguilar',   'Lone Star Framers',     'Wood Framing',  'osha_10',           'OSHA-10-2206', '2024-10-12', '2029-10-12', true,  u_gregorcyk, '2024-11-01 09:00:00'),
  (v_project_id, 'Pedro Salazar',    'Lone Star Framers',     'Wood Framing',  'osha_10',           'OSHA-10-2207', '2024-10-12', '2029-10-12', true,  u_gregorcyk, '2024-11-01 09:00:00'),
  (v_project_id, 'Brad Whitfield',   'Capital Concrete TX',   'Concrete',      'osha_30',           'OSHA-30-6612', '2023-04-20', '2028-04-20', true,  u_gregorcyk, '2024-09-01 09:00:00'),
  (v_project_id, 'Brad Whitfield',   'Capital Concrete TX',   'Concrete',      'crane_operator',    'CC-TX-22019',  '2024-06-15', '2026-06-15', true,  u_gregorcyk, '2024-09-01 09:00:00'),
  (v_project_id, 'Junior Castro',    'Capital Concrete TX',   'Concrete',      'osha_10',           'OSHA-10-3382', '2024-08-09', '2029-08-09', true,  u_gregorcyk, '2024-09-15 09:00:00'),
  (v_project_id, 'Maria Delgado',    'Lone Star MEP',         'MEP',           'osha_30',           'OSHA-30-7820', '2024-09-12', '2029-09-12', true,  u_gregorcyk, '2025-01-15 10:00:00'),
  (v_project_id, 'Maria Delgado',    'Lone Star MEP',         'MEP',           'electrical_qualified','ELQ-TX-771', '2024-05-08', '2027-05-08', true,  u_gregorcyk, '2025-01-15 10:00:00'),
  (v_project_id, 'Tom Reilly',       'Capital Plumbing',      'Plumbing',      'osha_30',           'OSHA-30-9011', '2024-04-22', '2029-04-22', true,  u_gregorcyk, '2025-01-15 10:00:00'),
  (v_project_id, 'Greg Anderson',    'Capital Electrical',    'Electrical',    'osha_30',           'OSHA-30-8102', '2024-07-30', '2029-07-30', true,  u_gregorcyk, '2025-02-15 09:00:00'),
  (v_project_id, 'Greg Anderson',    'Capital Electrical',    'Electrical',    'electrical_qualified','ELQ-TX-880', '2024-02-15', '2027-02-15', true,  u_gregorcyk, '2025-02-15 09:00:00'),
  (v_project_id, 'Linda Park',       'Hill Country Finishers','Drywall',       'osha_30',           'OSHA-30-7711', '2024-08-20', '2029-08-20', true,  u_gregorcyk, '2025-09-01 09:00:00'),
  (v_project_id, 'Dwayne Wilson',    'Hill Country Finishers','Drywall',       'osha_10',           'OSHA-10-4451', '2025-09-08', '2030-09-08', true,  u_gregorcyk, '2025-09-15 09:00:00'),
  (v_project_id, 'Antonio Vega',     'Hill Country Finishers','Drywall',       'osha_10',           'OSHA-10-4452', '2025-09-08', '2030-09-08', true,  u_gregorcyk, '2025-09-15 09:00:00'),
  (v_project_id, 'Jorge Mendoza',    'Hardy Siding',          'Siding',        'osha_30',           'OSHA-30-7882', '2024-09-22', '2029-09-22', true,  u_gregorcyk, '2025-09-15 09:00:00'),
  (v_project_id, 'Jorge Mendoza',    'Hardy Siding',          'Siding',        'fall_protection',   'FP-TX-9911',   '2025-08-01', '2027-08-01', true,  u_gregorcyk, '2025-09-15 09:00:00'),
  (v_project_id, 'Steve O''Brien',   'TAMKO Roofing',         'Roofing',       'osha_30',           'OSHA-30-6622', '2024-07-15', '2029-07-15', true,  u_gregorcyk, '2025-08-15 09:00:00'),
  (v_project_id, 'Steve O''Brien',   'TAMKO Roofing',         'Roofing',       'fall_protection',   'FP-TX-7720',   '2025-06-30', '2027-06-30', true,  u_gregorcyk, '2025-08-15 09:00:00'),
  (v_project_id, 'Tyrone Jackson',   'TAMKO Roofing',         'Roofing',       'osha_10',           'OSHA-10-3812', '2025-08-22', '2030-08-22', true,  u_gregorcyk, '2025-09-01 09:00:00'),
  (v_project_id, 'Tyrone Jackson',   'TAMKO Roofing',         'Roofing',       'fall_protection',   'FP-TX-7721',   '2025-08-22', '2027-08-22', true,  u_gregorcyk, '2025-09-01 09:00:00'),
  (v_project_id, 'Holly Krenek',     'AquaTech Pools',        'Pool',          'osha_30',           'OSHA-30-9912', '2024-12-10', '2029-12-10', true,  u_gregorcyk, '2026-03-01 10:00:00'),
  (v_project_id, 'Wesley Moore',     'Statewide Fire',        'Fire Protection','osha_30',          'OSHA-30-7708', '2024-06-15', '2029-06-15', true,  u_gregorcyk, '2025-08-01 09:00:00'),
  (v_project_id, 'Erica Brunson',    'Austin Window Spec.',   'Glazing',       'osha_10',           'OSHA-10-5102', '2025-10-08', '2030-10-08', true,  u_gregorcyk, '2025-10-15 09:00:00'),
  (v_project_id, 'Frank Rojas',      'Austin Window Spec.',   'Glazing',       'osha_10',           'OSHA-10-5103', '2025-10-25', '2030-10-25', true,  u_gregorcyk, '2025-11-01 09:00:00'),
  (v_project_id, 'Marcus Patel',     'Schindler Elevator',    'Elevators',     'osha_30',           'OSHA-30-4488', '2023-11-20', '2028-11-20', true,  u_gregorcyk, '2025-05-01 09:00:00'),
  (v_project_id, 'Diego Hernandez',  'Stone Solutions TX',    'Countertops',   'osha_10',           'OSHA-10-6712', '2026-03-22', '2031-03-22', true,  u_gregorcyk, '2026-04-01 10:00:00'),
  (v_project_id, 'Patricia Vasquez', 'Hill Country Landscape','Landscape',     'osha_30',           'OSHA-30-7702', '2024-11-09', '2029-11-09', true,  u_gregorcyk, '2026-03-01 09:00:00'),
  (v_project_id, 'James Foster',     'Bleyl Civil Site',      'Civil',         'osha_30',           'OSHA-30-5577', '2023-02-15', '2028-02-15', true,  u_gregorcyk, '2024-10-01 09:00:00'),
  (v_project_id, 'James Foster',     'Bleyl Civil Site',      'Civil',         'excavation_competent','EXC-TX-2201','2024-09-10', '2027-09-10', true,  u_gregorcyk, '2024-10-01 09:00:00'),
  (v_project_id, 'Rebecca Zhao',     'Texas Truss Mfg.',      'Trusses',       'rigging',           'RIG-TX-8801',  '2024-04-12', '2027-04-12', true,  u_gregorcyk, '2025-08-01 09:00:00');

-- =========================================================================
-- 40. TIME ENTRIES (5 days for 8 active workers — sample timesheet data)
-- =========================================================================
DELETE FROM time_entries WHERE project_id = v_project_id;

WITH wf AS (
  SELECT id, name FROM workforce_members WHERE project_id = v_project_id
)
INSERT INTO time_entries (workforce_member_id, project_id, date, clock_in, clock_out, regular_hours, overtime_hours, double_time_hours, break_minutes, cost_code, task_description, approved, approved_by)
SELECT wf.id, v_project_id, d.date,
  d.date + interval '6 hours 30 minutes',
  d.date + interval '15 hours 0 minutes',
  8.0, 0.5, 0.0, 30,
  CASE wf.name
    WHEN 'Carlos Ramirez'  THEN '06-10' WHEN 'Hector Aguilar'   THEN '06-10' WHEN 'Pedro Salazar' THEN '06-10'
    WHEN 'Brad Whitfield'  THEN '03-20' WHEN 'Junior Castro'    THEN '03-20'
    WHEN 'Maria Delgado'   THEN '23-10' WHEN 'Tom Reilly'       THEN '22-10' WHEN 'Greg Anderson' THEN '26-10'
    WHEN 'Linda Park'      THEN '09-10' WHEN 'Dwayne Wilson'    THEN '09-10' WHEN 'Antonio Vega'  THEN '09-10'
    WHEN 'Jorge Mendoza'   THEN '07-46' WHEN 'Steve O''Brien'   THEN '07-31' WHEN 'Tyrone Jackson'THEN '07-31'
    WHEN 'Erica Brunson'   THEN '08-53' WHEN 'Frank Rojas'      THEN '08-53'
    ELSE '01-00'
  END,
  CASE wf.name
    WHEN 'Carlos Ramirez'  THEN 'Building A floor 5 framing' WHEN 'Hector Aguilar' THEN 'Building A floor 5 framing'
    WHEN 'Pedro Salazar'   THEN 'Building A floor 5 framing'
    WHEN 'Brad Whitfield'  THEN 'Building B podium topping' WHEN 'Junior Castro'  THEN 'Building B podium topping'
    WHEN 'Maria Delgado'   THEN 'MEP coordination building A' WHEN 'Tom Reilly'   THEN 'Plumbing rough floor 4'
    WHEN 'Greg Anderson'   THEN 'Branch circuit rough A4'
    WHEN 'Linda Park'      THEN 'Drywall finishing floor 2' WHEN 'Dwayne Wilson' THEN 'Drywall hanging floor 3' WHEN 'Antonio Vega' THEN 'Drywall finishing floor 2'
    WHEN 'Jorge Mendoza'   THEN 'Building A siding install'
    WHEN 'Steve O''Brien'  THEN 'Building C truss set' WHEN 'Tyrone Jackson' THEN 'Building C shingle install'
    WHEN 'Erica Brunson'   THEN 'Building C window install' WHEN 'Frank Rojas' THEN 'Building C window install'
    ELSE 'General site duties'
  END,
  true, u_gregorcyk
FROM wf, generate_series('2026-04-06'::date, '2026-04-10'::date, interval '1 day') AS d(date)
WHERE wf.name IN ('Carlos Ramirez','Hector Aguilar','Pedro Salazar','Brad Whitfield','Junior Castro','Maria Delgado','Tom Reilly','Greg Anderson','Linda Park','Dwayne Wilson','Antonio Vega','Jorge Mendoza','Steve O''Brien','Tyrone Jackson','Erica Brunson','Frank Rojas')
  AND EXTRACT(dow FROM d.date) NOT IN (0);  -- skip Sunday

-- =========================================================================
-- 41. SUBCONTRACTOR INVOICES (8)
-- =========================================================================
DELETE FROM subcontractor_invoices WHERE project_id = v_project_id;
INSERT INTO subcontractor_invoices (project_id, invoice_number, period_start, period_end, scheduled_value, work_completed_previous, work_completed_this_period, materials_stored, total_completed, retainage_percent, retainage_amount, amount_due, status, submitted_at, approved_at, paid_at, notes) VALUES
  (v_project_id, 'LSF-INV-014',  '2026-03-01', '2026-03-31', 7350000, 4520000, 430000, 0, 4950000, 10, 495000, 387000, 'paid',       '2026-04-02 09:00:00', '2026-04-08 11:00:00', '2026-04-15 14:30:00', 'Lone Star Framers — March work'),
  (v_project_id, 'CCT-INV-024',  '2026-03-01', '2026-03-31', 5500000, 4080000, 240000, 0, 4320000, 10, 432000, 216000, 'paid',       '2026-04-02 09:30:00', '2026-04-08 11:30:00', '2026-04-15 14:30:00', 'Capital Concrete — March work'),
  (v_project_id, 'LSM-INV-009',  '2026-03-01', '2026-03-31', 9900000, 4720000, 500000, 50000, 5270000, 10, 527000, 450000, 'submitted', '2026-04-05 10:00:00', NULL,                  NULL,                  'Lone Star MEP — March work, awaiting review'),
  (v_project_id, 'TAMKO-INV-006','2026-03-01', '2026-03-31', 1820000,  910000,  80000, 0,  990000, 10,  99000, 72000,  'paid',       '2026-04-03 11:00:00', '2026-04-09 09:00:00', '2026-04-16 13:00:00', 'TAMKO Roofing — March work'),
  (v_project_id, 'HCF-INV-005',  '2026-03-01', '2026-03-31', 4400000, 1500000, 210000, 0, 1710000, 10, 171000, 189000, 'approved',   '2026-04-04 12:00:00', '2026-04-10 09:30:00', NULL,                  'Hill Country Finishers — March, ready for payment'),
  (v_project_id, 'HSC-INV-008',  '2026-03-01', '2026-03-31',  860000,  650000,  60000, 0,  710000, 10,  71000, 54000,  'paid',       '2026-04-03 11:30:00', '2026-04-09 10:00:00', '2026-04-16 13:00:00', 'Hardy Siding — March work'),
  (v_project_id, 'AWS-INV-004',  '2026-03-01', '2026-03-31',  720000,  220000,  40000, 0,  260000, 10,  26000, 36000,  'submitted',  '2026-04-05 13:00:00', NULL,                  NULL,                  'Austin Window — March, partial install'),
  (v_project_id, 'AQTC-INV-001', '2026-03-15', '2026-04-15',  680000,       0, 100000, 0,  100000, 10,  10000, 90000,  'draft',      NULL,                  NULL,                  NULL,                  'AquaTech Pool — initial mobilization and shotcrete');

-- =========================================================================
-- 42. MEETING AGENDA ITEMS (extended detail for OAC #18 and OAC #19)
-- =========================================================================
DELETE FROM meeting_agenda_items WHERE meeting_id IN (mtg_01, mtg_07, mtg_11, mtg_12);
INSERT INTO meeting_agenda_items (meeting_id, title, presenter, duration_minutes, notes, decision, sort_order, status) VALUES
  -- OAC #18 (mtg_01)
  (mtg_01, 'Safety moment',                       'David Gregorcyk',  5,  'Reviewed 3/24 first-aid incident; reinforced glove protocol.',                                              NULL,                                                       1, 'discussed'),
  (mtg_01, 'Schedule update',                     'David Gregorcyk', 15,  'Building B podium pour complete. Building A framing at floor 5 (70%). Building C trusses set in progress.', NULL,                                                       2, 'discussed'),
  (mtg_01, 'Budget review',                       'David Gregorcyk', 15,  '$42.1M of $58.6M forecast. Wood framing trending +$200K covered by contingency.',                            NULL,                                                       3, 'discussed'),
  (mtg_01, 'Change order status',                 'David Gregorcyk', 20,  'Pool rock removal $62K approved. EV charging $175K in concept approval.',                                    'Owner approves EV charging in concept; final pricing due 4/5', 4, 'discussed'),
  (mtg_01, 'RFI log review',                      'Mark Leon',       10,  'Critical: RFI 001, 005, 007 require attention.',                                                              NULL,                                                       5, 'discussed'),
  (mtg_01, 'Submittal log review',                'Mark Leon',       10,  '3 under review. Pool deck submittal rejected — resubmittal due 4/5.',                                          NULL,                                                       6, 'discussed'),
  (mtg_01, 'Owner items',                         'Sam Kumar',        5,  'Schindler elevator delivery update needed.',                                                                 'GC to provide update by 4/2',                              7, 'discussed'),
  -- OAC #19 (mtg_07)
  (mtg_07, 'Safety moment',                       'David Gregorcyk',  5,  'Wet weather slip prevention review.',                                                                        NULL,                                                       1, 'discussed'),
  (mtg_07, 'Schedule update',                     'David Gregorcyk', 15,  'Building A floor 5 framing complete. Building C trusses 100%. Pool shotcrete placed. Condensers all set.', NULL,                                                       2, 'discussed'),
  (mtg_07, 'Budget review',                       'David Gregorcyk', 15,  '$43.5M of $58.7M forecast. Pending change orders: $112,500 for curtain wall + package room.',                NULL,                                                       3, 'discussed'),
  (mtg_07, 'Submittals',                          'Mark Leon',       10,  'Tankless water heater under review 24 days. Cabinets cleared rev 2.',                                          NULL,                                                       4, 'discussed'),
  (mtg_07, 'RFIs',                                'Mark Leon',       10,  'Critical: RFI 024 garage ventilation undersized; needs decision.',                                              'Architect to respond by 4/11',                             5, 'discussed'),
  (mtg_07, 'Owner items',                         'Sam Kumar',        5,  'EV charging change order final pricing approved.',                                                            'EV change order approved at $175K',                        6, 'discussed'),
  -- Owner Walk (mtg_11)
  (mtg_11, 'Model unit tour',                     'David Gregorcyk', 30,  'Walked unit 201 — kitchen, master bath, living, master bedroom.',                                              NULL,                                                       1, 'discussed'),
  (mtg_11, 'Cabinet review',                      'Mark Leon',       20,  'Reviewed shaker profile and finish.',                                                                          'Approved as installed',                                    2, 'discussed'),
  (mtg_11, 'Countertop review',                   'Mark Leon',       15,  'Reviewed quartz pattern and seam locations.',                                                                  'Approved',                                                 3, 'discussed'),
  (mtg_11, 'Flooring review',                     'Mark Leon',       15,  'Reviewed plank color and transitions.',                                                                        'Approved',                                                 4, 'discussed'),
  (mtg_11, 'Punch list discussion',               'David Gregorcyk', 20,  'Walked open punch items in unit 201; closed 3 of 5 on the spot.',                                              NULL,                                                       5, 'discussed'),
  (mtg_11, 'Open questions',                      'Sam Kumar',       20,  'Owner asked for second walk after cabinets in 50% of units.',                                                  'Schedule second walk for 4/25',                            6, 'discussed'),
  -- Schedule Recovery (mtg_12)
  (mtg_12, 'Framing rate analysis',                'David Gregorcyk', 25,  'Pace 8% below plan; floor 5 slipping 4 days.',                                                                 NULL,                                                       1, 'discussed'),
  (mtg_12, 'Recovery options',                    'David Gregorcyk', 30,  'Saturday shift (+$28K), additional crew (+$42K), accept slip.',                                                NULL,                                                       2, 'discussed'),
  (mtg_12, 'Owner cost implications',             'Sam Kumar',       15,  'Within general contingency for either option.',                                                                NULL,                                                       3, 'discussed'),
  (mtg_12, 'Decision and action items',           'David Gregorcyk', 20,  'Authorize Saturday shift through 4/30; add crew if 4/22 metrics still off plan.',                              'Saturday shift approved through 4/30',                    4, 'discussed');

-- =========================================================================
-- 43. MATERIAL INVENTORY (12)
-- =========================================================================
DELETE FROM material_inventory WHERE project_id = v_project_id;
INSERT INTO material_inventory (project_id, name, category, quantity_on_hand, unit, location, minimum_quantity, last_counted_date) VALUES
  (v_project_id, 'Drywall Sheets, 5/8" Type X',         'Drywall',       420,    'sheets',   'Bldg A Yard',     200, '2026-04-08'),
  (v_project_id, 'Drywall Sheets, 1/2" Standard',       'Drywall',       180,    'sheets',   'Bldg A Yard',     100, '2026-04-08'),
  (v_project_id, 'Drywall Joint Compound, 5gal',         'Drywall',        24,    'buckets',  'Bldg A Yard',      10, '2026-04-08'),
  (v_project_id, 'Wood Studs 2x4x10',                    'Lumber',        320,    'each',     'Bldg A Yard',     150, '2026-04-08'),
  (v_project_id, 'Wood Studs 2x6x10',                    'Lumber',        180,    'each',     'Bldg A Yard',     100, '2026-04-08'),
  (v_project_id, 'OSB Sheathing 7/16"',                  'Lumber',        145,    'sheets',   'Bldg C Yard',      80, '2026-04-09'),
  (v_project_id, 'PEX Tubing 1/2"',                      'Plumbing',     2400,    'feet',     'Bldg A Floor 4',  600, '2026-04-07'),
  (v_project_id, 'PEX Tubing 3/4"',                      'Plumbing',     1100,    'feet',     'Bldg A Floor 4',  300, '2026-04-07'),
  (v_project_id, 'EMT Conduit 1/2"',                     'Electrical',    480,    'feet',     'Bldg A Floor 4',  200, '2026-04-07'),
  (v_project_id, 'Romex 12-2 NM-B',                      'Electrical',   1800,    'feet',     'Bldg A Floor 4',  500, '2026-04-07'),
  (v_project_id, 'Asphalt Shingle Bundles 30-yr',        'Roofing',       180,    'bundles',  'Bldg C Roof Stage', 80, '2026-04-09'),
  (v_project_id, 'Caulk 10oz',                           'Sealants',       96,    'tubes',    'Bldg A Yard',      40, '2026-04-08');

-- =========================================================================
-- 44. BID PACKAGES + INVITATIONS + RESPONSES (precon — for late bids/upcoming)
-- =========================================================================
DELETE FROM bid_responses WHERE bid_package_id IN (bp_01, bp_02, bp_03);
DELETE FROM bid_invitations WHERE bid_package_id IN (bp_01, bp_02, bp_03);
DELETE FROM bid_packages WHERE id IN (bp_01, bp_02, bp_03);

INSERT INTO bid_packages (id, project_id, name, trade, scope_description, status, issue_date, due_date, pre_bid_meeting_date, pre_bid_meeting_location, created_by) VALUES
  (bp_01, v_project_id, 'EV Charging Station Installation', 'Electrical',
   'Provide and install 8 dual-port EV charging stations per City of Austin parking requirement update. Includes feeder routing from main service, conduit, and ChargePoint hardware.',
   'awarded', '2026-03-26', '2026-04-09', '2026-04-02', 'Jobsite Trailer A', u_gregorcyk),
  (bp_02, v_project_id, 'Site Signage Package',              'Signage',
   'Monument sign at main entry, building identification signs (3), wayfinding signs, ADA signage. Materials per architectural sign schedule.',
   'leveled', '2026-04-01', '2026-04-22', '2026-04-08', 'Jobsite Trailer A', u_gregorcyk),
  (bp_03, v_project_id, 'Final Cleaning Package',             'Cleaning',
   'Construction cleaning of 294 units, common areas, amenities. Final clean prior to TCO walks.',
   'issued', '2026-04-08', '2026-04-30', NULL, NULL, u_gregorcyk);

INSERT INTO bid_invitations (bid_package_id, subcontractor_name, company, contact_email, contact_phone, status, invited_at, viewed_at, submitted_at) VALUES
  (bp_01, 'Mason Stryker',     'ChargePoint Texas',          'mstryker@chargepoint.com',     '(512) 555-3010', 'submitted', '2026-03-26 09:00:00', '2026-03-27 14:00:00', '2026-04-08 16:00:00'),
  (bp_01, 'Greg Anderson',     'Capital Electrical',          'ganderson@capitalelectrical.com','(512) 555-2056', 'submitted', '2026-03-26 09:00:00', '2026-03-26 16:00:00', '2026-04-09 11:00:00'),
  (bp_01, 'Joel Ramirez',      'Cinco EV Solutions',          'jramirez@cincoev.com',         '(512) 555-3025', 'declined',  '2026-03-26 09:00:00', '2026-03-28 09:00:00', NULL),
  (bp_02, 'Allison Park',      'Texas Sign Studio',           'apark@texsign.com',            '(512) 555-3100', 'submitted', '2026-04-01 09:00:00', '2026-04-02 11:00:00', '2026-04-22 14:00:00'),
  (bp_02, 'Marco Adams',       'Lone Star Signage',           'madams@lonestarsignage.com',   '(512) 555-3115', 'submitted', '2026-04-01 09:00:00', '2026-04-02 13:00:00', '2026-04-22 11:00:00'),
  (bp_02, 'Pat Henning',       'Capitol Custom Signs',        'phenning@capitolcustomsigns.com','(512) 555-3128','viewed',    '2026-04-01 09:00:00', '2026-04-04 09:00:00', NULL),
  (bp_03, 'Rosa Martinez',     'Lone Star Final Clean',       'rmartinez@lonestarclean.com',  '(512) 555-3201', 'invited',   '2026-04-08 09:00:00', NULL,                  NULL),
  (bp_03, 'Tina Velasquez',    'Capitol Cleaning Services',   'tvelasquez@capitolclean.com',  '(512) 555-3215', 'invited',   '2026-04-08 09:00:00', NULL,                  NULL);

INSERT INTO bid_responses (bid_package_id, subcontractor_name, company, base_bid, schedule_days, bond_included, inclusions, exclusions, notes, ai_analysis) VALUES
  (bp_01, 'Mason Stryker',  'ChargePoint Texas',     158000, 35, true,  'ChargePoint CT4000 dual-port, conduit, install, commissioning, 1-yr warranty', 'Permits by GC. Concrete pads by GC.', 'Direct from manufacturer; full system + commissioning.', 'Lowest bid; full scope; manufacturer-direct; recommend award.'),
  (bp_01, 'Greg Anderson',  'Capital Electrical',    175000, 28, true,  'Equipment, conduit, install, commissioning, 90-day labor warranty.',            'Equipment warranty per manufacturer.', 'Existing site team; faster schedule.',                          'Mid bid; faster install; existing crew already mobilized.'),
  (bp_02, 'Allison Park',   'Texas Sign Studio',      48000, 21, true,  'Monument sign, 3 building IDs, 12 wayfinding, 18 ADA signs, install, permit.',  'Concrete footings by GC.',           'Strong portfolio in multifamily.',                              'Aligned with design intent. Fabrication QC strong.'),
  (bp_02, 'Marco Adams',    'Lone Star Signage',      52500, 18, true,  'Same scope as RFP. Plus illuminated monument upgrade.',                          'Concrete footings by GC.',           'Slightly higher bid but offers illumination upgrade.',          'Higher cost but adds value with illuminated monument.');

-- =========================================================================
-- 45. ESTIMATES + LINE ITEMS (precon historical context)
-- =========================================================================
DELETE FROM estimate_line_items WHERE estimate_id IN (est_01, est_02);
DELETE FROM estimates WHERE id IN (est_01, est_02);

INSERT INTO estimates (id, project_id, name, version, status, type, total_amount, markup_percent, overhead_percent, profit_percent, contingency_percent, due_date, submitted_date, notes, created_by) VALUES
  (est_01, v_project_id, 'GMP Estimate v3 (Construction Documents)', 3, 'awarded', 'construction_documents', 58400000, 8.5, 5, 4, 5, '2020-08-15', '2020-08-12', 'Final GMP submitted to owner. Awarded 8/28/2020.',         u_gregorcyk),
  (est_02, v_project_id, 'EV Charging Station CO Estimate',          1, 'awarded', 'change_order',              175000, 8.5, 5, 4, 0, '2026-04-05', '2026-04-04', 'Owner-driven scope addition per Austin parking update.', u_gregorcyk);

INSERT INTO estimate_line_items (estimate_id, csi_division, csi_code, description, unit, quantity, unit_cost, total_cost, sort_order) VALUES
  (est_01, '01', '01 00 00', 'General Conditions',                            'ls',    1,  4200000, 4200000, 1),
  (est_01, '03', '03 00 00', 'Concrete (podium and site)',                    'ls',    1,  5800000, 5800000, 2),
  (est_01, '04', '04 00 00', 'Masonry (stair towers)',                        'ls',    1,   850000,  850000, 3),
  (est_01, '05', '05 00 00', 'Metals',                                        'ls',    1,  1200000, 1200000, 4),
  (est_01, '06', '06 00 00', 'Wood framing and trusses',                      'ls',    1,  7800000, 7800000, 5),
  (est_01, '07', '07 00 00', 'Thermal and moisture',                          'ls',    1,  3400000, 3400000, 6),
  (est_01, '08', '08 00 00', 'Doors, windows, storefronts',                   'ls',    1,  4200000, 4200000, 7),
  (est_01, '09', '09 00 00', 'Finishes',                                      'ls',    1,  6800000, 6800000, 8),
  (est_01, '10', '10 00 00', 'Specialties',                                   'ls',    1,   720000,  720000, 9),
  (est_01, '11', '11 00 00', 'Equipment',                                     'ls',    1,   480000,  480000, 10),
  (est_01, '12', '12 00 00', 'Furnishings',                                   'ls',    1,  2200000, 2200000, 11),
  (est_01, '14', '14 00 00', 'Conveying equipment',                           'ls',    1,  1100000, 1100000, 12),
  (est_01, '21', '21 00 00', 'Fire protection',                               'ls',    1,  1200000, 1200000, 13),
  (est_01, '22', '22 00 00', 'Plumbing',                                      'ls',    1,  3800000, 3800000, 14),
  (est_01, '23', '23 00 00', 'HVAC',                                          'ls',    1,  3200000, 3200000, 15),
  (est_01, '26', '26 00 00', 'Electrical',                                    'ls',    1,  3600000, 3600000, 16),
  (est_01, '31', '31 00 00', 'Earthwork',                                     'ls',    1,  1100000, 1100000, 17),
  (est_01, '32', '32 00 00', 'Exterior improvements',                         'ls',    1,  1850000, 1850000, 18),
  (est_01, '33', '33 00 00', 'Utilities',                                     'ls',    1,   980000,  980000, 19),
  (est_02, '26', '26 27 19', 'EV charging stations and feeders',              'ea',    8,    19750,  158000, 1),
  (est_02, '01', '01 00 00', 'GC fee and overhead',                           'ls',    1,    17000,   17000, 2);

-- =========================================================================
-- 46. LIEN WAIVERS (parallel to pay applications)
-- =========================================================================
DELETE FROM lien_waivers WHERE project_id = v_project_id;
INSERT INTO lien_waivers (project_id, contractor_name, amount, status, waiver_state, through_date, signed_at, signed_by, notes) VALUES
  (v_project_id, 'Lone Star Framers',           430000, 'unconditional', 'texas',   '2026-03-31', '2026-04-15 14:30:00', 'Carlos Ramirez',  'Pay app #14 unconditional waiver upon payment'),
  (v_project_id, 'Capital Concrete Texas',       240000, 'unconditional', 'texas',   '2026-03-31', '2026-04-15 14:30:00', 'Brad Whitfield',  'Pay app #24 unconditional waiver upon payment'),
  (v_project_id, 'Lone Star MEP Services',       500000, 'conditional',   'texas',   '2026-03-31', '2026-04-05 10:30:00', 'Maria Delgado',   'Pay app #9 conditional waiver upon payment, awaiting funds'),
  (v_project_id, 'TAMKO Roofing Crew C',          80000, 'unconditional', 'texas',   '2026-03-31', '2026-04-16 13:00:00', 'Steve O''Brien',  'Pay app #6 unconditional waiver'),
  (v_project_id, 'Hill Country Finishers',       210000, 'conditional',   'texas',   '2026-03-31', '2026-04-04 12:00:00', 'Linda Park',      'Pay app #5 conditional, payment pending'),
  (v_project_id, 'Hardy Siding Contractors',      54000, 'unconditional', 'texas',   '2026-03-31', '2026-04-16 13:00:00', 'Jorge Mendoza',   'Pay app #8 unconditional waiver'),
  (v_project_id, 'Capital Plumbing Co.',         185000, 'conditional',   'texas',   '2026-02-28', '2026-03-15 10:00:00', 'Tom Reilly',      'Pay app #6 conditional');

-- =========================================================================
-- 47. WIKI PAGES (project knowledge base — when supported)
-- =========================================================================
IF to_regclass('public.wiki_pages') IS NOT NULL THEN
DELETE FROM wiki_pages WHERE project_id = v_project_id;
INSERT INTO wiki_pages (project_id, title, content, sort_order, created_by) VALUES
  (v_project_id, 'Project Overview',
   E'# Avery Oaks Apartments\n\n294-unit multifamily community in north Austin (78717). 5-over-1 wood/podium construction over Type V wood framing. Three buildings (A, B, C). $58.4M GMP.\n\n## Key Dates\n- Start: Sept 15, 2020\n- Target completion: Apr 30, 2027\n- Substantial completion target: Jul 25, 2026\n\n## Key Contacts\n- Owner: Lakeline Avery Partners (Kurt Goll)\n- Developer: JCI Residential (Sam Kumar)\n- GC: Journeyman (David Gregorcyk)\n- Architect: Cross Architects (Mark Leon)\n- Civil: Bleyl Engineering (Jason Rodgers)\n- Structural: RTP Structural (Trent Perkins)\n- MEP: MEP Systems Design (Mark Portnoy)\n- Landscape: Blu Fish Collaborative (Mike Fishbaugh)',
   1, u_gregorcyk),
  (v_project_id, 'Site Logistics',
   E'# Site Logistics\n\n## Access\n- Primary site entry: 9019 N Lake Creek Pkwy\n- Secondary entry (deliveries): SE corner gate\n\n## Trailer locations\n- Trailer A (GC, OAC): NW corner\n- Trailer B (subs, coordination): N edge\n\n## Yard layout\n- Bldg A material yard: NE\n- Bldg B material yard: SE\n- Bldg C material yard: SW (also truss staging)\n- Equipment yard: central, south of trailers\n\n## Parking\n- Worker parking: street, west of site\n- Visitor parking: trailer A loop',
   2, u_gregorcyk),
  (v_project_id, 'Safety Plan Summary',
   E'# Site-Specific Safety Plan (Rev 3)\n\n## Required PPE\n- Hard hat, safety glasses, hi-vis (after dawn), steel-toe boots, gloves\n- Cut-resistant gloves required for all rebar handling (mandated 3/26/2026)\n- Fall protection: 100% tie-off above 6 ft\n\n## Crane operations\n- Pre-pick inspection required\n- Wind threshold: 25 mph cease lifts\n- Spotter mandatory for all reverse maneuvers in pedestrian zones (added 3/27/2026)\n\n## Emergency\n- Site contact: David Gregorcyk (512) 247-7000\n- Hospital: St. David''s North Austin Medical Center, 12221 N MoPac\n- 911 for emergencies; site supervisor must be notified within 5 minutes',
   3, u_gregorcyk),
  (v_project_id, 'Quality Standards',
   E'# Quality Standards\n\n## Concrete\n- ACI 301 testing per spec; 4 cylinders per 100 CY pour\n- Slump tolerance: ±1 in\n- Air entrainment 5-7% for exterior pours\n\n## Wood framing\n- IRC 2021 + spec section 06 11 13\n- Stud spacing: 16 in O.C. all bearing walls\n- Hold-downs per S4 sheets\n\n## Drywall\n- Level 4 finish all units\n- Level 5 finish all common-area public spaces\n\n## Punch list standard\n- Walk every unit at substantial completion\n- All items closed within 30 days of TCO',
   4, u_gregorcyk),
  (v_project_id, 'Schedule Recovery Decisions',
   E'# Schedule Recovery Log\n\nTracks decisions made when schedule is at risk.\n\n## 2026-04-10 — Building A floor 5 framing pace\n- Pace 8% below plan, slipping 4 days on critical path\n- Decision: Authorize Saturday shift through 4/30 (cost +$28K, recovers 4 days)\n- Reassess 4/22 metrics\n- Decision authority: David Gregorcyk\n- Owner notified: Sam Kumar (4/9 OAC #19)',
   5, u_gregorcyk);
END IF;

-- =========================================================================
-- 48. DRAWING DISCREPANCIES (AI insights — when supported)
-- =========================================================================
IF to_regclass('public.drawing_discrepancies') IS NOT NULL THEN
DELETE FROM drawing_discrepancies WHERE project_id = v_project_id;
INSERT INTO drawing_discrepancies (project_id, description, arch_dimension, struct_dimension, severity, confidence, user_confirmed) VALUES
  (v_project_id, 'Type V wood framing transition at podium deck Building B — sole plate dimension mismatch', '4 ft 2 in',  '4 ft 0 in',  'high',   0.92, true),
  (v_project_id, 'Stair tower 3 holdown spacing vs embed plate spacing in podium deck',                       '24 in O.C.', '32 in O.C.', 'high',   0.88, true),
  (v_project_id, 'Plumbing wet stack alignment, units 215/315/415 — kitchen sink offset',                       'aligned',    '14 in offset','medium', 0.94, true),
  (v_project_id, 'Building entry threshold detail — bevel slope mismatch with ADA tolerance',                   '1/2 in',     '1/4 in',     'medium', 0.86, true),
  (v_project_id, 'Lobby curtain wall thermal performance — glazing spec mismatch',                              'double',     'triple',     'low',    0.81, false);
END IF;

RAISE NOTICE 'Avery Oaks Apartments seeded for wrbenner23@yahoo.com (project_id: %)', v_project_id;
RAISE NOTICE '8 consultants + 15 subcontractor contacts in directory.';
RAISE NOTICE '25 RFIs, 24 submittals, 35 punch items, 45 tasks, 18 daily logs, 10 crews, 10 change orders, 12 meetings, 12 schedule phases, 50+ activity events.';
RAISE NOTICE '15 drawings, 10 equipment, 12 photo pins, 8 safety inspections, 12 observations, 8 toolbox talks.';
RAISE NOTICE '3 incidents, 10 deliveries, 10 COIs, 6 contracts + 5 pay apps, 4 owner updates.';
RAISE NOTICE '28 weather records, 6 risk predictions, 15 closeout items, 5 permits + 10 inspections, 24 workforce members, 6 transmittals, 15 spec sections.';
RAISE NOTICE '24 SoV line items, 30 safety certs, 80 time entries, 8 sub invoices, 25 agenda items, 12 inventory, 3 bid pkgs + 8 invitations + 4 responses, 2 estimates + 21 line items, 7 lien waivers, 5 wiki pages, 5 drawing discrepancies.';

END $$;

-- Restore normal trigger firing for everything else in the database.
SET session_replication_role = origin;
