/**
 * track — fire-and-forget page-event telemetry.
 *
 * Writes one row to `iris_telemetry` via the `record_event` SECURITY DEFINER
 * RPC (see `supabase/migrations/20260509000000_iris_telemetry.sql`). Powers
 * per-page adoption signal for the soft pilot. Distinct from the
 * drafted_actions telemetry (which is decision-centric and feeds the Lap-2
 * acceptance matview).
 *
 * Contract:
 *   • Never throws. Telemetry loss is acceptable; UI latency is not.
 *   • Skips silently when no project is in context (e.g. during route
 *     transitions before the projectStore hydrates).
 *   • Skips silently when Supabase isn't configured (test/preview builds).
 *   • Convention: eventName is `<page>.<action>`. The schema does NOT
 *     enforce this; convention lives here.
 *
 * Type-cast note:
 *   `record_event` and the `iris_telemetry` table are added by the
 *   2026-05-09 migration. Until `npm run db-types:write` regenerates
 *   `src/types/database.ts` post-deploy, we narrow the supabase.rpc call
 *   with a single localized cast. Every other surface in the helper is
 *   fully typed.
 */
import { supabase, isSupabaseConfigured } from '../supabase'
import { useProjectStore } from '../../stores/projectStore'

type EventDetails = Record<string, unknown>

interface RecordEventArgs {
  p_project_id: string
  p_event_name: string
  p_details: EventDetails
}

// Localized, documented cast. See "Type-cast note" in the file header.
const callRecordEvent = (args: RecordEventArgs) =>
  (supabase.rpc as unknown as (
    name: string,
    args: RecordEventArgs,
  ) => Promise<{ error: unknown }>)('record_event', args)

let warnedNoProject = false

/**
 * Record a single page-event. Fire-and-forget; never throws.
 *
 * @example
 *   track('day.opened')
 *   track('rfi.status_changed', { rfi_id, status })
 */
export function track(eventName: string, details?: EventDetails): void {
  if (!isSupabaseConfigured) return

  const projectId = useProjectStore.getState().activeProjectId
  if (!projectId) {
    if (!warnedNoProject && import.meta.env.DEV) {
      // Warn once per session — typical cause is firing before the store
      // hydrates from localStorage. Not a bug, just diagnostic.
      console.warn('[track] skipped (no active project):', eventName)
      warnedNoProject = true
    }
    return
  }

  if (import.meta.env.DEV) {
    console.debug('[track]', eventName, details)
  }

  void callRecordEvent({
    p_project_id: projectId,
    p_event_name: eventName,
    p_details: details ?? {},
  })
    .then(({ error }) => {
      if (error) {
        console.warn('[track] failed:', eventName, error)
      }
    })
    .catch((err: unknown) => {
      // The supabase client itself can reject (network error, etc).
      // Telemetry loss is acceptable; UI must never see this.
      console.warn('[track] rejected:', eventName, err)
    })
}

/** Test-only: reset the once-per-session no-project warn flag. */
export function __resetTrackWarn() {
  warnedNoProject = false
}
