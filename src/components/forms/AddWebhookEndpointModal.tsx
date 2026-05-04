import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { z } from 'zod'
import { FormModal, FormBody, FormField, FormInput, FormCheckbox } from './FormPrimitives'
import { Btn } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { toast } from 'sonner'
import { useProjectId } from '../../hooks/useProjectId'
import { supabase } from '../../lib/supabase'
import { Copy, Check, Loader2 } from 'lucide-react'

// ── Zod Schema ─────────────────────────────────────────────

const WebhookEndpointSchema = z.object({
  url: z.string()
    .min(1, 'URL is required')
    .url('Must be a valid URL')
    .refine((url) => url.startsWith('https://'), 'Only HTTPS URLs are supported'),
  events: z.array(z.string())
    .min(1, 'Select at least one event type'),
  secret: z.string()
    .min(16, 'Secret must be at least 16 characters')
    .max(128, 'Secret must be 128 characters or less'),
  retryOnFailure: z.boolean().default(true),
})

type WebhookFormData = z.infer<typeof WebhookEndpointSchema>

// ── Props ──────────────────────────────────────────────────

interface AddWebhookEndpointModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (webhook: { id: string; url: string; events: string[] }) => void
}

// ── Event Definitions ──────────────────────────────────────

const EVENT_CATEGORIES = [
  {
    category: 'RFIs',
    events: ['rfi.created', 'rfi.updated', 'rfi.responded'],
  },
  {
    category: 'Tasks',
    events: ['task.created', 'task.updated', 'task.completed'],
  },
  {
    category: 'Submittals',
    events: ['submittal.created', 'submittal.updated', 'submittal.approved'],
  },
  {
    category: 'Change Orders',
    events: ['change_order.created', 'change_order.approved'],
  },
  {
    category: 'Daily Logs',
    events: ['daily_log.created', 'daily_log.submitted'],
  },
  {
    category: 'Payments',
    events: ['payment.submitted', 'payment.approved', 'payment.completed'],
  },
  {
    category: 'Safety',
    events: ['incident.reported', 'inspection.completed'],
  },
] as const

// ── Helpers ────────────────────────────────────────────────

function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'whsec_'
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(bytes[i] % chars.length)
  }
  return result
}

// ── Draft Persistence ──────────────────────────────────────

const DB_NAME = 'sitesync_drafts'
const STORE_NAME = 'form_drafts'
const DRAFT_KEY = 'draft_webhook'

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveDraft(data: Omit<WebhookFormData, 'secret'>): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(data, DRAFT_KEY)
    db.close()
  } catch { /* IndexedDB unavailable */ }
}

async function loadDraft(): Promise<Omit<WebhookFormData, 'secret'> | null> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(DRAFT_KEY)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => resolve(null)
      db.close()
    })
  } catch {
    return null
  }
}

async function clearDraft(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(DRAFT_KEY)
    db.close()
  } catch { /* IndexedDB unavailable */ }
}

// ── Component ──────────────────────────────────────────────

