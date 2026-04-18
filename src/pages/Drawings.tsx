import React, { useState, useRef, useCallback, useMemo } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Upload, X, Sparkles, FileText, AlertTriangle, AlertCircle, CheckCircle2, Loader2, ChevronRight, ChevronDown, FileDown } from 'lucide-react';
import { ReportGenerationModal, type ReportGenerationOptions } from '../components/reports/ReportGenerationModal';
import { ProcessingPipeline } from '../components/drawings/ProcessingPipeline';
import type { PipelineState } from '../hooks/useDrawingIntelligence';
import { aiService } from '../lib/aiService';
import type { DrawingAnalysis } from '../types/ai';
import type { DrawingRevision } from '../types/api';
import { PageContainer, Card, Btn, Tag, MetricBox, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions, shadows, zIndex } from '../styles/theme';
import { getDrawings, getDisciplineColor, getDrawingRevisionHistory } from '../api/endpoints/documents';
import { useQuery } from '../hooks/useQuery';
import { useProjectId } from '../hooks/useProjectId';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { getAnnotationsForEntity } from '../data/aiAnnotations';
import { DrawingViewer } from '../components/drawings/DrawingViewer';
import { VersionCompare } from '../components/drawings/VersionCompare';
const PdfViewer = React.lazy(() => import('../components/drawings/PdfViewer').then(m => ({ default: m.PdfViewer })));
import { PermissionGate } from '../components/auth/PermissionGate';
import { supabase } from '../lib/supabase';
import { UploadZone } from '../components/files/UploadZone';
import { drawingService } from '../services/drawingService';


const aiChanges: Record<number, number> = {};

const linkedItems: Record<number, { rfis: number; submittals: number }> = {};

const lastViewed: Record<number, string> = {};

const gridColumns = '60px 80px 1fr 120px 80px 100px 80px 70px 120px 100px 70px 90px';

// Static coordination conflicts for the AI Insights panel
function parseAiConflicts(text: string): Array<{ severity: 'high' | 'medium' | 'low'; description: string; sheets: string[] }> {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.conflicts && Array.isArray(parsed.conflicts)) return parsed.conflicts;
  } catch { /* not JSON */ }
  const lines = text.split(/\n+/).map((l) => l.replace(/^[-•*\d.]\s*/, '').trim()).filter((l) => l.length > 10);
  const severities: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'medium', 'low', 'low', 'low'];
  return lines.slice(0, 6).map((line, i) => ({
    severity: severities[Math.min(i, severities.length - 1)],
    description: line,
    sheets: [],
  }));
}

const coordinationConflicts = [
  { id: 'c1', drawing1: 'A-201', rev1: 'Rev 3', drawing2: 'S-101', location: 'Grid Line C4', discipline1: 'Architectural', discipline2: 'Structural', confidence: 0.94 },
  { id: 'c2', drawing1: 'M-301', rev1: 'Rev 2', drawing2: 'S-204', location: 'Level 3 ceiling plenum', discipline1: 'Mechanical', discipline2: 'Structural', confidence: 0.88 },
  { id: 'c3', drawing1: 'E-101', rev1: 'Rev 1', drawing2: 'P-201', location: 'Mechanical room west wall', discipline1: 'Electrical', discipline2: 'Plumbing', confidence: 0.76 },
  { id: 'c4', drawing1: 'FP-101', rev1: 'Rev 2', drawing2: 'A-301', location: 'Stairwell 3 soffit', discipline1: 'Fire Protection', discipline2: 'Architectural', confidence: 0.71 },
  { id: 'c5', drawing1: 'M-401', rev1: 'Rev 1', drawing2: 'E-202', location: 'Roof drain area B7', discipline1: 'Mechanical', discipline2: 'Electrical', confidence: 0.68 },
];

