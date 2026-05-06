// DO NOT EDIT IN PLACE — duplicated from src/lib/compliance/bonds/index.ts

// =============================================================================
// Bonds — expiration helpers shared by the watcher edge function
// =============================================================================

export interface BondRow {
  id: string
  project_id: string
  bond_type: 'payment' | 'performance' | 'bid' | 'maintenance' | 'warranty' | 'license'
  company: string
  bond_amount: number
  effective_date: string | null
  expiration_date: string | null
  status: 'active' | 'expired' | 'released' | 'disputed'
}

export type BondAlertTier = 'expired' | 'expires_soon' | 'expires_in_30' | 'expires_in_60' | 'safe' | 'unknown'

export function bondAlertTier(bond: BondRow, asOfIso?: string): BondAlertTier {
  if (bond.status !== 'active') return 'safe'
  if (!bond.expiration_date) return 'unknown'
  const asOf = asOfIso ?? new Date().toISOString().slice(0, 10)
  const days = Math.round(
    (new Date(bond.expiration_date).getTime() - new Date(asOf).getTime()) / (1000 * 60 * 60 * 24),
  )
  if (days < 0) return 'expired'
  if (days <= 14) return 'expires_soon'
  if (days <= 30) return 'expires_in_30'
  if (days <= 60) return 'expires_in_60'
  return 'safe'
}

/** Group bonds by company so a sub on multiple projects shows up once with
 *  the affected projects listed. */
export function aggregateByCompany(bonds: BondRow[]): Array<{
  company: string
  bonds: BondRow[]
  affectedProjects: string[]
  worstTier: BondAlertTier
}> {
  const map = new Map<string, BondRow[]>()
  for (const b of bonds) {
    if (!map.has(b.company)) map.set(b.company, [])
    map.get(b.company)!.push(b)
  }
  const tierRank: Record<BondAlertTier, number> = {
    expired: 5, expires_soon: 4, expires_in_30: 3, expires_in_60: 2, safe: 1, unknown: 0,
  }
  return Array.from(map.entries()).map(([company, rows]) => {
    let worst: BondAlertTier = 'safe'
    for (const b of rows) {
      const t = bondAlertTier(b)
      if (tierRank[t] > tierRank[worst]) worst = t
    }
    return {
      company,
      bonds: rows,
      affectedProjects: Array.from(new Set(rows.map(r => r.project_id))),
      worstTier: worst,
    }
  }).sort((a, b) => tierRank[b.worstTier] - tierRank[a.worstTier])
}
