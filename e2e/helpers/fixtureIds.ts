/**
 * Fixture IDs — pinned UUIDv4s for the e2e scenario projects.
 *
 * Lives in its own zero-dependency module so unit tests can import it
 * without dragging the `postgres` runtime dep through Vitest's bundler.
 */

export const FIXTURE_PROJECT_IDS = [
  'e2000001-0000-4000-8000-000000000001',  // Small / fast scenario
  'e2000001-0000-4000-8000-000000000002',  // Mid / multi-team
  'e2000001-0000-4000-8000-000000000003',  // Enterprise / full pack
] as const
