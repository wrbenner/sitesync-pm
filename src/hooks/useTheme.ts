import { useEffect, useMemo } from 'react'
import { useUiStore } from '../stores'

export type ThemeMode = 'light' | 'dark' | 'system'

// Light/dark switching is handled declaratively by tokens.css via [data-theme].
// This function only needs to set the attribute on documentElement.
function applyTheme(isDark: boolean) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', isDark ? '#0C0D0F' : '#FAFAF8')
  }
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return mode === 'dark'
}

export function useTheme() {
  const themeMode = useUiStore((s) => s.themeMode)

  useEffect(() => {
    applyTheme(resolveIsDark(themeMode))

    if (themeMode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [themeMode])

  const isDark = useMemo(() => resolveIsDark(themeMode), [themeMode])

  return { themeMode, isDark }
}
