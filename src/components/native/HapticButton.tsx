// ── HapticButton ───────────────────────────────────────────────────────────
// Drop-in <button> that fires a haptic on click. The visual is identical
// to the rest of the app's buttons; the only difference is the
// fireHaptic call. On web the haptic is a no-op so behaviour is
// unchanged.
//
// Used everywhere a state-changing action lives (Save, Approve, Submit).

import React from 'react'
import { fireHaptic, type HapticPattern } from '../../lib/native/haptics'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Haptic pattern fired on click. Defaults to 'tap'. */
  haptic?: HapticPattern
  /** Optional override: skip the haptic entirely (e.g. when the parent
   *  component already fires one for the same action). */
  disableHaptic?: boolean
}

export const HapticButton = React.forwardRef<HTMLButtonElement, Props>(
  ({ haptic = 'tap', disableHaptic, onClick, children, ...rest }, ref) => {
    const handle = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disableHaptic) {
        // Fire-and-forget; never block the click handler on the haptic.
        void fireHaptic(haptic).catch(() => undefined)
      }
      onClick?.(e)
    }
    return (
      <button ref={ref} onClick={handle} {...rest}>
        {children}
      </button>
    )
  },
)
HapticButton.displayName = 'HapticButton'

export default HapticButton
