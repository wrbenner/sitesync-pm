/**
 * useOpenCitationPanel — open the side-panel surface for a citation.
 *
 * Per ADR-004, citations open in a right-edge side panel whose state
 * is encoded in the `?cite=<draftId>:<index>` query param. This hook:
 *   1. Sets the URL param (so back-button + share-link work)
 *   2. Records the `open_panel` interaction via the citation telemetry
 *      RPC so the gate's diagnostic click-through metric reflects it
 *
 * The hook returns a stable callback. The companion CitationPanel
 * component reads the query param and renders the panel.
 */

import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { CitationKind } from '../lib/iris/citationRouting'
import { useInboxSession } from './useInboxSession'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function useOpenCitationPanel(): (
  draftId: string,
  citationIndex: number,
  citationKind: CitationKind,
) => void {
  const [searchParams, setSearchParams] = useSearchParams()
  const sessionId = useInboxSession()

  return useCallback(
    (draftId, citationIndex, citationKind) => {
      const next = new URLSearchParams(searchParams)
      next.set('cite', `${draftId}:${citationIndex}`)
      setSearchParams(next, { replace: false })

      // Best-effort telemetry — never block the open on it.
      // Synthetic-id drafts (e.g. IrisSuggestionCard) skip the RPC.
      if (!isSupabaseConfigured) return
      if (!UUID_REGEX.test(draftId)) return
      void supabase.rpc('record_citation_interaction', {
        p_draft_id: draftId,
        p_citation_index: citationIndex,
        p_citation_kind: citationKind,
        p_interaction_type: 'open_panel',
        p_session_id: sessionId ?? undefined,
      })
    },
    [searchParams, setSearchParams, sessionId],
  )
}

/** Close handler that clears the cite param without affecting other params. */
export function useCloseCitationPanel(): () => void {
  const [searchParams, setSearchParams] = useSearchParams()
  return useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('cite')
    setSearchParams(next, { replace: false })
  }, [searchParams, setSearchParams])
}

/** Parse the active citation from the URL. Returns null when no panel is open. */
export function parseCiteParam(
  param: string | null,
): { draftId: string; citationIndex: number } | null {
  if (!param) return null
  const colon = param.indexOf(':')
  if (colon < 0) return null
  const draftId = param.slice(0, colon)
  const idx = Number(param.slice(colon + 1))
  if (!draftId || !Number.isInteger(idx) || idx < 0) return null
  return { draftId, citationIndex: idx }
}
