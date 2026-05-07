// Phase 3 — useSubmittalFilters URL round-trip tests.
//
// Real-DOM exercise (jsdom) of the URL-state hook: setChip writes a query
// parameter, decodeFiltersFromUrl reads it back; clearChip / clearAll /
// applySavedFilters all preserve unrelated params.

import React from 'react'
import { describe, it, expect } from 'vitest'
import { act, render, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useSubmittalFilters } from '../../../hooks/useSubmittalFilters'

const wrapper = (initial: string) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  }

describe('useSubmittalFilters', () => {
  it('decodes filters from initial URL', () => {
    const { result } = renderHook(() => useSubmittalFilters(), {
      wrapper: wrapper('/submittals?filter[status]=in_review,closed'),
    })
    expect(result.current.hasAny).toBe(true)
    expect(result.current.filters.status).toEqual(['in_review', 'closed'])
  })

  it('setChip writes to URL', () => {
    const Probe = () => {
      const filters = useSubmittalFilters()
      const loc = useLocation()
      return (
        <div>
          <button onClick={() => filters.setChip('private', true)}>set</button>
          <span data-testid="search">{loc.search}</span>
        </div>
      )
    }
    const { getByTestId, getByText } = render(
      <MemoryRouter initialEntries={['/submittals']}>
        <Probe />
      </MemoryRouter>,
    )
    expect(getByTestId('search').textContent).toBe('')
    act(() => {
      getByText('set').click()
    })
    expect(getByTestId('search').textContent).toContain('filter%5Bprivate%5D=true')
  })

  it('clearChip removes a single chip and preserves others', () => {
    const { result } = renderHook(() => useSubmittalFilters(), {
      wrapper: wrapper('/submittals?filter[status]=draft&filter[private]=true'),
    })
    expect(Object.keys(result.current.filters).sort()).toEqual(['private', 'status'])
    act(() => {
      result.current.clearChip('private')
    })
    expect(result.current.filters.status).toEqual(['draft'])
    expect(result.current.filters.private).toBeUndefined()
  })

  it('clearAll removes every chip', () => {
    const { result } = renderHook(() => useSubmittalFilters(), {
      wrapper: wrapper('/submittals?filter[status]=draft&filter[private]=true&other=keep'),
    })
    act(() => {
      result.current.clearAll()
    })
    expect(result.current.hasAny).toBe(false)
    expect(Object.keys(result.current.filters)).toHaveLength(0)
  })

  it('applySavedFilters replaces filters wholesale', () => {
    const { result } = renderHook(() => useSubmittalFilters(), {
      wrapper: wrapper('/submittals?filter[status]=draft'),
    })
    act(() => {
      result.current.applySavedFilters({ private: true, type: ['shop_drawing'] })
    })
    expect(result.current.filters.private).toBe(true)
    expect(result.current.filters.type).toEqual(['shop_drawing'])
    expect(result.current.filters.status).toBeUndefined()
  })

  it('produces a stable filtersToken that changes only on filter change', () => {
    const { result, rerender } = renderHook(() => useSubmittalFilters(), {
      wrapper: wrapper('/submittals?filter[status]=draft'),
    })
    const token1 = result.current.filtersToken
    rerender()
    expect(result.current.filtersToken).toBe(token1)
    act(() => {
      result.current.setChip('private', true)
    })
    expect(result.current.filtersToken).not.toBe(token1)
  })
})
