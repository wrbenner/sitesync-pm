// ────────────────────────────────────────────────────────────────────────────
// HomeForOffice — PM Coordinator / AP / Accounting persona dashboard
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §3.2 (office) + §6

import { PersonaDashboardShell, type PersonaCardSpec } from '../components/iris/dashboard/PersonaDashboardShell'
import { usePersona } from '../hooks/usePersona'

const OFFICE_CARDS: PersonaCardSpec[] = [
  {
    id: 'lien_waivers_outstanding',
    title: 'Lien waivers outstanding',
    description: 'Conditional + unconditional waivers due before pay app cutoff.',
    placeholder: 'Connected in Phase 4.',
  },
  {
    id: 'certified_payroll_due',
    title: 'Certified payroll due dates',
    description: 'Upcoming WH-347 submissions across active prevailing-wage projects.',
    placeholder: 'Connected in Phase 4.',
  },
  {
    id: 'pay_app_cycle',
    title: 'Pay app cycle status',
    description: 'Where each project sits in its monthly billing cycle.',
    placeholder: 'Connected in Phase 4.',
  },
  {
    id: 'co_log_delta',
    title: 'CO log delta vs. ledger',
    description: 'Change orders authorized but not yet posted to the accounting ledger.',
    placeholder: 'Connected in Phase 4.',
    cta: { label: 'Open change orders', to: '/change-orders' },
  },
  {
    id: 'contracts_awaiting_countersignature',
    title: 'Contracts awaiting countersignature',
    description: 'Sent + signed by counterparty; missing our countersign.',
    placeholder: 'Connected in Phase 4.',
    cta: { label: 'Open contracts', to: '/contracts' },
  },
  {
    id: 'insurance_expiring_30d',
    title: 'Insurance certificates expiring < 30d',
    description: 'Subcontractor COIs or our own policies approaching expiration.',
    placeholder: 'Connected in Phase 4.',
  },
]

export default function HomeForOffice() {
  const { resolved } = usePersona()
  return <PersonaDashboardShell persona="office" resolved={resolved} cards={OFFICE_CARDS} />
}
