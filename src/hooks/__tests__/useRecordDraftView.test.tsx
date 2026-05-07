/**
 * useRecordDraftView — fires `record_draft_view` exactly once per
 * (draftId, sessionId) pair when the card crosses 50% intersection.
 *
 * jsdom does not implement IntersectionObserver. We install a controllable
 * mock that records the constructor args and exposes a `.fire(entry)`
 * helper so each test drives the intersection event directly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

import { __resetRecordedDraftViews, useRecordDraftView } from '../useRecordDraftView'
import { InboxSessionProvider } from '../useInboxSession'

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
  isSupabaseConfigured: true,
}))

interface FakeObserver {
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  fire: (ratio: number) => void
}
let lastObserver: FakeObserver | null = null

class MockIntersectionObserver {
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  fire: (ratio: number) => void
  constructor(cb: IntersectionObserverCallback) {
    this.observe = vi.fn()
    this.disconnect = vi.fn()
    this.fire = (ratio: number) => {
      cb(
        [{ isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      )
    }
    lastObserver = this as unknown as FakeObserver
  }
}

function ProbeCard({ draftId }: { draftId: string }) {
  const ref = useRecordDraftView(draftId)
  return <div data-testid="card" ref={ref} />
}

beforeEach(() => {
  __resetRecordedDraftViews()
  lastObserver = null
  vi.clearAllMocks()
  // Resolve every rpc call successfully unless the test overrides.
  mockRpc.mockResolvedValue({ error: null })
  ;(globalThis as unknown as { IntersectionObserver: typeof MockIntersectionObserver })
    .IntersectionObserver = MockIntersectionObserver
})

afterEach(() => {
  delete (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver
})

describe('useRecordDraftView', () => {
  it('fires record_draft_view once when the card crosses 50% visibility', async () => {
    render(
      <InboxSessionProvider>
        <ProbeCard draftId="00000000-0000-0000-0000-000000000001" />
      </InboxSessionProvider>,
    )
    expect(lastObserver).not.toBeNull()
    await act(async () => {
      lastObserver!.fire(0.6)
    })
    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('record_draft_view', {
      p_draft_id: '00000000-0000-0000-0000-000000000001',
      p_session_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    })
  })

  it('does not fire when the card is below the visibility threshold', async () => {
    render(
      <InboxSessionProvider>
        <ProbeCard draftId="00000000-0000-0000-0000-000000000002" />
      </InboxSessionProvider>,
    )
    await act(async () => {
      lastObserver!.fire(0.2)
    })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('dedupes per session: scrolls in/out 5 times → 1 RPC call', async () => {
    render(
      <InboxSessionProvider>
        <ProbeCard draftId="00000000-0000-0000-0000-000000000003" />
      </InboxSessionProvider>,
    )
    for (let i = 0; i < 5; i++) {
      await act(async () => lastObserver!.fire(0.9))
    }
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  it('skips the RPC entirely when rendered outside InboxSessionProvider', async () => {
    // Behavior change post-PR-#350: record_draft_view now requires a
    // non-null p_session_id (database.ts regen surfaced the contract).
    // Without a session id, the only honest path is to skip the call —
    // synthesising a fake session would corrupt the dedupe set + audit.
    render(<ProbeCard draftId="00000000-0000-0000-0000-000000000004" />)
    await act(async () => lastObserver!.fire(0.7))
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
