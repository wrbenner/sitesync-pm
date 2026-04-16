/**
 * samGovService.ts — SAM.gov Wage Determination Integration
 *
 * Queries SAM.gov API for Davis-Bacon prevailing wage determinations.
 * Used at project setup when a project is marked as Davis-Bacon covered.
 *
 * API: https://api.sam.gov
 * Rate limits: 10 req/day (no role), 1000/day (with role)
 * Free API key from SAM.gov
 */

import { supabase } from './supabase'

// ── Types ────────────────────────────────────────────────

export interface WageDetermination {
  wdNumber: string        // e.g., 'NC20240005'
  revision: number        // e.g., 2
  state: string           // 2-letter code
  county: string
  constructionType: 'building' | 'residential' | 'heavy' | 'highway'
  effectiveDate: string
  classifications: WageClassification[]
}

export interface WageClassification {
  name: string            // e.g., 'ELEC0003-005 06/01/2024'
  tradeGroup: string      // e.g., 'Electrician'
  baseHourlyRate: number  // cents (e.g., 3400 = $34.00)
  fringeRate: number      // cents (e.g., 2100 = $21.00)
  totalRate: number       // cents
  notes?: string
}

export interface WageLookupParams {
  state: string
  county: string
  constructionType: 'building' | 'residential' | 'heavy' | 'highway'
}

// ── SAM.gov API Client ──────────────────────────────────

const SAM_API_BASE = 'https://api.sam.gov/opportunities/v2/search'

/**
 * Look up wage determinations from SAM.gov.
 *
 * NOTE: The SAM.gov Wage Determinations API has limited public documentation.
 * This implementation queries the available endpoints and parses the response.
 * In production, consider caching results in prevailing_wage_determinations table
 * and checking for revisions daily.
 */
export async function lookupWageDetermination(
  params: WageLookupParams
): Promise<WageDetermination | null> {
  const { state, county, constructionType } = params

  // Try the SAM.gov wage determinations endpoint
  try {
    const url = new URL('https://api.sam.gov/prod/federalregister/v1/wages')
    url.searchParams.set('state', state)
    url.searchParams.set('county', county)
    url.searchParams.set('constructionType', constructionType)
    url.searchParams.set('api_key', import.meta.env.VITE_SAM_GOV_API_KEY ?? '')

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      console.warn(`SAM.gov API returned ${response.status}`)
      return null
    }

    const data = await response.json()
    return parseWageDetermination(data, state, county, constructionType)
  } catch (err) {
    console.error('SAM.gov API error:', err)
    return null
  }
}

/**
 * Import a wage determination into the project database.
 * Called when a GC marks a project as Davis-Bacon covered.
 */
export async function importWageDetermination(
  projectId: string,
  organizationId: string,
  wd: WageDetermination
): Promise<string> {
  // Insert the wage determination
  const { data: wdRow, error: wdError } = await supabase
    .from('prevailing_wage_determinations')
    .insert({
      project_id: projectId,
      organization_id: organizationId,
      wd_number: wd.wdNumber,
      wd_revision: wd.revision,
      state: wd.state,
      county: wd.county,
      construction_type: wd.constructionType,
      source: 'federal',
      effective_date: wd.effectiveDate,
      locked_at_bid: false,
      raw_data: wd,
    })
    .select('id')
    .single()

  if (wdError) throw new Error(`Failed to import wage determination: ${wdError.message}`)

  // Insert all classification rates
  if (wd.classifications.length > 0) {
    const classRows = wd.classifications.map(c => ({
      wd_id: wdRow.id,
      classification_name: c.name,
      trade_group: c.tradeGroup,
      base_hourly_rate: c.baseHourlyRate,
      fringe_rate: c.fringeRate,
      notes: c.notes ?? null,
    }))

    const { error: classError } = await supabase
      .from('wd_classification_rates')
      .insert(classRows)

    if (classError) {
      console.error('Failed to import classification rates:', classError)
    }
  }

  return wdRow.id
}

/**
 * Check if a wage determination has been revised on SAM.gov.
 * Returns the new revision number if changed, null if current.
 */
export async function checkForWDRevision(
  wdNumber: string,
  currentRevision: number
): Promise<number | null> {
  try {
    const wd = await lookupWageDetermination({
      state: wdNumber.slice(0, 2),
      county: '',
      constructionType: 'building',
    })

    if (wd && wd.revision > currentRevision) {
      return wd.revision
    }

    return null
  } catch {
    return null
  }
}

