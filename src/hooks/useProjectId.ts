// Returns the active project ID for database queries.
// Reads from the project context store, which persists the selected project across sessions.
// When routing includes a project param, that takes precedence over the stored selection.

import { useProjectContext } from '../stores/projectContextStore'

export function useProjectId(): string | undefined {
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  return activeProjectId ?? undefined
}
