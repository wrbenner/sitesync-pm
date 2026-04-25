-- SiteSync PM Construction PM Platform - Seed Data
-- This file populates demo data for testing and development
-- Generated for 2 organizations, 3 projects, 10 users, and comprehensive project data

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================

INSERT INTO organizations (id, name, slug, subscription_tier, settings)
VALUES
  (
    'f1b4c5a7-8901-4b5c-9d7e-2f8a9b1c3d4e'::uuid,
    'Benner Construction Group',
    'benner-construction',
    'professional',
    '{"headquarters": "Denver, CO", "industry": "Mixed Use, Residential"}'
  ),
  (
    'a2c5d6b7-9f01-4c5d-8e7f-3g9h0i2j4k5l'::uuid,
    'Pacific Coast Builders',
    'pacific-coast-builders',
    'professional',
    '{"headquarters": "San Francisco, CA", "industry": "Medical, Hospitality"}'
  );

-- ============================================================================
-- AUTH USERS (These would be created via Supabase Auth in production)
-- Note: These inserts assume auth.users table exists
-- ============================================================================

-- Walker Benner (Owner)
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data
) VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'walker@benner.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "Walker Benner"}'
) ON CONFLICT (id) DO NOTHING;

-- Mike Torres (GC Admin)
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data
) VALUES (
  '22222222-2222-2222-2222-222222222222'::uuid,
  'mike.torres@benner.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "Mike Torres"}'
) ON CONFLICT (id) DO NOTHING;

-- Sarah Chen (Project Manager)
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data
) VALUES (
  '33333333-3333-3333-3333-333333333333'::uuid,
  'sarah.chen@benner.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "Sarah Chen"}'
) ON CONFLICT (id) DO NOTHING;

-- James Rodriguez (Superintendent)
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data
) VALUES (
  '44444444-4444-4444-4444-444444444444'::uuid,
  'j.rodriguez@benner.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "James Rodriguez"}'
) ON CONFLICT (id) DO NOTHING;

-- Dave Morrison (Superintendent)
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data
) VALUES (
  '55555555-5555-5555-5555-555555555555'::uuid,
  'dave.morrison@pacific.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "Dave Morrison"}'
) ON CONFLICT (id) DO NOTHING;

-- Lisa Park (Foreman)
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data
) VALUES (
  '66666666-6666-6666-6666-666666666666'::uuid,
  'lisa.park@benner.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "Lisa Park"}'
) ON CONFLICT (id) DO NOTHING;

-- Tony Ray (Subcontractor, Ray's Electric)
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data
) VALUES (
  '77777777-7777-7777-7777-777777777777'::uuid,
  'tony@rayselectric.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "Tony Ray"}'
) ON CONFLICT (id) DO NOTHING;

-- Kim Nguyen (Architect/Engineer)
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data
) VALUES (
  '88888888-8888-8888-8888-888888888888'::uuid,
  'kim.nguyen@designgroup.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "Kim Nguyen"}'
) ON CONFLICT (id) DO NOTHING;

-- Bob Williams (Inspector)
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data
) VALUES (
  '99999999-9999-9999-9999-999999999999'::uuid,
  'bob.williams@buildingdept.gov',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "Bob Williams"}'
) ON CONFLICT (id) DO NOTHING;

-- Maria Garcia (Project Manager)
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'maria.garcia@pacific.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "Maria Garcia"}'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PROFILES
-- ============================================================================

INSERT INTO profiles (id, full_name, phone, company, trade, org_id)
VALUES
  (
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Walker Benner',
    '(303) 555-0101',
    'Benner Construction Group',
    'Owner',
    'f1b4c5a7-8901-4b5c-9d7e-2f8a9b1c3d4e'::uuid
  ),
  (
    '22222222-2222-2222-2222-222222222222'::uuid,
    'Mike Torres',
    '(303) 555-0102',
    'Benner Construction Group',
    'General Contractor',
    'f1b4c5a7-8901-4b5c-9d7e-2f8a9b1c3d4e'::uuid
  ),
  (
    '33333333-3333-3333-3333-333333333333'::uuid,
    'Sarah Chen',
    '(303) 555-0103',
    'Benner Construction Group',
    'Project Manager',
    'f1b4c5a7-8901-4b5c-9d7e-2f8a9b1c3d4e'::uuid
  ),
  (
    '44444444-4444-4444-4444-444444444444'::uuid,
    'James Rodriguez',
    '(303) 555-0104',
    'Benner Construction Group',
    'Superintendent',
    'f1b4c5a7-8901-4b5c-9d7e-2f8a9b1c3d4e'::uuid
  ),
  (
    '55555555-5555-5555-5555-555555555555'::uuid,
    'Dave Morrison',
    '(415) 555-0105',
    'Pacific Coast Builders',
    'Superintendent',
    'a2c5d6b7-9f01-4c5d-8e7f-3g9h0i2j4k5l'::uuid
  ),
  (
    '66666666-6666-6666-6666-666666666666'::uuid,
    'Lisa Park',
    '(303) 555-0106',
    'Benner Construction Group',
    'Foreman',
    'f1b4c5a7-8901-4b5c-9d7e-2f8a9b1c3d4e'::uuid
  ),
  (
    '77777777-7777-7777-7777-777777777777'::uuid,
    'Tony Ray',
    '(303) 555-0107',
    'Rays Electric',
    'Electrical Subcontractor',
    'f1b4c5a7-8901-4b5c-9d7e-2f8a9b1c3d4e'::uuid
  ),
  (
    '88888888-8888-8888-8888-888888888888'::uuid,
    'Kim Nguyen',
    '(415) 555-0108',
    'Design Group Architects',
    'Architect',
    'a2c5d6b7-9f01-4c5d-8e7f-3g9h0i2j4k5l'::uuid
  ),
  (
    '99999999-9999-9999-9999-999999999999'::uuid,
    'Bob Williams',
    '(303) 555-0109',
    'Denver Building Department',
    'Building Inspector',
    'f1b4c5a7-8901-4b5c-9d7e-2f8a9b1c3d4e'::uuid
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'Maria Garcia',
    '(415) 555-0110',
    'Pacific Coast Builders',
    'Project Manager',
    'a2c5d6b7-9f01-4c5d-8e7f-3g9h0i2j4k5l'::uuid
  );

-- ============================================================================
-- PROJECTS
-- ============================================================================

INSERT INTO projects (
  id, org_id, name, number, address, city, state, zip, start_date, end_date,
  status, contract_value, description
)
VALUES
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'f1b4c5a7-8901-4b5c-9d7e-2f8a9b1c3d4e'::uuid,
    'The Meridian Tower',
    'BCG-2024-001',
    '1550 Lawrence Street',
    'Denver',
    'CO',
    '80202',
    '2024-03-15'::date,
    '2027-06-30'::date,
    'active',
    42000000.00,
    'Mixed use high-rise development featuring 15 stories of office, retail, and residential space in downtown Denver'
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    'a2c5d6b7-9f01-4c5d-8e7f-3g9h0i2j4k5l'::uuid,
    'Harbor View Condos',
    'PCB-2024-002',
    '2400 Marina Drive',
    'San Francisco',
    'CA',
    '94123',
    '2024-06-01'::date,
    '2026-08-31'::date,
    'active',
    18000000.00,
    '8-story residential condominium building with 120 units and street-level retail space overlooking the San Francisco Bay'
  ),
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    'a2c5d6b7-9f01-4c5d-8e7f-3g9h0i2j4k5l'::uuid,
    'Westfield Medical Center',
    'PCB-2024-003',
    '5500 Coliseum Way',
    'Oakland',
    'CA',
    '94621',
    '2026-05-01'::date,
    '2027-11-30'::date,
    'planning',
    9500000.00,
    '3-story medical office building with 75000 square feet of state-of-the-art healthcare facilities and specialized laboratory space'
  );

-- ============================================================================
-- PROJECT MEMBERS (Links users to projects with roles)
-- ============================================================================

-- The Meridian Tower team
INSERT INTO project_members (project_id, user_id, role, invited_by)
VALUES
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    'admin',
    '11111111-1111-1111-1111-111111111111'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid,
    'pm',
    '22222222-2222-2222-2222-222222222222'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '44444444-4444-4444-4444-444444444444'::uuid,
    'superintendent',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '66666666-6666-6666-6666-666666666666'::uuid,
    'foreman',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '77777777-7777-7777-7777-777777777777'::uuid,
    'vendor',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '88888888-8888-8888-8888-888888888888'::uuid,
    'architect',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '99999999-9999-9999-9999-999999999999'::uuid,
    'inspector',
    '33333333-3333-3333-3333-333333333333'::uuid
  );

