import type { BudgetAnomaly } from './financialEngine'
import type { CollaborationContext, CollaborationBlockerItem, ProjectAIContext } from '../types/ai'
import { getProject } from '../api/endpoints/projects'
import { getRfis } from '../api/endpoints/rfis'
import { fetchBudgetDivisions } from '../api/endpoints/budget'
import { getSchedulePhases } from '../api/endpoints/schedule'
import { getDailyLogs } from '../api/endpoints/field'
import { getSubmittals } from '../api/endpoints/submittals'
import { getActivityFeed } from '../api/endpoints/activity'
import { usePresenceStore } from '../stores/presenceStore'
import { useUiStore } from '../stores/uiStore'

const IDLE_THRESHOLD_MS = 48 * 60 * 60 * 1000

export async function buildCollaborationContext(projectId: string): Promise<CollaborationContext> {
  const presenceState = usePresenceStore.getState()
  const notifState = useUiStore.getState()

  const onlineUsers = presenceState.onlineUsers.map(u => ({
    id: u.userId || '',
    name: u.name || u.userId || 'Unknown',
    page: u.page,
  }))

  const unreadNotificationTitles = notifState.notifications
    .filter(n => !n.read)
    .map(n => n.title)

  const now = Date.now()

  const [rfisRes, submittalsRes, activityRes] = await Promise.allSettled([
    getRfis(projectId),
    getSubmittals(projectId),
    getActivityFeed(projectId),
  ])

  // Build last-activity map: user_id -> most recent activity timestamp in ms
  const lastActivityByUser = new Map<string, number>()
  if (activityRes.status === 'fulfilled') {
    for (const entry of activityRes.value) {
      const uid = (entry as { user_id?: string | null }).user_id
      const ts = entry.created_at ? new Date(entry.created_at).getTime() : 0
      if (uid && ts) {
        const prev = lastActivityByUser.get(uid) ?? 0
        if (ts > prev) lastActivityByUser.set(uid, ts)
      }
    }
  }

  const blockedItems: CollaborationBlockerItem[] = []
  const RFI_OPEN = new Set(['open', 'draft', 'review', 'pending'])
  const SUB_OPEN = new Set(['pending', 'review', 'submitted', 'in_review'])

  if (rfisRes.status === 'fulfilled') {
    for (const rfi of rfisRes.value.data) {
      const bic = rfi.ball_in_court as string | null | undefined
      if (!bic) continue
      if (rfi.status && !RFI_OPEN.has(rfi.status)) continue
      const lastUpdate = (rfi as { updated_at?: string | null }).updated_at
        ? new Date((rfi as { updated_at: string }).updated_at).getTime()
        : 0
      const lastActivity = lastActivityByUser.get(bic) ?? lastUpdate
      const idleMs = now - Math.max(lastActivity, lastUpdate)
      if (idleMs > IDLE_THRESHOLD_MS) {
        blockedItems.push({
          entityType: 'rfi',
          entityNumber: rfi.rfiNumber || `RFI-${rfi.number}`,
          entityId: rfi.id,
          title: rfi.title,
          assignedTo: bic,
          idleSinceHours: Math.floor(idleMs / (60 * 60 * 1000)),
        })
      }
    }
  }

  if (submittalsRes.status === 'fulfilled') {
    for (const sub of submittalsRes.value.data) {
      const assignee = sub.assigned_to as string | null | undefined
      if (!assignee) continue
      if (sub.status && !SUB_OPEN.has(sub.status)) continue
      const lastUpdate = (sub as { updated_at?: string | null }).updated_at
        ? new Date((sub as { updated_at: string }).updated_at).getTime()
        : 0
      const lastActivity = lastActivityByUser.get(assignee) ?? lastUpdate
      const idleMs = now - Math.max(lastActivity, lastUpdate)
      if (idleMs > IDLE_THRESHOLD_MS) {
        blockedItems.push({
          entityType: 'submittal',
          entityNumber: sub.submittalNumber || `SUB-${sub.number}`,
          entityId: sub.id,
          title: sub.title,
          assignedTo: assignee,
          idleSinceHours: Math.floor(idleMs / (60 * 60 * 1000)),
        })
      }
    }
  }

  // Tally blocked items per assignee to find the most overdue party
  const countByAssignee = new Map<string, number>()
  for (const item of blockedItems) {
    countByAssignee.set(item.assignedTo, (countByAssignee.get(item.assignedTo) ?? 0) + 1)
  }
  let mostOverdueAssignee: CollaborationContext['mostOverdueAssignee'] = null
  let maxCount = 0
  for (const [name, count] of countByAssignee) {
    if (count > maxCount) {
      maxCount = count
      mostOverdueAssignee = { name, itemCount: count }
    }
  }

  return { onlineUsers, unreadNotificationTitles, blockedItems, mostOverdueAssignee }
}

