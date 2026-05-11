// ────────────────────────────────────────────────────────────────────────────
// iris-ingest-spreadsheet-worker — Phase 3d scaffold
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// Drains `iris_ingest` messages where source_type='spreadsheet'.
//   1. Read media_assets row (the xlsx blob).
//   2. xlsx parser:
//      - Read all sheet names.
//      - For each sheet: detect named ranges (from workbook XML defined names).
//      - For each sheet: detect contiguous non-empty blocks separated by
//        empty rows; emit each as a "range" with synthetic A1 notation.
//   3. chunkSpreadsheet(input).
//   4. Sensitivity defaults to 'finance_only' for sheets whose names match
//      /budget|estimate|gmp|cost|pay/i; 'gc_only' for the rest. The worker
//      maps sheet_name -> sensitivity at upsert.
//   5. Embed each chunk; upsert.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

interface SpreadsheetIngestPayload {
  source_id: string // = asset_id
  project_id: string
  org_id: string
  version_hash: string
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let payload: SpreadsheetIngestPayload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!payload.source_id || !payload.project_id) {
    return new Response(JSON.stringify({ error: 'missing_required_fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(
    JSON.stringify({
      status: 'scaffold',
      source_id: payload.source_id,
      message: 'Phase 3d scaffold — xlsx parse + named-range detection + contiguous-block segmentation + chunkSpreadsheet + sensitivity by sheet name + embed lands on first soft-pilot spreadsheet',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
