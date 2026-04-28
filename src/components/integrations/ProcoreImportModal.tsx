import React, { useState } from 'react'
import { ExternalLink, CheckCircle2, AlertCircle, Loader2, Cloud } from 'lucide-react'
import { Btn, Modal } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { importFromProcore, type ImportScope, type ProcoreImportResult } from '../../services/procoreImport'

// ── Procore Import Modal ───────────────────────────────────
//
// Sales-cycle unblocker. Customer pastes their Procore credentials,
// picks a target SiteSync project, clicks Import. Within ~60 seconds
// they see their real RFIs, submittals, change orders, and drawings
// in SiteSync.
//
// MVP scope: one-shot import; ongoing sync is the integrations flow.

interface Props {
  open: boolean
  onClose: () => void
  /** SiteSync project to import INTO. */
  targetProjectId: string
  /** Display name for the target project, shown in confirmation copy. */
  targetProjectName?: string
}

const ALL_SCOPES: { key: ImportScope; label: string; help: string }[] = [
  { key: 'rfis', label: 'RFIs', help: 'Open + closed Requests for Information.' },
  { key: 'submittals', label: 'Submittals', help: 'Spec submittals with status + due date.' },
  { key: 'change_orders', label: 'Change orders', help: 'Approved + pending change orders.' },
  { key: 'drawings', label: 'Drawings', help: 'Sheet metadata only — no PDFs.' },
]

