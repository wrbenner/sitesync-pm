// src/pages/onboarding/OnboardingWizard.tsx — BRT sub-3 §4.1
//
// Wraps WizardChrome with the 5 step components. Steps 3, 4, 5 are
// placeholder bodies that the next slice fleshes out (CreateProject form
// extraction for step 3, useInviteOnboardingTeam wiring for step 4,
// Iris demo for step 5). Spec section §3 lists the bodies to ship.

import { lazy, Suspense } from 'react'
import WizardChrome, { type WizardStep } from '../../components/onboarding/WizardChrome'

const Step1RolePick = lazy(() => import('../../components/onboarding/Step1RolePick'))
const Step2OrgDetails = lazy(() => import('../../components/onboarding/Step2OrgDetails'))

function StepPlaceholder({ title }: { title: string }) {
  return (
    <div style={{ color: '#5C5C5C', fontSize: 14 }}>
      <p>
        <strong>{title}</strong> ships in the next slice. For now, click <em>Skip</em>
        {' '}or <em>Next</em> to advance.
      </p>
    </div>
  )
}

const STEPS: WizardStep[] = [
  {
    id: 1,
    title: 'I am a…',
    skippable: false,
    body: <Suspense fallback={null}><Step1RolePick /></Suspense>,
  },
  {
    id: 2,
    title: 'Workspace details',
    skippable: false,
    body: <Suspense fallback={null}><Step2OrgDetails /></Suspense>,
  },
  {
    id: 3,
    title: 'Your first project',
    skippable: true,
    body: <StepPlaceholder title="Project setup" />,
  },
  {
    id: 4,
    title: 'Invite your team',
    skippable: true,
    body: <StepPlaceholder title="Team invites" />,
  },
  {
    id: 5,
    title: 'Meet Iris, your AI assistant',
    skippable: true,
    body: <StepPlaceholder title="Iris demo" />,
  },
]

export default function OnboardingWizard() {
  return <WizardChrome steps={STEPS} doneRedirect="/day" />
}
