// SiteSync PM — Billing & Subscription Service
// Manages plan limits, usage tracking, and Stripe subscription lifecycle.

import { supabase } from '../lib/supabase'
import { fromTable } from '../lib/db/queries'
import type { Cents } from '../types/money'
import { multiplyCents, addCents } from '../types/money'

// ── Types ───────────────────────────────────────────────

export interface Plan {
  id: string
  name: string
  description: string
  priceMonthly: Cents  // integer cents
  priceAnnual: Cents  // integer cents
  maxProjects: number
  maxUsers: number
  maxStorageGb: number
  aiCopilot: boolean
  integrations: boolean
  customReports: boolean
  sso: boolean
  apiAccess: boolean
  aiPerPageRate: Cents  // integer cents per page
  paymentProcessingRate: number  // percentage rate, not money
}

export interface Subscription {
  id: string
  organizationId: string
  planId: string
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'paused'
  billingCycle: 'monthly' | 'annual'
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  trialEndsAt: string | null
  currentPeriodStart: string
  currentPeriodEnd: string
  canceledAt: string | null
}

export interface UsageSummary {
  eventType: string
  period: string
  totalQuantity: number
  totalAmount: number
}

export type UsageEventType =
  | 'ai_page_processed'
  | 'ai_chat_message'
  | 'ai_insight_generated'
  | 'document_ocr'
  | 'payment_processed'
  | 'report_generated'
  | 'storage_upload'

// ── Plan Queries ────────────────────────────────────────

export async function getPlans(): Promise<Plan[]> {
  const { data, error } = await fromTable('plans')
    .select('*')
    .eq('active' as never, true)
    .order('price_monthly')

  if (error) throw error

  type PlanRow = {
    id: string; name: string; description: string | null; price_monthly: number; price_annual: number;
    max_projects: number; max_users: number; max_storage_gb: number;
    ai_copilot: boolean; integrations: boolean; custom_reports: boolean; sso: boolean; api_access: boolean;
    ai_per_page_rate: number | null; payment_processing_rate: number | null; active: boolean;
  }
  return ((data ?? []) as unknown as PlanRow[]).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    priceMonthly: p.price_monthly as Cents,
    priceAnnual: p.price_annual as Cents,
    maxProjects: p.max_projects,
    maxUsers: p.max_users,
    maxStorageGb: p.max_storage_gb,
    aiCopilot: p.ai_copilot,
    integrations: p.integrations,
    customReports: p.custom_reports,
    sso: p.sso,
    apiAccess: p.api_access,
    aiPerPageRate: (p.ai_per_page_rate ?? 0) as Cents,
    paymentProcessingRate: p.payment_processing_rate ?? 0,
  }))
}

// ── Subscription Management ─────────────────────────────

export async function getSubscription(organizationId: string): Promise<Subscription | null> {
  const { data, error } = await fromTable('subscriptions')
    .select('*')
    .eq('organization_id' as never, organizationId)
    .single()

  if (error || !data) return null

  type SubRow = {
    id: string; organization_id: string; plan_id: string; status: Subscription['status'];
    billing_cycle: Subscription['billingCycle']; stripe_customer_id: string | null;
    stripe_subscription_id: string | null; trial_ends_at: string | null;
    current_period_start: string; current_period_end: string; canceled_at: string | null;
  }
  const row = data as unknown as SubRow
  return {
    id: row.id,
    organizationId: row.organization_id,
    planId: row.plan_id,
    status: row.status,
    billingCycle: row.billing_cycle,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    trialEndsAt: row.trial_ends_at,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    canceledAt: row.canceled_at,
  }
}

export async function createCheckoutSession(
  organizationId: string,
  planId: string,
  billingCycle: 'monthly' | 'annual',
): Promise<{ url: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/billing/checkout`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId, planId, billingCycle }),
    },
  )

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Checkout failed' }))
    throw new Error((err as Record<string, string>).error)
  }

  return response.json()
}

export async function createPortalSession(organizationId: string): Promise<{ url: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/billing/portal`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId }),
    },
  )

  if (!response.ok) throw new Error('Failed to create portal session')
  return response.json()
}

// ── Plan Limit Checks ───────────────────────────────────

export async function checkPlanLimit(
  organizationId: string,
  limitType: 'projects' | 'users' | 'storage_gb',
): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_plan_limit', {
    p_organization_id: organizationId,
    p_limit_type: limitType,
  })

  if (error) return true // Fail open to not block operations
  return data as unknown as boolean
}

export async function checkFeatureAccess(
  organizationId: string,
  feature: 'ai_copilot' | 'integrations' | 'custom_reports' | 'sso' | 'api_access',
): Promise<boolean> {
  const { data, error } = await fromTable('subscriptions')
    .select('plan:plan_id(*)')
    .eq('organization_id' as never, organizationId)
    .eq('status' as never, 'active')
    .single()

  if (error || !data) return false

  const plan = (data as unknown as { plan: Record<string, unknown> }).plan
  return !!plan[feature]
}

// ── Usage Tracking ──────────────────────────────────────

export async function trackUsage(
  organizationId: string,
  eventType: UsageEventType,
  quantity: number = 1,
  metadata?: Record<string, unknown>,
  projectId?: string,
): Promise<void> {
  // Get the unit price from the plan
  const { data: sub } = await fromTable('subscriptions')
    .select('plan:plan_id(ai_per_page_rate, payment_processing_rate)')
    .eq('organization_id' as never, organizationId)
    .eq('status' as never, 'active')
    .single()

  const plan = ((sub as unknown as { plan?: Record<string, number> } | null)?.plan as Record<string, number>) ?? {}
  let unitPrice = 0

  if (eventType === 'ai_page_processed' || eventType === 'document_ocr') {
    unitPrice = plan.ai_per_page_rate ?? 0.10
  }

  await fromTable('usage_events').insert({
    organization_id: organizationId,
    project_id: projectId,
    event_type: eventType,
    quantity,
    unit_price: unitPrice,
    metadata: metadata ?? {},
  } as never)
}

export async function getUsageSummary(
  organizationId: string,
  periodStart?: string,
): Promise<UsageSummary[]> {
  const start = periodStart ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const { data, error } = await fromTable('usage_events')
    .select('event_type, quantity, unit_price')
    .eq('organization_id' as never, organizationId)
    .gte('created_at' as never, start)

  if (error) throw error

  type UsageEventRow = { event_type: string; quantity: number; unit_price: number | null }

  // Aggregate by event type
  const summary = new Map<string, { quantity: number; amount: Cents }>()

  for (const event of (data ?? []) as unknown as UsageEventRow[]) {
    const existing = summary.get(event.event_type) ?? { quantity: 0, amount: 0 as Cents }
    existing.quantity += event.quantity
    existing.amount = addCents(existing.amount as Cents, multiplyCents((event.unit_price ?? 0) as Cents, event.quantity))
    summary.set(event.event_type, existing)
  }

  return Array.from(summary.entries()).map(([eventType, { quantity, amount }]) => ({
    eventType,
    period: start,
    totalQuantity: quantity,
    totalAmount: amount,
  }))
}
