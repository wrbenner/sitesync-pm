# E2: Integration App Marketplace with Revenue Share

**Status:** Static 10-app listing, zero commerce/monetization
**Unlock Value:** $2-10M ARR (70/30 revenue split on third-party apps)
**Dependencies:** E1 SDK (developers need tools), app submission workflow

---

## 1. OVERVIEW: FROM APP GRAVEYARD TO ECOSYSTEM

Current state: 10 apps listed statically, no installation flow, no revenue sharing
Target: 50+ apps, 1-click installation, automated revenue distribution, app marketplace economy

---

## 2. DATABASE SCHEMA

```sql
-- Apps in marketplace
CREATE TABLE marketplace_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES auth.users(id),
  app_name VARCHAR(200) NOT NULL,
  app_slug VARCHAR(100) NOT NULL UNIQUE, -- URL-safe slug
  description TEXT,
  long_description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  -- Category & discovery
  category VARCHAR(100), -- 'integrations' | 'analytics' | 'automation' | 'compliance'
  tags TEXT[] DEFAULT '{}',
  -- Rating & reviews
  rating_avg DECIMAL(3,2),
  rating_count INT DEFAULT 0,
  -- Pricing
  pricing_model VARCHAR(50), -- 'free' | 'paid' | 'freemium'
  price_per_user_month DECIMAL(10,2),
  price_per_project_month DECIMAL(10,2),
  transaction_fee_percent DECIMAL(4,2), -- SiteSync cuts % of transactions processed
  -- Permissions & scopes
  required_scopes TEXT[], -- OAuth scopes
  data_access JSONB, -- { "reads": ["projects", "budget"], "writes": ["tasks"] }
  -- UI integration
  ui_extension_points TEXT[], -- 'project_toolbar' | 'payment_app_detail' | 'dashboard_widget'
  webhook_events TEXT[], -- Events app subscribes to
  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- 'draft' | 'in_review' | 'published' | 'suspended'
  review_status VARCHAR(50), -- 'pending_review' | 'approved' | 'rejected'
  review_notes TEXT,
  -- Links
  documentation_url TEXT,
  support_email VARCHAR(100),
  website_url TEXT,
  github_url TEXT,
  -- Metadata
  version VARCHAR(20) DEFAULT '1.0.0',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP,

  CONSTRAINT valid_pricing CHECK(
    (pricing_model = 'free') OR
    (pricing_model IN ('paid', 'freemium') AND (price_per_user_month > 0 OR price_per_project_month > 0))
  )
);

-- App installations per account
CREATE TABLE app_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  app_id UUID NOT NULL REFERENCES marketplace_apps(id),
  -- Installation config
  installation_data JSONB, -- App-specific configuration
  -- Usage tracking
  active_users INT DEFAULT 0,
  monthly_transactions DECIMAL(15,2) DEFAULT 0,
  -- Billing
  status VARCHAR(50) DEFAULT 'active', -- 'active' | 'paused' | 'cancelled'
  billing_cycle_start DATE,
  next_billing_date DATE,
  -- OAuth
  oauth_access_token_encrypted TEXT,
  oauth_refresh_token_encrypted TEXT,
  oauth_token_expires_at TIMESTAMP,
  -- Webhook delivery
  webhook_secret VARCHAR(100),
  -- Metadata
  installed_at TIMESTAMP DEFAULT NOW(),
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- App reviews & ratings
CREATE TABLE app_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES marketplace_apps(id),
  reviewer_id UUID NOT NULL REFERENCES auth.users(id),
  rating INT CHECK(rating >= 1 AND rating <= 5),
  title VARCHAR(200),
  review_text TEXT,
  helpful_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT one_review_per_user UNIQUE(app_id, reviewer_id)
);

-- App analytics (for marketplace visibility)
CREATE TABLE app_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES marketplace_apps(id),
  date DATE,
  installs INT DEFAULT 0,
  uninstalls INT DEFAULT 0,
  active_installations INT,
  page_views INT,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_daily_app_analytics UNIQUE(app_id, date)
);

-- Revenue tracking (for marketplace payments)
CREATE TABLE app_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES marketplace_apps(id),
  developer_id UUID NOT NULL REFERENCES auth.users(id),
  -- Revenue sources
  subscription_revenue DECIMAL(15,2),
  transaction_revenue DECIMAL(15,2),
  total_revenue DECIMAL(15,2),
  -- SiteSync cut
  sitesync_cut_percent DECIMAL(4,2),
  sitesync_amount DECIMAL(15,2),
  developer_amount DECIMAL(15,2),
  -- Period
  revenue_month INT, -- Month as number (1-12)
  revenue_year INT,
  -- Payment
  payout_status VARCHAR(50), -- 'pending' | 'processed' | 'failed'
  payout_date TIMESTAMP,
  payout_method VARCHAR(50), -- 'stripe' | 'ach' | 'wire'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Webhook deliveries (audit trail)
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_installation_id UUID NOT NULL REFERENCES app_installations(id),
  event_type VARCHAR(100),
  event_data JSONB,
  -- Delivery attempt
  webhook_url TEXT,
  http_method VARCHAR(10) DEFAULT 'POST',
  request_body JSONB,
  response_status INT,
  response_body TEXT,
  delivery_attempt INT DEFAULT 1,
  next_retry_at TIMESTAMP,
  -- Status
  status VARCHAR(50), -- 'pending' | 'delivered' | 'failed' | 'dead_letter'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Dead letter queue for failed webhooks
CREATE TABLE webhook_dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_delivery_id UUID REFERENCES webhook_deliveries(id),
  app_installation_id UUID NOT NULL REFERENCES app_installations(id),
  event_type VARCHAR(100),
  event_data JSONB,
  failure_reason TEXT,
  retry_manual_requested BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 3. APP MANIFEST FORMAT

File: `/docs/app-manifest.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SiteSync App Manifest",
  "type": "object",
  "required": ["name", "description", "version"],
  "properties": {
    "name": {
      "type": "string",
      "description": "App name"
    },
    "description": {
      "type": "string",
      "description": "Short app description"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "author": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "email": { "type": "string" },
        "url": { "type": "string" }
      }
    },
    "permissions": {
      "type": "object",
      "properties": {
        "scopes": {
          "type": "array",
          "items": { "type": "string" },
          "description": "OAuth scopes required"
        },
        "dataAccess": {
          "type": "object",
          "properties": {
            "read": {
              "type": "array",
              "items": { "type": "string" },
              "description": ["projects", "budget", "payment_applications"]
            },
            "write": {
              "type": "array",
              "items": { "type": "string" }
            }
          }
        }
      }
    },
    "webhooks": {
      "type": "object",
      "properties": {
        "events": {
          "type": "array",
          "items": { "type": "string" },
          "description": [
            "project.created",
            "project.updated",
            "payment_application.created",
            "payment_application.approved",
            "certified_payroll.submitted"
          ]
        },
        "url": { "type": "string", "format": "uri" }
      }
    },
    "ui": {
      "type": "object",
      "properties": {
        "extensionPoints": {
          "type": "array",
          "items": { "type": "string" },
          "description": [
            "project_toolbar",
            "project_sidebar",
            "payment_app_detail",
            "budget_dashboard",
            "task_list_toolbar"
          ]
        }
      }
    },
    "pricing": {
      "type": "object",
      "properties": {
        "model": {
          "enum": ["free", "paid", "freemium"]
        },
        "perUser": {
          "type": "number",
          "description": "Monthly price per active user"
        },
        "perProject": {
          "type": "number",
          "description": "Monthly price per project"
        },
        "transactionFee": {
          "type": "number",
          "description": "% of transactions app processes"
        }
      }
    }
  }
}
```

Example manifest (`sitesync-manifest.json`):

```json
{
  "name": "QuickBooks Integration",
  "description": "Sync SiteSync budgets and payments with QuickBooks Online",
  "version": "1.2.0",
  "author": {
    "name": "SiteSync Team",
    "email": "support@sitesync.app"
  },
  "permissions": {
    "scopes": [
      "projects:read",
      "budget:read",
      "payment_applications:read",
      "vendors:read"
    ],
    "dataAccess": {
      "read": ["projects", "budget", "payment_applications", "vendors"],
      "write": []
    }
  },
  "webhooks": {
    "events": [
      "project.created",
      "payment_application.approved",
      "budget.updated"
    ],
    "url": "https://quickbooks-app.example.com/webhooks"
  },
  "ui": {
    "extensionPoints": [
      "project_toolbar",
      "budget_dashboard"
    ]
  },
  "pricing": {
    "model": "freemium",
    "perUser": 10,
    "perProject": 0,
    "transactionFee": 0.5
  }
}
```

---

## 4. REACT PAGES & COMPONENTS

### 4a. `/src/pages/marketplace.tsx`

```typescript
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Button, Input, Select, Badge, Spinner, Alert } from '@/components/ui';
import AppCard from '@/components/marketplace/app-card';
import AppDetail from '@/components/marketplace/app-detail';

