import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // SECURITY: This function is CRON-only. Reject calls without the scheduler header.
    const authHeader = req.headers.get('Authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized: CRON-only endpoint' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { project_id } = await req.json()

    // Validate project_id is a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!project_id || !uuidRegex.test(project_id)) {
      return new Response(JSON.stringify({ error: 'Invalid project_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch project data for analysis
    const [
      { data: phases },
      { data: budgetItems },
      { data: rfis },
      { data: punchItems },
      { data: crews },
    ] = await Promise.all([
      supabase.from('schedule_phases').select('*').eq('project_id', project_id),
      supabase.from('budget_items').select('*').eq('project_id', project_id),
      supabase.from('rfis').select('*').eq('project_id', project_id),
      supabase.from('punch_items').select('*').eq('project_id', project_id),
      supabase.from('crews').select('*').eq('project_id', project_id),
    ])

    const insights: Array<{
      project_id: string
      page: string
      severity: string
      message: string
      expanded_content: string
      action_label: string
      action_link: string
    }> = []

    // Schedule analysis
    const behindPhases = (phases || []).filter(p => p.status === 'delayed' || p.status === 'at_risk')
    if (behindPhases.length > 0) {
      insights.push({
        project_id,
        page: 'schedule',
        severity: behindPhases.some(p => p.is_critical_path) ? 'critical' : 'warning',
        message: `${behindPhases.length} schedule phase${behindPhases.length > 1 ? 's' : ''} at risk or delayed`,
        expanded_content: `Phases affected: ${behindPhases.map(p => p.name).join(', ')}. Review dependencies and consider resource reallocation.`,
        action_label: 'Review Schedule',
        action_link: '/schedule',
      })
    }

    // Budget analysis
    const overBudgetDivisions = (budgetItems || []).filter(b => {
      const pct = b.original_amount ? (b.actual_amount || 0) / b.original_amount * 100 : 0
      return pct > 90
    })
    if (overBudgetDivisions.length > 0) {
      insights.push({
        project_id,
        page: 'budget',
        severity: overBudgetDivisions.some(b => ((b.actual_amount || 0) / (b.original_amount || 1)) > 1) ? 'critical' : 'warning',
        message: `${overBudgetDivisions.length} budget division${overBudgetDivisions.length > 1 ? 's' : ''} above 90% spend`,
        expanded_content: `Divisions: ${overBudgetDivisions.map(b => b.division).join(', ')}. Review committed costs and forecast.`,
        action_label: 'Review Budget',
        action_link: '/budget',
      })
    }

    // RFI analysis
    const overdueRfis = (rfis || []).filter(r => r.status === 'open' && r.due_date && new Date(r.due_date) < new Date())
    if (overdueRfis.length > 0) {
      insights.push({
        project_id,
        page: 'rfis',
        severity: overdueRfis.length > 3 ? 'critical' : 'warning',
        message: `${overdueRfis.length} overdue RFI${overdueRfis.length > 1 ? 's' : ''} need attention`,
        expanded_content: `Overdue items may be blocking field work. Prioritize responses to prevent schedule impact.`,
        action_label: 'View Overdue RFIs',
        action_link: '/rfis',
      })
    }

    // Punch list analysis
    const openPunch = (punchItems || []).filter(p => p.status === 'open')
    if (openPunch.length > 15) {
      insights.push({
        project_id,
        page: 'punchlist',
        severity: 'warning',
        message: `${openPunch.length} open punch items. Trending higher than normal.`,
        expanded_content: `High open punch count may indicate quality issues. Review by trade and area for patterns.`,
        action_label: 'Review Punch List',
        action_link: '/punch-list',
      })
    }

    // Crew analysis
    const behindCrews = (crews || []).filter(c => c.status === 'behind')
    if (behindCrews.length > 0) {
      insights.push({
        project_id,
        page: 'crews',
        severity: 'warning',
        message: `${behindCrews.length} crew${behindCrews.length > 1 ? 's' : ''} falling behind schedule`,
        expanded_content: `Crews: ${behindCrews.map(c => c.name).join(', ')}. Consider overtime or additional resources.`,
        action_label: 'View Crews',
        action_link: '/crews',
      })
    }

    // Clear old non-dismissed insights and insert new ones
    if (insights.length > 0) {
      await supabase.from('ai_insights').delete().eq('project_id', project_id).eq('dismissed', false)
      await supabase.from('ai_insights').insert(insights)
    }

    return new Response(
      JSON.stringify({ generated: insights.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
