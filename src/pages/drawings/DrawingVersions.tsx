import React from 'react';
import { X } from 'lucide-react';
import { Tag } from '../../components/Primitives';
import { VersionCompare } from '../../components/drawings/VersionCompare';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import type { DrawingRevision } from '../../types/api';
import { formatRevDate } from './types';

interface DrawingItem {
  id: string;
  title: string;
  setNumber: string;
  discipline: string;
  revision: string;
  date: string;
  status?: string;
  sheetCount?: number;
  currentRevision?: { revision_number: number; issued_date: string | null; issued_by?: string };
  revisions: DrawingRevision[];
}

// ── Version Compare Modal (from detail panel) ───────────────
interface VersionCompareModalProps {
  drawing: DrawingItem;
  revisionHistory: DrawingRevision[];
  compareRevAIdx: number;
  compareRevBIdx: number;
  setCompareRevAIdx: (i: number) => void;
  setCompareRevBIdx: (i: number) => void;
  onClose: () => void;
}

export const VersionCompareModal: React.FC<VersionCompareModalProps> = ({
  drawing,
  revisionHistory,
  compareRevAIdx,
  compareRevBIdx,
  setCompareRevAIdx,
  setCompareRevBIdx,
  onClose,
}) => {
  const formatRev = (dateStr: string | null): string => formatRevDate(dateStr);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Compare versions: ${drawing.title}`}
      style={{ position: 'fixed', inset: 0, zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 22, 41, 0.55)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{ backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg, border: `1px solid ${colors.borderSubtle}`, padding: spacing['5'], width: '90vw', maxWidth: 1100, height: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'], flexShrink: 0 }}>
          <h2 style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>Compare Revisions: {drawing.title}</h2>
          <button onClick={onClose} aria-label="Close revision compare" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textTertiary }}
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
              <label style={{ display: 'block', fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary, marginBottom: spacing['1'] }}>{label}</label>
              <select value={idx} onChange={(e) => setIdx(Number(e.target.value))} aria-label={`Select ${label}`} style={{ width: '100%', padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary, backgroundColor: colors.surfaceRaised, cursor: 'pointer' }}>
                {revisionHistory.map((rev, i) => (
                  <option key={rev.id} value={i}>Rev {rev.revision_number}{rev.issued_date ? ` — ${formatRev(rev.issued_date)}` : ''}{!rev.superseded_at ? ' (Current)' : ''}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Compare viewport */}
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
                        <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.white, backgroundColor: side === 'A' ? colors.statusInfo : colors.primaryOrange, padding: '2px 8px', borderRadius: borderRadius.full }}>{side}</span>
                        <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>Rev {rev.revision_number}</span>
                        {rev.issued_by && <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{rev.issued_by}</span>}
                        {!rev.superseded_at && <Tag label="Current" color={colors.statusActive} backgroundColor={`${colors.statusActive}18`} />}
                      </div>
                      <iframe src={rev.file_url ?? undefined} title={`Revision ${rev.revision_number} — ${drawing.title}`} style={{ flex: 1, border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, width: '100%' }} />
                    </div>
                  ))}
                </div>
              );
            }
            return (
              <VersionCompare
                currentRev={String(revA?.revision_number ?? revisionHistory[0].revision_number)}
                previousRev={String(revB?.revision_number ?? revisionHistory[1].revision_number)}
                drawingTitle={drawing.title}
                currentRevision={revA ?? revisionHistory[0]}
                previousRevision={revB ?? revisionHistory[1]}
                revisionHistory={revisionHistory}
              />
            );
          })()}
        </div>
      </div>
    </div>
  );
};

// ── Row-level comparison modal (from revision dropdown) ─────
interface ComparisonModalProps {
  compareDrawingTitle: string;
  selectedRevisions: [DrawingRevision, DrawingRevision];
  compareOpacity: number;
  setCompareOpacity: (v: number) => void;
  onClose: () => void;
}

export const ComparisonModal: React.FC<ComparisonModalProps> = ({
  compareDrawingTitle,
  selectedRevisions,
  compareOpacity,
  setCompareOpacity,
  onClose,
}) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label={`Compare revisions: ${compareDrawingTitle}`}
    style={{ position: 'fixed', inset: 0, zIndex: 1002, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 22, 41, 0.55)' }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    <div
      style={{ backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg, border: `1px solid ${colors.borderSubtle}`, padding: spacing['5'], width: '92vw', maxWidth: 1200, height: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'], flexShrink: 0 }}>
        <h2 style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>Compare Revisions: {compareDrawingTitle}</h2>
        <button onClick={onClose} aria-label="Close revision comparison" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textTertiary }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceInset; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <X size={16} />
        </button>
      </div>
      {/* Opacity slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['3'], flexShrink: 0, padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base }}>
        <label htmlFor="compare-opacity-slider" style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, whiteSpace: 'nowrap', fontWeight: typography.fontWeight.medium }}>Right panel opacity</label>
        <input id="compare-opacity-slider" type="range" min={0} max={100} value={compareOpacity} onChange={(e) => setCompareOpacity(Number(e.target.value))} style={{ flex: 1, accentColor: colors.primaryOrange }} aria-label="Right panel opacity for overlay comparison" />
        <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, minWidth: 36, textAlign: 'right' }}>{compareOpacity}%</span>
      </div>
      {/* Side-by-side viewers */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
        {[
          { rev: selectedRevisions[0], label: 'Older Revision', badge: 'A', badgeColor: colors.statusInfo, opacity: 1 },
          { rev: selectedRevisions[1], label: 'Current Revision', badge: 'B', badgeColor: colors.primaryOrange, opacity: compareOpacity / 100 },
        ].map(({ rev, label, badge, badgeColor, opacity }) => (
          <div key={rev.id} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, opacity }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'], flexShrink: 0 }}>
              <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.white, backgroundColor: badgeColor, padding: '2px 8px', borderRadius: borderRadius.full }}>{badge}</span>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>Rev {rev.revision_number} — {label}</span>
              {rev.issued_by && <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{rev.issued_by}</span>}
            </div>
            {rev.file_url ? (
              <iframe src={rev.file_url} title={`Rev ${rev.revision_number} — ${compareDrawingTitle}`} style={{ flex: 1, border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, width: '100%' }} />
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
);
