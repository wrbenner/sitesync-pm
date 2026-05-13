// src/components/billing/CancelModal.tsx — BRT sub-4 §4.7
//
// Pre-cancel modal. Captures a structured reason in `cancellation_reasons`
// before handing the user off to the Stripe Portal to confirm the actual
// cancel. The two-step approach lets us learn churn drivers without
// blocking the customer's ability to leave.

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useActiveOrg } from '../../hooks/useActiveOrg'
import { supabase } from '../../lib/supabase'

interface CancelModalProps {
  open: boolean
  onClose: () => void
  onConfirmed: () => void
}

const REASONS = [
  { id: 'too_expensive', label: 'Too expensive' },
  { id: 'missing_features', label: 'Missing features I need' },
  { id: 'switching_tool', label: 'Switching to another tool' },
  { id: 'project_ended', label: 'My project ended' },
  { id: 'bugs_or_quality', label: 'Bugs or quality issues' },
  { id: 'other', label: 'Other' },
] as const

type ReasonId = typeof REASONS[number]['id']

export function CancelModal({ open, onClose, onConfirmed }: CancelModalProps) {
  const { orgId } = useActiveOrg()
  const [reason, setReason] = useState<ReasonId | null>(null)
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Esc-to-close keyboard support (a11y).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const submit = async () => {
    setError(null)
    if (!reason) {
      setError('Please pick a reason so we can improve.')
      return
    }
    if (!orgId) {
      setError('No active organization.')
      return
    }
    setSubmitting(true)
    // `cancellation_reasons` was added by the Day 3 catch-up migration;
    // generated database types lag, so we use the raw supabase client +
    // cast. Future regen will let this go back through fromTable().
    const { error: insertErr } = await supabase
      .from('cancellation_reasons' as never)
      .insert({
        organization_id: orgId,
        reason,
        details: details.trim() || null,
      } as never)
    setSubmitting(false)
    if (insertErr) {
      setError(insertErr.message || 'Could not record reason.')
      return
    }
    onConfirmed()
    onClose()
  }

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      {/* Click-outside backdrop — keyboard parity via Esc handler above. */}
      <button
        type="button"
        aria-label="Close cancel-subscription dialog"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'default',
        }}
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-modal-title"
        style={{
          position: 'relative',
          background: 'white',
          borderRadius: 12,
          padding: 24,
          maxWidth: 480,
          width: '90%',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <h2 id="cancel-modal-title" style={{ margin: 0, fontSize: 22, color: '#1A1A1A' }}>Cancel subscription</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} color="#5C5C5C" />
          </button>
        </div>

        <p style={{ margin: 0, marginBottom: 16, color: '#5C5C5C', lineHeight: 1.5 }}>
          We're sorry to see you go. Before we hand you off to Stripe to confirm,
          can you tell us why you're leaving? This helps us improve.
        </p>

        <fieldset style={{ border: 'none', padding: 0, margin: 0, marginBottom: 16 }}>
          <legend style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', marginBottom: 8 }}>
            Reason
          </legend>
          {REASONS.map((r) => (
            <label
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 0',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="cancel-reason"
                value={r.id}
                checked={reason === r.id}
                onChange={() => setReason(r.id)}
              />
              <span style={{ color: '#1A1A1A' }}>{r.label}</span>
            </label>
          ))}
        </fieldset>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1A1A1A', marginBottom: 6 }}>
            Anything else? (optional)
          </span>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="What would have made you stay?"
            style={{
              width: '100%',
              padding: 10,
              border: '1px solid #D6D6D6',
              borderRadius: 6,
              fontFamily: 'inherit',
              fontSize: 14,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </label>

        {error && (
          <p role="alert" style={{ color: '#7F1D1D', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              color: '#5C5C5C',
              border: '1px solid #D6D6D6',
              borderRadius: 6,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Stay
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !reason}
            style={{
              padding: '10px 16px',
              background: !reason ? '#FEE2E2' : '#B91C1C',
              color: !reason ? '#B91C1C' : 'white',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              cursor: !reason || submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Submitting…' : 'Continue to Stripe'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CancelModal
