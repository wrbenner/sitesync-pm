import React, { useCallback, useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import {
  Bold, Italic, Strikethrough, Heading2, List, ListOrdered,
  CheckSquare, Highlighter,
} from 'lucide-react'
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme'

interface RichTextEditorProps {
  content?: string
  onChange?: (html: string) => void
  placeholder?: string
  editable?: boolean
  minHeight?: number
}

const ToolbarButton: React.FC<{
  onClick: () => void
  active?: boolean
  icon: React.ReactNode
  title: string
}> = ({ onClick, active, icon, title }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      width: 28, height: 28,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: 'none', borderRadius: borderRadius.sm,
      backgroundColor: active ? colors.orangeSubtle : 'transparent',
      color: active ? colors.orangeText : colors.textTertiary,
      cursor: 'pointer',
      transition: `all ${transitions.instant}`,
    }}
  >
    {icon}
  </button>
)

const editorStyles = `
.ProseMirror { outline: none; min-height: inherit; }
.ProseMirror p { margin: 0 0 ${spacing['2']}; }
.ProseMirror h2 { font-size: ${typography.fontSize.subtitle}; font-weight: ${typography.fontWeight.semibold}; margin: ${spacing['4']} 0 ${spacing['2']}; }
.ProseMirror ul, .ProseMirror ol { padding-left: ${spacing['6']}; }
.ProseMirror ul[data-type="taskList"] { padding-left: 0; list-style: none; }
.ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: ${spacing['2']}; }
.ProseMirror mark { background-color: ${colors.orangeLight}; }
.ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  color: ${colors.textTertiary};
  float: left;
  height: 0;
  pointer-events: none;
}
`

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content = '',
  onChange,
  placeholder = 'Start typing...',
  editable = true,
  minHeight = 120,
}) => {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content,
    editable,
    onUpdate: ({ editor: ed }) => {
      if (!onChange) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onChange(ed.getHTML())
      }, 500)
    },
  })

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const runCommand = useCallback(
    (cb: (chain: ReturnType<NonNullable<typeof editor>['chain']>) => ReturnType<NonNullable<typeof editor>['chain']>) => {
      if (!editor) return
      cb(editor.chain().focus()).run()
    },
    [editor],
  )

  if (!editor) return null

  return (
    <div
      style={{
        border: `1px solid ${colors.borderDefault}`,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
      }}
    >
      <style>{editorStyles}</style>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['1'],
          padding: `${spacing['1']} ${spacing['2']}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.surfacePage,
        }}
      >
        <ToolbarButton
          onClick={() => runCommand(c => c.toggleBold())}
          active={editor.isActive('bold')}
          icon={<Bold size={14} />}
          title="Bold"
        />
        <ToolbarButton
          onClick={() => runCommand(c => c.toggleItalic())}
          active={editor.isActive('italic')}
          icon={<Italic size={14} />}
          title="Italic"
        />
        <ToolbarButton
          onClick={() => runCommand(c => c.toggleStrike())}
          active={editor.isActive('strike')}
          icon={<Strikethrough size={14} />}
          title="Strikethrough"
        />
        <ToolbarButton
          onClick={() => runCommand(c => c.toggleHeading({ level: 2 }))}
          active={editor.isActive('heading', { level: 2 })}
          icon={<Heading2 size={14} />}
          title="Heading 2"
        />
        <ToolbarButton
          onClick={() => runCommand(c => c.toggleBulletList())}
          active={editor.isActive('bulletList')}
          icon={<List size={14} />}
          title="Bullet List"
        />
        <ToolbarButton
          onClick={() => runCommand(c => c.toggleOrderedList())}
          active={editor.isActive('orderedList')}
          icon={<ListOrdered size={14} />}
          title="Ordered List"
        />
        <ToolbarButton
          onClick={() => runCommand(c => c.toggleTaskList())}
          active={editor.isActive('taskList')}
          icon={<CheckSquare size={14} />}
          title="Task List"
        />
        <ToolbarButton
          onClick={() => runCommand(c => c.toggleHighlight())}
          active={editor.isActive('highlight')}
          icon={<Highlighter size={14} />}
          title="Highlight"
        />
      </div>

      {/* Editor content */}
      <div
        style={{
          minHeight,
          padding: spacing['4'],
          fontFamily: typography.fontFamily,
          fontSize: typography.fontSize.body,
          lineHeight: typography.lineHeight.normal,
          color: colors.textPrimary,
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
