import React, { useState, useMemo, useCallback, memo } from 'react'
import {
  Bot, CheckCircle, XCircle, Clock, Play, Pause, Activity, Shield,
  Calendar, DollarSign, ShieldCheck, ClipboardCheck, Scale, FileSearch,
  Zap, TrendingUp, AlertTriangle, Eye,
} from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Skeleton, EmptyState } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useAIAgents, useAIAgentActions } from '../hooks/queries'
import { useAgentOrchestrator } from '../stores/agentOrchestrator'
import { SPECIALIST_AGENTS, AGENT_DOMAINS } from '../types/agents'
import type { AgentDomain, AgentState } from '../types/agents'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────

type TabKey = 'overview' | 'activity' | 'tools'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Agent Team', icon: Bot },
  { key: 'activity', label: 'Activity Feed', icon: Activity },
  { key: 'tools', label: 'Tool Registry', icon: Zap },
]

// ── Agent Icon/Color Maps ─────────────────────────────────────

const AGENT_ICONS: Record<AgentDomain, React.ElementType> = {
  schedule: Calendar,
  cost: DollarSign,
  safety: ShieldCheck,
  quality: ClipboardCheck,
  compliance: Scale,
  document: FileSearch,
}

const AGENT_ACCENT: Record<AgentDomain, string> = {
  schedule: colors.statusInfo,
  cost: colors.statusActive,
  safety: colors.statusCritical,
  quality: colors.statusPending,
  compliance: colors.statusReview,
  document: colors.statusInfo,
}

const AGENT_ACCENT_SUBTLE: Record<AgentDomain, string> = {
  schedule: colors.statusInfoSubtle,
  cost: colors.statusActiveSubtle,
  safety: colors.statusCriticalSubtle,
  quality: colors.statusPendingSubtle,
  compliance: colors.statusReviewSubtle,
  document: colors.statusInfoSubtle,
}

// ── Agent Card Component ──────────────────────────────────────

interface AgentCardProps {
  domain: AgentDomain
  agentState: AgentState
  dbActions: number
  onToggle: (domain: AgentDomain) => void
}

