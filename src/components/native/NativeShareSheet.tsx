// ── NativeShareSheet ───────────────────────────────────────────────────────
// Wraps shareEntity() with a small inline trigger + a status toast. The
// caller passes the entity payload; we pick the best channel and surface
// success / cancel / fallback inline.

import React, { useState } from 'react'
import { Share } from 'lucide-react'
import { shareEntity, detectShareChannel, type ShareInput, type ShareResult } from '../../lib/native/share'
import { fireHaptic } from '../../lib/native/haptics'
import { colors, typography } from '../../styles/theme'
import { toast } from 'sonner'

interface Props {
  input: ShareInput
  /** Render a custom trigger element. Defaults to a primary button. */
  trigger?: (open: () => void) => React.ReactNode
  /** Optional callback after the share resolves. */
  onResult?: (result: ShareResult) => void
}

export const NativeShareSheet: React.FC<Props> = ({ input, trigger, onResult }) => {
  const [busy, setBusy] = useState(false)

  const fire = async () => {
    setBusy(true)
    void fireHaptic('tap').catch(() => undefined)
    const r = await shareEntity(input)
    setBusy(false)
    onResult?.(r)
    if (r.ok) {
      if (r.channel === 'fallback_copy') toast.success('Link copied to clipboard')
      else toast.success('Shared')
    } else if (r.error === 'cancelled') {
      // user cancelled — silent
    } else {
      toast.error(`Share failed: ${r.error ?? 'unsupported'}`)
    }
  }

  if (trigger) return <>{trigger(fire)}</>

  return (
    <button
      onClick={fire}
      disabled={busy}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 14px',
        border: `1px solid ${colors.border}`,
        borderRadius: 6,
        background: 'transparent',
        color: colors.textPrimary,
        fontWeight: typography.fontWeight.medium,
        fontSize: typography.fontSize.sm,
        cursor: busy ? 'wait' : 'pointer',
      }}
    >
      <Share size={12} /> Share
    </button>
  )
}

/** Small badge that shows which channel will be used. Useful in admin
 *  UIs to surface "this device will use the native iOS sheet" vs the
 *  web Share API vs copy-to-clipboard fallback. */
export const ShareChannelBadge: React.FC = () => {
  const [channel, setChannel] = useState<ShareResult['channel'] | null>(null)
  React.useEffect(() => {
    let cancelled = false
    void detectShareChannel().then((c) => { if (!cancelled) setChannel(c) })
    return () => { cancelled = true }
  }, [])
  if (!channel) return null
  const label =
    channel === 'native' ? 'Native sheet'
    : channel === 'web' ? 'Web Share'
    : channel === 'fallback_copy' ? 'Copy link'
    : 'Unsupported'
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        background: colors.surfaceInset,
        color: colors.textSecondary,
        fontSize: typography.fontSize.label,
      }}
    >
      {label}
    </span>
  )
}

export default NativeShareSheet