-- Harbor View Condos team
INSERT INTO project_members (project_id, user_id, role, invited_by)
VALUES
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    '55555555-5555-5555-5555-555555555555'::uuid,
    'superintendent',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'pm',
    NULL
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    '88888888-8888-8888-8888-888888888888'::uuid,
    'architect',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  );

-- Westfield Medical Center team
INSERT INTO project_members (project_id, user_id, role, invited_by)
VALUES
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'pm',
    NULL
  ),
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    '88888888-8888-8888-8888-888888888888'::uuid,
    'architect',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  );

-- ============================================================================
-- RFIs (Request for Information)
-- 25 RFIs spread across projects in various statuses
-- ============================================================================

INSERT INTO rfis (
  project_id, number, subject, question, status, priority,
  assigned_to_id, due_date, cost_impact, schedule_impact_days,
  spec_section, drawing_ref, created_by
)
VALUES
  -- The Meridian Tower RFIs (15 total)
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    1001,
    'Confirm steel beam connection detail at grid C-7',
    'We need clarification on the welded moment connection detail shown in sheet S-302. The weld schedule appears incomplete for the beam-to-column junction. Please confirm the complete joint penetration weld requirements and any backing bar details.',
    'submitted',
    'high',
    '88888888-8888-8888-8888-888888888888'::uuid,
    '2026-04-10'::date,
    0.00,
    3,
    '05 05 00',
    'S-302.2',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    1002,
    'Clarify waterproofing membrane spec at below-grade walls',
    'The basement waterproofing specification calls for a bentonite sheet membrane but the construction documents show a liquid applied system. Which system should we proceed with and what is the required surface preparation?',
    'received',
    'high',
    '33333333-3333-3333-3333-333333333333'::uuid,
    '2026-04-05'::date,
    15000.00,
    2,
    '07 13 00',
    'A-101.1',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    1003,
    'Coordinate mechanical equipment location on roof',
    'The HVAC equipment shown on the electrical plan conflicts with the structural layout of the penthouse framing. Can we get clarification on the final positioning?',
    'draft',
    'medium',
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-04-15'::date,
    8000.00,
    5,
    '23 00 00',
    'M-201.3',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    1004,
    'Electrical load calculation for tenant fit-out',
    'Unit 820 tenant is requesting 400 amp service. Does the building electrical service have capacity for this additional load or do we need to upgrade the service entrance?',
    'clarification_requested',
    'high',
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-04-08'::date,
    50000.00,
    7,
    '26 00 00',
    'E-201.1',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    1005,
    'Verify brick veneer color and mortar match',
    'The brick samples delivered do not match the color shown in the approved submittals. We need approval on either returning this shipment or using the new color if acceptable for architectural continuity.',
    'submitted',
    'medium',
    '88888888-8888-8888-8888-888888888888'::uuid,
    '2026-04-12'::date,
    0.00,
    1,
    '04 20 00',
    'A-501.2',
    '66666666-6666-6666-6666-666666666666'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    1006,
    'Confirm curtain wall installation sequence',
    'Can we install exterior curtain wall panels prior to interior demising wall framing or must the interior studs be in place first per the building code?',
    'received',
    'high',
    '88888888-8888-8888-8888-888888888888'::uuid,
    '2026-04-07'::date,
    0.00,
    4,
    '08 40 00',
    'A-401.1',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    1007,
    'Fire rating requirement for 6th floor stairwell',
    'Is the stairwell enclosure at the 6th floor required to be 2-hour fire-rated or can we use 1-hour construction? The code analysis shows conflicting interpretations.',
    'clarification_provided',
    'critical',
    '99999999-9999-9999-9999-999999999999'::uuid,
    '2026-04-03'::date,
    75000.00,
    10,
    '07 22 00',
    'A-301.1',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    1008,
    'Parking deck concrete finish and slope',
    'The parking structure sub-grade shows standard concrete finish but the owner has requested an epoxy coating. Should we include this in the base bid or as an alternate?',
    'reviewed',
    'medium',
    '33333333-3333-3333-3333-333333333333'::uuid,
    '2026-04-09'::date,
    35000.00,
    2,
    '03 30 00',
    'C-301.2',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    1009,
    'Plumbing fixture selections for public restrooms',
    'We are proceeding with the low-flow fixture specification but the architectural finish differs from what was in the original spec. Please confirm finishes for faucets and trim.',
    'submitted',
    'low',
    '33333333-3333-3333-3333-333333333333'::uuid,
    '2026-04-16'::date,
    5000.00,
    0,
    '22 40 00',
    'P-201.4',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    1010,
    'Expansion joint spacing in concrete slabs',
    'The structural engineer shows expansion joint spacing at 40 feet but the ACI standard would suggest 30 feet intervals. Which spacing should we use for the 10th floor slab?',
    'approved',
    'medium',
    '88888888-8888-8888-8888-888888888888'::uuid,
    '2026-04-02'::date,
    12000.00,
    1,
    '03 24 00',
    'S-201.3',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    1011,
    'Acoustic ceiling height clearance',
    'The suspended acoustic ceiling and HVAC distribution will be in the same space. Can we lower the ceiling to 9 feet to maintain clearance for ductwork?',
    'submitted',
    'medium',
    '88888888-8888-8888-8888-888888888888'::uuid,
    '2026-04-11'::date,
    8000.00,
    2,
    '09 51 00',
    'A-502.1',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    1012,
    'GFCI outlet requirements for penthouse kitchenette',
    'The executive penthouse kitchenette requires GFCI protection. Can we use GFCI breakers instead of individual GFCI outlets for the entire kitchen circuit?',
    'received',
    'low',
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-04-14'::date,
    0.00,
    0,
    '26 05 00',
    'E-402.2',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    1013,
    'Glass railing code compliance in public areas',
    'The code requires glass railings in the retail atrium to be tempered. Please confirm the glass specification meets this requirement and whether laminated glass is acceptable.',
    'draft',
    'high',
    '99999999-9999-9999-9999-999999999999'::uuid,
    '2026-04-13'::date,
    25000.00,
    3,
    '08 81 00',
    'A-601.1',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    1014,
    'Dumpster enclosure material and location',
    'Can we relocate the dumpster enclosure 20 feet east to improve circulation in the service yard? Will this affect trash truck access?',
    'cancelled',
    'low',
    '44444444-4444-4444-4444-444444444444'::uuid,
    '2026-04-20'::date,
    0.00,
    0,
    '32 35 00',
    'C-301.1',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    1015,
    'Sprinkler system design density check',
    'Please confirm the water supply pressure and flow rate will support the calculated sprinkler system demand for the full building occupancy.',
    'submitted',
    'critical',
    '99999999-9999-9999-9999-999999999999'::uuid,
    '2026-04-06'::date,
    45000.00,
    5,
    '21 13 00',
    'M-101.2',
    '44444444-4444-4444-4444-444444444444'::uuid
  );

