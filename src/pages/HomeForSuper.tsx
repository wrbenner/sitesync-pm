// ────────────────────────────────────────────────────────────────────────────
// HomeForSuper — Superintendent persona dashboard
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §3.2 (superintendent) + §6

import { PersonaDashboardShell, type PersonaCardSpec } from '../components/iris/dashboard/PersonaDashboardShell'
import { usePersona } from '../hooks/usePersona'

const SUPER_CARDS: PersonaCardSpec[] = [
  {
    id: 'todays_crews',
    title: "Today's crews + manpower",
    description: 'Crew counts vs. plan for the day, by trade.',
    placeholder: 'Connected in Phase 4.',
    cta: { label: 'Open daily log', to: '/daily-log' },
  },
  {
    id: 'weather_14d',
    title: '14-day weather impact map',
    description: 'Forecast windows aligned to outdoor activities.',
    placeholder: 'Connected in Phase 4.',
  },
  {
    id: 'rfis_blocking_field',
    title: 'Open RFIs blocking field work',
    description: 'RFIs flagged with field-blocker status.',
    placeholder: 'Connected in Phase 4.',
    cta: { label: 'Open RFIs', to: '/rfis' },
  },
  {
    id: 'safety_walk_followups',
    title: 'Safety walk follow-ups',
    description: 'Outstanding items from recent safety walks.',
    placeholder: 'Connected in Phase 4.',
  },
  {
    id: 'daily_log_finalize',
    title: "Yesterday's daily log",
    description: 'Awaiting your finalize tap.',
    placeholder: 'Connected in Phase 4.',
    cta: { label: 'Open daily log', to: '/daily-log' },
  },
  {
    id: 'photos_pending',
    title: 'Photos awaiting captioning',
    description: 'Untagged jobsite photos from the field.',
    placeholder: 'Connected in Phase 4.',
  },
]

export default function HomeForSuper() {
  const { resolved } = usePersona()
  return (
    <PersonaDashboardShell persona="superintendent" resolved={resolved} cards={SUPER_CARDS} />
  )
}
