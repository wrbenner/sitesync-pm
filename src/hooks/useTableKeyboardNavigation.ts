import { useState, useCallback, useId } from 'react'
import type React from 'react'

interface UseTableKeyboardNavigationOptions {
  rowCount: number
  onActivate?: (index: number) => void
  onToggleSelect?: (index: number) => void
  /** Prefix used to build row element IDs, e.g. "myTable" produces "myTable-row-0". Defaults to a generated ID. */
  rowIdPrefix?: string
}

export function useTableKeyboardNavigation({
  rowCount,
  onActivate,
  onToggleSelect,
  rowIdPrefix,
}: UseTableKeyboardNavigationOptions): {
  focusedIndex: number
  handleKeyDown: (e: React.KeyboardEvent) => void
  /** The id of the currently focused row element, for use as aria-activedescendant on the container. */
  activeRowId: string | undefined
} {
  const generatedPrefix = useId()
  const prefix = rowIdPrefix ?? generatedPrefix
  const [focusedIndex, setFocusedIndex] = useState(0)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (rowCount === 0) return

      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault()
          setFocusedIndex((prev) => Math.min(prev + 1, rowCount - 1))
          break
        case 'ArrowUp':
        case 'k':
          e.preventDefault()
          setFocusedIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Enter': {
          e.preventDefault()
          onActivate?.(focusedIndex)
          break
        }
        case ' ': {
          e.preventDefault()
          onToggleSelect?.(focusedIndex)
          break
        }
      }
    },
    [rowCount, focusedIndex, onActivate, onToggleSelect],
  )

  const activeRowId = rowCount > 0 ? `${prefix}-row-${focusedIndex}` : undefined

  return { focusedIndex, handleKeyDown, activeRowId }
}
