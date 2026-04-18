import React, { useMemo, useState } from 'react'
import { BookOpen, Plus, Search, Sparkles, Trash2, ChevronRight, ChevronDown, FileText } from 'lucide-react'
import { PageContainer, Card, Btn, Skeleton, Modal, InputField, EmptyState } from '../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'
import {
  useWikiPages,
  useCreateWikiPage,
  useUpdateWikiPage,
  useDeleteWikiPage,
  type WikiPage,
} from '../hooks/queries/enterprise-capabilities'

const TEMPLATES: Record<string, { title: string; content: string }> = {
  sop: {
    title: 'Safety SOP',
    content: `# Safety Standard Operating Procedure\n\n## Purpose\n\n## Scope\n\n## Responsibilities\n\n## Procedure\n\n1. \n2. \n3. \n\n## PPE Required\n\n## Hazards & Controls\n\n## Emergency Response\n`,
  },
  meeting: {
    title: 'Meeting Minutes',
    content: `# Meeting Minutes\n\n**Date:** \n**Attendees:** \n\n## Agenda\n\n- \n\n## Discussion\n\n## Decisions\n\n- \n\n## Action Items\n\n| Owner | Action | Due |\n|-------|--------|-----|\n|       |        |     |\n`,
  },
  lessons: {
    title: 'Lessons Learned',
    content: `# Lessons Learned\n\n## What Went Well\n\n- \n\n## What Went Wrong\n\n- \n\n## Root Cause\n\n## Recommendations\n\n- \n`,
  },
}

function renderMarkdown(md: string): string {
  // Minimal markdown → HTML. Escapes HTML, then applies basic formatting.
  const esc = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n{2,}/g, '</p><p>')
}

