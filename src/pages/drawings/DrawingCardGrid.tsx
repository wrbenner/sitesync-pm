import React, { useMemo } from 'react';
import { FileText, Upload, Eye, Loader2, MessageSquare, MessageCircle, Sparkles } from 'lucide-react';
import { Btn } from '../../components/Primitives';
import { colors, typography } from '../../styles/theme';
import type { DrawingItem } from './DrawingList';
import { formatRevDate } from './types';
import { useSignedUrl } from '../../hooks/useSignedUrl';
import { DISCIPLINE_COLORS, STATUS_CONFIG, groupByDiscipline } from './constants';

// Iris/AI accent — used for the "Iris analyzed" pill on classified sheets.
const IRIS_INDIGO = '#4F46E5';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DrawingCardGridProps {
  drawings: DrawingItem[];
  loading: boolean;
  error: unknown;
  refetch: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectDrawing: (d: DrawingItem) => void;
  onViewDrawing: (d: DrawingItem) => void;
  onUploadClick: () => void;
  searchQuery: string;
  /** ID of the keyboard-focused (j/k) sheet, used to highlight without
   *  hijacking selection. */
  focusedId?: string | null;
}

// ─── Styles (industrial: dense, content-first, no decorative motion) ────────

const S = {
  // Grid — 220px target card, generous gutters
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '16px',
  } as React.CSSProperties,

  // Discipline group
  groupWrap: {
    marginBottom: '32px',
  } as React.CSSProperties,
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
    padding: '0 2px',
  } as React.CSSProperties,
  groupBadge: (color: string) => ({
    width: 24,
    height: 24,
    borderRadius: '7px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 700,
    color: '#fff',
    backgroundColor: color,
    flexShrink: 0,
  } as React.CSSProperties),
  groupName: {
    fontSize: '13px',
    fontWeight: 600,
    color: colors.textPrimary,
    letterSpacing: '-0.01em',
  } as React.CSSProperties,
  groupCount: {
    fontSize: '12px',
    color: colors.textTertiary,
    fontWeight: 400,
  } as React.CSSProperties,

  // Card — flat, industrial, no shadow
  card: (isSelected: boolean, isFocused: boolean) => ({
    position: 'relative' as const,
    borderRadius: '8px',
    border: `1px solid ${isSelected ? colors.primaryOrange : isFocused ? colors.borderDefault : colors.borderSubtle}`,
    overflow: 'hidden',
    cursor: 'pointer',
    backgroundColor: colors.surfaceRaised,
    transition: 'border-color 120ms ease, background-color 120ms ease',
  }),

  // Thumbnail — sheet-aspect-ratio favoring portrait so sheet number reads
  // legibly when the source PDF is loaded; 200px tall + 80px info = ~280 card.
  thumbWrap: {
    height: '200px',
    overflow: 'hidden',
    backgroundColor: '#FAFAFA',
    position: 'relative' as const,
    borderBottom: `1px solid ${colors.borderSubtle}`,
  } as React.CSSProperties,
  thumbImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  } as React.CSSProperties,
  thumbFallback: (color: string) => ({
    height: '200px',
    backgroundColor: `${color}06`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: `1px solid ${colors.borderSubtle}`,
  } as React.CSSProperties),
  thumbFallbackText: (color: string) => ({
    fontSize: '24px',
    fontWeight: 600,
    color,
    fontFamily: typography.fontFamilyMono,
    opacity: 0.35,
  } as React.CSSProperties),

  // Status badge overlay — subtle, frosted glass
  statusBadge: (_bg: string, _color: string) => ({
    position: 'absolute' as const,
    top: '8px',
    right: '8px',
    padding: '2px 7px',
    borderRadius: '4px',
    backgroundColor: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    color: colors.textSecondary,
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  }),

  // Quick view on hover
  quickView: {
    position: 'absolute' as const,
    bottom: '8px',
    right: '8px',
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'rgba(255,255,255,0.9)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.textSecondary,
    opacity: 0,
    transition: 'opacity 150ms ease',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  } as React.CSSProperties,

  // Card info — sheet # is the headline; everything else is supporting.
  info: {
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '3px',
  } as React.CSSProperties,
  sheetNumber: {
    fontSize: '15px',
    fontWeight: 600,
    color: colors.textPrimary,
    fontFamily: typography.fontFamilyMono,
    margin: 0,
    letterSpacing: '-0.01em',
    fontVariantNumeric: 'tabular-nums',
  } as React.CSSProperties,
  title: {
    margin: 0,
    fontSize: '12px',
    color: colors.textSecondary,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: 1.3,
  } as React.CSSProperties,
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '4px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  revPill: {
    fontFamily: typography.fontFamily,
    fontSize: '11px',
    fontWeight: 500,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceInset,
    padding: '2px 7px',
    borderRadius: '4px',
    whiteSpace: 'nowrap' as const,
    fontVariantNumeric: 'tabular-nums',
  } as React.CSSProperties,
  countBadge: (color: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '11px',
    fontWeight: 500,
    color,
    fontVariantNumeric: 'tabular-nums' as const,
  } as React.CSSProperties),

  // Iris-analyzed pill — indigo, top-left of the thumbnail.
  irisPill: {
    position: 'absolute' as const,
    top: '8px',
    left: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    color: IRIS_INDIGO,
    fontSize: '9.5px',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    border: `1px solid ${IRIS_INDIGO}25`,
  } as React.CSSProperties,

  // Skeleton
  skeleton: {
    borderRadius: '12px',
    border: `1px solid ${colors.borderSubtle}`,
    overflow: 'hidden',
  } as React.CSSProperties,
  skeletonThumb: {
    height: '170px',
    backgroundColor: colors.surfaceInset,
  } as React.CSSProperties,
  skeletonBar: (width: string) => ({
    height: '10px',
    borderRadius: '5px',
    backgroundColor: colors.surfaceInset,
    width,
  } as React.CSSProperties),

  // Empty state
  empty: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '100px 24px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  emptyIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: `${colors.primaryOrange}06`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  } as React.CSSProperties,
} as const;

