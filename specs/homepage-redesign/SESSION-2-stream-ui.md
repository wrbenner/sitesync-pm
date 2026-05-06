# Session 2 (Tab B): Stream UI — Homepage Components

## Read First (in order)
1. `specs/homepage-redesign/PRODUCT-DIRECTION.md` — full vision
2. `specs/homepage-redesign/CONTRACT.md` — your ownership boundaries (do not violate)
3. `src/types/stream.ts` — locked contract; import types from here
4. `src/components/atoms/index.tsx` — existing design atoms (OrangeDot, Hairline, Eyebrow, PageQuestion)
5. `src/components/auth/PermissionGate.tsx` — wrap action buttons with this
6. `src/styles/theme.ts` and `src/styles/tokens.css` — design tokens

## Mock Data During Parallel Dev
The pre-flight stub at `src/hooks/useActionStream.ts` returns an empty result. To develop without waiting on Tab A, create a local fixture in your component file (NOT a new file) like:

```tsx
const MOCK_ITEMS: StreamItem[] = [/* 4-5 hand-rolled examples covering each cardType */]
const stream = useActionStream(role)
const items = stream.items.length ? stream.items : MOCK_ITEMS
```

Remove the mock fallback before the PR. The locked types in `src/types/stream.ts` guarantee your fixtures and Tab A's real items have identical shape.

## Objective
Build the new homepage UI. Replace the current Day page entirely. Create reusable stream and card components.

## Files to Create
```
src/components/stream/
  ActionStream.tsx          — the main stream list
  StreamItem.tsx            — individual item card
  StreamItemExpanded.tsx    — expanded state with details + actions
  StreamEmpty.tsx           — empty state
  StreamPulse.tsx           — project health strip
  StreamNav.tsx             — The Nine icon strip
  SwipeActions.tsx          — mobile swipe gesture wrapper
```

## Files to Modify
```
src/pages/day/index.tsx     — complete rewrite (keep the file, replace contents)
```

## Page Layout: `src/pages/day/index.tsx`

```tsx
export default function DayPage() {
  const { role } = useAuth() // or however role is stored
  const stream = useActionStream(role)

  return (
    <div style={{
      maxWidth: 720,
      margin: '0 auto',
      padding: `${theme.spacing[8]}px ${theme.spacing[4]}px`,
      minHeight: '100vh',
      background: 'var(--surface-page)',
    }}>
      <StreamHeader />

      {stream.items.length === 0 ? (
        <StreamEmpty />
      ) : (
        <ActionStream items={stream.items} onDismiss={stream.dismiss} onSnooze={stream.snooze} />
      )}

      <StreamPulse />
      <StreamNav />
    </div>
  )
}
```

## StreamHeader Component
- Project name: Eyebrow atom (Inter 11px, uppercase, 0.18em letter-spacing, ink3)
- Date: Inter 14px, weight 400, ink2. Format: "Thursday, April 30"
- Right side: weather icon + temperature (14px, ink3). Use existing weather hook if available.
- Height: ~60px with padding
- Bottom: Hairline (weight 3)

## ActionStream Component
- Receives `items: StreamItem[]`, `onDismiss`, `onSnooze`
- Renders StreamItem for each item
- Items separated by Hairline (weight 3 — subtlest: `rgba(26, 22, 19, 0.025)`)
- Pull-to-refresh on mobile (call stream.refetch)
- Keyboard navigation on desktop: arrow keys move focus, Enter expands, Escape collapses

## StreamItem Component (Collapsed State)
```
┌──────────────────────────────────────────────────┐
│▌[icon]  RFI #247 — Electrical Conduit Routing    │
│         3 days overdue · Martinez Eng.            │
│         ✦ Iris has a draft follow-up              │  ← only if irisEnhancement
└──────────────────────────────────────────────────┘
```

