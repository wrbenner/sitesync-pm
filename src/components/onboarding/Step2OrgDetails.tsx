// src/components/onboarding/Step2OrgDetails.tsx — BRT sub-3 §3 (Step 2 of 5)
//
// Confirm org name (prefilled from signup), pick timezone. Logo upload is
// deferred to Settings → Workspace; making it required would block the
// 90-second sign-up-to-dashboard target.

import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { fromTable } from '../../lib/db/queries'

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
]

export default function Step2OrgDetails() {
  const { organization, setCurrentOrg } = useAuthStore()
  const orgId = organization?.id ?? null

  // Lazy-init so the prefilled name comes through even if the org loads
  // before this component renders (no useEffect setState needed).
  const [name, setName] = useState(() => organization?.name ?? '')
  const [tz, setTz] = useState<string>(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    } catch {
      return 'UTC'
    }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setError(null)
    if (!orgId) {
      setError('No active organization. Sign in again to continue.')
      return
    }
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setError('Workspace name is required.')
      return
    }
    setSaving(true)
    const { data, error: updateErr } = await fromTable('organizations')
      .update({ name: trimmed, settings: { timezone: tz } } as never)
      .eq('id' as never, orgId)
      .select()
      .single()
    if (updateErr) {
      setError(updateErr.message || 'Could not save workspace details.')
      setSaving(false)
      return
    }
    if (data && organization) {
      setCurrentOrg({ ...organization, name: trimmed })
    }
    setSaved(true)
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ color: '#5C5C5C', fontSize: 14, margin: 0 }}>
        We pulled this from your sign-up. Confirm it looks right: it shows up on PDF exports,
        invite emails, and the audit chain footer.
      </p>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
          Workspace name <span style={{ color: '#B91C1C' }}>*</span>
        </span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (saved) setSaved(false)
          }}
          placeholder="Acme Builders"
          style={{
            padding: '10px 14px',
            border: '1px solid #D6D6D6',
            borderRadius: 6,
            fontSize: 15,
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>Timezone</span>
        <select
          value={tz}
          onChange={(e) => {
            setTz(e.target.value)
            if (saved) setSaved(false)
          }}
          style={{
            padding: '10px 14px',
            border: '1px solid #D6D6D6',
            borderRadius: 6,
            fontSize: 15,
            background: 'white',
            width: '100%',
          }}
        >
          {COMMON_TIMEZONES.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
      </label>

      {error && <p style={{ color: '#7F1D1D', fontSize: 13, margin: 0 }}>{error}</p>}

      {saved ? (
        <p style={{ color: '#15803D', fontSize: 14, margin: 0 }}>
          Saved. Click <strong>Next</strong> to continue.
        </p>
      ) : (
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            alignSelf: 'flex-start',
            padding: '10px 16px',
            background: '#0066FF',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save workspace'}
        </button>
      )}
    </div>
  )
}
