// Phase 5. Full tier progressive disclosure.
//
// Renders the rest of the create form below the Quick tier. Sections
// expand/collapse independently; each section header shows whether any
// field inside has been filled (Iris pre-filled or manual).
//
// Sections (per spec Part 4.2 + plan Pillar A):
//   * Question(s). multi-question support per RFI parity (Phase 5 ships
//     single-question; multi follows in Phase 6 if needed by demo)
//   * Context. Trade / Cost code / Spec section / Location / Drawing pins
//   * Impact. Cost impact $ + days; schedule activity link
//   * People. From / Reviewers chain / Distribution / Watchers
//   * Workflow. template picker (project default + Iris suggestion)
//   * Attachments. drag-drop manager
//   * Privacy. Internal / Shared + Private toggle
//   * Numbering. auto by default; "Override" reveals manual entry
//
// Phase 5 ships the section scaffolding + the field plumbing. The
// typeahead pickers (people / spec / drawing pin / schedule activity)
// reuse the components built in Phase 6 detail-page work; here they're
// represented as labeled placeholder inputs so the form data round-trips.

import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Field, inputStyle } from './QuickTierFields'
import type { SubmittalDraft } from '../../../services/iris/submittalDraft'
import type { WalkbackBreakdown } from '../../../hooks/useScheduleWalkback'
import type { SubmittalKind } from '../../../types/submittal'

/** Returns the provenance source for a field when it's an Iris pre-fill,
 *  otherwise undefined (so the "auto" badge stays hidden after manual edits). */
const autoSrc = (draft: SubmittalDraft, key: keyof SubmittalDraft['provenance']): string | undefined => {
  const v = draft.provenance[key]
  return v && v !== 'manual' ? v : undefined
}

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surfaceInset: '#F5F5F1',
  brandOrange: '#F47820',
  active: '#2D8A6E',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface FullTierProgressiveProps {
  draft: SubmittalDraft
  projectId: string
  walkback: WalkbackBreakdown
  onPatch: (patch: Partial<SubmittalDraft>) => void
}