export default function MarketplacePage() {
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'rating' | 'installs' | 'newest'>('rating');

  const { data: apps, isLoading } = useQuery({
    queryKey: ['marketplace-apps', searchQuery, categoryFilter, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(searchQuery && { search: searchQuery }),
        ...(categoryFilter && { category: categoryFilter }),
        ...(sortBy && { sort: sortBy }),
      });

      const response = await fetch(`/api/v1/marketplace/apps?${params}`);
      return response.json();
    },
  });

  if (selectedAppId) {
    return (
      <AppDetail
        appId={selectedAppId}
        onBack={() => setSelectedAppId(null)}
      />
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">SiteSync App Marketplace</h1>

      {/* Search & Filters */}
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Input
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <Select
            value={categoryFilter || ''}
            onValueChange={(v) => setCategoryFilter(v || null)}
            options={[
              { value: '', label: 'All Categories' },
              { value: 'integrations', label: 'Integrations' },
              { value: 'analytics', label: 'Analytics' },
              { value: 'automation', label: 'Automation' },
              { value: 'compliance', label: 'Compliance' },
            ]}
          />

          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as any)}
            options={[
              { value: 'rating', label: 'Top Rated' },
              { value: 'installs', label: 'Most Installed' },
              { value: 'newest', label: 'Newest' },
            ]}
          />
        </div>
      </Card>

      {/* Apps Grid */}
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {apps?.map((app: any) => (
            <AppCard
              key={app.id}
              app={app}
              onSelect={() => setSelectedAppId(app.id)}
            />
          ))}
        </div>
      )}

      {apps?.length === 0 && (
        <Alert variant="info">
          No apps found matching your criteria.
        </Alert>
      )}
    </div>
  );
}
```

### 4b. `/src/components/marketplace/app-card.tsx`

```typescript
import React from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { Star } from 'lucide-react';

