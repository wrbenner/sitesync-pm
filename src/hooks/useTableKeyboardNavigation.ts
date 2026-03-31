import { useEffect, useCallback } from 'react'

/**
 * Adds arrow-key navigation to data tables and lists.
 * When a row is focused/selected, ArrowUp/ArrowDown moves to the
 * previous/next item in the list.
 */
export function useTableKeyboardNavigation<T extends { id: string | number }>(
  items: T[],
  selectedId: string | number | null,
  onSelect: (item: T) => void,
) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (items.length === 0) return
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return

      // Only handle when no input/textarea is focused
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      e.preventDefault()

      const currentIndex = selectedId != null
        ? items.findIndex((item) => item.id === selectedId)
        : -1

      let nextIndex: number
      if (e.key === 'ArrowDown') {
        nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : currentIndex
      } else {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : 0
      }

      if (nextIndex !== currentIndex && items[nextIndex]) {
        onSelect(items[nextIndex])
      }
    },
    [items, selectedId, onSelect],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
