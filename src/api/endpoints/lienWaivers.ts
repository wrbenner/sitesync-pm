import { transformSupabaseError } from '../client'
import { fromTable } from '../../lib/db/queries'
import { assertProjectAccess } from '../middleware/projectScope'
import type { LienWaiverRow, LienWaiverStatus, LienWaiverType } from '../../types/api'

export type { LienWaiverType }

// Shape of a row as stored in the database (column names differ from LienWaiverRow)
interface DbLienWaiverRow {
  id: string
  project_id: string
  subcontractor_id: string | null
  payment_period: string | null
  type: LienWaiverType
  amount: number | null
  status: 'pending' | 'received' | 'executed' | 'missing'
  payment_app_id: string | null
  waiver_date: string | null
  created_at: string | null
  received_at: string | null
}

// Shape returned by pay_application_line_items joined to subcontractors
interface PayAppLineItemRow {
  subcontractor_id: string
  amount: number | null
  payment_period: string | null
}

function mapDbRow(row: DbLienWaiverRow): LienWaiverRow {
  // Missing waivers must be visually distinct from pending waivers per AIA billing requirements
  const status: LienWaiverStatus = row.status
  return {
    id: row.id,
    project_id: row.project_id,
    subcontractor_id: row.subcontractor_id ?? '',
    payment_period: row.payment_period ?? '',
    waiver_type: row.type,
    amount: row.amount ?? 0,
    status,
    is_missing: row.status === 'missing',
    pay_application_id: row.payment_app_id,
    waiver_date: row.waiver_date ?? null,
    submitted_at: null,
    received_at: row.received_at,
    created_at: row.created_at ?? new Date().toISOString(),
  }
}

function mapStatusToDb(status: LienWaiverStatus): DbLienWaiverRow['status'] {
  // Missing waivers must be visually distinct from pending waivers per AIA billing requirements
  // 'missing' maps back to 'missing' in the DB to preserve the distinction
  return status
}

export async function getLienWaivers(projectId: string): Promise<LienWaiverRow[]> {
  await assertProjectAccess(projectId)
  const { data, error } = await fromTable('lien_waivers')
    .select('*')
    .eq('project_id' as never, projectId)
    .order('created_at', { ascending: false })
  if (error) throw transformSupabaseError(error)
  return (data as unknown as DbLienWaiverRow[]).map(mapDbRow)
}

export async function createLienWaiver(
  projectId: string,
  payload: Omit<LienWaiverRow, 'id' | 'created_at'>,
): Promise<LienWaiverRow> {
  await assertProjectAccess(projectId)
  const { data, error } = await fromTable('lien_waivers')
    .insert({
      project_id: projectId,
      subcontractor_id: payload.subcontractor_id,
      payment_period: payload.payment_period,
      type: payload.waiver_type,
      amount: payload.amount,
      status: mapStatusToDb(payload.status),
      payment_app_id: payload.pay_application_id,
      waiver_date: payload.waiver_date ?? null,
      received_at: payload.received_at,
    } as never)
    .select()
    .single()
  if (error) throw transformSupabaseError(error)
  return mapDbRow(data as unknown as DbLienWaiverRow)
}

/**
 * Updates lien waiver status with rollback support for optimistic UI updates.
 * The calling component should update local state immediately, then call this function,
 * and invoke rollback() + show error toast on failure.
 */
