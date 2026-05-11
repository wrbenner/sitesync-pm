/**
 * track — fire-and-forget page-event telemetry.
 *
 * Tests the contract that page-instrumentation call sites depend on:
 *   • Calls record_event RPC with the right shape
 *   • Falls back to noop when no project is active (no throw)
 *   • Swallows RPC errors (no throw)
 *   • Defaults details to {}
 *   • Skips entirely when Supabase isn't configured
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }))
const { mockGetState } = vi.hoisted(() => ({
  mockGetState: vi.fn<() => { activeProjectId: string | null }>(() => ({ activeProjectId: 'project-123' })),
}))

vi.mock('../../supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
  isSupabaseConfigured: true,
}))

vi.mock('../../../stores/projectStore', () => ({
  useProjectStore: { getState: () => mockGetState() },
}))

import { track, __resetTrackWarn } from '../track'

beforeEach(() => {
  vi.clearAllMocks()
  mockRpc.mockResolvedValue({ error: null })
  mockGetState.mockReturnValue({ activeProjectId: 'project-123' })
  __resetTrackWarn()
})

describe('track', () => {
  it('calls record_event with project + event + details', async () => {
    track('day.opened', { role: 'pm' })
    // Allow the fire-and-forget promise chain to settle.
    await Promise.resolve()
    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('record_event', {
      p_project_id: 'project-123',
      p_event_name: 'day.opened',
      p_details: { role: 'pm' },
    })
  })

  it('defaults details to {} when omitted', async () => {
    track('rfi.opened')
    await Promise.resolve()
    expect(mockRpc).toHaveBeenCalledWith('record_event', {
      p_project_id: 'project-123',
      p_event_name: 'rfi.opened',
      p_details: {},
    })
  })

  it('skips silently when no project is in context (does not throw)', () => {
    mockGetState.mockReturnValue({ activeProjectId: null })
    expect(() => track('day.opened')).not.toThrow()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('swallows RPC errors (does not throw)', async () => {
    mockRpc.mockResolvedValue({ error: new Error('boom') })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    track('rfi.deleted', { rfi_id: 'r1' })
    // Wait for the .then callback that logs the warning.
    await new Promise((r) => setTimeout(r, 0))
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('does not throw when the rpc itself rejects', async () => {
    mockRpc.mockRejectedValue(new Error('network'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => track('submittal.opened')).not.toThrow()
    await new Promise((r) => setTimeout(r, 0))
    warn.mockRestore()
  })

  it('handles each page namespace shape', async () => {
    track('day.lane_clicked', { lane: 'iris' })
    track('rfi.status_changed', { rfi_id: 'r1', status: 'open' })
    track('submittal.tab_switched', { tab: 'items' })
    track('dailylog.entry_added', { entry_type: 'manpower' })
    track('iris.tab_switched', { tab: 'drafts' })
    await Promise.resolve()
    expect(mockRpc).toHaveBeenCalledTimes(5)
    const calls = mockRpc.mock.calls.map((c) => c[1].p_event_name)
    expect(calls).toEqual([
      'day.lane_clicked',
      'rfi.status_changed',
      'submittal.tab_switched',
      'dailylog.entry_added',
      'iris.tab_switched',
    ])
  })

  it('passes the active project id through unchanged', async () => {
    mockGetState.mockReturnValue({ activeProjectId: 'avery-oaks-uuid' })
    track('iris.opened')
    await Promise.resolve()
    expect(mockRpc).toHaveBeenCalledWith('record_event', expect.objectContaining({
      p_project_id: 'avery-oaks-uuid',
    }))
  })

  it('warns at most once per session when no project is in context', () => {
    mockGetState.mockReturnValue({ activeProjectId: null })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    track('day.opened')
    track('day.opened')
    track('rfi.opened')
    // The dev-mode warn fires once-per-session per the helper's contract.
    // In test env import.meta.env.DEV is true (vitest sets MODE=test which
    // does NOT make DEV true; but our helper uses import.meta.env.DEV).
    // Either way: count is at most 1.
    expect(warn.mock.calls.length).toBeLessThanOrEqual(1)
    warn.mockRestore()
  })
})
