import React, { useState, memo, useCallback } from 'react'
import {
  Calendar, DollarSign, ShieldCheck, ClipboardCheck, Scale, FileSearch,
  Sparkles, ThumbsUp, ThumbsDown, Copy, Check, ArrowRight,
} from 'lucide-react'
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme'
import type { AgentConversationMessage, AgentDomain } from '../../types/agents'
import { SPECIALIST_AGENTS } from '../../types/agents'

// ── Agent Icon Map ────────────────────────────────────────────

const AGENT_ICONS: Record<AgentDomain, React.ElementType> = {
  schedule: Calendar,
  cost: DollarSign,
  safety: ShieldCheck,
  quality: ClipboardCheck,
  compliance: Scale,
  document: FileSearch,
}

const AGENT_COLORS: Record<AgentDomain, { fg: string; bg: string; subtle: string }> = {
  schedule: { fg: colors.statusInfo, bg: colors.statusInfo, subtle: colors.statusInfoSubtle },
  cost: { fg: colors.statusActive, bg: colors.statusActive, subtle: colors.statusActiveSubtle },
  safety: { fg: colors.statusCritical, bg: colors.statusCritical, subtle: colors.statusCriticalSubtle },
  quality: { fg: colors.statusPending, bg: colors.statusPending, subtle: colors.statusPendingSubtle },
  compliance: { fg: colors.statusReview, bg: colors.statusReview, subtle: colors.statusReviewSubtle },
  document: { fg: colors.statusInfo, bg: colors.statusInfo, subtle: colors.statusInfoSubtle },
}

// ── Agent Message Bubble ──────────────────────────────────────

interface AgentMessageProps {
  message: AgentConversationMessage
}

