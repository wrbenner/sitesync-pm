// Returns the active project ID for database queries.
// In the current single-project prototype, this returns the seeded project.
// When multi-project support is added, this will read from route params or a project switcher.

const SEED_PROJECT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

export function useProjectId(): string | undefined {
  // For now, always return the seed project.
  // Future: Read from route params or project switcher when multi-project is implemented
  return SEED_PROJECT_ID
}
