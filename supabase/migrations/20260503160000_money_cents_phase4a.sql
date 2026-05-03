-- Money-Cents Migration — Phase 4a
-- =============================================================================
-- Day 17 / Phase 4 of the Lap-1 money-cents migration.
--
-- Purpose: add `*_cents bigint` columns alongside every active-path money
-- column in the construction-billing surface so the application can transition
-- from `numeric` to integer cents WITHOUT a flag day. The application reads
-- prefer the `*_cents` column when present and fall back to ROUND(col*100)
-- on the legacy column. After a soak window (no drift detected for ≥7 days
-- via the CHECK constraints below), Phase 4d will drop the legacy columns.
--
-- Scope (matches MONEY_CENTS_AUDIT_2026-05-01.md, narrowed to active-path
-- tables; deprecated/unused tables are deferred to a follow-up):
--   pay_applications        — 8 money columns
--   pay_application_line_items — 6 money columns
--   change_orders           — 4 money columns
--   change_order_line_items — 2 money columns
--   budget_items            — 4 money columns
--   contracts               — 2 money columns
--   lien_waivers            — 1 money column
--
-- Out of scope for 4a (deferred — these tables are either deprecated, not
-- in the active billing path, or already on Cents):
--   payment_applications, payment_line_items   (deprecated mirror of pay_*)
--   subcontractor_invoices, retainage_entries, retainage_ledger,
--   budget_line_items, schedule_of_values, usage_events, plans,
--   purchase_orders, po_line_items, payment_milestones, bid_submissions,
--   bonds, permits, wip_reports, equipment, equipment_maintenance,
--   estimate_*, projects.contract_value
-- These will land in a separate Phase 4b once the primary path soaks clean.
--
-- Safety properties:
--   • Pure ADD COLUMN + UPDATE + ADD CONSTRAINT — no DROP, no RENAME.
--   • Idempotent: ADD COLUMN IF NOT EXISTS, constraint guarded by NOT EXISTS.
--   • Backfill is a single UPDATE per table, no row-by-row loops.
--   • CHECK constraints are NOT VALID initially so existing rows aren't
--     re-validated; the constraint applies only to future writes during
--     the soak window. Phase 4c will VALIDATE them.
--   • Rolls back cleanly: drop the *_cents columns and constraints; the
--     legacy `numeric` columns are untouched.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: ROUND to nearest int8 with banker's rounding (round-half-to-even)
-- ─────────────────────────────────────────────────────────────────────────────
-- Postgres `round(numeric, 0)` rounds half-away-from-zero. AIA G702 examples
-- are computed with banker's rounding (round-half-to-even) so that's what we
-- use for the backfill — same convention as src/lib/payApp/g702Audited.ts.
CREATE OR REPLACE FUNCTION public.round_half_even_cents(v numeric)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN v IS NULL THEN NULL
    -- Convert to a numeric in cents (×100) and round to even.
    -- Postgres has no native banker's rounding; emulate via offset trick:
    -- if the value rounded is exactly halfway, round to even.
    WHEN abs((v * 100) - floor(v * 100) - 0.5) < 1e-9 THEN
      CASE WHEN floor(v * 100)::bigint % 2 = 0
           THEN floor(v * 100)::bigint
           ELSE floor(v * 100)::bigint + 1
      END
    ELSE round(v * 100)::bigint
  END;
$$;

COMMENT ON FUNCTION public.round_half_even_cents(numeric) IS
  'Banker''s rounding (round-half-to-even) of a dollar value to integer cents. Matches src/lib/payApp/g702Audited.ts roundHalfEvenCents().';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. pay_applications  (8 money columns)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.pay_applications
  ADD COLUMN IF NOT EXISTS balance_to_finish_cents          bigint,
  ADD COLUMN IF NOT EXISTS contract_sum_to_date_cents       bigint,
  ADD COLUMN IF NOT EXISTS current_payment_due_cents        bigint,
  ADD COLUMN IF NOT EXISTS less_previous_certificates_cents bigint,
  ADD COLUMN IF NOT EXISTS net_change_orders_cents          bigint,
  ADD COLUMN IF NOT EXISTS original_contract_sum_cents      bigint,
  ADD COLUMN IF NOT EXISTS paid_amount_cents                bigint,
  ADD COLUMN IF NOT EXISTS retainage_cents                  bigint,
  ADD COLUMN IF NOT EXISTS total_completed_and_stored_cents bigint,
  ADD COLUMN IF NOT EXISTS total_earned_less_retainage_cents bigint;

