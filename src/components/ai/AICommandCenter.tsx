// ── AI Command Center ─────────────────────────────────────────
// Enhanced port of sitesyncai-web ChatBot. Context-aware, dockable,
// with quick-action chips, voice input, inline entity cards, and
// streaming tool-call visualization.

import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react'
import {
  Sparkles, Mic, MicOff, Send, Minimize2, Maximize2,
  PanelRight, PanelBottom, ExternalLink, Wand2, Zap,
  AlertTriangle, FileText, BarChart3, Loader2,
} from 'lucide-react'
import { colors, spacing, typography, borderRadius, transitions, shadows, zIndex } from '../../styles/theme'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import { useProjectId } from '../../hooks/useProjectId'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

// ── Dock positions ───────────────────────────────────────────
type DockPosition = 'right' | 'bottom' | 'floating'
const DOCK_STORAGE_KEY = 'ai-cmdcenter-dock'
const SIZE_STORAGE_KEY = 'ai-cmdcenter-size'

// ── Message types ────────────────────────────────────────────
interface ToolCall {
  id: string
  name: string
  status: 'running' | 'complete' | 'error'
  args?: Record<string, unknown>
  result?: unknown
  durationMs?: number
}

interface EntityRef {
  type: 'rfi' | 'drawing' | 'submittal' | 'task' | 'document'
  id: string
  title: string
  status?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  streaming?: boolean
  toolCalls?: ToolCall[]
  entities?: EntityRef[]
  timestamp: number
}

// ── Context awareness ────────────────────────────────────────
interface PageContext {
  page: string
  label: string
  stats?: Record<string, number | string>
}

