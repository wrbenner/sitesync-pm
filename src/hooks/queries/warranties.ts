import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'

export interface WarrantyRow {
  id: string
  project_id: string
  item: string
  manufacturer: string | null
  subcontractor: string | null
  trade: string | null
  category: string | null
  warranty_type: string | null
  start_date: string | null
  expiration_date: string | null
  duration_years: number | null
  status: string | null
  document_url: string | null
  coverage_description: string | null
  coverage_details: string | null
  limitations: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  reminder_7_sent: boolean | null
  reminder_30_sent: boolean | null
  created_at: string | null
  updated_at: string | null
}

export type WarrantyStatus = 'active' | 'expiring_soon' | 'expired'

export interface WarrantyWithStatus extends WarrantyRow {
  computedStatus: WarrantyStatus
  daysUntilExpiration: number | null
}

export function deriveWarrantyStatus(expirationDate: string | null): {
  status: WarrantyStatus
  days: number | null
} {
  if (!expirationDate) return { status: 'active', days: null }
  const now = Date.now()
  const exp = new Date(expirationDate).getTime()
  const days = Math.ceil((exp - now) / (1000 * 60 * 60 * 24))
  if (days < 0) return { status: 'expired', days }
  if (days <= 90) return { status: 'expiring_soon', days }
  return { status: 'active', days }
}

export function useWarranties(projectId: string | undefined) {
  return useQuery({
    queryKey: ['warranties', projectId],
    queryFn: async (): Promise<WarrantyWithStatus[]> => {
      const { data, error } = await fromTable('warranties')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('expiration_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      const rows = (data ?? []) as unknown as WarrantyRow[]
      return rows.map((w) => {
        const { status, days } = deriveWarrantyStatus(w.expiration_date)
        return { ...w, computedStatus: status, daysUntilExpiration: days }
      })
    },
    enabled: !!projectId,
  })
}
