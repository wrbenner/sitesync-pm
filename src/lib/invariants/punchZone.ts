export type PunchItemStatus = 'open' | 'in_progress' | 'verified' | 'rejected'

export interface PunchItemSnapshot {
  id: string
  status: PunchItemStatus
}

export interface PunchZoneSnapshot {
  zoneId: string
  items: readonly PunchItemSnapshot[]
  completedAt: string | null
}

export class PunchZoneCompletionViolation extends Error {
  readonly zoneId: string
  readonly openItemIds: readonly string[]

  constructor(zoneId: string, openItemIds: readonly string[]) {
    super(`punch_zone_completion violated: zone ${zoneId} marked completed while ${openItemIds.length} item(s) not verified: ${openItemIds.join(', ')}`)
    this.name = 'PunchZoneCompletionViolation'
    this.zoneId = zoneId
    this.openItemIds = openItemIds
  }
}

export function allItemsVerified(items: readonly PunchItemSnapshot[]): boolean {
  return items.length > 0 && items.every((item) => item.status === 'verified')
}

export function assertPunchZoneCompletionValid(zone: PunchZoneSnapshot): void {
  if (zone.completedAt === null) return
  const unverified = zone.items.filter((i) => i.status !== 'verified')
  if (unverified.length > 0) {
    throw new PunchZoneCompletionViolation(zone.zoneId, unverified.map((i) => i.id))
  }
}
