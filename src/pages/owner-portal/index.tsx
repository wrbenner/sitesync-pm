// ─────────────────────────────────────────────────────────────────────────────
// Owner Portal page (Tab S, Wave 2)
// ─────────────────────────────────────────────────────────────────────────────
// Thin shell that mounts <OwnerStream> with whatever projectId / project
// metadata it was hydrated with. The route wrapper (MagicLinkOwnerRoute)
// validates the magic-link token and passes the project context in.
//
// This module exists as a separate file (rather than importing OwnerStream
// directly from MagicLinkOwnerRoute) so the page is React.lazy-friendly
// from App.tsx and so a future authenticated /owner-portal preview can
// reuse the same view.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { OwnerStream } from './OwnerStream'

export interface OwnerPortalPageProps {
  projectId: string
  projectName: string | null
  projectAddress: string | null
}

const OwnerPortalPage: React.FC<OwnerPortalPageProps> = (props) => (
  <OwnerStream {...props} />
)

export default OwnerPortalPage
