// src/pages/Settings/security/ImpersonationHistory.tsx — BRT sub-6 §4.6
//
// Customer-facing view: every time SiteSync staff entered this customer's
// account, with reason + duration. Builds trust + supports SOC 2 audit
// requests. Org members read their own org's history; no admin gates here.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { useActiveOrg } from '../../../hooks/useActiveOrg'
import { Loader2 } from 'lucide-react'

interface SessionRow {
  id: string
  admin_user_id: string
  reason: string
  started_at: string
  ended_at: string | null
  expires_at: string
  notification_sent_at: string | null
}

export default function ImpersonationHistory() {
  const { orgId } = useActiveOrg()

  const { data, isLoading, error } = useQuery<SessionRow[]>({
    queryKey: ['impersonation-history', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data: rows, error: e } = await supabase
        .from('impersonation_sessions' as never)
        .select('id, admin_user_id, reason, started_at, ended_at, expires_at, notification_sent_at' as never)
        .eq('target_org_id' as never, orgId)
        .order('started_at' as never, { ascending: false })
        .limit(50)
      if (e) throw new Error(e.message)
      return (rows as SessionRow[] | null) ?? []
    },
    enabled: !!orgId,
  })

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 28, marginTop: 0, marginBottom: 4 }}>SiteSync Staff Access History</h1>
      <p style={{ color: '#5C5C5C', marginTop: 0, marginBottom: 24, lineHeight: 1.5 }}>
        Every time a SiteSync support agent entered your account is logged here, including the reason
        and how long the session lasted. You were notified by email each time before the session began.
      </p>

      {isLoading && <Loader2 size={20} style={{ animation: 'spin-loader 0.8s linear infinite' }} />}
      <style>{`@keyframes spin-loader { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {error && (
        <p role="alert" style={{ padding: 12, background: '#FEE2E2', color: '#7F1D1D', borderRadius: 6 }}>
          {error instanceof Error ? error.message : 'Failed to load history'}
        </p>
      )}

      {data && data.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: '#5C5C5C', background: 'white', border: '1px solid #E5E7EB', borderRadius: 8 }}>
          No staff has accessed your account.
        </div>
      )}

      {data && data.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.map((r) => (
            <div key={r.id} style={{ padding: 16, background: 'white', border: '1px solid #E5E7EB', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <strong style={{ fontSize: 14 }}>{new Date(r.started_at).toLocaleString()}</strong>
                <span style={{ fontSize: 12, color: r.ended_at ? '#5C5C5C' : '#B45309' }}>
                  {r.ended_at ? `Ended ${new Date(r.ended_at).toLocaleTimeString()}` : 'Still active'}
                </span>
              </div>
              <p style={{ margin: 0, color: '#1A1A1A', fontSize: 14, lineHeight: 1.5 }}>
                <strong>Reason:</strong> {r.reason}
              </p>
              {r.notification_sent_at && (
                <p style={{ margin: '6px 0 0', color: '#0E6F4D', fontSize: 12 }}>
                  You were notified at {new Date(r.notification_sent_at).toLocaleTimeString()}.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
