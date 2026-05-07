// Phase 2 — row-checkbox selection state for the Items view.
//
// Selection persists across pagination but clears on filter or view-tab
// change. The hook is uncontrolled: page passes the current set of visible
// row IDs so toggleAll knows which rows to flip.
// Phase 3 wires this into the Bulk Actions menu.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface UseSubmittalSelectionOptions {
  /**
   * When this stable token changes, selection clears. Pass a value that
   * encodes "filter + view-tab" together. Pagination should NOT change it.
   */
  resetToken: string
}

export interface UseSubmittalSelectionResult {
  selectedIds: Set<string>
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  toggleMany: (ids: string[], select?: boolean) => void
  toggleAll: (visibleIds: string[]) => void
  clear: () => void
  size: number
  /** Header-checkbox tri-state for the visible page: 'all' | 'some' | 'none'. */
  headerStateFor: (visibleIds: string[]) => 'all' | 'some' | 'none'
}

export function useSubmittalSelection(
  { resetToken }: UseSubmittalSelectionOptions,
): UseSubmittalSelectionResult {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const lastResetRef = useRef<string>(resetToken)

  useEffect(() => {
    if (lastResetRef.current !== resetToken) {
      lastResetRef.current = resetToken
      setSelectedIds(new Set())
    }
  }, [resetToken])

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  )

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleMany = useCallback((ids: string[], select?: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const target = select === undefined
        ? !ids.every((id) => next.has(id))
        : select
      for (const id of ids) {
        if (target) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback((visibleIds: string[]) => {
    setSelectedIds((prev) => {
      const allOn = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allOn) {
        for (const id of visibleIds) next.delete(id)
      } else {
        for (const id of visibleIds) next.add(id)
      }
      return next
    })
  }, [])

  const clear = useCallback(() => setSelectedIds(new Set()), [])

  const headerStateFor = useCallback(
    (visibleIds: string[]): 'all' | 'some' | 'none' => {
      if (visibleIds.length === 0) return 'none'
      let count = 0
      for (const id of visibleIds) if (selectedIds.has(id)) count += 1
      if (count === 0) return 'none'
      if (count === visibleIds.length) return 'all'
      return 'some'
    },
    [selectedIds],
  )

  const size = selectedIds.size

  return useMemo(
    () => ({ selectedIds, isSelected, toggle, toggleMany, toggleAll, clear, size, headerStateFor }),
    [selectedIds, isSelected, toggle, toggleMany, toggleAll, clear, size, headerStateFor],
  )
}
