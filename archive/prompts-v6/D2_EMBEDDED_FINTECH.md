# D2: Full Embedded Fintech Platform

**Status:** Stripe Connect exists, need complete financial OS
**Unlock Value:** $3-8M ARR (1% platform fees on $300-800M processed annually)
**Dependencies:** Stripe Connect account, Supabase, React Query

---

## 1. OVERVIEW: FROM PAYMENTS TO FINTECH PLATFORM

Current state: Stripe Connect allows GCs to pay subs directly. Missing:
- Subcontractor payment portal (subs can't track payment status)
- Vendor invoice matching (no PO reconciliation)
- Retainage tracking (no visibility across subs)
- Early payment discount program (capture 0.5-2% SiteSync fees)
- Lending integration (critical for bank-financed projects)
- Cash flow forecasting (ML-powered prediction)

Revenue model: **0.5-2% platform fee on all processed transactions**

Example: $50M project → $250K-1M SiteSync platform revenue

---

## 2. DATABASE SCHEMA

```sql
-- Subcontractor payment accounts (Stripe Connect linked accounts)
CREATE TABLE subcontractor_payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id),
  stripe_account_id VARCHAR(100), -- Stripe Connect account ID
  stripe_person_id VARCHAR(100), -- Individual if sole proprietor
  account_status VARCHAR(50), -- 'pending' | 'active' | 'restricted' | 'suspended'
  -- Verification
  verification_status VARCHAR(50), -- 'verified' | 'pending_verification' | 'unverified'
  verification_started_at TIMESTAMP,
  verification_completed_at TIMESTAMP,
  -- Bank account for payouts
  bank_account_id VARCHAR(100),
  bank_name VARCHAR(100),
  bank_account_last4 CHAR(4),
  -- Tax ID & compliance
  tax_id_masked VARCHAR(20), -- Last 4 SSN or EIN
  tax_id_country CHAR(2) DEFAULT 'US',
  -- Preferences
  payout_frequency VARCHAR(20) DEFAULT 'weekly', -- 'daily' | 'weekly' | 'monthly'
  payout_minimum_amount DECIMAL(10,2) DEFAULT 100.00,
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_stripe_account UNIQUE(stripe_account_id)
);

-- Vendor invoices (PDF uploaded)
CREATE TABLE vendor_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  vendor_id UUID REFERENCES vendors(id),
  vendor_name VARCHAR(200),
  vendor_email VARCHAR(100),
  -- Upload
  invoice_file_url TEXT,
  invoice_file_size INT,
  ocr_extracted_at TIMESTAMP, -- When AI extracted line items
  -- Invoice metadata (extracted by AI)
  invoice_number VARCHAR(50),
  invoice_date DATE,
  invoice_total DECIMAL(12,2),
  invoice_currency VARCHAR(3) DEFAULT 'USD',
  -- Matching
  purchase_order_id UUID REFERENCES purchase_orders(id),
  po_matched_at TIMESTAMP,
  match_confidence DECIMAL(3,2), -- 0.0-1.0
  -- Status workflow
  status VARCHAR(50) DEFAULT 'received', -- 'received' | 'extracted' | 'po_matched' | 'approved' | 'rejected' | 'payment_scheduled' | 'paid'
  rejection_reason TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP,
  -- Cost code allocation
  cost_code_id UUID REFERENCES cost_codes(id),
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_invoice UNIQUE(vendor_id, invoice_number, invoice_date)
);

-- Invoice line items (extracted by Claude Vision)
CREATE TABLE vendor_invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_invoice_id UUID NOT NULL REFERENCES vendor_invoices(id) ON DELETE CASCADE,
  -- Line item
  line_number INT,
  description VARCHAR(500),
  unit_of_measure VARCHAR(20),
  quantity DECIMAL(10,3),
  unit_price DECIMAL(10,2),
  line_total DECIMAL(12,2),
  -- PO matching
  purchase_order_line_id UUID REFERENCES purchase_order_line_items(id),
  po_matched BOOLEAN DEFAULT FALSE,
  quantity_variance DECIMAL(6,2), -- Over/under ordered
  price_variance DECIMAL(10,2), -- Price difference
  -- Cost allocation
  cost_code_id UUID REFERENCES cost_codes(id),

  created_at TIMESTAMP DEFAULT NOW()
);

-- Retainage tracking (for all payment apps)
CREATE TABLE retainage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_app_id UUID REFERENCES payment_applications(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id),
  -- Amount details
  total_amount_claimed DECIMAL(12,2),
  retainage_percent DECIMAL(4,2), -- e.g., 5.00%
  retainage_amount DECIMAL(12,2) GENERATED ALWAYS AS (
    total_amount_claimed * (retainage_percent / 100.0)
  ) STORED,
  retainage_released_date DATE,
  retainage_released_amount DECIMAL(12,2),
  -- Lien waiver connection
  lien_waiver_final BOOLEAN DEFAULT FALSE, -- Did they waive final lien?
  lien_waiver_id UUID REFERENCES lien_waivers(id),
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Early payment discount program
CREATE TABLE early_payment_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_app_id UUID NOT NULL REFERENCES payment_applications(id),
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id),
  -- Offer details
  original_amount DECIMAL(12,2),
  discount_percent DECIMAL(4,2), -- e.g., 2.0% = 2/10 net 30
  discount_amount DECIMAL(12,2) GENERATED ALWAYS AS (
    original_amount * (discount_percent / 100.0)
  ) STORED,
  amount_after_discount DECIMAL(12,2) GENERATED ALWAYS AS (
    original_amount - (original_amount * (discount_percent / 100.0))
  ) STORED,
  -- Terms
  discount_deadline DATE, -- When discount expires (e.g., net 10)
  final_due_date DATE, -- e.g., net 30
  -- SiteSync revenue
  sitesync_platform_fee_percent DECIMAL(4,2) DEFAULT 0.50, -- SiteSync takes 0.5-2% of discount
  sitesync_fee_amount DECIMAL(12,2) GENERATED ALWAYS AS (
    discount_amount * (sitesync_platform_fee_percent / 100.0)
  ) STORED,
  -- Status
  status VARCHAR(50) DEFAULT 'offered', -- 'offered' | 'accepted' | 'rejected' | 'expired' | 'completed'
  accepted_at TIMESTAMP,
  rejected_at TIMESTAMP,
  payment_received_at TIMESTAMP,
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Construction lending integration
CREATE TABLE construction_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  lender_id UUID REFERENCES vendors(id), -- Bank as vendor
  lender_name VARCHAR(200),
  lender_contact_email VARCHAR(100),
  -- Loan details
  loan_amount DECIMAL(15,2),
  interest_rate DECIMAL(6,4),
  loan_term_months INT,
  -- Draw management
  draw_schedule_type VARCHAR(50), -- 'milestone' | 'percentage_complete' | 'time_based' | 'manual'
  -- Inspection workflow
  inspector_required BOOLEAN DEFAULT TRUE,
  inspector_id UUID REFERENCES users(id),
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active' | 'funded' | 'closed'
  funded_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Draw requests for construction loans
CREATE TABLE loan_draw_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  construction_loan_id UUID NOT NULL REFERENCES construction_loans(id),
  -- Draw details
  draw_number INT,
  draw_date TIMESTAMP,
  amount_requested DECIMAL(12,2),
  -- Milestone tracking
  milestone_id UUID REFERENCES milestones(id),
  percent_complete DECIMAL(5,2),
  -- Documentation
  supporting_documents_url TEXT[], -- Array of URLs
  -- Inspection
  inspector_approval_required BOOLEAN,
  inspector_id UUID REFERENCES users(id),
  inspector_approved_at TIMESTAMP,
  inspector_notes TEXT,
  -- Approval workflow
  status VARCHAR(50) DEFAULT 'submitted', -- 'draft' | 'submitted' | 'approved' | 'funded' | 'rejected'
  lender_approved_at TIMESTAMP,
  amount_approved DECIMAL(12,2),
  approved_by UUID REFERENCES auth.users(id),
  -- Disbursement
  disbursement_date TIMESTAMP,
  disbursement_reference_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cash flow forecast (AI-powered)
CREATE TABLE cash_flow_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  forecast_date DATE, -- When forecast was generated
  forecast_horizon_days INT DEFAULT 90,
  -- ML model metadata
  model_version VARCHAR(20),
  model_accuracy DECIMAL(4,2), -- Historical MAPE
  -- Forecast data points
  data JSONB, -- { "2026-04-01": { "inflow": 50000, "outflow": 35000, "net": 15000 }, ... }
  assumptions TEXT, -- Model assumptions & notes
  -- Confidence
  confidence_level VARCHAR(20), -- 'high' | 'medium' | 'low'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tax documents (1099-NEC, 1099-MISC)
CREATE TABLE tax_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id),
  tax_year INT,
  document_type VARCHAR(20), -- '1099-NEC' | '1099-MISC' | '1098' | 'W-2'
  amount DECIMAL(12,2),
  -- Recipient info
  recipient_name VARCHAR(200),
  recipient_tin VARCHAR(20), -- Tax ID
  recipient_address TEXT,
  -- IRS submission
  irs_submission_date TIMESTAMP,
  irs_confirmation_number VARCHAR(50),
  -- File
  document_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Payment transaction ledger (audit trail)
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id),
  payment_app_id UUID REFERENCES payment_applications(id),
  early_payment_offer_id UUID REFERENCES early_payment_offers(id),
  -- Transaction details
  transaction_type VARCHAR(50), -- 'payment' | 'retainage_hold' | 'retainage_release' | 'early_pay_discount' | 'fee'
  amount DECIMAL(12,2),
  -- Stripe details
  stripe_transfer_id VARCHAR(100),
  stripe_charge_id VARCHAR(100),
  stripe_payout_id VARCHAR(100),
  -- Status
  status VARCHAR(50), -- 'pending' | 'succeeded' | 'failed' | 'reversed'
  failure_reason TEXT,
  -- Timing
  initiated_at TIMESTAMP,
  settled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 3. REACT PAGES & COMPONENTS

### 3a. `/src/pages/fintech-dashboard.tsx`

```typescript
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Tabs, Button, Alert } from '@/components/ui';
import { useProjectStore } from '@/stores/projects';
import VendorInvoiceCenter from '@/components/fintech/vendor-invoice-center';
import RetainageTracker from '@/components/fintech/retainage-tracker';
import EarlyPaymentDashboard from '@/components/fintech/early-payment-dashboard';
import SubcontractorPortal from '@/components/fintech/subcontractor-portal';
import CashFlowForecast from '@/components/fintech/cash-flow-forecast';

