import React from 'react'
import { useUiStore } from '../../stores'

const srOnlyStyle: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

// Global live region that announces status changes to screen readers.
// Render once at the root level so there is a single source of truth.
export function LiveRegion() {
  const statusMessage = useUiStore((s) => s.a11yStatusMessage)
  const alertMessage = useUiStore((s) => s.a11yAlertMessage)

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={srOnlyStyle}
      >
        {statusMessage}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        style={srOnlyStyle}
      >
        {alertMessage}
      </div>
    </>
  )
}