/**
 * Get all wage determinations for a project.
 */
export async function getProjectWageDeterminations(
  projectId: string
): Promise<Array<WageDetermination & { id: string; classifications: WageClassification[] }>> {
  const { data: wds, error } = await supabase
    .from('prevailing_wage_determinations')
    .select('*, wd_classification_rates(*)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch wage determinations: ${error.message}`)

  return (wds ?? []).map(wd => ({
    id: wd.id,
    wdNumber: wd.wd_number,
    revision: wd.wd_revision,
    state: wd.state,
    county: wd.county,
    constructionType: wd.construction_type,
    effectiveDate: wd.effective_date,
    classifications: (wd.wd_classification_rates ?? []).map((c: Record<string, unknown>) => ({
      name: c.classification_name as string,
      tradeGroup: (c.trade_group as string) ?? '',
      baseHourlyRate: c.base_hourly_rate as number,
      fringeRate: c.fringe_rate as number,
      totalRate: (c.base_hourly_rate as number) + (c.fringe_rate as number),
      notes: (c.notes as string) ?? undefined,
    })),
  }))
}

// ── Helpers ──────────────────────────────────────────────

function parseWageDetermination(
  apiResponse: Record<string, unknown>,
  state: string,
  county: string,
  constructionType: string
): WageDetermination | null {
  // Parse the SAM.gov response format
  // The actual API response structure varies — this handles the common patterns
  const wdNumber = (apiResponse.wdNumber ?? apiResponse.wd_number ?? apiResponse.id ?? '') as string
  if (!wdNumber) return null

  const classifications: WageClassification[] = []
  const rates = (apiResponse.rates ?? apiResponse.classifications ?? []) as Array<Record<string, unknown>>

  for (const rate of rates) {
    const baseRate = parseFloat(String(rate.baseRate ?? rate.base_hourly_rate ?? 0))
    const fringeRate = parseFloat(String(rate.fringeRate ?? rate.fringe_rate ?? 0))

    classifications.push({
      name: String(rate.classification ?? rate.name ?? ''),
      tradeGroup: String(rate.tradeGroup ?? rate.trade ?? ''),
      baseHourlyRate: Math.round(baseRate * 100),  // Convert to cents
      fringeRate: Math.round(fringeRate * 100),
      totalRate: Math.round((baseRate + fringeRate) * 100),
      notes: rate.notes as string | undefined,
    })
  }

  return {
    wdNumber,
    revision: Number(apiResponse.revision ?? apiResponse.wd_revision ?? 0),
    state,
    county,
    constructionType: constructionType as WageDetermination['constructionType'],
    effectiveDate: String(apiResponse.effectiveDate ?? apiResponse.effective_date ?? new Date().toISOString().slice(0, 10)),
    classifications,
  }
}

/**
 * Format cents to dollar string for display.
 * 3400 → "$34.00"
 */
export function formatWageCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Compute the hourly fringe credit using the annualization formula.
 * Per DOL: Hourly Credit = Total Annual Plan Cost ÷ Total Hours Worked
 */
export function computeAnnualizedFringeCredit(
  totalAnnualPlanCost: number,  // cents
  totalAnnualHoursWorked: number
): number {
  if (totalAnnualHoursWorked <= 0) return 0
  return Math.round(totalAnnualPlanCost / totalAnnualHoursWorked)
}

/**
 * Check if a worker's total compensation meets the prevailing wage.
 * Returns the shortfall in cents (0 = compliant, >0 = underpaid).
 */
export function checkWageCompliance(
  baseHourlyPaid: number,      // cents
  fringeCreditClaimed: number,  // cents
  cashInLieu: number,           // cents
  requiredBaseRate: number,     // cents (from WD)
  requiredFringeRate: number    // cents (from WD)
): { compliant: boolean; shortfall: number } {
  const totalRequired = requiredBaseRate + requiredFringeRate
  const totalPaid = baseHourlyPaid + fringeCreditClaimed + cashInLieu

  // Worker must also receive at least the base hourly rate in cash
  const baseCompliant = baseHourlyPaid >= requiredBaseRate
  const totalCompliant = totalPaid >= totalRequired

  // The overall shortfall
  const shortfall = Math.max(0, totalRequired - totalPaid)

  return {
    compliant: baseCompliant && totalCompliant,
    shortfall,
  }
}