export default function FintechDashboard() {
  const { activeProject } = useProjectStore();
  const [viewMode, setViewMode] = useState<'overview' | 'invoices' | 'retainage' | 'early-pay' | 'forecast'>('overview');

  // Fetch financial summary
  const { data: financialSummary } = useQuery({
    queryKey: ['financial-summary', activeProject?.id],
    queryFn: async () => {
      const response = await fetch(`/api/v1/projects/${activeProject?.id}/financial-summary`);
      return response.json();
    },
    enabled: !!activeProject?.id,
  });

  if (!activeProject) return <Alert>Select a project</Alert>;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Financial Operating System</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600">Total Invoiced</div>
          <div className="text-2xl font-bold">${(financialSummary?.total_invoiced / 1000000).toFixed(1)}M</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Retainage Held</div>
          <div className="text-2xl font-bold">${(financialSummary?.total_retainage / 1000).toFixed(0)}K</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Early Pay Offers</div>
          <div className="text-2xl font-bold">${(financialSummary?.early_pay_total / 1000).toFixed(0)}K</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">SiteSync Revenue (YTD)</div>
          <div className="text-2xl font-bold text-green-600">${(financialSummary?.sitesync_revenue / 1000).toFixed(0)}K</div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <Tabs.List>
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="invoices">Vendor Invoices</Tabs.Trigger>
          <Tabs.Trigger value="retainage">Retainage Tracking</Tabs.Trigger>
          <Tabs.Trigger value="early-pay">Early Payment Offers</Tabs.Trigger>
          <Tabs.Trigger value="forecast">Cash Flow Forecast</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="overview">
          <SubcontractorPortal projectId={activeProject.id} />
        </Tabs.Content>

        <Tabs.Content value="invoices">
          <VendorInvoiceCenter projectId={activeProject.id} />
        </Tabs.Content>

        <Tabs.Content value="retainage">
          <RetainageTracker projectId={activeProject.id} />
        </Tabs.Content>

        <Tabs.Content value="early-pay">
          <EarlyPaymentDashboard projectId={activeProject.id} />
        </Tabs.Content>

        <Tabs.Content value="forecast">
          <CashFlowForecast projectId={activeProject.id} />
        </Tabs.Content>
      </Tabs>
    </div>
  );
}
```

### 3b. `/src/components/fintech/vendor-invoice-center.tsx`

```typescript
import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, Button, Input, Table, Badge, Dialog, Spinner, Alert } from '@/components/ui';
import { format } from 'date-fns';

