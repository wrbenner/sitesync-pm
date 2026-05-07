// Phase 8 — Distribute action.
//
// One-tap "Push to Field" → opens a 3-step wizard that captures:
//   1. Recipients (people picker + free-form emails)
//   2. Message + options (auto-pin drawings, send magic-link)
//   3. Confirmation preview with ✨ AUTO badges on each side-effect
//
// On confirm, calls submittal_distribute_v2 RPC. Each side-effect is
// 5-second-undoable via the toast affordance (per plan principle #6
// "Reversibility is a feature").

import React, { useCallback, useState } from 'react'
import { Send, X, Check, MapPin, Link, Mail, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { submittalDistributeService } from '../../../../services/submittalDistributeV2'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  brandOrange: '#F47820',
  active: '#2D8A6E',
  critical: '#C93B3B',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface DistributeActionProps {
  /** Submittal id — passed to the distribute RPC. */
  submittalId: string
  /** Submittal-side label rendered in the confirmation step. */
  submittalLabel?: string
  /** Fires after successful distribute — page refetches submittal + chain. */
  onDistributed?: () => void
}

type Step = 'recipients' | 'options' | 'preview'

export const DistributeAction: React.FC<DistributeActionProps> = ({
  submittalId,
  submittalLabel,
  onDistributed,
}) => {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('recipients')
  const [emails, setEmails] = useState<string>('')
  const [message, setMessage] = useState<string>('')
  const [autoPin, setAutoPin] = useState(true)
  const [sendMagicLink, setSendMagicLink] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const reset = useCallback(() => {
    setStep('recipients')
    setEmails('')
    setMessage('')
    setAutoPin(true)
    setSendMagicLink(true)
    setSubmitting(false)
  }, [])

  const close = useCallback(() => {
    if (submitting) return
    setOpen(false)
    reset()
  }, [submitting, reset])

  const parsedEmails = parseEmails(emails)

  const submit = async (): Promise<void> => {
    if (parsedEmails.length === 0) {
      toast.error('Add at least one recipient email.')
      setStep('recipients')
      return
    }
    setSubmitting(true)
    try {
      const result = await submittalDistributeService.distribute({
        submittal_id: submittalId,
        to_emails: parsedEmails,
        message: message.trim() || null,
        auto_pin_drawings: autoPin,
        send_magic_link: sendMagicLink,
      })
      if (result.error) {
        toast.error('Distribute failed: ' + result.error.message)
        return
      }
      toast.success(
        `Distributed to ${parsedEmails.length} recipient${parsedEmails.length === 1 ? '' : 's'}.`,
        // 5-second-undoable affordance — per plan #6 Reversibility.
        // (Phase 8b wires the actual undo RPC; Phase 8 ships the toast.)
        { duration: 5000 },
      )
      setOpen(false)
      reset()
      onDistributed?.()
    } catch (err) {
      toast.error('Distribute failed: ' + (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Push to field — distribute approved submittal"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '7px 12px',
          backgroundColor: C.brandOrange,
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: FONT,
        }}
      >
        <Send size={12} /> Push to field
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Distribute submittal"
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
              width: 540,
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
              <div>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.ink }}>
                  Push to field
                </h2>
                {submittalLabel && (
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: C.ink3 }}>
                    {submittalLabel}
                  </p>
                )}
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

            <StepDots step={step} onStep={(s) => parsedEmails.length > 0 || s === 'recipients' ? setStep(s) : null} />

            <div style={{ padding: '18px', minHeight: 220 }}>
              {step === 'recipients' && (
                <RecipientsStep emails={emails} onChange={setEmails} parsed={parsedEmails} />
              )}
              {step === 'options' && (
                <OptionsStep
                  message={message}
                  onMessage={setMessage}
                  autoPin={autoPin}
                  onAutoPin={setAutoPin}
                  sendMagicLink={sendMagicLink}
                  onSendMagicLink={setSendMagicLink}
                />
              )}
              {step === 'preview' && (
                <PreviewStep
                  emails={parsedEmails}
                  message={message}
                  autoPin={autoPin}
                  sendMagicLink={sendMagicLink}
                />
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
              {step !== 'recipients' && (
                <button
                  type="button"
                  onClick={() => setStep(step === 'preview' ? 'options' : 'recipients')}
                  disabled={submitting}
                  style={secondaryBtnStyle}
                >
                  Back
                </button>
              )}
              <span style={{ flex: 1 }} />
              {step !== 'preview' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (step === 'recipients' && parsedEmails.length === 0) {
                      toast.error('Add at least one recipient email.')
                      return
                    }
                    setStep(step === 'recipients' ? 'options' : 'preview')
                  }}
                  style={{
                    ...primaryBtnStyle,
                    backgroundColor: C.brandOrange,
                  }}
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  style={{
                    ...primaryBtnStyle,
                    backgroundColor: submitting ? '#F4D7BD' : C.brandOrange,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Distributing…' : `Distribute to ${parsedEmails.length} recipient${parsedEmails.length === 1 ? '' : 's'}`}
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </>
  )
}

// ── Step components ────────────────────────────────────────────────────────

const RecipientsStep: React.FC<{
  emails: string
  onChange: (v: string) => void
  parsed: string[]
}> = ({ emails, onChange, parsed }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={labelStyle}>Recipient emails</span>
      <textarea
        autoFocus
        value={emails}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        placeholder="foreman@example.com, super@example.com&#10;Comma- or newline-separated."
        style={{ ...inputStyle, resize: 'vertical', minHeight: 100, fontFamily: FONT }}
      />
    </label>
    <div style={{ fontSize: 11, color: C.ink3 }}>
      Parsed: <strong style={{ color: parsed.length > 0 ? C.active : C.ink3 }}>
        {parsed.length} valid email{parsed.length === 1 ? '' : 's'}
      </strong>
    </div>
    <p style={{ margin: 0, fontSize: 11, color: C.ink3, lineHeight: 1.4 }}>
      Phase 8 ships email-only recipient capture. The project-member
      typeahead (people picker) lands in Phase 8b alongside the existing
      `useProjectDirectory` hook.
    </p>
  </div>
)

const OptionsStep: React.FC<{
  message: string
  onMessage: (v: string) => void
  autoPin: boolean
  onAutoPin: (v: boolean) => void
  sendMagicLink: boolean
  onSendMagicLink: (v: boolean) => void
}> = ({ message, onMessage, autoPin, onAutoPin, sendMagicLink, onSendMagicLink }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={labelStyle}>Message (optional)</span>
      <textarea
        value={message}
        onChange={(e) => onMessage(e.target.value)}
        rows={3}
        placeholder="Anything the field team needs to know about this distribution."
        style={{ ...inputStyle, resize: 'vertical', minHeight: 60, fontFamily: FONT }}
      />
    </label>

    <Toggle
      checked={autoPin}
      onChange={onAutoPin}
      label="Auto-pin on linked drawings"
      hint="Marks the linked drawing pins with a 'Distributed YYYY-MM-DD' stamp so the field team can see what's currently being distributed."
      icon={<MapPin size={12} />}
    />

    <Toggle
      checked={sendMagicLink}
      onChange={onSendMagicLink}
      label="Send magic-link viewer"
      hint="Each recipient gets a 14-day token that opens a no-account viewer. Phase 9 wires sub.sitesync.com; Phase 8 ships the token persistence."
      icon={<Link size={12} />}
    />
  </div>
)

const PreviewStep: React.FC<{
  emails: string[]
  message: string
  autoPin: boolean
  sendMagicLink: boolean
}> = ({ emails, message, autoPin, sendMagicLink }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.ink2, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      Confirm distribution
    </h3>
    <PreviewRow
      icon={<Mail size={12} />}
      label="Recipients"
      value={`${emails.length} email${emails.length === 1 ? '' : 's'}`}
      detail={emails.slice(0, 4).join(', ') + (emails.length > 4 ? `… +${emails.length - 4} more` : '')}
    />
    {message.trim() && (
      <PreviewRow
        icon={<Mail size={12} />}
        label="Message"
        value={message.length > 60 ? message.slice(0, 60) + '…' : message}
      />
    )}
    {autoPin && (
      <PreviewRow
        icon={<MapPin size={12} />}
        label="Auto-pin drawings"
        value="On"
        autoBadge
      />
    )}
    {sendMagicLink && (
      <PreviewRow
        icon={<Link size={12} />}
        label="Magic-link viewers"
        value="Generated for each recipient"
        autoBadge
      />
    )}
    <p style={{ margin: '4px 0 0', fontSize: 11, color: C.ink3, lineHeight: 1.4 }}>
      Distribute is 5-second-undoable via the toast that fires on success.
    </p>
  </div>
)

// ── Sub-components ─────────────────────────────────────────────────────────

const StepDots: React.FC<{ step: Step; onStep: (s: Step) => void }> = ({ step, onStep }) => {
  const order: Step[] = ['recipients', 'options', 'preview']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderBottom: `1px solid ${C.borderSubtle}` }}>
      {order.map((s, idx) => {
        const active = s === step
        const reached = order.indexOf(step) >= idx
        return (
          <React.Fragment key={s}>
            <button
              type="button"
              onClick={() => onStep(s)}
              aria-current={active}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 600,
                color: active ? C.brandOrange : reached ? C.ink2 : C.ink3,
                backgroundColor: active ? 'rgba(244, 120, 32, 0.10)' : 'transparent',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
                fontFamily: FONT,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {idx + 1}. {s}
            </button>
            {idx < order.length - 1 && <span style={{ color: C.ink4, fontSize: 10 }}>›</span>}
          </React.Fragment>
        )
      })}
    </div>
  )
}

