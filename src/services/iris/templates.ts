// ─────────────────────────────────────────────────────────────────────────────
// Iris draft prompt templates (Wave 1, Tab D)
// ─────────────────────────────────────────────────────────────────────────────
// One template per IrisDraftType. Each provides:
//   - buildPrompt(item, ctx) → the full prompt string sent to the model
//   - getSources(item, ctx)  → human-readable source descriptors saved with the
//                              draft so the UI can render the source trail
//   - confidence              → static confidence score (UI surfaces this)
//
// Prompt rules:
//   - Be terse. Construction PMs read these on phones in cabs.
//   - Never instruct the model to invent facts. Only what we pass in.
//   - Always reinforce: this is a DRAFT, a human will review and send.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  IrisDraftType,
  SourceReference,
  StreamItem,
} from '../../types/stream'
import type { ProjectContextSnapshot } from './types'

export interface IrisTemplate {
  buildPrompt: (item: StreamItem, ctx: ProjectContextSnapshot) => string
  getSources: (item: StreamItem, ctx: ProjectContextSnapshot) => string[]
  confidence: number
}

const PROJECT_LINE = (ctx: ProjectContextSnapshot) =>
  ctx.projectName ? `Project: ${ctx.projectName}` : 'Project: (unspecified)'

const FROM_LINE = (ctx: ProjectContextSnapshot) =>
  ctx.userName ? `Drafting on behalf of: ${ctx.userName}` : 'Drafting on behalf of: the project manager'

const ROLE_PREAMBLE = [
  'You are Iris, a junior project assistant for a construction project manager.',
  'You draft short, professional, construction-industry-appropriate communications.',
  'You never invent facts — only use the information given.',
  'The PM will review and send. Do not include "DRAFT" in the body itself.',
].join(' ')

function describeSources(refs: SourceReference[]): string[] {
  return refs.map((r) => {
    const label = r.title || `${r.type} ${r.id}`
    return r.relevance ? `${label} — ${r.relevance}` : label
  })
}

function pluralizeDays(n: number): string {
  return n === 1 ? '1 day' : `${n} days`
}

// ── 1. Overdue follow-up email (RFI or Submittal) ───────────────────────────

const followUpEmail: IrisTemplate = {
  confidence: 0.85,
  buildPrompt: (item, ctx) => {
    const subject = item.title
    const due = item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'the due date'
    const recipient = item.assignedTo ?? 'the responsible party'
    const reason = item.reason || (item.overdue ? 'overdue' : 'past due')
    const scheduleNote =
      typeof item.scheduleImpactDays === 'number' && item.scheduleImpactDays > 0
        ? `This item is currently impacting the schedule by ${pluralizeDays(item.scheduleImpactDays)}.`
        : ''
    const itemNoun =
      item.type === 'submittal' ? 'submittal' : item.type === 'rfi' ? 'RFI' : 'item'
    return [
      ROLE_PREAMBLE,
      '',
      PROJECT_LINE(ctx),
      FROM_LINE(ctx),
      '',
      `Task: Draft a polite, professional follow-up email about an overdue ${itemNoun}.`,
      '',
      'Facts you may use (do not invent more):',
      `- Recipient: ${recipient}`,
      `- ${itemNoun.toUpperCase()} subject/title: ${subject}`,
      `- Due date: ${due}`,
      `- Status: ${reason}`,
      scheduleNote ? `- ${scheduleNote}` : '',
      '',
      'Format:',
      '- 3 short paragraphs.',
      '- Greeting line addressing the recipient by name if provided.',
      '- Reference the item, the due date, and ask for a timeline.',
      '- Sign-off using the PM\'s name if provided, otherwise "Project team".',
      '- No bullet lists. No subject line. Plain body text only.',
    ]
      .filter(Boolean)
      .join('\n')
  },
  getSources: (item) => {
    const fromTrail = describeSources(item.sourceTrail)
    if (fromTrail.length > 0) return fromTrail
    // Fallback: synthesize a minimal source descriptor from the item itself.
    const noun = item.type === 'submittal' ? 'Submittal' : 'RFI'
    return [`${noun}: ${item.title}`]
  },
}

// ── 2. Daily log draft ──────────────────────────────────────────────────────

const dailyLog: IrisTemplate = {
  confidence: 0.6,
  buildPrompt: (item, ctx) => {
    const date = ctx.asOfDate ?? new Date().toISOString().slice(0, 10)
    const weather = ctx.weather
      ? `Weather: ${ctx.weather.summary}${ctx.weather.tempF != null ? `, ${ctx.weather.tempF}°F` : ''}`
      : 'Weather: (not provided — leave the weather sentence factual or omit if unknown)'
    const crew =
      typeof ctx.workforceCount === 'number'
        ? `Crew on site: ${ctx.workforceCount}`
        : 'Crew on site: (not provided — omit if unknown)'
    const entries =
      typeof ctx.fieldEntryCount === 'number'
        ? `Field entries logged: ${ctx.fieldEntryCount}`
        : 'Field entries logged: (not provided — omit if unknown)'
    return [
      ROLE_PREAMBLE,
      '',
      PROJECT_LINE(ctx),
      FROM_LINE(ctx),
      '',
      `Task: Draft a daily log narrative for ${date}.`,
      '',
      'Facts you may use:',
      `- ${weather}`,
      `- ${crew}`,
      `- ${entries}`,
      `- Trigger note: ${item.reason}`,
      '',
      'Format:',
      '- 2–4 short paragraphs.',
      '- Cover: weather, crew/manpower, work performed, deliveries/visitors, and any noted issues.',
      '- Plain narrative prose. No bullet lists. No headings.',
      '- If a fact above is "(not provided ...)", omit that sentence rather than invent.',
      '- End with a single sentence saying the log is a draft awaiting field confirmation.',
    ].join('\n')
  },
  getSources: (item, ctx) => {
    const trail = describeSources(item.sourceTrail)
    const synthetic: string[] = []
    if (typeof ctx.fieldEntryCount === 'number') {
      synthetic.push(`${ctx.fieldEntryCount} field entr${ctx.fieldEntryCount === 1 ? 'y' : 'ies'}`)
    }
    if (ctx.weather) synthetic.push(`Weather: ${ctx.weather.summary}`)
    if (typeof ctx.workforceCount === 'number') {
      synthetic.push(`Crew records (${ctx.workforceCount})`)
    }
    return [...trail, ...synthetic]
  },
}

