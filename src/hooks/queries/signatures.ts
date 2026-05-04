import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fromTable } from '../../lib/db/queries'

const from = (table: string) => fromTable(table as never)

// ── Interfaces ───────────────────────────────────────

export interface SignatureRequest {
  id: string
  project_id: string
  document_id: string | null
  file_id: string | null
  title: string
  description: string | null
  status: 'draft' | 'sent' | 'in_progress' | 'completed' | 'declined' | 'expired' | 'voided'
  signing_order: 'sequential' | 'parallel'
  source_file_url: string
  signed_file_url: string | null
  created_by: string | null
  sent_at: string | null
  completed_at: string | null
  expires_at: string | null
  reminder_frequency_days: number | null
  auto_remind: boolean | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SignatureSigner {
  id: string
  request_id: string
  signer_name: string
  signer_email: string
  signer_role: string | null
  signing_order_index: number | null
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined'
  signed_at: string | null
  declined_at: string | null
  decline_reason: string | null
  access_token: string
  ip_address: string | null
  user_agent: string | null
  color_code: string | null
  created_at: string
}

export interface SignatureField {
  id: string
  request_id: string
  signer_id: string
  page_number: number
  field_type: 'signature' | 'initials' | 'date' | 'text' | 'name' | 'email' | 'company' | 'title' | 'checkbox' | 'stamp'
  x_position: number
  y_position: number
  width: number
  height: number
  is_required: boolean | null
  placeholder: string | null
  default_value: string | null
  response_value: string | null
  font_size: number | null
  completed_at: string | null
  created_at: string
}

export interface SignatureAuditEvent {
  id: string
  request_id: string
  signer_id: string | null
  event_type: 'created' | 'sent' | 'viewed' | 'signed' | 'declined' | 'completed' | 'voided' | 'reminder_sent' | 'expired' | 'downloaded'
  event_description: string | null
  ip_address: string | null
  user_agent: string | null
  document_hash: string | null
  metadata: Record<string, unknown>
  created_at: string
}

// ── Queries ───────────────────────────────────────

export function useSignatureRequests(projectId: string | undefined) {
  return useQuery({
    queryKey: ['signature_requests', projectId],
    queryFn: async (): Promise<SignatureRequest[]> => {
      const { data, error } = await from('signature_requests')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as SignatureRequest[]
    },
    enabled: !!projectId,
  })
}

export function useSignatureRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: ['signature_request', requestId],
    queryFn: async (): Promise<SignatureRequest & { signers: SignatureSigner[]; fields: SignatureField[] }> => {
      const { data, error } = await from('signature_requests')
        .select('*, signature_signers(*), signature_fields(*)')
        .eq('id' as never, requestId!)
        .single()
      if (error) throw error
      const raw = data as unknown as Record<string, unknown>
      const signers = (raw.signature_signers ?? []) as unknown as SignatureSigner[]
      const fields = (raw.signature_fields ?? []) as unknown as SignatureField[]
      const { signature_signers: _s, signature_fields: _f, ...request } = raw
      return { ...(request as unknown as SignatureRequest), signers, fields }
    },
    enabled: !!requestId,
  })
}

export function useSignatureSigners(requestId: string | undefined) {
  return useQuery({
    queryKey: ['signature_signers', requestId],
    queryFn: async (): Promise<SignatureSigner[]> => {
      const { data, error } = await from('signature_signers')
        .select('*')
        .eq('request_id' as never, requestId!)
        .order('signing_order_index', { ascending: true })
      if (error) throw error
      return data as unknown as SignatureSigner[]
    },
    enabled: !!requestId,
  })
}

export function useSignatureFields(requestId: string | undefined) {
  return useQuery({
    queryKey: ['signature_fields', requestId],
    queryFn: async (): Promise<SignatureField[]> => {
      const { data, error } = await from('signature_fields')
        .select('*')
        .eq('request_id' as never, requestId!)
        .order('page_number', { ascending: true })
      if (error) throw error
      return data as unknown as SignatureField[]
    },
    enabled: !!requestId,
  })
}