const KIND_OPTIONS: { value: SubmittalKind; label: string }[] = [
  { value: 'shop_drawing', label: 'Shop drawing' },
  { value: 'product_data', label: 'Product data' },
  { value: 'sample', label: 'Sample' },
  { value: 'mockup', label: 'Mockup' },
  { value: 'test_report', label: 'Test report' },
  { value: 'certification', label: 'Certification' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'closeout', label: 'Closeout' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'leed_credit', label: 'LEED credit' },
  { value: 'coordination_drawing', label: 'Coordination drawing' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
]

export const FullTierProgressive: React.FC<FullTierProgressiveProps> = ({
  draft,
  walkback,
  onPatch,
}) => (
  <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
    <Section
      title="Context"
      defaultOpen
      filledCount={
        (draft.csi_section ? 1 : 0) +
        (draft.kind ? 1 : 0) +
        (draft.spec_section_paragraph ? 1 : 0)
      }
    >
      <Row>
        <Field
          label="CSI section"
          autoFromIris={autoSrc(draft, 'csi_section')}
        >
          <input
            type="text"
            value={draft.csi_section ?? ''}
            onChange={(e) => onPatch({ csi_section: e.target.value || null })}
            placeholder="08 41 13"
            style={inputStyle}
          />
        </Field>
        <Field
          label="Kind"
          autoFromIris={autoSrc(draft, 'kind')}
        >
          <select
            value={draft.kind ?? ''}
            onChange={(e) =>
              onPatch({ kind: (e.target.value || null) as SubmittalKind | null })
            }
            style={inputStyle}
            aria-label="Submittal kind"
          >
            <option value="">- select -</option>
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
      </Row>
      <Field
        label="Spec section paragraph"
        autoFromIris={autoSrc(draft, 'spec_section_paragraph')}
        hint="e.g. §2.04.B.3. feeds the citation backref."
      >
        <input
          type="text"
          value={draft.spec_section_paragraph ?? ''}
          onChange={(e) => onPatch({ spec_section_paragraph: e.target.value || null })}
          placeholder="§2.04"
          style={inputStyle}
        />
      </Field>
      <Field label="Description / question" hint="Optional. Rich text comes in Phase 6 (TipTap reuse from RFI).">
        <textarea
          value={draft.description ?? ''}
          onChange={(e) => onPatch({ description: e.target.value || null })}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
          placeholder="Anything the reviewer needs to know about the submission."
        />
      </Field>
    </Section>

    <Section
      title="Impact"
      filledCount={
        (draft.schedule_activity_id ? 1 : 0) +
        (draft.is_critical_path ? 1 : 0) +
        (draft.required_on_site_date ? 1 : 0)
      }
    >
      <Row>
        <Field
          label="Schedule activity"
          autoFromIris={autoSrc(draft, 'schedule_activity_id')}
        >
          <input
            type="text"
            value={draft.schedule_activity_id ?? ''}
            onChange={(e) => onPatch({ schedule_activity_id: e.target.value || null })}
            placeholder="Pick activity. Phase 6 typeahead"
            style={inputStyle}
            aria-label="Schedule activity (placeholder picker)"
          />
        </Field>
        <Field label="Critical path">
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 10px',
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              backgroundColor: '#fff',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={draft.is_critical_path}
              onChange={(e) => onPatch({ is_critical_path: e.target.checked })}
            />
            On critical path
          </label>
        </Field>
      </Row>
      <Row>
        <Field
          label="Required on site"
          autoFromIris={autoSrc(draft, 'required_on_site_date')}
          hint={
            walkback.ready
              ? `Walkback: ${walkback.activity_start_date} − ${walkback.buffer_days}d buffer = ${walkback.computed_required_on_site}`
              : 'Set a schedule activity to enable the walkback default.'
          }
        >
          <input
            type="date"
            value={draft.required_on_site_date ?? ''}
            onChange={(e) => onPatch({ required_on_site_date: e.target.value || null })}
            style={inputStyle}
          />
        </Field>
        <Field
          label="Submit by"
          autoFromIris={autoSrc(draft, 'submit_by_date')}
          hint={
            walkback.ready
              ? `Required-on-site − ${walkback.ship_lead_time_days + walkback.fab_lead_time_days + walkback.review_duration_days}d (ship + fab + SLA)`
              : null
          }
        >
          <input
            type="date"
            value={draft.submit_by_date ?? ''}
            onChange={(e) => onPatch({ submit_by_date: e.target.value || null })}
            style={inputStyle}
          />
        </Field>
        <Field
          label="Lead time (weeks)"
          autoFromIris={autoSrc(draft, 'lead_time_weeks')}
        >
          <input
            type="number"
            min={0}
            step={0.5}
            value={draft.lead_time_weeks ?? ''}
            onChange={(e) => onPatch({ lead_time_weeks: e.target.value === '' ? null : Number(e.target.value) })}
            style={inputStyle}
          />
        </Field>
      </Row>
    </Section>

    <Section
      title="People"
      filledCount={(draft.responsible_sub_id ? 1 : 0)}
    >
      <Row>
        <Field label="Responsible sub" autoFromIris={autoSrc(draft, 'responsible_sub_id')}>
          <input
            type="text"
            value={draft.responsible_sub_id ?? ''}
            onChange={(e) => onPatch({ responsible_sub_id: e.target.value || null })}
            placeholder="Pick org. Phase 6 typeahead"
            style={inputStyle}
            aria-label="Responsible sub (placeholder picker)"
          />
        </Field>
      </Row>
    </Section>

    <Section title="Privacy" filledCount={draft.is_private ? 1 : 0}>
      <Field label="Visibility">
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 10px',
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            backgroundColor: '#fff',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={draft.is_private}
            onChange={(e) => onPatch({ is_private: e.target.checked })}
          />
          Private (project-managers + admins only)
        </label>
      </Field>
    </Section>

    <Section
      title="Numbering"
      filledCount={draft.csi_section ? 1 : 0}
    >
      {draft.csi_section ? (
        <p style={{ fontSize: 12, color: C.ink2, margin: 0 }}>
          Auto-numbering: <code style={{ fontFamily: FONT, fontWeight: 600 }}>
            {draft.csi_section}-{'{seq}'}
          </code>
          {' '}(next sequence is computed at submit time).
        </p>
      ) : (
        <p style={{ fontSize: 12, color: C.ink3, margin: 0 }}>
          Set a CSI section to enable auto-numbering. Manual override is reserved for admins.
        </p>
      )}
    </Section>
  </div>
)

// ── Section shell ──────────────────────────────────────────────────────────

interface SectionProps {
  title: string
  defaultOpen?: boolean
  filledCount: number
  children: React.ReactNode
}

const Section: React.FC<SectionProps> = ({ title, defaultOpen = false, filledCount, children }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      style={{
        border: `1px solid ${C.borderSubtle}`,
        borderRadius: 6,
        backgroundColor: '#fff',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          border: 'none',
          backgroundColor: open ? C.surfaceInset : 'transparent',
          cursor: 'pointer',
          fontFamily: FONT,
          fontSize: 12,
          fontWeight: 600,
          color: C.ink,
          textAlign: 'left',
          borderRadius: 6,
        }}
      >
        {open ? <ChevronDown size={14} color={C.ink2} /> : <ChevronRight size={14} color={C.ink2} />}
        {title}
        {filledCount > 0 && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              color: C.active,
              fontWeight: 600,
              padding: '1px 6px',
              backgroundColor: 'rgba(45, 138, 110, 0.10)',
              borderRadius: 3,
            }}
          >
            {filledCount} filled
          </span>
        )}
      </button>
      {open && (
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.borderSubtle}` }}>
          {children}
        </div>
      )}
    </div>
  )
}

const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 10,
      marginBottom: 10,
    }}
  >
    {children}
  </div>
)

export default FullTierProgressive
