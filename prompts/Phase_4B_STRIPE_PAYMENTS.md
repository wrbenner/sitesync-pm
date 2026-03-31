# Phase 4B: Stripe Connect Embedded Payments

**Status**: Phase 4 (Construction Fintech)
**Priority**: Critical
**Effort**: 14 days
**Target**: Day 101-114

---

## Pre-Requisites

### Dependencies
- @stripe/react-stripe-js 2.4+
- @stripe/stripe-js 2.1+
- stripe (backend) 13.0+

### Stripe Setup
- Stripe Connect platform (with custom accounts enabled)
- Restricted API keys for separate sub-accounts
- Webhook signing secret

### Database Tables

```sql
CREATE TABLE stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) UNIQUE,
  stripe_account_id VARCHAR(255) UNIQUE,
  stripe_status VARCHAR(50), -- 'pending', 'active', 'restricted', 'suspended'
  onboarding_complete BOOLEAN DEFAULT false,
  charges_enabled BOOLEAN DEFAULT false,
  transfers_enabled BOOLEAN DEFAULT false,
  email VARCHAR(255),
  country VARCHAR(2),
  account_number VARCHAR(255), -- Encrypted
  routing_number VARCHAR(255), -- Encrypted
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  pay_app_id UUID NOT NULL REFERENCES pay_apps(id),
  recipient_contractor_id UUID NOT NULL REFERENCES contractors(id),
  amount DECIMAL(15, 2) NOT NULL,
  amount_cents INT, -- For Stripe API
  currency VARCHAR(3) DEFAULT 'USD',
  stripe_transfer_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  status VARCHAR(50), -- 'pending', 'processing', 'completed', 'failed', 'refunded'
  payment_method VARCHAR(50), -- 'ach', 'wire', 'card'
  initiator_user_id UUID NOT NULL REFERENCES auth.users(id),
  scheduled_for TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  idempotency_key VARCHAR(255) UNIQUE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE payment_retainage_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id),
  retainage_amount DECIMAL(15, 2) NOT NULL,
  hold_release_date DATE,
  released BOOLEAN DEFAULT false,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE remittance_advices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id),
  contractor_id UUID NOT NULL REFERENCES contractors(id),
  pdf_url TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_stripe_accounts_contractor ON stripe_accounts(contractor_id);
CREATE INDEX idx_payments_project ON payments(project_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_contractor ON payments(recipient_contractor_id);
```

---

## Implementation Steps

### Step 1: Stripe Account Manager

**File**: `src/services/payments/StripeAccountManager.ts`

