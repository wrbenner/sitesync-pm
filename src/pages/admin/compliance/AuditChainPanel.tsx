/**
 * AuditChainPanel — hash-chain integrity status for the active project.
 *
 * Reads `audit_log` rows (chronological), runs the lib's verifyChain(),
 * surfaces total entries + last-verified timestamp + any chain breaks.
 * "Re-verify now" button forces a refetch.
 */

import React, { useMemo, useState } from 'react'
import { ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { spacing, colors, typography, borderRadius } from '../../../styles/theme'
import { Skeleton, EmptyState, Btn } from '../../../components/Primitives'
import { supabase } from '../../../lib/supabase'
import { verifyChain, type AuditLogRow, type ChainVerificationResult } from '../../../lib/audit/hashChainVerifier'
import { KpiTile, StatusPill, DegradedBanner } from './_kit'

export const AuditChainPanel: React.FC<{ projectId: string | undefined }> = ({ projectId }) => {
  const qc = useQueryClient()
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null)

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['audit-chain', projectId],
    enabled: !!projectId,
    staleTime: 30_000,
    queryFn: async (): Promise<{ rows: AuditLogRow[]; result: ChainVerificationResult; partial: boolean }> => {
      // Pull the chronological run of audit_log rows for the project.
      const { data: rows, error } = await supabase
        .from('audit_log')
        .select('id, created_at, user_id, user_email, user_name, project_id, organization_id, entity_type, entity_id, action, before_state, after_state, changed_fields, metadata, previous_hash, entry_hash')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: true })
        .limit(2000)
      // Older audit_log rows may be missing the chain-hash columns (created
      // before the 20260426 migration). Treat the missing-column error as
      // "chain not yet enabled" rather than failing.
      if (error && /column .* does not exist/i.test(error.message)) {
        return { rows: [], result: { ok: true, total: 0, gaps: [] }, partial: true }
      }
      const typed = (rows ?? []) as unknown as AuditLogRow[]
      const result = await verifyChain(typed)
      setVerifiedAt(new Date().toISOString())
      return { rows: typed, result, partial: false }
    },
  })

  const handleReverify = () => {
    void qc.invalidateQueries({ queryKey: ['audit-chain', projectId] })
  }

  const result = data?.result
  const total = result?.total ?? 0
  const gapCount = result?.gaps.length ?? 0
  const ok = !!result?.ok
  const headerLabel = useMemo(() => {
    if (!result) return 'Not yet verified'
    if (data?.partial) return 'Chain not enabled on this deployment'
    if (ok) return 'Chain intact'
    return `${gapCount} chain ${gapCount === 1 ? 'break' : 'breaks'} detected`
  }, [result, ok, gapCount, data])

  if (isLoading) return <Skeleton width="100%" height="240px" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      {error && (
        <DegradedBanner message="Could not load audit_log — check RLS + service role grants." />
      )}
      {data?.partial && (
        <DegradedBanner message="audit_log is missing the entry_hash / previous_hash columns. Apply the 20260426000001_audit_log_hash_chain migration to enable chain verification." />
      )}

      {/* Header status banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['3'],
        padding: spacing['4'],
        backgroundColor: ok && !data?.partial ? colors.statusActiveSubtle
                       : data?.partial ? colors.surfaceInset
                       : colors.statusCriticalSubtle,
        border: `1px solid ${ok && !data?.partial ? colors.statusActive : data?.partial ? colors.borderDefault : colors.statusCritical}`,
        borderRadius: borderRadius.lg,
      }}>
        {ok && !data?.partial
          ? <ShieldCheck size={20} color={colors.statusActive} />
          : <AlertTriangle size={20} color={data?.partial ? colors.textSecondary : colors.statusCritical} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            {headerLabel}
          </div>
          {verifiedAt && (
            <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: 2 }}>
              Last verified: {new Date(verifiedAt).toLocaleString()}
            </div>
          )}
        </div>
        <Btn variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={handleReverify} disabled={isFetching}>
          {isFetching ? 'Re-verifying…' : 'Re-verify now'}
        </Btn>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['3'] }}>
        <KpiTile label="Total entries" value={total} hint="audit_log rows in scope" />
        <KpiTile label="Chain breaks" value={gapCount} tone={gapCount > 0 ? 'critical' : 'success'} />
        <KpiTile label="Status" value={ok ? 'OK' : data?.partial ? '—' : 'BROKEN'} tone={ok && !data?.partial ? 'success' : data?.partial ? 'default' : 'critical'} />
      </div>

      {/* Gaps table */}
      {gapCount === 0 && total > 0 && !data?.partial && (
        <EmptyState
          title="No chain gaps"
          description="Every audit_log row's previous_hash + entry_hash recompute matches. Chain integrity confirmed."
        />
      )}
      {gapCount > 0 && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            Chain gaps
          </div>
          {result.gaps.map(g => (
            <div key={g.row_id} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1.2fr 1fr 1fr',
              gap: spacing['2'],
              padding: `${spacing['2']} ${spacing['3']}`,
              backgroundColor: colors.statusCriticalSubtle,
              border: `1px solid ${colors.statusCritical}`,
              borderRadius: borderRadius.base,
              alignItems: 'center',
              fontSize: typography.fontSize.sm,
            }}>
              <span style={{ fontFamily: typography.fontFamilyMono, color: colors.statusCritical }}>{g.row_id.slice(0, 12)}…</span>
              <StatusPill tone="critical" label={g.reason.replace(/_/g, ' ')} />
              <span style={{ fontFamily: typography.fontFamilyMono, color: colors.textSecondary }}>
                expected {g.expected ? `${g.expected.slice(0, 16)}…` : '∅'}
              </span>
              <span style={{ fontFamily: typography.fontFamilyMono, color: colors.textPrimary }}>
                actual {g.actual ? `${g.actual.slice(0, 16)}…` : '∅'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