export function useSignatureAuditTrail(requestId: string | undefined) {
  return useQuery({
    queryKey: ['signature_audit_trail', requestId],
    queryFn: async (): Promise<SignatureAuditEvent[]> => {
      const { data, error } = await from('signature_audit_trail')
        .select('*')
        .eq('request_id' as never, requestId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as unknown as SignatureAuditEvent[]
    },
    enabled: !!requestId,
  })
}

// ── Mutations ───────────────────────────────────────

export interface CreateSignatureRequestInput {
  project_id: string
  document_id?: string | null
  file_id?: string | null
  title: string
  description?: string | null
  signing_order?: 'sequential' | 'parallel'
  source_file_url: string
  created_by?: string | null
  expires_at?: string | null
  reminder_frequency_days?: number
  auto_remind?: boolean
  metadata?: Record<string, unknown>
}

export function useCreateSignatureRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateSignatureRequestInput) => {
      const { data, error } = await from('signature_requests')
        .insert(input as never)
        .select()
        .single()
      if (error) throw error
      return data as unknown as SignatureRequest
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['signature_requests', variables.project_id] })
    },
  })
}

export interface UpdateSignatureRequestInput {
  id: string
  status?: string
  signed_file_url?: string | null
  sent_at?: string | null
  completed_at?: string | null
  metadata?: Record<string, unknown>
}

export function useUpdateSignatureRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateSignatureRequestInput) => {
      const { id, ...updates } = input
      const { data, error } = await from('signature_requests')
        .update(updates as never)
        .eq('id' as never, id)
        .select()
        .single()
      if (error) throw error
      return data as unknown as SignatureRequest
    },
    onSuccess: (data: unknown) => {
      const req = data as SignatureRequest
      queryClient.invalidateQueries({ queryKey: ['signature_requests', req.project_id] })
      queryClient.invalidateQueries({ queryKey: ['signature_request', req.id] })
    },
  })
}

export interface AddSignerInput {
  request_id: string
  signer_name: string
  signer_email: string
  signer_role?: string
  signing_order_index?: number
  color_code?: string
}

export function useAddSigner() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: AddSignerInput) => {
      const { data, error } = await from('signature_signers')
        .insert(input as never)
        .select()
        .single()
      if (error) throw error
      return data as unknown as SignatureSigner
    },
    onSuccess: (_data: unknown, variables: AddSignerInput) => {
      queryClient.invalidateQueries({ queryKey: ['signature_signers', variables.request_id] })
      queryClient.invalidateQueries({ queryKey: ['signature_request', variables.request_id] })
    },
  })
}

export function useRemoveSigner() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; request_id: string }) => {
      const { error } = await from('signature_signers')
        .delete()
        .eq('id' as never, input.id)
      if (error) throw error
    },
    onSuccess: (_data: unknown, variables: { id: string; request_id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['signature_signers', variables.request_id] })
      queryClient.invalidateQueries({ queryKey: ['signature_request', variables.request_id] })
    },
  })
}

export interface AddSignatureFieldInput {
  request_id: string
  signer_id: string
  page_number: number
  field_type: string
  x_position: number
  y_position: number
  width?: number
  height?: number
  is_required?: boolean
  placeholder?: string
  default_value?: string
  font_size?: number
}

export function useAddSignatureField() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: AddSignatureFieldInput) => {
      const { data, error } = await from('signature_fields')
        .insert(input as never)
        .select()
        .single()
      if (error) throw error
      return data as unknown as SignatureField
    },
    onSuccess: (_data: unknown, variables: AddSignatureFieldInput) => {
      queryClient.invalidateQueries({ queryKey: ['signature_fields', variables.request_id] })
      queryClient.invalidateQueries({ queryKey: ['signature_request', variables.request_id] })
    },
  })
}

export interface UpdateSignatureFieldInput {
  id: string
  request_id: string
  response_value?: string | null
  completed_at?: string | null
}

