import { useEffect, useState } from 'react'

/**
 * Returns true if `loading` has been continuously true for longer than `ms`
 * milliseconds. Starts a new countdown each time `loading` flips to true.
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
    return () => clearTimeout(t)
  }, [loading, ms])
  return timedOut
}