export const ProcoreImportModal: React.FC<Props> = ({ open, onClose, targetProjectId, targetProjectName }) => {
  const [apiKey, setApiKey] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [procoreProjectId, setProcoreProjectId] = useState('')
  const [selectedScopes, setSelectedScopes] = useState<Set<ImportScope>>(
    () => new Set(ALL_SCOPES.map((s) => s.key)),
  )
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ProcoreImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setApiKey('')
    setCompanyId('')
    setProcoreProjectId('')
    setSelectedScopes(new Set(ALL_SCOPES.map((s) => s.key)))
    setImporting(false)
    setResult(null)
    setError(null)
  }

  const handleClose = () => {
    if (importing) return
    reset()
    onClose()
  }

  const toggleScope = (k: ImportScope) => {
    setSelectedScopes((prev) => {
      const next = new Set(prev)
      if (next.has(k)) {
        next.delete(k)
      } else {
        next.add(k)
      }
      return next
    })
  }

  const canSubmit =
    apiKey.trim().length > 0 &&
    companyId.trim().length > 0 &&
    procoreProjectId.trim().length > 0 &&
    selectedScopes.size > 0 &&
    !importing

  const handleImport = async () => {
    if (!canSubmit) return
    setImporting(true)
    setError(null)
    setResult(null)
    try {
      const r = await importFromProcore(
        targetProjectId,
        { apiKey: apiKey.trim(), companyId: companyId.trim(), procoreProjectId: procoreProjectId.trim() },
        Array.from(selectedScopes),
      )
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const totalImported = result
    ? result.imported.rfis + result.imported.submittals + result.imported.change_orders + result.imported.drawings
    : 0

  return (
    <Modal open={open} onClose={handleClose} title="Import from Procore" width="560px">
      {/* Success state ──────────────────────────────────── */}
      {result && result.ok && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <CheckCircle2 size={20} color={colors.statusActive} />
            <span style={{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold }}>
              Imported {totalImported.toLocaleString()} items into {targetProjectName ?? 'this project'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing['3'] }}>
            <SummaryRow label="RFIs" count={result.imported.rfis} />
            <SummaryRow label="Submittals" count={result.imported.submittals} />
            <SummaryRow label="Change orders" count={result.imported.change_orders} />
            <SummaryRow label="Drawings" count={result.imported.drawings} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
            <Btn variant="primary" onClick={handleClose}>Done</Btn>
          </div>
        </div>
      )}

      {/* Partial-failure state ──────────────────────────── */}
      {result && !result.ok && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <AlertCircle size={20} color={colors.statusPending} />
            <span style={{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold }}>
              Import completed with errors
            </span>
          </div>
          <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
            Imported {totalImported.toLocaleString()} items. {result.errors.length} step{result.errors.length === 1 ? '' : 's'} failed:
          </div>
          <ul style={{ margin: 0, paddingLeft: spacing['4'], fontSize: typography.fontSize.sm, color: colors.statusCritical, lineHeight: 1.5 }}>
            {result.errors.map((e, i) => (
              <li key={i}>
                <strong>{e.scope}</strong>: {e.error}
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
            <Btn variant="ghost" onClick={() => setResult(null)}>Try again</Btn>
            <Btn variant="primary" onClick={handleClose}>Done</Btn>
          </div>
        </div>
      )}

      {/* Form state ─────────────────────────────────────── */}
      {!result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.55 }}>
            Pulls your Procore project&apos;s open data into <strong style={{ color: colors.textPrimary }}>{targetProjectName ?? 'this project'}</strong> so your team can run on real data immediately. One-shot import — for ongoing sync, use the Procore integration once you&apos;re ready to commit.
          </p>

          {/* Procore creds */}
          <Field
            label="Procore API key"
            value={apiKey}
            onChange={setApiKey}
            placeholder="Bearer token from your Procore Developer Portal"
            type="password"
            help={
              <>
                Generate at <a href="https://developers.procore.com/" target="_blank" rel="noopener noreferrer" style={{ color: colors.primaryOrange }}>developers.procore.com <ExternalLink size={10} style={{ verticalAlign: 'middle' }} /></a>
              </>
            }
          />
          <Field
            label="Procore Company ID"
            value={companyId}
            onChange={setCompanyId}
            placeholder="e.g. 12345"
            help="Numeric ID for your company in Procore. Found in URL when viewing your company dashboard."
          />
          <Field
            label="Procore Project ID"
            value={procoreProjectId}
            onChange={setProcoreProjectId}
            placeholder="e.g. 67890"
            help="Numeric ID for the project to import. Found in URL when viewing the project."
          />

          {/* Scopes */}
          <div>
            <div style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['2'], textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              What to import
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing['2'] }}>
              {ALL_SCOPES.map((s) => (
                <label
                  key={s.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing['2'],
                    padding: spacing['2'],
                    borderRadius: borderRadius.sm,
                    background: selectedScopes.has(s.key) ? `${colors.primaryOrange}10` : colors.surfaceInset,
                    border: `1px solid ${selectedScopes.has(s.key) ? colors.primaryOrange : colors.borderSubtle}`,
                    cursor: 'pointer',
                    fontSize: typography.fontSize.sm,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedScopes.has(s.key)}
                    onChange={() => toggleScope(s.key)}
                    style={{ margin: 0 }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{s.label}</div>
                    <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginTop: 1 }}>{s.help}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: typography.fontSize.sm, color: colors.statusCritical }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing['2'] }}>
            <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Cloud size={12} /> Credentials are sent server-side only. Never stored.
            </span>
            <div style={{ display: 'flex', gap: spacing['2'] }}>
              <Btn variant="ghost" onClick={handleClose} disabled={importing}>Cancel</Btn>
              <Btn variant="primary" onClick={handleImport} disabled={!canSubmit}>
                {importing ? (<><Loader2 size={14} style={{ marginRight: 6, animation: 'spin 1s linear infinite' }} /> Importing…</>) : 'Import now'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── helpers ────────────────────────────────────────────────

const Field: React.FC<{
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: 'text' | 'password'
  help?: React.ReactNode
}> = ({ label, value, onChange, placeholder, type = 'text', help }) => (
  <div>
    <label style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: spacing['2'],
        borderRadius: borderRadius.md,
        border: `1px solid ${colors.borderSubtle}`,
        background: colors.surfaceRaised,
        color: colors.textPrimary,
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily,
      }}
    />
    {help && (
      <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginTop: 4, lineHeight: 1.4 }}>{help}</div>
    )}
  </div>
)

const SummaryRow: React.FC<{ label: string; count: number }> = ({ label, count }) => (
  <div
    style={{
      padding: spacing['3'],
      borderRadius: borderRadius.md,
      background: colors.surfaceInset,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}
  >
    <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
      {count.toLocaleString()}
    </div>
  </div>
)
