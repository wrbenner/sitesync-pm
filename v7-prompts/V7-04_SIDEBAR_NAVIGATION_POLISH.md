# V7-04: Sidebar & Navigation Polish

## Goal
Make the sidebar feel like a Linear/Notion-tier navigation: spatially clear, silky smooth, with beautiful transitions and impeccable typography. Fix every hardcoded value, add proper hover/active states, and implement collapse behavior.

## Why This Matters
The sidebar is visible on every single page. If the sidebar feels cheap, the entire app feels cheap. Currently it has cramped spacing, hardcoded rgba values, negative margin hacks, and inconsistent active indicators. These are the details that separate a $50M product from a weekend project.

---

## Phase 1: Sidebar Structure Fix

### 1A. Remove Negative Margins

The current Sidebar.tsx uses `margin: '-4px 0 0 -8px'` for logo alignment. This is a hack.

Fix: Use proper flexbox alignment:
```typescript
// Logo area
<div style={{
  display: 'flex',
  alignItems: 'center',
  padding: `${spacing[5]} ${spacing[5]} ${spacing[4]}`,
  gap: spacing[3],
}}>
  {/* Logo icon */}
  <div style={{
    width: '32px',
    height: '32px',
    borderRadius: borderRadius.md,
    background: colors.primaryOrange,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    {/* S icon or construction helmet */}
  </div>
  {/* App name */}
  <span style={{
    fontSize: typography.fontSize.title,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    letterSpacing: typography.letterSpacing.tight,
  }}>
    SiteSync
  </span>
</div>
```

### 1B. Section Spacing

Current section spacing is `8px` top, `4px` bottom. This is too cramped.

Fix:
- Between sections: `spacing[5]` (20px) gap
- Section header: `padding: '${spacing[2]} ${spacing[5]}'`, `marginBottom: spacing[1]`
- Section header text: `typography.fontSize.caption` (11px), `typography.fontWeight.semibold`, `colors.textTertiary`, `typography.letterSpacing.widest`, `textTransform: 'uppercase'`

### 1C. Nav Item Design

Each nav item must be redesigned:

```typescript
// Nav item base
{
  display: 'flex',
  alignItems: 'center',
  gap: spacing[3],           // 12px between icon and label
  padding: `${spacing[2]} ${spacing[3]}`,  // 8px 12px
  margin: `0 ${spacing[2]}`,  // 0 8px (inset from sidebar edges)
  borderRadius: borderRadius.md,  // 8px
  cursor: 'pointer',
  transition: motion.hover,   // from animations.ts
  position: 'relative',
}

// Nav item — default state
{
  background: 'transparent',
  color: colors.textSecondary,
}

// Nav item — hover state
{
  background: colors.surfaceHover,
  color: colors.textPrimary,
}

// Nav item — active (current page)
{
  background: colors.orangeSubtle,
  color: colors.primaryOrange,
  fontWeight: typography.fontWeight.medium,
}

// Icon styling
{
  width: '18px',
  height: '18px',
  opacity: 0.6,           // default
  // opacity: 0.85,       // hover
  // opacity: 1,          // active, color: colors.primaryOrange
  transition: 'opacity 120ms ease-out',
}

// Label styling
{
  fontSize: typography.fontSize.sm,  // 13px
  fontWeight: typography.fontWeight.normal,  // 400
  // fontWeight: typography.fontWeight.medium, // 500 when active
  lineHeight: typography.lineHeight.tight,
}
```

### 1D. Active Indicator

Replace any existing active indicator with:
- Left edge: 3px wide, `borderRadius.full` on right side, `colors.primaryOrange`
- Position: absolute, left: 0, vertically centered on the nav item
- Height: 60% of nav item height
- Animate in: `scaleY(0)` to `scaleY(1)`, `duration.fast` (120ms), `easing.spring`
- This is like the Linear sidebar indicator