### Specs
- Left urgency bar: 3px wide, full height of item
  - critical: `var(--color-primary)` (#F47820)
  - high: `var(--color-rust)` (#B8472E) — actually use statusCritical (#C93B3B) for high since rust is brand
  - medium/low: no bar (transparent)
- Type icon: 16px, ink4 (#C4BDB4), left of title
  - rfi → MessageCircle
  - submittal → FileCheck
  - punch → CheckCircle
  - change_order → DollarSign
  - task → ListTodo
  - daily_log → BookOpen
  - incident → AlertTriangle
  - schedule → Calendar
- Title: Inter 14px, weight 600, ink (#1A1613), single line, ellipsis overflow
- Reason line: Inter 13px, weight 400, ink3 (#8C857E)
  - Overdue portion: statusCritical (#C93B3B) color — "3 days overdue" in red, rest in ink3
  - Separator: ` · ` (middle dot)
- Iris line: Inter 12px, weight 500, indigo (#4F46E5), only renders if `irisEnhancement` exists
  - ✦ character or SparklesIcon (12px) before text
- Padding: 16px vertical, 16px horizontal (mobile), 20px horizontal (desktop)
- Min height: 56px (touch target for mobile)
- Tap → expand (toggle)
- Hover (desktop): background → surfaceHover (#EFE9DD), transition 160ms

## StreamItemExpanded Component
```
┌──────────────────────────────────────────────────┐
│▌[icon]  RFI #247 — Electrical Conduit Routing    │
│         3 days overdue · Martinez Eng.            │
│                                                   │
│  RFI asking about conduit routing for the         │
│  electrical panel relocation on Level 3.          │
│  The mechanical engineer has not provided...      │
│                                                   │
│  Drawing A3.2 · Spec 26 05 00 · Photo 04-15      │  ← source trail pills
│                                                   │
│  ┌─ Iris Draft ──────────────────────────────┐    │  ← only if iris draft
│  │ "Hi Martinez Engineering, following up... │    │
│  │  ...due on April 26."                     │    │
│  │ [Send as-is]  [Edit]  [Dismiss]           │    │
│  └───────────────────────────────────────────┘    │
│                                                   │
│  [Respond]  [Reassign]  [Snooze ▾]               │
└──────────────────────────────────────────────────┘
```

### Specs
- Expand animation: Framer Motion `AnimatePresence` + `motion.div` with `initial={{ height: 0, opacity: 0 }}`, `animate={{ height: 'auto', opacity: 1 }}`, transition: 300ms `cubic-bezier(0.32, 0.72, 0, 1)` (matches theme smooth)
- Description: Inter 13px, weight 400, ink2 (#5C5550), max 3 lines with "Show more →" link, max-width 600px
- Source trail: horizontal row of pills
  - Each pill: Inter 11px, weight 500, ink3, padding 4px 8px, background surfaceInset (#F5F0E5), border-radius 4px (sm)
  - Tappable → navigates to source item
  - Separator: → arrow between pills
- Iris draft section (only if irisEnhancement.draftContent):
  - Background: surfaceInset (#F5F0E5)
  - Border-radius: 6px (base)
  - Padding: 12px 16px
  - Draft text: Inter 13px, weight 400, ink2
  - Max 4 lines with "Show full draft →"
  - Buttons: "Send as-is" (filled, primary), "Edit" (text), "Dismiss" (text, ink4)
- Action buttons:
  - Primary: background ink (#1A1613), color parchment (#FAF7F0), padding 8px 16px, border-radius 6px, Inter 13px weight 500
  - Secondary: background transparent, color ink2, padding 8px 16px, Inter 13px weight 500
  - Dismiss/Snooze: color ink4, Inter 12px
  - Snooze opens a Popover with `SnoozeDuration` options: "1 hour", "Tomorrow morning", "Next week"
  - **Permission-gate every action button:** if `action.permissionKey` is set, wrap the button in `<PermissionGate permission={action.permissionKey}>`. Hidden when not permitted (no disabled state, no fallback).
  - **Iris draft labeling:** Draft Card section header reads `✦ Iris drafted this — review before sending` in indigo (#4F46E5). Never just "AI".
- Impact chain (if item.impactChain exists):
  - Render as: `Late submittal → Delayed fabrication → Dry-in at risk`
  - Inter 12px, weight 500, rust color, each step separated by →

## SwipeActions Component (Mobile Only)
- Wraps each StreamItem
- Uses Framer Motion drag gesture
- Swipe right → green background reveals (statusActive #2D8A6E), checkmark icon, "Done"
  - Threshold: 80px drag before action commits
  - On commit: call onDismiss(item.id)
  - Spring back if released before threshold
- Swipe left → amber background reveals (statusPending #C4850C), clock icon, "Snooze"
  - On commit: show snooze time picker
- Only active on mobile (useIsMobile hook)

## StreamEmpty Component
```
┌──────────────────────────────────────────────────┐
│                                                   │
│                                                   │
│                                                   │
│         Nothing waiting on you.                   │  ← PageQuestion atom, 'medium' size
│                                                   │
│                                                   │
│                                                   │
│         ── StreamPulse ──                         │
│         ── StreamNav ──                           │
└──────────────────────────────────────────────────┘
```
- Vertically centered in viewport (use min-height calc)
- Text: PageQuestion atom, EB Garamond serif, 28px, weight 400, ink2
- Feeling: calm, resolved, rewarding. This is inbox zero.

## StreamPulse Component
```
Schedule: On track    Budget: 82%    Weather: ☀️ 72°    Crew: 47
```
- Horizontal flex row, evenly spaced
- Each item: Eyebrow atom (Inter 11px, uppercase, 0.18em letter-spacing)
- Value color: moss (#4A5D3A) for positive, rust/statusCritical for negative, ink2 for neutral
- Tappable: Schedule → /schedule, Budget → /budget, Crew → /workforce
- Hairline (weight 2) above
- Padding: 20px vertical
- On mobile: 2x2 grid instead of horizontal row

### Data
- Schedule: use useScheduleActivities to compute overall schedule variance
- Budget: use existing budget hooks/metrics
- Weather: use existing weather hook
- Crew: use useWorkforceMembers for count

## StreamNav Component
- 9 icons in horizontal row (or role-filtered subset)
- Each icon: 24px Lucide icon, 48px touch target
- Color: ink4 (#C4BDB4) default, primary (#F47820) for current page
- OrangeDot overlay (from atoms) on icons that have items in the stream
  - Map StreamItem.type to nav icon to determine which get dots
- No labels by default
- Desktop hover: tooltip with page name
- Mobile long-press: tooltip with page name + question
- Padding: 24px vertical
- Hairline (weight 2) above

### Icon mapping
| Page | Icon | Route | Stream types that trigger dot |
|------|------|-------|-----|
| Command | Zap | /day | (current page, always highlighted) |
| RFIs | MessageCircle | /rfis | rfi |
| Submittals | FileCheck | /submittals | submittal |
| Schedule | Calendar | /schedule | schedule |
| Budget | DollarSign | /budget | change_order |
| Drawings | Layers | /drawings | — |
| Daily Log | BookOpen | /daily-log | daily_log |
| Reports | FileText | /reports | — |
| Documents | FolderOpen | /files | — |

## Responsive Behavior

### Mobile (< 768px)
- Full-width, 16px horizontal padding
- 56px min height per stream item
- Swipe actions enabled
- StreamPulse: 2x2 grid
- StreamNav: horizontal scroll if > 6 items visible for role
- Bottom safe area padding for iOS

### Desktop (≥ 768px)
- Max-width 720px, centered
- Hover states on items
- No swipe — hover reveals action icons on right side of item
- Keyboard navigation
- StreamPulse: single horizontal row

## Design Token Reference (from tokens.css)
- surfacePage: #FAF7F0
- surfaceRaised: #FFFFFF
- surfaceInset: #F5F0E5
- surfaceHover: #EFE9DD
- ink: #1A1613
- ink2: #5C5550
- ink3: #8C857E
- ink4: #C4BDB4
- primary: #F47820
- rust: #B8472E
- moss: #4A5D3A
- statusCritical: #C93B3B
- statusActive: #2D8A6E
- statusPending: #C4850C
- hairline: rgba(26, 22, 19, 0.10)
- hairline-3: rgba(26, 22, 19, 0.025)
- indigo AI: #4F46E5
- border-radius base: 6px
- transition smooth: 300ms cubic-bezier(0.32, 0.72, 0, 1)
- transition quick: 160ms cubic-bezier(0.25, 0.1, 0.25, 1)

## Do NOT
- Modify `src/types/stream.ts` (locked contract)
- Modify `src/hooks/useActionStream.ts` (Tab A owns it; consume the stub)
- Modify `src/stores/streamStore.ts` (Tab A owns it)
- Modify `src/components/Sidebar.tsx`, navigation config, or routing (Tab C)
- Modify `src/services/iris/*` (Tab D)
- Keep ANY of the current Day page UI (sundial, horizon, metric cards)
- Add charts, graphs, or data visualizations
- Add filtering tabs or category toggles
- Add a floating AI button
- Use card shadows in the stream (items are list entries, not floating cards)
- Use Tailwind (project uses CSS custom properties + inline styles)
- Create a grid/dashboard layout
