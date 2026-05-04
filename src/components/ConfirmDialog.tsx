import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../styles/theme'

/**
 * ConfirmDialog — the styled replacement for `window.confirm`.
 *
 * What it fixes vs the native dialog:
 *  - Matches the design system (parchment + ink, not OS chrome)
 *  - Renders entity context (the *thing* being deleted, not just text)
 *  - Cancel is auto-focused (safer default — Enter cancels, not confirms)
 *  - Escape + backdrop click both cancel
 *  - Confirm button is disabled while the async handler is in flight
 *  - Optional "type to confirm" mode for highly destructive actions
 *  - Keyboard nav respects modal trap
 *  - Works on mobile (no system alert popup)
 *
 * Usage:
 *
 *   const [confirmDelete, setConfirmDelete] = useState<RFI | null>(null)
 *
 *   <ConfirmDialog
 *     open={!!confirmDelete}
 *     title="Delete RFI?"
 *     description={`RFI #${confirmDelete?.number} — "${confirmDelete?.title}"`}
 *     destructiveLabel="Delete RFI"
 *     onConfirm={async () => {
 *       await deleteRfi.mutateAsync(confirmDelete!.id)
 *       setConfirmDelete(null)
 *     }}
 *     onCancel={() => setConfirmDelete(null)}
 *   />
 *
 * For type-to-confirm:
 *   <ConfirmDialog
 *     ...
 *     typeToConfirm="DELETE"
 *     description="This permanently deletes 247 items and cannot be undone."
 *   />
 */

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  /** Destructive button label. Defaults to "Confirm". */
  destructiveLabel?: string
  /** Cancel button label. Defaults to "Cancel". */
  cancelLabel?: string
  /** When set, user must type this string before the destructive button enables. */
  typeToConfirm?: string
  /** Called when the user confirms. May be async; UI disables both buttons during. */
  onConfirm: () => void | Promise<void>
  /** Called on Cancel / Escape / backdrop. */
  onCancel: () => void
  /** Optional extra body content (React node) rendered above the buttons. */
  children?: React.ReactNode
  /** When true, the destructive button uses `colors.statusCritical`. Default `true`. */
  destructive?: boolean
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  destructiveLabel = 'Confirm',
  cancelLabel = 'Cancel',
  typeToConfirm,
  onConfirm,
  onCancel,
  children,
  destructive = true,
}) => {
  const titleId = useId()
  const descId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [typed, setTyped] = useState('')

  // Lock body scroll while open. Auto-focus Cancel (safer default —
  // hitting Enter accidentally cancels rather than confirms).
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTyped('')
    setSubmitting(false)
    const t = setTimeout(() => cancelRef.current?.focus(), 60)
    return () => {
      document.body.style.overflow = prev
      clearTimeout(t)
    }
  }, [open])

  // Escape closes (unless mid-submit). Trap Tab inside the dialog.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        e.stopPropagation()
        onCancel()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [open, submitting, onCancel])

  const handleConfirm = useCallback(async () => {
    if (submitting) return
    if (typeToConfirm && typed !== typeToConfirm) return
    setSubmitting(true)
    try {
      await onConfirm()
    } finally {
      // If the parent unmounts the dialog (e.g. by clearing state),
      // setSubmitting(false) becomes a no-op on the unmounted component.
      // The cleanup useEffect resets it on next open. Either way safe.
      setSubmitting(false)
    }
  }, [submitting, typeToConfirm, typed, onConfirm])

  if (!open) return null

  const confirmDisabled =
    submitting || (typeToConfirm != null && typed !== typeToConfirm)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClick={() => {
        if (!submitting) onCancel()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: zIndex.modal as number,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.overlayDark,
        backdropFilter: 'blur(4px)',
        padding: spacing['4'],
      }}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          maxWidth: '100%',
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.xl,
          boxShadow: shadows.panel,
          padding: spacing['6'],
          display: 'flex',
          flexDirection: 'column',
          gap: spacing['4'],
          fontFamily: typography.fontFamily,
          position: 'relative',
        }}
      >
        {/* Close X */}
        <button
          onClick={onCancel}
          disabled={submitting}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: spacing['3'],
            right: spacing['3'],
            background: 'transparent',
            border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer',
            color: colors.textTertiary,
            padding: spacing['1'],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>

        {/* Title row with icon */}
        <div style={{ display: 'flex', gap: spacing['3'], alignItems: 'flex-start' }}>
          {destructive && (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: `${colors.statusCritical}20`,
                color: colors.statusCritical,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={20} />
            </div>
          )}
          <h2
            id={titleId}
            style={{
              margin: 0,
              fontSize: typography.fontSize.lg,
              fontWeight: typography.fontWeight.bold,
              color: colors.textPrimary,
              flex: 1,
              minWidth: 0,
            }}
          >
            {title}
          </h2>
        </div>

        {description && (
          <p
            id={descId}
            style={{
              margin: 0,
              fontSize: typography.fontSize.sm,
              color: colors.textSecondary,
              lineHeight: 1.5,
              wordBreak: 'break-word',
            }}
          >
            {description}
          </p>
        )}

        {children}

        {typeToConfirm && (
          <label style={{ display: 'block' }}>
            <span
              style={{
                display: 'block',
                fontSize: typography.fontSize.label,
                fontWeight: typography.fontWeight.medium,
                color: colors.textPrimary,
                marginBottom: spacing['2'],
              }}
            >
              Type{' '}
              <span style={{ fontFamily: typography.fontFamilyMono, color: colors.statusCritical }}>
                {typeToConfirm}
              </span>{' '}
              to confirm
            </span>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={submitting}
              autoComplete="off"
              spellCheck={false}
              style={{
                width: '100%',
                padding: `${spacing['3']} ${spacing['3']}`,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: borderRadius.md,
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
                backgroundColor: submitting ? colors.surfaceInset : colors.surfaceRaised,
                color: colors.textPrimary,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </label>
        )}

        {/* Buttons. Cancel first (auto-focused, safer) on the LEFT in
            the DOM but rendered on the RIGHT visually via flex-row-reverse
            so the destructive primary stays in the rightmost position
            (matches the rest of the app's modals). */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row-reverse',
            gap: spacing['3'],
            marginTop: spacing['2'],
          }}
        >
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirmDisabled}
            style={{
              padding: `${spacing['3']} ${spacing['4']}`,
              border: 'none',
              borderRadius: borderRadius.lg,
              backgroundColor: confirmDisabled
                ? `${destructive ? colors.statusCritical : colors.primaryOrange}80`
                : destructive
                  ? colors.statusCritical
                  : colors.primaryOrange,
              color: colors.white,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily,
              cursor: confirmDisabled ? 'not-allowed' : 'pointer',
              minHeight: 56,
              minWidth: 140,
            }}
          >
            {submitting ? 'Working…' : destructiveLabel}
          </button>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={{
              padding: `${spacing['3']} ${spacing['4']}`,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.lg,
              backgroundColor: colors.surfaceRaised,
              color: colors.textPrimary,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily,
              cursor: submitting ? 'not-allowed' : 'pointer',
              minHeight: 56,
              minWidth: 100,
            }}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog

/**
 * useConfirm — hook-style API for callers that prefer imperative confirm flow.
 *
 *   const { confirm, dialog } = useConfirm()
 *
 *   const handleDelete = async () => {
 *     const ok = await confirm({
 *       title: 'Delete RFI?',
 *       description: `RFI #${rfi.number} — "${rfi.title}"`,
 *       destructiveLabel: 'Delete RFI',
 *     })
 *     if (!ok) return
 *     await deleteRfi.mutateAsync(rfi.id)
 *   }
 *
 *   return (
 *     <>
 *       <button onClick={handleDelete}>Delete</button>
 *       {dialog}
 *     </>
 *   )
 */

interface ConfirmRequest extends Omit<ConfirmDialogProps, 'open' | 'onConfirm' | 'onCancel'> {}

export function useConfirm(): {
  confirm: (req: ConfirmRequest) => Promise<boolean>
  dialog: React.ReactElement | null
} {
  const [pending, setPending] = useState<{
    req: ConfirmRequest
    resolve: (v: boolean) => void
  } | null>(null)

  const confirm = useCallback((req: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      setPending({ req, resolve })
    })
  }, [])

  const dialog = pending
    ? (
      <ConfirmDialog
        {...pending.req}
        open
        onConfirm={async () => {
          pending.resolve(true)
          setPending(null)
        }}
        onCancel={() => {
          pending.resolve(false)
          setPending(null)
        }}
      />
    )
    : null

  return { confirm, dialog }
}
