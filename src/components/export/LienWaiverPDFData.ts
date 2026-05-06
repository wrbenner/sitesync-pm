// Lien-waiver PDF data shapes + row→data adapter.
//
// Lives in a separate file from LienWaiverPDF.tsx so callers that only need
// the row adapter / types (e.g. LienWaiverPanel listing each waiver in the
// payment-applications tab) do NOT pull @react-pdf/renderer (~1.8MB) into
// their page chunk. The PDF component itself is loaded lazily — see
// `lazy(() => import('./LienWaiverPDF'))` in callers.

export type WaiverType = 'conditional' | 'unconditional'
export type WaiverState = 'california' | 'texas' | 'florida' | 'new_york' | 'generic'

export interface LienWaiverData {
  waiverType: WaiverType
  waiverState: WaiverState
  projectName: string
  projectAddress: string
  ownerName: string
  contractorName: string
  claimantName: string
  throughDate: string
  amount: number
  checkDate?: string
  checkNumber?: string
  signedBy?: string
  signedDate?: string
}

export interface LienWaiverRowContext {
  projectName: string
  projectAddress: string
  ownerName: string
  contractorName: string
  waiverState?: WaiverState
}

export function lienWaiverDataFromRow(
  row: {
    type: string
    sub_name: string | null
    amount: number | null
    through_date: string | null
    signed_by: string | null
    signed_date: string | null
  },
  ctx: LienWaiverRowContext,
): LienWaiverData {
  const isConditional = row.type === 'conditional_progress' || row.type === 'conditional_final'
  return {
    waiverType: isConditional ? 'conditional' : 'unconditional',
    waiverState: ctx.waiverState ?? 'generic',
    projectName: ctx.projectName,
    projectAddress: ctx.projectAddress,
    ownerName: ctx.ownerName,
    contractorName: ctx.contractorName,
    claimantName: row.sub_name ?? '',
    throughDate: row.through_date ?? '',
    amount: row.amount ?? 0,
    signedBy: row.signed_by ?? undefined,
    signedDate: row.signed_date ?? undefined,
  }
}
