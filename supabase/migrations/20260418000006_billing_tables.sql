-- Phase 6: Billing & Payment Infrastructure
-- Tables for Stripe customer linkage, saved payment methods, and invoices.
-- Adapted from sitesyncai-backend-main/src/billing/billing.service.ts.

-- ── billing_customers ───────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id text UNIQUE,
  max_projects integer DEFAULT 5,
  max_files_per_project integer DEFAULT 100,
  max_pages_per_file integer DEFAULT 500,
  tier text DEFAULT 'starter' CHECK (tier IN ('starter','professional','enterprise')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_customers_org ON billing_customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_customers_stripe ON billing_customers(stripe_customer_id);

ALTER TABLE billing_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_customers_select ON billing_customers;
CREATE POLICY billing_customers_select
  ON billing_customers FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ── payment_methods ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_payment_method_id text UNIQUE,
  brand text,
  last4 text,
  exp_month integer,
  exp_year integer,
  is_default boolean DEFAULT false,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_org
  ON payment_methods(organization_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payment_methods_default
  ON payment_methods(organization_id, is_default)
  WHERE deleted_at IS NULL AND is_default = true;

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_methods_select ON payment_methods;
CREATE POLICY payment_methods_select
  ON payment_methods FOR SELECT
  USING (
    deleted_at IS NULL
    AND organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ── invoices ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number text UNIQUE,
  amount_cents integer NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','void')),
  due_at timestamptz,
  paid_at timestamptz,
  stripe_payment_intent_id text,
  invoice_pdf_url text,
  receipt_pdf_url text,
  line_items jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_org_status
  ON invoices(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_created
  ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_payment_intent
  ON invoices(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoices_select ON invoices;
CREATE POLICY invoices_select
  ON invoices FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE billing_customers IS
  'Stripe customer linkage per organization with tier limits. Writes happen via service-role Edge Functions only.';
COMMENT ON TABLE payment_methods IS
  'Tokenized Stripe payment methods. Never stores card numbers or CVC.';
COMMENT ON TABLE invoices IS
  'Invoices in integer cents. Status transitions driven by Stripe webhooks and billing Edge Functions.';