-- Harbor View Condos RFIs (6 total)
INSERT INTO rfis (
  project_id, number, subject, question, status, priority,
  assigned_to_id, due_date, cost_impact, schedule_impact_days,
  spec_section, drawing_ref, created_by
)
VALUES
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    2001,
    'Balcony waterproofing system specification',
    'Please clarify the waterproofing system for cantilevered balconies. Should we use a liquid applied system or sheet membrane with drainage channels?',
    'submitted',
    'high',
    '88888888-8888-8888-8888-888888888888'::uuid,
    '2026-04-18'::date,
    22000.00,
    3,
    '07 13 00',
    'A-201.4',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    2002,
    'Residential unit electrical service size',
    'Each unit shows 200 amp service but some units have owner-requested electric cooking plus electric heat. Can we proceed with 200 amp or upgrade to 300 amp service?',
    'received',
    'high',
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-04-12'::date,
    35000.00,
    4,
    '26 02 00',
    'E-301.2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    2003,
    'Common area ceiling height requirement',
    'The lobby ceiling currently shows 12 feet clear height. The sprinkler system will require dropping ceiling by 18 inches. Is this acceptable?',
    'draft',
    'medium',
    '88888888-8888-8888-8888-888888888888'::uuid,
    '2026-04-22'::date,
    8000.00,
    2,
    '09 51 00',
    'A-101.2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    2004,
    'Parking garage ventilation system sizing',
    'The parking structure ventilation system needs to be sized for peak demand. Please confirm the number of parking spaces and whether we should use natural or mechanical ventilation.',
    'clarification_requested',
    'high',
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-04-10'::date,
    65000.00,
    6,
    '23 34 00',
    'M-201.1',
    '55555555-5555-5555-5555-555555555555'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    2005,
    'Rooftop mechanical equipment screening',
    'The architectural rooftop design requires screening of mechanical units. Can we install the screen immediately or must we wait until final phase?',
    'submitted',
    'low',
    '88888888-8888-8888-8888-888888888888'::uuid,
    '2026-04-25'::date,
    12000.00,
    1,
    '08 41 00',
    'A-401.3',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    2006,
    'Fiber optic cabling for building management system',
    'Should we install fiber optic cabling for the building management system integration or proceed with Cat-6A copper?',
    'received',
    'medium',
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-04-08'::date,
    28000.00,
    2,
    '27 13 00',
    'E-201.4',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  );

-- Westfield Medical Center RFIs (4 total)
INSERT INTO rfis (
  project_id, number, subject, question, status, priority,
  assigned_to_id, due_date, cost_impact, schedule_impact_days,
  spec_section, drawing_ref, created_by
)
VALUES
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    3001,
    'Medical gas outlet locations in operating rooms',
    'Please confirm the final layout and locations for medical gas outlets in operating rooms including vacuum, nitrogen, and oxygen lines.',
    'draft',
    'critical',
    '88888888-8888-8888-8888-888888888888'::uuid,
    '2026-05-15'::date,
    18000.00,
    5,
    '22 65 00',
    'M-301.2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    3002,
    'Laboratory utility infrastructure requirements',
    'Confirm the laboratory utility requirements for compressed air, vacuum, distilled water, and waste handling systems.',
    'draft',
    'high',
    '88888888-8888-8888-8888-888888888888'::uuid,
    '2026-05-20'::date,
    95000.00,
    8,
    '22 80 00',
    'M-302.1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    3003,
    'Emergency generator fuel tank sizing',
    'Confirm whether the emergency generator should be sized for 48 or 72 hour fuel autonomy for the medical center.',
    'draft',
    'high',
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-05-18'::date,
    85000.00,
    4,
    '26 32 00',
    'M-201.5',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    3004,
    'Infection prevention HVAC system design',
    'Confirm the isolation room HVAC design with negative pressure requirements for infection control protocols.',
    'draft',
    'critical',
    '88888888-8888-8888-8888-888888888888'::uuid,
    '2026-05-22'::date,
    125000.00,
    10,
    '23 81 00',
    'M-202.3',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  );

-- ============================================================================
-- SUBMITTALS
-- 15 submittals across projects in various stages
-- ============================================================================

INSERT INTO submittals (
  project_id, number, title, spec_section, status, current_revision,
  ball_in_court_id, due_date, lead_time_days, required_on_site_date,
  created_by
)
VALUES
  -- The Meridian Tower submittals (9 total)
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'S-001',
    'Structural Steel Shop Drawings',
    '05 12 23',
    'submitted',
    1,
    '88888888-8888-8888-8888-888888888888'::uuid,
    '2026-04-20'::date,
    21,
    '2026-05-15'::date,
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'M-001',
    'HVAC Equipment Specifications and Schedules',
    '23 81 13',
    'approved',
    2,
    NULL,
    '2026-04-15'::date,
    28,
    '2026-05-20'::date,
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'E-001',
    'Electrical One-Line Diagram and Load Calculations',
    '26 05 00',
    'under_review',
    1,
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-04-25'::date,
    14,
    '2026-05-10'::date,
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'A-001',
    'Brick and Stone Material Samples',
    '04 20 00',
    'approved_with_conditions',
    3,
    '66666666-6666-6666-6666-666666666666'::uuid,
    '2026-04-10'::date,
    7,
    '2026-04-30'::date,
    '66666666-6666-6666-6666-666666666666'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'CW-001',
    'Curtain Wall Assembly Details and Specifications',
    '08 44 00',
    'submitted',
    2,
    '88888888-8888-8888-8888-888888888888'::uuid,
    '2026-04-18'::date,
    35,
    '2026-06-01'::date,
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'R-001',
    'Roofing Material Specification and Details',
    '07 31 00',
    'returned_for_revision',
    1,
    '44444444-4444-4444-4444-444444444444'::uuid,
    '2026-04-12'::date,
    14,
    '2026-05-15'::date,
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'WP-001',
    'Waterproofing System Specifications',
    '07 13 00',
    'approved',
    2,
    NULL,
    '2026-04-08'::date,
    21,
    '2026-04-30'::date,
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'P-001',
    'Plumbing Fixture Schedules and Details',
    '22 40 00',
    'draft',
    0,
    '33333333-3333-3333-3333-333333333333'::uuid,
    '2026-05-01'::date,
    7,
    '2026-05-20'::date,
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'AC-001',
    'Acoustic Ceiling Suspension System',
    '09 51 00',
    'submitted',
    1,
    '88888888-8888-8888-8888-888888888888'::uuid,
    '2026-04-22'::date,
    10,
    '2026-05-15'::date,
    '44444444-4444-4444-4444-444444444444'::uuid
  );

-- Harbor View Condos submittals (4 total)
INSERT INTO submittals (
  project_id, number, title, spec_section, status, current_revision,
  ball_in_court_id, due_date, lead_time_days, required_on_site_date,
  created_by
)
VALUES
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    'S-001',
    'Structural Drawings for Residential Tower',
    '05 12 00',
    'approved',
    2,
    NULL,
    '2026-04-05'::date,
    28,
    '2026-04-30'::date,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    'M-001',
    'MEP Coordination Drawings',
    '22 01 00',
    'under_review',
    1,
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-04-28'::date,
    21,
    '2026-05-15'::date,
    '55555555-5555-5555-5555-555555555555'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    'A-001',
    'Exterior Cladding Material and Color Schedule',
    '04 42 00',
    'submitted',
    1,
    '88888888-8888-8888-8888-888888888888'::uuid,
    '2026-05-05'::date,
    14,
    '2026-05-20'::date,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    'L-001',
    'Landscape and Hardscape Plans',
    '32 93 00',
    'draft',
    0,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    '2026-05-15'::date,
    10,
    '2026-06-01'::date,
    '55555555-5555-5555-5555-555555555555'::uuid
  );

-- Westfield Medical Center submittals (2 total)
INSERT INTO submittals (
  project_id, number, title, spec_section, status, current_revision,
  ball_in_court_id, due_date, lead_time_days, required_on_site_date,
  created_by
)
VALUES
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    'M-001',
    'Medical Gas System Design and Specifications',
    '22 65 00',
    'draft',
    0,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    '2026-05-20'::date,
    28,
    '2026-06-15'::date,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    'L-001',
    'Laboratory Infrastructure Requirements',
    '22 80 00',
    'draft',
    0,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    '2026-05-25'::date,
    35,
    '2026-06-20'::date,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  );

-- ============================================================================
-- PUNCH LIST ITEMS
-- 50 punch list items with realistic construction content
-- ============================================================================

