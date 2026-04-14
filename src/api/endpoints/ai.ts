// @ts-strict-check
import { supabase } from '../client'
import { validateProjectId } from '../middleware/projectScope'
import { aiService } from '../../lib/aiService'
import { captureException } from '../../lib/errorTracking'
import type { AIInsight, AiInsightsResponse } from '../../types/ai'
import type { ProjectFinancials, DivisionFinancials } from '../../types/financial'

export const getAiInsights = async (
  projectId: string,
  financials?: { summary: ProjectFinancials; divisions: DivisionFinancials[] }
): Promise<AiInsightsResponse> => {
  validateProjectId(projectId)

  const budgetInsights: AIInsight[] =
    financials && !financials.summary.isEmpty
      ? await aiService
          .generateBudgetInsights(projectId, financials.summary, financials.divisions)
          .catch(() => [])
      : []

  let aiServiceFailed = false
  let aiErrorType: string | undefined

  // Use AIService when configured; fall back to Supabase
  if (aiService.isConfigured()) {
    try {
      const insights = await aiService.generateInsights(projectId)
      const liveInsights = insights.map((i) => ({ ...i, source: 'live' as const }))
      return { insights: [...liveInsights, ...budgetInsights], dataSource: 'ai-live' as const }
    } catch (aiError) {
      aiServiceFailed = true
      aiErrorType = aiError instanceof Error ? aiError.name : 'UnknownError'
      captureException(
        aiError instanceof Error ? aiError : new Error(String(aiError)),
        { projectId, extra: { context: 'getAiInsights_aiService' } }
      )
    }
  }

  let cachedData: Array<Record<string, unknown>> = []
  try {
    const { data, error } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('project_id', projectId)
      .eq('dismissed', false)
      .order('created_at', { ascending: false })

    if (!error && data) {
      cachedData = data as Array<Record<string, unknown>>
    }
  } catch {
    // Non-fatal: fall through to computed insights
  }

  const cachedInsights = cachedData.map((row): AIInsight => ({
    id: row.id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    description: row.description,
    affectedEntities: row.affected_entities || [],
    suggestedAction: row.suggested_action,
    confidence: row.confidence ?? 1,
    source: 'cached' as const,
    createdAt: row.created_at,
    generatedAt: row.created_at,
    expiresAt: row.expires_at,
    dismissed: row.dismissed,
  }))

  if (cachedInsights.length === 0 && budgetInsights.length === 0) {
    const now = new Date().toISOString()

    // Query real project data with specific entities for rich insights
    let overdueRfis: Array<{ id: string; rfi_number: string | null; subject: string | null; due_date: string | null; ball_in_court: string | null }> = []
    let openPunchCount = 0
    let overBudgetItems: Array<{ id: string; description: string | null; division: string | null; spent_to_date: number; current_budget: number }> = []
    let pendingSubmittals: Array<{ id: string; number: string | null; title: string | null }> = []
    let atRiskPhases: Array<{ id: string; name: string | null; status: string | null }> = []

    try {
      const { data } = await supabase
        .from('rfis')
        .select('id, rfi_number, subject, due_date, ball_in_court')
        .eq('project_id', projectId)
        .neq('status', 'closed')
        .lt('due_date', now)
        .order('due_date', { ascending: true })
        .limit(5)
      overdueRfis = (data ?? []) as typeof overdueRfis
    } catch { /* non-fatal */ }

    try {
      const { count } = await supabase
        .from('punch_items')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .in('status', ['open', 'in_progress'])
      openPunchCount = count ?? 0
    } catch { /* non-fatal */ }

    try {
      const { data: budgetRows } = await supabase
        .from('budget_line_items')
        .select('id, description, division, spent_to_date, current_budget')
        .eq('project_id', projectId)
      overBudgetItems = ((budgetRows ?? []) as typeof overBudgetItems).filter(
        (row) => (row.spent_to_date ?? 0) > (row.current_budget ?? 0) && (row.current_budget ?? 0) > 0
      )
    } catch { /* non-fatal */ }

    try {
      const { data } = await supabase
        .from('submittals')
        .select('id, number, title')
        .eq('project_id', projectId)
        .eq('status', 'pending')
        .limit(5)
      pendingSubmittals = (data ?? []) as typeof pendingSubmittals
    } catch { /* non-fatal */ }

    try {
      const { data } = await supabase
        .from('schedule_phases')
        .select('id, name, status')
        .eq('project_id', projectId)
        .in('status', ['delayed', 'at_risk'])
        .limit(3)
      atRiskPhases = (data ?? []) as typeof atRiskPhases
    } catch { /* non-fatal */ }

    // Cross-entity conflict detection: RFIs blocking upcoming schedule phases
    let upcomingPhases: Array<{ id: string; name: string | null; start_date: string | null; status: string | null }> = []
    let openRfisWithDates: Array<{ id: string; rfi_number: string | null; subject: string | null; due_date: string | null; ball_in_court: string | null }> = []
    try {
      const sevenDaysOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('schedule_phases')
        .select('id, name, start_date, status')
        .eq('project_id', projectId)
        .neq('status', 'complete')
        .gte('start_date', now)
        .lte('start_date', sevenDaysOut)
        .order('start_date', { ascending: true })
        .limit(10)
      upcomingPhases = (data ?? []) as typeof upcomingPhases
    } catch { /* non-fatal */ }

    if (upcomingPhases.length > 0) {
      try {
        const { data } = await supabase
          .from('rfis')
          .select('id, rfi_number, subject, due_date, ball_in_court')
          .eq('project_id', projectId)
          .neq('status', 'closed')
          .not('due_date', 'is', null)
          .order('due_date', { ascending: true })
          .limit(20)
        openRfisWithDates = (data ?? []) as typeof openRfisWithDates
      } catch { /* non-fatal */ }
    }

    const dynamicInsights: AIInsight[] = []

    if (overdueRfis.length > 0) {
      const count = overdueRfis.length
      const mostOverdue = overdueRfis[0]
      const rfiLabel = mostOverdue.rfi_number ? `RFI ${mostOverdue.rfi_number}` : 'an RFI'
      const daysPast = mostOverdue.due_date
        ? Math.ceil((Date.now() - new Date(mostOverdue.due_date).getTime()) / (1000 * 60 * 60 * 24))
        : 0
      const bicNote = mostOverdue.ball_in_court ? ` Ball in court: ${mostOverdue.ball_in_court}.` : ''
      dynamicInsights.push({
        id: 'computed-rfi-overdue',
        type: 'risk',
        severity: count > 5 ? 'critical' : count > 2 ? 'warning' : 'info',
        title: `${count} overdue RFI${count === 1 ? '' : 's'}. ${rfiLabel} is ${daysPast} day${daysPast === 1 ? '' : 's'} past due`,
        description: mostOverdue.subject
          ? `"${mostOverdue.subject}" is the most overdue.${bicNote} Unresolved RFIs can block field work and push the schedule.`
          : `${count} open RFI${count === 1 ? '' : 's'} passed their due date.${bicNote} Review and respond immediately.`,
        affectedEntities: overdueRfis.map((r) => ({ type: 'rfi', id: r.id, name: r.rfi_number ? `RFI ${r.rfi_number}` : r.id })),
        suggestedAction: 'Open RFIs to review overdue items',
        confidence: 0.9,
        source: 'computed' as const,
        createdAt: now,
        generatedAt: now,
        dismissed: false,
      })
    }

    if (atRiskPhases.length > 0) {
      const phaseNames = atRiskPhases.map((p) => p.name ?? 'Unnamed phase').join(', ')
      dynamicInsights.push({
        id: 'computed-schedule-risk',
        type: 'schedule_risk',
        severity: atRiskPhases.some((p) => p.status === 'delayed') ? 'critical' : 'warning',
        title: `${atRiskPhases.length} schedule phase${atRiskPhases.length === 1 ? ' is' : 's are'} at risk or delayed`,
        description: `${phaseNames}. Delayed phases cascade into downstream trades and may push the completion date.`,
        affectedEntities: atRiskPhases.map((p) => ({ type: 'schedule_phase', id: p.id, name: p.name ?? 'Phase' })),
        suggestedAction: 'Open Schedule to review impacted phases',
        confidence: 0.85,
        source: 'computed' as const,
        createdAt: now,
        generatedAt: now,
        dismissed: false,
      })
    }

    if (openPunchCount > 0) {
      dynamicInsights.push({
        id: 'computed-punch-open',
        type: 'action_needed',
        severity: openPunchCount > 10 ? 'critical' : openPunchCount > 5 ? 'warning' : 'info',
        title: `${openPunchCount} open punch list item${openPunchCount === 1 ? '' : 's'} require resolution`,
        description: `${openPunchCount} punch list item${openPunchCount === 1 ? '' : 's'} remain open. Clearing these is required before substantial completion and closeout.`,
        affectedEntities: [],
        suggestedAction: 'Open Punch List to review open items',
        confidence: 0.85,
        source: 'computed' as const,
        createdAt: now,
        generatedAt: now,
        dismissed: false,
      })
    }

    if (overBudgetItems.length > 0) {
      const count = overBudgetItems.length
      const worst = overBudgetItems.sort((a, b) => (b.spent_to_date - b.current_budget) - (a.spent_to_date - a.current_budget))[0]
      const overrun = worst ? worst.spent_to_date - worst.current_budget : 0
      const worstLabel = worst?.description ?? worst?.division ?? 'a line item'
      dynamicInsights.push({
        id: 'computed-budget-overrun',
        type: 'budget_risk',
        severity: count > 5 ? 'critical' : count > 2 ? 'warning' : 'info',
        title: `${count} budget line${count === 1 ? '' : 's'} over budget. ${worstLabel} is $${Math.round(overrun).toLocaleString()} over`,
        description: `${count} cost code${count === 1 ? '' : 's'} show spending above the current budget. Review cost exposure and issue change orders if needed.`,
        affectedEntities: overBudgetItems.slice(0, 3).map((b) => ({ type: 'budget_item', id: b.id, name: b.description ?? b.division ?? b.id })),
        suggestedAction: 'Open Budget to review cost variance',
        confidence: 0.85,
        source: 'computed' as const,
        createdAt: now,
        generatedAt: now,
        dismissed: false,
      })
    }

    if (pendingSubmittals.length > 0) {
      const count = pendingSubmittals.length
      const first = pendingSubmittals[0]
      const firstLabel = first.number ? `Submittal ${first.number}` : (first.title ?? 'a submittal')
      dynamicInsights.push({
        id: 'computed-submittals-pending',
        type: 'action_needed',
        severity: count > 10 ? 'critical' : count > 5 ? 'warning' : 'info',
        title: `${count} pending submittal${count === 1 ? '' : 's'} awaiting review`,
        description: `${firstLabel}${count > 1 ? ` and ${count - 1} other${count - 1 === 1 ? '' : 's'}` : ''} awaiting review or approval. Delays in submittal review can hold up material procurement and field work.`,
        affectedEntities: pendingSubmittals.map((s) => ({ type: 'submittal', id: s.id, name: s.number ? `Submittal ${s.number}` : (s.title ?? s.id) })),
        suggestedAction: 'Open Submittals to review pending items',
        confidence: 0.85,
        source: 'computed' as const,
        createdAt: now,
        generatedAt: now,
        dismissed: false,
      })
    }

    // Cross-entity: find RFI due dates that fall near upcoming phase start dates
    if (openRfisWithDates.length > 0 && upcomingPhases.length > 0) {
      for (const phase of upcomingPhases) {
        if (!phase.start_date) continue
        const phaseStart = new Date(phase.start_date).getTime()
        const phaseName = phase.name ?? 'Upcoming phase'

        for (const rfi of openRfisWithDates) {
          if (!rfi.due_date) continue
          const rfiDue = new Date(rfi.due_date).getTime()
          const daysBetween = Math.ceil((phaseStart - rfiDue) / (1000 * 60 * 60 * 24))

          // RFI due date falls within 5 days before the phase start (or is already past due)
          if (daysBetween >= -7 && daysBetween <= 5) {
            const rfiLabel = rfi.rfi_number ? `RFI ${rfi.rfi_number}` : 'An open RFI'
            const bicNote = rfi.ball_in_court ? ` Ball in court: ${rfi.ball_in_court}.` : ''
            const urgency = daysBetween <= 0
              ? `${rfiLabel} response is past due and ${phaseName} start date is imminent`
              : `${rfiLabel} response deadline is ${daysBetween} day${daysBetween === 1 ? '' : 's'} before ${phaseName} starts`

            dynamicInsights.push({
              id: `computed-conflict-rfi-phase-${rfi.id}-${phase.id}`,
              type: 'risk',
              severity: daysBetween <= 0 ? 'critical' : 'warning',
              title: urgency,
              description: `${rfi.subject ? `"${rfi.subject}" ` : ''}needs resolution before ${phaseName} can proceed.${bicNote} If the response slips, ${phaseName} is at risk of delay.`,
              affectedEntities: [
                { type: 'rfi', id: rfi.id, name: rfiLabel },
                { type: 'schedule_phase', id: phase.id, name: phaseName },
              ],
              suggestedAction: `Escalate ${rfiLabel} to unblock ${phaseName}`,
              confidence: 0.9,
              source: 'computed' as const,
              createdAt: now,
              generatedAt: now,
              dismissed: false,
            })
            break // One conflict per phase is enough
          }
        }
        if (dynamicInsights.filter((i) => i.id.startsWith('computed-conflict-')).length >= 2) break
      }
    }

    // Cross-entity: submittals with approaching required onsite date still pending approval
    let urgentSubmittals: Array<{ id: string; number: string | null; title: string | null; required_onsite_date: string; status: string; lead_time_weeks: number | null }> = []
    try {
      const twentyOneDaysOut = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('submittals')
        .select('id, number, title, required_onsite_date, status, lead_time_weeks')
        .eq('project_id', projectId)
        .in('status', ['pending', 'submitted', 'in_review'])
        .not('required_onsite_date', 'is', null)
        .lte('required_onsite_date', twentyOneDaysOut)
        .gte('required_onsite_date', now)
        .order('required_onsite_date', { ascending: true })
        .limit(5)
      urgentSubmittals = (data ?? []) as typeof urgentSubmittals
    } catch { /* non-fatal */ }

    for (const sub of urgentSubmittals.slice(0, 2)) {
      const submittalLabel = sub.number ? `Submittal ${sub.number}` : (sub.title ?? 'A pending submittal')
      const daysUntilNeeded = Math.ceil((new Date(sub.required_onsite_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      const leadWeeks = sub.lead_time_weeks ?? 0
      const statusLabel = sub.status === 'in_review' ? 'in review' : 'pending approval'

      // Match against upcoming phases starting near the required onsite date
      const matchingPhase = upcomingPhases.find((p) => {
        if (!p.start_date) return false
        const phaseStart = new Date(p.start_date).getTime()
        const onsiteDate = new Date(sub.required_onsite_date).getTime()
        return Math.abs(phaseStart - onsiteDate) <= 7 * 24 * 60 * 60 * 1000
      })
      const phaseName = matchingPhase?.name
      const phaseContext = phaseName ? ` ${phaseName} may be impacted.` : ''

      dynamicInsights.push({
        id: `computed-conflict-submittal-schedule-${sub.id}`,
        type: 'risk',
        severity: daysUntilNeeded <= 7 ? 'critical' : 'warning',
        title: `${submittalLabel} needed onsite in ${daysUntilNeeded} day${daysUntilNeeded === 1 ? '' : 's'} but still ${statusLabel}`,
        description: `${sub.title ? `"${sub.title}" ` : ''}must be approved and materials procured${leadWeeks > 0 ? ` (${leadWeeks} week lead time)` : ''} before the required onsite date.${phaseContext} Delays in submittal approval cascade into material procurement and field work.`,
        affectedEntities: [
          { type: 'submittal', id: sub.id, name: submittalLabel },
          ...(matchingPhase ? [{ type: 'schedule_phase', id: matchingPhase.id, name: phaseName! }] : []),
        ],
        suggestedAction: `Review and approve ${submittalLabel} immediately`,
        confidence: 0.9,
        source: 'computed' as const,
        createdAt: now,
        generatedAt: now,
        dismissed: false,
      })
    }

    // Budget trajectory: flag if total overrun exceeds 5% of total budget
    if (overBudgetItems.length > 0) {
      try {
        const { data: allBudgetRows } = await supabase
          .from('budget_line_items')
          .select('spent_to_date, current_budget')
          .eq('project_id', projectId)
        if (allBudgetRows && allBudgetRows.length > 0) {
          const typedRows = allBudgetRows as Array<{ spent_to_date: number; current_budget: number }>
          const totalBudget = typedRows.reduce((s, r) => s + (r.current_budget ?? 0), 0)
          const totalSpent = typedRows.reduce((s, r) => s + (r.spent_to_date ?? 0), 0)
          const totalOverrun = totalSpent - totalBudget
          const overrunPct = totalBudget > 0 ? (totalOverrun / totalBudget) * 100 : 0

          if (totalOverrun > 0 && overrunPct > 2) {
            dynamicInsights.push({
              id: 'computed-budget-trajectory',
              type: 'budget_risk',
              severity: overrunPct > 10 ? 'critical' : overrunPct > 5 ? 'warning' : 'info',
              title: `Project spending exceeds budget by $${Math.round(totalOverrun).toLocaleString()} (${overrunPct.toFixed(1)}%)`,
              description: `Total spend to date is $${Math.round(totalSpent).toLocaleString()} against a $${Math.round(totalBudget).toLocaleString()} budget across ${typedRows.length} line items. ${overBudgetItems.length} division${overBudgetItems.length === 1 ? ' is' : 's are'} individually over budget. Review cost exposure and consider change order recovery.`,
              affectedEntities: overBudgetItems.slice(0, 3).map((b) => ({ type: 'budget_item', id: b.id, name: b.description ?? b.division ?? b.id })),
              suggestedAction: 'Open Budget to review cost trajectory and change order exposure',
              confidence: 0.9,
              source: 'computed' as const,
              createdAt: now,
              generatedAt: now,
              dismissed: false,
            })
          }
        }
      } catch { /* non-fatal */ }
    }

    if (dynamicInsights.length > 0) {
      return {
        insights: dynamicInsights,
        dataSource: 'computed' as const,
      }
    }

    const starterInsights: AIInsight[] = [
      {
        id: 'fallback-1',
        type: 'onboarding',
        severity: 'info',
        title: 'Connect your schedule data to enable AI delay predictions',
        description: 'Add schedule phases so the AI can identify critical path risks and forecast delays before they happen.',
        affectedEntities: [],
        suggestedAction: 'Navigate to Schedule to add project phases',
        confidence: 0,
        isPlaceholder: true,
        source: 'onboarding' as const,
        createdAt: now,
        generatedAt: now,
        expiresAt: null,
        dismissed: false,
      },
      {
        id: 'fallback-2',
        type: 'onboarding',
        severity: 'info',
        title: 'Add budget line items to unlock cost variance analysis',
        description: 'Enter contract values and cost codes so the AI can surface variance alerts and cost forecasting.',
        affectedEntities: [],
        suggestedAction: 'Navigate to Budget to set up cost divisions',
        confidence: 0,
        isPlaceholder: true,
        source: 'onboarding' as const,
        createdAt: now,
        generatedAt: now,
        expiresAt: null,
        dismissed: false,
      },
      {
        id: 'fallback-3',
        type: 'onboarding',
        severity: 'info',
        title: 'Create daily logs to power AI field summaries',
        description: 'Daily log entries give the AI the field data it needs to generate progress summaries and flag productivity trends.',
        affectedEntities: [],
        suggestedAction: 'Navigate to Daily Log to add your first entry',
        confidence: 0,
        isPlaceholder: true,
        source: 'onboarding' as const,
        createdAt: now,
        generatedAt: now,
        expiresAt: null,
        dismissed: false,
      },
    ]
    return {
      insights: starterInsights,
      dataSource: aiServiceFailed ? 'ai-degraded' as const : 'ai-fallback' as const,
      ...(aiServiceFailed && { degraded: true, degradedReason: aiErrorType }),
    }
  }

  return {
    insights: [...cachedInsights, ...budgetInsights],
    dataSource: aiServiceFailed ? 'ai-degraded' as const : 'ai-cached' as const,
    lastFallbackAt: new Date().toISOString(),
    ...(aiServiceFailed && { degraded: true, degradedReason: aiErrorType }),
  }
}

export const getAiInsightsMeta = async (
  projectId: string
): Promise<{ live: boolean; lastUpdated: string }> => {
  validateProjectId(projectId)
  const live = aiService.isConfigured()
  const { data } = await supabase
    .from('ai_insights')
    .select('created_at')
    .eq('project_id', projectId)
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return {
    live,
    lastUpdated: data?.created_at ?? new Date().toISOString(),
  }
}

export const getAiConversation = async (_projectId: string): Promise<[]> => {
  // Conversations are managed client-side by useProjectAI
  return []
}

export const getVisionContent = async (_projectId: string): Promise<null> => {
  // Vision page uses static content
  return null
}
