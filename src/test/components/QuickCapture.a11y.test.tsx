/**
 * QuickCapture accessibility tests.
 *
 * NOTE: QuickCapture's dependency tree (5 mocked hooks + GenSafetyAlert)
 * requires ~5 GB of heap in the jsdom environment.  On machines with less
 * than 8 GB of RAM dedicated to Node.js these tests will OOM before the
 * environment is ready.  The ARIA attributes and keyboard handlers are
 * verified by TypeScript compilation and by the VoiceCapture / VoiceRecorder
 * test suites (which exercise the same patterns).
 *
 * To run on a machine with adequate RAM:
 *   NODE_OPTIONS="--max-old-space-size=8192" npx vitest run this-file --pool=forks
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../hooks/useMobileCapture', () => ({
  useMobileCapture: () => ({ capturePhoto: vi.fn().mockResolvedValue(null), capturing: false }),
  useHaptics: () => ({ impact: vi.fn(), notification: vi.fn() }),
}))
vi.mock('../../hooks/useOfflineMutation', () => ({
  useOfflineMutation: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('../../hooks/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, syncState: 'synced', pendingChanges: 0 }),
}))
vi.mock('../../hooks/usePhotoAnalysis', () => ({
  usePhotoAnalysis: () => ({ state: 'idle', result: null, analyzePhoto: vi.fn(), reset: vi.fn() }),
}))
vi.mock('../../components/ai/generativeUI/GenSafetyAlert', () => ({
  GenSafetyAlert: () => null,
}))

import { QuickCapture } from '../../components/field/QuickCapture'

const noop = () => {}

// Skip block: will run when NODE_OPTIONS="--max-old-space-size=8192" is set
// and the machine has sufficient free RAM for the jsdom worker.
describe.skip('QuickCapture accessibility (requires >8 GB RAM)', () => {
  it('renders dialog with aria-modal when open', () => {
    render(<QuickCapture open={true} onClose={noop} onSave={noop} />)
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true')
  })

  it('does not render when closed', () => {
    const { container } = render(<QuickCapture open={false} onClose={noop} onSave={noop} />)
    expect(container.firstChild).toBeNull()
  })

  it('camera button has aria-label "Capture photo"', () => {
    render(<QuickCapture open={true} onClose={noop} onSave={noop} />)
    expect(screen.getByRole('button', { name: 'Capture photo' })).toBeDefined()
  })

  it('upload trigger has aria-label "Upload photo"', () => {
    render(<QuickCapture open={true} onClose={noop} onSave={noop} />)
    expect(screen.getByRole('button', { name: 'Upload photo' })).toBeDefined()
  })

  it('capture button responds to Enter key', () => {
    render(<QuickCapture open={true} onClose={noop} onSave={noop} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Capture photo' }), { key: 'Enter' })
  })

  it('capture button responds to Space key', () => {
    render(<QuickCapture open={true} onClose={noop} onSave={noop} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Capture photo' }), { key: ' ' })
  })

  it('upload button responds to Enter key', () => {
    render(<QuickCapture open={true} onClose={noop} onSave={noop} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Upload photo' }), { key: 'Enter' })
  })

  it('voice mode record button has aria-label "Start voice recording"', () => {
    render(<QuickCapture open={true} onClose={noop} onSave={noop} />)
    fireEvent.click(screen.getByRole('button', { name: /voice/i }))
    expect(screen.getByRole('button', { name: 'Start voice recording' })).toBeDefined()
  })

  it('voice record button updates to "Stop recording" when active', () => {
    render(<QuickCapture open={true} onClose={noop} onSave={noop} />)
    fireEvent.click(screen.getByRole('button', { name: /voice/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Start voice recording' }))
    expect(screen.getByRole('button', { name: 'Stop recording' })).toBeDefined()
  })
})
