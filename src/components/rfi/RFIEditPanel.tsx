// ── RFIEditPanel ─────────────────────────────────────────────────────────
// Per-row Edit slide-in panel for the full RFI editor.
//
// Drives:    P1a deliverable #2 from
//            docs/audits/RFI_EDIT_MANIPULATE_AUDIT_2026-05-06.md.
//
// Bugatti choices baked in (no patches):
//   • All RFI fields are editable in one place. The detail-page InlineEdit
//     surface stays for quick metadata tweaks; this panel is for "I'm
//     opening this row to actually update it."
//   • One Save = one transaction. We gather Subject, Question, Ball-in-
//     Court, Due, Priority, Drawing, Spec, Schedule Impact, Cost Impact,
//     Reference, Private flag — all into a single useUpdateRFI call.
//     Distribution adds and Watcher adds fan out through their own
//     dedicated mutations after the RFI patch lands (kept separate so a
//     failure in one doesn't poison the others; per-entity audit_log row).
//   • Cancel asks before discarding when the form is dirty.
//   • Money fields go through src/types/money.ts (dollarsToCents on save).
//   • PermissionGate `rfis.edit` wraps the Save bar — read-only users see
//     the form but can't submit it.
//   • Question is a multi-line textarea today; rich-text TipTap upgrade
//     is queued for P1b (the package is already in the tree). The schema
//     column is `question TEXT` so a Markdown / HTML body slots in
//     without a migration when P1b lands.
//
// Required props: `rfiId`, `projectId`, `open`, `onClose`. The panel
// fetches its own RFI by id (via the queries layer).

