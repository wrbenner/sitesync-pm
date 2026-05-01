-- =============================================================================
-- SiteSync PM: Seed Data
-- Riverside Commercial Tower, Dallas TX, $52M
-- =============================================================================
-- This seed file populates the database with realistic construction project
-- data for development and testing purposes.
-- =============================================================================

-- Seed user UUIDs (these match test auth users)
-- In production, real auth.users UUIDs would be used
DO $$
DECLARE
  user_mike UUID := '11111111-1111-1111-1111-111111111111';
  user_jennifer UUID := '22222222-2222-2222-2222-222222222222';
  user_david UUID := '33333333-3333-3333-3333-333333333333';
  user_robert UUID := '44444444-4444-4444-4444-444444444444';
  user_lisa UUID := '55555555-5555-5555-5555-555555555555';
  user_karen UUID := '66666666-6666-6666-6666-666666666666';
  user_james UUID := '77777777-7777-7777-7777-777777777777';
  user_sarah UUID := '88888888-8888-8888-8888-888888888888';
  project_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  -- RFI IDs
  rfi_01 UUID := 'b0000001-0000-0000-0000-000000000001';
  rfi_02 UUID := 'b0000001-0000-0000-0000-000000000002';
  rfi_03 UUID := 'b0000001-0000-0000-0000-000000000003';
  rfi_04 UUID := 'b0000001-0000-0000-0000-000000000004';
  rfi_05 UUID := 'b0000001-0000-0000-0000-000000000005';
  rfi_06 UUID := 'b0000001-0000-0000-0000-000000000006';
  rfi_07 UUID := 'b0000001-0000-0000-0000-000000000007';
  rfi_08 UUID := 'b0000001-0000-0000-0000-000000000008';
  rfi_09 UUID := 'b0000001-0000-0000-0000-000000000009';
  rfi_10 UUID := 'b0000001-0000-0000-0000-000000000010';
  rfi_11 UUID := 'b0000001-0000-0000-0000-000000000011';
  rfi_12 UUID := 'b0000001-0000-0000-0000-000000000012';
  rfi_13 UUID := 'b0000001-0000-0000-0000-000000000013';
  rfi_14 UUID := 'b0000001-0000-0000-0000-000000000014';
  rfi_15 UUID := 'b0000001-0000-0000-0000-000000000015';

  -- Submittal IDs
  sub_01 UUID := 'c0000001-0000-0000-0000-000000000001';
  sub_02 UUID := 'c0000001-0000-0000-0000-000000000002';
  sub_03 UUID := 'c0000001-0000-0000-0000-000000000003';
  sub_04 UUID := 'c0000001-0000-0000-0000-000000000004';
  sub_05 UUID := 'c0000001-0000-0000-0000-000000000005';
  sub_06 UUID := 'c0000001-0000-0000-0000-000000000006';
  sub_07 UUID := 'c0000001-0000-0000-0000-000000000007';
  sub_08 UUID := 'c0000001-0000-0000-0000-000000000008';
  sub_09 UUID := 'c0000001-0000-0000-0000-000000000009';
  sub_10 UUID := 'c0000001-0000-0000-0000-000000000010';
  sub_11 UUID := 'c0000001-0000-0000-0000-000000000011';
  sub_12 UUID := 'c0000001-0000-0000-0000-000000000012';
  sub_13 UUID := 'c0000001-0000-0000-0000-000000000013';
  sub_14 UUID := 'c0000001-0000-0000-0000-000000000014';
  sub_15 UUID := 'c0000001-0000-0000-0000-000000000015';
  sub_16 UUID := 'c0000001-0000-0000-0000-000000000016';

  -- Daily log IDs
  dl_01 UUID := 'd0000001-0000-0000-0000-000000000001';
  dl_02 UUID := 'd0000001-0000-0000-0000-000000000002';
  dl_03 UUID := 'd0000001-0000-0000-0000-000000000003';
  dl_04 UUID := 'd0000001-0000-0000-0000-000000000004';
  dl_05 UUID := 'd0000001-0000-0000-0000-000000000005';
  dl_06 UUID := 'd0000001-0000-0000-0000-000000000006';
  dl_07 UUID := 'd0000001-0000-0000-0000-000000000007';
  dl_08 UUID := 'd0000001-0000-0000-0000-000000000008';
  dl_09 UUID := 'd0000001-0000-0000-0000-000000000009';
  dl_10 UUID := 'd0000001-0000-0000-0000-000000000010';

  -- Crew IDs
  crew_steel UUID := 'e0000001-0000-0000-0000-000000000001';
  crew_mep UUID := 'e0000001-0000-0000-0000-000000000002';
  crew_elec UUID := 'e0000001-0000-0000-0000-000000000003';
  crew_ext UUID := 'e0000001-0000-0000-0000-000000000004';
  crew_frame UUID := 'e0000001-0000-0000-0000-000000000005';
  crew_finish UUID := 'e0000001-0000-0000-0000-000000000006';

  -- Meeting IDs
  mtg_01 UUID := 'f0000001-0000-0000-0000-000000000001';
  mtg_02 UUID := 'f0000001-0000-0000-0000-000000000002';
  mtg_03 UUID := 'f0000001-0000-0000-0000-000000000003';
  mtg_04 UUID := 'f0000001-0000-0000-0000-000000000004';
  mtg_05 UUID := 'f0000001-0000-0000-0000-000000000005';
  mtg_06 UUID := 'f0000001-0000-0000-0000-000000000006';
  mtg_07 UUID := 'f0000001-0000-0000-0000-000000000007';
  mtg_08 UUID := 'f0000001-0000-0000-0000-000000000008';

  -- Drawing IDs
  dwg_01 UUID := 'a1000001-0000-0000-0000-000000000001';
  dwg_02 UUID := 'a1000001-0000-0000-0000-000000000002';
  dwg_03 UUID := 'a1000001-0000-0000-0000-000000000003';
  dwg_04 UUID := 'a1000001-0000-0000-0000-000000000004';
  dwg_05 UUID := 'a1000001-0000-0000-0000-000000000005';
  dwg_06 UUID := 'a1000001-0000-0000-0000-000000000006';
  dwg_07 UUID := 'a1000001-0000-0000-0000-000000000007';
  dwg_08 UUID := 'a1000001-0000-0000-0000-000000000008';
  dwg_09 UUID := 'a1000001-0000-0000-0000-000000000009';
  dwg_10 UUID := 'a1000001-0000-0000-0000-000000000010';
  dwg_11 UUID := 'a1000001-0000-0000-0000-000000000011';
  dwg_12 UUID := 'a1000001-0000-0000-0000-000000000012';

  -- Schedule phase IDs
  sp_01 UUID := 'a2000001-0000-0000-0000-000000000001';
  sp_02 UUID := 'a2000001-0000-0000-0000-000000000002';
  sp_03 UUID := 'a2000001-0000-0000-0000-000000000003';
  sp_04 UUID := 'a2000001-0000-0000-0000-000000000004';
  sp_05 UUID := 'a2000001-0000-0000-0000-000000000005';
  sp_06 UUID := 'a2000001-0000-0000-0000-000000000006';
  sp_07 UUID := 'a2000001-0000-0000-0000-000000000007';
  sp_08 UUID := 'a2000001-0000-0000-0000-000000000008';
  sp_09 UUID := 'a2000001-0000-0000-0000-000000000009';
  sp_10 UUID := 'a2000001-0000-0000-0000-000000000010';
  sp_11 UUID := 'a2000001-0000-0000-0000-000000000011';
  sp_12 UUID := 'a2000001-0000-0000-0000-000000000012';
  sp_13 UUID := 'a2000001-0000-0000-0000-000000000013';
  sp_14 UUID := 'a2000001-0000-0000-0000-000000000014';
  sp_15 UUID := 'a2000001-0000-0000-0000-000000000015';

BEGIN

-- =========================================================================
-- 0. TEST AUTH USERS (created via Supabase's own internal schema)
-- =========================================================================
-- We must match what GoTrue expects: proper instance_id, is_sso_user, etc.
-- The password hash below is a valid bcrypt hash for "Password123!"

-- bcrypt hash ($2a$ prefix required by GoTrue) for "Password123!"
-- raw_user_meta_data must include sub, email, email_verified, phone_verified
-- confirmation_token and similar fields must be '' not NULL

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  is_sso_user, is_anonymous
)
VALUES
  (user_mike,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mike.chen@turnergc.com',
   '$2a$10$zd4L4pEffpYxkvfOqqErZeZts4hQcsb9OMrUYGC/ia5sbr.D4lK3O', now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('sub', '11111111-1111-1111-1111-111111111111', 'email', 'mike.chen@turnergc.com', 'full_name', 'Mike Chen', 'email_verified', true, 'phone_verified', false),
   '', '', '', '', false, false),
  (user_jennifer, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jennifer.walsh@turnergc.com',
   '$2a$10$zd4L4pEffpYxkvfOqqErZeZts4hQcsb9OMrUYGC/ia5sbr.D4lK3O', now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('sub', '22222222-2222-2222-2222-222222222222', 'email', 'jennifer.walsh@turnergc.com', 'full_name', 'Jennifer Walsh', 'email_verified', true, 'phone_verified', false),
   '', '', '', '', false, false),
  (user_david,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'david.park@turnergc.com',
   '$2a$10$zd4L4pEffpYxkvfOqqErZeZts4hQcsb9OMrUYGC/ia5sbr.D4lK3O', now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('sub', '33333333-3333-3333-3333-333333333333', 'email', 'david.park@turnergc.com', 'full_name', 'David Park', 'email_verified', true, 'phone_verified', false),
   '', '', '', '', false, false),
  (user_robert,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'robert.martinez@turnergc.com',
   '$2a$10$zd4L4pEffpYxkvfOqqErZeZts4hQcsb9OMrUYGC/ia5sbr.D4lK3O', now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('sub', '44444444-4444-4444-4444-444444444444', 'email', 'robert.martinez@turnergc.com', 'full_name', 'Robert Martinez', 'email_verified', true, 'phone_verified', false),
   '', '', '', '', false, false),
  (user_lisa,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lisa.thompson@turnergc.com',
   '$2a$10$zd4L4pEffpYxkvfOqqErZeZts4hQcsb9OMrUYGC/ia5sbr.D4lK3O', now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('sub', '55555555-5555-5555-5555-555555555555', 'email', 'lisa.thompson@turnergc.com', 'full_name', 'Lisa Thompson', 'email_verified', true, 'phone_verified', false),
   '', '', '', '', false, false),
  (user_karen,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'karen.rodriguez@turnergc.com',
   '$2a$10$zd4L4pEffpYxkvfOqqErZeZts4hQcsb9OMrUYGC/ia5sbr.D4lK3O', now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('sub', '66666666-6666-6666-6666-666666666666', 'email', 'karen.rodriguez@turnergc.com', 'full_name', 'Karen Rodriguez', 'email_verified', true, 'phone_verified', false),
   '', '', '', '', false, false),
  (user_james,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'james.wilson@turnergc.com',
   '$2a$10$zd4L4pEffpYxkvfOqqErZeZts4hQcsb9OMrUYGC/ia5sbr.D4lK3O', now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('sub', '77777777-7777-7777-7777-777777777777', 'email', 'james.wilson@turnergc.com', 'full_name', 'James Wilson', 'email_verified', true, 'phone_verified', false),
   '', '', '', '', false, false),
  (user_sarah,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sarah.kim@turnergc.com',
   '$2a$10$zd4L4pEffpYxkvfOqqErZeZts4hQcsb9OMrUYGC/ia5sbr.D4lK3O', now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('sub', '88888888-8888-8888-8888-888888888888', 'email', 'sarah.kim@turnergc.com', 'full_name', 'Sarah Kim', 'email_verified', true, 'phone_verified', false),
   '', '', '', '', false, false);

-- GoTrue requires an identity row per user for password sign-in
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES
  (gen_random_uuid(), user_mike,     jsonb_build_object('sub', user_mike::text,     'email', 'mike.chen@turnergc.com',       'email_verified', true, 'phone_verified', false), 'email', user_mike::text,     now(), now(), now()),
  (gen_random_uuid(), user_jennifer, jsonb_build_object('sub', user_jennifer::text, 'email', 'jennifer.walsh@turnergc.com',  'email_verified', true, 'phone_verified', false), 'email', user_jennifer::text, now(), now(), now()),
  (gen_random_uuid(), user_david,    jsonb_build_object('sub', user_david::text,    'email', 'david.park@turnergc.com',      'email_verified', true, 'phone_verified', false), 'email', user_david::text,    now(), now(), now()),
  (gen_random_uuid(), user_robert,   jsonb_build_object('sub', user_robert::text,   'email', 'robert.martinez@turnergc.com', 'email_verified', true, 'phone_verified', false), 'email', user_robert::text,   now(), now(), now()),
  (gen_random_uuid(), user_lisa,     jsonb_build_object('sub', user_lisa::text,     'email', 'lisa.thompson@turnergc.com',   'email_verified', true, 'phone_verified', false), 'email', user_lisa::text,     now(), now(), now()),
  (gen_random_uuid(), user_karen,    jsonb_build_object('sub', user_karen::text,    'email', 'karen.rodriguez@turnergc.com', 'email_verified', true, 'phone_verified', false), 'email', user_karen::text,    now(), now(), now()),
  (gen_random_uuid(), user_james,    jsonb_build_object('sub', user_james::text,    'email', 'james.wilson@turnergc.com',    'email_verified', true, 'phone_verified', false), 'email', user_james::text,    now(), now(), now()),
  (gen_random_uuid(), user_sarah,    jsonb_build_object('sub', user_sarah::text,    'email', 'sarah.kim@turnergc.com',       'email_verified', true, 'phone_verified', false), 'email', user_sarah::text,    now(), now(), now());

-- =========================================================================
-- 1. PROJECT
-- =========================================================================

INSERT INTO projects (id, name, address, city, state, zip, owner_id, general_contractor, contract_value, start_date, target_completion, status)
VALUES (
  project_id,
  'Riverside Commercial Tower',
  '2400 Commerce Street',
  'Dallas',
  'TX',
  '75201',
  user_mike,
  'Turner & Associates General Contractors',
  52000000.00,
  '2024-01-15',
  '2027-03-31',
  'active'
);