// ─── Thumbnail sub-component ────────────────────────────────────────────────

const DrawingThumbnail: React.FC<{
  thumbnailPath: string | null | undefined;
  sheetNumber: string;
  discColor: string;
  processing?: string;
}> = ({ thumbnailPath, sheetNumber, discColor, processing }) => {
  const signedUrl = useSignedUrl(thumbnailPath);

  if (processing === 'splitting' || processing === 'classifying') {
    return (
      <div style={S.thumbFallback(discColor)}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={20} color={discColor} style={{ animation: 'spin 1s linear infinite', marginBottom: '4px' }} />
          <span style={{ display: 'block', fontSize: '10px', color: colors.textTertiary, textTransform: 'capitalize' }}>
            {processing}...
          </span>
        </div>
      </div>
    );
  }

  if (signedUrl) {
    return (
      <div style={S.thumbWrap}>
        <img
          src={signedUrl}
          alt={`${sheetNumber}`}
          loading="lazy"
          style={S.thumbImage}
        />
      </div>
    );
  }

  return (
    <div style={S.thumbFallback(discColor)}>
      <span style={S.thumbFallbackText(discColor)}>
        {sheetNumber || '—'}
      </span>
    </div>
  );
};

// ─── Component ──────────────────────────────────────────────────────────────

