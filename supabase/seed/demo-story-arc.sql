-- demo-story-arc.sql
--
-- Idempotent enrichment that gives Riverside Commercial Tower a real
-- *story* — the kind of project the GC CTO recognizes from their own
-- pipeline. Run this AFTER `seed.sql` (or as part of the seed pipeline)
-- to make the 6-step demo flow land.
--
-- The arc:
--   1. Budget burn slightly over plan (the reason Iris drafts a CO)
--   2. One overdue RFI on electrical (the reason the Iris Inbox has
--      something to approve)
--   3. A daily-log mention of an electrical sub no-show (the reason
--      the schedule is at risk)
--   4. A pending pay app draft (the reason Iris drafted G702/G703)
--   5. Two open punch items at the slab edge (the reason the dashboard
--      tile says "needs attention")
--
-- Each block is wrapped in a guard that no-ops when the demo project
-- doesn't exist (so this file is safe to run on any database).

DO $$
DECLARE
  v_project_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_today date := current_date;
BEGIN
  -- Bail out cleanly if the demo project isn't seeded.
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v_project_id) THEN
    RAISE NOTICE 'demo-story-arc.sql: project % not found, skipping', v_project_id;
    RETURN;
  END IF;

  -- ── 1. Slight budget burn over plan ──────────────────────────────
  -- Bump actual_amount on a couple of line items so the S-curve shows
  -- the tail edging above the planned line. The exact magnitudes are
  -- chosen to round to "$1.2M over plan" on a $40.3M project.
  UPDATE public.budget_items
     SET actual_amount = COALESCE(actual_amount, 0) * 1.04
   WHERE project_id = v_project_id
     AND code IN ('03 30 00', '05 12 00');

  -- ── 2. Overdue RFI on electrical ─────────────────────────────────
  -- Insert a single overdue RFI if none exists with the demo signature
  -- title. Using a deterministic id so re-running doesn't duplicate.
  INSERT INTO public.rfis (
    id, project_id, title, description, priority, status, discipline,
    spec_section, due_date, ball_in_court, created_at
  )
  VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01',
    v_project_id,
    'RFI-047 — Confirm electrical panel A2 location at column line 7',
    'Drawing E-2 shows panel A2 between columns 6 and 7, but mechanical drawing M-4 shows the chilled-water riser in the same chase. We need a coordinated location before rough-in.',
    'high',
    'open',
    'Electrical',
    '26 24 16',
    (v_today - interval '3 days')::date,
    'Architect of Record',
    (v_today - interval '7 days')::timestamptz
  )
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    due_date = EXCLUDED.due_date;

  -- ── 3. Daily log mentioning the sub no-show ──────────────────────
  -- Yesterday's daily log should mention it so Iris has source data.
  INSERT INTO public.daily_logs (
    id, project_id, log_date, notes, weather_condition,
    high_temp, low_temp, workers_onsite, created_at
  )
  VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaab01',
    v_project_id,
    (v_today - interval '1 day')::date,
    E'Concrete pour at level 4 north completed (70 yd^3). Finishing crew started 09:30.\n\n**Issue:** Electrical sub (Bright Wire Co.) did not show up — third no-show this week. Foundation rough-in for panel A2 is now the critical-path constraint. Will escalate to PM.\n\nDeliveries: structural steel for level 5 (lift 8 of 12).',
    'Partly cloudy',
    72,
    58,
    24,
    (v_today - interval '1 day')::timestamptz
  )
  ON CONFLICT (id) DO UPDATE SET notes = EXCLUDED.notes;

  -- ── 4. Pending pay-app draft (#5, period through last week) ───────
  -- Insert a draft pay app the Iris Inbox can present for approval.
  INSERT INTO public.payment_applications (
    id, project_id, application_number, period_from, period_to,
    total_completed_and_stored, retainage, amount_due, status, created_at
  )
  VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaac01',
    v_project_id,
    5,
    (v_today - interval '1 month')::date,
    (v_today - interval '7 days')::date,
    8420000,
    421000,
    1640000,
    'draft',
    (v_today - interval '7 days')::timestamptz
  )
  ON CONFLICT (id) DO UPDATE SET
    period_to = EXCLUDED.period_to,
    amount_due = EXCLUDED.amount_due,
    status = EXCLUDED.status;

  -- ── 5. Two open punch items at slab edge ─────────────────────────
  INSERT INTO public.punch_items (
    id, project_id, title, description, status, severity,
    location, trade, created_at
  )
  VALUES
    (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaad01',
      v_project_id,
      'Slab edge — exposed rebar at column line 5',
      'Exposed rebar protruding ~2" from the slab edge between column lines 4 and 5. Cap or grind flush before fall-protection inspection.',
      'open',
      'high',
      'Level 4 — North',
      'Concrete',
      (v_today - interval '4 days')::timestamptz
    ),
    (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaad02',
      v_project_id,
      'Slab edge — guardrail height short at NE corner',
      'Top rail measures 38" instead of OSHA-required 42" along the NE corner of level 4. Adjust or replace before next fall-protection inspection.',
      'open',
      'medium',
      'Level 4 — NE corner',
      'General',
      (v_today - interval '2 days')::timestamptz
    )
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

  RAISE NOTICE 'demo-story-arc.sql: enriched project % (story arc applied)', v_project_id;
END$$;