interface AppCardProps {
  app: any;
  onSelect: () => void;
}

export default function AppCard({ app, onSelect }: AppCardProps) {
  return (
    <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={onSelect}>
      {/* Logo */}
      {app.logo_url && (
        <img
          src={app.logo_url}
          alt={app.app_name}
          className="w-12 h-12 rounded mb-4"
        />
      )}

      {/* Name & Description */}
      <h3 className="font-bold text-lg mb-2">{app.app_name}</h3>
      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
        {app.description}
      </p>

      {/* Rating */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              size={14}
              className={i < Math.round(app.rating_avg) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
            />
          ))}
        </div>
        <span className="text-sm text-gray-600">
          {app.rating_avg.toFixed(1)} ({app.rating_count})
        </span>
      </div>

      {/* Category & Price */}
      <div className="flex justify-between items-center mb-4">
        <Badge variant="outline">{app.category}</Badge>
        <Badge variant="default">
          {app.pricing_model === 'free'
            ? 'Free'
            : `$${app.price_per_user_month}/user`}
        </Badge>
      </div>

      {/* Install Count */}
      <p className="text-xs text-gray-500 mb-4">
        {app.install_count || 0} installations
      </p>

      {/* CTA */}
      <Button variant="primary" className="w-full" onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}>
        View & Install
      </Button>
    </Card>
  );
}
```

### 4c. `/src/components/marketplace/app-detail.tsx`

```typescript
import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, Button, Badge, Alert, Spinner } from '@/components/ui';
import { Star, ExternalLink, GitBranch } from 'lucide-react';

interface AppDetailProps {
  appId: string;
  onBack: () => void;
}