-- Iris "Ground in the world" jurisdiction tag. Skipped silently if the
-- column does not exist on this database (migration may not be applied
-- yet on older targets).
IF EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'projects' AND column_name = 'jurisdiction'
) THEN
  UPDATE projects SET jurisdiction = 'Dallas, TX' WHERE id = project_id;
END IF;

-- =========================================================================
-- 2. PROJECT MEMBERS (8)
-- =========================================================================

INSERT INTO project_members (project_id, user_id, role, company, trade, invited_at, accepted_at) VALUES
  (project_id, user_mike,     'owner',  'Turner & Associates GC',       'General Contractor', '2024-01-10', '2024-01-10'),
  (project_id, user_jennifer, 'admin',  'Turner & Associates GC',       'Project Management', '2024-01-10', '2024-01-11'),
  (project_id, user_david,    'subcontractor', 'Lone Star Structural Steel',   'Structural Steel',   '2024-01-12', '2024-01-13'),
  (project_id, user_robert,   'subcontractor', 'DFW Mechanical Services',      'HVAC/Mechanical',    '2024-01-12', '2024-01-14'),
  (project_id, user_lisa,     'subcontractor', 'Apex Electrical Contractors',   'Electrical',         '2024-01-15', '2024-01-16'),
  (project_id, user_karen,    'admin',  'Whitman Graves Architects',     'Architecture',       '2024-01-10', '2024-01-11'),
  (project_id, user_james,    'subcontractor', 'Precision Concrete Works',      'Concrete',           '2024-01-15', '2024-01-17'),
  (project_id, user_sarah,    'viewer', 'Riverside Development Group',   'Owner Representative', '2024-01-10', '2024-01-12');

-- =========================================================================
-- 3. RFIs (15)
-- =========================================================================

INSERT INTO rfis (id, project_id, title, description, priority, status, created_by, assigned_to, ball_in_court, drawing_reference, due_date, closed_date, created_at) VALUES
  (rfi_01, project_id,
   'Steel connection detail at grid line J7',
   'The structural drawings show a moment connection at grid J7, Level 12, but the steel fabricator notes a conflict with the adjacent brace frame. Please clarify the intended connection type and provide revised detail.',
   'critical', 'open', user_david, user_karen, user_karen,
   'S301', '2026-04-01', NULL, '2026-03-20 09:15:00'),

  (rfi_02, project_id,
   'HVAC ductwork routing through structural transfer beam at Level 8',
   'Mechanical drawings indicate a 24x18 duct running through the transfer beam zone at Level 8 between grids C and D. Structural drawings do not show any penetrations in this beam. Requesting coordination and approval for reroute or penetration allowance.',
   'critical', 'under_review', user_robert, user_karen, user_karen,
   'M401, S201', '2026-03-30', NULL, '2026-03-15 14:30:00'),

  (rfi_03, project_id,
   'Lobby floor finish transition detail',
   'Architectural plans call for a transition from polished concrete to porcelain tile at the main lobby entrance, but no transition strip detail is provided. Please confirm the preferred transition method and material spec.',
   'medium', 'answered', user_jennifer, user_karen, user_jennifer,
   'A105', '2026-03-20', NULL, '2026-03-05 10:00:00'),

  (rfi_04, project_id,
   'Exterior curtain wall anchor spacing at Level 14 setback',
   'The curtain wall shop drawings show anchor spacing at 4 feet on center, but the setback at Level 14 creates an irregular condition. Requesting clarification on anchor layout for the angled facade section.',
   'high', 'open', user_david, user_karen, user_karen,
   'A401, S105', '2026-04-05', NULL, '2026-03-22 11:45:00'),

  (rfi_05, project_id,
   'Fire rated shaft wall assembly at elevator lobby',
   'Specification Section 09 21 16 calls for a 2 hour rated shaft wall, but the UL assembly referenced (UL U465) requires minimum 6 inch studs. Current framing layout shows 3 5/8 inch studs. Please advise on assembly modification.',
   'high', 'under_review', user_james, user_karen, user_karen,
   'A301', '2026-04-02', NULL, '2026-03-18 08:20:00'),

  (rfi_06, project_id,
   'Electrical panel clearance in mechanical room 305',
   'Panel HP 3A is shown 18 inches from the chilled water pipe on the as built condition. NEC requires 36 inch clearance in front of the panel. Requesting relocation guidance for either the panel or the piping.',
   'high', 'open', user_lisa, user_robert, user_robert,
   'E201, M301', '2026-04-03', NULL, '2026-03-24 13:10:00'),

  (rfi_07, project_id,
   'Concrete mix design for Level 15 through 18 elevated slabs',
   'The structural notes specify 6000 PSI concrete for elevated slabs above Level 14, but the batch plant has proposed a fly ash mix. Requesting approval of the alternate mix design with supporting test data.',
   'medium', 'answered', user_james, user_david, user_james,
   'S001', '2026-03-18', NULL, '2026-03-01 07:30:00'),

  (rfi_08, project_id,
   'Roof drain location conflict with structural framing',
   'Two roof drains shown on plumbing drawings conflict with W14x90 beams at the roof level. Please confirm if drains can be shifted 30 inches east or if beam penetrations are acceptable.',
   'medium', 'open', user_robert, user_karen, user_karen,
   'P501, S101', '2026-04-08', NULL, '2026-03-25 15:00:00'),

  (rfi_09, project_id,
   'Door hardware specification for stairwell doors',
   'Spec Section 08 71 00 references Von Duprin 99 series exit devices for stairwell doors, but the door schedule shows a Von Duprin 22 series. Please confirm which series is correct for the 14 stairwell doors.',
   'low', 'closed', user_jennifer, user_karen, user_jennifer,
   'A801', '2026-03-10', '2026-03-12', '2026-02-25 09:45:00'),

  (rfi_10, project_id,
   'Waterproofing membrane extent at below grade walls',
   'Waterproofing drawings terminate the membrane at 6 inches above finished grade on the south elevation, but the civil drawings show the grade 18 inches higher at that location. Please clarify the required membrane termination height.',
   'high', 'closed', user_james, user_karen, user_james,
   'A002, C101', '2026-02-28', '2026-03-05', '2026-02-15 10:30:00'),

  (rfi_11, project_id,
   'Sprinkler head layout in Level 10 open office area',
   'Fire protection plans show standard spray heads at 130 sq ft coverage, but the ceiling height in this zone is 14 feet which may require extended coverage heads per NFPA 13. Requesting design confirmation.',
   'medium', 'under_review', user_robert, user_karen, user_karen,
   'FP201', '2026-04-04', NULL, '2026-03-21 11:00:00'),

  (rfi_12, project_id,
   'Landscape irrigation tie in point',
   'Civil site plans show the irrigation connection at the southeast corner of the building, but the water meter is located on the northwest side. Requesting clarification on the intended routing path for the irrigation main.',
   'low', 'open', user_jennifer, user_karen, user_karen,
   'L101, C201', '2026-04-15', NULL, '2026-03-26 14:20:00'),

  (rfi_13, project_id,
   'Interior partition type at conference rooms Level 6',
   'The finish schedule on A601 shows STC 55 rated partitions for conference rooms, but the wall type legend references a standard gypsum partition (STC 38). Which assembly should be used for the 8 conference rooms on Level 6?',
   'medium', 'answered', user_jennifer, user_karen, user_jennifer,
   'A601', '2026-03-15', NULL, '2026-03-02 16:00:00'),

  (rfi_14, project_id,
   'Loading dock overhead coiling door size discrepancy',
   'Architectural plans show a 12 foot wide by 14 foot high opening for the loading dock door, but the structural opening is framed at 14 foot wide by 16 foot high. Please confirm the correct opening size.',
   'medium', 'closed', user_david, user_karen, user_david,
   'A102, S103', '2026-03-08', '2026-03-11', '2026-02-20 08:00:00'),

  (rfi_15, project_id,
   'Generator exhaust routing and louver placement',
   'The mechanical plans show the generator exhaust terminating at the east wall, but this conflicts with the fresh air intake louver location. Minimum 15 foot separation required per code. Requesting revised louver placement.',
   'high', 'open', user_robert, user_karen, user_karen,
   'M501, A201', '2026-04-06', NULL, '2026-03-27 10:30:00');

-- Iris "Ground in the world" code citations. Same idempotent column-existence
-- guard pattern as the projects.jurisdiction update above.
IF EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'rfis' AND column_name = 'applicable_codes'
) THEN
  -- rfi_05: Fire rated shaft wall assembly at elevator lobby
  UPDATE rfis SET applicable_codes = ARRAY['IBC 706.2', 'NFPA 285']
   WHERE id = rfi_05;
  -- rfi_11: Sprinkler head layout in Level 10 open office area (NFPA 13 grounded)
  UPDATE rfis SET applicable_codes = ARRAY['NFPA 13 § 8.6', 'IBC 903.3.1.1']
   WHERE id = rfi_11;
END IF;

-- =========================================================================
-- 4. RFI RESPONSES (5)
-- =========================================================================

INSERT INTO rfi_responses (rfi_id, author_id, content, attachments, created_at) VALUES
  (rfi_03, user_karen,
   'Use Schluter RENO T transition profile in brushed stainless steel, 5/16 inch height. Install per manufacturer detail. See attached sketch for the lobby threshold condition. Tile side gets set first, then the profile, then pour and polish the concrete to meet the profile edge.',
   '[{"name": "SK_A105_lobby_transition.pdf", "size": 245000}]',
   '2026-03-12 14:00:00'),

  (rfi_07, user_david,
   'The fly ash mix is acceptable provided the substitution rate does not exceed 25% by weight and 56 day break tests meet or exceed the specified 6000 PSI. Contractor shall submit certified test results from an independent lab before proceeding to Level 15 pours.',
   '[]',
   '2026-03-10 09:30:00'),

  (rfi_09, user_karen,
   'The door schedule is correct. Use Von Duprin 22 series exit devices for all stairwell doors. The specification section contained a typographical error and will be corrected in Addendum 4. The 22 series meets all code requirements for this application.',
   '[]',
   '2026-03-08 11:15:00'),

  (rfi_10, user_karen,
   'Extend the waterproofing membrane to 24 inches above the highest anticipated finished grade at any point along the south elevation. This accounts for the grade variation shown on the civil drawings. Membrane shall lap onto the foundation wall a minimum of 12 inches above grade. Revised detail SK A002.1 is attached.',
   '[{"name": "SK_A002_1_waterproofing_detail.pdf", "size": 380000}]',
   '2026-03-01 10:00:00'),

  (rfi_13, user_karen,
   'All conference rooms on Level 6 shall receive the STC 55 rated partition assembly. Use the detail on A601 note 7 which shows double layer 5/8 inch gypsum board on resilient channel with batt insulation. The wall type legend will be corrected in the next revision.',
   '[]',
   '2026-03-08 15:30:00');

-- =========================================================================
-- 5. SUBMITTALS (16)
-- =========================================================================

INSERT INTO submittals (id, project_id, title, spec_section, subcontractor, status, revision_number, lead_time_weeks, submitted_date, due_date, approved_date, created_by, assigned_to, created_at) VALUES
  (sub_01, project_id, 'Structural Steel Shop Drawings, Levels 12 through 18',       '05 12 00', 'Lone Star Structural Steel',      'approved',      2, 12, '2025-11-15', '2025-12-15', '2026-01-05', user_david, user_karen, '2025-11-15'),
  (sub_02, project_id, 'Rooftop AHU Units (4 units)',                                 '23 73 00', 'DFW Mechanical Services',          'approved',      1,  8, '2025-12-01', '2025-12-20', '2025-12-18', user_robert, user_karen, '2025-12-01'),
  (sub_03, project_id, 'Curtain Wall System, South and East Elevations',              '08 44 00', 'Premier Glass and Glazing',        'under_review',  1, 14, '2026-03-01', '2026-03-28', NULL, user_david, user_karen, '2026-03-01'),
  (sub_04, project_id, 'Door Hardware Allowance Package',                              '08 71 00', 'Commercial Door Solutions',         'approved',      1,  6, '2025-10-10', '2025-11-01', '2025-10-28', user_jennifer, user_karen, '2025-10-10'),
  (sub_05, project_id, 'VAV Box and Controls, Floors 6 through 14',                   '23 36 00', 'DFW Mechanical Services',          'under_review',  1, 10, '2026-03-10', '2026-04-05', NULL, user_robert, user_karen, '2026-03-10'),
  (sub_06, project_id, 'Elevator Cab Finish and Equipment',                            '14 21 00', 'ThyssenKrupp Elevator',            'pending',       1, 16, NULL, '2026-04-15', NULL, user_jennifer, user_karen, '2026-03-20'),
  (sub_07, project_id, 'Fire Alarm Control Panel and Devices',                         '28 31 00', 'Apex Electrical Contractors',      'approved',      1,  8, '2025-12-15', '2026-01-10', '2026-01-08', user_lisa, user_karen, '2025-12-15'),
  (sub_08, project_id, 'Concrete Mix Designs (6000 PSI elevated, 4000 PSI SOG)',       '03 30 00', 'Precision Concrete Works',         'approved',      3,  4, '2025-06-01', '2025-06-20', '2025-07-10', user_james, user_karen, '2025-06-01'),
  (sub_09, project_id, 'Spray Applied Fireproofing',                                   '07 81 00', 'Fireproofing Specialists Inc.',    'approved',      1,  6, '2025-09-15', '2025-10-10', '2025-10-05', user_david, user_karen, '2025-09-15'),
  (sub_10, project_id, 'Standing Seam Metal Roof System',                              '07 41 00', 'Southwest Roofing Partners',       'resubmit',      2,  8, '2026-02-15', '2026-03-15', NULL, user_david, user_karen, '2026-02-15'),
  (sub_11, project_id, 'Emergency Generator, 2000kW Diesel',                           '26 32 00', 'Apex Electrical Contractors',      'approved',      1, 20, '2025-05-01', '2025-06-01', '2025-05-28', user_lisa, user_karen, '2025-05-01'),
  (sub_12, project_id, 'Interior Stone Cladding, Lobby and Elevator Lobbies',          '09 30 00', 'Dallas Stone Works',               'under_review',  1, 10, '2026-03-05', '2026-04-01', NULL, user_jennifer, user_karen, '2026-03-05'),
  (sub_13, project_id, 'Plumbing Fixtures and Trim',                                   '22 40 00', 'DFW Mechanical Services',          'pending',       1,  8, NULL, '2026-04-20', NULL, user_robert, user_karen, '2026-03-22'),
  (sub_14, project_id, 'Acoustic Ceiling Tile System',                                 '09 51 00', 'Southwest Interior Systems',       'approved',      1,  4, '2026-01-20', '2026-02-15', '2026-02-10', user_jennifer, user_karen, '2026-01-20'),
  (sub_15, project_id, 'Waterproofing Membrane, Below Grade',                          '07 11 00', 'Weatherguard Coatings LLC',        'approved',      1,  6, '2025-03-01', '2025-03-20', '2025-03-18', user_james, user_karen, '2025-03-01'),
  (sub_16, project_id, 'Switchgear and Main Distribution Panel',                       '26 24 00', 'Apex Electrical Contractors',      'rejected',      1, 16, '2026-01-10', '2026-02-10', NULL, user_lisa, user_karen, '2026-01-10');

