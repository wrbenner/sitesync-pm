import React, { useState, useRef, useCallback, memo, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Send, Calendar, DollarSign, ShieldCheck, ClipboardCheck, Scale, FileSearch,
} from 'lucide-react'

const MAX_MESSAGE_LENGTH = 4000
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../../styles/theme'
import type { AgentDomain } from '../../types/agents'
import { SPECIALIST_AGENTS, AGENT_DOMAINS } from '../../types/agents'

// ── Agent Icon Map ────────────────────────────────────────────

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

// ── Agent Mention Input ───────────────────────────────────────

interface AgentMentionInputProps {
  onSend: (text: string) => void
  placeholder?: string
  disabled?: boolean
  textareaAriaLabel?: string
}

export const AgentMentionInput = memo<AgentMentionInputProps>(
  ({ onSend, placeholder = 'Ask your AI team... Use @ to route to a specific agent', disabled, textareaAriaLabel }) => {
    const [value, setValue] = useState('')
    const [showAgentMenu, setShowAgentMenu] = useState(false)
    const [agentFilter, setAgentFilter] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const toastShownRef = useRef(false)

    const filteredAgents = useMemo(() => {
      if (!agentFilter) return [...AGENT_DOMAINS]
      const lower = agentFilter.toLowerCase()
      return AGENT_DOMAINS.filter(
        (d) =>
          d.includes(lower) ||
          SPECIALIST_AGENTS[d].name.toLowerCase().includes(lower) ||
          SPECIALIST_AGENTS[d].shortName.toLowerCase().includes(lower),
      )
    }, [agentFilter])

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        let text = e.target.value
        if (text.length > MAX_MESSAGE_LENGTH) {
          text = text.slice(0, MAX_MESSAGE_LENGTH)
          if (!toastShownRef.current) {
            toastShownRef.current = true
            toast.error('Message is too long. Maximum 4000 characters.')
            setTimeout(() => { toastShownRef.current = false }, 3000)
          }
        }
        setValue(text)

        // Detect @mention trigger
        const atMatch = text.match(/@(\w*)$/)
        if (atMatch) {
          setShowAgentMenu(true)
          setAgentFilter(atMatch[1])
          setSelectedIndex(0)
        } else {
          setShowAgentMenu(false)
          setAgentFilter('')
        }
      },
      [],
    )

    useEffect(() => {
      if (!inputRef.current) return
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + 'px'
    }, [value])

    const insertAgent = useCallback(
      (domain: AgentDomain) => {
        const agent = SPECIALIST_AGENTS[domain]
        const newValue = value.replace(/@\w*$/, `@${domain} `)
        setValue(newValue)
        setShowAgentMenu(false)
        setAgentFilter('')
        inputRef.current?.focus()
      },
      [value],
    )

    const handleSend = useCallback(() => {
      const trimmed = value.trim()
      if (!trimmed || disabled) return
      if (value.length > MAX_MESSAGE_LENGTH) {
        toast.error(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`)
        return
      }
      const sanitized = trimmed.replace(/<[^>]*>/g, '')
      onSend(sanitized)
      setValue('')
      setShowAgentMenu(false)
    }, [value, disabled, onSend])

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (showAgentMenu) {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex((i) => Math.min(i + 1, filteredAgents.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault()
            if (filteredAgents[selectedIndex]) {
              insertAgent(filteredAgents[selectedIndex])
            }
          } else if (e.key === 'Escape') {
            setShowAgentMenu(false)
          }
          return
        }

        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          handleSend()
        }
      },
      [showAgentMenu, filteredAgents, selectedIndex, insertAgent, handleSend],
    )

    return (
      <div style={{ position: 'relative' }}>
        {/* Agent mention dropdown */}
        {showAgentMenu && filteredAgents.length > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              marginBottom: spacing['2'],
              backgroundColor: colors.surfaceRaised,
              borderRadius: borderRadius.lg,
              boxShadow: shadows.dropdown,
              border: `1px solid ${colors.borderDefault}`,
              overflow: 'hidden',
              zIndex: 100,
            }}
            role="listbox"
            aria-label="Select AI agent"
          >
            <div
              style={{
                padding: `${spacing['2']} ${spacing['3']}`,
                borderBottom: `1px solid ${colors.borderSubtle}`,
              }}
            >
              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textTertiary,
                  textTransform: 'uppercase',
                  letterSpacing: typography.letterSpacing.wider,
                }}
              >
                Route to Agent
              </span>
            </div>
            {filteredAgents.map((domain, index) => {
              const agent = SPECIALIST_AGENTS[domain]
              const Icon = AGENT_ICONS[domain]
              const accent = AGENT_ACCENT[domain]
              const isSelected = index === selectedIndex

              return (
                <button
                  key={domain}
                  id={`agent-option-${index}`}
                  onClick={() => insertAgent(domain)}
                  role="option"
                  aria-selected={isSelected}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing['3'],
                    padding: `${spacing['2.5']} ${spacing['3']}`,
                    backgroundColor: isSelected ? colors.surfaceHover : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: typography.fontFamily,
                    transition: `background-color ${transitions.instant}`,
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: borderRadius.base,
                      backgroundColor: accent,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={14} color={colors.white} />
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: typography.fontSize.sm,
                        fontWeight: typography.fontWeight.medium,
                        color: colors.textPrimary,
                      }}
                    >
                      @{domain}
                      <span
                        style={{
                          marginLeft: spacing['2'],
                          fontSize: typography.fontSize.caption,
                          fontWeight: typography.fontWeight.normal,
                          color: colors.textTertiary,
                        }}
                      >
                        {agent.name}
                      </span>
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: typography.fontSize.caption,
                        color: colors.textTertiary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {agent.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Input area */}
        <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: spacing['2'],
            padding: spacing['3'],
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.lg,
            border: `1px solid ${colors.borderDefault}`,
            boxShadow: shadows.card,
            transition: `border-color ${transitions.quick}`,
          }}
        >
          <textarea
            ref={inputRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            aria-disabled={disabled}
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            aria-label={textareaAriaLabel ?? 'Message AI copilot'}
            aria-activedescendant={showAgentMenu ? `agent-option-${selectedIndex}` : undefined}
            style={{
              flex: 1,
              resize: 'none',
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontSize: typography.fontSize.body,
              fontFamily: typography.fontFamily,
              color: colors.textPrimary,
              lineHeight: typography.lineHeight.normal,
              maxHeight: '160px',
              overflow: 'auto',
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'text',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            aria-label="Send message"
            aria-disabled={disabled}
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor:
                value.trim() && !disabled ? colors.primaryOrange : colors.surfaceInset,
              color: value.trim() && !disabled ? colors.white : colors.textTertiary,
              border: 'none',
              borderRadius: borderRadius.base,
              cursor: disabled ? 'not-allowed' : value.trim() ? 'pointer' : 'default',
              opacity: disabled ? 0.5 : 1,
              transition: `all ${transitions.quick}`,
              flexShrink: 0,
            }}
          >
            <Send size={16} />
          </button>
        </div>
        {value.length > 3500 && (
          <div
            style={{
              textAlign: 'right',
              marginTop: spacing['1'],
              fontSize: typography.fontSize.caption,
              color: colors.textTertiary,
            }}
          >
            {MAX_MESSAGE_LENGTH - value.length} characters remaining
          </div>
        )}
        </div>
      </div>
    )
  },
)

AgentMentionInput.displayName = 'AgentMentionInput'
