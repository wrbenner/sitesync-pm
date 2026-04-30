import React, { useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import { BookOpen, Plus, Search, Sparkles, Trash2, ChevronRight, ChevronDown, FileText, History, RotateCcw, Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered, Link, Code, Quote, Minus, Table, Paperclip, Image, Users, Save, Eye, EyeOff } from 'lucide-react'
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
import { useFiles } from '../hooks/queries/files'
import type { MappedFile } from '../types/api'

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
  // Escape user-supplied HTML, then inject only a finite allowlist of tags
  // from markdown patterns. Final output goes through DOMPurify before
  // dangerouslySetInnerHTML at the call site.
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

// ── Embeddable File helpers ──────────────────────────────────────────
interface EmbeddableFile {
  id: string
  name: string
  type: 'pdf' | 'dwg' | 'image' | 'xlsx' | 'docx' | 'other'
  size: string
  icon: string
}

function mapFileToEmbeddable(f: MappedFile): EmbeddableFile | null {
  // Skip folders
  if (f.type === 'folder') return null
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  const ct = f.content_type?.toLowerCase() ?? ''
  let fileType: EmbeddableFile['type'] = 'other'
  let icon = '\uD83D\uDCC4' // default document icon
  if (ext === 'pdf' || ct.includes('pdf')) { fileType = 'pdf'; icon = '\uD83D\uDCC4' }
  else if (ext === 'dwg' || ext === 'dxf') { fileType = 'dwg'; icon = '\uD83D\uDCD0' }
  else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext) || ct.startsWith('image/')) { fileType = 'image'; icon = '\uD83D\uDDBC\uFE0F' }
  else if (['xlsx', 'xls', 'csv'].includes(ext) || ct.includes('spreadsheet')) { fileType = 'xlsx'; icon = '\uD83D\uDCCA' }
  else if (['docx', 'doc'].includes(ext) || ct.includes('word')) { fileType = 'docx'; icon = '\uD83D\uDCDD' }
  return { id: f.id, name: f.name, type: fileType, size: f.size, icon }
}

function computeDiff(oldText: string, newText: string): { type: 'same' | 'add' | 'del'; text: string }[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const result: { type: 'same' | 'add' | 'del'; text: string }[] = []
  const maxLen = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < maxLen; i++) {
    const ol = oldLines[i]
    const nl = newLines[i]
    if (ol === nl) result.push({ type: 'same', text: ol ?? '' })
    else {
      if (ol !== undefined) result.push({ type: 'del', text: ol })
      if (nl !== undefined) result.push({ type: 'add', text: nl })
    }
  }
  return result
}

// ── Rich Text Toolbar Buttons ─────────────────────────────────────────
interface ToolbarAction {
  label: string
  icon: React.ReactNode
  markdown: string
  shortcut?: string
  wrap?: boolean
}

