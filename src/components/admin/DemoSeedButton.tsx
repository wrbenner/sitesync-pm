import React, { useState, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Sparkles, Trash2, Loader2, AlertTriangle, Check, X } from 'lucide-react'
import { toast } from 'sonner'

import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { usePermissions } from '../../hooks/usePermissions'
import { useProjectId } from '../../hooks/useProjectId'
import { seedDemoData, wipeDemoData, hasDemoData } from '../../lib/demoSeeder'

const ADMIN_ROLES = new Set(['admin', 'owner', 'project_manager'])

/**
 * Admin-only "Seed demo data" / "Wipe demo data" controls. Mounts on /admin
 * pages. Gated to admin / owner / PM roles via usePermissions; hidden for
 * everyone else so an investor doing a self-tour won't trip on it.
 *
 * Wipe path requires explicit confirmation in a modal — these are
 * destructive operations that target the live project.
 */
export const DemoSeedButton: React.FC = () => {
  const { role } = usePermissions()
  const projectId = useProjectId()
  const [seeding, setSeeding] = useState(false)
  const [wiping, setWiping] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [hasData, setHasData] = useState(() => (projectId ? hasDemoData(projectId) : false))

  const refreshHasData = useCallback(() => {
    if (projectId) setHasData(hasDemoData(projectId))
  }, [projectId])

  // Hide entirely for non-admin users.
  if (!role || !ADMIN_ROLES.has(role)) return null
  if (!projectId) return null

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const result = await seedDemoData(projectId)
      const total = result.created.reduce((s, r) => s + r.count, 0)
      if (total > 0) {
        toast.success(`Seeded ${total} demo records across ${result.created.length} tables`)
      } else {
        toast.error('Nothing was seeded — check console for skipped tables')
      }
      if (result.skipped.length > 0) {
        // eslint-disable-next-line no-console
        console.warn('[demo seeder] skipped:', result.skipped)
      }
      refreshHasData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Seeding failed')
    } finally {
      setSeeding(false)
    }
  }

  const handleWipe = async () => {
    setConfirmOpen(false)
    setWiping(true)
    try {
      const result = await wipeDemoData(projectId)
      const total = result.deleted.reduce((s, r) => s + r.count, 0)
      toast.success(`Wiped ${total} demo records`)
      if (result.failed.length > 0) {
        // eslint-disable-next-line no-console
        console.warn('[demo seeder] wipe failures:', result.failed)
      }
      refreshHasData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Wipe failed')
    } finally {
      setWiping(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['2'],
        padding: spacing['3'],
        backgroundColor: colors.surfaceInset,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.md,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: colors.textTertiary,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginRight: spacing['2'],
        }}
      >
        Demo data
      </span>
      <button
        type="button"
        onClick={handleSeed}
        disabled={seeding || wiping}
        style={primaryBtn(seeding)}
        title="Populate this project with realistic demo records"
      >
        {seeding ? (
          <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          <Sparkles size={13} />
        )}
        {seeding ? 'Seeding…' : 'Seed demo data'}
      </button>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={seeding || wiping || !hasData}
        style={dangerBtn(wiping || !hasData)}
        title={hasData ? 'Delete every record this seeder created' : 'No seeded data on this project yet'}
      >
        {wiping ? (
          <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          <Trash2 size={13} />
        )}
        {wiping ? 'Wiping…' : 'Wipe demo data'}
      </button>

      <ConfirmWipeDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleWipe}
      />
    </div>
  )
}

// ── Local styles ────────────────────────────────────────────────────────────

const baseBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: borderRadius.sm,
  fontSize: typography.fontSize.caption,
  fontWeight: typography.fontWeight.semibold,
  fontFamily: typography.fontFamily,
  border: '1px solid transparent',
  cursor: 'pointer',
}

const primaryBtn = (loading: boolean): React.CSSProperties => ({
  ...baseBtn,
  backgroundColor: loading ? '#4338CA' : '#4F46E5',
  color: colors.white,
  cursor: loading ? 'wait' : 'pointer',
})

const dangerBtn = (disabled: boolean): React.CSSProperties => ({
  ...baseBtn,
  backgroundColor: colors.white,
  color: colors.statusCritical,
  borderColor: `${colors.statusCritical}40`,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.55 : 1,
})

// ── Confirm modal ───────────────────────────────────────────────────────────

const ConfirmWipeDialog: React.FC<{
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}> = ({ open, onCancel, onConfirm }) => (
  <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
    <Dialog.Portal>
      <Dialog.Overlay
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 22, 41, 0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing['4'],
        }}
      >
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            width: 'min(440px, 100%)',
            backgroundColor: colors.white,
            borderRadius: borderRadius.lg,
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            padding: spacing['5'],
            fontFamily: typography.fontFamily,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: `${colors.statusCritical}14`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.statusCritical,
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={18} />
            </div>
            <Dialog.Title
              style={{
                margin: 0,
                fontSize: typography.fontSize.subtitle,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
              }}
            >
              Wipe demo data?
            </Dialog.Title>
          </div>
          <p
            style={{
              margin: 0,
              marginBottom: spacing['4'],
              fontSize: typography.fontSize.sm,
              color: colors.textSecondary,
              lineHeight: 1.5,
            }}
          >
            This will delete every record the seeder created on this project — RFIs,
            submittals, punch items, schedule activities, budget lines, photos, and
            commitments. Records you created manually are <strong>not</strong> touched.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
            <Dialog.Close asChild>
              <button
                type="button"
                onClick={onCancel}
                style={{ ...baseBtn, backgroundColor: colors.white, color: colors.textPrimary, borderColor: colors.borderDefault }}
              >
                <X size={13} />
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={onConfirm}
              style={{ ...baseBtn, backgroundColor: colors.statusCritical, color: colors.white }}
            >
              <Check size={13} />
              Yes, wipe it
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Portal>
  </Dialog.Root>
)
