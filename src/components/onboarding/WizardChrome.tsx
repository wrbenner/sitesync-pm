// src/components/onboarding/WizardChrome.tsx — BRT sub-3 §4.1
//
// 5-step wizard shell. Renders a progress bar, the active step body, and
// back/next/skip navigation. Step bodies are passed in as a tuple so the
// chrome stays decoupled from any specific page.
//
// Each step passes through useOnboardingState's advance/complete on its
// own "next" — chrome doesn't decide when to advance, only displays + nav.

import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingState } from '../../hooks/useOnboardingState'

export interface WizardStep {
  id: number
  title: string
  /** True if this step can be skipped (steps 3, 4, 5 per spec; 1 + 2 mandatory). */
  skippable: boolean
  body: ReactNode
}

export interface WizardChromeProps {
  steps: WizardStep[]
  /** Where to send the user after step 5 completes. Defaults to /day. */
  doneRedirect?: string
}

const STEP_COUNT = 5

export default function WizardChrome({ steps, doneRedirect = '/day' }: WizardChromeProps) {
  const navigate = useNavigate()
  const { step, loading, advance, complete } = useOnboardingState()

  // Clamp step to a valid index for the steps array. Step 0 = not started → show step 1.
  const activeIndex = Math.max(0, Math.min(STEP_COUNT - 1, step === 0 ? 0 : step - 1))
  const active = steps[activeIndex]
  if (!active) return null

  const onBack = () => {
    if (step <= 1) return
    void advance(step - 1)
  }
  const onNext = async () => {
    if (step >= STEP_COUNT - 1) {
      await complete()
      navigate(doneRedirect)
      return
    }
    await advance((step === 0 ? 1 : step) + 1)
  }
  const onSkip = async () => {
    if (!active.skippable) return
    await onNext()
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px', minHeight: '100vh' }}>
      <ProgressBar current={active.id} total={STEP_COUNT} />
      <h1 style={{ fontSize: 24, fontWeight: 600, marginTop: 24, marginBottom: 16 }}>
        {active.title}
      </h1>
      <div style={{ marginBottom: 32 }}>{active.body}</div>
      <nav style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="button"
          onClick={onBack}
          disabled={loading || step <= 1}
          style={{
            padding: '10px 16px',
            border: '1px solid #D6D6D6',
            background: 'white',
            borderRadius: 6,
            cursor: step <= 1 ? 'not-allowed' : 'pointer',
            opacity: step <= 1 ? 0.5 : 1,
          }}
        >
          Back
        </button>
        {active.skippable && (
          <button
            type="button"
            onClick={onSkip}
            disabled={loading}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              color: '#5C5C5C',
              cursor: 'pointer',
            }}
          >
            Skip
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={loading}
          style={{
            marginLeft: 'auto',
            padding: '10px 20px',
            background: '#0F172A',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {step >= STEP_COUNT - 1 ? 'Finish' : 'Next'}
        </button>
      </nav>
    </main>
  )
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={total} aria-label="Onboarding progress">
      <div style={{ display: 'flex', gap: 8 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              background: i < current ? '#0066FF' : '#EFEFEF',
              borderRadius: 2,
            }}
          />
        ))}
      </div>
      <p style={{ marginTop: 8, color: '#5C5C5C', fontSize: 13 }}>
        Step {current} of {total}
      </p>
    </div>
  )
}
