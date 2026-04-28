/**
 * useFieldSession — write a row to `field_session_events` per
 * app-foreground session. The PMF signal for the SiteSync vision.
 *
 * We define a "session" as: the app is in the foreground from when
 * `useFieldSession` mounts (or the page becomes visible) until either
 * (a) the page is hidden for >30 seconds, or (b) the component
 * unmounts. Background blip-aways shorter than 30s do NOT close the
 * session — that filters out toast acknowledgements and quick context
 * switches.
 *
 * Cheap. Fire-and-forget. Failures are silent (telemetry must never
 * break the user's flow).
 *
 * Mount this hook ONCE near the root of an authenticated layout.
 */

import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useProjectId } from './useProjectId'

const HIDE_GRACE_MS = 30_000
const APP_BUILD = (import.meta.env.VITE_APP_BUILD as string | undefined) ?? 'dev'

function inferSurface(): 'field' | 'desktop' | 'tablet' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown'
  const w = window.innerWidth
  if (w < 768) return 'field'
  if (w <= 1024) return 'tablet'
  return 'desktop'
}

function inferNetwork(): 'online' | 'offline' | 'slow' | null {
  if (typeof navigator === 'undefined') return null
  if (!navigator.onLine) return 'offline'
  type ConnLike = { effectiveType?: string }
  const conn = (navigator as Navigator & { connection?: ConnLike }).connection
  if (conn?.effectiveType && /^(slow-2g|2g|3g)$/.test(conn.effectiveType)) return 'slow'
  return 'online'
}

export function useFieldSession(activity: 'capture' | 'view' | 'navigate' | 'log' | 'transition' | 'search' | 'offline_queue' = 'view') {
  const { user } = useAuth()
  const projectId = useProjectId()
  const sessionIdRef = useRef<string | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closedRef = useRef(false)

  useEffect(() => {
    if (!user?.id || !projectId) return
    closedRef.current = false

    let cancelled = false

    async function start() {
      const insertRow = {
        project_id: projectId!,
        user_id: user!.id,
        surface: inferSurface(),
        activity,
        network: inferNetwork(),
        app_build: APP_BUILD,
      }
      try {
        const { data } = await supabase
          .from('field_session_events')
          .insert(insertRow as never)
          .select('id')
          .single()
        if (!cancelled && data) {
          sessionIdRef.current = (data as { id: string }).id
        }
      } catch {
        // Telemetry never blocks the user — swallow failures.
      }
    }

    async function close() {
      if (closedRef.current || !sessionIdRef.current) return
      closedRef.current = true
      try {
        await supabase
          .from('field_session_events')
          .update({ ended_at: new Date().toISOString() } as never)
          .eq('id', sessionIdRef.current)
      } catch {
        // ignore
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
        hideTimerRef.current = setTimeout(() => {
          void close()
        }, HIDE_GRACE_MS)
      } else {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      }
    }

    void start()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', close)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', close)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      void close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, projectId])

  /** Mark the current session as having produced a real mutation. */
  const recordMutation = async () => {
    if (!sessionIdRef.current) return
    try {
      await supabase
        .from('field_session_events')
        .update({ did_mutate: true } as never)
        .eq('id', sessionIdRef.current)
    } catch {
      // ignore
    }
  }

  return { recordMutation }
}