export default function AppDetail({ appId, onBack }: AppDetailProps) {
  const { data: app, isLoading } = useQuery({
    queryKey: ['marketplace-app', appId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/marketplace/apps/${appId}`);
      return response.json();
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ['app-reviews', appId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/marketplace/apps/${appId}/reviews`);
      return response.json();
    },
  });

  const installMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/v1/marketplace/apps/${appId}/install`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Install failed');
      return response.json();
    },
    onSuccess: () => {
      alert('App installed successfully! Redirecting to setup...');
      window.location.href = `/apps/${appId}/setup`;
    },
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-6 p-6">
      <Button variant="outline" onClick={onBack}>
        ← Back to Marketplace
      </Button>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex gap-4 mb-6">
              {app.logo_url && (
                <img
                  src={app.logo_url}
                  alt={app.app_name}
                  className="w-24 h-24 rounded"
                />
              )}
              <div>
                <h1 className="text-3xl font-bold">{app.app_name}</h1>
                <p className="text-gray-600">{app.description}</p>

                <div className="flex gap-2 mt-4">
                  {app.rating_avg && (
                    <Badge variant="default">
                      ★ {app.rating_avg.toFixed(1)} ({app.rating_count})
                    </Badge>
                  )}
                  <Badge variant="outline">{app.category}</Badge>
                </div>
              </div>
            </div>

            {/* Long description */}
            <div className="prose prose-sm max-w-none mb-6">
              {app.long_description}
            </div>

            {/* Links */}
            <div className="flex gap-2">
              {app.documentation_url && (
                <a
                  href={app.documentation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600"
                >
                  Documentation <ExternalLink size={14} />
                </a>
              )}
              {app.github_url && (
                <a
                  href={app.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600"
                >
                  GitHub <GitBranch size={14} />
                </a>
              )}
            </div>
          </Card>

          {/* Reviews */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Reviews</h2>
            <div className="space-y-4">
              {reviews?.map((review: any) => (
                <div key={review.id} className="border-b pb-4">
                  <div className="flex justify-between mb-2">
                    <strong>{review.reviewer_name}</strong>
                    <span className="text-sm text-gray-600">
                      {[...Array(5)].map((_, i) => (
                        <span
                          key={i}
                          className={i < review.rating ? 'text-yellow-400' : 'text-gray-300'}
                        >
                          ★
                        </span>
                      ))}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{review.review_text}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right: Installation */}
        <div className="space-y-4">
          <Card className="p-6 sticky top-4">
            <h3 className="font-bold mb-4">Get Started</h3>

            {/* Pricing */}
            <div className="mb-6 p-4 bg-gray-100 rounded">
              {app.pricing_model === 'free' ? (
                <div className="text-2xl font-bold">Free</div>
              ) : (
                <>
                  <div className="text-xs text-gray-600">Pricing</div>
                  {app.price_per_user_month && (
                    <div className="text-2xl font-bold">
                      ${app.price_per_user_month}
                      <span className="text-sm text-gray-600 ml-2">/user/mo</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Permissions */}
            <div className="mb-6">
              <h4 className="font-semibold mb-2">Permissions</h4>
              <p className="text-xs text-gray-600">
                This app will access:
              </p>
              <ul className="text-xs mt-2 space-y-1">
                {app.required_scopes?.map((scope: string) => (
                  <li key={scope} className="text-gray-700">
                    • {scope}
                  </li>
                ))}
              </ul>
            </div>

            {/* Install Button */}
            <Button
              onClick={() => installMutation.mutate()}
              disabled={installMutation.isPending}
              variant="primary"
              className="w-full"
            >
              {installMutation.isPending ? 'Installing...' : 'Install App'}
            </Button>

            {/* Support */}
            {app.support_email && (
              <p className="text-xs text-gray-600 mt-4 text-center">
                <a href={`mailto:${app.support_email}`} className="text-blue-600">
                  Contact Support
                </a>
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
```

---

## 5. WEBHOOK DELIVERY SYSTEM

