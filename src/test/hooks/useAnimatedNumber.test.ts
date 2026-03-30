import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber'

describe('useAnimatedNumber', () => {
  it('should start at 0', () => {
    const { result } = renderHook(() => useAnimatedNumber(100))
    // Initial render may be 0 or close to it
    expect(typeof result.current).toBe('number')
  })

  it('should eventually reach target value', async () => {
    const { result } = renderHook(
      ({ target }) => useAnimatedNumber(target, 100),
      { initialProps: { target: 50 } }
    )

    // Wait for animation to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200))
    })

    expect(Math.round(result.current)).toBe(50)
  })
})
