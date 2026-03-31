# V7-12: Dark Mode, Shadows & Depth System

## Goal
Implement a fully functional dark mode using the existing `darkColors` tokens, create a proper depth/elevation system that makes surfaces feel physically layered, and ensure the shadow system creates a natural sense of hierarchy. Apple and Linear both have flawless dark modes because they treat it as a first-class design surface, not an afterthought.

## Why This Matters
Dark mode isn't just an aesthetic preference. Construction supers check their phones in bright sunlight (where high contrast dark mode is actually easier to read) and in dark trailers early in the morning. More importantly: a polished dark mode is a signal of quality. If dark mode looks broken, users assume the whole product is brittle. Currently `darkColors` exist in theme.ts but aren't wired to anything.

---

## Phase 1: Dark Mode Infrastructure

### 1A. Theme Context

Create a theme context that manages light/dark mode:

```typescript
// src/hooks/useTheme.ts
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { colors, darkColors, colorVars } from '../styles/theme';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  colors: typeof colors;  // Resolved colors for current mode
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('sitesync-theme');
    return (saved as ThemeMode) || 'system';
  });

  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const isDark = mode === 'dark' || (mode === 'system' && systemDark);

  const resolvedColors = isDark
    ? { ...colors, ...darkColors }
    : colors;

  // Set CSS custom properties on document root
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      Object.entries(darkColors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value);
      });
      root.setAttribute('data-theme', 'dark');
    } else {
      Object.entries(darkColors).forEach(([key]) => {
        root.style.removeProperty(`--color-${key}`);
      });
      root.setAttribute('data-theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem('sitesync-theme', mode);
  }, [mode]);

  const toggleMode = useCallback(() => {
    setMode(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, isDark, setMode, toggleMode, colors: resolvedColors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
```

### 1B. CSS Custom Properties Approach

Instead of passing colors through React context (which causes re-renders), use CSS custom properties:

1. All components that use `colors.surfacePage` etc. should reference `colorVars.surfacePage` instead
2. The `colorVars` object returns `var(--color-surfacePage, #FAFAF8)` — falls back to light mode
3. Dark mode only needs to set the CSS custom properties, no re-renders needed

This means migrating all inline styles from:
```typescript
background: colors.surfaceRaised
```
to:
```typescript
background: colorVars.surfaceRaised  // 'var(--color-surfaceRaised, #FFFFFF)'
```

For colors NOT in `colorVars` (like status colors, brand orange), they stay as direct references since they don't change between modes.

### 1C. Expand colorVars

The current `colorVars` only covers surfaces, borders, and text. Expand to cover ALL dark-mode-sensitive colors:

```typescript
export const colorVars = {
  // Surfaces
  surfacePage: 'var(--color-surfacePage, #FAFAF8)',
  surfaceSidebar: 'var(--color-surfaceSidebar, #F6F3F0)',
  surfaceRaised: 'var(--color-surfaceRaised, #FFFFFF)',
  surfaceInset: 'var(--color-surfaceInset, #F3EFEC)',
  surfaceHover: 'var(--color-surfaceHover, #F0EDE8)',
  surfaceSelected: 'var(--color-surfaceSelected, #FEF7F2)',
  surfaceFlat: 'var(--color-surfaceFlat, #F6F3F0)',
  // Borders
  borderSubtle: 'var(--color-borderSubtle, #F0EDE9)',
  borderDefault: 'var(--color-borderDefault, #E5E1DC)',
  borderLight: 'var(--color-borderLight, #F0EDE9)',
  // Text
  textPrimary: 'var(--color-textPrimary, #1A1613)',
  textSecondary: 'var(--color-textSecondary, #5C5550)',
  textTertiary: 'var(--color-textTertiary, #9A9490)',
  // Card aliases
  cardBackground: 'var(--color-cardBackground, #FFFFFF)',
  lightBackground: 'var(--color-lightBackground, #FAFAF8)',
} as const;
```

### 1D. Dark Mode Shadows

Shadows need to be stronger in dark mode because they're less visible:

```typescript
export const darkShadows = {
  none: 'none',
  sm: '0 1px 3px rgba(0, 0, 0, 0.2)',
  card: '0 1px 4px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.04)',
  cardHover: '0 4px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.06)',
  dropdown: '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.06)',
  panel: '0 16px 48px rgba(0, 0, 0, 0.5)',
  pressed: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
  glow: '0 4px 24px rgba(244, 120, 32, 0.3)',
} as const;
```

---

## Phase 2: Dark Mode Specific Fixes

### 2A. Sidebar in Dark Mode

