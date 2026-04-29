/**
 * Compliance Cockpit — single pane of glass for the compliance officer.
 *
 * Operational density. The five panels (COI / WH-347 / OSHA 300 / Lien Rights
 * / Audit Chain) live in this one route so the once-a-week sweep is one URL,
 * one shortcut. No decorative motion — this dashboard is read fast and
 * exported faster.
 *
 * Each panel handles its own data load + graceful degradation. This file
 * just wires the chrome (header, project pill, tabs, refresh stamp).
 */

import React, { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '../../../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'
import { useProjectId } from '../../../hooks/useProjectId'
import { useProjectContext } from '../../../stores/projectContextStore'
import { CoiGapsPanel } from './CoiGapsPanel'
import { Wh347Panel } from './Wh347Panel'
import { Osha300Panel } from './Osha300Panel'
import { LienRightsPanel } from './LienRightsPanel'
import { AuditChainPanel } from './AuditChainPanel'

type TabKey = 'coi' | 'wh347' | 'osha300' | 'lien' | 'chain'

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: 'coi',     label: 'COI Gaps' },
  { key: 'wh347',   label: 'WH-347' },
  { key: 'osha300', label: 'OSHA 300' },
  { key: 'lien',    label: 'Lien Rights' },
  { key: 'chain',   label: 'Audit Chain' },
]

function formatHHMM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

const ComplianceCockpit: React.FC = () => {
  const qc = useQueryClient()
  const projectId = useProjectId()
  const activeProjectName = useProjectContext((s) => s.activeProject?.name ?? null)
  const [tab, setTab] = useState<TabKey>('coi')
  const [lastRefresh, setLastRefresh] = useState<Date>(() => new Date())

  const handleRefresh = () => {
    // Invalidate just the panels' queries — bounded to this page so we don't
    // thrash the rest of the app's caches.
    void qc.invalidateQueries({ queryKey: ['insurance_certificates', projectId] })
    void qc.invalidateQueries({ queryKey: ['wh347-data', projectId] })
    void qc.invalidateQueries({ queryKey: ['wh347-gen', projectId] })
    void qc.invalidateQueries({ queryKey: ['osha-incidents', projectId] })
    void qc.invalidateQueries({ queryKey: ['osha-project', projectId] })
    void qc.invalidateQueries({ queryKey: ['lien-rights', projectId] })
    void qc.invalidateQueries({ queryKey: ['audit-chain', projectId] })
    setLastRefresh(new Date())
  }

  return (
    <PageContainer
      title="Compliance"
      subtitle="COI · certified payroll · OSHA 300 · lien rights · audit chain — one project, one screen."
    >
      {/* Header strip: project pill + last-refresh stamp + refresh button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['3'],
        flexWrap: 'wrap',
        marginBottom: spacing['4'],
      }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: spacing['2'],
          padding: `${spacing['1.5']} ${spacing['3']}`,
          borderRadius: borderRadius.full,
          backgroundColor: colors.surfaceInset,
          border: `1px solid ${colors.borderSubtle}`,
          fontSize: typography.fontSize.sm,
          color: colors.textSecondary,
          fontFamily: typography.fontFamily,
        }}>
          <ShieldCheck size={14} color={colors.primaryOrange} />
          <span style={{ color: colors.textTertiary }}>Project:</span>
          <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
            {activeProjectName ?? (projectId ? projectId.slice(0, 8) + '…' : 'No project selected')}
          </span>
        </span>
        <span style={{
          fontSize: typography.fontSize.caption,
          color: colors.textTertiary,
          fontFamily: typography.fontFamily,
        }}>
          last refreshed: {formatHHMM(lastRefresh)}
        </span>
        <button
          type="button"
          onClick={handleRefresh}
          style={{
            marginLeft: 'auto',
            padding: `${spacing['1.5']} ${spacing['3']}`,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.base,
            backgroundColor: colors.surfaceRaised,
            color: colors.textSecondary,
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Tab strip */}
      <div role="tablist" aria-label="Compliance sections" style={{
        display: 'flex',
        gap: spacing['1'],
        borderBottom: `1px solid ${colors.borderSubtle}`,
        marginBottom: spacing['5'],
        overflowX: 'auto' as const,
      }}>
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              aria-controls={`compliance-panel-${t.key}`}
              id={`compliance-tab-${t.key}`}
              onClick={() => setTab(t.key)}
              style={{
                padding: `${spacing['2']} ${spacing['4']}`,
                border: 'none',
                borderBottom: active ? `2px solid ${colors.primaryOrange}` : '2px solid transparent',
                backgroundColor: 'transparent',
                color: active ? colors.primaryOrange : colors.textSecondary,
                fontSize: typography.fontSize.sm,
                fontWeight: active ? typography.fontWeight.semibold : typography.fontWeight.medium,
                cursor: 'pointer',
                fontFamily: typography.fontFamily,
                whiteSpace: 'nowrap' as const,
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Panel surface */}
      <div
        role="tabpanel"
        id={`compliance-panel-${tab}`}
        aria-labelledby={`compliance-tab-${tab}`}
      >
        {tab === 'coi'     && <CoiGapsPanel projectId={projectId} />}
        {tab === 'wh347'   && <Wh347Panel projectId={projectId} />}
        {tab === 'osha300' && <Osha300Panel projectId={projectId} />}
        {tab === 'lien'    && <LienRightsPanel projectId={projectId} />}
        {tab === 'chain'   && <AuditChainPanel projectId={projectId} />}
      </div>
    </PageContainer>
  )
}

export default ComplianceCockpit
