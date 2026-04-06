# E3: White-Label / OEM Licensing Infrastructure

## Overview

White-label and OEM licensing transforms SiteSync into a white-labeled construction platform that regional GCs, national unions, and construction software VARs can rebrand as their own. This feature enables:

- **Multi-tenant architecture** with complete tenant isolation
- **Custom branding** (logo, colors, fonts, domain)
- **Feature flag engine** enabling/disabling capabilities per tenant
- **SSO federation** (OAuth 2.0, SAML 2.0) for enterprise customers
- **Data isolation** via Supabase schema/project separation and RLS policies
- **Custom onboarding flows** and role-based permission templates
- **Pricing flexibility** with per-seat, per-project, and transaction fee models
- **White-label admin panel** for managing tenants, licensing, usage

### Value Proposition

Construction VARs and regional GCs can deploy SiteSync as their own branded platform without building infrastructure. SiteSync captures platform fees while partners own customer relationships and success metrics. This creates a $50M+ annual revenue stream from 200+ white-label partners at $250K+ ARR each.

### Market Context

- **Regional GC networks** (100+ companies, $1B+ combined revenue): Deploy SiteSync to standardize operations across divisions while maintaining regional branding
- **National unions** (IBMiC, AGC): Need platform for apprenticeship tracking, prevailing wage compliance, union labor dispatch
- **Construction software VARs**: ERP resellers, estimating firms, safety platforms seeking to add project management
- **Design-build firms**: Internal platform for integrated design-construction workflows with white-label capabilities

---

## Database Schema

### Tenant Architecture

```sql
-- Multi-tenant core tables
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL, -- used in subdomain: tenant.sitesync.app
  name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  branding JSONB NOT NULL DEFAULT '{
    "logo_url": null,
    "favicon_url": null,
    "primary_color": "#1e40af",
    "secondary_color": "#1f2937",
    "accent_color": "#3b82f6",
    "font_family": "Inter, sans-serif",
    "company_name": null
  }',
  sso_config JSONB DEFAULT NULL, -- OAuth/SAML configuration
  webhook_secret TEXT NOT NULL,
  stripe_account_id TEXT, -- Connected account for platform fees
  subscription_status TEXT DEFAULT 'active', -- active, suspended, cancelled
  max_users INTEGER DEFAULT 50,
  max_projects INTEGER DEFAULT 500,
  monthly_transaction_limit NUMERIC DEFAULT 1000000.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX tenants_slug_idx ON tenants(slug);
CREATE INDEX tenants_owner_email_idx ON tenants(owner_email);
CREATE INDEX tenants_subscription_status_idx ON tenants(subscription_status);

-- Tenant-specific feature flags
CREATE TABLE tenant_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  config JSONB DEFAULT '{}', -- Feature-specific configuration
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, feature_key)
);

CREATE INDEX tenant_feature_flags_tenant_idx ON tenant_feature_flags(tenant_id);

-- Tenant users (RLS isolated by tenant_id)
CREATE TABLE tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  auth_id UUID NOT NULL, -- Foreign key to auth.users
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- owner, admin, manager, member
  permissions JSONB DEFAULT '[]', -- Custom permission array
  sso_provider TEXT, -- 'oauth_google', 'oauth_microsoft', 'saml_okta', etc.
  sso_external_id TEXT, -- External user ID from SSO provider
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(tenant_id, email),
  UNIQUE(tenant_id, auth_id)
);

CREATE INDEX tenant_users_tenant_idx ON tenant_users(tenant_id);
CREATE INDEX tenant_users_email_idx ON tenant_users(email);
CREATE INDEX tenant_users_sso_provider_idx ON tenant_users(sso_provider);

-- Tenant-level role templates
CREATE TABLE tenant_role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL, -- Array of permission strings
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, role_name)
);

-- Tenant onboarding flow configuration
CREATE TABLE tenant_onboarding_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL, -- Array of onboarding step configuration
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tenant usage tracking for billing
CREATE TABLE tenant_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  active_user_count INTEGER DEFAULT 0,
  project_count INTEGER DEFAULT 0,
  transaction_volume NUMERIC DEFAULT 0.00,
  api_calls INTEGER DEFAULT 0,
  webhook_events INTEGER DEFAULT 0,
  storage_gb NUMERIC DEFAULT 0,
  payment_processing_volume NUMERIC DEFAULT 0.00,
  certified_payroll_entries INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, billing_period_start)
);

CREATE INDEX tenant_usage_tracking_tenant_idx ON tenant_usage_tracking(tenant_id);
CREATE INDEX tenant_usage_tracking_period_idx ON tenant_usage_tracking(billing_period_start, billing_period_end);

-- Tenant subscription/licensing
CREATE TABLE tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL, -- 'starter', 'professional', 'enterprise'
  pricing_model TEXT NOT NULL, -- 'per_seat', 'per_project', 'transaction_fee', 'hybrid'
  price_per_seat NUMERIC,
  price_per_project NUMERIC,
  transaction_fee_percentage NUMERIC DEFAULT 0,
  stripe_subscription_id TEXT,
  billing_cycle TEXT DEFAULT 'monthly', -- monthly, annual
  annual_discount_percent NUMERIC DEFAULT 0,
  custom_pricing_terms TEXT, -- For enterprise deals
  billing_contact_email TEXT,
  next_billing_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX tenant_subscriptions_tenant_idx ON tenant_subscriptions(tenant_id);

-- Tenant audit log (immutable)
CREATE TABLE tenant_audit_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX tenant_audit_log_tenant_idx ON tenant_audit_log(tenant_id);
CREATE INDEX tenant_audit_log_user_idx ON tenant_audit_log(user_id);
CREATE INDEX tenant_audit_log_created_idx ON tenant_audit_log(created_at);
```

