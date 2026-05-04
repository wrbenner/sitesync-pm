/**
 * Notifications · Inbox.
 *
 * Read-only list of the user's notifications, grouped by entity type.
 * Wraps the existing notifications table; we don't own the schema.
 */

import React, { useEffect, useState } from 'react'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { Eyebrow, Hairline, PageQuestion } from '../../components/atoms'
import { supabase } from '../../lib/supabase'

interface NotificationRow {
  id: string
  title: string
  body: string | null
  severity: string
  entity_type: string | null
  entity_id: string | null
  created_at: string
  read_at: string | null
}

export const InboxPage: React.FC = () => {
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase
        .from('notifications')
        .select('id, title, body, severity, entity_type, entity_id, created_at, read_at')
        .order('created_at', { ascending: false })
        .limit(100)
      if (!mounted) return
      setRows((data as unknown as NotificationRow[]) ?? [])
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [])

  const groups = rows.reduce<Record<string, NotificationRow[]>>((acc, r) => {
    const k = r.entity_type ?? 'general'
    acc[k] ??= []
    acc[k].push(r)
    return acc
  }, {})

  return (
    <div style={{ padding: spacing['8'], maxWidth: 960, minHeight: '100vh', backgroundColor: colors.surface }}>
      <Eyebrow>Inbox</Eyebrow>
      <PageQuestion size="medium" style={{ marginTop: spacing['2'] }}>
        What needs my attention?
      </PageQuestion>
      <Hairline />

      {loading && <div style={{ color: colors.textTertiary }}>Loading…</div>}

      {!loading && rows.length === 0 && (
        <div style={{ padding: spacing['6'], color: colors.textTertiary, textAlign: 'center' }}>
          No notifications.
        </div>
      )}

      {Object.entries(groups).map(([entity, list]) => (
        <section key={entity} style={{ marginBottom: spacing['6'] }}>
          <Eyebrow>{entity.toUpperCase()} · {list.length}</Eyebrow>
          <ul style={{ listStyle: 'none', padding: 0, margin: `${spacing['2']} 0 0 0` }}>
            {list.map((r) => (
              <li
                key={r.id}
                style={{
                  padding: spacing['3'],
                  marginBottom: spacing['2'],
                  borderRadius: borderRadius.md,
                  backgroundColor: r.read_at ? 'transparent' : colors.surfaceInset,
                  border: `1px solid ${colors.borderSubtle}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing['2'] }}>
                  <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>
                    {r.title}
                  </div>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                {r.body && (
                  <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginTop: spacing['1'] }}>
                    {r.body}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export default InboxPage