const AgentCard = memo<AgentCardProps>(({ domain, agentState, dbActions, onToggle }) => {
  const agent = SPECIALIST_AGENTS[domain]
  const Icon = AGENT_ICONS[domain]
  const accent = AGENT_ACCENT[domain]
  const accentSubtle = AGENT_ACCENT_SUBTLE[domain]
  const isActive = agentState.status === 'active'
  const totalActions = agentState.totalActions + dbActions
  const approvalRate =
    totalActions > 0
      ? Math.round((agentState.approvedActions / totalActions) * 100)
      : 0

  return (
    <Card padding={spacing['5']}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing['4'],
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: borderRadius.lg,
              backgroundColor: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={20} color={colors.white} />
          </div>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: typography.fontSize.title,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
              }}
            >
              {agent.name}
            </p>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: spacing['1'],
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.medium,
                color: isActive ? colors.statusActive : colors.statusPending,
                backgroundColor: isActive
                  ? colors.statusActiveSubtle
                  : colors.statusPendingSubtle,
                padding: `1px ${spacing['2']}`,
                borderRadius: borderRadius.full,
                marginTop: spacing['1'],
              }}
            >
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  backgroundColor: isActive ? colors.statusActive : colors.statusPending,
                }}
              />
              {isActive ? 'Active' : 'Paused'}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: typography.fontSize.sm,
          color: colors.textSecondary,
          margin: 0,
          marginBottom: spacing['4'],
          lineHeight: typography.lineHeight.normal,
        }}
      >
        {agent.description}
      </p>

      {/* Expertise tags */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: spacing['1'],
          marginBottom: spacing['4'],
        }}
      >
        {agent.expertise.slice(0, 3).map((skill) => (
          <span
            key={skill}
            style={{
              padding: `2px ${spacing['2']}`,
              borderRadius: borderRadius.full,
              backgroundColor: accentSubtle,
              color: accent,
              fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.medium,
            }}
          >
            {skill}
          </span>
        ))}
        {agent.expertise.length > 3 && (
          <span
            style={{
              padding: `2px ${spacing['2']}`,
              borderRadius: borderRadius.full,
              backgroundColor: colors.surfaceInset,
              color: colors.textTertiary,
              fontSize: typography.fontSize.caption,
            }}
          >
            +{agent.expertise.length - 3} more
          </span>
        )}
      </div>

      {/* Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: spacing['2'],
          marginBottom: spacing['4'],
          padding: spacing['3'],
          backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.base,
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: typography.fontSize.caption,
              color: colors.textTertiary,
            }}
          >
            Actions
          </p>
          <p
            style={{
              margin: 0,
              fontSize: typography.fontSize.title,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
            }}
          >
            {totalActions}
          </p>
        </div>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: typography.fontSize.caption,
              color: colors.textTertiary,
            }}
          >
            Approved
          </p>
          <p
            style={{
              margin: 0,
              fontSize: typography.fontSize.title,
              fontWeight: typography.fontWeight.semibold,
              color: approvalRate >= 80 ? colors.statusActive : colors.statusPending,
            }}
          >
            {approvalRate}%
          </p>
        </div>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: typography.fontSize.caption,
              color: colors.textTertiary,
            }}
          >
            Confidence
          </p>
          <p
            style={{
              margin: 0,
              fontSize: typography.fontSize.title,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
            }}
          >
            {agentState.averageConfidence > 0
              ? `${agentState.averageConfidence}%`
              : 'N/A'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
        <button
          onClick={() => onToggle(domain)}
          aria-label={isActive ? `Pause ${agent.name}` : `Resume ${agent.name}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: spacing['1'],
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
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
              colors.surfaceInset
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
          }}
        >
          {isActive ? (
            <>
              <Pause size={12} /> Pause
            </>
          ) : (
            <>
              <Play size={12} /> Resume
            </>
          )}
        </button>
      </div>
    </Card>
  )
})
AgentCard.displayName = 'AgentCard'

// ── Activity Table Columns ────────────────────────────────────

const actionCol = createColumnHelper<Record<string, unknown>>()
const actionColumns = [
  actionCol.accessor('agent_type', {
    header: 'Agent',
    cell: (info) => {
      const domain = info.getValue() as AgentDomain | undefined
      if (!domain || !SPECIALIST_AGENTS[domain]) {
        return <span style={{ color: colors.textTertiary }}>{String(info.getValue() || '')}</span>
      }
      const agent = SPECIALIST_AGENTS[domain]
      const Icon = AGENT_ICONS[domain]
      const accent = AGENT_ACCENT[domain]
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: borderRadius.sm,
              backgroundColor: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={11} color={colors.white} />
          </div>
          <span
            style={{
              fontWeight: typography.fontWeight.medium,
              color: colors.textPrimary,
              fontSize: typography.fontSize.sm,
            }}
          >
            {agent.shortName}
          </span>
        </div>
      )
    },
  }),
  actionCol.accessor('description', {
    header: 'Description',
    cell: (info) => (
      <span
        style={{
          color: colors.textSecondary,
          fontSize: typography.fontSize.sm,
          maxWidth: 320,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'block',
        }}
      >
        {String(info.getValue() || '')}
      </span>
    ),
  }),
  actionCol.accessor('confidence', {
    header: 'Confidence',
    cell: (info) => {
      const v = info.getValue() as number | null
      if (v == null) return <span style={{ color: colors.textTertiary }}>N/A</span>
      const c =
        v >= 90
          ? colors.statusActive
          : v >= 70
            ? colors.statusPending
            : colors.statusCritical
      return (
        <span style={{ fontWeight: typography.fontWeight.semibold, color: c }}>
          {v}%
        </span>
      )
    },
  }),
  actionCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = String(info.getValue() || '')
      const statusColor =
        v === 'approved' || v === 'completed'
          ? colors.statusActive
          : v === 'rejected'
            ? colors.statusCritical
            : v === 'pending'
              ? colors.statusPending
              : colors.statusInfo
      const statusBg =
        v === 'approved' || v === 'completed'
          ? colors.statusActiveSubtle
          : v === 'rejected'
            ? colors.statusCriticalSubtle
            : v === 'pending'
              ? colors.statusPendingSubtle
              : colors.statusInfoSubtle
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: spacing.xs,
            padding: `2px ${spacing.sm}`,
            borderRadius: borderRadius.full,
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.medium,
            color: statusColor,
            backgroundColor: statusBg,
          }}
        >
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              backgroundColor: statusColor,
            }}
          />
          {v ? v.charAt(0).toUpperCase() + v.slice(1) : ''}
        </span>
      )
    },
  }),
  actionCol.accessor('created_at', {
    header: 'Time',
    cell: (info) => (
      <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption }}>
        {info.getValue()
          ? new Date(info.getValue() as string).toLocaleString()
          : ''}
      </span>
    ),
  }),
]

// ── Tool Registry ─────────────────────────────────────────────

const TOOL_REGISTRY: Record<
  AgentDomain,
  Array<{ name: string; description: string; mutating: boolean }>
> = {
  schedule: [
    { name: 'query_tasks', description: 'Query tasks with filters', mutating: false },
    { name: 'query_schedule', description: 'Get schedule milestones and phases', mutating: false },
    { name: 'predict_delays', description: 'Predict delays from current data', mutating: false },
    { name: 'analyze_critical_path', description: 'Analyze critical path and float', mutating: false },
    { name: 'query_weather_impact', description: 'Check weather impact on schedule', mutating: false },
    { name: 'suggest_reordering', description: 'Suggest task reordering to mitigate delays', mutating: true },
  ],
  cost: [
    { name: 'query_budget', description: 'Query budget by division or cost code', mutating: false },
    { name: 'query_change_orders', description: 'Query change orders', mutating: false },
    { name: 'earned_value_analysis', description: 'Calculate CPI, SPI, EAC metrics', mutating: false },
    { name: 'forecast_costs', description: 'Project final cost with confidence intervals', mutating: false },
    { name: 'query_contingency', description: 'Check contingency remaining', mutating: false },
    { name: 'draft_change_order', description: 'Draft a new change order for approval', mutating: true },
  ],
  safety: [
    { name: 'query_incidents', description: 'Query safety incidents', mutating: false },
    { name: 'query_inspections', description: 'Query inspection results', mutating: false },
    { name: 'analyze_safety_photos', description: 'Analyze photos for PPE violations', mutating: false },
    { name: 'query_weather', description: 'Check weather conditions', mutating: false },
    { name: 'generate_jha', description: 'Generate Job Hazard Analysis', mutating: true },
    { name: 'track_corrective_actions', description: 'Track corrective actions', mutating: false },
  ],
  quality: [
    { name: 'query_punch_items', description: 'Query punch list items', mutating: false },
    { name: 'query_submittals', description: 'Query submittal status', mutating: false },
    { name: 'query_inspections', description: 'Query quality inspections', mutating: false },
    { name: 'analyze_rework', description: 'Analyze rework patterns', mutating: false },
    { name: 'predict_rework_risk', description: 'Predict rework risk for activities', mutating: false },
    { name: 'suggest_inspection_schedule', description: 'Suggest optimal inspection schedule', mutating: true },
  ],
  compliance: [
    { name: 'query_certifications', description: 'Query workforce certifications', mutating: false },
    { name: 'query_insurance', description: 'Query insurance certificates', mutating: false },
    { name: 'query_payroll', description: 'Query certified payroll records', mutating: false },
    { name: 'check_prevailing_wage', description: 'Verify prevailing wage rates', mutating: false },
    { name: 'flag_expiring_cois', description: 'Flag expiring insurance certificates', mutating: true },
    { name: 'generate_compliance_report', description: 'Generate compliance report', mutating: true },
  ],
  document: [
    { name: 'search_documents', description: 'Full text search project documents', mutating: false },
    { name: 'extract_from_pdf', description: 'Extract data from PDF files', mutating: false },
    { name: 'cross_reference_specs', description: 'Cross reference specs with drawings', mutating: false },
    { name: 'generate_report', description: 'Generate project report', mutating: true },
    { name: 'find_spec_sections', description: 'Find relevant specification sections', mutating: false },
    { name: 'generate_closeout_docs', description: 'Generate closeout documentation', mutating: true },
  ],
}

// ── Main Component ────────────────────────────────────────────

export const AIAgents: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const projectId = useProjectId()
  const { data: dbAgents, isLoading: loadingAgents } = useAIAgents(projectId)
  const { data: dbActions, isLoading: loadingActions } = useAIAgentActions(projectId)
  const { agentStates, setAgentStatus } = useAgentOrchestrator()

  // Compute metrics from DB + local state
  const totalActiveAgents = useMemo(
    () => AGENT_DOMAINS.filter((d) => agentStates[d].status === 'active').length,
    [agentStates],
  )

  const totalActions = useMemo(
    () =>
      AGENT_DOMAINS.reduce((sum, d) => sum + agentStates[d].totalActions, 0) +
      (dbActions?.length || 0),
    [agentStates, dbActions],
  )

  const pendingCount = useMemo(
    () => dbActions?.filter((a: Record<string, unknown>) => a.status === 'pending').length || 0,
    [dbActions],
  )

  const overallApprovalRate = useMemo(() => {
    const total = AGENT_DOMAINS.reduce((s, d) => s + agentStates[d].totalActions, 0)
    const approved = AGENT_DOMAINS.reduce((s, d) => s + agentStates[d].approvedActions, 0)
    return total > 0 ? Math.round((approved / total) * 100) : 0
  }, [agentStates])

  const handleToggleAgent = useCallback(
    (domain: AgentDomain) => {
      const current = agentStates[domain].status
      const next = current === 'active' ? 'paused' : 'active'
      setAgentStatus(domain, next as 'active' | 'paused')
      toast.success(
        `${SPECIALIST_AGENTS[domain].name} ${next === 'active' ? 'resumed' : 'paused'}`,
      )
    },
    [agentStates, setAgentStatus],
  )

  const dbActionCountByDomain = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const action of dbActions || []) {
      const domain = (action as Record<string, unknown>).agent_type as string
      counts[domain] = (counts[domain] || 0) + 1
    }
    return counts
  }, [dbActions])

  const isLoading = loadingAgents || loadingActions

  return (
    <PageContainer
      title="AI Agents"
      subtitle="Your team of 6 specialist agents analyzing schedule, cost, safety, quality, compliance, and documents"
    >
      {/* Tab Switcher */}
      <div
        role="tablist"
        aria-label="AI Agents navigation"
        style={{
          display: 'flex',
          gap: spacing['1'],
          backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.lg,
          padding: spacing['1'],
          marginBottom: spacing['2xl'],
          overflowX: 'auto',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              role="tab"
              aria-selected={isActive}
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
                fontWeight: isActive
                  ? typography.fontWeight.medium
                  : typography.fontWeight.normal,
                color: isActive ? colors.orangeText : colors.textSecondary,
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: spacing['4'],
            marginBottom: spacing['2xl'],
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width="100%" height="100px" />
          ))}
        </div>
      )}

      {/* KPIs */}
      {!isLoading && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: spacing['4'],
            marginBottom: spacing['2xl'],
          }}
        >
          <MetricBox
            label="Active Agents"
            value={`${totalActiveAgents}/6`}
            change={totalActiveAgents === 6 ? 1 : 0}
          />
          <MetricBox label="Total Actions" value={totalActions} />
          <MetricBox
            label="Pending Approval"
            value={pendingCount}
            change={pendingCount > 5 ? -1 : 0}
          />
          <MetricBox
            label="Approval Rate"
            value={`${overallApprovalRate}%`}
            change={overallApprovalRate >= 80 ? 1 : -1}
          />
        </div>
      )}

      {/* Overview Tab — Agent Cards */}
      {activeTab === 'overview' && !isLoading && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: spacing['4'],
          }}
        >
          {AGENT_DOMAINS.map((domain) => (
            <AgentCard
              key={domain}
              domain={domain}
              agentState={agentStates[domain]}
              dbActions={dbActionCountByDomain[domain] || 0}
              onToggle={handleToggleAgent}
            />
          ))}
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && !isLoading && (
        <Card padding={spacing['4']}>
          <SectionHeader title="Agent Activity Feed" />
          {dbActions && dbActions.length > 0 ? (
            <div style={{ marginTop: spacing['3'] }}>
              <DataTable
                columns={actionColumns}
                data={dbActions as Record<string, unknown>[]}
              />
            </div>
          ) : (
            <EmptyState
              icon={<Activity size={32} color={colors.textTertiary} />}
              title="No activity yet"
              description="Agent activity will appear here as agents analyze your project data and suggest actions."
            />
          )}
        </Card>
      )}

      {/* Tools Tab */}
      {activeTab === 'tools' && !isLoading && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: spacing['4'],
          }}
        >
          {AGENT_DOMAINS.map((domain) => {
            const agent = SPECIALIST_AGENTS[domain]
            const Icon = AGENT_ICONS[domain]
            const accent = AGENT_ACCENT[domain]
            const tools = TOOL_REGISTRY[domain]

            return (
              <Card key={domain} padding={spacing['5']}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing['3'],
                    marginBottom: spacing['4'],
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: borderRadius.base,
                      backgroundColor: accent,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={16} color={colors.white} />
                  </div>
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: typography.fontSize.title,
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.textPrimary,
                      }}
                    >
                      {agent.name}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: typography.fontSize.caption,
                        color: colors.textTertiary,
                      }}
                    >
                      {tools.length} tools available
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: spacing['2'],
                  }}
                >
                  {tools.map((tool) => (
                    <div
                      key={tool.name}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: spacing['3'],
                        padding: spacing['3'],
                        backgroundColor: colors.surfaceInset,
                        borderRadius: borderRadius.base,
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: tool.mutating
                            ? colors.statusPending
                            : colors.statusActive,
                          marginTop: spacing['1.5'],
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: typography.fontSize.sm,
                            fontWeight: typography.fontWeight.medium,
                            color: colors.textPrimary,
                            fontFamily: typography.fontFamilyMono,
                          }}
                        >
                          {tool.name}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: typography.fontSize.caption,
                            color: colors.textTertiary,
                            marginTop: spacing['0.5'],
                          }}
                        >
                          {tool.description}
                        </p>
                        {tool.mutating && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: spacing['1'],
                              marginTop: spacing['1'],
                              padding: `1px ${spacing['2']}`,
                              borderRadius: borderRadius.full,
                              backgroundColor: colors.statusPendingSubtle,
                              color: colors.statusPending,
                              fontSize: typography.fontSize.caption,
                              fontWeight: typography.fontWeight.medium,
                            }}
                          >
                            <Shield size={8} /> Requires approval
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </PageContainer>
  )
}

export default AIAgents
