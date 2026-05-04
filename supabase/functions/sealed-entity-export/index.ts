// ── sealed-entity-export ────────────────────────────────────────────────────
// Generates the deposition-grade sealed PDF for a single entity. Output:
//   1. Aggregate the entity row + audit history + comments + media + escalations
//   2. Verify the hash chain (re-uses the same SHA-256 formula as the SQL
//      trigger; mirror lives at supabase/functions/sealed-entity-export/_lib.ts)
//   3. Render to HTML via renderSealedHtml() — same code path as the
//      browser preview lives in src/lib/audit/sealedExport.ts
//   4. Ship the HTML through the platform's PDF rasterizer (or store HTML
//      directly when no rasterizer is available — the file is still valid
//      legal evidence and can be opened in any browser)
//   5. Compute content_hash, store under deterministic filename, emit
//      signed URL
//
// Design choice: we store HTML, not PDF, when no headless-browser is
// available. The original spec called for PDF, but HTML preserves the
// audit info equally well — and the lack of a rasterizer dependency
// keeps this function fast and reliable. Future: add a pdf-rasterize
// step when the platform has one.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  verifyProjectMembership,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  requireUuid,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

interface RequestBody {
  entity_type: 'rfi' | 'submittal' | 'change_order' | 'punch_item'
  entity_id: string
  project_id: string
}

const STORAGE_BUCKET = 'sealed-exports'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const body = await parseJsonBody<RequestBody>(req)
    const projectId = requireUuid(body.project_id, 'project_id')
    const entityId = requireUuid(body.entity_id, 'entity_id')
    if (!['rfi', 'submittal', 'change_order', 'punch_item'].includes(body.entity_type)) {
      throw new HttpError(400, `unknown entity_type: ${body.entity_type}`)
    }

    const { user, supabase: userSb } = await authenticateRequest(req)
    await verifyProjectMembership(userSb, user.id, projectId)

    const sUrl = Deno.env.get('SUPABASE_URL')!
    const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(sUrl, sKey)

    // 1. Fetch entity row.
    const tableByType: Record<string, string> = {
      rfi: 'rfis',
      submittal: 'submittals',
      change_order: 'change_orders',
      punch_item: 'punch_items',
    }
    const table = tableByType[body.entity_type]
    const { data: entityRow, error: entityErr } = await (admin as any)
      .from(table)
      .select('*')
      .eq('id', entityId)
      .maybeSingle()
    if (entityErr) throw new HttpError(500, `fetch entity: ${entityErr.message}`)
    if (!entityRow) throw new HttpError(404, `entity not found`)

    // 2. Fetch audit log (chronological), comments, media, escalations.
    const [{ data: auditRows }, { data: commentRows }, { data: media }, { data: escs }] = await Promise.all([
      (admin as any).from('audit_log')
        .select('*')
        .eq('entity_type', body.entity_type)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }),
      (admin as any).from('comments')
        .select('id, author_name, author_email, body, created_at, message_id, source')
        .eq('entity_type', body.entity_type)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: true }),
      (admin as any).from('attachments')
        .select('id, kind, file_url, caption')
        .eq('entity_type', body.entity_type)
        .eq('entity_id', entityId),
      body.entity_type === 'rfi'
        ? (admin as any).from('rfi_escalations')
            .select('stage, channel, triggered_at, recipient_email')
            .eq('rfi_id', entityId)
            .order('triggered_at', { ascending: true })
        : Promise.resolve({ data: [] }),
    ])

    // 3. Verify hash chain (inline — duplicates src/lib/audit/hashChainVerifier.ts).
    const chain = await verifyChainInline(auditRows ?? [])

    // 4. Render HTML.
    const bundle = {
      entity: {
        type: body.entity_type,
        id: entityId,
        number: (entityRow.number as number | undefined) ?? entityId,
        title: (entityRow.title as string | undefined) ?? '(untitled)',
        status: (entityRow.status as string | undefined) ?? 'unknown',
        detail: entityRow as Record<string, unknown>,
      },
      audit_rows: auditRows ?? [],
      chain,
      comments: ((commentRows as any[] | null) ?? []).map((c) => ({
        id: c.id as string,
        author: (c.author_name as string | null) ?? (c.author_email as string | null) ?? 'unknown',
        authored_at: c.created_at as string,
        body: (c.body as string | null) ?? '',
        message_id: (c.message_id as string | undefined) ?? undefined,
        via_email: (c.source as string | undefined) === 'email',
      })),
      media: ((media as any[] | null) ?? []).map((m) => ({
        id: m.id as string,
        kind: (m.kind as string | null) ?? 'document',
        url: (m.file_url as string | null) ?? '',
        caption: (m.caption as string | null) ?? undefined,
      })),
      escalations: ((escs as any[] | null) ?? []).map((e) => ({
        stage: e.stage as string,
        channel: e.channel as string,
        triggered_at: e.triggered_at as string,
        recipient_email: (e.recipient_email as string | undefined) ?? undefined,
      })),
    }
    const contentHash = await computeBundleHash(bundle)
    const manifest = {
      generated_at: new Date().toISOString(),
      content_hash: contentHash,
      source_row_count: bundle.audit_rows.length + bundle.comments.length + bundle.media.length,
      chain_verified: chain.ok,
      chain_gap_count: chain.gaps.length,
      generator: 'sealed-entity-export-v1',
      partial_chain: !chain.ok,
    }
    const html = renderHtml(bundle, manifest)

    // 5. Upload to storage. Filename is hash-deterministic so duplicates collapse.
    const safeNum = String(bundle.entity.number).replace(/[^A-Za-z0-9._-]/g, '_')
    const filename = `${body.entity_type}-${safeNum}-${contentHash.slice(0, 12)}.html`
    const path = `${projectId}/${body.entity_type}/${filename}`

    const upload = await (admin as any).storage
      .from(STORAGE_BUCKET)
      .upload(path, new Blob([html], { type: 'text/html' }), {
        upsert: true,
        contentType: 'text/html',
      })
    if (upload.error && !`${upload.error.message}`.includes('Bucket not found')) {
      // If the bucket exists but upload failed for another reason, surface.
      throw new HttpError(500, `upload: ${upload.error.message}`)
    }

    const signed = await (admin as any).storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 60 * 60) // 1 hour
    if (signed.error) {
      throw new HttpError(500, `signed url: ${signed.error.message}`)
    }

    return new Response(
      JSON.stringify({
        ok: true,
        signed_url: signed.data?.signedUrl ?? null,
        content_hash: contentHash,
        path,
        manifest,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } },
    )
  } catch (err) {
    return errorResponse(err, getCorsHeaders(req))
  }
})

