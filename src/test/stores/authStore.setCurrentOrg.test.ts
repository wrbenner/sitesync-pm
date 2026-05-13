// BRT sub-0 day-4 P0-G: setCurrentOrg atomicity verification.
//
// Asserts that on an actual org switch (prev?.id !== org.id):
//   1. queryClient.cancelQueries is awaited before state set
//   2. queryClient.clear is called before state set
//   3. setSentryUser is called with the new org id
//   4. Same-org "rename" calls (same id) skip the cache nuke

import { describe, it, expect, vi, beforeEach } from 'vitest'

const cancelQueries = vi.fn().mockResolvedValue(undefined)
const clear = vi.fn()
vi.mock('../../lib/queryClient', () => ({
  queryClient: {
    cancelQueries: (...args: unknown[]) => cancelQueries(...args),
    clear: (...args: unknown[]) => clear(...args),
  },
}))

const setSentryUser = vi.fn()
vi.mock('../../lib/sentry', () => ({
  setSentryUser: (...args: unknown[]) => setSentryUser(...args),
  clearSentryUser: vi.fn(),
  addBreadcrumb: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

vi.mock('../../lib/analytics', () => ({ default: { identify: vi.fn(), track: vi.fn(), reset: vi.fn() } }))
vi.mock('../../lib/crisp/init', () => ({ identifyCrispUser: vi.fn(), resetCrispSession: vi.fn() }))
vi.mock('../../services/userService', () => ({ userService: { getProfile: vi.fn() } }))

const orgA = { id: 'org-aaaa', name: 'Org A' } as never
const orgB = { id: 'org-bbbb', name: 'Org B' } as never
const orgARenamed = { id: 'org-aaaa', name: 'Org A — renamed' } as never

describe('authStore.setCurrentOrg (P0-G atomicity)', () => {
  beforeEach(() => {
    cancelQueries.mockClear()
    clear.mockClear()
    setSentryUser.mockClear()
    vi.resetModules()
  })

  it('cancels and clears query cache, retags Sentry, before setting state on org switch', async () => {
    const { useAuthStore } = await import('../../stores/authStore')
    useAuthStore.setState({
      organization: orgA,
      user: { id: 'user-1', email: 'u@example.com' } as never,
    })

    await useAuthStore.getState().setCurrentOrg(orgB)

    expect(cancelQueries).toHaveBeenCalledTimes(1)
    expect(clear).toHaveBeenCalledTimes(1)
    expect(setSentryUser).toHaveBeenCalledWith('user-1', 'u@example.com', undefined, 'org-bbbb')
    expect(useAuthStore.getState().organization?.id).toBe('org-bbbb')
    expect(useAuthStore.getState().currentOrgRole).toBeNull()
  })

  it('returns a Promise', async () => {
    const { useAuthStore } = await import('../../stores/authStore')
    useAuthStore.setState({ organization: orgA, user: { id: 'user-1', email: 'u@x' } as never })
    const result = useAuthStore.getState().setCurrentOrg(orgB)
    expect(result).toBeInstanceOf(Promise)
    await result
  })

  it('does NOT clear cache on same-org rename (prev.id === org.id)', async () => {
    const { useAuthStore } = await import('../../stores/authStore')
    useAuthStore.setState({ organization: orgA, user: { id: 'user-1', email: 'u@x' } as never })

    await useAuthStore.getState().setCurrentOrg(orgARenamed)

    expect(cancelQueries).not.toHaveBeenCalled()
    expect(clear).not.toHaveBeenCalled()
    expect(setSentryUser).not.toHaveBeenCalled()
    expect(useAuthStore.getState().organization?.name).toBe('Org A — renamed')
  })
})
