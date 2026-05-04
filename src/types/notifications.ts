/**
 * Notification types — preferences, channels, digest.
 *
 * The existing `notifications` table is owned by another wave; this file
 * adds preferences and the in-flight event shape used by `shouldDeliver`
 * and `digest`. Mirrors `notification_preferences` from migration
 * `20260503120001_notification_preferences.sql`.
 */

export type NotificationChannel = 'in_app' | 'email' | 'push' | 'digest' | 'none'

export type NotificationSeverity = 'info' | 'normal' | 'critical'

export type NotificationEventType =
  | 'rfi.assigned'
  | 'rfi.due_soon'
  | 'rfi.overdue'
  | 'rfi.responded'
  | 'submittal.assigned'
  | 'submittal.overdue'
  | 'change_order.pending_approval'
  | 'punch_item.assigned'
  | 'punch_item.overdue'
  | 'pay_app.pending_review'
  | 'inspection.scheduled'
  | 'inspection.failed'
  | 'workflow.step_required'
  | 'iris.suggestion'
  | 'system.alert'

/** A notification event ready to be routed. */
export interface NotificationEvent {
  id: string
  user_id: string
  event_type: NotificationEventType
  severity: NotificationSeverity
  project_id?: string
  entity_type?: string
  entity_id?: string
  title: string
  body?: string
  /** Wall-clock instant the event was raised. */
  occurred_at: string
}

/** Per-event-type channel matrix entry. */
export interface ChannelMatrixEntry {
  in_app: boolean
  email: boolean
  push: boolean
  digest: boolean
}

/** User-facing preferences row. */
export interface UserNotificationPreferences {
  user_id: string
  /** Per-event-type channel toggles. Missing keys fall back to defaults. */
  channels: Partial<Record<NotificationEventType, ChannelMatrixEntry>>
  /** DND window: HH:MM 24-hour, both required if either is set. */
  dnd_start?: string
  dnd_end?: string
  /** IANA timezone, e.g. 'America/Chicago'. Required if DND set. */
  dnd_timezone?: string
  /** When set false, critical-tier still respects DND. Default: true. */
  bypass_dnd_for_critical: boolean
  /** Iris suggestion frequency. */
  suggestion_frequency: 'off' | 'occasional' | 'always'
  /** Digest schedule. */
  digest_schedule?: {
    cadence: 'daily' | 'weekly'
    /** HH:MM 24-hour in dnd_timezone (or UTC if unset). */
    time: string
    /** 0=Sunday … 6=Saturday. Required if cadence=weekly. */
    weekday?: number
  }
}

// ── shouldDeliver result ──────────────────────────────────────────────

export interface DeliveryDecision {
  deliver: boolean
  channel: NotificationChannel
  reason: string
}

// ── Digest aggregation ────────────────────────────────────────────────

export interface DigestGroup {
  entity_type: string
  events: NotificationEvent[]
  count: number
}

export interface Digest {
  user_id: string
  generated_at: string
  groups: DigestGroup[]
  total_events: number
  /** Critical events that bypassed digest and were delivered immediately. */
  critical_count: number
}
