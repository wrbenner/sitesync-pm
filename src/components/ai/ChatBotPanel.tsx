import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Bot,
  MessageSquare,
  Minus,
  Send,
  Wrench,
  Copy,
  RefreshCcw,
  ThumbsUp,
  ThumbsDown,
  Check,
  X,
  List,
  Plus,
} from 'lucide-react'
import { colors, spacing, typography, shadows, borderRadius, zIndex } from '../../styles/theme'
import { useMultiAgentChat, useConversationHistory } from '../../hooks/useMultiAgentChat'
import type { AgentConversationMessage } from '../../types/agents'

// ── Helpers ───────────────────────────────────────────────

const formatTime = (date: Date): string =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const formatInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = []
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    if (match[1] !== undefined) {
      parts.push(
        <strong key={`${keyPrefix}-b-${match.index}`} style={{ fontWeight: typography.fontWeight.semibold }}>
          {match[1]}
        </strong>,
      )
    } else if (match[2] !== undefined) {
      parts.push(<em key={`${keyPrefix}-i-${match.index}`}>{match[2]}</em>)
    } else if (match[3] !== undefined) {
      parts.push(
        <code
          key={`${keyPrefix}-c-${match.index}`}
          style={{
            background: colors.surfaceInset,
            borderRadius: 4,
            padding: '1px 5px',
            fontSize: '0.9em',
            fontFamily: typography.fontFamilyMono,
          }}
        >
          {match[3]}
        </code>,
      )
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length > 0 ? parts : [text]
}

const renderContent = (content: string): React.ReactNode => {
  const lines = content.split('\n')
  const out: React.ReactNode[] = []
  let listBuf: React.ReactNode[] = []
  const flush = () => {
    if (listBuf.length) {
      out.push(
        <ul key={`ul-${out.length}`} style={{ paddingLeft: 20, margin: `${spacing.xs} 0` }}>
          {listBuf}
        </ul>,
      )
      listBuf = []
    }
  }
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd()
    if (line.startsWith('### ')) {
      flush()
      out.push(
        <h4 key={`h-${idx}`} style={{ margin: `${spacing.sm} 0 ${spacing.xs}`, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold }}>
          {formatInline(line.slice(4), `h-${idx}`)}
        </h4>,
      )
    } else if (line.startsWith('- ')) {
      listBuf.push(<li key={`li-${idx}`}>{formatInline(line.slice(2), `li-${idx}`)}</li>)
    } else if (line === '') {
      flush()
    } else {
      flush()
      out.push(
        <p key={`p-${idx}`} style={{ margin: `${spacing.xs} 0` }}>
          {formatInline(line, `p-${idx}`)}
        </p>,
      )
    }
  })
  flush()
  return out
}

// ── Types ─────────────────────────────────────────────────

export interface ChatBotPanelProps {
  pageContext?: string
  entityContext?: string
  offsetRightPx?: number
  initialOpen?: boolean
}

// ── Tool Call Card ────────────────────────────────────────

const ToolCallCard: React.FC<{ name: string; status?: 'running' | 'done' | 'failed' }> = ({
  name,
  status = 'done',
}) => {
  const color =
    status === 'running'
      ? colors.primaryOrange
      : status === 'failed'
        ? colors.statusCritical
        : colors.statusActive
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        background: colors.surfaceInset,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.base,
        fontSize: typography.fontSize.label,
        color: colors.textSecondary,
        marginTop: spacing.xs,
      }}
    >
      <Wrench size={12} color={color} />
      <span>{name}</span>
      {status === 'running' && (
        <span style={{ color: colors.primaryOrange, marginLeft: 4 }}>running…</span>
      )}
    </div>
  )
}

// ── Typing Indicator ──────────────────────────────────────

const TypingDots: React.FC = () => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 12px' }}>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: colors.textTertiary,
          animation: `chatbotBlink 1.2s infinite ${i * 0.2}s`,
        }}
      />
    ))}
  </div>
)

// ── Message Bubble ────────────────────────────────────────

