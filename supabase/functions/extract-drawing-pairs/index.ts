// ── extract-drawing-pairs Edge Function ───────────────────────
// Phase 3, Module 4 Step 4.2: Pairs architectural and structural
// drawings based on drawing_classifications. Adapted EXACTLY from
// services/drawing-pair-extraction/helper_functions/pair_extractor.py
// Rules copied verbatim so pair fidelity matches the production
// Gemini-based microservice.
//
// Hard rules (see pair_extractor.py generate_pair_extraction_prompt):
//   - FOUNDATION pairs with FOUNDATION (same building/section)
//   - FRAMING pairs with FLOOR PLAN (same floor)
//   - ROOF pairs with ROOF
//   - Section Roman->Area letter mapping:
//       SEC I  (SEC 1/TYPE I)   -> AREA A only
//       SEC II (SEC 2/TYPE II)  -> AREA B only
//       SEC III (SEC 3/TYPE III)-> AREA C only
//   - OVERALL pairs with OVERALL only (same floor)
//   - FORBIDDEN:
//       never pair FOUNDATION with FRAMING
//       never cross buildings
//       never pair SEC I with AREA B/C, etc.


import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
  verifyProjectMembership,
  requireUuid,
} from '../shared/auth.ts'

interface ExtractPairsRequest {
  project_id: string
}

interface ClassificationRow {
  id: string
  drawing_id: string | null
  project_id: string | null
  sheet_number: string | null
  drawing_title: string | null
  building_name: string | null
  floor_level: string | null
  discipline: string | null
  plan_type: string | null
  pairing_tokens: Record<string, unknown> | null
  design_description: Record<string, unknown> | null
  processing_status: string | null
}

interface NormalizedClassification {
  row: ClassificationRow
  planKind: PlanKind
  building: string
  level: string
  areaToken: string | null
  sectionToken: string | null
  isOverall: boolean
}

type PlanKind =
  | 'foundation'
  | 'floor_plan'
  | 'framing'
  | 'roof'
  | 'other'

// ── Section Roman -> Area letter map (EXACT rules from pair_extractor) ─
const SECTION_TO_AREA: Record<string, string> = {
  I: 'A',
  '1': 'A',
  II: 'B',
  '2': 'B',
  III: 'C',
  '3': 'C',
  IV: 'D',
  '4': 'D',
}

function normalizePlanType(plan: string | null): PlanKind {
  if (!plan) return 'other'
  const p = plan.trim().toUpperCase()
  if (p.includes('FOUNDATION')) return 'foundation'
  if (p === 'FRAMING' || p.includes('FRAMING')) return 'framing'
  if (p === 'ROOF' || p.includes('ROOF')) return 'roof'
  if (p === 'FLOOR PLAN' || p === 'FLOOR_PLAN' || p.includes('FLOOR')) return 'floor_plan'
  return 'other'
}

