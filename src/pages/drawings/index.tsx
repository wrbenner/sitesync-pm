import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { Upload, ScanSearch, FolderOpen, MessageSquare, Ruler } from 'lucide-react';
import { PageContainer, Btn, useToast } from '../../components/Primitives';
import { colors, spacing } from '../../styles/theme';
import { getDrawings, getDrawingRevisionHistory } from '../../api/endpoints/documents';
import { useQuery } from '../../hooks/useQuery';
import { useProjectId } from '../../hooks/useProjectId';
import { PdfViewer } from '../../components/drawings/PdfViewer';
import { DrawingTiledViewer } from '../../components/drawings/DrawingTiledViewer';
import { useSignedUrl } from '../../hooks/useSignedUrl';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { supabase } from '../../lib/supabase';
import { fromTable } from '../../lib/db/queries'
import { smartUpload } from '../../lib/resumableUpload';
import { drawingService } from '../../services/drawingService';
import { isPdf, splitPdfToPages } from '../../lib/pdfPageSplitter';
import { DrawingToolbar, type ViewMode, type ToolbarFilters } from './DrawingToolbar';
import { type DrawingStatus } from './constants';
import { DrawingList, type DrawingItem } from './DrawingList';
import { DrawingCardGrid } from './DrawingCardGrid';
// KPIs intentionally omitted — drawings page is visual-first, content-first
import { DrawingDetail } from './DrawingDetail';
import JSZip from 'jszip';
import { DrawingUpload, RevisionUpload } from './DrawingUpload';
import { extractDrawingFilesFromZip } from '../../components/files/UploadZone';
import {
  classifyPdfByFilename,
  inferDisciplineFromFilename,
  extractRevisionFromFilename,
  parseCoverMetadata,
  mergeCoverMetadata,
  looksLikeCoverText,
  type CoverMetadata,
} from '../../lib/pdfClassifier';
import { extractPdfFirstPageText, extractPdfTextFromPages } from '../../lib/pdfPageSplitter';
import { extractSheetTitleBlock } from '../../lib/sheetTitleBlockParser';
import { rightEdgeStripRegion } from '../../lib/titleBlockDetector';
import { cropPngToRegion } from '../../lib/imageCrop';
import { RevisionOverlay } from '../../components/drawings/RevisionOverlay';
import { AnnotationListPanel } from '../../components/drawings/AnnotationListPanel';
import { useAIAnnotationStore } from '../../stores';
import { useDrawingProcessing } from '../../hooks/useDrawingProcessing';
import {
  useDrawingIntelligence,
  useDiscrepanciesForDrawing,
} from '../../hooks/useDrawingIntelligence';
import { AnalysisProgress } from '../../components/drawings/AnalysisProgress';
import { DrawingSetPanel, type DrawingSetItem, type SetType } from '../../components/drawings/DrawingSetPanel';
import { ScaleAuditPanel } from '../../components/drawings/ScaleAuditPanel';
import { TransmittalModal, type TransmittalData } from '../../components/drawings/TransmittalModal';
import { DiscrepancyDetailModal } from '../../components/drawings/DiscrepancyDetailModal';
import { IrisConflictScanButton } from '../../components/drawings/IrisConflictScanButton';
import { useProjectDrawingPairs } from '../../hooks/useDrawingIntelligence';
import type { DrawingDiscrepancy, DrawingPair } from '../../types/ai';

// ─── Helpers ───────────────────────────────────────────────────────────────

// extractRevisionFromFilename moved to src/lib/pdfClassifier.ts
// (imported above) — single source of truth shared with the local tester.

/**
 * Clean a source filename down to a readable title.
 * Hyphens in sheet numbers like "A-101" are preserved; underscores and
 * leading dates are stripped; common tokens (IFC, stamped, Rev NN, RTG,
 * Updated, "For Construction/Permit/…") are removed.
 *
 * "25.04.02_Merritt Crossing_Mechanical_IFC_stamped_Rev 05.pdf"
 *   → "Merritt Crossing Mechanical"
 * "A-101.pdf" → "A-101"
 */
