
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
import { routeAI, getAvailableProviders, type AIRequest } from '../shared/aiRouter.ts'

// ── Types ────────────────────────────────────────────────────────────────────

interface RfiDraftRequest {
  description: string
  photo_url?: string
  photo_base64?: string        // Base64-encoded photo for vision analysis
  drawing_ref?: string
  project_id: string
}

interface RfiDraftResponse {
  subject: string
  question: string
  suggested_assignee?: string
  spec_section?: string
  code_citation?: string       // NEW: building code reference from Perplexity
  photo_analysis?: string      // NEW: field photo analysis from Gemini
  trade_classification?: {     // NEW: structured classification from OpenAI
    trade: string
    csi_division: string
    urgency: 'low' | 'medium' | 'high' | 'critical'
  }
  providers_used: string[]     // Transparency: which providers contributed
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
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

    // ── Fetch project context ────────────────────────────────────────────

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: projectInfo } = await adminClient
      .from('projects')
      .select('name, specs_version')
      .eq('id', projectId)
      .single()

    const providers = getAvailableProviders()
    const providersUsed: string[] = []

    // ── Phase 1: Vision analysis (Gemini) ────────────────────────────────
    // If a photo is attached, analyze it for construction context.

    let photoAnalysis: string | undefined
    if (body.photo_base64 && providers.gemini) {
      try {
        const visionRequest: AIRequest = {
          task: 'vision',
          messages: [{
            role: 'user',
            content: `Analyze this construction site photo. Describe:
1. What construction element or condition is shown
2. Any visible defects, conflicts, or issues
3. Relevant trade (electrical, mechanical, structural, etc.)
4. Whether this appears to require an RFI for clarification

Context: This photo accompanies an RFI draft for project "${projectInfo?.name ?? 'Unknown'}".
Field description: ${description}`,
          }],
          images: [{
            base64: body.photo_base64,
            media_type: 'image/jpeg',
          }],
          max_tokens: 512,
          temperature: 0.2,
        }

        const visionResponse = await routeAI(visionRequest)
        photoAnalysis = visionResponse.content
        providersUsed.push(`${visionResponse.provider}/${visionResponse.model}`)
      } catch (e) {
        console.warn('[ai-rfi-draft] Vision analysis failed, continuing without:', e)
      }
    }

    // ── Phase 2: Core RFI draft (Claude) ─────────────────────────────────
    // Claude generates the primary RFI content using construction reasoning.

    const contextParts = [
      `Field description: ${description}`,
      body.photo_url ? `Photo attached: ${body.photo_url}` : null,
      body.drawing_ref ? `Drawing reference: ${body.drawing_ref}` : null,
      projectInfo ? `Project: ${projectInfo.name}` : null,
      photoAnalysis ? `Photo analysis: ${photoAnalysis}` : null,
    ].filter(Boolean).join('\n')

    const draftRequest: AIRequest = {
      task: 'reasoning',
      system: `You are a construction document expert specializing in RFI drafting. 
You write formal, precise RFIs that architects and engineers take seriously. 
Reference specific conditions, spec sections, and drawing details when available.
Respond with a JSON object only — no markdown, no explanation.`,
      messages: [{
        role: 'user',
        content: `Based on this field information, draft a formal RFI.

${contextParts}

Generate a JSON response with:
{
  "subject": "Concise RFI subject line (10-15 words max)",
  "question": "Detailed, professional RFI question suitable for architect or engineer review",
  "suggested_assignee": "Role to receive this (e.g., 'Architect', 'Structural Engineer', 'MEP Coordinator') or null",
  "spec_section": "Relevant specification section (e.g., '09 21 16' for drywall) or null if unclear"
}`,
      }],
      max_tokens: 1024,
      temperature: 0.3,
    }

    const draftResponse = await routeAI(draftRequest)
    providersUsed.push(`${draftResponse.provider}/${draftResponse.model}`)

    let rfiDraft: RfiDraftResponse
    try {
      const jsonMatch = draftResponse.content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found in response')
      rfiDraft = JSON.parse(jsonMatch[0])
    } catch {
      console.error('Failed to parse AI response:', draftResponse.content)
      throw new HttpError(500, 'Failed to parse RFI generation response')
    }

    // ── Phase 3: Trade classification (OpenAI) ───────────────────────────
    // Fast structured extraction of trade, CSI division, urgency.

    if (providers.openai) {
      try {
        const classifyRequest: AIRequest = {
          task: 'classification',
          messages: [{
            role: 'user',
            content: `Classify this RFI:
Subject: ${rfiDraft.subject}
Question: ${rfiDraft.question}
Spec section: ${rfiDraft.spec_section ?? 'unknown'}`,
          }],
          system: 'You are a construction document classifier. Return JSON only.',
          json_schema: {
            type: 'object',
            properties: {
              trade: { type: 'string', description: 'Primary construction trade' },
              csi_division: { type: 'string', description: 'CSI MasterFormat division (e.g., "03 00 00 Concrete")' },
              urgency: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            },
            required: ['trade', 'csi_division', 'urgency'],
          },
          max_tokens: 256,
          temperature: 0.1,
        }

        const classifyResponse = await routeAI(classifyRequest)
        providersUsed.push(`${classifyResponse.provider}/${classifyResponse.model}`)
        try {
          rfiDraft.trade_classification = JSON.parse(classifyResponse.content)
        } catch {
          console.warn('[ai-rfi-draft] Classification parse failed')
        }
      } catch (e) {
        console.warn('[ai-rfi-draft] Classification failed, continuing without:', e)
      }
    }

    // ── Phase 4: Code citation (Perplexity) ──────────────────────────────
    // If a spec section was identified, look up the actual code language.

    if (providers.perplexity && rfiDraft.spec_section) {
      try {
        // IMPORTANT: Code lookup is a RESEARCH ASSIST, not authoritative
        // legal/compliance guidance. Output must include confidence markers.
        const codeRequest: AIRequest = {
          task: 'code_lookup',
          messages: [{
            role: 'user',
            content: `For an RFI about "${rfiDraft.subject}", find the relevant building code or standard requirement for specification section ${rfiDraft.spec_section}. Include the specific code section number, edition year, and exact requirement text. If IBC, cite the specific section. If ASTM/ACI, cite the standard number. IMPORTANT: Always state the jurisdiction and edition year. If uncertain, say so explicitly.`,
          }],
          search_context: `construction building code specification ${rfiDraft.spec_section}`,
          max_tokens: 512,
          temperature: 0.1,
        }

        const codeResponse = await routeAI(codeRequest)
        providersUsed.push(`${codeResponse.provider}/${codeResponse.model}`)
        rfiDraft.code_citation = codeResponse.content
      } catch (e) {
        console.warn('[ai-rfi-draft] Code lookup failed, continuing without:', e)
      }
    }

    // ── Finalize response ────────────────────────────────────────────────

    rfiDraft.photo_analysis = photoAnalysis
    rfiDraft.providers_used = providersUsed

    // Save draft to database
    await adminClient.from('rfi_drafts').insert({
      project_id: projectId,
      user_id: user.id,
      subject: rfiDraft.subject,
      question: rfiDraft.question,
      source_description: description,
      source_photo: body.photo_url,
      source_drawing: body.drawing_ref,
    }).then(() => {}).catch((e: Error) => {
      console.warn('[ai-rfi-draft] Failed to save draft:', e)
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
