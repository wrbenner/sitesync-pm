// Phase 7 — Voice review codes + disposition picker overlay.
//
// World-class plan Pillar B + cross-cutting principle "Voice and keyboard
// are first-class, mouse is fallback":
//
//   A → Approve as noted        (or Approve)
//   R → Revise and resubmit
//   V → Reject (Veto)           (mnemonic: V is the verbal opposite of A)
//
// Pressing the key opens a disposition overlay pre-filled with the
// matching disposition. Voice path: hold spacebar (push-to-talk) and say
// "approve as noted" / "revise and resubmit — see comments" / "reject —
// wrong manufacturer". Iris parses → opens the overlay pre-filled →
// user presses ⌘+Enter to confirm. PermissionGate fires before the RPC.
//
// Phase 7 ships the keyboard path + disposition overlay. The voice
// driver (real microphone, transcription, parser) plugs in via Phase 10's
// unified `useVoiceCommand` hook; the overlay accepts a transcript prop
// so the voice path can fire `applyTranscript(transcript)` to seed it.

import React, { useCallback, useEffect, useState } from 'react'
import { Check, RefreshCcw, X, Sparkles, ChevronDown } from 'lucide-react'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  brandOrange: '#F47820',
  active: '#2D8A6E',
  pending: '#C4850C',
  critical: '#C93B3B',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export type ReviewCode = 'approve' | 'revise' | 'reject'

export interface DispositionPick {
  code: ReviewCode
  /** EJCDC / AIA / UFGS / custom — codeset comes from the submittal's
   *  project settings. The picker shows the codeset's labels. */
  disposition: string
  comments: string
}

const KEY_CODE_MAP: Record<string, ReviewCode> = {
  a: 'approve',
  r: 'revise',
  v: 'reject',
}

const DISPOSITION_OPTIONS: Record<ReviewCode, { label: string; codes: string[] }> = {
  approve: {
    label: 'Approve',
    codes: ['A — No exceptions taken', 'Approved as noted', 'Approved'],
  },
  revise: {
    label: 'Revise & resubmit',
    codes: ['C — Revise and resubmit', 'Revise and resubmit', 'Returned for revision'],
  },
  reject: {
    label: 'Reject',
    codes: ['D — Rejected', 'Rejected', 'Not approved'],
  },
}

export interface VoiceReviewOverlayProps {
  /** True when the user has the `submittals.approve` permission (parent gates). */
  canApprove: boolean
  /** Fires when the user confirms a disposition. The page wires this to the
   *  `submittal_record_disposition` RPC. */
  onConfirm: (pick: DispositionPick) => Promise<void> | void
  /** Optional transcript-seed callback — Phase 10 voice driver fires this
   *  with the parsed transcript ("approve as noted"). The overlay opens
   *  pre-filled. */
  transcriptSeed?: string | null
}

