import { useEffect, useMemo } from 'react'
import { useUiStore } from '../stores'
import { colors, darkColors } from '../styles/theme'

export type ThemeMode = 'light' | 'dark' | 'system'

// All CSS-variable-driven colors for light mode
const lightVars: Record<string, string> = {
  surfacePage: colors.surfacePage,
  surfaceSidebar: colors.surfaceSidebar,
  surfaceRaised: colors.surfaceRaised,
  surfaceInset: colors.surfaceInset,
  surfaceHover: colors.surfaceHover,
  surfaceSelected: colors.surfaceSelected,
  surfaceFlat: colors.surfaceFlat,
  borderSubtle: colors.borderSubtle,
  borderDefault: colors.borderDefault,
  borderLight: colors.borderLight,
  textPrimary: colors.textPrimary,
  textSecondary: colors.textSecondary,
  textTertiary: colors.textTertiary,
  cardBackground: colors.cardBackground,
  lightBackground: colors.lightBackground,
}

// All CSS-variable-driven colors for dark mode
const darkVars: Record<string, string> = {
  surfacePage: darkColors.surfacePage,
  surfaceSidebar: darkColors.surfaceSidebar,
  surfaceRaised: darkColors.surfaceRaised,
  surfaceInset: darkColors.surfaceInset,
  surfaceHover: darkColors.surfaceHover,
  surfaceSelected: darkColors.surfaceSelected,
  surfaceFlat: darkColors.surfaceFlat,
  borderSubtle: darkColors.borderSubtle,
  borderDefault: darkColors.borderDefault,
  borderLight: darkColors.borderLight,
  textPrimary: darkColors.textPrimary,
  textSecondary: darkColors.textSecondary,
  textTertiary: darkColors.textTertiary,
  cardBackground: darkColors.cardBackground,
  lightBackground: darkColors.lightBackground,
}

function applyTheme(isDark: boolean) {
  const vars = isDark ? darkVars : lightVars
  const root = document.documentElement
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(`--color-${key}`, value)
  }
  root.setAttribute('data-theme', isDark ? 'dark' : 'light')
  // Update meta theme-color for mobile browser chrome
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', isDark ? darkColors.surfacePage : colors.surfacePage)
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