- Background: `darkColors.surfaceSidebar` (#111214)
- Nav item hover: `darkColors.surfaceHover` (#1F2024)
- Active item: `orangeSubtle` on dark background → increase opacity to 0.12
- Section headers: `darkColors.textTertiary`
- Dividers: `darkColors.borderSubtle`

### 2B. TopBar in Dark Mode

- Background: `darkColors.surfaceRaised` (#1A1B1E)
- Search field: `darkColors.surfaceInset` background
- Icon buttons: Hover background `darkColors.surfaceHover`
- Border bottom: `darkColors.borderDefault`

### 2C. Cards in Dark Mode

- Background: `darkColors.surfaceRaised` (#1A1B1E)
- Border: `darkColors.borderDefault` (rgba(255,255,255,0.1))
- Hover border: Slightly brighter (`rgba(255,255,255,0.15)`)
- Shadow: Use `darkShadows.card`

### 2D. Tables in Dark Mode

- Header row: `darkColors.surfacePage` background
- Row borders: `darkColors.borderSubtle`
- Row hover: `darkColors.surfaceHover`
- Selected row: `darkColors.surfaceSelected` (#2A1F16, warm dark)

### 2E. Form Inputs in Dark Mode

- Background: `darkColors.surfaceInset` (#141518)
- Border: `darkColors.borderDefault`
- Text: `darkColors.textPrimary` (rgba(255,255,255,0.92))
- Placeholder: `darkColors.textTertiary`
- Focus border: Still `primaryOrange` (stays the same)
- Focus glow: `rgba(244, 120, 32, 0.15)` (less opaque than light mode)

### 2F. Status Colors in Dark Mode

Status colors (green, red, amber, blue) stay the same in dark mode because they need high contrast. But subtle backgrounds need adjustment:

```typescript
// Dark mode status backgrounds need higher opacity
statusActiveSubtle: 'rgba(45, 138, 110, 0.15)',   // up from 0.08
statusCriticalSubtle: 'rgba(201, 59, 59, 0.15)',
statusPendingSubtle: 'rgba(196, 133, 12, 0.15)',
statusInfoSubtle: 'rgba(58, 123, 200, 0.15)',
```

---

## Phase 3: Elevation & Depth System

### 3A. Elevation Levels

Define clear elevation levels that create a physical sense of depth:

| Level | Use Case | Shadow (Light) | Shadow (Dark) | Border |
|-------|----------|----------------|---------------|--------|
| 0 (Base) | Page background, inset areas | `none` | `none` | None |
| 1 (Surface) | Cards, table container | `card` | `darkShadows.card` | `borderSubtle` |
| 2 (Raised) | Hovered cards, toolbars | `cardHover` | `darkShadows.cardHover` | `borderDefault` |
| 3 (Floating) | Dropdowns, popovers, tooltips | `dropdown` | `darkShadows.dropdown` | `borderDefault` |
| 4 (Modal) | Modals, drawers, command palette | `panel` | `darkShadows.panel` | None |

### 3B. Surface Color by Elevation

In light mode, higher elevation = whiter:
- Level 0: `surfacePage` (#FAFAF8, warm off-white)
- Level 1: `surfaceRaised` (#FFFFFF, pure white)
- Level 2: `surfaceRaised` with stronger shadow
- Level 3: `surfaceRaised` with dropdown shadow
- Level 4: `surfaceRaised` with panel shadow

In dark mode, higher elevation = lighter:
- Level 0: `darkColors.surfacePage` (#0C0D0F, near-black)
- Level 1: `darkColors.surfaceRaised` (#1A1B1E, dark gray)
- Level 2: `#1F2024` (slightly lighter)
- Level 3: `#252628` (lighter still)
- Level 4: `#2A2B2E` (lightest elevated surface)

### 3C. Inset Surfaces

For areas that are "below" the surface (search fields, code blocks, nested areas):
- Light: `surfaceInset` (#F3EFEC)
- Dark: `darkColors.surfaceInset` (#141518, darker than surface)

---

## Phase 4: Theme Toggle UI

### 4A. TopBar Toggle

In TopBar, add a theme toggle button:
- Icon: `Sun` for light mode, `Moon` for dark mode
- Click: Toggle between light and dark
- Long press or dropdown: Shows Light / Dark / System options
- Animation: Icon cross-fades (sun rotates out, moon rotates in)

### 4B. Transition Between Modes

When switching modes:
- All color changes transition with `transition: background 200ms ease-out, color 200ms ease-out, border-color 200ms ease-out`
- Avoid a flash of wrong colors: Apply transition to all elements

Add a global CSS rule:
```css
[data-theme-transitioning] * {
  transition: background-color 200ms ease-out, color 200ms ease-out, border-color 200ms ease-out !important;
}
```

Apply `data-theme-transitioning` attribute during the switch, remove after 300ms.

---

## Phase 5: System Preference Respect

### 5A. Auto-Detect

When mode is "system":
- Use `window.matchMedia('(prefers-color-scheme: dark)')` to detect OS preference
- Listen for changes (user changes OS theme mid-session)
- React instantly to OS theme changes

### 5B. No Flash on Load

Prevent flash of wrong theme on page load:
- Store theme preference in `localStorage`
- In `index.html`, add a blocking `<script>` that reads localStorage and sets `data-theme` attribute BEFORE React hydrates
- This prevents the "flash of light mode then switch to dark" effect

```html
<script>
  (function() {
    const saved = localStorage.getItem('sitesync-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved === 'dark' || (saved === 'system' && prefersDark) || (!saved && prefersDark);
    if (isDark) document.documentElement.setAttribute('data-theme', 'dark');
  })();
</script>
```

---

## Verification Checklist

- [ ] ThemeProvider context wraps entire app
- [ ] CSS custom properties set on document root for dark mode
- [ ] All surface colors use `colorVars` (CSS variables) not direct `colors` references
- [ ] Dark mode: Sidebar is dark with proper text contrast
- [ ] Dark mode: Cards are elevated dark surfaces with visible borders
- [ ] Dark mode: Tables have correct hover and selected states
- [ ] Dark mode: Form inputs are dark with visible borders and placeholder text
- [ ] Dark mode: Status colors are legible (subtle backgrounds have higher opacity)
- [ ] Dark mode: Shadows are stronger (darkShadows)
- [ ] Elevation system: 5 clear levels with consistent shadow + surface color
- [ ] Theme toggle in TopBar with sun/moon icon
- [ ] Toggle animation: Icon cross-fades
- [ ] Mode transition: Smooth 200ms background/color transition
- [ ] System preference: Auto-detect and react to OS changes
- [ ] No flash: Blocking script in index.html sets theme before render
- [ ] Brand orange stays consistent in both modes
- [ ] Charts and visualizations are legible in dark mode
