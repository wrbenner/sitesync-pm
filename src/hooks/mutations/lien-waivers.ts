import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { fromTable } from '../../lib/db/queries'

// The 4-way domain enum the Generate-Waiver flow exposes in the UI.
// (unconditional/conditional) × (partial/final).
export type WaiverType =
  | 'unconditional_partial'
  | 'conditional_partial'
  | 'unconditional_final'
  | 'conditional_final'

export const WAIVER_TYPE_LABELS: Record<WaiverType, string> = {
  unconditional_partial: 'Unconditional Partial',
  conditional_partial: 'Conditional Partial',
  unconditional_final: 'Unconditional Final',
  conditional_final: 'Conditional Final',
}

/**
 * Mapping to the existing `lien_waivers.status` CHECK constraint
 * ('pending','conditional','unconditional','final','waived').
 *
 * Partial waivers map directly to their conditional/unconditional status.
 * Final waivers map to 'final' — but we preserve the conditional vs
 * unconditional distinction in the `notes` prefix, since adding a new column
 * would require editing the lien_waivers schema (out of scope for this
 * session).
 *
 * `encodeWaiverNotes` / `decodeWaiverType` round-trip this cleanly for the UI.
 */
export function waiverTypeToStatus(t: WaiverType): 'conditional' | 'unconditional' | 'final' {
  if (t === 'conditional_partial') return 'conditional'
  if (t === 'unconditional_partial') return 'unconditional'
  return 'final'
}

const WAIVER_NOTE_PREFIX = /^\[waiver_type:(unconditional_final|conditional_final|unconditional_partial|conditional_partial)\]\s*/

function encodeWaiverNotes(type: WaiverType, userNotes: string | null | undefined): string {
  const tag = `[waiver_type:${type}]`
  const body = (userNotes ?? '').trim()
  return body ? `${tag} ${body}` : tag
}

/**
 * Reverse of `encodeWaiverNotes`. Returns the canonical 4-way type + the
 * user-visible notes (without the prefix). Falls back to a sensible default
 * for legacy rows that were written before this mutation existed.
 */
export function decodeWaiverType(row: {
  status: string | null | undefined
  notes: string | null | undefined
}): { type: WaiverType; userNotes: string } {
  const raw = row.notes ?? ''
  const m = raw.match(WAIVER_NOTE_PREFIX)
  const userNotes = m ? raw.slice(m[0].length) : raw
  if (m) return { type: m[1] as WaiverType, userNotes }

  // Legacy inference from status alone.
  switch (row.status) {
    case 'conditional':
      return { type: 'conditional_partial', userNotes }
    case 'unconditional':
      return { type: 'unconditional_partial', userNotes }
    case 'final':
      return { type: 'unconditional_final', userNotes }
    default:
      return { type: 'conditional_partial', userNotes }
  }
}

export interface GenerateWaiverInput {
  project_id: string
  application_id?: string | null
  contractor_name: string
  amount: number
  through_date: string
  type: WaiverType
  waiver_state?: 'california' | 'texas' | 'florida' | 'new_york' | 'generic'
  notes?: string | null
}

/**
 * Generate a new lien waiver of a specific type. Writes to `lien_waivers`
 * using `waiverTypeToStatus` for the schema enum and `encodeWaiverNotes` to
 * preserve the partial/final + conditional/unconditional combination.
 */
export function useGenerateLienWaiver() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: GenerateWaiverInput) => {
      const name = input.contractor_name.trim()
      if (!name) throw new Error('Contractor name is required')
      if (!(input.amount > 0)) throw new Error('Amount must be greater than 0')
      if (!input.through_date) throw new Error('Through-date is required')

      const payload = {
        project_id: input.project_id,
        application_id: input.application_id ?? null,
        contractor_name: name,
        amount: input.amount,
        through_date: input.through_date,
        status: waiverTypeToStatus(input.type),
        waiver_state: input.waiver_state ?? 'generic',
        notes: encodeWaiverNotes(input.type, input.notes),
      }

      const { data, error } = await fromTable('lien_waivers')
        .insert(payload as never)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['lien_waivers', variables.project_id] })
      if (variables.application_id) {
        qc.invalidateQueries({ queryKey: ['lien_waivers', 'pay_app', variables.application_id] })
      }
      toast.success(`${WAIVER_TYPE_LABELS[variables.type]} waiver generated`)
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to generate lien waiver')
    },
  })
}

/**
 * Mark an existing waiver as signed/executed. Kept small — the heavier
 * status-update flow lives in `api/endpoints/lienWaivers.ts` and is already
 * consumed by the payment-applications page.
 */
export function useMarkLienWaiverSigned() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      id: string
      project_id: string
      signed_by: string
      document_url?: string | null
    }) => {
      const { data, error } = await fromTable('lien_waivers')
        .update({
          signed_at: new Date().toISOString(),
          signed_by: params.signed_by,
          document_url: params.document_url ?? null,
        })
        .eq('id' as never, params.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['lien_waivers', variables.project_id] })
      toast.success('Waiver marked as signed')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to mark waiver as signed')
    },
  })
}
