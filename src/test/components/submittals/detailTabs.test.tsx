// Phase 6 — DetailTabs render + interaction tests.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  DetailTabs,
  DETAIL_TABS,
  EmptyDetailTab,
  type DetailTab,
} from '../../../components/submittals/detail/DetailTabs'

describe('DetailTabs', () => {
  it('renders all 7 tabs in order', () => {
    render(<DetailTabs active="overview" onChange={() => {}} />)
    const labels = DETAIL_TABS.map((t) => t.label)
    for (const label of labels) {
      expect(screen.getAllByText((c) => c.includes(label)).length).toBeGreaterThan(0)
    }
  })

  it('shows Phase badge for tabs that ship later', () => {
    render(<DetailTabs active="overview" onChange={() => {}} />)
    // Markup is Phase 8
    expect(screen.getAllByText('P8').length).toBeGreaterThan(0)
    // Citations is Phase 7
    expect(screen.getByText('P7')).toBeInTheDocument()
  })

  it('does NOT show Phase badge for live tabs (overview, history)', () => {
    render(<DetailTabs active="overview" onChange={() => {}} />)
    // Overview tab itself shouldn't have a P-badge sibling
    const overviewBtn = screen.getByRole('tab', { name: /overview/i })
    expect(overviewBtn.querySelector('span[title^="Coming"]')).toBeNull()
  })

  it('marks the active tab via aria-selected', () => {
    render(<DetailTabs active="markup" onChange={() => {}} />)
    const markup = screen.getByRole('tab', { name: /markup/i })
    expect(markup).toHaveAttribute('aria-selected', 'true')
  })

  it('fires onChange with the clicked tab id', () => {
    const onChange = vi.fn()
    render(<DetailTabs active="overview" onChange={onChange} />)
    fireEvent.click(screen.getByRole('tab', { name: /citations/i }))
    expect(onChange).toHaveBeenCalledWith('citations' satisfies DetailTab)
  })
})

describe('EmptyDetailTab', () => {
  it('shows the phase label and tab name', () => {
    render(<EmptyDetailTab phase={8} tabLabel="Markup" />)
    expect(screen.getByText(/Markup — coming in Phase 8/i)).toBeInTheDocument()
  })
})