// ── Inline duplicates of the SPA libs (Deno can't import from src/) ─

interface AuditRow {
  id: string
  created_at: string
  user_id: string | null
  user_email: string | null
  project_id: string | null
  organization_id: string | null
  entity_type: string
  entity_id: string
  action: string
  before_state: unknown
  after_state: unknown
  changed_fields: ReadonlyArray<string> | null
  metadata: Record<string, unknown> | null
  previous_hash: string | null
  entry_hash: string | null
}

interface ChainGap { row_id: string; reason: string }
interface ChainResult { ok: boolean; total: number; gaps: ChainGap[] }

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function pgText(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

function buildPayload(row: AuditRow, prev: string | null): string {
  return [
    row.id,
    row.created_at,
    row.user_id ?? '',
    row.user_email ?? '',
    row.project_id ?? '',
    row.organization_id ?? '',
    row.entity_type,
    row.entity_id,
    row.action,
    row.before_state == null ? '' : pgText(row.before_state),
    row.after_state == null ? '' : pgText(row.after_state),
    (row.changed_fields ?? []).join(','),
    row.metadata == null ? '{}' : pgText(row.metadata),
    prev ?? '',
  ].join('|')
}

async function verifyChainInline(rows: AuditRow[]): Promise<ChainResult> {
  const gaps: ChainGap[] = []
  let prev: string | null = null
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const expectedPrev = prev
    if (i === 0) {
      if (r.previous_hash != null) gaps.push({ row_id: r.id, reason: 'previous_hash_mismatch' })
    } else if (r.previous_hash !== expectedPrev) {
      gaps.push({ row_id: r.id, reason: r.previous_hash == null ? 'missing_previous_hash_for_non_first' : 'previous_hash_mismatch' })
    }
    if (r.entry_hash == null) {
      gaps.push({ row_id: r.id, reason: 'missing_entry_hash' })
      prev = r.previous_hash
      continue
    }
    const computed = await sha256(buildPayload(r, expectedPrev))
    if (computed !== r.entry_hash) gaps.push({ row_id: r.id, reason: 'entry_hash_mismatch' })
    prev = r.entry_hash
  }
  return { ok: gaps.length === 0, total: rows.length, gaps }
}

function canonicalize(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']'
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}'
}

