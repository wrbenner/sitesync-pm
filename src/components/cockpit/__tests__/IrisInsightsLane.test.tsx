import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IrisInsightsLane } from '../IrisInsightsLane'
import type { IrisInsight } from '../../../services/iris/insights'

function makeInsight(overrides: Partial<IrisInsight> = {}): IrisInsight {
  return {
    id: 'insight-1',
    kind: 'cascade',
    severity: 'high',
    headline: 'RFI 042 blocks Level 3 framing',
    impactChain: ['RFI 042 → activity slips → critical path at risk'],
    sourceTrail: [
      {
        type: 'rfi',
        id: 'rfi-042',
        title: 'RFI #042',
        url: '/rfis/042',
      },
    ],
    estimatedImpact: { dollars: 42_000, scheduleDays: 5 },
    detectedAt: '2026-04-30T10:00:00.000Z',
    ...overrides,
  }
}

describe('IrisInsightsLane', () => {
  it('renders nothing when there are no insights', () => {
    const { container } = render(<IrisInsightsLane insights={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the Iris eyebrow and the deterministic moat-statement subtitle', () => {
    // The lane was relabeled from "Detected risks" to "Deterministic /
    // no AI · sourced · real-time" to match the demo moat statement —
    // these insights are pure functions, not LLM output.
    render(<IrisInsightsLane insights={[makeInsight()]} />)
    expect(screen.getByRole('region', { name: /iris insights/i })).toBeTruthy()
    expect(screen.getByText(/iris/i)).toBeTruthy()
    expect(screen.getByText(/deterministic/i)).toBeTruthy()
    expect(screen.getByText(/no AI/i)).toBeTruthy()
  })

  it('renders a card for each insight up to the limit', () => {
    const insights = [
      makeInsight({ id: 'a', headline: 'Alpha risk' }),
      makeInsight({ id: 'b', headline: 'Beta risk' }),
      makeInsight({ id: 'c', headline: 'Gamma risk' }),
      makeInsight({ id: 'd', headline: 'Delta risk' }),
    ]
    render(<IrisInsightsLane insights={insights} limit={3} />)
    expect(screen.getByText('Alpha risk')).toBeTruthy()
    expect(screen.getByText('Beta risk')).toBeTruthy()
    expect(screen.getByText('Gamma risk')).toBeTruthy()
    expect(screen.queryByText('Delta risk')).toBeNull()
  })

  it('sorts critical above high above medium, then by dollars desc', () => {
    const insights = [
      makeInsight({
        id: 'med-big',
        severity: 'medium',
        headline: 'Medium with $5M',
        estimatedImpact: { dollars: 5_000_000 },
      }),
      makeInsight({
        id: 'crit-small',
        severity: 'critical',
        headline: 'Critical with $1K',
        estimatedImpact: { dollars: 1_000 },
      }),
      makeInsight({
        id: 'high-mid',
        severity: 'high',
        headline: 'High with $50K',
        estimatedImpact: { dollars: 50_000 },
      }),
    ]
    render(<IrisInsightsLane insights={insights} />)
    const cards = screen.getAllByRole('button')
    expect(cards[0]).toHaveTextContent('Critical with $1K')
    expect(cards[1]).toHaveTextContent('High with $50K')
    expect(cards[2]).toHaveTextContent('Medium with $5M')
  })

  it('renders the dollar + day exposure stat', () => {
    render(<IrisInsightsLane insights={[makeInsight()]} />)
    expect(screen.getByText(/\$42K exposed · \+5d slip/)).toBeTruthy()
  })

  it('invokes onSelect when a card is clicked', () => {
    const onSelect = vi.fn()
    const insight = makeInsight()
    render(<IrisInsightsLane insights={[insight]} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(insight)
  })

  it('renders a source trail label from the first source', () => {
    render(<IrisInsightsLane insights={[makeInsight()]} />)
    expect(screen.getByText('RFI #042')).toBeTruthy()
  })

  it('shows an aggregated trail when the source list has multiple entries', () => {
    const insight = makeInsight({
      sourceTrail: [
        { type: 'rfi', id: 'rfi-042', title: 'RFI #042', url: '/rfis/042' },
        {
          type: 'schedule_activity',
          id: 'sa-7',
          title: 'L3 framing',
          url: '/schedule/sa-7',
        },
        {
          type: 'submittal',
          id: 'sb-9',
          title: 'Sub 09',
          url: '/submittals/sb-9',
        },
      ],
    })
    render(<IrisInsightsLane insights={[insight]} />)
    expect(screen.getByText('RFI #042 +2')).toBeTruthy()
  })
})
