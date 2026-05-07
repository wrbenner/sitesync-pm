// ── RFIInlineMetadata ────────────────────────────────────────────────
// Dense 4-column metadata grid for the RFI detail page.
//
// May-7 final-gap audit item #1 — the biggest "Brad notices in 3 minutes"
// win. Procore renders ~20 metadata fields in a 4-column grid; we used
// to render 6 in a 2-column grid. The detail page now reads as an
// enterprise record, not a chat thread.
//
// Fields surfaced (16, all live on the rfis row): Number (admin-editable
// override), Due Date, Ball-in-Court (UserName render), Status (read-only
// pill), Received From (assigned_to), Created By, Date Initiated, Closed
// Date, Specification, Drawing Reference, Priority, Private, Schedule
// Impact (Yes/No/TBD + days), Cost Impact (Yes/No/TBD + $), Reference,
// Reopen Reason. Procore-only fields (Responsible Contractor / Cost Code
// / Location / RFI Stage) are skipped — we don't track them yet, and a
// fake "—" cell is dishonest.
//
// All edits flow through useUpdateRFI (audit-aware via the RFI mutation
// trigger) — no new audit gaps. Inline-edit cells reuse the existing
// InlineEditField primitive.

import React from 'react'
import { useUpdateRFI } from '../../hooks/mutations/rfis'
import { useProfileNames, displayName } from '../../hooks/queries/profiles'
import { usePermissions } from '../../hooks/usePermissions'
import { InlineEditField } from './InlineEditField'
import { UserName } from '../UserName'
import { fromCents, dollarsToCents } from '../../types/money'
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

const IMPACT_STATUS_OPTIONS = [
  { value: '', label: '—' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'tbd', label: 'TBD' },
]

const formatDate = (d: string | null | undefined): string => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatNumber = (n: number | null | undefined): string =>
  n != null ? `RFI-${String(n).padStart(3, '0')}` : '—'

const Cell: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
    <span
      style={{
        fontSize: 10,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
    >
      {label}
    </span>
    <div style={{ fontSize: 13, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, minHeight: 22 }}>
      {children}
    </div>
  </div>
)

const ReadOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontSize: 13, color: colors.textSecondary }}>{children}</span>
)

