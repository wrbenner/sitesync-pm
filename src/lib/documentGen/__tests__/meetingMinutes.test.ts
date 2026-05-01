import { describe, it, expect } from 'vitest'
import { generateMeetingMinutes } from '../meetingMinutes'

describe('generateMeetingMinutes', () => {
  it('renders all sections when fully populated', () => {
    const doc = generateMeetingMinutes({
      meeting_title: 'OAC Meeting',
      meeting_date: '2026-04-29',
      attendees: [{ name: 'Alice', role: 'Owner' }, { name: 'Bob', role: 'PM' }],
      decisions: ['Approved beam upgrade'],
      action_items: [{ owner: 'Bob', description: 'Submit RFI', due: '2026-05-01' }],
      open_questions: ['When does steel arrive?'],
      generated_at: '2026-04-29T00:00:00Z',
    })
    expect(doc.sections.length).toBe(4)
  })

  it('skips empty sections', () => {
    const doc = generateMeetingMinutes({
      meeting_title: 'OAC',
      meeting_date: '2026-04-29',
      attendees: [{ name: 'Alice' }],
      decisions: [],
      action_items: [],
      open_questions: [],
      generated_at: '2026-04-29T00:00:00Z',
    })
    expect(doc.sections.length).toBe(1) // attendees only
  })

  it('formats attendee with role', () => {
    const doc = generateMeetingMinutes({
      meeting_title: 'OAC',
      meeting_date: '2026-04-29',
      attendees: [{ name: 'Alice', role: 'Owner' }, { name: 'Bob' }],
      decisions: [],
      action_items: [],
      open_questions: [],
      generated_at: '2026-04-29T00:00:00Z',
    })
    expect(doc.sections[0].bullets).toEqual(['Alice (Owner)', 'Bob'])
  })
})
