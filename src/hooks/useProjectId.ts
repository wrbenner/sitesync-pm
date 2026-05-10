// Returns the active project ID for database queries.
// Reads from the project context store, which persists the selected project across sessions.
// When routing includes a project param, that takes precedence over the stored selection.

import { isDevBypassActive } from '../lib/devBypass'
import { useProjectStore } from '../stores/projectStore'

// In dev-bypass mode the project store never loads from Supabase.
// Fall back to the seed project ID so pages skip the "Select a project" gate.
const BYPASS_PROJECT_ID = 'demo-proj-maple-ridge-0001'

export function useProjectId(): string | undefined {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  if (!activeProjectId && isDevBypassActive()) return BYPASS_PROJECT_ID
  return activeProjectId ?? undefined
}
