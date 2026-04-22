
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

interface ScheduleRisk {
  activity_id: string
  activity_name: string
  risk_level: 'high' | 'medium' | 'low'
  probability: number
  impact_days: number
  reason: string
  mitigation: string
}

interface ScheduleRiskResponse {
  risks: ScheduleRisk[]
}

interface ScheduleRiskRequest {
  project_id: string
}

Deno.serve(async (req) => {
  const corsCheck = handleCors(req)
  if (corsCheck) return corsCheck

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<ScheduleRiskRequest>(req)

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
      { data: activities },
      { data: weatherForecast },
      { data: crewAssignments },
      { data: openRfis },
      { data: projectInfo },
    ] = await Promise.all([
      adminClient
        .from('schedule_phases')
        .select('id, name, status, scheduled_start, scheduled_end, is_critical_path')
        .eq('project_id', projectId)
        .order('scheduled_start', { ascending: true }),
      adminClient
        .from('weather_cache')
        .select('forecast_data')
        .eq('project_id', projectId)
        .order('cached_at', { ascending: false })
        .limit(1)
        .single(),
      adminClient
        .from('crews')
        .select('id, name, status, availability_percent')
        .eq('project_id', projectId),
      adminClient
        .from('rfis')
        .select('id, subject, affected_phases')
        .eq('project_id', projectId)
        .eq('status', 'open'),
      adminClient.from('projects').select('name').eq('id', projectId).single(),
    ])

    if (!activities || activities.length === 0) {
      throw new HttpError(404, 'No schedule activities found')
    }

    const contextParts: string[] = []

    contextParts.push(`Project: ${projectInfo?.name || 'Unknown'}`)
    contextParts.push(
      `Schedule Activities: ${activities.map((a) => `${a.name} (${a.status})`).join(', ')}`,
    )

    if (weatherForecast?.forecast_data) {
      contextParts.push(`Weather Forecast: ${JSON.stringify(weatherForecast.forecast_data).substring(0, 300)}`)
    }

    if (crewAssignments && crewAssignments.length > 0) {
      const crewSummary = crewAssignments
        .map((c) => `${c.name}: ${c.status} (${c.availability_percent}% available)`)
        .join(', ')
      contextParts.push(`Crew Status: ${crewSummary}`)
    }

    if (openRfis && openRfis.length > 0) {
      const rfiSummary = openRfis.map((r) => `${r.subject}`).join(', ')
      contextParts.push(`Open RFIs: ${rfiSummary}`)
    }

    const prompt = `You are a construction schedule risk analyst. Analyze the following project schedule and identify activities at risk of delay.

${contextParts.join('\n')}

For each activity that has notable risk factors, provide:
- Probability (0-1): likelihood the activity will be delayed
- Impact Days: estimated number of days delay if the risk occurs
- Risk Level: 'high', 'medium', or 'low' based on probability and impact
- Reason: specific factors creating risk (weather, crew availability, RFI dependencies, etc.)
- Mitigation: recommended action to reduce risk

Return JSON array with this structure:
[
  {
    "activity_id": "original activity name or identifier",
    "activity_name": "Activity Name",
    "risk_level": "high|medium|low",
    "probability": 0.0-1.0,
    "impact_days": number,
    "reason": "Specific risk factors",
    "mitigation": "Recommended action"
  }
]

Only include activities with notable risk (probability > 0.3 or on critical path).`

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
      throw new HttpError(500, 'Failed to analyze schedule risks')
    }

    const anthropicData = await anthropicResponse.json()
    const responseText = anthropicData.content[0]?.text || '[]'

    let risks: ScheduleRisk[]
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error('No JSON array found in response')
      }
      risks = JSON.parse(jsonMatch[0])
    } catch (_parseError) {
      console.error('Failed to parse AI response:', responseText)
      throw new HttpError(500, 'Failed to parse risk analysis response')
    }

    const response: ScheduleRiskResponse = {
      risks,
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
