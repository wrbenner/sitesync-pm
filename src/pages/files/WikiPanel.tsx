import React, { useState } from 'react'
import { BookMarked, Plus, Trash2, Edit2 } from 'lucide-react'
import { Card, SectionHeader, Btn, Skeleton, Modal, InputField, EmptyState } from '../../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { useProjectId } from '../../hooks/useProjectId'
import { useWikiPages, useCreateWikiPage, useUpdateWikiPage, useDeleteWikiPage, type WikiPage } from '../../hooks/queries/enterprise-capabilities'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'sonner'
import { useConfirm } from '../../components/ConfirmDialog'

export const WikiPanel: React.FC = () => {
  const projectId = useProjectId()
  const { user } = useAuth()
  const { data, isLoading } = useWikiPages(projectId ?? undefined)
  const createMut = useCreateWikiPage()
  const updateMut = useUpdateWikiPage()
  const deleteMut = useDeleteWikiPage()

  const [selected, setSelected] = useState<WikiPage | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', content: '' })

  const list = (data ?? []) as WikiPage[]

  const openCreate = () => {
    setEditId(null)
    setForm({ title: '', content: '' })
    setModalOpen(true)
  }

  const openEdit = (page: WikiPage) => {
    setEditId(page.id)
    setForm({ title: page.title, content: page.content })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!projectId || !form.title.trim()) {
      toast.error('Title is required')
      return
    }
    try {
      if (editId) {
        await updateMut.mutateAsync({ id: editId, updates: { title: form.title.trim(), content: form.content, updated_by: user?.id || null } })
        toast.success('Page updated')
      } else {
        await createMut.mutateAsync({ project_id: projectId, title: form.title.trim(), content: form.content, created_by: user?.id || null })
        toast.success('Page created')
      }
      setModalOpen(false)
      setEditId(null)
      setForm({ title: '', content: '' })
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`)
    }
  }

  const { confirm: confirmDeleteWiki, dialog: deleteWikiDialog } = useConfirm()

  const handleDelete = async (page: WikiPage) => {
    if (!projectId) return
    const ok = await confirmDeleteWiki({
      title: 'Delete wiki page?',
      description: `"${page.title}" — page content and history will be removed. Cross-references from other entities will become orphaned.`,
      destructiveLabel: 'Delete page',
    })
    if (!ok) return
    try {
      await deleteMut.mutateAsync({ id: page.id, project_id: projectId })
      toast.success('Page deleted')
      if (selected?.id === page.id) setSelected(null)
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`)
    }
  }

  if (!projectId) {
    return <EmptyState icon={<BookMarked size={32} />} title="No project selected" description="Select a project to view wiki pages." />
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['4'] }}>
        <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
          Project wiki pages — process notes, onboarding info, field references
        </div>
        <Btn variant="primary" size="sm" icon={<Plus size={14} />} onClick={openCreate}>
          New Page
        </Btn>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height="56px" />)}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<BookMarked size={32} />}
          title="No wiki pages yet"
          description="Capture project-specific documentation, onboarding notes, and process references here."
          actionLabel="Create Page"
          onAction={openCreate}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: spacing['4'] }}>
          <Card padding={spacing['2']}>
            <SectionHeader title="Pages" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'], marginTop: spacing['2'] }}>
              {list.map((page) => {
                const isSelected = selected?.id === page.id
                return (
                  <button
                    key={page.id}
                    onClick={() => setSelected(page)}
                    style={{
                      padding: `${spacing['2']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.base,
                      cursor: 'pointer', textAlign: 'left', fontSize: typography.fontSize.sm,
                      backgroundColor: isSelected ? colors.surfaceInset : 'transparent',
                      color: isSelected ? colors.orangeText : colors.textPrimary,
                      fontWeight: isSelected ? typography.fontWeight.medium : typography.fontWeight.normal,
                    }}
                  >
                    {page.title}
                  </button>
                )
              })}
            </div>
          </Card>

          <Card padding={spacing['4']}>
            {selected ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['3'] }}>
                  <h3 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                    {selected.title}
                  </h3>
                  <div style={{ display: 'flex', gap: spacing['2'] }}>
                    <Btn variant="ghost" size="sm" icon={<Edit2 size={14} />} onClick={() => openEdit(selected)}>Edit</Btn>
                    <Btn variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => handleDelete(selected)}>Delete</Btn>
                  </div>
                </div>
                <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {selected.content || <span style={{ color: colors.textTertiary, fontStyle: 'italic' }}>No content</span>}
                </div>
                <div style={{ marginTop: spacing['4'], paddingTop: spacing['3'], borderTop: `1px solid ${colors.borderLight}`, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  Updated {new Date(selected.updated_at).toLocaleString()}
                </div>
              </>
            ) : (
              <div style={{ padding: spacing['6'], textAlign: 'center', color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
                Select a page to read or edit
              </div>
            )}
          </Card>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Page' : 'New Page'} width="640px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <InputField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Onboarding checklist" />
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
              Content (plain text or markdown)
            </label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={14}
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, resize: 'vertical' }}
              placeholder="# Section heading&#10;&#10;Page content..."
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleSave} loading={createMut.isPending || updateMut.isPending}>
              {editId ? 'Update' : 'Create'}
            </Btn>
          </div>
        </div>
      </Modal>
      {deleteWikiDialog}
    </div>
  )
}

export default WikiPanel
