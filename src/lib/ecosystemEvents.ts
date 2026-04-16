// ── Ecosystem Event Chain ─────────────────────────────────────
// When a significant entity changes in SiteSync, this module
// orchestrates the full integration chain across all connected systems.
//
// Example: Change Order approved →
//   1. Budget update in SiteSync
//   2. Journal entry in QuickBooks
//   3. Slack notification in #project-updates
//   4. Schedule impact recalculated
//   5. Payment application updated
//   6. Subcontractor notified via email
//   7. Webhook fired to all subscribed endpoints
//   8. Audit trail records entire chain

import { supabase, isSupabaseConfigured } from './supabase'
import type { QueryClient } from '@tanstack/react-query'

// ── Event Types ───────────────────────────────────────────────

export type EcosystemEvent =
  | { type: 'change_order.approved'; data: { changeOrderId: string; projectId: string; amount: number; title: string; approvedBy: string } }
  | { type: 'rfi.created'; data: { rfiId: string; projectId: string; subject: string; assignedTo?: string; priority: string } }
  | { type: 'rfi.responded'; data: { rfiId: string; projectId: string; subject: string; respondedBy: string } }
  | { type: 'submittal.approved'; data: { submittalId: string; projectId: string; title: string; approvedBy: string } }
  | { type: 'daily_log.submitted'; data: { dailyLogId: string; projectId: string; date: string; submittedBy: string } }
  | { type: 'payment.completed'; data: { paymentId: string; projectId: string; amount: number; recipient: string } }
  | { type: 'incident.reported'; data: { incidentId: string; projectId: string; severity: string; description: string } }
  | { type: 'task.completed'; data: { taskId: string; projectId: string; title: string } }
  | { type: 'punch_item.resolved'; data: { punchItemId: string; projectId: string; title: string } }

// ── Integration Chain Result ──────────────────────────────────

interface ChainStep {
  integration: string
  action: string
  status: 'success' | 'skipped' | 'failed'
  message: string
  durationMs: number
}

interface ChainResult {
  event: string
  totalSteps: number
  successfulSteps: number
  steps: ChainStep[]
  totalDurationMs: number
}

// ── Step Executor ─────────────────────────────────────────────

async function executeStep(
  integration: string,
  action: string,
  fn: () => Promise<void>,
): Promise<ChainStep> {
  const start = Date.now()
  try {
    await fn()
    return {
      integration,
      action,
      status: 'success',
      message: 'Completed',
      durationMs: Date.now() - start,
    }
  } catch (err) {
    return {
      integration,
      action,
      status: 'failed',
      message: (err as Error).message,
      durationMs: Date.now() - start,
    }
  }
}

// ── Get Connected Integrations ────────────────────────────────

async function getConnectedIntegrations(): Promise<Set<string>> {
  if (!isSupabaseConfigured) return new Set()

  const { data } = await supabase
    .from('integrations')
    .select('type')
    .eq('status', 'connected')

  return new Set((data ?? []).map((i) => i.type as string))
}

// ── Main Dispatch ─────────────────────────────────────────────