export async function updateLienWaiverStatus(
  id: string,
  status: LienWaiverStatus,
  timestamp?: string,
): Promise<{ data: LienWaiverRow; rollback: () => void }> {
  const { data: previousRow, error: fetchError } = await fromTable('lien_waivers')
    .select('*')
    .eq('id' as never, id)
    .single()
  if (fetchError) throw new Error('Unable to update lien waiver status. Please try again.')
  const previousState = previousRow as unknown as DbLienWaiverRow

  const ts = timestamp ?? new Date().toISOString()
  const update: Partial<DbLienWaiverRow> = { status: mapStatusToDb(status) }
  if (status === 'received') update.received_at = ts
  if (status === 'executed') update.waiver_date = ts
  const { data: updatedRow, error } = await fromTable('lien_waivers')
    .update(update as never)
    .eq('id' as never, id)
    .select()
    .single()
  if (error) throw new Error('Unable to update lien waiver status. Please try again.')
  return {
    data: mapDbRow(updatedRow as unknown as DbLienWaiverRow),
    rollback: async () => {
      await fromTable('lien_waivers')
        .update({ status: mapStatusToDb(previousState.status) } as never)
        .eq('id' as never, id)
    },
  }
}

export async function generateWaiversFromPayApp(
  projectId: string,
  payAppId: string,
): Promise<LienWaiverRow[]> {
  await assertProjectAccess(projectId)

  // Fetch line items for this pay application, joined to subcontractor data
  const { data: lineItems, error: lineError } = await fromTable('pay_application_line_items')
    .select('subcontractor_id, amount, payment_period')
    .eq('pay_application_id' as never, payAppId)
    .eq('project_id' as never, projectId)
  if (lineError) throw transformSupabaseError(lineError)

  // Deduplicate by subcontractor, summing amounts
  const bySubcontractor = new Map<string, { amount: number; payment_period: string | null }>()
  for (const item of (lineItems ?? []) as PayAppLineItemRow[]) {
    if (!item.subcontractor_id) continue
    const existing = bySubcontractor.get(item.subcontractor_id)
    if (existing) {
      existing.amount += item.amount ?? 0
    } else {
      bySubcontractor.set(item.subcontractor_id, {
        amount: item.amount ?? 0,
        payment_period: item.payment_period,
      })
    }
  }

  if (bySubcontractor.size === 0) return []

  // Only generate waivers for subs with a positive payment amount this period
  const payingSubs = Array.from(bySubcontractor.entries()).filter(([, vals]) => vals.amount > 0)
  if (payingSubs.length === 0) return []

  const inserts = payingSubs.map(([subId, vals]) => ({
    project_id: projectId,
    subcontractor_id: subId,
    payment_period: vals.payment_period ?? '',
    type: 'conditional_progress' as LienWaiverType,
    amount: vals.amount,
    status: 'pending' as const,
    payment_app_id: payAppId,
  }))

  const { data, error } = await fromTable('lien_waivers')
    .insert(inserts as never)
    .select()
  if (error) throw transformSupabaseError(error)
  return (data as unknown as DbLienWaiverRow[]).map(mapDbRow)
}

// Convenience wrappers kept for backwards compatibility
export const markReceived = (waiverId: string, receivedAt: string): Promise<LienWaiverRow> =>
  updateLienWaiverStatus(waiverId, 'received', receivedAt).then((r) => r.data)

export const markLienWaiverReceived = (waiverId: string): Promise<LienWaiverRow> =>
  updateLienWaiverStatus(waiverId, 'received', new Date().toISOString()).then((r) => r.data)

export interface LienWaiverSummary {
  total: number
  received: number
  missing: number
  missingSubcontractors: string[]
}

// Named entry point used by the payment approval flow and paymentMachine.ts.
// Generates one conditional_progress waiver per sub with payment > 0 for the given pay app.
export const autoGenerateLienWaivers = generateWaiversFromPayApp

export async function getLienWaiverSummary(projectId: string): Promise<LienWaiverSummary> {
  const waivers = await getLienWaivers(projectId)
  const received = waivers.filter((w) => w.status === 'received' || w.status === 'executed').length
  // Missing waivers must be visually distinct from pending waivers per AIA billing requirements
  const missingWaivers = waivers.filter((w) => w.is_missing)
  const missingSubcontractors = [
    ...new Set(missingWaivers.map((w) => w.subcontractor_id).filter((id) => id !== '')),
  ]
  return {
    total: waivers.length,
    received,
    missing: missingWaivers.length,
    missingSubcontractors,
  }
}
