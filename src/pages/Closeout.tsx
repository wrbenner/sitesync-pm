import React, { useMemo, useState, useRef, useCallback } from 'react'
import {
  CheckCircle2, Plus, Shield, BookOpen, GraduationCap, ClipboardList,
  Trash2, Upload, Eye, AlertTriangle, FileSignature, Pencil, X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton,
  Modal, InputField, EmptyState, ProgressBar,
} from '../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { PermissionGate } from '../components/auth/PermissionGate'

import { useCloseoutData, type CloseoutItemRow } from '../hooks/queries/closeout'
import { usePunchItems } from '../hooks/queries/punch-items'
import { useProfileNames, displayName } from '../hooks/queries/profiles'

// punch_items.assigned_to is sometimes a UUID (linked auth user) and sometimes
// a free-text trade name. Resolve only when it looks like a UUID; pass other
// strings through unchanged so a label like "Atlantic Concrete Co." still
// renders as itself.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function resolveAssignee(
  value: string | null | undefined,
  profileMap: ReturnType<typeof useProfileNames>['data'],
  fallback = '—',
): string {
  if (!value) return fallback
  if (UUID_RE.test(value)) return displayName(profileMap, value, fallback)
  return value
}
import { useWarranties, type WarrantyWithStatus } from '../hooks/queries/warranties'
import {
  useCreateWarranty, useUpdateWarranty, useDeleteWarranty,
  type CreateWarrantyInput,
} from '../hooks/mutations/warranties'
import {
  useCreateCloseoutItem, useDeleteCloseoutItem, useToggleCloseoutItemComplete,
  useUploadOMManual, useRecordSignOff, type SignOffKind,
} from '../hooks/mutations/closeout'
import type { PunchItem } from '../types/database'
import { useConfirm } from '../components/ConfirmDialog'

// ── Tabs ──────────────────────────────────────────────────

type Tab = 'punch' | 'warranties' | 'om' | 'training' | 'signoff'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'punch',      label: 'Punch Items',     icon: ClipboardList },
  { key: 'warranties', label: 'Warranties',      icon: Shield },
  { key: 'om',         label: 'O&M Manuals',     icon: BookOpen },
  { key: 'training',   label: 'Training',        icon: GraduationCap },
  { key: 'signoff',    label: 'Final Sign-offs', icon: FileSignature },
]

// ── Helpers ───────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Main component ───────────────────────────────────────

