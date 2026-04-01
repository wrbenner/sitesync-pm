import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VoiceCapture } from '../../components/field/VoiceCapture'

vi.mock('../../hooks/useVoiceCapture', () => ({
  useVoiceCapture: () => ({
    phase: 'idle',
    elapsed: 0,
    transcript: '',
    interimText: '',
    waveform: { frequencies: Array(32).fill(0) },
    entities: [],
    audioBlob: null,
    audioUrl: null,
    extractionResult: null,
    detectedLanguage: null,
    language: 'en-US',
    languageOptions: [{ value: 'en-US', label: 'English (US)' }],
    pendingSync: 0,
    error: null,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    removeEntity: vi.fn(),
    reset: vi.fn(),
    setLanguage: vi.fn(),
  }),
}))

const noop = () => {}

describe('VoiceCapture accessibility', () => {
  it('renders dialog with aria-modal', () => {
    render(<VoiceCapture onClose={noop} onConfirm={noop} />)
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true')
  })

  it('record button has aria-label "Start voice recording" in idle phase', () => {
    render(<VoiceCapture onClose={noop} onConfirm={noop} />)
    expect(screen.getByRole('button', { name: 'Start voice recording' })).toBeDefined()
  })

  it('aria-live polite region is present', () => {
    const { container } = render(<VoiceCapture onClose={noop} onConfirm={noop} />)
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull()
  })

  it('close button is keyboard accessible', () => {
    render(<VoiceCapture onClose={noop} onConfirm={noop} />)
    const closeBtn = screen.getByRole('button', { name: /close/i })
    expect(closeBtn).toBeDefined()
    fireEvent.keyDown(closeBtn, { key: 'Enter' })
  })
})
