import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Brain, X, Send, FileText, Loader2, Sparkles, Database, ChevronRight,
  MessageSquare, Scale, FolderOpen, History, Plus, Trash2, AlertTriangle,
  CheckCircle, Shield, Clock, ArrowRight, Search, _Upload, Eye,
  ChevronDown, BarChart3, Zap, BookOpen, HardHat, FileCheck,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { Btn } from '../Primitives';
import { useProjectId } from '../../hooks/useProjectId';
import { supabase } from '../../lib/supabase';
import { fromTable } from '../../lib/db/queries'
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────

interface Citation {
  document_name: string;
  document_id: string | null;
  chunk_index: number;
  page?: number | null;
  excerpt: string;
  similarity: number;
}

interface BrainMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  followUpQuestions?: string[];
  ts: number;
}

interface Conversation {
  id: string;
  title: string;
  messages: BrainMessage[];
  createdAt: number;
  updatedAt: number;
}

interface ProjectFile {
  id: string;
  name: string;
  file_url: string;
  content_type: string | null;
}

interface RiskFinding {
  category: string;
  clause: string;
  severity: 'critical' | 'important' | 'acceptable';
  negotiability: 'high' | 'medium' | 'low' | 'none';
  excerpt: string;
  recommendation: string;
  marketBenchmark?: string;
}

interface ContractAnalysis {
  id: string;
  fileName: string;
  analyzedAt: number;
  summary: string;
  overallRisk: 'high' | 'medium' | 'low';
  findings: RiskFinding[];
  keyTerms: { label: string; value: string }[];
}

interface IndexedDocument {
  id: string;
  name: string;
  chunksCount: number;
  indexedAt?: string;
  contentType: string | null;
}

type ActiveTab = 'chat' | 'contracts' | 'documents';

// ── PDF text extraction ────────────────────────────────────

async function extractPdfText(url: string): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // Local worker in public/. Unified with all other pdfjs call sites so
  // load order can't substitute a CDN URL blocked by CSP.
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('/pdf.worker.min.js', import.meta.url).href;
  }
  const loadingTask = pdfjs.getDocument({ url });
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];
  const max = Math.min(pdf.numPages, 200);
  for (let p = 1; p <= max; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const strings = content.items.map((it) => ('str' in it ? (it as { str: string }).str : '')).join(' ');
    pageTexts.push(strings);
  }
  return pageTexts.join('\n\n');
}

// ── Construction-specific follow-up question generator ─────

function generateFollowUps(question: string, answer: string): string[] {
  const q = question.toLowerCase();
  const a = answer.toLowerCase();

  if (q.includes('change order') || a.includes('change order')) {
    return [
      'What is the total cost impact of all pending change orders?',
      'Which change orders affect the critical path schedule?',
      'Are there any unsigned change orders past their deadline?',
    ];
  }
  if (q.includes('rfi') || a.includes('rfi')) {
    return [
      'Which RFIs are overdue and who is the responsible party?',
      'What is the average RFI response time on this project?',
      'Are there RFIs that may trigger change orders?',
    ];
  }
  if (q.includes('submittal') || a.includes('submittal')) {
    return [
      'Which submittals are holding up procurement?',
      'What is the resubmittal rate by discipline?',
      'Are there any submittals past the required-by date?',
    ];
  }
  if (q.includes('safety') || a.includes('incident') || a.includes('osha')) {
    return [
      'What is the current TRIR and DART rate?',
      'What trades have the highest incident frequency?',
      'Are there any open corrective actions from safety inspections?',
    ];
  }
  if (q.includes('schedule') || a.includes('schedule') || a.includes('milestone')) {
    return [
      'Which milestones are at risk of slipping?',
      'What is the current overall project float?',
      'Which trades are behind schedule?',
    ];
  }
  if (q.includes('contract') || a.includes('contract') || a.includes('subcontract')) {
    return [
      'Which contracts have unsigned change orders?',
      'What is the total retainage held across all contracts?',
      'Are any contracts approaching their end date?',
    ];
  }
  if (q.includes('budget') || a.includes('budget') || a.includes('cost')) {
    return [
      'What cost codes are trending over budget?',
      'What is the projected cost at completion?',
      'Which change orders have the largest budget impact?',
    ];
  }
  // Generic construction follow-ups
  return [
    'What are the biggest risks on this project right now?',
    'Summarize outstanding action items across all disciplines',
    'What documents were updated in the last 7 days?',
  ];
}

// ── Auto-title from first message ──────────────────────────

function autoTitle(firstMsg: string): string {
  const t = firstMsg.trim();
  if (t.length <= 40) return t;
  return t.slice(0, 37) + '…';
}

// ── Similarity badge ───────────────────────────────────────

const SimilarityBadge: React.FC<{ score: number }> = ({ score }) => {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? colors.statusActive : pct >= 60 ? colors.statusPending : colors.textTertiary;
  const bg = pct >= 80 ? colors.statusActiveSubtle : pct >= 60 ? colors.statusPendingSubtle : colors.statusNeutralSubtle;
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: borderRadius.sm,
      color, backgroundColor: bg, whiteSpace: 'nowrap',
    }}>
      {pct}%
    </span>
  );
};

// ── Risk severity badge ────────────────────────────────────

const RiskBadge: React.FC<{ severity: 'critical' | 'important' | 'acceptable' }> = ({ severity }) => {
  const cfg = {
    critical: { color: colors.statusCritical, bg: colors.statusCriticalSubtle, icon: AlertTriangle, label: 'Critical' },
    important: { color: colors.statusPending, bg: colors.statusPendingSubtle, icon: Shield, label: 'Important' },
    acceptable: { color: colors.statusActive, bg: colors.statusActiveSubtle, icon: CheckCircle, label: 'Acceptable' },
  }[severity];
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: borderRadius.sm,
      color: cfg.color, backgroundColor: cfg.bg,
    }}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
};

// ── Message bubble with enhanced citations ─────────────────