-- =========================================================================
-- 6. SUBMITTAL APPROVALS (8)
-- =========================================================================

INSERT INTO submittal_approvals (submittal_id, approver_id, role, status, comments, reviewed_at) VALUES
  (sub_01, user_karen, 'Architect',          'approved', 'Approved as noted. Verify connection details at grid J7 per supplemental sketch SK S301.1.', '2026-01-05 10:00:00'),
  (sub_01, user_david, 'Structural Engineer', 'approved', 'Connection geometry confirmed. Proceed with fabrication.', '2026-01-03 14:00:00'),
  (sub_02, user_karen, 'Architect',          'approved', 'Equipment selections are acceptable. Confirm roof curb dimensions before delivery.', '2025-12-18 09:00:00'),
  (sub_04, user_karen, 'Architect',          'approved', 'Hardware groups and finishes match the specification. Approved for procurement.', '2025-10-28 11:30:00'),
  (sub_07, user_karen, 'Architect',          'approved', 'System meets specification requirements. Verify device placement with ceiling reflected plans.', '2026-01-08 16:00:00'),
  (sub_08, user_karen, 'Architect',          'approved', 'Third revision accepted. Fly ash content at 20% is within acceptable range. Proceed with batching.', '2025-07-10 08:30:00'),
  (sub_09, user_david, 'Structural Engineer', 'approved', 'Thickness and density meet UL assembly requirements. Approved for application on steel framing.', '2025-10-05 13:00:00'),
  (sub_16, user_karen, 'Architect',          'rejected', 'Switchgear dimensions exceed the allocated space in electrical room 102. Resubmit with a compact configuration or propose room modifications.', '2026-02-08 10:00:00');

-- =========================================================================
-- 7. PUNCH ITEMS (20)
-- =========================================================================

INSERT INTO punch_items (project_id, title, description, location, floor, area, trade, priority, status, assigned_to, reported_by, due_date, resolved_date, verified_date, photos, created_at) VALUES
  (project_id, 'Paint touch up at column C4',                  'Scuff marks and roller lines visible on finished column wrap. Needs full repaint of the exposed faces.',          'Grid C4',            'Level 6',  'Open Office',      'Painting',     'low',      'open',        user_jennifer, user_karen, '2026-04-05', NULL, NULL, '[]', '2026-03-20'),
  (project_id, 'Ceiling grid misalignment at corridor 8B',     'Ceiling grid is 3/4 inch off from the wall angle along the south side of corridor 8B. Visible gap at perimeter.', 'Corridor 8B',        'Level 8',  'Corridor',         'Ceiling',      'medium',   'open',        user_jennifer, user_karen, '2026-04-03', NULL, NULL, '[]', '2026-03-18'),
  (project_id, 'Door closer adjustment, stairwell D',          'Stairwell D door on Level 10 does not latch properly. Door closer needs adjustment to increase closing force.',   'Stairwell D',        'Level 10', 'Stairwell',        'Door Hardware', 'high',    'in_progress', user_jennifer, user_jennifer, '2026-03-30', NULL, NULL, '[]', '2026-03-15'),
  (project_id, 'Light fixture alignment in conference room',    'Two 2x4 troffer fixtures in conference room 612 are visibly crooked in the ceiling grid. Straighten and re secure.','Room 612',          'Level 6',  'Conference Room',  'Electrical',   'medium',   'open',        user_lisa, user_karen, '2026-04-05', NULL, NULL, '[]', '2026-03-22'),
  (project_id, 'Base cove separation at elevator lobby',       'Rubber base cove is pulling away from the wall at two locations in the Level 7 elevator lobby. Adhesive failure.',  'Elevator Lobby',    'Level 7',  'Elevator Lobby',   'Flooring',     'low',      'resolved',    user_jennifer, user_karen, '2026-03-20', '2026-03-19', NULL, '[]', '2026-03-10'),
  (project_id, 'HVAC diffuser not connected to duct',          'Supply air diffuser in room 805 is installed but not connected to the main trunk duct above. No airflow at register.','Room 805',         'Level 8',  'Office',           'HVAC',         'critical', 'open',        user_robert, user_jennifer, '2026-03-29', NULL, NULL, '[]', '2026-03-24'),
  (project_id, 'Cracked floor tile at building entrance',      'Hairline crack in the 24x24 porcelain tile at the main entrance, approximately 3 feet from the revolving door.',  'Main Entrance',      'Level 1',  'Lobby',            'Tile',         'high',     'open',        user_jennifer, user_sarah, '2026-04-01', NULL, NULL, '[]', '2026-03-23'),
  (project_id, 'Fire caulk missing at pipe penetration',       'Firestopping sealant not applied around the 4 inch chilled water pipe penetration through the rated wall at Level 9.','Mechanical Room',  'Level 9',  'Mechanical',       'Firestopping', 'critical', 'in_progress', user_robert, user_jennifer, '2026-03-28', NULL, NULL, '[]', '2026-03-20'),
  (project_id, 'Restroom partition anchor loose',              'The wall mounted restroom partition in men room 504 has a loose upper anchor. Partition wobbles when door is used.','Restroom 504',       'Level 5',  'Restroom',         'Specialties',  'medium',   'resolved',    user_jennifer, user_karen, '2026-03-22', '2026-03-21', NULL, '[]', '2026-03-12'),
  (project_id, 'Exposed conduit not painted in parking garage','EMT conduit runs in parking Level P2 are not painted to match the ceiling. Spec requires gray paint on all exposed conduit.','Parking P2',     'Level P2', 'Parking',          'Electrical',   'low',      'open',        user_lisa, user_jennifer, '2026-04-10', NULL, NULL, '[]', '2026-03-25'),
  (project_id, 'Window sealant gap at Level 12 south',        'Visible gap in the exterior sealant joint at the curtain wall mullion on Level 12, south elevation, grid F3.',      'Grid F3 South',     'Level 12', 'Exterior',         'Glazing',      'high',     'open',        user_david, user_karen, '2026-04-02', NULL, NULL, '[]', '2026-03-21'),
  (project_id, 'Sprinkler head paint overspray',              'Six sprinkler heads in the Level 6 open office area have been painted over during ceiling finish work. Heads need replacement per NFPA.',  'Open Office', 'Level 6', 'Open Office', 'Fire Protection', 'high', 'in_progress', user_robert, user_jennifer, '2026-03-31', NULL, NULL, '[]', '2026-03-19'),
  (project_id, 'Elevator cab scratch on stainless panel',      'A 6 inch scratch on the stainless steel elevator cab interior panel in Elevator 2. Needs polishing or panel replacement.',  'Elevator 2',  'All',      'Elevator',         'Elevator',     'medium',   'open',        user_jennifer, user_sarah, '2026-04-08', NULL, NULL, '[]', '2026-03-26'),
  (project_id, 'GWB joint cracking at Level 11 corridor',     'Visible drywall joint crack running approximately 8 feet along the corridor wall on Level 11. Likely settling movement.', 'Corridor',    'Level 11', 'Corridor',         'Drywall',      'medium',   'open',        user_jennifer, user_karen, '2026-04-05', NULL, NULL, '[]', '2026-03-22'),
  (project_id, 'Handrail height noncompliant at ramp',        'Interior accessibility ramp handrail at Level 1 measures 36 inches. ADA requires 34 inches maximum. Needs adjustment.',  'Lobby Ramp',  'Level 1',  'Lobby',            'Metals',       'critical', 'open',        user_david, user_karen, '2026-03-30', NULL, NULL, '[]', '2026-03-18'),
  (project_id, 'Stained ceiling tile in break room',          'Water stain on two ceiling tiles in the Level 5 break room, likely from condensation on the chilled water line above.',  'Break Room',  'Level 5',  'Break Room',       'Ceiling',      'medium',   'resolved',    user_jennifer, user_jennifer, '2026-03-25', '2026-03-24', NULL, '[]', '2026-03-14'),
  (project_id, 'Electrical outlet cover plate missing',        'Four duplex outlet cover plates missing along the east wall of room 710. Rough boxes are exposed.',                   'Room 710',    'Level 7',  'Office',           'Electrical',   'low',      'verified',    user_lisa, user_jennifer, '2026-03-18', '2026-03-16', '2026-03-17', '[]', '2026-03-08'),
  (project_id, 'Grout color mismatch in restroom tile',       'Floor tile grout in women restroom 803 is noticeably lighter than the specified charcoal color. Appears to be the wrong batch.','Restroom 803','Level 8', 'Restroom',        'Tile',         'medium',   'open',        user_jennifer, user_karen, '2026-04-05', NULL, NULL, '[]', '2026-03-23'),
  (project_id, 'Roof drain strainer missing',                  'Roof drain at the southeast corner is missing the cast iron strainer dome. Drain is open and collecting debris.',    'SE Corner Roof', 'Roof',  'Roof',             'Plumbing',     'high',     'in_progress', user_robert, user_jennifer, '2026-03-29', NULL, NULL, '[]', '2026-03-20'),
  (project_id, 'Damaged stone panel at lobby wall',            'Natural stone panel on the north lobby feature wall has a chipped corner, approximately 2 inches by 3 inches. Needs replacement panel.','North Wall','Level 1','Lobby',       'Stone',        'medium',   'open',        user_jennifer, user_sarah, '2026-04-10', NULL, NULL, '[]', '2026-03-27');

-- =========================================================================
-- 8. TASKS (30)
-- =========================================================================

INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date, is_critical_path, sort_order, created_at) VALUES
  (project_id, 'Complete structural steel erection Level 16 through 18',            'Final steel erection for upper tower floors. Includes moment frames and braced frames at core.',                     'in_progress', 'critical', user_david,    '2026-04-15', true,  1,  '2026-02-01'),
  (project_id, 'Pour elevated slab Level 15',                                       'Place 6000 PSI concrete for the Level 15 elevated slab. Pre pour inspection required 24 hours before placement.',    'in_progress', 'high',     user_james,    '2026-04-01', true,  2,  '2026-03-01'),
  (project_id, 'Install curtain wall south elevation Levels 8 through 12',          'Begin curtain wall panel installation on the south face. Panels staged on Level 7 loading area.',                    'in_progress', 'high',     user_david,    '2026-04-20', true,  3,  '2026-03-10'),
  (project_id, 'Rough in HVAC ductwork Level 10',                                   'Main trunk and branch duct installation for Level 10 tenant spaces. Coordinate with sprinkler routing above ceiling.','in_progress', 'high',     user_robert,   '2026-03-31', false, 4,  '2026-03-05'),
  (project_id, 'Pull electrical feeders to Level 12 distribution',                   'Run primary feeders from main switchgear to the Level 12 electrical room. Includes fire rated conduit in shaft.',    'todo',        'high',     user_lisa,     '2026-04-10', false, 5,  '2026-03-15'),
  (project_id, 'Install fire sprinkler mains Level 9',                               'Main and cross main installation for Level 9. Branchlines to follow once ceiling grid layout is confirmed.',        'done',        'medium',   user_robert,   '2026-03-15', false, 6,  '2026-02-15'),
  (project_id, 'Frame interior partitions Level 6',                                  'Metal stud framing for all interior partitions on Level 6 per architectural plans. Include backing for casework.',    'done',        'medium',   user_jennifer, '2026-03-10', false, 7,  '2026-02-01'),
  (project_id, 'Hang and finish drywall Level 5',                                    'Board hanging, taping, and finishing for Level 5 office and corridor areas. Level 4 sanding to follow.',              'done',        'medium',   user_jennifer, '2026-03-18', false, 8,  '2026-02-10'),
  (project_id, 'Install elevator guide rails Cab 1 and 2',                           'Set guide rails and brackets for both passenger elevators in the east core shaft.',                                  'in_progress', 'high',     user_jennifer, '2026-04-05', true,  9,  '2026-03-01'),
  (project_id, 'Waterproof plaza deck Level 2',                                      'Apply hot rubberized asphalt membrane to the Level 2 plaza deck. Protection board and drainage mat to follow.',      'todo',        'high',     user_james,    '2026-04-12', false, 10, '2026-03-20'),
  (project_id, 'Install rooftop mechanical equipment',                               'Set AHU units, cooling tower, and associated pumps on the mechanical penthouse. Crane pick scheduled for April 8.',  'todo',        'critical', user_robert,   '2026-04-08', true,  11, '2026-03-15'),
  (project_id, 'Complete fireproofing Levels 12 through 14',                         'Spray applied fireproofing on all structural steel members for Levels 12, 13, and 14.',                              'in_progress', 'high',     user_david,    '2026-04-02', false, 12, '2026-03-10'),
  (project_id, 'Rough in plumbing risers Levels 10 through 14',                      'Install domestic water, waste, and vent risers through the core from Level 10 to Level 14.',                         'in_progress', 'medium',   user_robert,   '2026-04-08', false, 13, '2026-03-12'),
  (project_id, 'Install emergency generator on pad',                                 'Set the 2000kW diesel generator on the housekeeping pad at the ground level mechanical yard. Vibration isolators.', 'done',        'high',     user_lisa,     '2026-03-20', false, 14, '2026-02-20'),
  (project_id, 'Run low voltage cabling Level 6',                                    'Install Category 6A cabling for data and voice throughout Level 6 tenant spaces. J hooks and cable tray in place.',  'todo',        'medium',   user_lisa,     '2026-04-15', false, 15, '2026-03-25'),
  (project_id, 'Paint Level 5 offices and corridors',                                'Prime and two coat finish paint for all Level 5 drywall surfaces. Colors per finish schedule A501.',                 'in_progress', 'medium',   user_jennifer, '2026-03-30', false, 16, '2026-03-15'),
  (project_id, 'Install ceramic tile restrooms Level 5 and 6',                       'Wall and floor tile installation in all restrooms on Levels 5 and 6 per tile layout drawings.',                      'todo',        'medium',   user_jennifer, '2026-04-10', false, 17, '2026-03-20'),
  (project_id, 'Set structural steel penthouse framing',                              'Erect penthouse steel framing for the mechanical equipment enclosure at the roof level.',                           'todo',        'critical', user_david,    '2026-04-18', true,  18, '2026-03-22'),
  (project_id, 'Install exterior stone veneer Level 1 through 3',                     'Set natural stone panels on the lower podium levels. Start at the main entrance and work around the building.',     'in_progress', 'high',     user_jennifer, '2026-04-15', false, 19, '2026-03-01'),
  (project_id, 'Complete stairwell pressurization ductwork',                          'Install pressurization fans and ductwork for both east and west stairwells per fire protection plans.',              'todo',        'high',     user_robert,   '2026-04-12', false, 20, '2026-03-18'),
  (project_id, 'Install ceiling grid Level 7',                                       'Hang suspension wire and install ceiling grid for Level 7 office and corridor areas.',                               'in_review',   'medium',   user_jennifer, '2026-03-28', false, 21, '2026-03-10'),
  (project_id, 'Test fire alarm system Levels 1 through 5',                           'Perform functional testing of all fire alarm devices, pull stations, and notification appliances on Levels 1 to 5.','todo',        'high',     user_lisa,     '2026-04-20', false, 22, '2026-03-25'),
  (project_id, 'Install loading dock equipment',                                      'Set dock levelers, bumpers, and overhead coiling doors at the loading dock area.',                                  'in_progress', 'medium',   user_jennifer, '2026-04-05', false, 23, '2026-03-15'),
  (project_id, 'Concrete topping slab at parking Level P1',                           'Place 4 inch concrete topping slab with hardener finish at parking Level P1.',                                      'done',        'medium',   user_james,    '2026-03-05', false, 24, '2026-02-01'),
  (project_id, 'Install building management system controllers',                      'Mount and wire BMS controllers at each floor mechanical room. Program sequences to follow.',                         'todo',        'medium',   user_lisa,     '2026-04-18', false, 25, '2026-03-22'),
  (project_id, 'Apply exterior sealant joints Levels 5 through 8',                    'Install backer rod and sealant at all curtain wall and precast panel joints on Levels 5 through 8.',                'in_progress', 'high',     user_david,    '2026-04-01', false, 26, '2026-03-12'),
  (project_id, 'Install landscape irrigation main line',                               'Trench and install 4 inch PVC irrigation main from the meter to the southeast landscape beds.',                    'todo',        'low',      user_jennifer, '2026-05-01', false, 27, '2026-03-26'),
  (project_id, 'Rough in electrical for Level 8 tenant build out',                     'Install branch circuit wiring, boxes, and conduit for the Level 8 tenant suite per electrical plans.',             'in_progress', 'medium',   user_lisa,     '2026-04-03', false, 28, '2026-03-15'),
  (project_id, 'Erect tower crane for upper floor steel',                              'Mobilize and erect supplemental tower crane on the east side for steel erection above Level 14.',                  'done',        'critical', user_mike,     '2026-02-28', true,  29, '2026-01-15'),
  (project_id, 'Commission chilled water system',                                      'Start up, test, and balance the chilled water loop including pumps, piping, and control valves.',                 'todo',        'high',     user_robert,   '2026-05-01', true,  30, '2026-03-25');

-- =========================================================================
-- 9. DRAWINGS (12)
-- =========================================================================

INSERT INTO drawings (id, project_id, title, discipline, sheet_number, revision, file_url, uploaded_by, ai_changes_detected, created_at) VALUES
  (dwg_01, project_id, 'Floor Plan Level 6',                        'architectural',    'A601',  'C',  '/drawings/A601_RevC.pdf',  user_karen,    0,  '2026-03-10'),
  (dwg_02, project_id, 'Structural Framing Plan Level 12',          'structural',       'S301',  'B',  '/drawings/S301_RevB.pdf',  user_david,    3,  '2026-03-05'),
  (dwg_03, project_id, 'HVAC Duct Layout Level 10',                 'mechanical',       'M401',  'A',  '/drawings/M401_RevA.pdf',  user_robert,   1,  '2026-03-15'),
  (dwg_04, project_id, 'Electrical Power Plan Level 8',             'electrical',       'E201',  'B',  '/drawings/E201_RevB.pdf',  user_lisa,     0,  '2026-03-08'),
  (dwg_05, project_id, 'Plumbing Riser Diagram',                    'plumbing',         'P501',  'A',  '/drawings/P501_RevA.pdf',  user_robert,   2,  '2026-03-01'),
  (dwg_06, project_id, 'Fire Protection Layout Level 9',            'fire_protection',  'FP201', 'A',  '/drawings/FP201_RevA.pdf', user_robert,   0,  '2026-03-12'),
  (dwg_07, project_id, 'Site Plan and Grading',                     'civil',            'C101',  'D',  '/drawings/C101_RevD.pdf',  user_karen,    0,  '2026-02-20'),
  (dwg_08, project_id, 'Landscape Planting Plan',                   'landscape',        'L101',  'A',  '/drawings/L101_RevA.pdf',  user_karen,    0,  '2026-02-25'),
  (dwg_09, project_id, 'Interior Elevations, Main Lobby',           'interior',         'ID101', 'B',  '/drawings/ID101_RevB.pdf', user_karen,    1,  '2026-03-18'),
  (dwg_10, project_id, 'Building Sections, East West',              'architectural',    'A201',  'C',  '/drawings/A201_RevC.pdf',  user_karen,    0,  '2026-03-10'),
  (dwg_11, project_id, 'Structural Foundation Plan',                'structural',       'S101',  'D',  '/drawings/S101_RevD.pdf',  user_david,    0,  '2025-06-15'),
  (dwg_12, project_id, 'Roof Mechanical Equipment Plan',            'mechanical',       'M501',  'A',  '/drawings/M501_RevA.pdf',  user_robert,   4,  '2026-03-20');

-- =========================================================================
-- 10. DAILY LOGS (10) with entries
-- =========================================================================

INSERT INTO daily_logs (id, project_id, log_date, weather, temperature_high, temperature_low, workers_onsite, total_hours, incidents, summary, ai_summary, approved, approved_by, approved_at, created_by, created_at) VALUES
  (dl_01, project_id, '2026-03-16', 'Clear',          72, 55, 145, 1160, 0,
   'Good production day. Steel crew completed erection of Level 14 moment frames. MEP rough in proceeding on Level 9. Concrete pour for Level 14 slab scheduled for Thursday.',
   'Strong day with 145 workers and zero incidents. Steel erection on track. MEP coordination meeting resolved duct routing conflict on Level 9.',
   true, user_mike, '2026-03-17 07:00:00', user_jennifer, '2026-03-16 16:30:00'),

  (dl_02, project_id, '2026-03-17', 'Partly Cloudy',  68, 52, 138, 1104, 0,
   'Curtain wall installation continued on south elevation Level 8. Interior framing on Level 6 is 90% complete. Elevator shaft work proceeding.',
   'Productive day across all trades. Curtain wall team making good progress. Level 6 framing nearing completion ahead of schedule.',
   true, user_mike, '2026-03-18 07:00:00', user_jennifer, '2026-03-17 16:45:00'),

  (dl_03, project_id, '2026-03-18', 'Clear',          75, 58, 152, 1216, 0,
   'Concrete pour for Level 14 elevated slab completed successfully. 285 cubic yards placed. Steel crew began shaking out Level 15 members.',
   'Major milestone: Level 14 slab pour complete. Peak manpower this week at 152 workers. Steel erection advancing to Level 15.',
   true, user_mike, '2026-03-19 07:00:00', user_jennifer, '2026-03-18 17:00:00'),

  (dl_04, project_id, '2026-03-19', 'Rain',           62, 48, 98,  784,  0,
   'Moderate rain starting at 10 AM. Exterior work suspended. Interior crews continued on Levels 5 through 8. Fireproofing crew worked on Level 12.',
   'Rain day reduced productivity by 35%. Only interior trades working after mid morning. No schedule impact on critical path items.',
   true, user_mike, '2026-03-20 07:00:00', user_jennifer, '2026-03-19 15:30:00'),

  (dl_05, project_id, '2026-03-20', 'Clear',          70, 53, 148, 1184, 0,
   'Resumed full operations after rain day. Curtain wall crew back on south elevation. Painting crew mobilized to Level 5. Fire sprinkler testing on Level 8.',
   'Full recovery from rain day. All crews back at peak staffing. Painting operations beginning on lower finished floors.',
   true, user_mike, '2026-03-21 07:00:00', user_jennifer, '2026-03-20 16:30:00'),

  (dl_06, project_id, '2026-03-23', 'Clear',          74, 56, 151, 1208, 0,
   'Steel crew working on Level 15 braced frames. Drywall finishing on Level 5 corridors. Plumbing rough in advancing on Level 11. Elevator guide rail installation in progress.',
   'Excellent Monday start with 151 workers. Multiple parallel activities across 8 active floors. Steel erection on critical path is tracking to schedule.',
   true, user_mike, '2026-03-24 07:00:00', user_jennifer, '2026-03-23 16:30:00'),

  (dl_07, project_id, '2026-03-24', 'Partly Cloudy',  71, 54, 147, 1176, 1,
   'Minor first aid incident in parking area. Worker stepped on a nail. Treated on site, returned to work. Steel connection work on Level 15 continuing. MEP coordination ongoing for Level 10.',
   'One recordable first aid incident. Steel and MEP crews maintaining pace. Toolbox talk on housekeeping conducted for all trades.',
   true, user_mike, '2026-03-25 07:00:00', user_jennifer, '2026-03-24 16:45:00'),

  (dl_08, project_id, '2026-03-25', 'Clear',          76, 59, 155, 1240, 0,
   'Highest headcount this month. Tile crew mobilized for Level 5 restrooms. Curtain wall reached Level 10 on south elevation. Concrete forming began for Level 15 slab.',
   'Peak staffing at 155 workers. New tile crew on site for finishes. Curtain wall progressing well. Concrete forming for next major pour underway.',
   true, user_mike, '2026-03-26 07:00:00', user_jennifer, '2026-03-25 17:00:00'),

  (dl_09, project_id, '2026-03-26', 'Windy',          69, 51, 142, 1136, 0,
   'High winds at 25 mph gusts suspended crane operations from 11 AM to 2 PM. Steel crew worked on bolting connections during downtime. Interior work unaffected.',
   'Wind delay affected crane operations for 3 hours. Steel crew pivoted to connection work. No impact to overall schedule. Interior trades at full production.',
   true, user_mike, '2026-03-27 07:00:00', user_jennifer, '2026-03-26 16:00:00'),

  (dl_10, project_id, '2026-03-27', 'Clear',          73, 55, 149, 1192, 0,
   'Steel erection on Level 15 is 60% complete. Level 5 painting nearing completion. Stone veneer installation at lobby entrance started. OAC meeting held at 2 PM.',
   'Solid production day. Steel erection advancing well. Finishing trades progressing on lower floors. Lobby stone work adds visual progress to the building.',
   false, NULL, NULL, user_jennifer, '2026-03-27 17:00:00');

-- Daily log entries for selected logs
INSERT INTO daily_log_entries (daily_log_id, type, trade, headcount, hours, equipment_name, equipment_hours, description, created_at) VALUES
  -- Log 01 entries
  (dl_01, 'manpower', 'Structural Steel',  22, 176, NULL, NULL,  'Steel erection Level 14 moment frames',          '2026-03-16 07:00:00'),
  (dl_01, 'manpower', 'Mechanical',        18, 144, NULL, NULL,  'HVAC rough in Level 9',                          '2026-03-16 07:00:00'),
  (dl_01, 'manpower', 'Electrical',        16, 128, NULL, NULL,  'Electrical rough in Levels 7 and 8',             '2026-03-16 07:00:00'),
  (dl_01, 'manpower', 'Concrete',          24, 192, NULL, NULL,  'Forming Level 14 elevated slab',                 '2026-03-16 07:00:00'),
  (dl_01, 'equipment', NULL, NULL, NULL, 'Tower Crane TC1',      10, 'Steel erection picks',                       '2026-03-16 07:00:00'),
  (dl_01, 'equipment', NULL, NULL, NULL, 'Concrete Pump',         0, 'Standby for Thursday pour',                  '2026-03-16 07:00:00'),

  -- Log 03 entries (pour day)
  (dl_03, 'manpower', 'Concrete',          32, 288, NULL, NULL,  'Level 14 slab pour, 285 CY placed',             '2026-03-18 05:00:00'),
  (dl_03, 'manpower', 'Structural Steel',  20, 160, NULL, NULL,  'Shaking out Level 15 steel members',            '2026-03-18 07:00:00'),
  (dl_03, 'manpower', 'Finishing',         14, 112, NULL, NULL,  'Drywall finishing Level 5',                      '2026-03-18 07:00:00'),
  (dl_03, 'equipment', NULL, NULL, NULL, 'Concrete Pump 42M',   12, 'Pumping for Level 14 slab pour',             '2026-03-18 05:00:00'),
  (dl_03, 'equipment', NULL, NULL, NULL, 'Tower Crane TC1',     10, 'Concrete bucket and steel picks',             '2026-03-18 06:00:00'),

  -- Log 07 entries (incident day)
  (dl_07, 'manpower', 'Structural Steel',  20, 160, NULL, NULL,  'Level 15 connection work',                       '2026-03-24 07:00:00'),
  (dl_07, 'manpower', 'Mechanical',        22, 176, NULL, NULL,  'MEP coordination and rough in Level 10',         '2026-03-24 07:00:00'),
  (dl_07, 'incident', NULL, NULL, NULL, NULL, NULL, 'First aid: worker stepped on nail in parking area, Level P1. Steel shank boot had worn sole. Treated on site by safety officer, tetanus up to date. Worker returned to light duty after 30 minutes. Toolbox talk on PPE footwear inspection conducted.', '2026-03-24 10:30:00'),
  (dl_07, 'note', NULL, NULL, NULL, NULL, NULL, 'MEP coordination meeting held to resolve duct routing conflict with sprinkler main on Level 10. Revised routing accepted by all parties.', '2026-03-24 14:00:00'),

  -- Log 10 entries
  (dl_10, 'manpower', 'Structural Steel',  22, 176, NULL, NULL,  'Level 15 erection, 60% complete',                '2026-03-27 07:00:00'),
  (dl_10, 'manpower', 'Painting',          12,  96, NULL, NULL,  'Level 5 offices second coat',                    '2026-03-27 07:00:00'),
  (dl_10, 'manpower', 'Stone/Masonry',      8,  64, NULL, NULL,  'Lobby entrance stone veneer',                    '2026-03-27 07:00:00'),
  (dl_10, 'manpower', 'Glazing',           14, 112, NULL, NULL,  'Curtain wall south elevation Level 10',          '2026-03-27 07:00:00'),
  (dl_10, 'note', NULL, NULL, NULL, NULL, NULL, 'OAC meeting held at 2 PM. Owner expressed satisfaction with lobby progress. Schedule update presented showing 2 days ahead on steel erection.', '2026-03-27 14:00:00');

