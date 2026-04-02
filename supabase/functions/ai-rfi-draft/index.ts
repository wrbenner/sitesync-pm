import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
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

interface RfiDraftRequest {
  description: string
  photo_url?: string
  drawing_ref?: string
  project_id: string
}

interface RfiDraftResponse {
  subject: string
  question: string
  suggested_assignee?: string
  spec_section?: string
}

serve(async (req) => {
  const corsCheck = handleCors(req)
  if (corsCheck) return corsCheck

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<RfiDraftRequest>(req)

    const projectId = requireUuid(body.project_id, 'project_id')
    const description = sanitizeForPrompt(body.description, 2000)

    if (!description || description.length < 10) {
      throw new HttpError(400, 'description must be at least 10 characters')
    }

    await verifyProjectMembership(supabase, user.id, projectId)

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      throw new HttpError(500, 'ANTHROPIC_API_KEY not configured')
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: projectInfo } = await adminClient
      .from('projects')
      .select('name, specs_version')
      .eq('id', projectId)
      .single()

    const context = [
      `Field description: ${description}`,
      body.photo_url ? `Photo attached: ${body.photo_url}` : null,
      body.drawing_ref ? `Drawing reference: ${body.drawing_ref}` : null,
      projectInfo ? `Project: ${projectInfo.name}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const prompt = `You are a construction document expert. Based on this field information, draft a formal RFI (Request for Information) submission.

${context}

Generate a JSON response with:
{
  "subject": "Concise RFI subject line (10-15 words max)",
  "question": "Detailed, professional RFI question suitable for architect or engineer review",
  "suggested_assignee": "Role to receive this (e.g., 'Architect', 'Structural Engineer', 'MEP Coordinator') or null",
  "spec_section": "Relevant specification section (e.g., '09 21 16' for drywall) or null if unclear"
}

Ensure the subject and question are formal, clear, and reference the specific condition or requirement in question.`

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages/create', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
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
      throw new HttpError(500, 'Failed to generate RFI draft')
    }

    const anthropicData = await anthropicResponse.json()
    const responseText = anthropicData.content[0]?.text || '{}'

    let rfiDraft: RfiDraftResponse
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      rfiDraft = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText)
      throw new HttpError(500, 'Failed to parse RFI generation response')
    }

    await adminClient.from('rfi_drafts').insert({
      project_id: projectId,
      user_id: user.id,
      subject: rfiDraft.subject,
      question: rfiDraft.question,
      source_description: description,
      source_photo: body.photo_url,
      source_drawing: body.drawing_ref,
    })

    return new Response(JSON.stringify(rfiDraft), {
      headers: {
        ...getCorsHeaders(req),
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    return errorResponse(error, getCorsHeaders(req))
  }
})
