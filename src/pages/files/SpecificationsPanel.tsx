import React, { useMemo, useState } from 'react'
import { BookOpen, Search, ExternalLink } from 'lucide-react'
import { Card, SectionHeader, MetricBox, Btn, Skeleton, InputField, EmptyState } from '../../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { useProjectId } from '../../hooks/useProjectId'
import { useSpecifications } from '../../hooks/queries/specifications'

type SpecRow = {
  id: string
  section_number: string
  title: string
  division: string | null
  status: string
  revision: string | null
  responsible_party: string | null
}

const CSI_DIVISIONS: Record<number, string> = {
  1: 'General Requirements', 2: 'Existing Conditions', 3: 'Concrete', 4: 'Masonry',
  5: 'Metals', 6: 'Wood & Plastics', 7: 'Thermal & Moisture', 8: 'Openings',
  9: 'Finishes', 10: 'Specialties', 11: 'Equipment', 12: 'Furnishings',
  13: 'Special Construction', 14: 'Conveying Systems', 21: 'Fire Suppression',
  22: 'Plumbing', 23: 'HVAC', 26: 'Electrical', 27: 'Communications',
  28: 'Electronic Safety', 31: 'Earthwork', 32: 'Exterior Improvements', 33: 'Utilities',
}

const STATUS_STYLES: Record<string, { c: string; bg: string }> = {
  draft: { c: colors.textTertiary, bg: colors.surfaceInset },
  for_review: { c: colors.statusPending, bg: colors.statusPendingSubtle },
  approved: { c: colors.statusActive, bg: colors.statusActiveSubtle },
  superseded: { c: colors.statusCritical, bg: colors.statusCriticalSubtle },
}

export const SpecificationsPanel: React.FC = () => {
  const projectId = useProjectId()
  const { data, isLoading } = useSpecifications(projectId ?? undefined)

  const [searchText, setSearchText] = useState('')
  const [selectedDivision, setSelectedDivision] = useState<number | null>(null)

  const list = (data ?? []) as unknown as SpecRow[]

  const filtered = useMemo(() => {
    let result = list
    if (selectedDivision !== null) result = result.filter((s) => s.division === String(selectedDivision))
    if (searchText) {
      const q = searchText.toLowerCase()
      result = result.filter((s) =>
        s.section_number.toLowerCase().includes(q) || s.title.toLowerCase().includes(q),
      )
    }
    return result
  }, [list, selectedDivision, searchText])

  const divisionCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const s of list) {
      if (s.division) {
        const d = parseInt(String(s.division), 10)
        if (!isNaN(d)) counts[d] = (counts[d] || 0) + 1
      }
    }
    return counts
  }, [list])

  const approvedCount = list.filter((s) => s.status === 'approved').length

  if (!projectId) {
    return <EmptyState icon={<BookOpen size={32} />} title="No project selected" description="Select a project to view specifications." />
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['4'] }}>
        <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
          CSI MasterFormat sections linked to submittals and RFIs
        </div>
        <Btn variant="ghost" size="sm" icon={<ExternalLink size={14} />} onClick={() => { window.location.href = '/specifications' }}>
          Manage specs
        </Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: spacing['4'], marginBottom: spacing['4'] }}>
        <MetricBox label="Total Sections" value={list.length} />
        <MetricBox label="Divisions" value={Object.keys(divisionCounts).length} />
        <MetricBox label="Approved" value={approvedCount} />
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="56px" />)}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={32} />}
          title="No specifications"
          description="Specification sections will appear here. Use the full Specifications page to add, edit, or approve sections."
        />
      ) : (
        <>
          <div style={{ marginBottom: spacing['3'] }}>
            <InputField value={searchText} onChange={setSearchText} placeholder="Search by section number or title..." icon={<Search size={16} />} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: spacing['4'] }}>
            <Card padding={spacing['3']}>
              <SectionHeader title="Divisions" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'], marginTop: spacing['2'] }}>
                <button
                  onClick={() => setSelectedDivision(null)}
                  style={{
                    padding: `${spacing['2']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.base,
                    cursor: 'pointer', textAlign: 'left', fontSize: typography.fontSize.sm,
                    backgroundColor: selectedDivision === null ? colors.surfaceInset : 'transparent',
                    color: selectedDivision === null ? colors.orangeText : colors.textPrimary,
                  }}
                >
                  All Divisions ({list.length})
                </button>
                {Object.keys(CSI_DIVISIONS).map((divStr) => {
                  const div = parseInt(divStr, 10)
                  const count = divisionCounts[div] || 0
                  if (count === 0) return null
                  const isSelected = selectedDivision === div
                  return (
                    <button
                      key={div}
                      onClick={() => setSelectedDivision(div)}
                      style={{
                        padding: `${spacing['2']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.base,
                        cursor: 'pointer', textAlign: 'left', fontSize: typography.fontSize.sm,
                        backgroundColor: isSelected ? colors.surfaceInset : 'transparent',
                        color: isSelected ? colors.orangeText : colors.textPrimary,
                      }}
                    >
                      Div {String(div).padStart(2, '0')} — {CSI_DIVISIONS[div]} ({count})
                    </button>
                  )
                })}
              </div>
            </Card>
            <Card padding={spacing['4']}>
              <SectionHeader title={selectedDivision !== null ? `Division ${String(selectedDivision).padStart(2, '0')} — ${CSI_DIVISIONS[selectedDivision] || ''}` : 'All Sections'} />
              {filtered.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginTop: spacing['3'] }}>
                  {filtered.map((spec) => {
                    const st = STATUS_STYLES[spec.status] || STATUS_STYLES.draft
                    return (
                      <div key={spec.id} style={{
                        display: 'flex', alignItems: 'center', gap: spacing['3'],
                        padding: spacing['3'], borderRadius: borderRadius.base, backgroundColor: colors.surfaceInset,
                      }}>
                        <span style={{ fontFamily: 'monospace', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.orangeText, minWidth: 80 }}>
                          {spec.section_number}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{spec.title}</div>
                          {spec.responsible_party && (
                            <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: 2 }}>{spec.responsible_party}</div>
                          )}
                        </div>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center',
                          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
                          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                          color: st.c, backgroundColor: st.bg,
                        }}>
                          {spec.status.replace(/_/g, ' ')}
                        </span>
                        {spec.revision && (
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Rev {spec.revision}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ padding: spacing['6'], textAlign: 'center', color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
                  No specs match your search
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

export default SpecificationsPanel
