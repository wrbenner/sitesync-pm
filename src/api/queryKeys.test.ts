import { describe, it, expect } from 'vitest'
import { queryKeys, allProjectEntityKeys } from './queryKeys'

// queryKeys is the source of truth for every TanStack Query cache key.
// A regression here means a mutation invalidates the wrong cache or a
// query reads from the wrong key — both silently break optimistic UI.

describe('queryKeys — top-level entity keys', () => {
  it('projects.all is ["projects"]', () => {
    expect(queryKeys.projects.all).toEqual(['projects'])
  })

  it('projects.detail returns ["projects", id]', () => {
    expect(queryKeys.projects.detail('p-1')).toEqual(['projects', 'p-1'])
  })

  it('detail keys nest under "detail" segment to avoid collision with .all', () => {
    expect(queryKeys.rfis.detail('r-1')).toEqual(['rfis', 'detail', 'r-1'])
    expect(queryKeys.submittals.detail('s-1')).toEqual(['submittals', 'detail', 's-1'])
    expect(queryKeys.tasks.detail('t-1')).toEqual(['tasks', 'detail', 't-1'])
  })

  it('all-keys are scoped by projectId for project-bound entities', () => {
    expect(queryKeys.rfis.all('p-1')).toEqual(['rfis', 'p-1'])
    expect(queryKeys.submittals.all('p-1')).toEqual(['submittals', 'p-1'])
    expect(queryKeys.punchItems.all('p-1')).toEqual(['punch_items', 'p-1'])
    expect(queryKeys.changeOrders.all('p-1')).toEqual(['change_orders', 'p-1'])
    expect(queryKeys.dailyLogs.all('p-1')).toEqual(['daily_logs', 'p-1'])
  })

  it('switching projectId yields a different key (cache key cannot leak)', () => {
    expect(queryKeys.rfis.all('p-1')).not.toEqual(queryKeys.rfis.all('p-2'))
  })
})

describe('queryKeys — notifications + global keys', () => {
  it('notifications.all and notifications.unread are global (no project id)', () => {
    expect(queryKeys.notifications.all).toEqual(['notifications'])
    expect(queryKeys.notifications.unread).toEqual(['notifications', 'unread'])
  })

  it('organizations.all is global', () => {
    expect(queryKeys.organizations.all).toEqual(['organizations'])
  })

  it('organizations.projects(orgId) is org-scoped', () => {
    expect(queryKeys.organizations.projects('o-1')).toEqual(['organizations', 'o-1', 'projects'])
  })
})

describe('queryKeys — metrics', () => {
  it('project metrics are project-scoped', () => {
    expect(queryKeys.metrics.project('p-1')).toEqual(['metrics', 'project', 'p-1'])
  })

  it('portfolio metrics are org-scoped', () => {
    expect(queryKeys.metrics.portfolio('o-1')).toEqual(['metrics', 'portfolio', 'o-1'])
  })
})

describe('queryKeys — aiInsights', () => {
  it('byPage adds the page slug to the key', () => {
    expect(queryKeys.aiInsights.byPage('p-1', 'rfis')).toEqual(['ai_insights', 'p-1', 'rfis'])
  })

  it('different pages produce different keys for the same project', () => {
    expect(queryKeys.aiInsights.byPage('p-1', 'rfis')).not.toEqual(
      queryKeys.aiInsights.byPage('p-1', 'submittals'),
    )
  })
})

describe('queryKeys — lienWaivers', () => {
  it('byPayApp groups under a "pay_app" segment', () => {
    expect(queryKeys.lienWaivers.byPayApp('pa-1')).toEqual(['lien_waivers', 'pay_app', 'pa-1'])
  })
})

describe('queryKeys — auditLog', () => {
  it('project key is just project-scoped', () => {
    expect(queryKeys.auditLog.project('p-1')).toEqual(['audit_log', 'p-1'])
  })

  it('projectFiltered embeds the filter object so different filters are different keys', () => {
    const a = queryKeys.auditLog.projectFiltered('p-1', { entity: 'rfi' })
    const b = queryKeys.auditLog.projectFiltered('p-1', { entity: 'submittal' })
    expect(a).not.toEqual(b)
  })

  it('entity audit key includes both entityType and entityId', () => {
    expect(queryKeys.auditLog.entity('rfi', 'r-1')).toEqual(['audit_log', 'entity', 'rfi', 'r-1'])
  })
})

describe('allProjectEntityKeys — bulk-invalidation surface', () => {
  it('returns at least the documented project-scoped entities', () => {
    const keys = allProjectEntityKeys('p-1')
    expect(keys.length).toBeGreaterThanOrEqual(20)
  })

  it('every returned key is project-id-scoped (last meaningful segment)', () => {
    const keys = allProjectEntityKeys('SCOPE')
    for (const key of keys) {
      // Each key array contains 'SCOPE' somewhere
      expect(key.includes('SCOPE'), `key ${JSON.stringify(key)} missing project scope`).toBe(true)
    }
  })

  it('different project ids produce disjoint key sets', () => {
    const p1 = allProjectEntityKeys('p-1').map((k) => JSON.stringify(k))
    const p2 = allProjectEntityKeys('p-2').map((k) => JSON.stringify(k))
    for (const k of p1) {
      expect(p2).not.toContain(k)
    }
  })

  it('includes RFI / submittal / task / drawing / change-order keys at minimum', () => {
    const keys = allProjectEntityKeys('p').map((k) => k[0])
    expect(keys).toEqual(
      expect.arrayContaining([
        'rfis', 'submittals', 'tasks', 'drawings',
        'change_orders', 'daily_logs', 'punch_items',
        'budget_items', 'meetings', 'files',
      ]),
    )
  })
})
