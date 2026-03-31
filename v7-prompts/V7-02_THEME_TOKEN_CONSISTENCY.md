# V7-02: Theme Token Consistency & Cleanup

## Goal
Audit and fix every single file in the codebase so that 100% of visual values (colors, spacing, font sizes, shadows, radii, z-indices, transitions) come from `src/styles/theme.ts`. Zero hardcoded visual values anywhere. Zero `rgba()` literals. Zero pixel values that aren't in the spacing scale.

## Why This Matters
The theme system in `theme.ts` is comprehensive and well designed, but it's inconsistently applied. Components mix theme tokens with hardcoded values (`rgba(0,0,0,0.1)`, `#333`, `16px`, `8px`). This creates visual inconsistency (slightly wrong grays, misaligned spacing) and makes global design changes impossible. A Steve Jobs level UI has pixel-perfect consistency, which requires 100% token usage.

---

## Phase 1: Audit Hardcoded Values

### 1A. Color Audit

Search every `.tsx` and `.ts` file for these patterns and replace with theme tokens:

**Hex colors:**
- Any `#` followed by 3 or 6 hex chars that isn't in `theme.ts`
- Common offenders: `#333`, `#666`, `#999`, `#ccc`, `#f5f5f5`, `#fff`, `#000`
- Map to: `colors.textPrimary`, `colors.textSecondary`, `colors.textTertiary`, `colors.borderDefault`, `colors.surfacePage`, `colors.white`, `colors.textPrimary`

**RGBA values:**
- Any `rgba(` literal not in `theme.ts`
- Common offenders: `rgba(0,0,0,0.1)`, `rgba(0,0,0,0.05)`, `rgba(255,255,255,0.9)`
- Map to: `colors.overlayDark`, `shadows.sm` (if used as shadow), `colors.overlayLight`

**RGB values:**
- Any `rgb(` literal
- Replace with hex equivalent from theme

**Named CSS colors:**
- `white`, `black`, `transparent`, `red`, `green`, `blue`
- Replace: `white` → `colors.white`, `black` → `colors.textPrimary`, `transparent` → `'transparent'` (acceptable)

### 1B. Spacing Audit

Search for pixel values in `padding`, `margin`, `gap`, `top`, `right`, `bottom`, `left`, `width`, `height`:

**Pattern:** Any number followed by `px` that isn't in the spacing scale.

Valid spacing values (from `theme.ts`):
`0, 1px, 2px, 4px, 6px, 8px, 10px, 12px, 14px, 16px, 20px, 24px, 28px, 32px, 36px, 40px, 44px, 48px, 56px, 64px, 80px, 96px`

Common offenders:
- `3px` → `spacing['0.5']` (2px) or `spacing['1']` (4px)
- `5px` → `spacing['1']` (4px) or `spacing['1.5']` (6px)
- `7px` → `spacing['2']` (8px)
- `9px` → `spacing['2']` (8px) or `spacing['2.5']` (10px)
- `11px` → `spacing['3']` (12px)
- `15px` → `spacing['4']` (16px)
- `18px` → `spacing['5']` (20px) or `spacing['4']` (16px)
- `22px` → `spacing['6']` (24px)
- `30px` → `spacing['8']` (32px)
- `35px` → `spacing['9']` (36px)
- `50px` → `spacing['12']` (48px) or `spacing['14']` (56px)

**Exceptions** (acceptable hardcoded px values):
- `1px` borders (this is in the scale as `spacing.px`)
- Component-specific dimensions like icon sizes (16px, 20px, 24px are on-scale)
- Layout dimensions already in `layout` object
- `100%`, `auto`, `fit-content`, `min-content` etc.

### 1C. Font Size Audit

Search for `fontSize:` followed by any string literal.

Valid font sizes: `11px, 12px, 13px, 14px, 15px, 16px, 18px, 20px, 24px, 28px, 36px`

Replace with: `typography.fontSize.caption`, `.label`, `.sm`, `.body`, `.lg`, `.title`, `.subtitle`, `.3xl`, `.4xl`, `.heading`, `.display`

### 1D. Font Weight Audit

Search for `fontWeight:` followed by any number.

Valid weights: `300, 400, 500, 600, 700`

Replace with: `typography.fontWeight.light`, `.normal`, `.medium`, `.semibold`, `.bold`

### 1E. Shadow Audit

Search for `boxShadow:` followed by any string literal not from `shadows`.

Replace all custom shadow strings with the closest match from: `shadows.none`, `.sm`, `.card`, `.cardHover`, `.dropdown`, `.panel`, `.pressed`, `.glow`

### 1F. Border Radius Audit

Search for `borderRadius:` followed by any pixel value.

Valid radii: `0, 4px, 6px, 8px, 10px, 12px, 16px, 9999px`

Replace with: `borderRadius.none`, `.sm`, `.base`, `.md`, `.lg`, `.xl`, `.2xl`, `.full`

### 1G. Z-Index Audit

Search for `zIndex:` followed by any number.

Replace with: `zIndex.base`, `.dropdown`, `.sticky`, `.fixed`, `.modal`, `.popover`, `.tooltip`, `.command`, `.toast`

### 1H. Transition Audit

Search for `transition:` followed by any string literal.

Replace with values from `transitions` object or new `motion` object from V7-01.

---

## Phase 2: Specific File Fixes

### 2A. Sidebar.tsx

