import { useEffect, useState } from 'react'

/**
 * Returns true if `loading` has been continuously true for longer than `ms`
 * milliseconds. Resets to false when `loading` drops back to false, so a
 * subsequent fetch (refetch, filter change) gets a fresh 5-second window.
 *
 * Use this to escape infinite skeleton states when a fetch hangs:
 *   const timedOut = useLoadingTimeout(isLoading, 5000)
 *   if (isLoading && !timedOut) return <Skeleton />
 */
export function useLoadingTimeout(loading: boolean, ms: number): boolean {
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => setTimedOut(true), ms)
    return () => {
      clearTimeout(t)
      setTimedOut(false)
    }
  }, [loading, ms])
  return timedOut
}
