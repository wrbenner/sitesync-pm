// iris-weekly-digest — Monday-morning Iris digest worker
//
// P2b deliverable #5 (Iris weekly digest). Hybrid-cron pattern per
// ADR-003: pg_cron heartbeat (Monday 06:00 project-local) enqueues a
// pgmq message → this edge fn worker dequeues, computes risk-ranked
// open RFIs per recipient, writes one iris_weekly_digests row per
// (project_id, week_starting, recipient_id), and (optionally) calls
// send-email so the digest also lands in Walker's inbox.
//
// Idempotency: the iris_weekly_digests table has UNIQUE
// (project_id, week_starting, recipient_id), so re-runs upsert.
//
// Risk score formula:
//   priority_weight × (cost_impact_cents / 100000)  +
//   days_open / max(SLA_days_remaining, 1) × 10     +
//   priority_weight × 5
// Then top-N (default 5) sort desc.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface InvokeBody {
  project_id?: string                    // Optional: limit to one project
  week_starting?: string                 // Optional: ISO date (Monday)
  top_n?: number                         // Default 5
}

interface RFIRow {
  id: string
  project_id: string
  number: number | null
  title: string
  status: string | null
  priority: string | null
  ball_in_court: string | null
  cost_impact_cents: number | null
  schedule_days_impact: number | null
  due_date: string | null
  created_at: string
}

const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dow = d.getUTCDay()
  const offset = dow === 0 ? -6 : 1 - dow
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

function daysOpen(createdAt: string): number {
  const d = (Date.now() - new Date(createdAt).getTime()) / 86400000
  return Math.max(0, Math.floor(d))
}

function slaDaysRemaining(rfi: RFIRow): number {
  if (!rfi.due_date) return 7
  const days = (new Date(rfi.due_date).getTime() - Date.now()) / 86400000
  return Math.max(1, Math.floor(days))
}

function riskScore(rfi: RFIRow): number {
  const weight = PRIORITY_WEIGHT[rfi.priority ?? 'medium'] ?? 2
  const costMillions = (rfi.cost_impact_cents ?? 0) / 100_000_000
  const open = daysOpen(rfi.created_at)
  const sla = slaDaysRemaining(rfi)
  return Number((weight * costMillions * 100 + (open / sla) * 10 + weight * 5).toFixed(2))
}

function reasonFor(rfi: RFIRow): string {
  const cost = rfi.cost_impact_cents ?? 0
  const open = daysOpen(rfi.created_at)
  const dueLabel = rfi.due_date ? `due ${rfi.due_date}` : 'no due date'
  if (cost > 100_000) return `$${Math.round(cost / 100).toLocaleString()} cost impact, ${open}d open, ${dueLabel}`
  if (open > 14) return `${open}d open, ${dueLabel}`
  if (rfi.priority === 'critical') return `Critical priority, ${dueLabel}`
  return `${rfi.priority ?? 'medium'} priority, ${open}d open`
}

function digestHtml(projectName: string, weekStarting: string, ranked: Array<{ rfi: RFIRow; score: number; reason: string }>): string {
  const rows = ranked
    .map((r) => {
      const num = r.rfi.number != null ? `RFI-${String(r.rfi.number).padStart(3, '0')}` : `RFI-${r.rfi.id.slice(0, 6)}`
      return `
        <li style="margin-bottom:10px;">
          <strong>${num}: ${escapeHtml(r.rfi.title)}</strong><br/>
          <span style="font-size:12px;color:#5C5550;">${escapeHtml(r.reason)}</span>
        </li>`
    })
    .join('')
  return `<!doctype html>
<html><body style="font-family:Helvetica,Arial,sans-serif;color:#1A1613;max-width:640px;margin:0 auto;">
  <div style="background:#F47820;padding:16px;color:#fff;font-weight:700;">SITESYNC PM · Iris weekly digest</div>
  <div style="padding:24px;">
    <p style="margin:0 0 12px 0;font-size:14px;">Top ${ranked.length} RFIs need your attention this week (${weekStarting}, ${escapeHtml(projectName)}).</p>
    <ol style="padding-left:20px;font-size:14px;line-height:1.6;">${rows}</ol>
  </div>
</body></html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function digestForProject(projectId: string, projectName: string, weekStarting: string, topN: number): Promise<number> {
  const { data: rfis } = await sb
    .from('rfis')
    .select('id, project_id, number, title, status, priority, ball_in_court, cost_impact_cents, schedule_days_impact, due_date, created_at')
    .eq('project_id', projectId)
    .neq('status', 'closed')
    .neq('status', 'void')
    .is('deleted_at', null)
  const open = (rfis ?? []) as RFIRow[]
  if (open.length === 0) return 0

  const ranked = open
    .map((r) => ({ rfi: r, score: riskScore(r), reason: reasonFor(r) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)

  const { data: members } = await sb
    .from('project_members')
    .select('user_id, role')
    .eq('project_id', projectId)
    .in('role', ['owner', 'admin', 'member'])
  const recipients = (members ?? []) as Array<{ user_id: string }>

  const html = digestHtml(projectName, weekStarting, ranked)
  const text = ranked
    .map((r) => `${r.rfi.number != null ? `RFI-${String(r.rfi.number).padStart(3, '0')}` : r.rfi.id.slice(0, 6)}: ${r.rfi.title} — ${r.reason}`)
    .join('\n')

  let written = 0
  for (const m of recipients) {
    const { error } = await sb.from('iris_weekly_digests').upsert(
      {
        project_id: projectId,
        week_starting: weekStarting,
        recipient_id: m.user_id,
        ranked_rfis: ranked.map((r) => ({
          rfi_id: r.rfi.id,
          score: r.score,
          reason: r.reason,
          cost_cents: r.rfi.cost_impact_cents,
          days_open: daysOpen(r.rfi.created_at),
        })),
        body_html: html,
        body_text: text,
      },
      { onConflict: 'project_id,week_starting,recipient_id' },
    )
    if (!error) written++
  }
  return written
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  let body: InvokeBody = {}
  try {
    body = await req.json() as InvokeBody
  } catch {
    body = {}
  }

  const weekStarting = body.week_starting ?? mondayOf(new Date())
  const topN = body.top_n ?? 5

  let projects: Array<{ id: string; name: string | null }> = []
  if (body.project_id) {
    const { data } = await sb.from('projects').select('id, name').eq('id', body.project_id).maybeSingle()
    if (data) projects = [data as { id: string; name: string | null }]
  } else {
    const { data } = await sb.from('projects').select('id, name')
    projects = (data ?? []) as Array<{ id: string; name: string | null }>
  }

  let totalDigests = 0
  for (const p of projects) {
    totalDigests += await digestForProject(p.id, p.name ?? 'Project', weekStarting, topN)
  }

  return new Response(
    JSON.stringify({ ok: true, week_starting: weekStarting, projects: projects.length, digests_written: totalDigests }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
})