### Row-Level Security (RLS) Policies

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_role_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_onboarding_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_audit_log ENABLE ROW LEVEL SECURITY;

-- Tenant detection function (stored in JWT custom claims)
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
  SELECT (auth.jwt() ->> 'tenant_id')::UUID
$$ LANGUAGE SQL STABLE;

-- Users can only see their own tenant's users
CREATE POLICY "Users can view own tenant users"
  ON tenant_users FOR SELECT
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Admins can insert users to own tenant"
  ON tenant_users FOR INSERT
  WITH CHECK (
    tenant_id = get_current_tenant_id() AND
    EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = get_current_tenant_id()
      AND tu.auth_id = auth.uid()
      AND tu.role IN ('owner', 'admin')
    )
  );

-- Users can update own profile, admins can update any tenant user
CREATE POLICY "Users can update own profile"
  ON tenant_users FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

CREATE POLICY "Admins can update tenant users"
  ON tenant_users FOR UPDATE
  USING (
    tenant_id = get_current_tenant_id() AND
    EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = get_current_tenant_id()
      AND tu.auth_id = auth.uid()
      AND tu.role IN ('owner', 'admin')
    )
  );

-- Feature flags are visible to all authenticated users in the tenant
CREATE POLICY "Users can view own tenant feature flags"
  ON tenant_feature_flags FOR SELECT
  USING (tenant_id = get_current_tenant_id());

-- Audit logs are visible to admins only
CREATE POLICY "Admins can view audit logs"
  ON tenant_audit_log FOR SELECT
  USING (
    tenant_id = get_current_tenant_id() AND
    EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = tenant_id
      AND tu.auth_id = auth.uid()
      AND tu.role IN ('owner', 'admin')
    )
  );
```

---

## React Components & Pages

### 1. Multi-Tenant Layout Shell

**File: `/src/layouts/tenant-shell.tsx`**

```typescript
import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTenantStore } from '@/stores/tenant.store';
import { useQuery } from '@tanstack/react-query';
import { Logo } from '@/components/branding/logo';
import { TenantSidebar } from '@/components/navigation/tenant-sidebar';
import { TenantTopbar } from '@/components/navigation/tenant-topbar';

interface TenantShellProps {
  children: React.ReactNode;
}

