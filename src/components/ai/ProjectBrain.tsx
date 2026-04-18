import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Brain, X, Send, FileText, Loader2, Sparkles, Database, ChevronRight } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { Btn } from '../Primitives';
import { useProjectId } from '../../hooks/useProjectId';
import { supabase } from '../../lib/supabase';
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
  ts: number;
}

interface ProjectFile {
  id: string;
  name: string;
  file_url: string;
  content_type: string | null;
}

// ── PDF text extraction (client-side, uses pdfjs already in bundle) ────

async function extractPdfText(url: string): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url,
  ).toString();
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

// ── Message bubble ─────────────────────────────────────────────

const MessageBubble: React.FC<{ msg: BrainMessage; onCitationClick: (c: Citation) => void }> = ({ msg, onCitationClick }) => {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: spacing['3'],
    }}>
      <div style={{
        maxWidth: '85%',
        padding: `${spacing['3']} ${spacing['4']}`,
        borderRadius: borderRadius.lg,
        backgroundColor: isUser ? colors.primaryOrange : colors.surfaceRaised,
        color: isUser ? colors.white : colors.textPrimary,
        fontSize: typography.fontSize.sm,
        lineHeight: typography.lineHeight.relaxed,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        boxShadow: shadows.xs,
      }}>
        {msg.content}
      </div>
      {msg.citations && msg.citations.length > 0 && (
        <div style={{ marginTop: spacing['2'], display: 'flex', flexDirection: 'column', gap: spacing['1.5'], width: '85%' }}>
          <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, fontWeight: typography.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Sources
          </div>
          {msg.citations.map((c, i) => (
            <button
              key={`${c.document_id || c.document_name}-${c.chunk_index}`}
              onClick={() => onCitationClick(c)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: spacing['2'],
                padding: spacing['2'],
                backgroundColor: colors.surfaceInset,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: borderRadius.md,
                cursor: 'pointer',
                textAlign: 'left',
                transition: transitions.fast,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.surfaceHover)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors.surfaceInset)}
            >
              <div style={{
                width: 20, height: 20, borderRadius: borderRadius.sm,
                backgroundColor: colors.primaryOrange, color: colors.white,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: typography.fontWeight.bold, flexShrink: 0,
              }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                  {c.document_name}{c.page ? ` · p.${c.page}` : ''}
                </div>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: 2, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {c.excerpt}
                </div>
              </div>
              <ChevronRight size={14} color={colors.textTertiary} style={{ flexShrink: 0, marginTop: 2 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── ProjectBrain floating panel ─────────────────────────────────

export const ProjectBrain: React.FC = () => {
  const projectId = useProjectId();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<BrainMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState<{ done: number; total: number } | null>(null);
  const [indexedCount, setIndexedCount] = useState<number>(0);
  const [fileCount, setFileCount] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshStats = useCallback(async () => {
    if (!projectId) return;
    const [chunksRes, filesRes] = await Promise.all([
      supabase.from('document_chunks').select('document_id', { count: 'exact', head: false }).eq('project_id', projectId),
      supabase.from('files').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
    ]);
    const uniqueDocs = new Set((chunksRes.data || []).map((r: { document_id: string | null }) => r.document_id).filter(Boolean));
    setIndexedCount(uniqueDocs.size);
    setFileCount(filesRes.count || 0);
  }, [projectId]);

  useEffect(() => {
    if (open && projectId) refreshStats();
  }, [open, projectId, refreshStats]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, asking]);

  const ask = useCallback(async () => {
    if (!projectId || !question.trim() || asking) return;
    const q = question.trim();
    setQuestion('');
    setMessages((m) => [...m, { role: 'user', content: q, ts: Date.now() }]);
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
      setMessages((m) => [...m, {
        role: 'assistant',
        content: data.answer,
        citations: data.citations,
        ts: Date.now(),
      }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((m) => [...m, { role: 'assistant', content: `Sorry — ${msg}`, ts: Date.now() }]);
    } finally {
      setAsking(false);
    }
  }, [projectId, question, asking]);

  const indexAll = useCallback(async () => {
    if (!projectId || indexing) return;
    setIndexing(true);
    try {
      const { data: files, error } = await supabase
        .from('files')
        .select('id, name, file_url, content_type')
        .eq('project_id', projectId);
      if (error) throw error;

      const { data: existingChunks } = await supabase
        .from('document_chunks')
        .select('document_id')
        .eq('project_id', projectId);
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Indexing failed');
    } finally {
      setIndexing(false);
      setIndexProgress(null);
    }
  }, [projectId, indexing, refreshStats]);

  const onCitationClick = useCallback((c: Citation) => {
    if (c.document_id) {
      window.location.hash = `#/files?doc=${c.document_id}`;
    } else {
      toast.info(c.document_name);
    }
  }, []);

  if (!projectId) return null;

  return (
    <>
      {/* Floating brain button — bottom LEFT corner */}
      <button
        aria-label="Open Project Brain"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: spacing['6'],
          left: spacing['6'],
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          backgroundColor: colors.primaryOrange,
          color: colors.white,
          boxShadow: shadows.lg,
          display: open ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          transition: transitions.base,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <Brain size={26} />
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: spacing['6'],
            left: spacing['6'],
            width: 'min(480px, calc(100vw - 48px))',
            maxHeight: 'calc(100vh - 120px)',
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.lg,
            boxShadow: shadows.xl,
            border: `1px solid ${colors.borderDefault}`,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1001,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: `${spacing['3']} ${spacing['4']}`,
            borderBottom: `1px solid ${colors.borderSubtle}`,
            display: 'flex',
            alignItems: 'center',
            gap: spacing['3'],
            backgroundColor: colors.surfaceRaised,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: borderRadius.md,
              backgroundColor: colors.primaryOrange, color: colors.white,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Brain size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                Project Brain
              </div>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>
                {indexedCount}/{fileCount} documents indexed
              </div>
            </div>
            <button
              aria-label="Close Project Brain"
              onClick={() => setOpen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: colors.textSecondary, padding: spacing['1'],
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Index bar */}
          <div style={{
            padding: `${spacing['2']} ${spacing['4']}`,
            backgroundColor: colors.surfaceInset,
            borderBottom: `1px solid ${colors.borderSubtle}`,
            display: 'flex',
            alignItems: 'center',
            gap: spacing['2'],
          }}>
            <Database size={14} color={colors.textTertiary} />
            {indexing && indexProgress ? (
              <span style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, flex: 1 }}>
                Indexing {indexProgress.done}/{indexProgress.total}…
              </span>
            ) : (
              <span style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, flex: 1 }}>
                {fileCount === 0 ? 'No files to index' : indexedCount === fileCount ? 'All documents indexed' : `${fileCount - indexedCount} document${fileCount - indexedCount === 1 ? '' : 's'} unindexed`}
              </span>
            )}
            <Btn size="sm" variant="secondary" onClick={indexAll} disabled={indexing || fileCount === 0}>
              {indexing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              <span style={{ marginLeft: 4 }}>{indexing ? 'Indexing…' : 'Index All'}</span>
            </Btn>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{
            flex: 1,
            overflowY: 'auto',
            padding: spacing['4'],
            minHeight: 240,
            maxHeight: 'calc(100vh - 320px)',
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: spacing['8'] }}>
                <Brain size={40} color={colors.textTertiary} style={{ marginBottom: spacing['3'] }} />
                <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing['4'] }}>
                  Ask anything about your project documents.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], maxWidth: 320, margin: '0 auto' }}>
                  {[
                    'What are the approved submittals for Division 09?',
                    'Summarize the latest change orders',
                    'What RFIs relate to the HVAC scope?',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setQuestion(prompt)}
                      style={{
                        padding: `${spacing['2']} ${spacing['3']}`,
                        backgroundColor: colors.surfaceInset,
                        border: `1px solid ${colors.borderSubtle}`,
                        borderRadius: borderRadius.md,
                        cursor: 'pointer',
                        fontSize: typography.fontSize.xs,
                        color: colors.textSecondary,
                        textAlign: 'left',
                      }}
                    >
                      <FileText size={12} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => <MessageBubble key={m.ts} msg={m} onCitationClick={onCitationClick} />)}
            {asking && (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], color: colors.textTertiary, fontSize: typography.fontSize.xs }}>
                <Loader2 size={14} className="animate-spin" /> Thinking…
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{
            padding: spacing['3'],
            borderTop: `1px solid ${colors.borderSubtle}`,
            display: 'flex',
            gap: spacing['2'],
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
                padding: `${spacing['2']} ${spacing['3']}`,
                backgroundColor: colors.surfaceInset,
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: borderRadius.md,
                fontSize: typography.fontSize.sm,
                color: colors.textPrimary,
                outline: 'none',
              }}
            />
            <Btn variant="primary" onClick={ask} disabled={asking || !question.trim()}>
              <Send size={14} />
            </Btn>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectBrain;
