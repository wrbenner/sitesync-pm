import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  handleCors,
  getCorsHeaders,
  authenticateRequest,
  verifyProjectMembership,
  requireMinimumRole,
  requireUuid,
  parseJsonBody,
  errorResponse,
  HttpError,
} from '../shared/auth.ts'

// ── Constants ────────────────────────────────────────────

const VALID_AGENT_TYPES = new Set([
  'rfi_router', 'schedule_predictor', 'cost_forecaster', 'safety_monitor',
  'daily_log_analyzer', 'drawing_analyzer', 'document_classifier', 'submittal_prefiller',
])

const MAX_RUNS_PER_HOUR = 10

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const cors = getCorsHeaders(req)

  try {
    // SECURITY: Authenticate user (no more service role key)
    const { user, supabase } = await authenticateRequest(req)

    const body = await parseJsonBody<{
      agent_type: string
      project_id: string
      trigger?: string
    }>(req)

    const { agent_type, trigger = 'manual' } = body
    const projectId = requireUuid(body.project_id, 'project_id')

    // Validate agent type
    if (!VALID_AGENT_TYPES.has(agent_type)) {
      throw new HttpError(400, `Invalid agent type: ${agent_type}`)
    }

    // Verify project membership with minimum PM role (agents are powerful)
    const userRole = await verifyProjectMembership(supabase, user.id, projectId)
    requireMinimumRole(userRole, 'project_manager', 'run AI agents')

    // Rate limiting: max runs per hour per user per project
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
    const { count } = await supabase
      .from('ai_agent_actions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .gte('created_at', oneHourAgo)
    if ((count ?? 0) > MAX_RUNS_PER_HOUR * 20) { // ~20 actions per run * 10 runs
      throw new HttpError(429, 'Agent rate limit exceeded. Try again in an hour.')
    }

    // Get agent config
    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('project_id', projectId)
      .eq('agent_type', agent_type)
      .single()
    if (agentError || !agent) throw new HttpError(404, `Agent ${agent_type} not found for this project`)
    if (agent.status !== 'active') throw new HttpError(400, `Agent ${agent_type} is not active`)

    const actions: Array<Record<string, unknown>> = []

    // Execute agent logic
    switch (agent_type) {
      case 'rfi_router': {
        const { data: rfis } = await supabase
          .from('rfis')
          .select('id, title, rfi_number, status, due_date, assigned_to, created_at')
          .eq('project_id', projectId)
          .in('status', ['open', 'under_review'])

        const now = new Date()
        for (const rfi of (rfis || [])) {
          if (!rfi.due_date) continue
          const daysOverdue = Math.floor((now.getTime() - new Date(rfi.due_date).getTime()) / 86400000)

          if (daysOverdue >= 14) {
            actions.push({
              action_type: 'escalate_critical',
              description: `RFI #${rfi.rfi_number} "${rfi.title}" is ${daysOverdue} days overdue. Critical escalation recommended.`,
              confidence: 0.95,
              input_data: { rfi_id: rfi.id, days_overdue: daysOverdue },
              output_data: { action: 'notify_admin', severity: 'critical' },
            })
          } else if (daysOverdue >= 7) {
            actions.push({
              action_type: 'escalate_pm',
              description: `RFI #${rfi.rfi_number} "${rfi.title}" is ${daysOverdue} days overdue. PM escalation recommended.`,
              confidence: 0.90,
              input_data: { rfi_id: rfi.id, days_overdue: daysOverdue },
              output_data: { action: 'notify_pm', severity: 'warning' },
            })
          } else if (daysOverdue >= 3) {
            actions.push({
              action_type: 'send_reminder',
              description: `RFI #${rfi.rfi_number} "${rfi.title}" is ${daysOverdue} days overdue. Reminder to assignee.`,
              confidence: 0.85,
              input_data: { rfi_id: rfi.id, days_overdue: daysOverdue },
              output_data: { action: 'send_reminder' },
            })
          }
        }
        break
      }

      case 'schedule_predictor': {
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, title, status, due_date, percent_complete, is_critical_path')
          .eq('project_id', projectId)
          .neq('status', 'done')

        for (const task of (tasks || [])) {
          if (!task.due_date) continue
          const daysUntilDue = Math.floor((new Date(task.due_date).getTime() - Date.now()) / 86400000)
          const progress = task.percent_complete || 0

          if (daysUntilDue < 7 && progress < 50) {
            actions.push({
              action_type: 'schedule_risk',
              description: `Task "${task.title}" is ${progress}% complete with only ${daysUntilDue} days remaining.${task.is_critical_path ? ' Critical path item.' : ''}`,
              confidence: task.is_critical_path ? 0.95 : 0.80,
              input_data: { task_id: task.id, progress, days_remaining: daysUntilDue },
              output_data: { risk_level: task.is_critical_path ? 'critical' : 'warning' },
            })
          }
        }
        break
      }

      case 'cost_forecaster': {
        const { data: budget } = await supabase
          .from('budget_items')
          .select('id, division, original_amount, actual_amount, percent_complete')
          .eq('project_id', projectId)

        for (const item of (budget || [])) {
          const budgeted = item.original_amount || 0
          const spent = item.actual_amount || 0
          const progress = (item.percent_complete || 0) / 100
          if (budgeted === 0) continue

          const spendRate = spent / budgeted
          if (spendRate > progress + 0.10 && spendRate > 0.5) {
            const projectedOverrun = Math.round((spendRate / Math.max(progress, 0.01)) * budgeted - budgeted)
            actions.push({
              action_type: 'budget_warning',
              description: `${item.division}: ${Math.round(spendRate * 100)}% of budget spent at ${Math.round(progress * 100)}% complete. Projected overrun: $${projectedOverrun.toLocaleString()}.`,
              confidence: 0.85,
              input_data: { budget_item_id: item.id, spend_rate: spendRate, progress },
              output_data: { projected_overrun: projectedOverrun },
            })
          }
        }
        break
      }

      case 'safety_monitor': {
        const { data: incidents } = await supabase
          .from('incidents')
          .select('id, type, severity, date')
          .eq('project_id', projectId)
          .gte('date', new Date(Date.now() - 30 * 86400000).toISOString())

        const nearMisses = (incidents || []).filter(i => i.type === 'near_miss')
        if (nearMisses.length >= 3) {
          actions.push({
            action_type: 'safety_alert',
            description: `${nearMisses.length} near misses in 30 days. Safety stand down recommended.`,
            confidence: 0.90,
            input_data: { near_miss_count: nearMisses.length },
            output_data: { recommended_action: 'safety_stand_down' },
          })
        }
        break
      }

      default: {
        actions.push({
          action_type: 'status_report',
          description: `${agent_type.replace(/_/g, ' ')} agent executed. No items require attention.`,
          confidence: 1.0,
          input_data: { trigger },
          output_data: { status: 'no_action_needed' },
        })
      }
    }

    // SECURITY FIX: ALL actions go to pending_review. NEVER auto-execute.
    // In construction, mistakes cost millions. Human-in-the-loop is mandatory.
    if (actions.length > 0) {
      // Write audit trail BEFORE saving actions
      await supabase.from('audit_trail').insert({
        project_id: projectId,
        actor_id: user.id,
        action: `agent_run_${agent_type}`,
        entity_type: 'ai_agent',
        entity_id: agent.id,
        new_value: { actions_count: actions.length, trigger },
        user_agent: req.headers.get('User-Agent') || '',
      })

      const actionRecords = actions.map(a => ({
        agent_id: agent.id,
        project_id: projectId,
        action_type: a.action_type,
        description: a.description,
        confidence: a.confidence,
        input_data: a.input_data,
        output_data: a.output_data,
        status: 'pending_review', // ALWAYS pending. Never auto_applied.
      }))

      await supabase.from('ai_agent_actions').insert(actionRecords)
    }

    // Update agent metadata
    await supabase.from('ai_agents').update({
      last_run: new Date().toISOString(),
      actions_taken: (agent.actions_taken || 0) + actions.length,
    }).eq('id', agent.id)

    return new Response(
      JSON.stringify({ agent_type, actions_created: actions.length, trigger }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return errorResponse(error, cors)
  }
})
