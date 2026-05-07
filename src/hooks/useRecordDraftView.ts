/**
 * useRecordDraftView — fire `record_draft_view` exactly once when a draft
 * card scrolls into the user's viewport.
 *
 * Used by `IrisApprovalGate` to set `first_viewed_at` on `drafted_actions`
 * — the source of truth for the Lap 2 "time-to-approve" gate metric.
 *
 * Dedupe: a module-scoped Set tracks `${sessionId}:${draftId}` keys so a
 * draft that scrolls in and out of view 10 times still only records one
 * view. Without an inbox session (e.g. on a per-entity detail page) we
 * still dedupe per page-mount via the IntersectionObserver disconnect.
 *
 * The fire-and-forget supabase.rpc swallows errors silently. Telemetry
 * loss is acceptable; user-facing latency on the inbox is not.
 */

import { useCallback, useRef } from 'react'

import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useInboxSession } from './useInboxSession'

const recordedKeys = new Set<string>()

const VIEW_INTERSECTION_THRESHOLD = 0.5

export function useRecordDraftView(
  draftId: string | null | undefined,
): (el: HTMLElement | null) => void {
  const sessionId = useInboxSession()
  const observerRef = useRef<IntersectionObserver | null>(null)

  return useCallback(
    (el: HTMLElement | null) => {
      observerRef.current?.disconnect()
      observerRef.current = null

      if (!el || !draftId || !isSupabaseConfigured) return
      if (typeof IntersectionObserver === 'undefined') return

      const dedupeKey = `${sessionId ?? 'no-session'}:${draftId}`
      if (recordedKeys.has(dedupeKey)) return

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          if (!entry?.isIntersecting) return
          if (entry.intersectionRatio < VIEW_INTERSECTION_THRESHOLD) return
          if (recordedKeys.has(dedupeKey)) {
            observer.disconnect()
            return
          }
          recordedKeys.add(dedupeKey)
          if (sessionId == null) {
            // Pre-D38: anonymous draft views aren't recorded. Skip rather
            // than error, so the IntersectionObserver still mark-once works.
            recordedKeys.delete(dedupeKey)
            observer.disconnect()
            return
          }
          void supabase
            .rpc('record_draft_view', {
              p_draft_id: draftId,
              p_session_id: sessionId,
            })
            .then(({ error }) => {
              if (error) recordedKeys.delete(dedupeKey)
            })
          observer.disconnect()
        },
        { threshold: VIEW_INTERSECTION_THRESHOLD },
      )
      observer.observe(el)
      observerRef.current = observer
    },
    [draftId, sessionId],
  )
}

/** Test-only: clear the module-scoped dedupe Set between tests. */
export function __resetRecordedDraftViews() {
  recordedKeys.clear()
}
