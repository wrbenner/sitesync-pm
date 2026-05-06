/**
 * SearchResultRow — single row in the cross-project palette.
 *
 * Renders entity icon + project + title + snippet + status. Highlight
 * tokens get a subtle highlight (semibold + warmer ink, no background
 * change) so the matched terms scan visually without breaking the
 * design language.
 */

import React from 'react'
import { ChevronRight, FileText, MessageSquare, ClipboardList, Layers, Banknote, Calendar, Clock } from 'lucide-react'
import { colors, typography, spacing } from '../../styles/theme'
import { highlightSegments, snippet, type SearchRow } from '../../lib/search/ftsQuery'

const ICON_MAP: Record<string, React.ElementType> = {
  rfi: MessageSquare,
  submittal: FileText,
  change_order: Banknote,
  punch_item: ClipboardList,
  meeting: Calendar,
  daily_log: Clock,
  drawing: Layers,
}

const TYPE_LABEL: Record<string, string> = {
  rfi: 'RFI',
  submittal: 'Submittal',
  change_order: 'Change Order',
  punch_item: 'Punch',
  meeting: 'Meeting',
  daily_log: 'Daily Log',
  drawing: 'Drawing',
}

interface Props {
  row: SearchRow
  highlights: string[]
  /** Project name resolved by the parent — search rows only carry id. */
  projectName: string
  active: boolean
  onClick: () => void
}

export const SearchResultRow: React.FC<Props> = ({ row, highlights, projectName, active, onClick }) => {
  const Icon = ICON_MAP[row.entity_type] ?? FileText
  const titleSegs = highlightSegments(row.title, highlights)
  const bodyText = snippet(row.body, highlights, 120)
  const bodySegs = highlightSegments(bodyText, highlights)

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: spacing['3'],
        padding: `${spacing['2']} ${spacing['3']}`,
        background: active ? 'var(--color-primary-subtle)' : 'transparent',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background-color 80ms ease',
      }}
    >
      <Icon size={14} style={{ color: colors.ink3, flexShrink: 0, marginTop: 3 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: spacing['2'],
          fontFamily: typography.fontFamily, fontSize: 11, color: colors.ink3,
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          <span>{TYPE_LABEL[row.entity_type] ?? row.entity_type}</span>
          <span style={{ color: colors.ink4 }}>·</span>
          <span style={{ textTransform: 'none', letterSpacing: 0, color: colors.ink3 }}>
            {projectName}
          </span>
          {row.status && (
            <>
              <span style={{ color: colors.ink4 }}>·</span>
              <span style={{ color: colors.ink3 }}>{row.status}</span>
            </>
          )}
        </div>
        <div style={{ fontFamily: typography.fontFamilySerif, fontSize: 15, color: colors.ink, marginTop: 2, lineHeight: 1.3 }}>
          {titleSegs.map((s, i) => (
            <span key={i} style={s.highlighted ? { fontWeight: 600, color: colors.primaryOrange } : undefined}>{s.text}</span>
          ))}
        </div>
        {bodyText && (
          <div style={{ fontFamily: typography.fontFamily, fontSize: 12, color: colors.ink2, marginTop: 4, lineHeight: 1.45 }}>
            {bodySegs.map((s, i) => (
              <span key={i} style={s.highlighted ? { fontWeight: 500, color: colors.ink } : undefined}>{s.text}</span>
            ))}
          </div>
        )}
      </div>
      <ChevronRight size={14} style={{ color: active ? colors.primaryOrange : colors.ink4, flexShrink: 0, marginTop: 5 }} />
    </button>
  )
}
