# V7-03: Dashboard Redesign

## Goal
Transform the Dashboard from a "bootstrap template" into a world-class command center that makes superintendents feel powerful the moment they open the app. The Dashboard is the first thing users see. It must be the most beautiful, most informative, most polished page in the entire product.

## Why This Matters
The current Dashboard was rated "feature complete but personality light." Widget headers are all 12px (too small), brand color is underutilized, the BIM preview is a static illustration, and the overall composition feels like a generic admin template. A construction super should open this page and immediately know: what's hot, what's behind, what needs attention, and what happened overnight. All in under 3 seconds.

---

## Phase 1: Dashboard Layout & Composition

### 1A. Hero Section (Top of Page)

Replace the current flat metric cards with a hero section that creates visual impact:

**Project Hero Bar:**
- Full-width card at the very top with the project name, address, and current phase
- Left side: Project name in `typography.fontSize.heading` (28px), semibold, `colors.textPrimary`
- Below name: Project address in `typography.fontSize.sm` (13px), `colors.textSecondary`
- Right side: Overall completion ring (circular progress, 80px diameter) with percentage in the center
- The ring uses `colors.primaryOrange` for filled, `colors.surfaceInset` for empty
- Below the ring: "Day 247 of 365" in `typography.fontSize.label`, `colors.textTertiary`
- Background: `colors.surfaceRaised` with `shadows.card`
- Padding: `spacing[6]` (24px) all around
- Border radius: `borderRadius.xl` (12px)

### 1B. Metric Strip

Below the hero, a row of 5 metric cards. These are the "vital signs" of the project:

1. **Schedule Health** — Days ahead/behind, green/red indicator
2. **Budget Used** — Dollar amount and percentage, progress bar
3. **Open RFIs** — Count with "X overdue" in red
4. **Safety Score** — Number with trend arrow
5. **Field Activity** — Workers on site today

Each metric card:
- Height: Consistent `120px`
- Padding: `spacing[5]` (20px)
- Icon: 20px, `colors.textTertiary`, top-left
- Value: `typography.fontSize.heading` (28px), `typography.fontWeight.bold`, `colors.textPrimary`
- Label: `typography.fontSize.sm` (13px), `colors.textSecondary`, below value
- Trend: Small arrow icon + percentage, colored (green for positive, red for negative)
- Background: `colors.surfaceRaised`
- Shadow: `shadows.card`, lifts to `shadows.cardHover` on hover
- Border: `1px solid ${colors.borderSubtle}`
- Border radius: `borderRadius.lg` (10px)
- Gap between cards: `spacing[4]` (16px)
- **Hover animation**: Card lifts 2px, shadow deepens (from V7-01)
- **Click**: Navigate to relevant page (Schedule, Budget, RFIs, Safety, DailyLog)

### 1C. Main Grid Layout

Below metrics, a 2-column grid (roughly 60/40 split):

**Left column (main content):**
1. Activity Timeline widget (most recent events)
2. AI Insights widget (AI observations and recommendations)
3. Photo Feed widget (recent field photos in a grid)

**Right column (sidebar):**
1. Weather Impact widget
2. Milestone Timeline widget
3. Risk Heatmap widget

Grid gap: `spacing[5]` (20px)

---

## Phase 2: Widget Design System

Every dashboard widget must follow a consistent structure:

### 2A. Widget Container

```
┌─────────────────────────────────────────┐
│  Icon   Widget Title        Action Btn  │  ← Header (48px height)
│─────────────────────────────────────────│  ← Divider (borderSubtle)
│                                         │
│  Widget Content Area                    │  ← Content (variable height)
│                                         │
│                                         │
├─────────────────────────────────────────┤  ← Footer divider (optional)
│  Footer: "View all" link                │  ← Footer (36px, optional)
└─────────────────────────────────────────┘
```

**Header:**
- Height: `48px`, display: flex, align-items: center
- Icon: 16px, `colors.textTertiary`, margin-right: `spacing[2]`
- Title: `typography.fontSize.sm` (13px), `typography.fontWeight.semibold`, `colors.textPrimary`, `typography.letterSpacing.wide`, `text-transform: uppercase`
- Action button (if any): Ghost icon button, right-aligned
- Padding: `0 ${spacing[5]}`

**Container:**
- Background: `colors.surfaceRaised`
- Border: `1px solid ${colors.borderSubtle}`
- Border radius: `borderRadius.xl` (12px)
- Shadow: `shadows.card`
- Hover: Shadow lifts to `shadows.cardHover` (only if widget is clickable)
- Overflow: hidden (so child content respects radius)

**Footer:**
- Height: `36px`
- Border-top: `1px solid ${colors.borderSubtle}`
- "View all →" link in `typography.fontSize.label`, `colors.primaryOrange`, `typography.fontWeight.medium`
- Hover: Text underline, slightly darker orange

### 2B. Activity Timeline Widget

A live feed of project activity (think GitHub activity feed, but for construction):

Each activity item:
- Avatar (32px circle) on the left
- Name in semibold, action in normal weight, object in semibold
- Example: "**Mike Torres** approved RFI **#047** — Structural beam sizing"
- Timestamp: Relative ("2h ago"), `typography.fontSize.caption`, `colors.textTertiary`
- Subtle left border color-coded by activity type (orange for RFIs, green for approvals, blue for submittals)
- Vertical line connecting items (1px, `colors.borderSubtle`)
- Spacing between items: `spacing[4]`
- Show 8 most recent, "View all activity →" in footer

