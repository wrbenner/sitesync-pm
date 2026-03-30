import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useProjectId } from '../../hooks/useProjectId'

describe('useProjectId', () => {
  it('should return the seed project ID', () => {
    const { result } = renderHook(() => useProjectId())
    expect(result.current).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  })

  it('should return a string', () => {
    const { result } = renderHook(() => useProjectId())
    expect(typeof result.current).toBe('string')
  })
})