```typescript
// Active indicator (inside nav item, only visible when active)
{
  position: 'absolute',
  left: 0,
  top: '20%',
  bottom: '20%',
  width: '3px',
  borderRadius: `0 ${borderRadius.full} ${borderRadius.full} 0`,
  background: colors.primaryOrange,
  transform: isActive ? 'scaleY(1)' : 'scaleY(0)',
  transition: `transform ${duration.fast}ms ${easing.spring}`,
}
```

---

## Phase 2: Sidebar Collapse

### 2A. Collapse Trigger

Add a collapse/expand button:
- Position: Bottom of sidebar, above any user section
- Icon: `ChevronsLeft` (lucide) when expanded, `ChevronsRight` when collapsed
- Style: Ghost icon button, `colors.textTertiary`, `20px`
- Alternatively: Trigger button at the bottom edge of the sidebar, or a hover zone on the right edge

### 2B. Collapse Animation

When collapsing:
1. Width transitions from `layout.sidebarWidth` (252px) to `layout.sidebarCollapsed` (72px)
2. Transition: `width 300ms cubic-bezier(0.32, 0.72, 0, 1)`
3. Nav labels fade out at ~60% of the transition (before the space is fully gone)
4. Section headers collapse (height 0, opacity 0, overflow hidden)
5. Logo text fades out, only icon remains
6. Main content area expands to fill the space

### 2C. Collapsed State

When collapsed:
- Only icons visible, centered in the 72px width
- Hover: Tooltip appears to the right showing the nav item label
- Tooltip: `background: colors.textPrimary`, `color: colors.textOnDark`, `borderRadius.base`, `shadows.dropdown`, `fontSize: typography.fontSize.label`
- Tooltip enters with `variants.tooltip` from animations.ts
- Active item: Orange background circle behind the icon

### 2D. Expand on Hover (Optional)

Consider: When collapsed, hovering over the sidebar for 300ms could temporarily expand it (like macOS dock). This is a premium touch but optional.

---

## Phase 3: Scrollable Navigation

### 3A. Scroll Behavior

With 63 nav items across 8 sections, the sidebar content will overflow.

- The sidebar body (below logo, above user section) must be scrollable
- Use `overflow-y: auto` with custom scrollbar styling
- Scrollbar: 4px wide, `borderRadius.full`, `colors.borderSubtle` track, `colors.textTertiary` thumb
- Scrollbar only visible on hover (fade in on sidebar hover, fade out 1s after scroll stops)

```typescript
// Custom scrollbar CSS (inject as style tag or CSS-in-JS)
.sidebar-scroll::-webkit-scrollbar { width: 4px; }
.sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
.sidebar-scroll::-webkit-scrollbar-thumb {
  background: ${colors.borderDefault};
  border-radius: 9999px;
}
.sidebar-scroll::-webkit-scrollbar-thumb:hover {
  background: ${colors.textTertiary};
}
```

### 3B. Sticky Sections

The logo area and user/settings area at the bottom should be sticky (not scroll). Only the nav items scroll.

Layout:
```
┌──────────────┐
│  Logo Area   │  ← Sticky top
├──────────────┤
│  Nav Items   │  ← Scrollable
│  Section 1   │
│  Section 2   │
│  ...         │
│  Section 8   │
├──────────────┤
│  User Area   │  ← Sticky bottom
└──────────────┘
```

Use flexbox with `flex: 1` on the scrollable area and `flex-shrink: 0` on sticky areas.

---

## Phase 4: Project Switcher

### 4A. Project Dropdown

Below the logo, add a project switcher:
- Shows current project name with a chevron-down icon
- Click: Opens dropdown with recent projects
- Dropdown items: Project name + address, hover state
- "All Projects" link at bottom → navigates to Portfolio page
- Dropdown animation: `variants.slideDown` from animations.ts

### 4B. Project Indicator

Current project should have a subtle color bar at the very top of the sidebar:
- 2px high bar, full width, `colors.primaryOrange`
- This gives a sense of "you are here" that persists across navigation

