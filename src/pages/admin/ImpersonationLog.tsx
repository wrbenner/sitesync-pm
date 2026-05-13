// src/pages/admin/ImpersonationLog.tsx — BRT sub-6 §4.5
//
// Internal-admin audit history of every impersonation session ever opened.
// Hard requirement: never deletable, never editable. The table itself
// (impersonation_sessions) has no UPDATE/DELETE RLS policy for admins.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Loader2 } from 'lucide-react'

interface SessionRow {
  id: string
  admin_user_id: string
  target_user_id: string | null
  target_org_id: string
  reason: string
  started_at: string
  ended_at: string | null
  expires_at: string
  notification_sent_at: string | null
}

export default function ImpersonationLog() {
  const { data, isLoading, error } = useQuery<SessionRow[]>({
    queryKey: ['admin', 'impersonation-log'],
    queryFn: async () => {
      // impersonation_sessions was added by Day 3 catch-up migration;
      // generated database types lag. Use as-never until next types regen.
      const { data: rows, error: e } = await supabase
        .from('impersonation_sessions' as never)
        .select('id, admin_user_id, target_user_id, target_org_id, reason, started_at, ended_at, expires_at, notification_sent_at' as never)
        .order('started_at' as never, { ascending: false })
        .limit(200)
      if (e) throw new Error(e.message)
      return (rows as SessionRow[] | null) ?? []
    },
  })

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 28, marginTop: 0, marginBottom: 4 }}>Impersonation Audit Log</h1>
      <p style={{ color: '#5C5C5C', marginTop: 0, marginBottom: 24 }}>
        Every impersonation session, append-only. Customer was notified before each session token was issued.
      </p>

      {isLoading && <Loader2 size={20} style={{ animation: 'spin-loader 0.8s linear infinite' }} />}
      <style>{`@keyframes spin-loader { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {error && (
        <p role="alert" style={{ padding: 12, background: '#FEE2E2', color: '#7F1D1D', borderRadius: 6 }}>
          {error instanceof Error ? error.message : 'Failed to load log'}
        </p>
      )}

      {data && (
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#F9FAFB' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #E5E7EB' }}>Started</th>
                <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #E5E7EB' }}>Admin</th>
                <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #E5E7EB' }}>Target org</th>
                <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #E5E7EB' }}>Reason</th>
                <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #E5E7EB' }}>Ended</th>
                <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #E5E7EB' }}>Notified</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: 10, fontFamily: 'monospace', color: '#5C5C5C' }}>{new Date(r.started_at).toLocaleString()}</td>
                  <td style={{ padding: 10, fontFamily: 'monospace', fontSize: 11 }}>{r.admin_user_id.slice(0, 8)}…</td>
                  <td style={{ padding: 10, fontFamily: 'monospace', fontSize: 11 }}>{r.target_org_id.slice(0, 8)}…</td>
                  <td style={{ padding: 10 }}>{r.reason}</td>
                  <td style={{ padding: 10, color: '#5C5C5C' }}>{r.ended_at ? new Date(r.ended_at).toLocaleString() : <em>active</em>}</td>
                  <td style={{ padding: 10, color: r.notification_sent_at ? '#0E6F4D' : '#B91C1C' }}>
                    {r.notification_sent_at ? '✓' : '✗'}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#5C5C5C' }}>No impersonation sessions recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
