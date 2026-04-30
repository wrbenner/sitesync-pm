// Draw Report mutations
// -----------------------
// useExtractDrawReport — upload file → call extract-draw-report edge fn → return extracted JSON (no DB writes)
// useCommitDrawReport  — given reviewed JSON: insert pay app + line items, update budget actuals, trigger RAG embed

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, fromTable } from '../../lib/supabase'
import { uploadFile } from '../../lib/storage'
import { prepareDrawReportUpload } from '../../lib/drawReportParser'

const fromAny = (table: string) => fromTable(table)

// ── Shared types ────────────────────────────────────────────

export interface DrawReportLineItem {
  item_number: string
  cost_code: string
  description: string
  /** CSI MasterFormat division inferred from description, 2-char ("03"). */
  csi_division?: string
  scheduled_value: number
  previous_completed: number
  this_period: number
  materials_stored: number
  percent_complete: number
  retainage: number
  balance_to_finish: number
  confidence: number
}

export interface DrawReportReconciliation {
  sum_of_lines: number
  stated_contract_sum: number
  deviation_dollars: number
  deviation_pct: number
  reconciled: boolean
  dropped_subtotal_count: number
}

export interface DrawReportExtraction {
  application_number?: number
  period_from?: string
  period_to?: string
  contract_sum?: number
  contractor_name?: string
  project_name?: string
  totals?: {
    total_completed_and_stored?: number
    retainage?: number
    total_earned_less_retainage?: number
    less_previous_certificates?: number
    current_payment_due?: number
    balance_to_finish?: number
  }
  line_items: DrawReportLineItem[]
  warnings: string[]
  reconciliation?: DrawReportReconciliation
}

export interface ExtractResult {
  extraction: DrawReportExtraction
  rawText: string
  model: string
  documentId: string
  documentName: string
  sheetHint?: { name: string; score: number; reason: string }
}

// ── Helpers ─────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')
  return token
}