function fmtDollars(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

export async function fetchAndBuildProjectContext(projectId: string): Promise<string> {
  const [projectRes, rfisRes, costRes, schedRes, logsRes] = await Promise.allSettled([
    getProject(projectId),
    getRfis(projectId),
    fetchBudgetDivisions(projectId),
    getSchedulePhases(projectId),
    getDailyLogs(projectId),
  ])

  const lines: string[] = []

  if (projectRes.status === 'fulfilled') {
    const p = projectRes.value
    const value = p.contract_value ? fmtDollars(p.contract_value) : 'N/A'
    lines.push(`=== PROJECT: ${p.name} ===`)
    lines.push(`Contract Value: ${value} | Phase: ${p.project_phase ?? 'N/A'} | Status: ${p.status ?? 'active'}`)
  }

  if (rfisRes.status === 'fulfilled') {
    const today = new Date().toISOString().slice(0, 10)
    const open = rfisRes.value.data.filter(r => r.status !== 'closed' && r.status !== 'answered')
    const overdue = open.filter(r => r.dueDate && r.dueDate < today)
    lines.push('')
    lines.push('--- RFIs ---')
    lines.push(`Open: ${open.length} | Overdue: ${overdue.length}`)
  }

  if (costRes.status === 'fulfilled') {
    const divs = costRes.value.divisions
      .filter(d => d.budget > 0)
      .map(d => {
        const committed = d.spent + d.committed
        return { name: d.name, csi: d.csi_division, budget: d.budget, committed, variance: committed - d.budget }
      })
      .sort((a, b) => b.variance - a.variance)
      .slice(0, 3)
    lines.push('')
    lines.push('--- Budget (Top 3 CSI Divisions by Variance) ---')
    for (const d of divs) {
      const label = d.csi ? `CSI ${d.csi} ${d.name}` : d.name
      const varPct = ((d.variance / d.budget) * 100).toFixed(1)
      const sign = d.variance >= 0 ? '+' : ''
      lines.push(`${label}: Budget ${fmtDollars(d.budget)} | Committed ${fmtDollars(d.committed)} | Variance ${sign}${fmtDollars(d.variance)} (${sign}${varPct}%)`)
    }
  }

  if (schedRes.status === 'fulfilled') {
    const today = new Date().toISOString().slice(0, 10)
    const upcoming = schedRes.value
      .filter(s => s.percent_complete < 100 && s.status !== 'completed' && s.finish_date >= today)
      .sort((a, b) => a.finish_date.localeCompare(b.finish_date))
      .slice(0, 3)
    lines.push('')
    lines.push('--- Schedule Milestones (Next 3) ---')
    for (const m of upcoming) {
      const critical = m.is_critical ? ' [CRITICAL PATH]' : ''
      lines.push(`${m.name}: due ${m.finish_date}${critical}`)
    }
  }

  if (logsRes.status === 'fulfilled') {
    const recent = logsRes.value.data.slice(0, 3)
    lines.push('')
    lines.push('--- Recent Daily Logs ---')
    for (const log of recent) {
      const summary = (log.ai_summary || log.summary_display || '').slice(0, 150).replace(/-/g, ',')
      lines.push(`[${log.date}] ${log.workers} workers, ${log.manHours} man-hours. ${summary}`)
    }
  }

  // Append collaboration context
  const collab = await buildCollaborationContext(projectId).catch(() => null)
  if (collab) {
    if (collab.onlineUsers.length > 0) {
      lines.push('')
      lines.push('--- Team Presence ---')
      lines.push(`Online now: ${collab.onlineUsers.map(u => u.name).join(', ')}`)
    }
    if (collab.unreadNotificationTitles.length > 0) {
      lines.push('')
      lines.push('--- Unread Notifications ---')
      for (const title of collab.unreadNotificationTitles) lines.push(`* ${title}`)
    }
    if (collab.blockedItems.length > 0) {
      lines.push('')
      lines.push('--- Collaboration Blockers (ball-in-court idle >48h) ---')
      for (const item of collab.blockedItems.slice(0, 8)) {
        lines.push(`${item.entityNumber} "${item.title}": waiting on ${item.assignedTo} for ${item.idleSinceHours}h`)
      }
      if (collab.mostOverdueAssignee) {
        lines.push(`Most blocked: ${collab.mostOverdueAssignee.name} holds ${collab.mostOverdueAssignee.itemCount} idle item(s)`)
      }
    }
  }

  return lines.join('\n')
}

const APPROX_CHARS_PER_TOKEN = 4
const CONTEXT_TOKEN_LIMIT = 3000

export function buildProjectContext(data: ProjectAIContext): string {
  const lines: string[] = []

  lines.push(`=== PROJECT: ${data.projectName} ===`)
  const value = data.contractValue ? fmtDollars(data.contractValue) : 'N/A'
  lines.push(`Contract Value: ${value} | Phase: ${data.phase ?? 'N/A'}`)

  lines.push('')
  lines.push('--- RFIs ---')
  lines.push(`Open: ${data.openRfiCount} | Overdue: ${data.overdueRfiCount}`)

  if (data.budgetVarianceByDivision.length > 0) {
    lines.push('')
    lines.push('--- Budget (Top CSI Divisions by Variance) ---')
    for (const d of data.budgetVarianceByDivision.slice(0, 3)) {
      const label = d.csiCode ? `CSI ${d.csiCode} ${d.divisionName}` : d.divisionName
      const sign = d.budgetVariancePct >= 0 ? '+' : ''
      lines.push(`${label}: Variance ${sign}${fmtDollars(d.varianceAmount)} (${sign}${d.budgetVariancePct.toFixed(1)}%)`)
    }
  }

  if (data.scheduleVarianceDays !== null) {
    const ahead = data.scheduleVarianceDays >= 0
    lines.push('')
    lines.push('--- Schedule ---')
    lines.push(`Variance: ${ahead ? '+' : ''}${data.scheduleVarianceDays} days (${ahead ? 'ahead' : 'behind'})`)
  }

  if (data.criticalPathActivities.length > 0) {
    lines.push('Critical Path:')
    for (const a of data.criticalPathActivities.slice(0, 5)) {
      lines.push(`  ${a.name}: due ${a.finishDate}`)
    }
  }

  if (data.recentDailyLogSummaries.length > 0) {
    lines.push('')
    lines.push('--- Recent Daily Logs ---')
    for (const log of data.recentDailyLogSummaries.slice(0, 5)) {
      lines.push(`[${log.date}] ${log.summary.slice(0, 150)}`)
    }
  }

  if (data.activeBallInCourtSubmittals.length > 0) {
    lines.push('')
    lines.push('--- Active Submittals (Ball in Court) ---')
    for (const s of data.activeBallInCourtSubmittals) {
      lines.push(`${s.number} "${s.title}": waiting on ${s.assignedTo}`)
    }
  }

  if (data.pendingChangeOrderExposure > 0) {
    lines.push('')
    lines.push('--- Pending Change Order Exposure ---')
    lines.push(`Total: ${fmtDollars(data.pendingChangeOrderExposure)}`)
  }

  const result = lines.join('\n')
  const estimatedTokens = Math.ceil(result.length / APPROX_CHARS_PER_TOKEN)
  if (estimatedTokens > CONTEXT_TOKEN_LIMIT) {
    const maxChars = CONTEXT_TOKEN_LIMIT * APPROX_CHARS_PER_TOKEN
    if (import.meta.env.DEV) console.warn(`[aiPrompts] Project context truncated: ~${estimatedTokens} tokens exceeds ${CONTEXT_TOKEN_LIMIT} token limit`)
    return result.slice(0, maxChars)
  }
  return result
}

export function buildBudgetInsightPrompt(anomalies: BudgetAnomaly[], projectName: string): string {
  const lines = anomalies
    .map(a => `${a.divisionName} (${a.severity.toUpperCase()}): ${a.message}`)
    .join('\n')
  return `You are analyzing budget risk for construction project "${projectName}". The following cost anomalies were detected:\n\n${lines}\n\nProvide a concise plain-English risk summary for the project superintendent. For each anomaly explain the financial exposure and recommend one specific mitigation action. Keep each response to 1 to 2 sentences. Do not use hyphens.`
}

export const CONSTRUCTION_SYSTEM_PROMPT = `You are SiteSync PM, the most experienced construction project engineer in the world. You know CSI MasterFormat, AIA billing, CPM scheduling, OSHA safety, lien waiver law, and every workflow a GC runs daily. You speak like a construction professional, not a generic assistant. Always use real numbers from the project context provided. Never say 'I don't have access to that data' as the data is in your context window.`

export const SYSTEM_PROMPT = `You are the SiteSync PM Copilot, an expert construction project engineer and project management assistant. You have deep knowledge of construction processes, contracts, specifications, and field operations.

You have real-time access to all project data including RFIs, submittals, schedule, budget, daily logs, drawings, punch lists, and crew information. You communicate like a seasoned superintendent: direct, precise, and action oriented.

When responding:
- Lead with the most critical information first
- Use construction industry terminology appropriately
- Quantify risks with specific numbers and dates when possible
- Suggest concrete next actions, not vague recommendations
- Reference specific entities with [ENTITY:type:id:label] markers when citing RFIs, submittals, tasks, etc.
- When the user asks to create or update something, respond with [ACTION_PENDING: description of action] to confirm before executing
- Offer follow up questions the user might find useful

You never use hyphens in your responses. Use commas, periods, or restructure sentences instead.`

export const RFI_DRAFT_PROMPT = `You are drafting a formal RFI response for a construction project. Your response must be professional, technically precise, and compliant with standard construction contract requirements (AIA, ConsensusDocs).

Format the response with:
1. A clear, direct answer to the question posed
2. Reference to the applicable specification section or drawing number
3. Any required field actions or clarifications
4. Impact statement if schedule or cost is affected

Keep the language formal and unambiguous. Do not use hyphens. All statements should be defensible in a dispute context.`

export const DAILY_LOG_SUMMARY_PROMPT = `You are generating a professional daily log summary for a construction project. Transform the raw field data into a clear narrative suitable for owner reporting and record keeping.

Include:
- Weather conditions and any impact on work
- Workforce counts by trade and productivity notes
- Work completed with location references
- Equipment on site
- Materials received or issues
- Safety observations
- Any delays, incidents, or notable events
- Visitors and inspections

Write in past tense. Be specific about quantities and locations. Do not use hyphens. Keep it factual and professional.`

export const RISK_ANALYSIS_PROMPT = `You are analyzing construction project data to identify risks across schedule, budget, safety, and quality dimensions.

For each risk identified, provide:
1. Risk type (schedule delay, budget overrun, safety concern, quality issue)
2. Severity (info, warning, critical)
3. Specific affected items with dates and dollar amounts where applicable
4. Probability assessment (low, medium, high)
5. Recommended mitigation action with owner and due date

Prioritize risks by potential impact. Flag anything that could trigger a contract dispute or delay milestone payments. Do not use hyphens.`

export const MEETING_MINUTES_PROMPT = `You are generating structured meeting minutes from construction meeting notes. Format the output as a professional record suitable for distribution to all project stakeholders.

Include:
- Meeting type, date, location, and attendees
- Items discussed, organized by topic
- Decisions made (clearly labeled as DECISION)
- Action items with responsible party and due date (clearly labeled as ACTION ITEM)
- Next meeting details if mentioned

Write in past tense for discussion items, present/future tense for action items. Be concise but complete. Do not use hyphens.`

export const COLLABORATION_BLOCKER_PROMPT = `You are analyzing project collaboration status to identify workflow bottlenecks and stalled items. You have access to the current team presence, unread notifications, and a list of RFIs and submittals where the assigned ball-in-court party has been idle for more than 48 hours.

When answering questions like "Who is blocking X?" or "Which items are waiting on [person]?":
1. List each stalled item by entity number (e.g. RFI-003, SUB-007), title, and how many hours it has been idle
2. Name the specific person responsible (ball-in-court) and note whether they are currently online or offline
3. Group multiple items by the same assignee and call out their total count
4. Suggest a concrete follow-up action per assignee with a specific due date

Sort results by idle time, longest first. Always cite specific names and entity numbers, never generic placeholders. Do not use hyphens. Use construction industry language: "ball-in-court", "pending response", "action required".`

export const DRAWING_ANALYSIS_PROMPT = `You are interpreting AI generated classifications and discrepancy findings from a construction drawing set. Each sheet has been processed by a vision model that extracted: sheet number, drawing title, discipline, plan type, floor level, building, and architectural scale. Paired sheets (architectural vs structural for the same area and level) are analyzed for dimensional discrepancies.

When answering questions about drawings:
1. Cite specific sheet numbers and titles. Never refer to "the drawing" without identifying which one.
2. Group findings by discipline and plan type when summarizing multi sheet sets.
3. When a scale is reported, state it in standard notation (e.g. 1/8" equals 1'0").
4. Flag low confidence classifications (confidence below 0.7) explicitly. Recommend manual review.
5. For paired sheets, report pairing confidence and method (AI versus manual).

Use construction drawing terminology: sheet, elevation, section, schedule, title block, scale bar. Do not use hyphens.`

export const FIELD_PHOTO_COMPARISON_PROMPT = `You are comparing a field photograph against a classified construction drawing. The drawing's metadata (discipline, plan type, floor level, scale, and extracted dimensions) is provided alongside the photo.

Your job is to:
1. Identify visible elements in the photo: framing members, MEP runs, openings, structural elements, finishes.
2. Cross reference each visible element with what the drawing specifies at that location.
3. Call out mismatches: missing elements, extra elements, wrong dimensions, wrong materials, wrong orientation.
4. Rate overall field to plan alignment as high, medium, or low.
5. Recommend concrete actions: create an RFI, flag as punch item, request field measurement, photograph additional angles.

Be specific about location ("at column line C/4", "north wall of stairwell B2"). If the photo lacks enough context to verify, say so and list what additional photos would help. Do not use hyphens.`

export const DISCREPANCY_EXPLANATION_PROMPT = `You are explaining a detected dimensional discrepancy between architectural and structural drawings in plain construction language. The discrepancy includes: source sheets, reported architectural dimension, reported structural dimension, tolerance threshold, computed delta, and severity (high, medium, low).

For each discrepancy, produce:
1. A one sentence summary suitable for an RFI subject line.
2. A two to three sentence description explaining what the arch sheet says versus what the struct sheet says, at what location, and what the construction impact is.
3. Severity justification: why this is high, medium, or low. High discrepancies (greater than 5% divergence or greater than 2 inches on load bearing elements) should trigger an immediate RFI.
4. Recommended resolution path: who owns it (architect or structural engineer), what drawing reference is needed, and an estimated schedule impact.

Never use hyphens. Use terms like "coordination required", "dimension mismatch", "RFI recommended". Be direct and unambiguous, as this text feeds into formal RFI documents.`

export const AI_COPILOT_DRAWING_TOOLS = [
  {
    name: 'get_drawing_metadata',
    description:
      'Returns classification data for a single drawing: sheet number, title, discipline, plan type, floor level, scale, and confidence. Use when the user asks "what does sheet X say", "what is the scale of drawing Y", or "what discipline is this".',
    parameters: {
      type: 'object',
      required: ['drawing_id'],
      properties: {
        drawing_id: {
          type: 'string',
          description: 'UUID of the drawing to inspect',
        },
      },
    },
  },
  {
    name: 'analyze_pair_relationships',
    description:
      'Returns every architectural versus structural drawing pair for a project along with their pairing confidence, processing status, and count of detected discrepancies. Use when the user asks about pairing coverage or overall drawing set quality.',
    parameters: {
      type: 'object',
      required: ['project_id'],
      properties: {
        project_id: {
          type: 'string',
          description: 'UUID of the project',
        },
      },
    },
  },
  {
    name: 'get_discrepancy_stats',
    description:
      'Returns aggregated discrepancy statistics for a project, grouped by severity (high, medium, low), by discipline pair, and by resolution status (open, auto RFI created, confirmed, dismissed).',
    parameters: {
      type: 'object',
      required: ['project_id'],
      properties: {
        project_id: {
          type: 'string',
          description: 'UUID of the project',
        },
      },
    },
  },
  {
    name: 'trigger_clash_analysis',
    description:
      'Kicks off the full drawing intelligence pipeline for a project: pair extraction, edge detection, overlap generation, and dimensional discrepancy analysis. Returns a job identifier the caller can poll. Use when the user says "run the analysis", "check for clashes", or "scan this drawing set".',
    parameters: {
      type: 'object',
      required: ['project_id'],
      properties: {
        project_id: {
          type: 'string',
          description: 'UUID of the project',
        },
      },
    },
  },
  {
    name: 'compare_field_photo_to_drawing',
    description:
      'Uses vision AI to compare a field photo against the classified drawing at the same location. Returns alignment score and list of mismatches.',
    parameters: {
      type: 'object',
      required: ['photo_url', 'drawing_id'],
      properties: {
        photo_url: { type: 'string', description: 'Public URL of the field photo' },
        drawing_id: { type: 'string', description: 'UUID of the drawing to compare against' },
      },
    },
  },
] as const