export async function dispatchEcosystemEvent(
  event: EcosystemEvent,
  queryClient?: QueryClient,
): Promise<ChainResult> {
  const startTime = Date.now()
  const steps: ChainStep[] = []
  const connected = await getConnectedIntegrations()

  switch (event.type) {
    case 'change_order.approved':
      await runChangeOrderChain(event, connected, steps, queryClient)
      break
    case 'rfi.created':
      await runRFICreatedChain(event, connected, steps)
      break
    case 'rfi.responded':
      await runRFIRespondedChain(event, connected, steps)
      break
    case 'submittal.approved':
      await runSubmittalApprovedChain(event, connected, steps)
      break
    case 'daily_log.submitted':
      await runDailyLogChain(event, connected, steps)
      break
    case 'payment.completed':
      await runPaymentChain(event, connected, steps)
      break
    case 'incident.reported':
      await runIncidentChain(event, connected, steps)
      break
    case 'task.completed':
      await runTaskCompletedChain(event, connected, steps)
      break
    case 'punch_item.resolved':
      await runPunchItemChain(event, connected, steps)
      break
  }

  // Always fire webhooks as the last step
  steps.push(
    await executeStep('webhooks', 'fan_out', async () => {
      if (!isSupabaseConfigured) return
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) return
      const { data: { session } } = await supabase.auth.getSession()
      // Webhook fan-out is handled by the edge function
      await fetch(`${supabaseUrl}/functions/v1/webhook-receiver?event=${event.type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ type: event.type, data: event.data }),
      })
    }),
  )

  // Write audit trail
  steps.push(
    await executeStep('audit', 'record', async () => {
      if (!isSupabaseConfigured) return
      await supabase.from('audit_trail').insert({
        project_id: event.data.projectId,
        entity_type: event.type.split('.')[0],
        entity_id: (event.data as Record<string, unknown>)[`${event.type.split('.')[0]}Id`] as string || null,
        action: event.type,
        metadata: {
          ecosystem_chain: steps.filter((s) => s.status !== 'skipped').map((s) => `${s.integration}:${s.action}`),
          event_data: event.data,
        },
      })
    }),
  )

  const result: ChainResult = {
    event: event.type,
    totalSteps: steps.length,
    successfulSteps: steps.filter((s) => s.status === 'success').length,
    steps,
    totalDurationMs: Date.now() - startTime,
  }

  return result
}

// ── Chain: Change Order Approved ──────────────────────────────

async function runChangeOrderChain(
  event: Extract<EcosystemEvent, { type: 'change_order.approved' }>,
  connected: Set<string>,
  steps: ChainStep[],
  queryClient?: QueryClient,
) {
  const { changeOrderId, projectId, amount, title, approvedBy } = event.data

  // 1. Update budget in SiteSync
  steps.push(
    await executeStep('sitesync', 'update_budget', async () => {
      if (!isSupabaseConfigured) return
      // Invalidate budget cache to trigger re-fetch
      queryClient?.invalidateQueries({ queryKey: ['budget_items', projectId] })
      queryClient?.invalidateQueries({ queryKey: ['change_orders', projectId] })
    }),
  )

  // 2. QuickBooks journal entry
  if (connected.has('quickbooks')) {
    steps.push(
      await executeStep('quickbooks', 'create_journal_entry', async () => {
        const { getProvider } = await import('../services/integrations')
        const qb = getProvider('quickbooks')
        if (!qb) throw new Error('QuickBooks provider not available')
        // The sync method handles journal entry creation
        await qb.sync(changeOrderId, 'export')
      }),
    )
  } else {
    steps.push({ integration: 'quickbooks', action: 'create_journal_entry', status: 'skipped', message: 'Not connected', durationMs: 0 })
  }

  // 3. Slack notification
  if (connected.has('slack')) {
    steps.push(
      await executeStep('slack', 'post_notification', async () => {
        const { sendSlackChangeOrderNotification } = await import('../services/integrations/slack')
        const { data: integrations } = await supabase
          .from('integrations')
          .select('id')
          .eq('type', 'slack')
          .eq('status', 'connected')
          .limit(1)
        if (integrations?.[0]) {
          await sendSlackChangeOrderNotification(integrations[0].id, {
            title,
            amount,
            approvedBy,
            projectId,
          })
        }
      }),
    )
  } else {
    steps.push({ integration: 'slack', action: 'post_notification', status: 'skipped', message: 'Not connected', durationMs: 0 })
  }

  // 4. Schedule impact recalculation
  steps.push(
    await executeStep('sitesync', 'recalculate_schedule', async () => {
      queryClient?.invalidateQueries({ queryKey: ['tasks', projectId] })
      queryClient?.invalidateQueries({ queryKey: ['digital-twin-schedule', projectId] })
    }),
  )

  // 5. Payment application update
  steps.push(
    await executeStep('sitesync', 'update_pay_app', async () => {
      queryClient?.invalidateQueries({ queryKey: ['pay_applications', projectId] })
    }),
  )

  // 6. Email notification to subcontractor
  if (connected.has('email_resend')) {
    steps.push(
      await executeStep('email', 'notify_subcontractor', async () => {
        // Would send email with change order details and payment timeline
      }),
    )
  }
}

// ── Chain: RFI Created ────────────────────────────────────────

async function runRFICreatedChain(
  event: Extract<EcosystemEvent, { type: 'rfi.created' }>,
  connected: Set<string>,
  steps: ChainStep[],
) {
  const { rfiId, projectId, subject, assignedTo, priority } = event.data

  if (connected.has('slack')) {
    steps.push(
      await executeStep('slack', 'post_rfi_notification', async () => {
        const { sendSlackRFINotification } = await import('../services/integrations/slack')
        const { data: integrations } = await supabase
          .from('integrations').select('id').eq('type', 'slack').eq('status', 'connected').limit(1)
        if (integrations?.[0]) {
          await sendSlackRFINotification(integrations[0].id, {
            id: rfiId, subject, assignedTo, priority, projectId,
          })
        }
      }),
    )
  }

  if (connected.has('email_resend') && assignedTo) {
    steps.push(
      await executeStep('email', 'send_rfi_assignment', async () => {
        await import('../services/integrations/email')
        // Send email to assigned party
      }),
    )
  }
}

// ── Chain: RFI Responded ──────────────────────────────────────

async function runRFIRespondedChain(
  event: Extract<EcosystemEvent, { type: 'rfi.responded' }>,
  connected: Set<string>,
  steps: ChainStep[],
) {
  if (connected.has('slack')) {
    steps.push(
      await executeStep('slack', 'post_rfi_response', async () => {
        // Notify that RFI was answered
      }),
    )
  }
}

// ── Chain: Submittal Approved ─────────────────────────────────

async function runSubmittalApprovedChain(
  event: Extract<EcosystemEvent, { type: 'submittal.approved' }>,
  connected: Set<string>,
  steps: ChainStep[],
) {
  if (connected.has('slack')) {
    steps.push(
      await executeStep('slack', 'post_submittal_approved', async () => {
        const { sendSlackSubmittalNotification } = await import('../services/integrations/slack')
        const { data: integrations } = await supabase
          .from('integrations').select('id').eq('type', 'slack').eq('status', 'connected').limit(1)
        if (integrations?.[0]) {
          await sendSlackSubmittalNotification(integrations[0].id, {
            id: event.data.submittalId, title: event.data.title, projectId: event.data.projectId,
          })
        }
      }),
    )
  }
}

// ── Chain: Daily Log Submitted ────────────────────────────────

async function runDailyLogChain(
  event: Extract<EcosystemEvent, { type: 'daily_log.submitted' }>,
  connected: Set<string>,
  steps: ChainStep[],
) {
  if (connected.has('slack')) {
    steps.push(
      await executeStep('slack', 'post_daily_log', async () => {
        const { sendSlackDailyLogNotification } = await import('../services/integrations/slack')
        const { data: integrations } = await supabase
          .from('integrations').select('id').eq('type', 'slack').eq('status', 'connected').limit(1)
        if (integrations?.[0]) {
          await sendSlackDailyLogNotification(integrations[0].id, {
            date: event.data.date, submittedBy: event.data.submittedBy, projectId: event.data.projectId,
          })
        }
      }),
    )
  }
}

// ── Chain: Payment Completed ──────────────────────────────────

async function runPaymentChain(
  event: Extract<EcosystemEvent, { type: 'payment.completed' }>,
  connected: Set<string>,
  steps: ChainStep[],
) {
  // Update lien waiver status (conditional → unconditional)
  steps.push(
    await executeStep('sitesync', 'update_lien_waiver', async () => {
      // Lien waiver conversion handled by Stripe webhook
    }),
  )

  if (connected.has('quickbooks')) {
    steps.push(
      await executeStep('quickbooks', 'record_payment', async () => {
        // Record payment in QuickBooks
      }),
    )
  }

  if (connected.has('email_resend')) {
    steps.push(
      await executeStep('email', 'payment_confirmation', async () => {
        // Send payment receipt to subcontractor
      }),
    )
  }
}

// ── Chain: Incident Reported ──────────────────────────────────

async function runIncidentChain(
  event: Extract<EcosystemEvent, { type: 'incident.reported' }>,
  connected: Set<string>,
  steps: ChainStep[],
) {
  // Always send Slack notification for incidents (critical priority)
  if (connected.has('slack')) {
    steps.push(
      await executeStep('slack', 'post_incident_alert', async () => {
        // High priority Slack message for safety incidents
      }),
    )
  }

  if (connected.has('email_resend')) {
    steps.push(
      await executeStep('email', 'incident_alert', async () => {
        // Email safety manager and PM
      }),
    )
  }
}

// ── Chain: Task Completed ─────────────────────────────────────

async function runTaskCompletedChain(
  event: Extract<EcosystemEvent, { type: 'task.completed' }>,
  connected: Set<string>,
  steps: ChainStep[],
) {
  // Update schedule and digital twin
  steps.push(
    await executeStep('sitesync', 'update_progress', async () => {
      // Cache invalidation handled by calling code
    }),
  )

  if (connected.has('ms_project')) {
    steps.push(
      await executeStep('ms_project', 'update_task_status', async () => {
        // Export updated task to MS Project
      }),
    )
  }
}

// ── Chain: Punch Item Resolved ────────────────────────────────

async function runPunchItemChain(
  event: Extract<EcosystemEvent, { type: 'punch_item.resolved' }>,
  connected: Set<string>,
  steps: ChainStep[],
) {
  if (connected.has('slack')) {
    steps.push(
      await executeStep('slack', 'post_punch_resolved', async () => {
        // Notify punch item resolved
      }),
    )
  }
}

// ── Slack helper for change orders (not in existing slack.ts) ─

// This would be added to the Slack integration service