export const VoiceReviewOverlay: React.FC<VoiceReviewOverlayProps> = ({
  canApprove,
  onConfirm,
  transcriptSeed,
}) => {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState<ReviewCode>('approve')
  const [disposition, setDisposition] = useState<string>('Approved as noted')
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const openWithCode = useCallback((c: ReviewCode) => {
    setCode(c)
    setDisposition(DISPOSITION_OPTIONS[c].codes[0])
    setOpen(true)
  }, [])

  // Keyboard shortcuts — A / R / V open the overlay with the matching code.
  useEffect(() => {
    if (!canApprove) return
    const onKey = (e: KeyboardEvent): void => {
      // Skip when typing in an input/textarea/contentEditable.
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      const matchedCode = KEY_CODE_MAP[k]
      if (!matchedCode) return
      e.preventDefault()
      openWithCode(matchedCode)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canApprove, openWithCode])

  // Transcript seed — Phase 10 voice driver fires `transcriptSeed`; we
  // parse it deterministically into a code + disposition.
  useEffect(() => {
    if (!transcriptSeed) return
    const parsed = parseTranscriptToReviewCode(transcriptSeed)
    if (parsed) {
      setCode(parsed.code)
      setDisposition(parsed.disposition)
      setComments(parsed.comments)
      setOpen(true)
    }
  }, [transcriptSeed])

  // Esc + ⌘+Enter shortcuts inside the overlay.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        void handleSubmit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, code, disposition, comments])

  const handleSubmit = async (): Promise<void> => {
    if (!canApprove || submitting) return
    setSubmitting(true)
    try {
      await onConfirm({ code, disposition, comments: comments.trim() })
      setOpen(false)
      setComments('')
    } finally {
      setSubmitting(false)
    }
  }

  if (!canApprove) return null

  return (
    <>
      {/* Inline keyboard-hint chip on the action cluster (always visible). */}
      <div
        aria-hidden
        title="Keyboard shortcuts: A approve, R revise, V veto/reject"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          fontSize: 10,
          fontWeight: 600,
          color: C.ink3,
          backgroundColor: C.surfaceInset,
          border: `1px solid ${C.borderSubtle}`,
          borderRadius: 3,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          fontFamily: FONT,
        }}
      >
        <kbd style={kbdStyle}>A</kbd>
        <kbd style={kbdStyle}>R</kbd>
        <kbd style={kbdStyle}>V</kbd>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Submit review disposition"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(26, 22, 19, 0.30)',
            zIndex: 80,
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
              width: 460,
              maxWidth: '100%',
              backgroundColor: '#fff',
              borderRadius: 8,
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.18)',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={14} color={C.brandOrange} />
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.ink }}>
                Submit review disposition
              </h2>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: C.ink2 }}
              >
                <X size={14} />
              </button>
            </header>

            {/* Code radio row */}
            <div role="radiogroup" aria-label="Review code" style={{ display: 'flex', gap: 6 }}>
              <CodeChip
                code="approve"
                active={code === 'approve'}
                icon={<Check size={12} />}
                tone="success"
                onClick={() => { setCode('approve'); setDisposition(DISPOSITION_OPTIONS.approve.codes[0]) }}
              />
              <CodeChip
                code="revise"
                active={code === 'revise'}
                icon={<RefreshCcw size={12} />}
                tone="pending"
                onClick={() => { setCode('revise'); setDisposition(DISPOSITION_OPTIONS.revise.codes[0]) }}
              />
              <CodeChip
                code="reject"
                active={code === 'reject'}
                icon={<X size={12} />}
                tone="critical"
                onClick={() => { setCode('reject'); setDisposition(DISPOSITION_OPTIONS.reject.codes[0]) }}
              />
            </div>

            {/* Disposition picker (within the chosen code) */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle}>Disposition</span>
              <div style={{ position: 'relative' }}>
                <select
                  value={disposition}
                  onChange={(e) => setDisposition(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 28, appearance: 'none' }}
                  aria-label="Disposition codeset"
                >
                  {DISPOSITION_OPTIONS[code].codes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  color={C.ink3}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                />
              </div>
            </label>

            {/* Comments */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle}>Comments {code !== 'approve' && <span style={{ color: C.critical }}>*</span>}</span>
              <textarea
                autoFocus
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={4}
                placeholder={
                  code === 'approve'
                    ? 'Optional. Anything the next reviewer needs to know.'
                    : code === 'revise'
                    ? 'Required. What needs to change before resubmission?'
                    : 'Required. Reason for rejection.'
                }
                style={{ ...inputStyle, resize: 'vertical', minHeight: 80, fontFamily: FONT }}
              />
            </label>

            <footer style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: C.ink3 }}>
                ⌘+Enter to confirm · Esc to cancel
              </span>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={secondaryBtnStyle}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || (code !== 'approve' && comments.trim().length === 0)}
                style={{
                  ...primaryBtnStyle,
                  backgroundColor: submitting ? '#F4D7BD' : C.brandOrange,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Sending…' : `Send ${DISPOSITION_OPTIONS[code].label.toLowerCase()}`}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface CodeChipProps {
  code: ReviewCode
  active: boolean
  icon: React.ReactNode
  tone: 'success' | 'pending' | 'critical'
  onClick: () => void
}

const CodeChip: React.FC<CodeChipProps> = ({ code, active, icon, tone, onClick }) => {
  const color = tone === 'success' ? C.active : tone === 'pending' ? C.pending : C.critical
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      style={{
        flex: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        padding: '8px 10px',
        backgroundColor: active ? `${color}14` : '#fff',
        border: `1px solid ${active ? color : C.border}`,
        color: active ? color : C.ink2,
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: FONT,
      }}
    >
      {icon}
      {DISPOSITION_OPTIONS[code].label}
    </button>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: C.ink2,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  fontSize: 13,
  fontFamily: FONT,
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

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 5px',
  fontSize: 10,
  fontWeight: 700,
  color: C.ink2,
  backgroundColor: '#fff',
  border: `1px solid ${C.border}`,
  borderRadius: 3,
  fontFamily: '"JetBrains Mono", SFMono-Regular, Menlo, monospace',
  lineHeight: 1.4,
}

// ── Transcript parsing ────────────────────────────────────────────────────

export interface ParsedTranscript {
  code: ReviewCode
  disposition: string
  comments: string
}

/**
 * Deterministic transcript-to-review-code parser. Phase 10 voice driver
 * uses Iris LLM extraction for higher-recall intent detection; this
 * parser is the offline-safe fallback (and what we test today).
 */
export function parseTranscriptToReviewCode(transcript: string): ParsedTranscript | null {
  const t = transcript.trim().toLowerCase()
  if (!t) return null

  let code: ReviewCode | null = null
  if (/(approve\s+as\s+noted|approved\s+as\s+noted)/.test(t)) {
    code = 'approve'
  } else if (/^(approve|approved)\b/.test(t) || /\bapprove\b/.test(t)) {
    code = 'approve'
  } else if (/(revise\s+(and\s+)?resubmit|revise|resubmit)/.test(t)) {
    code = 'revise'
  } else if (/^reject(ed)?\b/.test(t) || /\breject(ed)?\b/.test(t) || /\bnot\s+approved\b/.test(t)) {
    code = 'reject'
  }
  if (!code) return null

  // Strip the disposition stem to recover comments — everything after the
  // first em-dash, "see comments", "—", or "because" / "reason:".
  let comments = ''
  const splitIdx = t.search(/\s+[—–-]\s+|see\s+comments|because|reason:|—|—/)
  if (splitIdx > -1) {
    comments = transcript.slice(splitIdx).replace(/^\s+[—–-]\s+/, '').trim()
  }

  const disposition =
    code === 'approve' && /as\s+noted/.test(t) ? 'Approved as noted' :
    DISPOSITION_OPTIONS[code].codes[0]

  return { code, disposition, comments }
}

export default VoiceReviewOverlay
