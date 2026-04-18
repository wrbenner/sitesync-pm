import React, { useState, useRef, useCallback } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { Upload, Sparkles, ScanSearch } from 'lucide-react';
import { aiService } from '../../lib/aiService';
import type { DrawingAnalysis } from '../../types/ai';
import type { DrawingRevision } from '../../types/api';
import { PageContainer, Btn, useToast } from '../../components/Primitives';
import { colors, spacing } from '../../styles/theme';
import { getDrawings, getDrawingRevisionHistory } from '../../api/endpoints/documents';
import { useQuery } from '../../hooks/useQuery';
import { useProjectId } from '../../hooks/useProjectId';
import { DrawingViewer } from '../../components/drawings/DrawingViewer';
import { PdfViewer } from '../../components/drawings/PdfViewer';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { supabase } from '../../lib/supabase';
import { drawingService } from '../../services/drawingService';
import { parseAiConflicts } from './types';
import { DrawingList } from './DrawingList';
import { DrawingDetail } from './DrawingDetail';
import { DrawingUpload, RevisionUpload } from './DrawingUpload';
import { VersionCompareModal, ComparisonModal } from './DrawingVersions';
import { AiInsightsPanel } from './AiInsightsPanel';
import { RevisionOverlay } from '../../components/drawings/RevisionOverlay';
import { AnnotationListPanel } from '../../components/drawings/AnnotationListPanel';
import { useAIAnnotationStore } from '../../stores';
import { useDrawingProcessing } from '../../hooks/useDrawingProcessing';
import {
  useDrawingIntelligence,
  useDiscrepanciesForDrawing,
} from '../../hooks/useDrawingIntelligence';
import { ClashDetectionPanel } from '../../components/drawings/ClashDetectionPanel';
import { AnalysisProgress } from '../../components/drawings/AnalysisProgress';
import { useLogCorrection } from '../../hooks/useAITrainingCorrections';
import type { DrawingClassification, DrawingDiscipline } from '../../types/ai';

interface DrawingItem {
  id: number;
  title: string;
  setNumber: string;
  discipline: string;
  disciplineColor?: string;
  revision: string;
  date: string;
  status?: string;
  sheetCount?: number;
  currentRevision?: { revision_number: number; issued_date: string | null; issued_by?: string };
  revisions: DrawingRevision[];
}

const DISCIPLINE_BADGE_COLOR: Record<DrawingDiscipline, string> = {
  architectural: '#3B82F6',
  structural: '#E74C3C',
  mechanical: '#F47820',
  electrical: '#F5A623',
  plumbing: '#4EC896',
  mep: '#8B5CF6',
  civil: '#10B981',
  interior_design: '#DB2777',
  unclassified: '#6B7280',
};

const DISCIPLINE_LABEL: Record<DrawingDiscipline, string> = {
  architectural: 'Architectural',
  structural: 'Structural',
  mechanical: 'Mechanical',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  mep: 'MEP',
  civil: 'Civil',
  interior_design: 'Interior',
  unclassified: 'Unclassified',
};

const DISCIPLINE_OPTIONS: DrawingDiscipline[] = [
  'architectural',
  'structural',
  'mechanical',
  'electrical',
  'plumbing',
  'mep',
  'civil',
  'interior_design',
  'unclassified',
];

const PLAN_TYPE_OPTIONS = [
  'floor_plan',
  'foundation',
  'framing',
  'roof',
  'elevation',
  'section',
  'detail',
  'schedule',
  'site',
] as const;