// ── 3. Schedule risk note ───────────────────────────────────────────────────

const scheduleSuggestion: IrisTemplate = {
  confidence: 0.7,
  buildPrompt: (item, ctx) => {
    const days =
      typeof item.scheduleImpactDays === 'number' && item.scheduleImpactDays > 0
        ? pluralizeDays(item.scheduleImpactDays)
        : 'an unknown number of days'
    return [
      ROLE_PREAMBLE,
      '',
      PROJECT_LINE(ctx),
      FROM_LINE(ctx),
      '',
      'Task: Draft a brief schedule-risk note suitable for a daily report or stakeholder share.',
      '',
      'Facts you may use:',
      `- Activity: ${item.title}`,
      `- Status: ${item.reason}`,
      `- Schedule impact: ${days} behind`,
      '',
      'Format:',
      '- 2–3 sentences. Neutral, factual tone.',
      '- State what is behind, by how much, and the implication if known.',
      '- Do NOT recommend a specific action — leave that to the PM.',
      '- No greeting, no sign-off — this is a note, not an email.',
    ].join('\n')
  },
  getSources: (item) => {
    const trail = describeSources(item.sourceTrail)
    return trail.length > 0 ? trail : [`Schedule activity: ${item.title}`]
  },
}

// ── 4. Owner update (on-demand only — not auto-detected in v1) ──────────────

const ownerUpdate: IrisTemplate = {
  confidence: 0.5,
  buildPrompt: (item, ctx) => [
    ROLE_PREAMBLE,
    '',
    PROJECT_LINE(ctx),
    FROM_LINE(ctx),
    '',
    'Task: Draft an executive summary update for the project owner.',
    '',
    'Facts you may use:',
    `- Trigger note: ${item.reason}`,
    `- Subject: ${item.title}`,
    '',
    'Format:',
    '- 4 short sections labeled inline (no markdown headings):',
    '  Schedule. Budget. Key risks. Decisions needed.',
    '- 1–2 sentences per section.',
    '- Plain professional tone.',
    '- If a section has no data provided, write "No material change" rather than invent.',
  ].join('\n'),
  getSources: (item) => {
    const trail = describeSources(item.sourceTrail)
    return trail.length > 0 ? trail : ['Project status snapshot']
  },
}

// ── 5. RFI response & submittal review (defined for completeness) ────────────
// These exist in IrisDraftType but Wave 1 doesn't auto-detect them — they may
// be invoked manually from a card. Keeping minimal templates so generateDraft
// doesn't throw if a caller selects them.

const rfiResponse: IrisTemplate = {
  confidence: 0.4,                   // intentionally low — content is technical
  buildPrompt: (item, ctx) => [
    ROLE_PREAMBLE,
    '',
    PROJECT_LINE(ctx),
    FROM_LINE(ctx),
    '',
    'Task: Draft a short, neutral acknowledgement to the RFI submitter while the technical answer is developed.',
    'You do NOT have technical authority — do not propose a code, dimension, or material answer.',
    '',
    'Facts you may use:',
    `- RFI title: ${item.title}`,
    `- Status: ${item.reason}`,
    '',
    'Format:',
    '- 2 short paragraphs.',
    '- Acknowledge receipt, state expected response timeframe in general terms, no commitments.',
  ].join('\n'),
  getSources: (item) => {
    const trail = describeSources(item.sourceTrail)
    return trail.length > 0 ? trail : [`RFI: ${item.title}`]
  },
}

const submittalReview: IrisTemplate = {
  confidence: 0.5,
  buildPrompt: (item, ctx) => [
    ROLE_PREAMBLE,
    '',
    PROJECT_LINE(ctx),
    FROM_LINE(ctx),
    '',
    'Task: Draft a brief reviewer note for a submittal — outline what the reviewer should check, not the verdict.',
    '',
    'Facts you may use:',
    `- Submittal title: ${item.title}`,
    `- Status: ${item.reason}`,
    '',
    'Format:',
    '- 3–5 short bullet checks (use "- " prefix).',
    '- No verdict. No approval/rejection language.',
  ].join('\n'),
  getSources: (item) => {
    const trail = describeSources(item.sourceTrail)
    return trail.length > 0 ? trail : [`Submittal: ${item.title}`]
  },
}

// ── Registry ────────────────────────────────────────────────────────────────

export const DRAFT_TEMPLATES: Record<IrisDraftType, IrisTemplate> = {
  follow_up_email: followUpEmail,
  daily_log: dailyLog,
  schedule_suggestion: scheduleSuggestion,
  owner_update: ownerUpdate,
  rfi_response: rfiResponse,
  submittal_review: submittalReview,
}
