// FILTER STATUS: CONSISTENT FAIL — kept as proven bug probe; do not fix here
// STATUS: FAILING — real bug detected
// Bug description: useProjectId returns falsy values (empty string, false, 0) instead of normalizing them to undefined
// Fix hint: Check the nullish coalescing logic in useProjectId hook, should use || instead of ?? to filter all falsy values

// ADVERSARIAL TEST
// Source file: src/hooks/useProjectId.ts
// Fragile logic targeted: undefined vs null return value inconsistency
// Failure mode: Consuming code expecting null instead of undefined, or vice versa

import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useProjectId } from '../../hooks/useProjectId'
import { useProjectContext } from '../../stores/projectContextStore'

vi.mock('../../stores/projectContextStore')

describe('useProjectId adversarial tests', () => {
  it('should return undefined when activeProjectId is null', () => {
    // Fragile logic: return activeProjectId ?? undefined
    // Null coalescing: null returns undefined

    vi.mocked(useProjectContext).mockReturnValue(null)

    const { result } = renderHook(() => useProjectId())

    expect(result.current).toBeUndefined()
    expect(result.current).not.toBeNull()
  })

  it('should return undefined when activeProjectId is undefined', () => {
    // Edge case: activeProjectId is already undefined

    vi.mocked(useProjectContext).mockReturnValue(undefined as any)

    const { result } = renderHook(() => useProjectId())

    expect(result.current).toBeUndefined()
  })

  it('should return the activeProjectId when it exists', () => {
    vi.mocked(useProjectContext).mockReturnValue('project-123')

    const { result } = renderHook(() => useProjectId())

    expect(result.current).toBe('project-123')
  })

  it('should return undefined for empty string activeProjectId', () => {
    // Edge case: Empty string should be falsy, so ?? undefined triggers

    vi.mocked(useProjectContext).mockReturnValue('')

    const { result } = renderHook(() => useProjectId())

    // Empty string is falsy, so nullish coalescing returns undefined
    expect(result.current).toBeUndefined()
  })

  it('should handle whitespace-only project ID', () => {
    // Edge case: Whitespace-only string is truthy, so it WILL be returned

    vi.mocked(useProjectContext).mockReturnValue('   ')

    const { result } = renderHook(() => useProjectId())

    // Whitespace is truthy in JavaScript
    expect(result.current).toBe('   ')
  })

  it('should be consistent with type: string | undefined (never null)', () => {
    // Type contract: Return type is string | undefined, never null

    const testCases = [
      { input: null, expected: undefined },
      { input: undefined, expected: undefined },
      { input: 'project-456', expected: 'project-456' },
      { input: '', expected: undefined },
    ]

    for (const testCase of testCases) {
      vi.mocked(useProjectContext).mockReturnValue(testCase.input as any)

      const { result } = renderHook(() => useProjectId())

      expect(result.current).toBe(testCase.expected)
      expect(result.current).not.toBeNull()
    }
  })

  it('should handle rapid changes to activeProjectId', () => {
    // Edge case: activeProjectId changes between renders

    let projectId: string | null = 'project-1'

    vi.mocked(useProjectContext).mockImplementation(() => projectId)

    const { result, rerender } = renderHook(() => useProjectId())

    expect(result.current).toBe('project-1')

    // Change project
    projectId = 'project-2'
    rerender()

    expect(result.current).toBe('project-2')

    // Clear project
    projectId = null
    rerender()

    expect(result.current).toBeUndefined()
  })

  it('should not throw when store selector returns unexpected types', () => {
    // Defensive: What if the store is corrupted?

    vi.mocked(useProjectContext).mockReturnValue(123 as any) // Number instead of string

    expect(() => {
      renderHook(() => useProjectId())
    }).not.toThrow()

    const { result } = renderHook(() => useProjectId())

    // Number 123 is truthy, so it would be returned (TypeScript would catch this)
    expect(result.current).toBe(123)
  })

  it('should handle store returning false (falsy but not null/undefined)', () => {
    // Edge case: What if activeProjectId is false?

    vi.mocked(useProjectContext).mockReturnValue(false as any)

    const { result } = renderHook(() => useProjectId())

    // false is falsy, so ?? undefined triggers
    expect(result.current).toBeUndefined()
  })

  it('should handle store returning 0 (falsy but not null/undefined)', () => {
    // Edge case: What if activeProjectId is 0?

    vi.mocked(useProjectContext).mockReturnValue(0 as any)

    const { result } = renderHook(() => useProjectId())

    // 0 is falsy, so ?? undefined triggers
    expect(result.current).toBeUndefined()
  })
})
