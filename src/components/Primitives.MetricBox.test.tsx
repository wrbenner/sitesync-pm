import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MetricBox, Tag, SectionHeader } from './Primitives'

// MetricBox uses an internal formatMetricValue helper. We exercise it via
// the rendered output (the displayed value reflects the format applied).

describe('MetricBox — value formatting', () => {
  it('currency format under \$1k displays as raw dollars', () => {
    const { getByRole } = render(<MetricBox label="Spent" value={500} format="currency" />)
    expect(getByRole('region').getAttribute('aria-label')).toContain('500')
  })

  it('currency format ≥ \$1k shows the K suffix (rounded)', () => {
    const { container } = render(<MetricBox label="Spent" value={1500} format="currency" />)
    expect(container.textContent).toContain('$2K')
  })

  it('currency format ≥ \$1M shows the M suffix (1 decimal)', () => {
    const { container } = render(<MetricBox label="Spent" value={2_500_000} format="currency" />)
    expect(container.textContent).toContain('$2.5M')
  })

  it('percent format renders 1 decimal place', () => {
    const { container } = render(<MetricBox label="Progress" value={42.7} format="percent" />)
    expect(container.textContent).toContain('42.7%')
  })

  it('number format applies locale separators', () => {
    const { container } = render(<MetricBox label="Count" value={1234567} format="number" />)
    expect(container.textContent).toContain('1,234,567')
  })

  it('passes through string values unchanged when no format supplied', () => {
    const { container } = render(<MetricBox label="Status" value="N/A" />)
    expect(container.textContent).toContain('N/A')
  })

  it('aria-label includes label + value + unit when supplied', () => {
    const { getByRole } = render(<MetricBox label="Workers" value={50} unit="onsite" />)
    expect(getByRole('region').getAttribute('aria-label')).toBe('Workers: 50 onsite')
  })

  it('aria-label includes warning when data may be incomplete', () => {
    const { getByRole } = render(
      <MetricBox label="Cost" value={1000} warning="incomplete data" />,
    )
    expect(getByRole('region').getAttribute('aria-label')).toContain('incomplete data')
  })

  it('renders with role="region" for screen-reader landmarks', () => {
    const { getByRole } = render(<MetricBox label="X" value={1} />)
    expect(getByRole('region')).toBeTruthy()
  })
})

describe('Tag', () => {
  it('renders the label text', () => {
    const { getByText } = render(<Tag label="Active" />)
    expect(getByText('Active')).toBeTruthy()
  })

  it('uses role="status" for accessibility', () => {
    const { getByRole } = render(<Tag label="Done" />)
    expect(getByRole('status')).toBeTruthy()
  })

  it('aria-label matches the label text', () => {
    const { getByRole } = render(<Tag label="Critical" />)
    expect(getByRole('status').getAttribute('aria-label')).toBe('Critical')
  })

  it('renders custom color and backgroundColor when supplied', () => {
    const { getByRole } = render(<Tag label="X" color="#ff0000" backgroundColor="#00ff00" />)
    const tag = getByRole('status') as HTMLElement
    expect(tag.style.color).toBe('rgb(255, 0, 0)')
    expect(tag.style.backgroundColor).toBe('rgb(0, 255, 0)')
  })
})

describe('SectionHeader', () => {
  it('renders the title', () => {
    const { getByText } = render(<SectionHeader title="Pay Applications" />)
    expect(getByText('Pay Applications')).toBeTruthy()
  })

  it('renders an action element when supplied', () => {
    const { getByText } = render(
      <SectionHeader title="RFIs" action={<button>New</button>} />,
    )
    expect(getByText('New')).toBeTruthy()
  })

  it('action is omitted from output when not supplied', () => {
    const { container } = render(<SectionHeader title="Schedule" />)
    expect(container.querySelector('button')).toBeNull()
  })
})
