/**
 * Notifications · Preferences.
 *
 * Per-event-type channel matrix, DND window + tz, digest schedule,
 * critical-bypass toggle. Mirrors the matrix pattern from
 * usePermissions.PERMISSION_MATRIX.
 */

import React, { useEffect, useState } from 'react'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { Eyebrow, Hairline, PageQuestion, SectionHeading } from '../../components/atoms'
import { supabase } from '../../lib/supabase'
import type { UserNotificationPreferences, NotificationEventType, ChannelMatrixEntry } from '../../types/notifications'
import { defaultPreferences } from '../../lib/notifications/preferences'

const EVENT_ROWS: Array<{ id: NotificationEventType; label: string }> = [
  { id: 'rfi.assigned', label: 'RFI assigned to me' },
  { id: 'rfi.due_soon', label: 'RFI due soon' },
  { id: 'rfi.overdue', label: 'RFI overdue' },
  { id: 'rfi.responded', label: 'RFI responded' },
  { id: 'submittal.assigned', label: 'Submittal assigned' },
  { id: 'submittal.overdue', label: 'Submittal overdue' },
  { id: 'change_order.pending_approval', label: 'CO pending approval' },
  { id: 'punch_item.assigned', label: 'Punch item assigned' },
  { id: 'punch_item.overdue', label: 'Punch item overdue' },
  { id: 'pay_app.pending_review', label: 'Pay app pending' },
  { id: 'inspection.scheduled', label: 'Inspection scheduled' },
  { id: 'inspection.failed', label: 'Inspection failed' },
  { id: 'workflow.step_required', label: 'Workflow step required' },
  { id: 'iris.suggestion', label: 'Iris suggestion' },
  { id: 'system.alert', label: 'System alert' },
]

const DEFAULT_ROW: ChannelMatrixEntry = { in_app: true, email: false, push: false, digest: false }