const DrawingsPage: React.FC = () => {
  const { addToast } = useToast();
    const projectId = useProjectId();
  const { data: drawings, loading, error, refetch } = useQuery(`drawings-${projectId}`, () => getDrawings(projectId!), { enabled: !!projectId });
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [selectedDrawing, setSelectedDrawing] = useState<NonNullable<typeof drawings>[0] | null>(null);
  const [viewerDrawing, setViewerDrawing] = useState<NonNullable<typeof drawings>[0] | null>(null);
  const [sortField, setSortField] = useState<string>('setNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showConflicts, setShowConflicts] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<number, DrawingAnalysis>>({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const sortedDrawingsRef = useRef<typeof sortedDrawings>([]);
  const [viewingRevisionNum, setViewingRevisionNum] = useState<number | null>(null);
  const [showVersionCompare, setShowVersionCompare] = useState(false);
  const [compareRevAIdx, setCompareRevAIdx] = useState(0);
  const [compareRevBIdx, setCompareRevBIdx] = useState(1);
  const [viewRevPdfUrl, setViewRevPdfUrl] = useState<string | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPanelLoading, setAiPanelLoading] = useState(false);
  const [aiPanelConflicts, setAiPanelConflicts] = useState<Array<{ severity: 'high' | 'medium' | 'low'; description: string; sheets: string[] }>>([]);
  const [aiPanelError, setAiPanelError] = useState<string | null>(null);
  const [aiPanelAnalyzed, setAiPanelAnalyzed] = useState(false);
  const [uploadDiscipline, setUploadDiscipline] = useState('Architectural');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pageIsDragging, setPageIsDragging] = useState(false);
  const [openRevDropdownId, setOpenRevDropdownId] = useState<string | null>(null);
  const [rowRevHistory, setRowRevHistory] = useState<Record<string, DrawingRevision[]>>({});
  const [rowRevHistoryLoading, setRowRevHistoryLoading] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showPipeline, setShowPipeline] = useState(false);
  const pipelineState = useMemo<PipelineState>(
    () => ({
      stage: isUploading ? 'classifying' : 'idle',
      totalPairs: 0,
      processedPairs: 0,
      discrepancyCount: 0,
      autoRfiCount: 0,
      error: null,
    }),
    [isUploading],
  );
  const reportDrawings = useMemo(
    () =>
      (drawings ?? []).map((d) => ({
        id: String(d.id),
        sheet_number: d.setNumber ?? null,
        discipline: d.discipline ?? null,
      })),
    [drawings],
  );
  const handleGenerateReport = useCallback(
    async (opts: ReportGenerationOptions) => {
      const scope =
        opts.drawingIds === 'all' ? 'all drawings' : `${opts.drawingIds.length} drawings`;
      addToast('success', `${opts.reportType} report queued for ${scope}`);
    },
    [addToast],
  );
  const [selectedRevisions, setSelectedRevisions] = useState<DrawingRevision[]>([]);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [compareOpacity, setCompareOpacity] = useState(100);
  const [compareDrawingTitle, setCompareDrawingTitle] = useState('');
  const [showRevUploadModal, setShowRevUploadModal] = useState(false);
  const [revUploadFile, setRevUploadFile] = useState<File | null>(null);
  const [revUploadNum, setRevUploadNum] = useState('');
  const [revUploadDesc, setRevUploadDesc] = useState('');
  const [isRevUploading, setIsRevUploading] = useState(false);

  const { data: revisionHistory } = useQuery(
    `revision-history-${selectedDrawing?.id ?? 'none'}`,
    () => getDrawingRevisionHistory(String(selectedDrawing!.id)),
    { enabled: !!selectedDrawing?.id },
  );

  React.useEffect(() => { setViewingRevisionNum(null); setShowVersionCompare(false); setCompareRevAIdx(0); setCompareRevBIdx(1); setViewRevPdfUrl(null); }, [selectedDrawing?.id]);

  const formatRevDate = (dateStr: string | null): string => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  const allDrawings = drawings || [];
  const uniqueDisciplines = Array.from(new Set(allDrawings.map((d) => d.discipline).filter(Boolean))) as string[];
  const filteredDrawings =
    activeFilters.size === 0 ? allDrawings : allDrawings.filter((d) => activeFilters.has(d.discipline));

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleAnalyzeSheet = async (e: React.MouseEvent, drawing: NonNullable<typeof drawings>[0]) => {
    e.stopPropagation();
    setAnalyzingId(drawing.id);
    try {
      const result = await aiService.analyzeDrawingSheet(String(drawing.id), '');
      setAnalysisResults((prev) => ({ ...prev, [drawing.id]: result }));
      addToast('success', `Analysis complete: ${result.drawingNumber} ${result.revision}`);
    } catch {
      addToast('error', 'Sheet analysis failed. Try again.');
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleGridKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const total = sortedDrawingsRef.current.length;
    if (total === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      const next = Math.min(focusedIndex + 1, total - 1);
      setFocusedIndex(next);
      const rows = gridRef.current?.querySelectorAll<HTMLElement>('[role="listitem"]');
      rows?.[next]?.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      const prev = Math.max(focusedIndex - 1, 0);
      setFocusedIndex(prev);
      const rows = gridRef.current?.querySelectorAll<HTMLElement>('[role="listitem"]');
      rows?.[prev]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const drawing = sortedDrawingsRef.current[focusedIndex];
      if (drawing) setSelectedDrawing(drawing);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSelectedDrawing(null);
    }
  }, [focusedIndex]);

  const handleAiAnalyze = async () => {
    if (!selectedDrawing || !projectId) return;
    setAiPanelLoading(true);
    setAiPanelError(null);
    setAiPanelConflicts([]);
    setAiPanelAnalyzed(false);
    try {
      const sheetNumber = selectedDrawing.setNumber || selectedDrawing.title;
      const { data, error: fnError } = await supabase.functions.invoke('ai-copilot', {
        body: {
          project_id: projectId,
          message: `Analyze drawing ${sheetNumber} for coordination conflicts with other disciplines`,
          context: { entity_type: 'drawing', entity_id: String(selectedDrawing.id) },
        },
      });
      if (fnError) throw fnError;
      const responseText: string =
        data?.response ?? data?.message ?? (typeof data === 'string' ? data : JSON.stringify(data));
      const parsed = parseAiConflicts(responseText);
      setAiPanelConflicts(parsed);
      setAiPanelAnalyzed(true);
    } catch {
      setAiPanelError('AI analysis unavailable. Ensure the AI service is configured in project settings.');
    } finally {
      setAiPanelLoading(false);
    }
  };

  const sortedDrawings = [...filteredDrawings].sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[sortField];
    const bVal = (b as Record<string, unknown>)[sortField];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });
  sortedDrawingsRef.current = sortedDrawings;

  const handleFileReady = useCallback((file: File) => {
    setPendingFiles((prev) => [...prev, file]);
  }, []);

  const handleUploadDrawings = async () => {
    if (!projectId || pendingFiles.length === 0) return;
    setIsUploading(true);
    setShowPipeline(true);
    let completed = 0;
    const total = pendingFiles.length;
    for (const file of pendingFiles) {
      setUploadProgressText(`Uploading sheet ${completed + 1} of ${total}...`);
      const titleNoExt = file.name.replace(/\.[^.]+$/, '');
      const sheetMatch = titleNoExt.match(/^([A-Z]{1,3}-?\d+)/i);
      const sheetNumber = sheetMatch ? sheetMatch[1].toUpperCase() : titleNoExt.substring(0, 20);
      const storagePath = `${projectId}/drawings/${Date.now()}-${file.name}`;
      let fileUrl = storagePath;
      try {
        const { data: storageData } = await supabase.storage.from('drawings').upload(storagePath, file);
        if (storageData?.path) fileUrl = storageData.path;
      } catch { /* storage upload failed, continue with generated path */ }
      await drawingService.createDrawing({
        project_id: projectId,
        title: titleNoExt,
        discipline: uploadDiscipline,
        sheet_number: sheetNumber,
        revision: '1',
        file_url: fileUrl,
      });
      completed++;
    }
    setIsUploading(false);
    setUploadProgressText('');
    setPendingFiles([]);
    setShowUploadModal(false);
    setUploadFiles([]);
    setIsDragging(false);
    setUploadDiscipline('Architectural');
    refetch();
    addToast('success', `${completed} drawing${completed !== 1 ? 's' : ''} uploaded successfully.`);
  };

  const handlePageDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const hasFile = Array.from(e.dataTransfer.items).some((item) => item.kind === 'file');
    if (hasFile) setPageIsDragging(true);
  }, []);

  const handlePageDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setPageIsDragging(false);
    }
  }, []);

  const handlePageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setPageIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => /\.(pdf|dwg|dxf)$/i.test(f.name));
    if (files.length > 0) {
      setPendingFiles(files);
      setShowUploadModal(true);
    }
  }, []);

  const handleUploadRevision = async () => {
    if (!projectId || !selectedDrawing || !revUploadNum) return;
    setIsRevUploading(true);
    let fileUrl: string | null = null;
    if (revUploadFile) {
      const path = `${projectId}/drawings/rev-${Date.now()}-${revUploadFile.name}`;
      try {
        const { data: storageData } = await supabase.storage.from('drawings').upload(path, revUploadFile);
        if (storageData?.path) fileUrl = storageData.path;
      } catch { /* storage upload failed, proceed without file url */ }
    }
    // Supersede existing current revisions
    await supabase
      .from('drawing_revisions')
      .update({ superseded_at: new Date().toISOString() })
      .eq('drawing_id', String(selectedDrawing.id))
      .is('superseded_at', null);
    await supabase.from('drawing_revisions').insert({
      drawing_id: String(selectedDrawing.id),
      revision_number: Number(revUploadNum),
      issued_date: new Date().toISOString().slice(0, 10),
      change_description: revUploadDesc || null,
      file_url: fileUrl,
    });
    setIsRevUploading(false);
    setShowRevUploadModal(false);
    setRevUploadFile(null);
    setRevUploadNum('');
    setRevUploadDesc('');
    refetch();
    addToast('success', `Revision ${revUploadNum} uploaded for ${selectedDrawing.title}.`);
  };

  const handleRevDropdown = useCallback(async (e: React.MouseEvent, drawingId: string, drawingTitle: string, fallbackRevisions: DrawingRevision[]) => {
    e.stopPropagation();
    if (openRevDropdownId === drawingId) {
      setOpenRevDropdownId(null);
      return;
    }
    setOpenRevDropdownId(drawingId);
    if (!rowRevHistory[drawingId]) {
      if (fallbackRevisions.length > 0) {
        setRowRevHistory((prev) => ({ ...prev, [drawingId]: fallbackRevisions }));
      } else {
        setRowRevHistoryLoading(drawingId);
        try {
          const history = await getDrawingRevisionHistory(drawingId);
          setRowRevHistory((prev) => ({ ...prev, [drawingId]: history }));
        } catch {
          // keep dropdown open with empty state
        } finally {
          setRowRevHistoryLoading(null);
        }
      }
    }
    setCompareDrawingTitle(drawingTitle);
  }, [openRevDropdownId, rowRevHistory]);

  return (
    <PageContainer
      title="Drawings"
      actions={
        <>
          <Btn
            variant="secondary"
            size="md"
            icon={<Sparkles size={16} />}
            aria-label="Toggle AI insights panel"
            aria-pressed={showAiPanel}
            onClick={() => setShowAiPanel((v) => !v)}
          >
            AI Insights
          </Btn>
          <Btn
            variant="secondary"
            size="md"
            icon={<FileDown size={16} />}
            aria-label="Generate drawings report"
            onClick={() => setShowReportModal(true)}
          >
            Generate Report
          </Btn>
          <PermissionGate permission="drawings.upload">
            <Btn variant="primary" size="md" icon={<Upload size={16} />} aria-label="Upload new drawing" onClick={() => setShowUploadModal(true)}>
              Upload Drawings
            </Btn>
          </PermissionGate>
        </>
      }
    >
      <h1 style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>Drawings</h1>
      <style>{`
        @media(max-width:768px){
          .drawings-layout{grid-template-columns:1fr!important;}
          .drawing-table-header{display:none!important;}
          .drawings-list{display:grid;grid-template-columns:1fr;gap:8px;padding:8px;}
          .drawing-row-desktop{display:none!important;}
          .drawing-row-mobile{display:flex!important;}
        }
        @media(min-width:769px){
          .drawing-row-mobile{display:none!important;}
        }
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
        .drawing-row:focus-visible{outline:2px solid var(--color-primary,#F47820);outline-offset:-2px;}
      `}</style>
      <div
        style={{ position: 'relative' }}
        onDragOver={handlePageDragOver}
        onDragLeave={handlePageDragLeave}
        onDrop={handlePageDrop}
      >
        {pageIsDragging && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 50,
              backgroundColor: `${colors.primaryOrange}10`,
              border: `2px dashed ${colors.primaryOrange}`,
              borderRadius: borderRadius.lg,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing['3'],
              pointerEvents: 'none',
            }}
          >
            <Upload size={48} color={colors.primaryOrange} />
            <p style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange, margin: 0 }}>
              Drop drawings here
            </p>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.primaryOrange, margin: 0, opacity: 0.7 }}>
              .pdf, .dwg, .dxf files accepted
            </p>
          </div>
        )}
        <div
          className="drawings-layout"
          style={{
            display: 'grid',
            gridTemplateColumns: selectedDrawing ? '1fr 380px' : '1fr',
            gap: spacing.xl,
          }}
        >
        <div>
          {/* Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.lg, marginBottom: spacing.xl }}>
            <MetricBox label="Total Drawings" value={allDrawings.length} />
            <MetricBox label="Current Revisions" value={allDrawings.filter((d) => d.currentRevision !== null).length} />
            <MetricBox label="Pending Markups" value={Object.values(aiChanges).reduce((a, b) => a + b, 0)} />
            <MetricBox label="Disciplines" value={uniqueDisciplines.length} />
          </div>

          {/* AI Insights Panel */}
          <div style={{ marginBottom: spacing['4'], backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`, overflow: 'hidden' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, cursor: 'pointer', borderBottom: showConflicts ? `1px solid ${colors.borderSubtle}` : 'none', transition: `background-color ${transitions.instant}` }}
              onClick={() => setShowConflicts((v) => !v)}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Sparkles size={14} color={colors.statusReview} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
                  AI Insights: {coordinationConflicts.length} coordination conflicts detected in latest revision
                </p>
                <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 1 }}>Click to {showConflicts ? 'collapse' : 'review'} conflicts across disciplines</p>
              </div>
              <span style={{ fontSize: typography.fontSize.caption, backgroundColor: `${colors.statusCritical}12`, color: colors.statusCritical, padding: '2px 8px', borderRadius: borderRadius.full, fontWeight: typography.fontWeight.semibold }}>
                {coordinationConflicts.filter((c) => c.confidence >= 0.8).length} high confidence
              </span>
            </div>

            {showConflicts && (
              <div style={{ padding: spacing['2'] }}>
                {coordinationConflicts.map((conflict) => (
                  <div key={conflict.id} style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], padding: `${spacing['2']} ${spacing['2']}`, borderRadius: borderRadius.base }}>
                    <AlertTriangle size={13} color={conflict.confidence >= 0.8 ? colors.statusCritical : colors.statusPending} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>
                        <span style={{ fontWeight: typography.fontWeight.semibold }}>{conflict.drawing1} {conflict.rev1}</span>
                        {' conflicts with '}
                        <span style={{ fontWeight: typography.fontWeight.semibold }}>{conflict.drawing2}</span>
                        {' at '}
                        <span style={{ color: colors.primaryOrange }}>{conflict.location}</span>
                      </p>
                      <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 1 }}>
                        {conflict.discipline1} vs {conflict.discipline2}
                      </p>
                    </div>
                    <span style={{ fontSize: typography.fontSize.caption, color: conflict.confidence >= 0.8 ? colors.statusCritical : colors.statusPending, fontWeight: typography.fontWeight.semibold, flexShrink: 0 }}>
                      {Math.round(conflict.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Discipline filter pills */}
          <div style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: colors.white, paddingTop: spacing['2'], paddingBottom: spacing['2'], marginBottom: spacing.xl }}>
          <div role="group" aria-label="Filter by discipline" style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
            {uniqueDisciplines.map((discipline) => {
              const isActive = activeFilters.has(discipline);
              const pillColor = getDisciplineColor(discipline);
              const count = allDrawings.filter((d) => d.discipline === discipline).length;
              return (
                <button
                  key={discipline}
                  role="button"
                  tabIndex={0}
                  aria-label={`Filter by ${discipline} discipline`}
                  aria-pressed={isActive}
                  onClick={() => {
                    setActiveFilters((prev) => {
                      const next = new Set(prev);
                      if (next.has(discipline)) next.delete(discipline);
                      else next.add(discipline);
                      return next;
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveFilters((prev) => {
                        const next = new Set(prev);
                        if (next.has(discipline)) next.delete(discipline);
                        else next.add(discipline);
                        return next;
                      });
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing['1'],
                    padding: `${spacing.sm} ${spacing.md}`,
                    backgroundColor: isActive ? pillColor : 'transparent',
                    color: isActive ? colors.white : pillColor,
                    border: `1.5px solid ${pillColor}`,
                    borderRadius: borderRadius.full,
                    cursor: 'pointer',
                    fontSize: typography.fontSize.sm,
                    fontFamily: typography.fontFamily,
                    fontWeight: typography.fontWeight.medium,
                    transition: `all ${transitions.quick}`,
                    minHeight: '56px',
                  }}
                >
                  {discipline}
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 18,
                    height: 18,
                    borderRadius: borderRadius.full,
                    backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : `${pillColor}22`,
                    fontSize: typography.fontSize.caption,
                    fontWeight: typography.fontWeight.semibold,
                    padding: '0 4px',
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
            {activeFilters.size > 0 && (
              <button
                aria-label="Clear all discipline filters"
                onClick={() => setActiveFilters(new Set())}
                style={{
                  padding: `${spacing.sm} ${spacing.md}`,
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  color: colors.textTertiary,
                  textDecoration: 'underline',
                  minHeight: '56px',
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
          </div>

          {/* Results count — visible label */}
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginBottom: spacing.md }}>
            {activeFilters.size > 0
              ? `Showing ${sortedDrawings.length} of ${allDrawings.length} drawing${allDrawings.length !== 1 ? 's' : ''}`
              : `${sortedDrawings.length} drawing${sortedDrawings.length !== 1 ? 's' : ''}`}
          </p>
          {/* sr-only live region announces filter result counts to screen readers */}
          <span
            aria-live="polite"
            aria-atomic="true"
            style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}
          >
            {`Showing ${sortedDrawings.length} of ${allDrawings.length} drawings`}
          </span>

          {/* Drawings Table */}
          <div style={{ overflowX: 'auto' }}>
          <Card padding="0">
            {/* Custom sortable header */}
            <div className="drawing-table-header" style={{ display: 'grid', gridTemplateColumns: gridColumns, padding: `${spacing.md} ${spacing.lg}`, borderBottom: `1px solid ${colors.border}` }}>
              {/* thumbnail col, no sort */}
              <span></span>
              {[
                { field: 'setNumber', label: 'Set #' },
                { field: 'title', label: 'Title' },
                { field: 'discipline', label: 'Discipline' },
                { field: 'revision', label: 'Rev' },
                { field: 'date', label: 'Date Issued' },
                { field: 'status', label: 'Status' },
                { field: 'sheetCount', label: 'Sheets' },
                { field: '', label: 'Linked' },
                { field: '', label: 'Last Viewed' },
                { field: '', label: 'View' },
                { field: '', label: 'Analyze' },
              ].map((col, i) => (
                <button key={col.label || `col-${i}`} onClick={() => col.field && handleSort(col.field)} style={{ display: 'flex', alignItems: 'center', gap: 2, border: 'none', backgroundColor: 'transparent', cursor: col.field ? 'pointer' : 'default', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textTertiary, fontFamily: typography.fontFamily, padding: 0 }}>
                  {col.label}
                  {col.field && sortField === col.field && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </button>
              ))}
            </div>

            {loading && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'], padding: spacing['4'] }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        height: 200,
                        borderRadius: 12,
                        backgroundColor: colors.surfaceInset,
                        border: `1px solid ${colors.borderSubtle}`,
                        animation: 'pulse 1.5s ease-in-out infinite',
                        animationDelay: `${i * 0.1}s`,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ flex: 1, backgroundColor: colors.borderSubtle }} />
                      <div style={{ padding: `${spacing['2']} ${spacing['3']}`, display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                        <div style={{ height: 12, borderRadius: 6, backgroundColor: colors.borderSubtle, width: '70%' }} />
                        <div style={{ height: 10, borderRadius: 6, backgroundColor: colors.borderSubtle, width: '45%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {!loading && error && (
              <div role="alert" style={{ margin: spacing['4'], padding: spacing['4'], backgroundColor: colors.white, border: `1px solid ${colors.borderSubtle}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                <AlertCircle size={16} color={colors.statusCritical} style={{ flexShrink: 0 }} />
                <p style={{ flex: 1, margin: 0, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>Unable to load drawings. Check your connection and try again.</p>
                <Btn variant="secondary" size="sm" onClick={() => refetch()}>Retry</Btn>
              </div>
            )}
            {!loading && !error && (
              <div
                role="list"
                aria-label="Project drawings"
                ref={gridRef}
                onKeyDown={handleGridKeyDown}
              >
              <style>{`.drawing-row:focus-visible{outline:2px solid var(--color-primary,#F47820);outline-offset:-2px;}`}</style>
              {sortedDrawings.map((drawing, index) => {
              const thumbColor = drawing.disciplineColor || getDisciplineColor(drawing.discipline || '');
              const linked = linkedItems[drawing.id];
              const viewed = lastViewed[drawing.id];
              const rowBorder = index < sortedDrawings.length - 1 ? `1px solid ${colors.border}` : 'none';
              const rev = drawing.currentRevision?.revision_number ?? drawing.revision ?? '';
              const ariaLabel = `${drawing.title}, ${drawing.discipline}, Revision ${rev}`;
              return (
                <React.Fragment key={drawing.id}>
                {/* Mobile card row */}
                <div
                  role="listitem"
                  tabIndex={index === focusedIndex ? 0 : -1}
                  aria-label={ariaLabel}
                  className="drawing-row drawing-row-mobile"
                  onFocus={() => setFocusedIndex(index)}
                  onClick={() => setSelectedDrawing(drawing)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDrawing(drawing); } }}
                  style={{
                    display: 'none',
                    padding: `${spacing.md} ${spacing.lg}`,
                    borderBottom: rowBorder,
                    cursor: 'pointer',
                    alignItems: 'center',
                    gap: spacing['3'],
                    transition: `background-color ${transitions.quick}`,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div style={{ width: 40, height: 32, borderRadius: borderRadius.sm, backgroundColor: thumbColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, flexShrink: 0 }}>
                    {drawing.discipline[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {drawing.title}
                    </p>
                    <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                      {drawing.setNumber} · Rev {drawing.currentRevision?.revision_number ?? drawing.revision} · {drawing.discipline}
                    </p>
                  </div>
                  <ChevronRight size={16} color={colors.textTertiary} style={{ flexShrink: 0 }} />
                </div>
                {/* Desktop table row */}
                <div
                  role="listitem"
                  tabIndex={index === focusedIndex ? 0 : -1}
                  aria-label={ariaLabel}
                  className="drawing-row drawing-row-desktop"
                  onClick={() => { setFocusedIndex(index); setSelectedDrawing(drawing); }}
                  onFocus={() => setFocusedIndex(index)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDrawing(drawing); } }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: gridColumns,
                    padding: `${spacing.md} ${spacing.lg}`,
                    borderBottom: rowBorder,
                    cursor: 'pointer',
                    alignItems: 'center',
                    transition: `background-color ${transitions.quick}`,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {/* Thumbnail */}
                  <div style={{ width: 48, height: 36, borderRadius: borderRadius.sm, backgroundColor: thumbColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold }}>
                    {drawing.discipline[0]}
                  </div>

                  {/* Set # */}
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                    {drawing.setNumber}
                  </span>

                  {/* Title */}
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: thumbColor,
                        flexShrink: 0,
                        display: 'inline-block',
                      }}
                    />
                    {drawing.title}
                    {getAnnotationsForEntity('drawing', drawing.id).map((ann) => (
                      <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                    ))}
                    {aiChanges[drawing.id] && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['1'], marginLeft: spacing['2'], padding: '1px 6px', backgroundColor: `${colors.statusReview}12`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusReview, whiteSpace: 'nowrap' }}>
                        <Sparkles size={10} /> {aiChanges[drawing.id]} AI changes
                      </span>
                    )}
                  </span>

                  {/* Discipline */}
                  <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: thumbColor, flexShrink: 0, display: 'inline-block' }} />
                    <Tag label={drawing.discipline} />
                  </span>

                  {/* Revision */}
                  <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      aria-label={`Revision history for ${drawing.setNumber}`}
                      aria-expanded={openRevDropdownId === String(drawing.id)}
                      aria-haspopup="listbox"
                      onClick={(e) => handleRevDropdown(e, String(drawing.id), drawing.title, drawing.revisions)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: typography.fontSize.sm,
                        color: colors.textSecondary,
                        background: 'none',
                        border: `1px solid ${colors.borderSubtle}`,
                        borderRadius: borderRadius.base,
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontFamily: typography.fontFamily,
                        whiteSpace: 'nowrap',
                        transition: `border-color ${transitions.quick}, color ${transitions.quick}`,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.primaryOrange; e.currentTarget.style.color = colors.primaryOrange; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.borderSubtle; e.currentTarget.style.color = colors.textSecondary; }}
                    >
                      Rev {drawing.currentRevision?.revision_number ?? drawing.revision}
                      <ChevronDown size={10} />
                    </button>
                    {openRevDropdownId === String(drawing.id) && (
                      <div
                        role="listbox"
                        aria-label={`Revision history for ${drawing.setNumber}`}
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          left: 0,
                          zIndex: 200,
                          backgroundColor: colors.surfaceRaised,
                          border: `1px solid ${colors.borderSubtle}`,
                          borderRadius: borderRadius.md,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                          minWidth: 300,
                          maxHeight: 320,
                          overflowY: 'auto',
                        }}
                      >
                        <div style={{ padding: `${spacing['2']} ${spacing['3']}`, borderBottom: `1px solid ${colors.borderSubtle}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                            Revision History
                          </span>
                          {(rowRevHistory[String(drawing.id)]?.length ?? 0) >= 2 && (
                            <button
                              onClick={() => {
                                const history = rowRevHistory[String(drawing.id)];
                                const current = history.find((r) => !r.superseded_at) ?? history[0];
                                const older = history.find((r) => r.id !== current.id) ?? history[1];
                                setSelectedRevisions([older, current]);
                                setCompareOpacity(100);
                                setComparisonMode(true);
                                setOpenRevDropdownId(null);
                              }}
                              style={{
                                fontSize: typography.fontSize.caption,
                                color: colors.primaryOrange,
                                border: `1px solid ${colors.primaryOrange}40`,
                                borderRadius: borderRadius.base,
                                backgroundColor: 'transparent',
                                cursor: 'pointer',
                                padding: '2px 8px',
                                fontFamily: typography.fontFamily,
                                fontWeight: typography.fontWeight.medium,
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${colors.primaryOrange}10`; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              Compare
                            </button>
                          )}
                        </div>
                        {rowRevHistoryLoading === String(drawing.id) ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: spacing['4'], gap: spacing['2'] }}>
                            <Loader2 size={14} color={colors.textTertiary} style={{ animation: 'spin 1s linear infinite' }} />
                            <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Loading revisions...</span>
                          </div>
                        ) : (rowRevHistory[String(drawing.id)] ?? drawing.revisions).map((rev) => {
                          const isCurrent = !rev.superseded_at;
                          return (
                            <button
                              key={rev.id}
                              role="option"
                              aria-selected={isCurrent}
                              onClick={() => {
                                if (rev.file_url) {
                                  setViewRevPdfUrl(rev.file_url);
                                } else {
                                  setViewingRevisionNum(isCurrent ? null : rev.revision_number);
                                  if (!isCurrent) setViewerDrawing({ ...drawing, revision: `Rev ${rev.revision_number}` });
                                }
                                setOpenRevDropdownId(null);
                              }}
                              style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: `${spacing['2']} ${spacing['3']}`,
                                backgroundColor: 'transparent',
                                border: 'none',
                                borderBottom: `1px solid ${colors.borderSubtle}`,
                                cursor: 'pointer',
                                fontFamily: typography.fontFamily,
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: 2 }}>
                                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                                  Rev {rev.revision_number}
                                </span>
                                {isCurrent && (
                                  <span style={{ fontSize: typography.fontSize.caption, color: colors.statusActive, backgroundColor: `${colors.statusActive}18`, padding: '1px 6px', borderRadius: borderRadius.full }}>
                                    Current
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                                {formatRevDate(rev.issued_date)}{rev.issued_by ? ` · ${rev.issued_by}` : ''}
                              </div>
                              {rev.change_description && (
                                <div style={{ fontSize: typography.fontSize.caption, color: colors.gray600, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {rev.change_description}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Date Issued */}
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                    {formatRevDate(drawing.currentRevision?.issued_date ?? null) !== '—'
                      ? formatRevDate(drawing.currentRevision?.issued_date ?? null)
                      : drawing.date}
                  </span>

                  {/* Status */}
                  {(() => {
                    const st = drawing.status ?? 'current';
                    const cfg: Record<string, { bg: string; color: string; label: string }> = {
                      current:    { bg: `${colors.statusActive}18`,   color: colors.statusActive,   label: 'Current' },
                      superseded: { bg: `${colors.statusPending}18`,  color: colors.statusPending,  label: 'Superseded' },
                      draft:      { bg: `${colors.statusReview}18`,   color: colors.statusReview,   label: 'Draft' },
                    };
                    const c = cfg[st] ?? cfg['current'];
                    return (
                      <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, padding: '2px 8px', borderRadius: borderRadius.full, backgroundColor: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
                        {c.label}
                      </span>
                    );
                  })()}

                  {/* Sheets */}
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                    {drawing.sheetCount}
                  </span>

                  {/* Linked */}
                  <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], flexWrap: 'wrap' }}>
                    {linked ? (
                      <>
                        {linked.rfis > 0 && (
                          <span
                            style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: borderRadius.full, backgroundColor: `${colors.statusInfo}18`, color: colors.statusInfo, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            onClick={(e) => { e.stopPropagation(); addToast('info', `${linked.rfis} RFI${linked.rfis !== 1 ? 's' : ''} linked to ${drawing.setNumber}`); }}
                          >
                            {linked.rfis} RFI{linked.rfis !== 1 ? 's' : ''}
                          </span>
                        )}
                        {linked.submittals > 0 && (
                          <span
                            style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: borderRadius.full, backgroundColor: `${colors.statusPending}18`, color: colors.statusPending, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            onClick={(e) => { e.stopPropagation(); addToast('info', `${linked.submittals} submittal${linked.submittals !== 1 ? 's' : ''} linked to ${drawing.setNumber}`); }}
                          >
                            {linked.submittals} Sub
                          </span>
                        )}
                        {linked.rfis === 0 && linked.submittals === 0 && <span style={{ color: colors.textTertiary }}>—</span>}
                      </>
                    ) : (
                      <span style={{ color: colors.textTertiary }}>—</span>
                    )}
                  </span>

                  {/* Last Viewed */}
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                    {viewed || '—'}
                  </span>

                  {/* View Button */}
                  <Btn variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setViewerDrawing(drawing); }}>View</Btn>

                  {/* Analyze Button */}
                  <div>
                    {analyzingId === drawing.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], padding: `4px ${spacing['2']}` }}>
                        <Loader2 size={12} color={colors.statusReview} style={{ animation: 'spin 1s linear infinite' }} />
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.statusReview }}>Analyzing</span>
                      </div>
                    ) : analysisResults[drawing.id] ? (
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], padding: `4px ${spacing['2']}`, cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); addToast('info', `${analysisResults[drawing.id].drawingNumber} ${analysisResults[drawing.id].revision}: ${analysisResults[drawing.id].conflicts.length} conflict(s) found`); }}
                      >
                        {analysisResults[drawing.id].conflicts.length > 0
                          ? <AlertTriangle size={12} color={colors.statusCritical} />
                          : <CheckCircle2 size={12} color={colors.statusActive} />}
                        <span style={{ fontSize: typography.fontSize.caption, color: analysisResults[drawing.id].conflicts.length > 0 ? colors.statusCritical : colors.statusActive, fontWeight: typography.fontWeight.semibold }}>
                          {analysisResults[drawing.id].conflicts.length > 0 ? `${analysisResults[drawing.id].conflicts.length} conflicts` : 'No conflicts'}
                        </span>
                      </div>
                    ) : (
                      <PermissionGate permission="ai.use">
                      <button
                        onClick={(e) => handleAnalyzeSheet(e, drawing)}
                        style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], padding: `4px ${spacing['2']}`, backgroundColor: `${colors.statusReview}10`, border: `1px solid ${colors.statusReview}30`, borderRadius: borderRadius.base, cursor: 'pointer', fontSize: typography.fontSize.caption, color: colors.statusReview, fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily, whiteSpace: 'nowrap' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${colors.statusReview}20`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = `${colors.statusReview}10`; }}
                      >
                        <Sparkles size={10} /> Analyze
                      </button>
                      </PermissionGate>
                    )}
                  </div>
                </div>
                </React.Fragment>
              );
            })}
              </div>
            )}
            {!loading && !error && sortedDrawings.length === 0 && (
              allDrawings.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing['10']} ${spacing['4']}`, textAlign: 'center' }}>
                  <Upload size={40} color={colors.textTertiary} style={{ marginBottom: spacing['4'] }} />
                  <p style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>No drawings uploaded yet.</p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginBottom: spacing['5'], maxWidth: 420 }}>Upload your plans to enable digital markup, RFI linking, and AI coordination analysis.</p>
                  <PermissionGate permission="drawings.upload">
                  <button
                    onClick={() => setShowUploadModal(true)}
                    style={{ backgroundColor: colors.primaryOrange, color: colors.white, borderRadius: borderRadius.lg, padding: `${spacing['3']} ${spacing['4']}`, border: 'none', cursor: 'pointer', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily, minHeight: '56px' }}
                  >
                    Upload Drawings
                  </button>
                  </PermissionGate>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing['6']} ${spacing['4']}`, textAlign: 'center' }}>
                  <FileText size={32} color={colors.textTertiary} style={{ marginBottom: spacing['3'] }} />
                  <p style={{ fontSize: typography.fontSize.body, fontWeight: 500, color: colors.textPrimary, margin: 0, marginBottom: spacing['1'] }}>No drawings match your filters</p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.gray600, margin: 0, marginBottom: spacing['4'] }}>Try adjusting your discipline filter</p>
                  <button onClick={() => setActiveFilters(new Set())} style={{ padding: `${spacing['1']} ${spacing['4']}`, backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.gray600, cursor: 'pointer' }}>
                    Clear filters
                  </button>
                </div>
              )
            )}
          </Card>
          </div>
        </div>

        {/* Detail Panel */}
        {selectedDrawing && (
          <div style={{ position: 'sticky', top: spacing.xl, height: 'fit-content' }}>
            <Card padding={spacing.xl}>
              {viewingRevisionNum !== null && (
                <div style={{ marginBottom: spacing.xl, padding: `${spacing.sm} ${spacing.md}`, backgroundColor: colors.statusPendingSubtle, border: `1px solid ${colors.statusPending}`, borderRadius: borderRadius.base, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.statusPending }}>
                    Viewing Revision {viewingRevisionNum} — not the current version
                  </span>
                  <button
                    onClick={() => setViewingRevisionNum(null)}
                    style={{ fontSize: typography.fontSize.sm, color: colors.primaryOrange, fontWeight: typography.fontWeight.semibold, border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontFamily: typography.fontFamily, whiteSpace: 'nowrap' }}
                  >
                    Back to Current
                  </button>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: spacing.xl,
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: typography.fontSize.sm,
                      color: colors.textTertiary,
                      margin: 0,
                      marginBottom: spacing.xs,
                    }}
                  >
                    {selectedDrawing.setNumber}
                  </p>
                  <h3
                    style={{
                      fontSize: typography.fontSize['2xl'],
                      fontWeight: typography.fontWeight.bold,
                      color: colors.textPrimary,
                      margin: 0,
                    }}
                  >
                    {selectedDrawing.title}
                  </h3>
                </div>
                <button
                  aria-label="Close drawing detail panel"
                  onClick={() => setSelectedDrawing(null)}
                  style={{
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: borderRadius.md,
                    cursor: 'pointer',
                    color: colors.textTertiary,
                    transition: `background-color ${transitions.quick}`,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceFlat;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl, marginBottom: spacing.xl }}>
                <div>
                  <p style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, margin: 0, marginBottom: spacing.xs }}>
                    Discipline
                  </p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>
                    {selectedDrawing.discipline}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, margin: 0, marginBottom: spacing.xs }}>
                    Revision
                  </p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>
                    {selectedDrawing.revision}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, margin: 0, marginBottom: spacing.xs }}>
                    Date
                  </p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>
                    {selectedDrawing.date}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, margin: 0, marginBottom: spacing.xs }}>
                    Sheets
                  </p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>
                    {selectedDrawing.sheetCount}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                <Btn variant="primary" size="md" fullWidth onClick={() => setViewerDrawing(selectedDrawing)}>
                  Open Viewer
                </Btn>
                <PermissionGate permission="ai.use">
                <Btn variant="secondary" size="md" fullWidth onClick={() => addToast('info', 'AI Scan initiated for ' + selectedDrawing.setNumber)}>
                  AI Scan
                </Btn>
                </PermissionGate>
                <PermissionGate permission="drawings.upload">
                  <Btn
                    variant="secondary"
                    size="md"
                    fullWidth
                    icon={<Upload size={16} />}
                    onClick={() => {
                      const nextRev = revisionHistory && revisionHistory.length > 0
                        ? String(revisionHistory[0].revision_number + 1)
                        : '1';
                      setRevUploadNum(nextRev);
                      setRevUploadFile(null);
                      setRevUploadDesc('');
                      setShowRevUploadModal(true);
                    }}
                  >
                    Upload Revision
                  </Btn>
                </PermissionGate>
              </div>

              {revisionHistory && revisionHistory.length > 0 && (
                <div style={{ marginTop: spacing.xl, borderTop: `1px solid ${colors.border}`, paddingTop: spacing.xl }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
                    <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
                      Revision History
                    </p>
                    <button
                      onClick={() => setShowVersionCompare(true)}
                      disabled={revisionHistory.length < 2}
                      style={{ fontSize: typography.fontSize.caption, color: revisionHistory.length >= 2 ? colors.primaryOrange : colors.textTertiary, border: `1px solid ${revisionHistory.length >= 2 ? `${colors.primaryOrange}40` : colors.border}`, borderRadius: borderRadius.base, backgroundColor: 'transparent', cursor: revisionHistory.length >= 2 ? 'pointer' : 'default', padding: '3px 8px', fontFamily: typography.fontFamily }}
                      onMouseEnter={(e) => { if (revisionHistory.length >= 2) e.currentTarget.style.backgroundColor = `${colors.primaryOrange}10`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      Compare Versions
                    </button>
                  </div>
                  <div aria-label="Revision history" role="list">
                    {revisionHistory.map((rev) => {
                      const isCurrent = !rev.superseded_at;
                      return (
                        <div
                          key={rev.id}
                          role="listitem"
                          aria-label={`Revision ${rev.revision_number}`}
                          style={{
                            borderLeft: `2px solid ${isCurrent ? colors.statusActive : colors.borderLight}`,
                            paddingLeft: 16,
                            marginBottom: 12,
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: spacing.sm,
                          }}
                        >
                          {/* Dot indicator */}
                          <span
                            aria-hidden="true"
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: isCurrent ? colors.statusActive : colors.textTertiary,
                              flexShrink: 0,
                              marginTop: 4,
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: 2, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                                Rev {rev.revision_number}
                              </span>
                              {isCurrent && (
                                <Tag
                                  label="Current"
                                  color={colors.statusActive}
                                  backgroundColor={`${colors.statusActive}18`}
                                />
                              )}
                            </div>
                            <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.gray600 }}>
                              {formatRevDate(rev.issued_date)}{rev.issued_by ? ` · ${rev.issued_by}` : ''}
                            </p>
                            {rev.change_description && (
                              <p style={{ margin: 0, marginTop: 2, fontSize: typography.fontSize.caption, color: colors.gray600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {rev.change_description}
                              </p>
                            )}
                            <button
                              aria-label={`View revision ${rev.revision_number} of ${selectedDrawing.title}`}
                              onClick={() => {
                                if (rev.file_url) {
                                  setViewRevPdfUrl(rev.file_url);
                                } else {
                                  setViewingRevisionNum(isCurrent ? null : rev.revision_number);
                                  if (!isCurrent) setViewerDrawing({ ...selectedDrawing, revision: `Rev ${rev.revision_number}` });
                                }
                              }}
                              style={{
                                marginTop: spacing['1'],
                                fontSize: typography.fontSize.caption,
                                color: colors.primaryOrange,
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                fontFamily: typography.fontFamily,
                                fontWeight: typography.fontWeight.medium,
                                textAlign: 'left',
                              }}
                            >
                              View This Revision
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
        </div>
      </div>
      {viewerDrawing && (
        <DrawingViewer
          drawing={viewerDrawing}
          onClose={() => setViewerDrawing(null)}
        />
      )}

      {viewRevPdfUrl && (
        <React.Suspense fallback={<div style={{padding: 20}}>Loading viewer...</div>}>
          <PdfViewer
            file={viewRevPdfUrl}
            title={`${selectedDrawing?.title ?? 'Drawing'} — Rev ${viewingRevisionNum ?? 'Current'}`}
            onClose={() => setViewRevPdfUrl(null)}
          />
        </React.Suspense>
      )}

      {showVersionCompare && selectedDrawing && revisionHistory && revisionHistory.length >= 2 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Compare versions: ${selectedDrawing.title}`}
          style={{
            position: 'fixed', inset: 0, zIndex: 1001,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(15, 22, 41, 0.55)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowVersionCompare(false); }}
        >
          <div
            style={{
              backgroundColor: colors.surfaceRaised,
              borderRadius: borderRadius.lg,
              border: `1px solid ${colors.borderSubtle}`,
              padding: spacing['5'],
              width: '90vw',
              maxWidth: 1100,
              height: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'], flexShrink: 0 }}>
              <h2 style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
                Compare Revisions: {selectedDrawing.title}
              </h2>
              <button
                onClick={() => setShowVersionCompare(false)}
                aria-label="Close revision compare"
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textTertiary }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceInset; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <X size={16} />
              </button>
            </div>
            {/* Revision selectors */}
            <div style={{ display: 'flex', gap: spacing['4'], marginBottom: spacing['4'], flexShrink: 0 }}>
              {([
                { label: 'Revision A', idx: compareRevAIdx, setIdx: setCompareRevAIdx },
                { label: 'Revision B', idx: compareRevBIdx, setIdx: setCompareRevBIdx },
              ] as const).map(({ label, idx, setIdx }) => (
                <div key={label} style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary, marginBottom: spacing['1'] }}>
                    {label}
                  </label>
                  <select
                    value={idx}
                    onChange={(e) => setIdx(Number(e.target.value))}
                    aria-label={`Select ${label}`}
                    style={{ width: '100%', padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary, backgroundColor: colors.surfaceRaised, cursor: 'pointer' }}
                  >
                    {revisionHistory.map((rev, i) => (
                      <option key={rev.id} value={i}>
                        Rev {rev.revision_number}{rev.issued_date ? ` — ${formatRevDate(rev.issued_date)}` : ''}{!rev.superseded_at ? ' (Current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {/* Compare viewport: iframes when file_urls exist, else VersionCompare */}
            <div style={{ flex: 1, minHeight: 0 }}>
              {(() => {
                const revA = revisionHistory[compareRevAIdx];
                const revB = revisionHistory[compareRevBIdx];
                if (revA?.file_url && revB?.file_url) {
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'], height: '100%' }}>
                      {([{ rev: revA, side: 'A' }, { rev: revB, side: 'B' }] as const).map(({ rev, side }) => (
                        <div key={side} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'], flexShrink: 0 }}>
                            <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.white, backgroundColor: side === 'A' ? colors.statusInfo : colors.primaryOrange, padding: '2px 8px', borderRadius: borderRadius.full }}>
                              {side}
                            </span>
                            <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
                              Rev {rev.revision_number}
                            </span>
                            {rev.issued_by && (
                              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                                {rev.issued_by}
                              </span>
                            )}
                            {!rev.superseded_at && (
                              <Tag label="Current" color={colors.statusActive} backgroundColor={`${colors.statusActive}18`} />
                            )}
                          </div>
                          <iframe
                            src={rev.file_url}
                            title={`Revision ${rev.revision_number} — ${selectedDrawing.title}`}
                            style={{ flex: 1, border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, width: '100%' }}
                          />
                        </div>
                      ))}
                    </div>
                  );
                }
                return (
                  <VersionCompare
                    currentRev={String(revA?.revision_number ?? revisionHistory[0].revision_number)}
                    previousRev={String(revB?.revision_number ?? revisionHistory[1].revision_number)}
                    drawingTitle={selectedDrawing.title}
                    currentRevision={revA ?? revisionHistory[0]}
                    previousRevision={revB ?? revisionHistory[1]}
                    revisionHistory={revisionHistory}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Backdrop to close revision dropdown on outside click */}
      {openRevDropdownId !== null && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 199 }}
          onClick={() => setOpenRevDropdownId(null)}
          aria-hidden="true"
        />
      )}

      {/* Row-level comparison modal */}
      {comparisonMode && selectedRevisions.length === 2 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Compare revisions: ${compareDrawingTitle}`}
          style={{ position: 'fixed', inset: 0, zIndex: 1002, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 22, 41, 0.55)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setComparisonMode(false); }}
        >
          <div
            style={{ backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg, border: `1px solid ${colors.borderSubtle}`, padding: spacing['5'], width: '92vw', maxWidth: 1200, height: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'], flexShrink: 0 }}>
              <h2 style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
                Compare Revisions: {compareDrawingTitle}
              </h2>
              <button
                onClick={() => setComparisonMode(false)}
                aria-label="Close revision comparison"
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textTertiary }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceInset; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <X size={16} />
              </button>
            </div>
            {/* Opacity slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['3'], flexShrink: 0, padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base }}>
              <label htmlFor="compare-opacity-slider" style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, whiteSpace: 'nowrap', fontWeight: typography.fontWeight.medium }}>
                Right panel opacity
              </label>
              <input
                id="compare-opacity-slider"
                type="range"
                min={0}
                max={100}
                value={compareOpacity}
                onChange={(e) => setCompareOpacity(Number(e.target.value))}
                style={{ flex: 1, accentColor: colors.primaryOrange }}
                aria-label="Right panel opacity for overlay comparison"
              />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, minWidth: 36, textAlign: 'right' }}>
                {compareOpacity}%
              </span>
            </div>
            {/* Side-by-side viewers */}
            <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
              {[
                { rev: selectedRevisions[0], label: 'Older Revision', badge: 'A', badgeColor: colors.statusInfo, opacity: 1 },
                { rev: selectedRevisions[1], label: 'Current Revision', badge: 'B', badgeColor: colors.primaryOrange, opacity: compareOpacity / 100 },
              ].map(({ rev, label, badge, badgeColor, opacity }) => (
                <div key={rev.id} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, opacity }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'], flexShrink: 0 }}>
                    <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.white, backgroundColor: badgeColor, padding: '2px 8px', borderRadius: borderRadius.full }}>
                      {badge}
                    </span>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                      Rev {rev.revision_number} — {label}
                    </span>
                    {rev.issued_by && (
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{rev.issued_by}</span>
                    )}
                  </div>
                  {rev.file_url ? (
                    <iframe
                      src={rev.file_url}
                      title={`Rev ${rev.revision_number} — ${compareDrawingTitle}`}
                      style={{ flex: 1, border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, width: '100%' }}
                    />
                  ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}` }}>
                      <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>No PDF available for this revision</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Upload Drawings Modal */}
      {showUploadModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Upload drawings"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 22, 41, 0.55)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowUploadModal(false); setUploadFiles([]); setIsDragging(false); } }}
        >
          <div
            style={{
              backgroundColor: colors.surfaceRaised,
              borderRadius: borderRadius.lg,
              border: `1px solid ${colors.borderSubtle}`,
              padding: spacing['6'],
              width: '100%',
              maxWidth: 520,
              boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['5'] }}>
              <h2 style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
                Upload Drawings
              </h2>
              <button
                onClick={() => { setShowUploadModal(false); setUploadFiles([]); setIsDragging(false); }}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textTertiary }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceInset; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                aria-label="Close upload modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Upload Zone */}
            <UploadZone
              onUpload={() => {}}
              onFileReady={handleFileReady}
            />

            {/* Discipline selector */}
            <div style={{ marginTop: spacing['4'] }}>
              <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>
                Discipline
              </p>
              <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap' }}>
                {['Architectural', 'Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire Protection', 'Civil'].map((disc) => (
                  <button
                    key={disc}
                    onClick={() => setUploadDiscipline(disc)}
                    style={{
                      padding: `${spacing['1']} ${spacing['3']}`,
                      fontSize: typography.fontSize.sm,
                      fontFamily: typography.fontFamily,
                      fontWeight: typography.fontWeight.medium,
                      border: `1.5px solid ${uploadDiscipline === disc ? colors.primaryOrange : colors.borderDefault}`,
                      borderRadius: borderRadius.full,
                      backgroundColor: uploadDiscipline === disc ? `${colors.primaryOrange}12` : 'transparent',
                      color: uploadDiscipline === disc ? colors.primaryOrange : colors.textSecondary,
                      cursor: 'pointer',
                      transition: `all ${transitions.instant}`,
                    }}
                  >
                    {disc}
                  </button>
                ))}
              </div>
            </div>

            {/* Upload progress indicator */}
            {(isUploading || uploadProgressText) && (
              <div style={{ marginTop: spacing['4'], padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: `${colors.primaryOrange}0D`, border: `1px solid ${colors.primaryOrange}30`, borderRadius: borderRadius.base, display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <Loader2 size={14} color={colors.primaryOrange} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                <p style={{ fontSize: typography.fontSize.sm, color: colors.orangeText, margin: 0 }}>
                  {uploadProgressText}
                </p>
              </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'], marginTop: spacing['5'] }}>
              <Btn variant="secondary" size="md" onClick={() => { setShowUploadModal(false); setUploadFiles([]); setIsDragging(false); setPendingFiles([]); }}>
                Cancel
              </Btn>
              <Btn
                variant="primary"
                size="md"
                icon={<Upload size={16} />}
                aria-label="Upload drawings"
                disabled={pendingFiles.length === 0 || isUploading}
                onClick={handleUploadDrawings}
              >
                {isUploading ? 'Uploading...' : `Upload${pendingFiles.length > 0 ? ` (${pendingFiles.length})` : ''}`}
              </Btn>
            </div>
          </div>
        </div>
      )}
      {/* Upload New Revision Modal */}
      {showRevUploadModal && selectedDrawing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Upload revision for ${selectedDrawing.title}`}
          style={{ position: 'fixed', inset: 0, zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 22, 41, 0.55)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowRevUploadModal(false); }}
        >
          <div
            style={{ backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg, border: `1px solid ${colors.borderSubtle}`, padding: spacing['6'], width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['5'] }}>
              <div>
                <h2 style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
                  Upload New Revision
                </h2>
                <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginTop: 2 }}>
                  {selectedDrawing.setNumber} — {selectedDrawing.title}
                </p>
              </div>
              <button
                onClick={() => setShowRevUploadModal(false)}
                aria-label="Close upload revision modal"
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textTertiary }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceInset; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
              {/* Revision number */}
              <div>
                <label htmlFor="rev-upload-num" style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                  Revision Number
                </label>
                <input
                  id="rev-upload-num"
                  type="number"
                  min={1}
                  value={revUploadNum}
                  onChange={(e) => setRevUploadNum(e.target.value)}
                  style={{ width: '100%', padding: `${spacing['2']} ${spacing['3']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary, backgroundColor: colors.surfaceRaised, boxSizing: 'border-box' }}
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="rev-upload-desc" style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                  Change Description
                </label>
                <textarea
                  id="rev-upload-desc"
                  value={revUploadDesc}
                  onChange={(e) => setRevUploadDesc(e.target.value)}
                  placeholder="What changed in this revision?"
                  rows={3}
                  style={{ width: '100%', padding: `${spacing['2']} ${spacing['3']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary, backgroundColor: colors.surfaceRaised, resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              {/* File input */}
              <div>
                <label htmlFor="rev-upload-file" style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                  Drawing File
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.normal, marginLeft: spacing['2'] }}>
                    .pdf, .dwg, .dxf
                  </span>
                </label>
                <label
                  htmlFor="rev-upload-file"
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: spacing['2'], padding: `${spacing['4']} ${spacing['3']}`,
                    border: `1.5px dashed ${revUploadFile ? colors.primaryOrange : colors.borderDefault}`,
                    borderRadius: borderRadius.md, cursor: 'pointer',
                    backgroundColor: revUploadFile ? `${colors.primaryOrange}06` : colors.surfaceInset,
                    transition: `all ${transitions.quick}`,
                  }}
                >
                  <Upload size={20} color={revUploadFile ? colors.primaryOrange : colors.textTertiary} />
                  <span style={{ fontSize: typography.fontSize.sm, color: revUploadFile ? colors.primaryOrange : colors.textTertiary, fontWeight: typography.fontWeight.medium, textAlign: 'center' }}>
                    {revUploadFile ? revUploadFile.name : 'Click to select or drag a file'}
                  </span>
                  {revUploadFile && (
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                      {(revUploadFile.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  )}
                </label>
                <input
                  id="rev-upload-file"
                  type="file"
                  accept=".pdf,.dwg,.dxf"
                  style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                  onChange={(e) => { if (e.target.files?.[0]) setRevUploadFile(e.target.files[0]); }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'], marginTop: spacing['5'] }}>
              <Btn variant="secondary" size="md" onClick={() => setShowRevUploadModal(false)}>
                Cancel
              </Btn>
              <Btn
                variant="primary"
                size="md"
                icon={isRevUploading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={16} />}
                disabled={!revUploadNum || isRevUploading}
                onClick={handleUploadRevision}
              >
                {isRevUploading ? 'Uploading...' : `Upload Rev ${revUploadNum}`}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* AI Insights right sidebar */}
      {showAiPanel && (
        <div
          role="complementary"
          aria-label="AI coordination insights"
          style={{
            position: 'fixed',
            right: 0,
            top: 64,
            bottom: 0,
            width: 320,
            backgroundColor: colors.surfaceRaised,
            borderLeft: `1px solid ${colors.borderSubtle}`,
            boxShadow: shadows.panel,
            zIndex: zIndex.sticky,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'slideInRight 0.22s cubic-bezier(0.32,0.72,0,1)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['4']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, flexShrink: 0 }}>
            <Sparkles size={16} color={colors.statusReview} />
            <span style={{ flex: 1, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              AI Insights
            </span>
            <button
              onClick={() => setShowAiPanel(false)}
              aria-label="Close AI insights panel"
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.base, cursor: 'pointer', color: colors.textTertiary }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: spacing['4'], display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
            <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
              Detected Conflicts
            </p>

            {aiPanelLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['3']} 0` }}>
                <Loader2 size={16} color={colors.statusReview} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Analyzing...</span>
              </div>
            ) : aiPanelError ? (
              <div style={{ padding: spacing['3'], backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.base, border: `1px solid ${colors.statusCritical}30` }}>
                <p style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical, margin: 0 }}>{aiPanelError}</p>
              </div>
            ) : !aiPanelAnalyzed ? (
              <div style={{ padding: `${spacing['5']} ${spacing['3']}`, textAlign: 'center' }}>
                <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, lineHeight: typography.lineHeight.normal }}>
                  Select a drawing and click Analyze to detect coordination conflicts.
                </p>
              </div>
            ) : aiPanelConflicts.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['3']} 0` }}>
                <CheckCircle2 size={16} color={colors.statusActive} />
                <p style={{ fontSize: typography.fontSize.sm, color: colors.statusActive, margin: 0 }}>No conflicts detected.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                {aiPanelConflicts.map((conflict, i) => {
                  const severityColor =
                    conflict.severity === 'high' ? colors.statusCritical :
                    conflict.severity === 'medium' ? colors.statusPending :
                    colors.statusInfo;
                  const severityBg =
                    conflict.severity === 'high' ? colors.statusCriticalSubtle :
                    conflict.severity === 'medium' ? colors.statusPendingSubtle :
                    colors.statusInfoSubtle;
                  return (
                    <div
                      key={i}
                      style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base, border: `1px solid ${colors.borderSubtle}` }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
                        <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: severityColor, backgroundColor: severityBg, padding: '2px 8px', borderRadius: borderRadius.full }}>
                          {conflict.severity.charAt(0).toUpperCase() + conflict.severity.slice(1)}
                        </span>
                        {conflict.sheets.length > 0 && (
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                            {conflict.sheets.join(', ')}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.normal }}>
                        {conflict.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer with Analyze button */}
          <div style={{ padding: spacing['4'], borderTop: `1px solid ${colors.borderSubtle}`, flexShrink: 0 }}>
            <PermissionGate permission="ai.use">
            <Btn
              variant="primary"
              size="md"
              fullWidth
              icon={<Sparkles size={14} />}
              onClick={handleAiAnalyze}
              disabled={!selectedDrawing || aiPanelLoading}
              aria-label="Analyze drawing for coordination conflicts"
            >
              {aiPanelLoading ? 'Analyzing...' : 'Analyze Drawing'}
            </Btn>
            </PermissionGate>
            {!selectedDrawing && (
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: spacing['2'], textAlign: 'center' }}>
                Select a drawing from the list first.
              </p>
            )}
          </div>
        </div>
      )}

      <ReportGenerationModal
        open={showReportModal}
        projectName="Project Drawings"
        drawings={reportDrawings}
        onClose={() => setShowReportModal(false)}
        onGenerate={handleGenerateReport}
      />

      {showPipeline && projectId && (
        <ProcessingPipeline
          projectId={projectId}
          state={pipelineState}
          floating
          onClose={() => setShowPipeline(false)}
        />
      )}
    </PageContainer>
  );
};

export const Drawings: React.FC = () => (
  <ErrorBoundary message="Failed to load drawings. Retry">
    <DrawingsPage />
  </ErrorBoundary>
);
