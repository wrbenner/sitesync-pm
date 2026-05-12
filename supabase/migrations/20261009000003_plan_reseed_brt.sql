-- =============================================================================
-- 20261009000003_plan_reseed_brt.sql
-- BRT subsystem 4 §4.1 — reconcile self-serve plan to $400/$4,080.
--
-- Background: 00042 seeded a `professional` plan at $499/$4,990. The Master
-- Brief (Section 9.2) targets $400/mo per company with a 15%-off annual
-- prepay ($4,080). The pricing decision is captured at
-- docs/audits/BRT_PRICING_DECISION_2026-05-11.md (Walker confirmed via
-- Claude Code AskUserQuestion 2026-05-11).
--
-- This migration does NOT delete the legacy seed rows; it adds a new `pro`
-- row at the new pricing and archives the old ones via a new `archived`
-- column. Existing pilot orgs subscribed to legacy plans continue to bill
-- at their grandfather rate (subscriptions.legacy_grandfather=true is added
-- in a follow-up slice).
--
-- Stripe Price IDs are NOT seeded here — they're issued only when the
-- Founder creates the SiteSync Pro Product in Stripe Dashboard (step 4.1
-- of the spec). The reseed leaves stripe_price_monthly/annual NULL until
-- a follow-up env-driven update populates them.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- archived flag — keeps legacy rows queryable but hidden from new self-serve.
-- ---------------------------------------------------------------------------

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN plans.archived IS
  'BRT sub-4 §4.1: archived plans are never offered to new self-serve customers but remain queryable so existing subscriptions can resolve their billing rate.';

-- Hide the old free 'starter' from new self-serve (pilots stay grandfathered)
UPDATE plans SET archived = true WHERE id IN ('starter');

-- The old 'professional' at $499 stays active for the moment so existing
-- pilot orgs (Nexus) that signed under the old price aren't disrupted.
-- Once Founder confirms migration is complete, a follow-up sets archived=true
-- on professional too. For now: rename it 'professional_legacy' so the new
-- 'pro' is unambiguous in the UI.
UPDATE plans
SET name = 'Professional (legacy)',
    description = description || ' — legacy pricing, retained for grandfathered pilot accounts only',
    archived = true
WHERE id = 'professional';

-- ---------------------------------------------------------------------------
-- New canonical plan: SiteSync Pro at $400/$4,080.
-- ---------------------------------------------------------------------------

INSERT INTO plans (
  id,
  name,
  description,
  price_monthly,
  price_annual,
  stripe_price_monthly,
  stripe_price_annual,
  max_projects,
  max_users,
  max_storage_gb,
  ai_copilot,
  integrations,
  custom_reports,
  sso,
  api_access,
  dedicated_support,
  ai_per_page_rate,
  archived
) VALUES (
  'pro',
  'SiteSync Pro',
  'For construction firms shipping work — unlimited projects + users, AI Copilot, deposition-grade audit chain, 100 GB storage.',
  400.00,
  4080.00,
  NULL, -- Set by Founder once Stripe Product is created (§4.1)
  NULL, -- Same
  -1,   -- unlimited
  -1,   -- unlimited
  100,  -- 100 GB included
  true,
  true,
  true,
  true, -- SSO included at this price (per spec §3.1)
  true, -- API access included
  false, -- dedicated_support reserved for Enterprise
  0,     -- AI cost included; no per-page meter at Beta
  false  -- not archived
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  max_projects = EXCLUDED.max_projects,
  max_users = EXCLUDED.max_users,
  max_storage_gb = EXCLUDED.max_storage_gb,
  ai_copilot = EXCLUDED.ai_copilot,
  integrations = EXCLUDED.integrations,
  custom_reports = EXCLUDED.custom_reports,
  sso = EXCLUDED.sso,
  api_access = EXCLUDED.api_access,
  archived = EXCLUDED.archived;

-- ---------------------------------------------------------------------------
-- Helper view: only-active plans for self-serve UI.
-- Frontend reads from this view, NOT from the raw plans table.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_active_plans AS
SELECT *
FROM plans
WHERE archived = false
ORDER BY price_monthly ASC;

GRANT SELECT ON v_active_plans TO authenticated, anon;

COMMENT ON VIEW v_active_plans IS
  'BRT sub-4 §4.1: read-only projection of plans that are offered to new self-serve customers. Excludes archived/legacy rows. Frontend pricing surfaces should read from here.';

-- ---------------------------------------------------------------------------
-- Legacy grandfather flag on subscriptions.
-- Subscriptions tied to archived plans get is_legacy=true so billing
-- aggregations can split MRR by old vs new pricing if needed.
-- ---------------------------------------------------------------------------

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS legacy_grandfather boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN subscriptions.legacy_grandfather IS
  'BRT sub-4 §4.1: true for subscriptions on archived plans (Nexus pilot, early customers). Excluded from new-pricing MRR aggregations.';

-- Backfill: any subscription on an archived plan today is legacy.
UPDATE subscriptions s
SET legacy_grandfather = true
FROM plans p
WHERE s.plan_id = p.id
  AND p.archived = true
  AND s.legacy_grandfather = false;

-- ---------------------------------------------------------------------------
-- Default plan_id for new subscriptions: 'pro'.
-- Old default 'starter' is archived; any new INSERT without explicit plan_id
-- would resolve to a hidden plan and confuse the billing UI. Switching the
-- default keeps signup-without-checkout edge cases (e.g., admin-created
-- internal orgs) on a sensible plan.
-- ---------------------------------------------------------------------------

ALTER TABLE subscriptions
  ALTER COLUMN plan_id SET DEFAULT 'pro';
