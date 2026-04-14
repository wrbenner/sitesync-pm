import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Loader2, FolderOpen, ChevronRight } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, zIndex, transitions, touchTarget } from '../../styles/theme'
import { motion, AnimatePresence } from 'framer-motion'

// ── Folder Picker Modal ──────────────────────────────────

export interface FolderOption {
  id: string
  name: string
  depth?: number
}

interface FolderPickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folders: FolderOption[]
  onSelect: (folder: FolderOption) => void
  title?: string
}

export const FolderPickerModal: React.FC<FolderPickerModalProps> = ({
  open,
  onOpenChange,
  folders,
  onSelect,
  title = 'Move to Folder',
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: zIndex.modal as number,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Dialog.Content
            style={{
              width: 400,
              backgroundColor: colors.white,
              borderRadius: borderRadius.xl,
              boxShadow: shadows.panel,
              fontFamily: typography.fontFamily,
              overflow: 'hidden',
            }}
            aria-describedby="folder-picker-description"
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: `${spacing['4']} ${spacing['5']}`,
              borderBottom: `1px solid ${colors.borderSubtle}`,
            }}>
              <Dialog.Title style={{
                margin: 0,
                fontSize: typography.fontSize.subtitle,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
              }}>
                {title}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  aria-label="Close"
                  style={{
                    all: 'unset', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: touchTarget.field, height: touchTarget.field,
                    borderRadius: borderRadius.full,
                    color: colors.textTertiary,
                  }}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>

            <p id="folder-picker-description" style={{
              margin: 0,
              padding: `${spacing['3']} ${spacing['5']} 0`,
              fontSize: typography.fontSize.sm,
              color: colors.textSecondary,
            }}>
              Select a destination folder.
            </p>

            <div style={{ maxHeight: 320, overflowY: 'auto', padding: spacing['3'] }}>
              {folders.length === 0 && (
                <p style={{ padding: `${spacing['4']} ${spacing['5']}`, fontSize: typography.fontSize.sm, color: colors.textTertiary, textAlign: 'center', margin: 0 }}>
                  No folders available
                </p>
              )}
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => { onSelect(folder); onOpenChange(false); }}
                  onMouseEnter={() => setHoveredId(folder.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    all: 'unset',
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing['3'],
                    width: '100%',
                    minHeight: touchTarget.field,
                    padding: `0 ${spacing['3']}`,
                    paddingLeft: `calc(${spacing['3']} + ${(folder.depth || 0) * 20}px)`,
                    borderRadius: borderRadius.md,
                    cursor: 'pointer',
                    backgroundColor: hoveredId === folder.id ? colors.surfaceHover : 'transparent',
                    transition: `background-color ${transitions.instant}`,
                    boxSizing: 'border-box',
                  }}
                >
                  <FolderOpen size={16} color={colors.primaryOrange} />
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, flex: 1 }}>
                    {folder.name}
                  </span>
                  <ChevronRight size={14} color={colors.textTertiary} />
                </button>
              ))}
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ── Bulk Action Bar ─────────────────────────────────────
// Floats at the bottom of the screen when items are selected.

interface BulkAction {
  label: string
  icon?: React.ReactNode
  variant?: 'primary' | 'secondary' | 'danger'
  /** If true, shows a confirmation dialog before executing */
  confirm?: boolean
  confirmMessage?: string
  onClick: (selectedIds: string[]) => Promise<void>
}

