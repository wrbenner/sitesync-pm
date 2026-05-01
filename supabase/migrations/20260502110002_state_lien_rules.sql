-- =============================================================================
-- state_lien_rules — single table, 50 states, framework-data-driven
-- =============================================================================
-- Replaces the "50 individual state files" approach with one row per
-- (state, claimant_role). Adding the remaining 40 states is data entry
-- against this schema, not new code.
--
-- The notice/lien-deadline calculator (src/lib/compliance/lienRights/) walks
-- this table — it never branches per state. State-specific edge cases (NY's
-- mechanic's lien rules, LA's privilege rules) are encoded as exception
-- flags + free-text notes. Effective-dated so a 2027 rule change doesn't
-- silently overwrite the 2026 calculation an active project depends on.
--
-- Seeded with the 10 highest-volume states. The remaining 40 land via a
-- CSV import migration when legal review approves the data.
-- =============================================================================

CREATE TABLE IF NOT EXISTS state_lien_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code      text NOT NULL,
  /** 'general_contractor' | 'first_tier_sub' | 'second_tier_sub' | 'supplier'. */
  claimant_role   text NOT NULL CHECK (claimant_role IN ('general_contractor','first_tier_sub','second_tier_sub','supplier','laborer')),
  /** Days from first day of work to deliver preliminary notice. null = no
   *  preliminary notice required. */
  preliminary_notice_days integer,
  /** Days from last day of work to record a mechanic's lien. */
  lien_record_days integer NOT NULL,
  /** Days from filing the lien to commencing the foreclosure suit. */
  foreclosure_suit_days integer,
  /** Days the property owner has to demand a discharge. Some states (NY) use this. */
  owner_demand_days integer,
  /** Whether residential vs commercial properties have different rules. The
   *  framework picks the right rule via the project's residential flag. */
  applies_to_residential boolean NOT NULL DEFAULT true,
  applies_to_commercial  boolean NOT NULL DEFAULT true,
  /** Free-text notes — cite the statute, mention quirks ("Sundays excluded
   *  for the 30-day count" etc). */
  statute_citation text,
  notes           text,
  effective_from  date NOT NULL,
  effective_to    date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_state_lien_rules_active
  ON state_lien_rules(state_code, claimant_role, effective_from)
  WHERE effective_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_state_lien_rules_lookup
  ON state_lien_rules(state_code, claimant_role, effective_from DESC);

ALTER TABLE state_lien_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY state_lien_rules_authenticated_select ON state_lien_rules
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Seed: top 10 states by construction volume ─────────────────────
-- These are STARTING-POINT values from public statute citations. They MUST
-- be reviewed by counsel for each customer's jurisdiction before relying on
-- them in production. The notes column captures known nuances; legal review
-- should expand each row before billing the customer.
INSERT INTO state_lien_rules
  (state_code, claimant_role, preliminary_notice_days, lien_record_days, foreclosure_suit_days, owner_demand_days,
   statute_citation, notes, effective_from)
VALUES
  ('CA', 'general_contractor',   NULL, 90,  90,  NULL, 'CCP §8412',           'No preliminary notice for direct contracts with owner.',     '2026-01-01'),
  ('CA', 'first_tier_sub',       20,   90,  90,  NULL, 'CCP §8200, §8412',    '20-day prelim notice; lien within 90 days of last labor.',    '2026-01-01'),
  ('TX', 'general_contractor',   NULL, 120, 730, NULL, 'Tex. Prop. Code §53', 'Lien filed 4 months after last day worked (residential 3).', '2026-01-01'),
  ('TX', 'first_tier_sub',       45,   120, 730, NULL, 'Tex. Prop. Code §53.056', '15th of 3rd month notice; commercial 4 months.',         '2026-01-01'),
  ('FL', 'general_contractor',   NULL, 90,  365, NULL, 'Fla. Stat. §713.08',  'Notice of commencement governs; 90-day lien deadline.',     '2026-01-01'),
  ('FL', 'first_tier_sub',       45,   90,  365, NULL, 'Fla. Stat. §713.06',  '45-day Notice to Owner from first labor.',                  '2026-01-01'),
  ('NY', 'general_contractor',   NULL, 240, 365, 30,   'NY Lien Law §10',     'Single-family dwelling: 4 months. Commercial: 8 months.',   '2026-01-01'),
  ('NY', 'first_tier_sub',       NULL, 240, 365, 30,   'NY Lien Law §10',     'Owner demand-for-discharge clock 30 days. Brace yourself.', '2026-01-01'),
  ('IL', 'general_contractor',   NULL, 120, 730, NULL, '770 ILCS 60/7',       'Direct contract: 4 months from last labor.',                '2026-01-01'),
  ('IL', 'first_tier_sub',       60,   90,  730, NULL, '770 ILCS 60/24',      '60-day notice + lien within 90 days.',                       '2026-01-01'),
  ('PA', 'general_contractor',   NULL, 180, 730, NULL, '49 P.S. §1502',       '6 months from completion.',                                  '2026-01-01'),
  ('PA', 'first_tier_sub',       NULL, 180, 730, NULL, '49 P.S. §1501.1',     'Pa. Construction Notices Directory registration required.', '2026-01-01'),
  ('OH', 'general_contractor',   NULL, 75,  730, NULL, 'ORC §1311.06',        '75 days from last labor for commercial.',                    '2026-01-01'),
  ('OH', 'first_tier_sub',       NULL, 75,  730, NULL, 'ORC §1311.06',        'Notice of furnishing recommended within 21 days.',           '2026-01-01'),
  ('GA', 'general_contractor',   NULL, 90,  365, NULL, 'OCGA §44-14-361.1',   '90 days from last labor.',                                   '2026-01-01'),
  ('GA', 'first_tier_sub',       NULL, 90,  365, NULL, 'OCGA §44-14-361.1',   'Notice of commencement governs; 90 days.',                   '2026-01-01'),
  ('NC', 'general_contractor',   NULL, 120, 180, NULL, 'NCGS §44A-12',        '120 days from last labor; 180 days to file suit.',           '2026-01-01'),
  ('NC', 'first_tier_sub',       NULL, 120, 180, NULL, 'NCGS §44A-23',        'Subrogation lien through GC; serve notice promptly.',        '2026-01-01'),
  ('WA', 'general_contractor',   NULL, 90,  240, NULL, 'RCW 60.04.091',       '90 days from cease of labor.',                               '2026-01-01'),
  ('WA', 'first_tier_sub',       60,   90,  240, NULL, 'RCW 60.04.031',       '60-day pre-claim notice required.',                          '2026-01-01')
ON CONFLICT DO NOTHING;

-- 40 remaining states are tracked in docs/ENTERPRISE_COMPLIANCE_PACK.md. Land
-- as a CSV import migration after counsel review per state.
