// Phase 5. Quick tier fields for the Unified Create Modal.
//
// Three fields, all required for the 80% path:
//   1. Title
//   2. Ball-in-court (single user picker. typeahead)
//   3. Due date (default 7 days from today; user overrides)
//
// Provenance-aware: when Iris pre-filled a value (e.g. from voice), the
// label gets a small "auto" badge that disappears as soon as the user
// edits the field (manual override clears the pre-fill flag).

import React from 'react'
import type { SubmittalDraft } from '../../../services/iris/submittalDraft'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  brandOrange: '#F47820',
  critical: '#C93B3B',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface QuickTierFieldsProps {
  draft: SubmittalDraft
  projectId: string
  onPatch: (patch: Partial<SubmittalDraft>) => void
  titleRef: React.RefObject<HTMLInputElement | null>
  showValidation: boolean
}

export const QuickTierFields: React.FC<QuickTierFieldsProps> = ({
  draft,
  onPatch,
  titleRef,
  showValidation,
}) => {
  const titleMissing = showValidation && !draft.title.trim()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field
        label="Title"
        required
        autoFromIris={draft.provenance.title && draft.provenance.title !== 'manual' ? draft.provenance.title : undefined}
        error={titleMissing ? 'Title is required.' : null}
      >
        <input
          ref={titleRef}
          type="text"
          value={draft.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder="e.g. Storefront frame system, ACME Glass cut sheets"
          style={{
            ...inputStyle,
            borderColor: titleMissing ? C.critical : C.border,
          }}
          aria-invalid={titleMissing}
        />
      </Field>

      <Field
        label="Ball in court"
        autoFromIris={draft.provenance.ball_in_court_user_id
          && draft.provenance.ball_in_court_user_id !== 'manual'
            ? draft.provenance.ball_in_court_user_id : undefined}
      >
        {/* Phase 5 ships a placeholder picker. typeahead over project_members
         *  is wired by the existing PeoplePicker component in Phase 6 detail
         *  page work. For now, accept a freeform user-id string and let the
         *  full tier provide the searchable picker. */}
        <input
          type="text"
          value={draft.ball_in_court_user_id ?? ''}
          onChange={(e) => onPatch({ ball_in_court_user_id: e.target.value || null })}
          placeholder="Pick a person. coming Phase 6 (typeahead)"
          style={inputStyle}
          aria-label="Ball in court (placeholder picker)"
        />
      </Field>

      <Field
        label="Due date"
        autoFromIris={draft.provenance.due_date && draft.provenance.due_date !== 'manual' ? draft.provenance.due_date : undefined}
        hint="Defaults to 7 days from today. Override anytime."
      >
        <input
          type="date"
          value={draft.due_date ?? ''}
          onChange={(e) => onPatch({ due_date: e.target.value || null })}
          style={{ ...inputStyle, fontFamily: FONT }}
        />
      </Field>
    </div>
  )
}

// ── Field shell ────────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  required?: boolean
  /** When truthy, renders an "auto" badge next to the label. */
  autoFromIris?: string | undefined
  /** Inline help text below the input. */
  hint?: React.ReactNode
  /** Inline error below the input. */
  error?: string | null
  children: React.ReactNode
}

export const Field: React.FC<FieldProps> = ({
  label,
  required,
  autoFromIris,
  hint,
  error,
  children,
}) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        color: C.ink2,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
      }}
    >
      {label}
      {required && <span style={{ color: C.critical }}>*</span>}
      {autoFromIris && (
        <span
          title={`Iris pre-filled this from ${autoFromIris}. Editing replaces the auto value.`}
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: C.brandOrange,
            backgroundColor: 'rgba(244, 120, 32, 0.10)',
            padding: '1px 5px',
            borderRadius: 3,
            letterSpacing: '0.05em',
          }}
        >
          ✨ AUTO
        </span>
      )}
    </span>
    {children}
    {error && (
      <span style={{ fontSize: 11, color: C.critical, fontWeight: 500 }}>{error}</span>
    )}
    {!error && hint && (
      <span style={{ fontSize: 11, color: C.ink3 }}>{hint}</span>
    )}
  </label>
)

export const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  fontSize: 13,
  fontFamily: FONT,
  color: C.ink,
  backgroundColor: '#fff',
  outline: 'none',
}

export default QuickTierFields
