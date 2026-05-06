// ── RFIRichTextEditor ───────────────────────────────────────────────────
// Bugatti rich-text editor for RFI Question + Response bodies.
//
// Drives:    P1b deliverable #1 from RFI_EDIT_MANIPULATE_AUDIT_2026-05-06.md
//            and the audit's `question TEXT` column (P1a) which already
//            accepts Markdown / HTML.
//
// Toolbar:   bold • italic • underline • strikethrough • bullet list •
//            ordered list • heading • code block • paste-from-clipboard.
//            Link is a prompt-based wrapper that emits an anchor mark via
//            TipTap's chain (StarterKit ships a Link mark in 3.x; if it
//            isn't loaded the button no-ops gracefully).
//
// Why a separate editor (vs reusing src/components/shared/RichTextEditor):
//   • The shared editor's toolbar omits underline + link + code block,
//     which the audit explicitly requires for RFI parity with Procore.
//   • The shared editor debounces on a 500 ms timer; for save-on-Save
//     panel flow we want immediate value flow with no extra delay.
//
// Output contract: HTML string. The DB column is `question TEXT`. All
// inputs go through TipTap's schema, which strips disallowed tags by
// design — we never inject raw user HTML.

import React, { useCallback, useEffect } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered,
  Heading2, Code2, Link as LinkIcon,
} from 'lucide-react'
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme'

interface RFIRichTextEditorProps {
  /** Initial HTML / Markdown content. */
  value: string
  /** Fired on every keystroke with the latest HTML. */
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  /** Optional aria-label for the editable region. */
  ariaLabel?: string
  /** When true, renders as read-only without the toolbar. */
  readOnly?: boolean
}

interface ToolbarButtonProps {
  onClick: () => void
  active?: boolean
  icon: React.ReactNode
  title: string
  disabled?: boolean
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ onClick, active, icon, title, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    aria-pressed={active}
    disabled={disabled}
    style={{
      width: 28,
      height: 28,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: 'none',
      borderRadius: borderRadius.sm,
      backgroundColor: active ? colors.orangeSubtle : 'transparent',
      color: active ? colors.orangeText : colors.textTertiary,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: `all ${transitions.instant}`,
    }}
  >
    {icon}
  </button>
)

const editorStyles = `
.rfi-tiptap .ProseMirror { outline: none; min-height: inherit; }
.rfi-tiptap .ProseMirror p { margin: 0 0 ${spacing['2']}; }
.rfi-tiptap .ProseMirror h2 { font-size: ${typography.fontSize.subtitle}; font-weight: ${typography.fontWeight.semibold}; margin: ${spacing['4']} 0 ${spacing['2']}; }
.rfi-tiptap .ProseMirror ul, .rfi-tiptap .ProseMirror ol { padding-left: ${spacing['6']}; margin: 0 0 ${spacing['2']}; }
.rfi-tiptap .ProseMirror code { background-color: ${colors.surfaceInset}; padding: 1px 4px; border-radius: 4px; font-size: 12px; }
.rfi-tiptap .ProseMirror pre { background-color: ${colors.surfaceInset}; padding: ${spacing['3']}; border-radius: ${borderRadius.base}; overflow-x: auto; }
.rfi-tiptap .ProseMirror a { color: ${colors.primaryOrange}; text-decoration: underline; }
.rfi-tiptap .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  color: ${colors.textTertiary};
  float: left;
  height: 0;
  pointer-events: none;
}
`

export const RFIRichTextEditor: React.FC<RFIRichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Type your RFI question…',
  minHeight = 120,
  ariaLabel,
  readOnly = false,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editable: !readOnly,
    editorProps: {
      attributes: {
        'aria-label': ariaLabel ?? placeholder,
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
    },
  })

  // Sync external value changes (e.g. opening the panel for a different
  // RFI) without losing focus during local typing. Only sync when the
  // value diverges meaningfully — avoids the cursor jumping every
  // keystroke because parent state echoes back what onUpdate just emitted.
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current === value) return
    editor.commands.setContent(value || '', { emitUpdate: false })
  }, [value, editor])

  const promptForLink = useCallback((ed: Editor) => {
    const previousUrl = ed.getAttributes('link').href as string | undefined
    const url = window.prompt('URL (leave blank to remove)', previousUrl ?? '')
    if (url === null) return
    if (url === '') {
      ed.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    const chain = ed.chain().focus().extendMarkRange('link') as ReturnType<Editor['chain']> & {
      setLink?: (attrs: { href: string }) => ReturnType<Editor['chain']>
    }
    if (typeof chain.setLink === 'function') {
      chain.setLink({ href: url }).run()
    }
    // No fallback — if the Link mark isn't present in the schema we'd
    // need to inject raw HTML, which we deliberately don't do (XSS).
  }, [])

  if (!editor) return null

  return (
    <div
      className="rfi-tiptap"
      style={{
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.base,
        overflow: 'hidden',
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <style>{editorStyles}</style>

      {!readOnly && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 2,
            padding: `${spacing['1']} ${spacing['2']}`,
            borderBottom: `1px solid ${colors.borderSubtle}`,
            backgroundColor: colors.surfacePage,
          }}
          role="toolbar"
          aria-label="Rich text formatting"
        >
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            icon={<Bold size={13} />}
            title="Bold (⌘B)"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            icon={<Italic size={13} />}
            title="Italic (⌘I)"
          />
          <ToolbarButton
            onClick={() => {
              const chain = editor.chain().focus() as ReturnType<Editor['chain']> & {
                toggleUnderline?: () => ReturnType<Editor['chain']>
              }
              if (typeof chain.toggleUnderline === 'function') chain.toggleUnderline().run()
            }}
            active={editor.isActive('underline')}
            icon={<UnderlineIcon size={13} />}
            title="Underline (⌘U)"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            icon={<Strikethrough size={13} />}
            title="Strikethrough"
          />
          <Divider />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            icon={<Heading2 size={13} />}
            title="Heading"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            icon={<List size={13} />}
            title="Bulleted list"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            icon={<ListOrdered size={13} />}
            title="Numbered list"
          />
          <Divider />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive('codeBlock')}
            icon={<Code2 size={13} />}
            title="Code block"
          />
          <ToolbarButton
            onClick={() => promptForLink(editor)}
            active={editor.isActive('link')}
            icon={<LinkIcon size={13} />}
            title="Insert link"
          />
        </div>
      )}

      <div
        style={{
          minHeight,
          padding: spacing['3'],
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

const Divider: React.FC = () => (
  <span
    aria-hidden="true"
    style={{
      width: 1,
      height: 16,
      margin: `0 ${spacing['1']}`,
      backgroundColor: colors.borderSubtle,
    }}
  />
)

export default RFIRichTextEditor
