// Agent Status Badge: Compact indicator for active agents.
// Shows in the sidebar or header to indicate background agent activity.

import React, { useMemo } from 'react'
import { Zap } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'

interface ActiveAgent {
  id: string
  name: string
  status: 'idle' | 'executing' | 'awaiting_approval' | 'error'
  current_task?: string
}

interface AgentStatusBadgeProps {
  agents: ActiveAgent[]
  compact?: boolean
}

const STATUS_COLORS: Record<ActiveAgent['status'], string> = {
  idle: colors.textTertiary,
  executing: colors.statusInfo,
  awaiting_approval: colors.statusPending,
  error: colors.statusCritical,
}

export const AgentStatusBadge: React.FC<AgentStatusBadgeProps> = React.memo(({ agents, compact = false }) => {
  const activeAgents = useMemo(
    () => agents.filter((a) => a.status !== 'idle'),
    [agents],
  )

  if (activeAgents.length === 0) return null

  if (compact) {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
          backgroundColor: `${colors.statusInfo}15`, color: colors.statusInfo,
          padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
        }}
        aria-label={`${activeAgents.length} agent${activeAgents.length !== 1 ? 's' : ''} active`}
      >
        <Zap size={10} />
        {activeAgents.length}
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
      {activeAgents.map((agent) => (
        <div
          key={agent.id}
          style={{
            display: 'flex', gap: spacing['2'], alignItems: 'center',
            padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.surfaceFlat,
            borderRadius: borderRadius.base, fontSize: typography.fontSize.caption,
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            backgroundColor: STATUS_COLORS[agent.status],
            animation: agent.status === 'executing' ? 'pulse 2s infinite' : 'none',
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary, margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {agent.name}
            </p>
            {agent.current_task && (
              <p style={{
                fontSize: '10px', color: colors.textTertiary, margin: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {agent.current_task}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
})

AgentStatusBadge.displayName = 'AgentStatusBadge'