function usePageContext(): PageContext {
  const location = useLocation()
  const [stats, setStats] = useState<Record<string, number | string>>({})
  const projectId = useProjectId()

  useEffect(() => {
    if (!projectId) return
    const path = location.pathname.split('/').pop() || ''

    ;(async () => {
      try {
        if (path === 'drawings') {
          const { count: sheets } = await fromTable('drawing_classifications')
            .select('*', { count: 'exact', head: true }).eq('project_id' as never, projectId)
          const { count: pairs } = await fromTable('drawing_pairs')
            .select('*', { count: 'exact', head: true }).eq('project_id' as never, projectId)
          setStats({ sheets: sheets ?? 0, pairs: pairs ?? 0 })
        } else if (path === 'rfis') {
          const { count: open } = await fromTable('rfis')
            .select('*', { count: 'exact', head: true })
            .eq('project_id' as never, projectId).eq('status' as never, 'open')
          setStats({ openRfis: open ?? 0 })
        } else if (path === 'tasks') {
          const { count: open } = await fromTable('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('project_id' as never, projectId).neq('status' as never, 'done')
          setStats({ openTasks: open ?? 0 })
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[AICommandCenter] Context stats failed:', err)
      }
    })()
  }, [location.pathname, projectId])

  const page = location.pathname.split('/').pop() || 'dashboard'
  return {
    page,
    label: page.charAt(0).toUpperCase() + page.slice(1),
    stats,
  }
}

// ── Quick actions ────────────────────────────────────────────
const QUICK_ACTIONS = [
  { id: 'analyze', label: 'Analyze Drawings', icon: Wand2, prompt: 'Analyze all uploaded drawings for this project and report classifications and pair relationships.' },
  { id: 'discrepancies', label: 'Find Discrepancies', icon: AlertTriangle, prompt: 'Scan drawing pairs for discrepancies and rank them by severity.' },
  { id: 'report', label: 'Generate Report', icon: FileText, prompt: 'Generate a project status report for the owner: RFIs, schedule risks, budget variance.' },
  { id: 'summary', label: 'Summarize Project', icon: BarChart3, prompt: 'Summarize the project in 5 bullet points: progress, risks, overdue items, budget, next actions.' },
] as const

// ── Voice input (Web Speech API) ─────────────────────────────
function useVoiceInput(onTranscript: (text: string) => void) {
  const recognitionRef = useRef<unknown>(null)
  const [listening, setListening] = useState(false)
  const [supported] = useState(() => {
    if (typeof window === 'undefined') return false
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition)
  })

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as undefined | (new () => {
      continuous: boolean
      interimResults: boolean
      lang: string
      start: () => void
      stop: () => void
      onresult: ((e: unknown) => void) | null
      onend: (() => void) | null
      onerror: ((e: unknown) => void) | null
    })
    if (!Ctor) return
    const r = new Ctor()
    r.continuous = false
    r.interimResults = false
    r.lang = 'en-US'
    r.onresult = (e: unknown) => {
      const ev = e as { results: ArrayLike<ArrayLike<{ transcript: string }>> }
      const text = ev.results[0][0].transcript
      onTranscript(text)
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    recognitionRef.current = r
  }, [onTranscript])

  const start = useCallback(() => {
    const r = recognitionRef.current as { start: () => void } | null
    if (!r) return
    try {
      r.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }, [])

  const stop = useCallback(() => {
    const r = recognitionRef.current as { stop: () => void } | null
    r?.stop()
    setListening(false)
  }, [])

  return { listening, supported, start, stop }
}

// ── Entity card ──────────────────────────────────────────────
const EntityCard = memo<{ entity: EntityRef; onOpen: (e: EntityRef) => void }>(({ entity, onOpen }) => {
  const statusColor: Record<string, string> = {
    open: colors.statusWarning,
    closed: colors.statusSuccess,
    pending: colors.statusInfo,
    overdue: colors.statusCritical,
  }
  const badge = entity.status ? statusColor[entity.status.toLowerCase()] ?? colors.textTertiary : colors.textTertiary
  return (
    <button
      onClick={() => onOpen(entity)}
      style={{
        display: 'flex', alignItems: 'center', gap: spacing['2'],
        padding: `${spacing['2']} ${spacing['3']}`,
        background: colors.surfaceInset, border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.base, cursor: 'pointer',
        minHeight: 56, width: '100%', textAlign: 'left',
        transition: `all ${transitions.instant}`,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = colors.primaryOrange }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = colors.borderSubtle }}
    >
      <div style={{
        padding: `${spacing['1']} ${spacing['2']}`, background: badge, color: 'white',
        fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.bold,
        borderRadius: borderRadius.sm, textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {entity.type}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entity.title}
        </div>
        {entity.status && (
          <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            Status: {entity.status}
          </div>
        )}
      </div>
      <ExternalLink size={16} color={colors.textTertiary} />
    </button>
  )
})
EntityCard.displayName = 'EntityCard'

// ── Tool call card ───────────────────────────────────────────
const ToolCallCard = memo<{ call: ToolCall }>(({ call }) => {
  const iconColor = call.status === 'error' ? colors.statusCritical : call.status === 'complete' ? colors.statusSuccess : colors.primaryOrange
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: spacing['2'],
      padding: spacing['2'], background: colors.surfaceInset,
      border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.sm,
      fontSize: typography.fontSize.caption, color: colors.textSecondary,
    }}>
      {call.status === 'running'
        ? <Loader2 size={14} color={iconColor} style={{ animation: 'spin 1s linear infinite' }} />
        : <Zap size={14} color={iconColor} />}
      <code style={{ fontFamily: 'monospace', color: colors.textPrimary }}>{call.name}</code>
      {call.durationMs !== undefined && (
        <span style={{ marginLeft: 'auto', color: colors.textTertiary }}>{call.durationMs}ms</span>
      )}
    </div>
  )
})
ToolCallCard.displayName = 'ToolCallCard'

// ── Parse assistant text for entity refs ─────────────────────
// Markdown-style: [RFI-42](rfi:uuid) or plain text "RFI #42"
function extractEntities(text: string): EntityRef[] {
  const out: EntityRef[] = []
  const linkRx = /\[([^\]]+)\]\((rfi|drawing|submittal|task|document):([^)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = linkRx.exec(text))) {
    out.push({ title: m[1], type: m[2] as EntityRef['type'], id: m[3] })
  }
  return out
}

