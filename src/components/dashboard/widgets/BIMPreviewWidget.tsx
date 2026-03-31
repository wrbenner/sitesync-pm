import React from 'react'
import { Box, ArrowRight } from 'lucide-react'
import { colors, spacing, typography, borderRadius, vizColors } from '../../../styles/theme'

export const BIMPreviewWidget: React.FC = React.memo(() => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
        <Box size={16} color={colors.textTertiary} />
        <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
          3D Site Model
        </span>
      </div>

      {/* Static building preview using CSS/SVG */}
      <div style={{
        flex: 1,
        backgroundColor: colors.statusInfoSubtle,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '120px',
      }}>
        {/* Simple isometric building illustration using divs */}
        <svg viewBox="0 0 200 150" width="100%" height="100%" style={{ maxHeight: '140px' }}>
          {/* Ground */}
          <rect x="30" y="120" width="140" height="4" rx="2" fill={colors.gray300} />

          {/* Building base */}
          <rect x="50" y="40" width="100" height="80" rx="2" fill={vizColors.gridLine} stroke={vizColors.gridLine} strokeWidth="0.5" />

          {/* Floors */}
          <line x1="50" y1="67" x2="150" y2="67" stroke={vizColors.gridLine} strokeWidth="0.5" />
          <line x1="50" y1="93" x2="150" y2="93" stroke={vizColors.gridLine} strokeWidth="0.5" />

          {/* Windows grid */}
          {[45, 71, 97].map((y) =>
            [60, 80, 100, 120, 135].map((x) => (
              <rect key={`${x}-${y}`} x={x} y={y} width="8" height="12" rx="1" fill={vizColors.neutral} />
            ))
          )}

          {/* MEP color indicators */}
          <line x1="55" y1="55" x2="145" y2="55" stroke={colors.chartRed} strokeWidth="1.5" strokeDasharray="4 3" />
          <line x1="55" y1="82" x2="145" y2="82" stroke={colors.statusInfoBright} strokeWidth="1.5" strokeDasharray="4 3" />
          <line x1="55" y1="107" x2="145" y2="107" stroke="#E8C84A" strokeWidth="1.5" strokeDasharray="4 3" /* decorative MEP yellow */ />

          {/* Roof */}
          <rect x="48" y="36" width="104" height="6" rx="1" fill={colors.gray500} />

          {/* Steel columns */}
          {[65, 100, 135].map((x) => (
            <rect key={x} x={x} y="40" width="3" height="80" fill={colors.gray600} />
          ))}
        </svg>

        {/* Overlay badge */}
        <div style={{
          position: 'absolute',
          bottom: spacing['2'],
          right: spacing['2'],
          backgroundColor: colors.overlayLight,
          borderRadius: borderRadius.sm,
          padding: `${spacing['1']} ${spacing['2']}`,
          fontSize: typography.fontSize.caption,
          color: colors.textSecondary,
          fontWeight: typography.fontWeight.medium,
        }}>
          3 floors · 6 systems
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing['3'] }}>
        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
          Last updated: Today
        </span>
        <a
          href="#/drawings"
          onClick={() => {
            // Navigate to drawings page 3D tab
            window.location.hash = '#/drawings';
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['1'],
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.semibold,
            color: colors.orangeText,
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          Open 3D Model <ArrowRight size={12} />
        </a>
      </div>
    </div>
  )
})