import React, { useEffect, useMemo, useState } from 'react'
import { Save, X, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { DetailPanel } from '../Primitives'
import { PermissionGate } from '../auth/PermissionGate'
import { UserChipEditor, type UserChipOption } from './UserChipEditor'
import { RFIRichTextEditor } from './RFIRichTextEditor'
import { RFIAttachmentManager } from './RFIAttachmentManager'
import { RFIAssigneePicker } from './RFIAssigneePicker'
import { RFIDistributionStatusList } from './RFIDistributionStatusList'
import { sendRFIOutboundEmailFanout } from '../../lib/email/rfiOutbound'
import { useRFI } from '../../hooks/queries'
import { useUpdateRFI } from '../../hooks/mutations'
import { useProjectDirectory } from '../../hooks/queries/useProjectDirectory'
import { useRFIWatchers, useAddRFIWatcher } from '../../hooks/queries/useRFIWatchers'
import { useRFIDistributions } from '../../hooks/queries/useRFIDistributions'
import { dollarsToCents, fromCents } from '../../types/money'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { entityLabel } from '../../lib/entityLabel'

interface RFIEditPanelProps {
  open: boolean
  onClose: () => void
  rfiId: string | null
  projectId: string
}

type ImpactStatus = '' | 'yes' | 'no' | 'tbd'

interface EditDraft {
  title: string
  question: string
  ball_in_court: string
  due_date: string
  priority: string
  drawing_reference: string
  spec_section: string
  schedule_impact_status: ImpactStatus
  schedule_days_impact: string
  cost_impact_status: ImpactStatus
  cost_impact_dollars: string
  reference: string
  is_private: boolean
}

const EMPTY_DRAFT: EditDraft = {
  title: '',
  question: '',
  ball_in_court: '',
  due_date: '',
  priority: 'medium',
  drawing_reference: '',
  spec_section: '',
  schedule_impact_status: '',
  schedule_days_impact: '',
  cost_impact_status: '',
  cost_impact_dollars: '',
  reference: '',
  is_private: false,
}

export const RFIEditPanel: React.FC<RFIEditPanelProps> = ({ open, onClose, rfiId, projectId }) => {
  const { data: rfi } = useRFI(rfiId ?? undefined)
  const { data: directory } = useProjectDirectory(projectId)
  const { data: watcherIds = [] } = useRFIWatchers(rfiId ?? undefined)
  const { data: distributions = [] } = useRFIDistributions(rfiId ?? undefined)
  const updateRFI = useUpdateRFI()
  const addWatcher = useAddRFIWatcher()
  // P1c: distribution sends now flow through sendRFIOutboundEmailFanout.
  // The legacy useAddRFIDistribution hook only inserted a row without
  // sending — superseded.

  const [draft, setDraft] = useState<EditDraft>(EMPTY_DRAFT)
  const [pickedWatchers, setPickedWatchers] = useState<string[]>([])
  const [pickedRecipients, setPickedRecipients] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Hydrate draft when the panel opens or the loaded RFI changes
  useEffect(() => {
    if (!open || !rfi) return
    const r = rfi as unknown as Record<string, unknown>
    setDraft({
      title: (r.title as string | null) ?? '',
      question: ((r.question as string | null) ?? (r.description as string | null)) ?? '',
      ball_in_court: typeof r.ball_in_court === 'string' ? r.ball_in_court : '',
      due_date: (r.due_date as string | null) ?? '',
      priority: (r.priority as string | null) ?? 'medium',
      drawing_reference: (r.drawing_reference as string | null) ?? '',
      spec_section: (r.spec_section as string | null) ?? '',
      schedule_impact_status: ((r.schedule_impact_status as string | null) ?? '') as ImpactStatus,
      schedule_days_impact:
        r.schedule_days_impact != null ? String(r.schedule_days_impact) : '',
      cost_impact_status: ((r.cost_impact_status as string | null) ?? '') as ImpactStatus,
      cost_impact_dollars:
        r.cost_impact_cents != null
          ? fromCents(Number(r.cost_impact_cents) as never).toFixed(2)
          : '',
      reference: (r.reference as string | null) ?? '',
      is_private: Boolean(r.is_private),
    })
  }, [open, rfi])

  useEffect(() => {
    if (!open) return
    setPickedWatchers(watcherIds)
  }, [open, watcherIds])

  useEffect(() => {
    if (!open) return
    // Distributions are append-only — the chip editor seeds with the
    // current set; only newly-added emails get persisted on Save.
    setPickedRecipients(distributions.map((d) => d.recipient_email))
  }, [open, distributions])

  const memberOptions: UserChipOption[] = useMemo(
    () =>
      (directory?.members ?? []).map((m) => ({
        value: m.value,
        label: m.label,
        sublabel: m.sublabel,
      })),
    [directory],
  )

  // Distribution typeahead — emails plus member email aliases
  const distributionOptions: UserChipOption[] = useMemo(() => {
    const fromMembers = (directory?.members ?? [])
      .filter((m) => m.sublabel)
      .map((m) => ({
        value: m.sublabel!,
        label: m.label,
        sublabel: m.sublabel,
      }))
    return fromMembers
  }, [directory])

  const dirty = (() => {
    if (!rfi) return false
    const r = rfi as unknown as Record<string, unknown>
    return (
      draft.title !== ((r.title as string | null) ?? '') ||
      draft.question !== (((r.question as string | null) ?? (r.description as string | null)) ?? '') ||
      draft.ball_in_court !== (typeof r.ball_in_court === 'string' ? r.ball_in_court : '') ||
      draft.due_date !== ((r.due_date as string | null) ?? '') ||
      draft.priority !== ((r.priority as string | null) ?? 'medium') ||
      draft.drawing_reference !== ((r.drawing_reference as string | null) ?? '') ||
      draft.spec_section !== ((r.spec_section as string | null) ?? '') ||
      draft.schedule_impact_status !== ((r.schedule_impact_status as string | null) ?? '') ||
      draft.schedule_days_impact !== (r.schedule_days_impact != null ? String(r.schedule_days_impact) : '') ||
      draft.cost_impact_status !== ((r.cost_impact_status as string | null) ?? '') ||
      draft.cost_impact_dollars !==
        (r.cost_impact_cents != null
          ? fromCents(Number(r.cost_impact_cents) as never).toFixed(2)
          : '') ||
      draft.reference !== ((r.reference as string | null) ?? '') ||
      draft.is_private !== Boolean(r.is_private) ||
      // Watcher / distribution add-only diffs
      pickedWatchers.length !== watcherIds.length ||
      pickedWatchers.some((w) => !watcherIds.includes(w)) ||
      pickedRecipients.length !== distributions.length ||
      pickedRecipients.some((e) => !distributions.find((d) => d.recipient_email === e))
    )
  })()

  const handleClose = () => {
    if (dirty && !window.confirm('Discard your unsaved edits?')) return
    onClose()
  }

  const handleSave = async () => {
    if (!rfiId) return
    setSaving(true)
    try {
      // 1. Patch the RFI itself with the field updates (single transaction;
      //    one audit_log row per the useUpdateRFI hook).
      const updates: Record<string, unknown> = {
        title: draft.title.trim(),
        question: draft.question.trim() || null,
        ball_in_court: draft.ball_in_court.trim() || null,
        due_date: draft.due_date || null,
        priority: draft.priority,
        drawing_reference: draft.drawing_reference.trim() || null,
        spec_section: draft.spec_section.trim() || null,
        schedule_impact_status: draft.schedule_impact_status || null,
        schedule_days_impact: draft.schedule_days_impact.trim()
          ? Number.parseInt(draft.schedule_days_impact, 10)
          : null,
        cost_impact_status: draft.cost_impact_status || null,
        cost_impact_cents: draft.cost_impact_dollars.trim()
          ? dollarsToCents(Number.parseFloat(draft.cost_impact_dollars))
          : null,
        reference: draft.reference.trim() || null,
        is_private: draft.is_private,
      }
      await updateRFI.mutateAsync({ id: rfiId, updates, projectId })

      // 2. Add new watchers (skip ones already present). Each fans out
      //    through its own audit-aware mutation — failures in one don't
      //    block the others, but they DO surface as warning toasts.
      const newWatchers = pickedWatchers.filter((w) => !watcherIds.includes(w))
      if (newWatchers.length > 0) {
        const results = await Promise.allSettled(
          newWatchers.map((userId) => addWatcher.mutateAsync({ rfiId, userId, projectId })),
        )
        const failed = results.filter((r) => r.status === 'rejected').length
        if (failed > 0) toast.warning(`${failed} watcher${failed > 1 ? 's' : ''} could not be added`)
      }

      // 3. Add new distribution recipients (append-only — existing rows
      //    are preserved by definition). P1c — each new recipient now
      //    actually receives an email through the send-email pipeline.
      //    The helper handles the durable rfi_distributions row, the
      //    Message-ID stamping, the outbound_email_log link for
      //    In-Reply-To threading, and the per-row audit log.
      const existingEmails = new Set(distributions.map((d) => d.recipient_email))
      const newRecipients = pickedRecipients.filter((e) => !existingEmails.has(e))
      if (newRecipients.length > 0) {
        const detailUrl = `${window.location.origin}/rfis/${rfiId}`
        const r = rfi as Record<string, unknown> | undefined
        const fanout = await sendRFIOutboundEmailFanout(
          {
            rfiId,
            projectId,
            rfiNumber: (r?.number as number | undefined) ?? null,
            rfiTitle: ((r?.title as string | undefined) ?? draft.title) || 'RFI',
            rfiQuestion:
              (r?.question as string | undefined) ?? (r?.description as string | undefined) ?? draft.question,
            projectName: null,
            detailUrl,
            senderUserId: (r?.created_by as string | undefined) ?? null,
            message: null,
          },
          newRecipients.map((email) => ({ email })),
        )
        if (fanout.failed > 0) {
          toast.warning(`${fanout.failed} distribution${fanout.failed > 1 ? 's' : ''} could not be sent`)
        }
      }

      toast.success(`${entityLabel('rfi')} updated`)
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      toast.error(`Could not save: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  const titleStr = rfi
    ? `Edit ${entityLabel('rfi')}-${String((rfi as { number?: number }).number ?? '').padStart(3, '0')}`
    : `Edit ${entityLabel('rfi')}`

  const setField = <K extends keyof EditDraft>(key: K, value: EditDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  return (
    <DetailPanel open={open} onClose={handleClose} title={titleStr} width="640px">
      {!rfi ? (
        <div style={{ padding: spacing.xl, color: colors.textTertiary }}>Loading…</div>
      ) : (
        <div style={{ padding: spacing.xl, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
          <FieldRow label="Subject" required>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setField('title', e.target.value)}
              maxLength={200}
              style={inputStyle}
              aria-label="Subject"
            />
          </FieldRow>

          <FieldRow label="Question" hint="Rich-text — paste screenshots, format with lists, links.">
            <RFIRichTextEditor
              value={draft.question}
              onChange={(html) => setField('question', html)}
              placeholder="What needs to be clarified?"
              ariaLabel="Question"
              minHeight={140}
            />
          </FieldRow>

          <FieldGrid>
            <FieldRow label="Ball in Court">
              <input
                type="text"
                value={draft.ball_in_court}
                onChange={(e) => setField('ball_in_court', e.target.value)}
                style={inputStyle}
                aria-label="Ball in Court"
              />
            </FieldRow>
            <FieldRow label="Due Date">
              <input
                type="date"
                value={draft.due_date}
                onChange={(e) => setField('due_date', e.target.value)}
                style={inputStyle}
                aria-label="Due Date"
              />
            </FieldRow>
            <FieldRow label="Priority">
              <select
                value={draft.priority}
                onChange={(e) => setField('priority', e.target.value)}
                style={inputStyle}
                aria-label="Priority"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </FieldRow>
            <FieldRow label="Reference">
              <input
                type="text"
                value={draft.reference}
                onChange={(e) => setField('reference', e.target.value)}
                style={inputStyle}
                aria-label="Reference"
                placeholder="External reference (e.g. submittal #, drawing rev)"
              />
            </FieldRow>
            <FieldRow label="Drawing">
              <input
                type="text"
                value={draft.drawing_reference}
                onChange={(e) => setField('drawing_reference', e.target.value)}
                style={inputStyle}
                aria-label="Drawing"
                placeholder="A-101"
              />
            </FieldRow>
            <FieldRow label="Spec Section">
              <input
                type="text"
                value={draft.spec_section}
                onChange={(e) => setField('spec_section', e.target.value)}
                style={inputStyle}
                aria-label="Spec Section"
                placeholder="09 21 16"
              />
            </FieldRow>
            <FieldRow label="Schedule Impact" hint="Yes/No/TBD wraps the day count, matching Procore's enum.">
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={draft.schedule_impact_status}
                  onChange={(e) => setField('schedule_impact_status', e.target.value as ImpactStatus)}
                  style={{ ...inputStyle, flex: '0 0 100px' }}
                  aria-label="Schedule Impact status"
                >
                  <option value="">—</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="tbd">TBD</option>
                </select>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={draft.schedule_days_impact}
                  onChange={(e) => setField('schedule_days_impact', e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                  aria-label="Schedule Impact (days)"
                  placeholder="days"
                  disabled={draft.schedule_impact_status === 'no'}
                />
              </div>
            </FieldRow>
            <FieldRow label="Cost Impact" hint="Yes/No/TBD wraps the dollar amount.">
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={draft.cost_impact_status}
                  onChange={(e) => setField('cost_impact_status', e.target.value as ImpactStatus)}
                  style={{ ...inputStyle, flex: '0 0 100px' }}
                  aria-label="Cost Impact status"
                >
                  <option value="">—</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="tbd">TBD</option>
                </select>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={draft.cost_impact_dollars}
                  onChange={(e) => setField('cost_impact_dollars', e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                  aria-label="Cost Impact ($)"
                  placeholder="0.00"
                  disabled={draft.cost_impact_status === 'no'}
                />
              </div>
            </FieldRow>
          </FieldGrid>

          <FieldRow label="Assignees" hint="Each gets a checkbox; ball-in-court tracks the first unresponded.">
            {rfiId && <RFIAssigneePicker rfiId={rfiId} projectId={projectId} />}
          </FieldRow>

          <FieldRow label="Watchers" hint="Watchers receive every status change.">
            <UserChipEditor
              value={pickedWatchers}
              onChange={setPickedWatchers}
              options={memberOptions}
              placeholder="Search project members…"
              ariaLabel="Watchers"
            />
          </FieldRow>

          <FieldRow label="Distribution" hint="Type an email or pick a role group.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <UserChipEditor
                value={pickedRecipients}
                onChange={setPickedRecipients}
                options={distributionOptions}
                roleGroups={directory?.roleGroups}
                placeholder="email@example.com"
                ariaLabel="Distribution"
                onFreeText={(raw) => {
                  const trimmed = raw.trim()
                  if (!trimmed.includes('@')) return null
                  return { value: trimmed, label: trimmed }
                }}
              />
              {/* P1c — delivery status dots from Resend webhook events. */}
              {rfiId && <RFIDistributionStatusList rfiId={rfiId} />}
            </div>
          </FieldRow>

          <FieldRow label="Attachments" hint="Drag-drop, paste, or click to upload. Mark Official with the star.">
            {rfiId && (
              <RFIAttachmentManager rfiId={rfiId} projectId={projectId} responseId={null} />
            )}
          </FieldRow>

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing['2'],
              fontSize: typography.fontSize.sm,
              color: colors.textPrimary,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={draft.is_private}
              onChange={(e) => setField('is_private', e.target.checked)}
              aria-label="Private"
              style={{ width: 14, height: 14, cursor: 'pointer' }}
            />
            <span>Private — only owner / admin / RFI manager can read</span>
          </label>

          {/* Required-field legend (May-7 audit item D3 / Procore parity).
              Procore puts a bold "* required fields" line at the bottom of
              its edit form. Subject is the only currently-required field
              on RFIs; flagging it explicitly removes ambiguity. */}
          <div
            style={{
              fontSize: 11,
              color: colors.textTertiary,
              paddingTop: spacing['2'],
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ color: colors.statusCritical, fontWeight: 700 }}>*</span>
            <span>required fields — Subject must be filled before save</span>
          </div>

          {/* Save bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: spacing['2'],
              paddingTop: spacing.lg,
              borderTop: `1px solid ${colors.borderSubtle}`,
            }}
          >
            {dirty && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  marginRight: 'auto',
                  fontSize: typography.fontSize.caption,
                  color: colors.statusPending,
                }}
              >
                <AlertTriangle size={12} />
                Unsaved changes
              </span>
            )}
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              style={cancelBtnStyle}
            >
              <X size={14} /> Cancel
            </button>
            <PermissionGate
              permission="rfis.edit"
              fallback={
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  Read-only. You don&apos;t have edit permission for this {entityLabel('rfi')}.
                </span>
              }
            >
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !dirty}
                style={saveBtnStyle(saving || !dirty)}
              >
                <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </PermissionGate>
          </div>
        </div>
      )}
    </DetailPanel>
  )
}

// ── Field primitives ─────────────────────────────────────────────────────

interface FieldRowProps {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}

const FieldRow: React.FC<FieldRowProps> = ({ label, required, hint, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label style={{ fontSize: typography.fontSize.caption, fontWeight: 600, color: colors.textSecondary }}>
      {label}
      {required && <span style={{ color: colors.statusCritical, marginLeft: 4 }}>*</span>}
    </label>
    {children}
    {hint && (
      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{hint}</span>
    )}
  </div>
)

const FieldGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: spacing.lg,
    }}
  >
    {children}
  </div>
)

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: typography.fontSize.sm,
  color: colors.textPrimary,
  backgroundColor: colors.surfaceRaised,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.base,
  outline: 'none',
  fontFamily: 'inherit',
}

const cancelBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  fontSize: typography.fontSize.sm,
  fontWeight: 500,
  color: colors.textSecondary,
  backgroundColor: 'transparent',
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.base,
  cursor: 'pointer',
}

const saveBtnStyle = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  fontSize: typography.fontSize.sm,
  fontWeight: 600,
  color: 'white',
  backgroundColor: disabled ? colors.borderSubtle : colors.primaryOrange,
  border: 'none',
  borderRadius: borderRadius.base,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.7 : 1,
})

export default RFIEditPanel
