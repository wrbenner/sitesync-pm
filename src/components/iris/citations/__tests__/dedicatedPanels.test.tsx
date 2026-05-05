/**
 * Day 39 dedicated citation panels — render shape + edge cases.
 *
 * These panels are pure presentation; they only consume the
 * side_panel_data shape the resolver returns. We render with various
 * inputs (full data, partial data, empty data) and assert key strings
 * + structural invariants.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { DailyLogCitationPanelContent } from '../DailyLogCitationPanelContent'
import { ChangeOrderCitationPanelContent } from '../ChangeOrderCitationPanelContent'
import { SpecCitationPanelContent } from '../SpecCitationPanelContent'
import { SchedulePhaseCitationPanelContent } from '../SchedulePhaseCitationPanelContent'

describe('DailyLogCitationPanelContent', () => {
  it('renders the formatted log date', () => {
    render(
      <DailyLogCitationPanelContent
        data={{ date: '2026-06-15', summary: 'Crew poured slab.' }}
      />,
    )
    // Locale formatting: e.g. "Mon, Jun 15, 2026" — assert by month name.
    // Day can be 14 or 15 depending on the test runner's timezone.
    expect(screen.getByText(/Jun (14|15), 2026/)).toBeTruthy()
    expect(screen.getByText(/Crew poured slab\./)).toBeTruthy()
  })

  it('truncates summaries longer than 360 chars and shows length hint', () => {
    const long = 'word '.repeat(120).trim() // ~600 chars
    render(<DailyLogCitationPanelContent data={{ date: '2026-06-15', summary: long }} />)
    expect(screen.getByText(/characters total/)).toBeTruthy()
  })

  it('shows empty-state copy when summary is missing', () => {
    render(<DailyLogCitationPanelContent data={{ date: '2026-06-15' }} />)
    expect(screen.getByText(/No narrative recorded/)).toBeTruthy()
  })

  it('shows "Unknown date" when date missing', () => {
    render(<DailyLogCitationPanelContent data={{ summary: 'x' }} />)
    expect(screen.getByText('Unknown date')).toBeTruthy()
  })
})

describe('ChangeOrderCitationPanelContent', () => {
  it('renders status pill and currency-formatted amount', () => {
    render(
      <ChangeOrderCitationPanelContent
        data={{ status: 'approved', amount: 12500, description: 'Storefront glazing CO' }}
      />,
    )
    expect(screen.getByText(/Status:/)).toBeTruthy()
    expect(screen.getByText('Approved')).toBeTruthy()
    expect(screen.getByText('$12,500')).toBeTruthy()
    expect(screen.getByText(/Storefront glazing CO/)).toBeTruthy()
  })

  it('formats fractional amounts with two decimals', () => {
    render(<ChangeOrderCitationPanelContent data={{ amount: 1234.5 }} />)
    expect(screen.getByText('$1,234.50')).toBeTruthy()
  })

  it('omits amount pill when absent', () => {
    render(<ChangeOrderCitationPanelContent data={{ status: 'pending' }} />)
    expect(screen.queryByText(/Amount:/)).toBeNull()
  })

  it('shows empty-state copy when description missing', () => {
    render(<ChangeOrderCitationPanelContent data={{ status: 'pending' }} />)
    expect(screen.getByText(/No description recorded/)).toBeTruthy()
  })

  it('truncates long descriptions at 320 chars', () => {
    const long = 'a'.repeat(500)
    render(<ChangeOrderCitationPanelContent data={{ status: 'pending', description: long }} />)
    // No length-hint footer for CO descriptions; check truncation by ellipsis.
    expect(screen.getByText(/…$/)).toBeTruthy()
  })
})

describe('SpecCitationPanelContent', () => {
  it('renders the section number and title', () => {
    render(
      <SpecCitationPanelContent
        data={{ section: '03 30 00', title: 'Cast-in-Place Concrete' }}
      />,
    )
    expect(screen.getByText('03 30 00')).toBeTruthy()
    expect(screen.getByText('Cast-in-Place Concrete')).toBeTruthy()
  })

  it('shows "no metadata" copy when both fields missing', () => {
    render(<SpecCitationPanelContent data={{}} />)
    expect(screen.getByText(/no metadata available/)).toBeTruthy()
  })

  it('renders only section if title missing', () => {
    render(<SpecCitationPanelContent data={{ section: '03 30 00' }} />)
    expect(screen.getByText('03 30 00')).toBeTruthy()
    expect(screen.queryByText(/no metadata available/)).toBeNull()
  })
})

describe('SchedulePhaseCitationPanelContent', () => {
  it('renders activity name + date range + duration', () => {
    render(
      <SchedulePhaseCitationPanelContent
        data={{
          name: 'Foundation pour',
          start: '2026-06-10',
          end: '2026-06-14',
        }}
      />,
    )
    expect(screen.getByText('Foundation pour')).toBeTruthy()
    // Match loosely since locale formatting is timezone-dependent — the
    // exact day can shift ±1 between UTC and local time renderings.
    const jun10s = screen.getAllByText(/Jun (9|10), 2026/)
    expect(jun10s.length).toBeGreaterThan(0)
    const jun14s = screen.getAllByText(/Jun (13|14), 2026/)
    expect(jun14s.length).toBeGreaterThan(0)
    expect(screen.getByText('4 days')).toBeTruthy()
  })

  it('reports "ended N days ago" when phase is in the past', () => {
    const past = new Date()
    past.setUTCDate(past.getUTCDate() - 5)
    const earlier = new Date()
    earlier.setUTCDate(earlier.getUTCDate() - 8)
    render(
      <SchedulePhaseCitationPanelContent
        data={{
          name: 'Past activity',
          start: earlier.toISOString().slice(0, 10),
          end: past.toISOString().slice(0, 10),
        }}
      />,
    )
    expect(screen.getByText(/Ended \d+ days? ago/)).toBeTruthy()
  })

  it('reports "in progress" when today falls inside the range', () => {
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    render(
      <SchedulePhaseCitationPanelContent
        data={{
          name: 'Current activity',
          start: yesterday.toISOString().slice(0, 10),
          end: tomorrow.toISOString().slice(0, 10),
        }}
      />,
    )
    expect(screen.getByText('In progress')).toBeTruthy()
  })

  it('reports "starts in N days" when phase is upcoming', () => {
    const future = new Date()
    future.setUTCDate(future.getUTCDate() + 7)
    const futureEnd = new Date()
    futureEnd.setUTCDate(futureEnd.getUTCDate() + 14)
    render(
      <SchedulePhaseCitationPanelContent
        data={{
          name: 'Upcoming activity',
          start: future.toISOString().slice(0, 10),
          end: futureEnd.toISOString().slice(0, 10),
        }}
      />,
    )
    expect(screen.getByText(/Starts in \d+ days?/)).toBeTruthy()
  })

  it('renders fallback copy when no dates provided', () => {
    render(<SchedulePhaseCitationPanelContent data={{ name: 'Activity X' }} />)
    expect(screen.getByText('Activity X')).toBeTruthy()
    expect(screen.getByText(/no start\/end dates set/i)).toBeTruthy()
  })

  it('renders "Unnamed activity" when name missing', () => {
    render(<SchedulePhaseCitationPanelContent data={{}} />)
    expect(screen.getByText('Unnamed activity')).toBeTruthy()
  })
})
