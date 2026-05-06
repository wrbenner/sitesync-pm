/**
 * CitationPanel — right-edge side panel that opens when a citation is
 * clicked from the Iris inbox.
 *
 * ADR-004: side panel, not modal, not full-page nav. 480px on desktop,
 * full bottom-sheet < 768px. Closes on Esc, click-outside, or X.
 *
 * State source: `?cite=<draftId>:<index>` query param. The inbox
 * already has the drafts in memory (via useDraftedActionsForProject),
 * so we look up the citation locally + call resolve_citation only for
 * the deep-link / side_panel_data envelope, never for re-fetching the
 * draft itself.
 *
 * Reference: docs/audits/IRIS_CITATIONS_SPEC_2026-05-04.md § Phase 1+2
 *            docs/audits/ADR_004_CITATION_SIDE_PANEL_2026-05-04.md
 */

import React, { useEffect, useMemo, useState } from 'react'
import { X, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'

import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { citationDeepLink, citationLabel, isCitationKind } from '../../lib/iris/citationRouting'
import type { DraftedAction, DraftedActionCitation } from '../../types/draftedActions'
import { useCloseCitationPanel, parseCiteParam } from '../../hooks/useOpenCitationPanel'
import { RfiCitationPanelContent } from './citations/RfiCitationPanelContent'
import { DrawingCitationPanelContent } from './citations/DrawingCitationPanelContent'
import { DailyLogCitationPanelContent } from './citations/DailyLogCitationPanelContent'
import { ChangeOrderCitationPanelContent } from './citations/ChangeOrderCitationPanelContent'
import { SpecCitationPanelContent } from './citations/SpecCitationPanelContent'
import { SchedulePhaseCitationPanelContent } from './citations/SchedulePhaseCitationPanelContent'
import { GenericCitationPanelContent } from './citations/GenericCitationPanelContent'

type ResolvedStatus = 'ok' | 'stale' | 'not_found' | 'forbidden'

interface ResolvedCitation {
  status: ResolvedStatus
  label?: string
  deep_link?: string
  side_panel_data?: Record<string, unknown>
}

export interface CitationPanelProps {
  /** All drafts visible in the inbox; the panel finds its citation by id+index. */
  drafts: DraftedAction[]
}

const PANEL_WIDTH = 480

export const CitationPanel: React.FC<CitationPanelProps> = ({ drafts }) => {
  const [searchParams] = useSearchParams()
  const close = useCloseCitationPanel()
  const parsed = parseCiteParam(searchParams.get('cite'))

  const draft = useMemo(
    () => (parsed ? drafts.find((d) => d.id === parsed.draftId) ?? null : null),
    [drafts, parsed],
  )
  const citation: DraftedActionCitation | null = useMemo(() => {
    if (!parsed || !draft) return null
    return draft.citations[parsed.citationIndex] ?? null
  }, [draft, parsed])

  // Esc closes the panel. Match the existing IrisDraftDrawer pattern.
  useEffect(() => {
    if (!parsed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [parsed, close])

  return (
    <AnimatePresence>
      {parsed && citation && (
        <CitationPanelInner
          key={`${parsed.draftId}:${parsed.citationIndex}`}
          citation={citation}
          onClose={close}
        />
      )}
    </AnimatePresence>
  )
}

interface InnerProps {
  citation: DraftedActionCitation
  onClose: () => void
}

const CitationPanelInner: React.FC<InnerProps> = ({ citation, onClose }) => {
  const [resolved, setResolved] = useState<ResolvedCitation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      if (!isSupabaseConfigured || !citation.ref || !isCitationKind(citation.kind)) {
        if (!cancelled) {
          setResolved({ status: 'ok' })
          setLoading(false)
        }
        return
      }
      const { data, error } = await supabase.rpc('resolve_citation', {
        p_kind: citation.kind,
        p_ref: citation.ref,
        p_payload: { x: citation.x, y: citation.y },
      })
      if (cancelled) return
      if (error || !data) {
        setResolved({ status: 'not_found' })
      } else {
        setResolved(data as unknown as ResolvedCitation)
      }
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [citation])

  const fallbackLink = citationDeepLink(citation)
  const deepLink = resolved?.deep_link ?? fallbackLink
  const statusBanner = resolved && resolved.status !== 'ok' ? statusMessage(resolved.status) : null

  return (
    <>
      {/* Backdrop — captures click-outside without intercepting touch on mobile. */}
      <motion.div
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.35)',
          zIndex: 70,
        }}
      />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={`Citation: ${citation.label}`}
        initial={{ x: PANEL_WIDTH }}
        animate={{ x: 0 }}
        exit={{ x: PANEL_WIDTH }}
        transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(480px, 100vw)',
          backgroundColor: colors.surfaceRaised,
          borderLeft: `1px solid ${colors.borderSubtle}`,
          boxShadow: shadows.lg,
          zIndex: 71,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: typography.fontFamily,
        }}
      >
        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing['4'],
            borderBottom: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Citation · {citationLabel(citation.kind)}
            </span>
            <span
              style={{
                fontSize: typography.fontSize.base,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
                lineHeight: 1.3,
              }}
            >
              {resolved?.label ?? citation.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close citation panel"
            style={{
              background: 'transparent',
              border: 'none',
              padding: spacing['2'],
              cursor: 'pointer',
              color: colors.textTertiary,
              borderRadius: borderRadius.md,
            }}
          >
            <X size={18} />
          </button>
        </header>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: spacing['4'],
            display: 'flex',
            flexDirection: 'column',
            gap: spacing['3'],
          }}
        >
          {statusBanner && (
            <div
              role="status"
              style={{
                padding: spacing['3'],
                backgroundColor: colors.statusPendingSubtle,
                color: colors.statusPending,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: borderRadius.base,
                fontSize: typography.fontSize.sm,
              }}
            >
              {statusBanner}
            </div>
          )}

          {citation.snippet && (
            <blockquote
              style={{
                margin: 0,
                padding: spacing['3'],
                backgroundColor: colors.surfaceInset,
                borderLeft: `3px solid ${colors.primaryOrange}`,
                borderRadius: borderRadius.sm,
                fontSize: typography.fontSize.sm,
                color: colors.textSecondary,
                fontStyle: 'italic',
                whiteSpace: 'pre-wrap',
              }}
            >
              "{citation.snippet}"
            </blockquote>
          )}

          {loading ? (
            <div
              data-skeleton="true"
              style={{
                height: 80,
                backgroundColor: colors.surfaceInset,
                borderRadius: borderRadius.lg,
                animation: 'skeletonPulse 1.5s ease-in-out infinite',
              }}
            />
          ) : (
            <PanelBody
              citation={citation}
              status={resolved?.status ?? 'ok'}
              sidePanelData={resolved?.side_panel_data}
            />
          )}
        </div>

        {/* Footer */}
        {deepLink && resolved?.status === 'ok' && (
          <footer
            style={{
              borderTop: `1px solid ${colors.borderSubtle}`,
              padding: spacing['3'],
            }}
          >
            <a
              href={`#${deepLink}`}
              onClick={onClose}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['3']}`,
                backgroundColor: 'transparent',
                color: colors.primaryOrange,
                border: `1px solid ${colors.primaryOrange}`,
                borderRadius: borderRadius.md,
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold,
                textDecoration: 'none',
              }}
            >
              Open in full page <ExternalLink size={14} />
            </a>
          </footer>
        )}
      </motion.aside>
    </>
  )
}

const PanelBody: React.FC<{
  citation: DraftedActionCitation
  status: ResolvedStatus
  sidePanelData?: Record<string, unknown>
}> = ({ citation, status, sidePanelData }) => {
  if (status !== 'ok') return null
  switch (citation.kind) {
    case 'rfi_reference':
      return <RfiCitationPanelContent data={sidePanelData} />
    case 'drawing_coordinate':
      return <DrawingCitationPanelContent data={sidePanelData} citation={citation} />
    case 'daily_log_excerpt':
      return <DailyLogCitationPanelContent data={sidePanelData} />
    case 'change_order':
      return <ChangeOrderCitationPanelContent data={sidePanelData} />
    case 'spec_reference':
      return <SpecCitationPanelContent data={sidePanelData} />
    case 'schedule_phase':
      return <SchedulePhaseCitationPanelContent data={sidePanelData} />
    case 'budget_line':
    case 'photo_observation':
      return <GenericCitationPanelContent data={sidePanelData} citation={citation} />
  }
}

function statusMessage(status: ResolvedStatus): string {
  switch (status) {
    case 'stale':
      return 'Source updated since this draft was created. The cited text may no longer match.'
    case 'not_found':
      return 'Source no longer available. The cited entity may have been deleted.'
    case 'forbidden':
      return 'Source is not visible to you. Ask a project admin to share access.'
    case 'ok':
      return ''
  }
}

export default CitationPanel