const MessageBubble: React.FC<{
  msg: AgentConversationMessage
  onCopy: (content: string) => void
  onRegenerate?: () => void
  onFeedback?: (id: string, kind: 'up' | 'down') => void
}> = ({ msg, onCopy, onRegenerate, onFeedback }) => {
  const [hover, setHover] = useState(false)
  const isUser = msg.role === 'user'
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: spacing.sm,
      }}
    >
      <div style={{ maxWidth: '85%' }}>
        <div
          style={{
            padding: '10px 14px',
            borderRadius: borderRadius.xl,
            background: isUser ? colors.primaryOrange : colors.surfaceRaised,
            color: isUser ? colors.white : colors.textPrimary,
            border: isUser ? 'none' : `1px solid ${colors.borderSubtle}`,
            fontSize: typography.fontSize.body,
            lineHeight: typography.lineHeight.normal,
            wordBreak: 'break-word',
          }}
        >
          {renderContent(msg.content)}
          {msg.toolCalls && msg.toolCalls.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: spacing.xs }}>
              {msg.toolCalls.map((tc, i) => (
                <ToolCallCard key={tc.id ?? i} name={tc.tool ?? 'tool'} />
              ))}
            </div>
          )}
        </div>
        <div
          style={{
            marginTop: 4,
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            alignItems: 'center',
            gap: 6,
            fontSize: typography.fontSize.caption,
            color: colors.textTertiary,
          }}
        >
          <span>{formatTime(msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp))}</span>
          {!isUser && hover && (
            <>
              <IconButton aria-label="Copy" onClick={() => onCopy(msg.content)}>
                <Copy size={12} />
              </IconButton>
              {onRegenerate && (
                <IconButton aria-label="Regenerate" onClick={onRegenerate}>
                  <RefreshCcw size={12} />
                </IconButton>
              )}
              {onFeedback && (
                <>
                  <IconButton aria-label="Good response" onClick={() => onFeedback(msg.id, 'up')}>
                    <ThumbsUp size={12} />
                  </IconButton>
                  <IconButton aria-label="Bad response" onClick={() => onFeedback(msg.id, 'down')}>
                    <ThumbsDown size={12} />
                  </IconButton>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...rest }) => (
  <button
    {...rest}
    style={{
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      color: colors.textTertiary,
      padding: 2,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.sm,
    }}
  >
    {children}
  </button>
)

// ── Main Panel ────────────────────────────────────────────

export const ChatBotPanel: React.FC<ChatBotPanelProps> = ({
  pageContext,
  entityContext,
  offsetRightPx = 0,
  initialOpen = false,
}) => {
  const [isMinimized, setIsMinimized] = useState(!initialOpen)
  const [isListOpen, setIsListOpen] = useState(false)
  const [width, setWidth] = useState(380)
  const [height, setHeight] = useState(560)
  const resizingRef = useRef<{ startX: number; startY: number; w: number; h: number } | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const { messages, input, setInput, sendMessage, isProcessing, resetConversation } =
    useMultiAgentChat(pageContext, entityContext)
  const history = useConversationHistory()
  const [conversations, setConversations] = useState<
    Array<{ id: string; conversation_topic: string | null; started_at: string | null }>
  >([])

  useEffect(() => {
    if (isListOpen) {
      history.load().then((list) => {
        setConversations(list as typeof conversations)
      })
    }
  }, [isListOpen, history])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isProcessing])

  const onSend = useCallback(() => {
    if (!input.trim() || isProcessing) return
    sendMessage(input.trim())
  }, [input, isProcessing, sendMessage])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const handleCopy = (content: string) => {
    try {
      void navigator.clipboard.writeText(content)
      setCopiedId(content.slice(0, 32))
      window.setTimeout(() => setCopiedId(null), 1200)
    } catch {
      /* clipboard unavailable */
    }
  }

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    resizingRef.current = { startX: e.clientX, startY: e.clientY, w: width, h: height }
    const move = (ev: MouseEvent) => {
      if (!resizingRef.current) return
      const dx = resizingRef.current.startX - ev.clientX
      const dy = resizingRef.current.startY - ev.clientY
      setWidth(Math.min(720, Math.max(320, resizingRef.current.w + dx)))
      setHeight(Math.min(900, Math.max(400, resizingRef.current.h + dy)))
    }
    const up = () => {
      resizingRef.current = null
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        aria-label="Open chatbot"
        style={{
          position: 'fixed',
          right: 16 + offsetRightPx,
          bottom: 16,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          background: colors.primaryOrange,
          color: colors.white,
          boxShadow: shadows.panel,
          cursor: 'pointer',
          zIndex: zIndex.popover,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MessageSquare size={24} />
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 16 + offsetRightPx,
        bottom: 16,
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        background: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.xl,
        boxShadow: shadows.panel,
        zIndex: zIndex.popover,
        overflow: 'hidden',
        fontFamily: typography.fontFamily,
      }}
    >
      <style>{`@keyframes chatbotBlink { 0%, 80%, 100% { opacity: 0.3 } 40% { opacity: 1 } }`}</style>

      {/* Resize handle (top-left corner) */}
      <div
        onMouseDown={onResizeStart}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 12,
          height: 12,
          cursor: 'nwse-resize',
          zIndex: 2,
        }}
        aria-label="Resize"
      />

      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${colors.borderSubtle}`,
          background: colors.surfaceRaised,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              position: 'relative',
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: colors.primaryOrange,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.white,
            }}
          >
            <Bot size={20} />
            <span
              style={{
                position: 'absolute',
                right: -1,
                bottom: -1,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: colors.statusActive,
                border: `2px solid ${colors.surfaceRaised}`,
              }}
            />
          </div>
          <div>
            <div style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, fontSize: typography.fontSize.title }}>
              SiteSync Copilot
            </div>
            <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
              {isProcessing ? 'Thinking…' : 'Ready'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <IconButton aria-label="Conversations" onClick={() => setIsListOpen((v) => !v)}>
            <List size={18} color={isListOpen ? colors.textPrimary : colors.textTertiary} />
          </IconButton>
          <IconButton aria-label="Minimize" onClick={() => setIsMinimized(true)}>
            <Minus size={18} color={colors.textTertiary} />
          </IconButton>
        </div>
      </div>

      {/* Conversation list drawer */}
      {isListOpen && (
        <div
          style={{
            borderBottom: `1px solid ${colors.borderSubtle}`,
            background: colors.surfacePage,
            maxHeight: 180,
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px' }}>
            <span style={{ fontSize: typography.fontSize.label, color: colors.textSecondary }}>
              Recent
            </span>
            <button
              onClick={() => {
                resetConversation()
                setIsListOpen(false)
              }}
              style={{
                background: 'transparent',
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: borderRadius.sm,
                padding: '2px 8px',
                fontSize: typography.fontSize.label,
                color: colors.textPrimary,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Plus size={12} /> New
            </button>
          </div>
          {conversations.length === 0 ? (
            <div style={{ padding: '8px 12px', color: colors.textTertiary, fontSize: typography.fontSize.label }}>
              No conversations yet.
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                style={{
                  padding: '8px 12px',
                  fontSize: typography.fontSize.sm,
                  color: colors.textPrimary,
                  cursor: 'pointer',
                  borderTop: `1px solid ${colors.borderSubtle}`,
                }}
              >
                {c.conversation_topic ?? 'Untitled'}
              </div>
            ))
          )}
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: spacing.md,
          background: colors.surfacePage,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: spacing.xl,
              color: colors.textSecondary,
              fontSize: typography.fontSize.body,
            }}
          >
            Ask me about your project — RFIs, schedule, drawings, or anything else.
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} onCopy={handleCopy} />
        ))}
        {isProcessing && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <TypingDots />
          </div>
        )}
        <div ref={endRef} />
        {copiedId && (
          <div
            style={{
              position: 'absolute',
              right: 16,
              bottom: 80,
              padding: '4px 8px',
              background: colors.statusActive,
              color: colors.white,
              borderRadius: borderRadius.sm,
              fontSize: typography.fontSize.caption,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Check size={12} /> Copied
          </div>
        )}
      </div>

      {/* Input */}
      <div
        style={{
          padding: spacing.md,
          borderTop: `1px solid ${colors.borderSubtle}`,
          display: 'flex',
          gap: spacing.sm,
          background: colors.surfaceRaised,
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Message the copilot…"
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.md,
            padding: '8px 12px',
            fontSize: typography.fontSize.body,
            fontFamily: typography.fontFamily,
            background: colors.surfacePage,
            color: colors.textPrimary,
            outline: 'none',
            maxHeight: 120,
          }}
        />
        <button
          onClick={onSend}
          disabled={!input.trim() || isProcessing}
          aria-label="Send message"
          style={{
            width: 40,
            height: 40,
            borderRadius: borderRadius.md,
            border: 'none',
            background: input.trim() && !isProcessing ? colors.primaryOrange : colors.surfaceDisabled,
            color: colors.white,
            cursor: input.trim() && !isProcessing ? 'pointer' : 'not-allowed',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isProcessing ? <X size={18} /> : <Send size={18} />}
        </button>
      </div>
    </div>
  )
}

export default ChatBotPanel