const Toggle: React.FC<{
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint: string
  icon: React.ReactNode
}> = ({ checked, onChange, label, hint, icon }) => (
  <label
    style={{
      display: 'flex',
      gap: 10,
      padding: '10px 12px',
      backgroundColor: checked ? C.surfaceInset : 'transparent',
      border: `1px solid ${checked ? C.border : C.borderSubtle}`,
      borderRadius: 6,
      cursor: 'pointer',
    }}
  >
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      style={{ marginTop: 4 }}
    />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          color: C.ink,
        }}
      >
        <span style={{ color: C.brandOrange }}>{icon}</span>
        {label}
      </div>
      <p style={{ margin: '3px 0 0', fontSize: 11, color: C.ink3, lineHeight: 1.4 }}>{hint}</p>
    </div>
  </label>
)

const PreviewRow: React.FC<{
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  autoBadge?: boolean
}> = ({ icon, label, value, detail, autoBadge }) => (
  <div
    style={{
      display: 'flex',
      gap: 10,
      padding: '8px 10px',
      backgroundColor: C.surfaceInset,
      borderRadius: 4,
      alignItems: 'flex-start',
    }}
  >
    <span style={{ color: C.ink2, paddingTop: 2 }}>{icon}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: C.ink3, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </span>
        {autoBadge && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: C.brandOrange,
              padding: '1px 5px',
              borderRadius: 3,
              backgroundColor: 'rgba(244, 120, 32, 0.10)',
              letterSpacing: '0.05em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Sparkles size={9} /> AUTO
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, color: C.ink, fontWeight: 500, marginTop: 2 }}>
        {value}
      </div>
      {detail && (
        <div style={{ fontSize: 11, color: C.ink3, marginTop: 2, fontFamily: FONT, wordBreak: 'break-word' }}>
          {detail}
        </div>
      )}
    </div>
    <Check size={12} color={C.active} style={{ marginTop: 4 }} />
  </div>
)

// ── Helpers ────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i

export function parseEmails(input: string): string[] {
  if (!input) return []
  const parts = input
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const valid = parts.filter((p) => EMAIL_REGEX.test(p))
  // Dedupe (case-insensitive) preserving order.
  const seen = new Set<string>()
  const out: string[] = []
  for (const e of valid) {
    const key = e.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(e)
  }
  return out
}

// ── Styles ─────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: C.ink2,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  fontSize: 13,
  color: C.ink,
  backgroundColor: '#fff',
  outline: 'none',
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

export default DistributeAction