UPDATE public.pay_applications SET
  balance_to_finish_cents          = round_half_even_cents(balance_to_finish),
  contract_sum_to_date_cents       = round_half_even_cents(contract_sum_to_date),
  current_payment_due_cents        = round_half_even_cents(current_payment_due),
  less_previous_certificates_cents = round_half_even_cents(less_previous_certificates),
  net_change_orders_cents          = round_half_even_cents(net_change_orders),
  original_contract_sum_cents      = round_half_even_cents(original_contract_sum),
  paid_amount_cents                = round_half_even_cents(paid_amount),
  retainage_cents                  = round_half_even_cents(retainage),
  total_completed_and_stored_cents = round_half_even_cents(total_completed_and_stored),
  total_earned_less_retainage_cents = round_half_even_cents(total_earned_less_retainage)
WHERE
     balance_to_finish_cents IS DISTINCT FROM round_half_even_cents(balance_to_finish)
  OR contract_sum_to_date_cents IS DISTINCT FROM round_half_even_cents(contract_sum_to_date)
  OR current_payment_due_cents IS DISTINCT FROM round_half_even_cents(current_payment_due)
  OR less_previous_certificates_cents IS DISTINCT FROM round_half_even_cents(less_previous_certificates)
  OR net_change_orders_cents IS DISTINCT FROM round_half_even_cents(net_change_orders)
  OR original_contract_sum_cents IS DISTINCT FROM round_half_even_cents(original_contract_sum)
  OR paid_amount_cents IS DISTINCT FROM round_half_even_cents(paid_amount)
  OR retainage_cents IS DISTINCT FROM round_half_even_cents(retainage)
  OR total_completed_and_stored_cents IS DISTINCT FROM round_half_even_cents(total_completed_and_stored)
  OR total_earned_less_retainage_cents IS DISTINCT FROM round_half_even_cents(total_earned_less_retainage);

-- Drift CHECK: future writes must keep the cents column == round_half_even of dollars.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pay_applications_cents_drift_chk') THEN
    ALTER TABLE public.pay_applications
      ADD CONSTRAINT pay_applications_cents_drift_chk
      CHECK (
        balance_to_finish_cents          IS NOT DISTINCT FROM round_half_even_cents(balance_to_finish)
        AND contract_sum_to_date_cents   IS NOT DISTINCT FROM round_half_even_cents(contract_sum_to_date)
        AND current_payment_due_cents    IS NOT DISTINCT FROM round_half_even_cents(current_payment_due)
        AND less_previous_certificates_cents IS NOT DISTINCT FROM round_half_even_cents(less_previous_certificates)
        AND net_change_orders_cents      IS NOT DISTINCT FROM round_half_even_cents(net_change_orders)
        AND original_contract_sum_cents  IS NOT DISTINCT FROM round_half_even_cents(original_contract_sum)
        AND paid_amount_cents            IS NOT DISTINCT FROM round_half_even_cents(paid_amount)
        AND retainage_cents              IS NOT DISTINCT FROM round_half_even_cents(retainage)
        AND total_completed_and_stored_cents IS NOT DISTINCT FROM round_half_even_cents(total_completed_and_stored)
        AND total_earned_less_retainage_cents IS NOT DISTINCT FROM round_half_even_cents(total_earned_less_retainage)
      ) NOT VALID;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. pay_application_line_items  (6 money columns)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.pay_application_line_items
  ADD COLUMN IF NOT EXISTS amount_cents             bigint,
  ADD COLUMN IF NOT EXISTS amount_this_period_cents bigint,
  ADD COLUMN IF NOT EXISTS balance_to_finish_cents  bigint,
  ADD COLUMN IF NOT EXISTS materials_stored_cents   bigint,
  ADD COLUMN IF NOT EXISTS previous_completed_cents bigint,
  ADD COLUMN IF NOT EXISTS retainage_cents          bigint,
  ADD COLUMN IF NOT EXISTS scheduled_value_cents    bigint;

