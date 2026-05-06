// ─────────────────────────────────────────────────────────────────────────────
// Stream Role Filters — same data, different lens
// ─────────────────────────────────────────────────────────────────────────────
// Six personas drive the homepage stream. Each filter receives an assembled
// StreamItem plus a context object; the hook applies the matching filter
// before sorting. See PRODUCT-DIRECTION.md "Role-Based Filtering".
// ─────────────────────────────────────────────────────────────────────────────

import type { StreamRole, StreamItem } from '../types/stream'

export interface RoleFilterContext {
  /**
   * Subcontractor company id. Required for the `subcontractor` lens —
   * supplied either by the authenticated user's project membership or by
   * a magic-link `ActorContext`. Without it, the sub stream is empty.
   */
  companyId?: string
}

type RoleFilter = (item: StreamItem, ctx: RoleFilterContext) => boolean

const SUPER_TYPES: ReadonlyArray<StreamItem['type']> = [
  'daily_log', 'punch', 'incident', 'schedule', 'task',
]

const ARCHITECT_TYPES: ReadonlyArray<StreamItem['type']> = [
  'rfi', 'submittal',
]

export const ROLE_FILTERS: Record<StreamRole, RoleFilter> = {
  pm: () => true,

  superintendent: (item) => SUPER_TYPES.includes(item.type),

  owner: (item) =>
    item.cardType === 'decision' ||
    item.type === 'schedule' ||
    item.costImpact != null,

  subcontractor: (item, ctx) => {
    if (!ctx.companyId) return false
    const data = item.sourceData as { assigned_company_id?: string | null } | null
    return data?.assigned_company_id === ctx.companyId
  },

  architect: (item) => ARCHITECT_TYPES.includes(item.type),

  executive: (item) => item.urgency === 'critical' || item.cardType === 'risk',
}
