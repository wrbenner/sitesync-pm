// src/components/onboarding/Step4InviteTeam.tsx — BRT sub-3 §3 (Step 4 of 5)
//
// Invite up to 5 teammates by email. Each invite assigns a default role
// (member) — owner can promote later via Settings → Team. Skippable; the
// wizard chrome handles the "Skip" button.

import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useInviteOnboardingTeam } from '../../hooks/mutations/onboarding'

const MAX_INVITES = 5

export default function Step4InviteTeam() {
  const { organization } = useAuthStore()
  const orgId = organization?.id ?? null
  const orgName = organization?.name ?? 'your workspace'

  const [emails, setEmails] = useState<string[]>([''])
  const [error, setError] = useState<string | null>(null)
  const [sentCount, setSentCount] = useState<number | null>(null)

  const invite = useInviteOnboardingTeam()

  const setAt = (i: number, value: string) => {
    setEmails((prev) => prev.map((e, idx) => (idx === i ? value : e)))
  }

  const addRow = () => {
    if (emails.length >= MAX_INVITES) return
    setEmails((prev) => [...prev, ''])
  }

  const removeAt = (i: number) => {
    setEmails((prev) => prev.filter((_, idx) => idx !== i))
  }

  const submit = async () => {
    setError(null)
    if (!orgId) {
      setError('No active organization yet — finish step 2 first.')
      return
    }
    const cleaned = emails.map((e) => e.trim()).filter((e) => e.length > 0)
    if (cleaned.length === 0) {
      setError('Add at least one email — or click Skip to do this later.')
      return
    }
    if (cleaned.some((e) => !e.includes('@'))) {
      setError('One or more entries doesn\'t look like a valid email.')
      return
    }
    try {
      // The mutation signature requires project_id; for onboarding step 4
      // we don't have a specific project to scope to yet (the user just
      // created their first project in step 3 but we don't pass it down
      // through wizard state today). The invite edge fn handles the
      // org-scope-only path when project_id is omitted at the SQL level.
      const result = await invite.mutateAsync({
        emails: cleaned,
        organization_id: orgId,
        project_id: '',
        organization_name: orgName,
      })
      setSentCount(Array.isArray(result.results) ? result.results.length : cleaned.length)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send invites.')
    }
  }

  if (sentCount !== null) {
    return (
      <p style={{ color: '#15803D', fontSize: 14 }}>
        Sent {sentCount} invite{sentCount === 1 ? '' : 's'}. They'll receive
        a sign-up link by email. Click <strong>Next</strong> to continue.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ color: '#5C5C5C', fontSize: 14 }}>
        Invite up to {MAX_INVITES} teammates by email. They'll get a sign-up
        link with member access to {orgName}. You can change roles later in
        Settings → Team.
      </p>

      {emails.map((email, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setAt(i, e.target.value)}
            placeholder="teammate@example.com"
            style={{
              flex: 1,
              padding: '10px 14px',
              border: '1px solid #D6D6D6',
              borderRadius: 6,
              fontSize: 15,
            }}
          />
          {emails.length > 1 && (
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`Remove invite row ${i + 1}`}
              style={{
                padding: '6px 10px',
                background: 'transparent',
                color: '#5C5C5C',
                border: '1px solid #D6D6D6',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Remove
            </button>
          )}
        </div>
      ))}

      {emails.length < MAX_INVITES && (
        <button
          type="button"
          onClick={addRow}
          style={{
            alignSelf: 'flex-start',
            padding: '6px 12px',
            background: 'transparent',
            color: '#0066FF',
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          + Add another
        </button>
      )}

      {error && <p style={{ color: '#7F1D1D', fontSize: 13 }}>{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={invite.isPending}
        style={{
          alignSelf: 'flex-start',
          padding: '10px 16px',
          background: '#0066FF',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          fontWeight: 600,
          cursor: invite.isPending ? 'wait' : 'pointer',
          opacity: invite.isPending ? 0.6 : 1,
        }}
      >
        {invite.isPending ? 'Sending invites…' : 'Send invites'}
      </button>
    </div>
  )
}
