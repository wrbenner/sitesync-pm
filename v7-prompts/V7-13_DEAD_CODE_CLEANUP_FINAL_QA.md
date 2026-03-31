# V7-13: Dead Code Removal & Final QA

## Goal
Remove all dead code, unused files, and technical debt. Then perform a comprehensive final QA pass across every page and component to catch anything missed in V7-01 through V7-12. This is the "white glove" pass. Ship nothing that isn't perfect.

## Why This Matters
Dead code is a tax on every developer who reads the codebase. It creates confusion ("is this used?"), increases bundle size, and signals sloppiness. A Steve Jobs product has zero waste. Everything that exists must justify its existence. After this prompt, every file, every component, every line of code either serves the product or is gone.

---

## Phase 1: Dead Code Removal

### 1A. Unused Files

**Delete these files:**

1. `src/components/TopNav.tsx` — Dead code. Not imported anywhere. An alternative horizontal nav that was never used. Delete entirely.

2. Any file in `src/` that is not imported by any other file. Run a dependency analysis:
```bash
# Find files with zero imports (excluding entry points and config)
npx madge --orphans --extensions ts,tsx src/
```

3. Check for commented-out import blocks in `App.tsx` and route files. Remove any commented routes.

### 1B. Unused Exports

Search for exports that are never imported anywhere:
```bash
# For each exported function/component, check if it has any importers
npx ts-prune src/
```

Remove any export that has zero consumers. Be careful with:
- Components exported from `primitives/index.ts` (may be used in pages)
- Hooks exported from `hooks/` (may be used across components)
- Types exported from `.d.ts` or type files (may be used for type checking)

### 1C. Unused Dependencies

Check `package.json` for dependencies that are no longer imported:
```bash
npx depcheck
```

Remove any unused `dependencies` and `devDependencies`.

### 1D. Legacy Aliases in Theme

After V7-02 migrates all usages away from legacy aliases, remove them from `theme.ts`:

In `colors`: Remove `tealSuccess`, `red`, `amber`, `green`, `blue`, `purple`, `cyan`, `lightBackground`, `cardBackground`, `border`, `borderLight`, `surfaceFlat`, `darkNavy`, `orangeGradientStart`, `orangeGradientEnd`, `orangeMedium`

In `spacing`: Remove `xs`, `sm`, `md`, `lg`, `xl`, `xxl`, `2xl`, `3xl`, `px`

In `typography.fontSize`: Remove `xs`, `base`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`, `6xl`

In `typography.fontWeight`: Remove `light` (if unused)

In `shadows`: Remove `xs`, `base`, `md`, `lg`

In `transitions`: Remove `fast`, `base`, `slow`

In `layout`: Remove `pageMaxWidth`, `pagePaddingX`, `pagePaddingY`

**CRITICAL:** Only remove aliases AFTER confirming zero usages via grep. If a component still references a legacy alias, fix it first.

### 1E. `as any` Elimination

The codebase has 179 `as any` casts. Fix as many as possible:

Common patterns and fixes:
- `event as any` → `event as React.MouseEvent<HTMLElement>` or `React.ChangeEvent<HTMLInputElement>`
- `ref as any` → `ref as React.RefObject<HTMLDivElement>`
- `style as any` → Type the style object properly
- `data as any` → Define a proper interface for the data
- `props as any` → Add TypeScript interface to the component
- Supabase query results `as any` → Define return types for queries

Target: Reduce from 179 to under 20 (some may be genuinely needed for third-party library types).

### 1F. Console.log Cleanup

Remove all `console.log`, `console.warn`, `console.error` statements from production code. Replace with:
- Error boundary for React errors
- Toast notifications for user-facing errors
- Structured logging (if needed for debugging) behind a `DEBUG` flag

```bash
grep -rn "console\.\(log\|warn\|error\)" src/ --include="*.tsx" --include="*.ts"
```

### 1G. TODO/FIXME/HACK Comments

Search for temporary markers and resolve them:
```bash
grep -rn "TODO\|FIXME\|HACK\|XXX\|TEMP" src/ --include="*.tsx" --include="*.ts"
```

Each one should be:
1. Resolved (if the fix is known)
2. Converted to a GitHub issue (if it requires more work)
3. Removed if it's stale/no longer relevant

---

## Phase 2: Bundle Optimization

### 2A. Import Analysis

Check for barrel imports that pull in more than needed:
```typescript
// Bad: Imports everything from lucide-react
import { Plus, Search, Filter, ... } from 'lucide-react';