```typescript
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export interface StripeAccountInfo {
  contractorId: string;
  email: string;
  country: string;
  accountHolder: string;
  accountNumber?: string;
  routingNumber?: string;
  businessType: 'individual' | 'company'; // for w9
}

export class StripeAccountManager {
  async createConnectAccount(data: StripeAccountInfo): Promise<string> {
    // Create Stripe Connect custom account
    const stripeAccount = await stripe.accounts.create({
      type: 'custom',
      country: data.country,
      email: data.email,
      business_profile: {
        name: data.accountHolder,
        support_email: data.email,
      },
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
    });

    // Save to database
    const { data: saved, error } = await supabase
      .from('stripe_accounts')
      .insert({
        contractor_id: data.contractorId,
        stripe_account_id: stripeAccount.id,
        stripe_status: 'pending',
        email: data.email,
        country: data.country,
      })
      .select('id');

    if (error) {
      throw new Error(`Failed to save Stripe account: ${error.message}`);
    }

    return stripeAccount.id;
  }

  async getOnboardingLink(
    contractorId: string,
    refreshUrl: string,
    returnUrl: string
  ): Promise<string> {
    // Get existing Stripe account ID
    const { data, error } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('contractor_id', contractorId)
      .single();

    if (error || !data) {
      throw new Error('Stripe account not found');
    }

    const link = await stripe.accountLinks.create({
      account: data.stripe_account_id,
      type: 'account_onboarding',
      refresh_url: refreshUrl,
      return_url: returnUrl,
      collection_options: {
        fields: 'eventually_due',
        future_requirements: 'include',
      },
    });

    return link.url;
  }

  async getAccountStatus(
    contractorId: string
  ): Promise<{
    status: string;
    chargesEnabled: boolean;
    transfersEnabled: boolean;
  }> {
    const { data, error } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id, stripe_status, charges_enabled, transfers_enabled')
      .eq('contractor_id', contractorId)
      .single();

    if (error) {
      throw new Error('Account not found');
    }

    // Fetch latest status from Stripe
    const account = await stripe.accounts.retrieve(data.stripe_account_id);

    // Update database
    await supabase
      .from('stripe_accounts')
      .update({
        charges_enabled: account.charges_enabled,
        transfers_enabled: account.transfers_enabled,
        onboarding_complete: !account.requirements?.currently_due?.length,
      })
      .eq('stripe_account_id', data.stripe_account_id);

    return {
      status: account.charges_enabled ? 'active' : 'pending',
      chargesEnabled: account.charges_enabled,
      transfersEnabled: account.transfers_enabled,
    };
  }

  async handleWebhook(
    event: Stripe.Event
  ): Promise<void> {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await supabase
          .from('stripe_accounts')
          .update({
            stripe_status: account.charges_enabled ? 'active' : 'pending',
            charges_enabled: account.charges_enabled,
            transfers_enabled: account.transfers_enabled,
          })
          .eq('stripe_account_id', account.id);
        break;
      }

      case 'charge.succeeded': {
        const charge = event.data.object as Stripe.Charge;
        if (charge.metadata?.paymentId) {
          await supabase
            .from('payments')
            .update({ status: 'completed', stripe_charge_id: charge.id })
            .eq('id', charge.metadata.paymentId);
        }
        break;
      }

      case 'charge.failed': {
        const charge = event.data.object as Stripe.Charge;
        if (charge.metadata?.paymentId) {
          await supabase
            .from('payments')
            .update({
              status: 'failed',
              failure_reason: charge.failure_message,
            })
            .eq('id', charge.metadata.paymentId);
        }
        break;
      }

      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer;
        if (transfer.metadata?.paymentId) {
          await supabase
            .from('payments')
            .update({
              status: 'processing',
              stripe_transfer_id: transfer.id,
            })
            .eq('id', transfer.metadata.paymentId);
        }
        break;
      }

      case 'transfer.paid': {
        const transfer = event.data.object as Stripe.Transfer;
        if (transfer.metadata?.paymentId) {
          await supabase
            .from('payments')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', transfer.metadata.paymentId);
        }
        break;
      }
    }
  }
}
```

### Step 2: Payment Processing Service

**File**: `src/services/payments/PaymentProcessor.ts`

