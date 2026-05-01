-- =============================================================================
-- eeo1_demographics — schema lands; logic deferred
-- =============================================================================
-- The EEO-1 Component 1 report aggregates self-reported demographic data
-- from the workforce. The schema is a separate table (not workforce_members
-- columns) for two reasons:
--   1. Privacy: demographic data is voluntary and has different access /
--      retention rules than identity data. A separate table makes the RLS
--      policy explicit and unambiguous.
--   2. Federal vs state: federal contractors above $50k have one set of
--      reporting obligations; CA/NY/IL public contracts have additional
--      utilization rules. The schema accommodates both.
--
-- THIS MIGRATION CREATES THE TABLE ONLY. The aggregation/export logic is
-- deferred until policy review confirms:
--   • whether self-reporting is voluntary (default) or mandatory
--   • retention policy (DOL: at least 1 year; longer for litigation hold)
--   • EEO-1 Component 1 vs Component 2 obligations for the customer base
--   • how to handle "decline to answer" without coercion
-- =============================================================================

CREATE TABLE IF NOT EXISTS eeo1_demographics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workforce_member_id uuid NOT NULL REFERENCES workforce_members(id) ON DELETE CASCADE,
  /** Self-reported. Workers may decline; record is then absent or 'decline'. */
  gender          text CHECK (gender IS NULL OR gender IN ('male','female','non_binary','decline')),
  /** EEO-1 race/ethnicity categories. */
  race_ethnicity  text CHECK (race_ethnicity IS NULL OR race_ethnicity IN (
                    'hispanic_or_latino',
                    'white',
                    'black_or_african_american',
                    'native_hawaiian_or_other_pacific_islander',
                    'asian',
                    'american_indian_or_alaska_native',
                    'two_or_more_races',
                    'decline'
                  )),
  /** EEO-1 job category. The export aggregates by this column. */
  job_category    text CHECK (job_category IS NULL OR job_category IN (
                    'executive_senior_managers',
                    'first_mid_managers',
                    'professionals',
                    'technicians',
                    'sales_workers',
                    'administrative_support',
                    'craft_workers',
                    'operatives',
                    'laborers_helpers',
                    'service_workers'
                  )),
  /** When the worker self-reported. */
  reported_at     timestamptz NOT NULL DEFAULT now(),
  /** When the worker last updated their self-report. Demographic data should
   *  be modifiable by the worker themselves at any time. */
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One row per worker — workers update their existing report rather than
-- accreting history. Historical aggregation lives in `compliance_reports`
-- snapshots elsewhere.
CREATE UNIQUE INDEX IF NOT EXISTS uq_eeo1_per_worker
  ON eeo1_demographics(workforce_member_id);

ALTER TABLE eeo1_demographics ENABLE ROW LEVEL SECURITY;

-- Workers see their own data. Admins see aggregates only (enforced at the
-- query layer; this table is never queried for aggregates without going
-- through the export edge function with an audit log).
DO $$ BEGIN
  CREATE POLICY eeo1_self_select ON eeo1_demographics
    FOR SELECT USING (
      workforce_member_id IN (
        SELECT id FROM workforce_members
         WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY eeo1_self_write ON eeo1_demographics
    FOR ALL USING (
      workforce_member_id IN (
        SELECT id FROM workforce_members
         WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    ) WITH CHECK (
      workforce_member_id IN (
        SELECT id FROM workforce_members
         WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- NOTE: aggregation/export queries should be performed only by the
-- eeo1-export edge function (deferred this turn) using the service-role
-- key after a permission check + audit log entry.
