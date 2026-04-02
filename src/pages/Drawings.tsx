import React, { useState, useRef } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { DrawingsEmptyState } from '../components/drawings/DrawingsEmptyState';
import { TableRowSkeleton } from '../components/ui/Skeletons';
import { Upload, X, Sparkles, FileText, AlertTriangle, AlertCircle, CheckCircle2, Loader2, ChevronRight } from 'lucide-react';
import { aiService } from '../lib/aiService';
import type { DrawingAnalysis } from '../types/ai';
import { PageContainer, Card, Btn, Tag, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';
import { getDrawings, getDisciplineColor } from '../api/endpoints/documents';
import { useQuery } from '../hooks/useQuery';
import { useProjectId } from '../hooks/useProjectId';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { getAnnotationsForEntity } from '../data/aiAnnotations';
import { DrawingViewer } from '../components/drawings/DrawingViewer';
import { PermissionGate } from '../components/auth/PermissionGate';


const aiChanges: Record<number, number> = { 1: 3, 5: 2, 11: 4 };

const linkedItems: Record<number, { rfis: number; submittals: number }> = {
  1: { rfis: 1, submittals: 0 },
  3: { rfis: 1, submittals: 1 },
  4: { rfis: 1, submittals: 1 },
  5: { rfis: 1, submittals: 0 },
  11: { rfis: 2, submittals: 1 },
};

const lastViewed: Record<number, string> = {
  1: '2h ago',
  2: '1d ago',
  3: '5h ago',
  4: '3d ago',
  5: '1h ago',
  6: '2d ago',
  7: 'Never',
  8: 'Never',
  9: '4d ago',
  10: 'Never',
  11: '30m ago',
  12: '1d ago',
};

const gridColumns = '60px 80px 1fr 120px 80px 100px 70px 120px 100px 70px 90px';

// Static coordination conflicts for the AI Insights panel
const coordinationConflicts = [
  { id: 'c1', drawing1: 'A-201', rev1: 'Rev 3', drawing2: 'S-101', location: 'Grid Line C4', discipline1: 'Architectural', discipline2: 'Structural', confidence: 0.94 },
  { id: 'c2', drawing1: 'M-301', rev1: 'Rev 2', drawing2: 'S-204', location: 'Level 3 ceiling plenum', discipline1: 'Mechanical', discipline2: 'Structural', confidence: 0.88 },
  { id: 'c3', drawing1: 'E-101', rev1: 'Rev 1', drawing2: 'P-201', location: 'Mechanical room west wall', discipline1: 'Electrical', discipline2: 'Plumbing', confidence: 0.76 },
  { id: 'c4', drawing1: 'FP-101', rev1: 'Rev 2', drawing2: 'A-301', location: 'Stairwell 3 soffit', discipline1: 'Fire Protection', discipline2: 'Architectural', confidence: 0.71 },
  { id: 'c5', drawing1: 'M-401', rev1: 'Rev 1', drawing2: 'E-202', location: 'Roof drain area B7', discipline1: 'Mechanical', discipline2: 'Electrical', confidence: 0.68 },
];

const _DrawingsPage: React.FC = () => {
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
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const sortedDrawings = [...filteredDrawings].sort((a, b) => {
    const aVal = (a as any)[sortField];
    const bVal = (b as any)[sortField];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  return (
    <PageContainer
      title="Drawings"
      actions={
        <PermissionGate permission="drawings.upload">
          <Btn variant="primary" size="md" icon={<Upload size={16} />} aria-label="Upload drawings" onClick={() => setShowUploadModal(true)}>
            Upload Drawings
          </Btn>
        </PermissionGate>
      }
    >
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
        .drawing-row:focus-visible{outline:2px solid #F47820;outline-offset:-2px;}
      `}</style>
      <div
        className="drawings-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: selectedDrawing ? '1fr 380px' : '1fr',
          gap: spacing.xl,
        }}
      >
        <div>
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
          <div style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#ffffff', paddingTop: spacing['2'], paddingBottom: spacing['2'], marginBottom: spacing.xl }}>
          <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
            {uniqueDisciplines.map((discipline) => {
              const isActive = activeFilters.has(discipline);
              const pillColor = getDisciplineColor(discipline);
              const count = allDrawings.filter((d) => d.discipline === discipline).length;
              return (
                <button
                  key={discipline}
                  aria-label={`Filter by ${discipline}`}
                  aria-pressed={isActive}
                  onClick={() => {
                    setActiveFilters((prev) => {
                      const next = new Set(prev);
                      if (next.has(discipline)) next.delete(discipline);
                      else next.add(discipline);
                      return next;
                    });
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing['1'],
                    padding: `${spacing.sm} ${spacing.md}`,
                    backgroundColor: isActive ? pillColor : 'transparent',
                    color: isActive ? '#ffffff' : pillColor,
                    border: `1.5px solid ${pillColor}`,
                    borderRadius: borderRadius.full,
                    cursor: 'pointer',
                    fontSize: typography.fontSize.sm,
                    fontFamily: typography.fontFamily,
                    fontWeight: typography.fontWeight.medium,
                    transition: `all ${transitions.quick}`,
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
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
          </div>

          {/* Results count — aria-live announces filter changes to screen readers */}
          <p
            aria-live="polite"
            style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginBottom: spacing.md }}
          >
            {sortedDrawings.length} drawing{sortedDrawings.length !== 1 ? 's' : ''}
            {activeFilters.size > 0 ? ` matching selected filters` : ''}
          </p>

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
                { field: 'date', label: 'Date' },
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
              <div role="alert" style={{ margin: spacing['4'], padding: spacing['4'], backgroundColor: '#fff', border: `1px solid ${colors.borderSubtle}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                <AlertCircle size={16} color={colors.statusCritical} style={{ flexShrink: 0 }} />
                <p style={{ flex: 1, margin: 0, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>Unable to load drawings. Check your connection and try again.</p>
                <Btn variant="secondary" size="sm" onClick={() => refetch()}>Retry</Btn>
              </div>
            )}
            {!loading && !error && (
              <div role="list" aria-label="Project drawings">
              <style>{`.drawing-row:focus-visible{outline:2px solid #F47820;outline-offset:-2px;}`}</style>
              {sortedDrawings.map((drawing, index) => {
              const thumbColor = drawing.disciplineColor || getDisciplineColor(drawing.discipline || '');
              const linked = linkedItems[drawing.id];
              const viewed = lastViewed[drawing.id];
              const rowBorder = index < sortedDrawings.length - 1 ? `1px solid ${colors.border}` : 'none';
              return (
                <React.Fragment key={drawing.id}>
                {/* Mobile card row */}
                <div
                  role="listitem"
                  tabIndex={0}
                  aria-label={`Drawing ${drawing.sheetNumber} ${drawing.title}, revision ${drawing.currentRevision?.revision_number ?? 0}, discipline ${drawing.disciplineLabel}`}
                  className="drawing-row drawing-row-mobile"
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
                  tabIndex={0}
                  aria-label={`Drawing ${drawing.sheetNumber} ${drawing.title}, revision ${drawing.currentRevision?.revision_number ?? 0}, discipline ${drawing.disciplineLabel}`}
                  className="drawing-row drawing-row-desktop"
                  onClick={() => setSelectedDrawing(drawing)}
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
                  <Tag label={drawing.discipline} />

                  {/* Revision */}
                  <div>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, display: 'block' }}>
                      Rev {drawing.currentRevision?.revision_number ?? drawing.revision}
                    </span>
                    {drawing.revisions.length > 1 && (
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                        {drawing.revisions.length} revisions
                      </span>
                    )}
                  </div>

                  {/* Date */}
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                    {drawing.date}
                  </span>

                  {/* Sheets */}
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                    {drawing.sheetCount}
                  </span>

                  {/* Linked */}
                  <span style={{ fontSize: typography.fontSize.sm }}>
                    {linked ? (
                      <span
                        style={{ color: colors.orangeText, cursor: 'pointer', fontSize: typography.fontSize.sm }}
                        onClick={(e) => { e.stopPropagation(); addToast('info', 'Opening linked items for ' + drawing.setNumber); }}
                      >
                        {linked.rfis} RFIs · {linked.submittals} Sub
                      </span>
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
                      <button
                        onClick={(e) => handleAnalyzeSheet(e, drawing)}
                        style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], padding: `4px ${spacing['2']}`, backgroundColor: `${colors.statusReview}10`, border: `1px solid ${colors.statusReview}30`, borderRadius: borderRadius.base, cursor: 'pointer', fontSize: typography.fontSize.caption, color: colors.statusReview, fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily, whiteSpace: 'nowrap' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${colors.statusReview}20`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = `${colors.statusReview}10`; }}
                      >
                        <Sparkles size={10} /> Analyze
                      </button>
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
                  <button
                    onClick={() => setShowUploadModal(true)}
                    style={{ backgroundColor: '#F47820', color: '#fff', borderRadius: 8, padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily }}
                  >
                    Upload Drawings
                  </button>
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
                <Btn variant="secondary" size="md" fullWidth onClick={() => addToast('info', 'AI Scan initiated for ' + selectedDrawing.setNumber)}>
                  AI Scan
                </Btn>
              </div>
            </Card>
          </div>
        )}
      </div>
      {viewerDrawing && (
        <DrawingViewer
          drawing={viewerDrawing}
          onClose={() => setViewerDrawing(null)}
        />
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

            {/* Drop zone */}
            <div
              style={{
                minHeight: 200,
                border: `2px dashed ${isDragging ? colors.primaryOrange : colors.border}`,
                borderRadius: borderRadius.md,
                backgroundColor: isDragging ? `${colors.primaryOrange}08` : colors.surfaceInset,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing['3'],
                cursor: 'pointer',
                transition: `border-color 0.15s, background-color 0.15s`,
                padding: spacing['6'],
                textAlign: 'center',
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const dropped = Array.from(e.dataTransfer.files).filter((f) =>
                  /\.(pdf|dwg|dxf)$/i.test(f.name)
                );
                if (dropped.length > 0) setUploadFiles(dropped);
              }}
            >
              <Upload size={32} color={isDragging ? colors.primaryOrange : colors.textTertiary} />
              <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>
                Drag and drop drawing files here, or click to browse
              </p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>
                Accepted formats: .pdf, .dwg, .dxf
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.dwg,.dxf"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  const selected = Array.from(e.target.files || []);
                  if (selected.length > 0) setUploadFiles(selected);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Selected files */}
            {uploadFiles.length > 0 && (
              <div style={{ marginTop: spacing['4'], display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                {uploadFiles.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    style={{
                      padding: `${spacing['2']} ${spacing['3']}`,
                      backgroundColor: colors.surfaceInset,
                      borderRadius: borderRadius.base,
                      border: `1px solid ${colors.borderSubtle}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
                      <FileText size={14} color={colors.textTertiary} />
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </span>
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, flexShrink: 0 }}>
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                    {/* Simulated progress bar */}
                    <div style={{ height: 4, backgroundColor: colors.border, borderRadius: borderRadius.full, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: '40%', backgroundColor: colors.borderSubtle, borderRadius: borderRadius.full }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Coming soon notice */}
            <div style={{ marginTop: spacing['4'], padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: `${colors.primaryOrange}0D`, border: `1px solid ${colors.primaryOrange}30`, borderRadius: borderRadius.base }}>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>
                Upload functionality coming soon. File selection is enabled for preview only.
              </p>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'], marginTop: spacing['5'] }}>
              <Btn variant="secondary" size="md" onClick={() => { setShowUploadModal(false); setUploadFiles([]); setIsDragging(false); }}>
                Cancel
              </Btn>
              <Btn variant="primary" size="md" icon={<Upload size={16} />} aria-label="Upload drawings" disabled>
                Upload
              </Btn>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export const Drawings: React.FC = () => (
  <ErrorBoundary message="Failed to load drawings. Retry">
    <_DrawingsPage />
  </ErrorBoundary>
);
