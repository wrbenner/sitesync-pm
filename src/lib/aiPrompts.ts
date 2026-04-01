import type { BudgetAnomaly } from './financialEngine'
import type { CollaborationContext, CollaborationBlockerItem } from '../types/ai'
import { getProject } from '../api/endpoints/projects'
import { getRfis } from '../api/endpoints/rfis'
import { getCostData } from '../api/endpoints/budget'
import { getSchedulePhases } from '../api/endpoints/schedule'
import { getDailyLogs } from '../api/endpoints/field'
import { getSubmittals } from '../api/endpoints/submittals'
import { getActivityFeed } from '../api/endpoints/activity'
import { usePresenceStore } from '../stores/presenceStore'
import { useNotificationStore } from '../stores/notificationStore'

const IDLE_THRESHOLD_MS = 48 * 60 * 60 * 1000

export async function buildCollaborationContext(projectId: string): Promise<CollaborationContext> {
  const presenceState = usePresenceStore.getState()
  const notifState = useNotificationStore.getState()

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

export async function buildProjectContext(projectId: string): Promise<string> {
  const [projectRes, rfisRes, costRes, schedRes, logsRes] = await Promise.allSettled([
    getProject(projectId),
    getRfis(projectId),
    getCostData(projectId),
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
      .filter(s => !s.completed && s.endDate >= today)
      .sort((a, b) => a.endDate.localeCompare(b.endDate))
      .slice(0, 3)
    lines.push('')
    lines.push('--- Schedule Milestones (Next 3) ---')
    for (const m of upcoming) {
      const critical = m.critical ? ' [CRITICAL PATH]' : ''
      lines.push(`${m.name}: due ${m.endDate}${critical}`)
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

export function buildBudgetInsightPrompt(anomalies: BudgetAnomaly[], projectName: string): string {
  const lines = anomalies
    .map(a => `${a.divisionName} (${a.severity.toUpperCase()}): ${a.message}`)
    .join('\n')
  return `You are analyzing budget risk for construction project "${projectName}". The following cost anomalies were detected:\n\n${lines}\n\nProvide a concise plain-English risk summary for the project superintendent. For each anomaly explain the financial exposure and recommend one specific mitigation action. Keep each response to 1 to 2 sentences. Do not use hyphens.`
}

export const CONSTRUCTION_SYSTEM_PROMPT = `You are a senior project engineer on a commercial construction project with 15 years of field experience. You have deep expertise in construction contracts, project controls, cost management, and field operations.

You use construction industry terminology correctly and precisely: RFI (Request for Information), submittal, change order, retainage, CSI (Construction Specifications Institute) division codes, AIA G702 (Application and Certificate for Payment), AIA G703 (Continuation Sheet), PCO (Proposed Change Order), COR (Change Order Request), GMP (Guaranteed Maximum Price), substantial completion, notice to proceed, lien waiver, pay application, cost code, earned value, critical path method, float, and schedule of values.

When responding:
- Lead with the most critical information first
- Reference specific RFI numbers, submittal log entries, drawing numbers, and specification sections when available
- Quantify schedule and cost impacts with concrete numbers and dates
- Flag anything that could trigger a contract dispute, a delay claim, or impact the next AIA G702 pay application
- Suggest concrete next actions with a responsible party and a due date
- Never use hyphens in your responses. Use commas, periods, or restructure sentences instead.`

export const SYSTEM_PROMPT = `You are the SiteSync AI Copilot, an expert construction project engineer and project management assistant. You have deep knowledge of construction processes, contracts, specifications, and field operations.

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