```typescript
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export interface PaymentRequest {
  payAppId: string;
  paymentAmount: number;
  recipientContractorId: string;
  initiatorUserId: string;
  paymentMethod: 'ach' | 'wire' | 'card';
  idempotencyKey?: string;
}

export class PaymentProcessor {
  async initiatePayment(req: PaymentRequest): Promise<string> {
    const idempotencyKey = req.idempotencyKey || uuidv4();

    // Fetch contractor Stripe account
    const { data: stripeAccount, error: stripeError } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id, transfers_enabled')
      .eq('contractor_id', req.recipientContractorId)
      .single();

    if (stripeError || !stripeAccount?.transfers_enabled) {
      throw new Error('Contractor account not ready for payments');
    }

    // Create payment record in database
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        pay_app_id: req.payAppId,
        recipient_contractor_id: req.recipientContractorId,
        amount: req.paymentAmount,
        amount_cents: Math.round(req.paymentAmount * 100),
        payment_method: req.paymentMethod,
        initiator_user_id: req.initiatorUserId,
        status: 'pending',
        idempotency_key: idempotencyKey,
      })
      .select('id');

    if (paymentError || !payment) {
      throw new Error(`Failed to create payment record: ${paymentError?.message}`);
    }

    const paymentId = payment[0].id;

    try {
      // Create charge on platform account
      const charge = await stripe.charges.create(
        {
          amount: Math.round(req.paymentAmount * 100),
          currency: 'usd',
          source: 'tok_us', // Test token; real flow uses payment method from frontend
          description: `Payment for pay app ${req.payAppId}`,
          metadata: {
            paymentId,
            payAppId: req.payAppId,
          },
          // Application fee (2.2% + $0.30 platform fee)
          application_fee_amount: Math.round(req.paymentAmount * 100 * 0.022 + 30),
        },
        {
          stripeAccount: stripeAccount.stripe_account_id,
          idempotencyKey,
        }
      );

      // Create transfer to contractor
      const transfer = await stripe.transfers.create(
        {
          amount: Math.round(req.paymentAmount * 100),
          currency: 'usd',
          destination: stripeAccount.stripe_account_id,
          description: `Payment from pay app`,
          metadata: {
            paymentId,
            payAppId: req.payAppId,
          },
        },
        { idempotencyKey }
      );

      // Update payment status
      await supabase
        .from('payments')
        .update({
          stripe_charge_id: charge.id,
          stripe_transfer_id: transfer.id,
          status: 'processing',
        })
        .eq('id', paymentId);

      return paymentId;
    } catch (error) {
      // Mark payment as failed
      await supabase
        .from('payments')
        .update({
          status: 'failed',
          failure_reason: String(error),
        })
        .eq('id', paymentId);

      throw error;
    }
  }

  async getPaymentStatus(paymentId: string): Promise<any> {
    const { data, error } = await supabase
      .from('payments')
      .select(
        '*, pay_apps(pay_app_number), contractors(legal_name, email)'
      )
      .eq('id', paymentId)
      .single();

    if (error) {
      throw new Error('Payment not found');
    }

    return data;
  }

  async schedulePayment(
    paymentId: string,
    scheduledFor: Date
  ): Promise<void> {
    const { error } = await supabase
      .from('payments')
      .update({
        scheduled_for: scheduledFor.toISOString(),
        status: 'pending',
      })
      .eq('id', paymentId);

    if (error) {
      throw new Error(`Failed to schedule payment: ${error.message}`);
    }
  }

  async holdRetainage(
    paymentId: string,
    retainageAmount: number,
    releaseDate: Date
  ): Promise<void> {
    const { error } = await supabase
      .from('payment_retainage_holds')
      .insert({
        payment_id: paymentId,
        retainage_amount: retainageAmount,
        hold_release_date: releaseDate.toISOString().split('T')[0],
      });

    if (error) {
      throw new Error(`Failed to hold retainage: ${error.message}`);
    }
  }

  async releaseRetainage(holdId: string): Promise<void> {
    const { data: hold, error: fetchError } = await supabase
      .from('payment_retainage_holds')
      .select('payment_id, retainage_amount')
      .eq('id', holdId)
      .single();

    if (fetchError || !hold) {
      throw new Error('Hold not found');
    }

    // Create transfer for released retainage
    const { data: payment } = await supabase
      .from('payments')
      .select('recipient_contractor_id')
      .eq('id', hold.payment_id)
      .single();

    if (payment) {
      // TODO: Create Stripe transfer for retainage amount
    }

    // Mark as released
    await supabase
      .from('payment_retainage_holds')
      .update({
        released: true,
        released_at: new Date().toISOString(),
      })
      .eq('id', holdId);
  }
}
```

### Step 3: Payment Dashboard Component