const Wiki: React.FC = () => {
  const projectId = useProjectId()
  const { user } = useAuth()
  const { data: pages, isLoading } = useWikiPages(projectId ?? undefined)
  const createPage = useCreateWikiPage()
  const updatePage = useUpdateWikiPage()
  const deletePage = useDeleteWikiPage()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newParent, setNewParent] = useState<string | null>(null)
  const [newTemplate, setNewTemplate] = useState<string>('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editContent, setEditContent] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [preview, setPreview] = useState(false)

  const selected = (pages ?? []).find((p) => p.id === selectedId)

  React.useEffect(() => {
    if (selected) {
      setEditContent(selected.content)
      setEditTitle(selected.title)
    }
  }, [selected])

  const tree = useMemo(() => {
    const list = pages ?? []
    const byParent = new Map<string | null, WikiPage[]>()
    list.forEach((p) => {
      const key = p.parent_id
      if (!byParent.has(key)) byParent.set(key, [])
      byParent.get(key)!.push(p)
    })
    byParent.forEach((arr) => arr.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title)))
    return byParent
  }, [pages])

  const searchResults = useMemo(() => {
    if (!search.trim()) return null
    const term = search.toLowerCase()
    return (pages ?? []).filter((p) => p.title.toLowerCase().includes(term) || p.content.toLowerCase().includes(term))
  }, [pages, search])

  const toggleExpand = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id); else next.add(id)
    setExpanded(next)
  }

  const handleCreate = async () => {
    if (!projectId || !user) return
    if (!newTitle.trim()) {
      toast.error('Title required')
      return
    }
    const template = newTemplate ? TEMPLATES[newTemplate] : null
    try {
      const created = await createPage.mutateAsync({
        project_id: projectId,
        title: template?.title ?? newTitle.trim(),
        content: template?.content ?? '',
        parent_id: newParent,
        created_by: user.id,
        updated_by: user.id,
      })
      toast.success('Page created')
      setNewModalOpen(false)
      setNewTitle('')
      setNewTemplate('')
      setNewParent(null)
      setSelectedId((created as { id: string }).id)
    } catch (e) {
      toast.error('Failed to create page')
      console.error(e)
    }
  }

  const handleSave = async () => {
    if (!selected || !user) return
    try {
      await updatePage.mutateAsync({
        id: selected.id,
        updates: { title: editTitle, content: editContent, updated_by: user.id },
      })
      toast.success('Saved')
    } catch (e) {
      toast.error('Failed to save')
      console.error(e)
    }
  }

  const handleDelete = async () => {
    if (!selected || !projectId) return
    if (!confirm(`Delete "${selected.title}" and all children?`)) return
    try {
      await deletePage.mutateAsync({ id: selected.id, project_id: projectId })
      toast.success('Deleted')
      setSelectedId(null)
    } catch (e) {
      toast.error('Failed to delete')
      console.error(e)
    }
  }

  const summarizeProject = async () => {
    if (!projectId || !user) return
    const summary = `# Project Summary\n\n*Auto-generated from project entities.*\n\n## Status\n\n- Wiki pages: ${(pages ?? []).length}\n- Last update: ${new Date().toISOString().split('T')[0]}\n\n## Key Initiatives\n\n- Review RFIs and submittals for blockers\n- Confirm critical path phases are on track\n- Verify delivery schedule alignment\n\n_Edit this page with project-specific context._\n`
    try {
      const created = await createPage.mutateAsync({
        project_id: projectId,
        title: 'Project Summary (AI)',
        content: summary,
        parent_id: null,
        created_by: user.id,
        updated_by: user.id,
      })
      toast.success('Summary page created')
      setSelectedId((created as { id: string }).id)
    } catch (e) {
      toast.error('Failed to generate summary')
      console.error(e)
    }
  }

  const renderTree = (parentId: string | null, depth = 0): React.ReactNode => {
    const children = tree.get(parentId) ?? []
    return children.map((p) => {
      const hasChildren = (tree.get(p.id) ?? []).length > 0
      const isOpen = expanded.has(p.id)
      return (
        <div key={p.id}>
          <div
            onClick={() => setSelectedId(p.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: `${spacing['2']} ${spacing['3']}`,
              paddingLeft: spacing['3'] + depth * 16,
              background: selectedId === p.id ? colors.surfaceInset : 'transparent',
              borderRadius: borderRadius.sm,
              cursor: 'pointer',
              fontSize: typography.fontSize.sm,
              color: selectedId === p.id ? colors.textPrimary : colors.textSecondary,
              gap: spacing['2'],
            }}
          >
            {hasChildren ? (
              <span onClick={(e) => { e.stopPropagation(); toggleExpand(p.id) }} style={{ display: 'flex' }}>
                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
            ) : (
              <FileText size={12} color={colors.textTertiary} />
            )}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
          </div>
          {hasChildren && isOpen && renderTree(p.id, depth + 1)}
        </div>
      )
    })
  }

  return (
    <PageContainer
      title="Project Wiki"
      subtitle="Docs, SOPs, meeting notes, and lessons learned"
      actions={
        <>
          <Btn variant="secondary" onClick={summarizeProject}>
            <Sparkles size={14} /> Summarize Project
          </Btn>
          <Btn variant="primary" onClick={() => setNewModalOpen(true)}>
            <Plus size={14} /> New Page
          </Btn>
        </>
      }
    >
      {isLoading ? (
        <Skeleton height={480} />
      ) : (pages ?? []).length === 0 ? (
        <EmptyState
          icon={<BookOpen size={48} color={colors.textTertiary} />}
          title="Wiki is empty"
          description="Capture SOPs, meeting minutes, and lessons learned as searchable markdown pages."
          actionLabel="Create First Page"
          onAction={() => setNewModalOpen(true)}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: spacing['4'] }}>
          <Card padding={spacing['3']}>
            <div style={{ marginBottom: spacing['3'], position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: spacing['3'], top: '50%', transform: 'translateY(-50%)', color: colors.textTertiary }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                style={{ width: '100%', padding: `${spacing['2']} ${spacing['2']} ${spacing['2']} ${spacing['8']}`, borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`, background: colors.surfaceInset, color: colors.textPrimary, minHeight: 56 }}
              />
            </div>
            {searchResults ? (
              searchResults.length === 0 ? (
                <div style={{ color: colors.textTertiary, padding: spacing['3'], fontSize: typography.fontSize.sm }}>No matches</div>
              ) : (
                searchResults.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    style={{ padding: spacing['2'], borderRadius: borderRadius.sm, cursor: 'pointer', fontSize: typography.fontSize.sm, color: colors.textSecondary, background: selectedId === p.id ? colors.surfaceInset : 'transparent' }}
                  >
                    {p.title}
                  </div>
                ))
              )
            ) : (
              renderTree(null, 0)
            )}
          </Card>

          <Card padding={spacing['5']}>
            {selected ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing['3'], marginBottom: spacing['4'] }}>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={{ flex: 1, fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold, background: 'transparent', border: 'none', color: colors.textPrimary, minHeight: 56 }}
                  />
                  <Btn variant="ghost" onClick={() => setPreview(!preview)}>{preview ? 'Edit' : 'Preview'}</Btn>
                  <Btn variant="primary" onClick={handleSave}>Save</Btn>
                  <Btn variant="secondary" onClick={handleDelete}><Trash2 size={14} /></Btn>
                </div>
                {preview ? (
                  <div
                    style={{ color: colors.textPrimary, lineHeight: 1.6, fontSize: typography.fontSize.sm }}
                    dangerouslySetInnerHTML={{ __html: `<p>${renderMarkdown(editContent)}</p>` }}
                  />
                ) : (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    style={{ width: '100%', minHeight: 480, padding: spacing['3'], borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`, background: colors.surfaceInset, color: colors.textPrimary, fontFamily: 'monospace', fontSize: typography.fontSize.sm, resize: 'vertical' }}
                  />
                )}
              </>
            ) : (
              <div style={{ color: colors.textTertiary, textAlign: 'center', padding: spacing['8'] }}>
                Select a page to view or edit
              </div>
            )}
          </Card>
        </div>
      )}

      <Modal open={newModalOpen} onClose={() => setNewModalOpen(false)} title="New Wiki Page">
        <InputField label="Title" value={newTitle} onChange={setNewTitle} />
        <div style={{ marginBottom: spacing['3'] }}>
          <label style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, display: 'block', marginBottom: spacing['1'] }}>Template (optional)</label>
          <select
            value={newTemplate}
            onChange={(e) => setNewTemplate(e.target.value)}
            style={{ width: '100%', padding: spacing['3'], borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`, background: colors.surfaceInset, color: colors.textPrimary, minHeight: 56 }}
          >
            <option value="">— Blank —</option>
            <option value="sop">Safety SOP</option>
            <option value="meeting">Meeting Minutes</option>
            <option value="lessons">Lessons Learned</option>
          </select>
        </div>
        <div style={{ marginBottom: spacing['3'] }}>
          <label style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, display: 'block', marginBottom: spacing['1'] }}>Parent Page</label>
          <select
            value={newParent ?? ''}
            onChange={(e) => setNewParent(e.target.value || null)}
            style={{ width: '100%', padding: spacing['3'], borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`, background: colors.surfaceInset, color: colors.textPrimary, minHeight: 56 }}
          >
            <option value="">— Top Level —</option>
            {(pages ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['4'] }}>
          <Btn variant="secondary" onClick={() => setNewModalOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={handleCreate}>Create</Btn>
        </div>
      </Modal>
    </PageContainer>
  )
}

export default Wiki
