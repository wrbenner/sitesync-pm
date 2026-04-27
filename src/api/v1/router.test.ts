import { describe, it, expect } from 'vitest'
import { resolveRequiredScope, pathMatches, v1Routes } from './router'

describe('v1 router — pathMatches', () => {
  it('matches identical literal paths', () => {
    expect(pathMatches('/api/v1/webhooks', '/api/v1/webhooks')).toBe(true)
  })

  it('treats :param segments as wildcards (alphanum + dash)', () => {
    expect(pathMatches('/api/v1/webhooks/:id', '/api/v1/webhooks/wh-123')).toBe(true)
    expect(pathMatches('/api/v1/webhooks/:id', '/api/v1/webhooks/abc')).toBe(true)
  })

  it('rejects :param values with disallowed characters (slashes, dots)', () => {
    expect(pathMatches('/api/v1/webhooks/:id', '/api/v1/webhooks/abc.def')).toBe(false)
    expect(pathMatches('/api/v1/webhooks/:id', '/api/v1/webhooks/abc/def')).toBe(false)
  })

  it('rejects shorter or longer paths than the pattern', () => {
    expect(pathMatches('/api/v1/webhooks/:id', '/api/v1/webhooks')).toBe(false)
    expect(pathMatches('/api/v1/webhooks/:id', '/api/v1/webhooks/abc/extra')).toBe(false)
  })

  it('handles nested :param segments (project + entity ids)', () => {
    expect(
      pathMatches(
        '/api/v1/projects/:projectId/rfis/:id',
        '/api/v1/projects/proj-1/rfis/rfi-2',
      ),
    ).toBe(true)
  })

  it('rejects when a literal segment does not match', () => {
    expect(
      pathMatches(
        '/api/v1/projects/:projectId/rfis/:id',
        '/api/v1/projects/proj-1/submittals/sub-2',
      ),
    ).toBe(false)
  })

  it('normalises path: collapses double slashes + drops empty segments', () => {
    expect(pathMatches('/api/v1/webhooks', '/api//v1//webhooks')).toBe(true)
  })

  it('decodes URL-encoded path segments before matching', () => {
    // Encoded /api/v1/webhooks
    expect(pathMatches('/api/v1/webhooks', '/api/v1/web%68ooks')).toBe(true)
  })
})

describe('v1 router — resolveRequiredScope', () => {
  it('returns the scope for a registered route', () => {
    expect(resolveRequiredScope('GET', '/api/v1/webhooks')).toBe('webhooks:read')
    expect(resolveRequiredScope('POST', '/api/v1/webhooks')).toBe('webhooks:write')
    expect(resolveRequiredScope('PATCH', '/api/v1/webhooks/wh-1')).toBe('webhooks:write')
  })

  it('returns null for routes that require session auth only', () => {
    expect(resolveRequiredScope('GET', '/api/v1/api-keys')).toBeNull()
    expect(resolveRequiredScope('POST', '/api/v1/api-keys')).toBeNull()
  })

  it('returns undefined when no route matches', () => {
    expect(resolveRequiredScope('GET', '/api/v2/webhooks')).toBeUndefined()
    expect(resolveRequiredScope('GET', '/nonsense/path')).toBeUndefined()
  })

  it('discriminates by method (GET vs POST give different scopes)', () => {
    expect(resolveRequiredScope('GET', '/api/v1/projects/proj-1/rfis')).toBe('rfis:read')
    expect(resolveRequiredScope('POST', '/api/v1/projects/proj-1/rfis')).toBe('rfis:write')
  })

  it('handles param-segment routes correctly', () => {
    expect(resolveRequiredScope('GET', '/api/v1/projects/abc/rfis/xyz')).toBe('rfis:read')
    expect(resolveRequiredScope('PATCH', '/api/v1/projects/abc/rfis/xyz')).toBe('rfis:write')
  })

  it('strict on method (using DELETE on a GET-only path → undefined)', () => {
    expect(resolveRequiredScope('DELETE', '/api/v1/webhooks/wh-1/deliveries')).toBeUndefined()
  })
})

describe('v1 router — v1Routes registry', () => {
  it('every route uses an /api/v1 prefix', () => {
    for (const r of v1Routes) {
      expect(r.path.startsWith('/api/v1/')).toBe(true)
    }
  })

  it('every route has a non-empty description', () => {
    for (const r of v1Routes) {
      expect(r.description).toBeTruthy()
    }
  })

  it('method is one of the documented HTTP verbs', () => {
    const allowed = new Set(['GET', 'POST', 'PATCH', 'DELETE'])
    for (const r of v1Routes) {
      expect(allowed.has(r.method)).toBe(true)
    }
  })

  it('write operations require write scopes (POST/PATCH/DELETE never have a read scope)', () => {
    for (const r of v1Routes) {
      if (r.method === 'GET' || r.requiredScope === null) continue
      expect(
        r.requiredScope,
        `${r.method} ${r.path} has scope ${r.requiredScope} — write methods cannot use :read`,
      ).not.toMatch(/:read$/)
    }
  })

  it('read operations (GET) never carry a :write scope', () => {
    for (const r of v1Routes) {
      if (r.method !== 'GET' || r.requiredScope === null) continue
      expect(
        r.requiredScope,
        `GET ${r.path} has scope ${r.requiredScope} — read methods cannot use :write`,
      ).not.toMatch(/:write$/)
    }
  })

  it('routes are not duplicated (method + path uniqueness)', () => {
    const keys = v1Routes.map((r) => `${r.method} ${r.path}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
