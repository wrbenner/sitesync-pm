# V7-06: Table, List & Data Display Perfection

## Goal
Make every table, list, and data grid in SiteSync feel like a Linear or Notion table: dense yet readable, sortable, hoverable, with crisp typography and perfect alignment. Tables are the heart of a construction PM tool. They must be world class.

## Why This Matters
Construction PMs spend hours looking at RFI tables, submittal logs, punch lists, and budget line items. If tables feel clunky, cramped, or visually noisy, the whole product feels amateur. Linear proved that even dense data tables can feel beautiful. That's the bar.

---

## Phase 1: Table Design System

### 1A. Base Table Structure

All tables across the app must follow this structure:

```
┌────────────────────────────────────────────────────────────┐
│  Header Row                                                │
│  Column A ↑    Column B      Column C      Actions         │
├────────────────────────────────────────────────────────────┤
│  Data Row 1 (hoverable)                                    │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│  Data Row 2                                                │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│  Data Row 3                                                │
└────────────────────────────────────────────────────────────┘
│  Pagination: ← 1 2 3 ... 12 →    Showing 1-20 of 247     │
└────────────────────────────────────────────────────────────┘
```

### 1B. Header Row Style

```typescript
{
  display: 'flex',
  alignItems: 'center',
  padding: `0 ${spacing[5]}`,   // 0 20px
  height: '40px',
  background: colors.surfacePage,  // Very subtle differentiation
  borderBottom: `1px solid ${colors.borderDefault}`,
  position: 'sticky',
  top: 0,
  zIndex: zIndex.sticky,
}

// Header cell
{
  fontSize: typography.fontSize.caption,  // 11px
  fontWeight: typography.fontWeight.semibold,
  color: colors.textTertiary,
  textTransform: 'uppercase' as const,
  letterSpacing: typography.letterSpacing.wider,
  userSelect: 'none',
  cursor: 'pointer',  // if sortable
}

// Sort indicator
// Active sort: Arrow icon (ChevronUp/ChevronDown), 12px, colors.textSecondary
// Hover (not active sort): Faint arrow appears, colors.textTertiary with 0.5 opacity
```

### 1C. Data Row Style

```typescript
{
  display: 'flex',
  alignItems: 'center',
  padding: `0 ${spacing[5]}`,
  height: layout.tableRowHeight || '52px',  // Consistent row height
  borderBottom: `1px solid ${colors.borderSubtle}`,
  background: colors.surfaceRaised,
  transition: `background ${duration.instant}ms ${easing.standard}`,
  cursor: 'pointer',
}

// Hover state
{
  background: colors.surfaceHover,
}

// Selected state (checkbox selected)
{
  background: colors.surfaceSelected,
  borderLeft: `3px solid ${colors.primaryOrange}`,
}
```

### 1D. Cell Typography

