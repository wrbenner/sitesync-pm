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

interface DailySummaryRequest {
  project_id: string
  date: string
}

interface DailySummaryResponse {
  summary: string
  highlights: string[]
  concerns: string[]
}

serve(async (req) => {
  const corsCheck = handleCors(req)
  if (corsCheck) return corsCheck

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<DailySummaryRequest>(req)

    const projectId = requireUuid(body.project_id, 'project_id')

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(body.date)) {
      throw new HttpError(400, 'date must be in YYYY-MM-DD format')
    }

    await verifyProjectMembership(supabase, user.id, projectId)

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      throw new HttpError(500, 'ANTHROPIC_API_KEY not configured')
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const dayStart = `${body.date}T00:00:00Z`
    const dayEnd = `${body.date}T23:59:59Z`

    const [
      { data: dailyLogs },
      { data: rfiActivity },
      { data: punchChanges },
      { data: projectInfo },
    ] = await Promise.all([
      adminClient
        .from('daily_logs')
        .select('id, crew_name, entry_text, weather, equipment_used')
        .eq('project_id', projectId)
        .gte('created_at', dayStart)
        .lt('created_at', dayEnd)
        .order('created_at', { ascending: true }),
      adminClient
        .from('rfis')
        .select('id, subject, status, updated_at')
        .eq('project_id', projectId)
        .gte('updated_at', dayStart)
        .lt('updated_at', dayEnd),
      adminClient
        .from('punch_items')
        .select('id, area, trade, status, updated_at')
        .eq('project_id', projectId)
        .gte('updated_at', dayStart)
        .lt('updated_at', dayEnd),
      adminClient.from('projects').select('name, location').eq('id', projectId).single(),
    ])

    if (
      (!dailyLogs || dailyLogs.length === 0) &&
      (!rfiActivity || rfiActivity.length === 0) &&
      (!punchChanges || punchChanges.length === 0)
    ) {
      throw new HttpError(404, 'No activity data found for this date')
    }

    const contextParts: string[] = []

    if (projectInfo) {
      contextParts.push(`Project: ${projectInfo.name} at ${projectInfo.location}`)
      contextParts.push(`Date: ${body.date}`)
    }

    if (dailyLogs && dailyLogs.length > 0) {
      const logsText = dailyLogs
        .map((log) => {
          const parts = [`${log.crew_name}: ${log.entry_text}`]
          if (log.weather) parts.push(`Weather: ${log.weather}`)
          if (log.equipment_used) parts.push(`Equipment: ${log.equipment_used}`)
          return parts.join(' | ')
        })
        .join('\n')

      contextParts.push(`Daily Log Entries:\n${logsText}`)
    }

    if (rfiActivity && rfiActivity.length > 0) {
      const rfiText = rfiActivity
        .map((r) => `- ${r.subject} (${r.status})`)
        .join('\n')
      contextParts.push(`RFI Activity:\n${rfiText}`)
    }

    if (punchChanges && punchChanges.length > 0) {
      const punchText = punchChanges
        .map((p) => `- ${p.area} (${p.trade}): ${p.status}`)
        .join('\n')
      contextParts.push(`Punch List Changes:\n${punchText}`)
    }

    const prompt = `You are a construction project management expert. Based on this daily project activity, generate a professional daily summary narrative suitable for sharing with owners, GCs, or PM teams.

${contextParts.join('\n\n')}

Generate a JSON response with:
{
  "summary": "2-3 paragraph narrative summary of the day's activities, progress, and key events. Professional tone suitable for project stakeholders.",
  "highlights": ["key accomplishment 1", "key accomplishment 2", "progress made"],
  "concerns": ["issue or concern 1", "issue or concern 2", "blocker or delay"] (empty array if no concerns)
}

Focus on:
- Work completed and progress toward schedule
- Weather or environmental impacts
- RFI responses or new RFI requests
- Punch list activity and closeouts
- Any delays, conflicts, or blockers`

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
      throw new HttpError(500, 'Failed to generate daily summary')
    }

    const anthropicData = await anthropicResponse.json()
    const responseText = anthropicData.content[0]?.text || '{}'

    let summaryResult: DailySummaryResponse
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      summaryResult = JSON.parse(jsonMatch[0])
    } catch (_parseError) {
      console.error('Failed to parse AI response:', responseText)
      throw new HttpError(500, 'Failed to parse summary generation response')
    }

    await adminClient.from('daily_summaries').insert({
      project_id: projectId,
      date: body.date,
      summary: summaryResult.summary,
      highlights: summaryResult.highlights,
      concerns: summaryResult.concerns,
      generated_by: user.id,
    })

    return new Response(JSON.stringify(summaryResult), {
      headers: {
        ...getCorsHeaders(req),
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    return errorResponse(error, getCorsHeaders(req))
  }
})