export const AgentMessage = memo<AgentMessageProps>(({ message }) => {
  const [reaction, setReaction] = useState<'up' | 'down' | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [message.content])

  // User message
  if (message.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'] }}>
        <div style={{ maxWidth: '640px' }}>
          <div
            style={{
              padding: spacing['5'],
              borderRadius: `${borderRadius.lg} ${borderRadius.sm} ${borderRadius.lg} ${borderRadius.lg}`,
              backgroundColor: colors.primaryOrange,
              color: colors.white,
              fontSize: typography.fontSize.body,
              lineHeight: typography.lineHeight.relaxed,
              whiteSpace: 'pre-wrap',
            }}
          >
            {message.content}
          </div>
        </div>
      </div>
    )
  }

  // Coordinator message
  if (message.role === 'coordinator') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', gap: spacing['3'] }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: borderRadius.full,
            background: `linear-gradient(135deg, ${colors.statusReview} 0%, ${colors.statusInfo} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: spacing['1'],
            flexShrink: 0,
          }}
        >
          <Sparkles size={13} color={colors.white} />
        </div>
        <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
          {/* Routing badge */}
          {message.routingInfo && message.routingInfo.targetAgents.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                flexWrap: 'wrap',
                marginBottom: spacing['1'],
              }}
            >
              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  color: colors.textTertiary,
                  fontWeight: typography.fontWeight.medium,
                  textTransform: 'uppercase',
                  letterSpacing: typography.letterSpacing.wider,
                }}
              >
                Routing
              </span>
              {message.routingInfo.targetAgents.map((domain) => {
                const agent = SPECIALIST_AGENTS[domain]
                const agentColors = AGENT_COLORS[domain]
                const Icon = AGENT_ICONS[domain]
                return (
                  <span
                    key={domain}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: spacing['1'],
                      padding: `2px ${spacing['2']}`,
                      borderRadius: borderRadius.full,
                      backgroundColor: agentColors.subtle,
                      color: agentColors.fg,
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.medium,
                    }}
                  >
                    <Icon size={10} />
                    {agent.shortName}
                  </span>
                )
              })}
            </div>
          )}

          <div
            style={{
              padding: spacing['4'],
              borderRadius: `${borderRadius.sm} ${borderRadius.lg} ${borderRadius.lg} ${borderRadius.lg}`,
              backgroundColor: colors.surfaceInset,
              color: colors.textPrimary,
              fontSize: typography.fontSize.body,
              lineHeight: typography.lineHeight.relaxed,
              whiteSpace: 'pre-wrap',
            }}
          >
            {message.content}
          </div>
        </div>
      </div>
    )
  }

  // Agent message
  const domain = message.agentDomain!
  const agent = SPECIALIST_AGENTS[domain]
  const agentColors = AGENT_COLORS[domain]
  const Icon = AGENT_ICONS[domain]

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', gap: spacing['3'] }}>
      {/* Agent avatar */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: borderRadius.full,
          backgroundColor: agentColors.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: spacing['1'],
          flexShrink: 0,
        }}
      >
        <Icon size={13} color={colors.white} />
      </div>

      <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
        {/* Agent identity label */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: spacing['1'],
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.semibold,
            color: agentColors.fg,
            textTransform: 'uppercase',
            letterSpacing: typography.letterSpacing.wider,
          }}
        >
          <Icon size={10} />
          {agent.name}
        </span>

        {/* Message content */}
        <div
          style={{
            padding: spacing['5'],
            borderRadius: `${borderRadius.sm} ${borderRadius.lg} ${borderRadius.lg} ${borderRadius.lg}`,
            backgroundColor: colors.surfaceInset,
            borderLeft: `3px solid ${agentColors.fg}`,
            color: colors.textPrimary,
            fontSize: typography.fontSize.body,
            lineHeight: typography.lineHeight.relaxed,
            whiteSpace: 'pre-wrap',
          }}
        >
          {message.content}
        </div>

        {/* Handoff indicator */}
        {message.handoff && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
              padding: `${spacing['2']} ${spacing['3']}`,
              backgroundColor: colors.surfaceSelected,
              borderRadius: borderRadius.base,
              marginTop: spacing['1'],
            }}
          >
            <ArrowRight size={12} color={colors.primaryOrange} />
            <span
              style={{
                fontSize: typography.fontSize.caption,
                color: colors.textSecondary,
              }}
            >
              Handing off to{' '}
              <strong style={{ color: AGENT_COLORS[message.handoff.to].fg }}>
                {SPECIALIST_AGENTS[message.handoff.to].name}
              </strong>{' '}
              for {message.handoff.reason}
            </span>
          </div>
        )}

        {/* Actions bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['1'],
            paddingLeft: spacing['2'],
          }}
        >
          <button
            onClick={() => setReaction(reaction === 'up' ? null : 'up')}
            aria-label="Mark as helpful"
            style={{
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: reaction === 'up' ? colors.orangeSubtle : 'transparent',
              border: 'none',
              borderRadius: borderRadius.sm,
              cursor: 'pointer',
              color: reaction === 'up' ? colors.orangeText : colors.textTertiary,
              transition: `all ${transitions.instant}`,
            }}
          >
            <ThumbsUp size={12} />
          </button>
          <button
            onClick={() => setReaction(reaction === 'down' ? null : 'down')}
            aria-label="Mark as not helpful"
            style={{
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: reaction === 'down' ? colors.statusCriticalSubtle : 'transparent',
              border: 'none',
              borderRadius: borderRadius.sm,
              cursor: 'pointer',
              color: reaction === 'down' ? colors.statusCritical : colors.textTertiary,
              transition: `all ${transitions.instant}`,
            }}
          >
            <ThumbsDown size={12} />
          </button>
          <button
            onClick={handleCopy}
            aria-label="Copy response"
            style={{
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: borderRadius.sm,
              cursor: 'pointer',
              color: copied ? colors.statusActive : colors.textTertiary,
              transition: `all ${transitions.instant}`,
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>
    </div>
  )
})

AgentMessage.displayName = 'AgentMessage'

// ── Agent Typing Indicator ────────────────────────────────────

interface AgentTypingIndicatorProps {
  activeAgents: AgentDomain[]
}

export const AgentTypingIndicator = memo<AgentTypingIndicatorProps>(({ activeAgents }) => {
  if (activeAgents.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      {activeAgents.map((domain) => {
        const agent = SPECIALIST_AGENTS[domain]
        const agentColors = AGENT_COLORS[domain]
        const Icon = AGENT_ICONS[domain]

        return (
          <div
            key={domain}
            style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: borderRadius.full,
                backgroundColor: agentColors.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon size={13} color={colors.white} />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['3']}`,
                backgroundColor: colors.surfaceInset,
                borderRadius: `${borderRadius.sm} ${borderRadius.lg} ${borderRadius.lg} ${borderRadius.lg}`,
                borderLeft: `3px solid ${agentColors.fg}`,
              }}
            >
              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.medium,
                  color: agentColors.fg,
                }}
              >
                {agent.shortName}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['0.5'] }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      backgroundColor: agentColors.fg,
                      opacity: 0.4,
                      animation: `pulse 1.4s infinite ${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
})

AgentTypingIndicator.displayName = 'AgentTypingIndicator'

// ── Exports ───────────────────────────────────────────────────

export { AGENT_ICONS, AGENT_COLORS }
