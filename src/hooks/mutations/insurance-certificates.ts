import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import { uploadFile } from '../../lib/storage'

type CertPayload = {
  project_id: string
  company: string
  subcontractor_id?: string | null
  policy_type?: string | null
  carrier?: string | null
  policy_number?: string | null
  coverage_amount?: number | null
  aggregate_limit?: number | null
  effective_date?: string | null
  expiration_date?: string | null
  additional_insured?: boolean | null
  waiver_of_subrogation?: boolean | null
  document_url?: string | null
  verified?: boolean | null
}

const COI_BUCKET = 'project-files'

export function useCreateInsuranceCertificate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CertPayload) => {
      const { data, error } = await fromTable('insurance_certificates')
        .insert(payload as never)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['insurance_certificates', vars.project_id] })
    },
  })
}

export function useUploadInsuranceCertificate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { cert: CertPayload; file?: File }) => {
      let documentUrl = payload.cert.document_url ?? null
      if (payload.file) {
        const sanitized = payload.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${payload.cert.project_id}/insurance/${Date.now()}_${sanitized}`
        const { url, error: uploadError } = await uploadFile(COI_BUCKET, path, payload.file)
        if (uploadError) throw new Error(uploadError)
        documentUrl = url
      }
      const row: CertPayload = { ...payload.cert, document_url: documentUrl }
      const { data, error } = await fromTable('insurance_certificates')
        .insert(row as never)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['insurance_certificates', vars.cert.project_id] })
    },
  })
}

export function useUpdateInsuranceCertificate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; projectId: string; updates: Partial<CertPayload> }) => {
      const { data, error } = await fromTable('insurance_certificates')
        .update(params.updates)
        .eq('id' as never, params.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['insurance_certificates', vars.projectId] })
    },
  })
}

export function useDeleteInsuranceCertificate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; projectId: string }) => {
      const { error } = await fromTable('insurance_certificates').delete().eq('id' as never, params.id)
      if (error) throw error
      return params
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['insurance_certificates', vars.projectId] })
    },
  })
}
