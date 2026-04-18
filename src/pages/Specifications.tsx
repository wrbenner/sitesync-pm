import React, { useState, useMemo } from 'react'
import { BookOpen, Plus, Search } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField, EmptyState } from '../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useSpecifications, useCreateSpecification } from '../hooks/queries/enterprise-modules'
import { toast } from 'sonner'
import { PermissionGate } from '../components/auth/PermissionGate'

interface Specification {
  id: string
  section_number: string
  title: string
  division: number | null
  status: string
  revision: string | null
}

const CSI_DIVISIONS: Record<number, string> = {
  1: 'General Requirements', 2: 'Existing Conditions', 3: 'Concrete', 4: 'Masonry',
  5: 'Metals', 6: 'Wood & Plastics', 7: 'Thermal & Moisture', 8: 'Openings',
  9: 'Finishes', 10: 'Specialties', 11: 'Equipment', 12: 'Furnishings',
  13: 'Special Construction', 14: 'Conveying Systems', 21: 'Fire Suppression',
  22: 'Plumbing', 23: 'HVAC', 26: 'Electrical', 27: 'Communications',
  28: 'Electronic Safety', 31: 'Earthwork', 32: 'Exterior Improvements', 33: 'Utilities',
}

export const Specifications: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [selectedDivision, setSelectedDivision] = useState<number | null>(null)
  const projectId = useProjectId()
  const { data: specs, isLoading } = useSpecifications(projectId ?? undefined)
  const createSpec = useCreateSpecification()

  const [form, setForm] = useState({ section_number: '', title: '', division: '3', revision: '' })

  const list = (specs ?? []) as Specification[]

  const filtered = useMemo(() => {
    let result = list
    if (selectedDivision !== null) result = result.filter((s) => s.division === selectedDivision)
    if (searchText) {
      const q = searchText.toLowerCase()
      result = result.filter((s) =>
        s.section_number.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)
      )
    }
    return result
  }, [list, selectedDivision, searchText])

  const divisionCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const s of list) {
      if (s.division) counts[s.division] = (counts[s.division] || 0) + 1
    }
    return counts
  }, [list])

  const handleSubmit = async () => {
    if (!projectId || !form.section_number || !form.title) {
      toast.error('Section number and title required')
      return
    }
    try {
      await createSpec.mutateAsync({
        project_id: projectId,
        section_number: form.section_number,
        title: form.title,
        division: parseInt(form.division, 10) || null,
        revision: form.revision || null,
      })
      toast.success('Spec section added')
      setModalOpen(false)
      setForm({ section_number: '', title: '', division: '3', revision: '' })
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  return (
    <PageContainer
      title="Specifications"
      subtitle="CSI MasterFormat sections linked to submittals and RFIs"
      actions={
        <PermissionGate
          permission="project.settings"
          fallback={<span title="Your role doesn't allow adding spec sections. Request access from your admin."><Btn variant="primary" icon={<Plus size={16} />} disabled>New Spec</Btn></span>}
        >
          <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>New Spec</Btn>
        </PermissionGate>
      }
    >
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
            <MetricBox label="Total Sections" value={list.length} />
            <MetricBox label="Divisions" value={Object.keys(divisionCounts).length} />
            <MetricBox label="Active" value={list.filter((s) => s.status === 'active').length} />
          </div>

          <div style={{ display: 'flex', gap: spacing['3'], marginBottom: spacing['3'] }}>
            <div style={{ flex: 1 }}>
              <InputField value={searchText} onChange={setSearchText} placeholder="Search by section number or title..." icon={<Search size={16} />} />
            </div>
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
              <SectionHeader title={selectedDivision !== null ? `Division ${String(selectedDivision).padStart(2, '0')}` : 'All Sections'} />
              {filtered.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginTop: spacing['3'] }}>
                  {filtered.map((spec) => (
                    <div key={spec.id} style={{
                      display: 'flex', alignItems: 'center', gap: spacing['3'],
                      padding: spacing['3'], borderRadius: borderRadius.base, backgroundColor: colors.surfaceInset,
                    }}>
                      <span style={{ fontFamily: 'monospace', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.orangeText }}>
                        {spec.section_number}
                      </span>
                      <span style={{ flex: 1, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{spec.title}</span>
                      {spec.revision && (
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Rev {spec.revision}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={<BookOpen size={48} />} title="No specs" description="Add specification sections to track project documentation." />
              )}
            </Card>
          </div>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Specification" width="520px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Section Number" value={form.section_number} onChange={(v) => setForm({ ...form, section_number: v })} placeholder="03 30 00" />
            <div>
              <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Division</label>
              <select
                value={form.division}
                onChange={(e) => setForm({ ...form, division: e.target.value })}
                style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
              >
                {Object.keys(CSI_DIVISIONS).map((d) => (
                  <option key={d} value={d}>{String(d).padStart(2, '0')} — {CSI_DIVISIONS[parseInt(d, 10)]}</option>
                ))}
              </select>
            </div>
          </div>
          <InputField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Cast-in-Place Concrete" />
          <InputField label="Revision (optional)" value={form.revision} onChange={(v) => setForm({ ...form, revision: v })} placeholder="2" />
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleSubmit} loading={createSpec.isPending}>Create</Btn>
          </div>
        </div>
      </Modal>
    </PageContainer>
  )
}

export default Specifications
