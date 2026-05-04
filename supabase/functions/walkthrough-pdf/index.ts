// walkthrough-pdf — generate a snapshot PDF of a walkthrough session
// for the owner record.
//
// Layout:
//   • Page 1: header (project name, walk date, attendees) + summary counts
//   • Per capture: title + severity + trade + transcript + photo thumb
//
// We use `pdf-lib` because:
//   • @react-pdf/renderer is a Node bundle that doesn't run in Deno edges
//   • pdf-lib is a tiny pure-JS PDF builder with a Deno-friendly ESM build
//   • src/lib/reports/wh347Pdf.ts already uses pdf-lib in this repo, so we
//     pick the same dependency rather than introduce a second PDF stack
//
// SHA-256 of the PDF bytes is computed and stored on the session row so
// later downloads can be proven identical to the artifact the owner saw.

import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'
import {
  handleCors,
  getCorsHeaders,
  authenticateRequest,
  parseJsonBody,
  errorResponse,
  HttpError,
  requireUuid,
  verifyProjectMembership,
} from '../shared/auth.ts'

interface PdfRequest {
  session_id: string
}

interface SessionRow {
  id: string
  project_id: string
  started_at: string
  ended_at: string | null
  attendees: Array<{ name: string; role: string; email?: string }>
  total_drafted: number
  total_approved: number
  total_rejected: number
}

interface CaptureRow {
  id: string
  captured_at: string
  status: string
  transcript: string | null
  parsed: {
    title?: string
    description?: string
    severity?: string
    trade?: string
    location_hint?: string
  } | null
  photo_storage_path: string | null
}

interface ProjectRow {
  id: string
  name: string
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' }

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<PdfRequest>(req)
    const sessionId = requireUuid(body.session_id, 'session_id')

    const { data: sessionData, error: sessionErr } = await supabase
      .from('walkthrough_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()
    if (sessionErr || !sessionData) throw new HttpError(404, 'Session not found')
    const session = sessionData as SessionRow
    await verifyProjectMembership(supabase, user.id, session.project_id)

    const [{ data: projectData }, { data: capturesData }] = await Promise.all([
      supabase.from('projects').select('id,name').eq('id', session.project_id).single(),
      supabase.from('walkthrough_captures').select('*').eq('session_id', sessionId).order('captured_at'),
    ])
    const project = projectData as ProjectRow | null
    const captures = (capturesData ?? []) as CaptureRow[]

    // ── Build the PDF ──────────────────────────────────────
    const pdf = await PDFDocument.create()
    const helv = await pdf.embedFont(StandardFonts.Helvetica)
    const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)

    const ink = rgb(0.12, 0.13, 0.15)
    const ink3 = rgb(0.42, 0.43, 0.45)
    const orange = rgb(0.957, 0.471, 0.125)

    const page1 = pdf.addPage([612, 792])
    let y = 740
    page1.drawText('WALK-THROUGH RECORD', {
      x: 48, y, size: 9, font: helvBold, color: ink3,
    })
    y -= 24
    page1.drawText(project?.name ?? 'Project', {
      x: 48, y, size: 22, font: helvBold, color: ink,
    })
    y -= 22
    const walkDate = new Date(session.started_at).toLocaleDateString('en-US', { dateStyle: 'long' })
    page1.drawText(walkDate, { x: 48, y, size: 12, font: helv, color: ink3 })
    y -= 28
    // Hairline
    page1.drawLine({ start: { x: 48, y }, end: { x: 564, y }, thickness: 0.5, color: ink3 })
    y -= 28

    page1.drawText('ATTENDEES', { x: 48, y, size: 9, font: helvBold, color: ink3 })
    y -= 16
    if (session.attendees.length === 0) {
      page1.drawText('(none recorded)', { x: 48, y, size: 11, font: helv, color: ink3 })
      y -= 16
    } else {
      for (const a of session.attendees.slice(0, 12)) {
        page1.drawText(`${a.name}${a.role ? ` — ${a.role}` : ''}`, { x: 48, y, size: 11, font: helv, color: ink })
        y -= 14
      }
    }
    y -= 16
    page1.drawText('SUMMARY', { x: 48, y, size: 9, font: helvBold, color: ink3 })
    y -= 16
    page1.drawText(
      `${session.total_drafted} captured · ${session.total_approved} approved · ${session.total_rejected} rejected`,
      { x: 48, y, size: 11, font: helv, color: ink },
    )

    // ── One block per capture (compact, multiple per page) ──
    let curY = 0
    let curPage = page1
    const newPage = () => {
      curPage = pdf.addPage([612, 792])
      curY = 740
      curPage.drawText('WALK-THROUGH RECORD (continued)', {
        x: 48, y: curY, size: 9, font: helvBold, color: ink3,
      })
      curY -= 30
    }
    newPage()

    for (let i = 0; i < captures.length; i++) {
      const c = captures[i]
      const sev = (c.parsed?.severity ?? 'medium').toUpperCase()
      const trade = c.parsed?.trade ?? '—'
      const title = c.parsed?.title ?? c.transcript?.slice(0, 80) ?? `Capture ${i + 1}`
      const transcript = (c.transcript ?? '').slice(0, 220)
      const status = c.status.toUpperCase()
      // Approx height needed: 56px
      if (curY < 110) newPage()
      // Header line
      curPage.drawText(`${String(i + 1).padStart(2, '0')}.`, { x: 48, y: curY, size: 10, font: helvBold, color: ink3 })
      curPage.drawText(title.slice(0, 80), { x: 72, y: curY, size: 11, font: helvBold, color: ink })
      curY -= 14
      // Sev / trade
      curPage.drawText(`${sev} · ${trade} · ${status}`, {
        x: 72, y: curY, size: 9, font: helv,
        color: sev === 'CRITICAL' ? orange : ink3,
      })
      curY -= 14
      // Transcript snippet
      if (transcript) {
        curPage.drawText(transcript, { x: 72, y: curY, size: 9, font: helv, color: ink3 })
        curY -= 14
      }
      curY -= 10
    }

    const bytes = await pdf.save()
    const hash = await sha256Hex(bytes)

    // Upload to storage. Bucket name documented in WALKTHROUGH_MODE.md.
    const path = `${session.project_id}/${sessionId}/${hash.slice(0, 12)}.pdf`
    const { error: upErr } = await supabase.storage
      .from('walkthrough-pdfs')
      .upload(path, bytes, { upsert: true, contentType: 'application/pdf' })
    if (upErr) throw new HttpError(502, `PDF upload failed: ${upErr.message}`)

    const { data: signed } = await supabase.storage
      .from('walkthrough-pdfs')
      .createSignedUrl(path, 60 * 60 * 24 * 30)

    const pdfUrl = signed?.signedUrl ?? null

    // Persist back onto the session.
    await supabase
      .from('walkthrough_sessions')
      .update({
        pdf_export_url: pdfUrl,
        pdf_content_hash: hash,
        status: 'finalized',
      } as never)
      .eq('id', sessionId)

    return new Response(
      JSON.stringify({ pdf_url: pdfUrl, content_hash: hash }),
      { status: 200, headers },
    )
  } catch (err) {
    return errorResponse(err, getCorsHeaders(req))
  }
})
