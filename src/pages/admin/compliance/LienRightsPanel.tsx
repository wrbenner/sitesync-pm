/**
 * LienRightsPanel — preliminary-notice + lien-record deadline tracker.
 *
 * Cross-references project state + per-contract dates against the
 * `state_lien_rules` library. Surfaces overdue / today / one_day /
 * three_days / seven_days alert tiers. "Generate notice" stub button
 * per row routes to the lien-waiver-generator pathway when wired.
 */

import React, { useMemo } from 'react'
import { FileText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { spacing, colors, typography, borderRadius } from '../../../styles/theme'
import { Skeleton, EmptyState, Btn } from '../../../components/Primitives'

import { fromTable } from '../../../lib/db/queries'
import { computeDeadlines, alertTier, type StateLienRule } from '../../../lib/compliance/lienRights'
import { KpiTile, StatusPill, DegradedBanner, TableHeaderRow, TableBodyRow, type StatusPillTone } from './_kit'

type AlertTier = ReturnType<typeof alertTier>

const TIER_TONE: Record<AlertTier, StatusPillTone> = {
  overdue: 'critical',
  today: 'critical',
  one_day: 'warn',
  three_days: 'warn',
  seven_days: 'info',
  safe: 'success',
}
const TIER_LABEL: Record<AlertTier, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  one_day: 'Due in 1d',
  three_days: 'Due in ≤3d',
  seven_days: 'Due in ≤7d',
  safe: 'On track',
}