export const PreferencesPage: React.FC = () => {
  const [prefs, setPrefs] = useState<UserNotificationPreferences | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) return
      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      if (!mounted) return
      setPrefs((data as UserNotificationPreferences) ?? defaultPreferences(userId))
    })()
    return () => {
      mounted = false
    }
  }, [])

  if (!prefs) {
    return (
      <div style={{ padding: spacing['8'], color: colors.textTertiary }}>Loading…</div>
    )
  }

  const setChannel = (event: NotificationEventType, channel: keyof ChannelMatrixEntry, value: boolean) => {
    const current = prefs.channels[event] ?? DEFAULT_ROW
    setPrefs({
      ...prefs,
      channels: { ...prefs.channels, [event]: { ...current, [channel]: value } },
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      await supabase.from('notification_preferences').upsert({
        user_id: prefs.user_id,
        channels: prefs.channels,
        dnd_start: prefs.dnd_start ?? null,
        dnd_end: prefs.dnd_end ?? null,
        dnd_timezone: prefs.dnd_timezone ?? null,
        digest_schedule: prefs.digest_schedule ?? null,
        bypass_dnd_for_critical: prefs.bypass_dnd_for_critical,
        suggestion_frequency: prefs.suggestion_frequency,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: spacing['8'], maxWidth: 960, minHeight: '100vh', backgroundColor: colors.surface }}>
      <Eyebrow>Notifications · Preferences</Eyebrow>
      <PageQuestion size="medium" style={{ marginTop: spacing['2'] }}>
        How should we reach you?
      </PageQuestion>
      <Hairline />

      <SectionHeading level={3}>Channel matrix</SectionHeading>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: spacing['3'] }}>
        <thead>
          <tr>
            <th style={th()}>Event</th>
            <th style={th()}>In-app</th>
            <th style={th()}>Email</th>
            <th style={th()}>Push</th>
            <th style={th()}>Digest</th>
          </tr>
        </thead>
        <tbody>
          {EVENT_ROWS.map((row) => {
            const current = prefs.channels[row.id] ?? DEFAULT_ROW
            return (
              <tr key={row.id}>
                <td style={td()}>{row.label}</td>
                {(['in_app', 'email', 'push', 'digest'] as const).map((c) => (
                  <td key={c} style={td('center')}>
                    <input
                      type="checkbox"
                      checked={current[c]}
                      onChange={(e) => setChannel(row.id, c, e.target.checked)}
                      aria-label={`${row.label} via ${c}`}
                    />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>

      <Hairline />
      <SectionHeading level={3}>Do not disturb</SectionHeading>
      <div style={{ display: 'flex', gap: spacing['3'], alignItems: 'center', marginTop: spacing['3'] }}>
        <label>
          <Eyebrow>Start</Eyebrow>
          <input
            type="time"
            value={prefs.dnd_start ?? ''}
            onChange={(e) => setPrefs({ ...prefs, dnd_start: e.target.value })}
            style={inputStyle()}
          />
        </label>
        <label>
          <Eyebrow>End</Eyebrow>
          <input
            type="time"
            value={prefs.dnd_end ?? ''}
            onChange={(e) => setPrefs({ ...prefs, dnd_end: e.target.value })}
            style={inputStyle()}
          />
        </label>
        <label>
          <Eyebrow>Timezone</Eyebrow>
          <input
            type="text"
            placeholder="America/Chicago"
            value={prefs.dnd_timezone ?? ''}
            onChange={(e) => setPrefs({ ...prefs, dnd_timezone: e.target.value })}
            style={inputStyle()}
          />
        </label>
      </div>
      <label style={{ display: 'flex', gap: spacing['2'], alignItems: 'center', marginTop: spacing['3'] }}>
        <input
          type="checkbox"
          checked={prefs.bypass_dnd_for_critical}
          onChange={(e) => setPrefs({ ...prefs, bypass_dnd_for_critical: e.target.checked })}
        />
        <span style={{ fontSize: typography.fontSize.sm }}>Critical alerts bypass DND</span>
      </label>

      <Hairline />
      <SectionHeading level={3}>Iris suggestions</SectionHeading>
      <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['3'] }}>
        {(['off', 'occasional', 'always'] as const).map((freq) => (
          <button
            key={freq}
            type="button"
            onClick={() => setPrefs({ ...prefs, suggestion_frequency: freq })}
            style={{
              padding: `${spacing['2']} ${spacing['3']}`,
              border: `1px solid ${prefs.suggestion_frequency === freq ? colors.primaryOrange : colors.borderDefault}`,
              backgroundColor: prefs.suggestion_frequency === freq ? colors.primaryOrange : 'transparent',
              color: prefs.suggestion_frequency === freq ? colors.white : colors.textSecondary,
              borderRadius: borderRadius.md,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
            }}
          >
            {freq}
          </button>
        ))}
      </div>

      <Hairline />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        style={{
          padding: `${spacing['2']} ${spacing['5']}`,
          backgroundColor: colors.primaryOrange,
          color: colors.white,
          border: 'none',
          borderRadius: borderRadius.md,
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          cursor: saving ? 'not-allowed' : 'pointer',
          fontFamily: typography.fontFamily,
        }}
      >
        {saving ? 'Saving…' : 'Save preferences'}
      </button>
    </div>
  )
}

function th(): React.CSSProperties {
  return {
    padding: spacing['2'],
    fontSize: typography.fontSize.caption,
    color: colors.textTertiary,
    textAlign: 'left',
    borderBottom: `1px solid ${colors.borderSubtle}`,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  }
}

function td(align: 'left' | 'center' = 'left'): React.CSSProperties {
  return {
    padding: spacing['2'],
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    borderBottom: `1px solid ${colors.borderSubtle}`,
    textAlign: align,
  }
}

function inputStyle(): React.CSSProperties {
  return {
    display: 'block',
    marginTop: spacing['1'],
    padding: spacing['2'],
    fontSize: typography.fontSize.sm,
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: borderRadius.sm,
    fontFamily: typography.fontFamily,
  }
}

export default PreferencesPage