export const DrawingCardGrid: React.FC<DrawingCardGridProps> = ({
  drawings,
  loading,
  selectedIds,
  onToggleSelect,
  onSelectDrawing,
  onViewDrawing,
  onUploadClick,
  searchQuery,
  focusedId,
}) => {
  const groups = useMemo(() => groupByDiscipline(drawings), [drawings]);

  // ── Loading skeleton — premium shimmer ───────────────────
  if (loading) {
    const shimmerStyle = (delay: number): React.CSSProperties => ({
      background: `linear-gradient(90deg, ${colors.surfaceInset} 25%, ${colors.surfaceHover} 37%, ${colors.surfaceInset} 63%)`,
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s ease-in-out infinite',
      animationDelay: `${delay}s`,
    })
    return (
      <div style={S.grid}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ ...S.skeleton, overflow: 'hidden' }}>
            <div style={{ ...S.skeletonThumb, ...shimmerStyle(i * 0.06) }} />
            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ ...S.skeletonBar('55%'), ...shimmerStyle(i * 0.06 + 0.1) }} />
              <div style={{ ...S.skeletonBar('35%'), ...shimmerStyle(i * 0.06 + 0.15) }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <div style={{ ...S.skeletonBar('40px'), height: 18, borderRadius: 4, ...shimmerStyle(i * 0.06 + 0.2) }} />
                <div style={{ ...S.skeletonBar('50px'), height: 18, borderRadius: 4, ...shimmerStyle(i * 0.06 + 0.25) }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────
  if (!loading && drawings.length === 0) {
    return (
      <div style={S.empty}>
        <div style={S.emptyIcon}>
          <FileText size={24} color={colors.primaryOrange} />
        </div>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: colors.textPrimary, marginBottom: '8px' }}>
          {searchQuery ? 'No drawings match your search' : 'No drawings yet'}
        </h3>
        <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary, maxWidth: '340px', marginBottom: '24px', lineHeight: 1.5 }}>
          {searchQuery
            ? 'Try adjusting your search terms or clearing filters.'
            : 'Upload construction drawings to get started.'}
        </p>
        {!searchQuery && (
          <Btn variant="primary" size="md" icon={<Upload size={16} />} onClick={onUploadClick}>
            Upload Drawings
          </Btn>
        )}
      </div>
    );
  }

  // ── Grouped grid ──────────────────────────────────────────
  // If searching (filters active), show flat grid without grouping
  const showFlat = searchQuery.length >= 2;

  if (showFlat) {
    return (
      <div style={S.grid}>
        {drawings.map((drawing) => (
          <SheetCard
            key={drawing.id}
            drawing={drawing}
            isSelected={selectedIds.has(drawing.id)}
            isFocused={focusedId === drawing.id}
            onSelect={onSelectDrawing}
            onView={onViewDrawing}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {groups.map((group) => (
        <div key={group.discipline} style={S.groupWrap}>
          {/* Discipline group header */}
          <div style={S.groupHeader}>
            <div style={S.groupBadge(group.color)}>
              {group.abbrev}
            </div>
            <span style={S.groupName}>{group.label}</span>
            <span style={S.groupCount}>{group.drawings.length}</span>
          </div>

          {/* Sheet cards */}
          <div style={S.grid}>
            {group.drawings.map((drawing) => (
              <SheetCard
                key={drawing.id}
                drawing={drawing}
                isSelected={selectedIds.has(drawing.id)}
                isFocused={focusedId === drawing.id}
                onSelect={onSelectDrawing}
                onView={onViewDrawing}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Sheet Card ─────────────────────────────────────────────────────────────

function shortIssuedDate(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  } catch {
    return raw;
  }
}

/** A drawing has been "Iris analyzed" once the classifier pipeline produced
 *  a real discipline (anything other than 'unclassified'). The signal lives
 *  in the existing data — no new field needed. */
function wasIrisAnalyzed(drawing: DrawingItem): boolean {
  const disc = (drawing.discipline || '').toLowerCase();
  if (!disc || disc === 'unclassified') return false;
  // 'splitting' / 'classifying' / 'pending' all imply not-yet-done.
  const stage = drawing.processing_status?.toLowerCase() ?? '';
  if (stage && stage !== 'completed' && stage !== 'classified' && stage !== 'ready') return false;
  return true;
}

const SheetCard: React.FC<{
  drawing: DrawingItem;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: (d: DrawingItem) => void;
  onView: (d: DrawingItem) => void;
  onToggleSelect: (id: string) => void;
}> = ({ drawing, isSelected, isFocused, _onSelect, onView, onToggleSelect }) => {
                                        void _onSelect;
  const [hovered, setHovered] = React.useState(false);
  const discColor = DISCIPLINE_COLORS[drawing.discipline] || DISCIPLINE_COLORS.unclassified;
  const statusKey = drawing.status || 'current';
  const badge = STATUS_CONFIG[statusKey] || STATUS_CONFIG.current;
  const rev = drawing.currentRevision?.revision_number ?? drawing.revision ?? '';
  const issuedDate = drawing.currentRevision?.issued_date ?? null;
  const issuedShort = shortIssuedDate(issuedDate);
  const markupCount = drawing.markupCount ?? 0;
  const rfiCount = drawing.linkedRfiCount ?? 0;
  const irisAnalyzed = wasIrisAnalyzed(drawing);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${drawing.setNumber} ${drawing.title}`}
      data-drawing-id={drawing.id}
      onClick={() => onView(drawing)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(drawing); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...S.card(isSelected, isFocused || hovered),
        backgroundColor: isFocused ? colors.surfaceHover : colors.surfaceRaised,
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <DrawingThumbnail
          thumbnailPath={drawing.thumbnail_url}
          sheetNumber={drawing.setNumber || '—'}
          discColor={discColor}
          processing={drawing.processing_status}
        />

        {/* Iris-analyzed pill (top-left) */}
        {irisAnalyzed && (
          <span style={S.irisPill} title="Iris classified this sheet">
            <Sparkles size={9} strokeWidth={2.5} />
            Iris analyzed
          </span>
        )}

        {/* Status badge (top-right) */}
        <span style={S.statusBadge(badge.bg, badge.color)}>
          {badge.label}
        </span>

        {/* Quick view button — visible on hover */}
        <button
          onClick={(e) => { e.stopPropagation(); onView(drawing); }}
          aria-label={`Open ${drawing.setNumber}`}
          style={{ ...S.quickView, opacity: hovered ? 1 : 0 }}
        >
          <Eye size={15} />
        </button>

        {/* Selection checkbox — visible on hover or when selected */}
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            opacity: isSelected || hovered ? 1 : 0,
            transition: 'opacity 120ms ease-out',
          }}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(drawing.id); }}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            aria-label={`Select ${drawing.setNumber}`}
            style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: colors.primaryOrange }}
          />
        </div>
      </div>

      {/* Info — sheet # is the headline */}
      <div style={S.info}>
        <p style={S.sheetNumber}>{drawing.setNumber || '—'}</p>
        <p style={S.title} title={drawing.title}>{drawing.title}</p>
        <div style={S.meta}>
          <span style={S.revPill} title={issuedDate ? `Issued ${formatRevDate(issuedDate)}` : 'No issue date recorded'}>
            Rev {rev}{issuedShort ? ` — Issued ${issuedShort}` : ''}
          </span>
          {markupCount > 0 && (
            <span
              style={S.countBadge(colors.primaryOrange)}
              title={`${markupCount} markup${markupCount === 1 ? '' : 's'} on this sheet`}
            >
              <MessageSquare size={11} strokeWidth={2.25} />
              {markupCount}
            </span>
          )}
          {rfiCount > 0 && (
            <span
              style={S.countBadge(colors.textSecondary)}
              title={`${rfiCount} linked RFI${rfiCount === 1 ? '' : 's'}`}
            >
              <MessageCircle size={11} strokeWidth={2.25} />
              {rfiCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
