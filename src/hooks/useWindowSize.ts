import { useEffect, useState } from 'react'

export interface WindowSize {
  width: number
  height: number
}

// REACT-03 FIX: Shared hook so pages don't each attach their own resize
// listener. Debounced to match the original per-page behavior (150ms).
export function useWindowSize(debounceMs = 150): WindowSize {
  const [size, setSize] = useState<WindowSize>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }))

  useEffect(() => {
    if (typeof window === 'undefined') return
    let timer: ReturnType<typeof setTimeout> | null = null
    const handleResize = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        setSize({ width: window.innerWidth, height: window.innerHeight })
      }, debounceMs)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('resize', handleResize)
    }
  }, [debounceMs])

  return size
}

export function useIsMobile(breakpoint = 768): boolean {
  const { width } = useWindowSize()
  return width > 0 && width < breakpoint
}