UPDATE public.pay_application_line_items SET
  amount_cents             = round_half_even_cents(amount),
  amount_this_period_cents = round_half_even_cents(amount_this_period),
  balance_to_finish_cents  = round_half_even_cents(balance_to_finish),
  materials_stored_cents   = round_half_even_cents(materials_stored),
  previous_completed_cents = round_half_even_cents(previous_completed),
  retainage_cents          = round_half_even_cents(retainage),
  scheduled_value_cents    = round_half_even_cents(scheduled_value)
WHERE
     amount_cents IS DISTINCT FROM round_half_even_cents(amount)
  OR amount_this_period_cents IS DISTINCT FROM round_half_even_cents(amount_this_period)
  OR balance_to_finish_cents IS DISTINCT FROM round_half_even_cents(balance_to_finish)
  OR materials_stored_cents IS DISTINCT FROM round_half_even_cents(materials_stored)
  OR previous_completed_cents IS DISTINCT FROM round_half_even_cents(previous_completed)
  OR retainage_cents IS DISTINCT FROM round_half_even_cents(retainage)
  OR scheduled_value_cents IS DISTINCT FROM round_half_even_cents(scheduled_value);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pay_app_line_items_cents_drift_chk') THEN
    ALTER TABLE public.pay_application_line_items
      ADD CONSTRAINT pay_app_line_items_cents_drift_chk
      CHECK (
        amount_cents             IS NOT DISTINCT FROM round_half_even_cents(amount)
        AND amount_this_period_cents IS NOT DISTINCT FROM round_half_even_cents(amount_this_period)
        AND balance_to_finish_cents  IS NOT DISTINCT FROM round_half_even_cents(balance_to_finish)
        AND materials_stored_cents   IS NOT DISTINCT FROM round_half_even_cents(materials_stored)
        AND previous_completed_cents IS NOT DISTINCT FROM round_half_even_cents(previous_completed)
        AND retainage_cents          IS NOT DISTINCT FROM round_half_even_cents(retainage)
        AND scheduled_value_cents    IS NOT DISTINCT FROM round_half_even_cents(scheduled_value)
      ) NOT VALID;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. change_orders  (4 money columns)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS amount_cents          bigint,
  ADD COLUMN IF NOT EXISTS approved_cost_cents   bigint,
  ADD COLUMN IF NOT EXISTS estimated_cost_cents  bigint,
  ADD COLUMN IF NOT EXISTS submitted_cost_cents  bigint;

UPDATE public.change_orders SET
  amount_cents          = round_half_even_cents(amount),
  approved_cost_cents   = round_half_even_cents(approved_cost),
  estimated_cost_cents  = round_half_even_cents(estimated_cost),
  submitted_cost_cents  = round_half_even_cents(submitted_cost)
WHERE
     amount_cents IS DISTINCT FROM round_half_even_cents(amount)
  OR approved_cost_cents IS DISTINCT FROM round_half_even_cents(approved_cost)
  OR estimated_cost_cents IS DISTINCT FROM round_half_even_cents(estimated_cost)
  OR submitted_cost_cents IS DISTINCT FROM round_half_even_cents(submitted_cost);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'change_orders_cents_drift_chk') THEN
    ALTER TABLE public.change_orders
      ADD CONSTRAINT change_orders_cents_drift_chk
      CHECK (
        amount_cents IS NOT DISTINCT FROM round_half_even_cents(amount)
        AND approved_cost_cents IS NOT DISTINCT FROM round_half_even_cents(approved_cost)
        AND estimated_cost_cents IS NOT DISTINCT FROM round_half_even_cents(estimated_cost)
        AND submitted_cost_cents IS NOT DISTINCT FROM round_half_even_cents(submitted_cost)
      ) NOT VALID;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. change_order_line_items  (2 money columns; quantity stays numeric)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.change_order_line_items
  ADD COLUMN IF NOT EXISTS amount_cents     bigint,
  ADD COLUMN IF NOT EXISTS unit_cost_cents  bigint;