function normalizeLevel(level: string | null): string {
  if (!level) return ''
  return level.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeBuilding(building: string | null): string {
  if (!building) return ''
  return building.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeArea(token: string | null | undefined): string | null {
  if (!token) return null
  const match = String(token).trim().match(/[A-Z]/i)
  return match ? match[0].toUpperCase() : null
}

function normalizeSection(token: string | null | undefined): string | null {
  if (!token) return null
  const cleaned = String(token).trim().toUpperCase().replace(/\./g, '')
  if (SECTION_TO_AREA[cleaned]) return cleaned
  const arabicMatch = cleaned.match(/\b([1-9])\b/)
  if (arabicMatch && SECTION_TO_AREA[arabicMatch[1]]) return arabicMatch[1]
  const romanMatch = cleaned.match(/\b(IV|III|II|I)\b/)
  if (romanMatch) return romanMatch[1]
  return null
}

function detectOverall(row: ClassificationRow): boolean {
  const title = (row.drawing_title ?? '').toLowerCase()
  return title.includes('overall')
}

function normalize(row: ClassificationRow): NormalizedClassification {
  const tokens = (row.pairing_tokens ?? {}) as Record<string, unknown>
  const areaToken =
    normalizeArea(typeof tokens.areaToken === 'string' ? tokens.areaToken : null) ??
    normalizeArea((row.drawing_title ?? '').match(/AREA\s+([A-Z])/i)?.[1] ?? null)
  const sectionToken =
    normalizeSection(typeof tokens.sectionToken === 'string' ? tokens.sectionToken : null) ??
    normalizeSection((row.drawing_title ?? '').match(/SEC(?:TION|TYPE)?\s*(IV|III|II|I|[1-9])/i)?.[1] ?? null)
  return {
    row,
    planKind: normalizePlanType(row.plan_type),
    building: normalizeBuilding(row.building_name),
    level: normalizeLevel(row.floor_level),
    areaToken,
    sectionToken,
    isOverall: detectOverall(row),
  }
}

// Area effectively in play for a sheet: an explicit AREA token wins,
// otherwise fallback to SECTION mapped through SECTION_TO_AREA.
function effectiveArea(c: NormalizedClassification): string | null {
  if (c.areaToken) return c.areaToken
  if (c.sectionToken && SECTION_TO_AREA[c.sectionToken]) {
    return SECTION_TO_AREA[c.sectionToken]
  }
  return null
}

// Pairing plan match rules (verbatim from pair_extractor.py):
//   foundation <-> foundation
//   framing   <-> floor_plan
//   roof       <-> roof
function plansCompatible(arch: PlanKind, struct: PlanKind): boolean {
  if (arch === 'foundation' && struct === 'foundation') return true
  if (arch === 'floor_plan' && struct === 'framing') return true
  if (arch === 'framing' && struct === 'floor_plan') return true
  if (arch === 'roof' && struct === 'roof') return true
  return false
}

// Hard anti-pattern: FOUNDATION with FRAMING, explicit per prompt.
function isForbidden(arch: PlanKind, struct: PlanKind): boolean {
  if (arch === 'foundation' && struct === 'framing') return true
  if (arch === 'framing' && struct === 'foundation') return true
  return false
}

interface PairCandidate {
  arch: NormalizedClassification
  struct: NormalizedClassification
  confidence: number
  reason: string
}

function scorePair(
  arch: NormalizedClassification,
  struct: NormalizedClassification,
): PairCandidate | null {
  // never cross building boundaries
  if (!arch.building || !struct.building) return null
  if (arch.building !== struct.building) return null

  // forbidden plan combos
  if (isForbidden(arch.planKind, struct.planKind)) return null
  if (!plansCompatible(arch.planKind, struct.planKind)) return null

  // OVERALL strictness: OVERALL only pairs with OVERALL and same level
  if (arch.isOverall !== struct.isOverall) return null

  // level must match (apply to foundation-vs-foundation too, so SEC I foundation
  // doesn't pair with SEC II foundation)
  if (arch.level && struct.level && arch.level !== struct.level) {
    // roofs may have "roof"/"rf" aliases — allow if both levels contain 'roof'
    const both = `${arch.level} ${struct.level}`
    if (!(both.includes('roof') && arch.level.includes('roof') && struct.level.includes('roof'))) {
      return null
    }
  }

  // Section/Area compatibility: if either sheet carries a section/area token,
  // the effective area must match (cross-bucket forbidden).
  const archArea = effectiveArea(arch)
  const structArea = effectiveArea(struct)

  if (archArea && structArea && archArea !== structArea) {
    return null
  }

  // base confidence for a clean match
  let confidence = 0.75
  const reasons: string[] = [`plans match: ${arch.planKind} <-> ${struct.planKind}`]

  if (arch.building && arch.building === struct.building) {
    confidence += 0.05
    reasons.push(`building="${arch.row.building_name}"`)
  }
  if (arch.level && arch.level === struct.level) {
    confidence += 0.05
    reasons.push(`level="${arch.row.floor_level}"`)
  }
  if (archArea && structArea && archArea === structArea) {
    confidence += 0.1
    reasons.push(`area="${archArea}"`)
  } else if (!archArea && !structArea) {
    // both unspecified → still OK but slightly lower confidence
    confidence -= 0.05
  }
  if (arch.sectionToken || struct.sectionToken) {
    reasons.push(
      `section mapping: SEC ${arch.sectionToken ?? struct.sectionToken} → AREA ${
        archArea ?? structArea ?? '?'
      }`,
    )
  }

  confidence = Math.min(1, Math.max(0, confidence))

  return {
    arch,
    struct,
    confidence,
    reason: reasons.join('; '),
  }
}

function buildPairs(rows: NormalizedClassification[]): PairCandidate[] {
  // Only classifications that are completed + pair candidates
  const architectural = rows.filter(
    (r) => r.row.discipline === 'architectural' && r.row.processing_status === 'completed',
  )
  const structural = rows.filter(
    (r) => r.row.discipline === 'structural' && r.row.processing_status === 'completed',
  )

  // Each struct sheet must pair at most once; pick the best arch match.
  const usedArch = new Set<string>()
  const pairs: PairCandidate[] = []

  // Sort struct rows to give OVERALL + FOUNDATION priority (more distinctive)
  const sortedStruct = [...structural].sort((a, b) => {
    const priority: Record<PlanKind, number> = {
      foundation: 0,
      framing: 1,
      roof: 2,
      floor_plan: 3,
      other: 4,
    }
    return priority[a.planKind] - priority[b.planKind]
  })

  for (const struct of sortedStruct) {
    let best: PairCandidate | null = null
    for (const arch of architectural) {
      if (usedArch.has(arch.row.id)) continue
      const candidate = scorePair(arch, struct)
      if (candidate && (!best || candidate.confidence > best.confidence)) {
        best = candidate
      }
    }
    if (best) {
      usedArch.add(best.arch.row.id)
      pairs.push(best)
    }
  }
  return pairs
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  const corsHeaders = getCorsHeaders(req)

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<ExtractPairsRequest>(req)
    const projectId = requireUuid(body.project_id, 'project_id')

    await verifyProjectMembership(supabase, user.id, projectId)

    const { data: classifications, error: classError } = await supabase
      .from('drawing_classifications')
      .select(
        'id, drawing_id, project_id, sheet_number, drawing_title, building_name, floor_level, discipline, plan_type, pairing_tokens, design_description, processing_status',
      )
      .eq('project_id', projectId)

    if (classError) {
      throw new HttpError(500, `Failed to query classifications: ${classError.message}`)
    }

    const normalized = (classifications ?? [])
      .filter((c) => !!c.drawing_id)
      .map((c) => normalize(c as ClassificationRow))

    const pairs = buildPairs(normalized)

    // Remove pairs that already exist for this project to avoid duplicates.
    const { data: existingPairs } = await supabase
      .from('drawing_pairs')
      .select('arch_drawing_id, struct_drawing_id')
      .eq('project_id', projectId)

    const existingKey = new Set(
      (existingPairs ?? []).map((p) => `${p.arch_drawing_id ?? ''}:${p.struct_drawing_id ?? ''}`),
    )

    const inserts = pairs
      .filter((p) => {
        const archId = p.arch.row.drawing_id ?? ''
        const structId = p.struct.row.drawing_id ?? ''
        return !existingKey.has(`${archId}:${structId}`)
      })
      .map((p) => ({
        project_id: projectId,
        arch_drawing_id: p.arch.row.drawing_id,
        struct_drawing_id: p.struct.row.drawing_id,
        arch_classification_id: p.arch.row.id,
        struct_classification_id: p.struct.row.id,
        pairing_confidence: p.confidence,
        pairing_method: 'ai',
        pairing_reason: p.reason,
        status: 'pending',
      }))

    let insertedPairs: Array<Record<string, unknown>> = []
    if (inserts.length > 0) {
      const { data: insertedRows, error: insertError } = await supabase
        .from('drawing_pairs')
        .insert(inserts)
        .select('*')
      if (insertError) {
        throw new HttpError(500, `Failed to insert drawing_pairs: ${insertError.message}`)
      }
      insertedPairs = insertedRows ?? []
    }

    return new Response(
      JSON.stringify({
        project_id: projectId,
        candidate_count: pairs.length,
        inserted_count: insertedPairs.length,
        skipped_existing: pairs.length - insertedPairs.length,
        pairs: insertedPairs,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