const MessageBubble: React.FC<{
  msg: BrainMessage;
  onCitationClick: (c: Citation) => void;
  onFollowUp: (q: string) => void;
}> = ({ msg, onCitationClick, onFollowUp }) => {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: spacing['3'],
    }}>
      {/* Role label */}
      {!isUser && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['1.5'],
          marginBottom: spacing['1'], paddingLeft: spacing['1'],
        }}>
          <Brain size={12} color={colors.indigo} />
          <span style={{ fontSize: 11, fontWeight: 600, color: colors.indigo, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Project Brain
          </span>
        </div>
      )}

      <div style={{
        maxWidth: '88%',
        padding: `${spacing['3']} ${spacing['4']}`,
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        backgroundColor: isUser ? colors.primaryOrange : colors.surfaceInset,
        color: isUser ? colors.white : colors.textPrimary,
        fontSize: typography.fontSize.sm,
        lineHeight: typography.lineHeight.relaxed,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        boxShadow: shadows.sm,
        border: isUser ? 'none' : `1px solid ${colors.borderSubtle}`,
      }}>
        {msg.content}
      </div>

      {/* Citations */}
      {msg.citations && msg.citations.length > 0 && (
        <div style={{ marginTop: spacing['2'], display: 'flex', flexDirection: 'column', gap: spacing['1.5'], width: '88%' }}>
          <div style={{
            fontSize: 11, color: colors.textTertiary, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            display: 'flex', alignItems: 'center', gap: spacing['1'],
          }}>
            <BookOpen size={11} />
            {msg.citations.length} Source{msg.citations.length > 1 ? 's' : ''}
          </div>
          {msg.citations.map((c, i) => (
            <button
              key={`${c.document_id || c.document_name}-${c.chunk_index}`}
              onClick={() => onCitationClick(c)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['2.5']}`,
                backgroundColor: colors.surfaceRaised,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: borderRadius.md,
                cursor: 'pointer', textAlign: 'left',
                transition: transitions.fast,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.surfaceHover;
                e.currentTarget.style.borderColor = colors.borderDefault;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.surfaceRaised;
                e.currentTarget.style.borderColor = colors.borderSubtle;
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: borderRadius.sm,
                backgroundColor: colors.indigo, color: colors.white,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: spacing['1.5'],
                  fontSize: typography.fontSize.xs, fontWeight: 600, color: colors.textPrimary,
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.document_name}
                  </span>
                  {c.page && (
                    <span style={{ fontSize: 10, color: colors.textTertiary, flexShrink: 0 }}>p.{c.page}</span>
                  )}
                  <SimilarityBadge score={c.similarity} />
                </div>
                <div style={{
                  fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 1.4,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {c.excerpt}
                </div>
              </div>
              <ChevronRight size={13} color={colors.textTertiary} style={{ flexShrink: 0, marginTop: 3 }} />
            </button>
          ))}
        </div>
      )}

      {/* Follow-up suggestions */}
      {msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
        <div style={{ marginTop: spacing['3'], width: '88%' }}>
          <div style={{
            fontSize: 11, color: colors.textTertiary, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: spacing['1.5'],
            display: 'flex', alignItems: 'center', gap: spacing['1'],
          }}>
            <Zap size={11} />
            Follow Up
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
            {msg.followUpQuestions.map((fq) => (
              <button
                key={fq}
                onClick={() => onFollowUp(fq)}
                style={{
                  padding: `${spacing['1.5']} ${spacing['2.5']}`,
                  backgroundColor: colors.surfaceRaised,
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: borderRadius.md,
                  cursor: 'pointer', textAlign: 'left',
                  fontSize: 12, color: colors.indigo, fontWeight: 500,
                  transition: transitions.fast,
                  display: 'flex', alignItems: 'center', gap: spacing['1.5'],
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.indigoSubtle;
                  e.currentTarget.style.borderColor = colors.indigo;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.surfaceRaised;
                  e.currentTarget.style.borderColor = colors.borderSubtle;
                }}
              >
                <ArrowRight size={12} style={{ flexShrink: 0 }} />
                {fq}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Tab button component ───────────────────────────────────

const TabBtn: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  badge?: number;
}> = ({ active, icon, label, onClick, badge }) => (
  <button
    onClick={onClick}
    style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['1'],
      padding: `${spacing['2']} 0`,
      fontSize: 12, fontWeight: active ? 600 : 500,
      color: active ? colors.indigo : colors.textTertiary,
      backgroundColor: 'transparent',
      borderBottom: active ? `2px solid ${colors.indigo}` : '2px solid transparent',
      border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid',
      borderBottomColor: active ? colors.indigo : 'transparent',
      cursor: 'pointer', transition: transitions.fast,
      position: 'relative',
    }}
  >
    {icon}
    <span>{label}</span>
    {badge !== undefined && badge > 0 && (
      <span style={{
        fontSize: 10, fontWeight: 700, backgroundColor: colors.statusCritical, color: colors.white,
        borderRadius: borderRadius.full, padding: '0 5px', minWidth: 16, textAlign: 'center', lineHeight: '16px',
      }}>
        {badge}
      </span>
    )}
  </button>
);

// ── Contract analysis suggested categories ─────────────────

const CONSTRUCTION_RISK_CATEGORIES = [
  { group: 'Payment & Retainage', items: ['Payment terms', 'Retainage release', 'Pay-when-paid clauses', 'Lien waiver requirements'] },
  { group: 'Liability & Insurance', items: ['Indemnification scope', 'Insurance requirements', 'Limitation of liability', 'Consequential damages waiver'] },
  { group: 'Scope & Changes', items: ['Change order process', 'Scope of work definition', 'Differing site conditions', 'Force majeure'] },
  { group: 'Schedule & Delay', items: ['Liquidated damages', 'Schedule requirements', 'Delay notification', 'Time extensions'] },
  { group: 'Termination & Disputes', items: ['Termination for convenience', 'Termination for cause', 'Dispute resolution', 'Governing law'] },
  { group: 'Safety & Compliance', items: ['Safety requirements', 'Environmental compliance', 'Warranty obligations', 'Closeout requirements'] },
  { group: 'Bonds & Security', items: ['Performance bond', 'Payment bond', 'Letter of credit', 'Parent guarantee'] },
];

// ── Suggested questions by category ────────────────────────

const QUESTION_CATEGORIES = [
  {
    icon: <HardHat size={14} />,
    label: 'Safety',
    questions: [
      'What is the current TRIR and how does it compare to industry average?',
      'Summarize all open safety corrective actions',
      'What are the most common incident types this month?',
    ],
  },
  {
    icon: <FileCheck size={14} />,
    label: 'Submittals & RFIs',
    questions: [
      'Which submittals are overdue or pending review?',
      'What RFIs are still unanswered past their due date?',
      'Summarize the latest approved submittals for Division 09',
    ],
  },
  {
    icon: <BarChart3 size={14} />,
    label: 'Cost & Budget',
    questions: [
      'What is the current budget variance by cost code?',
      'Summarize all pending change orders and their total cost impact',
      'What is the projected cost at completion vs original budget?',
    ],
  },
  {
    icon: <Clock size={14} />,
    label: 'Schedule',
    questions: [
      'Which milestones are at risk this month?',
      'What is the current critical path float?',
      'Which trades are behind schedule and by how many days?',
    ],
  },
];

// ── Main Component ─────────────────────────────────────────

export const ProjectBrain: React.FC = () => {
  const projectId = useProjectId();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');

  // Chat state
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Index state
  const [indexing, setIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState<{ done: number; total: number } | null>(null);
  const [indexedCount, setIndexedCount] = useState<number>(0);
  const [fileCount, setFileCount] = useState<number>(0);

  // Contract review state
  const [contractAnalyses, setContractAnalyses] = useState<ContractAnalysis[]>([]);
  const [analyzingContract, setAnalyzingContract] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<string | null>(null);
  const [contractFilter, setContractFilter] = useState<'all' | 'critical' | 'important'>('all');

  // Documents state
  const [documents, setDocuments] = useState<IndexedDocument[]>([]);
  const [docSearch, setDocSearch] = useState('');

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeConvId) || null,
    [conversations, activeConvId],
  );

  // Stable reference — empty-fallback must not allocate a new [] each render
  // or dep arrays keyed on `messages` will fire every render.
  const messages = useMemo<BrainMessage[]>(() => activeConv?.messages ?? [], [activeConv]);

  // ── Stats ──────────────────────────────────────────────

  const refreshStats = useCallback(async () => {
    if (!projectId) return;
    const [chunksRes, filesRes] = await Promise.all([
      fromTable('document_chunks').select('document_id', { count: 'exact', head: false }).eq('project_id' as never, projectId),
      fromTable('files').select('id', { count: 'exact', head: true }).eq('project_id' as never, projectId),
    ]);
    const uniqueDocs = new Set((chunksRes.data || []).map((r: { document_id: string | null }) => r.document_id).filter(Boolean));
    setIndexedCount(uniqueDocs.size);
    setFileCount(filesRes.count || 0);
  }, [projectId]);

  const refreshDocuments = useCallback(async () => {
    if (!projectId) return;
    const [filesRes, chunksRes] = await Promise.all([
      fromTable('files').select('id, name, content_type, created_at').eq('project_id' as never, projectId).order('created_at', { ascending: false }),
      fromTable('document_chunks').select('document_id').eq('project_id' as never, projectId),
    ]);
    const chunkCounts: Record<string, number> = {};
    (chunksRes.data || []).forEach((r: { document_id: string | null }) => {
      if (r.document_id) chunkCounts[r.document_id] = (chunkCounts[r.document_id] || 0) + 1;
    });
    const docs: IndexedDocument[] = (filesRes.data || []).map((f: { id: string; name: string; content_type: string | null; created_at: string }) => ({
      id: f.id,
      name: f.name,
      contentType: f.content_type,
      chunksCount: chunkCounts[f.id] || 0,
      indexedAt: chunkCounts[f.id] ? f.created_at : undefined,
    }));
    setDocuments(docs);
  }, [projectId]);

  useEffect(() => {
    if (open && projectId) {
      refreshStats();
      refreshDocuments();
    }
  }, [open, projectId, refreshStats, refreshDocuments]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, asking]);

  // ── Conversation management ────────────────────────────

  const createConversation = useCallback(() => {
    const id = `conv_${Date.now()}`;
    const conv: Conversation = {
      id,
      title: 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveConvId(id);
    setShowHistory(false);
    return id;
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) setActiveConvId(null);
  }, [activeConvId]);

  const updateConvMessages = useCallback((convId: string, updater: (msgs: BrainMessage[]) => BrainMessage[]) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, messages: updater(c.messages), updatedAt: Date.now() }
          : c,
      ),
    );
  }, []);

  // ── Ask ────────────────────────────────────────────────

  const ask = useCallback(async (overrideQuestion?: string) => {
    if (!projectId || asking) return;
    const q = (overrideQuestion || question).trim();
    if (!q) return;

    let convId = activeConvId;
    if (!convId) {
      convId = createConversation();
    }

    setQuestion('');
    const userMsg: BrainMessage = { role: 'user', content: q, ts: Date.now() };
    updateConvMessages(convId, (msgs) => [...msgs, userMsg]);

    // Auto-title on first message
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId && c.messages.length === 0
          ? { ...c, title: autoTitle(q) }
          : c,
      ),
    );

    setAsking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://hypxrmcppjfbtlwuoafc.supabase.co'}/functions/v1/query-brain`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({ project_id: projectId, question: q }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Request failed');

      const followUpQuestions = generateFollowUps(q, data.answer);

      const assistantMsg: BrainMessage = {
        role: 'assistant',
        content: data.answer,
        citations: data.citations,
        followUpQuestions,
        ts: Date.now(),
      };
      updateConvMessages(convId, (msgs) => [...msgs, assistantMsg]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      updateConvMessages(convId, (msgs) => [...msgs, {
        role: 'assistant',
        content: `Sorry — ${msg}`,
        ts: Date.now(),
      }]);
    } finally {
      setAsking(false);
    }
  }, [projectId, question, asking, activeConvId, createConversation, updateConvMessages]);

  // ── Index all documents ────────────────────────────────

  const indexAll = useCallback(async () => {
    if (!projectId || indexing) return;
    setIndexing(true);
    try {
      const { data: files, error } = await fromTable('files')
        .select('id, name, file_url, content_type')
        .eq('project_id' as never, projectId);
      if (error) throw error;

      const { data: existingChunks } = await fromTable('document_chunks')
        .select('document_id')
        .eq('project_id' as never, projectId);
      const indexed = new Set((existingChunks || []).map((r: { document_id: string | null }) => r.document_id).filter(Boolean));

      const pending = (files || []).filter((f: ProjectFile) => !indexed.has(f.id));
      if (pending.length === 0) {
        toast.info('All documents already indexed');
        return;
      }

      setIndexProgress({ done: 0, total: pending.length });
      const { data: { session } } = await supabase.auth.getSession();
      const endpoint = `${import.meta.env.VITE_SUPABASE_URL || 'https://hypxrmcppjfbtlwuoafc.supabase.co'}/functions/v1/embed-document`;

      for (let i = 0; i < pending.length; i++) {
        const f = pending[i] as ProjectFile;
        try {
          let text = '';
          if ((f.content_type || '').includes('pdf') || f.name.toLowerCase().endsWith('.pdf')) {
            text = await extractPdfText(f.file_url);
          } else if ((f.content_type || '').includes('text') || /\.(txt|md|csv)$/i.test(f.name)) {
            const r = await fetch(f.file_url);
            text = await r.text();
          }
          if (text && text.trim().length > 20) {
            await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.access_token || ''}`,
              },
              body: JSON.stringify({
                project_id: projectId,
                document_id: f.id,
                document_name: f.name,
                text,
              }),
            });
          }
        } catch (err) {
          console.warn('[ProjectBrain] Failed to index', f.name, err);
        }
        setIndexProgress({ done: i + 1, total: pending.length });
      }
      toast.success(`Indexed ${pending.length} document${pending.length === 1 ? '' : 's'}`);
      await refreshStats();
      await refreshDocuments();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Indexing failed');
    } finally {
      setIndexing(false);
      setIndexProgress(null);
    }
  }, [projectId, indexing, refreshStats, refreshDocuments]);

  // ── Contract analysis ──────────────────────────────────

  const analyzeContract = useCallback(async (fileId: string, fileName: string) => {
    if (!projectId || analyzingContract) return;
    setAnalyzingContract(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Get file content
      const { data: fileData } = await fromTable('files').select('file_url, content_type').eq('id' as never, fileId).single();
      if (!fileData) throw new Error('File not found');

      let text = '';
      if ((fileData.content_type || '').includes('pdf') || fileName.toLowerCase().endsWith('.pdf')) {
        text = await extractPdfText(fileData.file_url);
      } else {
        const r = await fetch(fileData.file_url);
        text = await r.text();
      }

      if (!text || text.trim().length < 50) {
        toast.error('Could not extract sufficient text from document');
        return;
      }

      // Send to the brain with contract analysis prompt
      const contractPrompt = `You are a construction contract risk analyst. Analyze this contract document and identify risks.

For each risk finding, provide:
- category: The risk category (e.g., "Payment Terms", "Indemnification", "Liquidated Damages")
- clause: The specific clause reference
- severity: "critical", "important", or "acceptable"
- negotiability: "high", "medium", "low", or "none"
- excerpt: The relevant contract language (verbatim quote)
- recommendation: Your specific recommendation
- marketBenchmark: How this compares to industry standard (optional)

Also provide:
- summary: A 2-3 sentence overall risk assessment
- overallRisk: "high", "medium", or "low"
- keyTerms: Key contract terms found (label/value pairs for things like contract value, duration, retainage %, payment terms, etc.)

Focus on construction-specific risks: pay-when-paid clauses, retainage, indemnification, liquidated damages, change order procedures, lien waiver requirements, safety obligations, warranty terms, and dispute resolution.

Respond in valid JSON format matching this structure:
{
  "summary": "...",
  "overallRisk": "high|medium|low",
  "findings": [...],
  "keyTerms": [{"label": "...", "value": "..."}]
}

CONTRACT TEXT:
${text.slice(0, 15000)}`;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://hypxrmcppjfbtlwuoafc.supabase.co'}/functions/v1/query-brain`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({
            project_id: projectId,
            question: contractPrompt,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Analysis failed');

      // Parse the AI response as JSON
      let analysis: Partial<ContractAnalysis> = {};
      try {
        const jsonMatch = data.answer.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // If JSON parse fails, create a basic analysis from the text
        analysis = {
          summary: data.answer.slice(0, 300),
          overallRisk: 'medium',
          findings: [],
          keyTerms: [],
        };
      }

      const fullAnalysis: ContractAnalysis = {
        id: `analysis_${Date.now()}`,
        fileName,
        analyzedAt: Date.now(),
        summary: analysis.summary || 'Analysis complete.',
        overallRisk: (analysis.overallRisk as 'high' | 'medium' | 'low') || 'medium',
        findings: (analysis.findings || []) as RiskFinding[],
        keyTerms: (analysis.keyTerms || []) as { label: string; value: string }[],
      };

      setContractAnalyses((prev) => [fullAnalysis, ...prev]);
      setSelectedAnalysis(fullAnalysis.id);
      toast.success(`Contract analysis complete: ${fullAnalysis.findings.length} findings`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Contract analysis failed');
    } finally {
      setAnalyzingContract(false);
    }
  }, [projectId, analyzingContract]);

  const onCitationClick = useCallback((c: Citation) => {
    if (c.document_id) {
      window.location.hash = `#/files?doc=${c.document_id}`;
    } else {
      toast.info(c.document_name);
    }
  }, []);

  const onFollowUp = useCallback((q: string) => {
    ask(q);
  }, [ask]);

  // Filtered documents
  const filteredDocs = useMemo(() => {
    if (!docSearch.trim()) return documents;
    const s = docSearch.toLowerCase();
    return documents.filter((d) => d.name.toLowerCase().includes(s));
  }, [documents, docSearch]);

  // Selected contract analysis
  const selectedContractAnalysis = useMemo(
    () => contractAnalyses.find((a) => a.id === selectedAnalysis) || null,
    [contractAnalyses, selectedAnalysis],
  );

  // Filtered findings
  const filteredFindings = useMemo(() => {
    if (!selectedContractAnalysis) return [];
    if (contractFilter === 'all') return selectedContractAnalysis.findings;
    return selectedContractAnalysis.findings.filter((f) => f.severity === contractFilter);
  }, [selectedContractAnalysis, contractFilter]);

  if (!projectId) return null;

  const panelWidth = expanded ? 'min(720px, calc(100vw - 48px))' : 'min(480px, calc(100vw - 48px))';

  return (
    <>
      {/* Floating brain button */}
      <button
        aria-label="Open Project Brain"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: spacing['6'], left: spacing['6'],
          width: 56, height: 56, borderRadius: '50%',
          border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${colors.indigo}, #7C3AED)`,
          color: colors.white,
          boxShadow: '0 4px 24px rgba(99, 102, 241, 0.35)',
          display: open ? 'none' : 'flex',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, transition: transitions.base,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <Brain size={26} />
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: spacing['6'], left: spacing['6'],
          width: panelWidth,
          maxHeight: 'calc(100vh - 120px)',
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.xl,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0,0,0,0.04)',
          border: `1px solid ${colors.borderSubtle}`,
          display: 'flex', flexDirection: 'column',
          zIndex: 1001, overflow: 'hidden',
          transition: 'width 200ms ease',
        }}>
          {/* ── Header ──────────────────────────────── */}
          <div style={{
            padding: `${spacing['3']} ${spacing['4']}`,
            borderBottom: `1px solid ${colors.borderSubtle}`,
            display: 'flex', alignItems: 'center', gap: spacing['3'],
            background: `linear-gradient(135deg, rgba(99,102,241,0.06), rgba(124,58,237,0.03))`,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: borderRadius.md,
              background: `linear-gradient(135deg, ${colors.indigo}, #7C3AED)`,
              color: colors.white,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Brain size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: typography.fontSize.sm, fontWeight: 600, color: colors.textPrimary }}>
                Project Brain
              </div>
              <div style={{ fontSize: 11, color: colors.textTertiary }}>
                {indexedCount}/{fileCount} docs indexed · AI-powered intelligence
              </div>
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: colors.textTertiary, padding: spacing['1'],
                fontSize: 11, fontWeight: 500,
              }}
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? '◂' : '▸'}
            </button>
            <button
              aria-label="Close"
              onClick={() => setOpen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: colors.textSecondary, padding: spacing['1'],
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* ── Tabs ────────────────────────────────── */}
          <div style={{
            display: 'flex', borderBottom: `1px solid ${colors.borderSubtle}`,
            backgroundColor: colors.surfaceRaised,
          }}>
            <TabBtn
              active={activeTab === 'chat'}
              icon={<MessageSquare size={14} />}
              label="Chat"
              onClick={() => setActiveTab('chat')}
            />
            <TabBtn
              active={activeTab === 'contracts'}
              icon={<Scale size={14} />}
              label="Contract Review"
              onClick={() => setActiveTab('contracts')}
              badge={contractAnalyses.filter((a) => a.overallRisk === 'high').length || undefined}
            />
            <TabBtn
              active={activeTab === 'documents'}
              icon={<FolderOpen size={14} />}
              label="Documents"
              onClick={() => setActiveTab('documents')}
            />
          </div>

          {/* ── Chat Tab ────────────────────────────── */}
          {activeTab === 'chat' && (
            <>
              {/* Index bar */}
              <div style={{
                padding: `${spacing['1.5']} ${spacing['4']}`,
                backgroundColor: colors.surfaceInset,
                borderBottom: `1px solid ${colors.borderSubtle}`,
                display: 'flex', alignItems: 'center', gap: spacing['2'],
              }}>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: spacing['1'],
                    fontSize: 12, color: showHistory ? colors.indigo : colors.textTertiary,
                    fontWeight: 500, padding: `${spacing['1']} ${spacing['1.5']}`,
                    borderRadius: borderRadius.sm,
                    backgroundColor: showHistory ? colors.indigoSubtle : 'transparent',
                  }}
                >
                  <History size={13} />
                  {conversations.length > 0 ? conversations.length : ''}
                </button>
                <div style={{ flex: 1 }} />
                <Database size={12} color={colors.textTertiary} />
                {indexing && indexProgress ? (
                  <span style={{ fontSize: 11, color: colors.textSecondary }}>
                    Indexing {indexProgress.done}/{indexProgress.total}…
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: colors.textTertiary }}>
                    {fileCount === 0 ? 'No files' : indexedCount === fileCount ? 'All indexed' : `${fileCount - indexedCount} unindexed`}
                  </span>
                )}
                <Btn size="sm" variant="secondary" onClick={indexAll} disabled={indexing || fileCount === 0}>
                  {indexing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  <span style={{ marginLeft: 3, fontSize: 11 }}>{indexing ? 'Indexing…' : 'Index'}</span>
                </Btn>
                <button
                  onClick={createConversation}
                  style={{
                    background: 'none', border: `1px solid ${colors.borderSubtle}`,
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    padding: `${spacing['1']} ${spacing['1.5']}`,
                    borderRadius: borderRadius.sm,
                    color: colors.textSecondary, fontSize: 11, gap: 3,
                  }}
                  title="New conversation"
                >
                  <Plus size={12} />
                </button>
              </div>

              {/* Conversation history drawer */}
              {showHistory && conversations.length > 0 && (
                <div style={{
                  maxHeight: 200, overflowY: 'auto',
                  borderBottom: `1px solid ${colors.borderSubtle}`,
                  backgroundColor: colors.surfaceInset,
                }}>
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => { setActiveConvId(conv.id); setShowHistory(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: spacing['2'],
                        padding: `${spacing['2']} ${spacing['4']}`,
                        cursor: 'pointer',
                        backgroundColor: conv.id === activeConvId ? colors.surfaceSelected : 'transparent',
                        borderBottom: `1px solid ${colors.borderSubtle}`,
                        transition: transitions.fast,
                      }}
                      onMouseEnter={(e) => {
                        if (conv.id !== activeConvId) e.currentTarget.style.backgroundColor = colors.surfaceHover;
                      }}
                      onMouseLeave={(e) => {
                        if (conv.id !== activeConvId) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <MessageSquare size={13} color={colors.textTertiary} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 500, color: colors.textPrimary,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {conv.title}
                        </div>
                        <div style={{ fontSize: 10, color: colors.textTertiary }}>
                          {conv.messages.length} message{conv.messages.length !== 1 ? 's' : ''}
                          {' · '}
                          {new Date(conv.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: colors.textTertiary, padding: 2,
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Messages area */}
              <div ref={scrollRef} style={{
                flex: 1, overflowY: 'auto',
                padding: spacing['4'],
                minHeight: 200, maxHeight: 'calc(100vh - 380px)',
              }}>
                {messages.length === 0 && (
                  <div style={{ paddingTop: spacing['4'] }}>
                    <div style={{ textAlign: 'center', marginBottom: spacing['6'] }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: borderRadius.lg,
                        background: `linear-gradient(135deg, rgba(99,102,241,0.1), rgba(124,58,237,0.06))`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto', marginBottom: spacing['3'],
                      }}>
                        <Brain size={24} color={colors.indigo} />
                      </div>
                      <div style={{ fontSize: typography.fontSize.sm, fontWeight: 600, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                        Ask anything about your project
                      </div>
                      <div style={{ fontSize: 12, color: colors.textTertiary, maxWidth: 280, margin: '0 auto' }}>
                        Get instant answers backed by citations from your indexed documents.
                      </div>
                    </div>

                    {/* Categorized suggestions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
                      {QUESTION_CATEGORIES.map((cat) => (
                        <div key={cat.label}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: spacing['1.5'],
                            fontSize: 11, fontWeight: 600, color: colors.textTertiary,
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            marginBottom: spacing['1.5'],
                          }}>
                            {cat.icon}
                            {cat.label}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                            {cat.questions.map((prompt) => (
                              <button
                                key={prompt}
                                onClick={() => { if (!activeConvId) createConversation(); setQuestion(prompt); }}
                                style={{
                                  padding: `${spacing['1.5']} ${spacing['2.5']}`,
                                  backgroundColor: colors.surfaceInset,
                                  border: `1px solid ${colors.borderSubtle}`,
                                  borderRadius: borderRadius.md,
                                  cursor: 'pointer',
                                  fontSize: 12, color: colors.textSecondary,
                                  textAlign: 'left',
                                  transition: transitions.fast,
                                  display: 'flex', alignItems: 'center', gap: spacing['1.5'],
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = colors.surfaceHover;
                                  e.currentTarget.style.borderColor = colors.borderDefault;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = colors.surfaceInset;
                                  e.currentTarget.style.borderColor = colors.borderSubtle;
                                }}
                              >
                                <ChevronRight size={11} style={{ flexShrink: 0, color: colors.indigo }} />
                                {prompt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m) => (
                  <MessageBubble key={m.ts} msg={m} onCitationClick={onCitationClick} onFollowUp={onFollowUp} />
                ))}
                {asking && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: spacing['2'],
                    color: colors.indigo, fontSize: 12, fontWeight: 500,
                    padding: `${spacing['2']} 0`,
                  }}>
                    <Loader2 size={14} className="animate-spin" />
                    Analyzing project documents…
                  </div>
                )}
              </div>

              {/* Input */}
              <div style={{
                padding: spacing['3'],
                borderTop: `1px solid ${colors.borderSubtle}`,
                display: 'flex', gap: spacing['2'],
                backgroundColor: colors.surfaceRaised,
              }}>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
                  placeholder="Ask the Project Brain…"
                  disabled={asking}
                  style={{
                    flex: 1,
                    padding: `${spacing['2.5']} ${spacing['3']}`,
                    backgroundColor: colors.surfaceInset,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.md,
                    fontSize: typography.fontSize.sm,
                    color: colors.textPrimary,
                    outline: 'none',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = colors.indigo; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderDefault; }}
                />
                <button
                  onClick={() => ask()}
                  disabled={asking || !question.trim()}
                  style={{
                    width: 38, height: 38,
                    borderRadius: borderRadius.md,
                    border: 'none', cursor: asking || !question.trim() ? 'default' : 'pointer',
                    background: asking || !question.trim()
                      ? colors.surfaceInset
                      : `linear-gradient(135deg, ${colors.indigo}, #7C3AED)`,
                    color: asking || !question.trim() ? colors.textDisabled : colors.white,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: transitions.fast,
                  }}
                >
                  <Send size={15} />
                </button>
              </div>
            </>
          )}

          {/* ── Contract Review Tab ─────────────────── */}
          {activeTab === 'contracts' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {!selectedContractAnalysis ? (
                /* Analysis list / start new */
                <div style={{ flex: 1, overflowY: 'auto', padding: spacing['4'] }}>
                  {/* Header */}
                  <div style={{ textAlign: 'center', marginBottom: spacing['5'] }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: borderRadius.lg,
                      background: 'linear-gradient(135deg, rgba(251,146,60,0.12), rgba(239,68,68,0.06))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto', marginBottom: spacing['3'],
                    }}>
                      <Scale size={24} color={colors.primaryOrange} />
                    </div>
                    <div style={{ fontSize: typography.fontSize.sm, fontWeight: 600, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                      AI Contract Risk Analysis
                    </div>
                    <div style={{ fontSize: 12, color: colors.textTertiary, maxWidth: 320, margin: '0 auto' }}>
                      Analyze contracts for construction-specific risks: payment terms, indemnification, liquidated damages, and more.
                    </div>
                  </div>

                  {/* Select a file to analyze */}
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: colors.textTertiary,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    marginBottom: spacing['2'],
                  }}>
                    Select Document to Analyze
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1.5'], marginBottom: spacing['5'] }}>
                    {documents.filter((d) =>
                      d.name.toLowerCase().includes('contract') ||
                      d.name.toLowerCase().includes('agreement') ||
                      d.name.toLowerCase().includes('subcontract') ||
                      d.name.toLowerCase().includes('aia') ||
                      d.name.toLowerCase().endsWith('.pdf'),
                    ).slice(0, 8).map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => analyzeContract(doc.id, doc.name)}
                        disabled={analyzingContract}
                        style={{
                          display: 'flex', alignItems: 'center', gap: spacing['2'],
                          padding: `${spacing['2']} ${spacing['3']}`,
                          backgroundColor: colors.surfaceInset,
                          border: `1px solid ${colors.borderSubtle}`,
                          borderRadius: borderRadius.md,
                          cursor: analyzingContract ? 'wait' : 'pointer',
                          textAlign: 'left', transition: transitions.fast,
                          opacity: analyzingContract ? 0.6 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (!analyzingContract) {
                            e.currentTarget.style.backgroundColor = colors.surfaceHover;
                            e.currentTarget.style.borderColor = colors.primaryOrange;
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = colors.surfaceInset;
                          e.currentTarget.style.borderColor = colors.borderSubtle;
                        }}
                      >
                        <FileText size={14} color={colors.textTertiary} />
                        <span style={{
                          flex: 1, fontSize: 12, color: colors.textPrimary, fontWeight: 500,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {doc.name}
                        </span>
                        {analyzingContract ? (
                          <Loader2 size={13} className="animate-spin" color={colors.primaryOrange} />
                        ) : (
                          <ArrowRight size={13} color={colors.textTertiary} />
                        )}
                      </button>
                    ))}
                    {documents.length === 0 && (
                      <div style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', padding: spacing['4'] }}>
                        No documents uploaded yet. Upload contract files to get started.
                      </div>
                    )}
                  </div>

                  {/* Previous analyses */}
                  {contractAnalyses.length > 0 && (
                    <>
                      <div style={{
                        fontSize: 11, fontWeight: 600, color: colors.textTertiary,
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        marginBottom: spacing['2'],
                      }}>
                        Previous Analyses
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1.5'] }}>
                        {contractAnalyses.map((analysis) => {
                          const riskColor = analysis.overallRisk === 'high' ? colors.statusCritical
                            : analysis.overallRisk === 'medium' ? colors.statusPending : colors.statusActive;
                          const riskBg = analysis.overallRisk === 'high' ? colors.statusCriticalSubtle
                            : analysis.overallRisk === 'medium' ? colors.statusPendingSubtle : colors.statusActiveSubtle;
                          return (
                            <button
                              key={analysis.id}
                              onClick={() => setSelectedAnalysis(analysis.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: spacing['2'],
                                padding: `${spacing['2.5']} ${spacing['3']}`,
                                backgroundColor: colors.surfaceRaised,
                                border: `1px solid ${colors.borderSubtle}`,
                                borderRadius: borderRadius.md,
                                cursor: 'pointer', textAlign: 'left',
                                transition: transitions.fast,
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.borderDefault; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.borderSubtle; }}
                            >
                              <Scale size={14} color={riskColor} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontSize: 12, fontWeight: 600, color: colors.textPrimary,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {analysis.fileName}
                                </div>
                                <div style={{ fontSize: 11, color: colors.textTertiary }}>
                                  {analysis.findings.length} findings · {new Date(analysis.analyzedAt).toLocaleDateString()}
                                </div>
                              </div>
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: '2px 6px',
                                borderRadius: borderRadius.sm, color: riskColor, backgroundColor: riskBg,
                                textTransform: 'uppercase',
                              }}>
                                {analysis.overallRisk} risk
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Risk categories reference */}
                  <div style={{ marginTop: spacing['6'] }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: colors.textTertiary,
                      textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: spacing['2'],
                    }}>
                      What We Analyze
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['1'] }}>
                      {CONSTRUCTION_RISK_CATEGORIES.map((group) => (
                        <span key={group.group} style={{
                          fontSize: 11, padding: '3px 8px',
                          backgroundColor: colors.surfaceInset, color: colors.textSecondary,
                          borderRadius: borderRadius.sm, border: `1px solid ${colors.borderSubtle}`,
                        }}>
                          {group.group}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Analysis detail view */
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {/* Back + title bar */}
                  <div style={{
                    padding: `${spacing['2.5']} ${spacing['4']}`,
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                    display: 'flex', alignItems: 'center', gap: spacing['2'],
                    backgroundColor: colors.surfaceInset,
                  }}>
                    <button
                      onClick={() => setSelectedAnalysis(null)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: colors.textSecondary, fontSize: 12, fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: spacing['1'],
                      }}
                    >
                      ← Back
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: colors.textPrimary,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {selectedContractAnalysis.fileName}
                      </div>
                    </div>
                    {(() => {
                      const rc = selectedContractAnalysis.overallRisk === 'high' ? colors.statusCritical
                        : selectedContractAnalysis.overallRisk === 'medium' ? colors.statusPending : colors.statusActive;
                      const rb = selectedContractAnalysis.overallRisk === 'high' ? colors.statusCriticalSubtle
                        : selectedContractAnalysis.overallRisk === 'medium' ? colors.statusPendingSubtle : colors.statusActiveSubtle;
                      return (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px',
                          borderRadius: borderRadius.sm, color: rc, backgroundColor: rb,
                          textTransform: 'uppercase',
                        }}>
                          {selectedContractAnalysis.overallRisk} risk
                        </span>
                      );
                    })()}
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: spacing['4'] }}>
                    {/* Summary */}
                    <div style={{
                      padding: spacing['3'], backgroundColor: colors.surfaceInset,
                      borderRadius: borderRadius.md, marginBottom: spacing['4'],
                      fontSize: 12, color: colors.textSecondary, lineHeight: 1.6,
                      border: `1px solid ${colors.borderSubtle}`,
                    }}>
                      {selectedContractAnalysis.summary}
                    </div>

                    {/* Key terms */}
                    {selectedContractAnalysis.keyTerms.length > 0 && (
                      <div style={{ marginBottom: spacing['4'] }}>
                        <div style={{
                          fontSize: 11, fontWeight: 600, color: colors.textTertiary,
                          textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: spacing['2'],
                        }}>
                          Key Terms
                        </div>
                        <div style={{
                          display: 'grid', gridTemplateColumns: '1fr 1fr',
                          gap: spacing['1.5'],
                        }}>
                          {selectedContractAnalysis.keyTerms.map((kt, i) => (
                            <div key={i} style={{
                              padding: `${spacing['1.5']} ${spacing['2.5']}`,
                              backgroundColor: colors.surfaceInset,
                              borderRadius: borderRadius.sm,
                              border: `1px solid ${colors.borderSubtle}`,
                            }}>
                              <div style={{ fontSize: 10, color: colors.textTertiary, fontWeight: 500 }}>{kt.label}</div>
                              <div style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 600 }}>{kt.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Filter chips */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: spacing['2'],
                      marginBottom: spacing['3'],
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Findings ({filteredFindings.length})
                      </span>
                      <div style={{ flex: 1 }} />
                      {(['all', 'critical', 'important'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setContractFilter(f)}
                          style={{
                            fontSize: 11, fontWeight: 500, padding: '2px 8px',
                            borderRadius: borderRadius.sm,
                            border: `1px solid ${contractFilter === f ? colors.borderFocus : colors.borderSubtle}`,
                            backgroundColor: contractFilter === f ? colors.indigoSubtle : 'transparent',
                            color: contractFilter === f ? colors.indigo : colors.textTertiary,
                            cursor: 'pointer', textTransform: 'capitalize',
                          }}
                        >
                          {f}
                        </button>
                      ))}
                    </div>

                    {/* Findings list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                      {filteredFindings.map((finding, i) => (
                        <div key={i} style={{
                          padding: spacing['3'],
                          backgroundColor: colors.surfaceRaised,
                          border: `1px solid ${colors.borderSubtle}`,
                          borderRadius: borderRadius.md,
                          borderLeft: `3px solid ${
                            finding.severity === 'critical' ? colors.statusCritical
                            : finding.severity === 'important' ? colors.statusPending : colors.statusActive
                          }`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1.5'] }}>
                            <span style={{
                              fontSize: 11, fontWeight: 600, color: colors.textPrimary,
                            }}>
                              {finding.category}
                            </span>
                            <RiskBadge severity={finding.severity} />
                            {finding.clause && (
                              <span style={{ fontSize: 10, color: colors.textTertiary, fontFamily: typography.fontFamilyMono }}>
                                {finding.clause}
                              </span>
                            )}
                          </div>
                          {finding.excerpt && (
                            <div style={{
                              fontSize: 11, color: colors.textSecondary, lineHeight: 1.5,
                              padding: `${spacing['1.5']} ${spacing['2.5']}`,
                              backgroundColor: colors.surfaceInset,
                              borderRadius: borderRadius.sm, marginBottom: spacing['2'],
                              borderLeft: `2px solid ${colors.borderDefault}`,
                              fontStyle: 'italic',
                            }}>
                              &ldquo;{finding.excerpt}&rdquo;
                            </div>
                          )}
                          <div style={{ fontSize: 12, color: colors.textPrimary, lineHeight: 1.5, marginBottom: spacing['1'] }}>
                            {finding.recommendation}
                          </div>
                          {finding.marketBenchmark && (
                            <div style={{
                              fontSize: 11, color: colors.indigo, fontWeight: 500,
                              display: 'flex', alignItems: 'center', gap: spacing['1'],
                            }}>
                              <BarChart3 size={11} />
                              Market: {finding.marketBenchmark}
                            </div>
                          )}
                        </div>
                      ))}
                      {filteredFindings.length === 0 && (
                        <div style={{ textAlign: 'center', padding: spacing['6'], color: colors.textTertiary, fontSize: 12 }}>
                          No findings match this filter.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Documents Tab ───────────────────────── */}
          {activeTab === 'documents' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Search + index bar */}
              <div style={{
                padding: `${spacing['2.5']} ${spacing['4']}`,
                borderBottom: `1px solid ${colors.borderSubtle}`,
                display: 'flex', gap: spacing['2'], alignItems: 'center',
                backgroundColor: colors.surfaceInset,
              }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={13} color={colors.textTertiary} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="Search documents…"
                    style={{
                      width: '100%',
                      padding: `${spacing['1.5']} ${spacing['2.5']} ${spacing['1.5']} ${spacing['7']}`,
                      backgroundColor: colors.surfaceRaised,
                      border: `1px solid ${colors.borderSubtle}`,
                      borderRadius: borderRadius.md,
                      fontSize: 12, color: colors.textPrimary,
                      outline: 'none',
                    }}
                  />
                </div>
                <Btn size="sm" variant="secondary" onClick={indexAll} disabled={indexing || fileCount === 0}>
                  {indexing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  <span style={{ marginLeft: 3, fontSize: 11 }}>{indexing ? 'Indexing…' : 'Index All'}</span>
                </Btn>
              </div>

              {/* Index progress */}
              {indexing && indexProgress && (
                <div style={{
                  padding: `${spacing['2']} ${spacing['4']}`,
                  backgroundColor: colors.indigoSubtle,
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                }}>
                  <Loader2 size={13} className="animate-spin" color={colors.indigo} />
                  <span style={{ fontSize: 12, color: colors.indigo, fontWeight: 500 }}>
                    Indexing document {indexProgress.done} of {indexProgress.total}…
                  </span>
                  <div style={{ flex: 1 }} />
                  <div style={{
                    height: 4, flex: 2, backgroundColor: colors.surfaceRaised,
                    borderRadius: borderRadius.full, overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', width: `${(indexProgress.done / indexProgress.total) * 100}%`,
                      backgroundColor: colors.indigo, borderRadius: borderRadius.full,
                      transition: 'width 300ms ease',
                    }} />
                  </div>
                </div>
              )}

              {/* Stats */}
              <div style={{
                padding: `${spacing['3']} ${spacing['4']}`,
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                gap: spacing['2'],
                borderBottom: `1px solid ${colors.borderSubtle}`,
              }}>
                <div style={{
                  padding: spacing['2'], backgroundColor: colors.surfaceInset,
                  borderRadius: borderRadius.sm, textAlign: 'center',
                }}>
                  <div style={{ fontSize: typography.fontSize.title, fontWeight: 700, color: colors.textPrimary }}>{fileCount}</div>
                  <div style={{ fontSize: 10, color: colors.textTertiary, fontWeight: 500 }}>Total Files</div>
                </div>
                <div style={{
                  padding: spacing['2'], backgroundColor: colors.surfaceInset,
                  borderRadius: borderRadius.sm, textAlign: 'center',
                }}>
                  <div style={{ fontSize: typography.fontSize.title, fontWeight: 700, color: colors.statusActive }}>{indexedCount}</div>
                  <div style={{ fontSize: 10, color: colors.textTertiary, fontWeight: 500 }}>Indexed</div>
                </div>
                <div style={{
                  padding: spacing['2'], backgroundColor: colors.surfaceInset,
                  borderRadius: borderRadius.sm, textAlign: 'center',
                }}>
                  <div style={{ fontSize: typography.fontSize.title, fontWeight: 700, color: fileCount - indexedCount > 0 ? colors.statusPending : colors.statusActive }}>
                    {fileCount - indexedCount}
                  </div>
                  <div style={{ fontSize: 10, color: colors.textTertiary, fontWeight: 500 }}>Pending</div>
                </div>
              </div>

              {/* Document list */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filteredDocs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: spacing['8'], color: colors.textTertiary }}>
                    <FolderOpen size={32} style={{ marginBottom: spacing['2'], opacity: 0.4 }} />
                    <div style={{ fontSize: 13 }}>
                      {documents.length === 0 ? 'No documents uploaded yet' : 'No documents match your search'}
                    </div>
                  </div>
                ) : (
                  filteredDocs.map((doc) => {
                    const isIndexed = doc.chunksCount > 0;
                    const isPdf = doc.name.toLowerCase().endsWith('.pdf');
                    const isContract = /contract|agreement|subcontract|aia/i.test(doc.name);
                    return (
                      <div
                        key={doc.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: spacing['2.5'],
                          padding: `${spacing['2.5']} ${spacing['4']}`,
                          borderBottom: `1px solid ${colors.borderSubtle}`,
                          transition: transitions.fast,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <FileText size={15} color={
                          isContract ? colors.primaryOrange
                          : isPdf ? colors.statusCritical
                          : colors.textTertiary
                        } />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 12, fontWeight: 500, color: colors.textPrimary,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {doc.name}
                          </div>
                          <div style={{ fontSize: 10, color: colors.textTertiary }}>
                            {isIndexed ? `${doc.chunksCount} chunks indexed` : 'Not indexed'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1.5'] }}>
                          {isIndexed ? (
                            <CheckCircle size={14} color={colors.statusActive} />
                          ) : (
                            <Clock size={14} color={colors.textTertiary} />
                          )}
                          {isContract && (
                            <button
                              onClick={() => { analyzeContract(doc.id, doc.name); setActiveTab('contracts'); }}
                              disabled={analyzingContract}
                              style={{
                                fontSize: 10, fontWeight: 600, padding: '2px 6px',
                                borderRadius: borderRadius.sm,
                                border: `1px solid ${colors.primaryOrange}`,
                                backgroundColor: 'transparent',
                                color: colors.primaryOrange,
                                cursor: 'pointer',
                              }}
                            >
                              Analyze
                            </button>
                          )}
                          <button
                            onClick={() => { window.location.hash = `#/files?doc=${doc.id}`; }}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: colors.textTertiary, padding: 2,
                            }}
                            title="View file"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ProjectBrain;
