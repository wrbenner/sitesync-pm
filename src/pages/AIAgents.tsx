import React, { useState } from 'react'
import { Bot, CheckCircle, XCircle, Clock, Play, Pause } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Skeleton } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useAIAgents, useAIAgentActions } from '../hooks/queries'
import { toast } from 'sonner'

type TabKey = 'agents' | 'pending'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'agents', label: 'Agents', icon: Bot },
  { key: 'pending', label: 'Pending Actions', icon: Clock },
]

function formatAgentType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ── Column helpers ───────────────────────────────────────────

const actionCol = createColumnHelper<any>()
const actionColumns = [
  actionCol.accessor('agent_type', {
    header: 'Agent',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue() ? formatAgentType(info.getValue()) : ''}
      </span>
    ),
  }),
  actionCol.accessor('description', {
    header: 'Description',
    cell: (info) => (
      <span style={{ color: colors.textSecondary, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
        {info.getValue()}
      </span>
    ),
  }),
  actionCol.accessor('confidence', {
    header: 'Confidence',
    cell: (info) => {
      const v = info.getValue() as number | null
      if (v == null) return <span style={{ color: colors.textTertiary }}>N/A</span>
      const c = v >= 90 ? colors.statusActive : v >= 70 ? colors.statusPending : colors.statusCritical
      return <span style={{ fontWeight: typography.fontWeight.semibold, color: c }}>{v}%</span>
    },
  }),
  actionCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue() as string
      const statusColor = v === 'approved' ? colors.statusActive
        : v === 'rejected' ? colors.statusCritical
        : v === 'pending' ? colors.statusPending
        : colors.statusInfo
      const statusBg = v === 'approved' ? colors.statusActiveSubtle
        : v === 'rejected' ? colors.statusCriticalSubtle
        : v === 'pending' ? colors.statusPendingSubtle
        : colors.statusInfoSubtle
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: statusColor, backgroundColor: statusBg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusColor }} />
          {v ? v.charAt(0).toUpperCase() + v.slice(1) : ''}
        </span>
      )
    },
  }),
  actionCol.accessor('created_at', {
    header: 'Created',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  actionCol.display({
    id: 'actions',
    header: '',
    cell: (info) => {
      const row = info.row.original
      if (row.status !== 'pending') return null
      return (
        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <button
            onClick={() => toast.success('Action approved')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: `4px ${spacing['3']}`, border: 'none', borderRadius: borderRadius.base,
              backgroundColor: colors.statusActiveSubtle, color: colors.statusActive,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
              cursor: 'pointer', fontFamily: typography.fontFamily,
            }}
          >
            <CheckCircle size={12} /> Approve
          </button>
          <button
            onClick={() => toast.info('Action rejected')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: `4px ${spacing['3']}`, border: 'none', borderRadius: borderRadius.base,
              backgroundColor: colors.statusCriticalSubtle, color: colors.statusCritical,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
              cursor: 'pointer', fontFamily: typography.fontFamily,
            }}
          >
            <XCircle size={12} /> Reject
          </button>
        </div>
      )
    },
  }),
]

// ── Main Component ───────────────────────────────────────────

