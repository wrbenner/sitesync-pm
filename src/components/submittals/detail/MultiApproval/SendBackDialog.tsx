// Phase 7c-1 — Send-back 3-step wizard.
//
// Picks a target prior step + a reason chip + a comment body, then calls
// submittal_send_back RPC which atomically:
//   - re-opens the target step + all intermediate steps
//   - flips ball-in-court back to the target's reviewer
//   - posts an auto-comment on the target step with the reason
//
// Keyboard: Esc cancels, ⌘+Enter on the comment step submits.

import React, { useCallback, useState } from 'react'
import { ArrowLeftCircle, Check, X, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import {
  submittalSendBackService,
  SEND_BACK_REASONS,
  type SendBackReasonCode,
} from '../../../../services/submittalSendBack'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
  brandOrange: '#F47820',
  active: '#2D8A6E',
  critical: '#C93B3B',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface PriorStep {
  id: string
  sequence: number
  reviewer_name: string | null
  reviewer_role: string | null
}

export interface SendBackDialogProps {
  open: boolean
  onClose: () => void
  /** Steps with sequence < current. Caller filters from the WorkflowChainTable rows. */
  priorSteps: PriorStep[]
  /** Fires after the RPC succeeds; the page refetches the chain + comments. */
  onSent?: () => void
}

type Step = 'target' | 'reason' | 'comment'

export const SendBackDialog: React.FC<SendBackDialogProps> = ({
  open,
  onClose,
  priorSteps,
  onSent,
}) => {
  const [step, setStep] = useState<Step>('target')
  const [targetId, setTargetId] = useState<string | null>(null)
  const [reasonCode, setReasonCode] = useState<SendBackReasonCode | null>(null)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reset = useCallback(() => {
    setStep('target')
    setTargetId(null)
    setReasonCode(null)
    setBody('')
    setSubmitting(false)
  }, [])

  const close = useCallback(() => {
    if (submitting) return
    onClose()
    reset()
  }, [submitting, onClose, reset])

  const submit = useCallback(async (): Promise<void> => {
    if (!targetId || !reasonCode) {
      toast.error('Pick a target step and a reason first.')
      return
    }
    if (!body.trim()) {
      toast.error('Comment body is required for send-back.')
      return
    }
    setSubmitting(true)
    try {
      const reasonLabel = SEND_BACK_REASONS.find((r) => r.code === reasonCode)?.label ?? reasonCode
      const r = await submittalSendBackService.sendBack({
        target_step_id: targetId,
        reason_code: reasonLabel,
        comment_body: body.trim(),
      })
      if (r.error) {
        toast.error('Could not send back: ' + r.error.message)
        return
      }
      const target = priorSteps.find((p) => p.id === targetId)
      toast.success(
        `Sent back to ${target?.reviewer_name ?? 'prior step'}. They've been notified.`,
        { duration: 5000 },
      )
      onSent?.()
      onClose()
      reset()
    } catch (err) {
      toast.error('Could not send back: ' + (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }, [targetId, reasonCode, body, priorSteps, onSent, onClose, reset])

  // Keyboard inside the dialog.
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && step === 'comment') {
        e.preventDefault()
        void submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, step, close, submit])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Send back to prior step"
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(26, 22, 19, 0.30)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: FONT,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: '100%',
          backgroundColor: '#fff',
          borderRadius: 8,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.18)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${C.borderSubtle}`,
            backgroundColor: C.surface,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowLeftCircle size={14} color={C.brandOrange} />
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.ink }}>
              Send back to prior step
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            disabled={submitting}
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              cursor: submitting ? 'not-allowed' : 'pointer',
              color: C.ink2,
              padding: 4,
            }}
          >
            <X size={14} />
          </button>
        </header>

        <StepDots step={step} reachable={{ target: true, reason: !!targetId, comment: !!reasonCode }} onStep={setStep} />

        <div style={{ padding: 18, minHeight: 220 }}>
          {step === 'target' && (
            <TargetStep priorSteps={priorSteps} value={targetId} onChange={setTargetId} />
          )}
          {step === 'reason' && (
            <ReasonStep value={reasonCode} onChange={setReasonCode} />
          )}
          {step === 'comment' && (
            <CommentStep body={body} onBody={setBody} />
          )}
        </div>

        <footer
          style={{
            padding: '12px 18px',
            borderTop: `1px solid ${C.borderSubtle}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {step !== 'target' && (
            <button
              type="button"
              onClick={() => setStep(step === 'comment' ? 'reason' : 'target')}
              disabled={submitting}
              style={secondaryBtnStyle}
            >
              Back
            </button>
          )}
          <span style={{ flex: 1 }} />
          {step !== 'comment' ? (
            <button
              type="button"
              onClick={() => {
                if (step === 'target' && !targetId) {
                  toast.error('Pick a target step first.')
                  return
                }
                if (step === 'reason' && !reasonCode) {
                  toast.error('Pick a reason chip first.')
                  return
                }
                setStep(step === 'target' ? 'reason' : 'comment')
              }}
              style={{ ...primaryBtnStyle, backgroundColor: C.brandOrange }}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !body.trim()}
              style={{
                ...primaryBtnStyle,
                backgroundColor: submitting ? '#F4D7BD' : C.brandOrange,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Sending back…' : 'Send back'}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

// ── Step views ─────────────────────────────────────────────────────────────

const TargetStep: React.FC<{
  priorSteps: PriorStep[]
  value: string | null
  onChange: (id: string) => void
}> = ({ priorSteps, value, onChange }) => {
  if (priorSteps.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: C.ink2, lineHeight: 1.5 }}>
        No prior steps in this chain — send-back is only available when there&apos;s
        a step to return to.
      </p>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ margin: 0, fontSize: 12, color: C.ink3 }}>
        Pick the reviewer step to return the submittal to. The intermediate
        steps will all be re-opened and need to flow again.
      </p>
      <ul role="radiogroup" aria-label="Prior steps" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {priorSteps.map((s) => {
          const active = s.id === value
          return (
            <li key={s.id}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(s.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  backgroundColor: active ? 'rgba(244, 120, 32, 0.08)' : '#fff',
                  border: `1px solid ${active ? C.brandOrange : C.border}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: FONT,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: active ? C.brandOrange : C.surfaceInset,
                    color: active ? '#fff' : C.ink2,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {s.sequence}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>
                    {s.reviewer_name ?? <em style={{ color: C.ink3, fontStyle: 'normal' }}>Unassigned</em>}
                  </div>
                  {s.reviewer_role && (
                    <div style={{ fontSize: 11, color: C.ink3 }}>{s.reviewer_role}</div>
                  )}
                </div>
                {active && <Check size={14} color={C.brandOrange} />}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const ReasonStep: React.FC<{
  value: SendBackReasonCode | null
  onChange: (code: SendBackReasonCode) => void
}> = ({ value, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <p style={{ margin: 0, fontSize: 12, color: C.ink3 }}>
      Why is this going back? The reason posts as the first line of an
      auto-comment on the target step + drives the Phase 7c-2 reason analytics.
    </p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
      {SEND_BACK_REASONS.map((r) => {
        const active = r.code === value
        return (
          <button
            key={r.code}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(r.code)}
            style={{
              padding: '8px 10px',
              backgroundColor: active ? 'rgba(244, 120, 32, 0.08)' : '#fff',
              border: `1px solid ${active ? C.brandOrange : C.border}`,
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              color: active ? C.brandOrange : C.ink,
              fontFamily: FONT,
              textAlign: 'left',
            }}
          >
            {r.label}
          </button>
        )
      })}
    </div>
  </div>
)

const CommentStep: React.FC<{
  body: string
  onBody: (v: string) => void
}> = ({ body, onBody }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <p style={{ margin: 0, fontSize: 12, color: C.ink3 }}>
      Add the explanation for the recipient. ⌘+Enter to send.
    </p>
    <textarea
      autoFocus
      value={body}
      onChange={(e) => onBody(e.target.value)}
      rows={5}
      placeholder="Describe what specifically needs to change before this comes back through the chain."
      style={{
        padding: '8px 10px',
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        fontSize: 13,
        fontFamily: FONT,
        color: C.ink,
        backgroundColor: '#fff',
        outline: 'none',
        resize: 'vertical',
        minHeight: 110,
      }}
    />
    <p style={{ margin: 0, fontSize: 11, color: C.ink3, display: 'flex', alignItems: 'center', gap: 4 }}>
      <Sparkles size={9} color={C.brandOrange} /> Auto-pin: the chain re-opens
      target → current; ball-in-court flips back to the target reviewer.
    </p>
  </div>
)

const StepDots: React.FC<{
  step: Step
  reachable: { target: boolean; reason: boolean; comment: boolean }
  onStep: (s: Step) => void
}> = ({ step, reachable, onStep }) => {
  const order: Array<{ id: Step; label: string }> = [
    { id: 'target',  label: 'Target' },
    { id: 'reason',  label: 'Reason' },
    { id: 'comment', label: 'Comment' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderBottom: `1px solid ${C.borderSubtle}` }}>
      {order.map((o, idx) => {
        const active = o.id === step
        const disabled = !reachable[o.id]
        return (
          <React.Fragment key={o.id}>
            <button
              type="button"
              onClick={() => !disabled && onStep(o.id)}
              aria-current={active}
              disabled={disabled}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 600,
                color: active ? C.brandOrange : disabled ? C.ink4 : C.ink2,
                backgroundColor: active ? 'rgba(244, 120, 32, 0.10)' : 'transparent',
                border: 'none',
                borderRadius: 3,
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontFamily: FONT,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {idx + 1}. {o.label}
            </button>
            {idx < order.length - 1 && <span style={{ color: C.ink4, fontSize: 10 }}>›</span>}
          </React.Fragment>
        )
      })}
    </div>
  )
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '7px 14px',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: FONT,
  cursor: 'pointer',
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: '7px 12px',
  backgroundColor: '#fff',
  color: C.ink,
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 500,
  fontFamily: FONT,
  cursor: 'pointer',
}

export default SendBackDialog
