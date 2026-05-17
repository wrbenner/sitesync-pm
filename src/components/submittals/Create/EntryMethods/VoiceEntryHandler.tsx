// Phase 5 — Voice entry handler.
//
// Bridges the existing voice FAB pattern (RFIVoiceFAB / VoiceCapture) to
// the unified create modal. Phase 10 will replace the per-feature voice
// drivers with the unified `useVoiceCommand` hook; for Phase 5 we ship a
// thin handler that:
//   1. Renders a Sparkles button in the page action cluster
//   2. On click, opens an inline transcript prompt (placeholder UI — the
//      real voice capture lives in `src/components/voice/VoiceRecorder.tsx`
//      and is wired by Phase 10's voice unification)
//   3. Iris parses the transcript → entities → seeds an initial draft via
//      `buildDraftFromVoice`
//   4. Opens the unified create modal with the draft pre-populated and
//      tier set to 'full' (so the user sees the "auto" badges)
//
// Phase 5 ships the handler shape + the integration point. The
// transcript-to-entity LLM call is stubbed to a deterministic regex
// extractor so the demo path is end-to-end testable today.

import React, { useCallback, useState } from 'react'
import { Mic, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { buildDraftFromVoice, type SubmittalDraft } from '../../../../services/iris/submittalDraft'
import type { SubmittalKind } from '../../../../types/submittal'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  brandOrange: '#F47820',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface VoiceEntryHandlerProps {
  /** Render-prop callback fired when the user finishes capture and Iris
   *  has produced a seeded draft. The page passes this to its modal. */
  onDraftReady: (draft: SubmittalDraft) => void
}

export const VoiceEntryHandler: React.FC<VoiceEntryHandlerProps> = ({ onDraftReady }) => {
  const [open, setOpen] = useState(false)
  const [transcript, setTranscript] = useState('')

  const finalize = useCallback(() => {
    const t = transcript.trim()
    if (!t) {
      toast.info('No transcript captured.')
      return
    }
    const entities = extractEntitiesFromTranscript(t)
    const draft = buildDraftFromVoice({ transcript: t, entities })
    onDraftReady(draft)
    setOpen(false)
    setTranscript('')
    toast.success('Voice captured. Review the pre-filled draft and send.')
  }, [transcript, onDraftReady])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Voice: Hey Iris, draft a submittal…"
        aria-label="Create submittal by voice"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '6px 10px',
          minHeight: 30,
          borderRadius: 4,
          backgroundColor: '#fff',
          border: `1px solid ${C.border}`,
          color: C.ink,
          fontSize: 12,
          fontWeight: 500,
          fontFamily: FONT,
          cursor: 'pointer',
        }}
      >
        <Mic size={12} />
        Voice
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Voice capture"
          onClick={() => setOpen(false)}
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
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={14} color={C.brandOrange} />
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.ink }}>
                Hey Iris — draft a submittal
              </h2>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: C.ink2,
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: C.ink3, lineHeight: 1.4 }}>
              Phase 5 ships transcript-paste here as the capture surface. Phase 10
              wires the unified <code style={{ fontFamily: FONT }}>useVoiceCommand</code>
              {' '}hook (real microphone, live transcription) — same draft seeding logic
              behind the scenes.
            </p>
            <textarea
              autoFocus
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder='e.g. "Draft a shop drawing submittal for storefront aluminum, ACME Glass, spec section 08 41 13, tied to Tower 3 floor 2 install"'
              rows={4}
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
                minHeight: 80,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  padding: '7px 12px',
                  backgroundColor: '#fff',
                  color: C.ink,
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: FONT,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={finalize}
                disabled={!transcript.trim()}
                style={{
                  padding: '7px 14px',
                  backgroundColor: !transcript.trim() ? '#F4D7BD' : C.brandOrange,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: !transcript.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: FONT,
                  opacity: !transcript.trim() ? 0.7 : 1,
                }}
              >
                Pre-fill draft
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Deterministic transcript extractor ──────────────────────────────────────
// Phase 5 ships a regex-based extractor for the demo path. Phase 7 swaps in
// the Iris LLM call with structured output + citation mapping.

const KIND_REGEX: { kind: SubmittalKind; pattern: RegExp }[] = [
  { kind: 'shop_drawing', pattern: /\b(shop\s*draw|sd|shop\s*dwg)/i },
  { kind: 'product_data', pattern: /\b(product\s*data|prod\s*data|cut\s*sheet)/i },
  { kind: 'sample', pattern: /\b(sample|swatch|chip)/i },
  { kind: 'mockup', pattern: /\b(mock[-\s]?up)/i },
  { kind: 'test_report', pattern: /\b(test\s*report|test\s*data|aama\s*test)/i },
  { kind: 'certification', pattern: /\b(cert|certification|certificate)/i },
  { kind: 'closeout', pattern: /\b(close[-\s]?out|coa|c\s*of\s*o)/i },
  { kind: 'warranty', pattern: /\b(warranty|warranties)/i },
]

const CSI_REGEX = /\b(\d{2})\s*(\d{2})\s*(\d{2,4})\b/
const SUB_NAME_REGEX = /([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)?)\s+(Glass|Concrete|Steel|Mechanical|Plumbing|Electrical|Roofing|Drywall)/

export function extractEntitiesFromTranscript(transcript: string): {
  title?: string
  csi_section?: string
  kind?: SubmittalKind
  sub_name?: string
  schedule_activity_name?: string
} {
  const out: ReturnType<typeof extractEntitiesFromTranscript> = {}

  // CSI section — "08 41 13" or "08-41-13" anywhere in the transcript.
  const csiMatch = transcript.match(CSI_REGEX)
  if (csiMatch) {
    out.csi_section = `${csiMatch[1]} ${csiMatch[2]} ${csiMatch[3]}`
  }

  // Kind — first match wins.
  for (const { kind, pattern } of KIND_REGEX) {
    if (pattern.test(transcript)) {
      out.kind = kind
      break
    }
  }

  // Sub name — "[xxx] Glass" / "[xxx] Concrete" / "[xxx] Steel" etc.
  const subMatch = transcript.match(SUB_NAME_REGEX)
  if (subMatch) {
    out.sub_name = subMatch[0]
  }

  // Title — short clean version: first sentence with kind/csi removed, max 60 chars.
  const firstSentence = transcript.split(/[.!?]/)[0].trim()
  if (firstSentence) {
    let title = firstSentence
    title = title.replace(/^(draft|create|new|make|hey iris[,]?)/i, '').trim()
    title = title.replace(/^[a-z]/, (c) => c.toUpperCase())
    if (title.length > 60) title = title.slice(0, 57) + '…'
    if (title) out.title = title
  }

  return out
}

export default VoiceEntryHandler