-- =========================================================================
-- 11. CREWS (6)
-- =========================================================================

INSERT INTO crews (id, project_id, name, lead_id, trade, size, current_task, location, productivity_score, status, certifications, created_at) VALUES
  (crew_steel,  project_id, 'Ironworkers Local 263',        user_david,    'Structural Steel',  22, 'Steel erection Level 15 braced frames',                 'Level 15',      92, 'active', '["OSHA 30", "Ironworker Certified", "Rigging Qualified"]', '2024-02-01'),
  (crew_mep,    project_id, 'DFW Mechanical Crew A',        user_robert,   'HVAC/Mechanical',   18, 'HVAC ductwork rough in Level 10',                       'Level 10',      87, 'active', '["OSHA 10", "EPA 608 Universal", "Journeyman HVAC"]',     '2024-03-15'),
  (crew_elec,   project_id, 'Apex Electrical Team 1',       user_lisa,     'Electrical',        16, 'Branch circuit rough in Level 8',                       'Level 8',       90, 'active', '["OSHA 10", "Journeyman Electrician", "Arc Flash Certified"]', '2024-04-01'),
  (crew_ext,    project_id, 'Premier Glazing Installers',   user_david,    'Curtain Wall',      14, 'Curtain wall panels south elevation Level 10',          'South Elevation', 85, 'active', '["OSHA 30", "Suspended Scaffold Certified"]',              '2025-06-01'),
  (crew_frame,  project_id, 'Southwest Interior Framers',   user_jennifer, 'Interior Framing',  12, 'Metal stud framing Level 7',                            'Level 7',       88, 'active', '["OSHA 10", "Powder Actuated Tool Certified"]',            '2025-01-15'),
  (crew_finish, project_id, 'Quality Finishes Group',       user_jennifer, 'Finishes',          10, 'Painting and drywall finishing Level 5',                 'Level 5',       83, 'behind', '["OSHA 10", "Lead Paint Certified"]',                      '2025-09-01');

-- =========================================================================
-- 12. BUDGET ITEMS (by CSI Division)
-- =========================================================================

INSERT INTO budget_items (project_id, division, description, original_amount, committed_amount, actual_amount, forecast_amount, percent_complete, status) VALUES
  (project_id, '01 00 00', 'General Conditions',                    4800000,  4650000,  3250000,  4700000,  68, 'on_track'),
  (project_id, '03 00 00', 'Concrete',                              6200000,  6350000,  5100000,  6400000,  80, 'at_risk'),
  (project_id, '04 00 00', 'Masonry',                               1800000,  1750000,  1200000,  1780000,  65, 'on_track'),
  (project_id, '05 00 00', 'Metals (Structural and Miscellaneous)', 8500000,  8400000,  6200000,  8500000,  72, 'on_track'),
  (project_id, '06 00 00', 'Wood, Plastics, and Composites',         950000,   920000,   450000,   930000,  48, 'on_track'),
  (project_id, '07 00 00', 'Thermal and Moisture Protection',       3200000,  3150000,  2100000,  3200000,  65, 'on_track'),
  (project_id, '08 00 00', 'Openings (Doors, Windows, Curtain Wall)', 5800000, 5950000, 3800000,  6100000,  62, 'at_risk'),
  (project_id, '09 00 00', 'Finishes',                              4500000,  4400000,  1800000,  4500000,  40, 'on_track'),
  (project_id, '10 00 00', 'Specialties',                            600000,   580000,   200000,   590000,  32, 'on_track'),
  (project_id, '14 00 00', 'Conveying Equipment (Elevators)',       2200000,  2250000,   900000,  2250000,  38, 'on_track'),
  (project_id, '22 00 00', 'Plumbing',                              2800000,  2750000,  1650000,  2800000,  58, 'on_track'),
  (project_id, '23 00 00', 'HVAC',                                  4200000,  4300000,  2600000,  4350000,  60, 'at_risk'),
  (project_id, '26 00 00', 'Electrical',                            3800000,  3750000,  2200000,  3800000,  56, 'on_track'),
  (project_id, '28 00 00', 'Electronic Safety and Security',        1200000,  1150000,   500000,  1180000,  42, 'on_track'),
  (project_id, '31 00 00', 'Earthwork',                              850000,   850000,   850000,   850000, 100, 'on_track'),
  (project_id, '32 00 00', 'Exterior Improvements',                  600000,   580000,   100000,   600000,  15, 'on_track');

-- =========================================================================
-- 13. CHANGE ORDERS (5)
-- =========================================================================

INSERT INTO change_orders (project_id, description, amount, status, requested_by, requested_date, approved_date, created_at) VALUES
  (project_id, 'Owner requested upgrade of lobby floor finish from standard porcelain to imported Italian marble. Includes revised substrate preparation and additional waterproofing at entrance transitions.',
   385000, 'approved', 'Riverside Development Group', '2025-08-15', '2025-09-10', '2025-08-15'),
  (project_id, 'Unforeseen rock removal encountered during foundation excavation at the southeast corner. Required hydraulic breaker and additional haul off of 240 cubic yards.',
   142000, 'approved', 'Turner & Associates GC', '2024-06-20', '2024-07-15', '2024-06-20'),
  (project_id, 'Addition of emergency generator load bank testing and permanent natural gas connection per revised owner requirements.',
   67000, 'approved', 'Riverside Development Group', '2025-11-01', '2025-12-05', '2025-11-01'),
  (project_id, 'Revised curtain wall system at the Level 14 setback to accommodate the architectural design change from flat panels to angled facade. Includes re engineering of anchor system.',
   520000, 'pending_review', 'Whitman Graves Architects', '2026-03-10', NULL, '2026-03-10'),
  (project_id, 'Credit for deletion of the rooftop amenity terrace water feature, replaced with enhanced landscape planters per owner direction.',
   -95000, 'pending_review', 'Riverside Development Group', '2026-03-18', NULL, '2026-03-18');

-- =========================================================================
-- 14. MEETINGS (8) with attendees and action items
-- =========================================================================

INSERT INTO meetings (id, project_id, title, type, date, location, duration_minutes, notes, agenda, created_by, created_at) VALUES
  (mtg_01, project_id, 'OAC Meeting #47',                    'oac',           '2026-03-27 14:00:00', 'Jobsite Trailer, Conference Room A', 90,
   'Reviewed current schedule status. Steel erection 2 days ahead. Discussed curtain wall change order at Level 14. Owner approved lobby stone mockup.',
   '1. Safety moment\n2. Schedule update\n3. Budget review\n4. Change order status\n5. RFI log review\n6. Submittal status\n7. Quality observations\n8. Owner items',
   user_jennifer, '2026-03-20'),

  (mtg_02, project_id, 'Weekly Safety Meeting',               'safety',        '2026-03-25 07:00:00', 'Jobsite Trailer, Main Meeting Area', 30,
   'Reviewed nail puncture incident from 3/24. Reinforced PPE boot inspection requirements. Discussed upcoming crane operations for rooftop equipment.',
   '1. Incident review\n2. Housekeeping observations\n3. Upcoming high risk activities\n4. PPE compliance\n5. Open discussion',
   user_mike, '2026-03-20'),

  (mtg_03, project_id, 'MEP Coordination Meeting #22',        'coordination',  '2026-03-24 10:00:00', 'Jobsite Trailer, Conference Room B', 60,
   'Resolved duct routing conflict on Level 10. Discussed electrical panel clearance in mechanical room 305. Sprinkler head locations coordinated with ceiling grid.',
   '1. Level 10 ceiling space conflicts\n2. Mechanical room 305 layout\n3. Sprinkler and ceiling coordination\n4. Riser shaft schedule\n5. BIM clash report review',
   user_robert, '2026-03-20'),

  (mtg_04, project_id, 'Subcontractor Progress Meeting #38',  'progress',      '2026-03-26 09:00:00', 'Jobsite Trailer, Conference Room A', 75,
   'All subs present. Reviewed 3 week look ahead. Steel crew on track. Finishing crew noted 2 day delay on Level 5 paint due to material delivery.',
   '1. Three week look ahead\n2. Manpower projections\n3. Material deliveries\n4. Coordination issues\n5. Quality items\n6. Schedule recovery plan for finishes',
   user_jennifer, '2026-03-20'),

  (mtg_05, project_id, 'OAC Meeting #46',                    'oac',           '2026-03-13 14:00:00', 'Jobsite Trailer, Conference Room A', 90,
   'Discussed Level 14 slab pour preparation. Reviewed submittal status. Owner requested update on elevator delivery schedule.',
   '1. Safety moment\n2. Schedule update\n3. Budget review\n4. Submittal log\n5. RFI review\n6. Elevator schedule\n7. Owner questions',
   user_jennifer, '2026-03-06'),

  (mtg_06, project_id, 'Weekly Safety Meeting',               'safety',        '2026-03-18 07:00:00', 'Jobsite Trailer, Main Meeting Area', 30,
   'Pre pour safety briefing for Level 14 slab. Reviewed concrete pump setup zones and exclusion areas. All trades reminded of overhead work protections.',
   '1. Concrete pour safety plan\n2. Crane signal review\n3. Fall protection audit results\n4. Near miss reports\n5. Weather preparedness',
   user_mike, '2026-03-15'),

  (mtg_07, project_id, 'Curtain Wall Coordination',           'coordination',  '2026-03-20 13:00:00', 'Jobsite Trailer, Conference Room B', 45,
   'Reviewed curtain wall shop drawing status. Discussed anchor spacing at Level 14 setback. Mock up panel inspection scheduled for April 2.',
   '1. Shop drawing review\n2. Anchor layout at setback\n3. Panel delivery schedule\n4. Mock up inspection\n5. Sealant joint details',
   user_david, '2026-03-15'),

  (mtg_08, project_id, 'Subcontractor Progress Meeting #37',  'progress',      '2026-03-19 09:00:00', 'Jobsite Trailer, Conference Room A', 75,
   'Rain day affected exterior work. Discussed contingency plans. Interior trade coordination for Levels 5 through 8 reviewed. Material staging areas reassigned.',
   '1. Weather impact review\n2. Schedule recovery\n3. Interior trade access\n4. Material staging\n5. Upcoming deliveries\n6. Safety observations',
   user_jennifer, '2026-03-15');

-- Meeting attendees
INSERT INTO meeting_attendees (meeting_id, user_id, attended) VALUES
  (mtg_01, user_mike, true), (mtg_01, user_jennifer, true), (mtg_01, user_karen, true), (mtg_01, user_sarah, true), (mtg_01, user_david, true), (mtg_01, user_robert, true),
  (mtg_02, user_mike, true), (mtg_02, user_jennifer, true), (mtg_02, user_david, true), (mtg_02, user_robert, true), (mtg_02, user_lisa, true), (mtg_02, user_james, true),
  (mtg_03, user_robert, true), (mtg_03, user_lisa, true), (mtg_03, user_jennifer, true), (mtg_03, user_david, false),
  (mtg_04, user_jennifer, true), (mtg_04, user_david, true), (mtg_04, user_robert, true), (mtg_04, user_lisa, true), (mtg_04, user_james, true), (mtg_04, user_mike, true),
  (mtg_05, user_mike, true), (mtg_05, user_jennifer, true), (mtg_05, user_karen, true), (mtg_05, user_sarah, true),
  (mtg_06, user_mike, true), (mtg_06, user_jennifer, true), (mtg_06, user_james, true), (mtg_06, user_david, true),
  (mtg_07, user_david, true), (mtg_07, user_karen, true), (mtg_07, user_jennifer, true),
  (mtg_08, user_jennifer, true), (mtg_08, user_david, true), (mtg_08, user_robert, true), (mtg_08, user_lisa, true);

-- Meeting action items
INSERT INTO meeting_action_items (meeting_id, description, assigned_to, due_date, status, completed_at) VALUES
  (mtg_01, 'Submit revised curtain wall change order pricing to owner by April 3',                     user_jennifer, '2026-04-03', 'open', NULL),
  (mtg_01, 'Provide updated elevator delivery schedule from ThyssenKrupp',                              user_jennifer, '2026-04-01', 'open', NULL),
  (mtg_01, 'Review and respond to RFI 001 regarding steel connection at grid J7',                       user_karen,    '2026-04-01', 'open', NULL),
  (mtg_02, 'Conduct boot inspection for all trades entering the site. Report results by end of week.',  user_mike,     '2026-03-28', 'completed', '2026-03-27 16:00:00'),
  (mtg_02, 'Develop crane lift plan for rooftop mechanical equipment',                                  user_david,    '2026-04-04', 'open', NULL),
  (mtg_03, 'Issue revised MEP coordination drawing for Level 10 ceiling space',                         user_robert,   '2026-03-28', 'open', NULL),
  (mtg_03, 'Confirm electrical panel relocation in mechanical room 305 with the architect',             user_lisa,     '2026-03-31', 'open', NULL),
  (mtg_04, 'Provide manpower projection for April to all subcontractors',                               user_jennifer, '2026-03-31', 'open', NULL),
  (mtg_04, 'Expedite Level 5 paint material delivery. Confirm arrival date by Friday.',                 user_jennifer, '2026-03-28', 'completed', '2026-03-27 10:00:00'),
  (mtg_05, 'Schedule elevator cab finish mockup review with the owner',                                 user_jennifer, '2026-03-20', 'completed', '2026-03-19 14:00:00'),
  (mtg_07, 'Prepare Level 14 anchor layout sketch for architect review',                                user_david,    '2026-03-25', 'completed', '2026-03-24 12:00:00'),
  (mtg_08, 'Reassign staging area on the east side for incoming curtain wall panels',                   user_jennifer, '2026-03-22', 'completed', '2026-03-21 09:00:00');