interface VendorInvoiceCenterProps {
  projectId: string;
}

export default function VendorInvoiceCenter({ projectId }: VendorInvoiceCenterProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);

  // Fetch invoices
  const { data: invoices, refetch } = useQuery({
    queryKey: ['vendor-invoices', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/projects/${projectId}/vendor-invoices`);
      return response.json();
    },
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('project_id', projectId);

      const response = await fetch('/api/v1/vendor-invoices/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: () => {
      setUploadDialogOpen(false);
      refetch();
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await fetch(`/api/v1/vendor-invoices/${invoiceId}/approve`, {
        method: 'POST',
      });
      return response.json();
    },
    onSuccess: () => refetch(),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Vendor Invoice Management</h2>
        <Button
          onClick={() => setUploadDialogOpen(true)}
          variant="primary"
        >
          + Upload Invoice
        </Button>
      </div>

      {/* Invoices Table */}
      <Card className="p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-4 py-2 text-left">Invoice #</th>
              <th className="px-4 py-2 text-left">Vendor</th>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2 text-left">PO Matched</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices?.map((inv: any) => (
              <tr key={inv.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2 font-mono">{inv.invoice_number}</td>
                <td className="px-4 py-2">{inv.vendor_name}</td>
                <td className="px-4 py-2">{format(new Date(inv.invoice_date), 'MMM d')}</td>
                <td className="px-4 py-2 text-right font-mono">${inv.invoice_total.toFixed(2)}</td>
                <td className="px-4 py-2">
                  {inv.po_matched_at ? (
                    <Badge variant="success">Matched</Badge>
                  ) : (
                    <Badge variant="warning">Pending</Badge>
                  )}
                </td>
                <td className="px-4 py-2">
                  <Badge
                    variant={
                      inv.status === 'approved'
                        ? 'success'
                        : inv.status === 'rejected'
                          ? 'error'
                          : 'default'
                    }
                  >
                    {inv.status}
                  </Badge>
                </td>
                <td className="px-4 py-2 flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedInvoice(inv.id)}
                  >
                    Details
                  </Button>
                  {inv.status === 'po_matched' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => approveMutation.mutate(inv.id)}
                      disabled={approveMutation.isPending}
                    >
                      Approve
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Upload Dialog */}
      {uploadDialogOpen && (
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <div className="space-y-4 p-6">
            <h3 className="text-lg font-semibold">Upload Invoice</h3>
            <p className="text-gray-600">
              Upload a PDF invoice. Our AI will extract line items and match to purchase orders.
            </p>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  uploadMutation.mutate(e.target.files[0]);
                }
              }}
              disabled={uploadMutation.isPending}
            />
            {uploadMutation.isPending && <Spinner />}
            <Button onClick={() => setUploadDialogOpen(false)} variant="outline">
              Cancel
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
```

### 3c. `/src/components/fintech/early-payment-dashboard.tsx`

```typescript
import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, Button, Badge, Table, Alert } from '@/components/ui';
import { format } from 'date-fns';

interface EarlyPaymentDashboardProps {
  projectId: string;
}

export default function EarlyPaymentDashboard({ projectId }: EarlyPaymentDashboardProps) {
  const { data: offers, refetch } = useQuery({
    queryKey: ['early-payment-offers', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/projects/${projectId}/early-payment-offers`);
      return response.json();
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (offerId: string) => {
      const response = await fetch(`/api/v1/early-payment-offers/${offerId}/accept`, {
        method: 'POST',
      });
      return response.json();
    },
    onSuccess: () => refetch(),
  });

  const totalOffered = offers?.reduce((sum: number, o: any) => sum + o.discount_amount, 0) || 0;
  const totalAccepted = offers
    ?.filter((o: any) => o.status === 'accepted')
    .reduce((sum: number, o: any) => sum + o.sitesync_fee_amount, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600">Total Discounts Offered</div>
          <div className="text-2xl font-bold">${(totalOffered / 1000).toFixed(0)}K</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">SiteSync Revenue (from offers)</div>
          <div className="text-2xl font-bold text-green-600">${(totalAccepted / 1000).toFixed(0)}K</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Acceptance Rate</div>
          <div className="text-2xl font-bold">
            {offers?.length > 0
              ? (
                  ((offers.filter((o: any) => o.status === 'accepted').length / offers.length) * 100).toFixed(0)
                )
              : '0'}
            %
          </div>
        </Card>
      </div>

      <Card className="p-4 overflow-x-auto">
        <h3 className="text-lg font-semibold mb-4">Active Offers</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-4 py-2 text-left">Subcontractor</th>
              <th className="px-4 py-2 text-right">Original Amount</th>
              <th className="px-4 py-2 text-right">Discount (%)</th>
              <th className="px-4 py-2 text-right">Discount Amount</th>
              <th className="px-4 py-2 text-left">Deadline</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {offers?.map((offer: any) => (
              <tr key={offer.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">{offer.subcontractor_name}</td>
                <td className="px-4 py-2 text-right font-mono">${offer.original_amount.toFixed(2)}</td>
                <td className="px-4 py-2 text-right font-semibold">{offer.discount_percent}%</td>
                <td className="px-4 py-2 text-right font-mono text-green-600">
                  ${offer.discount_amount.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-sm">
                  {format(new Date(offer.discount_deadline), 'MMM d')}
                </td>
                <td className="px-4 py-2">
                  <Badge
                    variant={offer.status === 'accepted' ? 'success' : 'default'}
                  >
                    {offer.status}
                  </Badge>
                </td>
                <td className="px-4 py-2">
                  {offer.status === 'offered' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => acceptMutation.mutate(offer.id)}
                      disabled={acceptMutation.isPending}
                    >
                      Accept
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Alert variant="info">
        <strong>How Early Payment Works:</strong> Offer subs a 2% discount if they pay in 10 days instead of 30.
        SiteSync takes 0.5-2% of the discount amount as platform fee.
      </Alert>
    </div>
  );
}
```

### 3d. `/src/components/fintech/subcontractor-portal.tsx`

```typescript
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Button, Badge, Table, Spinner } from '@/components/ui';
import { format } from 'date-fns';

interface SubcontractorPortalProps {
  projectId: string;
}

export default function SubcontractorPortal({ projectId }: SubcontractorPortalProps) {
  const { data: paymentApps, isLoading } = useQuery({
    queryKey: ['subcontractor-payment-apps', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/projects/${projectId}/payment-applications/subcontractor-view`);
      return response.json();
    },
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Subcontractor Payment Dashboard</h2>

      <Card className="p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-4 py-2 text-left">Application</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2 text-right">Retainage</th>
              <th className="px-4 py-2 text-right">Net Payment</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Due Date</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paymentApps?.map((app: any) => (
              <tr key={app.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">App #{app.application_number}</td>
                <td className="px-4 py-2 text-right font-mono">${app.total_amount_claimed.toFixed(2)}</td>
                <td className="px-4 py-2 text-right font-mono text-red-600">
                  -${app.retainage_amount.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right font-mono font-bold">
                  ${(app.total_amount_claimed - app.retainage_amount).toFixed(2)}
                </td>
                <td className="px-4 py-2">
                  <Badge
                    variant={
                      app.status === 'paid'
                        ? 'success'
                        : app.status === 'approved'
                          ? 'default'
                          : 'warning'
                    }
                  >
                    {app.status}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-sm">
                  {format(new Date(app.due_date), 'MMM d, yyyy')}
                </td>
                <td className="px-4 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      window.location.href = `/payment-apps/${app.id}`;
                    }}
                  >
                    View Details
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-4">Download & Submit</h3>
        <div className="space-y-2">
          <Button variant="outline" className="w-full">
            Download Remittance
          </Button>
          <Button variant="outline" className="w-full">
            Download Tax Documents (1099)
          </Button>
        </div>
      </Card>
    </div>
  );
}
```

---

## 4. STRIPE CONNECT ENHANCED

File: `/src/edge-functions/stripe-embedded-fintech.ts`

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

/**
 * Create Stripe Connect account for subcontractor
 */
export async function createStripeConnectAccount(
  subcontractorId: string,
  email: string,
  businessName: string
) {
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'US',
    email: email,
    business_profile: {
      name: businessName,
      url: `https://sitesync.app/sub/${subcontractorId}`,
    },
    capabilities: {
      transfers: { requested: true },
      card_payments: { requested: true },
    },
  });

  return account.id;
}

/**
 * Create transfer to subcontractor account
 */
export async function createTransferToSubcontractor(
  subcontractorStripeAccountId: string,
  amountCents: number,
  paymentAppId: string
) {
  const transfer = await stripe.transfers.create({
    amount: amountCents,
    currency: 'usd',
    destination: subcontractorStripeAccountId,
    metadata: {
      payment_app_id: paymentAppId,
    },
  });

  return transfer;
}

/**
 * Create payout from platform account (for early payment)
 */
export async function createPayout(
  subcontractorStripeAccountId: string,
  amountCents: number,
  description: string
) {
  const payout = await stripe.payouts.create(
    {
      amount: amountCents,
      currency: 'usd',
      description: description,
    },
    { stripeAccount: subcontractorStripeAccountId }
  );

  return payout;
}

/**
 * Webhook for Stripe payment completion
 */
export async function handleStripeWebhook(event: Stripe.Event) {
  switch (event.type) {
    case 'charge.completed':
    case 'charge.succeeded':
      // Mark payment as complete
      break;
    case 'account.updated':
      // Update verification status
      break;
    case 'payout.paid':
      // Confirm payout to subcontractor
      break;
  }
}
```

---

## 5. CASH FLOW FORECASTING (ML-POWERED)

File: `/src/edge-functions/cash-flow-forecast.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const client = new Anthropic();

/**
 * Generate AI-powered cash flow forecast
 */
export async function generateCashFlowForecast(projectId: string) {
  // Fetch project financial data
  const { data: paymentApps } = await supabase
    .from('payment_applications')
    .select('*')
    .eq('project_id', projectId);

  const { data: purchaseOrders } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('project_id', projectId);

  const { data: budget } = await supabase
    .from('budgets')
    .select('*')
    .eq('project_id', projectId)
    .single();

  // Prepare context for Claude
  const context = `
You are a construction finance expert. Analyze the following project data and generate a 90-day cash flow forecast.

Payment Applications (historical):
${JSON.stringify(paymentApps, null, 2)}

Purchase Orders (committed):
${JSON.stringify(purchaseOrders, null, 2)}

Total Project Budget: $${budget?.total_budget}

Generate a JSON forecast with daily/weekly cash flow predictions including:
- Expected inflows (payment from owner)
- Expected outflows (payments to subs, vendors)
- Net cash position
- Risk factors
- Assumptions
`;

  const response = await client.messages.create({
    model: 'claude-opus-4-1',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: context,
      },
    ],
  });

  const forecastText = response.content[0].type === 'text' ? response.content[0].text : '';

  // Store forecast
  const { data: forecast } = await supabase
    .from('cash_flow_forecasts')
    .insert({
      project_id: projectId,
      forecast_date: new Date(),
      data: parseJsonFromResponse(forecastText),
      assumptions: extractAssumptions(forecastText),
      model_version: 'claude-opus-4-1',
      confidence_level: 'high',
    })
    .select()
    .single();

  return forecast;
}

function parseJsonFromResponse(text: string): any {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
}

function extractAssumptions(text: string): string {
  const assumptionsMatch = text.match(/Assumptions?:[\s\S]*?(?=\n\n|$)/i);
  return assumptionsMatch ? assumptionsMatch[0] : '';
}
```

---

## 6. API ENDPOINTS

File: `/src/edge-functions/api/fintech.ts`

```typescript
// POST /api/v1/projects/:projectId/financial-summary
export async function getFinancialSummary(projectId: string) {
  const { data } = await supabase
    .from('payment_applications')
    .select('total_amount_claimed, retainage_amount')
    .eq('project_id', projectId);

  const { data: earlyPayOffers } = await supabase
    .from('early_payment_offers')
    .select('discount_amount, sitesync_fee_amount, status')
    .eq('status', 'accepted')
    .in(
      'payment_app_id',
      data?.map((p) => p.id) || []
    );

  return {
    total_invoiced: data?.reduce((sum, p) => sum + p.total_amount_claimed, 0) || 0,
    total_retainage: data?.reduce((sum, p) => sum + p.retainage_amount, 0) || 0,
    early_pay_total: earlyPayOffers?.reduce((sum, o) => sum + o.discount_amount, 0) || 0,
    sitesync_revenue: earlyPayOffers?.reduce((sum, o) => sum + o.sitesync_fee_amount, 0) || 0,
  };
}

// POST /api/v1/vendor-invoices/upload
export async function uploadVendorInvoice(formData: FormData, projectId: string) {
  const file = formData.get('file') as File;

  // Upload to Supabase Storage
  const { data: uploadData } = await supabase.storage
    .from('vendor-invoices')
    .upload(`${projectId}/${file.name}`, file);

  // Extract line items using Claude Vision
  const fileUrl = uploadData?.path;

  // TODO: Call Claude Vision API to extract invoice details

  return {
    invoice_id: 'new-invoice-id',
    status: 'extracted',
    line_items: [],
  };
}

// POST /api/v1/early-payment-offers/:offerId/accept
export async function acceptEarlyPaymentOffer(offerId: string) {
  // Create payout via Stripe
  // Mark offer as accepted
  // Schedule payment
}
```

---

## 7. VERIFICATION SCRIPT

```bash
#!/bin/bash
set -e

PROJECT_ROOT="/sessions/wonderful-practical-brahmagupta/mnt/sitesync-pm"

echo "=== D2: Embedded Fintech Verification ==="

# 1. Check database schema
echo "1. Verifying database schema..."
TABLES=(
  "vendor_invoices"
  "subcontractor_payment_accounts"
  "retainage_tracking"
  "early_payment_offers"
  "construction_loans"
  "cash_flow_forecasts"
)

for table in "${TABLES[@]}"; do
  if grep -r "$table" "$PROJECT_ROOT/src" --include="*.sql"; then
    echo "   ✓ $table schema exists"
  else
    echo "   ✗ MISSING: $table"
  fi
done

# 2. Check React components
echo "2. Checking React components..."
COMPONENTS=(
  "fintech-dashboard.tsx"
  "vendor-invoice-center.tsx"
  "retainage-tracker.tsx"
  "early-payment-dashboard.tsx"
  "subcontractor-portal.tsx"
  "cash-flow-forecast.tsx"
)

for comp in "${COMPONENTS[@]}"; do
  if [ -f "$PROJECT_ROOT/src/pages/$comp" ] || [ -f "$PROJECT_ROOT/src/components/fintech/$comp" ]; then
    echo "   ✓ $comp exists"
  else
    echo "   ✗ MISSING: $comp"
  fi
done

# 3. Check Stripe integration
echo "3. Checking Stripe integration..."
grep -r "stripe" "$PROJECT_ROOT/src/edge-functions" --include="*.ts" | grep -i "connect" && echo "   ✓ Stripe Connect configured" || echo "   ⚠ Stripe Connect needs setup"

# 4. Check AI integration (Claude Vision for invoice extraction)
echo "4. Checking Claude Vision for OCR..."
grep -r "vision" "$PROJECT_ROOT/src/edge-functions" --include="*.ts" && echo "   ✓ Claude Vision available" || echo "   ⚠ Claude Vision needs implementation"

echo ""
echo "=== VERIFICATION COMPLETE ==="
```

---

## 8. INTEGRATION CHECKLIST

- [ ] Database schema migrated for all fintech tables
- [ ] Vendor invoice upload & AI extraction (Claude Vision)
- [ ] PO matching logic (invoice line items vs. PO lines)
- [ ] Retainage tracking & calculation (% withholding)
- [ ] Early payment discount workflow (2/10 net 30)
- [ ] Stripe Connect integration for subcontractor accounts
- [ ] Payout orchestration (daily/weekly payroll automation)
- [ ] Cash flow forecasting (Claude ML model)
- [ ] Tax document generation (1099-NEC, 1099-MISC)
- [ ] Subcontractor portal (payment status visibility)
- [ ] Lending draw request workflow
- [ ] Platform fee calculation & revenue tracking
- [ ] Webhook handlers for Stripe payment events
- [ ] Audit trail for all financial transactions

---

## 9. SUCCESS METRICS

- Platform fees collected: $100K+ (first 100 customers)
- Invoice processing time: < 2 minutes (AI extraction)
- Early payment offer acceptance rate: > 25% (0.5-2% margin)
- Cash flow forecast accuracy: MAPE < 15% (vs 40% manual)
- Retainage transparency: 100% visibility (vs 20% manual tracking)
- Subcontractor NPS (fintech): > 8/10 (payment transparency)

