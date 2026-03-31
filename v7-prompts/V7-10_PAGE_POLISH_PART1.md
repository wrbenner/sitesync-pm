# V7-10: Page-by-Page Polish — RFIs, Tasks, Schedule, Budget, Submittals, PunchList

## Goal
Take each of these core pages from 8-9/10 to 10/10. Apply every principle from V7-01 through V7-09 to these specific pages. Audit every pixel, every hover state, every spacing value, every typographic choice. Leave nothing unpolished.

## Approach
For each page: identify current state, specify exact fixes needed, and provide the target state. Every fix must reference specific theme tokens and animation values.

---

## Page 1: RFIs (Currently 9/10 → Target 10/10)

### Current State
- Table/Kanban toggle works well
- Good column structure
- Decent status tags

### Fixes Required

**1. Page Header:**
- Title: "RFIs" in `heading` (28px), `bold`
- Count: "247" beside title in `title` (16px), `normal`, `textTertiary`
- Subtitle: "Track requests for information" in `sm`, `textTertiary`
- Right side: Filter/Search + "Create RFI" button (primary)

**2. Metric Cards (top strip):**
- 4 cards: Open (blue icon), Overdue (red icon), Avg Response Time (clock icon), Closed This Month (green icon)
- Each card: Apply `MetricBox` from V7-05 exactly
- Hover: Card lifts, shadow transitions per V7-01
- Click: Filters table to relevant subset

**3. Filter Bar:**
- Between metrics and table
- Compact row: Status dropdown, Priority dropdown, Assignee dropdown, Date range picker, Search input
- Each filter: `height: 36px`, `borderRadius.md`, `fontSize.label`
- Active filters: Show as removable pills below the filter bar
- "Clear all" link when filters are active
- Background: `surfaceRaised`, `padding: spacing[3] spacing[5]`, `border: 1px solid borderSubtle`, `borderRadius.lg`

**4. Table Fixes:**
- Apply all V7-06 table specs exactly
- Row height: 52px consistent
- Hover: Background + left orange accent
- ID column (`#047`): `fontFamilyMono`, `fontSize.label`, `textTertiary`
- Subject column: `fontSize.body`, `fontWeight.medium`, `textPrimary` — truncate with ellipsis
- Status column: `StatusTag` from V7-05
- Priority column: `PriorityTag` from V7-05
- Assignee column: `Avatar` (24px) + name in `fontSize.sm`
- Due date column: `fontSize.label`, `textSecondary` — red if overdue
- Actions column: Edit + More icons, visible only on hover

**5. Kanban View Fixes:**
- Apply V7-06 Kanban specs
- Column headers: Status name + count pill
- Cards: Title, assignee avatar, priority tag, due date
- Drag: Card lifts with shadow per V7-01 Phase 4F

**6. Detail Panel (click row):**
- Slide in from right, 480px wide
- Header: RFI number + subject, close button
- Status/Priority: Editable inline (click to change)
- Body: Full description, attachments, comments thread
- Timeline: Activity log at bottom
- Apply V7-08 loading state for detail panel

---

## Page 2: Tasks (Currently 8.5/10 → Target 10/10)

### Fixes Required

**1. Board View (Kanban):**
- Columns: To Do, In Progress, In Review, Done
- Column header: Status name in `sm`/`semibold`, count in `caption` pill
- Column background: `surfacePage` (subtle differentiation from cards)
- Card design: Title (body/medium), assignee avatar (24px), priority dot, due date badge
- Cards should have `borderRadius.lg`, `shadows.sm`, hover: `shadows.card` + `translateY(-1px)`
- Drag feedback per V7-01 Phase 4F
- Add task button at column bottom: "+ Add task" in `sm`/`textTertiary`, hover: `textPrimary`

**2. List View:**
- Full table with columns: Checkbox, Title, Status, Priority, Assignee, Due Date, Actions
- Apply V7-06 table design exactly
- Inline status change: Click status tag → dropdown to change status (animate)
- Subtasks: Expandable row with indent

**3. Task Detail:**
- Full-page or panel (user choice)
- Title: Large, editable inline (click to edit, border appears on focus)
- Description: Rich text area with formatting toolbar
- Properties sidebar: Status, Priority, Assignee, Due Date, Labels
- Comments/Activity at bottom
- Subtask checklist with progress bar

---

## Page 3: Schedule (Currently 8/10 → Target 10/10)

### Fixes Required

**1. Gantt Chart:**
- Timeline header: Month names in `label`/`semibold`, day ticks in `caption`
- Today marker: Vertical orange dashed line, `1px dashed ${primaryOrange}`
- Task bars: `borderRadius.sm` (4px), colored by status (green=complete, blue=in progress, gray=pending, red=behind)
- Bar hover: Tooltip with task name, dates, progress, assignee
- Bar height: 24px, gap between bars: 4px
- Task labels: To the left of bars, `fontSize.sm`, `textPrimary`, truncated
- Dependency arrows: `1px solid ${borderDefault}`, with small arrowhead
- Milestone diamonds: 10px, rotated 45deg, orange fill

