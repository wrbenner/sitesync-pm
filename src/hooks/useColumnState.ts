// Phase 2 — column width / visibility / pin / sort persistence.
//
// Keyed by `${user_id}:${project_id}:${tableId}` so each user gets their own
// layout per project per table. Persisted to localStorage; tolerates parse
// failures (returns defaults). Sort is single-column at a time.

/* eslint-disable react-hooks/no-deriving-state-in-effects, react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react'

export type ColumnPin = 'left' | 'right' | null

export interface ColumnState {
  width?: number
  hidden?: boolean
  pin?: ColumnPin
  sort?: 'asc' | 'desc' | null
}

export type ColumnStateMap = Record<string, ColumnState>

const STORAGE_VERSION = 1

interface PersistedShape {
  v: typeof STORAGE_VERSION
  cols: ColumnStateMap
}

function makeKey(userId: string | null | undefined, projectId: string | null | undefined, tableId: string): string {
  return `submittals:${tableId}:${userId ?? 'anon'}:${projectId ?? 'no-project'}`
}

function readStorage(key: string): ColumnStateMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as PersistedShape | ColumnStateMap
    if (typeof parsed === 'object' && parsed && 'v' in parsed && 'cols' in parsed) {
      return (parsed as PersistedShape).cols ?? {}
    }
    return (parsed as ColumnStateMap) ?? {}
  } catch {
    return {}
  }
}

function writeStorage(key: string, cols: ColumnStateMap): void {
  if (typeof window === 'undefined') return
  try {
    const payload: PersistedShape = { v: STORAGE_VERSION, cols }
    window.localStorage.setItem(key, JSON.stringify(payload))
  } catch {
    // Quota / private mode — silently drop.
  }
}

export interface UseColumnStateResult {
  state: ColumnStateMap
  getColumn: (id: string) => ColumnState
  setWidth: (id: string, width: number | undefined) => void
  setHidden: (id: string, hidden: boolean) => void
  setPin: (id: string, pin: ColumnPin) => void
  setSort: (id: string, sort: 'asc' | 'desc' | null) => void
  reset: () => void
}

export function useColumnState(
  userId: string | null | undefined,
  projectId: string | null | undefined,
  tableId: string,
): UseColumnStateResult {
  const key = makeKey(userId, projectId, tableId)
  const [state, setState] = useState<ColumnStateMap>(() => readStorage(key))

  useEffect(() => {
    setState(readStorage(key))
  }, [key])

  const persist = useCallback((next: ColumnStateMap) => {
    setState(next)
    writeStorage(key, next)
  }, [key])

  const update = useCallback((id: string, patch: Partial<ColumnState>) => {
    setState((prev) => {
      const cur = prev[id] ?? {}
      const merged: ColumnState = { ...cur, ...patch }
      const isDefault = merged.width === undefined && !merged.hidden && !merged.pin && !merged.sort
      const next = { ...prev }
      if (isDefault) delete next[id]
      else next[id] = merged
      writeStorage(key, next)
      return next
    })
  }, [key])

  const getColumn = useCallback(
    (id: string): ColumnState => state[id] ?? {},
    [state],
  )

  return {
    state,
    getColumn,
    setWidth: (id, width) => update(id, { width }),
    setHidden: (id, hidden) => update(id, { hidden }),
    setPin: (id, pin) => update(id, { pin }),
    setSort: (id, sort) => {
      // Sort is single-column; clear other columns' sort first.
      setState((prev) => {
        const next: ColumnStateMap = {}
        for (const [colId, col] of Object.entries(prev)) {
          if (colId !== id && col.sort) next[colId] = { ...col, sort: null }
          else next[colId] = col
        }
        next[id] = { ...(next[id] ?? {}), sort }
        writeStorage(key, next)
        return next
      })
    },
    reset: () => persist({}),
  }
}