-- =========================================================================
-- 15. DIRECTORY CONTACTS (25)
-- =========================================================================

INSERT INTO directory_contacts (project_id, name, company, role, trade, email, phone, address, avg_rfi_response_days) VALUES
  (project_id, 'Mike Thornton',        'Turner & Associates GC',       'Project Executive',           'General Contractor',   'mike.thornton@turnerassoc.com',       '(214) 555 3201', '1200 Main Street, Dallas, TX 75201',      NULL),
  (project_id, 'Jennifer Walsh',       'Turner & Associates GC',       'Senior Project Manager',      'General Contractor',   'jennifer.walsh@turnerassoc.com',      '(214) 555 3202', '1200 Main Street, Dallas, TX 75201',      NULL),
  (project_id, 'David Kowalski',       'Lone Star Structural Steel',   'Project Manager',             'Structural Steel',     'david.k@lonestarssteel.com',          '(817) 555 4100', '500 Industrial Blvd, Fort Worth, TX 76106', 3.2),
  (project_id, 'Robert Chen',          'DFW Mechanical Services',      'Mechanical Superintendent',   'HVAC/Mechanical',      'rchen@dfwmechanical.com',             '(972) 555 6700', '8800 Stemmons Fwy, Dallas, TX 75247',     4.1),
  (project_id, 'Lisa Ramirez',         'Apex Electrical Contractors',  'Electrical Foreman',          'Electrical',           'lisa.ramirez@apexelec.com',           '(214) 555 8100', '3200 Elm Street, Dallas, TX 75226',       2.8),
  (project_id, 'Karen Whitfield',      'Whitman Graves Architects',    'Project Architect',           'Architecture',         'kwhitfield@whitmangravesarch.com',    '(214) 555 1100', '2000 Ross Avenue, Suite 400, Dallas, TX 75201', 3.5),
  (project_id, 'James Patel',          'Precision Concrete Works',     'Concrete Superintendent',     'Concrete',             'jpatel@precisionconcrete.com',        '(972) 555 2200', '1500 E Highway 121, Lewisville, TX 75056', 2.5),
  (project_id, 'Sarah Mitchell',       'Riverside Development Group',  'Owner Representative',        'Owner',                'smitchell@riversidedev.com',          '(214) 555 9000', '3500 Maple Avenue, Suite 1200, Dallas, TX 75219', NULL),
  (project_id, 'Tom Brennan',          'Premier Glass and Glazing',    'Glazing Foreman',             'Curtain Wall',         'tbrennan@premierglazingdfw.com',      '(817) 555 3300', '700 S Freeway, Fort Worth, TX 76104',     5.2),
  (project_id, 'Maria Santos',         'Commercial Door Solutions',    'Project Coordinator',         'Door Hardware',        'msantos@commdoors.com',               '(972) 555 4400', '2100 Valley View Lane, Irving, TX 75062', 3.0),
  (project_id, 'Derek Washington',     'ThyssenKrupp Elevator',        'Installation Manager',        'Elevators',            'derek.washington@thyssenkrupp.com',   '(214) 555 5500', '4500 Alpha Road, Dallas, TX 75244',       4.5),
  (project_id, 'Rachel Kim',           'Fireproofing Specialists Inc.','Project Manager',             'Fireproofing',         'rkim@fireproofspec.com',              '(817) 555 6600', '1000 W Vickery Blvd, Fort Worth, TX 76104', 2.0),
  (project_id, 'Carlos Gutierrez',     'Southwest Roofing Partners',   'Roofing Superintendent',      'Roofing',              'cgutierrez@swroofingpartners.com',    '(972) 555 7700', '3300 N Belt Line Rd, Irving, TX 75062',   3.8),
  (project_id, 'Angela Foster',        'Dallas Stone Works',           'Sales Manager',               'Stone Cladding',       'afoster@dallasstoneworks.com',         '(214) 555 8800', '6000 Harry Hines Blvd, Dallas, TX 75235', 4.0),
  (project_id, 'Brian Murphy',         'Southwest Interior Systems',   'Framing Foreman',             'Interior Framing',     'bmurphy@swinterior.com',              '(972) 555 9900', '4200 LBJ Freeway, Dallas, TX 75244',      2.2),
  (project_id, 'Patricia Nguyen',      'Weatherguard Coatings LLC',    'Project Manager',             'Waterproofing',        'pnguyen@weatherguardcoat.com',        '(214) 555 1200', '1800 Canton Street, Dallas, TX 75201',    3.0),
  (project_id, 'William Harris',       'Whitman Graves Architects',    'Structural Engineer (EOR)',   'Structural Engineering','wharris@whitmangravesarch.com',       '(214) 555 1101', '2000 Ross Avenue, Suite 400, Dallas, TX 75201', 3.5),
  (project_id, 'Amanda Clark',         'Quality Finishes Group',       'Painting Foreman',            'Painting',             'aclark@qualityfinishes.com',          '(817) 555 1300', '900 E Belknap Street, Fort Worth, TX 76102', 1.5),
  (project_id, 'Steven Wright',        'Metroplex Fire Protection',    'Fire Protection Designer',    'Fire Protection',      'swright@metroplexfp.com',             '(214) 555 1400', '5500 Mockingbird Lane, Dallas, TX 75206', 3.2),
  (project_id, 'Diana Morales',        'Turner & Associates GC',       'Safety Manager',              'Safety',               'dmorales@turnerassoc.com',            '(214) 555 3203', '1200 Main Street, Dallas, TX 75201',      NULL),
  (project_id, 'Frank Russo',          'City of Dallas',               'Building Inspector',          'Code Enforcement',     'frank.russo@dallascityhall.com',      '(214) 555 2000', '1500 Marilla Street, Dallas, TX 75201',   NULL),
  (project_id, 'Nancy Cho',            'Lone Star Testing Labs',       'Lab Manager',                 'Testing/Inspection',   'ncho@lonestartesting.com',            '(972) 555 2100', '7700 N Stemmons Fwy, Dallas, TX 75247',   1.0),
  (project_id, 'Raymond Torres',       'DFW Mechanical Services',      'Plumbing Foreman',            'Plumbing',             'rtorres@dfwmechanical.com',           '(972) 555 6701', '8800 Stemmons Fwy, Dallas, TX 75247',     3.5),
  (project_id, 'Kathleen O Brien',     'Riverside Development Group',  'VP of Development',           'Owner',                'kobrien@riversidedev.com',            '(214) 555 9001', '3500 Maple Avenue, Suite 1200, Dallas, TX 75219', NULL),
  (project_id, 'Marcus Johnson',       'Precision Concrete Works',     'Quality Control Manager',     'Concrete QC',          'mjohnson@precisionconcrete.com',      '(972) 555 2201', '1500 E Highway 121, Lewisville, TX 75056', 2.0);

-- =========================================================================
-- 16. ACTIVITY FEED (50)
-- =========================================================================

INSERT INTO activity_feed (project_id, user_id, type, title, body, metadata, created_at) VALUES
  (project_id, user_david,    'rfi_created',            'RFI 015 created',                                 'Generator exhaust routing and louver placement',                             '{"rfi_number": 15}',               '2026-03-27 10:30:00'),
  (project_id, user_jennifer, 'file_uploaded',           'Document uploaded',                               'Uploaded Level 5 paint color schedule to the Finishes folder',               '{"file": "paint_schedule_L5.pdf"}', '2026-03-27 09:15:00'),
  (project_id, user_jennifer, 'daily_log_approved',      'Daily log approved',                              'March 26 daily log approved by Mike Thornton',                               '{"log_date": "2026-03-26"}',        '2026-03-27 07:15:00'),
  (project_id, user_sarah,    'comment_added',           'Comment on punch item',                           'Owner flagged damaged stone panel in the lobby for priority replacement',     '{}',                                '2026-03-27 08:45:00'),
  (project_id, user_robert,   'rfi_created',            'RFI 012 created',                                 'Landscape irrigation tie in point clarification needed',                      '{"rfi_number": 12}',               '2026-03-26 14:20:00'),
  (project_id, user_jennifer, 'task_moved',             'Task status updated',                              'Install loading dock equipment moved to In Progress',                        '{"task": "loading_dock"}',          '2026-03-26 11:00:00'),
  (project_id, user_jennifer, 'daily_log_approved',      'Daily log approved',                              'March 25 daily log approved by Mike Thornton',                               '{"log_date": "2026-03-25"}',        '2026-03-26 07:10:00'),
  (project_id, user_lisa,     'rfi_created',            'RFI 006 created',                                 'Electrical panel clearance in mechanical room 305',                          '{"rfi_number": 6}',                '2026-03-24 13:10:00'),
  (project_id, user_david,    'submittal_updated',       'Submittal status changed',                        'Curtain wall submittal moved to Under Review',                               '{"submittal_number": 3}',          '2026-03-24 10:00:00'),
  (project_id, user_jennifer, 'meeting_scheduled',       'Meeting scheduled',                               'MEP Coordination Meeting #22 scheduled for March 24',                        '{"meeting_type": "coordination"}',  '2026-03-23 16:00:00'),
  (project_id, user_jennifer, 'punch_resolved',          'Punch item resolved',                             'Stained ceiling tile in break room Level 5 resolved',                        '{}',                                '2026-03-24 11:30:00'),
  (project_id, user_robert,   'rfi_created',            'RFI 011 created',                                 'Sprinkler head layout in Level 10 open office area',                         '{"rfi_number": 11}',               '2026-03-21 11:00:00'),
  (project_id, user_karen,    'comment_added',           'RFI response posted',                             'Architect responded to RFI 003 regarding lobby floor finish transition',      '{"rfi_number": 3}',                '2026-03-22 14:00:00'),
  (project_id, user_jennifer, 'daily_log_approved',      'Daily log approved',                              'March 20 daily log approved by Mike Thornton',                               '{"log_date": "2026-03-20"}',        '2026-03-21 07:15:00'),
  (project_id, user_david,    'rfi_created',            'RFI 004 created',                                 'Exterior curtain wall anchor spacing at Level 14 setback',                   '{"rfi_number": 4}',                '2026-03-22 11:45:00'),
  (project_id, user_david,    'rfi_created',            'RFI 001 created',                                 'Steel connection detail at grid line J7',                                     '{"rfi_number": 1}',                '2026-03-20 09:15:00'),
  (project_id, user_jennifer, 'file_uploaded',           'Document uploaded',                               'Uploaded updated 3 week look ahead schedule',                                '{"file": "3_week_lookahead.pdf"}',  '2026-03-20 08:00:00'),
  (project_id, user_james,    'rfi_created',            'RFI 005 created',                                 'Fire rated shaft wall assembly at elevator lobby',                           '{"rfi_number": 5}',                '2026-03-18 08:20:00'),
  (project_id, user_jennifer, 'task_moved',             'Task completed',                                   'Frame interior partitions Level 6 marked as Done',                           '{"task": "framing_L6"}',            '2026-03-18 15:00:00'),
  (project_id, user_robert,   'submittal_updated',       'Submittal submitted',                             'VAV Box and Controls submittal submitted for review',                        '{"submittal_number": 5}',          '2026-03-17 09:30:00'),
  (project_id, user_jennifer, 'change_order_submitted',  'Change order submitted',                          'Curtain wall system redesign at Level 14 setback submitted for $520,000',    '{"co_amount": 520000}',            '2026-03-16 14:00:00'),
  (project_id, user_mike,     'meeting_scheduled',       'Meeting scheduled',                               'Safety meeting scheduled for March 18 to review pour safety plan',           '{"meeting_type": "safety"}',        '2026-03-15 16:30:00'),
  (project_id, user_robert,   'rfi_created',            'RFI 002 created',                                 'HVAC ductwork routing through structural transfer beam at Level 8',          '{"rfi_number": 2}',                '2026-03-15 14:30:00'),
  (project_id, user_jennifer, 'daily_log_approved',      'Daily log approved',                              'March 14 daily log approved by Mike Thornton',                               '{"log_date": "2026-03-14"}',        '2026-03-15 07:00:00'),
  (project_id, user_jennifer, 'task_moved',             'Task completed',                                   'Install fire sprinkler mains Level 9 marked as Done',                        '{"task": "sprinkler_L9"}',          '2026-03-15 10:00:00'),
  (project_id, user_david,    'file_uploaded',           'Document uploaded',                               'Uploaded steel erection progress photos March 14',                           '{"file": "steel_progress_0314.zip"}','2026-03-14 16:00:00'),
  (project_id, user_jennifer, 'punch_resolved',          'Punch item resolved',                             'Restroom partition anchor tightened and verified on Level 5',                 '{}',                                '2026-03-14 09:30:00'),
  (project_id, user_karen,    'submittal_updated',       'Submittal reviewed',                              'Interior stone cladding submittal moved to Under Review',                    '{"submittal_number": 12}',          '2026-03-12 11:00:00'),
  (project_id, user_jennifer, 'daily_log_approved',      'Daily log approved',                              'March 12 daily log approved by Mike Thornton',                               '{"log_date": "2026-03-12"}',        '2026-03-13 07:00:00'),
  (project_id, user_lisa,     'task_moved',             'Task completed',                                   'Install emergency generator on pad marked as Done',                          '{"task": "generator"}',             '2026-03-12 14:00:00'),
  (project_id, user_jennifer, 'meeting_scheduled',       'Meeting scheduled',                               'OAC Meeting #46 scheduled for March 13',                                     '{"meeting_type": "oac"}',           '2026-03-10 09:00:00'),
  (project_id, user_david,    'submittal_updated',       'Submittal resubmitted',                           'Standing seam metal roof system resubmitted as Revision 2',                  '{"submittal_number": 10}',          '2026-03-10 15:00:00'),
  (project_id, user_karen,    'comment_added',           'RFI response posted',                             'Architect responded to RFI 013 regarding interior partitions Level 6',        '{"rfi_number": 13}',               '2026-03-08 15:30:00'),
  (project_id, user_jennifer, 'task_moved',             'Task completed',                                   'Hang and finish drywall Level 5 marked as Done',                             '{"task": "drywall_L5"}',            '2026-03-08 11:00:00'),
  (project_id, user_james,    'rfi_created',            'RFI 007 created',                                 'Concrete mix design for Level 15 through 18 elevated slabs',                 '{"rfi_number": 7}',                '2026-03-01 07:30:00'),
  (project_id, user_jennifer, 'file_uploaded',           'Document uploaded',                               'Uploaded February monthly progress report',                                   '{"file": "feb_progress_report.pdf"}','2026-03-05 10:00:00'),
  (project_id, user_robert,   'submittal_updated',       'Submittal submitted',                             'Standing seam metal roof submittal submitted for review',                     '{"submittal_number": 10}',          '2026-03-01 09:00:00'),
  (project_id, user_jennifer, 'daily_log_approved',      'Daily log approved',                              'February 28 daily log approved',                                              '{"log_date": "2026-02-28"}',        '2026-03-01 07:00:00'),
  (project_id, user_jennifer, 'change_order_submitted',  'Change order submitted',                          'Rooftop amenity terrace water feature deletion credit submitted for $95,000', '{"co_amount": -95000}',            '2026-03-18 11:00:00'),
  (project_id, user_mike,     'meeting_scheduled',       'Meeting scheduled',                               'Subcontractor progress meeting #38 scheduled for March 26',                  '{"meeting_type": "progress"}',      '2026-03-20 14:00:00'),
  (project_id, user_jennifer, 'task_moved',             'Task status updated',                              'Curtain wall installation moved to In Progress',                             '{"task": "curtain_wall"}',          '2026-03-10 08:00:00'),
  (project_id, user_lisa,     'punch_resolved',          'Punch item verified',                             'Electrical outlet cover plates installed and verified on Level 7',            '{}',                                '2026-03-17 14:00:00'),
  (project_id, user_david,    'file_uploaded',           'Document uploaded',                               'Uploaded curtain wall shop drawings for south elevation',                     '{"file": "CW_shop_dwgs_south.pdf"}','2026-03-01 11:00:00'),
  (project_id, user_jennifer, 'task_moved',             'Task status updated',                              'Concrete topping slab at parking Level P1 marked as Done',                   '{"task": "topping_P1"}',            '2026-03-05 16:00:00'),
  (project_id, user_robert,   'rfi_created',            'RFI 008 created',                                 'Roof drain location conflict with structural framing',                        '{"rfi_number": 8}',                '2026-03-25 15:00:00'),
  (project_id, user_karen,    'submittal_updated',       'Submittal rejected',                              'Switchgear submittal rejected, dimensions exceed allocated space',            '{"submittal_number": 16}',          '2026-02-08 10:00:00'),
  (project_id, user_jennifer, 'daily_log_approved',      'Daily log approved',                              'March 18 daily log approved by Mike Thornton',                               '{"log_date": "2026-03-18"}',        '2026-03-19 07:00:00'),
  (project_id, user_mike,     'comment_added',           'Note added',                                     'Project insurance renewal documentation uploaded for 2026 coverage period',   '{}',                                '2026-03-15 12:00:00'),
  (project_id, user_jennifer, 'task_moved',             'Task moved to In Review',                          'Install ceiling grid Level 7 moved to In Review for inspection',             '{"task": "ceiling_L7"}',            '2026-03-25 14:00:00'),
  (project_id, user_james,    'task_moved',             'Task status updated',                              'Pour elevated slab Level 15 moved to In Progress, forming underway',         '{"task": "slab_L15"}',              '2026-03-22 08:00:00');