export const TenantShell: React.FC<TenantShellProps> = ({ children }) => {
  const router = useRouter();
  const { tenantSlug } = router.query;
  const { setCurrentTenant, branding } = useTenantStore();

  // Fetch tenant configuration on mount
  const { data: tenantConfig, isLoading } = useQuery({
    queryKey: ['tenant', tenantSlug],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantSlug}/config`, {
        headers: {
          'X-Tenant-Slug': tenantSlug as string,
        },
      });
      if (!res.ok) throw new Error('Failed to load tenant config');
      return res.json();
    },
    enabled: !!tenantSlug,
  });

  useEffect(() => {
    if (tenantConfig) {
      setCurrentTenant(tenantConfig);
    }
  }, [tenantConfig, setCurrentTenant]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Apply tenant branding CSS variables */}
      <style>{`
        :root {
          --color-primary: ${branding?.primary_color || '#1e40af'};
          --color-secondary: ${branding?.secondary_color || '#1f2937'};
          --color-accent: ${branding?.accent_color || '#3b82f6'};
          --font-family: ${branding?.font_family || 'Inter, sans-serif'};
        }
      `}</style>

      {/* Sidebar Navigation */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <Logo
            src={branding?.logo_url}
            alt={branding?.company_name || 'SiteSync'}
            height={32}
          />
        </div>
        <nav className="flex-1 overflow-y-auto">
          <TenantSidebar />
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center px-6">
          <TenantTopbar />
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
```

### 2. Tenant Branding Configuration Page

**File: `/src/pages/admin/branding.tsx`**

```typescript
import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useTenantStore } from '@/stores/tenant.store';
import { TenantShell } from '@/layouts/tenant-shell';

interface BrandingConfig {
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  company_name: string | null;
}

export default function BrandingPage() {
  const router = useRouter();
  const { tenantSlug } = router.query;
  const { branding, setBranding } = useTenantStore();
  const [formData, setFormData] = useState<BrandingConfig>(branding || {});
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Fetch current branding
  const { data: currentBranding } = useQuery({
    queryKey: ['tenant-branding', tenantSlug],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantSlug}/branding`);
      if (!res.ok) throw new Error('Failed to load branding');
      return res.json();
    },
    enabled: !!tenantSlug,
  });

  // Update branding mutation
  const updateBrandingMutation = useMutation({
    mutationFn: async (data: BrandingConfig) => {
      const res = await fetch(`/api/tenants/${tenantSlug}/branding`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update branding');
      return res.json();
    },
    onSuccess: (data) => {
      setBranding(data);
      alert('Branding updated successfully');
    },
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Upload to Supabase Storage
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`/api/tenants/${tenantSlug}/upload-asset`, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const { url } = await res.json();
      setFormData((prev) => ({ ...prev, logo_url: url }));
      setLogoPreview(url);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateBrandingMutation.mutate(formData);
  };

  return (
    <TenantShell>
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Branding</h1>
          <p className="text-gray-600 mt-2">Customize your workspace appearance</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Logo Upload */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Logo</h2>
            <div className="flex items-center gap-6">
              <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                {logoPreview || formData.logo_url ? (
                  <img
                    src={logoPreview || formData.logo_url}
                    alt="Logo"
                    className="max-w-full max-h-full"
                  />
                ) : (
                  <span className="text-gray-400">No logo</span>
                )}
              </div>
              <div>
                <input
                  type="file"
                  id="logo-upload"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <label
                  htmlFor="logo-upload"
                  className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600 transition"
                >
                  Upload Logo
                </label>
                <p className="text-sm text-gray-500 mt-2">Recommended: 200x200px PNG</p>
              </div>
            </div>
          </div>

          {/* Company Name */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Company Name</h2>
            <input
              type="text"
              value={formData.company_name || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  company_name: e.target.value,
                }))
              }
              placeholder="Your Company Name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Color Scheme */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Color Scheme</h2>
            <div className="grid grid-cols-3 gap-6">
              {[
                { key: 'primary_color' as const, label: 'Primary' },
                { key: 'secondary_color' as const, label: 'Secondary' },
                { key: 'accent_color' as const, label: 'Accent' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {label}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData[key]}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className="w-12 h-12 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData[key]}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Font Selection */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Font Family</h2>
            <select
              value={formData.font_family}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  font_family: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Inter, sans-serif">Inter</option>
              <option value="Helvetica, sans-serif">Helvetica</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="Courier New, monospace">Courier</option>
            </select>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Preview</h2>
            <div
              style={{
                backgroundColor: formData.secondary_color,
                borderColor: formData.primary_color,
                fontFamily: formData.font_family,
              }}
              className="p-6 rounded-lg text-white"
            >
              <h3 style={{ color: formData.accent_color }} className="text-2xl font-bold mb-2">
                {formData.company_name || 'SiteSync'}
              </h3>
              <p>This is how your workspace will look to users</p>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={updateBrandingMutation.isPending}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium"
          >
            {updateBrandingMutation.isPending ? 'Saving...' : 'Save Branding'}
          </button>
        </form>
      </div>
    </TenantShell>
  );
}
```

### 3. Feature Flags Management

**File: `/src/components/admin/feature-flags-panel.tsx`**

```typescript
import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { Switch } from '@headlessui/react';

interface FeatureFlag {
  id: string;
  feature_key: string;
  enabled: boolean;
  config: Record<string, any>;
  description: string;
}

const AVAILABLE_FEATURES = [
  {
    key: 'certified_payroll',
    label: 'Davis-Bacon Certified Payroll',
    description: 'WH-347 form generation and prevailing wage compliance',
  },
  {
    key: 'embedded_fintech',
    label: 'Embedded Fintech',
    description: 'Vendor invoice processing, retainage, early payment',
  },
  {
    key: 'ai_estimating',
    label: 'AI Estimating',
    description: 'Claude Vision plan reading and automated line items',
  },
  {
    key: 'equipment_telematics',
    label: 'Equipment Telematics',
    description: 'GPS tracking, maintenance alerts, utilization analysis',
  },
  {
    key: 'mobile_app',
    label: 'Mobile App',
    description: 'iOS/Android native application',
  },
  {
    key: 'custom_branding',
    label: 'Custom Branding',
    description: 'White-label logo, colors, domain customization',
  },
];

export const FeatureFlagsPanel: React.FC = () => {
  const router = useRouter();
  const { tenantSlug } = router.query;

  // Fetch feature flags
  const { data: featureFlags = [], refetch } = useQuery({
    queryKey: ['feature-flags', tenantSlug],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantSlug}/feature-flags`);
      if (!res.ok) throw new Error('Failed to load feature flags');
      return res.json();
    },
    enabled: !!tenantSlug,
  });

  // Toggle feature mutation
  const toggleFeatureMutation = useMutation({
    mutationFn: async ({
      featureKey,
      enabled,
    }: {
      featureKey: string;
      enabled: boolean;
    }) => {
      const res = await fetch(
        `/api/tenants/${tenantSlug}/feature-flags/${featureKey}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        }
      );
      if (!res.ok) throw new Error('Failed to update feature flag');
      return res.json();
    },
    onSuccess: () => {
      refetch();
    },
  });

  const getFeatureStatus = (featureKey: string): boolean => {
    const flag = featureFlags.find((f: FeatureFlag) => f.feature_key === featureKey);
    return flag?.enabled || false;
  };

  return (
    <div className="space-y-4">
      {AVAILABLE_FEATURES.map((feature) => (
        <div
          key={feature.key}
          className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between"
        >
          <div>
            <h3 className="font-semibold text-gray-900">{feature.label}</h3>
            <p className="text-sm text-gray-600">{feature.description}</p>
          </div>
          <Switch
            checked={getFeatureStatus(feature.key)}
            onChange={(enabled) =>
              toggleFeatureMutation.mutate({
                featureKey: feature.key,
                enabled,
              })
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              getFeatureStatus(feature.key) ? 'bg-blue-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                getFeatureStatus(feature.key) ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </Switch>
        </div>
      ))}
    </div>
  );
};
```

### 4. SSO Configuration Page

**File: `/src/pages/admin/sso-config.tsx`**

```typescript
import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { TenantShell } from '@/layouts/tenant-shell';