interface BulkActionBarProps {
  selectedIds: string[]
  onClearSelection: () => void
  actions: BulkAction[]
  entityLabel?: string
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedIds,
  onClearSelection,
  actions,
  entityLabel = 'items',
}) => {
  const [loading, setLoading] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<BulkAction | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const count = selectedIds.length

  const handleAction = async (action: BulkAction) => {
    if (action.confirm) {
      setConfirmAction(action)
      return
    }
    await executeAction(action)
  }

  const executeAction = async (action: BulkAction) => {
    setLoading(action.label)
    setErrorMsg(null)
    setConfirmAction(null)
    try {
      await action.onClick(selectedIds)
      onClearSelection()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed. Please try again.'
      setErrorMsg(msg)
    } finally {
      setLoading(null)
    }
  }

  const getButtonStyle = (variant: string = 'secondary'): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: `${spacing['2']} ${spacing['4']}`,
      fontSize: typography.fontSize.sm,
      fontFamily: typography.fontFamily,
      fontWeight: typography.fontWeight.medium,
      borderRadius: borderRadius.md,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: spacing['2'],
      transition: `all ${transitions.instant}`,
      minHeight: 56,
    }
    if (variant === 'primary') {
      return { ...base, backgroundColor: colors.primaryOrange, color: colors.white, border: 'none' }
    }
    if (variant === 'danger') {
      return { ...base, backgroundColor: colors.statusCritical, color: colors.white, border: 'none' }
    }
    return { ...base, backgroundColor: colors.white, color: colors.textPrimary, border: `1px solid ${colors.borderDefault}` }
  }

  return (
    <>
      <AnimatePresence>
        {count > 0 && (
        <motion.div
          key="bulk-bar"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'tween', duration: 0.15, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            bottom: spacing['6'],
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: zIndex.toast as number,
            display: 'flex',
            alignItems: 'center',
            gap: spacing['3'],
            padding: `${spacing['3']} ${spacing['5']}`,
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.xl,
            boxShadow: shadows.panel,
            border: `1px solid ${colors.borderDefault}`,
          }}
          role="toolbar"
          aria-label={`Bulk actions for ${count} selected ${entityLabel}`}
        >
          <span style={{
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.semibold,
            color: colors.primaryOrange,
            whiteSpace: 'nowrap',
          }}>
            {count} selected
          </span>

          {errorMsg && (
            <span
              role="alert"
              aria-live="assertive"
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.statusCritical,
                whiteSpace: 'nowrap',
                maxWidth: 240,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {errorMsg}
            </span>
          )}

          <div style={{ width: 1, height: 24, backgroundColor: colors.borderDefault }} />

          {actions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleAction(action)}
              disabled={loading !== null}
              aria-busy={loading === action.label}
              aria-label={loading === action.label ? `${action.label}, loading` : action.label}
              style={{
                ...getButtonStyle(action.variant),
                opacity: loading && loading !== action.label ? 0.5 : 1,
              }}
            >
              {loading === action.label ? (
                <Loader2 size={14} aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} />
              ) : action.icon ? (
                action.icon
              ) : null}
              {action.label}
            </button>
          ))}

          <div style={{ width: 1, height: 24, backgroundColor: colors.borderDefault }} />

          <button
            onClick={onClearSelection}
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: borderRadius.full,
              color: colors.textTertiary,
              transition: `background-color ${transitions.instant}`,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            aria-label="Clear selection"
          >
            <X size={16} />
          </button>
        </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <Dialog.Root open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: zIndex.modal as number,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Dialog.Content style={{
              width: 420,
              backgroundColor: colors.white,
              borderRadius: borderRadius.xl,
              boxShadow: shadows.panel,
              padding: spacing['6'],
              fontFamily: typography.fontFamily,
            }}
            aria-describedby="confirm-description"
            >
              <Dialog.Title style={{
                margin: 0, marginBottom: spacing['3'],
                fontSize: typography.fontSize.subtitle,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
              }}>
                Confirm Action
              </Dialog.Title>
              <p id="confirm-description" style={{
                margin: 0, marginBottom: spacing['5'],
                fontSize: typography.fontSize.body,
                color: colors.textSecondary,
                lineHeight: typography.lineHeight.relaxed,
              }}>
                {confirmAction?.confirmMessage || `This will affect ${count} ${entityLabel}. Are you sure?`}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'] }}>
                <button
                  onClick={() => setConfirmAction(null)}
                  style={{
                    padding: `0 ${spacing['5']}`,
                    minHeight: touchTarget.field,
                    fontSize: typography.fontSize.body,
                    fontFamily: typography.fontFamily,
                    fontWeight: typography.fontWeight.medium,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.md,
                    backgroundColor: colors.white,
                    color: colors.textSecondary,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmAction && executeAction(confirmAction)}
                  style={{
                    padding: `0 ${spacing['5']}`,
                    minHeight: touchTarget.field,
                    fontSize: typography.fontSize.body,
                    fontFamily: typography.fontFamily,
                    fontWeight: typography.fontWeight.semibold,
                    border: 'none',
                    borderRadius: borderRadius.md,
                    backgroundColor: confirmAction?.variant === 'danger' ? colors.statusCritical : colors.primaryOrange,
                    color: colors.white,
                    cursor: 'pointer',
                  }}
                >
                  {confirmAction?.label}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Overlay>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
