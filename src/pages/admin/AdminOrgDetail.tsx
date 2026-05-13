// src/pages/admin/AdminOrgDetail.tsx — BRT sub-6 §4.4
//
// Per-org admin detail. Shows summary + "Impersonate" button. The impersonate
// flow posts to start-impersonation; the customer-notification contract
// (Sub-6 §4.3 — notify before JWT) is enforced server-side.

import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Loader2, ArrowLeft } from 'lucide-react'

interface OrgDetail {
  id: string
  name: string
  slug: string | null
  plan: string | null
  created_at: string
}

export default function AdminOrgDetail() {
  const { id } = useParams<{ id: string }>()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resultMsg, setResultMsg] = useState<string | null>(null)
  const [resultErr, setResultErr] = useState<string | null>(null)

  const { data, isLoading } = useQuery<OrgDetail | null>({
    queryKey: ['admin', 'org', id],
    queryFn: async () => {
      if (!id) return null
      const { data: res, error } = await supabase.functions.invoke('admin-list-orgs')
      if (error) throw new Error(error.message ?? 'Failed to load org')
      const orgs = (res as { organizations?: OrgDetail[] } | null)?.organizations ?? []
      return orgs.find((o) => o.id === id) ?? null
    },
    enabled: !!id,
  })

  const startImpersonation = async () => {
    if (!id || !reason.trim()) {
      setResultErr('Reason is required (will be recorded in audit log + shown to customer).')
      return
    }
    setSubmitting(true)
    setResultErr(null)
    setResultMsg(null)
    const { data: res, error } = await supabase.functions.invoke('start-impersonation', {
      body: {
        target_org_id: id,
        reason: reason.trim(),
        duration_minutes: 30,
      },
    })
    setSubmitting(false)
    if (error) {
      setResultErr(error.message ?? 'Could not start impersonation')
      return
    }
    const payload = res as { session_id?: string; expires_at?: string } | null
    setResultMsg(`Session opened (${payload?.session_id ?? 'unknown'}). Expires ${payload?.expires_at ?? '—'}. Customer has been notified.`)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <Link to="/admin/orgs" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#5C5C5C', textDecoration: 'none', marginBottom: 16, fontSize: 14 }}>
        <ArrowLeft size={14} /> All organizations
      </Link>

      {isLoading && <Loader2 size={20} style={{ animation: 'spin-loader 0.8s linear infinite' }} />}
      <style>{`@keyframes spin-loader { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {data && (
        <>
          <h1 style={{ fontSize: 28, marginTop: 0, marginBottom: 4 }}>{data.name}</h1>
          <p style={{ color: '#5C5C5C', marginTop: 0, marginBottom: 24, fontFamily: 'monospace', fontSize: 13 }}>
            {data.id} · slug: {data.slug ?? '—'} · plan: {data.plan ?? '—'} · created {new Date(data.created_at).toLocaleDateString()}
          </p>

          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, padding: 20, marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 12 }}>Impersonate</h2>
            <p style={{ color: '#5C5C5C', fontSize: 13, lineHeight: 1.5, marginTop: 0, marginBottom: 12 }}>
              The customer will be notified <strong>before</strong> the session token is issued.
              Sessions auto-expire after 30 minutes. Reason is recorded in the audit log
              and shown to the customer in their impersonation history.
            </p>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Reason for impersonation</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer reported missing project after migration"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #D6D6D6', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
              />
            </label>
            <button
              type="button"
              onClick={startImpersonation}
              disabled={submitting || !reason.trim()}
              style={{
                padding: '10px 16px',
                background: !reason.trim() ? '#FEE2E2' : '#B91C1C',
                color: !reason.trim() ? '#B91C1C' : 'white',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                cursor: !reason.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Starting…' : 'Start impersonation session'}
            </button>

            {resultErr && <p role="alert" style={{ color: '#7F1D1D', fontSize: 13, marginTop: 12 }}>{resultErr}</p>}
            {resultMsg && <p role="status" style={{ color: '#0E6F4D', fontSize: 13, marginTop: 12 }}>{resultMsg}</p>}
          </div>
        </>
      )}
    </div>
  )
}
