// src/components/onboarding/Step1RolePick.tsx — BRT sub-3 §3 (Step 1 of 5)
//
// Role pick. Drives downstream copy and which sample data the seeder
// populates. Required — user must pick before advancing.

export type OnboardingRole = 'gc' | 'sub' | 'owner' | 'architect'

interface Step1Props {
  value: OnboardingRole | null
  onChange: (role: OnboardingRole) => void
}

const ROLES: { id: OnboardingRole; label: string; tag: string; blurb: string }[] = [
  {
    id: 'gc',
    label: 'General Contractor',
    tag: 'GC',
    blurb: 'You run the project. RFIs, submittals, change orders, daily logs, schedule.',
  },
  {
    id: 'sub',
    label: 'Subcontractor',
    tag: 'Sub',
    blurb: 'You own a trade scope. RFIs in your scope, submittals you deliver, payment apps.',
  },
  {
    id: 'owner',
    label: 'Owner / Developer',
    tag: 'Owner',
    blurb: 'You\'re funding the build. Budget summary, milestones, approval queue.',
  },
  {
    id: 'architect',
    label: 'Architect',
    tag: 'Arch',
    blurb: 'You authored the design. Drawing revisions, RFI responses, submittal review.',
  },
]

export default function Step1RolePick({ value, onChange }: Step1Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ color: '#5C5C5C', fontSize: 14, margin: 0 }}>
        I am a…
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {ROLES.map((r) => {
          const selected = value === r.id
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onChange(r.id)}
              aria-pressed={selected}
              style={{
                textAlign: 'left',
                padding: 16,
                borderRadius: 8,
                border: selected ? '2px solid #0066FF' : '1px solid #E5E7EB',
                background: selected ? '#EEF4FF' : 'white',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                transition: 'border-color 0.15s ease, background-color 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: selected ? '#1E3A8A' : '#5C5C5C',
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: selected ? '#BFDBFE' : '#F3F4F6',
                    letterSpacing: 0.4,
                  }}
                >
                  {r.tag}
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{r.label}</span>
              </div>
              <span style={{ fontSize: 13, color: '#5C5C5C', lineHeight: 1.4 }}>{r.blurb}</span>
            </button>
          )
        })}
      </div>

      <p style={{ color: '#5C5C5C', fontSize: 12, margin: 0 }}>
        We use this to tailor the sample data and prompts — you can change it later in Settings.
      </p>
    </div>
  )
}
