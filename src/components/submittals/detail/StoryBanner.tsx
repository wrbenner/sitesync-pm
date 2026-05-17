// Phase 6 — Story banner for the submittal detail page.
//
// Per plan Pillar B (Steve Jobs touches): "Status is a sentence, not a
// color." The banner sits below the header and tells the user what
// happened, why, and what's next — in plain English with citation chips.
//
// Phase 6 ships a deterministic banner derived from the submittal's status
// + days_in_court + reviewer info. Phase 7 augments with Iris LLM-generated
// banners that cite past similar submittals.

import React from 'react'
import { AlertTriangle, CheckCircle2, Clock, Info } from 'lucide-react'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  active: '#2D8A6E',
  pending: '#C4850C',
  critical: '#C93B3B',
  brandOrange: '#F47820',
  surfaceInset: '#F5F5F1',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

type Tone = 'info' | 'pending' | 'success' | 'critical'

const toneColor: Record<Tone, string> = {
  info: C.ink2,
  pending: C.pending,
  success: C.active,
  critical: C.critical,
}

const toneBg: Record<Tone, string> = {
  info: C.surfaceInset,
  pending: 'rgba(196, 133, 12, 0.08)',
  success: 'rgba(45, 138, 110, 0.08)',
  critical: 'rgba(201, 59, 59, 0.08)',
}

const ToneIcon: React.FC<{ tone: Tone }> = ({ tone }) => {
  if (tone === 'success') return <CheckCircle2 size={14} />
  if (tone === 'critical') return <AlertTriangle size={14} />
  if (tone === 'pending') return <Clock size={14} />
  return <Info size={14} />
}

export interface StoryBannerInputs {
  status: string | null
  current_reviewer_name: string | null
  current_reviewer_role: string | null
  days_in_court: number | null
  required_on_site_date: string | null
  closed_at: string | null
  iris_preflight_findings_count: number | null
  /** Optional Iris-generated narrative (Phase 7+). When present, overrides
   *  the deterministic banner. */
  iris_narrative?: string | null
}

export interface StoryBannerOutput {
  tone: Tone
  headline: string
  /** Optional clickable chips that route to citations / actions. */
  chips?: { label: string; onClick?: () => void; href?: string }[]
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildStoryBanner(inputs: StoryBannerInputs): StoryBannerOutput | null {
  const status = (inputs.status ?? '').toLowerCase()
  if (inputs.iris_narrative) {
    return {
      tone: status === 'closed' ? 'success' : status === 'returned' ? 'critical' : 'info',
      headline: inputs.iris_narrative,
    }
  }

  // Closed → success.
  if (status === 'closed' || status === 'approved' || status === 'approved_as_noted') {
    const closedDate = inputs.closed_at ? new Date(inputs.closed_at).toLocaleDateString() : null
    return {
      tone: 'success',
      headline: closedDate ? `Closed ${closedDate}.` : 'Closed.',
    }
  }

  // Voided.
  if (status === 'void') {
    return {
      tone: 'info',
      headline: 'Voided. No further action.',
    }
  }

  // Returned (rejected / revise-and-resubmit) → critical.
  if (status === 'returned') {
    const reviewer = inputs.current_reviewer_name
    return {
      tone: 'critical',
      headline: reviewer
        ? `Returned by ${reviewer}${inputs.current_reviewer_role ? ` (${inputs.current_reviewer_role})` : ''}. Review comments and resubmit.`
        : 'Returned. Review comments and resubmit.',
    }
  }

  // In-flight with reviewer.
  if (inputs.current_reviewer_name && (status === 'in_review' || status === 'sent_to_reviewer')) {
    const days = inputs.days_in_court ?? 0
    const overdue = days > 7
    const tone: Tone = overdue ? 'critical' : days > 3 ? 'pending' : 'info'
    const role = inputs.current_reviewer_role ? ` (${inputs.current_reviewer_role})` : ''
    return {
      tone,
      headline: overdue
        ? `${inputs.current_reviewer_name}${role} is ${days} days late.`
        : `Awaiting ${inputs.current_reviewer_name}${role}: ${days} day${days === 1 ? '' : 's'} in court.`,
    }
  }

  // Sub uploading.
  if (status === 'sub_uploading') {
    return {
      tone: 'pending',
      headline: 'Awaiting sub upload via magic link.',
    }
  }

  // GC reviewing / pre-flight.
  if (status === 'gc_review' || status === 'preflight') {
    return {
      tone: 'pending',
      headline: status === 'preflight'
        ? 'Iris pre-flight running.'
        : 'GC review in progress.',
    }
  }

  // Distribute pending.
  if (status === 'distribute') {
    return {
      tone: 'success',
      headline: 'Approved — pending distribution to field.',
    }
  }

  // Draft.
  if (status === 'draft') {
    return {
      tone: 'info',
      headline: 'Draft — fill in details and send to start the workflow.',
    }
  }

  // Iris-flagged but no story-state match.
  if ((inputs.iris_preflight_findings_count ?? 0) > 0) {
    return {
      tone: 'pending',
      headline: `Iris flagged ${inputs.iris_preflight_findings_count} pre-flight item${inputs.iris_preflight_findings_count === 1 ? '' : 's'}.`,
    }
  }

  return null
}

export interface StoryBannerProps {
  inputs: StoryBannerInputs
}

export const StoryBanner: React.FC<StoryBannerProps> = ({ inputs }) => {
  const banner = buildStoryBanner(inputs)
  if (!banner) return null

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '10px 16px',
        backgroundColor: toneBg[banner.tone],
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        fontFamily: FONT,
        fontSize: 13,
        color: C.ink,
        lineHeight: 1.4,
      }}
    >
      <span style={{ color: toneColor[banner.tone], paddingTop: 1 }}>
        <ToneIcon tone={banner.tone} />
      </span>
      <span style={{ flex: 1, fontWeight: 500 }}>{banner.headline}</span>
      {banner.chips && banner.chips.length > 0 && (
        <div style={{ display: 'flex', gap: 4 }}>
          {banner.chips.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={c.onClick}
              style={{
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 600,
                color: C.brandOrange,
                backgroundColor: '#fff',
                border: `1px solid ${C.brandOrange}`,
                borderRadius: 3,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default StoryBanner