### 2C. AI Insights Widget

The AI copilot's proactive observations:

Each insight:
- Left icon: AI sparkle icon in `colors.indigo`, 20px
- Insight text: `typography.fontSize.body`, `colors.textPrimary`
- Example: "3 submittals due this week have no reviewer assigned. Want me to suggest reviewers based on past assignments?"
- Action button: Small ghost button "Assign Reviewers" or "Dismiss"
- Background for each insight: `colors.indigoSubtle` with left border `3px solid ${colors.indigo}`
- Padding: `spacing[4]`
- Gap between insights: `spacing[3]`
- Maximum 3 insights shown
- "View all insights →" footer

### 2D. Weather Impact Widget

Current weather and its impact on the schedule:

- Current temp and condition icon (large, 48px)
- "Today: 72°F, Clear" in `typography.fontSize.title`
- 3-day forecast below as compact row
- Impact callout: "No weather delays expected" (green) or "Rain Thursday may delay concrete pour" (amber)
- Background: Subtle gradient from `surfaceRaised` to very faint blue at top

### 2E. Photo Feed Widget

Recent field photos in a masonry-style grid:

- 2x3 grid of photo thumbnails
- Each photo: `borderRadius.md`, object-fit cover
- Hover: Slight zoom (scale 1.05), overlay with date and location text
- Click: Opens photo in lightbox
- "View all photos →" footer
- If no photos today: Empty state with camera icon and "No field photos today"

### 2F. Milestone Timeline Widget

Vertical timeline of upcoming milestones:

- Each milestone: Dot on the left (color-coded by status), name, date
- Past milestones: Dot green (completed), line solid
- Future milestones: Dot gray (pending), line dashed
- Next milestone: Dot orange (upcoming), slightly larger
- "Concrete Pour — Level 3" style labels
- Compact: Show next 5 milestones

### 2G. Risk Heatmap Widget

Visual grid showing risk across project areas:

- 4x4 or 5x3 grid of small colored squares
- Each square represents a category (Schedule, Budget, Safety, Quality, etc.)
- Color: green (low risk), amber (medium), red (high)
- Hover: Tooltip with risk detail
- Title: "Project Risk Overview"

---

## Phase 3: Visual Polish Details

### 3A. Number Formatting

All numbers on the Dashboard should be formatted for scannability:
- Dollar amounts: `$1.2M` not `$1,200,000` (use compact notation above $10K)
- Percentages: One decimal max, `87.3%`
- Counts: No decimals, comma separated: `1,247`
- Days: "Day 247" not "247 days"

### 3B. Color Usage

The Dashboard should use the brand orange strategically:
- Primary numbers/KPIs: `colors.textPrimary` (don't make everything orange)
- Trend indicators and progress bars: Use status colors (green/red/amber)
- CTAs and interactive elements: `colors.primaryOrange`
- The overall feeling should be clean and white with pops of orange, not an orange page

### 3C. Empty States

If any widget has no data, show a beautiful empty state:
- Centered icon (48px, `colors.textTertiary`, stroke width 1.5)
- Message: `typography.fontSize.sm`, `colors.textSecondary`
- CTA: Small button to take action
- Example: Photo feed empty → Camera icon, "No photos captured today", "Open Field Capture" button

### 3D. Loading States

While data loads:
- Each widget shows a skeleton that matches its content shape
- Skeletons animate with shimmer from V7-01
- Staggered load: Metrics load first, then widgets stagger in
- Widget containers are visible immediately (structure), content shimmers

---

## Phase 4: Responsiveness

### 4A. Breakpoints

- **Desktop** (>1280px): Full 2-column layout as described
- **Laptop** (1024-1280px): Metrics shrink slightly, right column narrows
- **Tablet** (768-1024px): Single column, metrics wrap to 2 rows of 3+2, widgets stack
- **Mobile** (<768px): Single column, metrics as horizontal scroll, widgets full-width

### 4B. Metric Card Responsive Behavior

- Desktop: 5 cards in a row, flex-wrap
- Tablet: 3+2 arrangement
- Mobile: Horizontal scroll with snap points, show edge of next card

---

## Verification Checklist

- [ ] Hero section shows project name, completion ring, and day count
- [ ] 5 metric cards with icons, values, labels, and trend indicators
- [ ] Every metric card lifts on hover and navigates on click
- [ ] Activity timeline shows recent events with avatars and color-coded borders
- [ ] AI Insights widget shows 3 proactive observations with action buttons
- [ ] Weather widget shows current conditions and schedule impact
- [ ] Photo feed shows thumbnails in a grid with hover zoom
- [ ] Milestone timeline shows upcoming milestones with status dots
- [ ] Risk heatmap shows color-coded grid
- [ ] Every widget follows the consistent header/content/footer structure
- [ ] Numbers are formatted for scannability (compact notation)
- [ ] Empty states exist for every widget
- [ ] Skeleton loading states exist for every widget
- [ ] Layout is responsive at all 4 breakpoints
- [ ] Brand orange is used strategically, not overwhelmingly
- [ ] Overall page feels like a "command center" not an "admin dashboard"
