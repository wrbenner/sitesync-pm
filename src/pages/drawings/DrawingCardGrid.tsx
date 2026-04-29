import React, { useMemo
} from 'react';
import { motion } from 'framer-motion';
import { FileText, Upload, Eye, Loader2, Zap } from 'lucide-react';
import { Btn } from '../../components/Primitives';
import { colors, typography
} from '../../styles/theme';
import type { DrawingItem } from './DrawingList';
import { formatRevDate } from './types';
import { useSignedUrl } from '../../hooks/useSignedUrl';
import { DISCIPLINE_COLORS, STATUS_CONFIG, groupByDiscipline } from './constants';

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
}

// ─── Styles (Linear-inspired: minimal, calm, content-first) ─────────────────

const S = {
  // Grid — generous let cards breathe
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '20px',
  } as React.CSSProperties,

  // Discipline group
  groupWrap: {
    marginBottom: '40px',
  } as React.CSSProperties,
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '16px',
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

  // Card — clean, quiet, content-first
  card: (isSelected: boolean, isFocused: boolean) => ({
    position: 'relative' as const,
    borderRadius: '12px',
    border: `1px solid ${isSelected ? colors.primaryOrange : colors.borderSubtle}`,
    overflow: 'hidden',
    cursor: 'pointer',
    backgroundColor: colors.surfaceRaised,
    transition: 'all 220ms ease',
    boxShadow: isSelected
      ? `0 0 0 1px ${colors.primaryOrange}`
      : isFocused
        ? '0 4px 16px rgba(0,0,0,0.06)'
        : '0 1px 3px rgba(0,0,0,0.02)',
  }),

  // Thumbnail
  thumbWrap: {
    height: '170px',
    overflow: 'hidden',
    backgroundColor: '#FAFAFA',
    position: 'relative' as const,
  } as React.CSSProperties,
  thumbImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    transition: 'transform 300ms ease',
  } as React.CSSProperties,
  thumbFallback: (color: string) => ({
    height: '170px',
    backgroundColor: `${color}05`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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

  // Card info — minimal, typographic
  info: {
    padding: '10px 12px 12px',
  } as React.CSSProperties,
  sheetNumber: {
    fontSize: '13px',
    fontWeight: 600,
    color: colors.textPrimary,
    fontFamily: typography.fontFamilyMono,
    margin: 0,
    marginBottom: '2px',
    letterSpacing: '-0.01em',
  } as React.CSSProperties,
  title: {
    margin: 0,
    fontSize: '11.5px',
    color: colors.textTertiary,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: 1.3,
  } as React.CSSProperties,
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '6px',
  } as React.CSSProperties,
  revBadge: {
    fontFamily: typography.fontFamilyMono,
    fontSize: '10px',
    fontWeight: 500,
    color: colors.textTertiary,
  } as React.CSSProperties,
  date: {
    fontSize: '10px',
    color: colors.textTertiary,
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
  error: _error,
  refetch: _refetch,
  selectedIds,
  onToggleSelect,
  onSelectDrawing,
  onViewDrawing,
  onUploadClick,
  searchQuery,
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
        {drawings.map((drawing, i) => (
          <motion.div
            key={drawing.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.4), ease: [0.16, 1, 0.3, 1] }}
          >
            <SheetCard
              drawing={drawing}
              isSelected={selectedIds.has(drawing.id)}
              onSelect={onSelectDrawing}
              onView={onViewDrawing}
              onToggleSelect={onToggleSelect}
            />
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {groups.map((group, gi) => (
        <motion.div
          key={group.discipline}
          style={S.groupWrap}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: gi * 0.06, ease: [0.16, 1, 0.3, 1] }}
        >
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
            {group.drawings.map((drawing, di) => (
              <motion.div
                key={drawing.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25, delay: gi * 0.06 + Math.min(di * 0.02, 0.3), ease: [0.16, 1, 0.3, 1] }}
              >
                <SheetCard
                  drawing={drawing}
                  isSelected={selectedIds.has(drawing.id)}
                  onSelect={onSelectDrawing}
                  onView={onViewDrawing}
                  onToggleSelect={onToggleSelect}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// ─── Sheet Card ─────────────────────────────────────────────────────────────

const SheetCard: React.FC<{
  drawing: DrawingItem;
  isSelected: boolean;
  onSelect: (d: DrawingItem) => void;
  onView: (d: DrawingItem) => void;
  onToggleSelect: (id: string) => void;
}> = ({ drawing, isSelected, onSelect, onView, onToggleSelect }) => {
  const [hovered, setHovered] = React.useState(false);
  const discColor = DISCIPLINE_COLORS[drawing.discipline] || DISCIPLINE_COLORS.unclassified;
  const statusKey = drawing.status || 'current';
  const badge = STATUS_CONFIG[statusKey] || STATUS_CONFIG.current;
  const rev = drawing.currentRevision?.revision_number ?? drawing.revision ?? '';
  const issuedDate = drawing.currentRevision?.issued_date
    ? formatRevDate(drawing.currentRevision.issued_date)
    : drawing.date || '';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${drawing.setNumber} ${drawing.title}`}
      onClick={() => onSelect(drawing)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(drawing); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...S.card(isSelected, hovered),
        transform: hovered ? 'translateY(-2px)' : 'none',
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

        {/* Status badge */}
        <span style={S.statusBadge(badge.bg, badge.color)}>
          {badge.label}
        </span>

        {/* Tile-ready indicator (deep-zoom available) */}
        {drawing.tile_status === 'ready' && (
          <div
            title="Deep-zoom tiles ready"
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              width: 22,
              height: 22,
              borderRadius: '6px',
              backgroundColor: 'rgba(78,200,150,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Zap size={12} color="#fff" />
          </div>
        )}

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
            top: '8px',
            left: '8px',
            opacity: isSelected || hovered ? 1 : 0,
            transition: 'opacity 150ms ease-out',
          }}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(drawing.id); }}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: colors.primaryOrange }}
          />
        </div>
      </div>

      {/* Info — clean typographic hierarchy */}
      <div style={S.info}>
        <p style={S.sheetNumber}>{drawing.setNumber || '—'}</p>
        <p style={S.title}>{drawing.title}</p>
        <div style={S.meta}>
          <span style={S.revBadge}>Rev {rev}</span>
          <span style={{ color: colors.borderSubtle, fontSize: 8 }}>·</span>
          {issuedDate && issuedDate !== '—' && (
            <span style={S.date}>
              {(() => {
                try {
                  const d = new Date(issuedDate);
                  return isNaN(d.getTime()) ? issuedDate : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                } catch { return issuedDate; }
              })()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
