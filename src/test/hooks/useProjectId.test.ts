import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useProjectId } from '../../hooks/useProjectId'

const mockActiveProjectId = vi.fn<() => string | null>()

vi.mock('../../stores/projectStore', () => ({
  useProjectStore: (selector: (s: { activeProjectId: string | null }) => unknown) =>
    selector({ activeProjectId: mockActiveProjectId() }),
}))

describe('useProjectId', () => {
  beforeEach(() => {
    mockActiveProjectId.mockReset()
  })

  it('returns the active project ID from the context store', () => {
    mockActiveProjectId.mockReturnValue('11111111-1111-4111-a111-111111111111')
    const { result } = renderHook(() => useProjectId())
    expect(result.current).toBe('11111111-1111-4111-a111-111111111111')
  })

  it('returns undefined when no project is active', () => {
    mockActiveProjectId.mockReturnValue(null)
    const { result } = renderHook(() => useProjectId())
    expect(result.current).toBeUndefined()
  })
})
