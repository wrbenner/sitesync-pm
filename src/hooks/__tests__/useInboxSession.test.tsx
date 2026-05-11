/**
 * useInboxSession — stable per-inbox-mount session UUID for Iris telemetry.
 *
 * The session id is the join key the matview uses to count "drafts decided
 * in one sitting." Wrong shape here = wrong shape in the Lap-2 matview, so
 * the contract is worth pinning:
 *   • outside the provider: returns null (decisions on a per-entity detail
 *     page should NOT be counted as inbox-sessions)
 *   • inside the provider: returns a stable UUID for the lifetime of the
 *     mount; every consumer sees the same id
 *   • a second provider tree gets its own id (one inbox-session per mount)
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { InboxSessionProvider, useInboxSession } from '../useInboxSession'

function Probe({ testId }: { testId: string }) {
  const sessionId = useInboxSession()
  return <div data-testid={testId}>{sessionId ?? 'null'}</div>
}

describe('useInboxSession', () => {
  it('returns null when consumed outside the provider', () => {
    render(<Probe testId="probe" />)
    expect(screen.getByTestId('probe').textContent).toBe('null')
  })

  it('returns a UUID when inside the provider, stable across consumers', () => {
    render(
      <InboxSessionProvider>
        <Probe testId="a" />
        <Probe testId="b" />
      </InboxSessionProvider>,
    )
    const a = screen.getByTestId('a').textContent ?? ''
    const b = screen.getByTestId('b').textContent ?? ''
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(a).toBe(b)
  })

  it('mints a fresh id for each provider mount', () => {
    const { unmount: unmountFirst } = render(
      <InboxSessionProvider>
        <Probe testId="first" />
      </InboxSessionProvider>,
    )
    const first = screen.getByTestId('first').textContent ?? ''
    unmountFirst()

    render(
      <InboxSessionProvider>
        <Probe testId="second" />
      </InboxSessionProvider>,
    )
    const second = screen.getByTestId('second').textContent ?? ''

    expect(first).not.toBe(second)
    expect(second).toMatch(/^[0-9a-f-]{36}$/)
  })
})