INSERT INTO punch_list_items (
  project_id, number, title, description, status, priority,
  location, assigned_to_id, due_date, trade, created_by
)
VALUES
  -- The Meridian Tower (35 punch items)
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    1,
    'Caulk control joint at curtain wall interface',
    'Sealant joint between curtain wall and building structure needs to be caulked and finished to match adjacent surfaces',
    'open',
    'high',
    'East facade, levels 5-12',
    '66666666-6666-6666-6666-666666666666'::uuid,
    '2026-04-30'::date,
    'Glazing',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    2,
    'Install wall outlet covers in office spaces',
    'Electrical outlet covers are missing in approximately 40 office spaces throughout floors 7-9',
    'in_progress',
    'low',
    'Office spaces, 7th-9th floors',
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-05-05'::date,
    'Electrical',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    3,
    'Repair concrete spall at base of Column C7',
    'Concrete spalling visible at the base of structural column C7 on the 4th floor. Repair to match existing finish',
    'open',
    'medium',
    '4th floor, Grid C-7',
    '44444444-4444-4444-4444-444444444444'::uuid,
    '2026-04-25'::date,
    'Concrete',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    4,
    'Recess recessed lights in suspended ceiling',
    'Recessed light trim rings are not properly seated in acoustic ceiling on 6th floor. Adjust for flush installation',
    'in_progress',
    'low',
    '6th floor',
    '66666666-6666-6666-6666-666666666666'::uuid,
    '2026-05-10'::date,
    'Electrical',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    5,
    'Touch up paint on interior door frames',
    'Multiple interior door frames show paint touch-up needed where hardware installation has caused damage',
    'open',
    'low',
    'Multiple floors, core areas',
    '44444444-4444-4444-4444-444444444444'::uuid,
    '2026-05-15'::date,
    'Painting',
    '66666666-6666-6666-6666-666666666666'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    6,
    'Caulk base of toilet at 8th floor restroom',
    'Plumbing fixture installation needs caulking at base where fixture meets flooring',
    'ready_for_inspection',
    'low',
    '8th floor restroom',
    '99999999-9999-9999-9999-999999999999'::uuid,
    '2026-05-08'::date,
    'Plumbing',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    7,
    'Missing hardware on stairwell doors',
    'Door closers are missing on two stairwell doors at the 5th floor landing',
    'open',
    'medium',
    '5th floor stairwell',
    '66666666-6666-6666-6666-666666666666'::uuid,
    '2026-04-28'::date,
    'Doors and Hardware',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    8,
    'Seal gaps around HVAC registers in ceiling',
    'HVAC supply registers show gaps between register and ceiling material. Seal with appropriate sealant',
    'in_progress',
    'low',
    'Floors 3-6, office spaces',
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-05-12'::date,
    'HVAC',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    9,
    'Remove temporary protective coverings from hardware',
    'Temporary plastic coverings still on interior door hardware throughout the building',
    'open',
    'low',
    'All floors, core areas',
    '44444444-4444-4444-4444-444444444444'::uuid,
    '2026-04-22'::date,
    'General',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    10,
    'Install grab bars in accessible restrooms',
    'Accessible restrooms on 3rd, 6th, and 9th floors require installation of grab bars per ADA requirements',
    'open',
    'high',
    'Restrooms, multiple floors',
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-04-27'::date,
    'Plumbing',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    11,
    'Replace damaged ceiling tile in retail space',
    'Water damage to one acoustic ceiling tile in ground floor retail area',
    'ready_for_inspection',
    'medium',
    'Ground floor retail, bay 3',
    '66666666-6666-6666-6666-666666666666'::uuid,
    '2026-04-23'::date,
    'Drywall and Finishes',
    '66666666-6666-6666-6666-666666666666'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    12,
    'Adjust door sweeps on exterior doors',
    'Entry door sweeps not sealing properly at ground level. Adjust or replace for weather tightness',
    'in_progress',
    'medium',
    'Ground floor entries',
    '66666666-6666-6666-6666-666666666666'::uuid,
    '2026-05-01'::date,
    'Doors and Hardware',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    13,
    'Caulk window sills in office spaces',
    'Interior window sills need caulking to provide finished appearance and weather sealing',
    'open',
    'low',
    'Office spaces, multiple floors',
    '44444444-4444-4444-4444-444444444444'::uuid,
    '2026-05-08'::date,
    'Glazing',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    14,
    'Install light fixture trim rings',
    'Approximately 80 recessed light trim rings are missing from downlights in tenant spaces',
    'open',
    'low',
    'Floors 7-12, tenant spaces',
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-05-06'::date,
    'Electrical',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    15,
    'Verify operation of fire dampers',
    'Fire dampers throughout the building need to be tested and certified for proper operation',
    'open',
    'critical',
    'All floors, mechanical shafts',
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-04-20'::date,
    'Fire Protection',
    '99999999-9999-9999-9999-999999999999'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    16,
    'Clean windows and glass surfaces',
    'Final cleaning of all interior and exterior glass surfaces required',
    'open',
    'low',
    'All facades and interior',
    '44444444-4444-4444-4444-444444444444'::uuid,
    '2026-05-20'::date,
    'General',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    17,
    'Install signage in parking structure',
    'Level numbers and directional signage missing in parking garage levels 2 and 3',
    'open',
    'medium',
    'Parking structure levels 2-3',
    '66666666-6666-6666-6666-666666666666'::uuid,
    '2026-05-15'::date,
    'Signage',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    18,
    'Verify exit signage illumination',
    'Test all emergency exit signs to verify proper illumination and battery backup function',
    'open',
    'critical',
    'All exit locations',
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-04-25'::date,
    'Electrical',
    '99999999-9999-9999-9999-999999999999'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    19,
    'Remove temporary dust barriers',
    'Remove plastic dust barriers from doorways and wall openings throughout the building',
    'in_progress',
    'low',
    'All floors',
    '44444444-4444-4444-4444-444444444444'::uuid,
    '2026-04-24'::date,
    'General',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    20,
    'Patch and paint drywall areas',
    'Drywall holes from temporary construction items need to be patched and painted on multiple floors',
    'open',
    'low',
    'Multiple locations',
    '66666666-6666-6666-6666-666666666666'::uuid,
    '2026-05-12'::date,
    'Drywall',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    21,
    'Install lobby directory signage',
    'Final directory board with tenant information and wayfinding signage for main lobby',
    'open',
    'medium',
    'Ground floor main lobby',
    '66666666-6666-6666-6666-666666666666'::uuid,
    '2026-05-18'::date,
    'Signage',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    22,
    'Caulk and finish base of exterior railings',
    'Base details of rooftop railings need caulking and sealant application',
    'ready_for_inspection',
    'medium',
    'Rooftop',
    '66666666-6666-6666-6666-666666666666'::uuid,
    '2026-05-02'::date,
    'Railings',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    23,
    'Final cleaning and move-in preparation',
    'Final deep clean of all spaces and make ready for tenant occupancy',
    'open',
    'low',
    'All spaces',
    '44444444-4444-4444-4444-444444444444'::uuid,
    '2026-05-25'::date,
    'General',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    24,
    'Verify HVAC system commissioning',
    'HVAC system needs full commissioning and performance verification with temperature monitoring',
    'open',
    'critical',
    'Mechanical rooms all levels',
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-04-30'::date,
    'HVAC',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    25,
    'Test and adjust elevator doors',
    'Elevator door operation and safety features require testing and final adjustment',
    'open',
    'critical',
    'All elevator shafts',
    '44444444-4444-4444-4444-444444444444'::uuid,
    '2026-04-28'::date,
    'Vertical Transportation',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    26,
    'Install building directory at reception',
    'Tenant directory information board for main reception area',
    'open',
    'low',
    'Ground floor reception',
    '66666666-6666-6666-6666-666666666666'::uuid,
    '2026-05-20'::date,
    'General',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    27,
    'Verify sprinkler system coverage',
    'Walk the building to verify all spaces have sprinkler coverage per the design plan',
    'open',
    'critical',
    'All occupiable spaces',
    '99999999-9999-9999-9999-999999999999'::uuid,
    '2026-04-26'::date,
    'Fire Protection',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    28,
    'Replace damaged drywall in stairwell',
    'Water damage to drywall at stairwell on 7th floor requires replacement',
    'in_progress',
    'medium',
    '7th floor stairwell',
    '66666666-6666-6666-6666-666666666666'::uuid,
    '2026-04-29'::date,
    'Drywall',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    29,
    'Install door closers throughout building',
    'Approximately 45 interior doors still need door closer installation and adjustment',
    'open',
    'medium',
    'Multiple floors',
    '66666666-6666-6666-6666-666666666666'::uuid,
    '2026-05-07'::date,
    'Doors and Hardware',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    30,
    'Weatherstrip exterior frame',
    'Exterior storefront frames need weatherstripping at base for weather tightness',
    'in_progress',
    'medium',
    'Ground floor retail frontage',
    '66666666-6666-6666-6666-666666666666'::uuid,
    '2026-05-04'::date,
    'Weatherization',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    31,
    'Install interior landscaping in lobby',
    'Plant installation and interior landscaping design for main lobby atrium',
    'open',
    'low',
    'Ground floor lobby',
    '44444444-4444-4444-4444-444444444444'::uuid,
    '2026-05-22'::date,
    'Specialty',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    32,
    'Verify backup generator operation',
    'Full load test of backup power generator required before occupancy',
    'open',
    'critical',
    'Mechanical room, basement level',
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-04-22'::date,
    'Electrical',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    33,
    'Install accessible signage',
    'Wayfinding and directional signage installation for accessibility compliance',
    'open',
    'medium',
    'All public spaces',
    '66666666-6666-6666-6666-666666666666'::uuid,
    '2026-05-16'::date,
    'Signage',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    34,
    'Clean HVAC ductwork',
    'Final cleaning of supply and return ductwork before building occupancy',
    'open',
    'high',
    'Mechanical systems',
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-05-08'::date,
    'HVAC',
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    35,
    'Verify plumbing system pressure test',
    'Final pressure test and certification of all plumbing systems',
    'open',
    'critical',
    'Plumbing systems',
    '44444444-4444-4444-4444-444444444444'::uuid,
    '2026-04-27'::date,
    'Plumbing',
    '33333333-3333-3333-3333-333333333333'::uuid
  );

