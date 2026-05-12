// src/components/onboarding/Step1RolePick.tsx — BRT sub-3 §3 (Step 1 of 5)
//
// "I am a..." role picker. Determines downstream copy + which sample data
// is seeded in step 3. Persisted to profiles.trade so future sessions resume
// with the same role context.

import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'

const ROLES = [
  { id: 'gc',         label: 'General Contractor',           hint: 'You run multi-trade construction projects' },
  { id: 'sub',        label: 'Subcontractor',                hint: 'You install one or more trades' },
  { id: 'owner',      label: 'Owner / Developer',            hint: 'You commission projects, hire GCs + design' },
  { id: 'architect',  label: 'Architect / Designer',         hint: 'You produce drawings, specs, and respond to RFIs' },
] as const

export default function Step1RolePick() {
  const { user, profile, loadProfile } = useAuthStore()
  const [pending, setPending] = useState<string | null>(null)
  const current = (profile as { onboarding_role?: string | null } | null)?.onboarding_role ?? null

  const pick = async (role: string) => {
    if (!user) return
    setPending(role)
    const { error } = await supabase
      .from('profiles')
      // Cast: db-types:write regen needed to surface onboarding_role on the
      // typed payload; safe at runtime (column exists per migration 20261009000006).
      .update({ onboarding_role: role } as never)
      .eq('user_id', user.id)
    if (!error) await loadProfile()
    setPending(null)
  }

  return (
    <div>
      <p style={{ color: '#5C5C5C', marginBottom: 16 }}>
        Pick your role. We'll tailor the rest of onboarding around how you'll
        actually use SiteSync.
      </p>
      <div style={{ display: 'grid', gap: 12 }}>
        {ROLES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => pick(r.id)}
            disabled={pending !== null}
            style={{
              textAlign: 'left',
              padding: 16,
              border: current === r.id ? '2px solid #0066FF' : '1px solid #D6D6D6',
              borderRadius: 8,
              background: 'white',
              cursor: 'pointer',
              opacity: pending && pending !== r.id ? 0.6 : 1,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 15 }}>{r.label}</div>
            <div style={{ color: '#5C5C5C', fontSize: 13, marginTop: 4 }}>{r.hint}</div>
            {current === r.id && (
              <div style={{ color: '#0066FF', fontSize: 12, marginTop: 8, fontWeight: 600 }}>
                ✓ Selected — click Next to continue
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
