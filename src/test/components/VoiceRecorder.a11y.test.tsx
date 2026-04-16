import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import axe from 'axe-core'
import { VoiceRecorder } from '../../components/field/VoiceRecorder'

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

const noop = () => {}

describe('VoiceRecorder accessibility', () => {
  it('has zero critical axe violations', async () => {
    const { container } = render(<VoiceRecorder onClose={noop} onSave={noop} />)
    const critical = await checkCritical(container)
    expect(critical).toHaveLength(0)
  })

  it('renders as a dialog with aria-modal', () => {
    render(<VoiceRecorder onClose={noop} onSave={noop} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('record button starts with aria-label "Start voice recording"', () => {
    render(<VoiceRecorder onClose={noop} onSave={noop} />)
    expect(screen.getByRole('button', { name: 'Start voice recording' })).toBeDefined()
  })

  it('record button label updates to "Stop recording" when active', () => {
    render(<VoiceRecorder onClose={noop} onSave={noop} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start voice recording' }))
    expect(screen.getByRole('button', { name: 'Stop recording' })).toBeDefined()
  })

  it('close button has descriptive aria-label', () => {
    render(<VoiceRecorder onClose={noop} onSave={noop} />)
    expect(screen.getByRole('button', { name: /close/i })).toBeDefined()
  })

  it('aria-live polite region is present', () => {
    const { container } = render(<VoiceRecorder onClose={noop} onSave={noop} />)
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull()
  })

  it('all buttons have no tabindex -1', () => {
    render(<VoiceRecorder onClose={noop} onSave={noop} />)
    screen.getAllByRole('button').forEach((btn) => {
      expect(btn.getAttribute('tabindex')).not.toBe('-1')
    })
  })
})
