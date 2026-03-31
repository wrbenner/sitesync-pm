import React from 'react'
import { colors, spacing, typography, borderRadius, zIndex } from '../../styles/theme'

export const SkipToContent: React.FC = () => (
  <a
    href="#main-content"
    style={{
      position: 'absolute',
      top: '-100px',
      left: spacing['4'],
      zIndex: zIndex.toast as number,
      padding: `${spacing['2']} ${spacing['4']}`,
      backgroundColor: colors.primaryOrange,
      color: colors.white,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.semibold,
      borderRadius: borderRadius.md,
      textDecoration: 'none',
      transition: 'top 0.2s',
    }}
    onFocus={(e) => { (e.currentTarget as HTMLAnchorElement).style.top = spacing['4'] }}
    onBlur={(e) => { (e.currentTarget as HTMLAnchorElement).style.top = '-100px' }}
  >
    Skip to content
  </a>
)