**File**: `src/components/Financials/PaymentDashboard.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, MetricBox, Btn } from '@/components/Primitives';

interface PaymentDashboardProps {
  projectId: string;
}

export const PaymentDashboard: React.FC<PaymentDashboardProps> = ({ projectId }) => {
  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalPaid: 0,
    pendingPayments: 0,
    failedPayments: 0,
    averageProcessingTime: 0,
  });

  useEffect(() => {
    loadPayments();
  }, [projectId]);

  const loadPayments = async () => {
    const { data, error } = await supabase
      .from('payments')
      .select('*, pay_apps(pay_app_number), contractors(legal_name)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPayments(data);

      // Calculate summary
      const totalPaid = data
        .filter((p) => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount, 0);

      const pending = data.filter((p) => p.status === 'pending').length;
      const failed = data.filter((p) => p.status === 'failed').length;

      setSummary({
        totalPaid,
        pendingPayments: pending,
        failedPayments: failed,
        averageProcessingTime: 2, // days
      });
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '20px' }}>
        Payments
      </h1>

      {/* Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          marginBottom: '30px',
        }}
      >
        <MetricBox
          label="Total Paid"
          value={`$${summary.totalPaid.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
        />
        <MetricBox
          label="Pending"
          value={summary.pendingPayments}
          unit="payments"
          status={summary.pendingPayments > 0 ? 'warning' : 'ok'}
        />
        <MetricBox
          label="Failed"
          value={summary.failedPayments}
          unit="payments"
          status={summary.failedPayments > 0 ? 'error' : 'ok'}
        />
        <MetricBox
          label="Avg Processing"
          value={`${summary.averageProcessingTime}`}
          unit="days"
        />
      </div>

      {/* Payments Table */}
      <Card style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>
          Payment History
        </h2>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
            }}
          >
            <thead>
              <tr style={{ background: '#f7f8fa', borderBottom: '1px solid #ddd' }}>
                <th
                  style={{
                    padding: '8px',
                    textAlign: 'left',
                    fontWeight: 600,
                  }}
                >
                  Pay App
                </th>
                <th
                  style={{
                    padding: '8px',
                    textAlign: 'left',
                    fontWeight: 600,
                  }}
                >
                  Contractor
                </th>
                <th
                  style={{
                    padding: '8px',
                    textAlign: 'right',
                    fontWeight: 600,
                  }}
                >
                  Amount
                </th>
                <th
                  style={{
                    padding: '8px',
                    textAlign: 'center',
                    fontWeight: 600,
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    padding: '8px',
                    textAlign: 'left',
                    fontWeight: 600,
                  }}
                >
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr
                  key={payment.id}
                  style={{
                    borderBottom: '1px solid #eee',
                    cursor: 'pointer',
                  }}
                >
                  <td style={{ padding: '8px' }}>
                    G702 #{payment.pay_apps?.pay_app_number}
                  </td>
                  <td style={{ padding: '8px' }}>
                    {payment.contractors?.legal_name}
                  </td>
                  <td
                    style={{
                      padding: '8px',
                      textAlign: 'right',
                      fontWeight: 500,
                    }}
                  >
                    ${payment.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </td>
                  <td
                    style={{
                      padding: '8px',
                      textAlign: 'center',
                    }}
                  >
                    <StatusBadge status={payment.status} />
                  </td>
                  <td style={{ padding: '8px', fontSize: '11px', color: '#999' }}>
                    {new Date(payment.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const statusColors: Record<string, string> = {
    completed: '#4EC896',
    processing: '#3B82F6',
    pending: '#F59E0B',
    failed: '#EF4444',
  };

  return (
    <div
      style={{
        display: 'inline-block',
        padding: '4px 8px',
        borderRadius: '4px',
        background: statusColors[status] || '#999',
        color: '#fff',
        fontSize: '11px',
        fontWeight: 500,
        textTransform: 'capitalize',
      }}
    >
      {status}
    </div>
  );
};
```

---

## Acceptance Criteria

- [ ] Create Stripe Connect custom account for each contractor
- [ ] Onboarding flow redirects to Stripe Connect for kyc/banking details
- [ ] Payment creation deducts 2.2% + $0.30 platform fee
- [ ] Hold retainage based on contract terms (releases on date or conditions)
- [ ] Process ACH, wire, and card payments through Stripe
- [ ] Webhook listeners handle account updates, charge events, transfer events
- [ ] Payment dashboard shows total paid, pending, failed with status badges
- [ ] Idempotency key prevents duplicate charges if request retries
- [ ] Payment status updates in real-time from Stripe webhooks
- [ ] Remittance advice generated automatically and emailed to contractor

---

## Security & Compliance

- No raw banking details stored (Stripe handles encryption)
- PCI compliance delegated to Stripe
- Platform account holders all banking verification
- Webhook signatures verified using secret key
- Payment amounts match certified pay app amounts exactly

---

## Future Enhancements

1. Card payment support with 3% fee tier
2. Faster payouts (next-day ACH vs standard 2-3 days)
3. Payment scheduling UI with calendar
4. Bulk payment processing (pay multiple contractors at once)
5. Reconciliation with accounting software