export const Closeout: React.FC = () => {
  const projectId = useProjectId()

  const { data: closeoutData, isLoading: loadingCloseout } = useCloseoutData(projectId ?? undefined)
  const { data: punchResult, isLoading: loadingPunch } = usePunchItems(projectId ?? undefined, { page: 1, pageSize: 200 })
  const { data: warranties, isLoading: loadingWarranties } = useWarranties(projectId ?? undefined)

  const [activeTab, setActiveTab] = useState<Tab>('punch')

  const items = closeoutData?.items ?? []
  const totalItems = items.length
  const approvedItems = items.filter(i => i.status === 'approved').length
  const pctComplete = totalItems > 0 ? Math.round((approvedItems / totalItems) * 100) : 0

  const unresolvedPunch = useMemo(
    () => (punchResult?.data ?? []).filter(p => (p.status ?? '') !== 'verified'),
    [punchResult],
  )
  const blocksCompletion = unresolvedPunch.length > 0

  const omItems = useMemo(() => items.filter(i => i.category === 'om_manual'), [items])
  const trainingItems = useMemo(() => items.filter(i => i.category === 'training'), [items])

  const loading = loadingCloseout || loadingPunch || loadingWarranties

  return (
    <PageContainer
      title="Project Closeout"
      subtitle="Punch list verification, warranties, O&M manuals, training, and final sign-offs"
    >
      {/* ── Completion bar ───────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: spacing['3'],
        marginBottom: spacing['4'],
      }}>
        <MetricBox label="Total items" value={totalItems} />
        <MetricBox label="Approved" value={approvedItems} colorOverride={approvedItems === totalItems && totalItems > 0 ? 'success' : undefined} />
        <MetricBox label="Outstanding" value={totalItems - approvedItems} colorOverride={totalItems - approvedItems > 0 ? 'warning' : 'success'} />
        <MetricBox label="Complete" value={pctComplete} unit="%" colorOverride={pctComplete === 100 ? 'success' : pctComplete >= 75 ? 'warning' : 'danger'} />
      </div>

      <Card padding={spacing['4']}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['2'] }}>
          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            Closeout completion
          </span>
          {blocksCompletion && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
              fontSize: typography.fontSize.caption, color: colors.statusCritical,
              backgroundColor: colors.statusCriticalSubtle, padding: `2px ${spacing['2']}`,
              borderRadius: borderRadius.full, fontWeight: typography.fontWeight.medium,
            }}>
              <AlertTriangle size={12} />
              {unresolvedPunch.length} unresolved punch item{unresolvedPunch.length === 1 ? '' : 's'} blocking completion
            </span>
          )}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            {approvedItems} / {totalItems} items
          </span>
        </div>
        <ProgressBar value={pctComplete} />
      </Card>

      {/* ── Tabs ─────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Closeout sections"
        style={{
          display: 'flex',
          gap: spacing['1'],
          borderBottom: `1px solid ${colors.borderSubtle}`,
          margin: `${spacing['4']} 0 ${spacing['4']}`,
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        {TABS.map(t => {
          const Icon = t.icon
          const active = activeTab === t.key
          const badge = t.key === 'punch' ? unresolvedPunch.length
            : t.key === 'warranties' ? (warranties?.length ?? 0)
            : t.key === 'om' ? omItems.length
            : t.key === 'training' ? trainingItems.length
            : null
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              role="tab"
              aria-selected={active}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['3']}`,
                background: 'none', border: 'none',
                borderBottom: `2px solid ${active ? colors.primaryOrange : 'transparent'}`,
                color: active ? colors.primaryOrange : colors.textSecondary,
                fontSize: typography.fontSize.sm,
                fontWeight: active ? typography.fontWeight.semibold : typography.fontWeight.medium,
                cursor: 'pointer',
                flex: '0 0 auto',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={14} />
              {t.label}
              {badge != null && badge > 0 && (
                <span style={{
                  fontSize: typography.fontSize.caption,
                  color: colors.textTertiary,
                  backgroundColor: colors.surfaceInset,
                  padding: `1px ${spacing['2']}`,
                  borderRadius: borderRadius.full,
                  fontWeight: typography.fontWeight.medium,
                }}>{badge}</span>
              )}
            </button>
          )
        })}
      </div>

      {loading || !projectId ? (
        // Brief skeleton while the project resolves. ProjectGate in App.tsx
        // covers the "no project" case; rendering it here too caused the
        // welcome screen to flash inside an active project. Structured to
        // mirror the table that follows so a paused screenshot still reads
        // as "loading content" rather than "broken empty rectangle".
        <Card padding="0">
          <div style={{ padding: `${spacing['3']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
            <Skeleton width="40%" height="14px" />
          </div>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, borderBottom: i < 3 ? `1px solid ${colors.borderSubtle}` : 'none' }}>
              <Skeleton width="32px" height="14px" />
              <Skeleton width="35%" height="14px" />
              <Skeleton width="20%" height="14px" />
              <Skeleton width="15%" height="14px" />
            </div>
          ))}
        </Card>
      ) : (
        <>
          {activeTab === 'punch' && (
            <PunchTab unresolved={unresolvedPunch} />
          )}
          {activeTab === 'warranties' && (
            <WarrantiesTab projectId={projectId} warranties={warranties ?? []} />
          )}
          {activeTab === 'om' && (
            <OMManualsTab projectId={projectId} items={omItems} />
          )}
          {activeTab === 'training' && (
            <TrainingTab projectId={projectId} items={trainingItems} />
          )}
          {activeTab === 'signoff' && (
            <SignOffTab projectId={projectId} items={items} blocksCompletion={blocksCompletion} />
          )}
        </>
      )}
    </PageContainer>
  )
}

export default Closeout

// ══════════════════════════════════════════════════════════
// ██ PUNCH ITEMS TAB (read-only)
// ══════════════════════════════════════════════════════════

const PunchTab: React.FC<{ unresolved: PunchItem[] }> = ({ unresolved }) => {
  // Resolve assigned_to (UUID OR free-text trade) for every visible row.
  const { data: punchProfileMap } = useProfileNames(unresolved.map((p) => p.assigned_to ?? null))

  if (unresolved.length === 0) {
    return (
      <Card padding={spacing['5']}>
        <EmptyState
          icon={<CheckCircle2 size={48} />}
          title="All punch items verified"
          description="Every punch item has reached 'verified' status. Closeout is no longer blocked by outstanding punch work."
        />
      </Card>
    )
  }
  return (
    <Card padding="0">
      <SectionHeader title={`Unresolved punch items (${unresolved.length})`} />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${colors.borderSubtle}` }}>
              {['#', 'Title', 'Trade', 'Location', 'Status', 'Assigned', 'Due'].map(h => (
                <th key={h} style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'left', fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {unresolved.map(p => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textTertiary, fontFamily: 'ui-monospace, monospace' }}>{p.number}</td>
                <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{p.title}</td>
                <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{p.trade ?? '—'}</td>
                <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>
                  {[p.floor, p.area, p.location].filter(Boolean).join(' · ') || '—'}
                </td>
                <td style={{ padding: `${spacing['2']} ${spacing['3']}` }}>
                  <span style={{
                    display: 'inline-block', padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
                    fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                    color: colors.statusPending, backgroundColor: colors.statusPendingSubtle,
                    textTransform: 'capitalize',
                  }}>{(p.status ?? 'open').replace(/_/g, ' ')}</span>
                </td>
                <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{resolveAssignee(p.assigned_to, punchProfileMap)}</td>
                <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{formatDate(p.due_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ══════════════════════════════════════════════════════════
// ██ WARRANTIES TAB
// ══════════════════════════════════════════════════════════

const WarrantiesTab: React.FC<{ projectId: string; warranties: WarrantyWithStatus[] }> = ({ projectId, warranties }) => {
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<WarrantyWithStatus | null>(null)
  const createWarranty = useCreateWarranty()
  const updateWarranty = useUpdateWarranty()
  const deleteWarranty = useDeleteWarranty()
  const { confirm: confirmWarranty, dialog: warrantyConfirmDialog } = useConfirm()

  const active = warranties.filter(w => w.computedStatus === 'active').length
  const expiring = warranties.filter(w => w.computedStatus === 'expiring_soon').length
  const expired = warranties.filter(w => w.computedStatus === 'expired').length

  const handleDelete = useCallback(async (id: string) => {
    const target = warranties.find(w => w.id === id)
    const ok = await confirmWarranty({
      title: 'Delete warranty?',
      description: target
        ? `"${target.item}"${target.manufacturer ? ` from ${target.manufacturer}` : ''} — closeout coverage will be removed.`
        : 'This warranty record will be removed from the project closeout package.',
      destructiveLabel: 'Delete warranty',
    })
    if (!ok) return
    try {
      await deleteWarranty.mutateAsync({ id, project_id: projectId })
      toast.success('Warranty deleted')
    } catch (err) {
      toast.error('Delete failed: ' + (err as Error).message)
    }
  }, [deleteWarranty, projectId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['3'] }}>
        <MetricBox label="Active" value={active} colorOverride="success" />
        <MetricBox label="Expiring ≤ 90d" value={expiring} colorOverride={expiring > 0 ? 'warning' : undefined} />
        <MetricBox label="Expired" value={expired} colorOverride={expired > 0 ? 'danger' : undefined} />
      </div>

      <Card padding="0">
        <div style={{ display: 'flex', alignItems: 'center', padding: spacing['4'], borderBottom: `1px solid ${colors.borderSubtle}` }}>
          <SectionHeader title={`Warranties (${warranties.length})`} />
          <div style={{ flex: 1 }} />
          <PermissionGate permission="project.settings" fallback={null}>
            <Btn variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              Add Warranty
            </Btn>
          </PermissionGate>
        </div>

        {warranties.length === 0 ? (
          <EmptyState icon={<Shield size={48} />} title="No warranties tracked" description="Add warranties for equipment, systems, and subcontractor workmanship. SiteSync will flag ones nearing expiration." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${colors.borderSubtle}` }}>
                  {['Item', 'Subcontractor', 'Trade', 'Start', 'Expires', 'Status', 'Doc', 'Actions'].map(h => (
                    <th key={h} style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'left', fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {warranties.map(w => <WarrantyRow key={w.id} w={w} onEdit={() => setEditing(w)} onDelete={() => handleDelete(w.id)} />)}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <WarrantyFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (values) => {
          try {
            await createWarranty.mutateAsync({ project_id: projectId, ...values })
            toast.success('Warranty added')
            setCreateOpen(false)
          } catch (err) {
            toast.error('Create failed: ' + (err as Error).message)
          }
        }}
        submitting={createWarranty.isPending}
      />
      <WarrantyFormModal
        open={!!editing}
        initial={editing}
        onClose={() => setEditing(null)}
        onSubmit={async (values) => {
          if (!editing) return
          try {
            await updateWarranty.mutateAsync({ id: editing.id, project_id: projectId, updates: values })
            toast.success('Warranty updated')
            setEditing(null)
          } catch (err) {
            toast.error('Update failed: ' + (err as Error).message)
          }
        }}
        submitting={updateWarranty.isPending}
      />
      {warrantyConfirmDialog}
    </div>
  )
}

const WarrantyRow: React.FC<{ w: WarrantyWithStatus; onEdit: () => void; onDelete: () => void }> = ({ w, onEdit, onDelete }) => {
  const statusCfg = {
    active: { label: 'Active', color: colors.statusActive, bg: colors.statusActiveSubtle },
    expiring_soon: { label: w.daysUntilExpiration != null ? `${w.daysUntilExpiration}d left` : 'Expiring', color: colors.statusPending, bg: colors.statusPendingSubtle },
    expired: { label: w.daysUntilExpiration != null ? `Expired ${Math.abs(w.daysUntilExpiration)}d ago` : 'Expired', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
  }[w.computedStatus]

  return (
    <tr style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {w.item}
        {w.manufacturer && (
          <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.normal }}>
            {w.manufacturer}
          </div>
        )}
      </td>
      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{w.subcontractor ?? '—'}</td>
      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{w.trade ?? '—'}</td>
      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{formatDate(w.start_date)}</td>
      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{formatDate(w.expiration_date)}</td>
      <td style={{ padding: `${spacing['2']} ${spacing['3']}` }}>
        <span style={{
          display: 'inline-block', padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: statusCfg.color, backgroundColor: statusCfg.bg,
        }}>{statusCfg.label}</span>
      </td>
      <td style={{ padding: `${spacing['2']} ${spacing['3']}` }}>
        {w.document_url ? (
          <a href={w.document_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: colors.statusInfo, textDecoration: 'none', fontSize: typography.fontSize.caption }}>
            <Eye size={12} /> View
          </a>
        ) : (
          <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption }}>—</span>
        )}
      </td>
      <td style={{ padding: `${spacing['2']} ${spacing['3']}` }}>
        <div style={{ display: 'flex', gap: spacing['1'] }}>
          <PermissionGate permission="project.settings" fallback={null}>
            <button onClick={onEdit} title="Edit" style={iconButtonStyle}>
              <Pencil size={12} />
            </button>
            <button onClick={onDelete} title="Delete" style={iconButtonStyle}>
              <Trash2 size={12} />
            </button>
          </PermissionGate>
        </div>
      </td>
    </tr>
  )
}

const iconButtonStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 24, height: 24, borderRadius: borderRadius.base,
  background: 'transparent', border: `1px solid ${colors.borderSubtle}`,
  cursor: 'pointer', color: colors.textTertiary,
}

// ── Warranty modal ────────────────────────────────────────

interface WarrantyFormValues {
  item: string
  manufacturer: string
  subcontractor: string
  trade: string
  warranty_type: string
  start_date: string
  expiration_date: string
  duration_years: string
  document_url: string
  coverage_description: string
  contact_name: string
  contact_email: string
}

const blankWarranty: WarrantyFormValues = {
  item: '', manufacturer: '', subcontractor: '', trade: '',
  warranty_type: '', start_date: '', expiration_date: '',
  duration_years: '', document_url: '', coverage_description: '',
  contact_name: '', contact_email: '',
}

type WarrantyPayload = Omit<CreateWarrantyInput, 'project_id'>

const WarrantyFormModal: React.FC<{
  open: boolean
  initial?: WarrantyWithStatus | null
  onClose: () => void
  onSubmit: (values: WarrantyPayload) => void | Promise<void>
  submitting?: boolean
}> = ({ open, initial, onClose, onSubmit, submitting }) => {
  const [form, setForm] = useState<WarrantyFormValues>(blankWarranty)

  React.useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        item: initial.item ?? '',
        manufacturer: initial.manufacturer ?? '',
        subcontractor: initial.subcontractor ?? '',
        trade: initial.trade ?? '',
        warranty_type: initial.warranty_type ?? '',
        start_date: initial.start_date ?? '',
        expiration_date: initial.expiration_date ?? '',
        duration_years: initial.duration_years != null ? String(initial.duration_years) : '',
        document_url: initial.document_url ?? '',
        coverage_description: initial.coverage_description ?? '',
        contact_name: initial.contact_name ?? '',
        contact_email: initial.contact_email ?? '',
      })
    } else {
      setForm(blankWarranty)
    }
  }, [open, initial])

  const setField = (k: keyof WarrantyFormValues) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = () => {
    if (!form.item.trim()) {
      toast.error('Item is required')
      return
    }
    const payload: WarrantyPayload = {
      item: form.item.trim(),
      manufacturer: form.manufacturer.trim() || null,
      subcontractor: form.subcontractor.trim() || null,
      trade: form.trade.trim() || null,
      warranty_type: form.warranty_type.trim() || null,
      start_date: form.start_date || null,
      expiration_date: form.expiration_date || null,
      duration_years: form.duration_years ? Number(form.duration_years) : null,
      document_url: form.document_url.trim() || null,
      coverage_description: form.coverage_description.trim() || null,
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
    }
    void onSubmit(payload)
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Warranty' : 'Add Warranty'} width="640px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
        <InputField label="Item *" value={form.item} onChange={setField('item')} placeholder="e.g. Rooftop AHU-1" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
          <InputField label="Manufacturer" value={form.manufacturer} onChange={setField('manufacturer')} />
          <InputField label="Warranty Type" value={form.warranty_type} onChange={setField('warranty_type')} placeholder="manufacturer / workmanship / extended" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
          <InputField label="Subcontractor" value={form.subcontractor} onChange={setField('subcontractor')} />
          <InputField label="Trade" value={form.trade} onChange={setField('trade')} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing['3'] }}>
          <InputField label="Start Date" type="date" value={form.start_date} onChange={setField('start_date')} />
          <InputField label="Expiration Date" type="date" value={form.expiration_date} onChange={setField('expiration_date')} />
          <InputField label="Duration (yrs)" type="number" value={form.duration_years} onChange={setField('duration_years')} />
        </div>
        <InputField label="Document URL" value={form.document_url} onChange={setField('document_url')} placeholder="https://…" />
        <InputField label="Coverage Description" value={form.coverage_description} onChange={setField('coverage_description')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
          <InputField label="Contact Name" value={form.contact_name} onChange={setField('contact_name')} />
          <InputField label="Contact Email" value={form.contact_email} onChange={setField('contact_email')} />
        </div>
        <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} loading={submitting}>{initial ? 'Save' : 'Add'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════
// ██ O&M MANUALS TAB
// ══════════════════════════════════════════════════════════

const OMManualsTab: React.FC<{ projectId: string; items: CloseoutItemRow[] }> = ({ projectId, items }) => {
  const [uploadOpen, setUploadOpen] = useState(false)
  const uploadOM = useUploadOMManual()
  const deleteItem = useDeleteCloseoutItem()
  const toggleComplete = useToggleCloseoutItemComplete()
  const { confirm: confirmManual, dialog: omConfirmDialog } = useConfirm()

  const bySub = useMemo(() => {
    const map: Record<string, CloseoutItemRow[]> = {}
    for (const i of items) {
      const k = i.assigned_to?.trim() || 'Unassigned'
      map[k] = map[k] || []
      map[k].push(i)
    }
    return map
  }, [items])

  const subs = Object.keys(bySub).sort()

  const handleDelete = async (item: CloseoutItemRow) => {
    const ok = await confirmManual({
      title: 'Remove O&M manual?',
      description: `"${item.description}"${item.trade ? ` from ${item.trade}` : ''} — closeout package will no longer include this manual.`,
      destructiveLabel: 'Remove manual',
    })
    if (!ok) return
    try {
      await deleteItem.mutateAsync({ id: item.id, projectId })
      toast.success('Removed')
    } catch (err) {
      toast.error('Delete failed: ' + (err as Error).message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      <Card padding={spacing['4']}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <SectionHeader title={`O&M Manuals (${items.length})`} />
          <div style={{ flex: 1 }} />
          <PermissionGate permission="files.upload" fallback={null}>
            <Btn variant="primary" size="sm" icon={<Upload size={14} />} onClick={() => setUploadOpen(true)}>
              Upload Manual
            </Btn>
          </PermissionGate>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card padding={spacing['5']}>
          <EmptyState icon={<BookOpen size={48} />} title="No O&M manuals uploaded" description="Upload operations & maintenance manuals by subcontractor. Files are stored in the project-files bucket and tracked as closeout deliverables." />
        </Card>
      ) : (
        subs.map(sub => (
          <Card key={sub} padding={spacing['4']}>
            <SectionHeader title={sub} action={
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                {bySub[sub].length} manual{bySub[sub].length === 1 ? '' : 's'}
              </span>
            } />
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginTop: spacing['3'] }}>
              {bySub[sub].map(item => {
                const isDone = item.status === 'approved'
                return (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: spacing['3'],
                    padding: spacing['3'], borderRadius: borderRadius.base,
                    backgroundColor: colors.surfaceInset,
                  }}>
                    <BookOpen size={16} color={colors.statusInfo} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.description}
                      </p>
                      <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                        {item.trade} · Uploaded {formatDate(item.created_at)}
                      </p>
                    </div>
                    {item.document_url && (
                      <a href={item.document_url} target="_blank" rel="noopener noreferrer" style={{
                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                        fontSize: typography.fontSize.caption, color: colors.statusInfo, textDecoration: 'none',
                        padding: `2px ${spacing['2']}`, borderRadius: borderRadius.base,
                        border: `1px solid ${colors.borderSubtle}`,
                      }}>
                        <Eye size={12} /> View
                      </a>
                    )}
                    <button
                      onClick={() => toggleComplete.mutate({ id: item.id, projectId, complete: !isDone })}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                        padding: `2px ${spacing['2']}`, borderRadius: borderRadius.base,
                        border: `1px solid ${isDone ? colors.statusActive : colors.borderSubtle}`,
                        backgroundColor: isDone ? colors.statusActiveSubtle : 'transparent',
                        color: isDone ? colors.statusActive : colors.textSecondary,
                        fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                        cursor: 'pointer',
                      }}
                    >
                      {isDone ? <CheckCircle2 size={12} /> : <X size={12} />}
                      {isDone ? 'Approved' : 'Pending'}
                    </button>
                    <PermissionGate permission="project.settings" fallback={null}>
                      <button onClick={() => handleDelete(item)} title="Remove" style={iconButtonStyle}>
                        <Trash2 size={12} />
                      </button>
                    </PermissionGate>
                  </div>
                )
              })}
            </div>
          </Card>
        ))
      )}

      <OMUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        submitting={uploadOM.isPending}
        onSubmit={async ({ file, subcontractor, description, trade }) => {
          try {
            await uploadOM.mutateAsync({ projectId, file, subcontractor, description, trade })
            toast.success(`"${file.name}" uploaded`)
            setUploadOpen(false)
          } catch (err) {
            toast.error('Upload failed: ' + (err as Error).message)
          }
        }}
      />
      {omConfirmDialog}
    </div>
  )
}

const OMUploadModal: React.FC<{
  open: boolean
  onClose: () => void
  submitting?: boolean
  onSubmit: (input: { file: File; subcontractor: string; description: string; trade: string }) => void | Promise<void>
}> = ({ open, onClose, submitting, onSubmit }) => {
  const [subcontractor, setSubcontractor] = useState('')
  const [description, setDescription] = useState('')
  const [trade, setTrade] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) {
      setSubcontractor(''); setDescription(''); setTrade(''); setFile(null)
    }
  }, [open])

  const handleSubmit = () => {
    if (!file) { toast.error('Pick a file to upload'); return }
    if (!description.trim()) { toast.error('Description is required'); return }
    if (!trade.trim()) { toast.error('Trade is required'); return }
    void onSubmit({ file, subcontractor: subcontractor.trim(), description: description.trim(), trade: trade.trim() })
  }

  return (
    <Modal open={open} onClose={onClose} title="Upload O&M Manual" width="560px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
        <InputField label="Description *" value={description} onChange={setDescription} placeholder="e.g. RTU-1 Operations & Maintenance" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
          <InputField label="Trade *" value={trade} onChange={setTrade} placeholder="e.g. Mechanical" />
          <InputField label="Subcontractor" value={subcontractor} onChange={setSubcontractor} placeholder="e.g. Acme Mechanical" />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>File *</label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%', textAlign: 'left',
              padding: spacing['3'], borderRadius: borderRadius.base,
              border: `1px dashed ${colors.borderSubtle}`,
              backgroundColor: colors.surfaceInset,
              fontFamily: typography.fontFamily,
              fontSize: typography.fontSize.sm,
              color: file ? colors.textPrimary : colors.textTertiary,
              cursor: 'pointer',
            }}
          >
            <Upload size={14} style={{ verticalAlign: 'middle', marginRight: spacing['2'] }} />
            {file ? file.name : 'Click to select a file'}
          </button>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.png,.jpg,.jpeg"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setFile(f)
              e.target.value = ''
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSubmit} loading={submitting}>Upload</Btn>
        </div>
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════
// ██ TRAINING TAB
// ══════════════════════════════════════════════════════════

const TrainingTab: React.FC<{ projectId: string; items: CloseoutItemRow[] }> = ({ projectId, items }) => {
  const [createOpen, setCreateOpen] = useState(false)
  const createItem = useCreateCloseoutItem()
  const toggleComplete = useToggleCloseoutItemComplete()
  const deleteItem = useDeleteCloseoutItem()
  const { confirm: confirmTraining, dialog: trainingConfirmDialog } = useConfirm()
  // Resolve assigned_to (UUID OR free-text) for every visible item.
  const { data: trainingProfileMap } = useProfileNames(items.map((it) => (it.assigned_to as string | null) ?? null))

  const [form, setForm] = useState({ description: '', trade: '', assigned_to: '', due_date: '', notes: '' })

  const handleCreate = async () => {
    if (!form.description.trim()) { toast.error('Description is required'); return }
    if (!form.trade.trim()) { toast.error('Trade is required'); return }
    try {
      await createItem.mutateAsync({
        project_id: projectId,
        category: 'training',
        description: form.description.trim(),
        trade: form.trade.trim(),
        assigned_to: form.assigned_to.trim() || null,
        due_date: form.due_date || null,
        notes: form.notes.trim() || null,
      })
      toast.success('Training session added')
      setCreateOpen(false)
      setForm({ description: '', trade: '', assigned_to: '', due_date: '', notes: '' })
    } catch (err) {
      toast.error('Create failed: ' + (err as Error).message)
    }
  }

  const handleDelete = async (item: CloseoutItemRow) => {
    const ok = await confirmTraining({
      title: 'Delete training entry?',
      description: `"${item.description}" — training record will be removed from the project closeout package.`,
      destructiveLabel: 'Delete entry',
    })
    if (!ok) return
    try {
      await deleteItem.mutateAsync({ id: item.id, projectId })
      toast.success('Deleted')
    } catch (err) {
      toast.error('Delete failed: ' + (err as Error).message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      <Card padding={spacing['4']}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <SectionHeader title={`Training (${items.length})`} />
          <div style={{ flex: 1 }} />
          <PermissionGate permission="project.settings" fallback={null}>
            <Btn variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              Add Session
            </Btn>
          </PermissionGate>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card padding={spacing['5']}>
          <EmptyState icon={<GraduationCap size={48} />} title="No owner training scheduled" description="Add training sessions for equipment, systems, and building operations." />
        </Card>
      ) : (
        <Card padding="0">
          {items.map((item, i) => {
            const isDone = item.status === 'approved'
            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: spacing['3'],
                padding: spacing['3'],
                borderBottom: i < items.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
              }}>
                <button
                  onClick={() => toggleComplete.mutate({ id: item.id, projectId, complete: !isDone })}
                  aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    border: `2px solid ${isDone ? colors.statusActive : colors.borderSubtle}`,
                    backgroundColor: isDone ? colors.statusActive : 'transparent',
                    color: 'white', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {isDone && <CheckCircle2 size={14} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0, fontSize: typography.fontSize.sm,
                    fontWeight: typography.fontWeight.medium,
                    color: isDone ? colors.textSecondary : colors.textPrimary,
                    textDecoration: isDone ? 'line-through' : 'none',
                  }}>{item.description}</p>
                  <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    {item.trade}{item.assigned_to ? ` · ${resolveAssignee(item.assigned_to as string, trainingProfileMap, '')}` : ''}{item.due_date ? ` · Due ${formatDate(item.due_date)}` : ''}
                  </p>
                </div>
                {item.completed_date && (
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.statusActive }}>
                    Completed {formatDate(item.completed_date)}
                  </span>
                )}
                <PermissionGate permission="project.settings" fallback={null}>
                  <button onClick={() => handleDelete(item)} title="Delete" style={iconButtonStyle}>
                    <Trash2 size={12} />
                  </button>
                </PermissionGate>
              </div>
            )
          })}
        </Card>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Training Session" width="520px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          <InputField label="Description *" value={form.description} onChange={v => setForm({ ...form, description: v })} placeholder="e.g. BMS operator training" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Trade *" value={form.trade} onChange={v => setForm({ ...form, trade: v })} />
            <InputField label="Assigned To" value={form.assigned_to} onChange={v => setForm({ ...form, assigned_to: v })} />
          </div>
          <InputField label="Due Date" type="date" value={form.due_date} onChange={v => setForm({ ...form, due_date: v })} />
          <InputField label="Notes" value={form.notes} onChange={v => setForm({ ...form, notes: v })} />
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreate} loading={createItem.isPending}>Add</Btn>
          </div>
        </div>
      </Modal>
      {trainingConfirmDialog}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// ██ FINAL SIGN-OFFS TAB
// ══════════════════════════════════════════════════════════

const SignOffTab: React.FC<{ projectId: string; items: CloseoutItemRow[]; blocksCompletion: boolean }> = ({ projectId, items, blocksCompletion }) => {
  const recordSignOff = useRecordSignOff()
  const [signingKind, setSigningKind] = useState<SignOffKind | null>(null)

  const substantial = items.find(i => i.category === 'substantial_completion')
  const final = items.find(i => i.category === 'final_completion')

  const signOffs: { kind: SignOffKind; label: string; item: CloseoutItemRow | undefined; description: string }[] = [
    {
      kind: 'substantial_completion',
      label: 'Substantial Completion',
      item: substantial,
      description: 'Project reached substantial completion — owner may occupy and use for intended purpose. Punch items may remain.',
    },
    {
      kind: 'final_completion',
      label: 'Final Completion',
      item: final,
      description: 'All punch items verified, all closeout deliverables approved. Contract formally complete.',
    },
  ]

  const substantialDone = substantial?.status === 'approved'
  const finalBlocked = !substantialDone || blocksCompletion

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      {signOffs.map(s => {
        const isDone = s.item?.status === 'approved'
        const disabled = s.kind === 'final_completion' && finalBlocked && !isDone
        const notes = s.item?.notes ? safeParseNotes(s.item.notes) : null
        return (
          <Card key={s.kind} padding={spacing['5']}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'] }}>
              <span style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                backgroundColor: isDone ? colors.statusActiveSubtle : colors.surfaceInset,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: isDone ? colors.statusActive : colors.textTertiary,
                marginTop: 2,
              }}>
                {isDone ? <CheckCircle2 size={16} /> : <FileSignature size={14} />}
              </span>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                  {s.label}
                </h3>
                <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                  {s.description}
                </p>
                {isDone && notes && (
                  <div style={{ marginTop: spacing['3'], padding: spacing['3'], backgroundColor: colors.statusActiveSubtle, borderRadius: borderRadius.base, borderLeft: `3px solid ${colors.statusActive}` }}>
                    <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                      Signed by <strong>{notes.signed_by}</strong>
                      {notes.title ? `, ${notes.title}` : ''}
                      {' · '}{formatDate(notes.signed_at)}
                    </p>
                    {notes.signature && (
                      <img src={notes.signature} alt="signature" style={{ marginTop: spacing['2'], maxHeight: 60, maxWidth: 300 }} />
                    )}
                  </div>
                )}
                {disabled && !isDone && (
                  <div style={{ marginTop: spacing['3'], padding: spacing['2'], backgroundColor: colors.statusPendingSubtle, borderRadius: borderRadius.base, fontSize: typography.fontSize.caption, color: colors.statusPending }}>
                    <AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: spacing['1'] }} />
                    Final sign-off is blocked until substantial completion is signed and all punch items are verified.
                  </div>
                )}
              </div>
              {!isDone && (
                <PermissionGate permission="project.settings" fallback={null}>
                  <Btn
                    variant="primary"
                    size="sm"
                    icon={<FileSignature size={14} />}
                    disabled={disabled}
                    onClick={() => setSigningKind(s.kind)}
                  >
                    Sign
                  </Btn>
                </PermissionGate>
              )}
            </div>
          </Card>
        )
      })}

      <SignatureModal
        open={signingKind !== null}
        kind={signingKind}
        onClose={() => setSigningKind(null)}
        submitting={recordSignOff.isPending}
        onSubmit={async ({ name, title, signature }) => {
          if (!signingKind) return
          try {
            await recordSignOff.mutateAsync({
              projectId,
              kind: signingKind,
              signerName: name,
              signerTitle: title,
              signatureDataUrl: signature,
            })
            toast.success('Sign-off recorded')
            setSigningKind(null)
          } catch (err) {
            toast.error('Sign-off failed: ' + (err as Error).message)
          }
        }}
      />
    </div>
  )
}

function safeParseNotes(notes: string): { signed_by: string; title: string | null; signed_at: string; signature: string | null } | null {
  try {
    const parsed = JSON.parse(notes) as { signed_by?: string; title?: string | null; signed_at?: string; signature?: string | null }
    if (!parsed.signed_by || !parsed.signed_at) return null
    return {
      signed_by: parsed.signed_by,
      title: parsed.title ?? null,
      signed_at: parsed.signed_at,
      signature: parsed.signature ?? null,
    }
  } catch {
    return null
  }
}

const SignatureModal: React.FC<{
  open: boolean
  kind: SignOffKind | null
  onClose: () => void
  submitting?: boolean
  onSubmit: (input: { name: string; title: string; signature: string | null }) => void | Promise<void>
}> = ({ open, kind, onClose, submitting, onSubmit }) => {
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  React.useEffect(() => {
    if (!open) {
      setName(''); setTitle('')
      drawing.current = false
      const c = canvasRef.current
      if (c) {
        const ctx = c.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, c.width, c.height)
      }
    }
  }, [open])

  const pointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    const rect = c.getBoundingClientRect()
    drawing.current = true
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#111827'
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }
  const pointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    const rect = c.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }
  const pointerUp = () => { drawing.current = false }
  const clearSig = () => {
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
  }

  const submit = () => {
    if (!name.trim()) { toast.error('Signer name is required'); return }
    const c = canvasRef.current
    let signature: string | null = null
    if (c) {
      // Only include the signature image if the canvas isn't blank
      const ctx = c.getContext('2d')
      const data = ctx?.getImageData(0, 0, c.width, c.height).data
      const hasInk = data ? Array.from(data).some((v, idx) => idx % 4 === 3 && v > 0) : false
      if (hasInk) signature = c.toDataURL('image/png')
    }
    void onSubmit({ name: name.trim(), title: title.trim(), signature })
  }

  const title_ = kind === 'substantial_completion' ? 'Substantial Completion Sign-off' : 'Final Completion Sign-off'

  return (
    <Modal open={open} onClose={onClose} title={title_} width="560px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
        <InputField label="Signer Name *" value={name} onChange={setName} placeholder="e.g. Jane Smith" />
        <InputField label="Title" value={title} onChange={setTitle} placeholder="e.g. Project Manager" />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing['1'] }}>
            <label style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Signature</label>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={clearSig}
              style={{ background: 'transparent', border: 'none', color: colors.textTertiary, fontSize: typography.fontSize.caption, cursor: 'pointer' }}
            >
              Clear
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={520}
            height={140}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerLeave={pointerUp}
            style={{
              width: '100%', height: 140,
              backgroundColor: colors.surfaceInset,
              border: `1px dashed ${colors.borderSubtle}`,
              borderRadius: borderRadius.base,
              touchAction: 'none', cursor: 'crosshair',
            }}
          />
          <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            Draw your signature above. Leave blank to record a typed sign-off only.
          </p>
        </div>
        <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} loading={submitting} icon={<FileSignature size={14} />}>Record Sign-off</Btn>
        </div>
      </div>
    </Modal>
  )
}
