import React, { useState, useRef, useEffect, useCallback, memo } from 'react'
import {
  Sparkles, X, Bot, DollarSign, ShieldCheck, ClipboardCheck, Scale, FileSearch,
  Calendar, Users, Clock, Download, Clipboard, Share2, FileText,
} from 'lucide-react'
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../../styles/theme'
import { useCopilotStore } from '../../stores/copilotStore'
import { useAgentOrchestrator } from '../../stores/agentOrchestrator'
import { useMultiAgentChat } from '../../hooks/useMultiAgentChat'
import { supabase } from '../../lib/supabase'
import { AgentMessage, AgentTypingIndicator, AGENT_COLORS } from './AgentMessage'
import { BatchActionPreview } from './BatchActionPreview'
import { AgentMentionInput } from './AgentMentionInput'
import { GenerativeUIRenderer } from './generativeUI'
import { ToolResultCard } from './ToolResultCard'
import { SPECIALIST_AGENTS, AGENT_DOMAINS } from '../../types/agents'
import type { AgentDomain, AgentConversationMessage } from '../../types/agents'
import { useToast } from '../Primitives'
import { toast } from 'sonner'

// ── Context-aware suggested prompts ──────────────────────────

const CONTEXT_PROMPTS: Record<string, Array<{ label: string; icon: React.ElementType; description: string }>> = {
  rfis: [
    { label: '@document list overdue RFIs', icon: FileSearch, description: 'All RFIs past due date grouped by trade' },
    { label: 'Who is blocking the most open RFIs?', icon: Users, description: 'Ball-in-court analysis by responsible party' },
    { label: '@schedule what RFIs may delay the critical path?', icon: Calendar, description: 'RFI to schedule impact analysis' },
    { label: 'Summarize all open RFIs for the owner', icon: Clipboard, description: 'Owner-ready RFI status summary' },
  ],
  budget: [
    { label: '@cost what is the EAC for this project?', icon: DollarSign, description: 'Estimate at completion via earned value' },
    { label: '@cost show cost variance by division', icon: DollarSign, description: 'Budget vs actual breakdown across all divisions' },
    { label: 'Which change orders are at risk of approval delay?', icon: Clock, description: 'Pending COs flagged for owner review' },
    { label: '@cost is the contingency sufficient?', icon: DollarSign, description: 'Contingency burn rate and forecast' },
  ],
  schedule: [
    { label: '@schedule what is on the critical path?', icon: Calendar, description: 'Critical path tasks and float analysis' },
    { label: '@schedule which tasks are at risk this week?', icon: Calendar, description: 'Near-term risk flag from schedule data' },
    { label: '@schedule predict the new completion date', icon: Calendar, description: 'Forecast based on current progress rate' },
    { label: 'What is causing schedule slippage?', icon: Clock, description: 'Root cause analysis of delays' },
  ],
  'daily-log': [
    { label: '@safety any PPE violations this week?', icon: ShieldCheck, description: 'Safety agent review of field logs' },
    { label: 'Summarize this week in the field', icon: FileText, description: 'AI narrative from daily log entries' },
    { label: '@schedule are crew hours tracking to plan?', icon: Calendar, description: 'Labor hours vs scheduled plan' },
    { label: 'What issues were reported today?', icon: ClipboardCheck, description: 'Open items from the latest daily log' },
  ],
  default: [
    { label: "How's the project doing?", icon: Sparkles, description: 'Multi-agent health check across all areas' },
    { label: 'What needs my attention today?', icon: Clock, description: 'Overdue items, pending approvals, risk flags' },
    { label: '@safety any open safety issues?', icon: ShieldCheck, description: 'Safety agent review' },
    { label: '@cost what is the EAC for this project?', icon: DollarSign, description: 'Cost agent earned value analysis' },
  ],
}

const AGENT_ICON_MAP: Record<AgentDomain, React.ElementType> = {
  schedule: Calendar,
  cost: DollarSign,
  safety: ShieldCheck,
  quality: ClipboardCheck,
  compliance: Scale,
  document: FileSearch,
}

// ── Message renderer (same pattern as AICopilot) ─────────────

const PanelMessageRenderer = memo<{
  message: AgentConversationMessage
  onSend: (text: string) => void
}>(({ message, onSend }) => (
  <div>
    <AgentMessage message={message} />
    {message.toolCalls && message.toolCalls.length > 0 && (() => {
      const uiBlocks = message.generativeBlocks || []
      const plainToolCalls = message.toolCalls.filter(
        (tc) => !(tc.result as Record<string, unknown>).ui_type,
      )
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginTop: spacing['2'], marginLeft: '40px' }}>
          {plainToolCalls.map((tc, i) => (
            <ToolResultCard key={i} result={{ tool: tc.tool, input: tc.input, result: tc.result }} />
          ))}
          {uiBlocks.map((block, i) => (
            <GenerativeUIRenderer
              key={`ui-${i}`}
              block={block as Record<string, unknown>}
              onAction={(action, data) => onSend(`Execute: ${action} with ${JSON.stringify(data)}`)}
            />
          ))}
        </div>
      )
    })()}
    {message.generativeBlocks && message.generativeBlocks.length > 0 && !message.toolCalls && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginTop: spacing['2'], marginLeft: '40px' }}>
        {message.generativeBlocks.map((block, i) => (
          <GenerativeUIRenderer
            key={`gen-${i}`}
            block={block as Record<string, unknown>}
            onAction={(action, data) => onSend(`Execute: ${action} with ${JSON.stringify(data)}`)}
          />
        ))}
      </div>
    )}
  </div>
))
PanelMessageRenderer.displayName = 'PanelMessageRenderer'

