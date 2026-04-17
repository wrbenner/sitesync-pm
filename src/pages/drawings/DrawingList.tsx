import React from 'react';
import { Upload, Sparkles, FileText, AlertTriangle, AlertCircle, CheckCircle2, Loader2, ChevronRight, ChevronDown } from 'lucide-react';
import { Card, Btn, Tag, useToast } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import { getDisciplineColor } from '../../api/endpoints/documents';
import { AIAnnotationIndicator } from '../../components/ai/AIAnnotation';
import { getAnnotationsForEntity } from '../../data/aiAnnotations';
import type { DrawingAnalysis } from '../../types/ai';
import type { DrawingRevision } from '../../types/api';
import { aiChanges, linkedItems, lastViewed, gridColumns, coordinationConflicts, formatRevDate } from './types';

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

interface DrawingListProps {
  drawings: DrawingItem[];
  loading: boolean;
  error: unknown;
  refetch: () => void;
  sortField: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: string) => void;
  activeFilters: Set<string>;
  setActiveFilters: (fn: (prev: Set<string>) => Set<string>) => void;
  allDrawings: DrawingItem[];
  focusedIndex: number;
  setFocusedIndex: (i: number) => void;
  gridRef: React.RefObject<HTMLDivElement>;
  onSelectDrawing: (d: DrawingItem) => void;
  onViewDrawing: (d: DrawingItem) => void;
  analyzingId: number | null;
  analysisResults: Record<number, DrawingAnalysis>;
  onAnalyzeSheet: (e: React.MouseEvent, d: DrawingItem) => void;
  openRevDropdownId: string | null;
  rowRevHistory: Record<string, DrawingRevision[]>;
  rowRevHistoryLoading: string | null;
  onRevDropdown: (e: React.MouseEvent, drawingId: string, drawingTitle: string, fallbackRevisions: DrawingRevision[]) => void;
  setOpenRevDropdownId: (id: string | null) => void;
  setViewRevPdfUrl: (url: string | null) => void;
  setViewingRevisionNum: (n: number | null) => void;
  setViewerDrawing: (d: DrawingItem | null) => void;
  setSelectedRevisions: (revs: DrawingRevision[]) => void;
  setComparisonMode: (v: boolean) => void;
  setShowUploadModal: (v: boolean) => void;
  showConflicts: boolean;
  setShowConflicts: (fn: (v: boolean) => boolean) => void;
  handleGridKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

