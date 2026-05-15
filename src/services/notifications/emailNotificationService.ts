import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'

export type NotificationTrigger =
  | 'rfi_assigned'
  | 'rfi_response'
  | 'rfi_overdue'
  | 'submittal_approved'
  | 'submittal_revision'
  | 'change_order_pending'
  | 'daily_log_reminder'
  | 'pay_app_review'
  | 'punch_item_assigned'
  | 'meeting_scheduled'

export interface EmailNotification {
  id: string
  projectId: string
  recipientUserId: string
  recipientEmail: string
  trigger: NotificationTrigger
  templateData: Record<string, string>
  status: 'pending' | 'sent' | 'failed' | 'skipped'
  sentAt: string | null
  error: string | null
  createdAt: string
}

export type NotificationPreferences = {
  [K in NotificationTrigger]: 'instant' | 'digest' | 'off'
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  rfi_assigned: 'instant',
  rfi_response: 'instant',
  rfi_overdue: 'instant',
  submittal_approved: 'instant',
  submittal_revision: 'instant',
  change_order_pending: 'instant',
  daily_log_reminder: 'instant',
  pay_app_review: 'instant',
  punch_item_assigned: 'instant',
  meeting_scheduled: 'instant',
}

const TEMPLATE_SUBJECTS: Record<NotificationTrigger, (data: Record<string, string>) => string> = {
  rfi_assigned: (d) => `New RFI assigned: ${d.rfiNumber} ${d.rfiTitle}`,
  rfi_response: (d) => `RFI response received: ${d.rfiNumber} ${d.rfiTitle}`,
  rfi_overdue: (d) => `OVERDUE: RFI ${d.rfiNumber} is ${d.daysOverdue} days past due`,
  submittal_approved: (d) => `Submittal approved: ${d.submittalTitle}`,
  submittal_revision: (d) => `Submittal revision required: ${d.submittalTitle}`,
  change_order_pending: (d) => `Change order pending review: ${d.changeOrderTitle}`,
  daily_log_reminder: (d) => `Reminder: Submit daily log for ${d.projectName}`,
  pay_app_review: (d) => `Pay application ready for review: ${d.payAppTitle}`,
  punch_item_assigned: (d) => `Punch item assigned to you: ${d.punchItemTitle}`,
  meeting_scheduled: (d) => `Meeting scheduled: ${d.meetingTitle} on ${d.meetingDate}`,
}

export async function queueNotification(
  projectId: string,
  trigger: NotificationTrigger,
  recipientUserId: string,
  templateData: Record<string, string>,
): Promise<void> {
  const { error } = await fromTable('notification_queue').insert({
    project_id: projectId,
    trigger,
    recipient_user_id: recipientUserId,
    template_data: templateData,
    status: 'pending',
    sent_at: null,
    error: null,
  } as never)

  if (error) throw error
}

export async function getUserNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const { data, error } = await fromTable('notification_preferences')
    .select('*')
    .eq('user_id' as never, userId)
    .single()

  if (error || !data) {
    return { ...DEFAULT_PREFERENCES }
  }

  const prefs: NotificationPreferences = { ...DEFAULT_PREFERENCES }
  const triggers = Object.keys(DEFAULT_PREFERENCES) as unknown as NotificationTrigger[]
  for (const trigger of triggers) {
    const val = (data as unknown as Record<string, unknown>)[trigger]
    if (val === 'instant' || val === 'digest' || val === 'off') {
      prefs[trigger] = val
    }
  }

  return prefs
}

async function sendEmail(notification: EmailNotification): Promise<void> {
  const subject = TEMPLATE_SUBJECTS[notification.trigger](notification.templateData)

  const { error: invokeError } = await supabase.functions.invoke('send-notification-email', {
    body: {
      notificationId: notification.id,
      recipientEmail: notification.recipientEmail,
      subject,
      trigger: notification.trigger,
      templateData: notification.templateData,
    },
  })

  if (invokeError) {
    await fromTable('notification_queue')
      .update({ status: 'failed', error: invokeError.message } as never)
      .eq('id' as never, notification.id)
    throw invokeError
  }

  await fromTable('notification_queue')
    .update({ status: 'sent', sent_at: new Date().toISOString(), error: null } as never)
    .eq('id' as never, notification.id)
}

/**
 * FMEA D.NOTIF.5 (wave 3) — recipient deletion guard.
 *
 * Returns true when the recipient profile is missing or soft-deleted
 * so the caller can skip the queue row instead of attempting an email
 * send that will bounce or crash the worker. Failing open (returning
 * false) on lookup errors preserves the prior send behavior so a
 * transient profiles-table error never blocks the whole queue.
 */
async function isRecipientDeleted(recipientUserId: string): Promise<boolean> {
  try {
    const { data, error } = await fromTable('profiles')
      .select('user_id, deleted_at')
      .eq('user_id' as never, recipientUserId)
      .maybeSingle()
    if (error) {
      // Lookup failed (network / transient) — fail open so the worker
      // doesn't stall. The send path will still surface a per-row
      // failure if the recipient is truly gone.
      return false
    }
    if (!data) {
      // No profile row found — treat as deleted so we skip cleanly.
      return true
    }
    const deletedAt = (data as { deleted_at?: string | null }).deleted_at ?? null
    return deletedAt !== null
  } catch {
    return false
  }
}

export async function processNotificationQueue(): Promise<void> {
  const { data: pending, error } = await fromTable('notification_queue')
    .select('*')
    .eq('status' as never, 'pending')

  if (error) throw error
  if (!pending || pending.length === 0) return

  type QueueRow = { id: string; project_id: string; recipient_user_id: string; recipient_email: string; trigger: string; template_data: unknown; status: string; sent_at: string | null; error: string | null; created_at: string | null }
  for (const row of (pending as unknown as QueueRow[])) {
    const notification: EmailNotification = {
      id: row.id,
      projectId: row.project_id,
      recipientUserId: row.recipient_user_id,
      recipientEmail: row.recipient_email,
      trigger: row.trigger as NotificationTrigger,
      templateData: row.template_data as Record<string, string>,
      status: row.status as EmailNotification['status'],
      sentAt: row.sent_at,
      error: row.error,
      createdAt: row.created_at ?? new Date().toISOString(),
    }

    // FMEA D.NOTIF.5 fix (wave 3): if the recipient's profile is
    // soft-deleted or missing, mark the queue row 'skipped' instead
    // of sending. Never throws — a deleted recipient must not crash
    // the worker loop nor reroute to a stale email.
    if (await isRecipientDeleted(notification.recipientUserId)) {
      await fromTable('notification_queue')
        .update({ status: 'skipped', error: 'recipient_deleted' } as never)
        .eq('id' as never, notification.id)
      continue
    }

    const prefs = await getUserNotificationPreferences(notification.recipientUserId)

    if (prefs[notification.trigger] === 'off') {
      await fromTable('notification_queue')
        .update({ status: 'skipped' } as never)
        .eq('id' as never, notification.id)
      continue
    }

    if (prefs[notification.trigger] === 'instant') {
      await sendEmail(notification)
    }
  }
}