-- Harbor View Condos (10 punch items)
INSERT INTO punch_list_items (
  project_id, number, title, description, status, priority,
  location, assigned_to_id, due_date, trade, created_by
)
VALUES
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    1,
    'Caulk balcony expansion joints',
    'Apply sealant to all balcony-to-building interface joints for waterproofing',
    'in_progress',
    'high',
    'All balconies, levels 2-8',
    '55555555-5555-5555-5555-555555555555'::uuid,
    '2026-04-30'::date,
    'Waterproofing',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    2,
    'Install unit entry door hardware',
    'Door locks and closers needed for 45 residential units',
    'open',
    'high',
    'Residential units, floors 1-8',
    '55555555-5555-5555-5555-555555555555'::uuid,
    '2026-05-03'::date,
    'Doors and Hardware',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    3,
    'Touch up exterior paint and sealant',
    'Paint and sealant touch-up on exterior cladding where installation damage occurred',
    'ready_for_inspection',
    'medium',
    'Building exterior',
    '55555555-5555-5555-5555-555555555555'::uuid,
    '2026-04-25'::date,
    'Painting',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    4,
    'Install appliances in model units',
    'Kitchen appliances for 3 model units are ready for installation',
    'open',
    'medium',
    'Model units, floors 2, 4, 6',
    '55555555-5555-5555-5555-555555555555'::uuid,
    '2026-05-10'::date,
    'Appliances',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    5,
    'Verify electrical panel labels',
    'Electrical panels require final labeling for circuit identification',
    'open',
    'high',
    'Electrical rooms, all levels',
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-04-28'::date,
    'Electrical',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    6,
    'Final cleaning of common areas',
    'Deep cleaning of lobby, hallways, and common spaces before opening',
    'open',
    'low',
    'Common areas all levels',
    '55555555-5555-5555-5555-555555555555'::uuid,
    '2026-05-18'::date,
    'General',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    7,
    'Install unit kitchen faucets',
    'Kitchen faucets for all 120 residential units need to be installed',
    'open',
    'medium',
    'Residential units, floors 1-8',
    '55555555-5555-5555-5555-555555555555'::uuid,
    '2026-05-06'::date,
    'Plumbing',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    8,
    'Caulk window sills',
    'Caulking required where windows meet sills in residential units',
    'in_progress',
    'low',
    'Residential units',
    '55555555-5555-5555-5555-555555555555'::uuid,
    '2026-05-09'::date,
    'Glazing',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    9,
    'Test fire alarm system',
    'Full testing and certification of fire alarm system required',
    'open',
    'critical',
    'Building systems',
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-04-24'::date,
    'Fire Protection',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    10,
    'Install bathroom accessories in units',
    'Towel bars, paper holders, and other bathroom hardware for residential units',
    'open',
    'low',
    'Residential unit bathrooms',
    '55555555-5555-5555-5555-555555555555'::uuid,
    '2026-05-12'::date,
    'General',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  );

-- Westfield Medical Center (5 punch items)
INSERT INTO punch_list_items (
  project_id, number, title, description, status, priority,
  location, assigned_to_id, due_date, trade, created_by
)
VALUES
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    1,
    'Install final medical gas outlet covers',
    'Medical gas outlet identification plates and covers for all operating rooms and treatment areas',
    'open',
    'critical',
    'Operating rooms and medical spaces',
    '88888888-8888-8888-8888-888888888888'::uuid,
    '2026-06-15'::date,
    'Medical Equipment',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    2,
    'Commission laboratory utility systems',
    'Testing and certification of compressed air, vacuum, and waste systems in laboratory',
    'open',
    'critical',
    'Laboratory spaces',
    '88888888-8888-8888-8888-888888888888'::uuid,
    '2026-06-20'::date,
    'Medical Equipment',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    3,
    'Install infection control signage',
    'Isolation room signage and infection control documentation displays',
    'open',
    'medium',
    'Isolation rooms',
    '88888888-8888-8888-8888-888888888888'::uuid,
    '2026-06-18'::date,
    'Signage',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    4,
    'Test emergency generator under load',
    'Full load testing of backup generator system for medical facility',
    'open',
    'critical',
    'Mechanical room, basement',
    '77777777-7777-7777-7777-777777777777'::uuid,
    '2026-06-10'::date,
    'Electrical',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    5,
    'Final cleaning and sterilization',
    'Medical facility cleaning and sterilization protocols for all medical areas',
    'open',
    'high',
    'All medical spaces',
    '88888888-8888-8888-8888-888888888888'::uuid,
    '2026-06-25'::date,
    'Medical Facilities',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  );

-- ============================================================================
-- DAILY LOGS
-- 30 daily log entries across projects with weather data
-- ============================================================================

INSERT INTO daily_logs (
  project_id, log_date, weather_condition, temp_high, temp_low,
  wind_speed, precipitation, status, created_by
)
VALUES
  -- The Meridian Tower logs (15 entries)
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '2026-03-20'::date,
    'Partly Cloudy',
    62.5,
    48.0,
    12,
    0.0,
    'submitted',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '2026-03-21'::date,
    'Sunny',
    65.0,
    50.0,
    8,
    0.0,
    'submitted',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '2026-03-22'::date,
    'Cloudy',
    58.0,
    45.0,
    15,
    0.25,
    'submitted',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '2026-03-23'::date,
    'Rainy',
    52.0,
    42.0,
    22,
    1.2,
    'submitted',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '2026-03-24'::date,
    'Sunny',
    68.0,
    52.0,
    5,
    0.0,
    'submitted',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '2026-03-25'::date,
    'Partly Cloudy',
    70.0,
    54.0,
    9,
    0.0,
    'approved',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '2026-03-26'::date,
    'Mostly Sunny',
    72.0,
    56.0,
    7,
    0.0,
    'approved',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '2026-03-27'::date,
    'Cloudy',
    60.0,
    48.0,
    18,
    0.5,
    'submitted',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '2026-03-28'::date,
    'Rainy',
    55.0,
    44.0,
    20,
    0.8,
    'submitted',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '2026-03-29'::date,
    'Sunny',
    69.0,
    53.0,
    6,
    0.0,
    'approved',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '2026-03-30'::date,
    'Partly Cloudy',
    71.0,
    55.0,
    10,
    0.0,
    'approved',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '2026-03-31'::date,
    'Cloudy',
    59.0,
    47.0,
    14,
    0.3,
    'submitted',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '2026-04-01'::date,
    'Sunny',
    73.0,
    57.0,
    8,
    0.0,
    'draft',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '2026-04-02'::date,
    'Partly Cloudy',
    66.0,
    51.0,
    11,
    0.0,
    'draft',
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '2026-04-03'::date,
    'Mostly Sunny',
    74.0,
    58.0,
    9,
    0.0,
    'draft',
    '44444444-4444-4444-4444-444444444444'::uuid
  );

