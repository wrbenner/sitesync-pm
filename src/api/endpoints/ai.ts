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
          .catch((err) => {
            if (import.meta.env.DEV) console.error('[AI Endpoint] generateBudgetInsights failed:', err instanceof Error ? err.message : err)
            captureException(err instanceof Error ? err : new Error(String(err)), {
              projectId,
              extra: { context: 'getAiInsights_generateBudgetInsights' },
            })
            return []
          })
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
  } catch (err) {
    if (import.meta.env.DEV) console.error('[AI Endpoint] ai_insights cache lookup failed:', err instanceof Error ? err.message : err)
    captureException(err instanceof Error ? err : new Error(String(err)), {
      projectId,
      extra: { context: 'getAiInsights_cacheLookup' },
    })
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
    let overdueRfis: Array<{ id: string; number: number | null; title: string | null; due_date: string | null; ball_in_court: string | null }> = []
    let openPunchCount = 0
    let overBudgetItems: Array<{ id: string; description: string | null; division: string | null; actual_cost: number; revised_budget: number }> = []
    let pendingSubmittals: Array<{ id: string; number: string | null; title: string | null }> = []
    let atRiskPhases: Array<{ id: string; name: string | null; status: string | null }> = []

    try {
      const { data } = await supabase
        .from('rfis')
        .select('id, number, title, due_date, ball_in_court')
        .eq('project_id', projectId)
        .neq('status', 'closed')
        .lt('due_date', now)
        .order('due_date', { ascending: true })
        .limit(5)
      overdueRfis = (data ?? []) as typeof overdueRfis
    } catch (err) {
      if (import.meta.env.DEV) console.error('[AI Endpoint] overdueRfis query failed:', err instanceof Error ? err.message : err)
      captureException(err instanceof Error ? err : new Error(String(err)), {
        projectId,
        extra: { context: 'getAiInsights_overdueRfis' },
      })
    }

    try {
      const { count } = await supabase
        .from('punch_items')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .in('status', ['open', 'in_progress'])
      openPunchCount = count ?? 0
    } catch (err) {
      if (import.meta.env.DEV) console.error('[AI Endpoint] openPunchCount query failed:', err instanceof Error ? err.message : err)
      captureException(err instanceof Error ? err : new Error(String(err)), {
        projectId,
        extra: { context: 'getAiInsights_openPunchCount' },
      })
    }

    try {
      const { data: budgetRows } = await supabase
        .from('budget_line_items')
        .select('id, description, csi_code, actual_cost, revised_budget')
        .eq('project_id', projectId)
      overBudgetItems = ((budgetRows ?? []) as Array<{ id: string; description: string | null; csi_code: string | null; actual_cost: number; revised_budget: number }>).filter(
        (row) => (row.actual_cost ?? 0) > (row.revised_budget ?? 0) && (row.revised_budget ?? 0) > 0
      ).map(row => ({ id: row.id, description: row.description, division: row.csi_code, actual_cost: row.actual_cost, revised_budget: row.revised_budget }))
    } catch (err) {
      if (import.meta.env.DEV) console.error('[AI Endpoint] overBudgetItems query failed:', err instanceof Error ? err.message : err)
      captureException(err instanceof Error ? err : new Error(String(err)), {
        projectId,
        extra: { context: 'getAiInsights_overBudgetItems' },
      })
    }

    try {
      const { data } = await supabase
        .from('submittals')
        .select('id, number, title')
        .eq('project_id', projectId)
        .eq('status', 'pending')
        .limit(5)
      pendingSubmittals = (data ?? []) as typeof pendingSubmittals
    } catch (err) {
      if (import.meta.env.DEV) console.error('[AI Endpoint] pendingSubmittals query failed:', err instanceof Error ? err.message : err)
      captureException(err instanceof Error ? err : new Error(String(err)), {
        projectId,
        extra: { context: 'getAiInsights_pendingSubmittals' },
      })
    }

    try {
      const { data } = await supabase
        .from('schedule_phases')
        .select('id, name, status')
        .eq('project_id', projectId)
        .in('status', ['delayed', 'at_risk'])
        .limit(3)
      atRiskPhases = (data ?? []) as typeof atRiskPhases
    } catch (err) {
      if (import.meta.env.DEV) console.error('[AI Endpoint] atRiskPhases query failed:', err instanceof Error ? err.message : err)
      captureException(err instanceof Error ? err : new Error(String(err)), {
        projectId,
        extra: { context: 'getAiInsights_atRiskPhases' },
      })
    }

    // Cross-entity conflict detection: RFIs blocking upcoming schedule phases
    let upcomingPhases: Array<{ id: string; name: string | null; start_date: string | null; status: string | null }> = []
    let openRfisWithDates: Array<{ id: string; number: number | null; title: string | null; due_date: string | null; ball_in_court: string | null }> = []
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
    } catch (err) {
      if (import.meta.env.DEV) console.error('[AI Endpoint] upcomingPhases query failed:', err instanceof Error ? err.message : err)
      captureException(err instanceof Error ? err : new Error(String(err)), {
        projectId,
        extra: { context: 'getAiInsights_upcomingPhases' },
      })
    }

    if (upcomingPhases.length > 0) {
      try {
        const { data } = await supabase
          .from('rfis')
          .select('id, number, title, due_date, ball_in_court')
          .eq('project_id', projectId)
          .neq('status', 'closed')
          .not('due_date', 'is', null)
          .order('due_date', { ascending: true })
          .limit(20)
        openRfisWithDates = (data ?? []) as typeof openRfisWithDates
      } catch (err) {
        if (import.meta.env.DEV) console.error('[AI Endpoint] openRfisWithDates query failed:', err instanceof Error ? err.message : err)
        captureException(err instanceof Error ? err : new Error(String(err)), {
          projectId,
          extra: { context: 'getAiInsights_openRfisWithDates' },
        })
      }
    }

    const dynamicInsights: AIInsight[] = []

    if (overdueRfis.length > 0) {
      const count = overdueRfis.length
      const mostOverdue = overdueRfis[0]
      const rfiLabel = mostOverdue.number ? `RFI ${mostOverdue.number}` : 'an RFI'
      const daysPast = mostOverdue.due_date
        ? Math.ceil((Date.now() - new Date(mostOverdue.due_date).getTime()) / (1000 * 60 * 60 * 24))
        : 0
      const bicNote = mostOverdue.ball_in_court ? ` Ball in court: ${mostOverdue.ball_in_court}.` : ''
      dynamicInsights.push({
        id: 'computed-rfi-overdue',
        type: 'risk',
        severity: count > 5 ? 'critical' : count > 2 ? 'warning' : 'info',
        title: `${count} overdue RFI${count === 1 ? '' : 's'}. ${rfiLabel} is ${daysPast} day${daysPast === 1 ? '' : 's'} past due`,
        description: mostOverdue.title
          ? `"${mostOverdue.title}" is the most overdue.${bicNote} Unresolved RFIs can block field work and push the schedule.`
          : `${count} open RFI${count === 1 ? '' : 's'} passed their due date.${bicNote} Review and respond immediately.`,
        affectedEntities: overdueRfis.map((r) => ({ type: 'rfi', id: r.id, name: r.number ? `RFI ${r.number}` : r.id })),
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
      const worst = overBudgetItems.sort((a, b) => (b.actual_cost - b.revised_budget) - (a.actual_cost - a.revised_budget))[0]
      const overrun = worst ? worst.actual_cost - worst.revised_budget : 0
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
            const rfiLabel = rfi.number ? `RFI ${rfi.number}` : 'An open RFI'
            const bicNote = rfi.ball_in_court ? ` Ball in court: ${rfi.ball_in_court}.` : ''
            const urgency = daysBetween <= 0
              ? `${rfiLabel} response is past due and ${phaseName} start date is imminent`
              : `${rfiLabel} response deadline is ${daysBetween} day${daysBetween === 1 ? '' : 's'} before ${phaseName} starts`

            dynamicInsights.push({
              id: `computed-conflict-rfi-phase-${rfi.id}-${phase.id}`,
              type: 'risk',
              severity: daysBetween <= 0 ? 'critical' : 'warning',
              title: urgency,
              description: `${rfi.title ? `"${rfi.title}" ` : ''}needs resolution before ${phaseName} can proceed.${bicNote} If the response slips, ${phaseName} is at risk of delay.`,
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

export const getAiConversation = async (): Promise<[]> => {
  // Conversations are managed client-side by useProjectAI
  return []
}

export const getVisionContent = async (): Promise<null> => {
  // Vision page uses static content
  return null
}
