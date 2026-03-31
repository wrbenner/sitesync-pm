# V7-00: System Context & Execution Order

## What Is V7?

V7 is a complete UI perfection pass on SiteSync AI. No new features. No new pages. No backend work. The sole objective is to take every existing page, component, and interaction from "good enough" to "Steve Jobs would approve." This means:

- Every hover state is animated
- Every color comes from the design token system
- Every table row lifts on hover
- Every modal glides open and shut
- Every loading state uses skeleton shimmers
- Every empty state is beautiful and actionable
- Every font size, weight, and color follows the type scale
- Dark mode works flawlessly
- Dead code is eliminated
- The app feels alive, responsive, and intentional

## Codebase Snapshot

| Metric | Value |
|--------|-------|
| Total TypeScript/TSX | ~86,000 lines |
| Pages | 48 files in `src/pages/` |
| Components | 150 files in `src/components/` |
| Hooks | 38 files in `src/hooks/` |
| Stores | 24 Zustand stores |
| Design Tokens | `src/styles/theme.ts` (435 lines) |
| Framework | React 19 + TypeScript + Vite |
| Styling | Inline styles using theme tokens |
| Icons | lucide-react |
| Animation | Framer Motion (for complex), CSS transitions (for simple) |
| Charts | Nivo + Recharts |

## Tech Stack Rules

- **Styling:** Inline styles using design tokens. NOT Tailwind. NOT CSS modules. NOT styled-components.
- **Animation (simple):** CSS transitions with inline styles + React state for hover/press/focus.
- **Animation (complex):** Framer Motion for modals, page transitions, staggered lists, drag.
- **Icons:** lucide-react exclusively. No other icon libraries.
- **Writing:** NEVER use hyphens in any text content, UI copy, or comments.
- **Theme tokens:** Every visual value comes from `src/styles/theme.ts` or the new `src/styles/animations.ts`.

## File Reference

| File | Purpose | Notes |
|------|---------|-------|
| `src/styles/theme.ts` | All design tokens | Source of truth for colors, spacing, typography, shadows, radii |
| `src/styles/animations.ts` | Motion system | Created in V7-01. Easing, duration, motion presets, variants |
| `src/components/Primitives.tsx` | 24 shared components | Split into `src/components/primitives/` in V7-05 |
| `src/components/Sidebar.tsx` | Left navigation | Fixed in V7-04 |
| `src/components/TopBar.tsx` | Sticky top bar | Fixed in V7-04 |
| `src/components/TopNav.tsx` | DEAD CODE | Deleted in V7-13 |
| `src/pages/Dashboard.tsx` | Command center | Redesigned in V7-03 |
| `src/App.tsx` | Main shell + routing | Animations added in V7-01 |

---

## Execution Order

Execute these prompts in this exact order. Each builds on the previous.

### Foundation Layer (do first, everything depends on these)

| Order | Prompt | Dependency | Description |
|-------|--------|------------|-------------|
| 1 | **V7-01** | None | Animation system. Creates `animations.ts`. Must exist before any hover/transition work. |
| 2 | **V7-02** | None | Theme token cleanup. Fixes hardcoded values. Must be done before component polish. |
| 3 | **V7-09** | V7-02 | Typography hierarchy. Establishes text rules. Must be done before page polish. |

### Component Layer (do second, pages depend on these)

| Order | Prompt | Dependency | Description |
|-------|--------|------------|-------------|
| 4 | **V7-05** | V7-01, V7-02 | Split Primitives.tsx, polish every component. |
| 5 | **V7-06** | V7-01, V7-02, V7-05 | Table/list/Kanban perfection. |
| 6 | **V7-07** | V7-01, V7-02, V7-05 | Form/modal/input polish. |
| 7 | **V7-08** | V7-01, V7-05 | Loading skeletons and empty states for all components. |

### Layout Layer

| Order | Prompt | Dependency | Description |
|-------|--------|------------|-------------|
| 8 | **V7-04** | V7-01, V7-02 | Sidebar and navigation. |
| 9 | **V7-03** | V7-01, V7-02, V7-05, V7-08 | Dashboard redesign (uses polished components). |

### Page Layer (do after components are polished)

| Order | Prompt | Dependency | Description |
|-------|--------|------------|-------------|
| 10 | **V7-10** | V7-01 through V7-09 | Polish RFIs, Tasks, Schedule, Budget, Submittals, PunchList. |
| 11 | **V7-11** | V7-01 through V7-09 | Polish Safety, DailyLog, FieldCapture, AI, Drawings, etc. |

### System Layer (do last)

| Order | Prompt | Dependency | Description |
|-------|--------|------------|-------------|
| 12 | **V7-12** | All above | Dark mode and depth system. |
| 13 | **V7-13** | All above | Dead code removal and final QA. |

---

## Quality Bar

Every change in V7 must meet ALL of these criteria:

1. **Uses theme tokens exclusively** — Zero hardcoded px, color, shadow, or radius values
2. **Has hover state** — Every interactive element (buttons, cards, rows, links, tags) has a visible, animated hover state
3. **Has loading state** — Every data-dependent view has a shimmer skeleton
4. **Has empty state** — Every collection has a beautiful empty state with icon + CTA
5. **Follows type scale** — Every text element uses a defined font size, weight, and color
6. **Animates smoothly** — All transitions are 60fps, use the correct easing, and respect `prefers-reduced-motion`
7. **Works in dark mode** — After V7-12, every component looks correct in both themes
8. **Is accessible** — Focus rings, ARIA attributes, keyboard navigation, color contrast
9. **Has zero dead code** — No unused imports, exports, files, or commented-out blocks

## What V7 Does NOT Include

- New pages or features
- Backend/API integration
- Authentication
- State management migration (Zustand stores stay as-is)
- Mobile-native features
- Real-time/WebSocket integration
- File upload implementation
- AI model integration

These are for V8+. V7 is purely about making what exists beautiful.

---

## Brand Colors Quick Reference

| Color | Hex | Use |
|-------|-----|-----|
| Primary Orange | `#F47820` | CTAs, active states, brand accent |
| Orange Text (AA) | `#C45A0C` | Orange text on white backgrounds |
| Orange Hover | `#E06A10` | Button/link hover |
| Orange Pressed | `#D05E08` | Button/link pressed |
| Orange Subtle | `rgba(244,120,32,0.08)` | Active nav, selected backgrounds |
| Surface Page | `#FAFAF8` | Page background |
| Surface Raised | `#FFFFFF` | Cards, elevated surfaces |
| Surface Inset | `#F3EFEC` | Input backgrounds, nested areas |
| Text Primary | `#1A1613` | Body text, headings |
| Text Secondary | `#5C5550` | Descriptions, labels |
| Text Tertiary | `#9A9490` | Metadata, timestamps |
| Status Active | `#2D8A6E` | Success, complete, approved |
| Status Critical | `#C93B3B` | Error, overdue, rejected |
| Status Pending | `#C4850C` | Warning, under review |
| Status Info | `#3A7BC8` | Info, in progress |
| Indigo | `#4F46E5` | AI accent |