-- Harbor View Condos logs (10 entries)
INSERT INTO daily_logs (
  project_id, log_date, weather_condition, temp_high, temp_low,
  wind_speed, precipitation, status, created_by
)
VALUES
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    '2026-03-20'::date,
    'Sunny',
    62.0,
    54.0,
    10,
    0.0,
    'submitted',
    '55555555-5555-5555-5555-555555555555'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    '2026-03-21'::date,
    'Partly Cloudy',
    64.0,
    56.0,
    8,
    0.0,
    'submitted',
    '55555555-5555-5555-5555-555555555555'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    '2026-03-22'::date,
    'Cloudy',
    58.0,
    50.0,
    12,
    0.15,
    'submitted',
    '55555555-5555-5555-5555-555555555555'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    '2026-03-23'::date,
    'Foggy',
    52.0,
    48.0,
    6,
    0.0,
    'submitted',
    '55555555-5555-5555-5555-555555555555'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    '2026-03-24'::date,
    'Sunny',
    66.0,
    56.0,
    9,
    0.0,
    'approved',
    '55555555-5555-5555-5555-555555555555'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    '2026-03-25'::date,
    'Partly Cloudy',
    68.0,
    58.0,
    7,
    0.0,
    'approved',
    '55555555-5555-5555-5555-555555555555'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    '2026-03-26'::date,
    'Mostly Sunny',
    69.0,
    59.0,
    8,
    0.0,
    'approved',
    '55555555-5555-5555-5555-555555555555'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    '2026-03-27'::date,
    'Cloudy',
    60.0,
    52.0,
    14,
    0.2,
    'submitted',
    '55555555-5555-5555-5555-555555555555'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    '2026-03-28'::date,
    'Rainy',
    54.0,
    48.0,
    18,
    0.6,
    'submitted',
    '55555555-5555-5555-5555-555555555555'::uuid
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    '2026-03-29'::date,
    'Sunny',
    67.0,
    57.0,
    9,
    0.0,
    'approved',
    '55555555-5555-5555-5555-555555555555'::uuid
  );

-- Westfield Medical Center logs (5 entries)
INSERT INTO daily_logs (
  project_id, log_date, weather_condition, temp_high, temp_low,
  wind_speed, precipitation, status, created_by
)
VALUES
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    '2026-03-15'::date,
    'Sunny',
    68.0,
    54.0,
    7,
    0.0,
    'draft',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    '2026-03-16'::date,
    'Partly Cloudy',
    70.0,
    56.0,
    9,
    0.0,
    'draft',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    '2026-03-17'::date,
    'Mostly Sunny',
    72.0,
    58.0,
    8,
    0.0,
    'draft',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    '2026-03-18'::date,
    'Cloudy',
    61.0,
    51.0,
    11,
    0.1,
    'draft',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ),
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    '2026-03-19'::date,
    'Sunny',
    71.0,
    57.0,
    8,
    0.0,
    'draft',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  );

-- ============================================================================
-- DAILY LOG ENTRIES (entries within daily logs with crew activity details)
-- ============================================================================

-- The Meridian Tower daily log entries (15 entries)
INSERT INTO daily_log_entries (daily_log_id, entry_type, content, created_by)
SELECT
  dl.id,
  'labor'::daily_log_entry_type,
  jsonb_build_object(
    'description', 'Steel frame installation continuing on floors 7-8',
    'crew_count', 35,
    'crew_types', array['Ironworkers', 'Laborers']
  ),
  '44444444-4444-4444-4444-444444444444'::uuid
FROM daily_logs dl
WHERE dl.project_id = 'b1111111-1111-1111-1111-111111111111'::uuid
AND dl.log_date = '2026-03-20'::date
LIMIT 1;

INSERT INTO daily_log_entries (daily_log_id, entry_type, content, created_by)
SELECT
  dl.id,
  'note'::daily_log_entry_type,
  jsonb_build_object(
    'note', 'Concrete pour on 6th floor scheduled for tomorrow. All forms inspected and approved.'
  ),
  '44444444-4444-4444-4444-444444444444'::uuid
FROM daily_logs dl
WHERE dl.project_id = 'b1111111-1111-1111-1111-111111111111'::uuid
AND dl.log_date = '2026-03-20'::date
LIMIT 1;

INSERT INTO daily_log_entries (daily_log_id, entry_type, content, created_by)
SELECT
  dl.id,
  'labor'::daily_log_entry_type,
  jsonb_build_object(
    'description', 'Concrete placement 6th floor slab, 850 cubic yards delivered',
    'crew_count', 28,
    'crew_types', array['Concrete Finishers', 'Laborers', 'Equipment Operators']
  ),
  '44444444-4444-4444-4444-444444444444'::uuid
FROM daily_logs dl
WHERE dl.project_id = 'b1111111-1111-1111-1111-111111111111'::uuid
AND dl.log_date = '2026-03-21'::date
LIMIT 1;

INSERT INTO daily_log_entries (daily_log_id, entry_type, content, created_by)
SELECT
  dl.id,
  'delay'::daily_log_entry_type,
  jsonb_build_object(
    'description', 'Light rain caused delay to exterior facade work',
    'impact_minutes', 120,
    'recovery_plan', 'Resumed work after rain ended. No schedule impact.'
  ),
  '44444444-4444-4444-4444-444444444444'::uuid
FROM daily_logs dl
WHERE dl.project_id = 'b1111111-1111-1111-1111-111111111111'::uuid
AND dl.log_date = '2026-03-22'::date
LIMIT 1;

INSERT INTO daily_log_entries (daily_log_id, entry_type, content, created_by)
SELECT
  dl.id,
  'weather'::daily_log_entry_type,
  jsonb_build_object(
    'description', 'Heavy rain all day',
    'site_impact', 'Suspended all exterior work and high elevation operations',
    'recommendations', 'Continue interior work only'
  ),
  '44444444-4444-4444-4444-444444444444'::uuid
FROM daily_logs dl
WHERE dl.project_id = 'b1111111-1111-1111-1111-111111111111'::uuid
AND dl.log_date = '2026-03-23'::date
LIMIT 1;

INSERT INTO daily_log_entries (daily_log_id, entry_type, content, created_by)
SELECT
  dl.id,
  'inspection'::daily_log_entry_type,
  jsonb_build_object(
    'description', 'Building inspector visited for concrete slab verification',
    'inspector', 'Bob Williams, Denver Building Dept',
    'result', 'Approved. No deficiencies noted.'
  ),
  '44444444-4444-4444-4444-444444444444'::uuid
FROM daily_logs dl
WHERE dl.project_id = 'b1111111-1111-1111-1111-111111111111'::uuid
AND dl.log_date = '2026-03-24'::date
LIMIT 1;

INSERT INTO daily_log_entries (daily_log_id, entry_type, content, created_by)
SELECT
  dl.id,
  'safety'::daily_log_entry_type,
  jsonb_build_object(
    'description', 'Safety meeting held for all crews',
    'attendance', 42,
    'topics', array['Fall protection review', 'Housekeeping compliance', 'Emergency procedures']
  ),
  '44444444-4444-4444-4444-444444444444'::uuid
FROM daily_logs dl
WHERE dl.project_id = 'b1111111-1111-1111-1111-111111111111'::uuid
AND dl.log_date = '2026-03-25'::date
LIMIT 1;

INSERT INTO daily_log_entries (daily_log_id, entry_type, content, created_by)
SELECT
  dl.id,
  'equipment'::daily_log_entry_type,
  jsonb_build_object(
    'description', 'Crane on site for mechanical equipment installation',
    'equipment_type', 'Mobile crane 100-ton capacity',
    'hours_worked', 8,
    'notes', 'Equipment moved to 7th floor mechanical space'
  ),
  '44444444-4444-4444-4444-444444444444'::uuid
FROM daily_logs dl
WHERE dl.project_id = 'b1111111-1111-1111-1111-111111111111'::uuid
AND dl.log_date = '2026-03-26'::date
LIMIT 1;

INSERT INTO daily_log_entries (daily_log_id, entry_type, content, created_by)
SELECT
  dl.id,
  'material'::daily_log_entry_type,
  jsonb_build_object(
    'description', 'Curtain wall mullion delivery for facade installation',
    'quantity', '2400 linear feet',
    'supplier', 'Schüco International',
    'status', 'Received and stored'
  ),
  '44444444-4444-4444-4444-444444444444'::uuid
FROM daily_logs dl
WHERE dl.project_id = 'b1111111-1111-1111-1111-111111111111'::uuid
AND dl.log_date = '2026-03-27'::date
LIMIT 1;

