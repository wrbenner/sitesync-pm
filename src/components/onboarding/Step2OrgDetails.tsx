// src/components/onboarding/Step2OrgDetails.tsx — BRT sub-3 §3 (Step 2 of 5)
//
// Confirm org name (prefilled from signup) + pick timezone. Logo upload is
// optional and intentionally not blocking — most users don't have a logo
// file at hand during signup.

import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
] as const

export default function Step2OrgDetails() {
  const { organization, loadOrganization } = useAuthStore()
  // Lazy init from organization name so the field starts populated; user
  // edits override. No effect needed — re-mounts re-init from current org.
  const [name, setName] = useState(() => organization?.name ?? '')
  const [timezone, setTimezone] = useState<string>('America/Chicago')
  const [pending, setPending] = useState(false)

  const save = async () => {
    if (!organization) return
    setPending(true)
    const settings = { ...((organization.settings as Record<string, unknown>) ?? {}), timezone }
    const { error } = await supabase
      .from('organizations')
      .update({ name: name.trim(), settings })
      .eq('id', organization.id)
    if (!error) await loadOrganization()
    setPending(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <p style={{ color: '#5C5C5C' }}>
        Confirm your workspace details. You can change these any time in
        Settings → Workspace.
      </p>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>Workspace name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Construction"
          style={{
            padding: '10px 14px',
            border: '1px solid #D6D6D6',
            borderRadius: 6,
            fontSize: 15,
          }}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>Time zone</span>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          style={{
            padding: '10px 14px',
            border: '1px solid #D6D6D6',
            borderRadius: 6,
            fontSize: 15,
            background: 'white',
          }}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={save}
        disabled={pending || name.trim().length < 2}
        style={{
          alignSelf: 'flex-start',
          padding: '10px 16px',
          background: '#0066FF',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          fontWeight: 600,
          cursor: pending ? 'wait' : 'pointer',
        }}
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
