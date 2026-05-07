// ── RFISettingsPage ─────────────────────────────────────────────────────
// Phase 3 — RFI Settings module. Six sub-tabs.
//
// Mounted at /projects/:id/settings/rfi. Each sub-tab is a focused panel
// with admin-only mutations gated via PermissionGate `change_settings`.
// Per-row audit on every mutation through the underlying hooks.

import React, { useState } from 'react'
import { Link2, FileType2, ListTodo, ShieldCheck, Hash, Bell, Plus, Trash2, Save, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { PageContainer, useToast } from '../../components/Primitives'
import { PermissionGate } from '../../components/auth/PermissionGate'
import { useProjectId } from '../../hooks/useProjectId'
import { useImportSpecBookRows, useSpecBook } from '../../hooks/queries/useSpecBook'
import { parseSpecBookCsv } from '../../lib/rfi/specBookCsv'
import {
  useRFIWorkflows,
  useSaveRFIWorkflow,
  useRFIResponseTypes,
  useRFICustomFields,
  useSaveRFICustomField,
  useRFIPermissions,
  useSetRFIPermission,
  useRFINumberingSettings,
  useSaveRFINumberingSettings,
  useRFINotificationPrefs,
  useSetRFINotificationPref,
  RFI_PERMISSION_ACTIONS,
  RFI_PERMISSION_ROLES,
  type CustomFieldDef,
  type WorkflowStage,
} from '../../hooks/queries/useRFISettings'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

type Tab = 'workflows' | 'response_types' | 'custom_fields' | 'permissions' | 'numbering' | 'notifications' | 'spec_book'

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'workflows', label: 'Workflows', icon: <Link2 size={13} /> },
  { id: 'response_types', label: 'Response Types', icon: <FileType2 size={13} /> },
  { id: 'custom_fields', label: 'Custom Fields', icon: <ListTodo size={13} /> },
  { id: 'permissions', label: 'Permissions', icon: <ShieldCheck size={13} /> },
  { id: 'numbering', label: 'Numbering', icon: <Hash size={13} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={13} /> },
  { id: 'spec_book', label: 'Spec Book', icon: <FileType2 size={13} /> },
]

export function RFISettingsPage() {
  const projectId = useProjectId()
  const [tab, setTab] = useState<Tab>('workflows')
  if (!projectId) {
    return (
      <PageContainer>
        <p style={{ padding: spacing.xl, color: colors.textTertiary }}>Pick a project first.</p>
      </PageContainer>
    )
  }
  return (
    <PageContainer>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: spacing.xl }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: colors.textPrimary }}>RFI Settings</h1>
        <p style={{ marginTop: 4, marginBottom: spacing.lg, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
          Configure workflows, response types, custom fields, permissions, numbering, and notifications for this project's RFI module.
        </p>
        <div style={{ position: 'relative', marginBottom: spacing.lg }}>
          <div role="tablist" aria-label="RFI Settings tabs" style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${colors.borderSubtle}`, overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  fontSize: typography.fontSize.sm,
                  fontWeight: 600,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${tab === t.id ? colors.primaryOrange : 'transparent'}`,
                  color: tab === t.id ? colors.primaryOrange : colors.textSecondary,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flex: '0 0 auto',
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div aria-hidden style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 32, background: `linear-gradient(to left, ${colors.surfacePage}, transparent)`, pointerEvents: 'none' }} />
        </div>
        <PermissionGate
          permission="rfis.edit"
          fallback={
            <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
              You don't have permission to change RFI settings on this project.
            </p>
          }
        >
          {tab === 'workflows' && <WorkflowsTab projectId={projectId} />}
          {tab === 'response_types' && <ResponseTypesTab projectId={projectId} />}
          {tab === 'custom_fields' && <CustomFieldsTab projectId={projectId} />}
          {tab === 'permissions' && <PermissionsTab projectId={projectId} />}
          {tab === 'numbering' && <NumberingTab projectId={projectId} />}
          {tab === 'notifications' && <NotificationsTab projectId={projectId} />}
          {tab === 'spec_book' && <SpecBookTab projectId={projectId} />}
        </PermissionGate>
      </div>
    </PageContainer>
  )
}