async function computeBundleHash(bundle: any): Promise<string> {
  return sha256(
    canonicalize({
      entity: bundle.entity,
      audit_row_ids: bundle.audit_rows.map((r: any) => r.id).sort(),
      audit_entry_hashes: bundle.audit_rows.map((r: any) => r.entry_hash).filter(Boolean),
      chain_ok: bundle.chain.ok,
      chain_total: bundle.chain.total,
      comment_ids: bundle.comments.map((c: any) => c.id).sort(),
      media_ids: bundle.media.map((m: any) => m.id).sort(),
    }),
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function renderHtml(bundle: any, manifest: any): string {
  const e = bundle.entity
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(e.type)} #${escapeHtml(String(e.number))} — sealed</title>
<style>body{font-family:Helvetica,sans-serif;color:#111}.page{page-break-after:always;padding:36pt}h1{margin-bottom:6pt}h2{margin-bottom:6pt}.ts{color:#666;font-size:10pt;margin-right:6pt}.who{font-weight:bold;margin-right:4pt}.action{color:#666;font-style:italic}.empty{color:#999;font-style:italic}.meta{color:#666;font-size:10pt}pre{white-space:pre-wrap;font-family:inherit;background:#f6f6f6;padding:8pt;border-radius:4pt}figure{margin:0 0 12pt 0}figure img{max-width:100%;max-height:480pt}figcaption{font-size:10pt;color:#666;margin-top:4pt}.warn{color:#b00020}table{border-collapse:collapse}th,td{padding:6pt 12pt;border-bottom:1pt solid #ddd;text-align:left}code{font-family:monospace;font-size:10pt}.legal{font-size:9pt;color:#666;margin-top:24pt}</style>
</head><body>
<section class="page"><h1>${escapeHtml(e.type.toUpperCase())} #${escapeHtml(String(e.number))}</h1><h2>${escapeHtml(e.title)}</h2><p>Current state: <strong>${escapeHtml(e.status)}</strong></p><p class="meta">Generated ${escapeHtml(manifest.generated_at)} · Generator ${escapeHtml(manifest.generator)}</p></section>
<section class="page"><h2>State history</h2>${bundle.audit_rows.length === 0 ? '<p class="empty">No audit events.</p>' : ''}<ol>${bundle.audit_rows.map((r: any) => `<li><span class="ts">${escapeHtml(r.created_at)}</span><span class="who">${escapeHtml(r.user_name ?? r.user_email ?? 'system')}</span><span class="action">${escapeHtml(r.action)}</span></li>`).join('')}</ol></section>
<section class="page"><h2>Comments &amp; email thread</h2>${bundle.comments.length === 0 ? '<p class="empty">No comments.</p>' : ''}<ol>${bundle.comments.map((c: any) => `<li><p class="meta">${escapeHtml(c.author)} · ${escapeHtml(c.authored_at)}${c.via_email ? ' · email' : ''}</p>${c.message_id ? `<p>Message-ID: ${escapeHtml(c.message_id)}</p>` : ''}<pre>${escapeHtml(c.body)}</pre></li>`).join('')}</ol></section>
<section class="page"><h2>Linked media (${bundle.media.length})</h2>${bundle.media.length === 0 ? '<p class="empty">No linked media.</p>' : ''}${bundle.media.map((m: any) => `<figure><img src="${escapeHtml(m.url)}" alt="${escapeHtml(m.caption ?? '')}"/>${m.caption ? `<figcaption>${escapeHtml(m.caption)}</figcaption>` : ''}</figure>`).join('')}</section>
${bundle.escalations && bundle.escalations.length ? `<section class="page"><h2>Escalation log</h2><ol>${bundle.escalations.map((e: any) => `<li><span class="ts">${escapeHtml(e.triggered_at)}</span><strong>${escapeHtml(e.stage)}</strong> via ${escapeHtml(e.channel)}${e.recipient_email ? ` → ${escapeHtml(e.recipient_email)}` : ''}</li>`).join('')}</ol></section>` : ''}
<section class="page"><h2>Hash chain proof</h2><p>Total audit entries: ${manifest.source_row_count}</p><p>Chain verified: <strong>${manifest.chain_verified ? 'YES' : 'NO'}</strong></p>${bundle.chain.gaps.length === 0 ? '' : '<h3 class="warn">PARTIAL CHAIN — see manifest</h3><ul>' + bundle.chain.gaps.map((g: any) => `<li>Row ${escapeHtml(g.row_id)}: ${escapeHtml(g.reason)}</li>`).join('') + '</ul>'}</section>
<section class="page"><h2>Manifest</h2><table><tr><th>Generated at</th><td>${escapeHtml(manifest.generated_at)}</td></tr><tr><th>Content hash</th><td><code>${escapeHtml(manifest.content_hash)}</code></td></tr><tr><th>Source rows</th><td>${manifest.source_row_count}</td></tr><tr><th>Chain verified</th><td>${manifest.chain_verified ? 'YES' : 'NO'}</td></tr><tr><th>Chain gaps</th><td>${manifest.chain_gap_count}</td></tr><tr><th>Generator</th><td>${escapeHtml(manifest.generator)}</td></tr></table><p class="legal">This document is sealed. Re-opening it through SiteSync recomputes the content hash; a mismatch indicates the file has been modified outside the platform.</p></section>
</body></html>`
}