async function ensureContractId(projectId: string): Promise<string> {
  // pay_applications.contract_id is NOT NULL. Reuse an existing contract
  // for the project if one exists; otherwise auto-create a minimal
  // "Prime Contract" so draw-report uploads Just Work on new projects.
  const { data: existing } = await fromAny('contracts')
    .select('id')
    .eq('project_id', projectId)
    .limit(1)
    .maybeSingle()
  if (existing?.id) return existing.id as string

  // Insert uses the live-schema column set: `counterparty` and
  // `original_value` are NOT NULL on this DB. `type` is a CHECK-constrained
  // enum; "prime" is always valid.
  const { data: created, error } = await fromAny('contracts')
    .insert({
      project_id: projectId,
      title: 'Prime Contract',
      type: 'prime',
      counterparty: 'Draw Report Auto-created',
      original_value: 0,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Could not create contract: ${error.message}`)
  return created.id as string
}

// ── useExtractDrawReport ─────────────────────────────────────

interface ExtractParams {
  projectId: string
  file: File
}

export function useExtractDrawReport() {
  return useMutation<ExtractResult, Error, ExtractParams>({
    mutationFn: async ({ projectId, file }) => {
      // 1. Upload file to Supabase Storage so it's durable + citable.
      const path = `${projectId}/draw-reports/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const up = await uploadFile('documents', path, file)
      if (up.error) throw new Error(`Upload failed: ${up.error}`)

      // 2. Create a documents row so we can link line items back to it.
      //    Live schema uses file_url / file_type; the catchall migration's
      //    storage_path / content_type columns aren't present on this DB.
      const { data: doc, error: docErr } = await fromAny('documents')
        .insert({
          project_id: projectId,
          name: file.name,
          category: 'draw_report',
          file_url: up.url || path,
          file_size: file.size,
          file_type: file.type || null,
        })
        .select('id, name')
        .single()
      if (docErr) throw new Error(`Document record failed: ${docErr.message}`)

      // 3. Prep payload for edge function.
      //    For PDFs we send a signed URL rather than base64 — Supabase's
      //    edge-function request gateway rejects bodies over ~6 MB, and
      //    a 33% base64 inflation of a real G702 easily exceeds that.
      //    XLSX payloads are small (flattened text), so we send inline.
      const prep = await prepareDrawReportUpload(file)
      // Prefer text path: if pdf.js pulled a usable text layer, send that
      // as pdf_text (3-8s Gemini call). If not (scan / image-only PDF),
      // fall back to a signed URL so the edge function can fetch the PDF
      // and do a vision extraction (slower but works on scans).
      let pdfUrl: string | undefined
      if (prep.isPdf && !prep.pdfText) {
        const { data: signed, error: signErr } = await supabase.storage
          .from('documents')
          .createSignedUrl(path, 600)
        if (signErr || !signed?.signedUrl) {
          throw new Error(`Could not create signed URL for PDF: ${signErr?.message ?? 'unknown'}`)
        }
        pdfUrl = signed.signedUrl
      }

      // 4. Kick off the extract-draw-report edge function. It returns
      //    { job_id } in under 2s. We then poll the job row because Gemini
      //    extraction on a dense G703 regularly exceeds Supabase's 25s
      //    synchronous response limit.
      const token = await getAccessToken()
      const { data: kickoff, error: kickoffErr } = await supabase.functions.invoke('extract-draw-report', {
        body: {
          project_id: projectId,
          user_token: token,
          pdf_text: prep.pdfText,
          pdf_url: pdfUrl,
          xlsx_text: prep.xlsxText,
          filename: prep.filename,
          document_id: doc.id,
        },
      })
      if (kickoffErr) throw new Error(`Extraction kickoff failed: ${kickoffErr.message}`)
      const jobId = (kickoff as { job_id?: string } | null)?.job_id
      if (!jobId) throw new Error('Extraction kickoff returned no job_id')

      // 5. Poll the job row until it reaches a terminal status. Gemini on
      //    a 50-line HUD form finishes in 20-60s; we poll every 2s for up
      //    to 3 minutes to cover worst-case.
      const POLL_INTERVAL_MS = 2000
      const POLL_TIMEOUT_MS = 180_000
      const started = Date.now()
      let job: Record<string, unknown> | null = null
      while (Date.now() - started < POLL_TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
        const { data: row, error: pollErr } = await fromAny('draw_report_extraction_jobs')
          .select('id, status, result_json, error_message')
          .eq('id', jobId)
          .maybeSingle()
        if (pollErr) {
          console.warn('[draw-reports] job poll error:', pollErr)
          continue
        }
        if (!row) continue
        const status = String(row.status || '')
        if (status === 'done') {
          job = row
          break
        }
        if (status === 'error') {
          throw new Error(String(row.error_message || 'Extraction failed'))
        }
      }
      if (!job) {
        throw new Error(`Extraction timed out after ${POLL_TIMEOUT_MS / 1000}s. The file may be unusually large.`)
      }

      const result = job.result_json as {
        extraction: DrawReportExtraction
        raw_text: string
        model: string
      }
      if (!result?.extraction?.line_items || result.extraction.line_items.length === 0) {
        const msg = result?.extraction?.warnings?.[0] || 'No line items could be extracted.'
        throw new Error(msg)
      }

      return {
        extraction: result.extraction,
        rawText: result.raw_text,
        model: result.model,
        documentId: doc.id as string,
        documentName: doc.name as string,
        sheetHint: prep.sheetHint,
      }
    },
  })
}

// ── useCommitDrawReport ──────────────────────────────────────

interface CommitParams {
  projectId: string
  documentId: string
  extraction: DrawReportExtraction
  rawText: string
  /**
   * When true, skip the reconciliation guard that blocks a commit if
   * sum(line_items) disagrees with the stated contract sum by more
   * than 5%. The UI exposes this as an "override" checkbox.
   */
  overrideReconciliationGuard?: boolean
}

interface CommitResult {
  payApplicationId: string
  lineItemCount: number
  budgetRowsUpdated: number
}

