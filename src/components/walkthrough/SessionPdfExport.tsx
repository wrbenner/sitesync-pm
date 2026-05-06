/**
 * SessionPdfExport — POSTs to the `walkthrough-pdf` edge function and
 * surfaces a download link to the PM.
 *
 * The button doesn't manage the session row itself; the edge function
 * persists `pdf_export_url` + `pdf_content_hash` server-side, and the
 * page query refetches the session.
 */

import React, { useState } from 'react'
import { FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { colors, typography } from '../../styles/theme'
import { supabase } from '../../lib/supabase'

export interface SessionPdfExportProps {
  sessionId: string
  /** Existing PDF URL — if set, the button shows "Re-generate". */
  existingUrl?: string | null
  /** Called after a successful generate so the parent can refetch. */
  onGenerated?: (pdfUrl: string) => void
}

export const SessionPdfExport: React.FC<SessionPdfExportProps> = ({
  sessionId,
  existingUrl,
  onGenerated,
}) => {
  const [busy, setBusy] = useState(false)

  const generate = async () => {
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke<{ pdf_url?: string; error?: string }>(
        'walkthrough-pdf',
        { body: { session_id: sessionId } },
      )
      if (error) throw error
      if (!data?.pdf_url) throw new Error(data?.error ?? 'No PDF URL returned')
      toast.success('PDF generated')
      onGenerated?.(data.pdf_url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate PDF'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: typography.fontFamily,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.06em',
          padding: '8px 14px',
          border: `1px solid ${colors.primaryOrange}`,
          background: busy ? 'transparent' : colors.primaryOrange,
          color: busy ? colors.primaryOrange : 'white',
          borderRadius: 6,
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        <FileDown size={14} />
        {busy ? 'Generating…' : existingUrl ? 'Re-generate PDF' : 'Generate PDF'}
      </button>
      {existingUrl && (
        <a
          href={existingUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            fontFamily: typography.fontFamily,
            fontSize: 12,
            color: colors.ink3,
            textDecoration: 'underline',
            textDecorationColor: colors.hairline2,
          }}
        >
          Download last PDF
        </a>
      )}
    </div>
  )
}

export default SessionPdfExport
