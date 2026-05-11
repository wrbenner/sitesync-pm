// ────────────────────────────────────────────────────────────────────────────
// HomePersonaSwitch — routes /home/iris to the user's persona-appropriate dashboard
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §6.1
//
// Phase 1d ships the 3 dashboards behind a single entry route (/home/iris).
// The full default-home re-routing lands in Phase 1e (the dashboards become
// the new default `/home` when the persona-eval gate clears).

import HomeForOffice from './HomeForOffice'
import HomeForPm from './HomeForPm'
import HomeForSuper from './HomeForSuper'

import { usePersona } from '../hooks/usePersona'

export default function HomePersonaSwitch() {
  const { persona } = usePersona()
  switch (persona) {
    case 'superintendent':
      return <HomeForSuper />
    case 'office':
      return <HomeForOffice />
    case 'pm':
    case 'foreman':
    case 'owner_rep':
    default:
      // Foreman + owner_rep dashboards ship Phase 1.5 per spec §6.1.
      // Until then, those personas land on the PM dashboard with the
      // fallback banner explaining the assignment.
      return <HomeForPm />
  }
}
