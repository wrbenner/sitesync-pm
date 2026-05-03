/**
 * FeatureGate — conditionally renders children based on a feature flag.
 *
 * Usage in routes:
 *
 *   <FeatureGate flag="bimViewer" fallback={<Navigate to="/dashboard" replace />}>
 *     <BIMViewerPage />
 *   </FeatureGate>
 *
 * When the flag is OFF the fallback renders (defaults to null — the route
 * simply disappears).  When the flag is ON, children render normally.
 *
 * Flags are set via VITE_FLAG_<KEY>=true in .env.local.  See
 * src/lib/featureFlags.ts for the full flag registry.
 */

import React from 'react'
import { FLAGS, type FlagKey } from '../../lib/featureFlags'

interface FeatureGateProps {
  flag: FlagKey
  /** Rendered when the flag is OFF. Defaults to null (nothing). */
  fallback?: React.ReactNode
  children: React.ReactNode
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  flag,
  fallback = null,
  children,
}) => {
  return FLAGS[flag] ? <>{children}</> : <>{fallback}</>
}

export default FeatureGate
