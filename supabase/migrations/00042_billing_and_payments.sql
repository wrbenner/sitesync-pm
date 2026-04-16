-- Billing, Subscriptions, Usage Tracking, and Payment Processing
-- Supports: Stripe subscriptions, usage-based billing, payment transactions via Stripe Connect.

-- ── Pricing Plans ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS plans (
  id text PRIMARY KEY, -- 'starter', 'professional', 'enterprise'
  name text NOT NULL,
  description text,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  price_annual numeric(10,2) NOT NULL DEFAULT 0,
  stripe_price_monthly text, -- Stripe Price ID
  stripe_price_annual text,
  -- Limits
  max_projects int NOT NULL DEFAULT 1,
  max_users int NOT NULL DEFAULT 5,
  max_storage_gb int NOT NULL DEFAULT 5,
  -- Features
  ai_copilot boolean DEFAULT false,
  integrations boolean DEFAULT false,
  custom_reports boolean DEFAULT false,
  sso boolean DEFAULT false,
  api_access boolean DEFAULT false,
  dedicated_support boolean DEFAULT false,
  -- Billing rates
  ai_per_page_rate numeric(6,4) DEFAULT 0, -- $ per AI-processed page
  payment_processing_rate numeric(5,4) DEFAULT 0, -- % fee on payments
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO plans (id, name, description, price_monthly, price_annual, max_projects, max_users, max_storage_gb, ai_copilot, integrations, custom_reports, sso, api_access, ai_per_page_rate, payment_processing_rate) VALUES
  ('starter', 'Starter', 'For small projects getting started', 0, 0, 1, 5, 5, false, false, false, false, false, 0, 0),
  ('professional', 'Professional', 'For growing construction firms', 499, 4990, 5, 25, 50, true, true, true, false, false, 0.10, 0.015),
  ('enterprise', 'Enterprise', 'For large GCs and owners', 0, 0, -1, -1, -1, true, true, true, true, true, 0.05, 0.005)
ON CONFLICT (id) DO NOTHING;

-- ── Organization Subscriptions ──────────────────────────

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations NOT NULL UNIQUE,
  plan_id text REFERENCES plans(id) NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing', 'paused')),
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  -- Stripe
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  -- Dates
  trial_ends_at timestamptz,
  current_period_start timestamptz DEFAULT now(),
  current_period_end timestamptz DEFAULT now() + interval '30 days',
  canceled_at timestamptz,
  -- Overrides (for enterprise custom deals)
  max_projects_override int,
  max_users_override int,
  max_storage_gb_override int,
  custom_rate_override jsonb, -- { ai_per_page: 0.05, payment_fee: 0.005 }
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_customer_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_select ON subscriptions FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (select auth.uid())));
CREATE POLICY subscriptions_update ON subscriptions FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin')));

-- ── Usage Events ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations NOT NULL,
  project_id uuid REFERENCES projects(id),
  event_type text NOT NULL CHECK (event_type IN (
    'ai_page_processed',
    'ai_chat_message',
    'ai_insight_generated',
    'document_ocr',
    'payment_processed',
    'report_generated',
    'storage_upload'
  )),
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(8,4) DEFAULT 0,
  total_amount numeric(10,4) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_usage_events_org ON usage_events(organization_id, created_at DESC);
CREATE INDEX idx_usage_events_type ON usage_events(event_type, created_at);
CREATE INDEX idx_usage_events_period ON usage_events(organization_id, event_type, created_at);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_events_select ON usage_events FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (select auth.uid())));
CREATE POLICY usage_events_insert ON usage_events FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (select auth.uid())));

-- Usage aggregation view (for billing dashboard)
CREATE OR REPLACE VIEW usage_summary AS
SELECT
  organization_id,
  event_type,
  date_trunc('month', created_at) AS period,
  SUM(quantity) AS total_quantity,
  SUM(quantity * unit_price) AS total_amount
FROM usage_events
GROUP BY organization_id, event_type, date_trunc('month', created_at);

