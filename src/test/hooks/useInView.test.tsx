import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import React from 'react'
import { useInView } from '../../hooks/useInView'

// Minimal IntersectionObserver mock that exposes a way to trigger entries.
type IOCallback = (entries: IntersectionObserverEntry[]) => void

let capturedCallback: IOCallback | null = null

const MockIntersectionObserver = vi.fn(function (
  this: IntersectionObserver,
  callback: IOCallback,
  options?: IntersectionObserverInit,
) {
  capturedCallback = callback
  ;(this as unknown as Record<string, unknown>)._options = options
  return this
})
MockIntersectionObserver.prototype.observe = vi.fn()
MockIntersectionObserver.prototype.disconnect = vi.fn()
MockIntersectionObserver.prototype.unobserve = vi.fn()

beforeAll(() => {
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: MockIntersectionObserver,
  })
})

afterEach(() => {
  capturedCallback = null
  vi.clearAllMocks()
})

// Helper component that exposes inView state via data attribute
function TestComponent({ threshold }: { threshold?: number }) {
  const [ref, inView] = useInView(threshold)
  return <div ref={ref} data-in-view={String(inView)} data-testid="target" />
}

describe('useInView', () => {
  it('starts as not in view', () => {
    const { getByTestId } = render(<TestComponent />)
    expect(getByTestId('target').dataset.inView).toBe('false')
  })

  it('becomes true when the element intersects', () => {
    const { getByTestId } = render(<TestComponent />)

    act(() => {
      capturedCallback?.([{ isIntersecting: true } as IntersectionObserverEntry])
    })

    expect(getByTestId('target').dataset.inView).toBe('true')
  })

  it('does not become true when isIntersecting is false', () => {
    const { getByTestId } = render(<TestComponent />)

    act(() => {
      capturedCallback?.([{ isIntersecting: false } as IntersectionObserverEntry])
    })

    expect(getByTestId('target').dataset.inView).toBe('false')
  })

  it('calls disconnect after first intersection (one-shot behaviour)', () => {
    render(<TestComponent />)

    act(() => {
      capturedCallback?.([{ isIntersecting: true } as IntersectionObserverEntry])
    })

    expect(MockIntersectionObserver.prototype.disconnect).toHaveBeenCalled()
  })

  it('accepts a custom threshold and passes it to IntersectionObserver', () => {
    render(<TestComponent threshold={0.5} />)
    expect(MockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ threshold: 0.5 }),
    )
  })

  it('cleans up observer on unmount', () => {
    const { unmount } = render(<TestComponent />)
    unmount()
    expect(MockIntersectionObserver.prototype.disconnect).toHaveBeenCalled()
  })

  it('re-subscribes when threshold changes', () => {
    const { rerender } = render(<TestComponent threshold={0.1} />)
    const firstCallCount = MockIntersectionObserver.mock.calls.length
    rerender(<TestComponent threshold={0.9} />)
    expect(MockIntersectionObserver.mock.calls.length).toBeGreaterThan(firstCallCount)
  })
})