// ── Workflows ─────────────────────────────────────────────────────────
const WorkflowsTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data: workflows = [] } = useRFIWorkflows(projectId)
  const save = useSaveRFIWorkflow()
  const [editing, setEditing] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftStages, setDraftStages] = useState<WorkflowStage[]>([])

  return (
    <section>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {workflows.map((w) => (
          <li key={w.id} style={listRowStyle}>
            <div style={{ flex: 1 }}>
              <strong>{w.name}</strong>
              {w.is_default && <span style={defaultBadgeStyle}>default</span>}
              <div style={subTextStyle}>
                {w.stages.map((s, i) => (
                  <span key={i} style={{ marginRight: 8 }}>
                    {s.name} ({s.sla_days}d)
                  </span>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => { setEditing(w.id); setDraftName(w.name); setDraftStages(w.stages) }} style={smallBtn}>Edit</button>
          </li>
        ))}
      </ul>
      {editing && (
        <div style={{ marginTop: spacing.md, padding: spacing.md, border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base }}>
          <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Workflow name" style={inputStyle} />
          <ul style={{ listStyle: 'none', padding: 0, margin: `${spacing.md} 0`, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {draftStages.map((s, i) => (
              <li key={i} style={{ display: 'flex', gap: 4 }}>
                <input
                  value={s.name}
                  onChange={(e) => setDraftStages((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="Stage name"
                />
                <input
                  type="number"
                  value={s.sla_days}
                  onChange={(e) => setDraftStages((prev) => prev.map((x, j) => j === i ? { ...x, sla_days: Number(e.target.value) } : x))}
                  style={{ ...inputStyle, width: 90 }}
                  placeholder="SLA days"
                />
                <button type="button" onClick={() => setDraftStages((prev) => prev.filter((_, j) => j !== i))} style={smallBtn}>
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setDraftStages((prev) => [...prev, { name: 'New Stage', sla_days: 5, ball_in_court_role: 'member' }])} style={smallBtn}>
            <Plus size={12} /> Add stage
          </button>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: spacing.md }}>
            <button type="button" onClick={() => setEditing(null)} style={smallBtn}><X size={12} /> Cancel</button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await save.mutateAsync({ projectId, id: editing, name: draftName, stages: draftStages })
                  toast.success('Workflow saved')
                  setEditing(null)
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Save failed')
                }
              }}
              style={primaryBtn}
            >
              <Save size={12} /> Save
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

// ── Response types (read-only catalog for MVP) ──────────────────────
const ResponseTypesTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data: types = [] } = useRFIResponseTypes(projectId)
  return (
    <section>
      <p style={subTextStyle}>Configurable response types. Edit support ships in a follow-up.</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {types.map((t) => (
          <li key={t.id} style={listRowStyle}>
            <span style={{ width: 12, height: 12, borderRadius: 6, background: t.color ?? '#999' }} />
            <strong style={{ flex: 1 }}>{t.label}</strong>
            <code style={{ fontSize: 11, color: colors.textTertiary }}>{t.type_code}</code>
            {t.counts_as_answered && <span style={subBadge}>answers</span>}
            {t.requires_resubmittal && <span style={subBadge}>resubmittal</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── Custom fields ───────────────────────────────────────────────────
const CustomFieldsTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data: fields = [] } = useRFICustomFields(projectId)
  const save = useSaveRFICustomField()
  const [editing, setEditing] = useState<CustomFieldDef | null>(null)
  const [draftLabel, setDraftLabel] = useState('')
  const [draftCode, setDraftCode] = useState('')
  const [draftType, setDraftType] = useState<CustomFieldDef['field_type']>('text')
  const [draftRequired, setDraftRequired] = useState(false)
  const [draftOptions, setDraftOptions] = useState<string>('')

  const startNew = () => {
    setEditing({ id: '', project_id: projectId, field_code: '', label: '', field_type: 'text', options: [], required: false, applies_to_workflow_id: null, sort_order: fields.length })
    setDraftLabel('')
    setDraftCode('')
    setDraftType('text')
    setDraftRequired(false)
    setDraftOptions('')
  }

  return (
    <section>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {fields.map((f) => (
          <li key={f.id} style={listRowStyle}>
            <strong style={{ flex: 1 }}>{f.label}</strong>
            <code style={{ fontSize: 11, color: colors.textTertiary }}>{f.field_code}</code>
            <span style={subBadge}>{f.field_type}</span>
            {f.required && <span style={subBadge}>required</span>}
          </li>
        ))}
      </ul>
      <button type="button" onClick={startNew} style={{ ...smallBtn, marginTop: spacing.md }}>
        <Plus size={12} /> New custom field
      </button>
      {editing && (
        <div style={{ marginTop: spacing.md, padding: spacing.md, border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <input value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} placeholder="Label (e.g. Permit Number)" style={{ ...inputStyle, flex: 1 }} />
            <input value={draftCode} onChange={(e) => setDraftCode(e.target.value)} placeholder="Code (snake_case)" style={{ ...inputStyle, width: 180 }} />
            <select value={draftType} onChange={(e) => setDraftType(e.target.value as CustomFieldDef['field_type'])} style={{ ...inputStyle, width: 120 }}>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Select</option>
              <option value="user">User</option>
            </select>
          </div>
          {draftType === 'select' && (
            <input
              value={draftOptions}
              onChange={(e) => setDraftOptions(e.target.value)}
              placeholder="Options, comma-separated"
              style={{ ...inputStyle, marginTop: 4 }}
            />
          )}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: typography.fontSize.sm }}>
            <input type="checkbox" checked={draftRequired} onChange={(e) => setDraftRequired(e.target.checked)} />
            Required
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: spacing.md }}>
            <button type="button" onClick={() => setEditing(null)} style={smallBtn}><X size={12} /> Cancel</button>
            <button
              type="button"
              onClick={async () => {
                if (!draftLabel.trim() || !draftCode.trim()) { toast.error('Label + code are required'); return }
                try {
                  await save.mutateAsync({
                    projectId,
                    id: editing.id || null,
                    field_code: draftCode.trim(),
                    label: draftLabel.trim(),
                    field_type: draftType,
                    options: draftType === 'select' ? draftOptions.split(',').map((s) => s.trim()).filter(Boolean) : [],
                    required: draftRequired,
                  })
                  toast.success('Custom field saved')
                  setEditing(null)
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Save failed')
                }
              }}
              style={primaryBtn}
            >
              <Save size={12} /> Save
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

// ── Permissions matrix ──────────────────────────────────────────────
const PermissionsTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data: perms = [] } = useRFIPermissions(projectId)
  const set = useSetRFIPermission()
  const lookup = (role: string, action: string): boolean => {
    const row = perms.find((p) => p.role === role && p.action === action)
    return row?.allowed ?? false
  }

  return (
    <section>
      <p style={subTextStyle}>
        Per-role × per-action matrix. Changes take effect immediately. Audit row written per cell change.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: typography.fontSize.caption, minWidth: 720 }}>
          <thead>
            <tr>
              <th style={thStyle}>Role / Action</th>
              {RFI_PERMISSION_ACTIONS.map((a) => (
                <th key={a} style={thStyle}>{a.replace(/_/g, ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RFI_PERMISSION_ROLES.map((role) => (
              <tr key={role}>
                <th scope="row" style={{ ...thStyle, textAlign: 'left' }}>{role}</th>
                {RFI_PERMISSION_ACTIONS.map((action) => (
                  <td key={action} style={tdStyle}>
                    <input
                      type="checkbox"
                      aria-label={`${role} can ${action}`}
                      checked={lookup(role, action)}
                      onChange={async (e) => {
                        try {
                          await set.mutateAsync({ projectId, role, action, allowed: e.target.checked })
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Save failed')
                        }
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ── Numbering ───────────────────────────────────────────────────────
const NumberingTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data } = useRFINumberingSettings(projectId)
  const save = useSaveRFINumberingSettings()
  const [prefix, setPrefix] = useState(data?.number_prefix ?? 'RFI-')
  const [suffix, setSuffix] = useState(data?.number_suffix ?? '')
  const [padding, setPadding] = useState(data?.number_padding ?? 3)
  const [perTrade, setPerTrade] = useState(data?.per_trade_sequences ?? false)
  const [manualOverride, setManualOverride] = useState(data?.manual_override ?? false)
  React.useEffect(() => {
    if (data) {
      setPrefix(data.number_prefix); setSuffix(data.number_suffix); setPadding(data.number_padding)
      setPerTrade(data.per_trade_sequences); setManualOverride(data.manual_override)
    }
  }, [data])

  const preview = `${prefix}${'0'.repeat(Math.max(0, padding - 1))}1${suffix}`

  return (
    <section>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
        <Field label="Prefix">
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Suffix">
          <input value={suffix} onChange={(e) => setSuffix(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Padding (digits)">
          <input type="number" min={1} max={10} value={padding} onChange={(e) => setPadding(Number(e.target.value))} style={inputStyle} />
        </Field>
        <Field label="Sample">
          <code style={{ fontSize: typography.fontSize.sm, color: colors.primaryOrange }}>{preview}</code>
        </Field>
      </div>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: spacing.md, fontSize: typography.fontSize.sm }}>
        <input type="checkbox" checked={perTrade} onChange={(e) => setPerTrade(e.target.checked)} />
        Per-trade sequences
      </label>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: spacing.md, fontSize: typography.fontSize.sm }}>
        <input type="checkbox" checked={manualOverride} onChange={(e) => setManualOverride(e.target.checked)} />
        Allow manual number override per RFI
      </label>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: spacing.md }}>
        <button
          type="button"
          onClick={async () => {
            try {
              await save.mutateAsync({
                projectId,
                patch: { number_prefix: prefix, number_suffix: suffix, number_padding: padding, per_trade_sequences: perTrade, manual_override: manualOverride },
              })
              toast.success('Numbering saved')
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Save failed')
            }
          }}
          style={primaryBtn}
        >
          <Save size={12} /> Save
        </button>
      </div>
    </section>
  )
}

// ── Notifications ───────────────────────────────────────────────────
const NotificationsTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data: prefs = [] } = useRFINotificationPrefs(projectId)
  const set = useSetRFINotificationPref()
  const events = ['created', 'assigned', 'responded', 'closed', 'overdue', 'mention', 'distribute_delivered', 'distribute_bounced']
  const channels = ['email', 'in_app', 'sms']
  const lookup = (event: string, channel: string): boolean => {
    const row = prefs.find((p) => p.event === event && p.channel === channel)
    return row?.enabled ?? (channel !== 'sms')
  }
  return (
    <section>
      <p style={subTextStyle}>Per-event × per-channel matrix. Defaults: in-app + email enabled, SMS off.</p>
      <table style={{ borderCollapse: 'collapse', fontSize: typography.fontSize.caption, minWidth: 480 }}>
        <thead>
          <tr>
            <th style={thStyle}>Event / Channel</th>
            {channels.map((c) => <th key={c} style={thStyle}>{c.replace(/_/g, ' ')}</th>)}
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event}>
              <th scope="row" style={{ ...thStyle, textAlign: 'left' }}>{event.replace(/_/g, ' ')}</th>
              {channels.map((channel) => (
                <td key={channel} style={tdStyle}>
                  <input
                    type="checkbox"
                    aria-label={`${event} via ${channel}`}
                    checked={lookup(event, channel)}
                    onChange={async (e) => {
                      try {
                        await set.mutateAsync({ projectId, event, channel, enabled: e.target.checked })
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Save failed')
                      }
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

// ── Spec Book uploader ──────────────────────────────────────────────
const SpecBookTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { addToast } = useToast()
  const { data: specs = [] } = useSpecBook(projectId)
  const importRows = useImportSpecBookRows()
  const [errors, setErrors] = useState<Array<{ row: number; message: string }>>([])

  const handleFile = async (file: File) => {
    const text = await file.text()
    const result = parseSpecBookCsv(text)
    setErrors(result.errors)
    if (result.errors.length > 0) {
      addToast('warning', `${result.errors.length} rows skipped — see error list below`)
    }
    if (result.rows.length === 0) return
    try {
      await importRows.mutateAsync({ projectId, rows: result.rows })
      addToast('success', `Imported ${result.rows.length} spec sections`)
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Import failed')
    }
  }

  return (
    <section>
      <p style={subTextStyle}>
        Upload a CSV with columns: <code>section_code, section_title, division, responsible_party, responsible_email, notes</code>.
        Existing rows are upserted by section_code.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
          e.target.value = ''
        }}
        style={{ marginTop: spacing.md }}
      />
      {errors.length > 0 && (
        <ul style={{ marginTop: spacing.md, color: colors.statusCritical, fontSize: 11 }}>
          {errors.slice(0, 10).map((e, i) => (
            <li key={i}>Row {e.row}: {e.message}</li>
          ))}
          {errors.length > 10 && <li>… {errors.length - 10} more</li>}
        </ul>
      )}
      <h3 style={{ marginTop: spacing.lg, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
        Current spec book ({specs.length} sections)
      </h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 280, overflowY: 'auto' }}>
        {specs.map((s) => (
          <li key={s.id} style={listRowStyle}>
            <code style={{ fontFamily: typography.fontFamilyMono, color: colors.primaryOrange, minWidth: 80 }}>{s.section_code}</code>
            <span style={{ flex: 1 }}>{s.section_title}</span>
            {s.responsible_party && <span style={subBadge}>{s.responsible_party}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── Style primitives ────────────────────────────────────────────────
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: typography.fontSize.caption, fontWeight: 600, color: colors.textSecondary }}>{label}</span>
    {children}
  </label>
)

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: typography.fontSize.sm,
  background: colors.surfaceRaised,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.sm,
  color: colors.textPrimary,
  outline: 'none',
  fontFamily: 'inherit',
}

const listRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  background: colors.surfaceRaised,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.sm,
  fontSize: typography.fontSize.sm,
}

const subTextStyle: React.CSSProperties = { fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: 2, marginBottom: spacing.md }
const defaultBadgeStyle: React.CSSProperties = { marginLeft: 6, padding: '1px 6px', borderRadius: 8, background: colors.orangeSubtle, color: colors.primaryOrange, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }
const subBadge: React.CSSProperties = { padding: '1px 6px', borderRadius: 8, background: colors.surfaceInset, color: colors.textTertiary, fontSize: 10, fontWeight: 600 }
const smallBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, background: 'transparent', border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.sm, color: colors.textSecondary, cursor: 'pointer' }
const primaryBtn: React.CSSProperties = { ...smallBtn, background: colors.primaryOrange, color: 'white', border: 'none' }
const thStyle: React.CSSProperties = { padding: '6px 8px', textAlign: 'center', fontWeight: 600, fontSize: 10, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${colors.borderSubtle}` }
const tdStyle: React.CSSProperties = { padding: '6px 8px', textAlign: 'center', borderBottom: `1px solid ${colors.borderSubtle}` }

void Check
export default RFISettingsPage