-- ── Payment Transactions (Stripe Connect) ───────────────

CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) NOT NULL,
  application_id uuid REFERENCES payment_applications(id),
  -- Stripe
  stripe_payment_intent_id text UNIQUE,
  stripe_transfer_id text,
  stripe_account_id text, -- Connected account (subcontractor)
  -- Payment details
  amount int NOT NULL, -- cents
  platform_fee int NOT NULL DEFAULT 0, -- cents
  currency text NOT NULL DEFAULT 'usd',
  payment_method text CHECK (payment_method IN ('card', 'ach_debit', 'ach_credit', 'wire')),
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'processing', 'succeeded', 'failed', 'canceled', 'requires_action')),
  -- Recipient
  recipient_name text,
  application_number int,
  -- Metadata
  description text,
  error text,
  type text DEFAULT 'payment' CHECK (type IN ('payment', 'transfer', 'refund', 'retainage_hold', 'retainage_release')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_pay_tx_project ON payment_transactions(project_id);
CREATE INDEX idx_pay_tx_stripe ON payment_transactions(stripe_payment_intent_id);
CREATE INDEX idx_pay_tx_app ON payment_transactions(application_id);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pay_tx_select ON payment_transactions FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid())));
CREATE POLICY pay_tx_insert ON payment_transactions FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin', 'project_manager')));

-- ── Stripe Connected Accounts (Subcontractor Onboarding) ─

CREATE TABLE IF NOT EXISTS stripe_connected_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations,
  project_id uuid REFERENCES projects(id),
  stripe_account_id text NOT NULL UNIQUE,
  company_name text NOT NULL,
  email text NOT NULL,
  charges_enabled boolean DEFAULT false,
  payouts_enabled boolean DEFAULT false,
  onboarding_complete boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_connected_accounts_org ON stripe_connected_accounts(organization_id);
CREATE INDEX idx_connected_accounts_stripe ON stripe_connected_accounts(stripe_account_id);

-- ── Plan Limit Checking Function ────────────────────────

CREATE OR REPLACE FUNCTION check_plan_limit(
  p_organization_id uuid,
  p_limit_type text -- 'projects', 'users', 'storage_gb'
) RETURNS boolean AS $$
DECLARE
  v_plan_max_projects int;
  v_plan_max_users int;
  v_plan_max_storage int;
  v_sub_max_projects_override int;
  v_sub_max_users_override int;
  v_sub_max_storage_override int;
  v_current_count int;
  v_max int;
BEGIN
  SELECT p.max_projects, p.max_users, p.max_storage_gb,
         s.max_projects_override, s.max_users_override, s.max_storage_gb_override
    INTO v_plan_max_projects, v_plan_max_users, v_plan_max_storage,
         v_sub_max_projects_override, v_sub_max_users_override, v_sub_max_storage_override
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.organization_id = p_organization_id AND s.status = 'active';

  IF NOT FOUND THEN RETURN false; END IF;

  CASE p_limit_type
    WHEN 'projects' THEN
      v_max := COALESCE(v_sub_max_projects_override, v_plan_max_projects);
      IF v_max = -1 THEN RETURN true; END IF;
      SELECT COUNT(*) INTO v_current_count FROM projects WHERE organization_id = p_organization_id;
    WHEN 'users' THEN
      v_max := COALESCE(v_sub_max_users_override, v_plan_max_users);
      IF v_max = -1 THEN RETURN true; END IF;
      SELECT COUNT(*) INTO v_current_count FROM organization_members WHERE organization_id = p_organization_id;
    WHEN 'storage_gb' THEN
      v_max := COALESCE(v_sub_max_storage_override, v_plan_max_storage);
      IF v_max = -1 THEN RETURN true; END IF;
      v_current_count := 0;
    ELSE
      RETURN true;
  END CASE;

  RETURN v_current_count < v_max;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated at triggers
CREATE TRIGGER set_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_pay_tx_updated_at BEFORE UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_connected_accounts_updated_at BEFORE UPDATE ON stripe_connected_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