export const RFIInlineMetadata: React.FC<RFIInlineMetadataProps> = ({
  rfi,
  memberOptions = [],
}) => {
  const updateRFI = useUpdateRFI()
  const { hasPermission } = usePermissions()
  const canAdminEdit = hasPermission('rfis.admin_edit')
  const { data: profileMap } = useProfileNames(
    [rfi.ball_in_court, rfi.assigned_to, rfi.created_by].filter(Boolean) as string[],
  )

  const save = async (updates: Record<string, unknown>): Promise<void> => {
    await updateRFI.mutateAsync({ id: rfi.id, projectId: rfi.project_id, updates })
  }

  const r = rfi as unknown as Record<string, unknown>
  const costStatus = ((r.cost_impact_status as string | null) ?? '') as string
  const schedStatus = ((r.schedule_impact_status as string | null) ?? '') as string
  const reopenReason = (r.reopen_reason as string | null) ?? null

  return (
    <section
      aria-label="RFI metadata"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        rowGap: spacing['3'],
        columnGap: spacing['4'],
        padding: spacing['4'],
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: 12,
      }}
    >
      {/* ── Row 1 ──────────────────────────────── */}
      <Cell label="Number">
        {canAdminEdit ? (
          <InlineEditField
            value={String(rfi.number ?? '')}
            onSave={(v) => save({ number: v ? Number.parseInt(v, 10) : null })}
            label="RFI Number (admin override)"
            type="text"
            permission="rfis.admin_edit"
            format={() => formatNumber(rfi.number)}
            placeholder="auto"
          />
        ) : (
          <ReadOnly>{formatNumber(rfi.number)}</ReadOnly>
        )}
      </Cell>
      <Cell label="Due Date">
        <InlineEditField
          value={rfi.due_date ?? ''}
          onSave={(v) => save({ due_date: v || null })}
          label="Due Date"
          type="date"
          permission="rfis.edit"
          format={() => formatDate(rfi.due_date)}
          placeholder="No due date"
        />
      </Cell>
      <Cell label="Ball in Court">
        <InlineEditField
          value={rfi.ball_in_court ?? ''}
          onSave={(v) => save({ ball_in_court: v || null })}
          label="Ball in court"
          type={memberOptions.length > 0 ? 'select' : 'text'}
          options={memberOptions}
          permission="rfis.edit"
          placeholder="Unassigned"
          format={(v) => (v ? displayName(profileMap, String(v), String(v)) : 'Unassigned')}
        />
      </Cell>
      <Cell label="Status">
        <ReadOnly>{rfi.status ?? '—'}</ReadOnly>
      </Cell>

      {/* ── Row 2 ──────────────────────────────── */}
      <Cell label="Received From">
        {(() => {
          const receivedFrom =
            ((r.received_from_user_id as string | null) ?? null) ?? rfi.assigned_to
          return receivedFrom ? (
            <ReadOnly>
              <UserName userId={receivedFrom} fallback="—" />
            </ReadOnly>
          ) : (
            <ReadOnly>—</ReadOnly>
          )
        })()}
      </Cell>
      <Cell label="Created By">
        {rfi.created_by ? (
          <ReadOnly>
            <UserName userId={rfi.created_by} fallback="—" />
          </ReadOnly>
        ) : (
          <ReadOnly>—</ReadOnly>
        )}
      </Cell>
      <Cell label="Date Initiated">
        <ReadOnly>{formatDate(rfi.created_at)}</ReadOnly>
      </Cell>
      <Cell label="Closed Date">
        <ReadOnly>{formatDate(rfi.closed_date)}</ReadOnly>
      </Cell>

      {/* ── Row 3 ──────────────────────────────── */}
      <Cell label="Specification">
        <InlineEditField
          value={rfi.spec_section ?? ''}
          onSave={(v) => save({ spec_section: v || null })}
          label="Spec section"
          type="text"
          permission="rfis.edit"
          maxLength={50}
          placeholder="e.g. 03 30 00"
        />
      </Cell>
      <Cell label="Drawing Reference">
        <InlineEditField
          value={rfi.drawing_reference ?? ''}
          onSave={(v) => save({ drawing_reference: v || null })}
          label="Drawing reference"
          type="text"
          permission="rfis.edit"
          maxLength={50}
          placeholder="e.g. A-201"
        />
      </Cell>
      <Cell label="Priority">
        <InlineEditField
          value={rfi.priority ?? 'medium'}
          onSave={(v) => save({ priority: v })}
          label="Priority"
          type="select"
          options={PRIORITY_OPTIONS}
          permission="rfis.edit"
        />
      </Cell>
      <Cell label="Reference">
        <InlineEditField
          value={(r.reference as string | null) ?? ''}
          onSave={(v) => save({ reference: v || null })}
          label="Reference"
          type="text"
          permission="rfis.edit"
          maxLength={120}
          placeholder="—"
        />
      </Cell>

      {/* ── Row 4: Impact pair (status + days/$) ──────────────────────── */}
      <Cell label="Schedule Impact">
        <InlineEditField
          value={schedStatus}
          onSave={(v) => save({ schedule_impact_status: v || null })}
          label="Schedule impact status"
          type="select"
          options={IMPACT_STATUS_OPTIONS}
          permission="rfis.edit"
        />
      </Cell>
      <Cell label={schedStatus === 'no' ? 'Schedule Days (n/a)' : 'Schedule Days'}>
        {schedStatus === 'no' ? (
          <ReadOnly>—</ReadOnly>
        ) : (
          <InlineEditField
            value={rfi.schedule_days_impact != null ? String(rfi.schedule_days_impact) : ''}
            onSave={(v) =>
              save({ schedule_days_impact: v.trim() ? Number.parseInt(v, 10) : null })
            }
            label="Schedule days"
            type="text"
            permission="rfis.edit"
            placeholder="0"
          />
        )}
      </Cell>
      <Cell label="Cost Impact">
        <InlineEditField
          value={costStatus}
          onSave={(v) => save({ cost_impact_status: v || null })}
          label="Cost impact status"
          type="select"
          options={IMPACT_STATUS_OPTIONS}
          permission="rfis.edit"
        />
      </Cell>
      <Cell label={costStatus === 'no' ? 'Cost ($) (n/a)' : 'Cost ($)'}>
        {costStatus === 'no' ? (
          <ReadOnly>—</ReadOnly>
        ) : (
          <InlineEditField
            value={
              rfi.cost_impact_cents != null
                ? fromCents(Number(rfi.cost_impact_cents) as never).toFixed(2)
                : ''
            }
            onSave={(v) =>
              save({
                cost_impact_cents: v.trim() ? dollarsToCents(Number.parseFloat(v)) : null,
              })
            }
            label="Cost amount"
            type="text"
            permission="rfis.edit"
            placeholder="0.00"
          />
        )}
      </Cell>

      {/* ── Row 5 ──────────────────────────────── */}
      <Cell label="Private">
        <InlineEditField
          value={rfi.is_private ? 'yes' : 'no'}
          onSave={(v) => save({ is_private: v === 'yes' })}
          label="Private RFI"
          type="select"
          options={[
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes' },
          ]}
          permission="rfis.edit"
        />
      </Cell>
      <Cell label="Reopen Reason">
        {reopenReason ? <ReadOnly>{reopenReason}</ReadOnly> : <ReadOnly>—</ReadOnly>}
      </Cell>
      {/* Info-density PR #4 — fill the prior 2 filler cells with the new
          Procore-parity inputs (cost code + RFI stage). Both inline-editable
          so PMs can backfill old RFIs without leaving the detail page. */}
      <Cell label="Cost Code">
        <InlineEditField
          value={(r.cost_code as string | null) ?? ''}
          onSave={(v) => save({ cost_code: v || null })}
          label="Cost code"
          type="text"
          permission="rfis.edit"
          maxLength={32}
          placeholder="e.g. 03-30-00"
        />
      </Cell>
      <Cell label="RFI Stage">
        <InlineEditField
          value={(r.rfi_stage as string | null) ?? ''}
          onSave={(v) => save({ rfi_stage: v || null })}
          label="RFI stage"
          type="text"
          permission="rfis.edit"
          maxLength={32}
          placeholder="Construction"
        />
      </Cell>
    </section>
  )
}

export default RFIInlineMetadata
