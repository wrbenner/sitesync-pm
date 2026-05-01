// ─────────────────────────────────────────────────────────────────────────────
// Iris draft generation (Wave 1, Tab D)
// ─────────────────────────────────────────────────────────────────────────────
// Generates the actual draft text for a stream item using @ai-sdk/anthropic.
// Called only when a user expands an item that has irisEnhancement.draftAvailable.
//
// Wave 1 uses the direct provider package to match the existing Iris pattern.
// Migrating to the Vercel AI Gateway is a separate post-Wave-1 initiative.
// ─────────────────────────────────────────────────────────────────────────────

import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'

import type { StreamItem } from '../../types/stream'
import { DRAFT_TEMPLATES } from './templates'
import type { IrisDraft, ProjectContextSnapshot } from './types'

const MODEL_ID = 'claude-sonnet-4.6'

// In the browser there is no `process.env`, so the default `anthropic` export
// throws "Environment variables are not supported in this environment" the
// moment a user clicks Draft. Construct the provider explicitly with the Vite
// env var so the key is wired the same way every other client-side secret
// (Supabase, OpenWeather) is wired in this app.
const anthropic = createAnthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
})

export interface GenerateDraftOptions {
  // Allow tests / future callers to swap in a fake without changing call sites.
  generate?: typeof generateText
}

export async function generateIrisDraft(
  item: StreamItem,
  projectContext: ProjectContextSnapshot,
  options: GenerateDraftOptions = {},
): Promise<IrisDraft> {
  const draftType = item.irisEnhancement?.draftType
  if (!draftType) {
    throw new Error(`StreamItem ${item.id} has no irisEnhancement.draftType — cannot generate a draft.`)
  }

  const template = DRAFT_TEMPLATES[draftType]
  if (!template) {
    throw new Error(`No template registered for draft type: ${draftType}`)
  }

  const prompt = template.buildPrompt(item, projectContext)
  const sources = template.getSources(item, projectContext)
  const generate = options.generate ?? generateText

  const { text } = await generate({
    model: anthropic(MODEL_ID),
    prompt,
    temperature: 0.3,
    maxOutputTokens: 500,
  })

  return {
    id: item.id,
    type: draftType,
    content: text.trim(),
    sources,
    status: 'pending',
    generatedAt: new Date().toISOString(),
    confidence: template.confidence,
  }
}
