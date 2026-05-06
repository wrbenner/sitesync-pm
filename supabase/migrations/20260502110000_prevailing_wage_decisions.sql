-- =============================================================================
-- prevailing_wage_decisions — DOL Davis-Bacon wage rates
-- =============================================================================
-- Effective-dated table. Hours worked before/after a rate change use the
-- respective rates. The active row for a given (state, county, trade) at
-- a given date is the one with the latest effective_from <= the date.
--
-- Real data refreshes from DOL's public API multiple times per year via the
-- prevailing-wage-sync edge function — we don't ship the table populated
-- from migrations. Seed with one example so tests have something to bite on.
-- =============================================================================

CREATE TABLE IF NOT EXISTS prevailing_wage_decisions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  /** State postal code: 'TX', 'CA'. */
  state_code      text NOT NULL,
  /** Free-text county. Some DOL determinations apply state-wide; that case
   *  uses '*' as a sentinel so the lookup still hits. */
  county          text NOT NULL,
  /** Trade name as it appears in DOL Wage Determinations (e.g. 'Electrician',
   *  'Carpenter (Form Setter)'). Matched case-insensitively against the
   *  worker's normalized trade. */
  trade           text NOT NULL,
  /** Apprentice classification ID per the registered apprenticeship program.
   *  null = journeyman rate. */
  apprentice_level integer,
  /** Per-hour base rate, USD. */
  base_rate       numeric(10,2) NOT NULL,
  /** Per-hour fringe rate, USD. The contractor may pay fringes either as
   *  cash or by contributions to bona fide plans; the WH-347 generator
   *  honors the contractor's per-worker fringe allocation. */
  fringe_rate     numeric(10,2) NOT NULL DEFAULT 0,
  /** OT premium multiplier; 1.5 by default for Davis-Bacon. */
  overtime_multiplier numeric(4,2) NOT NULL DEFAULT 1.5,
  /** DOL wage decision number, e.g. 'TX20240001'. Surfaced on WH-347 as
   *  the wage determination reference. */
  wage_decision_number text,
  /** ISO date — when this rate becomes effective. */
  effective_from  date NOT NULL,
  /** ISO date — when this rate was superseded (nullable; current row = null). */
  effective_to    date,
  /** Source: 'dol_api' | 'manual' | 'csv_import'. */
  source          text NOT NULL DEFAULT 'dol_api',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pwd_lookup
  ON prevailing_wage_decisions(state_code, county, trade, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_pwd_decision_number
  ON prevailing_wage_decisions(wage_decision_number);
-- Effective-date queries: "what was the rate on date D?"
CREATE INDEX IF NOT EXISTS idx_pwd_effective_window
  ON prevailing_wage_decisions(state_code, county, trade, effective_from, effective_to);

ALTER TABLE prevailing_wage_decisions ENABLE ROW LEVEL SECURITY;

-- Org-wide read access — wage rates aren't project-secret data.
DO $$ BEGIN
  CREATE POLICY pwd_authenticated_select ON prevailing_wage_decisions
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Seed: one county, two trades for tests ─────────────────────
INSERT INTO prevailing_wage_decisions
  (state_code, county, trade, apprentice_level, base_rate, fringe_rate, wage_decision_number, effective_from, source)
VALUES
  ('TX', 'Travis', 'Electrician',                NULL, 38.50,  9.20, 'TX20260001', '2026-01-01', 'manual'),
  ('TX', 'Travis', 'Electrician (Apprentice 1)', 1,    23.10,  6.20, 'TX20260001', '2026-01-01', 'manual'),
  ('TX', 'Travis', 'Carpenter',                  NULL, 32.75,  7.85, 'TX20260001', '2026-01-01', 'manual')
ON CONFLICT DO NOTHING;