UPDATE public.change_order_line_items SET
  amount_cents     = round_half_even_cents(amount),
  unit_cost_cents  = round_half_even_cents(unit_cost)
WHERE
     amount_cents IS DISTINCT FROM round_half_even_cents(amount)
  OR unit_cost_cents IS DISTINCT FROM round_half_even_cents(unit_cost);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'change_order_line_items_cents_drift_chk') THEN
    ALTER TABLE public.change_order_line_items
      ADD CONSTRAINT change_order_line_items_cents_drift_chk
      CHECK (
        amount_cents IS NOT DISTINCT FROM round_half_even_cents(amount)
        AND unit_cost_cents IS NOT DISTINCT FROM round_half_even_cents(unit_cost)
      ) NOT VALID;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. budget_items  (4 money columns; percent_complete stays numeric)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.budget_items
  ADD COLUMN IF NOT EXISTS actual_amount_cents     bigint,
  ADD COLUMN IF NOT EXISTS committed_amount_cents  bigint,
  ADD COLUMN IF NOT EXISTS forecast_amount_cents   bigint,
  ADD COLUMN IF NOT EXISTS original_amount_cents   bigint;

UPDATE public.budget_items SET
  actual_amount_cents    = round_half_even_cents(actual_amount),
  committed_amount_cents = round_half_even_cents(committed_amount),
  forecast_amount_cents  = round_half_even_cents(forecast_amount),
  original_amount_cents  = round_half_even_cents(original_amount)
WHERE
     actual_amount_cents IS DISTINCT FROM round_half_even_cents(actual_amount)
  OR committed_amount_cents IS DISTINCT FROM round_half_even_cents(committed_amount)
  OR forecast_amount_cents IS DISTINCT FROM round_half_even_cents(forecast_amount)
  OR original_amount_cents IS DISTINCT FROM round_half_even_cents(original_amount);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budget_items_cents_drift_chk') THEN
    ALTER TABLE public.budget_items
      ADD CONSTRAINT budget_items_cents_drift_chk
      CHECK (
        actual_amount_cents IS NOT DISTINCT FROM round_half_even_cents(actual_amount)
        AND committed_amount_cents IS NOT DISTINCT FROM round_half_even_cents(committed_amount)
        AND forecast_amount_cents IS NOT DISTINCT FROM round_half_even_cents(forecast_amount)
        AND original_amount_cents IS NOT DISTINCT FROM round_half_even_cents(original_amount)
      ) NOT VALID;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. contracts  (2 money columns; retainage_percent / retention_percentage stay numeric)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS original_value_cents bigint,
  ADD COLUMN IF NOT EXISTS revised_value_cents  bigint;

UPDATE public.contracts SET
  original_value_cents = round_half_even_cents(original_value),
  revised_value_cents  = round_half_even_cents(revised_value)
WHERE
     original_value_cents IS DISTINCT FROM round_half_even_cents(original_value)
  OR revised_value_cents IS DISTINCT FROM round_half_even_cents(revised_value);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contracts_cents_drift_chk') THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_cents_drift_chk
      CHECK (
        original_value_cents IS NOT DISTINCT FROM round_half_even_cents(original_value)
        AND revised_value_cents IS NOT DISTINCT FROM round_half_even_cents(revised_value)
      ) NOT VALID;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. lien_waivers  (1 money column)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.lien_waivers
  ADD COLUMN IF NOT EXISTS amount_cents bigint;

UPDATE public.lien_waivers SET
  amount_cents = round_half_even_cents(amount)
WHERE amount_cents IS DISTINCT FROM round_half_even_cents(amount);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lien_waivers_cents_drift_chk') THEN
    ALTER TABLE public.lien_waivers
      ADD CONSTRAINT lien_waivers_cents_drift_chk
      CHECK (
        amount_cents IS NOT DISTINCT FROM round_half_even_cents(amount)
      ) NOT VALID;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification query (run after migration to confirm zero drift)
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT 'pay_applications' AS tbl,
--        sum((retainage_cents != round_half_even_cents(retainage))::int) AS drift_rows
-- FROM pay_applications
-- UNION ALL ...
-- =============================================================================
