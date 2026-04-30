import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Send, Plus, MessageSquare, Trash2,
  FileText, BarChart3, Calendar, DollarSign, Shield,
  ChevronDown, Copy, Check, Loader2, User,
  ArrowDown, Eye, History, ClipboardList, AlertTriangle,
  CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { colors, spacing, typography, borderRadius } from '../styles/theme';

// Tailwind-style palettes for the AI page (the shared theme uses flat tokens)
const gray = {
  50: '#FAFAF9', 100: '#F5F4F2', 200: '#E8E6E3', 300: '#D0D0D0',
  400: '#B0B0B0', 500: '#8B8680', 600: '#6B6560', 700: '#5C5550', 800: '#3D3833',
} as const;
const blue = {
  300: '#93C5FD', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8',
} as const;
const indigo = {
  600: '#4F46E5', 700: '#4338CA',
} as const;

import { useProjectContext } from '../stores/projectContextStore';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  useAgentTasks,
  usePendingApprovalTasks,
  type AgentDomain,
  type AgentTask,
  type AgentTaskStatus,
} from '../hooks/queries/agent-tasks';
import {
  useCreateAgentTask,
  useApproveAgentTask,
  useRejectAgentTask,
} from '../hooks/mutations/agent-tasks';

// ── Types ─────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

// ── Suggested prompts ─────────────────────────────────────

interface SuggestedPrompt {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  prompt: string;
  domain: AgentDomain;
}

const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  { icon: BarChart3, label: 'Budget Analysis', domain: 'cost', prompt: 'Analyze my project budget and identify any cost overruns or areas where we\'re trending over budget.' },
  { icon: Calendar, label: 'Schedule Review', domain: 'schedule', prompt: 'Review the current project schedule and flag any tasks that are behind or at risk of delay.' },
  { icon: Shield, label: 'Safety Summary', domain: 'safety', prompt: 'Give me a summary of safety incidents and inspections from the past 30 days.' },
  { icon: DollarSign, label: 'Cash Flow Forecast', domain: 'cost', prompt: 'Generate a cash flow forecast for the next 3 months based on current commitments and pay applications.' },
  { icon: FileText, label: 'Daily Log Draft', domain: 'document', prompt: 'Help me draft today\'s daily log with weather, manpower, and work performed sections.' },
  { icon: MessageSquare, label: 'RFI Response', domain: 'quality', prompt: 'Help me draft a response to the latest open RFI with supporting documentation references.' },
];

// Infer the agent_domain from free-text when the user didn't click a
// suggested prompt. Pretty dumb keyword match; the orchestrator does
// its own routing — this is just for tagging persisted history.
function inferDomain(text: string): AgentDomain {
  const t = text.toLowerCase();
  if (/budget|cost|cash|money|spend|pay app|change order/.test(t)) return 'cost';
  if (/schedule|delay|behind|timeline|critical path|float/.test(t)) return 'schedule';
  if (/safety|incident|osha|inspection|hazard|ppe/.test(t)) return 'safety';
  if (/punch|submittal|qa|qc|defect|rework/.test(t)) return 'quality';
  if (/compliance|payroll|prevailing|wage|lien|coi|insurance|permit/.test(t)) return 'compliance';
  if (/drawing|sheet|rfi|document|spec|markup/.test(t)) return 'document';
  return 'general';
}

const DOMAIN_LABEL: Record<AgentDomain, string> = {
  schedule: 'Schedule',
  cost: 'Cost',
  safety: 'Safety',
  quality: 'Quality',
  compliance: 'Compliance',
  document: 'Document',
  general: 'General',
};

const STATUS_LABEL: Record<AgentTaskStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  cancelled: 'Cancelled',
  pending_approval: 'Awaiting approval',
};

const STATUS_COLOR: Record<AgentTaskStatus, string> = {
  pending: colors.statusInfo,
  running: colors.statusInfo,
  succeeded: colors.statusSuccess,
  failed: colors.statusCritical,
  cancelled: colors.textTertiary,
  pending_approval: colors.statusPending,
};

