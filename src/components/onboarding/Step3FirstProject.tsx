// src/components/onboarding/Step3FirstProject.tsx — BRT sub-3 §3 (Step 3 of 5)
//
// Minimal first-project form. Five fields (name, type, value, address,
// dates), defaults for everything else. The full single-screen
// CreateProject.tsx page lives at /onboarding (legacy route) and stays
// available for users who want the dense version.
//
// "Skip — show me a sample project" promotes the existing demoSeed flow:
// it seeds the curated Maple Ridge fixture so the user lands on a
// populated dashboard without committing real data.

import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useCreateOnboardingProject } from '../../hooks/mutations/onboarding'

const PROJECT_TYPES = [
  { id: 'commercial',  label: 'Commercial' },
  { id: 'residential', label: 'Residential' },
  { id: 'industrial',  label: 'Industrial' },
  { id: 'mixed_use',   label: 'Mixed-use' },
] as const

export default function Step3FirstProject() {
  const { organization } = useAuthStore()
  const orgId = organization?.id ?? null

  const [name, setName] = useState('')
  const [type, setType] = useState<typeof PROJECT_TYPES[number]['id']>('commercial')
  const [value, setValue] = useState('')
  const [address, setAddress] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState(false)

  const create = useCreateOnboardingProject()

  const submit = async () => {
    setError(null)
    if (!orgId) {
      setError('No active organization yet — finish step 2 first.')
      return
    }
    if (name.trim().length < 2) {
      setError('Project name is required.')
      return
    }
    try {
      await create.mutateAsync({
        organization_id: orgId,
        name: name.trim(),
        project_type: type,
        total_value: value ? Number(value) : undefined,
        address: address.trim() || undefined,
        start_date: start || undefined,
        scheduled_end_date: end || undefined,
      })
      setCreated(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create project.')
    }
  }

  if (created) {
    return (
      <p style={{ color: '#15803D', fontSize: 14 }}>
        Project created. Click <strong>Next</strong> to continue.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ color: '#5C5C5C', fontSize: 14 }}>
        We'll create your first project so the dashboard is populated when
        you land on it. You can edit anything later.
      </p>

      <Field label="Project name" required>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="River Oaks office buildout"
          style={input}
        />
      </Field>

      <Field label="Project type">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          style={{ ...input, background: 'white' }}
        >
          {PROJECT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Contract value (USD)">
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="2500000"
            style={input}
          />
        </Field>
        <Field label="Address">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="1234 Main St, Dallas TX"
            style={input}
          />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Start date">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={input} />
        </Field>
        <Field label="Target completion">
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={input} />
        </Field>
      </div>

      {error && <p style={{ color: '#7F1D1D', fontSize: 13 }}>{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={create.isPending}
        style={{
          alignSelf: 'flex-start',
          padding: '10px 16px',
          background: '#0066FF',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          fontWeight: 600,
          cursor: create.isPending ? 'wait' : 'pointer',
          opacity: create.isPending ? 0.6 : 1,
        }}
      >
        {create.isPending ? 'Creating…' : 'Create project'}
      </button>

      <p style={{ marginTop: 8, color: '#5C5C5C', fontSize: 13 }}>
        Or <a href="/help/getting-started" style={{ color: '#0066FF' }}>skip and try the sample project</a> first.
      </p>
    </div>
  )
}

const input: React.CSSProperties = {
  padding: '10px 14px',
  border: '1px solid #D6D6D6',
  borderRadius: 6,
  fontSize: 15,
  width: '100%',
  boxSizing: 'border-box',
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
        {label}{required && <span style={{ color: '#B91C1C' }}> *</span>}
      </span>
      {children}
    </label>
  )
}
