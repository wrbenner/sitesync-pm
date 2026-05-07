// ── RFIInlineMetadata ────────────────────────────────────────────────
// Editable RFI metadata sidebar block. Implements P0 item #7 from
// RFI_MODULE_BUILD_SPEC: subject, ball-in-court, due date, priority,
// drawing ref, spec section all directly inline-editable on the detail
// page.
//
// Design choice: a separate sidebar panel rather than inline-editable
// chips on the existing summary row. The chip row reads as a glance
// strip; edit affordance there clutters it. This panel is the explicit
// "edit metadata" surface — everything is a tappable field with an
// edit pencil cursor.
//
// All edits go through useUpdateRFI which already invalidates the RFI
// query AND entity_history (P0 item #3). Permission gating lives inside
// InlineEditField via the `permission` prop.

import React from 'react'
import { useUpdateRFI } from '../../hooks/mutations/rfis'
import { useProfileNames, displayName } from '../../hooks/queries/profiles'
import { InlineEditField } from './InlineEditField'
import { colors, spacing, typography } from '../../styles/theme'
import type { RFI } from '../../types/database'

interface RFIInlineMetadataProps {
  rfi: RFI
  /** All project members — feeds the ball-in-court selector. */
  memberOptions?: { value: string; label: string }[]
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

export const RFIInlineMetadata: React.FC<RFIInlineMetadataProps> = ({
  rfi, memberOptions = [],
}) => {
  const updateRFI = useUpdateRFI()
  const { data: profileMap } = useProfileNames(
    [rfi.ball_in_court, rfi.assigned_to, rfi.created_by].filter(Boolean) as string[],
  )

  // void-cast so InlineEditField's `Promise<void> | void` contract is
  // satisfied — we don't need the mutation result downstream.
  const save = async (updates: Record<string, unknown>): Promise<void> => {
    await updateRFI.mutateAsync({ id: rfi.id, projectId: rfi.project_id, updates })
  }

  return (
    <section
      aria-label="RFI metadata. Inline editable."
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr',
        rowGap: spacing['3'],
        columnGap: spacing['3'],
        padding: spacing['4'],
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: 12,
      }}
    >
      <Label>Subject</Label>
      <InlineEditField
        value={rfi.title ?? ''}
        onSave={(v) => save({ title: v })}
        label="Subject"
        type="text"
        permission="rfis.edit"
        maxLength={200}
        placeholder="Add a subject…"
      />

      <Label>Ball in court</Label>
      {/* When the parent has loaded the project's member list we render a
          select; otherwise a text field accepts a UUID or pasted email.
          The format() resolver on read-state always shows a name when
          we can find one, never the raw UUID. */}
      <InlineEditField
        value={rfi.ball_in_court ?? ''}
        onSave={(v) => save({ ball_in_court: v || null })}
        label="Ball in court"
        type={memberOptions.length > 0 ? 'select' : 'text'}
        options={memberOptions}
        permission="rfis.edit"
        placeholder="Unassigned"
        format={(v) => displayName(profileMap, v, v)}
      />

      <Label>Due date</Label>
      <InlineEditField
        value={rfi.due_date ?? ''}
        onSave={(v) => save({ due_date: v || null })}
        label="Due date"
        type="date"
        permission="rfis.edit"
        placeholder="No due date"
      />

      <Label>Priority</Label>
      <InlineEditField
        value={rfi.priority ?? 'medium'}
        onSave={(v) => save({ priority: v })}
        label="Priority"
        type="select"
        options={PRIORITY_OPTIONS}
        permission="rfis.edit"
      />

      <Label>Drawing ref</Label>
      <InlineEditField
        value={rfi.drawing_reference ?? ''}
        onSave={(v) => save({ drawing_reference: v || null })}
        label="Drawing reference"
        type="text"
        permission="rfis.edit"
        maxLength={50}
        placeholder="e.g. A-201"
      />

      <Label>Spec section</Label>
      <InlineEditField
        value={rfi.spec_section ?? ''}
        onSave={(v) => save({ spec_section: v || null })}
        label="Spec section"
        type="text"
        permission="rfis.edit"
        maxLength={50}
        placeholder="e.g. 03 30 00"
      />
    </section>
  )
}

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      fontSize: typography.fontSize.caption,
      fontWeight: typography.fontWeight.semibold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      paddingTop: 6,
    }}
  >
    {children}
  </span>
)

export default RFIInlineMetadata
