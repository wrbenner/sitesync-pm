import React, { useState, useRef, useEffect, useCallback, memo } from 'react'
import {
  Sparkles, Clock, Download, Clipboard, Share2, FileText,
  Calendar, DollarSign, ShieldCheck, ClipboardCheck, Scale, FileSearch,
  Bot, ChevronRight, Users, Layers, AlertTriangle,
} from 'lucide-react'
import { AI_COPILOT_DRAWING_TOOLS } from '../lib/aiPrompts'
import { PageContainer, useToast } from '../components/Primitives'
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useMultiAgentChat } from '../hooks/useMultiAgentChat'
import { AgentMessage, AgentTypingIndicator, AGENT_COLORS } from '../components/ai/AgentMessage'
import { BatchActionPreview } from '../components/ai/BatchActionPreview'
import { AgentMentionInput } from '../components/ai/AgentMentionInput'
import { GenerativeUIRenderer } from '../components/ai/generativeUI'
import { ToolResultCard } from '../components/ai/ToolResultCard'
import { SPECIALIST_AGENTS, AGENT_DOMAINS } from '../types/agents'
import type { AgentDomain, AgentConversationMessage } from '../types/agents'

// ── Agent Quick Access Panel ──────────────────────────────────

const AGENT_ICON_MAP: Record<AgentDomain, React.ElementType> = {
  schedule: Calendar,
  cost: DollarSign,
  safety: ShieldCheck,
  quality: ClipboardCheck,
  compliance: Scale,
  document: FileSearch,
}

