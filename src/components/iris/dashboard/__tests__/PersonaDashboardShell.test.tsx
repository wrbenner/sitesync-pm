// ────────────────────────────────────────────────────────────────────────────
// PersonaDashboardShell tests — Phase 1d
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §6

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import {
  PersonaDashboardShell,
  type PersonaCardSpec,
} from '../PersonaDashboardShell'

const FIXTURE_CARDS: PersonaCardSpec[] = [
  {
    id: 'card-one',
    title: 'Card one',
    description: 'First test card',
    placeholder: 'Loading…',
  },
  {
    id: 'card-two',
    title: 'Card two',
    description: 'Second test card',
    placeholder: 'Loading…',
    cta: { label: 'Open', to: '/rfis' },
  },
]

function renderShell(props: Parameters<typeof PersonaDashboardShell>[0]) {
  return render(
    <MemoryRouter>
      <PersonaDashboardShell {...props} />
    </MemoryRouter>,
  )
}

describe('PersonaDashboardShell', () => {
  it('renders the persona display name as the header', () => {
    renderShell({ persona: 'pm', resolved: true, cards: FIXTURE_CARDS })
    expect(screen.getByRole('heading', { name: /Project Manager home/ })).toBeTruthy()
  })

  it('renders every card by id + title + description + placeholder', () => {
    renderShell({ persona: 'pm', resolved: true, cards: FIXTURE_CARDS })
    expect(screen.getByTestId('persona-card-card-one')).toBeTruthy()
    expect(screen.getByTestId('persona-card-card-two')).toBeTruthy()
    expect(screen.getByText('Card one')).toBeTruthy()
    expect(screen.getByText('First test card')).toBeTruthy()
    expect(screen.getAllByText('Loading…').length).toBe(2)
  })

  it('omits the fallback banner when persona is resolved', () => {
    renderShell({ persona: 'office', resolved: true, cards: FIXTURE_CARDS })
    expect(screen.queryByTestId('persona-fallback-banner')).toBeNull()
  })

  it('shows the fallback banner when persona is NOT resolved', () => {
    renderShell({ persona: 'pm', resolved: false, cards: FIXTURE_CARDS })
    const banner = screen.getByTestId('persona-fallback-banner')
    expect(banner).toBeTruthy()
    expect(banner.textContent).toContain('Project Manager')
    expect(banner.textContent).toContain('administrator')
  })

  it('renders a CTA link when card.cta is provided', () => {
    renderShell({ persona: 'pm', resolved: true, cards: FIXTURE_CARDS })
    const link = screen.getByRole('link', { name: /Open/ })
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe('/rfis')
  })

  it('renders different headers for each persona slug', () => {
    const personas: Array<{ slug: 'pm' | 'superintendent' | 'office'; match: RegExp }> = [
      { slug: 'pm', match: /Project Manager/ },
      { slug: 'superintendent', match: /Superintendent/ },
      { slug: 'office', match: /Office/ },
    ]
    for (const p of personas) {
      const { unmount } = renderShell({ persona: p.slug, resolved: true, cards: FIXTURE_CARDS })
      expect(screen.getByRole('heading', { name: p.match })).toBeTruthy()
      unmount()
    }
  })

  it('sets a stable data-testid on the dashboard root by persona', () => {
    renderShell({ persona: 'superintendent', resolved: true, cards: FIXTURE_CARDS })
    expect(screen.getByTestId('persona-dashboard-superintendent')).toBeTruthy()
  })
})
