import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'

export type InsuranceCertificate = {
  id: string
  project_id: string
  company: string
  subcontractor_id: string | null
  policy_type: 'general_liability' | 'workers_comp' | 'auto' | 'umbrella' | 'professional_liability' | 'pollution' | null
  carrier: string | null
  policy_number: string | null
  coverage_amount: number | null
  aggregate_limit: number | null
  effective_date: string | null
  expiration_date: string | null
  additional_insured: boolean | null
  waiver_of_subrogation: boolean | null
  document_url: string | null
  verified: boolean | null
  verified_by: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export type COIStatus = {
  label: string
  severity: 'expired' | 'expiring' | 'current' | 'unknown'
  daysUntil: number | null
}

export function getCOIStatus(expirationDate: string | null | undefined, warnWithinDays = 30): COIStatus {
  if (!expirationDate) {
    return { label: 'No expiration', severity: 'unknown', daysUntil: null }
  }
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const exp = new Date(expirationDate)
  const daysUntil = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (daysUntil < 0) return { label: `Expired ${Math.abs(daysUntil)}d ago`, severity: 'expired', daysUntil }
  if (daysUntil <= warnWithinDays) return { label: `Expires in ${daysUntil}d`, severity: 'expiring', daysUntil }
  return { label: 'Current', severity: 'current', daysUntil }
}

export function useInsuranceCertificates(projectId: string | undefined) {
  return useQuery({
    queryKey: ['insurance_certificates', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('insurance_certificates')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('expiration_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return (data ?? []) as unknown as InsuranceCertificate[]
    },
    enabled: !!projectId,
  })
}

export function useInsuranceCertificatesByCompany(projectId: string | undefined, company: string | null | undefined) {
  return useQuery({
    queryKey: ['insurance_certificates', projectId, 'company', company],
    queryFn: async () => {
      if (!company) return [] as InsuranceCertificate[]
      const { data, error } = await fromTable('insurance_certificates')
        .select('*')
        .eq('project_id' as never, projectId!)
        .eq('company' as never, company)
        .order('expiration_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return (data ?? []) as unknown as InsuranceCertificate[]
    },
    enabled: !!projectId && !!company,
  })
}
