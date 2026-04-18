import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
  verifyProjectMembership,
  requireUuid,
} from '../shared/auth.ts'

interface ConflictItem {
  type: string
  severity: 'critical' | 'major' | 'minor'
  description: string
  affected_items: string[]
  recommendation: string
}

interface ConflictResponse {
  conflicts: ConflictItem[]
}

interface ConflictRequest {
  project_id: string
}

serve(async (req) => {
  const corsCheck = handleCors(req)
  if (corsCheck) return corsCheck

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<ConflictRequest>(req)

    const projectId = requireUuid(body.project_id, 'project_id')

    await verifyProjectMembership(supabase, user.id, projectId)

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      throw new HttpError(500, 'ANTHROPIC_API_KEY not configured')
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const [
      { data: schedulePhases },
      { data: submittals },
      { data: weatherData },
      { data: openRfis },
      { data: projectInfo },
    ] = await Promise.all([
      adminClient
        .from('schedule_phases')
        .select('id, name, scheduled_start, scheduled_end, is_critical_path, status')
        .eq('project_id', projectId)
        .order('scheduled_start', { ascending: true }),
      adminClient
        .from('submittals')
        .select('id, spec_section, name, due_date, submission_date, approval_date')
        .eq('project_id', projectId)
        .order('due_date', { ascending: true }),
      adminClient
        .from('weather_cache')
        .select('forecast_data')
        .eq('project_id', projectId)
        .order('cached_at', { ascending: false })
        .limit(1)
        .single(),
      adminClient
        .from('rfis')
        .select('id, subject, affected_phases, due_date')
        .eq('project_id', projectId)
        .eq('status', 'open'),
      adminClient.from('projects').select('name, start_date').eq('id', projectId).single(),
    ])

    if (!schedulePhases || schedulePhases.length === 0) {
      throw new HttpError(404, 'No schedule found for conflict analysis')
    }

    const contextParts: string[] = []

    contextParts.push(`Project: ${projectInfo?.name || 'Unknown'}`)
    contextParts.push(`Schedule Phases: ${schedulePhases.length} activities`)

    if (submittals && submittals.length > 0) {
      const submittalText = submittals
        .slice(0, 10)
        .map((s) => `${s.name} (due ${s.due_date})`)
        .join(', ')
      contextParts.push(`Key Submittals: ${submittalText}`)
    }

    if (weatherData?.forecast_data) {
      contextParts.push(`Weather Data: ${JSON.stringify(weatherData.forecast_data).substring(0, 200)}`)
    }

    if (openRfis && openRfis.length > 0) {
      const rfiText = openRfis.slice(0, 5).map((r) => r.subject).join(', ')
      contextParts.push(`Open RFIs: ${rfiText}`)
    }

    const prompt = `You are a construction conflict resolution expert. Analyze this project for scheduling conflicts and dependencies that could impact delivery.

Check for:
1. Submittal lead time conflicts: submittals due too close to when materials are needed
2. Schedule vs weather conflicts: critical path activities during severe weather forecasts
3. RFI response conflicts: open RFIs affecting critical activities with approaching deadlines
4. Dependency conflicts: activities with unclear or conflicting logic

${contextParts.join('\n')}

Return a JSON array of conflicts:
[
  {
    "type": "submittal_lead_time|weather_conflict|rfi_dependency|critical_path_at_risk",
    "severity": "critical|major|minor",
    "description": "What the conflict is",
    "affected_items": ["Activity Name", "Submittal Name", ...],
    "recommendation": "Specific action to resolve"
  }
]

Only include genuine conflicts where timeline or dependency issues exist. Empty array if no conflicts found.`

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages/create', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    if (!anthropicResponse.ok) {
      const error = await anthropicResponse.text()
      console.error('Anthropic API error:', error)
      throw new HttpError(500, 'Failed to detect conflicts')
    }

    const anthropicData = await anthropicResponse.json()
    const responseText = anthropicData.content[0]?.text || '[]'

    let conflicts: ConflictItem[]
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error('No JSON array found in response')
      }
      conflicts = JSON.parse(jsonMatch[0])
    } catch (_parseError) {
      console.error('Failed to parse AI response:', responseText)
      conflicts = []
    }

    const response: ConflictResponse = {
      conflicts,
    }

    return new Response(JSON.stringify(response), {
      headers: {
        ...getCorsHeaders(req),
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    return errorResponse(error, getCorsHeaders(req))
  }
})
