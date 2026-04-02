// v1 router — maps resource paths to endpoint handlers.
//
// This layer exists to:
//   1. Enforce the /api/v1/ prefix on all public routes
//   2. Let v2 import the same handlers with a different prefix
//   3. Centralize auth/scope checks before delegating to handlers
//
// In the current client-only architecture the "router" is a registry
// that the fetch interceptor and any future Edge Functions can consult.
// When a real API server is introduced, replace the dispatch() body
// with actual HTTP routing (e.g. Hono, Express).

import type { ApiKeyScope } from '../../types/webhooks'

export interface V1Route {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string                    // e.g. '/api/v1/webhooks'
  requiredScope: ApiKeyScope | null // null = requires session auth only
  description: string
}

export const v1Routes: V1Route[] = [
  // Webhook endpoints
  { method: 'GET',    path: '/api/v1/webhooks',                    requiredScope: 'webhooks:read',  description: 'List webhook endpoints for the org' },
  { method: 'POST',   path: '/api/v1/webhooks',                    requiredScope: 'webhooks:write', description: 'Create a webhook endpoint' },
  { method: 'GET',    path: '/api/v1/webhooks/:id',                requiredScope: 'webhooks:read',  description: 'Get a single webhook endpoint' },
  { method: 'PATCH',  path: '/api/v1/webhooks/:id',                requiredScope: 'webhooks:write', description: 'Update a webhook endpoint' },
  { method: 'DELETE', path: '/api/v1/webhooks/:id',                requiredScope: 'webhooks:write', description: 'Delete a webhook endpoint' },
  { method: 'GET',    path: '/api/v1/webhooks/:id/deliveries',     requiredScope: 'webhooks:read',  description: 'List delivery attempts for an endpoint' },

  // API keys (session auth only — you cannot create a key with a key)
  { method: 'GET',    path: '/api/v1/api-keys',                    requiredScope: null, description: 'List API keys for the org' },
  { method: 'POST',   path: '/api/v1/api-keys',                    requiredScope: null, description: 'Create an API key (raw key returned once)' },
  { method: 'DELETE', path: '/api/v1/api-keys/:id',                requiredScope: null, description: 'Revoke an API key' },

  // RFIs
  { method: 'GET',    path: '/api/v1/projects/:projectId/rfis',    requiredScope: 'rfis:read',  description: 'List RFIs for a project' },
  { method: 'POST',   path: '/api/v1/projects/:projectId/rfis',    requiredScope: 'rfis:write', description: 'Create an RFI' },
  { method: 'GET',    path: '/api/v1/projects/:projectId/rfis/:id', requiredScope: 'rfis:read', description: 'Get an RFI' },
  { method: 'PATCH',  path: '/api/v1/projects/:projectId/rfis/:id', requiredScope: 'rfis:write', description: 'Update an RFI' },

  // Submittals
  { method: 'GET',    path: '/api/v1/projects/:projectId/submittals',     requiredScope: 'submittals:read',  description: 'List submittals' },
  { method: 'POST',   path: '/api/v1/projects/:projectId/submittals',     requiredScope: 'submittals:write', description: 'Create a submittal' },
  { method: 'PATCH',  path: '/api/v1/projects/:projectId/submittals/:id', requiredScope: 'submittals:write', description: 'Update a submittal' },

  // Budget
  { method: 'GET',    path: '/api/v1/projects/:projectId/budget',         requiredScope: 'budget:read',  description: 'List budget line items' },
  { method: 'POST',   path: '/api/v1/projects/:projectId/budget',         requiredScope: 'budget:write', description: 'Create a budget item' },

  // Schedule
  { method: 'GET',    path: '/api/v1/projects/:projectId/schedule',       requiredScope: 'schedule:read',  description: 'List schedule phases' },
  { method: 'POST',   path: '/api/v1/projects/:projectId/schedule',       requiredScope: 'schedule:write', description: 'Create a schedule phase' },
]

/**
 * Resolve which scope a given method + path requires.
 *
 * Return values:
 *   - `undefined`  — no matching route registered (caller should respond 404/403)
 *   - `null`       — route found, session auth only; no API key scope required
 *   - `ApiKeyScope` — route found, API key must carry this scope
 */
export function resolveRequiredScope(
  method: string,
  path: string,
): ApiKeyScope | null | undefined {
  const route = v1Routes.find(r => r.method === method && pathMatches(r.path, path))
  if (!route) return undefined
  return route.requiredScope
}

/** Minimal path matching: supports :param segments. Exported for unit testing. */
export function pathMatches(pattern: string, actual: string): boolean {
  const patternParts = pattern.split('/')
  const actualParts = actual.split('/')
  if (patternParts.length !== actualParts.length) return false
  return patternParts.every(
    (segment, i) => segment.startsWith(':') || segment === actualParts[i],
  )
}
