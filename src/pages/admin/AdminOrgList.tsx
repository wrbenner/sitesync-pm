// src/pages/admin/AdminOrgList.tsx — BRT sub-6 §4.4
//
// Internal-admin list of every org. Route-gated by profiles.is_internal_admin.
// Click an org → AdminOrgDetail.

import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Loader2 } from 'lucide-react'

interface OrgRow {
  id: string
  name: string
  slug: string | null
  plan: string | null
  created_at: string
}

export default function AdminOrgList() {
  const { data, isLoading, error } = useQuery<OrgRow[]>({
    queryKey: ['admin', 'orgs'],
    queryFn: async () => {
      const { data: res, error: e } = await supabase.functions.invoke('admin-list-orgs')
      if (e) throw new Error(e.message ?? 'Failed to list orgs')
      const payload = res as { organizations?: OrgRow[] } | null
      return payload?.organizations ?? []
    },
    staleTime: 30_000,
  })

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 28, marginTop: 0, marginBottom: 4 }}>Organizations</h1>
      <p style={{ color: '#5C5C5C', marginTop: 0, marginBottom: 24 }}>
        Internal admin view: visible only to SiteSync staff.
      </p>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: 32, color: '#5C5C5C' }}>
          <Loader2 size={20} style={{ animation: 'spin-loader 0.8s linear infinite' }} />
          <style>{`@keyframes spin-loader { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {error && (
        <p role="alert" style={{ padding: 12, background: '#FEE2E2', color: '#7F1D1D', borderRadius: 6 }}>
          {error instanceof Error ? error.message : 'Failed to load orgs'}
        </p>
      )}

      {data && (
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead style={{ background: '#F9FAFB' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #E5E7EB', fontWeight: 600 }}>Name</th>
                <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #E5E7EB', fontWeight: 600 }}>Slug</th>
                <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #E5E7EB', fontWeight: 600 }}>Plan</th>
                <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #E5E7EB', fontWeight: 600 }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: 12 }}>
                    <Link to={`/admin/orgs/${o.id}`} style={{ color: '#0066FF', textDecoration: 'none', fontWeight: 500 }}>
                      {o.name}
                    </Link>
                  </td>
                  <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 13, color: '#5C5C5C' }}>{o.slug ?? '—'}</td>
                  <td style={{ padding: 12 }}>{o.plan ?? '—'}</td>
                  <td style={{ padding: 12, color: '#5C5C5C' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#5C5C5C' }}>
                    No organizations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