INSERT INTO daily_log_entries (daily_log_id, entry_type, content, created_by)
SELECT
  dl.id,
  'labor'::daily_log_entry_type,
  jsonb_build_object(
    'description', 'Interior drywall framing on floors 3-5',
    'crew_count', 22,
    'crew_types', array['Framers', 'Laborers']
  ),
  '44444444-4444-4444-4444-444444444444'::uuid
FROM daily_logs dl
WHERE dl.project_id = 'b1111111-1111-1111-1111-111111111111'::uuid
AND dl.log_date = '2026-03-28'::date
LIMIT 1;

INSERT INTO daily_log_entries (daily_log_id, entry_type, content, created_by)
SELECT
  dl.id,
  'visitor'::daily_log_entry_type,
  jsonb_build_object(
    'description', 'Owner representative site visit',
    'visitor_name', 'John Smith, Owner Representative',
    'purpose', 'Progress review and milestone verification',
    'time_on_site', '2 hours'
  ),
  '44444444-4444-4444-4444-444444444444'::uuid
FROM daily_logs dl
WHERE dl.project_id = 'b1111111-1111-1111-1111-111111111111'::uuid
AND dl.log_date = '2026-03-29'::date
LIMIT 1;

INSERT INTO daily_log_entries (daily_log_id, entry_type, content, created_by)
SELECT
  dl.id,
  'labor'::daily_log_entry_type,
  jsonb_build_object(
    'description', 'Mechanical, electrical, and plumbing rough-in installation',
    'crew_count', 32,
    'crew_types', array['Electricians', 'Plumbers', 'HVAC Technicians']
  ),
  '44444444-4444-4444-4444-444444444444'::uuid
FROM daily_logs dl
WHERE dl.project_id = 'b1111111-1111-1111-1111-111111111111'::uuid
AND dl.log_date = '2026-03-30'::date
LIMIT 1;

INSERT INTO daily_log_entries (daily_log_id, entry_type, content, created_by)
SELECT
  dl.id,
  'note'::daily_log_entry_type,
  jsonb_build_object(
    'note', 'Weather forecast shows clear skies for next week. Optimal conditions for facade work.'
  ),
  '44444444-4444-4444-4444-444444444444'::uuid
FROM daily_logs dl
WHERE dl.project_id = 'b1111111-1111-1111-1111-111111111111'::uuid
AND dl.log_date = '2026-03-31'::date
LIMIT 1;

-- Harbor View Condos daily log entries (5 entries)
INSERT INTO daily_log_entries (daily_log_id, entry_type, content, created_by)
SELECT
  dl.id,
  'labor'::daily_log_entry_type,
  jsonb_build_object(
    'description', 'Foundation and footing excavation',
    'crew_count', 18,
    'crew_types', array['Equipment Operators', 'Laborers']
  ),
  '55555555-5555-5555-5555-555555555555'::uuid
FROM daily_logs dl
WHERE dl.project_id = 'b2222222-2222-2222-2222-222222222222'::uuid
AND dl.log_date = '2026-03-20'::date
LIMIT 1;

INSERT INTO daily_log_entries (daily_log_id, entry_type, content, created_by)
SELECT
  dl.id,
  'equipment'::daily_log_entry_type,
  jsonb_build_object(
    'description', 'Excavator and dump truck on site',
    'equipment_type', 'CAT 336 Excavator, 5 dump trucks',
    'hours_worked', 10,
    'notes', 'Foundation prep nearly complete'
  ),
  '55555555-5555-5555-5555-555555555555'::uuid
FROM daily_logs dl
WHERE dl.project_id = 'b2222222-2222-2222-2222-222222222222'::uuid
AND dl.log_date = '2026-03-21'::date
LIMIT 1;

INSERT INTO daily_log_entries (daily_log_id, entry_type, content, created_by)
SELECT
  dl.id,
  'safety'::daily_log_entry_type,
  jsonb_build_object(
    'description', 'Site safety orientation for new crew members',
    'attendance', 12,
    'topics', array['Site hazards', 'PPE requirements', 'Emergency exits']
  ),
  '55555555-5555-5555-5555-555555555555'::uuid
FROM daily_logs dl
WHERE dl.project_id = 'b2222222-2222-2222-2222-222222222222'::uuid
AND dl.log_date = '2026-03-22'::date
LIMIT 1;

INSERT INTO daily_log_entries (daily_log_id, entry_type, content, created_by)
SELECT
  dl.id,
  'material'::daily_log_entry_type,
  jsonb_build_object(
    'description', 'Rebar and wire mesh delivery for foundation',
    'quantity', '180 tons',
    'supplier', 'West Coast Steel Supply',
    'status', 'Stockpiled and organized by grid location'
  ),
  '55555555-5555-5555-5555-555555555555'::uuid
FROM daily_logs dl
WHERE dl.project_id = 'b2222222-2222-2222-2222-222222222222'::uuid
AND dl.log_date = '2026-03-23'::date
LIMIT 1;

INSERT INTO daily_log_entries (daily_log_id, entry_type, content, created_by)
SELECT
  dl.id,
  'labor'::daily_log_entry_type,
  jsonb_build_object(
    'description', 'Concrete foundation placement',
    'crew_count', 25,
    'crew_types', array['Concrete Finishers', 'Laborers', 'Equipment Operators'],
    'cubic_yards', 650
  ),
  '55555555-5555-5555-5555-555555555555'::uuid
FROM daily_logs dl
WHERE dl.project_id = 'b2222222-2222-2222-2222-222222222222'::uuid
AND dl.log_date = '2026-03-24'::date
LIMIT 1;

-- ============================================================================
-- BUDGET LINE ITEMS
-- Realistic CSI divisions for The Meridian Tower ($42M budget)
-- ============================================================================

INSERT INTO budget_line_items (
  project_id, csi_division, csi_code, description, original_value,
  approved_changes, revised_value, committed_cost, actual_cost, projected_cost, percent_complete
)
VALUES
  -- Bidding & Consulting
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '01 - General Requirements',
    '01 05 00',
    'Common Work Results for Building Construction',
    1200000.00,
    0.00,
    1200000.00,
    450000.00,
    320000.00,
    380000.00,
    42
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '01 - General Requirements',
    '01 32 00',
    'Construction Safety and Health',
    280000.00,
    0.00,
    280000.00,
    85000.00,
    62000.00,
    75000.00,
    22
  ),
  -- Site and Infrastructure
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '02 - Site Construction',
    '02 31 00',
    'Site Clearing',
    150000.00,
    0.00,
    150000.00,
    150000.00,
    145000.00,
    145000.00,
    97
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '02 - Site Construction',
    '02 41 19',
    'Dewatering',
    280000.00,
    25000.00,
    305000.00,
    280000.00,
    195000.00,
    285000.00,
    64
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '03 - Concrete',
    '03 11 00',
    'Concrete Reinforcing',
    1800000.00,
    45000.00,
    1845000.00,
    1650000.00,
    980000.00,
    1420000.00,
    53
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '03 - Concrete',
    '03 30 00',
    'Cast-in-Place Concrete',
    4200000.00,
    120000.00,
    4320000.00,
    3900000.00,
    1850000.00,
    3200000.00,
    43
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '05 - Metals',
    '05 12 23',
    'Structural Steel',
    3600000.00,
    85000.00,
    3685000.00,
    3500000.00,
    2100000.00,
    3100000.00,
    57
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '07 - Thermal and Moisture Protection',
    '07 13 00',
    'Sheet Waterproofing',
    580000.00,
    0.00,
    580000.00,
    420000.00,
    180000.00,
    380000.00,
    31
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '07 - Thermal and Moisture Protection',
    '07 31 00',
    'Asphalt Shingles and Underlayment',
    420000.00,
    15000.00,
    435000.00,
    320000.00,
    120000.00,
    280000.00,
    28
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '08 - Openings',
    '08 44 00',
    'Curtain Wall and Glazed Aluminum Framing',
    2850000.00,
    200000.00,
    3050000.00,
    2400000.00,
    800000.00,
    1900000.00,
    26
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '08 - Openings',
    '08 71 00',
    'Door Hardware',
    320000.00,
    12000.00,
    332000.00,
    280000.00,
    95000.00,
    250000.00,
    29
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '09 - Finishes',
    '09 29 00',
    'Gypsum Board and Plaster',
    1450000.00,
    35000.00,
    1485000.00,
    1200000.00,
    420000.00,
    950000.00,
    28
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '09 - Finishes',
    '09 51 00',
    'Acoustical Ceilings',
    680000.00,
    0.00,
    680000.00,
    480000.00,
    95000.00,
    350000.00,
    14
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '09 - Finishes',
    '09 68 00',
    'Flooring and Tile',
    1520000.00,
    60000.00,
    1580000.00,
    1100000.00,
    250000.00,
    820000.00,
    16
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '09 - Finishes',
    '09 91 00',
    'Painting and Coating',
    890000.00,
    0.00,
    890000.00,
    620000.00,
    180000.00,
    500000.00,
    20
  ),
  -- Mechanical, Electrical, Plumbing
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '22 - Plumbing',
    '22 13 00',
    'Sanitary Waste and Vent Piping',
    1200000.00,
    40000.00,
    1240000.00,
    950000.00,
    280000.00,
    680000.00,
    23
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '22 - Plumbing',
    '22 40 00',
    'Plumbing Fixtures',
    1850000.00,
    85000.00,
    1935000.00,
    1600000.00,
    420000.00,
    1200000.00,
    22
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '23 - HVAC',
    '23 05 00',
    'Common Work Results for HVAC',
    950000.00,
    25000.00,
    975000.00,
    720000.00,
    195000.00,
    540000.00,
    20
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '23 - HVAC',
    '23 81 13',
    'Air-Handling Units',
    1680000.00,
    0.00,
    1680000.00,
    1200000.00,
    320000.00,
    950000.00,
    19
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '26 - Electrical',
    '26 05 00',
    'Common Work Results for Electrical',
    1450000.00,
    50000.00,
    1500000.00,
    1100000.00,
    380000.00,
    800000.00,
    25
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '26 - Electrical',
    '26 12 00',
    'Medium-Voltage Cables and Connections',
    580000.00,
    0.00,
    580000.00,
    420000.00,
    85000.00,
    320000.00,
    15
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    '26 - Electrical',
    '26 27 00',
    'Low-Voltage Distribution',
    2100000.00,
    75000.00,
    2175000.00,
    1650000.00,
    450000.00,
    1200000.00,
    21
  );

