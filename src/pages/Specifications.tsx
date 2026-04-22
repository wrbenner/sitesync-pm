import React, { useState, useMemo } from 'react'
import { BookOpen, Plus, Search, Edit2, Trash2, CheckCircle } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField, EmptyState } from '../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useSpecifications, useCreateSpecification, useUpdateSpecification, useDeleteSpecification } from '../hooks/queries/specifications'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'
import { PermissionGate } from '../components/auth/PermissionGate'

interface Specification {
  id: string
  section_number: string
  title: string
  division: string | null
  status: string
  revision: string | null
  description: string | null
  responsible_party: string | null
  notes: string | null
  file_url: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

const CSI_DIVISIONS: Record<number, string> = {
  1: 'General Requirements', 2: 'Existing Conditions', 3: 'Concrete', 4: 'Masonry',
  5: 'Metals', 6: 'Wood & Plastics', 7: 'Thermal & Moisture', 8: 'Openings',
  9: 'Finishes', 10: 'Specialties', 11: 'Equipment', 12: 'Furnishings',
  13: 'Special Construction', 14: 'Conveying Systems', 21: 'Fire Suppression',
  22: 'Plumbing', 23: 'HVAC', 26: 'Electrical', 27: 'Communications',
  28: 'Electronic Safety', 31: 'Earthwork', 32: 'Exterior Improvements', 33: 'Utilities',
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'for_review', label: 'For Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'superseded', label: 'Superseded' },
]

const STATUS_STYLES: Record<string, { c: string; bg: string }> = {
  draft: { c: colors.textTertiary, bg: colors.surfaceInset },
  for_review: { c: colors.statusPending, bg: colors.statusPendingSubtle },
  approved: { c: colors.statusActive, bg: colors.statusActiveSubtle },
  superseded: { c: colors.statusCritical, bg: colors.statusCriticalSubtle },
  active: { c: colors.statusActive, bg: colors.statusActiveSubtle },
}

type FormState = {
  section_number: string
  title: string
  division: string
  revision: string
  status: string
  description: string
  responsible_party: string
  notes: string
}

const emptyForm: FormState = { section_number: '', title: '', division: '3', revision: '', status: 'draft', description: '', responsible_party: '', notes: '' }

export const Specifications: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false)
  const [editSpec, setEditSpec] = useState<Specification | null>(null)
  const [searchText, setSearchText] = useState('')
  const [selectedDivision, setSelectedDivision] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const projectId = useProjectId()
  const { user } = useAuth()
  const { data: specs, isLoading } = useSpecifications(projectId ?? undefined)
  const createSpec = useCreateSpecification()
  const updateSpec = useUpdateSpecification()
  const deleteSpec = useDeleteSpecification()

  const [form, setForm] = useState<FormState>({ ...emptyForm })

  const list = (specs ?? []) as Specification[]

  const filtered = useMemo(() => {
    let result = list
    if (selectedDivision !== null) result = result.filter((s) => s.division === String(selectedDivision))
    if (statusFilter !== 'all') result = result.filter((s) => s.status === statusFilter)
    if (searchText) {
      const q = searchText.toLowerCase()
      result = result.filter((s) =>
        s.section_number.toLowerCase().includes(q) || s.title.toLowerCase().includes(q) ||
        (s.responsible_party && s.responsible_party.toLowerCase().includes(q))
      )
    }
    return result
  }, [list, selectedDivision, statusFilter, searchText])

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
  const reviewCount = list.filter((s) => s.status === 'for_review').length

  const openCreate = () => {
    setEditSpec(null)
    setForm({ ...emptyForm })
    setModalOpen(true)
  }

  const openEdit = (spec: Specification) => {
    setEditSpec(spec)
    setForm({
      section_number: spec.section_number,
      title: spec.title,
      division: spec.division || '3',
      revision: spec.revision || '',
      status: spec.status || 'draft',
      description: spec.description || '',
      responsible_party: spec.responsible_party || '',
      notes: spec.notes || '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!projectId || !form.section_number || !form.title) {
      toast.error('Section number and title required')
      return
    }
    try {
      if (editSpec) {
        await updateSpec.mutateAsync({
          id: editSpec.id,
          projectId,
          updates: {
            section_number: form.section_number,
            title: form.title,
            division: form.division || null,
            revision: form.revision || null,
            status: form.status,
            description: form.description || null,
            responsible_party: form.responsible_party || null,
            notes: form.notes || null,
            ...(form.status === 'approved' ? { approved_by: user?.id || null, approved_at: new Date().toISOString() } : {}),
          },
        })
        toast.success('Specification updated')
      } else {
        await createSpec.mutateAsync({
          project_id: projectId,
          section_number: form.section_number,
          title: form.title,
          division: form.division || null,
          revision: form.revision || null,
          status: form.status,
          description: form.description || null,
          responsible_party: form.responsible_party || null,
          notes: form.notes || null,
          created_by: user?.id || null,
        })
        toast.success('Spec section added')
      }
      setModalOpen(false)
      setEditSpec(null)
      setForm({ ...emptyForm })
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  const handleDelete = async (spec: Specification) => {
    if (!projectId) return
    try {
      await deleteSpec.mutateAsync({ id: spec.id, projectId })
      toast.success('Specification deleted')
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
          <Btn variant="primary" icon={<Plus size={16} />} onClick={openCreate}>New Spec</Btn>
        </PermissionGate>
      }
    >
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
            <MetricBox label="Total Sections" value={list.length} />
            <MetricBox label="Divisions" value={Object.keys(divisionCounts).length} />
            <MetricBox label="Approved" value={approvedCount} />
            <MetricBox label="For Review" value={reviewCount} />
          </div>

          <div style={{ display: 'flex', gap: spacing['3'], marginBottom: spacing['3'], flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <InputField value={searchText} onChange={setSearchText} placeholder="Search by section number, title, or responsible party..." icon={<Search size={16} />} />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: `${spacing['2']} ${spacing['3']}`, borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
            >
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
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
                      Div {String(div).padStart(2, '0')} -- {CSI_DIVISIONS[div]} ({count})
                    </button>
                  )
                })}
              </div>
            </Card>

            <Card padding={spacing['4']}>
              <SectionHeader title={selectedDivision !== null ? `Division ${String(selectedDivision).padStart(2, '0')} -- ${CSI_DIVISIONS[selectedDivision] || ''}` : 'All Sections'} />
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
                          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
                          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                          color: st.c, backgroundColor: st.bg,
                        }}>
                          {spec.status === 'approved' && <CheckCircle size={10} />}
                          {spec.status.replace(/_/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase())}
                        </span>
                        {spec.revision && (
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Rev {spec.revision}</span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(spec) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: 4 }}
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(spec) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: 4 }}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState icon={<BookOpen size={48} />} title="No specs" description="Add specification sections to track project documentation." />
              )}
            </Card>
          </div>
        </>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditSpec(null) }} title={editSpec ? 'Edit Specification' : 'New Specification'} width="560px">
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
                  <option key={d} value={d}>{String(d).padStart(2, '0')} -- {CSI_DIVISIONS[parseInt(d, 10)]}</option>
                ))}
              </select>
            </div>
          </div>
          <InputField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Cast-in-Place Concrete" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Revision" value={form.revision} onChange={(v) => setForm({ ...form, revision: v })} placeholder="0" />
            <div>
              <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
              >
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <InputField label="Responsible Party" value={form.responsible_party} onChange={(v) => setForm({ ...form, responsible_party: v })} placeholder="Architect, Engineer, etc." />
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, resize: 'vertical' }}
              placeholder="Description of this specification section..."
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, resize: 'vertical' }}
              placeholder="Additional notes or comments..."
            />
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => { setModalOpen(false); setEditSpec(null) }}>Cancel</Btn>
            <Btn variant="primary" onClick={handleSubmit} loading={createSpec.isPending || updateSpec.isPending}>{editSpec ? 'Update' : 'Create'}</Btn>
          </div>
        </div>
      </Modal>
    </PageContainer>
  )
}

export default Specifications