// Good: Direct imports (if tree-shaking isn't working)
import { Plus } from 'lucide-react/dist/esm/icons/plus';
```

Verify Vite's tree-shaking is working by checking build output size.

### 2B. Lazy Loading

Pages that are rarely visited should be lazy-loaded:
```typescript
const Vision = React.lazy(() => import('./pages/Vision'));
const Developers = React.lazy(() => import('./pages/Developers'));
const Marketplace = React.lazy(() => import('./pages/Marketplace'));
const TimeMachine = React.lazy(() => import('./pages/TimeMachine'));
const Integrations = React.lazy(() => import('./pages/Integrations'));
```

Wrap lazy routes with `<Suspense fallback={<PageSkeleton />}>`.

### 2C. Image Optimization

If any images exist in the codebase:
- Use WebP format
- Add `loading="lazy"` attribute
- Specify `width` and `height` to prevent layout shift
- Use responsive images with `srcSet` for different densities

---

## Phase 3: Accessibility Final Pass

### 3A. Keyboard Navigation

Test every page with keyboard only (no mouse):
- Tab order: Logical flow (left to right, top to bottom)
- Focus visible: Every focused element has a visible focus ring (from V7-01)
- Skip to content: Link at very top that jumps past sidebar/topbar
- Escape: Closes all modals, dropdowns, and overlays
- Enter/Space: Activates buttons and clickable elements
- Arrow keys: Navigate within menus, tab bars, and date pickers

### 3B. Screen Reader

Verify critical elements have proper ARIA:
- Page title: `<h1>` on every page (only one per page)
- Navigation: `<nav aria-label="Main navigation">` on sidebar
- Modals: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to title
- Tables: `<table>`, `<thead>`, `<th>` with proper scope
- Status changes: `aria-live="polite"` on status update areas
- Form errors: `aria-invalid="true"` on error fields, `aria-describedby` pointing to error text
- Icons: `aria-hidden="true"` on decorative icons
- Buttons: Always have accessible text (label or `aria-label`)

### 3C. Route Announcer

The `RouteAnnouncer.tsx` component should announce page changes to screen readers:
- On route change: "Navigated to RFIs page"
- Use `aria-live="assertive"` on a visually hidden element

### 3D. Color Contrast

Re-verify all text meets WCAG AA:
- Normal text (< 18px): 4.5:1 contrast ratio minimum
- Large text (>= 18px or >= 14px bold): 3:1 minimum
- Interactive elements: 3:1 against adjacent colors

Special attention:
- `textTertiary` (#9A9490) on `surfacePage` (#FAFAF8): 3.1:1 — Barely AA for large text only. Do NOT use for critical information.
- `primaryOrange` (#F47820) on white: 3.4:1 — Only for large text. Use `orangeText` (#C45A0C, 5.5:1) for body text.

---

## Phase 4: Performance Audit

### 4A. React.memo Coverage

Verify every component that receives primitive props (strings, numbers) or is used in lists has `React.memo`:
- All primitives (from V7-05)
- All table rows
- All list items
- All kanban cards
- All sidebar nav items

### 4B. useCallback / useMemo

Ensure event handlers passed to memoized children are wrapped in `useCallback`:
```typescript
// Bad: Creates new function every render
<TableRow onClick={() => openDetail(row.id)} />