-- =========================================================================
-- 17. FILES (20)
-- =========================================================================

INSERT INTO files (project_id, name, folder, file_url, file_size, content_type, uploaded_by, version, created_at) VALUES
  (project_id, 'Structural Steel Erection Sequence Rev C.pdf',     'Structural',  '/files/structural/steel_erection_seq_revC.pdf',     4500000,  'application/pdf', user_david,    3, '2026-03-15'),
  (project_id, 'Level 14 Pour Concrete Tickets.pdf',               'Structural',  '/files/structural/L14_pour_tickets.pdf',             1200000,  'application/pdf', user_james,    1, '2026-03-18'),
  (project_id, 'Steel Connection Detail SK S301.1.pdf',            'Structural',  '/files/structural/SK_S301_1.pdf',                    850000,   'application/pdf', user_karen,    1, '2026-03-20'),
  (project_id, 'MEP Coordination Drawing Level 10 Rev 2.pdf',      'MEP',         '/files/mep/MEP_coord_L10_rev2.pdf',                 6200000,  'application/pdf', user_robert,   2, '2026-03-24'),
  (project_id, 'HVAC Equipment Schedule.xlsx',                      'MEP',         '/files/mep/HVAC_equipment_schedule.xlsx',            380000,   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', user_robert, 1, '2026-03-10'),
  (project_id, 'Electrical Riser Diagram Rev B.pdf',               'MEP',         '/files/mep/elec_riser_revB.pdf',                    2100000,  'application/pdf', user_lisa,     2, '2026-03-08'),
  (project_id, 'Fire Protection Hydraulic Calculations.pdf',        'MEP',         '/files/mep/FP_hydraulic_calcs.pdf',                 1800000,  'application/pdf', user_robert,   1, '2026-03-12'),
  (project_id, 'Specification Section 05 12 00 Structural Steel.pdf','Specs',      '/files/specs/spec_05_12_00.pdf',                    2400000,  'application/pdf', user_karen,    1, '2024-02-01'),
  (project_id, 'Specification Section 08 44 00 Curtain Walls.pdf',  'Specs',       '/files/specs/spec_08_44_00.pdf',                    1900000,  'application/pdf', user_karen,    1, '2024-02-01'),
  (project_id, 'Specification Section 23 00 00 HVAC General.pdf',   'Specs',       '/files/specs/spec_23_00_00.pdf',                    3200000,  'application/pdf', user_karen,    1, '2024-02-01'),
  (project_id, 'Site Specific Safety Plan Rev 4.pdf',               'Safety',      '/files/safety/SSSP_rev4.pdf',                       5100000,  'application/pdf', user_mike,     4, '2026-01-15'),
  (project_id, 'Crane Lift Plan, Rooftop Equipment.pdf',            'Safety',      '/files/safety/crane_lift_plan_rooftop.pdf',          3800000,  'application/pdf', user_david,    1, '2026-03-22'),
  (project_id, 'Weekly Safety Inspection Report 03.25.pdf',         'Safety',      '/files/safety/safety_inspection_0325.pdf',           920000,   'application/pdf', user_mike,     1, '2026-03-25'),
  (project_id, 'Monthly Budget Report March 2026.xlsx',             'Budget',      '/files/budget/monthly_budget_mar2026.xlsx',          1500000,  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', user_jennifer, 1, '2026-03-27'),
  (project_id, 'Cost Forecast Update Q1 2026.pdf',                  'Budget',      '/files/budget/cost_forecast_Q1_2026.pdf',            2200000,  'application/pdf', user_jennifer, 1, '2026-03-25'),
  (project_id, 'Three Week Look Ahead 03.20.pdf',                   'Structural',  '/files/structural/3wk_lookahead_0320.pdf',           780000,   'application/pdf', user_jennifer, 1, '2026-03-20'),
  (project_id, 'February 2026 Monthly Progress Report.pdf',         'Budget',      '/files/budget/feb_progress_report.pdf',              8500000,  'application/pdf', user_jennifer, 1, '2026-03-05'),
  (project_id, 'Curtain Wall Shop Drawings South Elevation.pdf',    'Structural',  '/files/structural/CW_shop_south.pdf',               12000000, 'application/pdf', user_david,    1, '2026-03-01'),
  (project_id, 'Level 5 Paint Color Schedule.pdf',                  'Specs',       '/files/specs/L5_paint_colors.pdf',                   450000,   'application/pdf', user_jennifer, 1, '2026-03-27'),
  (project_id, 'Project Insurance Certificate 2026.pdf',            'Safety',      '/files/safety/insurance_cert_2026.pdf',              680000,   'application/pdf', user_mike,     1, '2026-03-15');

-- =========================================================================
-- 18. FIELD CAPTURES (10)
-- =========================================================================

INSERT INTO field_captures (project_id, type, content, file_url, location, ai_category, ai_tags, linked_drawing_id, created_by, created_at) VALUES
  (project_id, 'photo', 'Level 14 slab pour in progress, concrete pump positioned on east side',                     '/captures/IMG_20260318_0930.jpg', 'Level 14, East Core',    'concrete',     '["pour", "slab", "level_14", "concrete_pump"]',         NULL,   user_james,    '2026-03-18 09:30:00'),
  (project_id, 'photo', 'Steel erection Level 15, braced frame at grid B4 through B6',                               '/captures/IMG_20260323_1400.jpg', 'Level 15, Grid B',       'structural',   '["steel", "erection", "braced_frame", "level_15"]',     dwg_02, user_david,    '2026-03-23 14:00:00'),
  (project_id, 'photo', 'Curtain wall installation south elevation Level 9, panels aligned and sealed',             '/captures/IMG_20260325_1100.jpg', 'South Elevation Level 9','exterior',     '["curtain_wall", "glazing", "south_elevation"]',        NULL,   user_david,    '2026-03-25 11:00:00'),
  (project_id, 'voice', 'Walked Level 10 ceiling space with Robert. Duct routing conflict resolved, sprinkler main shifts 8 inches south. Need updated coord drawing by Friday. Fire caulk crew to follow once penetrations are final.', NULL, 'Level 10, Ceiling Space', 'coordination', '["mep", "duct_routing", "coordination", "level_10"]', dwg_03, user_jennifer, '2026-03-24 15:30:00'),
  (project_id, 'photo', 'Fire caulk missing at rated wall penetration, Level 9 mechanical room',                     '/captures/IMG_20260320_0815.jpg', 'Level 9, Mech Room',     'deficiency',   '["fire_caulk", "penetration", "deficiency", "level_9"]',NULL,   user_jennifer, '2026-03-20 08:15:00'),
  (project_id, 'text',  'Elevator guide rail installation Cab 2 is approximately 40% complete. ThyssenKrupp crew working from Level 1 upward. Bracket spacing at 10 feet on center per approved shop drawings. No issues observed during walkthrough.', NULL, 'East Core Shaft', 'elevator', '["elevator", "guide_rail", "progress"]', NULL, user_jennifer, '2026-03-26 10:00:00'),
  (project_id, 'photo', 'Lobby stone veneer first panels installed at north feature wall',                            '/captures/IMG_20260327_1030.jpg', 'Level 1, North Lobby',   'finishes',     '["stone", "lobby", "feature_wall", "finishes"]',        dwg_09, user_jennifer, '2026-03-27 10:30:00'),
  (project_id, 'voice', 'Level 5 paint inspection. First coat looks good in offices 501 through 508. Some roller marks on corridor wall near stairwell B. Told Amanda to sand and recoat before tomorrow. Color matches the approved sample.', NULL, 'Level 5, Corridor', 'finishes', '["paint", "inspection", "level_5", "quality"]', NULL, user_jennifer, '2026-03-26 14:45:00'),
  (project_id, 'photo', 'Cracked floor tile at main building entrance, marked for replacement',                      '/captures/IMG_20260323_0900.jpg', 'Level 1, Main Entrance', 'deficiency',   '["tile", "crack", "lobby", "deficiency"]',               NULL,   user_karen,    '2026-03-23 09:00:00'),
  (project_id, 'text',  'Rooftop mechanical equipment pad poured and cured. Ready for equipment set. Crane lift plan approved. Housekeeping pads for pumps and AHUs are level and within tolerance. Anchor bolts checked and confirmed.', NULL, 'Roof Level', 'mechanical', '["rooftop", "equipment_pad", "concrete", "ready"]', dwg_12, user_james, '2026-03-25 16:00:00');

-- =========================================================================
-- 19. SCHEDULE PHASES (15)
-- =========================================================================

INSERT INTO schedule_phases (id, project_id, name, start_date, end_date, percent_complete, status, depends_on, is_critical_path, assigned_crew_id, created_at) VALUES
  (sp_01, project_id, 'Mobilization and Site Preparation',         '2024-01-15', '2024-04-30', 100, 'completed', NULL,   true,  NULL,        '2024-01-15'),
  (sp_02, project_id, 'Foundation and Below Grade Work',           '2024-03-01', '2024-10-31', 100, 'completed', sp_01,  true,  NULL,        '2024-01-15'),
  (sp_03, project_id, 'Concrete Superstructure Levels 1 through 5','2024-08-01', '2025-03-31', 100, 'completed', sp_02,  true,  NULL,        '2024-01-15'),
  (sp_04, project_id, 'Concrete Superstructure Levels 6 through 10','2025-01-15', '2025-08-31', 100, 'completed', sp_03,  true, NULL,        '2024-01-15'),
  (sp_05, project_id, 'Steel Erection Levels 11 through 18',       '2025-06-01', '2026-05-31',  65, 'active',    sp_04,  true,  crew_steel,  '2024-01-15'),
  (sp_06, project_id, 'Exterior Enclosure and Curtain Wall',       '2025-09-01', '2026-08-31',  45, 'active',    sp_04,  true,  crew_ext,    '2024-01-15'),
  (sp_07, project_id, 'MEP Rough In Levels 1 through 10',          '2025-04-01', '2026-04-30',  80, 'active',    sp_03,  false, crew_mep,    '2024-01-15'),
  (sp_08, project_id, 'MEP Rough In Levels 11 through 18',         '2026-01-15', '2026-10-31',  25, 'active',    sp_05,  false, crew_mep,    '2024-01-15'),
  (sp_09, project_id, 'Interior Framing Levels 1 through 8',       '2025-08-01', '2026-04-15',  75, 'active',    sp_03,  false, crew_frame,  '2024-01-15'),
  (sp_10, project_id, 'Interior Finishes Levels 1 through 5',      '2026-01-01', '2026-06-30',  40, 'active',    sp_09,  false, crew_finish, '2024-01-15'),
  (sp_11, project_id, 'Interior Finishes Levels 6 through 10',     '2026-04-01', '2026-09-30',  5,  'upcoming',  sp_10,  false, crew_finish, '2024-01-15'),
  (sp_12, project_id, 'Elevator Installation',                      '2026-02-01', '2026-10-31',  20, 'active',    sp_05,  true,  NULL,        '2024-01-15'),
  (sp_13, project_id, 'Rooftop Mechanical Equipment',               '2026-04-01', '2026-07-31',   0, 'upcoming',  sp_05,  true,  crew_mep,   '2024-01-15'),
  (sp_14, project_id, 'Commissioning and Testing',                  '2026-08-01', '2027-01-31',   0, 'upcoming',  sp_13,  true,  NULL,        '2024-01-15'),
  (sp_15, project_id, 'Punchlist and Closeout',                     '2026-12-01', '2027-03-31',   0, 'upcoming',  sp_14,  true,  NULL,        '2024-01-15');

-- =========================================================================
-- 20. NOTIFICATIONS
-- =========================================================================

INSERT INTO notifications (user_id, project_id, type, title, body, link, read, created_at) VALUES
  (user_karen,    project_id, 'rfi_assigned',        'New RFI assigned to you',              'RFI 015: Generator exhaust routing and louver placement requires your response by April 6',     '/rfis/15',       false, '2026-03-27 10:30:00'),
  (user_karen,    project_id, 'rfi_assigned',        'New RFI assigned to you',              'RFI 001: Steel connection detail at grid line J7 requires your response by April 1',              '/rfis/1',        false, '2026-03-20 09:15:00'),
  (user_karen,    project_id, 'submittal_review',    'Submittal ready for review',           'Elevator Cab Finish and Equipment submittal is pending your review',                               '/submittals/6',  false, '2026-03-20 08:00:00'),
  (user_robert,   project_id, 'rfi_assigned',        'New RFI assigned to you',              'RFI 006: Electrical panel clearance in mechanical room 305 assigned to you',                      '/rfis/6',        false, '2026-03-24 13:10:00'),
  (user_jennifer, project_id, 'punch_item',          'New punch item reported',              'HVAC diffuser not connected to duct on Level 8, Room 805. Critical priority.',                    '/punchlist',     false, '2026-03-24 09:00:00'),
  (user_jennifer, project_id, 'task_update',         'Task nearing due date',                'Install ceiling grid Level 7 is in review status with due date of March 28',                      '/tasks',         false, '2026-03-26 08:00:00'),
  (user_mike,     project_id, 'daily_log_approval',  'Daily log pending approval',           'March 27 daily log submitted by Jennifer Walsh is awaiting your approval',                        '/dailylog',      false, '2026-03-27 17:00:00'),
  (user_mike,     project_id, 'ai_alert',            'AI schedule risk detected',            'Steel erection pace on Levels 16 through 18 may create 5 day delay if wind days continue',        '/schedule',      false, '2026-03-26 20:00:00'),
  (user_david,    project_id, 'submittal_review',    'Submittal requires resubmission',      'Standing seam metal roof system submittal marked for resubmission. Review architect comments.',    '/submittals/10', true,  '2026-03-15 10:00:00'),
  (user_jennifer, project_id, 'meeting_reminder',    'Meeting tomorrow',                      'OAC Meeting #47 scheduled for March 27 at 2:00 PM in the jobsite trailer',                       '/meetings',      true,  '2026-03-26 18:00:00'),
  (user_lisa,     project_id, 'task_update',         'New task assigned',                     'Pull electrical feeders to Level 12 distribution has been assigned to you, due April 10',          '/tasks',         false, '2026-03-15 09:00:00'),
  (user_sarah,    project_id, 'ai_alert',            'Budget variance alert',                'Openings (Doors, Windows, Curtain Wall) division trending $300K over original budget',             '/budget',        false, '2026-03-25 12:00:00'),
  (user_robert,   project_id, 'meeting_reminder',    'Coordination meeting tomorrow',        'MEP Coordination Meeting #22 scheduled for March 24 at 10:00 AM',                                 '/meetings',      true,  '2026-03-23 18:00:00'),
  (user_james,    project_id, 'task_update',         'Task status update',                   'Waterproof plaza deck Level 2 has been added to your task list, due April 12',                     '/tasks',         false, '2026-03-20 10:00:00'),
  (user_karen,    project_id, 'rfi_assigned',        'RFI response overdue',                 'RFI 002: HVAC ductwork routing through structural transfer beam at Level 8 is past due',          '/rfis/2',        false, '2026-03-28 07:00:00');

-- =========================================================================
-- 21. AI INSIGHTS
-- =========================================================================

INSERT INTO ai_insights (project_id, page, severity, message, expanded_content, action_label, action_link, dismissed, created_at) VALUES
  -- Dashboard
  (project_id, 'dashboard', 'warning',  'Steel erection pace may slip if wind delays continue',
   'Over the past two weeks, crane operations have been suspended for a total of 6 hours due to high winds. If March wind patterns hold into April, the steel erection on Levels 16 through 18 could fall 3 to 5 days behind the baseline schedule. Consider adding a Saturday shift to build float.',
   'View Schedule', '/schedule', false, '2026-03-26 20:00:00'),
  (project_id, 'dashboard', 'critical', '7 open RFIs require attention this week',
   'There are currently 7 open RFIs with due dates in the next 10 days. Three are assigned to the architect and four involve MEP coordination. Delayed responses on RFI 001 (steel connection) and RFI 002 (HVAC routing) could impact active work on Levels 12 and 8 respectively.',
   'View RFIs', '/rfis', false, '2026-03-27 06:00:00'),
  (project_id, 'dashboard', 'info',     'Project is tracking 2 days ahead on the critical path',
   'The steel erection sequence is currently 2 days ahead of the baseline schedule. This buffer should be maintained through the Level 16 erection phase. The concrete forming crew has aligned their schedule to take advantage of this lead time.',
   'View Schedule', '/schedule', false, '2026-03-27 06:00:00'),

  -- RFIs
  (project_id, 'rfis', 'warning',  'RFI 002 response is 2 days overdue',
   'The HVAC ductwork routing question at Level 8 was due March 30 and has not received a response. This RFI blocks mechanical rough in at the transfer beam zone. Each day of delay could affect 3 downstream activities.',
   'Open RFI 002', '/rfis/2', false, '2026-03-28 07:00:00'),
  (project_id, 'rfis', 'info',     'Average RFI response time has improved to 5.2 days',
   'Over the last 30 days, the average RFI response time dropped from 7.1 days to 5.2 days. The architect team has been particularly responsive on finish specification questions. Structural RFIs still average 6.8 days.',
   NULL, NULL, false, '2026-03-27 06:00:00'),

  -- Submittals
  (project_id, 'submittals', 'warning',  'Curtain wall submittal review is approaching deadline',
   'Submittal 003 (Curtain Wall System) has been under review for 27 days with a due date of March 28. Late approval could delay panel fabrication by 2 weeks given the 14 week lead time. The fabricator has already begun preliminary work at risk.',
   'Review Submittal', '/submittals/3', false, '2026-03-26 06:00:00'),
  (project_id, 'submittals', 'critical', 'Rejected switchgear submittal needs resubmission',
   'Submittal 016 (Switchgear and Main Distribution Panel) was rejected on February 8 due to oversized equipment. A resubmission has not been received. The 16 week lead time means every week of delay pushes energization further into the schedule.',
   'View Submittal', '/submittals/16', false, '2026-03-27 06:00:00'),

  -- Budget
  (project_id, 'budget', 'warning',  'Openings division trending 5.2% over original budget',
   'Division 08 00 00 (Openings) has committed costs of $5.95M against an original budget of $5.8M. The pending curtain wall change order of $520K, if approved, would push the variance to 11.2%. The contingency drawdown rate is higher than planned at this stage of the project.',
   'View Budget', '/budget', false, '2026-03-27 06:00:00'),
  (project_id, 'budget', 'info',     'Overall project is $180K under forecast through March',
   'Total actual spending through March 2026 is $33.9M against a forecast of $34.08M. General conditions and metals divisions are the primary contributors to the favorable variance. Concrete is slightly over budget due to the fly ash mix testing requirements.',
   NULL, NULL, false, '2026-03-27 06:00:00'),

  -- Schedule
  (project_id, 'schedule', 'warning',  'Finishing crew behind schedule on Level 5',
   'The Quality Finishes Group has a productivity score of 83, the lowest of all active crews. Level 5 painting is 2 days behind the planned completion. Material delivery delays contributed to the slip. A recovery plan is in place with Saturday overtime authorized.',
   'View Crews', '/crews', false, '2026-03-27 06:00:00'),
  (project_id, 'schedule', 'info',     'Elevator installation is 20% complete and on track',
   'ThyssenKrupp has guide rails at 40% in Shaft 1 and 40% in Shaft 2. The cab finish submittal is pending but not on the critical path until June. Machine room equipment is staged and ready for installation once shaft work reaches Level 14.',
   NULL, NULL, false, '2026-03-27 06:00:00'),

  -- Crews
  (project_id, 'crews', 'info',     'Ironworkers crew productivity is highest on site at 92',
   'The Ironworkers Local 263 crew has maintained a 92 productivity score throughout March. Their connection work efficiency has contributed to the 2 day schedule buffer on the critical path. Zero rework items recorded this month.',
   NULL, NULL, false, '2026-03-27 06:00:00'),
  (project_id, 'crews', 'warning',  'Quality Finishes Group may need additional resources',
   'With Level 5 painting behind and Level 6 and 7 finishes coming up in April, the 10 person finishing crew may be undersized. Adding 4 painters could recover the 2 day slip and build buffer for the upper floor finish sequence.',
   'View Crew', '/crews', false, '2026-03-27 06:00:00'),

  -- Punchlist
  (project_id, 'punchlist', 'critical', '2 critical punch items need immediate attention',
   'A disconnected HVAC diffuser on Level 8 and a noncompliant handrail at the Level 1 ramp are both critical priority items. The handrail issue is an ADA compliance concern that must be corrected before any occupancy inspections.',
   'View Punch List', '/punchlist', false, '2026-03-27 06:00:00'),
  (project_id, 'punchlist', 'info',     'Punch item resolution rate is 85% within 7 days',
   'Of the 20 punch items logged this month, 4 have been resolved and 1 verified within one week of creation. The fire caulking and sprinkler head items are being addressed by their respective trades and are expected to close by end of week.',
   NULL, NULL, false, '2026-03-27 06:00:00');

-- =========================================================================
-- 22. PROJECT SNAPSHOTS (5)
-- =========================================================================

INSERT INTO project_snapshots (project_id, snapshot_date, data, key_events, created_at) VALUES
  (project_id, '2024-09-30', '{
    "percent_complete": 20,
    "budget_spent": 10400000,
    "budget_forecast": 52000000,
    "workers_peak": 85,
    "open_rfis": 4,
    "open_submittals": 8,
    "schedule_variance_days": 0,
    "safety_incidents_mtd": 0,
    "active_change_orders": 1
  }', '[
    "Foundation work complete on all four quadrants",
    "Below grade waterproofing applied and inspected",
    "First concrete superstructure pour completed at Level 1",
    "Tower crane erected and operational"
  ]', '2024-09-30'),

  (project_id, '2025-04-30', '{
    "percent_complete": 35,
    "budget_spent": 18200000,
    "budget_forecast": 52100000,
    "workers_peak": 120,
    "open_rfis": 6,
    "open_submittals": 12,
    "schedule_variance_days": 3,
    "safety_incidents_mtd": 1,
    "active_change_orders": 2
  }', '[
    "Concrete superstructure reached Level 5",
    "Steel erection began for upper tower",
    "MEP rough in started on lower floors",
    "Rock removal change order approved"
  ]', '2025-04-30'),

  (project_id, '2025-09-30', '{
    "percent_complete": 50,
    "budget_spent": 26000000,
    "budget_forecast": 52200000,
    "workers_peak": 140,
    "open_rfis": 8,
    "open_submittals": 10,
    "schedule_variance_days": 1,
    "safety_incidents_mtd": 0,
    "active_change_orders": 3
  }', '[
    "Concrete superstructure topped out at Level 10",
    "Steel erection reached Level 11",
    "Curtain wall installation began on lower floors",
    "Interior framing started on Levels 1 through 4",
    "Emergency generator delivered and set"
  ]', '2025-09-30'),

  (project_id, '2026-01-31', '{
    "percent_complete": 60,
    "budget_spent": 31200000,
    "budget_forecast": 52400000,
    "workers_peak": 148,
    "open_rfis": 10,
    "open_submittals": 11,
    "schedule_variance_days": -1,
    "safety_incidents_mtd": 0,
    "active_change_orders": 3
  }', '[
    "Steel erection reached Level 14",
    "Curtain wall progressing on south elevation",
    "Interior finishes began on Level 1 through 3",
    "Elevator shaft work started",
    "Lobby marble upgrade change order approved"
  ]', '2026-01-31'),

  (project_id, '2026-03-27', '{
    "percent_complete": 65,
    "budget_spent": 33900000,
    "budget_forecast": 52600000,
    "workers_peak": 155,
    "open_rfis": 7,
    "open_submittals": 6,
    "schedule_variance_days": -2,
    "safety_incidents_mtd": 1,
    "active_change_orders": 5
  }', '[
    "Steel erection at Level 15, 2 days ahead of schedule",
    "Level 14 elevated slab poured successfully",
    "Curtain wall reached Level 10 on south elevation",
    "Interior finishes progressing on Levels 5 and 6",
    "Lobby stone veneer installation commenced",
    "Peak workforce of 155 workers achieved"
  ]', '2026-03-27');

END $$;
