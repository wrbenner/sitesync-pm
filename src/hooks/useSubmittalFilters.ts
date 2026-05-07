// Phase 3 — URL-state-backed filter management for the submittals page.
//
// Filter values round-trip through the URL: ?filter[approver]=u1,u2&filter[status]=in_review
// so a coordinator can paste a URL into Slack and the recipient lands on the
// same filtered view. Re-saving on URL change goes through react-router's
// useSearchParams to keep the route hash + history in sync.

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CHIPS_BY_ID,
  decodeFiltersFromUrl,
  encodeFiltersToUrl,
  type ActiveFilters,
  type ChipDefinition,
} from '../components/submittals/FilterChips/filterDefinitions'

export interface UseSubmittalFiltersResult {
  /** Decoded active filters keyed by chip id. */
  filters: ActiveFilters
  /** True iff at least one chip has a value. */
  hasAny: boolean
  /** Active chip definitions (those with a value), in registry order. */
  activeChips: ChipDefinition[]
  /** Set or replace a chip's value. Pass undefined to clear. */
  setChip: (chipId: string, value: unknown | undefined) => void
  /** Clear a specific chip. */
  clearChip: (chipId: string) => void
  /** Clear all filters. */
  clearAll: () => void
  /** Apply a saved view's filter snapshot wholesale (clears prior filters). */
  applySavedFilters: (next: ActiveFilters) => void
  /** Stable token for the current filter set; useful for selection-reset hooks. */
  filtersToken: string
}

export function useSubmittalFilters(): UseSubmittalFiltersResult {
  const [params, setParams] = useSearchParams()

  const filters = useMemo(() => decodeFiltersFromUrl(params), [params])

  const activeChips = useMemo(() => {
    const ids = Object.keys(filters)
    return ids.map((id) => CHIPS_BY_ID[id]).filter(Boolean) as ChipDefinition[]
  }, [filters])

  const hasAny = activeChips.length > 0

  const writeFilters = useCallback((next: ActiveFilters) => {
    const updated = encodeFiltersToUrl(params, next)
    setParams(updated, { replace: false })
  }, [params, setParams])

  const setChip = useCallback((chipId: string, value: unknown | undefined) => {
    const next = { ...filters }
    if (value === undefined || value === null) {
      delete next[chipId]
    } else {
      next[chipId] = value
    }
    writeFilters(next)
  }, [filters, writeFilters])

  const clearChip = useCallback((chipId: string) => {
    if (!(chipId in filters)) return
    const next = { ...filters }
    delete next[chipId]
    writeFilters(next)
  }, [filters, writeFilters])

  const clearAll = useCallback(() => {
    writeFilters({})
  }, [writeFilters])

  const applySavedFilters = useCallback((next: ActiveFilters) => {
    writeFilters(next)
  }, [writeFilters])

  const filtersToken = useMemo(() => {
    const ids = Object.keys(filters).sort()
    return ids.map((id) => {
      const v = filters[id]
      try { return `${id}=${JSON.stringify(v)}` } catch { return `${id}=?` }
    }).join('&')
  }, [filters])

  return { filters, hasAny, activeChips, setChip, clearChip, clearAll, applySavedFilters, filtersToken }
}