// Good: Memoized handler
const handleClick = useCallback(() => openDetail(row.id), [row.id]);
<TableRow onClick={handleClick} />
```

Use `useMemo` for:
- Filtered/sorted lists
- Computed metric values
- Style objects that depend on state

### 4C. Virtual Scrolling

For tables with 100+ rows, verify `VirtualDataTable` is used instead of rendering all rows. Check:
- RFIs table
- Budget line items
- Directory contacts
- File lists
- Activity feeds

### 4D. Image Loading

All images (photos, avatars, thumbnails) should:
- Use `loading="lazy"`
- Have explicit dimensions
- Show placeholder/skeleton while loading
- Gracefully handle errors (show fallback avatar/icon)

---

## Phase 5: Cross-Page Consistency Audit

### 5A. Pattern Consistency Check

Open every page and verify these patterns are identical:

| Pattern | Spec |
|---------|------|
| Page title | 28px, bold, textPrimary |
| Metric card strip | Consistent height (120px), consistent gap (16px) |
| Table header | 40px, uppercase, 11px, semibold, textTertiary |
| Table row | 52px, hover with surfaceHover + orange left accent |
| Filter bar | Consistent height, same dropdown style |
| Section headers | 16px, semibold, textPrimary |
| Empty states | Centered, 48px icon, title + description + CTA |
| Loading states | Matching skeletons for each layout |
| Card style | borderRadius.xl, shadows.card, borderSubtle |
| Buttons | Same size variants, same hover/press/focus behavior |

### 5B. Transition Consistency

Every animated element uses values from `animations.ts`:
- Hover: `80ms ease-out`
- Press: `120ms spring`
- Card lift: `200ms standard`
- Dropdown: `200ms enter`
- Modal: `300ms apple`
- Page: `200ms standard`

### 5C. Spacing Consistency

Every page has the same content padding:
- Top: `spacing[6]` (24px) from TopBar
- Left/Right: `layout.contentPaddingX` (36px)
- Between sections: `spacing[6]` (24px)

---

## Phase 6: Final Visual Inspection

### 6A. Screenshot Checklist

Take a screenshot of every page and inspect:

1. **Dashboard** — Hero section, 5 metrics, widget grid
2. **RFIs** — Metrics, filter bar, table, kanban toggle
3. **Tasks** — Board view, list view
4. **Schedule** — Gantt chart, today marker, milestones
5. **Budget** — Metrics, charts, line item table
6. **Submittals** — Table, detail panel
7. **PunchList** — Grid/table toggle, photo thumbnails
8. **Safety** — Score gauge, tabs, observation table
9. **DailyLog** — Calendar strip, sections, weather card
10. **FieldCapture** — Capture mode cards, voice/photo flows
11. **AI Copilot** — Chat messages, empty state, generative UI
12. **Drawings** — Drawing list, viewer, markup tools
13. **Directory** — Company cards, contact table
14. **Meetings** — Calendar, meeting list
15. **Files** — Folder grid, file grid, upload zone
16. **Crews** — Crew cards, detail view
17. **Sidebar** — Collapsed, expanded, hover states
18. **Dark Mode** — All of the above in dark mode

For each screenshot, verify:
- [ ] No hardcoded colors visible (everything matches theme)
- [ ] Consistent spacing throughout
- [ ] Proper visual hierarchy (eye flows naturally)
- [ ] All interactive elements have visible hover states
- [ ] Brand orange is used strategically and consistently
- [ ] Typography is crisp and readable
- [ ] Shadows create proper depth
- [ ] No orphaned elements (floating without context)
- [ ] No cut-off text (everything truncates or wraps properly)

---

## Verification Checklist

- [ ] TopNav.tsx is deleted
- [ ] Zero orphan files (every .tsx is imported somewhere)
- [ ] Zero unused exports
- [ ] Zero unused package.json dependencies
- [ ] All legacy aliases removed from theme.ts (with zero remaining references)
- [ ] `as any` count reduced from 179 to under 20
- [ ] Zero console.log/warn/error in production code
- [ ] Zero TODO/FIXME/HACK comments (all resolved or ticketed)
- [ ] Rarely-visited pages are lazy-loaded
- [ ] All images use lazy loading with dimensions
- [ ] Keyboard navigation works on every page
- [ ] Screen reader ARIA attributes on critical elements
- [ ] Color contrast meets WCAG AA everywhere
- [ ] React.memo on all list/table/card components
- [ ] Virtual scrolling on tables with 100+ rows
- [ ] All 18 pages pass visual inspection in light mode
- [ ] All 18 pages pass visual inspection in dark mode
- [ ] Bundle size is reasonable (< 2MB gzipped for initial load)
- [ ] Zero TypeScript errors
- [ ] Zero ESLint errors
