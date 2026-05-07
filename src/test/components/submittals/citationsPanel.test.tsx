// Phase 7 — CitationsPanel render + interaction tests.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CitationsPanel, groupByKind } from '../../../components/submittals/detail/Citations/CitationsPanel'
import type { CitationBase } from '../../../components/submittals/detail/Citations/citationKinds'

const sample: CitationBase[] = [
  {
    id: 'spec-1',
    kind: 'spec_section',
    label: '08 41 13 §2.04.B.3',
    subtitle: 'Aluminum-framed storefronts — anchorage',
    preview: { kind: 'pdf', pdfUrl: '/spec.pdf', page: 47, highlightRect: [10, 20, 70, 8] },
  },
  {
    id: 'past-1',
    kind: 'prior_submittal',
    label: '#08-41-13-7',
    subtitle: 'Approved as noted, 2 resubmits',
    preview: {
      kind: 'submittal_summary',
      submittal_id: 'past-1-id',
      number: '08-41-13-7',
      title: 'Storefront aluminum — Tower 2',
      disposition: 'Approved as noted',
      rev_count: 2,
    },
  },
  {
    id: 'rfi-1',
    kind: 'rfi',
    label: '#RFI-019',
    preview: {
      kind: 'rfi_summary',
      rfi_id: 'rfi-1-id',
      number: 'RFI-019',
      question: 'Confirm wet-glaze method on storefront frames.',
      status: 'answered',
    },
  },
]

afterEach?.(cleanup)

describe('groupByKind', () => {
  it('buckets citations by kind', () => {
    const grouped = groupByKind(sample)
    expect(grouped.get('spec_section')).toHaveLength(1)
    expect(grouped.get('prior_submittal')).toHaveLength(1)
    expect(grouped.get('rfi')).toHaveLength(1)
    expect(grouped.size).toBe(3)
  })
})

describe('CitationsPanel', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <CitationsPanel open={false} onClose={() => {}} citations={sample} />,
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('shows the citation count in the header when open', () => {
    render(<CitationsPanel open onClose={() => {}} citations={sample} />)
    expect(screen.getByText('Citations')).toBeInTheDocument()
    expect(screen.getByText('(3)')).toBeInTheDocument()
  })

  it('renders one group per kind present', () => {
    render(<CitationsPanel open onClose={() => {}} citations={sample} />)
    expect(screen.getAllByText('Spec section').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Prior submittal').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('RFI').length).toBeGreaterThanOrEqual(1)
  })

  it('selects the first citation on open and renders its preview', () => {
    render(<CitationsPanel open onClose={() => {}} citations={sample} />)
    // Label appears in both the left-rail card and the right-pane header.
    expect(screen.getAllByText('08 41 13 §2.04.B.3').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Page 47 preview/i)).toBeInTheDocument()
  })

  it('switches preview when a different card is clicked', () => {
    render(<CitationsPanel open onClose={() => {}} citations={sample} />)
    // Click the left-rail card (first occurrence) to switch the preview.
    const cards = screen.getAllByText('#RFI-019')
    fireEvent.click(cards[0])
    expect(screen.getByText(/wet-glaze method/i)).toBeInTheDocument()
  })

  it('closes when the X button is clicked', () => {
    const onClose = vi.fn()
    render(<CitationsPanel open onClose={onClose} citations={sample} />)
    fireEvent.click(screen.getByLabelText('Close citations'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows empty-state copy when no citations', () => {
    render(<CitationsPanel open onClose={() => {}} citations={[]} />)
    expect(screen.getByText(/no citations on this submittal yet/i)).toBeInTheDocument()
  })
})
