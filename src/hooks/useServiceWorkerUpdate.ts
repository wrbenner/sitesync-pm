import { useState, useEffect, useCallback } from 'react'

interface SWUpdateState {
  updateAvailable: boolean
  applyUpdate: () => void
}

export function useServiceWorkerUpdate(): SWUpdateState {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail
      setRegistration(detail.registration)
      setUpdateAvailable(true)
    }

    window.addEventListener('sw-update-available', handler)
    return () => window.removeEventListener('sw-update-available', handler)
  }, [])

  const applyUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      // Reload once the new SW takes over
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
      })
    }
  }, [registration])

  return { updateAvailable, applyUpdate }
}
