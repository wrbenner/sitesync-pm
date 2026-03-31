# V7-01: Animation & Micro-Interaction System

## Goal
Build a unified, reusable animation system that makes every interaction in SiteSync AI feel alive, responsive, and intentional. Steve Jobs believed that animation communicates meaning. Every hover, click, transition, and state change must feel like the interface is breathing.

## Why This Matters
The app currently has functional pages but feels "flat" and "dead." The biggest difference between a good UI and a world class UI is motion. Apple, Linear, Vercel, and Stripe all invest heavily in motion as a quality signal. Right now SiteSync has almost zero micro-interactions. This prompt fixes that entirely.

---

## Phase 1: Core Animation Primitives

### 1A. Create `src/styles/animations.ts`

This file becomes the single source of truth for all motion in the app. Every animated behavior references this file.

```typescript
// src/styles/animations.ts
// SiteSync AI — Unified Motion System
// Every animation in the app is defined here. No magic numbers in components.

// Easing curves (perceptually tuned)
export const easing = {
  // Standard movements (entering, resizing, repositioning)
  standard: 'cubic-bezier(0.32, 0.72, 0, 1)',
  // Entering from off-screen or appearing
  enter: 'cubic-bezier(0, 0, 0.2, 1)',
  // Leaving screen or disappearing
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  // Bouncy/spring (for confirmations, success states, playful moments)
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  // Linear (only for progress bars, loading spinners)
  linear: 'linear',
  // Apple-style (for modals, drawers, large surface transitions)
  apple: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
} as const;

// Duration scale (perceptually consistent)
export const duration = {
  instant: 80,     // Hover color changes, icon swaps
  fast: 120,       // Button press feedback, toggles
  normal: 200,     // Card hovers, dropdown opens
  smooth: 300,     // Modal/drawer enter, page transitions
  slow: 500,       // Complex layout shifts, dashboard widget reorganization
  glacial: 800,    // Onboarding, first-time animations
} as const;

// Pre-built CSS transition strings
export const motion = {
  // Hover effects (background, border, shadow changes)
  hover: `all ${duration.instant}ms ${easing.standard}`,
  // Button press/active state
  press: `transform ${duration.fast}ms ${easing.spring}`,
  // Card lift on hover
  cardLift: `transform ${duration.normal}ms ${easing.standard}, box-shadow ${duration.normal}ms ${easing.standard}`,
  // Dropdown/popover open
  dropdownOpen: `opacity ${duration.normal}ms ${easing.enter}, transform ${duration.normal}ms ${easing.enter}`,
  // Modal/drawer enter
  modalEnter: `opacity ${duration.smooth}ms ${easing.apple}, transform ${duration.smooth}ms ${easing.apple}`,
  // Page content fade in
  pageFade: `opacity ${duration.smooth}ms ${easing.enter}`,
  // Tab content switch
  tabSwitch: `opacity ${duration.fast}ms ${easing.standard}`,
  // Toast enter
  toastEnter: `transform ${duration.smooth}ms ${easing.spring}, opacity ${duration.smooth}ms ${easing.enter}`,
  // Sidebar expand/collapse
  sidebarResize: `width ${duration.smooth}ms ${easing.standard}, padding ${duration.smooth}ms ${easing.standard}`,
  // Skeleton shimmer
  shimmer: `background-position 1.5s ${easing.linear} infinite`,
  // Focus ring appear
  focusRing: `box-shadow ${duration.fast}ms ${easing.standard}`,
} as const;

// Framer Motion variants (for components using framer-motion)
export const variants = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: duration.smooth / 1000, ease: [0.32, 0.72, 0, 1] },
  },
  slideUp: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
    transition: { duration: duration.smooth / 1000, ease: [0.32, 0.72, 0, 1] },
  },
  slideDown: {
    initial: { opacity: 0, y: -8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 8 },
    transition: { duration: duration.normal / 1000, ease: [0.32, 0.72, 0, 1] },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
    transition: { duration: duration.smooth / 1000, ease: [0.32, 0.72, 0, 1] },
  },
  cardHover: {
    rest: { y: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.015)' },
    hover: { y: -2, boxShadow: '0 3px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)' },
    tap: { y: 0, scale: 0.995 },
  },
  staggerChildren: {
    animate: { transition: { staggerChildren: 0.04 } },
  },
  listItem: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: duration.normal / 1000, ease: [0.32, 0.72, 0, 1] },
  },
  modalOverlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: duration.normal / 1000 },
  },
  modalContent: {
    initial: { opacity: 0, scale: 0.96, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.98, y: 5 },
    transition: { duration: duration.smooth / 1000, ease: [0.25, 0.1, 0.25, 1] },
  },
  tooltip: {
    initial: { opacity: 0, scale: 0.96, y: 4 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.96 },
    transition: { duration: duration.fast / 1000, ease: [0.32, 0.72, 0, 1] },
  },
} as const;

// CSS keyframes as template strings (inject once in App.tsx or a global style)
export const keyframes = `
@keyframes shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes ripple {
  0% { transform: scale(0); opacity: 0.4; }
  100% { transform: scale(4); opacity: 0; }
}
`;
```

