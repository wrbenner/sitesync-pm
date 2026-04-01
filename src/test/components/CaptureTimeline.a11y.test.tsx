import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import axe from 'axe-core'
import { CaptureTimeline } from '../../components/field/CaptureTimeline'

async function checkCritical(container: HTMLElement) {
  const results = await new Promise<axe.AxeResults>((resolve, reject) => {
    axe.run(
      container,
      { resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } },
      (err, res) => (err ? reject(err) : resolve(res)),
    )
  })
  return results.violations.filter((v) => v.impact === 'critical')
}

const events = [
  { id: 1, type: 'photo' as const, title: 'Foundation pour', time: '9:15 AM', capturedBy: 'J. Smith', preview: 'Concrete placed on grid A3' },
  { id: 2, type: 'voice' as const, title: 'Safety observation', time: '10:30 AM', capturedBy: 'M. Lee' },
  { id: 3, type: 'issue' as const, title: 'Rebar misalignment', time: '11:00 AM', capturedBy: 'K. Jones' },
]

describe('CaptureTimeline accessibility', () => {
  it('has zero critical axe violations', async () => {
    const { container } = render(<CaptureTimeline events={events} />)
    const critical = await checkCritical(container)
    expect(critical).toHaveLength(0)
  })

  it('renders as a list', () => {
    render(<CaptureTimeline events={events} />)
    expect(screen.getByRole('list')).toBeDefined()
  })

  it('each event has role="listitem"', () => {
    render(<CaptureTimeline events={events} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(events.length)
  })

  it('each event has a descriptive aria-label with type and timestamp', () => {
    render(<CaptureTimeline events={events} />)
    expect(screen.getByRole('listitem', { name: /photo capture.*9:15 AM/i })).toBeDefined()
    expect(screen.getByRole('listitem', { name: /voice capture.*10:30 AM/i })).toBeDefined()
    expect(screen.getByRole('listitem', { name: /issue capture.*11:00 AM/i })).toBeDefined()
  })

  it('selectable items receive tabIndex 0', () => {
    const onSelect = vi.fn()
    render(<CaptureTimeline events={events} onSelect={onSelect} />)
    screen.getAllByRole('listitem').forEach((item) => {
      expect(item.getAttribute('tabindex')).toBe('0')
    })
  })

  it('non-selectable items have no tabIndex', () => {
    render(<CaptureTimeline events={events} />)
    screen.getAllByRole('listitem').forEach((item) => {
      expect(item.getAttribute('tabindex')).toBeNull()
    })
  })

  it('activates on Enter key', () => {
    const onSelect = vi.fn()
    render(<CaptureTimeline events={events} onSelect={onSelect} />)
    fireEvent.keyDown(screen.getAllByRole('listitem')[0], { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith(events[0])
  })

  it('activates on Space key', () => {
    const onSelect = vi.fn()
    render(<CaptureTimeline events={events} onSelect={onSelect} />)
    fireEvent.keyDown(screen.getAllByRole('listitem')[1], { key: ' ' })
    expect(onSelect).toHaveBeenCalledWith(events[1])
  })
})
