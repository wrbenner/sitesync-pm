import React, { useState } from 'react';
import { Upload, X, Sparkles, FileText } from 'lucide-react';
import { PageContainer, Card, Btn, Tag, Skeleton, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';
import { getDrawings } from '../api/endpoints/documents';
import { useQuery } from '../hooks/useQuery';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { getAnnotationsForEntity } from '../data/aiAnnotations';
import { DrawingViewer } from '../components/drawings/DrawingViewer';

const disciplineColorMap: Record<string, string> = {
  Architectural: '#3A7BC8',
  Structural: '#2D8A6E',
  Mechanical: '#F47820',
  Electrical: '#C4850C',
  Plumbing: '#7C5DC7',
  Landscape: '#2D8A6E',
  'Fire Protection': '#C93B3B',
  Civil: '#8C8580',
  'Interior Design': '#E07070',
};

const extraDrawings = [
  { id: 7, setNumber: 'L-001', title: 'Landscape and Site Plan', discipline: 'Landscape', disciplineColor: 'green', revision: 'A', date: '2025-03-10', sheetCount: 3 },
  { id: 8, setNumber: 'FP-001', title: 'Fire Protection System Layout', discipline: 'Fire Protection', disciplineColor: 'red', revision: 'B', date: '2025-03-14', sheetCount: 4 },
  { id: 9, setNumber: 'C-001', title: 'Civil Grading and Drainage', discipline: 'Civil', disciplineColor: 'gray', revision: 'C', date: '2025-03-08', sheetCount: 2 },
  { id: 10, setNumber: 'ID-001', title: 'Interior Design Lobby and Common Areas', discipline: 'Interior Design', disciplineColor: 'rose', revision: 'A', date: '2025-03-22', sheetCount: 6 },
  { id: 11, setNumber: 'A-002', title: 'Floor Plans Levels 1 through 6', discipline: 'Architectural', disciplineColor: 'purple', revision: 'D', date: '2025-03-21', sheetCount: 12 },
  { id: 12, setNumber: 'S-002', title: 'Connection Details and Schedules', discipline: 'Structural', disciplineColor: 'blue', revision: 'B', date: '2025-03-16', sheetCount: 8 },
];

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

const gridColumns = '60px 80px 1fr 120px 80px 100px 70px 120px 100px 70px';

export const Drawings: React.FC = () => {
  const { addToast } = useToast();
  const { data: drawings, loading } = useQuery('drawings', getDrawings);
  const [filter, setFilter] = useState('All');
  const [selectedDrawing, setSelectedDrawing] = useState<NonNullable<typeof drawings>[0] | null>(null);
  const [viewerDrawing, setViewerDrawing] = useState<NonNullable<typeof drawings>[0] | null>(null);
  const [sortField, setSortField] = useState<string>('setNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const disciplines = ['All', 'Architectural', 'Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Landscape', 'Fire Protection', 'Civil', 'Interior Design'];

  const allDrawings = [...(drawings || []), ...extraDrawings];
  const filteredDrawings =
    filter === 'All' ? allDrawings : allDrawings.filter((d) => d.discipline === filter);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const sortedDrawings = [...filteredDrawings].sort((a, b) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aVal = (a as any)[sortField];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        <Btn variant="primary" size="md" icon={<Upload size={16} />} onClick={() => addToast('success', 'Drawing set uploaded successfully')}>
          Upload Set
        </Btn>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selectedDrawing ? '1fr 380px' : '1fr',
          gap: spacing.xl,
        }}
      >
        <div>
          {/* AI Banner */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, marginBottom: spacing['4'], backgroundColor: `${colors.statusReview}06`, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusReview}` }}>
            <Sparkles size={14} color={colors.statusReview} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>AI detected 5 coordination conflicts between MEP and Structural drawings in the latest revision. Review recommended.</p>
              <button onClick={() => addToast('info', 'Navigating to conflict review')} style={{ marginTop: spacing['2'], padding: `${spacing['1']} ${spacing['3']}`, backgroundColor: colors.statusReview, color: 'white', border: 'none', borderRadius: borderRadius.base, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily, cursor: 'pointer' }}>View Conflicts</button>
            </div>
          </div>

          {/* Discipline filter pills */}
          <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.xl, flexWrap: 'wrap' }}>
            {disciplines.map((discipline) => {
              const isActive = filter === discipline;
              return (
                <button
                  key={discipline}
                  onClick={() => setFilter(discipline)}
                  style={{
                    padding: `${spacing.sm} ${spacing.lg}`,
                    backgroundColor: isActive ? colors.surfaceInset : 'transparent',
                    color: isActive ? colors.textPrimary : colors.textTertiary,
                    border: 'none',
                    borderRadius: borderRadius.full,
                    cursor: 'pointer',
                    fontSize: typography.fontSize.sm,
                    fontFamily: typography.fontFamily,
                    fontWeight: typography.fontWeight.medium,
                    transition: `all ${transitions.quick}`,
                  }}
                >
                  {discipline}
                </button>
              );
            })}
          </div>

          {/* Drawings Table */}
          <Card padding="0">
            {/* Custom sortable header */}
            <div style={{ display: 'grid', gridTemplateColumns: gridColumns, padding: `${spacing.md} ${spacing.lg}`, borderBottom: `1px solid ${colors.border}` }}>
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
                { field: '', label: '' },
              ].map((col, i) => (
                <button key={col.label || `col-${i}`} onClick={() => col.field && handleSort(col.field)} style={{ display: 'flex', alignItems: 'center', gap: 2, border: 'none', backgroundColor: 'transparent', cursor: col.field ? 'pointer' : 'default', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textTertiary, fontFamily: typography.fontFamily, padding: 0 }}>
                  {col.label}
                  {col.field && sortField === col.field && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </button>
              ))}
            </div>

            {loading && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: gridColumns, gap: spacing.md, padding: `${spacing.md} ${spacing.lg}`, borderBottom: i < 4 ? `1px solid ${colors.border}` : 'none' }}>
                <Skeleton width="48px" height="36px" borderRadius="4px" />
                <Skeleton width="50px" height="14px" />
                <Skeleton width="80%" height="14px" />
                <Skeleton width="70px" height="22px" borderRadius="12px" />
                <Skeleton width="45px" height="14px" />
                <Skeleton width="70px" height="14px" />
                <Skeleton width="30px" height="14px" />
                <Skeleton width="60px" height="14px" />
                <Skeleton width="40px" height="14px" />
                <Skeleton width="40px" height="22px" borderRadius="4px" />
              </div>
            ))}
            {!loading && sortedDrawings.map((drawing, index) => {
              const thumbColor = disciplineColorMap[drawing.discipline] || '#8C8580';
              const linked = linkedItems[drawing.id];
              const viewed = lastViewed[drawing.id];
              return (
                <div
                  key={drawing.id}
                  onClick={() => setSelectedDrawing(drawing)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: gridColumns,
                    padding: `${spacing.md} ${spacing.lg}`,
                    borderBottom: index < sortedDrawings.length - 1 ? `1px solid ${colors.border}` : 'none',
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
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
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
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                    Rev {drawing.revision}
                  </span>

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
                        style={{ color: colors.primaryOrange, cursor: 'pointer', fontSize: typography.fontSize.sm }}
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
                  <Btn variant="ghost" size="sm" onClick={() => { setViewerDrawing(drawing); }}>View</Btn>
                </div>
              );
            })}
            {!loading && sortedDrawings.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
                <FileText size={32} color="#A09890" style={{ marginBottom: '12px' }} />
                <p style={{ fontSize: '14px', fontWeight: 500, color: '#1A1613', margin: 0, marginBottom: '4px' }}>No drawings match your filters</p>
                <p style={{ fontSize: '13px', color: '#6B6560', margin: 0, marginBottom: '16px' }}>Try adjusting your discipline filter</p>
                <button onClick={() => setFilter('All')} style={{ padding: '6px 16px', backgroundColor: 'transparent', border: '1px solid #E5E1DC', borderRadius: '6px', fontSize: '13px', fontFamily: '"Inter", sans-serif', color: '#6B6560', cursor: 'pointer' }}>
                  Clear Filters
                </button>
              </div>
            )}
          </Card>
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
    </PageContainer>
  );
};
