import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Breadcrumbs } from './Breadcrumbs'

describe('Breadcrumbs — empty state', () => {
  it('renders nothing when items is empty (no <nav>)', () => {
    const { container } = render(<Breadcrumbs items={[]} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('Breadcrumbs — landmark + ARIA', () => {
  it('renders a <nav aria-label="Breadcrumb"> landmark', () => {
    const { getByRole } = render(
      <Breadcrumbs items={[{ label: 'Home' }, { label: 'Projects' }]} />,
    )
    const nav = getByRole('navigation', { name: 'Breadcrumb' })
    expect(nav).toBeTruthy()
  })

  it('the last item is marked aria-current="page"', () => {
    const { getByText } = render(
      <Breadcrumbs items={[{ label: 'Home' }, { label: 'Settings' }]} />,
    )
    const settings = getByText('Settings')
    expect(settings.getAttribute('aria-current')).toBe('page')
  })

  it('non-last items are NOT aria-current', () => {
    const { getByText } = render(
      <Breadcrumbs items={[{ label: 'Home' }, { label: 'Settings' }]} />,
    )
    expect(getByText('Home').getAttribute('aria-current')).toBe(null)
  })
})

describe('Breadcrumbs — chevron separators', () => {
  it('renders one fewer chevron than items (between items only)', () => {
    const { container } = render(
      <Breadcrumbs items={[{ label: 'A' }, { label: 'B' }, { label: 'C' }]} />,
    )
    // 3 items → 2 chevron SVGs
    const chevrons = container.querySelectorAll('svg[aria-hidden="true"]')
    expect(chevrons).toHaveLength(2)
  })

  it('A single item produces zero chevrons (no leading chevron)', () => {
    const { container } = render(<Breadcrumbs items={[{ label: 'Home' }]} />)
    const chevrons = container.querySelectorAll('svg[aria-hidden="true"]')
    expect(chevrons).toHaveLength(0)
  })
})

describe('Breadcrumbs — link / button interaction', () => {
  it('Item with href renders an <a> with that href', () => {
    const { getByText } = render(
      <Breadcrumbs items={[{ label: 'Projects', href: '/projects' }, { label: 'Detail' }]} />,
    )
    const link = getByText('Projects').closest('a')!
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe('/projects')
  })

  it('Item with href + onClick prevents default navigation and fires onClick', () => {
    const onClick = vi.fn()
    const { getByText } = render(
      <Breadcrumbs items={[
        { label: 'Projects', href: '/projects', onClick },
        { label: 'Detail' },
      ]} />,
    )
    const link = getByText('Projects').closest('a')!
    fireEvent.click(link)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('Item without href but with onClick renders a <button>', () => {
    const onClick = vi.fn()
    const { getByText } = render(
      <Breadcrumbs items={[
        { label: 'Back', onClick },
        { label: 'Now' },
      ]} />,
    )
    const btn = getByText('Back').closest('button')!
    expect(btn).toBeTruthy()
    expect(btn.getAttribute('type')).toBe('button')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('Last item (current page) is rendered as a <span>, not a link or button', () => {
    const { getByText } = render(
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Now' }]} />,
    )
    const last = getByText('Now')
    expect(last.tagName).toBe('SPAN')
  })

  it('Last item ignores its own href / onClick props (no double-render trap)', () => {
    const onClick = vi.fn()
    const { getByText } = render(
      <Breadcrumbs items={[
        { label: 'Home', href: '/' },
        { label: 'Last', href: '/last', onClick },
      ]} />,
    )
    const last = getByText('Last')
    expect(last.tagName).toBe('SPAN')
    fireEvent.click(last)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('Item with neither href nor onClick still renders as a button (no a-without-href)', () => {
    const { getByText } = render(
      <Breadcrumbs items={[{ label: 'Crumb' }, { label: 'Now' }]} />,
    )
    expect(getByText('Crumb').closest('button')).toBeTruthy()
  })
})

describe('Breadcrumbs — rendering N items', () => {
  it('Renders the labels in order', () => {
    const { container } = render(
      <Breadcrumbs items={[
        { label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' },
      ]} />,
    )
    const labels = Array.from(container.querySelectorAll('li'))
      .map(li => (li.textContent || '').trim())
    expect(labels).toEqual(['A', 'B', 'C', 'D'])
  })
})
