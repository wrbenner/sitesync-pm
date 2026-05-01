import React, { useCallback, useState } from 'react'
import { Link as LinkIcon, Copy as CopyIcon, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'

import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { generateOwnerShareLink } from '../../lib/ownerLinkGenerator'

const IRIS_INDIGO = '#4F46E5'
const IRIS_INDIGO_HOVER = '#4338CA'

interface OwnerLinkButtonProps {
  projectId: string | null
  /** Optional override; defaults to 14 days. */
  ttlHours?: number
}

/**
 * "Generate share link" button for the Owner Update card.
 *
 * Click → calls `generateOwnerShareLink` → renders the URL in a read-only
 * input with a Copy button. Errors surface via toast.
 *
 * Stays compact (single row) so it tucks below the Generate Update CTA on
 * the existing OwnerUpdateGenerator card without restructuring the card.
 */
export const OwnerLinkButton: React.FC<OwnerLinkButtonProps> = ({ projectId, ttlHours }) => {
  const [loading, setLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = useCallback(async () => {
    if (!projectId) {
      toast.error('Select a project first')
      return
    }
    setLoading(true)
    setCopied(false)
    try {
      const result = await generateOwnerShareLink({ projectId, ttlHours })
      if (!result.ok) {
        const message =
          result.error.kind === 'unauthenticated' ? 'Sign in again to generate a share link.'
          : result.error.kind === 'unconfigured' ? 'Share-link service is not configured.'
          : result.error.kind === 'http' ? `Could not generate link (${result.error.status}): ${result.error.message}`
          : result.error.message
        toast.error(message)
        return
      }
      setShareUrl(result.data.shareUrl)
      setExpiresAt(result.data.expiresAt)
      toast.success('Share link generated — owner can view without signing in')
    } finally {
      setLoading(false)
    }
  }, [projectId, ttlHours])

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy — long-press to select the URL manually')
    }
  }, [shareUrl])

  if (shareUrl) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['2'],
          marginTop: spacing['3'],
          padding: spacing['2'],
          backgroundColor: colors.white,
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: borderRadius.md,
        }}
      >
        <LinkIcon size={14} color={IRIS_INDIGO} style={{ flexShrink: 0, marginLeft: 6 }} />
        <input
          readOnly
          value={shareUrl}
          aria-label="Owner share link"
          onFocus={(e) => e.currentTarget.select()}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamilyMono,
            color: colors.textPrimary,
            padding: '4px 0',
            minWidth: 0,
            textOverflow: 'ellipsis',
          }}
        />
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy share link"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 10px',
            border: `1px solid ${colors.borderDefault}`,
            backgroundColor: colors.white,
            color: copied ? colors.statusActive : colors.textPrimary,
            borderRadius: borderRadius.sm,
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.semibold,
            fontFamily: typography.fontFamily,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {copied ? <Check size={12} /> : <CopyIcon size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        {expiresAt && (
          <span
            title={`Link expires ${new Date(expiresAt).toLocaleString()}`}
            style={{
              fontSize: typography.fontSize.caption,
              color: colors.textTertiary,
              whiteSpace: 'nowrap',
              paddingRight: spacing['2'],
              flexShrink: 0,
            }}
          >
            Expires {new Date(expiresAt).toLocaleDateString()}
          </span>
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={loading || !projectId}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginTop: spacing['3'],
        padding: '6px 12px',
        backgroundColor: 'transparent',
        color: IRIS_INDIGO,
        border: `1px solid ${IRIS_INDIGO}40`,
        borderRadius: borderRadius.md,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily,
        cursor: loading || !projectId ? 'not-allowed' : 'pointer',
        opacity: !projectId ? 0.5 : 1,
      }}
      onMouseEnter={(e) => { if (!loading && projectId) e.currentTarget.style.backgroundColor = `${IRIS_INDIGO}08` }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
      title={projectId ? 'Mint a no-login share link the owner can open in their browser' : 'Open a project first'}
    >
      {loading ? (
        <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
      ) : (
        <LinkIcon size={13} />
      )}
      {loading ? 'Generating…' : 'Generate share link'}
      {/* Hover suppression of color shift on iOS — keep a stable hover bg */}
      <span style={{ display: 'none', color: IRIS_INDIGO_HOVER }} aria-hidden />
    </button>
  )
}
