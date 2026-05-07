/**
 * RFIQuestionBody — read-only render of the RFI question body.
 *
 * Replaces the legacy `<div style={{ whiteSpace: 'pre-wrap' }}>` render
 * on RFIDetail that strips formatting, even though `RFIRichTextEditor`
 * already writes TipTap HTML to the existing `question` TEXT column.
 *
 * The May-7 final gap audit's item #5: "the Question body has no
 * rich-text on display" — fixed here by mounting a TipTap editor in
 * read-only mode (`editable: false`) over the stored HTML. Same
 * StarterKit as the writer, so HTML round-trips exactly.
 *
 * Falls back to plain text (with whiteSpace: pre-wrap) if the value
 * doesn't look like HTML — this keeps legacy plain-text questions
 * readable until they're re-edited via the rich editor.
 */

import React, { useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { colors, typography } from '../../styles/theme'

interface Props {
  /** Either rich HTML (newer rows) or plain text (legacy rows). */
  body: string | null | undefined
  /** Optional fallback if `body` is empty/null. */
  fallback?: string
}

const looksLikeHtml = (s: string): boolean => /<[a-z][^>]*>/i.test(s)

export const RFIQuestionBody: React.FC<Props> = ({ body, fallback = '' }) => {
  const value = (body ?? '').trim() || fallback.trim()
  const isHtml = useMemo(() => !!value && looksLikeHtml(value), [value])

  const editor = useEditor(
    {
      extensions: [StarterKit],
      content: isHtml ? value : '',
      editable: false,
      // Run in immediatelyRender: false to avoid SSR mismatch warnings.
      immediatelyRender: false,
    },
    [value, isHtml],
  )

  if (!value) {
    return (
      <div
        style={{
          fontSize: typography.fontSize.body,
          color: colors.textTertiary,
          fontStyle: 'italic',
        }}
      >
        No question text.
      </div>
    )
  }

  if (isHtml) {
    return (
      <div
        className="rfi-question-body"
        style={{
          fontSize: 15,
          color: colors.textPrimary,
          lineHeight: 1.75,
          wordBreak: 'break-word',
        }}
      >
        <EditorContent editor={editor} />
      </div>
    )
  }

  // Legacy plain text — preserve newlines, treat as text (no HTML
  // interpretation, no XSS risk).
  return (
    <div
      style={{
        fontSize: 15,
        color: colors.textPrimary,
        lineHeight: 1.75,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {value}
    </div>
  )
}

export default RFIQuestionBody
