import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  sanitizeForPrompt,
  HttpError,
  errorResponse,
  verifyProjectMembership,
  requireUuid,
} from '../shared/auth.ts'

interface CopilotRequest {
  message: string
  conversation_id?: string
  project_id: string
}

interface CopilotResponse {
  response: string
  conversation_id: string
  tokens_used: number
}

serve(async (req) => {
  const corsCheck = handleCors(req)
  if (corsCheck) return corsCheck

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<CopilotRequest>(req)

    const projectId = requireUuid(body.project_id, 'project_id')
    const message = sanitizeForPrompt(body.message, 5000)

    if (!message || message.length < 1) {
      throw new HttpError(400, 'message must be a non-empty string')
    }

    await verifyProjectMembership(supabase, user.id, projectId)

    // SECURITY: Use authenticated user's client (not service role key)

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      throw new HttpError(500, 'ANTHROPIC_API_KEY not configured')
    }

    let conversationId = body.conversation_id
    let conversationHistory: Array<{ role: string; content: string }> = []

    if (conversationId) {
      const { data: messages, error: msgError } = await supabase
        .from('ai_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(20)

      if (msgError) {
        console.error('Error fetching conversation:', msgError)
      } else if (messages) {
        conversationHistory = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }))
      }
    } else {
      conversationId = crypto.randomUUID()
    }

    const [
      { data: recentRfis },
      { data: scheduleStatus },
      { data: budgetSummary },
      { data: weatherData },
      { data: projectInfo },
    ] = await Promise.all([
      supabase
        .from('rfis')
        .select('id, subject, status, due_date')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('schedule_phases')
        .select('name, status, scheduled_start, scheduled_end')
        .eq('project_id', projectId)
        .eq('status', 'at_risk')
        .limit(3),
      supabase
        .from('budget_items')
        .select('division, original_amount, actual_amount')
        .eq('project_id', projectId)
        .limit(10),
      supabase
        .from('weather_cache')
        .select('forecast_data, cached_at')
        .eq('project_id', projectId)
        .order('cached_at', { ascending: false })
        .limit(1)
        .single(),
      supabase.from('projects').select('name, location, start_date').eq('id', projectId).single(),
    ])

    const contextParts: string[] = []

    if (projectInfo) {
      contextParts.push(`Project: ${projectInfo.name} in ${projectInfo.location}`)
    }

    if (recentRfis && recentRfis.length > 0) {
      contextParts.push(
        `Recent RFIs:\n${recentRfis.map((r) => `- ${r.subject} (${r.status})`).join('\n')}`,
      )
    }

    if (scheduleStatus && scheduleStatus.length > 0) {
      contextParts.push(
        `At-Risk Activities:\n${scheduleStatus.map((s) => `- ${s.name}`).join('\n')}`,
      )
    }

    if (budgetSummary && budgetSummary.length > 0) {
      const totalOriginal = budgetSummary.reduce((sum, b) => sum + (b.original_amount || 0), 0)
      const totalActual = budgetSummary.reduce((sum, b) => sum + (b.actual_amount || 0), 0)
      const percentSpent = totalOriginal > 0 ? Math.round((totalActual / totalOriginal) * 100) : 0
      contextParts.push(`Budget: ${percentSpent}% spent (${totalActual} of ${totalOriginal})`)
    }

    if (weatherData?.forecast_data) {
      contextParts.push(`Weather context: ${JSON.stringify(weatherData.forecast_data).substring(0, 200)}`)
    }

    const systemPrompt = `You are SiteSync AI, an intelligent construction project assistant integrated into a project management platform. You understand the complexities of construction, including scheduling, budgeting, RFIs, submittals, and field operations.

You help construction professionals by:
- Answering questions about project status, schedules, and budgets
- Suggesting solutions for common construction challenges
- Analyzing risks and recommending mitigations
- Drafting formal RFI and submittal text
- Providing field-first advice suitable for superintendents
- Speaking the language of construction, not software

Current project context:
${contextParts.join('\n')}

Be concise, practical, and construction industry appropriate. Avoid unnecessary jargon unless relevant.`

    const messages = [
      ...conversationHistory,
      { role: 'user', content: message },
    ]

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
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      }),
    })

    if (!anthropicResponse.ok) {
      const error = await anthropicResponse.text()
      console.error('Anthropic API error:', error)
      throw new HttpError(500, 'Failed to generate response from AI')
    }

    const anthropicData = await anthropicResponse.json()
    const aiResponse = anthropicData.content[0]?.text || ''
    const tokensUsed = (anthropicData.usage?.input_tokens || 0) + (anthropicData.usage?.output_tokens || 0)

    await Promise.all([
      supabase.from('ai_conversations').insert({
        id: conversationId,
        project_id: projectId,
        user_id: user.id,
        last_message_at: new Date().toISOString(),
      }).select(),
      supabase.from('ai_messages').insert([
        {
          conversation_id: conversationId,
          role: 'user',
          content: message,
          tokens: anthropicData.usage?.input_tokens || 0,
        },
        {
          conversation_id: conversationId,
          role: 'assistant',
          content: aiResponse,
          tokens: anthropicData.usage?.output_tokens || 0,
        },
      ]),
    ])

    const response: CopilotResponse = {
      response: aiResponse,
      conversation_id: conversationId,
      tokens_used: tokensUsed,
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
