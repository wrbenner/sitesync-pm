// Stripe Connect Payment Processing for Construction Payments
// GC pays subcontractor through SiteSync with 0.5-1.5% processing fee.
// Supports: card payments, ACH bank transfers, retainage hold/release.

import { supabase } from '../../lib/supabase'

// ── Types ───────────────────────────────────────────────

export type PaymentMethod = 'card' | 'ach_debit' | 'ach_credit' | 'wire'
export type PaymentIntentStatus = 'created' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'requires_action'

export interface CreatePaymentParams {
  applicationId: string
  projectId: string
  amount: number // cents
  currency?: string
  paymentMethod: PaymentMethod
  recipientAccountId: string // Stripe Connect account ID
  description: string
  metadata?: Record<string, string>
}

export interface PaymentResult {
  success: boolean
  paymentIntentId?: string
  clientSecret?: string
  status?: PaymentIntentStatus
  error?: string
}

export interface ConnectedAccount {
  id: string
  companyName: string
  email: string
  chargesEnabled: boolean
  payoutsEnabled: boolean
  onboardingComplete: boolean
}

// ── Processing Fees ─────────────────────────────────────

const PLATFORM_FEE_RATES: Record<PaymentMethod, number> = {
  card: 0.015,       // 1.5% for card payments
  ach_debit: 0.005,  // 0.5% for ACH (capped at $5)
  ach_credit: 0.005, // 0.5% for ACH credit
  wire: 0,           // No platform fee on wire (handled externally)
}

const ACH_FEE_CAP = 500 // $5 max fee for ACH in cents

export function calculatePlatformFee(amount: number, method: PaymentMethod): number {
  const rate = PLATFORM_FEE_RATES[method]
  const fee = Math.round(amount * rate)

  if (method === 'ach_debit' || method === 'ach_credit') {
    return Math.min(fee, ACH_FEE_CAP)
  }

  return fee
}

// ── Edge Function Calls ─────────────────────────────────
// All Stripe API calls go through edge functions to keep keys server-side.

async function callPaymentEdge(action: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-connect/${action}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Payment service error' }))
    throw new Error((err as Record<string, string>).error || 'Payment failed')
  }

  return response.json()
}

// ── Connected Accounts (Subcontractor Onboarding) ───────

export async function createConnectedAccount(
  companyName: string,
  email: string,
  projectId: string,
): Promise<{ accountId: string; onboardingUrl: string }> {
  const result = await callPaymentEdge('create-account', {
    companyName,
    email,
    projectId,
  })
  return {
    accountId: result.accountId as string,
    onboardingUrl: result.onboardingUrl as string,
  }
}

export async function getAccountOnboardingLink(accountId: string): Promise<string> {
  const result = await callPaymentEdge('onboarding-link', { accountId })
  return result.url as string
}

export async function getAccountStatus(accountId: string): Promise<ConnectedAccount> {
  const result = await callPaymentEdge('account-status', { accountId })
  return result as unknown as ConnectedAccount
}

// ── Payment Processing ──────────────────────────────────

export async function createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
  const fee = calculatePlatformFee(params.amount, params.paymentMethod)

  const result = await callPaymentEdge('create-payment', {
    applicationId: params.applicationId,
    projectId: params.projectId,
    amount: params.amount,
    currency: params.currency ?? 'usd',
    paymentMethod: params.paymentMethod,
    recipientAccountId: params.recipientAccountId,
    platformFee: fee,
    description: params.description,
    metadata: {
      ...params.metadata,
      application_id: params.applicationId,
      project_id: params.projectId,
    },
  })

  return {
    success: result.status === 'succeeded' || result.status === 'processing',
    paymentIntentId: result.paymentIntentId as string,
    clientSecret: result.clientSecret as string,
    status: result.status as PaymentIntentStatus,
  }
}

export async function confirmPayment(paymentIntentId: string): Promise<PaymentResult> {
  const result = await callPaymentEdge('confirm-payment', { paymentIntentId })
  return {
    success: result.status === 'succeeded',
    paymentIntentId: result.paymentIntentId as string,
    status: result.status as PaymentIntentStatus,
  }
}

// ── Retainage Hold/Release ──────────────────────────────

export async function holdRetainage(params: {
  projectId: string
  contractId: string
  amount: number
  recipientAccountId: string
  description: string
}): Promise<PaymentResult> {
  const result = await callPaymentEdge('hold-retainage', params)
  return {
    success: !result.error,
    paymentIntentId: result.holdId as string,
    status: 'created',
  }
}

export async function releaseRetainage(params: {
  holdId: string
  projectId: string
  amount: number
  recipientAccountId: string
}): Promise<PaymentResult> {
  const result = await callPaymentEdge('release-retainage', params)
  return {
    success: result.status === 'succeeded' || result.status === 'processing',
    paymentIntentId: result.paymentIntentId as string,
    status: result.status as PaymentIntentStatus,
  }
}

// ── Payment History ─────────────────────────────────────

export async function getPaymentHistory(projectId: string): Promise<Array<{
  id: string
  amount: number
  fee: number
  method: PaymentMethod
  status: PaymentIntentStatus
  recipientName: string
  applicationNumber: number
  createdAt: string
}>> {
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((t) => ({
    id: t.id,
    amount: t.amount,
    fee: t.platform_fee ?? 0,
    method: t.payment_method as PaymentMethod,
    status: t.status as PaymentIntentStatus,
    recipientName: t.recipient_name ?? '',
    applicationNumber: t.application_number ?? 0,
    createdAt: t.created_at,
  }))
}