**2. Date Navigation:**
- Zoom controls: Day, Week, Month, Quarter (toggle buttons)
- Active zoom: Orange background pill
- Date range display: "Mar 2026" in `title`/`semibold`
- Navigation: Left/Right arrows, "Today" button (ghost)

**3. Critical Path Highlight:**
- When enabled: Critical path bars get `2px solid ${statusCritical}` border
- Non-critical bars: Reduce opacity to 0.5
- Toggle: Button in toolbar

**4. Empty Schedule:**
- Apply V7-08 empty state
- Icon: Calendar, "Build your project schedule"
- CTA: "Import Schedule" or "Add First Task"

---

## Page 4: Budget (Currently 8.5/10 → Target 10/10)

### Fixes Required

**1. Metric Cards:**
- 4 cards: Original Budget, Revised Budget, Committed Costs, Variance
- Variance card: Green if under budget, red if over
- Dollar amounts: `fontFamilyMono`, `heading` size, `bold`
- Compact notation: `$12.4M` not `$12,400,000`

**2. Budget Table:**
- Dense table with cost codes
- Columns: Cost Code, Description, Original, Revised, Committed, Actual, Forecast, Variance
- Numeric columns: Right-aligned, `fontFamilyMono`, `fontSize.sm`
- Variance column: Green text for positive, red for negative
- Subtotal rows: `fontWeight.semibold`, `surfaceInset` background, slightly larger text
- Grand total row: `fontWeight.bold`, thicker top border, `fontSize.body`
- Row groups: Expandable/collapsible by cost code category

**3. Charts:**
- S-Curve: Smooth lines, branded colors, hover tooltip with exact values
- Waterfall: Bars with connecting lines, labeled values
- Cash Flow: Area chart with gradient fill using `orangeSubtle`
- All charts: Consistent axis labels (`caption`/`textTertiary`), grid lines (`borderSubtle`)

**4. Tab Navigation:**
- Tabs: Overview, Line Items, Change Orders, Forecasting
- Apply V7-05 TabBar with animated indicator

---

## Page 5: Submittals (Target 10/10)

### Fixes Required

**1. Submittal Log Table:**
- Columns: Number, Spec Section, Description, Subcontractor, Status, Due Date, Ball in Court
- Apply all V7-06 table specs
- "Ball in Court" column: Avatar + company name, shows who currently holds the submittal
- Status flow: Draft → Submitted → Under Review → Approved/Rejected/Resubmit
- Color-coded status tags per theme

**2. Submittal Detail:**
- Header with submittal number and description
- Revision history: Timeline showing each revision with status change
- Attachments section: File thumbnails with preview capability
- Approval chain: Visual flow showing each reviewer with status (pending/approved/rejected)

**3. Submission Workflow:**
- "Submit for Review" button triggers routing wizard
- Reviewer selection dropdown with avatar + name
- Due date picker
- Comments/cover letter textarea

---

## Page 6: PunchList (Target 10/10)

### Fixes Required

**1. Punch Item Grid:**
- Option for table view or grid view (photo cards)
- Grid view: Cards with photo thumbnail, location, status, responsible party
- Table: Standard V7-06 table with photo thumbnail in first column (40px square)

**2. Location Grouping:**
- Group by location: "Level 3 — East Wing", "Level 2 — Lobby"
- Collapsible groups with count badge
- Location header: `sm`/`semibold`, `textPrimary`, `surfacePage` background, sticky

**3. Photo Integration:**
- Each punch item can have photos
- Thumbnail: 40x40px, `borderRadius.sm`, click to expand
- Photo annotation: Circles/arrows drawn on photo
- Empty photo: Placeholder with camera icon

**4. Completion Flow:**
- "Mark Complete" button on each item
- Triggers a confirmation: "Has this been fixed and verified?"
- Status transitions: Open → In Progress → Ready for Review → Closed
- Progress bar at page top: "78 of 142 items closed (55%)"

---

## Verification Checklist

- [ ] RFIs: Metric cards hover, table rows have orange accent, Kanban cards lift
- [ ] RFIs: Filter bar is compact with removable pills
- [ ] RFIs: Detail panel slides in from right with loading state
- [ ] Tasks: Board view cards have shadows and drag feedback
- [ ] Tasks: List view has inline status editing
- [ ] Tasks: Detail has editable inline title
- [ ] Schedule: Gantt bars are color-coded with hover tooltips
- [ ] Schedule: Today marker is orange dashed line
- [ ] Schedule: Date navigation has zoom toggles
- [ ] Budget: Dollar amounts use monospace font with compact notation
- [ ] Budget: Variance column is color-coded
- [ ] Budget: Charts have consistent styling and hover tooltips
- [ ] Submittals: Ball-in-court shows avatar + company
- [ ] Submittals: Approval chain is visual
- [ ] PunchList: Grid view shows photo cards
- [ ] PunchList: Location grouping is collapsible
- [ ] PunchList: Progress bar at top shows completion
- [ ] All pages: Loading skeletons, empty states, error states
- [ ] All pages: Theme tokens only, no hardcoded values
- [ ] All pages: Animations from V7-01 system