export const AIAgents: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('agents')
  const projectId = useProjectId()
  const { data: agents, isLoading: loadingAgents } = useAIAgents(projectId)
  const { data: allActions, isLoading: loadingActions } = useAIAgentActions(projectId)

  const pendingActions = allActions?.filter((a: any) => a.status === 'pending') || []
  const approvedActions = allActions?.filter((a: any) => a.status === 'approved') || []
  const activeAgents = agents?.filter((a: any) => a.status === 'active') || []

  const approvalRate = allActions && allActions.length > 0
    ? Math.round((approvedActions.length / allActions.length) * 100)
    : 0

  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const actionsThisWeek = allActions?.filter((a: any) => new Date(a.created_at) >= oneWeekAgo).length || 0

  const isLoading = loadingAgents || loadingActions

  return (
    <PageContainer
      title="AI Agents"
      subtitle="Autonomous agents that monitor, analyze, and take action across your project"
    >
      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        gap: spacing['1'],
        backgroundColor: colors.surfaceInset,
        borderRadius: borderRadius.lg,
        padding: spacing['1'],
        marginBottom: spacing['2xl'],
        overflowX: 'auto',
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['4']}`,
                border: 'none',
                borderRadius: borderRadius.base,
                cursor: 'pointer',
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
                fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
                color: isActive ? colors.primaryOrange : colors.textSecondary,
                backgroundColor: isActive ? colors.surfaceRaised : 'transparent',
                transition: `all ${transitions.instant}`,
                whiteSpace: 'nowrap',
              }}
            >
              {React.createElement(tab.icon, { size: 14 })}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      )}

      {/* KPIs */}
      {!isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          <MetricBox label="Total Agents Active" value={activeAgents.length} />
          <MetricBox label="Pending Actions" value={pendingActions.length} change={pendingActions.length > 5 ? -1 : 0} />
          <MetricBox label="Approval Rate" value={`${approvalRate}%`} change={approvalRate >= 80 ? 1 : -1} />
          <MetricBox label="Actions This Week" value={actionsThisWeek} />
        </div>
      )}

      {/* Agents Tab */}
      {activeTab === 'agents' && !isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: spacing['4'] }}>
          {agents && agents.length > 0 ? agents.map((agent: any) => {
            const agentActions = allActions?.filter((a: any) => a.agent_type === agent.agent_type) || []
            const agentApproved = agentActions.filter((a: any) => a.status === 'approved').length
            const agentApprovalPct = agentActions.length > 0 ? Math.round((agentApproved / agentActions.length) * 100) : 0

            const statusColor = agent.status === 'active' ? colors.statusActive
              : agent.status === 'paused' ? colors.statusPending
              : colors.textTertiary
            const statusBg = agent.status === 'active' ? colors.statusActiveSubtle
              : agent.status === 'paused' ? colors.statusPendingSubtle
              : colors.surfaceInset

            return (
              <Card key={agent.id} padding={spacing['5']}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing['3'] }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: borderRadius.base,
                      background: `linear-gradient(135deg, ${colors.primaryOrange} 0%, ${colors.orangeGradientEnd || '#FF9F43'} 100%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Bot size={18} color="#fff" />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                        {formatAgentType(agent.agent_type)}
                      </p>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                        color: statusColor, backgroundColor: statusBg,
                        padding: `1px ${spacing.sm}`, borderRadius: borderRadius.full, marginTop: 2,
                      }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusColor }} />
                        {agent.status ? agent.status.charAt(0).toUpperCase() + agent.status.slice(1) : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['2'], marginBottom: spacing['4'] }}>
                  <div>
                    <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Actions Taken</p>
                    <p style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{agentActions.length}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Approved</p>
                    <p style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{agentApprovalPct}%</p>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => toast.success(agent.status === 'active' ? 'Agent paused' : 'Agent resumed')}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: `${spacing['2']} ${spacing['3']}`,
                      border: `1px solid ${colors.borderDefault}`,
                      borderRadius: borderRadius.base,
                      backgroundColor: 'transparent',
                      color: colors.textSecondary,
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.medium,
                      cursor: 'pointer',
                      fontFamily: typography.fontFamily,
                      transition: `background-color ${transitions.instant}`,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceInset }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
                  >
                    {agent.status === 'active' ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Resume</>}
                  </button>
                </div>
              </Card>
            )
          }) : (
            <Card padding={spacing['5']}>
              <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, margin: 0 }}>
                No AI agents configured yet.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Pending Actions Tab */}
      {activeTab === 'pending' && !isLoading && (
        <Card padding={spacing['4']}>
          <SectionHeader title="Pending Actions" />
          {allActions && allActions.length > 0 ? (
            <div style={{ marginTop: spacing['3'] }}>
              <DataTable columns={actionColumns} data={allActions} />
            </div>
          ) : (
            <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, margin: `${spacing['3']} 0 0` }}>
              No agent actions recorded yet.
            </p>
          )}
        </Card>
      )}
    </PageContainer>
  )
}

export default AIAgents