// ── CopilotPanel ──────────────────────────────────────────────

export const CopilotPanel: React.FC = () => {
  const { isOpen, closeCopilot, currentPageContext } = useCopilotStore()
  const { addToast } = useToast()
  const { addCoordinatorMessage } = useAgentOrchestrator()

  const {
    messages,
    input,
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
    error,
  } = useMultiAgentChat(currentPageContext)

  const [exportOpen, setExportOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768)
  const [panelWidth, setPanelWidth] = useState<string>(() => window.innerWidth < 640 ? '100vw' : '360px')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasMessages = messages.length > 0

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
      setPanelWidth(window.innerWidth < 640 ? '100vw' : '360px')
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isProcessing, scrollToBottom])

  useEffect(() => {
    if (error) {
      toast.error('AI response failed')
    }
  }, [error])

  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`copilot:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as { role?: string; content?: string }
          if (row.role === 'assistant' && row.content) {
            addCoordinatorMessage(row.content)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, addCoordinatorMessage])

  const handleSendMessage = useCallback(
    (text: string) => {
      setInput(text)
      requestAnimationFrame(() => sendMessage(text))
    },
    [setInput, sendMessage],
  )

  const contextPrompts = CONTEXT_PROMPTS[currentPageContext] ?? CONTEXT_PROMPTS.default

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCopilot()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, closeCopilot])

  return (
    <>
      {/* Dark overlay */}
      <div
        onClick={closeCopilot}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          zIndex: 49,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: `opacity 150ms ease-out`,
        }}
      />

      {/* Slide-in panel */}
      <div
        role="dialog"
        aria-label="AI Copilot"
        aria-modal="true"
        onKeyDown={(e) => { if (e.key === 'Escape') closeCopilot() }}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          ...(isMobile
            ? { inset: 0, width: '100%', height: '100%', borderRadius: 0 }
            : { width: panelWidth, maxWidth: panelWidth === '100vw' ? '100vw' : '85vw', height: '100vh' }),
          backgroundColor: colors.surfaceRaised,
          boxShadow: shadows.panel,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: `transform 150ms ease-out`,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['2'],
            padding: `${spacing['3']} ${spacing['4']}`,
            borderBottom: `1px solid ${colors.borderSubtle}`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: borderRadius.full,
              background: `linear-gradient(135deg, ${colors.statusReview} 0%, #9B8ADB 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Sparkles size={14} color={colors.white} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              AI Copilot
            </p>
            {currentPageContext !== 'dashboard' && (
              <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'capitalize' }}>
                {currentPageContext.replace('-', ' ')} context
              </p>
            )}
          </div>

          {/* Active agent indicators */}
          {activeAgents.length > 0 && (
            <div style={{ display: 'flex', gap: spacing['1'] }}>
              {activeAgents.map((domain) => {
                const agentColors = AGENT_COLORS[domain]
                const Icon = AGENT_ICON_MAP[domain]
                return (
                  <span
                    key={domain}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
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
            </div>
          )}

          {/* Export button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setExportOpen(!exportOpen)}
              aria-label="Export conversation"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
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
                <div onClick={() => setExportOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
                <div
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
                    { icon: <Clipboard size={14} />, label: 'Copy to Clipboard' },
                    { icon: <Share2 size={14} />, label: 'Share to Activity Feed' },
                    { icon: <FileText size={14} />, label: 'Export as PDF' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        addToast('success', `${item.label}: Feature pending configuration`)
                        setExportOpen(false)
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing['2'],
                        padding: `${spacing['2']} ${spacing['3']}`,
                        border: 'none',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        fontSize: typography.fontSize.sm,
                        fontFamily: typography.fontFamily,
                        color: colors.textPrimary,
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ color: colors.textTertiary, display: 'flex' }}>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* New conversation button */}
          <button
            onClick={clearMessages}
            style={{
              padding: `${spacing['1']} ${spacing['2']}`,
              backgroundColor: 'transparent',
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.base,
              fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily,
              color: colors.textSecondary,
              cursor: 'pointer',
            }}
          >
            + New
          </button>

          {/* Close button */}
          <button
            onClick={closeCopilot}
            aria-label="Close AI copilot panel"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: borderRadius.base,
              cursor: 'pointer',
              color: colors.textTertiary,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceHover }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Messages area */}
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="AI conversation messages"
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: spacing['4'],
            padding: `${spacing['4']} ${spacing['4']} ${isMobile ? '80px' : spacing['2']}`,
          }}
        >
          {/* Empty state with context-aware prompts */}
          {!hasMessages && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
              <div style={{ textAlign: 'center', paddingTop: spacing['4'], paddingBottom: spacing['2'] }}>
                <p
                  style={{
                    fontSize: typography.fontSize.caption,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.textTertiary,
                    textTransform: 'uppercase',
                    letterSpacing: typography.letterSpacing.wider,
                    margin: 0,
                    marginBottom: spacing['1'],
                  }}
                >
                  {currentPageContext !== 'dashboard' ? `${currentPageContext.replace('-', ' ')} suggestions` : 'Suggested prompts'}
                </p>
              </div>
              {contextPrompts.map((prompt) => {
                const Icon = prompt.icon
                return (
                  <button
                    key={prompt.label}
                    onClick={() => handleSendMessage(prompt.label)}
                    aria-label={prompt.label}
                    style={{
                      padding: `${spacing['3']} ${spacing['3']}`,
                      minHeight: '44px',
                      textAlign: 'left',
                      backgroundColor: colors.surfacePage,
                      border: `1px solid ${colors.borderSubtle}`,
                      borderRadius: borderRadius.base,
                      cursor: 'pointer',
                      transition: `all ${transitions.quick}`,
                      fontFamily: typography.fontFamily,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: spacing['2'],
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = colors.borderFocus
                      ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceRaised
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = colors.borderSubtle
                      ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfacePage
                    }}
                  >
                    <Icon size={14} color={colors.statusReview} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: 2 }}>
                        {prompt.label}
                      </p>
                      <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                        {prompt.description}
                      </p>
                    </div>
                  </button>
                )
              })}

              {/* Specialist agents quick access */}
              <div style={{ marginTop: spacing['2'] }}>
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'] }}>
                  {AGENT_DOMAINS.map((domain) => {
                    const agent = SPECIALIST_AGENTS[domain]
                    const agentColors = AGENT_COLORS[domain]
                    const Icon = AGENT_ICON_MAP[domain]
                    return (
                      <button
                        key={domain}
                        onClick={() => setInput(`@${domain} `)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: spacing['1'],
                          padding: `${spacing['1']} ${spacing['2']}`,
                          minHeight: '44px',
                          borderRadius: borderRadius.full,
                          backgroundColor: agentColors.subtle,
                          color: agentColors.fg,
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: typography.fontSize.caption,
                          fontWeight: typography.fontWeight.medium,
                          fontFamily: typography.fontFamily,
                        }}
                      >
                        <Icon size={10} />
                        {agent.shortName}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg) => (
            <div key={msg.id} role="listitem">
              <PanelMessageRenderer message={msg} onSend={handleSendMessage} />
            </div>
          ))}

          {/* Typing indicators */}
          {isProcessing && <AgentTypingIndicator activeAgents={activeAgents} />}

          {/* Batch action preview */}
          {pendingActions.length > 0 && (
            <div style={{ marginLeft: '40px' }}>
              <BatchActionPreview
                actions={pendingActions}
                onApprove={approveAction}
                onReject={rejectAction}
                onApproveAll={approveAllPending}
                onRejectAll={rejectAllPending}
              />
            </div>
          )}

          {/* Last routing info */}
          {lastIntent && lastIntent.targetAgents.length > 0 && hasMessages && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['1'], paddingLeft: '40px' }}>
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
          )}

          {/* Error banner */}
          {error && (() => {
            const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
            return (
              <div
                role="alert"
                style={{
                  backgroundColor: colors.statusCriticalSubtle,
                  borderLeft: `3px solid ${colors.statusCritical}`,
                  padding: spacing['3'],
                  borderRadius: borderRadius.md,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing['2'],
                }}
              >
                <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.statusCritical }}>
                  Unable to get a response. Check your connection.
                </p>
                {lastUserMessage && (
                  <button
                    onClick={() => handleSendMessage(lastUserMessage.content)}
                    style={{
                      flexShrink: 0,
                      padding: `${spacing['1']} ${spacing['2']}`,
                      backgroundColor: colors.statusCritical,
                      border: 'none',
                      borderRadius: borderRadius.base,
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.semibold,
                      fontFamily: typography.fontFamily,
                      color: colors.white,
                      cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                )}
              </div>
            )
          })()}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          style={{
            ...(isMobile
              ? { position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: colors.surfaceRaised, borderTop: `1px solid ${colors.borderSubtle}`, zIndex: 51 }
              : {}),
            padding: `${spacing['3']} ${spacing['4']} ${isMobile ? 'max(env(safe-area-inset-bottom), 16px)' : spacing['4']}`,
            flexShrink: 0,
          }}
        >
          <AgentMentionInput
            onSend={handleSendMessage}
            disabled={isProcessing}
            placeholder="Ask your AI team... Use @ to route to a specific agent"
          />
        </div>
      </div>
    </>
  )
}
