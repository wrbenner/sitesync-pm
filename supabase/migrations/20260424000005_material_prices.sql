-- ═══════════════════════════════════════════════════════════════
-- Migration: material_prices
-- Version: 20260424000005
-- Purpose: Platform-level material price time series, consumed by
--          useMaterialPriceTrends (src/hooks/usePlatformIntel.ts).
--          Columns match the SELECT in the hook:
--          (material_type, unit, price, region, recorded_at).
--
--          This is aggregated/platform-owned reference data — reads
--          are open to all authenticated users; writes are restricted
--          to the service role (the ingestion pipeline bypasses RLS
--          with the service key).
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS material_prices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_type  text NOT NULL,
  unit           text NOT NULL,
  price          numeric(14, 4) NOT NULL,
  region         text NOT NULL DEFAULT '',
  source         text,
  recorded_at    timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_material_prices_type_recorded
  ON material_prices (material_type, recorded_at);
CREATE INDEX IF NOT EXISTS idx_material_prices_region_recorded
  ON material_prices (region, recorded_at);

-- ── updated_at trigger ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_material_prices_updated_at ON material_prices;
CREATE TRIGGER trg_material_prices_updated_at
  BEFORE UPDATE ON material_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE material_prices ENABLE ROW LEVEL SECURITY;

-- Platform-owned reference data: readable by anyone authenticated.
DROP POLICY IF EXISTS material_prices_select ON material_prices;
CREATE POLICY material_prices_select ON material_prices FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- No end-user writes. Ingestion uses the service role key, which
-- bypasses RLS; intentionally no INSERT/UPDATE/DELETE policies here.
