-- =============================================================================
-- Change Orders: cost_impact column (integer cents)
-- =============================================================================
--
-- PURPOSE: Add cost_impact (bigint, integer cents) to change_orders.
-- Architecture Law §9: financial calculations use integer cents, never floats.
-- The existing amount column stores a float dollar value and is kept for
-- backward compatibility. cost_impact is the authoritative cents field.
--
-- TABLES AFFECTED:
--   change_orders — add cost_impact bigint
--
-- BACKWARD COMPATIBILITY:
--   Nullable with no default. Existing rows get NULL. No existing queries break.
--
-- ROLLBACK:
--   ALTER TABLE change_orders DROP COLUMN IF EXISTS cost_impact;
-- =============================================================================

BEGIN;

ALTER TABLE change_orders
  ADD COLUMN IF NOT EXISTS cost_impact bigint;

COMMENT ON COLUMN change_orders.cost_impact
  IS 'Cost impact in integer cents (positive = cost increase, negative = cost decrease). Architecture Law §9.';

COMMIT;
