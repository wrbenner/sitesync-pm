-- Webhook endpoints: where SiteSync sends event notifications
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL, -- HMAC signing secret (stored encrypted at rest)
  events text[] NOT NULL DEFAULT '{}', -- e.g. ['rfi.created', 'change_order.approved']
  active boolean DEFAULT true,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Delivery log: every attempt to POST an event to an endpoint
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  response_status int,
  response_body text,
  delivered_at timestamptz,
  attempts int DEFAULT 0,
  next_retry_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
  created_at timestamptz DEFAULT now()
);

-- API keys: scoped programmatic access (key itself is never stored)
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL, -- bcrypt hash of the raw key
  prefix text NOT NULL,   -- first 8 chars for identification (sk_live_abc12345)
  scopes text[] DEFAULT '{}', -- e.g. ['rfis:read', 'budget:read']
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes for common query patterns (guarded: columns may differ if tables pre-existed)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhook_endpoints' AND column_name = 'organization_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS webhook_endpoints_org_idx ON webhook_endpoints(organization_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhook_deliveries' AND column_name = 'endpoint_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS webhook_deliveries_endpoint_idx ON webhook_deliveries(endpoint_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhook_deliveries' AND column_name = 'next_retry_at') THEN
    EXECUTE $idx$CREATE INDEX IF NOT EXISTS webhook_deliveries_status_retry_idx ON webhook_deliveries(status, next_retry_at) WHERE status IN ('pending', 'retrying')$idx$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'organization_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS api_keys_org_idx ON api_keys(organization_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'prefix') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS api_keys_prefix_idx ON api_keys(prefix)';
  END IF;
END $$;

-- Row level security
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Webhook endpoints: org members can manage their org's endpoints
DROP POLICY IF EXISTS "webhook_endpoints_org_access" ON webhook_endpoints;
CREATE POLICY "webhook_endpoints_org_access" ON webhook_endpoints
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Webhook deliveries: readable by members of the owning org
-- Guarded: the pre-existing table from 00022 uses webhook_id, not endpoint_id
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhook_deliveries' AND column_name = 'endpoint_id') THEN
    EXECUTE 'DROP POLICY IF EXISTS "webhook_deliveries_org_access" ON webhook_deliveries';
    EXECUTE $p$
      CREATE POLICY "webhook_deliveries_org_access" ON webhook_deliveries
        USING (
          endpoint_id IN (
            SELECT id FROM webhook_endpoints
            WHERE organization_id IN (
              SELECT organization_id FROM organization_members
              WHERE user_id = auth.uid()
            )
          )
        )
    $p$;
  END IF;
END $$;

-- API keys: org members can manage their org's keys
DROP POLICY IF EXISTS "api_keys_org_access" ON api_keys;
CREATE POLICY "api_keys_org_access" ON api_keys
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Auto-update updated_at on webhook_endpoints
CREATE OR REPLACE FUNCTION update_webhook_endpoint_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS webhook_endpoints_updated_at ON webhook_endpoints;
CREATE TRIGGER webhook_endpoints_updated_at
  BEFORE UPDATE ON webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION update_webhook_endpoint_timestamp();
