import { useState, useEffect, useCallback } from 'react'

interface SWUpdateState {
  needRefresh: boolean
  offlineReady: boolean
  updateServiceWorker: (reloadPage?: boolean) => void
}

export function useServiceWorkerUpdate(): SWUpdateState {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)

  useEffect(() => {
    const updateHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail
      setRegistration(detail.registration)
      setNeedRefresh(true)
    }
    const offlineHandler = () => setOfflineReady(true)

    window.addEventListener('sw-update-available', updateHandler)
    window.addEventListener('sw-offline-ready', offlineHandler)
    return () => {
      window.removeEventListener('sw-update-available', updateHandler)
      window.removeEventListener('sw-offline-ready', offlineHandler)
    }
  }, [])

  const updateServiceWorker = useCallback((reloadPage = false) => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
      })
    } else if (reloadPage) {
      window.location.reload()
    }
  }, [registration])

  return { needRefresh, offlineReady, updateServiceWorker }
}