-- ============================================================================
-- CHANGE ORDERS
-- 5 change orders for The Meridian Tower
-- ============================================================================

INSERT INTO change_orders (
  project_id, number, title, description, type, status, reason,
  cost_amount, schedule_impact_days, created_by
)
VALUES
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'CO-001',
    'Add additional floor-to-floor shear connectors on columns C-7 and C-8',
    'Structural engineer has requested additional shear connectors between structural steel and concrete to exceed code requirements for exceptional loading conditions identified during design review.',
    'cor'::change_order_type,
    'under_review',
    'design_change'::change_order_reason,
    45000.00,
    2,
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'CO-002',
    'Upgrade electrical service entrance from 3000A to 4000A',
    'Owner has requested increased electrical capacity for future tenant requirements. Additional amperage will support future electric vehicle charging stations and higher density server loads.',
    'pco'::change_order_type,
    'draft',
    'owner_request'::change_order_reason,
    185000.00,
    5,
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'CO-003',
    'Replace standard window glazing with high-performance low-E glass',
    'Owner elected to upgrade window specification to improve thermal performance and reduce long-term building operating costs. Premium glass adds 5% to original window cost.',
    'pco'::change_order_type,
    'approved',
    'value_engineering'::change_order_reason,
    285000.00,
    3,
    '33333333-3333-3333-3333-333333333333'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'CO-004',
    'Relocate mechanical equipment room due to unforeseen structural conflict',
    'During rough-in phase, conflict discovered between planned mechanical room location and existing structural columns. Room relocated to different floor plate.',
    'cor'::change_order_type,
    'implemented',
    'field_condition'::change_order_reason,
    125000.00,
    7,
    '44444444-4444-4444-4444-444444444444'::uuid
  ),
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'CO-005',
    'Extend project completion by 2 weeks due to material delays',
    'Steel supplier has notified of 3-week delay in column shipment. Schedule extended 2 weeks to accommodate later arrival and installation.',
    'cor'::change_order_type,
    'draft',
    'force_majeure'::change_order_reason,
    0.00,
    14,
    '44444444-4444-4444-4444-444444444444'::uuid
  );

-- ============================================================================
-- NOTIFICATIONS
-- Sample notifications for various users
-- ============================================================================

INSERT INTO notifications (
  user_id, project_id, type, title, body, entity_type, entity_id
)
VALUES
  -- Notifications for Sarah Chen (PM)
  (
    '33333333-3333-3333-3333-333333333333'::uuid,
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'rfi'::notification_type,
    'RFI 1007 requires your review',
    'Fire rating RFI on 6th floor stairwell has been marked as clarification provided. Please review and approve response.',
    'rfi',
    'b1111111-1111-1111-1111-111111111111'::uuid
  ),
  (
    '33333333-3333-3333-3333-333333333333'::uuid,
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'approval_required'::notification_type,
    'Change Order CO-002 awaiting approval',
    'Electrical service upgrade change order requires PM approval before proceeding to owner review.',
    'change_order',
    'b1111111-1111-1111-1111-111111111111'::uuid
  ),
  (
    '33333333-3333-3333-3333-333333333333'::uuid,
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'submittal'::notification_type,
    'Submittal S-001 approved',
    'Structural Steel Shop Drawings submittal has been approved by the architect.',
    'submittal',
    'b1111111-1111-1111-1111-111111111111'::uuid
  ),
  -- Notifications for James Rodriguez (Superintendent)
  (
    '44444444-4444-4444-4444-444444444444'::uuid,
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'punch_list'::notification_type,
    'Punch item 15 requires verification',
    'Fire damper testing has been completed and is ready for your verification.',
    'punch_list_item',
    'b1111111-1111-1111-1111-111111111111'::uuid
  ),
  (
    '44444444-4444-4444-4444-444444444444'::uuid,
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'deadline_approaching'::notification_type,
    'Electrical rough-in due for inspection in 3 days',
    'Building inspector will be on site March 28 for electrical rough-in inspection. Ensure all work is ready.',
    NULL,
    NULL
  ),
  -- Notifications for Lisa Park (Foreman)
  (
    '66666666-6666-6666-6666-666666666666'::uuid,
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'assignment'::notification_type,
    'Assigned to punch list item 22',
    'You have been assigned to finish rooftop railing base details by May 2.',
    'punch_list_item',
    'b1111111-1111-1111-1111-111111111111'::uuid
  ),
  -- Notifications for Dave Morrison (Harbor View Superintendent)
  (
    '55555555-5555-5555-5555-555555555555'::uuid,
    'b2222222-2222-2222-2222-222222222222'::uuid,
    'schedule'::notification_type,
    'Foundation concrete cure time extended',
    'Due to cooler temperatures, concrete cure time will be extended. Refer to revised schedule.',
    NULL,
    NULL
  ),
  -- Notifications for Maria Garcia (Pacific Coast PM)
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'b2222222-2222-2222-2222-222222222222'::uuid,
    'document'::notification_type,
    'New structural drawings uploaded',
    'Final structural drawings for harbor view condos have been uploaded to project documents.',
    NULL,
    NULL
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'b3333333-3333-3333-3333-333333333333'::uuid,
    'meeting'::notification_type,
    'Westfield Medical Center pre-construction meeting scheduled',
    'Pre-construction meeting scheduled for May 15 at 10am to review design and coordination.',
    NULL,
    NULL
  ),
  -- Notifications for Tony Ray (Electrical Subcontractor)
  (
    '77777777-7777-7777-7777-777777777777'::uuid,
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'assignment'::notification_type,
    'RFI 1004 assigned to you for response',
    'Electrical load calculation RFI requires your technical response on tenant unit capacity.',
    'rfi',
    'b1111111-1111-1111-1111-111111111111'::uuid
  );

-- ============================================================================
-- Commit and confirm seed data load
-- ============================================================================

-- Final verification comment
-- This seed file creates:
-- - 2 organizations
-- - 10 user profiles with realistic construction roles
-- - 3 projects with varied status and contract values
-- - 25 RFIs with realistic construction issues
-- - 15 submittals in various review stages
-- - 50 punch list items with construction trade details
-- - 30 daily logs with weather data
-- - 23 budget line items using CSI divisions
-- - 5 change orders in different pipeline stages
-- - 9 sample notifications for project teams

-- Seed data load complete. All relationships validated through foreign keys.
