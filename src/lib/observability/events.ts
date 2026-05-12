// Typed event registry for product analytics (BRT subsystem 7 §4.3).
// Adding a new event = update this union AND the runtime label below.
// Event names are snake_case past-tense; props are flat scalars only
// (PostHog cohort builder dislikes nested objects).

export type AppEvent =
  // Auth / signup funnel
  | { name: 'signup_started'; props: { source?: string } }
  | { name: 'signup_email_submitted'; props: Record<string, never> }
  | { name: 'signup_email_verified'; props: Record<string, never> }
  | { name: 'signup_oauth_started'; props: { provider: 'google' | 'microsoft' | 'apple' } }
  | { name: 'signup_oauth_callback'; props: { provider: string; success: boolean } }
  | { name: 'signup_org_provisioned'; props: { org_id: string } }
  | { name: 'signup_completed'; props: { org_id: string; total_seconds: number } }

  // Onboarding funnel
  | { name: 'onboarding_step_viewed'; props: { step: number; role: string } }
  | { name: 'onboarding_step_completed'; props: { step: number; role: string; duration_ms: number } }
  | { name: 'onboarding_step_skipped'; props: { step: number } }
  | { name: 'onboarding_completed'; props: { total_duration_ms: number; role: string; sample_data_seeded: boolean } }
  | { name: 'onboarding_iris_demo_run'; props: Record<string, never> }

  // Activation
  | { name: 'first_rfi_created'; props: { org_id: string; project_id: string } }
  | { name: 'first_iris_draft_generated'; props: { org_id: string; entity_type: string } }
  | { name: 'first_iris_draft_approved'; props: { org_id: string; entity_type: string } }

  // Billing
  | { name: 'trial_started'; props: { org_id: string; price_id: string } }
  | { name: 'trial_will_end'; props: { org_id: string; days_remaining: number } }
  | { name: 'subscription_created'; props: { org_id: string; cycle: 'monthly' | 'annual' } }
  | { name: 'subscription_canceled'; props: { org_id: string; reason: string } }
  | { name: 'invoice_payment_succeeded'; props: { org_id: string; amount_cents: number } }
  | { name: 'invoice_payment_failed'; props: { org_id: string; reason: string } }

  // Marketing site
  | { name: 'marketing_cta_click'; props: { cta_id: string; page: string } }
  | { name: 'marketing_page_view'; props: { page: string } }

  // Help
  | { name: 'help_article_viewed'; props: { article_id: string } };

export type AppEventName = AppEvent['name'];

export type EventPropsFor<N extends AppEventName> = Extract<AppEvent, { name: N }>['props'];

// Runtime label for telemetry-volume budgeting (PostHog free tier = 1M/mo).
// `high` = sampled at 25% if total volume exceeds budget; `low` = always sent.
export const EVENT_VOLUME: Record<AppEventName, 'high' | 'low'> = {
  signup_started: 'low',
  signup_email_submitted: 'low',
  signup_email_verified: 'low',
  signup_oauth_started: 'low',
  signup_oauth_callback: 'low',
  signup_org_provisioned: 'low',
  signup_completed: 'low',
  onboarding_step_viewed: 'low',
  onboarding_step_completed: 'low',
  onboarding_step_skipped: 'low',
  onboarding_completed: 'low',
  onboarding_iris_demo_run: 'low',
  first_rfi_created: 'low',
  first_iris_draft_generated: 'low',
  first_iris_draft_approved: 'low',
  trial_started: 'low',
  trial_will_end: 'low',
  subscription_created: 'low',
  subscription_canceled: 'low',
  invoice_payment_succeeded: 'low',
  invoice_payment_failed: 'low',
  marketing_cta_click: 'high',
  marketing_page_view: 'high',
  help_article_viewed: 'low',
};
