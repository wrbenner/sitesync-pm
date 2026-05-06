// Phase 1 placeholder for /submittals/settings.
//
// The full Submittal Settings UI ships in Phase 8 of the rebuild plan
// (SUBMITTALS_PAGE_REBUILD_PLAN_2026-05-06.md). Phase 1 wires the Settings
// gear in the page header to navigate here so the silhouette matches
// Procore parity even before the settings panes land.

import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Settings } from 'lucide-react'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  surface: '#FCFCFA',
  border: 'rgba(26, 22, 19, 0.10)',
  brandOrange: '#F47820',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const SubmittalSettingsPage: React.FC = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100%',
      backgroundColor: C.surface,
      fontFamily: FONT,
      color: C.ink,
    }}
  >
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 24px',
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <Link
        to="/submittals"
        aria-label="Back to submittals"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          color: C.ink2,
          textDecoration: 'none',
          fontSize: 12,
          padding: '4px 8px',
          borderRadius: 4,
        }}
      >
        <ArrowLeft size={14} />
        Submittals
      </Link>
      <span style={{ color: C.ink3 }}>/</span>
      <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
        Settings
      </h1>
    </header>

    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 32,
        textAlign: 'center',
      }}
    >
      <Settings size={32} color={C.ink3} />
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
        Submittal settings — coming in Phase 8
      </h2>
      <p style={{ margin: 0, fontSize: 13, color: C.ink3, maxWidth: 460, lineHeight: 1.5 }}>
        Codeset picker (EJCDC / AIA / UFGS / Custom), workflow templates per trade, response
        types, distribution defaults, email matrix, and federal/UFGS toggles all ship together
        in Phase 8 of the rebuild plan.
      </p>
      <p style={{ margin: 0, fontSize: 12, color: C.ink3 }}>
        See <code style={{ fontFamily: 'inherit' }}>docs/audits/SUBMITTALS_PAGE_REBUILD_PLAN.md</code>.
      </p>
    </main>
  </div>
)

export { SubmittalSettingsPage }
export default SubmittalSettingsPage
