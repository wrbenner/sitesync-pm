import { useEffect } from 'react'
import { useUiStore } from '../stores'

export function useAccessibleStatus(
  isLoading: boolean,
  isError: boolean,
  entityName: string,
  itemCount?: number
) {
  const announceStatus = useUiStore((s) => s.announceStatus)
  const announceAlert = useUiStore((s) => s.announceAlert)

  useEffect(() => {
    if (isLoading) {
      announceStatus(`Loading ${entityName}...`)
    }
  }, [isLoading, entityName, announceStatus])

  useEffect(() => {
    if (isError) {
      announceAlert(`Error loading ${entityName}. Please try again.`)
    }
  }, [isError, entityName, announceAlert])

  useEffect(() => {
    if (!isLoading && !isError && itemCount !== undefined) {
      announceStatus(`${itemCount} ${entityName} loaded.`)
    }
  }, [isLoading, isError, itemCount, entityName, announceStatus])
}
