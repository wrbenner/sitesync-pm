// ────────────────────────────────────────────────────────────────────────────
// HomeForPm — Project Manager persona dashboard
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §3.2 (pm) + §6
// Card list comes directly from the spec; Phase 4 wires the data fetchers.

import { PersonaDashboardShell, type PersonaCardSpec } from '../components/iris/dashboard/PersonaDashboardShell'
import { usePersona } from '../hooks/usePersona'

const PM_CARDS: PersonaCardSpec[] = [
  {
    id: 'rfis_awaiting_response',
    title: 'RFIs awaiting response',
    description: 'Open RFIs past their due date, sorted by days overdue.',
    placeholder: 'Connected in Phase 4 (per-page coverage).',
    cta: { label: 'Open RFIs', to: '/rfis' },
  },
  {
    id: 'submittals_overdue',
    title: 'Submittals overdue ≥ 3 days',
    description: 'Submittal packages out for review past their lead time.',
    placeholder: 'Connected in Phase 4.',
    cta: { label: 'Open Submittals', to: '/submittals' },
  },
  {
    id: 'schedule_slip_risk',
    title: 'Schedule slip risk',
    description: 'Critical-path activities trending behind their baseline.',
    placeholder: 'Connected in Phase 4.',
    cta: { label: 'Open schedule', to: '/schedule' },
  },
  {
    id: 'budget_exposure',
    title: 'Budget exposure',
    description: 'Committed vs. authorized vs. CO exposure for this project.',
    placeholder: 'Connected in Phase 4.',
    cta: { label: 'Open budget', to: '/budget' },
  },
  {
    id: 'drafted_actions_inbox',
    title: 'Drafted actions inbox',
    description: 'Iris-drafted next steps awaiting your approval.',
    placeholder: 'Connected in Phase 4.',
    cta: { label: 'Open Iris inbox', to: '/iris' },
  },
  {
    id: 'oac_today',
    title: "Today's OAC topics",
    description: 'Items to review before the next owner-architect-contractor sync.',
    placeholder: 'Connected in Phase 4.',
  },
  {
    id: 'lookahead_conflicts',
    title: 'Lookahead conflict warnings',
    description: '3-week lookahead conflicts surfaced from the scheduled-insights pipeline.',
    placeholder: 'Connected in Phase 4.',
  },
]

export default function HomeForPm() {
  const { resolved } = usePersona()
  return <PersonaDashboardShell persona="pm" resolved={resolved} cards={PM_CARDS} />
}