### 1B. Inject global keyframes

In `src/App.tsx`, inject the keyframes string as a `<style>` tag at the top of the render tree. Use `useEffect` to inject once on mount, or render a `<style>` element directly.

```typescript
import { keyframes } from './styles/animations';

// Inside App component, at the top of the return:
<>
  <style>{keyframes}</style>
  {/* rest of app */}
</>
```

---

## Phase 2: Apply Hover States to EVERY Interactive Element

### 2A. Button Hover & Press

In `Primitives.tsx` (or the new split `Btn.tsx` after V7-05), every `Btn` component must:

1. On hover: Slightly darken the background (use `orangeHover` for primary, `surfaceHover` for ghost/secondary), lift shadow from `none`/`sm` to `card`.
2. On active/press: Scale to `0.98`, shadow to `pressed`, background to `orangePressed` for primary.
3. Apply `cursor: pointer` universally.
4. Transition: Use `motion.hover` for background/border, `motion.press` for transform.

Implementation pattern (inline style with state):
```typescript
const [isHovered, setIsHovered] = useState(false);
const [isPressed, setIsPressed] = useState(false);

<button
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
  onMouseDown={() => setIsPressed(true)}
  onMouseUp={() => setIsPressed(false)}
  style={{
    ...baseStyle,
    transition: 'all 120ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    transform: isPressed ? 'scale(0.98)' : 'scale(1)',
    background: isPressed ? colors.orangePressed : isHovered ? colors.orangeHover : colors.primaryOrange,
    boxShadow: isHovered && !isPressed ? shadows.card : shadows.none,
  }}
/>
```

**CRITICAL: Do NOT use framer-motion for simple hover states on buttons.** Use CSS transitions with inline styles and React state. Framer-motion is reserved for complex orchestrated animations (modals, page transitions, staggered lists).

### 2B. Card Hover

Every `Card` component must lift on hover:
1. On hover: `translateY(-2px)`, shadow from `card` to `cardHover`, border from `borderSubtle` to `borderDefault`.
2. On press (if clickable): `translateY(0)`, `scale(0.995)`, shadow back to `card`.
3. Transition: Use `motion.cardLift`.

### 2C. Table Row Hover

Every `TableRow` component:
1. On hover: Background fades to `surfaceHover`, left border appears (3px solid `primaryOrange`, animated from 0 width).
2. Cursor changes to `pointer` if row is clickable.
3. Transition: `background ${duration.instant}ms ${easing.standard}`.

### 2D. Sidebar Nav Item Hover

Each nav item in `Sidebar.tsx`:
1. On hover: Background to `surfaceHover`, text to `textPrimary`, icon opacity to 1.
2. Active state: Left 3px border with `primaryOrange`, background `orangeSubtle`, text weight `600`.
3. Transition: `motion.hover`.

### 2E. Tag/Badge Hover

`StatusTag`, `PriorityTag`, `Tag`:
1. On hover: Slightly increase opacity/saturation of background, add subtle `sm` shadow.
2. Cursor: `default` unless clickable, then `pointer`.

### 2F. Icon Button Hover

Every icon-only button (close, menu, actions):
1. On hover: Background circle appears (using `surfaceHover`), icon color intensifies.
2. On press: Background `surfaceInset`, slight scale down.
3. Radius: `borderRadius.full` for the hover background.

---

## Phase 3: Page Transition Animations

### 3A. Route Change Animation

Wrap the `<Routes>` in `App.tsx` with an `AnimatePresence` from framer-motion.

```typescript
import { AnimatePresence, motion } from 'framer-motion';

// In the main content area:
<AnimatePresence mode="wait">
  <motion.div
    key={location.pathname}
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
  >
    <Routes>
      {/* all routes */}
    </Routes>
  </motion.div>
</AnimatePresence>
```

### 3B. Staggered Content Load

When a page loads, its content should stagger in rather than appearing all at once:
1. Metric cards across the top: stagger 40ms each, fade + slide up.
2. Main content below: fade in after metrics complete.
3. Secondary sidebar/panels: fade in 100ms after main.

Use framer-motion's `staggerChildren` in the page container:
```typescript
<motion.div
  variants={{ animate: { transition: { staggerChildren: 0.04 } } }}
  initial="initial"
  animate="animate"
>
  {metricCards.map((card, i) => (
    <motion.div
      key={i}
      variants={{
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
      }}
    >
      <MetricBox {...card} />
    </motion.div>
  ))}
</motion.div>
```

---

## Phase 4: Component-Specific Animations

### 4A. Modal Open/Close

Current modals just appear. They need:
1. Overlay: Fade from transparent to `overlayDark` in 200ms.
2. Content: Scale from 0.96 to 1, fade in, slight Y shift (10px to 0).
3. Close: Reverse at 80% speed (faster exit than enter).
4. Body scroll lock when modal is open.

### 4B. Dropdown/Popover