const STATUS_ICON: Record<AgentTaskStatus, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  pending: Clock,
  running: Loader2,
  succeeded: CheckCircle2,
  failed: XCircle,
  cancelled: XCircle,
  pending_approval: AlertTriangle,
};

// ── Markdown-lite renderer ────────────────────────────────

function renderContent(text: string): React.ReactNode {
  const blocks = text.split(/\n\n+/);
  return blocks.map((block, i) => {
    // Code block
    if (block.startsWith('```')) {
      const lines = block.split('\n');
      const lang = lines[0].replace('```', '').trim();
      const code = lines.slice(1, lines[lines.length - 1] === '```' ? -1 : undefined).join('\n');
      return (
        <pre key={i} style={{
          background: colors.textPrimary,
          color: colors.surfaceInset,
          padding: spacing[4],
          borderRadius: borderRadius.lg,
          overflowX: 'auto',
          fontSize: '13px',
          lineHeight: 1.6,
          margin: `${spacing[3]} 0`,
          border: `1px solid ${colors.gray700}`,
        }}>
          {lang && (
            <div style={{ color: colors.gray500, fontSize: '11px', marginBottom: spacing[2], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {lang}
            </div>
          )}
          <code>{code}</code>
        </pre>
      );
    }
    // Heading
    if (block.startsWith('### ')) {
      return <h3 key={i} style={{ fontSize: '15px', fontWeight: 600, color: colors.textPrimary, margin: `${spacing[4]} 0 ${spacing[2]}` }}>{block.slice(4)}</h3>;
    }
    if (block.startsWith('## ')) {
      return <h2 key={i} style={{ fontSize: '17px', fontWeight: 700, color: colors.textPrimary, margin: `${spacing[4]} 0 ${spacing[2]}` }}>{block.slice(3)}</h2>;
    }
    // Bullet list
    if (block.match(/^[-•*]\s/m)) {
      const items = block.split(/\n/).filter(l => l.match(/^[-•*]\s/));
      return (
        <ul key={i} style={{ margin: `${spacing[2]} 0`, paddingLeft: spacing[5] }}>
          {items.map((item, j) => (
            <li key={j} style={{ fontSize: '14px', lineHeight: 1.7, color: colors.gray700, marginBottom: spacing[1] }}>
              {renderInline(item.replace(/^[-•*]\s/, ''))}
            </li>
          ))}
        </ul>
      );
    }
    // Numbered list
    if (block.match(/^\d+\.\s/m)) {
      const items = block.split(/\n/).filter(l => l.match(/^\d+\.\s/));
      return (
        <ol key={i} style={{ margin: `${spacing[2]} 0`, paddingLeft: spacing[5] }}>
          {items.map((item, j) => (
            <li key={j} style={{ fontSize: '14px', lineHeight: 1.7, color: colors.gray700, marginBottom: spacing[1] }}>
              {renderInline(item.replace(/^\d+\.\s/, ''))}
            </li>
          ))}
        </ol>
      );
    }
    // Regular paragraph
    return <p key={i} style={{ fontSize: '14px', lineHeight: 1.7, color: colors.gray700, margin: `${spacing[2]} 0` }}>{renderInline(block)}</p>;
  });
}

function renderInline(text: string): React.ReactNode {
  // Bold
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: colors.textPrimary, fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    }
    // Inline code
    const codeParts = part.split(/(`[^`]+`)/g);
    return codeParts.map((cp, j) => {
      if (cp.startsWith('`') && cp.endsWith('`')) {
        return (
          <code key={`${i}-${j}`} style={{
            background: colors.surfaceInset,
            color: colors.statusInfo,
            padding: '1px 5px',
            borderRadius: '4px',
            fontSize: '13px',
            fontFamily: 'monospace',
          }}>
            {cp.slice(1, -1)}
          </code>
        );
      }
      return cp;
    });
  });
}

// ── Copy button ───────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '4px 8px', border: 'none', borderRadius: borderRadius.md,
        background: 'transparent', color: colors.gray400,
        cursor: 'pointer', fontSize: '12px', transition: 'all 0.15s',
      }}
      onMouseEnter={e => { (e.target as HTMLElement).style.color = colors.gray600; (e.target as HTMLElement).style.background = colors.surfaceInset; }}
      onMouseLeave={e => { (e.target as HTMLElement).style.color = colors.gray400; (e.target as HTMLElement).style.background = 'transparent'; }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ── Typing indicator ──────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3], padding: `${spacing[4]} ${spacing[6]}`, maxWidth: '768px', margin: '0 auto' }}>
      <div style={{
        width: 32, height: 32, borderRadius: borderRadius.lg,
        background: `linear-gradient(135deg, ${colors.statusInfo}, ${colors.indigo})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Eye size={16} color="white" strokeWidth={1.8} />
      </div>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '12px 16px', background: colors.surfaceInset, borderRadius: borderRadius.xl }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%', background: colors.gray400,
            animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────

export default function AIAssistant() {
  const { currentProject } = useProjectContext();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSidebar, setShowSidebar] = useState(() => window.innerWidth >= 768);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Agent-tasks side panel.
  const [rightPanel, setRightPanel] = useState<'closed' | 'approvals' | 'history'>('closed');
  const [historyDomain, setHistoryDomain] = useState<AgentDomain | 'all'>('all');
  const [historyStatus, setHistoryStatus] = useState<AgentTaskStatus | 'all'>('all');

  // Domain tag for the next outgoing message. Clicking a suggested
  // prompt sets this; free typing falls back to keyword inference at
  // send time.
  const [nextDomain, setNextDomain] = useState<AgentDomain | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const projectId = currentProject?.id ?? null;
  const userId = user?.id ?? null;

  const activeConversation = conversations.find(c => c.id === activeConvId) || null;

  const createAgentTask = useCreateAgentTask();
  const approveAgentTask = useApproveAgentTask();
  const rejectAgentTask = useRejectAgentTask();
  const { data: pendingApprovals = [] } = usePendingApprovalTasks(projectId);
  const { data: historyTasks = [] } = useAgentTasks(
    projectId,
    userId,
    { domain: historyDomain, status: historyStatus },
    50,
  );

  const pendingCount = pendingApprovals.length;

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages.length, isStreaming]);

  // Scroll detection
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShowScrollDown(!atBottom);
  }, []);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  }, []);

  // Create new conversation
  const createConversation = useCallback((firstMessage?: string) => {
    const id = `conv-${Date.now()}`;
    const conv: Conversation = {
      id,
      title: firstMessage ? firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '…' : '') : 'New conversation',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setConversations(prev => [conv, ...prev]);
    setActiveConvId(id);
    return id;
  }, []);

  // Track ai-copilot server-side conversation ids per client conversation
  // so we can maintain continuity across turns.
  const serverConvoIds = useRef<Map<string, string>>(new Map());

  // Real chat call via the ai-copilot edge function, followed by a
  // non-blocking persistence of the turn as an agent_tasks row.
  const fetchResponse = useCallback(async (
    userMessage: string,
    convId: string,
    domain: AgentDomain,
  ) => {
    setIsStreaming(true);
    const startedAt = new Date().toISOString();

    let responseText = '';
    let newServerConvoId: string | undefined;
    let errorMessage: string | null = null;

    try {
      const { data, error } = await supabase.functions.invoke('ai-copilot', {
        body: {
          message: userMessage,
          conversation_id: serverConvoIds.current.get(convId),
          project_id: projectId,
          page_context: 'iris',
        },
      });
      if (error) throw error;
      const payload = data as { response?: string; conversation_id?: string } | null;
      responseText = payload?.response ?? 'I was unable to generate a response. Please try again.';
      newServerConvoId = payload?.conversation_id;
      if (newServerConvoId) serverConvoIds.current.set(convId, newServerConvoId);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      responseText = `I hit a problem reaching the AI service: ${errorMessage}. The ai-copilot edge function may not be deployed yet.`;
    }

    const completedAt = new Date().toISOString();

    const assistantMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: responseText,
      timestamp: new Date(),
    };
    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, messages: [...c.messages, assistantMsg], updatedAt: new Date() } : c
    ));
    setIsStreaming(false);

    // Non-blocking persistence. Chat must keep working even if the
    // agent_tasks table is missing or RLS rejects the insert.
    if (projectId && userId) {
      createAgentTask.mutate(
        {
          project_id: projectId,
          user_id: userId,
          conversation_id: newServerConvoId ?? null,
          agent_domain: domain,
          tool_name: null,
          tool_input: { message: userMessage, page_context: 'iris' },
          tool_output: errorMessage ? null : { response: responseText },
          status: errorMessage ? 'failed' : 'succeeded',
          error_message: errorMessage,
          started_at: startedAt,
          completed_at: completedAt,
        },
        {
          onError: (e) => {
             
            console.debug('[Iris] agent_tasks persist failed (non-blocking):', e);
          },
        },
      );
    }
  }, [projectId, userId, createAgentTask]);

  // Send message
  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    let convId = activeConvId;
    if (!convId) {
      convId = createConversation(trimmed);
    }

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setConversations(prev => prev.map(c =>
      c.id === convId ? {
        ...c,
        messages: [...c.messages, userMsg],
        title: c.messages.length === 0 ? trimmed.slice(0, 50) + (trimmed.length > 50 ? '…' : '') : c.title,
        updatedAt: new Date(),
      } : c
    ));

    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    const domain = nextDomain ?? inferDomain(trimmed);
    setNextDomain(null);
    void fetchResponse(trimmed, convId!, domain);
  }, [input, isStreaming, activeConvId, createConversation, fetchResponse, nextDomain]);

  // Keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Delete conversation
  const handleDelete = useCallback((convId: string) => {
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (activeConvId === convId) {
      setActiveConvId(null);
    }
  }, [activeConvId]);

  const projectName = currentProject?.name || 'Project';

  return (
    <div style={{ display: 'flex', height: '100%', background: 'white', overflow: 'hidden' }}>
      {/* Keyframe for typing dots */}
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* ── Conversation sidebar ── */}
      {showSidebar && (
        <div style={{
          width: 260, borderRight: `1px solid ${colors.borderSubtle}`,
          display: 'flex', flexDirection: 'column', background: colors.surfaceInset,
          flexShrink: 0,
        }}>
          {/* New chat button */}
          <div style={{ padding: spacing[3] }}>
            <button
              onClick={() => { setActiveConvId(null); inputRef.current?.focus(); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: spacing[2],
                padding: `${spacing[2]} ${spacing[3]}`,
                border: `1px solid ${colors.gray300}`, borderRadius: borderRadius.lg,
                background: 'white', cursor: 'pointer', fontSize: '13px',
                fontWeight: 500, color: colors.gray700,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = colors.surfaceInset; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = 'white'; }}
            >
              <Plus size={16} />
              New conversation
            </button>
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: `0 ${spacing[2]}` }}>
            {conversations.length === 0 ? (
              <div style={{ padding: spacing[4], textAlign: 'center', color: colors.gray400, fontSize: '13px' }}>
                No conversations yet
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing[2],
                    padding: `${spacing[2]} ${spacing[3]}`,
                    borderRadius: borderRadius.lg, cursor: 'pointer',
                    background: activeConvId === conv.id ? 'white' : 'transparent',
                    boxShadow: activeConvId === conv.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    marginBottom: '2px', transition: 'all 0.15s',
                  }}
                >
                  <MessageSquare size={14} style={{ color: colors.gray400, flexShrink: 0 }} />
                  <span style={{
                    flex: 1, fontSize: '13px', color: colors.gray700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {conv.title}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}
                    style={{
                      padding: '2px', border: 'none', background: 'transparent',
                      cursor: 'pointer', color: colors.gray300, borderRadius: '4px',
                      opacity: 0, transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '1'; (e.target as HTMLElement).style.color = colors.red; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '0'; }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Project context badge */}
          <div style={{
            padding: spacing[3], borderTop: `1px solid ${colors.borderSubtle}`,
            display: 'flex', alignItems: 'center', gap: spacing[2],
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: colors.green,
            }} />
            <span style={{ fontSize: '12px', color: colors.gray500 }}>
              Context: {projectName}
            </span>
          </div>
        </div>
      )}

      {/* ── Main chat area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing[3]} ${spacing[5]}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
          background: 'white',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              style={{
                padding: spacing[1], border: 'none', background: 'transparent',
                cursor: 'pointer', color: colors.gray400, borderRadius: borderRadius.md,
              }}
            >
              <MessageSquare size={18} />
            </button>
            <div style={{
              display: 'flex', alignItems: 'center', gap: spacing[2],
              padding: `${spacing[1]} ${spacing[3]}`,
              background: colors.surfaceInset, borderRadius: borderRadius.full,
            }}>
              <Eye size={14} style={{ color: colors.statusInfo }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: colors.textPrimary, letterSpacing: '-0.01em' }}>
                Iris
              </span>
              <ChevronDown size={12} style={{ color: colors.gray400 }} />
            </div>
          </div>
          {/* Approval queue + history toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
            <button
              onClick={() => setRightPanel(rightPanel === 'approvals' ? 'closed' : 'approvals')}
              title="Pending approvals"
              aria-label="Pending approvals"
              style={{
                position: 'relative',
                padding: `${spacing[1]} ${spacing[2]}`,
                border: `1px solid ${rightPanel === 'approvals' ? colors.statusInfo : colors.borderSubtle}`,
                borderRadius: borderRadius.md,
                background: rightPanel === 'approvals' ? colors.statusInfoSubtle : 'white',
                color: rightPanel === 'approvals' ? colors.statusInfo : colors.gray600,
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: spacing[1],
                fontSize: '12px', fontWeight: 600,
                fontFamily: typography.fontFamily,
              }}
            >
              <ClipboardList size={14} />
              Approvals
              {pendingCount > 0 && (
                <span style={{
                  background: colors.statusPending,
                  color: 'white', fontSize: '10px', fontWeight: 700,
                  padding: '1px 6px', borderRadius: borderRadius.full,
                  minWidth: 18, textAlign: 'center',
                }}>
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setRightPanel(rightPanel === 'history' ? 'closed' : 'history')}
              title="Task history"
              aria-label="Task history"
              style={{
                padding: `${spacing[1]} ${spacing[2]}`,
                border: `1px solid ${rightPanel === 'history' ? colors.statusInfo : colors.borderSubtle}`,
                borderRadius: borderRadius.md,
                background: rightPanel === 'history' ? colors.statusInfoSubtle : 'white',
                color: rightPanel === 'history' ? colors.statusInfo : colors.gray600,
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: spacing[1],
                fontSize: '12px', fontWeight: 600,
                fontFamily: typography.fontFamily,
              }}
            >
              <History size={14} />
              History
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          style={{
            flex: 1, overflowY: 'auto', position: 'relative',
          }}
        >
          {!activeConversation || activeConversation.messages.length === 0 ? (
            /* ── Empty state / Welcome ── */
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', padding: spacing[6],
              maxWidth: '700px', margin: '0 auto',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '20px',
                background: `linear-gradient(135deg, ${colors.statusInfo}, ${colors.indigo})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: spacing[5],
                boxShadow: `0 12px 40px ${colors.statusInfo}40`,
              }}>
                <Eye size={30} color="white" strokeWidth={1.8} />
              </div>
              <h1 style={{
                fontSize: '28px', fontWeight: 800, color: colors.textPrimary,
                marginBottom: spacing[1], textAlign: 'center',
                letterSpacing: '-0.02em',
              }}>
                Iris
              </h1>
              <p style={{
                fontSize: '13px', fontWeight: 500, color: blue[500],
                marginBottom: spacing[3], textAlign: 'center',
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                by SiteSync
              </p>
              <p style={{
                fontSize: '15px', color: gray[500],
                marginBottom: spacing[8], textAlign: 'center',
                maxWidth: '460px', lineHeight: 1.6,
              }}>
                I see everything happening on {projectName}. Budgets, schedules, safety, subs, documents — just ask.
              </p>

              {/* Suggested prompts grid */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: spacing[3], width: '100%',
              }}>
                {SUGGESTED_PROMPTS.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(item.prompt);
                      setNextDomain(item.domain);
                      inputRef.current?.focus();
                    }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: spacing[3],
                      padding: spacing[4],
                      border: `1px solid ${gray[200]}`, borderRadius: borderRadius.xl,
                      background: 'white', cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = blue[300];
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 8px ${blue[500]}15`;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = gray[200];
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    }}
                  >
                    <item.icon size={18} style={{ color: blue[500], flexShrink: 0, marginTop: '1px' }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: gray[800], marginBottom: '2px' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '12px', color: gray[500], lineHeight: 1.4 }}>
                        {item.prompt.slice(0, 60)}…
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Message list ── */
            <div style={{ padding: `${spacing[4]} 0` }}>
              {activeConversation.messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex', gap: spacing[3],
                    padding: `${spacing[4]} ${spacing[6]}`,
                    maxWidth: '768px', margin: '0 auto',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 32, height: 32, borderRadius: borderRadius.lg,
                    background: msg.role === 'assistant'
                      ? `linear-gradient(135deg, ${blue[600]}, ${indigo[700]})`
                      : gray[200],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {msg.role === 'assistant'
                      ? <Eye size={16} color="white" strokeWidth={1.8} />
                      : <User size={16} color={gray[600]} />
                    }
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px', fontWeight: 600,
                      color: msg.role === 'assistant' ? blue[700] : gray[700],
                      marginBottom: spacing[1],
                    }}>
                      {msg.role === 'assistant' ? 'Iris' : 'You'}
                    </div>
                    <div>{msg.role === 'assistant' ? renderContent(msg.content) : (
                      <p style={{ fontSize: '14px', lineHeight: 1.7, color: gray[700] }}>{msg.content}</p>
                    )}</div>
                    {msg.role === 'assistant' && (
                      <div style={{ marginTop: spacing[2] }}>
                        <CopyButton text={msg.content} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isStreaming && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Scroll to bottom FAB */}
          {showScrollDown && (
            <button
              onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
              style={{
                position: 'absolute', bottom: spacing[4], left: '50%',
                transform: 'translateX(-50%)',
                width: 36, height: 36, borderRadius: '50%',
                background: 'white', border: `1px solid ${gray[200]}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: gray[500],
              }}
            >
              <ArrowDown size={16} />
            </button>
          )}
        </div>

        {/* ── Input area ── */}
        <div style={{
          padding: `${spacing[3]} ${spacing[5]} ${spacing[5]}`,
          background: 'white',
          borderTop: `1px solid ${gray[50]}`,
        }}>
          <div style={{
            maxWidth: '768px', margin: '0 auto',
            display: 'flex', alignItems: 'flex-end', gap: spacing[2],
            padding: `${spacing[3]} ${spacing[4]}`,
            border: `1px solid ${gray[300]}`,
            borderRadius: borderRadius.xl,
            background: 'white',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          onFocus={() => {}}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={`Ask about ${projectName}…`}
              rows={1}
              style={{
                flex: 1, border: 'none', outline: 'none',
                resize: 'none', fontSize: '14px', lineHeight: 1.5,
                color: gray[800], background: 'transparent',
                fontFamily: typography.fontFamily,
                maxHeight: '200px',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              style={{
                width: 36, height: 36, borderRadius: borderRadius.lg,
                border: 'none', cursor: input.trim() && !isStreaming ? 'pointer' : 'default',
                background: input.trim() && !isStreaming
                  ? `linear-gradient(135deg, ${blue[500]}, ${indigo[600]})`
                  : gray[200],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s', flexShrink: 0,
              }}
            >
              {isStreaming
                ? <Loader2 size={16} color="white" style={{ animation: 'spin 1s linear infinite' }} />
                : <Send size={16} color="white" />
              }
            </button>
          </div>
          <div style={{
            maxWidth: '768px', margin: `${spacing[2]} auto 0`,
            textAlign: 'center', fontSize: '11px', color: gray[400],
          }}>
            Iris uses your live project data. Always verify critical decisions independently.
          </div>
        </div>
      </div>

      {/* ── Right panel: pending approvals / task history ── */}
      {rightPanel !== 'closed' && (
        <AgentTasksPanel
          mode={rightPanel}
          onClose={() => setRightPanel('closed')}
          pendingApprovals={pendingApprovals}
          historyTasks={historyTasks}
          historyDomain={historyDomain}
          setHistoryDomain={setHistoryDomain}
          historyStatus={historyStatus}
          setHistoryStatus={setHistoryStatus}
          onApprove={(task) => {
            if (!userId) {
              toast.error('Not signed in');
              return;
            }
            approveAgentTask.mutate({ task, approverId: userId });
          }}
          onReject={(task) => rejectAgentTask.mutate(task)}
          isApproving={approveAgentTask.isPending}
          isRejecting={rejectAgentTask.isPending}
        />
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ── AgentTasksPanel ───────────────────────────────────────

interface AgentTasksPanelProps {
  mode: 'approvals' | 'history';
  onClose: () => void;
  pendingApprovals: AgentTask[];
  historyTasks: AgentTask[];
  historyDomain: AgentDomain | 'all';
  setHistoryDomain: (d: AgentDomain | 'all') => void;
  historyStatus: AgentTaskStatus | 'all';
  setHistoryStatus: (s: AgentTaskStatus | 'all') => void;
  onApprove: (task: AgentTask) => void;
  onReject: (task: AgentTask) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

function AgentTasksPanel(props: AgentTasksPanelProps) {
  const {
    mode, onClose, pendingApprovals, historyTasks,
    historyDomain, setHistoryDomain, historyStatus, setHistoryStatus,
    onApprove, onReject, isApproving, isRejecting,
  } = props;

  const list = mode === 'approvals' ? pendingApprovals : historyTasks;

  return (
    <div
      role="complementary"
      aria-label={mode === 'approvals' ? 'Pending approvals' : 'Task history'}
      style={{
        width: 340,
        borderLeft: `1px solid ${gray[200]}`,
        background: gray[50],
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}
    >
      <div style={{
        padding: `${spacing[3]} ${spacing[4]}`,
        borderBottom: `1px solid ${gray[200]}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          {mode === 'approvals' ? <ClipboardList size={16} /> : <History size={16} />}
          <span style={{ fontSize: '14px', fontWeight: 700, color: gray[800] }}>
            {mode === 'approvals' ? 'Pending approvals' : 'Task history'}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close panel"
          style={{
            padding: spacing[1], border: 'none', background: 'transparent',
            cursor: 'pointer', color: gray[400], borderRadius: borderRadius.md,
          }}
        >
          <XCircle size={16} />
        </button>
      </div>

      {mode === 'history' && (
        <div style={{
          padding: spacing[3],
          borderBottom: `1px solid ${gray[200]}`,
          display: 'flex', gap: spacing[2], flexWrap: 'wrap',
          background: 'white',
        }}>
          <select
            value={historyDomain}
            onChange={(e) => setHistoryDomain(e.target.value as AgentDomain | 'all')}
            aria-label="Filter by domain"
            style={{
              flex: 1, minWidth: 120,
              padding: `${spacing[1]} ${spacing[2]}`,
              fontSize: '12px', fontFamily: typography.fontFamily,
              border: `1px solid ${gray[200]}`, borderRadius: borderRadius.md,
              background: 'white', color: gray[700], outline: 'none',
            }}
          >
            <option value="all">All domains</option>
            {(Object.keys(DOMAIN_LABEL) as AgentDomain[]).map((d) => (
              <option key={d} value={d}>{DOMAIN_LABEL[d]}</option>
            ))}
          </select>
          <select
            value={historyStatus}
            onChange={(e) => setHistoryStatus(e.target.value as AgentTaskStatus | 'all')}
            aria-label="Filter by status"
            style={{
              flex: 1, minWidth: 120,
              padding: `${spacing[1]} ${spacing[2]}`,
              fontSize: '12px', fontFamily: typography.fontFamily,
              border: `1px solid ${gray[200]}`, borderRadius: borderRadius.md,
              background: 'white', color: gray[700], outline: 'none',
            }}
          >
            <option value="all">All statuses</option>
            {(Object.keys(STATUS_LABEL) as AgentTaskStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: spacing[3] }}>
        {list.length === 0 ? (
          <div style={{
            padding: spacing[6], textAlign: 'center',
            color: gray[400], fontSize: '13px',
          }}>
            {mode === 'approvals' ? 'No actions waiting for approval.' : 'No tasks yet.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
            {list.map((task) => (
              <AgentTaskCard
                key={task.id}
                task={task}
                showActions={mode === 'approvals'}
                onApprove={onApprove}
                onReject={onReject}
                isApproving={isApproving}
                isRejecting={isRejecting}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── AgentTaskCard ─────────────────────────────────────────

interface AgentTaskCardProps {
  task: AgentTask;
  showActions: boolean;
  onApprove: (task: AgentTask) => void;
  onReject: (task: AgentTask) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

function AgentTaskCard({ task, showActions, onApprove, onReject, isApproving, isRejecting }: AgentTaskCardProps) {
  const StatusIcon = STATUS_ICON[task.status];
  const statusColor = STATUS_COLOR[task.status];
  const when = useMemo(() => {
    const d = new Date(task.created_at);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }, [task.created_at]);

  const summary = task.tool_name
    ? `${task.tool_name}`
    : (task.tool_input && typeof task.tool_input === 'object' && 'message' in task.tool_input
        ? String((task.tool_input as Record<string, unknown>).message).slice(0, 80)
        : 'Chat turn');

  return (
    <div style={{
      padding: spacing[3],
      background: 'white',
      border: `1px solid ${gray[200]}`,
      borderRadius: borderRadius.md,
      display: 'flex', flexDirection: 'column', gap: spacing[2],
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[2] }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '12px', fontWeight: 600, color: gray[700],
            display: 'flex', alignItems: 'center', gap: spacing[2], marginBottom: 2,
          }}>
            <span style={{
              padding: '1px 6px', borderRadius: borderRadius.full,
              background: gray[100], color: gray[600],
              fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {DOMAIN_LABEL[task.agent_domain]}
            </span>
            <span style={{ color: gray[400], fontWeight: 400, fontSize: '11px' }}>{when}</span>
          </div>
          <div style={{
            fontSize: '13px', color: gray[800],
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {summary}
          </div>
        </div>
        <span
          title={STATUS_LABEL[task.status]}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            color: statusColor, fontSize: '11px', fontWeight: 600, flexShrink: 0,
          }}
        >
          <StatusIcon size={12} style={task.status === 'running' ? { animation: 'spin 1s linear infinite' } : undefined} />
          {STATUS_LABEL[task.status]}
        </span>
      </div>
      {task.error_message && (
        <div style={{ fontSize: '11px', color: colors.statusCritical, lineHeight: 1.4 }}>
          {task.error_message}
        </div>
      )}
      {showActions && (
        <div style={{ display: 'flex', gap: spacing[2], marginTop: spacing[1] }}>
          <button
            onClick={() => onApprove(task)}
            disabled={isApproving || isRejecting}
            style={{
              flex: 1,
              padding: `${spacing[1]} ${spacing[2]}`,
              border: 'none', borderRadius: borderRadius.md,
              background: colors.statusSuccess, color: 'white',
              fontSize: '12px', fontWeight: 600, fontFamily: typography.fontFamily,
              cursor: (isApproving || isRejecting) ? 'not-allowed' : 'pointer',
              opacity: (isApproving || isRejecting) ? 0.6 : 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
            }}
          >
            <CheckCircle2 size={12} /> Approve
          </button>
          <button
            onClick={() => onReject(task)}
            disabled={isApproving || isRejecting}
            style={{
              padding: `${spacing[1]} ${spacing[2]}`,
              border: `1px solid ${gray[200]}`, borderRadius: borderRadius.md,
              background: 'white', color: gray[600],
              fontSize: '12px', fontWeight: 600, fontFamily: typography.fontFamily,
              cursor: (isApproving || isRejecting) ? 'not-allowed' : 'pointer',
              opacity: (isApproving || isRejecting) ? 0.6 : 1,
            }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
