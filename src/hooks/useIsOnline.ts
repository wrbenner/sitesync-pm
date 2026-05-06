import { useState, useEffect } from 'react'

// Lightweight online/offline status hook. Does NOT pull syncManager / Dexie,
// so routes that only need to know "are we online?" can avoid loading the
// offline-mutation queue on the cold path. Day 30 — Lap 1 acceptance gate.
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}