- Primary text (name, title): `fontSize.body` (14px), `fontWeight.normal`, `colors.textPrimary`
- Secondary text (subtitle, description): `fontSize.sm` (13px), `colors.textSecondary`
- Numeric values: `fontFamily: typography.fontFamilyMono`, right-aligned
- Dates: `fontSize.label` (12px), `colors.textTertiary`
- IDs (RFI #047): `fontFamilyMono`, `fontSize.label`, `colors.textTertiary`

### 1E. Column Alignment

- Text columns: Left-aligned
- Numeric columns (amount, count, percentage): Right-aligned
- Status columns: Left-aligned (tag/badge)
- Date columns: Left-aligned
- Action columns: Right-aligned
- Checkbox column: Center-aligned, 40px wide

---

## Phase 2: Table Interactions

### 2A. Row Hover with Left Accent

When hovering a row:
1. Background: `colors.surfaceHover`
2. Left border: 3px orange accent appears (animated from 0 width)
3. Action buttons on the far right become visible (were hidden or faded)

```typescript
// Hidden action buttons pattern
<div style={{
  display: 'flex',
  gap: spacing[1],
  opacity: isHovered ? 1 : 0,
  transition: `opacity ${duration.instant}ms ease-out`,
}}>
  <IconButton icon={<Edit3 />} tooltip="Edit" />
  <IconButton icon={<MoreHorizontal />} tooltip="More" />
</div>
```

### 2B. Row Click

Clicking a row should:
1. Brief press feedback: Row background flashes to `colors.surfaceSelected` for 120ms
2. Navigate to detail view or open detail panel
3. If detail panel: Slide in from right with `motion.modalEnter`

### 2C. Sortable Columns

Clicking a header cell:
1. Sorts the column (toggle asc/desc/none)
2. Sort icon animates (rotate 180deg when switching direction)
3. Rows re-order with a subtle animation (if feasible, otherwise instant)
4. Active sort column header text becomes `colors.textSecondary` (darker than inactive)

### 2D. Row Selection (Checkboxes)

When the table supports multi-select:
1. Checkbox column: 40px wide, centered
2. Checkbox: 18px, `borderRadius.sm`, `border: 2px solid ${colors.borderDefault}`
3. Checked: `background: colors.primaryOrange`, white checkmark icon, `borderColor: colors.primaryOrange`
4. Transition: `background ${duration.fast}ms ease-out, border-color ${duration.fast}ms ease-out`
5. Header checkbox: Select all / deselect all
6. When rows are selected: Bulk action bar appears above the table (slide down from top)

### 2E. Bulk Action Bar

When 1+ rows are selected:
```
┌────────────────────────────────────────────────────────────┐
│  ✓ 5 selected    [Assign]  [Change Status]  [Export]  [✕]  │
└────────────────────────────────────────────────────────────┘
```

- Background: `colors.textPrimary` (dark, high contrast)
- Text: `colors.textOnDark`
- Buttons: Ghost style with white text
- Enter: Slide down + fade in
- Exit: Slide up + fade out
- Sticky below header row

### 2F. Empty Table State

When a table has no data:
- Show the table header (so users see what columns exist)
- Below header: EmptyState component (from V7-05) centered
- Icon, message, and CTA appropriate to the entity ("No RFIs yet", "Create your first RFI")
- Padding: `spacing[16]` (64px) top and bottom

### 2G. Table Loading State

While data loads:
- Show table header (real, not skeleton)
- Below: 5 skeleton rows matching column widths
- Each skeleton row shimmers (from V7-01)
- Stagger skeleton rows: Each appears 40ms after the previous

---

## Phase 3: Pagination

### 3A. Pagination Bar

Below the table:
```typescript
{
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: `${spacing[3]} ${spacing[5]}`,
  borderTop: `1px solid ${colors.borderSubtle}`,
}
```

**Left side:** "Showing 1–20 of 247 items" in `fontSize.label`, `colors.textTertiary`

**Right side:** Page buttons
- Previous/Next: Arrow buttons, disabled when at start/end
- Page numbers: `1 2 3 ... 12`, each is a small button
- Active page: `background: colors.primaryOrange`, `color: white`, `borderRadius.md`
- Inactive page: `color: colors.textSecondary`, hover: `background: colors.surfaceHover`
- Ellipsis: "..." in `colors.textTertiary`

### 3B. Per-Page Selector

Small dropdown: "Show: 20 ▾" allowing 10, 20, 50, 100 rows per page.

---

## Phase 4: List Views

### 4A. List Item Design

For non-table lists (activity feeds, notification lists, search results):

```typescript
{
  display: 'flex',
  alignItems: 'flex-start',
  padding: `${spacing[4]} ${spacing[5]}`,
  gap: spacing[3],
  borderBottom: `1px solid ${colors.borderSubtle}`,
  background: colors.surfaceRaised,
  transition: `background ${duration.instant}ms ease-out`,
  cursor: 'pointer',
}
```

- Hover: `background: colors.surfaceHover`
- Leading element: Avatar, icon, or status dot
- Content: Title (body size, semibold) + description (sm size, secondary) + metadata (caption, tertiary)
- Trailing element: Timestamp, action button, or chevron-right

### 4B. Grouped Lists

Lists with section groupings (e.g., "Today", "Yesterday", "Last Week"):

- Group header: Sticky, `background: colors.surfacePage`, `padding: ${spacing[2]} ${spacing[5]}`, `fontSize.caption`, `fontWeight.semibold`, `textTransform: uppercase`, `letterSpacing.wider`, `colors.textTertiary`
- Subtle top border on group header

---

## Phase 5: Kanban View

For pages that offer kanban (RFIs, Tasks):

### 5A. Column Design

- Column header: Status name, count badge, "+" button
- Header: `fontSize.sm`, `fontWeight.semibold`, `colors.textPrimary`
- Count: Small pill, `background: colors.surfaceInset`, `fontSize.caption`
- Background: `colors.surfacePage` (not white, to differentiate from cards)
- Width: 280px minimum, flex-grow
- Gap between columns: `spacing[4]`

### 5B. Kanban Card

- Background: `colors.surfaceRaised`
- Border: `1px solid ${colors.borderSubtle}`
- Border radius: `borderRadius.lg`
- Shadow: `shadows.sm`
- Hover: Shadow to `shadows.card`, border to `colors.borderDefault`, `translateY(-1px)`
- Padding: `spacing[4]`
- Content: Title, assignee avatar, priority tag, due date
- Maximum height before truncation: 160px with "Show more" expand

### 5C. Column Scroll

- Each column scrolls independently
- Custom scrollbar (thin, like sidebar)
- When scrolled: Subtle top shadow on column header

---

## Phase 6: Data Formatting Consistency

### 6A. Date Formatting

Establish a single date format used everywhere:
- Recent (today): "2:30 PM" (time only)
- Recent (this week): "Mon 2:30 PM"
- This year: "Mar 15"
- Previous years: "Mar 15, 2024"
- Relative: "2h ago", "3d ago" (for activity feeds only)

### 6B. Number Formatting

- Currency: `$1,234.56` below $10K, `$12.3K` / `$1.2M` above
- Percentages: `87.3%` (one decimal) or `87%` (no decimal for rough numbers)
- Counts: `1,247` (comma separated)
- IDs: `#047` (zero-padded to 3 digits minimum), monospace font

### 6C. Status Text

- Always title case: "In Progress", "Under Review", "Approved"
- Never all caps in table cells (all caps only in column headers)
- Consistent verb forms: "Open" not "Opened", "Closed" not "Complete"

---

## Verification Checklist

- [ ] All tables use consistent 52px row height
- [ ] All table headers are 40px, uppercase, tracked, caption size
- [ ] Every row hovers with background change and left orange accent
- [ ] Action buttons appear on row hover (hidden by default)
- [ ] Sortable columns have animated sort indicators
- [ ] Checkboxes animate when checked
- [ ] Bulk action bar slides in when rows are selected
- [ ] Empty table state shows header + centered EmptyState
- [ ] Loading state shows header + 5 shimmering skeleton rows
- [ ] Pagination exists on all tables with >20 items
- [ ] Active page number is orange-filled
- [ ] List items have consistent padding, hover, and structure
- [ ] Kanban cards lift on hover with shadow transition
- [ ] Dates are formatted consistently across all pages
- [ ] Numbers use appropriate compact notation
- [ ] Status text is title case everywhere
- [ ] All values reference theme tokens (zero hardcoded)
