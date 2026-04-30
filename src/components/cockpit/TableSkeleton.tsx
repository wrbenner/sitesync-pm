// ─────────────────────────────────────────────────────────────────────────────
// TableSkeleton — placeholder rows for NeedsYouTable while data loads.
// Subtle pulse, no spinner. Reads as "still working" not "broken".
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { colors, typography, spacing } from '../../styles/theme'

interface TableSkeletonProps {
  rows?: number
}

const SHIMMER_KEYFRAMES = `
  @keyframes cockpit-shimmer {
    0%   { opacity: 0.5; }
    50%  { opacity: 0.85; }
    100% { opacity: 0.5; }
  }
`

function Bar({ width, height = 12 }: { width: number | string; height?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: typeof width === 'number' ? `${width}px` : width,
        height,
        background: colors.surfaceInset,
        borderRadius: 3,
        animation: 'cockpit-shimmer 1400ms ease-in-out infinite',
      }}
    />
  )
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 6 }) => (
  <>
    <style>{SHIMMER_KEYFRAMES}</style>
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: typography.fontFamily,
      }}
    >
      <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: colors.surfaceFlat }}>
        <tr>
          {['Type', 'What', 'Who', 'Due', '$', 'Age', 'Iris', ''].map((label, i) => (
            <th
              key={i}
              style={{
                padding: `${spacing[2]} ${spacing[4]}`,
                fontFamily: typography.fontFamily,
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: colors.ink3,
                borderBottom: `1px solid ${colors.borderDefault}`,
                background: colors.surfaceFlat,
                textAlign: i >= 3 && i <= 5 ? 'right' : 'left',
              }}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i} style={{ background: colors.surfaceRaised }}>
            <Td><Bar width={48} /></Td>
            <Td><Bar width={`${30 + ((i * 17) % 40)}%`} /></Td>
            <Td><Bar width={`${50 + ((i * 11) % 30)}%`} /></Td>
            <Td style={{ textAlign: 'right' }}><Bar width={36} /></Td>
            <Td style={{ textAlign: 'right' }}><Bar width={32} /></Td>
            <Td style={{ textAlign: 'right' }}><Bar width={24} /></Td>
            <Td><Bar width={48} /></Td>
            <Td><Bar width={12} /></Td>
          </tr>
        ))}
      </tbody>
    </table>
  </>
)

function Td({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td
      style={{
        padding: `${spacing[3]} ${spacing[4]}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
        verticalAlign: 'middle',
        ...style,
      }}
    >
      {children}
    </td>
  )
}

export default TableSkeleton