const COMMIT_GUARD_THRESHOLD_PCT = 5

export function useCommitDrawReport() {
  const queryClient = useQueryClient()
  return useMutation<CommitResult, Error, CommitParams>({
    mutationFn: async ({ projectId, documentId, extraction, rawText, overrideReconciliationGuard }) => {
      // Reconciliation guard: refuse to save a draw whose line items
      // disagree with the stated contract sum by >5% unless the user
      // has explicitly overridden. Protects against Gemini miscounts and
      // silent partial extractions.
      const recon = extraction.reconciliation
      if (!overrideReconciliationGuard && recon && !recon.reconciled && recon.deviation_pct > COMMIT_GUARD_THRESHOLD_PCT) {
        throw new Error(
          `Line items ($${recon.sum_of_lines.toLocaleString()}) don't reconcile with contract sum ($${recon.stated_contract_sum.toLocaleString()}) — off by ${recon.deviation_pct.toFixed(1)}%. Fix rows or check the "Save anyway" override to proceed.`,
        )
      }
      const contractId = await ensureContractId(projectId)

      // Compute top-level totals from line items so they're never missing.
      const totals = extraction.totals || {}
      const computedCompleted = extraction.line_items.reduce(
        (s, l) => s + l.previous_completed + l.this_period + l.materials_stored,
        0,
      )
      const computedRetainage = extraction.line_items.reduce((s, l) => s + l.retainage, 0)
      const totalCompleted = totals.total_completed_and_stored ?? computedCompleted
      const retainage = totals.retainage ?? computedRetainage
      const earnedLessRetainage = totals.total_earned_less_retainage ?? (totalCompleted - retainage)
      const lessPrev = totals.less_previous_certificates ?? 0
      const currentDue = totals.current_payment_due ?? (earnedLessRetainage - lessPrev)
      const contractSum = extraction.contract_sum ?? extraction.line_items.reduce((s, l) => s + l.scheduled_value, 0)
      const balanceToFinish = totals.balance_to_finish ?? (contractSum - totalCompleted)

      // 1. Upsert pay_applications row.
      //    Idempotent on (project_id, application_number) so re-uploading
      //    the same draw number safely updates in place rather than
      //    throwing a UNIQUE constraint violation. If the draw has no
      //    application_number (Gemini couldn't read it), fall back to
      //    straight insert because null doesn't collide in UNIQUE.
      const payAppRow = {
        project_id: projectId,
        contract_id: contractId,
        application_number: extraction.application_number ?? null,
        period_to: extraction.period_to || new Date().toISOString().slice(0, 10),
        original_contract_sum: contractSum,
        contract_sum_to_date: contractSum,
        total_completed_and_stored: totalCompleted,
        retainage,
        total_earned_less_retainage: earnedLessRetainage,
        less_previous_certificates: lessPrev,
        current_payment_due: currentDue,
        balance_to_finish: balanceToFinish,
        status: 'draft',
        source_document_id: documentId,
        raw_extraction: extraction as unknown as Record<string, unknown>,
      }
      const upsertResult = extraction.application_number != null
        ? await fromAny('pay_applications')
            .upsert(payAppRow, { onConflict: 'project_id,application_number' })
            .select('id')
            .single()
        : await fromAny('pay_applications')
            .insert(payAppRow)
            .select('id')
            .single()
      if (upsertResult.error) {
        throw new Error(`Pay app save failed: ${upsertResult.error.message}`)
      }
      const payAppId = upsertResult.data.id as string

      // 2. Replace line items for this pay app.
      //    Delete existing rows first so an idempotent re-upload doesn't
      //    duplicate. A brief inconsistency window exists between DELETE
      //    and INSERT — if INSERT fails, user re-uploads to recover. This
      //    is safer than leaving stale rows from a prior extraction.
      await fromAny('pay_application_line_items')
        .delete()
        .eq('pay_application_id', payAppId)

      // Live schema uses `amount_this_period` (legacy) rather than the
      // canonical AIA `this_period`. Send the legacy column only.
      const lineRows = extraction.line_items.map((li, idx) => ({
        pay_application_id: payAppId,
        item_number: li.item_number,
        cost_code: li.cost_code,
        description: li.description,
        scheduled_value: li.scheduled_value,
        previous_completed: li.previous_completed,
        amount_this_period: li.this_period,
        amount: li.previous_completed + li.this_period + li.materials_stored,
        materials_stored: li.materials_stored,
        percent_complete: li.percent_complete,
        retainage: li.retainage,
        balance_to_finish: li.balance_to_finish,
        sort_order: idx,
        source_document_id: documentId,
        extraction_confidence: li.confidence,
      }))
      const { error: lineErr } = await fromAny('pay_application_line_items').insert(lineRows)
      if (lineErr) {
        throw new Error(`Line item insert failed: ${lineErr.message}`)
      }

      // 3. Propagate actuals into budget_line_items.
      //    Strategy:
      //      a. Aggregate the draw's line items by CSI division
      //         (inferred from description by Gemini — works for GC-
      //         internal cost codes like 5010, 7010).
      //      b. For each CSI division with actuals, sum the matching
      //         budget_line_items for that division and update each row's
      //         actual_cost proportionally to its revised_budget share.
      //         (If multiple budget rows share a division, we distribute
      //         pro-rata so no single row gets the full amount.)
      //      c. Fall back to raw cost_code matching for draws where Gemini
      //         didn't infer a CSI division or the GC's codes ARE CSI.
      let budgetRowsUpdated = 0
      const byDivision = new Map<string, number>()
      for (const li of extraction.line_items) {
        const division = (li.csi_division || '').padStart(2, '0')
        if (!division || division === '00') continue
        const actual = li.previous_completed + li.this_period + li.materials_stored
        byDivision.set(division, (byDivision.get(division) || 0) + actual)
      }
      for (const [division, totalActual] of byDivision) {
        // Safety: never write NaN or negative actuals to the budget.
        if (!Number.isFinite(totalActual) || totalActual < 0) continue
        const { data: matches } = await fromAny('budget_line_items')
          .select('id, revised_budget, original_amount')
          .eq('project_id', projectId)
          .eq('csi_code', division)
        if (!matches || matches.length === 0) continue
        const denom = matches.reduce((s: number, r: Record<string, unknown>) => {
          const b = Number(r.revised_budget ?? r.original_amount ?? 0)
          return s + (Number.isFinite(b) && b > 0 ? b : 0)
        }, 0)
        for (const row of matches as Array<{ id: string; revised_budget?: number; original_amount?: number }>) {
          const rowBudgetRaw = Number(row.revised_budget ?? row.original_amount ?? 0)
          const rowBudget = Number.isFinite(rowBudgetRaw) && rowBudgetRaw > 0 ? rowBudgetRaw : 0
          // Equal-split fallback when every matching row has no budget.
          const share = denom > 0 ? rowBudget / denom : 1 / matches.length
          const rawShare = totalActual * share
          const actualShare = Number.isFinite(rawShare)
            ? Math.round(rawShare * 100) / 100
            : 0
          const { error: updErr } = await fromAny('budget_line_items')
            .update({ actual_cost: actualShare })
            .eq('id', row.id)
          if (!updErr) budgetRowsUpdated++
        }
      }
      // Fallback: direct cost_code match for draws whose cost_code already
      // IS a CSI division (standard AIA G703 with CSI codes).
      for (const li of extraction.line_items) {
        if (!li.cost_code) continue
        // Skip if this line was already handled via csi_division above.
        if ((li.csi_division || '').padStart(2, '0') !== '00') continue
        const actual = li.previous_completed + li.this_period + li.materials_stored
        const { data: matches } = await fromAny('budget_line_items')
          .select('id')
          .eq('project_id', projectId)
          .eq('csi_code', li.cost_code)
          .limit(10)
        if (!matches || matches.length === 0) continue
        for (const row of matches as Array<{ id: string }>) {
          const { error: updErr } = await fromAny('budget_line_items')
            .update({ actual_cost: actual })
            .eq('id', row.id)
          if (!updErr) budgetRowsUpdated++
        }
      }

      // 4. Index the raw extraction text into document_chunks so
      //    ProjectBrain can cite this draw in chat. Strictly fire-and-
      //    forget: RAG indexing is a nice-to-have secondary effect, NEVER
      //    a reason to fail a financial commit.
      void (async () => {
        try {
          const indexableText = buildIndexableText(extraction, rawText)
          await supabase.functions.invoke('embed-document', {
            body: {
              project_id: projectId,
              document_id: documentId,
              document_name: `Draw Report #${extraction.application_number ?? '?'} — ${extraction.period_to ?? ''}`,
              text: indexableText,
            },
          })
        } catch (embedErr) {
          console.warn('[draw-reports] embed-document failed (non-fatal):', embedErr)
        }
      })()

      return {
        payApplicationId: payAppId,
        lineItemCount: extraction.line_items.length,
        budgetRowsUpdated,
      }
    },
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({ queryKey: ['pay_applications', vars.projectId] })
      queryClient.invalidateQueries({ queryKey: ['pay_application_line_items'] })
      queryClient.invalidateQueries({ queryKey: [`costData-${vars.projectId}`] })
      queryClient.invalidateQueries({ queryKey: ['earned_value', vars.projectId] })
      queryClient.invalidateQueries({ queryKey: ['budget_divisions', vars.projectId] })
      queryClient.invalidateQueries({ queryKey: ['budget_line_items', vars.projectId] })
      queryClient.invalidateQueries({ queryKey: ['document_chunks', vars.projectId] })
      queryClient.invalidateQueries({ queryKey: ['documents', vars.projectId] })
    },
  })
}