// ── Main component ───────────────────────────────────────────
export function AICommandCenter() {
  const navigate = useNavigate()
  const projectId = useProjectId()
  const ctx = usePageContext()

  const [dock, setDock] = useState<DockPosition>(() => {
    try { return (localStorage.getItem(DOCK_STORAGE_KEY) as DockPosition) || 'right' } catch { return 'right' }
  })
  const [collapsed, setCollapsed] = useState(false)
  const [size, _setSize] = useState<{ w: number; h: number }>(() => {
    try { const s = localStorage.getItem(SIZE_STORAGE_KEY); return s ? JSON.parse(s) : { w: 440, h: 640 } } catch { return { w: 440, h: 640 } }
  })
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { try { localStorage.setItem(DOCK_STORAGE_KEY, dock) } catch { /* ignore */ } }, [dock])
  useEffect(() => { try { localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(size)) } catch { /* ignore */ } }, [size])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const voice = useVoiceInput((text) => setInput((prev) => prev ? `${prev} ${text}` : text))

  const openEntity = useCallback((e: EntityRef) => {
    const route: Record<EntityRef['type'], string> = {
      rfi: 'rfis', drawing: 'drawings', submittal: 'submittals', task: 'tasks', document: 'files',
    }
    navigate(`/projects/${projectId}/${route[e.type]}?highlight=${e.id}`)
  }, [navigate, projectId])

  const contextPreamble = useMemo(() => {
    const parts: string[] = [`Current page: ${ctx.label}.`]
    if (ctx.stats && Object.keys(ctx.stats).length) {
      parts.push(`Page stats: ${JSON.stringify(ctx.stats)}.`)
    }
    if (projectId) parts.push(`Project: ${projectId}.`)
    return parts.join(' ')
  }, [ctx, projectId])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || sending) return
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() }
    const assistantId = crypto.randomUUID()
    const assistantMsg: Message = {
      id: assistantId, role: 'assistant', content: '', streaming: true,
      toolCalls: [], entities: [], timestamp: Date.now(),
    }
    setMessages((m) => [...m, userMsg, assistantMsg])
    setInput('')
    setSending(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || ''
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-copilot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          project_id: projectId,
          context: contextPreamble,
          messages: [...messages.filter((m) => m.role !== 'system'), userMsg].map((m) => ({
            role: m.role, content: m.content,
          })),
        }),
      })
      if (!res.ok || !res.body) throw new Error(`AI request failed: ${res.status}`)

      // Stream response (SSE or chunked)
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        // Try parsing SSE lines
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (payload === '[DONE]') continue
          try {
            const evt = JSON.parse(payload) as {
              type?: string; delta?: string; tool?: ToolCall; entities?: EntityRef[]
            }
            setMessages((cur) => cur.map((m) => {
              if (m.id !== assistantId) return m
              if (evt.type === 'tool') {
                const tc = [...(m.toolCalls ?? []), evt.tool!]
                return { ...m, toolCalls: tc }
              }
              if (evt.type === 'delta' && evt.delta) {
                return { ...m, content: m.content + evt.delta }
              }
              return m
            }))
          } catch {
            // treat as plain text delta
            setMessages((cur) => cur.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + payload } : m
            ))
          }
        }
      }
      // Finalize: extract entities
      setMessages((cur) => cur.map((m) =>
        m.id === assistantId
          ? { ...m, streaming: false, entities: extractEntities(m.content) }
          : m
      ))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setMessages((cur) => cur.map((m) =>
        m.id === assistantId ? { ...m, streaming: false, content: `Error: ${msg}` } : m
      ))
      toast.error('AI request failed')
    } finally {
      setSending(false)
    }
  }, [messages, projectId, contextPreamble, sending])

  // ── Layout positioning ─────────────────────────────────────
  const containerStyle: React.CSSProperties = (() => {
    const base: React.CSSProperties = {
      position: 'fixed',
      zIndex: zIndex.modal,
      background: colors.surfaceRaised,
      border: `1px solid ${colors.borderDefault}`,
      borderRadius: borderRadius.lg,
      boxShadow: shadows.lg,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }
    if (collapsed) {
      return { ...base, right: 24, bottom: 24, width: 64, height: 64, borderRadius: '50%', cursor: 'pointer' }
    }
    if (dock === 'right') {
      return { ...base, right: 16, top: 80, bottom: 16, width: size.w }
    }
    if (dock === 'bottom') {
      return { ...base, left: 16, right: 16, bottom: 16, height: size.h }
    }
    return { ...base, right: 24, bottom: 24, width: size.w, height: size.h }
  })()

  if (collapsed) {
    return (
      <button
        aria-label="Open AI Command Center"
        style={{ ...containerStyle, background: colors.primaryOrange, alignItems: 'center', justifyContent: 'center', border: 'none' }}
        onClick={() => setCollapsed(false)}
      >
        <Sparkles size={24} color="white" />
      </button>
    )
  }

  return (
    <div style={containerStyle} role="complementary" aria-label="AI Command Center">
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing['2'],
        padding: spacing['3'], borderBottom: `1px solid ${colors.borderSubtle}`,
        background: colors.surfacePage,
      }}>
        <Sparkles size={18} color={colors.primaryOrange} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            AI Command Center
          </div>
          <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            {ctx.label}{Object.entries(ctx.stats ?? {}).map(([k, v]) => ` · ${k}: ${v}`).join('')}
          </div>
        </div>
        <button aria-label="Dock right" onClick={() => setDock('right')} style={iconBtn(dock === 'right')}>
          <PanelRight size={14} />
        </button>
        <button aria-label="Dock bottom" onClick={() => setDock('bottom')} style={iconBtn(dock === 'bottom')}>
          <PanelBottom size={14} />
        </button>
        <button aria-label="Float" onClick={() => setDock('floating')} style={iconBtn(dock === 'floating')}>
          <Maximize2 size={14} />
        </button>
        <button aria-label="Minimize" onClick={() => setCollapsed(true)} style={iconBtn(false)}>
          <Minimize2 size={14} />
        </button>
      </div>

      {/* Quick Actions */}
      <div style={{
        display: 'flex', gap: spacing['2'], padding: spacing['2'],
        borderBottom: `1px solid ${colors.borderSubtle}`, overflowX: 'auto',
      }}>
        {QUICK_ACTIONS.map((a) => {
          const Icon = a.icon
          return (
            <button
              key={a.id}
              onClick={() => send(a.prompt)}
              disabled={sending}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['1'],
                padding: `${spacing['2']} ${spacing['3']}`, minHeight: 56,
                background: colors.surfaceInset, border: `1px solid ${colors.borderSubtle}`,
                borderRadius: borderRadius.base, fontSize: typography.fontSize.caption,
                color: colors.textPrimary, cursor: sending ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap', fontWeight: typography.fontWeight.medium,
              }}
            >
              <Icon size={14} color={colors.primaryOrange} /> {a.label}
            </button>
          )
        })}
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: spacing['3'],
        display: 'flex', flexDirection: 'column', gap: spacing['3'],
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: colors.textTertiary, marginTop: spacing['8'] }}>
            <Sparkles size={32} color={colors.primaryOrange} style={{ marginBottom: spacing['3'] }} />
            <div style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
              Ready to help.
            </div>
            <div style={{ fontSize: typography.fontSize.caption, marginTop: spacing['1'] }}>
              Try a quick action or ask anything about this project.
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: spacing['2'],
          }}>
            <div style={{
              padding: `${spacing['2']} ${spacing['3']}`,
              background: m.role === 'user' ? colors.primaryOrange : colors.surfaceInset,
              color: m.role === 'user' ? 'white' : colors.textPrimary,
              borderRadius: borderRadius.base,
              fontSize: typography.fontSize.body,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {m.content || (m.streaming ? <span style={{ opacity: 0.6 }}>thinking…</span> : '')}
              {m.streaming && m.content && <span style={{ animation: 'pulse 1s infinite' }}>▍</span>}
            </div>
            {m.toolCalls && m.toolCalls.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                {m.toolCalls.map((tc) => <ToolCallCard key={tc.id} call={tc} />)}
              </div>
            )}
            {m.entities && m.entities.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                {m.entities.map((e) => <EntityCard key={`${e.type}-${e.id}`} entity={e} onOpen={openEntity} />)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{
        padding: spacing['3'], borderTop: `1px solid ${colors.borderSubtle}`,
        display: 'flex', gap: spacing['2'], alignItems: 'flex-end',
      }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
          placeholder={`Ask about ${ctx.label}…`}
          rows={2}
          style={{
            flex: 1, resize: 'none', fontFamily: typography.fontFamily,
            fontSize: typography.fontSize.body, padding: spacing['2'],
            border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base,
            background: colors.surfacePage, color: colors.textPrimary, outline: 'none', minHeight: 56,
          }}
        />
        {voice.supported && (
          <button
            aria-label={voice.listening ? 'Stop voice input' : 'Start voice input'}
            onClick={voice.listening ? voice.stop : voice.start}
            style={{
              width: 56, height: 56, minWidth: 56,
              background: voice.listening ? colors.statusCritical : colors.surfaceInset,
              color: voice.listening ? 'white' : colors.textPrimary,
              border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {voice.listening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        )}
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || sending}
          aria-label="Send message"
          style={{
            width: 56, height: 56, minWidth: 56,
            background: colors.primaryOrange, color: 'white',
            border: 'none', borderRadius: borderRadius.base,
            cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
            opacity: input.trim() && !sending ? 1 : 0.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}

function iconBtn(active: boolean): React.CSSProperties {
  return {
    width: 32, height: 32, minWidth: 32, minHeight: 32,
    background: active ? colors.orangeSubtle : 'transparent',
    color: active ? colors.primaryOrange : colors.textSecondary,
    border: 'none', borderRadius: borderRadius.sm,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}

export default AICommandCenter