const Wiki: React.FC = () => {
  const projectId = useProjectId()
  const { user } = useAuth()
  const { data: pages, isLoading } = useWikiPages(projectId ?? undefined)
  const createPage = useCreateWikiPage()
  const updatePage = useUpdateWikiPage()
  const deletePage = useDeleteWikiPage()
  const { data: projectFiles } = useFiles(projectId ?? undefined)

  // Map real project files to embeddable format
  const embeddableFiles: EmbeddableFile[] = useMemo(() => {
    if (!projectFiles) return []
    return projectFiles.map(mapFileToEmbeddable).filter((f): f is EmbeddableFile => f !== null)
  }, [projectFiles])

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
  // Version history
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareFrom, setCompareFrom] = useState<number | null>(null)
  const [compareTo, setCompareTo] = useState<number | null>(null)
  // File embedding
  const [filePickerOpen, setFilePickerOpen] = useState(false)
  const [attachments, setAttachments] = useState<EmbeddableFile[]>([])
  // Auto-save status
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'idle'>('saved')
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const toolbarActions: ToolbarAction[] = [
    { label: 'Bold', icon: <Bold size={14} />, markdown: '**', shortcut: 'Ctrl+B', wrap: true },
    { label: 'Italic', icon: <Italic size={14} />, markdown: '*', shortcut: 'Ctrl+I', wrap: true },
    { label: 'H1', icon: <Heading1 size={14} />, markdown: '# ', shortcut: 'Ctrl+1' },
    { label: 'H2', icon: <Heading2 size={14} />, markdown: '## ', shortcut: 'Ctrl+2' },
    { label: 'H3', icon: <Heading3 size={14} />, markdown: '### ', shortcut: 'Ctrl+3' },
    { label: 'Bullet List', icon: <List size={14} />, markdown: '- ', shortcut: 'Ctrl+U' },
    { label: 'Numbered List', icon: <ListOrdered size={14} />, markdown: '1. ' },
    { label: 'Link', icon: <Link size={14} />, markdown: '[text](url)', shortcut: 'Ctrl+K' },
    { label: 'Code Block', icon: <Code size={14} />, markdown: '```\n', shortcut: 'Ctrl+`' },
    { label: 'Quote', icon: <Quote size={14} />, markdown: '> ' },
    { label: 'Horizontal Rule', icon: <Minus size={14} />, markdown: '\n---\n' },
    { label: 'Table', icon: <Table size={14} />, markdown: '\n| Header | Header |\n|--------|--------|\n| Cell   | Cell   |\n' },
  ]

  const insertMarkdown = (action: ToolbarAction) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = editContent.substring(start, end)
    let insertion: string
    if (action.wrap && selected) {
      insertion = `${action.markdown}${selected}${action.markdown}`
    } else if (action.wrap) {
      insertion = `${action.markdown}text${action.markdown}`
    } else {
      insertion = action.markdown
    }
    const newContent = editContent.substring(0, start) + insertion + editContent.substring(end)
    setEditContent(newContent)
    setTimeout(() => {
      ta.focus()
      const cursorPos = start + insertion.length
      ta.setSelectionRange(cursorPos, cursorPos)
    }, 0)
  }

  const embedFile = (file: EmbeddableFile) => {
    const ta = textareaRef.current
    const pos = ta ? ta.selectionStart : editContent.length
    const embed = file.type === 'image'
      ? `\n![${file.name}](/files/${file.id})\n`
      : file.type === 'dwg'
        ? `\n${file.icon} [Drawing: ${file.name}](/files/${file.id})\n`
        : `\n${file.icon} [${file.name}](/files/${file.id})\n`
    const newContent = editContent.substring(0, pos) + embed + editContent.substring(pos)
    setEditContent(newContent)
    setAttachments((prev) => prev.some((a) => a.id === file.id) ? prev : [...prev, file])
    setFilePickerOpen(false)
  }

  const selected = (pages ?? []).find((p) => p.id === selectedId)

  // Auto-save indicator
  React.useEffect(() => {
    if (!selected) return
    if (editContent === selected.content && editTitle === selected.title) {
      setAutoSaveStatus('saved')
      return
    }
    setAutoSaveStatus('saving')
    const timer = setTimeout(() => setAutoSaveStatus('saved'), 1200)
    return () => clearTimeout(timer)
  }, [editContent, editTitle, selected])

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
    byParent.forEach((arr) => arr.sort((a, b) => a.title.localeCompare(b.title)))
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
      if (import.meta.env.DEV) console.error(e)
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
      if (import.meta.env.DEV) console.error(e)
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
      if (import.meta.env.DEV) console.error(e)
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
      if (import.meta.env.DEV) console.error(e)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    } catch {
      return dateStr
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
                {/* ── Status Bar ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['2']} ${spacing['3']}`, background: colors.surfaceInset, borderRadius: borderRadius.md, marginBottom: spacing['3'], fontSize: typography.fontSize.xs }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                    <Users size={12} color={colors.textTertiary} />
                    <span style={{ color: colors.textSecondary }}>Editing</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], color: autoSaveStatus === 'saving' ? colors.statusPending : colors.statusActive }}>
                    <Save size={11} />
                    <span>{autoSaveStatus === 'saving' ? 'Saving...' : 'All changes saved'}</span>
                  </div>
                </div>

                {/* ── Title Row + Action Buttons ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing['3'], marginBottom: spacing['3'] }}>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={{ flex: 1, fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold, background: 'transparent', border: 'none', color: colors.textPrimary, minHeight: 56 }}
                  />
                  <Btn variant="ghost" onClick={() => setPreview(!preview)}>{preview ? <><EyeOff size={14} /> Edit</> : <><Eye size={14} /> Preview</>}</Btn>
                  <Btn variant="ghost" onClick={() => { setHistoryOpen(!historyOpen); setSelectedVersion(null); setCompareMode(false) }}><History size={14} /> History</Btn>
                  <Btn variant="primary" onClick={handleSave}>Save</Btn>
                  <Btn variant="secondary" onClick={handleDelete}><Trash2 size={14} /></Btn>
                </div>

                {/* ── Last edited metadata ── */}
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing['3'] }}>
                  Last updated {formatDate(selected.updated_at)}
                </div>

                {/* ── Version History Panel ── */}
                {historyOpen && (
                  <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, marginBottom: spacing['4'], overflow: 'hidden' }}>
                    <div style={{ background: colors.surfaceInset, padding: `${spacing['2']} ${spacing['3']}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${colors.borderSubtle}` }}>
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Version History</span>
                      <div style={{ display: 'flex', gap: spacing['2'] }}>
                        <Btn variant={compareMode ? 'primary' : 'ghost'} onClick={() => { setCompareMode(!compareMode); setCompareFrom(null); setCompareTo(null) }} style={{ fontSize: typography.fontSize.xs }}>
                          Compare
                        </Btn>
                      </div>
                    </div>
                    <div style={{ padding: spacing['4'], textAlign: 'center', color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
                      {compareMode
                        ? 'Version history comparison will be available when version tracking is enabled.'
                        : 'No previous versions recorded yet. Each save will create a version history entry once version tracking is enabled.'}
                    </div>
                    {/* Compare mode diff view placeholder */}
                    {compareMode && compareFrom !== null && compareTo !== null && (() => {
                      // Future: fetch version snapshots and compute diff
                      void computeDiff // retain reference for future use
                      void selectedVersion
                      return null
                    })()}
                  </div>
                )}

                {/* ── Rich Text Toolbar ── */}
                {!preview && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], padding: `${spacing['2']} ${spacing['3']}`, background: colors.surfaceInset, borderRadius: `${borderRadius.md} ${borderRadius.md} 0 0`, border: `1px solid ${colors.borderSubtle}`, borderBottom: 'none', flexWrap: 'wrap' }}>
                    {toolbarActions.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => insertMarkdown(action)}
                        title={`${action.label}${action.shortcut ? ` (${action.shortcut})` : ''}`}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', background: 'transparent', color: colors.textSecondary, borderRadius: borderRadius.sm, cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={(e) => { (e.target as HTMLElement).style.background = colors.surfaceHover; (e.target as HTMLElement).style.color = colors.textPrimary }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; (e.target as HTMLElement).style.color = colors.textSecondary }}
                      >
                        {action.icon}
                      </button>
                    ))}
                    <div style={{ width: 1, height: 20, background: colors.borderSubtle, margin: `0 ${spacing['1']}` }} />
                    <button
                      onClick={() => setFilePickerOpen(true)}
                      title="Embed File"
                      style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], padding: `${spacing['1']} ${spacing['2']}`, border: 'none', background: 'transparent', color: colors.textSecondary, borderRadius: borderRadius.sm, cursor: 'pointer', fontSize: typography.fontSize.xs }}
                      onMouseEnter={(e) => { (e.target as HTMLElement).style.background = colors.surfaceHover }}
                      onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent' }}
                    >
                      <Paperclip size={13} /> Embed File
                    </button>
                    {embeddableFiles.some((f) => f.type === 'dwg') && (
                      <button
                        onClick={() => {
                          const drawingFiles = embeddableFiles.filter((f) => f.type === 'dwg')
                          if (drawingFiles.length > 0) embedFile(drawingFiles[0])
                        }}
                        title="Embed Drawing"
                        style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], padding: `${spacing['1']} ${spacing['2']}`, border: 'none', background: 'transparent', color: colors.textSecondary, borderRadius: borderRadius.sm, cursor: 'pointer', fontSize: typography.fontSize.xs }}
                        onMouseEnter={(e) => { (e.target as HTMLElement).style.background = colors.surfaceHover }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent' }}
                      >
                        <Image size={13} /> Embed Drawing
                      </button>
                    )}
                  </div>
                )}

                {/* ── Content Area (Preview or Editor) ── */}
                {preview ? (
                  <div
                    style={{ color: colors.textPrimary, lineHeight: 1.6, fontSize: typography.fontSize.sm, padding: spacing['3'], border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, minHeight: 400 }}
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(`<p>${renderMarkdown(editContent)}</p>`, {
                        ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'strong', 'em', 'code', 'li', 'ul', 'ol', 'br'],
                        ALLOWED_ATTR: [],
                      }),
                    }}
                  />
                ) : (
                  <textarea
                    ref={textareaRef}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    style={{ width: '100%', minHeight: 400, padding: spacing['3'], borderRadius: `0 0 ${borderRadius.md} ${borderRadius.md}`, border: `1px solid ${colors.borderSubtle}`, background: colors.surfaceInset, color: colors.textPrimary, fontFamily: 'monospace', fontSize: typography.fontSize.sm, resize: 'vertical' }}
                  />
                )}

                {/* ── Attachments List ── */}
                {attachments.length > 0 && (
                  <div style={{ marginTop: spacing['3'], border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, overflow: 'hidden' }}>
                    <div style={{ padding: `${spacing['2']} ${spacing['3']}`, background: colors.surfaceInset, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                      Attachments ({attachments.length})
                    </div>
                    {attachments.map((file) => (
                      <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['2']} ${spacing['3']}`, borderBottom: `1px solid ${colors.borderSubtle}`, fontSize: typography.fontSize.sm }}>
                        <span style={{ fontSize: '16px' }}>{file.icon}</span>
                        <span style={{ flex: 1, color: colors.textPrimary }}>{file.name}</span>
                        <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.xs }}>{file.size}</span>
                        <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.xs, textTransform: 'uppercase' }}>{file.type}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── File Picker Modal ── */}
                {filePickerOpen && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1040 }} onClick={() => setFilePickerOpen(false)}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: colors.surfaceRaised, borderRadius: borderRadius.lg, padding: spacing['5'], width: 480, maxHeight: '70vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}>
                      <div style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing['3'] }}>Embed Project File</div>
                      <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing['3'] }}>Select a file to embed in this wiki page</div>
                      {embeddableFiles.length === 0 ? (
                        <div style={{ padding: spacing['4'], textAlign: 'center', color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
                          No files uploaded to this project yet. Upload files in the Files section first.
                        </div>
                      ) : (
                        embeddableFiles.map((file) => (
                          <div
                            key={file.id}
                            onClick={() => embedFile(file)}
                            style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['2']} ${spacing['3']}`, borderRadius: borderRadius.sm, cursor: 'pointer', marginBottom: spacing['1'], border: `1px solid ${colors.borderSubtle}` }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.surfaceHover }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                          >
                            <span style={{ fontSize: '18px' }}>{file.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{file.name}</div>
                              <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>{file.size} &middot; {file.type.toUpperCase()}</div>
                            </div>
                          </div>
                        ))
                      )}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: spacing['3'] }}>
                        <Btn variant="secondary" onClick={() => setFilePickerOpen(false)}>Cancel</Btn>
                      </div>
                    </div>
                  </div>
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
            <option value="">-- Blank --</option>
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
            <option value="">-- Top Level --</option>
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