Known issues:
- Hardcoded `rgba(244, 120, 32, 0.08)` → `colors.orangeSubtle`
- Hardcoded `rgba(244, 120, 32, 0.15)` → create `colors.orangeMedium` if not exists, or use `colors.orangeLight`
- `padding: '8px 0'` → `padding: '${spacing[2]} 0'`
- `margin: '-4px 0 0 -8px'` → remove negative margins, fix layout properly with flexbox
- Section spacing `8px` → `spacing[2]`, should likely be `spacing[4]` (16px) for better breathing room
- `fontSize: '11px'` → `typography.fontSize.caption`
- `borderRadius: '8px'` → `borderRadius.md`

### 2B. TopBar.tsx

Known issues:
- Hardcoded `280px` search width → Create `layout.searchWidth` or use responsive flex
- Button sizes `36x36` inconsistent → Standardize to `touchTarget.min` (44px) for accessibility
- Duplicated avatar gradient → Extract to theme constant
- `gap: '8px'` → `spacing[2]`
- `padding: '0 16px'` → `padding: '0 ${spacing[4]}'`

### 2C. TopNav.tsx

This file is DEAD CODE. It's not imported by `App.tsx`. Delete it entirely in V7-13.

### 2D. Dashboard.tsx and Widget Components

Known issues:
- Widget headers all use `12px` font → `typography.fontSize.label` or `.sm` (13px) for readability
- Hardcoded `padding: '16px'` → `spacing[4]`
- Hardcoded `gap: '12px'` → `spacing[3]`
- BIM preview uses hardcoded grays → use `colors.surfaceInset`

### 2E. All Form Components (`src/components/forms/*`)

Common issues:
- Input `padding: '8px 12px'` → `padding: '${spacing[2]} ${spacing[3]}'`
- Label `fontSize: '12px'` → `typography.fontSize.label`
- Error text `color: '#C93B3B'` → `colors.statusCritical`
- Focus border `'2px solid #F47820'` → `focusRing` from theme

---

## Phase 3: Legacy Alias Cleanup

The theme file has many "Legacy aliases" that were meant to be temporary. Phase 3 removes them.

### 3A. In `colors`:

Remove and replace usages of:
- `tealSuccess` → `statusActive`
- `red` → `statusCritical`
- `amber` → `statusPending`
- `green` → `statusActive`
- `blue` → `statusInfo`
- `purple` → `statusReview`
- `cyan` → `chartCyan`
- `lightBackground` → `surfacePage`
- `cardBackground` → `surfaceRaised`
- `border` → `borderDefault`
- `borderLight` → `borderSubtle`
- `surfaceFlat` → `surfaceSidebar`
- `darkNavy` → remove (only used if old sidebar design)
- `orangeGradientStart` → `primaryOrange`
- `orangeGradientEnd` → define proper gradient token or remove
- `orangeMedium` → `orangeSubtle`

### 3B. In `spacing`:

Remove and replace usages of:
- `xs` → `'1'` (4px)
- `sm` → `'2'` (8px)
- `md` → `'3'` (12px)
- `lg` → `'4'` (16px)
- `xl` → `'6'` (24px)
- `xxl` → `'8'` (32px)
- `'2xl'` → `'10'` (40px)
- `'3xl'` → `'14'` (56px)
- `px` → just use `'1px'` directly

### 3C. In `typography.fontSize`:

Remove and replace usages of:
- `xs` → `label` (12px)
- `base` → `body` (14px)
- `lg` → use `'15px'` explicitly or add to scale
- `xl` → `title` (16px)
- `'2xl'` → `subtitle` (18px)
- `'3xl'` → create `typography.fontSize.medium` at 20px
- `'4xl'` → `'24px'` or add to scale
- `'5xl'` → `heading` (28px)
- `'6xl'` → `display` (36px)

### 3D. In `shadows`:

Remove and replace usages of:
- `xs` → `none`
- `base` → `card`
- `md` → `cardHover`
- `lg` → `panel`

### 3E. In `transitions`:

Remove and replace usages of:
- `fast` → `instant`
- `base` → `quick`
- `slow` → `smooth`

---

## Phase 4: Add Missing Tokens

Add any tokens that are needed but missing:

```typescript
// In colors:
textDisabled: '#C5C0BB',     // For disabled button text
surfaceDisabled: '#EDEDEB',   // For disabled backgrounds
borderHover: '#D5D0CA',      // For hovered input borders

// In typography.fontSize (if gap between 18 and 28 feels too large):
medium: '20px',
large: '24px',

// In layout:
searchWidth: '320px',         // TopBar search field
metricCardHeight: '120px',    // Consistent metric card sizing
tableRowHeight: '52px',       // Consistent table row height
```

---

## Verification Checklist

- [ ] `grep -rn "rgba(" src/` returns ZERO results outside of `theme.ts`
- [ ] `grep -rn "#[0-9a-fA-F]\{3,6\}" src/` returns ZERO results outside of `theme.ts` (except imports of theme)
- [ ] Every `fontSize` in the codebase is a `typography.fontSize.*` reference
- [ ] Every `fontWeight` is a `typography.fontWeight.*` reference
- [ ] Every `boxShadow` is a `shadows.*` reference
- [ ] Every `borderRadius` with px value is a `borderRadius.*` reference
- [ ] Every `zIndex` number is a `zIndex.*` reference
- [ ] Every `transition` is from `transitions.*` or `motion.*` object
- [ ] All legacy aliases have zero usages in `src/` (outside of theme.ts itself)
- [ ] No `padding`, `margin`, or `gap` uses a pixel value not in the spacing scale
- [ ] App compiles without errors after all replacements
- [ ] Visual regression: app looks identical to before (tokens should map to same values)
