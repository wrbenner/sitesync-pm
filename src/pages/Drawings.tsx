import React, { useState, useEffect } from 'react';
import { Upload, X, Sparkles, FileText, Plus } from 'lucide-react';
import { PageContainer, Card, Btn, Tag, Skeleton, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { getAnnotationsForEntity } from '../data/aiAnnotations';
import { DrawingViewer } from '../components/drawings/DrawingViewer';
import { PdfViewer } from '../components/drawings/PdfViewer';
import { UppyUploader } from '../components/files/UppyUploader';
import { useFileStore } from '../stores/fileStore';
import { useProjectContext } from '../stores/projectContextStore';
import { useAuthStore } from '../stores/authStore';
import type { LocalDrawing } from '../stores/fileStore';

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

const aiChanges: Record<string, number> = {};
const linkedItems: Record<string, { rfis: number; submittals: number }> = {};

const gridColumns = '60px 80px 1fr 120px 80px 100px 70px 120px 70px';

export const Drawings: React.FC = () => {
  const { addToast } = useToast();
  const { drawings, loading, loadDrawings, uploadDrawingSet } = useFileStore();
  const { activeProject } = useProjectContext();
  const { profile } = useAuthStore();
  const [filter, setFilter] = useState('All');
  const [selectedDrawing, setSelectedDrawing] = useState<LocalDrawing | null>(null);
  const [viewerDrawing, setViewerDrawing] = useState<LocalDrawing | null>(null);
  const [pdfFile, setPdfFile] = useState<{ file: string | File; title: string } | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadSetNumber, setUploadSetNumber] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDiscipline, setUploadDiscipline] = useState('Architectural');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [sortField, setSortField] = useState<string>('set_number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const disciplines = ['All', 'Architectural', 'Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Landscape', 'Fire Protection', 'Civil', 'Interior Design'];

  useEffect(() => {
    if (activeProject?.id) {
      loadDrawings(activeProject.id);
    }
  }, [activeProject?.id, loadDrawings]);

  const filteredDrawings = filter === 'All' ? drawings : drawings.filter((d) => d.discipline === filter);

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

  const handleUploadSet = async () => {
    if (!uploadSetNumber.trim() || !uploadTitle.trim() || !activeProject || !profile) {
      addToast('error', 'Set number and title are required');
      return;
    }

    const { error } = await uploadDrawingSet(
      activeProject.id,
      profile.id,
      uploadSetNumber.trim(),
      uploadTitle.trim(),
      uploadDiscipline,
      uploadFiles,
    );

    if (error) {
      addToast('error', error);
    } else {
      addToast('success', `Drawing set ${uploadSetNumber} uploaded`);
      setShowUpload(false);
      setUploadSetNumber('');
      setUploadTitle('');
      setUploadFiles([]);
    }
  };

  const handleViewSheet = (drawing: LocalDrawing) => {
    // Check if any sheet has a localUrl (uploaded PDF)
    const sheetWithPdf = drawing.sheets?.find((s) => s.localUrl);
    if (sheetWithPdf?.localUrl) {
      setPdfFile({ file: sheetWithPdf.localUrl, title: `${drawing.set_number}: ${drawing.title}` });
    } else {
      // Fall back to the canvas drawing viewer
      setViewerDrawing(drawing);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: `${spacing['2']} ${spacing['3']}`,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.base,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surfacePage,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: typography.fontFamily,
  };

  return (
    <PageContainer
      title="Drawings"
      subtitle={`${drawings.length} drawing sets`}
      actions={
        <Btn variant="primary" size="md" icon={<Upload size={16} />} onClick={() => setShowUpload(!showUpload)}>
          Upload Set
        </Btn>
      }
    >
      {/* Upload Drawing Set Panel */}
      {showUpload && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['4'] }}>
            <h3 style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Upload Drawing Set
            </h3>
            <button onClick={() => setShowUpload(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: colors.textTertiary, display: 'flex' }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing['3'], marginBottom: spacing['4'] }}>
            <div>
              <label style={{ display: 'block', fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['1'] }}>Set Number *</label>
              <input value={uploadSetNumber} onChange={(e) => setUploadSetNumber(e.target.value)} placeholder="e.g., A-003" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['1'] }}>Title *</label>
              <input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="Drawing set title" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['1'] }}>Discipline</label>
              <select value={uploadDiscipline} onChange={(e) => setUploadDiscipline(e.target.value)} style={{ ...inputStyle, backgroundColor: colors.surfaceRaised }}>
                {disciplines.filter((d) => d !== 'All').map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          <UppyUploader
            onFilesSelected={(files) => setUploadFiles((prev) => [...prev, ...files])}
            accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.tiff"
            label="Drop drawing sheets here (PDF, DWG, images)"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'], marginTop: spacing['4'] }}>
            <Btn variant="secondary" onClick={() => setShowUpload(false)}>Cancel</Btn>
            <Btn onClick={handleUploadSet}>
              <Plus size={14} style={{ marginRight: spacing['1'] }} />
              Create Drawing Set
            </Btn>
          </div>
        </Card>
      )}

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
            <div style={{ display: 'grid', gridTemplateColumns: gridColumns, padding: `${spacing.md} ${spacing.lg}`, borderBottom: `1px solid ${colors.border}` }}>
              <span></span>
              {[
                { field: 'set_number', label: 'Set #' },
                { field: 'title', label: 'Title' },
                { field: 'discipline', label: 'Discipline' },
                { field: 'current_revision', label: 'Rev' },
                { field: 'created_at', label: 'Date' },
                { field: '', label: 'Sheets' },
                { field: '', label: 'Linked' },
                { field: '', label: '' },
              ].map((col, i) => (
                <button key={col.label || `col-${i}`} onClick={() => col.field && handleSort(col.field)} style={{ display: 'flex', alignItems: 'center', gap: 2, border: 'none', backgroundColor: 'transparent', cursor: col.field ? 'pointer' : 'default', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textTertiary, fontFamily: typography.fontFamily, padding: 0 }}>
                  {col.label}
                  {col.field && sortField === col.field && <span>{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>}
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
                <Skeleton width="40px" height="22px" borderRadius="4px" />
              </div>
            ))}
            {!loading && sortedDrawings.map((drawing, index) => {
              const thumbColor = disciplineColorMap[drawing.discipline] || '#8C8580';
              const linked = linkedItems[drawing.id];
              const sheetCount = drawing.sheets?.length ?? 0;
              const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

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
                  <div style={{ width: 48, height: 36, borderRadius: borderRadius.sm, backgroundColor: thumbColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold }}>
                    {drawing.discipline[0]}
                  </div>
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                    {drawing.set_number}
                  </span>
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                    {drawing.title}
                    {getAnnotationsForEntity('drawing', parseInt(drawing.id.replace(/\D/g, '')) || 0).map((ann) => (
                      <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                    ))}
                    {aiChanges[drawing.id] && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['1'], marginLeft: spacing['2'], padding: '1px 6px', backgroundColor: `${colors.statusReview}12`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusReview, whiteSpace: 'nowrap' }}>
                        <Sparkles size={10} /> {aiChanges[drawing.id]} AI changes
                      </span>
                    )}
                  </span>
                  <Tag label={drawing.discipline} />
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                    Rev {drawing.current_revision}
                  </span>
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                    {formatDate(drawing.created_at)}
                  </span>
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                    {sheetCount}
                  </span>
                  <span style={{ fontSize: typography.fontSize.sm }}>
                    {linked ? (
                      <span style={{ color: colors.primaryOrange, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); addToast('info', 'Opening linked items'); }}>
                        {linked.rfis} RFIs
                      </span>
                    ) : (
                      <span style={{ color: colors.textTertiary }}>{'\u2014'}</span>
                    )}
                  </span>
                  <Btn variant="ghost" size="sm" onClick={() => { handleViewSheet(drawing); }}>View</Btn>
                </div>
              );
            })}
            {!loading && sortedDrawings.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
                <FileText size={32} color="#A09890" style={{ marginBottom: '12px' }} />
                <p style={{ fontSize: '14px', fontWeight: 500, color: '#1A1613', margin: 0, marginBottom: '4px' }}>No drawings match your filters</p>
                <p style={{ fontSize: '13px', color: '#6B6560', margin: 0, marginBottom: '16px' }}>Try adjusting your discipline filter or upload a new set</p>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl }}>
                <div>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginBottom: spacing.xs }}>
                    {selectedDrawing.set_number}
                  </p>
                  <h3 style={{ fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary, margin: 0 }}>
                    {selectedDrawing.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDrawing(null)}
                  style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textTertiary, transition: `background-color ${transitions.quick}`, flexShrink: 0 }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl, marginBottom: spacing.xl }}>
                <div>
                  <p style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, margin: 0, marginBottom: spacing.xs }}>Discipline</p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>{selectedDrawing.discipline}</p>
                </div>
                <div>
                  <p style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, margin: 0, marginBottom: spacing.xs }}>Revision</p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>{selectedDrawing.current_revision}</p>
                </div>
                <div>
                  <p style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, margin: 0, marginBottom: spacing.xs }}>Sheets</p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>{selectedDrawing.sheets?.length ?? 0}</p>
                </div>
                {selectedDrawing.sheets && selectedDrawing.sheets.length > 0 && (
                  <div>
                    <p style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, margin: 0, marginBottom: spacing.sm }}>Sheet List</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                      {selectedDrawing.sheets.map((sheet) => (
                        <div
                          key={sheet.id}
                          onClick={() => {
                            if (sheet.localUrl) {
                              setPdfFile({ file: sheet.localUrl, title: `${sheet.sheet_number}: ${sheet.title}` });
                            }
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: spacing['2'],
                            padding: `${spacing['2']} ${spacing['3']}`,
                            backgroundColor: colors.surfaceFlat,
                            borderRadius: borderRadius.sm,
                            cursor: sheet.localUrl ? 'pointer' : 'default',
                            fontSize: typography.fontSize.sm,
                            color: colors.textPrimary,
                          }}
                        >
                          <FileText size={14} color={colors.textTertiary} />
                          <span style={{ flex: 1 }}>{sheet.sheet_number}</span>
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{sheet.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                <Btn variant="primary" size="md" fullWidth onClick={() => handleViewSheet(selectedDrawing)}>
                  Open Viewer
                </Btn>
                <Btn variant="secondary" size="md" fullWidth onClick={() => addToast('info', 'AI Scan initiated for ' + selectedDrawing.set_number)}>
                  AI Scan
                </Btn>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Canvas Drawing Viewer (existing) */}
      {viewerDrawing && (
        <DrawingViewer
          drawing={{
            setNumber: viewerDrawing.set_number,
            title: viewerDrawing.title,
            discipline: viewerDrawing.discipline,
            revision: viewerDrawing.current_revision,
          }}
          onClose={() => setViewerDrawing(null)}
        />
      )}

      {/* PDF Viewer */}
      {pdfFile && (
        <PdfViewer
          file={pdfFile.file}
          title={pdfFile.title}
          onClose={() => setPdfFile(null)}
        />
      )}
    </PageContainer>
  );
};
