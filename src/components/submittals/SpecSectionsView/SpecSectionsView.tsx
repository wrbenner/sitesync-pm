// Phase 4 — Spec Sections view.
//
// Groups submittals by csi_section. Each group's title is looked up from the
// global spec_sections reference table; when the lookup is missing, falls
// back to "{section} — Section description not available".
//
// Sections without a csi_section value are bucketed under "Unsectioned".

import React, { useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSubmittalsList, type SubmittalListRow } from '../../../hooks/useSubmittalsList'
import { useSpecSections } from '../../../hooks/useSpecSections'
import { GroupedSubmittalsView, type GroupBucket } from '../GroupedView/GroupedSubmittalsView'

const C = {
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  brandOrange: '#F47820',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface SpecSectionsViewProps {
  projectId: string
  resetToken: string
  numberingFormat: string
  filterFn?: (row: SubmittalListRow) => boolean
  selectionClearToken?: number
  onSelectionIdsChange?: (ids: string[]) => void
}

export const SpecSectionsView: React.FC<SpecSectionsViewProps> = ({
  projectId,
  resetToken,
  numberingFormat,
  filterFn,
  selectionClearToken,
  onSelectionIdsChange,
}) => {
  const navigate = useNavigate()
  const { rows, loading } = useSubmittalsList(projectId)

  const filteredRows = useMemo(() => (filterFn ? rows.filter(filterFn) : rows), [rows, filterFn])

  // Bucket rows by csi_section.
  const sectionMap = useMemo(() => {
    const map = new Map<string, SubmittalListRow[]>()
    for (const row of filteredRows) {
      const section = (row.csi_section as string | null | undefined)?.trim() || ''
      const key = section || '__unsectioned__'
      const list = map.get(key)
      if (list) list.push(row)
      else map.set(key, [row])
    }
    return map
  }, [filteredRows])

  // Stable, sorted list of section numbers (real sections first, "Unsectioned" last).
  const sectionKeys = useMemo(() => {
    const keys = Array.from(sectionMap.keys())
    return keys.sort((a, b) => {
      if (a === '__unsectioned__') return 1
      if (b === '__unsectioned__') return -1
      return a.localeCompare(b)
    })
  }, [sectionMap])

  const realSectionNumbers = useMemo(
    () => sectionKeys.filter((k) => k !== '__unsectioned__'),
    [sectionKeys],
  )
  const { byNumber } = useSpecSections(realSectionNumbers)

  const groups = useMemo<GroupBucket[]>(() => {
    return sectionKeys.map((key) => {
      const subs = sectionMap.get(key) ?? []
      if (key === '__unsectioned__') {
        return {
          id: key,
          label: 'Unsectioned',
          subtitle: 'Submittals without a CSI section assigned.',
          rows: subs,
        }
      }
      const lookup = byNumber[key]
      const title = lookup?.title ?? null
      const division = lookup ? `Division ${String(lookup.division).padStart(2, '0')} — ${lookup.division_title}` : null

      return {
        id: key,
        label: title ? `${key} ${title}` : key,
        subtitle: title ? division : 'Section description not available',
        rows: subs,
        actions: <OpenSpecBtn section={key} onClick={() => navigate(`/spec/${encodeURIComponent(key)}`)} />,
      }
    })
  }, [sectionKeys, sectionMap, byNumber, navigate])

  const emptyState = (
    <div style={{ textAlign: 'center', maxWidth: 460, fontFamily: FONT }}>
      <h3 style={{ margin: 0, fontSize: 14, color: C.ink2, fontWeight: 600 }}>No submittals yet</h3>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: C.ink3, lineHeight: 1.5 }}>
        Spec sections will appear once submittals are created.
      </p>
    </div>
  )

  return (
    <GroupedSubmittalsView
      projectId={projectId}
      viewType="spec_sections"
      resetToken={resetToken}
      numberingFormat={numberingFormat}
      groups={groups}
      selectionClearToken={selectionClearToken}
      onSelectionIdsChange={onSelectionIdsChange}
      emptyState={emptyState}
      loading={loading}
    />
  )
}

const OpenSpecBtn: React.FC<{ section: string; onClick: () => void }> = ({ section, onClick }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onClick() }}
    title={`Open spec PDF for section ${section}`}
    aria-label={`Open spec PDF for section ${section}`}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      padding: '4px 6px',
      border: `1px solid ${C.border}`,
      backgroundColor: '#fff',
      color: C.ink2,
      cursor: 'pointer',
      borderRadius: 3,
      fontSize: 11,
      fontWeight: 500,
      fontFamily: FONT,
    }}
  >
    <ExternalLink size={11} /> Open spec
  </button>
)

export default SpecSectionsView