// ── Embedding-text builder ───────────────────────────────────
// Build a compact, human-readable summary of the draw so ProjectBrain
// can cite numbers and % complete without dragging in raw Gemini output.

function buildIndexableText(extraction: DrawReportExtraction, rawText: string): string {
  // Safe-formatter for currency — renders $0 rather than $NaN on bad input.
  const $ = (n: number | undefined | null): string => {
    const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
    return `$${v.toLocaleString()}`
  }
  const header = [
    `Application #${extraction.application_number ?? '?'}`,
    extraction.period_to ? `Period ending ${extraction.period_to}` : '',
    extraction.contractor_name ? `Contractor: ${extraction.contractor_name}` : '',
    extraction.contract_sum ? `Contract sum: ${$(extraction.contract_sum)}` : '',
  ].filter(Boolean).join('\n')

  const totalsSection = extraction.totals
    ? Object.entries(extraction.totals)
        .filter(([, v]) => typeof v === 'number' && Number.isFinite(v as number))
        .map(([k, v]) => `${k}: ${$(v as number)}`)
        .join('\n')
    : ''

  const lineItemsSection = extraction.line_items
    .map((li) => {
      const completed = (li.previous_completed ?? 0) + (li.this_period ?? 0) + (li.materials_stored ?? 0)
      const pct = Number.isFinite(li.percent_complete) ? li.percent_complete : 0
      return (
        `${li.item_number} ${li.cost_code} — ${li.description}: ` +
        `scheduled ${$(li.scheduled_value)}, ` +
        `completed-to-date ${$(completed)} (${pct}%), ` +
        `retainage ${$(li.retainage)}, ` +
        `balance ${$(li.balance_to_finish)}`
      )
    })
    .join('\n')

  // Include a trailing snippet of the raw text (first 4KB) so Gemini's
  // original phrasing — sometimes more precise than our structured fields —
  // is available to RAG.
  const rawTail = rawText.slice(0, 4000)

  return [
    'DRAW REPORT EXTRACTION',
    header,
    '',
    'TOTALS',
    totalsSection,
    '',
    'LINE ITEMS',
    lineItemsSection,
    '',
    'RAW EXTRACTION',
    rawTail,
  ].join('\n')
}
