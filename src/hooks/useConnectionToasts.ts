import { useEffect } from 'react'
import { initConnectionToasts } from '../services/connectionService'

/**
 * Mount this hook once at the app root to enable automatic toast notifications
 * when the network connection is lost or restored.
 *
 * The hook is idempotent — mounting it multiple times is safe because
 * initConnectionToasts() replaces any existing subscription.
 *
 * @example
 * // In App.tsx or your layout shell:
 * function App() {
 *   useConnectionToasts()
 *   return <RouterProvider ... />
 * }
 */
export function useConnectionToasts(): void {
  useEffect(() => {
    const cleanup = initConnectionToasts()
    return cleanup
  }, [])
}
