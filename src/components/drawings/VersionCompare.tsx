import React, { useState } from 'react';
import { Columns, Layers, Sparkles } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

interface VersionCompareProps {
  currentRev: string;
  previousRev: string;
  drawingTitle: string;
}

type CompareMode = 'side-by-side' | 'overlay';

// Change detection results loaded from AI analysis via drawing_markups table
const mockChanges: Array<{ id: number; x: number; y: number; w: number; h: number; label: string; severity: 'warning' | 'info' }> = [];

export const VersionCompare: React.FC<VersionCompareProps> = ({ currentRev, previousRev, drawingTitle: _drawingTitle }) => {
  const [mode, setMode] = useState<CompareMode>('overlay');
  const [opacity, setOpacity] = useState(50);
  const [showChanges, setShowChanges] = useState(true);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['3']} 0`, flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: spacing['1'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, padding: 2 }}>
          <button
            onClick={() => setMode('overlay')}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing['1'],
              padding: `${spacing['1']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.full,
              backgroundColor: mode === 'overlay' ? colors.surfaceRaised : 'transparent',
              color: mode === 'overlay' ? colors.textPrimary : colors.textTertiary,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
              fontFamily: typography.fontFamily, cursor: 'pointer', boxShadow: mode === 'overlay' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Layers size={12} /> Overlay
          </button>
          <button
            onClick={() => setMode('side-by-side')}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing['1'],
              padding: `${spacing['1']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.full,
              backgroundColor: mode === 'side-by-side' ? colors.surfaceRaised : 'transparent',
              color: mode === 'side-by-side' ? colors.textPrimary : colors.textTertiary,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
              fontFamily: typography.fontFamily, cursor: 'pointer', boxShadow: mode === 'side-by-side' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Columns size={12} /> Side by Side
          </button>
        </div>

        {mode === 'overlay' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flex: 1, minWidth: 200 }}>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Rev {previousRev}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              style={{ flex: 1, accentColor: colors.primaryOrange }}
            />
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Rev {currentRev}</span>
          </div>
        )}

        <button
          onClick={() => setShowChanges(!showChanges)}
          style={{
            display: 'flex', alignItems: 'center', gap: spacing['1'],
            padding: `${spacing['1']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.full,
            backgroundColor: showChanges ? `${colors.statusReview}14` : 'transparent',
            color: showChanges ? colors.statusReview : colors.textTertiary,
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
            fontFamily: typography.fontFamily, cursor: 'pointer',
          }}
        >
          <Sparkles size={12} /> AI Changes ({mockChanges.length})
        </button>
      </div>

      {/* Compare viewport */}
      {mode === 'overlay' ? (
        <div style={{ flex: 1, position: 'relative', borderRadius: borderRadius.md, overflow: 'hidden', border: `1px solid ${colors.borderSubtle}` }}>
          {/* Previous revision (background) */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, #e8e0d8 0%, #d4ccc4 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: typography.fontSize.heading, color: 'rgba(0,0,0,0.08)', fontWeight: typography.fontWeight.semibold,
          }}>
            Rev {previousRev}
          </div>
          {/* Current revision (overlay with opacity) */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, #f0e8e0 0%, #e0d8d0 100%)',
            opacity: opacity / 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: typography.fontSize.heading, color: 'rgba(0,0,0,0.12)', fontWeight: typography.fontWeight.semibold,
          }}>
            Rev {currentRev}
          </div>

          {/* AI change highlights */}
          {showChanges && mockChanges.map((change) => (
            <div
              key={change.id}
              style={{
                position: 'absolute',
                left: `${change.x}%`, top: `${change.y}%`,
                width: `${change.w}%`, height: `${change.h}%`,
                border: `2px dashed ${change.severity === 'warning' ? colors.statusPending : colors.statusInfo}`,
                backgroundColor: `${change.severity === 'warning' ? colors.statusPending : colors.statusInfo}10`,
                borderRadius: borderRadius.sm,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title={change.label}
            >
              <span style={{
                fontSize: '9px', fontWeight: typography.fontWeight.semibold,
                color: change.severity === 'warning' ? colors.statusPending : colors.statusInfo,
                backgroundColor: colors.surfaceRaised, padding: '1px 4px', borderRadius: 3,
                whiteSpace: 'nowrap',
              }}>
                {change.label}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['2'] }}>
          <div style={{
            position: 'relative', borderRadius: borderRadius.md, overflow: 'hidden', border: `1px solid ${colors.borderSubtle}`,
            background: 'linear-gradient(135deg, #e8e0d8 0%, #d4ccc4 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: typography.fontSize.title, color: 'rgba(0,0,0,0.1)', fontWeight: typography.fontWeight.semibold }}>Rev {previousRev}</span>
            <div style={{ position: 'absolute', top: spacing['2'], left: spacing['2'], padding: `${spacing['1']} ${spacing['2']}`, backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.sm, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary }}>
              Previous: Rev {previousRev}
            </div>
          </div>
          <div style={{
            position: 'relative', borderRadius: borderRadius.md, overflow: 'hidden', border: `1px solid ${colors.borderSubtle}`,
            background: 'linear-gradient(135deg, #f0e8e0 0%, #e0d8d0 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: typography.fontSize.title, color: 'rgba(0,0,0,0.1)', fontWeight: typography.fontWeight.semibold }}>Rev {currentRev}</span>
            <div style={{ position: 'absolute', top: spacing['2'], left: spacing['2'], padding: `${spacing['1']} ${spacing['2']}`, backgroundColor: colors.primaryOrange, borderRadius: borderRadius.sm, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: 'white' }}>
              Current: Rev {currentRev}
            </div>
            {showChanges && mockChanges.map((change) => (
              <div key={change.id} style={{
                position: 'absolute', left: `${change.x}%`, top: `${change.y}%`,
                width: `${change.w}%`, height: `${change.h}%`,
                border: `2px dashed ${colors.statusPending}`, borderRadius: borderRadius.sm,
                backgroundColor: `${colors.statusPending}10`,
              }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