interface SSOProvider {
  type: 'oauth_google' | 'oauth_microsoft' | 'saml_okta';
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
  samlMetadataUrl?: string;
  samlCertificate?: string;
}

interface SSOConfig {
  [key: string]: SSOProvider;
}

export default function SSOConfigPage() {
  const router = useRouter();
  const { tenantSlug } = router.query;
  const [ssoConfig, setSsoConfig] = useState<SSOConfig>({});
  const [showSecrets, setShowSecrets] = useState(false);

  // Fetch SSO config
  const { data: currentConfig } = useQuery({
    queryKey: ['sso-config', tenantSlug],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantSlug}/sso-config`);
      if (!res.ok) throw new Error('Failed to load SSO config');
      return res.json();
    },
    enabled: !!tenantSlug,
    onSuccess: (data) => setSsoConfig(data),
  });

  // Update SSO config mutation
  const updateSSOConfigMutation = useMutation({
    mutationFn: async (config: SSOConfig) => {
      const res = await fetch(`/api/tenants/${tenantSlug}/sso-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to update SSO config');
      return res.json();
    },
    onSuccess: () => {
      alert('SSO configuration updated');
    },
  });

  const handleOAuthSetup = (
    provider: 'oauth_google' | 'oauth_microsoft',
    field: string,
    value: string
  ) => {
    setSsoConfig((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        type: provider,
        [field]: value,
      },
    }));
  };

  const toggleProvider = (provider: string) => {
    setSsoConfig((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        type: provider as SSOProvider['type'],
        enabled: !prev[provider]?.enabled,
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSSOConfigMutation.mutate(ssoConfig);
  };

  return (
    <TenantShell>
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Single Sign-On (SSO)</h1>
          <p className="text-gray-600 mt-2">
            Enable enterprise authentication with OAuth 2.0 and SAML 2.0
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Google OAuth */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Google OAuth 2.0</h2>
                <p className="text-sm text-gray-600">
                  Enable Google accounts for your team
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleProvider('oauth_google')}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  ssoConfig.oauth_google?.enabled
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {ssoConfig.oauth_google?.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {ssoConfig.oauth_google?.enabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={ssoConfig.oauth_google?.clientId || ''}
                    onChange={(e) =>
                      handleOAuthSetup('oauth_google', 'clientId', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Secret
                  </label>
                  <div className="flex gap-2">
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={ssoConfig.oauth_google?.clientSecret || ''}
                      onChange={(e) =>
                        handleOAuthSetup('oauth_google', 'clientSecret', e.target.value)
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecrets(!showSecrets)}
                      className="px-3 py-2 text-gray-600 hover:text-gray-900"
                    >
                      {showSecrets ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <p className="text-sm text-blue-600">
                  Redirect URI: https://{tenantSlug}.sitesync.app/auth/google/callback
                </p>
              </div>
            )}
          </div>

          {/* Microsoft OAuth */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Microsoft OAuth 2.0</h2>
                <p className="text-sm text-gray-600">
                  Enable Microsoft/Office 365 accounts for your team
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleProvider('oauth_microsoft')}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  ssoConfig.oauth_microsoft?.enabled
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {ssoConfig.oauth_microsoft?.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {ssoConfig.oauth_microsoft?.enabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={ssoConfig.oauth_microsoft?.clientId || ''}
                    onChange={(e) =>
                      handleOAuthSetup('oauth_microsoft', 'clientId', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Secret
                  </label>
                  <div className="flex gap-2">
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={ssoConfig.oauth_microsoft?.clientSecret || ''}
                      onChange={(e) =>
                        handleOAuthSetup('oauth_microsoft', 'clientSecret', e.target.value)
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={updateSSOConfigMutation.isPending}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium"
          >
            {updateSSOConfigMutation.isPending ? 'Saving...' : 'Save SSO Configuration'}
          </button>
        </form>
      </div>
    </TenantShell>
  );
}
```

### 5. Tenant Zustand Store

**File: `/src/stores/tenant.store.ts`**

```typescript
import create from 'zustand';
import { persist } from 'zustand/middleware';

interface BrandingConfig {
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  company_name: string | null;
}

interface TenantConfig {
  id: string;
  slug: string;
  name: string;
  branding: BrandingConfig;
  features: {
    [key: string]: boolean;
  };
  sso_providers: string[];
}

interface TenantStore {
  currentTenant: TenantConfig | null;
  branding: BrandingConfig | null;
  featureEnabled: (feature: string) => boolean;
  setCurrentTenant: (tenant: TenantConfig) => void;
  setBranding: (branding: BrandingConfig) => void;
  setFeatureFlag: (feature: string, enabled: boolean) => void;
}

export const useTenantStore = create<TenantStore>(
  persist(
    (set, get) => ({
      currentTenant: null,
      branding: null,

      setCurrentTenant: (tenant: TenantConfig) => {
        set({
          currentTenant: tenant,
          branding: tenant.branding,
        });
      },

      setBranding: (branding: BrandingConfig) => {
        set({
          branding,
          currentTenant: get().currentTenant
            ? {
                ...get().currentTenant!,
                branding,
              }
            : null,
        });
      },

      featureEnabled: (feature: string) => {
        return get().currentTenant?.features[feature] ?? false;
      },

      setFeatureFlag: (feature: string, enabled: boolean) => {
        const current = get().currentTenant;
        if (current) {
          set({
            currentTenant: {
              ...current,
              features: {
                ...current.features,
                [feature]: enabled,
              },
            },
          });
        }
      },
    }),
    {
      name: 'tenant-store',
    }
  )
);
```

---

## API Endpoints & Implementation

### 1. Tenant Configuration Endpoint

**File: `/pages/api/tenants/[slug]/config.ts`**

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { slug } = req.query;
  const supabase = createServerSupabaseClient({ req, res });

  // Get session to extract tenant_id from JWT
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Fetch tenant configuration
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, name, branding, slug')
      .eq('slug', slug)
      .single();

    if (error || !tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Fetch enabled features for this tenant
    const { data: featureFlags } = await supabase
      .from('tenant_feature_flags')
      .select('feature_key, enabled')
      .eq('tenant_id', tenant.id)
      .eq('enabled', true);

    const features: { [key: string]: boolean } = {};
    featureFlags?.forEach((flag) => {
      features[flag.feature_key] = flag.enabled;
    });

    // Fetch SSO providers
    const ssoConfig = tenant.sso_config || {};
    const ssoProviders = Object.keys(ssoConfig).filter(
      (key) => ssoConfig[key]?.enabled
    );

    return res.status(200).json({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      branding: tenant.branding,
      features,
      sso_providers: ssoProviders,
    });
  } catch (error) {
    console.error('Error fetching tenant config:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

### 2. Branding Update Endpoint

**File: `/pages/api/tenants/[slug]/branding.ts`**

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { slug } = req.query;
  const supabase = createServerSupabaseClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    // Fetch branding
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('branding')
      .eq('slug', slug)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    return res.status(200).json(tenant.branding);
  }

  if (req.method === 'PUT') {
    // Update branding (only for admins)
    const { data: user } = await supabase
      .from('tenant_users')
      .select('role')
      .eq('auth_id', session.user.id)
      .eq('tenant_id', (await getTenantIdFromSlug(supabase, slug as string))!)
      .single();

    if (user?.role !== 'owner' && user?.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { data: updated, error } = await supabase
      .from('tenants')
      .update({ branding: req.body })
      .eq('slug', slug)
      .select('branding')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Log audit event
    await supabase.from('tenant_audit_log').insert({
      tenant_id: (await getTenantIdFromSlug(supabase, slug as string))!,
      user_id: session.user.id,
      action: 'UPDATE_BRANDING',
      resource_type: 'tenant',
      new_values: req.body,
    });

    return res.status(200).json(updated.branding);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function getTenantIdFromSlug(
  supabase: any,
  slug: string
): Promise<string | null> {
  const { data } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single();
  return data?.id || null;
}
```

### 3. OAuth Callback Handler

**File: `/pages/api/auth/[provider]/callback.ts`**

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { provider } = req.query;
  const { code, state } = req.query;
  const supabase = createServerSupabaseClient({ req, res });

  if (!code) {
    return res.status(400).json({ error: 'No authorization code' });
  }

  try {
    // Exchange code for token
    const { data, error } = await supabase.auth.exchangeCodeForSession(
      code as string
    );

    if (error || !data.session) {
      return res
        .status(400)
        .json({ error: 'Failed to authenticate', details: error?.message });
    }

    const { user } = data.session;

    // Get tenant from state or JWT claim
    const tenantId = state || user.user_metadata?.tenant_id;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant information missing' });
    }

    // Upsert user in tenant_users table
    const ssoProviderKey = `${provider}_${user.email?.split('@')[1]}` || 'oauth_' + provider;

    const { error: upsertError } = await supabase
      .from('tenant_users')
      .upsert(
        {
          tenant_id: tenantId,
          email: user.email,
          auth_id: user.id,
          sso_provider: `oauth_${provider}`,
          sso_external_id: user.id,
          role: 'member',
        },
        { onConflict: 'tenant_id,email' }
      );

    if (upsertError) {
      console.error('Error upserting tenant user:', upsertError);
      return res
        .status(500)
        .json({ error: 'Failed to create user record' });
    }

    // Redirect to tenant dashboard
    const { data: tenant } = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', tenantId)
      .single();

    return res.redirect(
      303,
      `https://${tenant?.slug}.sitesync.app/dashboard`
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

---

## Configuration Examples

### Tenant Creation Script

**File: `/scripts/create-tenant.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TenantInput {
  name: string;
  slug: string;
  owner_email: string;
  max_users?: number;
  max_projects?: number;
}

async function createTenant(input: TenantInput) {
  try {
    // Validate slug format
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(input.slug)) {
      throw new Error('Invalid slug format');
    }

    // Generate webhook secret
    const webhook_secret = crypto.randomBytes(32).toString('hex');

    // Create tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: input.name,
        slug: input.slug,
        owner_email: input.owner_email,
        webhook_secret,
        max_users: input.max_users || 50,
        max_projects: input.max_projects || 500,
      })
      .select()
      .single();

    if (tenantError) throw tenantError;

    // Create owner user
    const { data: user, error: userError } = await supabase.auth.admin.createUser({
      email: input.owner_email,
      password: crypto.randomBytes(16).toString('hex'),
      email_confirm: true,
      user_metadata: {
        tenant_id: tenant.id,
      },
    });

    if (userError) throw userError;

    // Add user to tenant_users with owner role
    const { error: tenantUserError } = await supabase
      .from('tenant_users')
      .insert({
        tenant_id: tenant.id,
        auth_id: user.user?.id,
        email: input.owner_email,
        role: 'owner',
      });

    if (tenantUserError) throw tenantUserError;

    // Create default subscription
    const { error: subscriptionError } = await supabase
      .from('tenant_subscriptions')
      .insert({
        tenant_id: tenant.id,
        plan_name: 'professional',
        pricing_model: 'hybrid',
        price_per_seat: 29,
        price_per_project: 199,
        transaction_fee_percentage: 2.5,
      });

    if (subscriptionError) throw subscriptionError;

    console.log('Tenant created successfully:');
    console.log(`  ID: ${tenant.id}`);
    console.log(`  Slug: ${tenant.slug}`);
    console.log(`  Domain: https://${tenant.slug}.sitesync.app`);
    console.log(`  Webhook Secret: ${webhook_secret}`);

    return tenant;
  } catch (error) {
    console.error('Error creating tenant:', error);
    throw error;
  }
}

// Run from CLI
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Usage: npx ts-node scripts/create-tenant.ts <name> <slug> <owner_email>');
  process.exit(1);
}

createTenant({
  name: args[0],
  slug: args[1],
  owner_email: args[2],
}).then(() => process.exit(0));
```

---

## Verification Script

**File: `/scripts/verify-white-label-setup.sh`**

```bash
#!/bin/bash

TENANT_SLUG=${1:-"demo-tenant"}
SUPABASE_URL=${SUPABASE_URL:-"http://localhost:54321"}
SUPABASE_KEY=${SUPABASE_KEY:-"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}

echo "=== White-Label Infrastructure Verification ==="
echo "Checking tenant: $TENANT_SLUG"
echo ""

# Check tenant exists
echo "1. Verifying tenant exists..."
curl -s "$SUPABASE_URL/rest/v1/tenants?slug=eq.$TENANT_SLUG" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" | jq '.[] | {id, name, slug}' || echo "FAIL: Tenant not found"

# Check branding config
echo ""
echo "2. Verifying branding configuration..."
curl -s "$SUPABASE_URL/rest/v1/tenants?slug=eq.$TENANT_SLUG" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" | jq '.[] | .branding' || echo "FAIL: Branding not found"

# Check feature flags
echo ""
echo "3. Verifying feature flags..."
TENANT_ID=$(curl -s "$SUPABASE_URL/rest/v1/tenants?slug=eq.$TENANT_SLUG" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" | jq -r '.[0].id')

curl -s "$SUPABASE_URL/rest/v1/tenant_feature_flags?tenant_id=eq.$TENANT_ID" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" | jq '.[] | {feature_key, enabled}' || echo "FAIL: Feature flags not found"

# Check SSO config
echo ""
echo "4. Verifying SSO configuration..."
curl -s "$SUPABASE_URL/rest/v1/tenants?slug=eq.$TENANT_SLUG" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" | jq '.[] | .sso_config | keys' || echo "FAIL: SSO config not found"

# Check tenant users
echo ""
echo "5. Verifying tenant users..."
curl -s "$SUPABASE_URL/rest/v1/tenant_users?tenant_id=eq.$TENANT_ID" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" | jq '.[] | {email, role}' || echo "FAIL: Tenant users not found"

# Check audit log
echo ""
echo "6. Verifying audit logging..."
curl -s "$SUPABASE_URL/rest/v1/tenant_audit_log?tenant_id=eq.$TENANT_ID&limit=5" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" | jq '.[] | {action, resource_type, created_at}' || echo "FAIL: Audit log not accessible"

echo ""
echo "=== Verification Complete ==="
```

---

## Success Metrics

| Metric | Target | Definition |
|--------|--------|-----------|
| **Tenant Provisioning Time** | <5 min | Time from signup to working white-label instance |
| **Feature Flag Toggle Latency** | <100ms | Time for feature flag changes to propagate |
| **SSO Authentication Success Rate** | >99.5% | % of valid SSO logins that succeed |
| **Data Isolation Breach Rate** | 0% | % of unauthorized cross-tenant data access |
| **Custom Domain Resolution** | <500ms | DNS + TLS handshake for tenant domain |
| **Branding CSS Load Time** | <200ms | Time to load tenant-specific CSS |
| **Multi-Tenant Query Performance** | <100ms | p95 response time for tenant-scoped queries |
| **Concurrent Tenants per Postgres** | 1000+ | Number of active tenant connections |

---

## Pricing Models

### Per-Seat Model
- **$29/user/month** for construction companies with variable team size
- Auto-scale billing based on active users
- Perfect for: Regional GCs, design-build firms

### Per-Project Model
- **$199/project/month** for project-based usage
- Fixed cost per active project
- Perfect for: Unions, national GC networks

### Transaction Fee Model
- **2.5% + $0.30** per payment processed through embedded fintech
- SiteSync captures platform fee (0.5%) + Stripe fee (2%)
- Perfect for: High-volume payment processing

### Hybrid Model (Recommended)
- **$29/user/month + $199/project + 2.5%** transaction fee
- Blended pricing captures all value streams
- Minimum $500/month, maximum $50K/month

---

## Deployment & Operations

### Tenant Isolation via Supabase Schemas

Each production white-label tenant can optionally receive a dedicated Supabase project for complete isolation:

```sql
-- In dedicated tenant project
CREATE SCHEMA tenant_data AUTHORIZATION postgres;

-- All tables are in tenant schema
CREATE TABLE tenant_data.projects (...);
CREATE TABLE tenant_data.tasks (...);
CREATE TABLE tenant_data.certified_payroll (...);

-- RLS still applies at row level
ALTER TABLE tenant_data.projects ENABLE ROW LEVEL SECURITY;
```

### Subdomain Routing

```typescript
// middleware.ts - Route based on tenant slug in subdomain
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const slug = hostname.split('.')[0];

  // Add tenant info to request headers for use in API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-slug', slug);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!_next|public).*)'],
};
```

---

This white-label infrastructure transforms SiteSync from a single-product company into a platform-as-a-service business model, enabling $50M+ ARR from 200+ white-label partners while maintaining a single codebase and operational footprint.