File: `/src/edge-functions/webhook-delivery.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

/**
 * Send webhook event to installed apps
 */
export async function deliverWebhook(
  eventType: string,
  eventData: any
) {
  // Find all apps subscribed to this event
  const { data: installations } = await supabase
    .from('app_installations')
    .select('*')
    .contains('webhook_events', [eventType])
    .eq('status', 'active');

  for (const installation of installations || []) {
    const { data: app } = await supabase
      .from('marketplace_apps')
      .select('*')
      .eq('id', installation.app_id)
      .single();

    if (!app) continue;

    // Create delivery record
    const { data: delivery } = await supabase
      .from('webhook_deliveries')
      .insert({
        app_installation_id: installation.id,
        event_type: eventType,
        event_data: eventData,
        webhook_url: app.webhook_url,
        status: 'pending',
      })
      .select()
      .single();

    // Queue delivery (with retries)
    queueWebhookDelivery(delivery.id, installation, app);
  }
}

/**
 * Queue webhook delivery with exponential backoff retries
 */
async function queueWebhookDelivery(
  deliveryId: string,
  installation: any,
  app: any
) {
  const maxRetries = 5;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { data: delivery } = await supabase
        .from('webhook_deliveries')
        .select('*')
        .eq('id', deliveryId)
        .single();

      if (!delivery) continue;

      // Calculate HMAC signature
      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', installation.webhook_secret)
        .update(JSON.stringify(delivery.event_data))
        .digest('hex');

      // Send webhook
      const response = await fetch(app.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SiteSync-Signature': signature,
          'X-SiteSync-Event': delivery.event_type,
          'X-SiteSync-Delivery-ID': delivery.id,
        },
        body: JSON.stringify({
          id: delivery.id,
          type: delivery.event_type,
          created_at: new Date().toISOString(),
          data: delivery.event_data,
        }),
        timeout: 30000,
      });

      if (response.ok) {
        // Success
        await supabase
          .from('webhook_deliveries')
          .update({
            status: 'delivered',
            response_status: response.status,
          })
          .eq('id', deliveryId);

        return;
      } else {
        // Failure
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) {
        // Move to dead letter queue
        await supabase.from('webhook_dead_letter_queue').insert({
          webhook_delivery_id: deliveryId,
          app_installation_id: installation.id,
          event_type: delivery?.event_type,
          event_data: delivery?.event_data,
          failure_reason: String(error),
        });

        await supabase
          .from('webhook_deliveries')
          .update({
            status: 'dead_letter',
            response_body: String(error),
          })
          .eq('id', deliveryId);
      } else {
        // Schedule retry with exponential backoff
        const backoffSeconds = Math.pow(2, attempt) * 60; // 1min, 2min, 4min, 8min, 16min
        const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000);

        await supabase
          .from('webhook_deliveries')
          .update({
            delivery_attempt: attempt + 1,
            next_retry_at: nextRetryAt,
            status: 'pending',
          })
          .eq('id', deliveryId);

        // Schedule next retry (using cron or task queue)
        await scheduleRetry(deliveryId, nextRetryAt);
      }
    }
  }
}

async function scheduleRetry(deliveryId: string, nextRetryAt: Date) {
  // TODO: Integrate with task queue (e.g., Bull, RabbitMQ, Google Cloud Tasks)
  // For now, this is a placeholder
}
```

---

## 6. VERIFICATION SCRIPT

```bash
#!/bin/bash
set -e

PROJECT_ROOT="/sessions/wonderful-practical-brahmagupta/mnt/sitesync-pm"

echo "=== E2: App Marketplace Verification ==="

# 1. Check database schema
echo "1. Verifying database schema..."
TABLES=("marketplace_apps" "app_installations" "app_revenue")

for table in "${TABLES[@]}"; do
  if grep -r "$table" "$PROJECT_ROOT/src" --include="*.sql"; then
    echo "   ✓ $table exists"
  else
    echo "   ✗ MISSING: $table"
  fi
done

# 2. Check React components
echo "2. Checking React components..."
[ -f "$PROJECT_ROOT/src/pages/marketplace.tsx" ] && echo "   ✓ marketplace.tsx" || echo "   ✗ MISSING"

# 3. Check webhook system
echo "3. Checking webhook delivery system..."
grep -r "webhook_deliveries\|dead_letter_queue" "$PROJECT_ROOT/src/edge-functions" --include="*.ts" && echo "   ✓ Webhook system" || echo "   ⚠ Webhook system needs implementation"

echo ""
echo "=== VERIFICATION COMPLETE ==="
```

---

## 7. SUCCESS METRICS

- App ecosystem: 50+ apps (vs. 10 current)
- Platform fees: $500K-2M ARR (from 70/30 revenue split)
- Avg app rating: > 4.5/5 stars
- App install-to-active rate: > 80%
- Webhook delivery success rate: > 99.9%