export const DrawingList: React.FC<DrawingListProps> = ({
  drawings: sortedDrawings,
  loading,
  error,
  refetch,
  sortField,
  sortDir,
  onSort,
  activeFilters,
  setActiveFilters,
  allDrawings,
  focusedIndex,
  setFocusedIndex,
  gridRef,
  onSelectDrawing,
  onViewDrawing,
  analyzingId,
  analysisResults,
  onAnalyzeSheet,
  openRevDropdownId,
  rowRevHistory,
  rowRevHistoryLoading,
  onRevDropdown,
  setOpenRevDropdownId,
  setViewRevPdfUrl,
  setViewingRevisionNum,
  setViewerDrawing,
  setSelectedRevisions,
  setComparisonMode,
  setShowUploadModal,
  showConflicts,
  setShowConflicts,
  handleGridKeyDown,
}) => {
  const { addToast } = useToast();
  const uniqueDisciplines = Array.from(new Set(allDrawings.map((d) => d.discipline).filter(Boolean))) as string[];

  return (
    <div>
      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.lg, marginBottom: spacing.xl }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24 }}>
          <p style={{ margin: 0, fontSize: 12, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>Total Drawings</p>
          <span style={{ fontSize: 28, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{allDrawings.length}</span>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24 }}>
          <p style={{ margin: 0, fontSize: 12, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>Current Revisions</p>
          <span style={{ fontSize: 28, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{allDrawings.filter((d) => d.currentRevision !== null).length}</span>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24 }}>
          <p style={{ margin: 0, fontSize: 12, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>Pending Markups</p>
          <span style={{ fontSize: 28, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{Object.values(aiChanges).reduce((a, b) => a + b, 0)}</span>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24 }}>
          <p style={{ margin: 0, fontSize: 12, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>Disciplines</p>
          <span style={{ fontSize: 28, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{uniqueDisciplines.length}</span>
        </div>
      </div>

      {/* AI Insights Panel — only show when there are drawings to analyze */}
      {sortedDrawings.length > 0 && (
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
      )}

      {/* Discipline filter pills */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#ffffff', paddingTop: spacing['2'], paddingBottom: spacing['2'], marginBottom: spacing.xl }}>
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
                  display: 'flex', alignItems: 'center', gap: spacing['1'],
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
                  minHeight: '56px',
                }}
              >
                {discipline}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 18, height: 18, borderRadius: borderRadius.full,
                  backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : `${pillColor}22`,
                  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, padding: '0 4px',
                }}>
                  {count}
                </span>
              </button>
            );
          })}
          {activeFilters.size > 0 && (
            <button
              aria-label="Clear all discipline filters"
              onClick={() => setActiveFilters(() => new Set())}
              style={{
                padding: `${spacing.sm} ${spacing.md}`,
                backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                color: colors.textTertiary, textDecoration: 'underline', minHeight: '56px',
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginBottom: spacing.md }}>
        {activeFilters.size > 0
          ? `Showing ${sortedDrawings.length} of ${allDrawings.length} drawing${allDrawings.length !== 1 ? 's' : ''}`
          : `${sortedDrawings.length} drawing${sortedDrawings.length !== 1 ? 's' : ''}`}
      </p>
      <span aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
        {`Showing ${sortedDrawings.length} of ${allDrawings.length} drawings`}
      </span>

      {/* Drawings Table */}
      <div style={{ overflowX: 'auto' }}>
        <Card padding="0">
          {/* Header */}
          <div className="drawing-table-header" style={{ display: 'grid', gridTemplateColumns: gridColumns, padding: `${spacing.md} ${spacing.lg}`, borderBottom: `1px solid ${colors.border}` }}>
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
              <button key={col.label || `col-${i}`} onClick={() => col.field && onSort(col.field)} style={{ display: 'flex', alignItems: 'center', gap: 2, border: 'none', backgroundColor: 'transparent', cursor: col.field ? 'pointer' : 'default', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textTertiary, fontFamily: typography.fontFamily, padding: 0 }}>
                {col.label}
                {col.field && sortField === col.field && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </button>
            ))}
          </div>

          {loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'], padding: spacing['4'] }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: 200, borderRadius: 12, backgroundColor: colors.surfaceInset, border: `1px solid ${colors.borderSubtle}`, animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ flex: 1, backgroundColor: colors.borderSubtle }} />
                  <div style={{ padding: `${spacing['2']} ${spacing['3']}`, display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                    <div style={{ height: 12, borderRadius: 6, backgroundColor: colors.borderSubtle, width: '70%' }} />
                    <div style={{ height: 10, borderRadius: 6, backgroundColor: colors.borderSubtle, width: '45%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div role="alert" style={{ margin: spacing['4'], padding: spacing['4'], backgroundColor: '#fff', border: `1px solid ${colors.borderSubtle}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
              <AlertCircle size={16} color={colors.statusCritical} style={{ flexShrink: 0 }} />
              <p style={{ flex: 1, margin: 0, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>Unable to load drawings. Check your connection and try again.</p>
              <Btn variant="secondary" size="sm" onClick={() => refetch()}>Retry</Btn>
            </div>
          )}

          {!loading && !error && (
            <div role="list" aria-label="Project drawings" ref={gridRef} onKeyDown={handleGridKeyDown}>
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
                      onClick={() => onSelectDrawing(drawing)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectDrawing(drawing); } }}
                      style={{ display: 'none', padding: `${spacing.md} ${spacing.lg}`, borderBottom: rowBorder, cursor: 'pointer', alignItems: 'center', gap: spacing['3'], transition: `background-color ${transitions.quick}` }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <div style={{ width: 40, height: 32, borderRadius: borderRadius.sm, backgroundColor: thumbColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, flexShrink: 0 }}>
                        {drawing.discipline[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{drawing.title}</p>
                        <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{drawing.setNumber} · Rev {drawing.currentRevision?.revision_number ?? drawing.revision} · {drawing.discipline}</p>
                      </div>
                      <ChevronRight size={16} color={colors.textTertiary} style={{ flexShrink: 0 }} />
                    </div>
                    {/* Desktop table row */}
                    <div
                      role="listitem"
                      tabIndex={index === focusedIndex ? 0 : -1}
                      aria-label={ariaLabel}
                      className="drawing-row drawing-row-desktop"
                      onClick={() => { setFocusedIndex(index); onSelectDrawing(drawing); }}
                      onFocus={() => setFocusedIndex(index)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectDrawing(drawing); } }}
                      style={{ display: 'grid', gridTemplateColumns: gridColumns, padding: `${spacing.md} ${spacing.lg}`, borderBottom: rowBorder, cursor: 'pointer', alignItems: 'center', transition: `background-color ${transitions.quick}` }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <div style={{ width: 48, height: 36, borderRadius: borderRadius.sm, backgroundColor: thumbColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold }}>
                        {drawing.discipline[0]}
                      </div>
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{drawing.setNumber}</span>
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: thumbColor, flexShrink: 0, display: 'inline-block' }} />
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
                      <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: thumbColor, flexShrink: 0, display: 'inline-block' }} />
                        <Tag label={drawing.discipline} />
                      </span>
                      {/* Revision dropdown */}
                      <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          aria-label={`Revision history for ${drawing.setNumber}`}
                          aria-expanded={openRevDropdownId === String(drawing.id)}
                          aria-haspopup="listbox"
                          onClick={(e) => onRevDropdown(e, String(drawing.id), drawing.title, drawing.revisions)}
                          style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: typography.fontSize.sm, color: colors.textSecondary, background: 'none', border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base, cursor: 'pointer', padding: '2px 6px', fontFamily: typography.fontFamily, whiteSpace: 'nowrap', transition: `border-color ${transitions.quick}, color ${transitions.quick}` }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.primaryOrange; e.currentTarget.style.color = colors.primaryOrange; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.borderSubtle; e.currentTarget.style.color = colors.textSecondary; }}
                        >
                          Rev {drawing.currentRevision?.revision_number ?? drawing.revision}
                          <ChevronDown size={10} />
                        </button>
                        {openRevDropdownId === String(drawing.id) && (
                          <div role="listbox" aria-label={`Revision history for ${drawing.setNumber}`} style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 300, maxHeight: 320, overflowY: 'auto' }}>
                            <div style={{ padding: `${spacing['2']} ${spacing['3']}`, borderBottom: `1px solid ${colors.borderSubtle}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Revision History</span>
                              {(rowRevHistory[String(drawing.id)]?.length ?? 0) >= 2 && (
                                <button
                                  onClick={() => {
                                    const history = rowRevHistory[String(drawing.id)];
                                    const current = history.find((r) => !r.superseded_at) ?? history[0];
                                    const older = history.find((r) => r.id !== current.id) ?? history[1];
                                    setSelectedRevisions([older, current]);
                                    setComparisonMode(true);
                                    setOpenRevDropdownId(null);
                                  }}
                                  style={{ fontSize: typography.fontSize.caption, color: colors.primaryOrange, border: `1px solid ${colors.primaryOrange}40`, borderRadius: borderRadius.base, backgroundColor: 'transparent', cursor: 'pointer', padding: '2px 8px', fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.medium }}
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
                                    if (rev.file_url) { setViewRevPdfUrl(rev.file_url); }
                                    else { setViewingRevisionNum(isCurrent ? null : rev.revision_number); if (!isCurrent) setViewerDrawing({ ...drawing, revision: `Rev ${rev.revision_number}` }); }
                                    setOpenRevDropdownId(null);
                                  }}
                                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: 'transparent', border: 'none', borderBottom: `1px solid ${colors.borderSubtle}`, cursor: 'pointer', fontFamily: typography.fontFamily }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: 2 }}>
                                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Rev {rev.revision_number}</span>
                                    {isCurrent && <span style={{ fontSize: typography.fontSize.caption, color: colors.statusActive, backgroundColor: `${colors.statusActive}18`, padding: '1px 6px', borderRadius: borderRadius.full }}>Current</span>}
                                  </div>
                                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{formatRevDate(rev.issued_date)}{rev.issued_by ? ` · ${rev.issued_by}` : ''}</div>
                                  {rev.change_description && <div style={{ fontSize: typography.fontSize.caption, color: colors.gray600, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rev.change_description}</div>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                        {formatRevDate(drawing.currentRevision?.issued_date ?? null) !== '—' ? formatRevDate(drawing.currentRevision?.issued_date ?? null) : drawing.date}
                      </span>
                      {/* Status badge */}
                      {(() => {
                        const st = drawing.status ?? 'current';
                        const cfg: Record<string, { bg: string; color: string; label: string }> = {
                          current: { bg: `${colors.statusActive}18`, color: colors.statusActive, label: 'Current' },
                          superseded: { bg: `${colors.statusPending}18`, color: colors.statusPending, label: 'Superseded' },
                          draft: { bg: `${colors.statusReview}18`, color: colors.statusReview, label: 'Draft' },
                        };
                        const c = cfg[st] ?? cfg['current'];
                        return <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, padding: '2px 8px', borderRadius: borderRadius.full, backgroundColor: c.bg, color: c.color, whiteSpace: 'nowrap' }}>{c.label}</span>;
                      })()}
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>{drawing.sheetCount}</span>
                      {/* Linked items */}
                      <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], flexWrap: 'wrap' }}>
                        {linked ? (
                          <>
                            {linked.rfis > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: borderRadius.full, backgroundColor: `${colors.statusInfo}18`, color: colors.statusInfo, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={(e) => { e.stopPropagation(); addToast('info', `${linked.rfis} RFI${linked.rfis !== 1 ? 's' : ''} linked to ${drawing.setNumber}`); }}>{linked.rfis} RFI{linked.rfis !== 1 ? 's' : ''}</span>}
                            {linked.submittals > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: borderRadius.full, backgroundColor: `${colors.statusPending}18`, color: colors.statusPending, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={(e) => { e.stopPropagation(); addToast('info', `${linked.submittals} submittal${linked.submittals !== 1 ? 's' : ''} linked to ${drawing.setNumber}`); }}>{linked.submittals} Sub</span>}
                            {linked.rfis === 0 && linked.submittals === 0 && <span style={{ color: colors.textTertiary }}>—</span>}
                          </>
                        ) : <span style={{ color: colors.textTertiary }}>—</span>}
                      </span>
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>{viewed || '—'}</span>
                      <Btn variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onViewDrawing(drawing); }}>View</Btn>
                      {/* Analyze button */}
                      <div>
                        {analyzingId === drawing.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], padding: `4px ${spacing['2']}` }}>
                            <Loader2 size={12} color={colors.statusReview} style={{ animation: 'spin 1s linear infinite' }} />
                            <span style={{ fontSize: typography.fontSize.caption, color: colors.statusReview }}>Analyzing</span>
                          </div>
                        ) : analysisResults[drawing.id] ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], padding: `4px ${spacing['2']}`, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); addToast('info', `${analysisResults[drawing.id].drawingNumber} ${analysisResults[drawing.id].revision}: ${analysisResults[drawing.id].conflicts.length} conflict(s) found`); }}>
                            {analysisResults[drawing.id].conflicts.length > 0 ? <AlertTriangle size={12} color={colors.statusCritical} /> : <CheckCircle2 size={12} color={colors.statusActive} />}
                            <span style={{ fontSize: typography.fontSize.caption, color: analysisResults[drawing.id].conflicts.length > 0 ? colors.statusCritical : colors.statusActive, fontWeight: typography.fontWeight.semibold }}>{analysisResults[drawing.id].conflicts.length > 0 ? `${analysisResults[drawing.id].conflicts.length} conflicts` : 'No conflicts'}</span>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => onAnalyzeSheet(e, drawing)}
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
                <button onClick={() => setShowUploadModal(true)} style={{ backgroundColor: colors.primaryOrange, color: colors.white, borderRadius: borderRadius.lg, padding: `${spacing['3']} ${spacing['4']}`, border: 'none', cursor: 'pointer', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily, minHeight: '56px' }}>Upload Drawings</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing['6']} ${spacing['4']}`, textAlign: 'center' }}>
                <FileText size={32} color={colors.textTertiary} style={{ marginBottom: spacing['3'] }} />
                <p style={{ fontSize: typography.fontSize.body, fontWeight: 500, color: colors.textPrimary, margin: 0, marginBottom: spacing['1'] }}>No drawings match your filters</p>
                <p style={{ fontSize: typography.fontSize.sm, color: colors.gray600, margin: 0, marginBottom: spacing['4'] }}>Try adjusting your discipline filter</p>
                <button onClick={() => setActiveFilters(() => new Set())} style={{ padding: `${spacing['1']} ${spacing['4']}`, backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.gray600, cursor: 'pointer' }}>Clear filters</button>
              </div>
            )
          )}
        </Card>
      </div>
    </div>
  );
};
