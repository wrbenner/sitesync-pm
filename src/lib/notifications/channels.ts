/**
 * Channel registry — pure metadata mapping a NotificationChannel to its
 * runtime adapter shape. The actual transport (resend, expo-push, in-app
 * row insert) is in the edge functions; this file is just a registry so
 * the UI and tests can introspect channels without importing supabase.
 */

import type { NotificationChannel } from '../../types/notifications'

export interface ChannelMeta {
  channel: NotificationChannel
  label: string
  description: string
  /** Estimated delivery latency band, used in UI copy. */
  latency: 'instant' | 'minutes' | 'batched'
}

export const CHANNEL_META: Record<NotificationChannel, ChannelMeta> = {
  in_app: {
    channel: 'in_app',
    label: 'In app',
    description: 'Shown in the inbox icon and on entity pages.',
    latency: 'instant',
  },
  email: {
    channel: 'email',
    label: 'Email',
    description: 'Delivered to your registered email address.',
    latency: 'minutes',
  },
  push: {
    channel: 'push',
    label: 'Push',
    description: 'Delivered as a mobile push notification.',
    latency: 'instant',
  },
  digest: {
    channel: 'digest',
    label: 'Digest',
    description: 'Bundled into your scheduled digest email.',
    latency: 'batched',
  },
  none: {
    channel: 'none',
    label: 'None',
    description: 'Suppressed; not delivered to any channel.',
    latency: 'batched',
  },
}