const AgentQuickPanel = memo<{ onSelect: (text: string) => void }>(({ onSelect }) => (
  <div style={{ marginBottom: spacing['4'] }}>
    <p
      style={{
        fontSize: typography.fontSize.caption,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing.wider,
        margin: 0,
        marginBottom: spacing['2'],
      }}
    >
      Specialist Agents
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
      {AGENT_DOMAINS.map((domain) => {
        const agent = SPECIALIST_AGENTS[domain]
        const agentColors = AGENT_COLORS[domain]
        const Icon = AGENT_ICON_MAP[domain]
        return (
          <button
            key={domain}
            onClick={() => onSelect(`@${domain} `)}
            aria-label={`Route to ${agent.name}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
              padding: `${spacing['2']} ${spacing['3']}`,
              minHeight: 56,
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: borderRadius.base,
              cursor: 'pointer',
              fontFamily: typography.fontFamily,
              transition: `background-color ${transitions.instant}`,
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceHover
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: borderRadius.sm,
                backgroundColor: agentColors.fg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon size={12} color={colors.white} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textPrimary,
                  lineHeight: typography.lineHeight.snug,
                }}
              >
                {agent.shortName}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: typography.fontSize.caption,
                  color: colors.textTertiary,
                  lineHeight: typography.lineHeight.snug,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {agent.expertise[0]}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  </div>
))
AgentQuickPanel.displayName = 'AgentQuickPanel'

// ── Preset Prompts ────────────────────────────────────────────

const PRESET_PROMPTS = [
  {
    label: "How's the project doing?",
    icon: Bot,
    description: 'Multi agent health check across schedule, cost, and safety',
    agentCount: 3,
  },
  {
    label: '@safety any PPE violations this week?',
    icon: ShieldCheck,
    description: 'Direct to Safety Agent for violation analysis',
    agentCount: 1,
  },
  {
    label: '@cost what is the EAC for this project?',
    icon: DollarSign,
    description: 'Direct to Cost Agent for earned value analysis',
    agentCount: 1,
  },
  {
    label: 'What needs my attention today?',
    icon: Sparkles,
    description: 'Overdue items, pending approvals, and risk flags',
    agentCount: 3,
  },
]

const DRAWING_PROMPTS = [
  {
    label: 'Run clash analysis on this drawing set',
    icon: Layers,
    description: 'Trigger the full drawing intelligence pipeline',
    agentCount: 1,
    tool: 'trigger_clash_analysis',
  },
  {
    label: 'Show discrepancy stats by severity',
    icon: AlertTriangle,
    description: 'Aggregate open clashes across all paired sheets',
    agentCount: 1,
    tool: 'get_discrepancy_stats',
  },
  {
    label: 'Summarize drawing pair coverage',
    icon: FileSearch,
    description: 'Pairing confidence and analysis status per pair',
    agentCount: 1,
    tool: 'analyze_pair_relationships',
  },
] as const

// Exported so hooks and diagnostics can reference the canonical tool list
export const DRAWING_TOOL_SPECS = AI_COPILOT_DRAWING_TOOLS

const COLLABORATION_PROMPTS = [
  {
    label: 'Who is blocking the most open items?',
    icon: Users,
    description: 'Find team members with the most idle ball in court assignments',
    agentCount: 2,
  },
  {
    label: 'Which team members have pending ball in court items?',
    icon: Clock,
    description: 'List all open RFIs and submittals grouped by responsible party',
    agentCount: 2,
  },
]

// ── Message Renderer ──────────────────────────────────────────

const MessageRenderer = memo<{
  message: AgentConversationMessage
  onSend: (text: string) => void
}>(({ message, onSend }) => {
  return (
    <div>
      <AgentMessage message={message} />

      {/* Tool result cards for agent messages */}
      {message.toolCalls && message.toolCalls.length > 0 && (() => {
        const uiBlocks = message.generativeBlocks || []
        const plainToolCalls = message.toolCalls.filter(
          (tc) => !(tc.result as Record<string, unknown>).ui_type,
        )
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: spacing['2'],
              marginTop: spacing['2'],
              marginLeft: '40px',
              maxWidth: 600,
            }}
          >
            {plainToolCalls.map((tc, i) => (
              <ToolResultCard
                key={i}
                result={{
                  tool: tc.tool,
                  input: tc.input,
                  result: tc.result,
                }}
              />
            ))}
            {uiBlocks.map((block, i) => (
              <GenerativeUIRenderer
                key={`ui-${i}`}
                block={block as Record<string, unknown>}
                onAction={(action, data) => {
                  onSend(`Execute: ${action} with ${JSON.stringify(data)}`)
                }}
              />
            ))}
          </div>
        )
      })()}

      {/* Generative blocks (from orchestrator) */}
      {message.generativeBlocks &&
        message.generativeBlocks.length > 0 &&
        !message.toolCalls && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: spacing['2'],
              marginTop: spacing['2'],
              marginLeft: '40px',
              maxWidth: 600,
            }}
          >
            {message.generativeBlocks.map((block, i) => (
              <GenerativeUIRenderer
                key={`gen-${i}`}
                block={block as Record<string, unknown>}
                onAction={(action, data) => {
                  onSend(`Execute: ${action} with ${JSON.stringify(data)}`)
                }}
              />
            ))}
          </div>
        )}
    </div>
  )
})
MessageRenderer.displayName = 'MessageRenderer'

// ── Main Page ─────────────────────────────────────────────────

export const AICopilot: React.FC = () => {
  const { addToast } = useToast()
  const projectId = useProjectId()

  const previousPage = window.location.hash.replace('#/', '').split('/')[0] || 'dashboard'
  const contextPage = previousPage === 'copilot' ? 'dashboard' : previousPage

  const {
    messages,
    setInput,
    sendMessage,
    isProcessing,
    activeAgents,
    lastIntent,
    pendingActions,
    approveAction,
    rejectAction,
    approveAllPending,
    rejectAllPending,
    clearMessages,
  } = useMultiAgentChat(contextPage, projectId)

  const [showAgentPanel, setShowAgentPanel] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const hasMessages = messages.length > 0

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isProcessing, scrollToBottom])

  const handleSendMessage = useCallback(
    (text: string) => {
      setInput(text)
      // Use requestAnimationFrame to ensure state update completes
      requestAnimationFrame(() => {
        sendMessage(text)
      })
    },
    [setInput, sendMessage],
  )

  const handleAgentSelect = useCallback(
    (text: string) => {
      setInput(text)
    },
    [setInput],
  )

  return (
    <PageContainer>
      <div style={{ display: 'flex', gap: spacing['5'], height: 'calc(100vh - 160px)' }}>
        {/* Agent sidebar panel */}
        {showAgentPanel && (
          <div
            style={{
              width: '220px',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              borderRight: `1px solid ${colors.borderSubtle}`,
              paddingRight: spacing['4'],
              overflow: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing['4'],
              }}
            >
              <span
                style={{
                  fontSize: typography.fontSize.label,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textTertiary,
                  textTransform: 'uppercase',
                  letterSpacing: typography.letterSpacing.wider,
                }}
              >
                AI Team
              </span>
              <button
                onClick={() => {
                  clearMessages()
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 56,
                  padding: `${spacing['1']} ${spacing['3']}`,
                  backgroundColor: colors.primaryOrange,
                  color: colors.white,
                  border: 'none',
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.semibold,
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                }}
              >
                + New
              </button>
            </div>

            <AgentQuickPanel onSelect={handleAgentSelect} />

            {/* Last routing info */}
            {lastIntent && lastIntent.targetAgents.length > 0 && (
              <div style={{ marginTop: 'auto', paddingTop: spacing['4'], borderTop: `1px solid ${colors.borderSubtle}` }}>
                <p
                  style={{
                    fontSize: typography.fontSize.caption,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.textTertiary,
                    textTransform: 'uppercase',
                    letterSpacing: typography.letterSpacing.wider,
                    margin: 0,
                    marginBottom: spacing['2'],
                  }}
                >
                  Last Routing
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['1'] }}>
                  {lastIntent.targetAgents.map((domain) => {
                    const agentColors = AGENT_COLORS[domain]
                    const Icon = AGENT_ICON_MAP[domain]
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
                        <Icon size={9} />
                        {SPECIALIST_AGENTS[domain].shortName}
                      </span>
                    )
                  })}
                </div>
                <p
                  style={{
                    fontSize: typography.fontSize.caption,
                    color: colors.textTertiary,
                    margin: `${spacing['1']} 0 0`,
                    lineHeight: typography.lineHeight.snug,
                  }}
                >
                  {lastIntent.reasoning}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Main chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
              marginBottom: spacing['3'],
            }}
          >
            <button
              onClick={() => setShowAgentPanel(!showAgentPanel)}
              aria-label={showAgentPanel ? 'Hide agent panel' : 'Show agent panel'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `${spacing['1']} ${spacing['2']}`,
                minHeight: 56,
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: borderRadius.base,
                cursor: 'pointer',
                color: colors.textTertiary,
                fontSize: typography.fontSize.caption,
                fontFamily: typography.fontFamily,
              }}
            >
              <Bot size={12} />
              {showAgentPanel ? 'Hide' : 'Show'} agents
            </button>

            {/* Active agent indicators in toolbar */}
            {activeAgents.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                {activeAgents.map((domain) => {
                  const agentColors = AGENT_COLORS[domain]
                  const Icon = AGENT_ICON_MAP[domain]
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
                        animation: 'pulse 2s infinite',
                      }}
                    >
                      <Icon size={9} />
                      {SPECIALIST_AGENTS[domain].shortName}
                    </span>
                  )
                })}
                <span
                  style={{
                    fontSize: typography.fontSize.caption,
                    color: colors.textTertiary,
                    marginLeft: spacing['1'],
                  }}
                >
                  analyzing...
                </span>
              </div>
            )}

            <div style={{ marginLeft: 'auto', position: 'relative' }}>
              <button
                onClick={() => setExportOpen(!exportOpen)}
                aria-label="Export conversation"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 56,
                  minHeight: 56,
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: borderRadius.base,
                  cursor: 'pointer',
                  color: colors.textTertiary,
                }}
              >
                <Download size={14} />
              </button>
              {exportOpen && (
                <>
                  <div
                    role="presentation"
                    onClick={() => setExportOpen(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                  />
                  <div
                    role="menu"
                    aria-label="Export options"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: spacing['1'],
                      backgroundColor: colors.surfaceRaised,
                      borderRadius: borderRadius.md,
                      boxShadow: shadows.dropdown,
                      zIndex: 999,
                      overflow: 'hidden',
                      minWidth: '180px',
                    }}
                  >
                    {[
                      { icon: <Clipboard size={14} />, label: 'Copy to Clipboard', action: () => {
                        const text = messages.map((m) => `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`).join('\n\n');
                        navigator.clipboard.writeText(text).then(
                          () => addToast('success', 'Conversation copied to clipboard'),
                          () => addToast('error', 'Failed to copy to clipboard'),
                        );
                      }},
                      { icon: <Share2 size={14} />, label: 'Share to Activity Feed', action: () => addToast('info', 'Activity feed sharing will be available in the next update') },
                      { icon: <FileText size={14} />, label: 'Export as PDF', action: () => addToast('info', 'PDF export will be available in the next update') },
                    ].map((item) => (
                      <button
                        role="menuitem"
                        key={item.label}
                        onClick={() => {
                          item.action()
                          setExportOpen(false)
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing['2'],
                          padding: `${spacing['2']} ${spacing['3']}`,
                          minHeight: 56,
                          border: 'none',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          fontSize: typography.fontSize.sm,
                          fontFamily: typography.fontFamily,
                          color: colors.textPrimary,
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ color: colors.textTertiary, display: 'flex' }}>
                          {item.icon}
                        </span>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Messages area */}
          <div
            role="log"
            aria-live="polite"
            aria-label="AI conversation"
            style={{
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: spacing['5'],
              marginBottom: spacing['4'],
            }}
          >
            {/* Empty state with presets */}
            {!hasMessages && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  gap: spacing['6'],
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: borderRadius.full,
                      background: `linear-gradient(135deg, ${colors.statusReview} 0%, ${colors.indigo} 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto',
                      marginBottom: spacing['3'],
                    }}
                  >
                    <Sparkles size={22} color={colors.white} />
                  </div>
                  <h2
                    style={{
                      fontSize: typography.fontSize.subtitle,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.textPrimary,
                      margin: 0,
                      marginBottom: spacing['1'],
                    }}
                  >
                    SiteSync AI Team
                  </h2>
                  <p
                    style={{
                      fontSize: typography.fontSize.sm,
                      color: colors.textTertiary,
                      margin: 0,
                    }}
                  >
                    6 specialist agents working together on your project
                  </p>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: spacing['3'],
                    maxWidth: 560,
                    width: '100%',
                  }}
                >
                  {PRESET_PROMPTS.map((preset) => {
                    const Icon = preset.icon
                    return (
                      <button
                        key={preset.label}
                        onClick={() => handleSendMessage(preset.label)}
                        style={{
                          padding: spacing['4'],
                          minHeight: spacing['14'],
                          textAlign: 'left',
                          backgroundColor: colors.surfaceRaised,
                          border: `1px solid ${colors.borderSubtle}`,
                          borderRadius: borderRadius.lg,
                          cursor: 'pointer',
                          transition: `all ${transitions.quick}`,
                          fontFamily: typography.fontFamily,
                        }}
                        onMouseEnter={(e) => {
                          ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                            colors.borderFocus
                          ;(e.currentTarget as HTMLButtonElement).style.boxShadow =
                            shadows.cardHover
                        }}
                        onMouseLeave={(e) => {
                          ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                            colors.borderSubtle
                          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: spacing['2'],
                            marginBottom: spacing['2'],
                          }}
                        >
                          <Icon size={16} color={colors.statusReview} />
                          <span
                            style={{
                              fontSize: typography.fontSize.caption,
                              color: colors.textTertiary,
                            }}
                          >
                            {preset.agentCount} agent{preset.agentCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: typography.fontSize.sm,
                            fontWeight: typography.fontWeight.medium,
                            color: colors.textPrimary,
                            margin: 0,
                            marginBottom: spacing['1'],
                          }}
                        >
                          {preset.label}
                        </p>
                        <p
                          style={{
                            fontSize: typography.fontSize.caption,
                            color: colors.textTertiary,
                            margin: 0,
                          }}
                        >
                          {preset.description}
                        </p>
                      </button>
                    )
                  })}
                </div>

                {/* Drawing intelligence prompts: shown when arriving from the drawings page */}
                {contextPage === 'drawings' && (
                  <div style={{ maxWidth: 560, width: '100%' }}>
                    <p
                      style={{
                        fontSize: typography.fontSize.caption,
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.textTertiary,
                        textTransform: 'uppercase',
                        letterSpacing: typography.letterSpacing.wider,
                        margin: 0,
                        marginBottom: spacing['2'],
                      }}
                    >
                      Drawing Intelligence
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                      {DRAWING_PROMPTS.map((prompt) => {
                        const Icon = prompt.icon
                        return (
                          <button
                            key={prompt.label}
                            onClick={() => handleSendMessage(prompt.label)}
                            aria-label={prompt.label}
                            style={{
                              padding: `${spacing['3']} ${spacing['4']}`,
                              minHeight: 56,
                              textAlign: 'left',
                              backgroundColor: colors.surfaceRaised,
                              border: `1px solid ${colors.borderSubtle}`,
                              borderRadius: borderRadius.lg,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: spacing['3'],
                              transition: `all ${transitions.quick}`,
                              fontFamily: typography.fontFamily,
                            }}
                          >
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: borderRadius.base,
                                backgroundColor: colors.statusReview,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Icon size={15} color={colors.white} />
                            </div>
                            <div>
                              <p
                                style={{
                                  fontSize: typography.fontSize.sm,
                                  fontWeight: typography.fontWeight.medium,
                                  color: colors.textPrimary,
                                  margin: 0,
                                  marginBottom: spacing['0.5'],
                                }}
                              >
                                {prompt.label}
                              </p>
                              <p
                                style={{
                                  fontSize: typography.fontSize.caption,
                                  color: colors.textTertiary,
                                  margin: 0,
                                }}
                              >
                                {prompt.description}
                              </p>
                            </div>
                            <ChevronRight
                              size={14}
                              color={colors.textTertiary}
                              style={{ marginLeft: 'auto', flexShrink: 0 }}
                            />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Collaboration prompts: shown when arriving from RFIs or submittals */}
                {(contextPage === 'rfis' || contextPage === 'submittals') && (
                  <div style={{ maxWidth: 560, width: '100%' }}>
                    <p
                      style={{
                        fontSize: typography.fontSize.caption,
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.textTertiary,
                        textTransform: 'uppercase',
                        letterSpacing: typography.letterSpacing.wider,
                        margin: 0,
                        marginBottom: spacing['2'],
                      }}
                    >
                      Collaboration
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                      {COLLABORATION_PROMPTS.map((prompt) => {
                        const Icon = prompt.icon
                        return (
                          <button
                            key={prompt.label}
                            onClick={() => handleSendMessage(prompt.label)}
                            style={{
                              padding: `${spacing['3']} ${spacing['4']}`,
                              minHeight: spacing['14'],
                              textAlign: 'left',
                              backgroundColor: colors.surfaceRaised,
                              border: `1px solid ${colors.borderSubtle}`,
                              borderRadius: borderRadius.lg,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: spacing['3'],
                              transition: `all ${transitions.quick}`,
                              fontFamily: typography.fontFamily,
                            }}
                            onMouseEnter={(e) => {
                              ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                                colors.borderFocus
                              ;(e.currentTarget as HTMLButtonElement).style.boxShadow =
                                shadows.cardHover
                            }}
                            onMouseLeave={(e) => {
                              ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                                colors.borderSubtle
                              ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
                            }}
                          >
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: borderRadius.base,
                                backgroundColor: colors.statusActive,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Icon size={15} color={colors.white} />
                            </div>
                            <div>
                              <p
                                style={{
                                  fontSize: typography.fontSize.sm,
                                  fontWeight: typography.fontWeight.medium,
                                  color: colors.textPrimary,
                                  margin: 0,
                                  marginBottom: spacing['0.5'],
                                }}
                              >
                                {prompt.label}
                              </p>
                              <p
                                style={{
                                  fontSize: typography.fontSize.caption,
                                  color: colors.textTertiary,
                                  margin: 0,
                                }}
                              >
                                {prompt.description}
                              </p>
                            </div>
                            <ChevronRight
                              size={14}
                              color={colors.textTertiary}
                              style={{ marginLeft: 'auto', flexShrink: 0 }}
                            />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Chat messages */}
            {messages.map((msg) => (
              <MessageRenderer key={msg.id} message={msg} onSend={handleSendMessage} />
            ))}

            {/* Typing indicators */}
            {isProcessing && <AgentTypingIndicator activeAgents={activeAgents} />}

            {/* Batch action preview */}
            {pendingActions.length > 0 && (
              <div style={{ marginLeft: '40px', maxWidth: 600 }}>
                <BatchActionPreview
                  actions={pendingActions}
                  onApprove={approveAction}
                  onReject={rejectAction}
                  onApproveAll={approveAllPending}
                  onRejectAll={rejectAllPending}
                />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <AgentMentionInput
            onSend={handleSendMessage}
            disabled={isProcessing}
            placeholder="Ask your AI team... Use @ to route to a specific agent"
          />
        </div>
      </div>
    </PageContainer>
  )
}