const ClassificationBadge: React.FC<{
  classification: DrawingClassification | null;
  status: string | null;
  classifying: boolean;
  drawingId?: string | number | null;
  projectId?: string | null;
}> = ({ classification, status, classifying, drawingId, projectId }) => {
  const [editOpen, setEditOpen] = useState(false);
  const logCorrection = useLogCorrection();
  if (classifying || status === 'processing' || status === 'pending') {
    return (
      <div
        aria-live="polite"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: spacing.md,
          marginBottom: spacing.md,
          borderRadius: 8,
          backgroundColor: `${colors.primaryOrange}14`,
          border: `1px solid ${colors.primaryOrange}55`,
          color: colors.textPrimary,
          fontSize: 13,
        }}
      >
        <Sparkles size={16} color={colors.primaryOrange} />
        <span>AI classification in progress…</span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div
        style={{
          padding: spacing.md,
          marginBottom: spacing.md,
          borderRadius: 8,
          backgroundColor: '#F443361A',
          border: '1px solid #F4433655',
          color: colors.textPrimary,
          fontSize: 13,
        }}
      >
        AI classification failed. Re-upload to retry.
      </div>
    );
  }

  if (!classification) {
    return null;
  }

  const discipline = (classification.discipline ?? 'unclassified') as DrawingDiscipline;
  const color = DISCIPLINE_BADGE_COLOR[discipline] ?? DISCIPLINE_BADGE_COLOR.unclassified;
  const label = DISCIPLINE_LABEL[discipline] ?? DISCIPLINE_LABEL.unclassified;
  const planType = classification.plan_type ?? null;
  const scaleText = classification.scale_text ?? null;

  return (
    <div
      style={{
        padding: spacing.md,
        marginBottom: spacing.md,
        borderRadius: 8,
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            backgroundColor: `${color}22`,
            color,
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          <Sparkles size={12} />
          {label}
        </span>
        {planType && (
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              backgroundColor: colors.surfacePage,
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: 500,
              textTransform: 'capitalize',
            }}
          >
            {planType}
          </span>
        )}
        {scaleText && (
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              backgroundColor: colors.surfacePage,
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Scale {scaleText}
          </span>
        )}
      </div>
      {classification.drawing_title && (
        <div style={{ fontSize: 12, color: colors.textSecondary }}>
          {classification.drawing_title}
        </div>
      )}
      {classification.id && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setEditOpen((v) => !v)}
            aria-label="Correct AI classification"
            style={{
              minHeight: 56,
              padding: '6px 12px',
              borderRadius: 6,
              backgroundColor: 'transparent',
              border: `1px solid ${colors.borderSubtle}`,
              color: colors.textSecondary,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {editOpen ? 'Cancel' : 'Correct classification'}
          </button>
          {logCorrection.isPending && (
            <span style={{ fontSize: 11, color: colors.textTertiary }}>Saving…</span>
          )}
          {logCorrection.isSuccess && !editOpen && (
            <span style={{ fontSize: 11, color: colors.statusActive }}>Correction logged</span>
          )}
        </div>
      )}
      {editOpen && classification.id && (
        <div
          style={{
            marginTop: 8,
            padding: 12,
            backgroundColor: colors.surfacePage,
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <label style={{ fontSize: 11, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Discipline
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {DISCIPLINE_OPTIONS.map((disc) => (
              <button
                key={disc}
                type="button"
                aria-label={`Set discipline to ${disc}`}
                onClick={() => {
                  logCorrection.mutate({
                    correctionType: 'classification',
                    projectId: projectId ?? null,
                    drawingId: drawingId != null ? String(drawingId) : null,
                    sourceTable: 'drawing_classifications',
                    sourceRecordId: classification.id,
                    originalValue: {
                      discipline: classification.discipline,
                      plan_type: classification.plan_type,
                    },
                    correctedValue: { discipline: disc },
                  });
                  setEditOpen(false);
                }}
                style={{
                  minHeight: 56,
                  padding: '6px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: disc === discipline ? 600 : 400,
                  border: `1px solid ${disc === discipline ? colors.primaryOrange : colors.borderSubtle}`,
                  backgroundColor: disc === discipline ? `${colors.primaryOrange}22` : 'transparent',
                  color: colors.textPrimary,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {DISCIPLINE_LABEL[disc]}
              </button>
            ))}
          </div>
          <label style={{ fontSize: 11, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Plan type
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PLAN_TYPE_OPTIONS.map((pt) => (
              <button
                key={pt}
                type="button"
                aria-label={`Set plan type to ${pt}`}
                onClick={() => {
                  logCorrection.mutate({
                    correctionType: 'classification',
                    projectId: projectId ?? null,
                    drawingId: drawingId != null ? String(drawingId) : null,
                    sourceTable: 'drawing_classifications',
                    sourceRecordId: classification.id,
                    originalValue: {
                      discipline: classification.discipline,
                      plan_type: classification.plan_type,
                    },
                    correctedValue: { plan_type: pt },
                  });
                  setEditOpen(false);
                }}
                style={{
                  minHeight: 56,
                  padding: '6px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: pt === planType ? 600 : 400,
                  border: `1px solid ${pt === planType ? colors.primaryOrange : colors.borderSubtle}`,
                  backgroundColor: pt === planType ? `${colors.primaryOrange}22` : 'transparent',
                  color: colors.textPrimary,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {pt.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const DrawingsPage: React.FC = () => {
  const { addToast } = useToast();
  const projectId = useProjectId();
  const { data: drawings, loading, error, refetch } = useQuery(`drawings-${projectId}`, () => getDrawings(projectId!), { enabled: !!projectId });

  // ── Filter & sort ──────────────────────────────────────────
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<string>('setNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ── Selected drawing ───────────────────────────────────────
  const [selectedDrawing, setSelectedDrawing] = useState<DrawingItem | null>(null);
  const [viewerDrawing, setViewerDrawing] = useState<DrawingItem | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const sortedDrawingsRef = useRef<DrawingItem[]>([]);

  // ── Revision state ─────────────────────────────────────────
  const [viewingRevisionNum, setViewingRevisionNum] = useState<number | null>(null);
  const [showVersionCompare, setShowVersionCompare] = useState(false);
  const [compareRevAIdx, setCompareRevAIdx] = useState(0);
  const [compareRevBIdx, setCompareRevBIdx] = useState(1);
  const [viewRevPdfUrl, setViewRevPdfUrl] = useState<string | null>(null);
  const [openRevDropdownId, setOpenRevDropdownId] = useState<string | null>(null);
  const [rowRevHistory, setRowRevHistory] = useState<Record<string, DrawingRevision[]>>({});
  const [rowRevHistoryLoading, setRowRevHistoryLoading] = useState<string | null>(null);
  const [selectedRevisions, setSelectedRevisions] = useState<DrawingRevision[]>([]);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [compareOpacity, setCompareOpacity] = useState(100);
  const [compareDrawingTitle, setCompareDrawingTitle] = useState('');

  // ── AI state ───────────────────────────────────────────────
  const [showConflicts, setShowConflicts] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<number, DrawingAnalysis>>({});
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPanelLoading, setAiPanelLoading] = useState(false);
  const [aiPanelConflicts, setAiPanelConflicts] = useState<Array<{ severity: 'high' | 'medium' | 'low'; description: string; sheets: string[] }>>([]);
  const [aiPanelError, setAiPanelError] = useState<string | null>(null);
  const [aiPanelAnalyzed, setAiPanelAnalyzed] = useState(false);

  // ── Annotation engine state ────────────────────────────────
  const [showRevisionOverlay, setShowRevisionOverlay] = useState(false);
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false);
  const annotationsStore = useAIAnnotationStore();

  // ── AI classification pipeline ─────────────────────────────
  const processing = useDrawingProcessing(projectId);
  const classifyMutation = processing.classify;

  // ── Drawing intelligence (Phase 3: clash detection) ───────
  const intelligence = useDrawingIntelligence(projectId ?? undefined);
  const { data: drawingDiscrepancies = [], isLoading: discrepanciesLoading } =
    useDiscrepanciesForDrawing(
      selectedDrawing ? String(selectedDrawing.id) : undefined,
      projectId ?? undefined,
    );
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);

  const handleAnalyzeDrawingSet = useCallback(async () => {
    if (!projectId) return;
    setShowAnalysisPanel(true);
    try {
      await intelligence.analyzeDrawingSet();
      addToast('success', `Analysis complete — ${intelligence.state.discrepancyCount} discrepancies detected`);
    } catch {
      addToast('error', 'Drawing analysis failed.');
    }
  }, [projectId, intelligence, addToast]);

  const handleCreateRFIFromDiscrepancy = useCallback(() => {
    addToast('info', 'A draft RFI will be created from this discrepancy. Open RFIs to edit.');
  }, [addToast]);

  const triggerClassification = useCallback(
    async (drawingId: string, pageImageUrl: string) => {
      if (!projectId) return;
      try {
        await classifyMutation.mutateAsync({ projectId, drawingId, pageImageUrl });
      } catch {
        addToast('error', 'AI classification failed. The drawing is still uploaded.');
      }
    },
    [projectId, classifyMutation, addToast],
  );

  const handleCreateRFIFromAnnotation = useCallback(() => {
    if (!selectedDrawing) {
      addToast('error', 'Select a drawing first to create an RFI from annotations.');
      return;
    }
    addToast('info', `RFI draft prefilled from ${selectedDrawing.setNumber}. Open the RFIs page to finish.`);
  }, [selectedDrawing, addToast]);

  // ── Upload state ───────────────────────────────────────────
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDiscipline, setUploadDiscipline] = useState('Architectural');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pageIsDragging, setPageIsDragging] = useState(false);
  const [showRevUploadModal, setShowRevUploadModal] = useState(false);
  const [revUploadFile, setRevUploadFile] = useState<File | null>(null);
  const [revUploadNum, setRevUploadNum] = useState('');
  const [revUploadDesc, setRevUploadDesc] = useState('');
  const [isRevUploading, setIsRevUploading] = useState(false);

  // ── Revision history for detail panel ─────────────────────
  const { data: revisionHistory } = useQuery(
    `revision-history-${selectedDrawing?.id ?? 'none'}`,
    () => getDrawingRevisionHistory(String(selectedDrawing!.id)),
    { enabled: !!selectedDrawing?.id },
  );

  React.useEffect(() => {
    setViewingRevisionNum(null);
    setShowVersionCompare(false);
    setCompareRevAIdx(0);
    setCompareRevBIdx(1);
    setViewRevPdfUrl(null);
  }, [selectedDrawing?.id]);

  const allDrawings = drawings || [];
  const filteredDrawings = activeFilters.size === 0 ? allDrawings : allDrawings.filter((d) => activeFilters.has(d.discipline));

  const handleSort = useCallback((field: string) => {
    setSortField((prev) => {
      if (prev === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
      else { setSortDir('asc'); }
      return field;
    });
  }, []);

  const sortedDrawings = [...filteredDrawings].sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[sortField];
    const bVal = (b as Record<string, unknown>)[sortField];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === 'string' && typeof bVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });
  sortedDrawingsRef.current = sortedDrawings;

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

  const handleAnalyzeSheet = useCallback(async (e: React.MouseEvent, drawing: DrawingItem) => {
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
  }, [addToast]);

  const handleAiAnalyze = useCallback(async () => {
    if (!selectedDrawing || !projectId) return;
    setAiPanelLoading(true);
    setAiPanelError(null);
    setAiPanelConflicts([]);
    setAiPanelAnalyzed(false);
    try {
      const sheetNumber = selectedDrawing.setNumber || selectedDrawing.title;
      const { data, error: fnError } = await supabase.functions.invoke('ai-copilot', {
        body: { project_id: projectId, message: `Analyze drawing ${sheetNumber} for coordination conflicts with other disciplines`, context: { entity_type: 'drawing', entity_id: String(selectedDrawing.id) } },
      });
      if (fnError) throw fnError;
      const responseText: string = data?.response ?? data?.message ?? (typeof data === 'string' ? data : JSON.stringify(data));
      setAiPanelConflicts(parseAiConflicts(responseText));
      setAiPanelAnalyzed(true);
    } catch {
      setAiPanelError('AI analysis unavailable. Ensure the AI service is configured in project settings.');
    } finally {
      setAiPanelLoading(false);
    }
  }, [selectedDrawing, projectId]);

  const handleFileReady = useCallback((file: File) => {
    setPendingFiles((prev) => [...prev, file]);
  }, []);

  const handleUploadDrawings = async () => {
    if (!projectId || pendingFiles.length === 0) return;
    setIsUploading(true);
    let completed = 0;
    const total = pendingFiles.length;
    const classificationTargets: Array<{ drawingId: string; pageImageUrl: string }> = [];
    for (const file of pendingFiles) {
      setUploadProgressText(`Uploading sheet ${completed + 1} of ${total}...`);
      const titleNoExt = file.name.replace(/\.[^.]+$/, '');
      const sheetMatch = titleNoExt.match(/^([A-Z]{1,3}-?\d+)/i);
      const sheetNumber = sheetMatch ? sheetMatch[1].toUpperCase() : titleNoExt.substring(0, 20);
      const storagePath = `${projectId}/drawings/${Date.now()}-${file.name}`;
      let fileUrl = storagePath;
      let publicUrl: string | null = null;
      try {
        const { data: storageData } = await supabase.storage.from('drawings').upload(storagePath, file);
        if (storageData?.path) {
          fileUrl = storageData.path;
          const { data: urlData } = supabase.storage.from('drawings').getPublicUrl(storageData.path);
          publicUrl = urlData?.publicUrl ?? null;
        }
      } catch { /* storage upload failed */ }
      const created = await drawingService.createDrawing({ project_id: projectId, title: titleNoExt, discipline: uploadDiscipline, sheet_number: sheetNumber, revision: '1', file_url: fileUrl });
      const createdId = created.data?.id;
      if (createdId && publicUrl) {
        classificationTargets.push({ drawingId: createdId, pageImageUrl: publicUrl });
      }
      completed++;
    }
    setIsUploading(false);
    setUploadProgressText('');
    setPendingFiles([]);
    setShowUploadModal(false);
    setUploadDiscipline('Architectural');
    refetch();
    addToast('success', `${completed} drawing${completed !== 1 ? 's' : ''} uploaded successfully.`);
    if (classificationTargets.length > 0) {
      addToast('info', 'AI classification started in the background.');
      void Promise.all(
        classificationTargets.map((t) => triggerClassification(t.drawingId, t.pageImageUrl)),
      );
    }
  };

  const handleUploadRevision = async () => {
    if (!projectId || !selectedDrawing || !revUploadNum) return;
    setIsRevUploading(true);
    let fileUrl: string | null = null;
    if (revUploadFile) {
      const path = `${projectId}/drawings/rev-${Date.now()}-${revUploadFile.name}`;
      try {
        const { data: storageData } = await supabase.storage.from('drawings').upload(path, revUploadFile);
        if (storageData?.path) fileUrl = storageData.path;
      } catch { /* storage upload failed */ }
    }
    await supabase.from('drawing_revisions').update({ superseded_at: new Date().toISOString() }).eq('drawing_id', String(selectedDrawing.id)).is('superseded_at', null);
    await supabase.from('drawing_revisions').insert({ drawing_id: String(selectedDrawing.id), revision_number: Number(revUploadNum), issued_date: new Date().toISOString().slice(0, 10), change_description: revUploadDesc || null, file_url: fileUrl });
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
    if (openRevDropdownId === drawingId) { setOpenRevDropdownId(null); return; }
    setOpenRevDropdownId(drawingId);
    if (!rowRevHistory[drawingId]) {
      if (fallbackRevisions.length > 0) {
        setRowRevHistory((prev) => ({ ...prev, [drawingId]: fallbackRevisions }));
      } else {
        setRowRevHistoryLoading(drawingId);
        try {
          const history = await getDrawingRevisionHistory(drawingId);
          setRowRevHistory((prev) => ({ ...prev, [drawingId]: history }));
        } catch { /* keep dropdown open with empty state */ } finally {
          setRowRevHistoryLoading(null);
        }
      }
    }
    setCompareDrawingTitle(drawingTitle);
  }, [openRevDropdownId, rowRevHistory]);

  const handlePageDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const hasFile = Array.from(e.dataTransfer.items).some((item) => item.kind === 'file');
    if (hasFile) setPageIsDragging(true);
  }, []);

  const handlePageDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setPageIsDragging(false);
  }, []);

  const handlePageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setPageIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => /\.(pdf|dwg|dxf)$/i.test(f.name));
    if (files.length > 0) { setPendingFiles(files); setShowUploadModal(true); }
  }, []);

  return (
    <PageContainer
      title="Drawings"
      actions={
        <>
          <Btn
            variant="secondary"
            size="md"
            aria-label="View annotations"
            onClick={() => setShowAnnotationPanel(true)}
          >
            Annotations
          </Btn>
          <Btn
            variant="secondary"
            size="md"
            aria-label="Open revision overlay"
            disabled={!selectedDrawing || !revisionHistory || revisionHistory.length < 2}
            onClick={() => setShowRevisionOverlay(true)}
          >
            Revision Overlay
          </Btn>
          <Btn variant="secondary" size="md" icon={<Sparkles size={16} />} aria-label="Toggle AI insights panel" aria-pressed={showAiPanel} onClick={() => setShowAiPanel((v) => !v)}>
            AI Insights
          </Btn>
          <PermissionGate permission="drawings.upload">
            <Btn
              variant="secondary"
              size="md"
              icon={<ScanSearch size={16} />}
              aria-label="Analyze drawing set for clashes"
              disabled={intelligence.state.stage !== 'idle' && intelligence.state.stage !== 'complete' && intelligence.state.stage !== 'failed'}
              onClick={handleAnalyzeDrawingSet}
            >
              Analyze Drawing Set
            </Btn>
          </PermissionGate>
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
        @media(min-width:769px){.drawing-row-mobile{display:none!important;}}
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
          <div style={{ position: 'absolute', inset: 0, zIndex: 50, backgroundColor: `${colors.primaryOrange}10`, border: `2px dashed ${colors.primaryOrange}`, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: spacing['3'], pointerEvents: 'none' }}>
            <Upload size={48} color={colors.primaryOrange} />
            <p style={{ fontSize: 20, fontWeight: 600, color: colors.primaryOrange, margin: 0 }}>Drop drawings here</p>
            <p style={{ fontSize: 14, color: colors.primaryOrange, margin: 0, opacity: 0.7 }}>.pdf, .dwg, .dxf files accepted</p>
          </div>
        )}
        <div className="drawings-layout" style={{ display: 'grid', gridTemplateColumns: selectedDrawing ? '1fr 380px' : '1fr', gap: spacing.xl }}>
          <DrawingList
            drawings={sortedDrawings}
            loading={loading}
            error={error}
            refetch={refetch}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
            activeFilters={activeFilters}
            setActiveFilters={setActiveFilters}
            allDrawings={allDrawings}
            focusedIndex={focusedIndex}
            setFocusedIndex={setFocusedIndex}
            gridRef={gridRef}
            onSelectDrawing={setSelectedDrawing}
            onViewDrawing={setViewerDrawing}
            analyzingId={analyzingId}
            analysisResults={analysisResults}
            onAnalyzeSheet={handleAnalyzeSheet}
            openRevDropdownId={openRevDropdownId}
            rowRevHistory={rowRevHistory}
            rowRevHistoryLoading={rowRevHistoryLoading}
            onRevDropdown={handleRevDropdown}
            setOpenRevDropdownId={setOpenRevDropdownId}
            setViewRevPdfUrl={setViewRevPdfUrl}
            setViewingRevisionNum={setViewingRevisionNum}
            setViewerDrawing={setViewerDrawing}
            setSelectedRevisions={setSelectedRevisions}
            setComparisonMode={setComparisonMode}
            setShowUploadModal={setShowUploadModal}
            showConflicts={showConflicts}
            setShowConflicts={setShowConflicts}
            handleGridKeyDown={handleGridKeyDown}
          />

          {selectedDrawing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              <ClassificationBadge
                classification={processing.byDrawing(String(selectedDrawing.id))}
                status={processing.statusByDrawing(String(selectedDrawing.id))}
                classifying={classifyMutation.isPending}
                drawingId={selectedDrawing.id}
                projectId={projectId}
              />
              {projectId && drawingDiscrepancies.length > 0 && (
                <ClashDetectionPanel
                  projectId={projectId}
                  drawingId={String(selectedDrawing.id)}
                  discrepancies={drawingDiscrepancies}
                  loading={discrepanciesLoading}
                  onCreateRFI={handleCreateRFIFromDiscrepancy}
                />
              )}
              <DrawingDetail
              drawing={selectedDrawing}
              revisionHistory={revisionHistory}
              viewingRevisionNum={viewingRevisionNum}
              onClose={() => setSelectedDrawing(null)}
              onOpenViewer={() => setViewerDrawing(selectedDrawing)}
              onAiScan={() => addToast('info', 'AI Scan initiated for ' + selectedDrawing.setNumber)}
              onUploadRevision={() => {
                const nextRev = revisionHistory && revisionHistory.length > 0 ? String(revisionHistory[0].revision_number + 1) : '1';
                setRevUploadNum(nextRev);
                setRevUploadFile(null);
                setRevUploadDesc('');
                setShowRevUploadModal(true);
              }}
              onViewRevision={(rev) => {
                if (rev.file_url) { setViewRevPdfUrl(rev.file_url); }
                else {
                  const isCurrent = !rev.superseded_at;
                  setViewingRevisionNum(isCurrent ? null : rev.revision_number);
                  if (!isCurrent) setViewerDrawing({ ...selectedDrawing, revision: `Rev ${rev.revision_number}` });
                }
              }}
              onCompareVersions={() => setShowVersionCompare(true)}
              setViewingRevisionNum={setViewingRevisionNum}
            />
            </div>
          )}
        </div>
      </div>

      {/* Viewers and modals */}
      {viewerDrawing && (
        <DrawingViewer
          drawing={viewerDrawing}
          onClose={() => setViewerDrawing(null)}
          onCreateRFI={handleCreateRFIFromAnnotation}
        />
      )}

      {showRevisionOverlay && selectedDrawing && revisionHistory && revisionHistory.length >= 2 && (
        <div
          role="dialog"
          aria-label="Revision overlay"
          style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: colors.overlayBackdrop, padding: spacing.lg, overflowY: 'auto' }}
        >
          <div style={{ maxWidth: 1400, margin: '0 auto', backgroundColor: colors.surfacePage, borderRadius: 12, padding: spacing.md }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <h2 style={{ margin: 0, color: colors.textPrimary, fontSize: 20 }}>
                Revision Overlay — {selectedDrawing.setNumber}
              </h2>
              <Btn variant="secondary" size="md" onClick={() => setShowRevisionOverlay(false)} aria-label="Close revision overlay">Close</Btn>
            </div>
            <RevisionOverlay
              oldRevisionUrl={revisionHistory[1]?.file_url || null}
              newRevisionUrl={revisionHistory[0]?.file_url || null}
              oldLabel={`Rev ${revisionHistory[1]?.revision_number ?? 'old'}`}
              newLabel={`Rev ${revisionHistory[0]?.revision_number ?? 'new'}`}
            />
          </div>
        </div>
      )}

      <AnnotationListPanel
        open={showAnnotationPanel}
        annotations={annotationsStore.annotations}
        selectedId={annotationsStore.selectedAnnotationId}
        onClose={() => setShowAnnotationPanel(false)}
        onSelect={annotationsStore.selectAnnotation}
        onDelete={annotationsStore.deleteAnnotation}
        loading={annotationsStore.isLoading}
        error={annotationsStore.error}
      />

      {viewRevPdfUrl && (
        <PdfViewer
          file={viewRevPdfUrl}
          title={`${selectedDrawing?.title ?? 'Drawing'} — Rev ${viewingRevisionNum ?? 'Current'}`}
          onClose={() => setViewRevPdfUrl(null)}
        />
      )}

      {showVersionCompare && selectedDrawing && revisionHistory && revisionHistory.length >= 2 && (
        <VersionCompareModal
          drawing={selectedDrawing}
          revisionHistory={revisionHistory}
          compareRevAIdx={compareRevAIdx}
          compareRevBIdx={compareRevBIdx}
          setCompareRevAIdx={setCompareRevAIdx}
          setCompareRevBIdx={setCompareRevBIdx}
          onClose={() => setShowVersionCompare(false)}
        />
      )}

      {openRevDropdownId !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setOpenRevDropdownId(null)} aria-hidden="true" />
      )}

      {comparisonMode && selectedRevisions.length === 2 && (
        <ComparisonModal
          compareDrawingTitle={compareDrawingTitle}
          selectedRevisions={selectedRevisions as [DrawingRevision, DrawingRevision]}
          compareOpacity={compareOpacity}
          setCompareOpacity={setCompareOpacity}
          onClose={() => setComparisonMode(false)}
        />
      )}

      {showUploadModal && (
        <DrawingUpload
          pendingFiles={pendingFiles}
          uploadDiscipline={uploadDiscipline}
          setUploadDiscipline={setUploadDiscipline}
          isUploading={isUploading}
          uploadProgressText={uploadProgressText}
          onClose={() => { setShowUploadModal(false); setPendingFiles([]); }}
          onFileReady={handleFileReady}
          onUpload={handleUploadDrawings}
        />
      )}

      {showRevUploadModal && selectedDrawing && (
        <RevisionUpload
          drawingTitle={selectedDrawing.title}
          drawingSetNumber={selectedDrawing.setNumber}
          revUploadNum={revUploadNum}
          setRevUploadNum={setRevUploadNum}
          revUploadDesc={revUploadDesc}
          setRevUploadDesc={setRevUploadDesc}
          revUploadFile={revUploadFile}
          setRevUploadFile={setRevUploadFile}
          isRevUploading={isRevUploading}
          onClose={() => setShowRevUploadModal(false)}
          onUpload={handleUploadRevision}
        />
      )}

      {showAnalysisPanel && intelligence.state.stage !== 'idle' && (
        <AnalysisProgress
          state={intelligence.state}
          floating
          onClose={() => setShowAnalysisPanel(false)}
        />
      )}

      <AiInsightsPanel
        isOpen={showAiPanel}
        onClose={() => setShowAiPanel(false)}
        loading={aiPanelLoading}
        error={aiPanelError}
        analyzed={aiPanelAnalyzed}
        conflicts={aiPanelConflicts}
        hasSelectedDrawing={!!selectedDrawing}
        onAnalyze={handleAiAnalyze}
      />
    </PageContainer>
  );
};

export const Drawings: React.FC = () => (
  <ErrorBoundary message="Failed to load drawings. Retry">
    <DrawingsPage />
  </ErrorBoundary>
);

export default Drawings;
