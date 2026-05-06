// DO NOT EDIT IN PLACE — duplicated from src/lib/coAutoDraft/costEstimator.ts
// Edge functions run under Deno and cannot import from src/. When the
// canonical lib changes, copy the file here and rerun the tests.

// =============================================================================
// Cost estimator
// =============================================================================
// Money never comes from the model. The model returns line items
// (description + quantity + unit). This file looks each line up against
// `cost_database` and computes lineTotal = quantity × unitCost.
//
// When a row can't be priced (no matching cost_database entry, ambiguous
// unit, missing quantity), the line carries unitCost = null and the total
// either reflects the priceable portion or is null entirely. The drafter
// never invents a number.
// =============================================================================

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { CostEstimate, CostEstimateLine, ScopeLineItem } from './types.ts'

interface CostRow {
  id: string
  description: string
  unit: string | null
  unit_cost: number | null
  csi_code: string | null
  labor_rate: number | null
  labor_hours_per_unit: number | null
  material_cost_per_unit: number | null
}

/**
 * Best-match a single line item against cost_database.
 *
 * Strategy:
 *   1. If csiCode is provided, prefer rows with the same csi_code.
 *   2. Filter to rows whose unit matches (case-insensitive, trimmed).
 *   3. Pick the row whose description has the highest token-overlap with
 *      the model's description.
 *
 * Returns null when no row clears all filters.
 */
function pickBestMatch(line: ScopeLineItem, candidates: CostRow[]): CostRow | null {
  if (candidates.length === 0) return null
  const lineUnit = (line.unit ?? '').trim().toLowerCase()
  const tokens = new Set(
    line.description.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2),
  )

  let best: { row: CostRow; score: number } | null = null
  for (const row of candidates) {
    if (line.csiCode && row.csi_code && row.csi_code !== line.csiCode) continue
    if (lineUnit && row.unit && row.unit.toLowerCase().trim() !== lineUnit) continue

    const rowTokens = (row.description ?? '').toLowerCase().split(/[^a-z0-9]+/)
    let overlap = 0
    for (const t of rowTokens) if (tokens.has(t)) overlap += 1
    if (best == null || overlap > best.score) best = { row, score: overlap }
  }
  return best && best.score > 0 ? best.row : null
}

function totalUnitCost(row: CostRow): number | null {
  // Prefer the all-in unit_cost if set; otherwise sum component prices.
  if (row.unit_cost != null && row.unit_cost > 0) return row.unit_cost
  const material = row.material_cost_per_unit ?? 0
  const labor = (row.labor_rate ?? 0) * (row.labor_hours_per_unit ?? 0)
  const sum = material + labor
  return sum > 0 ? sum : null
}

/**
 * Estimate cost for a list of scope-change line items. Pure (in the testable
 * sense) given a set of pre-fetched cost rows. The orchestrator handles the
 * Supabase round-trip; this function does the math.
 */
export function estimateCostFromCandidates(
  lineItems: ScopeLineItem[],
  candidates: CostRow[],
): CostEstimate {
  if (lineItems.length === 0) {
    return {
      lines: [],
      total: null,
      provenance: 'no line items',
    }
  }

  const lines: CostEstimateLine[] = lineItems.map(li => {
    const match = pickBestMatch(li, candidates)
    const unitCost = match ? totalUnitCost(match) : null
    const lineTotal = (li.quantity != null && unitCost != null)
      ? Number((li.quantity * unitCost).toFixed(2))
      : null
    return {
      description: li.description,
      quantity: li.quantity,
      unit: li.unit,
      unitCost,
      lineTotal,
      costDatabaseId: match?.id ?? null,
      matchNote: match
        ? `cost_database "${match.description}" @ $${unitCost?.toFixed(2) ?? '?'}/${match.unit ?? '?'}`
        : 'no cost_database match',
    }
  })

  const pricedLines = lines.filter(l => l.lineTotal != null)
  const total = pricedLines.length > 0
    ? Number(pricedLines.reduce((s, l) => s + (l.lineTotal as number), 0).toFixed(2))
    : null
  const provenance = `cost_database matches ${pricedLines.length}/${lines.length}` +
    (pricedLines.length < lines.length ? `, ${lines.length - pricedLines.length} unmatched` : '')

  return { lines, total, provenance }
}

/**
 * Convenience wrapper that fetches cost_database rows for the org and runs
 * the estimator. Edge function uses this; the unit tests target the pure
 * `estimateCostFromCandidates` directly.
 *
 * Uses the org-scoped cost_database (project.organization_id). Falls through
 * gracefully when the table is empty — every line will get unitCost=null and
 * the estimate's total will be null (drafter writes the CO with empty cost).
 */
export async function estimateCost(
  supabase: SupabaseClient,
  organizationId: string | null,
  lineItems: ScopeLineItem[],
): Promise<CostEstimate> {
  if (lineItems.length === 0) {
    return { lines: [], total: null, provenance: 'no line items' }
  }

  const csiCodes = Array.from(
    new Set(lineItems.map(l => l.csiCode).filter((v): v is string => !!v)),
  )

  let q = supabase.from('cost_database').select('*')
  if (organizationId) q = q.eq('organization_id', organizationId)
  if (csiCodes.length > 0) q = q.in('csi_code', csiCodes)

  const { data, error } = await q.limit(200)
  if (error) {
    return {
      lines: lineItems.map(li => ({
        description: li.description,
        quantity: li.quantity,
        unit: li.unit,
        unitCost: null,
        lineTotal: null,
        costDatabaseId: null,
        matchNote: `cost_database lookup failed: ${error.message}`,
      })),
      total: null,
      provenance: 'cost_database query error',
    }
  }
  return estimateCostFromCandidates(lineItems, (data ?? []) as CostRow[])
}