---

## Phase 5: TopBar Polish

### 5A. Search Field

The TopBar search field needs:
- Width: Flexible, use `flex: 1` with `max-width: 480px` instead of hardcoded `280px`
- Height: `touchTarget.min` (44px)
- Background: `colors.surfaceInset` (not white, gives it depth)
- Border: `1px solid transparent`, on focus: `1px solid ${colors.borderFocus}`
- Placeholder: "Search anything... ⌘K" in `colors.textTertiary`
- Icon: Search icon, 16px, `colors.textTertiary`
- Focus: Background transitions to `colors.surfaceRaised`, border becomes orange
- Transition: `motion.hover`
- Keyboard shortcut badge: "⌘K" pill on the right side, `colors.borderDefault` border, `typography.fontSize.caption`

### 5B. Icon Button Consistency

All TopBar icon buttons must be:
- Size: `36px` x `36px` (32px icon area + 4px padding each side)
- Border radius: `borderRadius.md` (8px)
- Background: transparent → `colors.surfaceHover` on hover
- Icon size: 20px
- Color: `colors.textSecondary` → `colors.textPrimary` on hover
- Transition: `motion.hover`
- Press: `colors.surfaceInset` background

### 5C. Notification Bell

The notification bell button:
- Default: Same as other icon buttons
- Has notifications: Small red dot (8px circle) at top-right of the icon
- Dot animation: Subtle pulse every 3 seconds (using CSS `pulse` keyframe)
- Click: Opens notification panel (dropdown style, right-aligned)

### 5D. User Avatar

The user avatar in TopBar:
- Size: 32px circle
- Border: `2px solid ${colors.borderSubtle}`
- Hover: Border becomes `colors.borderDefault`, slight shadow
- Click: Opens user dropdown (settings, profile, sign out)
- Dropdown: Standard dropdown animation from V7-01

### 5E. Breadcrumbs

If breadcrumbs exist in TopBar:
- Separator: "/" or "›" in `colors.textTertiary`
- Current page: `colors.textPrimary`, `fontWeight.medium`
- Parent pages: `colors.textSecondary`, clickable, hover underline
- Font: `typography.fontSize.sm`

---

## Phase 6: TopBar Scroll Behavior

### 6A. Shadow on Scroll

When the page content scrolls:
1. TopBar gains `shadows.sm` (from `shadows.none`)
2. Transition: `box-shadow 200ms ease-out`
3. Use `IntersectionObserver` on a sentinel element at the top of the content area

### 6B. Sticky Tab Bars

Pages with tab bars (RFIs, Safety, Budget) have a tab bar below the TopBar:
- When scrolled past the tab bar's natural position, it sticks below the TopBar
- Gains `shadows.sm` and `background: colors.surfaceRaised`
- Transition matches TopBar shadow transition

---

## Verification Checklist

- [ ] Zero negative margins in Sidebar.tsx
- [ ] Zero hardcoded rgba or hex values in Sidebar.tsx or TopBar.tsx
- [ ] Every nav item has hover, active, and default states with smooth transitions
- [ ] Active indicator animates in with spring easing
- [ ] Section headers are uppercase, tracked wide, in caption size
- [ ] Section spacing is 20px (not 8px)
- [ ] Sidebar content scrolls with custom thin scrollbar
- [ ] Logo area and user area are sticky (don't scroll)
- [ ] Sidebar collapses to 72px with animated labels
- [ ] Collapsed state shows tooltips on hover
- [ ] TopBar search is flexible width with focus animation
- [ ] All TopBar icon buttons are same size with consistent hover states
- [ ] Notification bell has animated red dot when notifications exist
- [ ] User avatar has hover state and click dropdown
- [ ] TopBar gains shadow on page scroll
- [ ] Tab bars stick below TopBar with matching shadow
- [ ] All transitions reference animation system (not hardcoded values)