Dropdowns and context menus:
1. Open: Scale from 0.95 to 1, fade in, transform-origin at trigger point.
2. Items inside: Stagger 30ms each, fade + slide down 4px.
3. Close: Fade out in half the time (no scale down on exit).

### 4C. Toast Notifications

Toasts should:
1. Enter from top-right: Slide down + fade in with spring easing.
2. Progress bar on auto-dismiss: Linear shrink from 100% to 0%.
3. Exit: Slide right + fade out.

### 4D. Tab Content Switch

When switching tabs (RFIs table/kanban, Safety tabs, Budget tabs):
1. Outgoing content: Fade out in 80ms.
2. Incoming content: Fade in + slight slide from direction of tab (left tab = slide from left).
3. Tab indicator: Animated underline that slides to active tab position (use `layoutId` in framer-motion or CSS transition on `left` + `width`).

### 4E. Sidebar Collapse/Expand

1. Width transition: 252px to 72px with `motion.sidebarResize`.
2. Nav labels: Fade out at 60% of the collapse (so they disappear before space is gone).
3. Section headers: Collapse height + fade.
4. Tooltip on collapsed items: Appears on hover to the right with `motion.tooltip`.

### 4F. Kanban Card Drag

If using a drag library (dnd-kit):
1. Pickup: Card lifts (shadow to `dropdown`, scale to 1.02, slight rotation ±1deg).
2. Dragging: Cursor `grabbing`, card follows with spring physics.
3. Drop: Spring settle to final position, shadow returns to `card`.

---

## Phase 5: Skeleton Shimmer

All loading states must use animated skeleton placeholders, not empty space or spinners.

### 5A. Skeleton Base Style

```typescript
export const skeletonStyle = {
  background: `linear-gradient(90deg, ${colors.surfaceInset} 25%, ${colors.surfaceHover} 50%, ${colors.surfaceInset} 75%)`,
  backgroundSize: '800px 100%',
  animation: 'shimmer 1.5s linear infinite',
  borderRadius: borderRadius.base,
};
```

### 5B. Skeleton Variants

Create skeleton variants that match the real content shapes:
1. `SkeletonText`: Rectangle, height 12px, width varies (60%, 80%, 45% for multi-line).
2. `SkeletonMetricCard`: Card-shaped, matches `MetricBox` dimensions.
3. `SkeletonTableRow`: Row with 4-6 shimmer blocks matching column widths.
4. `SkeletonAvatar`: Circle, 32px diameter.
5. `SkeletonChart`: Larger rectangle matching chart area dimensions.

### 5C. Content Transition

When real data replaces skeleton:
1. Skeleton fades out in 150ms.
2. Real content fades in with `slideUp` variant.
3. Never show skeleton and content simultaneously.

---

## Phase 6: Scroll Animations

### 6A. Scroll Fade-In

Long pages (Budget, Schedule, Safety) should animate content into view as the user scrolls:
1. Use IntersectionObserver (or framer-motion's `useInView`).
2. Each section fades + slides up 8px when 20% visible.
3. Only trigger once (not on scroll back up).

### 6B. Sticky Header Shadow

When the user scrolls past the metric cards:
1. The top bar gains `shadows.card` (animate from `shadows.none`).
2. Tab bars that become sticky gain the same shadow.
3. Transition: `motion.hover`.

---

## Phase 7: Focus & Accessibility Motion

### 7A. Focus Ring Animation

When an element receives keyboard focus:
1. Focus ring animates in (not instant snap).
2. Use: `transition: box-shadow 120ms ease-out`.
3. Ring: `0 0 0 2px white, 0 0 0 4px ${colors.borderFocus}`.

### 7B. Reduced Motion

CRITICAL: Wrap all animations in a `prefers-reduced-motion` check.

```typescript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// In component:
const shouldAnimate = !prefersReducedMotion;
```

If reduced motion is on:
1. Skip all transforms (no slide, no scale).
2. Keep opacity transitions but at 0ms (instant).
3. Keep color transitions (hover states) since those convey information.

Create a hook:
```typescript
export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return prefersReduced;
}
```

---

## Verification Checklist

After implementation, every single one of these must be true:

- [ ] Every button has a visible hover state and press state
- [ ] Every card lifts on hover with shadow transition
- [ ] Every table row highlights on hover
- [ ] Every sidebar nav item has hover and active transitions
- [ ] Every modal animates open and closed
- [ ] Every dropdown animates open and closed
- [ ] Every toast slides in and out
- [ ] Tab switches are animated (content + indicator)
- [ ] Page transitions fade/slide when navigating
- [ ] Metric cards stagger on page load
- [ ] Skeleton loaders shimmer during data fetch
- [ ] Focus rings animate in on keyboard navigation
- [ ] `prefers-reduced-motion` disables transform animations
- [ ] No animation uses hardcoded values (all reference `animations.ts`)
- [ ] No animation feels sluggish (nothing over 500ms for standard interactions)
- [ ] No animation feels jittery (60fps minimum, no layout thrash)