export const LienRightsPanel: React.FC<{ projectId: string | undefined }> = ({ projectId }) => {
  // ── Fetch project state + contracts + rules ──────────────────────
  const { data, isLoading, error } = useQuery({
    queryKey: ['lien-rights', projectId],
    enabled: !!projectId,
    staleTime: 60_000,
    queryFn: async () => {
      const [proj, contracts, rules] = await Promise.all([
        fromTable('projects').select('id, state, start_date, end_date').eq('id' as never, projectId!).maybeSingle(),
        fromTable('contracts').select('id, counterparty, type, start_date, end_date, original_value').eq('project_id' as never, projectId!).limit(200),
        fromTable('state_lien_rules').select('*').limit(500),
      ])
      return {
        project: proj.data,
        contracts: contracts.data ?? [],
        rules: (rules.data ?? []) as unknown as StateLienRule[],
        errors: [proj.error, contracts.error, rules.error].filter(Boolean),
      }
    },
  })

  // ── Compute one row per contract ─────────────────────────────────
  const rows = useMemo(() => {
    if (!data?.project || !data.contracts.length || !data.rules.length) return []
    const stateCode = (data.project.state as string) ?? 'TX'
    return data.contracts.map(c => {
      // Map contract type → claimant role. Default first_tier_sub for subs;
      // GC for prime contracts; everything else falls through to first_tier.
      const ctype = (c.type as string | null) ?? 'subcontract'
      const claimantRole: StateLienRule['claimant_role'] =
        ctype === 'prime' ? 'general_contractor' : 'first_tier_sub'

      const result = computeDeadlines(
        {
          stateCode,
          claimantRole,
          firstDayOfWork: (c.start_date as string | null) ?? (data.project!.start_date as string | null) ?? null,
          lastDayOfWork: (c.end_date as string | null) ?? (data.project!.end_date as string | null) ?? null,
        },
        data.rules,
      )

      // Pick the most-imminent tier across the three deadlines.
      const tiers: Array<{ deadline: string; tier: AlertTier; kind: string }> = []
      if (result.preliminaryNoticeDeadline) {
        tiers.push({ deadline: result.preliminaryNoticeDeadline, tier: alertTier(result.preliminaryNoticeDeadline), kind: 'Prelim notice' })
      }
      if (result.lienRecordDeadline) {
        tiers.push({ deadline: result.lienRecordDeadline, tier: alertTier(result.lienRecordDeadline), kind: 'Lien record' })
      }
      const sortRank: Record<AlertTier, number> = { overdue: 0, today: 1, one_day: 2, three_days: 3, seven_days: 4, safe: 5 }
      tiers.sort((a, b) => sortRank[a.tier] - sortRank[b.tier])
      const next = tiers[0]

      return {
        contractId: c.id as string,
        counterparty: (c.counterparty as string) ?? 'Unknown',
        state: stateCode,
        contractDate: (c.start_date as string | null) ?? '—',
        nextDeadline: next?.deadline ?? null,
        nextKind: next?.kind ?? null,
        tier: next?.tier ?? 'safe',
        warnings: result.warnings,
      }
    })
  }, [data])

  const stats = useMemo(() => {
    let overdue = 0, soon = 0, safe = 0, unresolved = 0
    for (const r of rows) {
      if (r.tier === 'overdue' || r.tier === 'today') overdue += 1
      else if (r.tier === 'one_day' || r.tier === 'three_days') soon += 1
      else if (r.tier === 'seven_days') soon += 1
      else if (r.tier === 'safe') safe += 1
      if (r.warnings.length > 0 && !r.nextDeadline) unresolved += 1
    }
    return { overdue, soon, safe, unresolved }
  }, [rows])

  if (isLoading) return <Skeleton width="100%" height="320px" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      {(error || (data?.errors.length ?? 0) > 0) && (
        <DegradedBanner message="Some inputs failed to load (projects.state, contracts, or state_lien_rules). Computations run on partial data." />
      )}
      {data && data.rules.length === 0 && (
        <DegradedBanner message="No state_lien_rules seeded. Apply the lien-rules migration; the deadline calculator returns empty until rules exist." />
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['3'] }}>
        <KpiTile label="Overdue / today" value={stats.overdue} tone={stats.overdue > 0 ? 'critical' : 'default'} />
        <KpiTile label="Due ≤7d" value={stats.soon} tone={stats.soon > 0 ? 'warn' : 'default'} />
        <KpiTile label="On track" value={stats.safe} tone="success" />
        <KpiTile label="No rule resolved" value={stats.unresolved} tone={stats.unresolved > 0 ? 'warn' : 'default'} hint="missing project state or rule row" />
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <EmptyState
          title="No contracts to evaluate"
          description="Contracts with a counterparty drive the deadline calculator. Add a contract to see lien rights tracked here."
        />
      ) : (
        <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.lg, overflow: 'hidden' }}>
          <TableHeaderRow
            template="2fr 70px 110px 1.2fr 110px 1fr 130px"
            columns={['Contractor', 'State', 'Contract date', 'Next deadline', 'Type', 'Status', 'Action']}
          />
          {rows.map((r, i) => (
            <TableBodyRow key={r.contractId} template="2fr 70px 110px 1.2fr 110px 1fr 130px" alt={i % 2 === 0}>
              <span style={{ fontWeight: typography.fontWeight.medium }}>{r.counterparty}</span>
              <span style={{ fontFamily: typography.fontFamilyMono, color: colors.textSecondary }}>{r.state}</span>
              <span style={{ fontFamily: typography.fontFamilyMono, color: colors.textSecondary }}>{r.contractDate}</span>
              <span style={{ fontFamily: typography.fontFamilyMono, color: colors.textPrimary }}>
                {r.nextDeadline ?? <span style={{ color: colors.textTertiary }}>—</span>}
              </span>
              <span style={{ color: colors.textSecondary, fontSize: typography.fontSize.caption }}>
                {r.nextKind ?? '—'}
              </span>
              <StatusPill tone={TIER_TONE[r.tier as AlertTier]} label={TIER_LABEL[r.tier as AlertTier]} />
              <Btn variant="ghost" size="sm" icon={<FileText size={12} />}>Generate notice</Btn>
            </TableBodyRow>
          ))}
        </div>
      )}
    </div>
  )
}
