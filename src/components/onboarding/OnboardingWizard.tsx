// src/components/onboarding/OnboardingWizard.tsx — BRT sub-3 §3
//
// Wizard shell that mounts Step 1–5. Owns: current step, role pick (the
// Step-1 selection lives here so Step 3/5 can tailor copy), progress bar,
// back / next / skip controls, and the "Finish" → mark-complete →
// /day handoff.
//
// Per spec §4.1: steps 1 and 2 cannot be skipped; steps 3, 4, 5 can.
// On step 5 finish: `useMarkOnboardingComplete` writes onboarded_at,
// then we route to /day.
//
// State is kept in-memory only. Resumable-across-sessions persistence
// (users.onboarding_step) is deferred to the BRT sub-3 §4.1 migration
// slice; the in-memory version covers the 90-second happy path.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useMarkOnboardingComplete } from '../../hooks/mutations/onboarding'
import { useOnboardingState } from '../../hooks/useOnboardingState'
import Step1RolePick, { type OnboardingRole } from './Step1RolePick'
import Step2OrgDetails from './Step2OrgDetails'
import Step3FirstProject from './Step3FirstProject'
import Step4InviteTeam from './Step4InviteTeam'
import Step5MeetIris from './Step5MeetIris'

type StepNumber = 1 | 2 | 3 | 4 | 5

const STEPS: { id: StepNumber; title: string; subtitle: string; skippable: boolean }[] = [
  { id: 1, title: 'Welcome', subtitle: 'Tell us how you use SiteSync.', skippable: false },
  { id: 2, title: 'Your workspace', subtitle: 'Confirm the name on your exports and invites.', skippable: false },
  { id: 3, title: 'Your first project', subtitle: 'Five fields, defaults for the rest.', skippable: true },
  { id: 4, title: 'Invite your team', subtitle: 'Add up to five teammates. Skip and do it later.', skippable: true },
  { id: 5, title: 'Meet Iris', subtitle: 'Sixty-second tour of the AI assistant.', skippable: true },
]

export default function OnboardingWizard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const markComplete = useMarkOnboardingComplete()
  // BRT sub-3 §4.1: persistent step state (profiles.onboarding_step).
  const { step: persistedStep, setStep: persistStep, markCompleted } = useOnboardingState()

  const [role, setRole] = useState<OnboardingRole | null>(null)
  const [finishError, setFinishError] = useState<string | null>(null)

  const step = (Math.min(Math.max(persistedStep, 1), 5)) as StepNumber
  const meta = STEPS.find((s) => s.id === step)!

  const canAdvance = step !== 1 || role !== null

  const goNext = () => {
    if (step < 5) persistStep(step + 1)
  }

  const goBack = () => {
    if (step > 1) persistStep(step - 1)
  }

  const finish = async () => {
    setFinishError(null)
    if (!user?.id) {
      setFinishError('No active session — sign in again to finish.')
      return
    }
    try {
      markCompleted()
      await markComplete.mutateAsync({ user_id: user.id })
      navigate('/day', { replace: true })
    } catch (e) {
      setFinishError(e instanceof Error ? e.message : 'Could not finalize onboarding.')
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F8F8F5',
        padding: '32px 16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ width: '100%', maxWidth: 640 }}>
        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }} aria-label={`Step ${step} of 5`}>
          {STEPS.map((s) => (
            <div
              key={s.id}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: s.id <= step ? '#0066FF' : '#E5E7EB',
                transition: 'background-color 0.2s ease',
              }}
            />
          ))}
        </div>

        {/* Step header */}
        <div style={{ marginBottom: 20 }}>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.6,
              color: '#5C5C5C',
              textTransform: 'uppercase',
            }}
          >
            Step {step} of 5
          </p>
          <h1
            style={{
              margin: '4px 0 6px',
              fontFamily: '"EB Garamond", Garamond, "Times New Roman", serif',
              fontStyle: 'italic',
              fontSize: 32,
              fontWeight: 500,
              color: '#1A1A1A',
              letterSpacing: '-0.01em',
              lineHeight: 1.1,
            }}
          >
            {meta.title}
          </h1>
          <p style={{ margin: 0, color: '#5C5C5C', fontSize: 14 }}>{meta.subtitle}</p>
        </div>

        {/* Step body — white card */}
        <div
          style={{
            background: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: 12,
            padding: 24,
            marginBottom: 16,
          }}
        >
          {step === 1 && <Step1RolePick value={role} onChange={setRole} />}
          {step === 2 && <Step2OrgDetails />}
          {step === 3 && <Step3FirstProject />}
          {step === 4 && <Step4InviteTeam />}
          {step === 5 && <Step5MeetIris />}
        </div>

        {finishError && (
          <p
            role="alert"
            style={{
              color: '#7F1D1D',
              fontSize: 13,
              margin: '0 0 12px',
              padding: '8px 12px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 6,
            }}
          >
            {finishError}
          </p>
        )}

        {/* Wizard chrome */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={goBack}
            disabled={step === 1}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              color: step === 1 ? '#A3A3A3' : '#1A1A1A',
              border: '1px solid #D6D6D6',
              borderRadius: 6,
              fontWeight: 500,
              cursor: step === 1 ? 'not-allowed' : 'pointer',
              opacity: step === 1 ? 0.5 : 1,
            }}
          >
            ← Back
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            {meta.skippable && step < 5 && (
              <button
                type="button"
                onClick={goNext}
                style={{
                  padding: '10px 14px',
                  background: 'transparent',
                  color: '#5C5C5C',
                  border: 'none',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Skip
              </button>
            )}

            {step < 5 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!canAdvance}
                style={{
                  padding: '10px 20px',
                  background: canAdvance ? '#0066FF' : '#BFD3FE',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: canAdvance ? 'pointer' : 'not-allowed',
                }}
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                disabled={markComplete.isPending}
                style={{
                  padding: '10px 20px',
                  background: '#0066FF',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: markComplete.isPending ? 'wait' : 'pointer',
                  opacity: markComplete.isPending ? 0.7 : 1,
                }}
              >
                {markComplete.isPending ? 'Finishing…' : 'Finish'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