export const AddWebhookEndpointModal: React.FC<AddWebhookEndpointModalProps> = ({ open, onClose, onSuccess }) => {
  const projectId = useProjectId()

  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>([])
  const [secret] = useState(() => generateSecret())
  const [retryOnFailure, setRetryOnFailure] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [secretCopied, setSecretCopied] = useState(false)

  // Load draft on open (secret is never saved to draft)
  useEffect(() => {
    if (!open) return
    loadDraft().then((draft) => {
      if (draft) {
        setUrl(draft.url)
        setEvents(draft.events)
        setRetryOnFailure(draft.retryOnFailure)
      }
    })
  }, [open])

  // Auto-save draft every 5 seconds
  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => {
      saveDraft({ url, events, retryOnFailure })
    }, 5000)
    return () => clearInterval(timer)
  }, [open, url, events, retryOnFailure])

  const allEvents = useMemo(
    () => EVENT_CATEGORIES.flatMap((c) => c.events),
    [],
  )

  const handleEventToggle = useCallback((eventId: string) => {
    setEvents((prev) =>
      prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
    )
    setErrors((prev) => {
      const next = { ...prev }
      delete next.events
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setEvents((prev) => prev.length === allEvents.length ? [] : [...allEvents])
  }, [allEvents])

  const handleCopySecret = useCallback(() => {
    navigator.clipboard.writeText(secret)
    setSecretCopied(true)
    setTimeout(() => setSecretCopied(false), 2000)
  }, [secret])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    const formData: WebhookFormData = { url, events, secret, retryOnFailure }
    const result = WebhookEndpointSchema.safeParse(formData)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((err) => {
        const field = String(err.path[0] ?? '')
        if (field && !fieldErrors[field]) fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setIsSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        toast.error('Your session has expired. Please sign in again.')
        setIsSubmitting(false)
        return
      }
      const response = await fetch('/functions/v1/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          url: result.data.url,
          events: result.data.events,
          secret: result.data.secret,
          retryOnFailure: result.data.retryOnFailure,
        }),
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        throw new Error((errBody as Record<string, string>).message || 'Failed to create webhook endpoint')
      }

      const webhook = await response.json()
      await clearDraft()
      toast.success('Webhook endpoint created')
      onSuccess(webhook as { id: string; url: string; events: string[] })
      onClose()
    } catch (err) {
      toast.error((err as Error).message || 'Failed to create webhook endpoint')
    } finally {
      setIsSubmitting(false)
    }
  }, [url, events, secret, retryOnFailure, projectId, onSuccess, onClose])

  return (
    <FormModal open={open} onClose={onClose} title="Add Webhook Endpoint" width={600}>
      <FormBody onSubmit={handleSubmit}>
          {/* URL */}
          <FormField label="Endpoint URL" required error={errors.url}>
            <FormInput
              id="webhook-url"
              type="url"
              placeholder="https://your-server.com/webhooks/sitesync"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isSubmitting}
            />
          </FormField>

          {/* Secret */}
          <FormField label="Webhook Secret">
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
              <div style={{
                flex: 1, padding: spacing['3'],
                backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base,
                fontFamily: 'monospace', fontSize: typography.fontSize.caption,
                color: colors.textPrimary, wordBreak: 'break-all', userSelect: 'all',
              }}>
                {secret}
              </div>
              <button
                type="button"
                onClick={handleCopySecret}
                aria-label={secretCopied ? 'Copied' : 'Copy secret'}
                title={secretCopied ? 'Copied' : 'Copy secret'}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 36, border: `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.base, backgroundColor: 'transparent',
                  cursor: 'pointer', color: secretCopied ? colors.statusActive : colors.textSecondary,
                  flexShrink: 0,
                }}
              >
                {secretCopied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              Store this secret safely. It is used to verify webhook signatures.
            </p>
          </FormField>

          {/* Events */}
          <FormField label="Event Types" required error={errors.events}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
              <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                Select which events trigger this webhook
              </p>
              <button
                type="button"
                onClick={handleSelectAll}
                style={{
                  border: 'none', backgroundColor: 'transparent',
                  color: colors.orangeText, fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.medium, cursor: 'pointer',
                  fontFamily: typography.fontFamily,
                }}
              >
                {events.length === allEvents.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
              {EVENT_CATEGORIES.map((cat) => (
                <div key={cat.category}>
                  <p style={{
                    margin: 0, marginBottom: spacing['2'],
                    fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                    color: colors.textPrimary,
                  }}>
                    {cat.category}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: spacing['2'] }}>
                    {cat.events.map((evt) => (
                      <div key={evt} style={{
                        padding: `${spacing['2']} ${spacing['3']}`,
                        border: `1px solid ${events.includes(evt) ? colors.primaryOrange : colors.borderDefault}`,
                        borderRadius: borderRadius.base,
                        backgroundColor: events.includes(evt) ? colors.orangeSubtle : 'transparent',
                      }}>
                        <FormCheckbox
                          id={`event-${evt}`}
                          label={evt}
                          checked={events.includes(evt)}
                          onChange={() => handleEventToggle(evt)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </FormField>

          {/* Retry toggle */}
          <div style={{ padding: `${spacing['3']} 0` }}>
            <FormCheckbox
              id="retry-on-failure"
              label="Automatically retry failed deliveries (up to 5 attempts with exponential backoff)"
              checked={retryOnFailure}
              onChange={setRetryOnFailure}
            />
          </div>

          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: spacing['3'],
            marginTop: spacing['2'], paddingTop: spacing['4'],
            borderTop: `1px solid ${colors.borderSubtle}`,
          }}>
            <Btn variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Btn>
            <Btn type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 size={14} style={{ animation: 'spin 600ms linear infinite', marginRight: spacing['2'] }} />
                  Creating...
                </>
              ) : (
                'Create Endpoint'
              )}
            </Btn>
          </div>
        </FormBody>
    </FormModal>
  )
}

export default AddWebhookEndpointModal
