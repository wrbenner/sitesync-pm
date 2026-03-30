import React from 'react'
import { colors, typography, borderRadius } from '../../styles/theme'

export const SkipToContent: React.FC = () => (
  <a
    href="#main-content"
    style={{
      position: 'absolute',
      top: '-100px',
      left: '16px',
      zIndex: 9999,
      padding: '8px 16px',
      backgroundColor: colors.primaryOrange,
      color: 'white',
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.semibold,
      borderRadius: borderRadius.md,
      textDecoration: 'none',
      transition: 'top 0.2s',
    }}
    onFocus={(e) => { (e.currentTarget as HTMLAnchorElement).style.top = '16px' }}
    onBlur={(e) => { (e.currentTarget as HTMLAnchorElement).style.top = '-100px' }}
  >
    Skip to content
  </a>
)