export function useUpdateSignatureField() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateSignatureFieldInput) => {
      const { id, request_id: _rid, ...updates } = input
      const { data, error } = await from('signature_fields')
        .update(updates as never)
        .eq('id' as never, id)
        .select()
        .single()
      if (error) throw error
      return data as unknown as SignatureField
    },
    onSuccess: (_data: unknown, variables: UpdateSignatureFieldInput) => {
      queryClient.invalidateQueries({ queryKey: ['signature_fields', variables.request_id] })
      queryClient.invalidateQueries({ queryKey: ['signature_request', variables.request_id] })
    },
  })
}

export interface CompleteSignerSigningInput {
  signer_id: string
  request_id: string
  ip_address?: string
  user_agent?: string
  document_hash?: string
}

export function useCompleteSignerSigning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CompleteSignerSigningInput) => {
      const now = new Date().toISOString()

      // Update signer status to signed
      const { error: signerError } = await from('signature_signers')
        .update({ status: 'signed', signed_at: now, ip_address: input.ip_address ?? null, user_agent: input.user_agent ?? null } as never)
        .eq('id' as never, input.signer_id)
      if (signerError) throw signerError

      // Log audit event
      const { error: auditError } = await from('signature_audit_trail')
        .insert({
          request_id: input.request_id,
          signer_id: input.signer_id,
          event_type: 'signed',
          event_description: 'Signer completed signing',
          ip_address: input.ip_address ?? null,
          user_agent: input.user_agent ?? null,
          document_hash: input.document_hash ?? null,
        } as never)
      if (auditError) throw auditError

      // Check if all signers are done
      const { data: signers, error: fetchError } = await from('signature_signers')
        .select('status')
        .eq('request_id' as never, input.request_id)
      if (fetchError) throw fetchError

      const allSigned = (signers as unknown as Array<{ status: string }>).every(
        (s) => s.status === 'signed'
      )

      if (allSigned) {
        const { error: completeError } = await from('signature_requests')
          .update({ status: 'completed', completed_at: now } as never)
          .eq('id' as never, input.request_id)
        if (completeError) throw completeError

        await from('signature_audit_trail')
          .insert({
            request_id: input.request_id,
            signer_id: null,
            event_type: 'completed',
            event_description: 'All signers have completed signing',
          } as never)
      }

      return { allSigned }
    },
    onSuccess: (_data: unknown, variables: CompleteSignerSigningInput) => {
      queryClient.invalidateQueries({ queryKey: ['signature_signers', variables.request_id] })
      queryClient.invalidateQueries({ queryKey: ['signature_request', variables.request_id] })
      queryClient.invalidateQueries({ queryKey: ['signature_requests'] })
      queryClient.invalidateQueries({ queryKey: ['signature_audit_trail', variables.request_id] })
    },
  })
}

export interface SendForSignatureInput {
  request_id: string
  project_id: string
}

export function useSendForSignature() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SendForSignatureInput) => {
      const now = new Date().toISOString()

      // Update request status to sent
      const { data: request, error: reqError } = await from('signature_requests')
        .update({ status: 'sent', sent_at: now } as never)
        .eq('id' as never, input.request_id)
        .select()
        .single()
      if (reqError) throw reqError

      // Update all signers to sent
      const { error: signersError } = await from('signature_signers')
        .update({ status: 'sent' } as never)
        .eq('request_id' as never, input.request_id)
      if (signersError) throw signersError

      // Log audit event
      const { error: auditError } = await from('signature_audit_trail')
        .insert({
          request_id: input.request_id,
          signer_id: null,
          event_type: 'sent',
          event_description: 'Document sent for signature',
        } as never)
      if (auditError) throw auditError

      return request as unknown as SignatureRequest
    },
    onSuccess: (_data: unknown, variables: SendForSignatureInput) => {
      queryClient.invalidateQueries({ queryKey: ['signature_requests', variables.project_id] })
      queryClient.invalidateQueries({ queryKey: ['signature_request', variables.request_id] })
      queryClient.invalidateQueries({ queryKey: ['signature_signers', variables.request_id] })
      queryClient.invalidateQueries({ queryKey: ['signature_audit_trail', variables.request_id] })
    },
  })
}