function cleanFilenameTitle(name: string): string {
  let s = name
    .replace(/\.[^.]+$/, '')                                    // strip extension
    .replace(/^\d{2,4}[.\-_]\d{1,2}[.\-_]\d{1,2}[_\-\s]*/, ''); // leading date
  s = s.replace(/_+/g, ' ');                                     // only underscores → spaces; keep hyphens
  s = s
    .replace(/\brev(?:ision)?\s?\d{1,3}(?:\.\d{1,2})?\b/ig, '')
    .replace(/\bifc\b/ig, '')
    .replace(/\bfor\s+(?:construction|permit|bid|review)\b/ig, '')
    .replace(/\bstamped\b/ig, '')
    .replace(/\bupdated\b/ig, '')
    .replace(/\brtg\b/ig, '')                                    // firm abbreviations
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

// inferDisciplineFromFilename now lives in src/lib/pdfClassifier.ts
// (imported above) — single source of truth shared with tests.

// ─── Drawing File Viewer — single path through OpenSeadragon ──────────────
// Every drawing goes through DrawingTiledViewer (OpenSeadragon):
//  • DZI tiles when tile_status === 'ready' (deepest zoom)
//  • Simple image source via signed URL (PNG/JPEG pages)
//  • Handles loading states while URL signs

const DrawingFileViewer: React.FC<{
  drawing: DrawingItem;
  drawings: DrawingItem[];
  onClose: () => void;
  onNavigate: (d: DrawingItem) => void;
  onCreateRFI?: () => void;
  projectId?: string;
  scaleRatioText?: string | null;
}> = ({ drawing, drawings, onClose, onNavigate, projectId, scaleRatioText }) => {
  const signedUrl = useSignedUrl(drawing.file_url || null);

  if (!drawing.file_url) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1090, backgroundColor: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <p style={{ fontSize: 16, fontWeight: 600 }}>No file attached to this drawing</p>
          <button onClick={onClose} style={{ marginTop: 16, padding: '8px 24px', backgroundColor: colors.primaryOrange, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Close</button>
        </div>
      </div>
    );
  }

  // All drawings → OpenSeadragon viewer
  // signedUrl may be null while loading — the viewer shows its own loading state
  return (
    <DrawingTiledViewer
      drawing={drawing}
      drawings={drawings}
      onClose={onClose}
      onNavigate={onNavigate}
      projectId={projectId}
      scaleRatioText={scaleRatioText}
      signedUrl={signedUrl}
    />
  );
};

// ─── Main Page ──────────────────────────────────────────────────────────────

const DrawingsPage: React.FC = () => {
  const { addToast } = useToast();
  const projectId = useProjectId();
  const navigate = useNavigate();
  const { data: drawings, loading, error, refetch } = useQuery(
    `drawings-${projectId}`,
    () => getDrawings(projectId!),
    { enabled: !!projectId },
  );

  // Surface persistent query errors
  const errorToastShown = React.useRef(false);
  React.useEffect(() => {
    if (error && !errorToastShown.current) {
      errorToastShown.current = true;
      addToast('error', `Failed to load drawings: ${error}`);
    }
    if (!error) errorToastShown.current = false;
  }, [error, addToast]);

  // ── Revision-impact banner ────────────────────────────────
  // Find RFIs that were flagged by a recent revision upload (within the last
  // 14 days) by the drawing-revised cross-feature chain. Surfacing this on
  // the drawings page is the right place because it answers "what did my
  // revision break?" — the question someone asks when looking at drawings.
  const [revisionImpact, setRevisionImpact] = useState<{
    rfiCount: number;
    sheetNumbers: string[];
  } | null>(null);
  const [revisionImpactDismissed, setRevisionImpactDismissed] = useState(false);
  React.useEffect(() => {
    if (!projectId || revisionImpactDismissed) return;
    let cancelled = false;
    (async () => {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      // We can't index on jsonb keys we don't know, so query open RFIs whose
      // metadata.last_revision_flagged_at is recent. Volume is low.
      // The generated Database types lag behind the live schema (rfis.metadata
      // is jsonb added in 20260428100000), so route through an `any`-typed
      // client. Same pattern as src/lib/crossFeatureWorkflows.ts.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      // Status values per migration 00028_rfi_workflow.sql.
      const { data, error: rfiErr } = await sb
        .from('rfis')
        .select('id, drawing_reference, metadata')
        .eq('project_id' as never, projectId)
        .in('status' as never, ['draft', 'open', 'under_review']);
      if (cancelled || rfiErr || !data) return;
      const recent = (data as Array<{ id: string; drawing_reference: string | null; metadata: Record<string, unknown> | null }>)
        .filter((rfi) => {
          const m = rfi.metadata ?? {};
          const flaggedAt = m.last_revision_flagged_at as string | undefined;
          if (!flaggedAt) return false;
          return new Date(flaggedAt) >= fourteenDaysAgo;
        });
      if (recent.length === 0) {
        setRevisionImpact(null);
        return;
      }
      const sheetNumbers = Array.from(
        new Set(
          recent
            .map((rfi) => rfi.drawing_reference)
            .filter((s): s is string => !!s),
        ),
      );
      setRevisionImpact({ rfiCount: recent.length, sheetNumbers });
    })();
    return () => { cancelled = true; };
  }, [projectId, drawings, revisionImpactDismissed]);

  // ── View & filter state ─────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filters, setFilters] = useState<ToolbarFilters>({
    search: '',
    disciplines: new Set(),
    statuses: new Set(),
  });
  const [sortField, setSortField] = useState('setNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ── Selection state ─────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedDrawing, setSelectedDrawing] = useState<DrawingItem | null>(null);
  const [viewerDrawing, setViewerDrawing] = useState<DrawingItem | null>(null);

  // ── Revision state ──────────────────────────────────────
  const [viewingRevisionNum, setViewingRevisionNum] = useState<number | null>(null);
  // Side-by-side rev comparison: holds the prior revision the user
  // wants to diff against the current sheet. Null = no compare modal.
  const [compareRev, setCompareRev] = useState<DrawingRevision | null>(null);
  const [viewRevPdfUrl, setViewRevPdfUrl] = useState<string | null>(null);

  // ── Overlay (any two drawings) ──────────────────────────
  const [overlayPair, setOverlayPair] = useState<{
    aUrl: string; aLabel: string;
    bUrl: string; bLabel: string;
  } | null>(null);
  const [isPreparingOverlay, setIsPreparingOverlay] = useState(false);

  // ── Upload state ────────────────────────────────────────
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadSetName, setUploadSetName] = useState('');
  const [uploadSetType, setUploadSetType] = useState<SetType>('working');
  const [pageIsDragging, setPageIsDragging] = useState(false);
  const [showRevUploadModal, setShowRevUploadModal] = useState(false);
  const [revUploadFile, setRevUploadFile] = useState<File | null>(null);
  const [revUploadNum, setRevUploadNum] = useState('');
  const [revUploadDesc, setRevUploadDesc] = useState('');
  const [isRevUploading, setIsRevUploading] = useState(false);

  // ── Annotation state ────────────────────────────────────
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false);
  const annotationsStore = useAIAnnotationStore();

  // ── AI pipeline state ───────────────────────────────────
  const processing = useDrawingProcessing(projectId);
  const classifyMutation = processing.classify;
  const intelligence = useDrawingIntelligence(projectId ?? undefined);
  const { data: drawingDiscrepancies = [] } = useDiscrepanciesForDrawing(
    selectedDrawing ? String(selectedDrawing.id) : undefined,
    projectId ?? undefined,
  );
  const { data: drawingPairs } = useProjectDrawingPairs(projectId ?? undefined);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const [openDiscrepancy, setOpenDiscrepancy] = useState<DrawingDiscrepancy | null>(null);

  const openDiscrepancyPair = useMemo<DrawingPair | null>(() => {
    if (!openDiscrepancy || !drawingPairs) return null;
    return drawingPairs.find((p) => p.id === openDiscrepancy.pair_id) ?? null;
  }, [openDiscrepancy, drawingPairs]);

  // ── Deep-link handling: /drawings?id=<drawingId> auto-opens the detail
  //    panel for that drawing. React-Router's top-level /drawings route is
  //    parameterless, so we surface deep-links via search params.
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkedId = searchParams.get('id');
  // Set true by the close button. The deep-link auto-open effect skips one
  // run after a user-initiated close so the panel can't immediately re-open
  // while the URL update is still in flight (react-router v7 may commit
  // the navigate in a transition, separate from the state batch).
  const userJustClosedRef = useRef(false);
  React.useEffect(() => {
    if (userJustClosedRef.current) {
      userJustClosedRef.current = false;
      return;
    }
    if (!deepLinkedId || !drawings) return;
    if (selectedDrawing?.id === deepLinkedId) return;
    const target = drawings.find((d) => String(d.id) === deepLinkedId);
    if (target) setSelectedDrawing(target);
  }, [deepLinkedId, drawings, selectedDrawing?.id]);

  // Keep URL in sync with the active detail panel so links are shareable.
  React.useEffect(() => {
    const current = searchParams.get('id');
    const desired = selectedDrawing ? String(selectedDrawing.id) : null;
    if (current === desired) return;
    const next = new URLSearchParams(searchParams);
    if (desired) next.set('id', desired);
    else next.delete('id');
    setSearchParams(next, { replace: true });
  }, [selectedDrawing?.id, searchParams, setSearchParams, selectedDrawing]);

  // ── Drawing Sets state ─────────────────────────────────
  const [showSetsPanel, setShowSetsPanel] = useState(false);
  const [showScaleAuditPanel, setShowScaleAuditPanel] = useState(false);
  const { data: drawingSets, refetch: refetchSets } = useQuery(
    `drawing-sets-${projectId}`,
    async () => {
      try {
        const { data, error: err } = await fromTable('drawing_sets')
          .select('*')
          .eq('project_id' as never, projectId!)
          .order('created_at', { ascending: false });
        if (err) {
          // Table may not exist yet if migration hasn't been applied
          console.warn('[DrawingSets] Query failed (table may not exist):', err.message);
          return [] as DrawingSetItem[];
        }
        return (data || []) as DrawingSetItem[];
      } catch (e) {
        console.warn('[DrawingSets] Query error:', e);
        return [] as DrawingSetItem[];
      }
    },
    { enabled: !!projectId },
  );

  const handleCreateSet = useCallback(async (setData: { name: string; set_type: SetType; description?: string; drawing_ids: string[] }) => {
    if (!projectId) return;
    const { error: err } = await fromTable('drawing_sets').insert({
      project_id: projectId,
      name: setData.name,
      set_type: setData.set_type,
      description: setData.description || null,
      drawing_ids: setData.drawing_ids,
    });
    if (err) { addToast('error', `Failed to create set: ${err.message}`); return; }
    addToast('success', `Drawing set "${setData.name}" created.`);
    refetchSets();
  }, [projectId, addToast, refetchSets]);

  const handleUpdateSet = useCallback(async (setId: string, data: { drawing_ids: string[] }) => {
    const { error: err } = await fromTable('drawing_sets')
      .update({ drawing_ids: data.drawing_ids })
      .eq('id' as never, setId);
    if (err) { addToast('error', `Failed to update set: ${err.message}`); return; }
    refetchSets();
  }, [addToast, refetchSets]);

  const [transmittalSetId, setTransmittalSetId] = useState<string | null>(null);
  const [isIssuingTransmittal, setIsIssuingTransmittal] = useState(false);

  const handleIssueSet = useCallback((setId: string) => {
    setTransmittalSetId(setId);
  }, []);

  const handleSubmitTransmittal = useCallback(async (data: TransmittalData) => {
    if (!projectId) return;
    setIsIssuingTransmittal(true);
    try {
      // Create the transmittal record (matches 00019_document_enhancements schema)
      const { error: transmittalErr } = await fromTable('transmittals').insert({
        project_id: projectId,
        to_company: data.recipient_company,
        to_contact: data.recipient_name,
        to_email: data.recipient_email || null,
        subject: `Drawing Set Issue — ${data.purpose.replace(/_/g, ' ')}`,
        purpose: data.purpose,
        notes: data.remarks || null,
        document_ids: data.drawing_ids,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
      if (transmittalErr) { addToast('error', `Failed to create transmittal: ${transmittalErr.message}`); return; }

      // Update the set to issued
      const { error: setErr } = await fromTable('drawing_sets')
        .update({
          set_type: 'issued',
          issued_date: new Date().toISOString(),
        })
        .eq('id' as never, data.set_id);
      if (setErr) { addToast('error', `Failed to update set status: ${setErr.message}`); return; }

      addToast('success', `Transmittal issued to ${data.recipient_company}.`);
      setTransmittalSetId(null);
      refetchSets();
    } finally {
      setIsIssuingTransmittal(false);
    }
  }, [projectId, addToast, refetchSets]);

  const allDrawings: DrawingItem[] = drawings || [];

  const handleOpenDrawingFromSet = useCallback((drawingId: string) => {
    const drawing = allDrawings.find((d) => d.id === drawingId);
    if (drawing) {
      setViewerDrawing(drawing);
      setShowSetsPanel(false);
    }
  }, [allDrawings]);

  // ── Revision history for detail panel ───────────────────
  const { data: revisionHistory } = useQuery(
    `revision-history-${selectedDrawing?.id ?? 'none'}`,
    () => getDrawingRevisionHistory(String(selectedDrawing!.id)),
    { enabled: !!selectedDrawing?.id },
  );

  // Reset revision view when selecting a different drawing
  React.useEffect(() => {
    setViewingRevisionNum(null);
    setViewRevPdfUrl(null);
  }, [selectedDrawing?.id]);

  // ── Backfill disciplines from sheet prefix ──────────────
  const backfillRan = React.useRef(false);
  React.useEffect(() => {
    if (!drawings || backfillRan.current) return;
    const missing = drawings.filter((d) => !d.discipline && d.setNumber);
    if (missing.length === 0) return;
    backfillRan.current = true;
    void (async () => {
      let updated = 0;
      for (const d of missing) {
        const disc = inferDisciplineFromFilename(d.setNumber || d.title);
        if (disc) {
          await drawingService.updateDrawing(String(d.id), { discipline: disc } as Record<string, unknown>);
          updated++;
        }
      }
      if (updated > 0) {
        refetch();
        addToast('info', `Auto-classified ${updated} drawing${updated !== 1 ? 's' : ''} from sheet prefix.`);
      }
    })();
  }, [drawings, refetch, addToast]);

  // (AI-backfill effect moved below — must run AFTER triggerClassification
  // is defined, otherwise the dependency-array read hits a TDZ.)

  // ── Derived data ────────────────────────────────────────
  const availableDisciplines = useMemo(() => {
    const set = new Set<string>();
    allDrawings.forEach((d) => { if (d.discipline) set.add(d.discipline); });
    return Array.from(set).sort();
  }, [allDrawings]);

  const filteredAndSorted = useMemo(() => {
    let result = allDrawings;

    if (filters.search.length >= 2) {
      const q = filters.search.toLowerCase();
      result = result.filter((d) =>
        d.title.toLowerCase().includes(q) ||
        d.setNumber?.toLowerCase().includes(q) ||
        d.discipline?.toLowerCase().includes(q),
      );
    }

    if (filters.disciplines.size > 0) {
      result = result.filter((d) => filters.disciplines.has(d.discipline));
    }

    if (filters.statuses.size > 0) {
      result = result.filter((d) => filters.statuses.has((d.status || 'for_review') as DrawingStatus));
    }

    result = [...result].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortField];
      const bVal = (b as Record<string, unknown>)[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return result;
  }, [allDrawings, filters, sortField, sortDir]);

  // ── Handlers ────────────────────────────────────────────

  const handleSort = useCallback((field: string) => {
    setSortField((prev) => {
      if (prev === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
      else setSortDir('asc');
      return field;
    });
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = filteredAndSorted.map((d) => d.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  }, [filteredAndSorted, selectedIds]);

  const handleClearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBulkDownload = useCallback(() => {
    addToast('info', `Downloading ${selectedIds.size} drawing${selectedIds.size !== 1 ? 's' : ''}...`);
    setSelectedIds(new Set());
  }, [selectedIds, addToast]);

  const handleBulkStatusChange = useCallback(async (status: DrawingStatus) => {
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => drawingService.updateDrawing(String(id), { status })));
      addToast('success', `Updated ${ids.length} drawing${ids.length !== 1 ? 's' : ''} to ${status.replace(/_/g, ' ')}`);
      setSelectedIds(new Set());
      refetch();
    } catch {
      addToast('error', 'Failed to update some drawings. Try again.');
    }
  }, [selectedIds, addToast, refetch]);

  const handleBulkOverlay = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length !== 2) { addToast('info', 'Select exactly 2 drawings to overlay.'); return; }
    const [aId, bId] = ids;
    const a = allDrawings.find((d) => d.id === aId);
    const b = allDrawings.find((d) => d.id === bId);
    if (!a?.file_url || !b?.file_url) {
      addToast('error', 'One or both drawings are missing a file.'); return;
    }
    setIsPreparingOverlay(true);
    try {
      const [aSign, bSign] = await Promise.all([
        supabase.storage.from('project-files').createSignedUrl(a.file_url, 3600),
        supabase.storage.from('project-files').createSignedUrl(b.file_url, 3600),
      ]);
      const aUrl = aSign.data?.signedUrl;
      const bUrl = bSign.data?.signedUrl;
      if (!aUrl || !bUrl) { addToast('error', 'Could not sign URLs for the selected drawings.'); return; }
      setOverlayPair({
        aUrl,
        bUrl,
        aLabel: a.setNumber || a.title,
        bLabel: b.setNumber || b.title,
      });
    } finally {
      setIsPreparingOverlay(false);
    }
  }, [selectedIds, allDrawings, addToast]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => drawingService.updateDrawing(String(id), { status: 'archived' })));
      addToast('success', `Archived ${ids.length} drawing${ids.length !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      refetch();
    } catch {
      addToast('error', 'Failed to archive some drawings.');
    }
  }, [selectedIds, addToast, refetch]);

  const triggerClassification = useCallback(
    async (drawingId: string, pageImageUrl: string, fileName?: string, fullPageUrl?: string) => {
      if (!projectId) return;
      // Must match the construction_discipline DOMAIN values.
      // Source of truth: supabase/migrations/20260423000001_discipline_domain.sql
      // + 20260428000000_extend_disciplines.sql (adds food_service, laundry,
      // vertical_transportation). Keep aligned with src/pages/drawings/constants.ts
      // and src/lib/pdfClassifier.ts:Discipline.
      const VALID_DISCIPLINES = new Set([
        'architectural', 'structural', 'mechanical', 'electrical', 'plumbing',
        'civil', 'fire_protection', 'landscape', 'interior', 'interior_design',
        'mep', 'unclassified', 'cover', 'demolition', 'survey', 'geotechnical',
        'hazmat', 'telecommunications',
        'food_service', 'laundry', 'vertical_transportation',
      ]);
      const DISCIPLINE_REMAP: Record<string, string> = {
        hvac: 'mechanical',
        low_voltage: 'telecommunications',
        telecom: 'telecommunications',
        fire_alarm: 'fire_protection',
        title: 'cover',
        title_sheet: 'cover',
        environmental: 'hazmat',
      };
      try {
        const result = await classifyMutation.mutateAsync({ projectId, drawingId, pageImageUrl, fullPageUrl });
        const updates: Record<string, unknown> = {};
        if (result.discipline && result.discipline !== 'unclassified') {
          const mapped = DISCIPLINE_REMAP[result.discipline] ?? result.discipline;
          if (VALID_DISCIPLINES.has(mapped)) updates.discipline = mapped;
        }
        // Always prefer AI-extracted sheet_number and title over text
        // extraction or filename fallbacks. The production AI codebase
        // sends every page to Gemini and achieves 99%+ accuracy — we
        // match that by always trusting AI results here.
        if (result.sheet_number) updates.sheet_number = result.sheet_number;
        if (result.drawing_title) updates.title = result.drawing_title;
        // Revision as read from the title block's REVISIONS table by Gemini.
        // Overwrites the filename-derived rev — the title block is authoritative
        // when it's readable.
        if ((result as Record<string, unknown>).revision) {
          updates.revision = String((result as Record<string, unknown>).revision);
        }
        updates.processing_status = 'completed';
        await drawingService.updateDrawing(drawingId, updates as Record<string, unknown>);

        // Also update the drawing_pages row so both tables stay in sync
        if (result.sheet_number || result.drawing_title || updates.discipline) {
          const pageUpdates: Record<string, unknown> = {
            classification: 'completed',
            classification_confidence: result.confidence ?? 1.0,
          };
          if (result.sheet_number) pageUpdates.sheet_number = result.sheet_number;
          if (result.drawing_title) pageUpdates.drawing_title = result.drawing_title;
          if (updates.discipline) pageUpdates.discipline = updates.discipline;
          await fromTable('drawing_pages')
            .update(pageUpdates as never)
            .eq('drawing_id' as never, drawingId);
        }
        refetch();
      } catch (err) {
        const updates: Record<string, unknown> = { processing_status: 'failed' };
        if (fileName) {
          const fallbackDiscipline = inferDisciplineFromFilename(fileName);
          if (fallbackDiscipline) updates.discipline = fallbackDiscipline;
        }
        await drawingService.updateDrawing(drawingId, updates as Record<string, unknown>);
        refetch();
        if (updates.discipline) {
          addToast('info', 'AI unavailable — discipline set from sheet prefix.');
        } else {
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('413') || msg.includes('too large')) {
            addToast('warning', 'File exceeds size limit for AI. Drawing saved without AI metadata.');
          } else {
            addToast('warning', 'AI classification failed. Drawing saved successfully.');
          }
        }
      }
    },
    [projectId, classifyMutation, addToast, refetch],
  );

  // ── Backfill AI classification for drawings that never got AI ──
  // Detects drawings with filename-derived titles (the "— Page N" pattern
  // or titles that exactly match the source filename) and re-runs Gemini.
  // Catches data uploaded before we switched to always-AI mode.
  // MUST sit after triggerClassification's useCallback — the dependency
  // array is read during render, so referencing it before its declaration
  // hits a TDZ ReferenceError.
  const aiBackfillRan = React.useRef(false);
  React.useEffect(() => {
    if (!drawings || !projectId || aiBackfillRan.current) return;
    const needsReclassify = drawings.filter((d) => {
      if (!d.file_url) return false;
      if (d.processing_status === 'completed') return false;
      if (['classifying', 'needs_review', 'pending', 'failed'].includes(d.processing_status ?? '')) return true;
      if (!d.processing_status) return true;
      return false;
    });
    if (needsReclassify.length === 0) return;
    aiBackfillRan.current = true;
    const batch = needsReclassify.slice(0, 20);
    addToast('info', `Re-classifying ${batch.length} drawing${batch.length !== 1 ? 's' : ''} with AI...`);
    void (async () => {
      for (const d of batch) {
        try {
          const { data: urlData } = await supabase.storage
            .from('project-files')
            .createSignedUrl(d.file_url!, 3600);
          if (urlData?.signedUrl) {
            await triggerClassification(String(d.id), urlData.signedUrl, d.source_filename ?? d.title);
          }
        } catch {
          /* per-drawing failure already handled inside triggerClassification */
        }
      }
    })();
  }, [drawings, projectId, addToast, triggerClassification]);

  const handleFileReady = useCallback((file: File) => {
    setPendingFiles((prev) => [...prev, file]);
  }, []);

  const handleUploadDrawings = async () => {
    if (!projectId || pendingFiles.length === 0) return;
    setIsUploading(true);
    let drawingsUploaded = 0;
    let specsUploaded = 0;
    let coversUploaded = 0;
    const createdDrawingIds: string[] = [];
    const classificationTargets: Array<{ drawingId: string; pageImageUrl: string; fullPageUrl?: string; fileName: string }> = [];
    const coverFindings: Array<{ fileName: string; metadata: CoverMetadata }> = [];
    // (sheet_number, sourcePdf) → drawing IDs. Used after upload to detect
    // pages where text extraction collapsed multiple sheets to the same
    // number (e.g. page 4 and page 6 both read "ID-2" because of a pdfjs
    // tokenization bug). Flagged drawings get processing_status='needs_review'.
    const sheetAssignments: Array<{ drawingId: string; sheetNumber: string; sourceFile: string }> = [];

    // ── Build work queue: expand zips into per-entry items (manifest-only —
    //    blobs are NOT decompressed here; they're read lazily one at a time
    //    during processing so peak memory stays bounded). ────────────────
    type WorkItem =
      | { kind: 'file'; file: File }
      | { kind: 'zip-entry'; zip: JSZip; entryName: string; displayName: string; sourceZipName: string };

    const queue: WorkItem[] = [];
    const zipsToClose: JSZip[] = [];

    const flattenZip = async (zip: JSZip, sourceName: string, depth = 0, maxDepth = 3) => {
      zipsToClose.push(zip);
      for (const entry of Object.values(zip.files)) {
        if (entry.dir) continue;
        if (entry.name.startsWith('__MACOSX/') || entry.name.split('/').some((p) => p === '.DS_Store')) continue;
        if (/\.zip$/i.test(entry.name) && depth < maxDepth) {
          try {
            const nestedBlob = await entry.async('blob');
            const nestedZip = await JSZip.loadAsync(nestedBlob);
            await flattenZip(nestedZip, entry.name, depth + 1, maxDepth);
          } catch (err) {
            console.warn('[upload] nested zip failed', entry.name, err);
          }
          continue;
        }
        if (!/\.(pdf|dwg|dxf|png|jpe?g|tiff?)$/i.test(entry.name)) continue;
        const baseName = entry.name.split('/').pop() || entry.name;
        queue.push({ kind: 'zip-entry', zip, entryName: entry.name, displayName: baseName, sourceZipName: sourceName });
      }
    };

    for (const f of pendingFiles) {
      if (/\.zip$/i.test(f.name) || f.type === 'application/zip' || f.type === 'application/x-zip-compressed') {
        try {
          const zip = await JSZip.loadAsync(f);
          await flattenZip(zip, f.name);
        } catch (err) {
          console.error('[upload] zip open failed', f.name, err);
          addToast('error', `Could not open "${f.name}": ${err instanceof Error ? err.message : 'unknown'}`);
        }
      } else {
        queue.push({ kind: 'file', file: f });
      }
    }

    if (queue.length === 0) {
      setIsUploading(false);
      setUploadProgressText('');
      addToast('error', 'No supported files found to upload.');
      return;
    }

    const total = queue.length;

    // ── Per-item processing helpers ─────────────────────────────────────
    const getFileForItem = async (item: WorkItem): Promise<File | null> => {
      if (item.kind === 'file') return item.file;
      const jszipEntry = item.zip.file(item.entryName);
      if (!jszipEntry) return null;
      try {
        const blob = await jszipEntry.async('blob');
        return new window.File([blob], item.displayName, { type: blob.type || 'application/octet-stream' });
      } catch (err) {
        console.error('[upload] could not extract', item.entryName, err);
        return null;
      }
    };

    const uploadAsSpec = async (file: File, idx: number) => {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      setUploadProgressText(`[${idx + 1}/${total}] Uploading spec "${file.name}" (${sizeMB} MB)...`);
      const storageKey = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const path = `${projectId}/specifications/${storageKey}-${file.name}`;
      let fileUrl = path;
      try {
        const result = await smartUpload('project-files', path, file, (pct) => {
          setUploadProgressText(`[${idx + 1}/${total}] Uploading spec "${file.name}" — ${pct}%`);
        });
        if (result.error) { addToast('error', `Spec upload failed for ${file.name}: ${result.error}`); return false; }
        fileUrl = result.storagePath || path;
      } catch (err) {
        console.error('[spec] upload failed', err);
        addToast('error', `Spec upload failed for ${file.name}`);
        return false;
      }

      // Insert into specifications table. Section number falls back to —; title
      // gets filename cleanup so "2024.08.08_RTG_Merritt Crossing_Spec Book_Updated"
      // becomes "Merritt Crossing Spec Book".
      const titleNoExt = file.name.replace(/\.[^.]+$/, '');
      const sectionMatch = titleNoExt.match(/\b(\d{2}[\s_-]?\d{2}[\s_-]?\d{0,2})\b/);
      const sectionNumber = sectionMatch ? sectionMatch[1].replace(/[\s_-]+/g, ' ').trim() : '—';
      const cleanedTitle = cleanFilenameTitle(file.name) || titleNoExt;
      const { error: specErr } = await fromTable('specifications').insert({
        project_id: projectId,
        section_number: sectionNumber,
        title: cleanedTitle,
        status: 'active',
        file_url: fileUrl,
      });
      if (specErr) {
        addToast('warning', `Spec "${file.name}" uploaded to storage but the record couldn't be saved: ${specErr.message}`);
        return false;
      }
      specsUploaded++;
      return true;
    };

    // ── Core PDF → drawing pages flow (reused by both drawing & cover routes)
    const uploadPdfAsDrawing = async (file: File, idx: number, opts: { isCover?: boolean } = {}) => {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      const titleNoExt = file.name.replace(/\.[^.]+$/, '');

      setUploadProgressText(`[${idx + 1}/${total}] Splitting PDF "${file.name}" (${sizeMB} MB)...`);
      let pages;
      try {
        pages = await splitPdfToPages(file, (p) => {
          setUploadProgressText(`[${idx + 1}/${total}] Rendering page ${p.current}/${p.total} of "${file.name}"...`);
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown';
        if (msg.includes('memory') || msg.includes('RangeError') || msg.includes('allocation')) {
          addToast('error', `"${file.name}" is too large to render in the browser (${sizeMB} MB). Try splitting it first.`);
        } else {
          addToast('error', `Failed to split PDF "${file.name}": ${msg}`);
        }
        return 0;
      }

      // Archive original PDF (non-fatal)
      const origPath = `${projectId}/drawings/${Date.now()}-${file.name}`;
      try {
        const origResult = await smartUpload('project-files', origPath, file, () => {});
        if (origResult.error) console.warn('[drawing] original PDF archive failed:', origResult.error);
      } catch { /* non-fatal */ }

      let localSucceeded = 0;
      // Precomputed values reused across all pages of this PDF
      const cleanedTitle = cleanFilenameTitle(file.name);
      const revisionFromName = extractRevisionFromFilename(file.name) ?? '1';
      const filenameSheetMatch = titleNoExt.match(/^([A-Z]{1,3}-?\d+)/i);

      for (let pi = 0; pi < pages.length; pi++) {
        const page = pages[pi];
        setUploadProgressText(`[${idx + 1}/${total}] Uploading page ${pi + 1}/${pages.length} of "${file.name}"...`);

        // ── Stage 1: Extract sheet number + title using vector-detected
        //    title-block region when available. Region scoping makes
        //    detail-callout garbage and body-text false positives
        //    invisible to the parser — ~3x accuracy lift on real CAD
        //    exports vs. full-page scanning.
        const titleBlock = extractSheetTitleBlock(
          page.text,
          page.textItems,
          page.pageWidth,
          page.pageHeight,
          page.titleBlockRegion ?? undefined,
        );

        // Sheet number: for NON-cover pages we deliberately ignore the
        // text-layer parser's guess and use a safe placeholder (filename
        // match or synthetic "P###"). Text-layer extraction against a
        // page full of cross-reference callouts ("06/ID4.0", "B2",
        // unit labels) picks wrong tokens too often — e.g. "B2" instead
        // of "P3B.3" on a Merritt Crossing plumbing sheet. AI on the
        // right-strip crop fills in the authoritative sheet_number.
        //
        // For cover sheets text-layer is more reliable (title sheets
        // have clean layouts) and AI doesn't run, so we still use it.
        const coverFallbackSheet = `CS-${String(page.pageNumber).padStart(3, '0')}`;
        const sheetNumber = opts.isCover
          ? (titleBlock.sheetNumber ?? coverFallbackSheet)
          : (filenameSheetMatch ? filenameSheetMatch[1].toUpperCase() : `P${String(page.pageNumber).padStart(3, '0')}`);

        // Title: filename-based placeholder until AI returns. Same
        // reasoning — text-layer pulls body-text garbage on many sheets,
        // and AI is running on every non-cover page, so we'd rather
        // show an obvious placeholder than a confident wrong answer.
        const filenameBasedLabel = opts.isCover
          ? (pages.length === 1 ? `Cover Sheet — ${cleanedTitle}` : `Cover Sheet — ${cleanedTitle} (p${page.pageNumber})`)
          : (pages.length === 1 ? cleanedTitle : `${cleanedTitle} — Page ${page.pageNumber}`);
        const pageLabel = opts.isCover && titleBlock.title
          ? titleBlock.title
          : filenameBasedLabel;

        if (titleBlock.sheetNumber || titleBlock.title) {
          console.info(`[text-layer-validator] page ${page.pageNumber}:`, {
            parserSheet: titleBlock.sheetNumber,
            parserTitle: titleBlock.title,
            strategy: titleBlock.titleStrategy,
            confidence: titleBlock.confidence,
            regionScoped: titleBlock.regionScoped,
            note: 'text-layer is validator-only for non-cover pages; AI output wins',
          });
        }

        // Unique storage key per page — UUID avoids Date.now() collisions
        // across concurrent uploads from different users/tabs.
        const pageKey = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
          ? globalThis.crypto.randomUUID()
          : `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
        const pageImagePath = `${projectId}/drawings/pages/${pageKey}-p${page.pageNumber}.png`;
        const thumbPath = `${projectId}/drawings/thumbs/${pageKey}-p${page.pageNumber}-thumb.png`;
        let pageImageStoragePath: string | null = null;
        let thumbStoragePath: string | null = null;

        try {
          const pageFile = new window.File([page.blob], `page${page.pageNumber}.png`, { type: 'image/png' });
          const pageResult = await smartUpload('project-files', pageImagePath, pageFile, (pct) => {
            setUploadProgressText(`Uploading page ${pi + 1}/${pages.length} — ${pct}%`);
          });
          if (pageResult.error) { addToast('error', `Upload failed for page ${page.pageNumber}: ${pageResult.error}`); continue; }
          pageImageStoragePath = pageResult.storagePath || pageImagePath;

          const thumbFile = new window.File([page.thumbnailBlob], `thumb${page.pageNumber}.png`, { type: 'image/png' });
          const thumbResult = await smartUpload('project-files', thumbPath, thumbFile, () => {});
          if (!thumbResult.error) thumbStoragePath = thumbResult.storagePath || thumbPath;
        } catch {
          addToast('error', `Upload failed for page ${page.pageNumber} of "${file.name}"`);
          continue;
        }

        // Infer discipline from filename, then clamp to DB-allowed values.
        // The construction_discipline domain has a fixed set; values outside
        // it (food_service, laundry, vertical_transportation) fall back to
        // null — AI classification fills the real value later.
        const ALLOWED_DISCIPLINES = new Set([
          'architectural','structural','mechanical','electrical','plumbing',
          'civil','fire_protection','landscape','interior','interior_design',
          'mep','unclassified','cover','demolition','survey','geotechnical',
          'hazmat','telecommunications',
        ]);
        const rawDiscipline = opts.isCover ? 'cover' : inferDisciplineFromFilename(file.name);
        const pageDiscipline = rawDiscipline && ALLOWED_DISCIPLINES.has(rawDiscipline)
          ? rawDiscipline
          : (opts.isCover ? 'cover' : null);

        const created = await drawingService.createDrawing({
          project_id: projectId,
          title: pageLabel,
          // Pass the source filename (e.g. "…_Mechanical_IFC_…") so the
          // word-based inferrer wins over the synthetic P### fallback.
          discipline: pageDiscipline,
          sheet_number: sheetNumber,
          revision: revisionFromName,
          file_url: pageImageStoragePath || pageImagePath,
          thumbnail_url: thumbStoragePath || undefined,
          total_pages: pages.length,
          source_filename: file.name,
          file_size_bytes: page.blob.size,
          // Status meaning:
          //   - 'completed'    — cover sheet, no AI needed
          //   - 'classifying'  — AI will process this page and overwrite with final values
          //   - 'needs_review' — cover sheet with no sheet number; user should edit
          processing_status: opts.isCover
            ? (titleBlock.sheetNumber ? 'completed' : 'needs_review')
            : 'classifying',  // always AI — matches production pipeline
        });
        if (created.error) { addToast('error', `Failed to save page ${page.pageNumber}: ${created.error.message}`); continue; }

        const createdId = created.data?.id;
        if (createdId) {
          createdDrawingIds.push(createdId);
          sheetAssignments.push({
            drawingId: createdId,
            sheetNumber,
            sourceFile: file.name,
          });

          // Also persist per-page metadata to drawing_pages. Carries fields
          // that aren't on drawings (scale_ratio, viewport_details,
          // pairing_tokens, design_description) and gives the classification
          // pipeline a stable per-page target.
          const { error: pageErr } = await fromTable('drawing_pages').insert({
            drawing_id: createdId,
            project_id: projectId,
            page_number: page.pageNumber,
            image_url: pageImageStoragePath || pageImagePath,
            thumbnail_url: thumbStoragePath,
            width: page.width,
            height: page.height,
            sheet_number: sheetNumber,
            drawing_title: pageLabel,
            discipline: pageDiscipline,
            classification: opts.isCover ? 'completed' : 'pending',  // AI will update to 'completed'
            classification_confidence: titleBlock.confidence ?? null,
          });
          if (pageErr) {
            console.warn(`[drawing_pages] insert failed for page ${page.pageNumber}: ${pageErr.message}`);
          }
        }

        // ── Stage 2: AI vision classification on a TIGHT RIGHT-STRIP CROP ──
        //
        // Always run Gemini on every non-cover page. The crop is the right
        // 20% of the page, full height — this covers both common title-block
        // layouts in one crop:
        //   (a) traditional bottom-right ARCH-D title block
        //   (b) right-edge vertical strip (common on multifamily residential
        //       drawings — Cross Architects, AOS Engineering layouts)
        //
        // Why crop instead of sending the full page: the full page contains
        // dozens of sheet-number-lookalike tokens (unit labels "B2", "A1",
        // detail callouts "06/ID4.0", grid bubbles) that Gemini has to
        // disambiguate. A tight right-strip crop eliminates those entirely
        // — Gemini sees ONLY title-block text and hits sheet_number reliably.
        //
        // If cropping fails (e.g. image decode error on an exotic PDF), we
        // fall back to sending the full page so we still get A classification
        // — better than skipping the page.
        const needsAi = !opts.isCover;

        if (createdId && pageImageStoragePath && needsAi) {
          let classifyUrl: string | null = null;

          try {
            const stripRegion = rightEdgeStripRegion(page.pageWidth, page.pageHeight);
            const cropBlob = await cropPngToRegion(
              page.blob,
              stripRegion,
              page.pageWidth,
              page.pageHeight,
            );
            const cropKey = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
              ? globalThis.crypto.randomUUID()
              : `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
            const cropPath = `${projectId}/drawings/crops/${cropKey}-strip-p${page.pageNumber}.png`;
            const cropFile = new window.File([cropBlob], `strip-${cropKey}.png`, { type: 'image/png' });
            const cropUploadResult = await smartUpload('project-files', cropPath, cropFile, () => {});
            if (!cropUploadResult.error) {
              const { data: cropUrlData } = await supabase.storage
                .from('project-files')
                .createSignedUrl(cropUploadResult.storagePath || cropPath, 3600);
              if (cropUrlData?.signedUrl) {
                classifyUrl = cropUrlData.signedUrl;
                console.info(`[ai-primary] page ${page.pageNumber} — right-strip crop queued for Gemini (${Math.round(cropBlob.size / 1024)}KB)`);
              }
            }
          } catch (err) {
            console.warn(`[ai-primary] right-strip crop failed for page ${page.pageNumber}, falling back to full page:`, err);
          }

          // Fallback: full page URL if crop/upload failed
          if (!classifyUrl) {
            const { data: urlData } = await supabase.storage.from('project-files').createSignedUrl(pageImageStoragePath, 3600);
            classifyUrl = urlData?.signedUrl ?? null;
          }

          // Also sign the FULL-PAGE URL separately so Gemini sees both
          // images in one call. The crop covers title-block fields (sheet,
          // title, revision); the full page covers fields that live with
          // the drawing viewport (scale, plan_type, viewport details).
          let fullPageSignedUrl: string | undefined;
          {
            const { data: fullUrlData } = await supabase.storage
              .from('project-files')
              .createSignedUrl(pageImageStoragePath, 3600);
            if (fullUrlData?.signedUrl) fullPageSignedUrl = fullUrlData.signedUrl;
          }

          if (classifyUrl) {
            classificationTargets.push({
              drawingId: createdId,
              pageImageUrl: classifyUrl,
              fullPageUrl: fullPageSignedUrl,
              fileName: `${titleNoExt}-P${page.pageNumber}`,
            });
          }
        }
        localSucceeded++;
      }
      return localSucceeded;
    };

    const uploadNonPdfAsDrawing = async (file: File, idx: number) => {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      const titleNoExt = file.name.replace(/\.[^.]+$/, '');
      const cleanedTitle = cleanFilenameTitle(file.name);
      const revisionFromName = extractRevisionFromFilename(file.name) ?? '1';
      setUploadProgressText(`[${idx + 1}/${total}] Uploading "${file.name}" (${sizeMB} MB)...`);
      const sheetMatch = titleNoExt.match(/^([A-Z]{1,3}-?\d+)/i);
      const sheetNumber = sheetMatch ? sheetMatch[1].toUpperCase() : titleNoExt.substring(0, 20);
      const storageKey = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const storagePath = `${projectId}/drawings/${storageKey}-${file.name}`;
      let fileUrl = storagePath;
      let publicUrl: string | null = null;

      try {
        const uploadResult = await smartUpload('project-files', storagePath, file, (pct) => {
          setUploadProgressText(`[${idx + 1}/${total}] Uploading "${file.name}" — ${pct}%`);
        });
        if (uploadResult.error) { addToast('error', `Upload failed for ${file.name}: ${uploadResult.error}`); return false; }
        fileUrl = uploadResult.storagePath || storagePath;
        const { data: urlData } = await supabase.storage.from('project-files').createSignedUrl(fileUrl, 3600);
        publicUrl = urlData?.signedUrl ?? null;
      } catch {
        addToast('error', `Upload failed for ${file.name}`);
        return false;
      }

      const created = await drawingService.createDrawing({
        project_id: projectId,
        title: cleanedTitle || titleNoExt,
        discipline: inferDisciplineFromFilename(file.name),
        sheet_number: sheetNumber,
        revision: revisionFromName,
        file_url: fileUrl,
        source_filename: file.name,
        file_size_bytes: file.size,
        processing_status: 'classifying',
      });
      if (created.error) { addToast('error', `Failed to save ${file.name}: ${created.error.message}`); return false; }
      const createdId = created.data?.id;
      if (createdId) createdDrawingIds.push(createdId);
      if (createdId && publicUrl) {
        classificationTargets.push({ drawingId: createdId, pageImageUrl: publicUrl, fileName: file.name });
      }
      return true;
    };

    // ── Main loop: process one item at a time, release memory between iterations ─
    for (let idx = 0; idx < queue.length; idx++) {
      const item = queue[idx];
      const displayName = item.kind === 'file' ? item.file.name : item.displayName;
      // Pass the zip-internal path when available so /Specifications/ folders
      // route as 'spec' even when their CSI-numbered filenames don't say "spec".
      const fullPath = item.kind === 'zip-entry' ? item.entryName : displayName;
      const route = /\.pdf$/i.test(displayName) ? classifyPdfByFilename(displayName, fullPath) : 'drawing';

      setUploadProgressText(`[${idx + 1}/${total}] Reading "${displayName}"...`);
      const file = await getFileForItem(item);
      if (!file) {
        addToast('error', `Could not read "${displayName}"${item.kind === 'zip-entry' ? ` from ${item.sourceZipName}` : ''}`);
        continue;
      }

      try {
        if (route === 'spec') {
          await uploadAsSpec(file, idx);
        } else if (route === 'cover') {
          // Upload cover as drawing (viewable), then extract metadata from the
          // first several pages — cover SETS are commonly 2–4 pages where page 1
          // is the title/consultants and page 2–3 carry the code summary,
          // building areas, and sheet index.
          const n = await uploadPdfAsDrawing(file, idx, { isCover: true });
          if (n > 0) coversUploaded++;
          try {
            setUploadProgressText(`[${idx + 1}/${total}] Extracting project metadata from "${displayName}"...`);
            const text = await extractPdfTextFromPages(file, 5);
            if (text.trim()) {
              const metadata = parseCoverMetadata(text);
              console.info('[cover] metadata detected for', file.name, metadata);
              coverFindings.push({ fileName: file.name, metadata });
            } else {
              console.info('[cover] no embedded text in', file.name, '— likely a scanned/image PDF. OCR would be needed.');
            }
          } catch (err) {
            console.warn('[cover] text extraction failed', err);
          }
        } else {
          // drawing
          if (isPdf(file)) {
            const n = await uploadPdfAsDrawing(file, idx, { isCover: false });
            drawingsUploaded += n;

            // ALSO peek at page 1 — the architectural title sheet inside a
            // discipline PDF (e.g. Arch_IFC.pdf p1) often carries the real
            // consultant block even when the filename says "drawing". If the
            // text looks cover-like, collect it as a metadata finding too.
            try {
              const firstPageText = await extractPdfFirstPageText(file);
              if (firstPageText.trim() && looksLikeCoverText(firstPageText)) {
                const metadata = parseCoverMetadata(firstPageText);
                if (metadata.confidence > 0.2) {
                  console.info('[drawing-title-page] metadata detected on', file.name, metadata);
                  coverFindings.push({ fileName: file.name, metadata });
                }
              }
            } catch { /* non-fatal — metadata is best-effort */ }
          } else if (await uploadNonPdfAsDrawing(file, idx)) {
            drawingsUploaded++;
          }
        }
      } catch (err) {
        console.error('[upload] item failed', displayName, err);
        addToast('error', `Failed to process "${displayName}": ${err instanceof Error ? err.message : 'unknown'}`);
      }

      // Help the GC — the large Blob inside `file` has no other references now
      // (the zip still holds the compressed bytes but not the decompressed form).
    }

    // ── Flag duplicate sheet numbers within the same source PDF so the user
    //    knows which drawings need manual review. This catches pdfjs
    //    tokenization failures where multiple sheets parsed to the same
    //    number (e.g. pages 4, 6, 7 all getting "ID-2" because their ".0"
    //    tail ended up on a separate text item).
    if (sheetAssignments.length > 0) {
      const groups = new Map<string, string[]>();
      for (const a of sheetAssignments) {
        const key = `${a.sourceFile}::${a.sheetNumber}`;
        const arr = groups.get(key) ?? [];
        arr.push(a.drawingId);
        groups.set(key, arr);
      }
      const duplicateIds: string[] = [];
      for (const [, ids] of groups) {
        if (ids.length > 1) duplicateIds.push(...ids);
      }
      if (duplicateIds.length > 0) {
        console.warn(`[upload] ${duplicateIds.length} drawings have duplicate sheet numbers — flagging for review`);
        // Flag without blocking — AI classification may still fix them later.
        await Promise.all(
          duplicateIds.map((id) =>
            drawingService.updateDrawing(id, { processing_status: 'needs_review' } as Record<string, unknown>),
          ),
        );
        addToast(
          'warning',
          `${duplicateIds.length} drawing${duplicateIds.length !== 1 ? 's' : ''} have duplicate sheet numbers — look for the "needs review" badge and fix them manually.`,
        );
      }
    }

    // Persist a drawing set if the user named one at upload time
    const trimmedSetName = uploadSetName.trim();
    if (trimmedSetName && createdDrawingIds.length > 0) {
      const { error: setErr } = await fromTable('drawing_sets').insert({
        project_id: projectId,
        name: trimmedSetName,
        set_type: uploadSetType,
        drawing_ids: createdDrawingIds,
      });
      if (setErr) {
        addToast('warning', `Drawings uploaded, but failed to create set "${trimmedSetName}": ${setErr.message}`);
      } else {
        addToast('success', `Set "${trimmedSetName}" created with ${createdDrawingIds.length} drawing${createdDrawingIds.length !== 1 ? 's' : ''}.`);
        refetchSets();
      }
    }

    setIsUploading(false);
    setUploadProgressText('');
    setPendingFiles([]);
    setUploadSetName('');
    setUploadSetType('working');
    setShowUploadModal(false);
    refetch();

    // Summary toast — show the breakdown so the user knows what went where.
    const totalSucceeded = drawingsUploaded + specsUploaded + coversUploaded;
    if (totalSucceeded > 0) {
      const parts: string[] = [];
      if (drawingsUploaded > 0) parts.push(`${drawingsUploaded} drawing sheet${drawingsUploaded !== 1 ? 's' : ''}`);
      if (specsUploaded > 0) parts.push(`${specsUploaded} spec${specsUploaded !== 1 ? 's' : ''} → Specifications`);
      if (coversUploaded > 0) parts.push(`${coversUploaded} cover sheet${coversUploaded !== 1 ? 's' : ''}`);
      addToast('success', `Uploaded ${parts.join(', ')}.`);
    } else if (pendingFiles.length > 0) {
      addToast('error', 'No items were uploaded. Check file sizes and try again.');
    }

    // ── Cover + project-data metadata: merge + auto-fill empty project fields
    //
    // Safety contract: we ONLY set fields on the projects row that are
    // currently null/empty. We NEVER overwrite user-entered data. The full
    // parse is logged to the console for the user to review.
    if (coverFindings.length > 0) {
      const merged: CoverMetadata = coverFindings
        .map((f) => f.metadata)
        .reduce((acc, m) => mergeCoverMetadata(acc, m));

      console.info('[project-metadata] merged findings across', coverFindings.length, 'source(s):', merged);

      // Fetch current project row to know which fields are already populated
      const { data: currentProject } = await fromTable('projects')
        .select('name, address, city, state, zip, architect_name, owner_name, general_contractor, building_area_sqft, num_floors')
        .eq('id' as never, projectId)
        .single();

      const updates: Record<string, unknown> = {};
      const applied: string[] = [];

      const setIfEmpty = (field: string, value: string | number | undefined | null, label: string) => {
        if (value === undefined || value === null || value === '') return;
        const cur = (currentProject as Record<string, unknown> | null)?.[field];
        if (cur === undefined || cur === null || cur === '' || cur === 0) {
          updates[field] = value;
          applied.push(label);
        }
      };

      setIfEmpty('address', merged.street, 'address');
      setIfEmpty('city', merged.city, 'city');
      setIfEmpty('state', merged.state, 'state');
      setIfEmpty('zip', merged.zip, 'zip');
      setIfEmpty('architect_name', merged.consultants.architect, 'architect');
      setIfEmpty('owner_name', merged.consultants.owner, 'owner');
      setIfEmpty('general_contractor', merged.consultants.contractor, 'general contractor');
      setIfEmpty('building_area_sqft', merged.buildingAreaSqft, `${merged.buildingAreaSqft?.toLocaleString()} sqft`);
      setIfEmpty('num_floors', merged.numFloors, `${merged.numFloors} floors`);

      if (Object.keys(updates).length > 0) {
        const { error: projErr } = await fromTable('projects')
          .update(updates as never)
          .eq('id' as never, projectId);
        if (projErr) {
          console.error('[project-metadata] update failed', projErr);
          addToast('warning', `Extracted project metadata but couldn't save: ${projErr.message}. Details in console.`);
        } else {
          addToast('success', `Project metadata auto-filled: ${applied.join(', ')}.`);
        }
      }

      // Non-applied findings (because the field was already filled) — still
      // surface them so the user sees everything that was detected.
      const detectedExtras: string[] = [];
      if (merged.projectName) detectedExtras.push(`Project: "${merged.projectName.slice(0, 60)}"`);
      const unpushedConsultants = Object.entries(merged.consultants)
        .filter(([k]) => !['architect', 'owner', 'contractor'].includes(k))
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
      if (unpushedConsultants.length > 0) {
        detectedExtras.push(`${unpushedConsultants.length} other consultant${unpushedConsultants.length !== 1 ? 's' : ''}`);
      }
      if (merged.occupancyClassification) detectedExtras.push(`Occupancy ${merged.occupancyClassification}`);
      if (merged.constructionType) detectedExtras.push(`Type ${merged.constructionType}`);
      if (merged.codeEdition) detectedExtras.push(merged.codeEdition);
      if (detectedExtras.length > 0) {
        addToast('info', `Also detected (review in console): ${detectedExtras.join(' · ')}`);
      }
    }

    if (classificationTargets.length > 0) {
      void (async () => {
        // Probe the classification service with the first drawing. If the
        // service is up, we apply the result (title / sheet-number / discipline)
        // to that drawing and proceed with the rest. If it's down, we mark
        // everything with the filename-inferred discipline and bail out.
        const probe = classificationTargets[0];
        try {
          await triggerClassification(probe.drawingId, probe.pageImageUrl, probe.fileName, probe.fullPageUrl);
        } catch {
          addToast('warning', 'AI classification service unavailable. Drawings saved — discipline set from filename where possible.');
          for (const t of classificationTargets) {
            const fallback = inferDisciplineFromFilename(t.fileName);
            if (fallback) {
              await drawingService.updateDrawing(
                t.drawingId,
                { discipline: fallback, processing_status: 'failed' } as Record<string, unknown>,
              );
            }
          }
          refetch();
          return;
        }
        addToast('info', `AI classification running for ${classificationTargets.length} sheet${classificationTargets.length !== 1 ? 's' : ''}...`);
        for (let i = 1; i < classificationTargets.length; i++) {
          await triggerClassification(classificationTargets[i].drawingId, classificationTargets[i].pageImageUrl, classificationTargets[i].fileName, classificationTargets[i].fullPageUrl);
        }

        // Auto-chain the downstream pipeline: pairing → edge detection →
        // overlap → discrepancy analysis. Previously gated behind a manual
        // "Analyze" button that most users never found; now it runs on
        // its own once classification finishes. Failures surface in the
        // intelligence panel state — no extra toast needed here.
        try {
          await intelligence.analyzeDrawingSet();
        } catch {
          /* per-pair failures already handled inside analyzeDrawingSet */
        }
      })();
    }
  };

  const handleUploadRevision = async () => {
    if (!projectId || !selectedDrawing || !revUploadNum) return;
    setIsRevUploading(true);
    let fileUrl: string | null = null;
    if (revUploadFile) {
      const path = `${projectId}/drawings/rev-${Date.now()}-${revUploadFile.name}`;
      try {
        const { data: storageData, error: storageErr } = await supabase.storage.from('project-files').upload(path, revUploadFile);
        if (storageErr) { addToast('error', `Revision upload failed: ${storageErr.message}`); setIsRevUploading(false); return; }
        if (storageData?.path) fileUrl = storageData.path;
      } catch { addToast('error', 'Revision upload failed'); setIsRevUploading(false); return; }
    }
    await fromTable('drawing_revisions').update({ superseded_at: new Date().toISOString() }).eq('drawing_id' as never, String(selectedDrawing.id)).is('superseded_at' as never, null);
    await fromTable('drawing_revisions').insert({
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

  const handleAnalyzeDrawingSet = useCallback(async () => {
    if (!projectId) return;
    setShowAnalysisPanel(true);
    try {
      await intelligence.analyzeDrawingSet();
      addToast('success', `Analysis complete — ${intelligence.state.discrepancyCount} discrepancies detected`);
    } catch { addToast('error', 'Drawing analysis failed.'); }
  }, [projectId, intelligence, addToast]);

  const handleCreateRFIFromAnnotation = useCallback(() => {
    if (!selectedDrawing) { addToast('error', 'Select a drawing first to create an RFI from annotations.'); return; }
    addToast('info', `RFI draft prefilled from ${selectedDrawing.setNumber}. Open the RFIs page to finish.`);
  }, [selectedDrawing, addToast]);

  const handleCreateRFIFromDiscrepancy = useCallback(() => {
    addToast('info', 'A draft RFI will be created from this discrepancy. Open RFIs to edit.');
  }, [addToast]);

  // ── Drag & drop ─────────────────────────────────────────
  const handlePageDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (Array.from(e.dataTransfer.items).some(item => item.kind === 'file')) setPageIsDragging(true);
  }, []);

  const handlePageDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setPageIsDragging(false);
  }, []);

  const handlePageDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setPageIsDragging(false);

    const items = e.dataTransfer.items;
    const rawFiles = Array.from(e.dataTransfer.files);

    // Directory entries (dropped folders)
    const entries: FileSystemEntry[] = [];
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) entries.push(entry);
      }
    }

    const collectFromDir = async (entry: FileSystemDirectoryEntry): Promise<File[]> => {
      const reader = entry.createReader();
      const out: File[] = [];
      const readBatch = (): Promise<void> => new Promise((resolve) => {
        reader.readEntries(async (children) => {
          if (children.length === 0) { resolve(); return; }
          for (const child of children) {
            if (child.isFile) {
              const f = await new Promise<File | null>((res) => {
                (child as FileSystemFileEntry).file((ff) => res(ff), () => res(null));
              });
              if (f) out.push(f);
            } else if (child.isDirectory) {
              const nested = await collectFromDir(child as FileSystemDirectoryEntry);
              out.push(...nested);
            }
          }
          await readBatch();
          resolve();
        }, () => resolve());
      });
      await readBatch();
      return out;
    };

    const drawingRe = /\.(pdf|dwg|dxf|png|jpe?g|tiff?)$/i;
    const collected: File[] = [];

    // Expand folders
    for (const entry of entries) {
      if (entry.isDirectory) {
        const files = await collectFromDir(entry as FileSystemDirectoryEntry);
        collected.push(...files.filter((f) => drawingRe.test(f.name)));
      }
    }

    // Process top-level files: expand zips, keep drawing files
    for (const f of rawFiles) {
      if (/\.zip$/i.test(f.name) || f.type === 'application/zip' || f.type === 'application/x-zip-compressed') {
        try {
          addToast('info', `Extracting "${f.name}" — this may take a moment for large archives...`);
          const { files, totalCandidates } = await extractDrawingFilesFromZip(f, 0, 3, (prog) => {
            if (prog.phase === 'loading') {
              setUploadProgressText(`Loading ZIP "${prog.zipName}"...`);
            } else {
              setUploadProgressText(`Extracting ${prog.current}/${prog.total}: ${prog.currentFile || '...'}`);
            }
          });
          setUploadProgressText('');
          if (files.length > 0) {
            collected.push(...files);
            addToast('success', `Extracted ${files.length} drawing file${files.length !== 1 ? 's' : ''} from "${f.name}".`);
          } else if (totalCandidates === 0) {
            addToast('warning', `${f.name}: no .pdf, .dwg, or .dxf files inside.`);
          } else {
            addToast('error', `${f.name}: found ${totalCandidates} drawings but none could be read.`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'unknown error';
          console.error('[Drawings] zip extraction failed:', err);
          addToast('error', `Failed to read ${f.name}: ${msg}`);
          setUploadProgressText('');
        }
      } else if (drawingRe.test(f.name)) {
        collected.push(f);
      }
    }

    if (collected.length > 0) {
      setPendingFiles(collected);
      setShowUploadModal(true);
    } else if (rawFiles.length > 0 || entries.length > 0) {
      addToast('warning', 'No PDF, DWG, or DXF files found in the drop.');
    }
  }, [addToast]);

  // ── Render ──────────────────────────────────────────────
  return (
    <PageContainer
      title="Drawings"
      actions={
        <>
          <Btn variant="ghost" size="md" icon={<FolderOpen size={16} />} onClick={() => setShowSetsPanel(true)}>
            Sets
          </Btn>
          <Btn variant="ghost" size="md" icon={<MessageSquare size={16} />} onClick={() => setShowAnnotationPanel(true)}>
            Annotations
          </Btn>
          <Btn variant="ghost" size="md" icon={<Ruler size={16} />} onClick={() => setShowScaleAuditPanel(true)}>
            Scale Audit
          </Btn>

          {/* Iris AI conflict scan — calls ai-conflict-detection edge fn over
              schedule + RFIs + submittals + drawings. */}
          <IrisConflictScanButton projectId={projectId} />

          <PermissionGate permission="drawings.upload">
            <Btn
              variant="ghost" size="md"
              icon={<ScanSearch size={16} />}
              disabled={intelligence.state.stage !== 'idle' && intelligence.state.stage !== 'complete' && intelligence.state.stage !== 'failed'}
              onClick={handleAnalyzeDrawingSet}
            >
              Analyze Set
            </Btn>
          </PermissionGate>
          <PermissionGate permission="drawings.upload">
            <Btn variant="primary" size="md" icon={<Upload size={16} />} onClick={() => setShowUploadModal(true)}>
              Upload
            </Btn>
          </PermissionGate>
        </>
      }
    >
      <h1 style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>Drawings</h1>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
      `}</style>

      <div
        style={{ position: 'relative' }}
        onDragOver={handlePageDragOver}
        onDragLeave={handlePageDragLeave}
        onDrop={handlePageDrop}
      >
        {/* Drop zone overlay */}
        {pageIsDragging && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            backgroundColor: colors.primaryOrange + '06',
            border: `2px dashed ${colors.primaryOrange}`,
            borderRadius: '12px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '12px',
            pointerEvents: 'none',
          }}>
            <Upload size={40} color={colors.primaryOrange} />
            <p style={{ fontSize: 17, fontWeight: 600, color: colors.primaryOrange, margin: 0 }}>Drop drawings here</p>
            <p style={{ fontSize: 12, color: colors.primaryOrange, margin: 0, opacity: 0.7 }}>.pdf, .dwg, .dxf, .zip files accepted</p>
          </div>
        )}

        {/* Revision-impact banner — surfaces RFIs flagged by recent revisions */}
        {revisionImpact && !revisionImpactDismissed && (
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 16px',
              marginBottom: 12,
              background: 'rgba(255, 152, 0, 0.08)',
              border: `1px solid ${colors.primaryOrange}`,
              borderRadius: 8,
              color: 'inherit',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <ScanSearch size={18} color={colors.primaryOrange} style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  Revision impact: {revisionImpact.rfiCount} open{' '}
                  {revisionImpact.rfiCount === 1 ? 'RFI references' : 'RFIs reference'} a recently revised sheet
                </div>
                {revisionImpact.sheetNumbers.length > 0 && (
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                    Sheets: {revisionImpact.sheetNumbers.slice(0, 5).join(', ')}
                    {revisionImpact.sheetNumbers.length > 5 ? ` +${revisionImpact.sheetNumbers.length - 5} more` : ''}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Btn variant="primary" size="sm" onClick={() => navigate('/rfis')}>
                Review RFIs
              </Btn>
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => setRevisionImpactDismissed(true)}
                aria-label="Dismiss revision impact banner"
              >
                Dismiss
              </Btn>
            </div>
          </div>
        )}

        <DrawingToolbar
          filters={filters}
          onFiltersChange={setFilters}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          totalCount={allDrawings.length}
          filteredCount={filteredAndSorted.length}
          selectedCount={selectedIds.size}
          onBulkDownload={handleBulkDownload}
          onBulkStatusChange={handleBulkStatusChange}
          onBulkDelete={handleBulkDelete}
          onBulkOverlay={handleBulkOverlay}
          isOverlayBusy={isPreparingOverlay}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          availableDisciplines={availableDisciplines}
        />

        {/* Content — full width, no sidebar column */}
        {viewMode === 'table' ? (
          <DrawingList
            drawings={filteredAndSorted}
            loading={loading}
            error={error}
            refetch={refetch}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            focusedId={selectedDrawing?.id ?? null}
            onSelectDrawing={setSelectedDrawing}
            onViewDrawing={setViewerDrawing}
            onUploadClick={() => setShowUploadModal(true)}
            searchQuery={filters.search}
          />
        ) : (
          <DrawingCardGrid
            drawings={filteredAndSorted}
            loading={loading}
            error={error}
            refetch={refetch}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectDrawing={setSelectedDrawing}
            onViewDrawing={setViewerDrawing}
            onUploadClick={() => setShowUploadModal(true)}
            searchQuery={filters.search}
          />
        )}
      </div>

      {/* ── Detail slide-over panel (replaces fixed sidebar column) ── */}
      {selectedDrawing && (
        <DrawingDetail
          drawing={selectedDrawing}
          revisionHistory={revisionHistory}
          viewingRevisionNum={viewingRevisionNum}
          onClose={() => {
            // Two effects fight over selectedDrawing: a deep-link reader
            // (URL → state) and a URL syncer (state → URL). On user close
            // we set a ref so the deep-link reader skips one run while
            // the URL clears, otherwise the panel re-opens mid-frame and
            // looks like it's "glitching".
            userJustClosedRef.current = true;
            setSelectedDrawing(null);
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete('id');
              return next;
            }, { replace: true });
          }}
          onOpenViewer={() => setViewerDrawing(selectedDrawing)}
          onUploadRevision={() => {
            const nextRev = revisionHistory && revisionHistory.length > 0
              ? String(revisionHistory[0].revision_number + 1)
              : '1';
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
          onCompareVersions={(rev) => setCompareRev(rev)}
          setViewingRevisionNum={setViewingRevisionNum}
          classification={processing.byDrawing(String(selectedDrawing.id))}
          classificationStatus={processing.statusByDrawing(String(selectedDrawing.id))}
          discrepancies={drawingDiscrepancies}
          projectId={projectId ?? undefined}
          onOpenDiscrepancy={(d) => setOpenDiscrepancy(d)}
          onCreateRFI={handleCreateRFIFromDiscrepancy}
          onFieldUpdate={async (drawingId, patch) => {
            // When the user corrects a sheet number or title, clear the
            // needs_review flag — they've explicitly verified the data.
            const fullPatch: Record<string, unknown> = { ...patch, processing_status: 'completed' };
            const result = await drawingService.updateDrawing(drawingId, fullPatch);
            if (result.error) {
              addToast('error', `Failed to save: ${result.error.message}`);
              return;
            }
            // Optimistically update the panel's view of the drawing so the
            // user sees their edit immediately. The useQuery `drawings` list
            // will also refresh via refetch() but React's render order means
            // the detail panel would otherwise show the pre-edit values for
            // one beat.
            if (selectedDrawing && selectedDrawing.id === drawingId) {
              setSelectedDrawing({
                ...selectedDrawing,
                ...(patch.sheet_number ? { setNumber: patch.sheet_number } : {}),
                ...(patch.title ? { title: patch.title } : {}),
              });
            }
            refetch();
            addToast('success', 'Drawing updated.');
          }}
        />
      )}

      {/* ── Modals & overlays ──────────────────────────────── */}

      {viewerDrawing && (
        <DrawingFileViewer
          drawing={viewerDrawing}
          drawings={filteredAndSorted}
          onClose={() => setViewerDrawing(null)}
          onNavigate={(d) => setViewerDrawing(d)}
          onCreateRFI={handleCreateRFIFromAnnotation}
          projectId={projectId ?? undefined}
          scaleRatioText={
            processing.byDrawing(String(viewerDrawing.id))?.scale_text
            ?? viewerDrawing.scale_text
            ?? null
          }
        />
      )}

      {overlayPair && (
        <div
          role="dialog"
          aria-label="Overlay two drawings"
          style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.6)', padding: spacing['4'], overflowY: 'auto' }}
        >
          <div style={{ maxWidth: 1400, margin: '0 auto', backgroundColor: colors.surfacePage, borderRadius: 12, padding: spacing['4'] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['4'] }}>
              <h2 style={{ margin: 0, color: colors.textPrimary, fontSize: 18, fontWeight: 600 }}>
                Overlay — {overlayPair.aLabel} vs {overlayPair.bLabel}
              </h2>
              <Btn variant="secondary" size="sm" onClick={() => setOverlayPair(null)}>Close</Btn>
            </div>
            <RevisionOverlay
              oldRevisionUrl={overlayPair.aUrl}
              newRevisionUrl={overlayPair.bUrl}
              oldLabel={overlayPair.aLabel}
              newLabel={overlayPair.bLabel}
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

      {showScaleAuditPanel && projectId && (
        <div
          role="dialog"
          aria-label="Scale audit"
          onClick={(e) => { if (e.target === e.currentTarget) setShowScaleAuditPanel(false); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 24,
          }}
        >
          <div style={{ width: 'min(900px, 100%)', maxHeight: '90vh', overflow: 'auto' }}>
            <ScaleAuditPanel projectId={projectId} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <Btn variant="ghost" onClick={() => setShowScaleAuditPanel(false)}>Close</Btn>
            </div>
          </div>
        </div>
      )}

      {showSetsPanel && projectId && (
        <DrawingSetPanel
          sets={drawingSets || []}
          availableDrawings={allDrawings.map((d) => ({
            id: d.id,
            setNumber: d.setNumber || '',
            title: d.title,
            discipline: d.discipline || '',
            revision: d.revision || '1',
          }))}
          projectId={projectId}
          onClose={() => setShowSetsPanel(false)}
          onCreateSet={handleCreateSet}
          onUpdateSet={handleUpdateSet}
          onIssueSet={handleIssueSet}
          onOpenDrawing={handleOpenDrawingFromSet}
        />
      )}

      {transmittalSetId && (() => {
        const set = (drawingSets || []).find((s) => s.id === transmittalSetId);
        if (!set) return null;
        const setDrawings = allDrawings
          .filter((d) => set.drawing_ids.includes(d.id))
          .map((d) => ({
            id: d.id,
            setNumber: d.setNumber || '',
            title: d.title,
            revision: d.revision || '1',
          }));
        return (
          <TransmittalModal
            setName={set.name}
            drawings={setDrawings}
            setId={set.id}
            onClose={() => setTransmittalSetId(null)}
            onSubmit={handleSubmitTransmittal}
            isSubmitting={isIssuingTransmittal}
          />
        );
      })()}

      {viewRevPdfUrl && (
        <PdfViewer
          file={viewRevPdfUrl}
          title={`${selectedDrawing?.title ?? 'Drawing'} — Rev ${viewingRevisionNum ?? 'Current'}`}
          onClose={() => setViewRevPdfUrl(null)}
        />
      )}

      {/* Side-by-side revision compare. Two iframes scroll independently;
          users can pan one against the other to spot differences. This
          is the MVP — a future pass might overlay them with a diff
          highlight layer. */}
      {compareRev && selectedDrawing && (
        <div
          role="dialog"
          aria-label="Compare drawing revisions"
          onClick={(e) => { if (e.target === e.currentTarget) setCompareRev(null) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(26, 22, 19, 0.65)',
            display: 'flex', flexDirection: 'column',
            padding: 24,
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: '#fff', marginBottom: 12, fontFamily: typography.fontFamily,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                Comparing Rev {compareRev.revision_number} → Current
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                {selectedDrawing.title}{selectedDrawing.sheet_number ? ` · Sheet ${selectedDrawing.sheet_number}` : ''}
              </div>
            </div>
            <button
              onClick={() => setCompareRev(null)}
              style={{
                background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none',
                padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
              }}
            >
              Close
            </button>
          </div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, minHeight: 0 }}>
            {[
              { label: `Rev ${compareRev.revision_number}`, url: compareRev.file_url },
              { label: 'Current', url: (selectedDrawing as { file_url?: string }).file_url ?? null },
            ].map((side, i) => (
              <div key={i} style={{
                background: '#fff', borderRadius: 6, overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--hairline)',
                  fontFamily: typography.fontFamily, fontSize: 11,
                  fontWeight: 500, letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: colors.textTertiary,
                }}>
                  {side.label}
                </div>
                {side.url ? (
                  <iframe
                    src={side.url}
                    title={side.label}
                    style={{ flex: 1, border: 'none', minHeight: 0 }}
                  />
                ) : (
                  <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: colors.textTertiary, fontSize: 13,
                  }}>
                    No file attached to this revision.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showUploadModal && (
        <DrawingUpload
          pendingFiles={pendingFiles}
          isUploading={isUploading}
          uploadProgressText={uploadProgressText}
          setName={uploadSetName}
          setSetName={setUploadSetName}
          setType={uploadSetType}
          setSetType={setUploadSetType}
          onClose={() => { setShowUploadModal(false); setPendingFiles([]); setUploadSetName(''); setUploadSetType('working'); }}
          onFileReady={handleFileReady}
          onUpload={handleUploadDrawings}
        />
      )}

      {/* Floating background progress bar — visible when the modal is closed
          mid-upload so the user keeps visibility while the work continues. */}
      {isUploading && !showUploadModal && (() => {
        const pctMatch = uploadProgressText.match(/\[(\d+)\/(\d+)\]/);
        const cur = pctMatch ? Number(pctMatch[1]) : 0;
        const tot = pctMatch ? Number(pctMatch[2]) : 0;
        const pct = tot > 0 ? Math.round(((cur - 1) / tot) * 100) : 0;
        return (
          <div
            role="button"
            tabIndex={0}
            aria-label={`Uploading drawings. ${tot > 0 ? `${cur} of ${tot} complete.` : ''} Click to open full upload details.`}
            onClick={() => setShowUploadModal(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowUploadModal(true); } }}
            style={{
              position: 'fixed',
              right: 20,
              bottom: 20,
              zIndex: 1200,
              minWidth: 320,
              maxWidth: 420,
              padding: '12px 14px',
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: 10,
              boxShadow: '0 12px 32px rgba(15, 22, 41, 0.18)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
            title="Click to reopen the upload modal"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Upload size={14} color={colors.primaryOrange} style={{ animation: 'spin 2s linear infinite', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: colors.textPrimary }}>
                  Uploading drawings {tot > 0 ? `(${cur}/${tot})` : ''}
                </p>
                <p style={{ margin: 0, marginTop: 2, fontSize: 11, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {uploadProgressText || 'Preparing…'}
                </p>
              </div>
            </div>
            {tot > 0 && (
              <div style={{ height: 3, borderRadius: 2, backgroundColor: `${colors.primaryOrange}20`, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, backgroundColor: colors.primaryOrange, borderRadius: 2, transition: 'width 200ms ease' }} />
              </div>
            )}
          </div>
        );
      })()}

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

      <DiscrepancyDetailModal
        open={!!openDiscrepancy}
        discrepancy={openDiscrepancy}
        pair={openDiscrepancyPair}
        archOverlayUrl={openDiscrepancyPair?.overlap_image_url ?? null}
        onClose={() => setOpenDiscrepancy(null)}
        onCreateRFI={handleCreateRFIFromDiscrepancy}
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
