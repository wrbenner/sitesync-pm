/**
 * Meeting minutes generator.
 *
 * Takes a transcript + an optional attendee list and produces a structured
 * document with action items, decisions, and unresolved questions.
 *
 * Pure: the LLM-extracted fields are passed in by the edge function, this
 * module only formats them.
 */

import type { GeneratedDocument, DocumentSection } from './monthlyReport'

export interface MeetingMinutesInput {
  meeting_title: string
  meeting_date: string
  attendees: Array<{ name: string; role?: string }>
  decisions: string[]
  action_items: Array<{ owner: string; description: string; due?: string }>
  open_questions: string[]
  /** Optional: project meta for header. */
  project_name?: string
  /** Snapshot timestamp. */
  generated_at: string
}

export function generateMeetingMinutes(input: MeetingMinutesInput): GeneratedDocument {
  const sections: DocumentSection[] = []

  sections.push({
    heading: 'Attendees',
    bullets: input.attendees.map((a) => (a.role ? `${a.name} (${a.role})` : a.name)),
  })

  if (input.decisions.length > 0) {
    sections.push({ heading: 'Decisions', bullets: input.decisions })
  }

  if (input.action_items.length > 0) {
    sections.push({
      heading: 'Action items',
      rows: input.action_items.map((a) => ({
        Owner: a.owner,
        Action: a.description,
        Due: a.due ?? '—',
      })),
    })
  }

  if (input.open_questions.length > 0) {
    sections.push({ heading: 'Open questions', bullets: input.open_questions })
  }

  return {
    title: input.meeting_title,
    subtitle: `${input.project_name ? input.project_name + ' · ' : ''}${input.meeting_date}`,
    as_of: input.generated_at,
    sections,
  }
}
