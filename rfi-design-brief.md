# The Conversation

## The philosophy

An RFI is not a form. An RFI is a question shouted across a construction site, formalized into a document that carries legal weight. It's the moment a superintendent in the field looks at a drawing and says "this doesn't match reality" — and needs a documented answer from the architect before concrete gets poured in the wrong place.

The greatest communication interfaces in history don't look like forms. iMessage doesn't look like a database entry. Linear's issue tracker doesn't look like JIRA. Apple Mail's conversation view doesn't look like Outlook 2003. They take the underlying data model (messages, tickets, emails) and present them as *conversations* — because that's what humans naturally do. We talk. We ask. We answer.

SiteSync PM's RFI page should feel like the world's most organized conversation. Not a spreadsheet with a chat window bolted on. A living, breathing thread where the question is the hero, responses flow naturally, and every GC in the field can understand "who owes what to whom" in under 2 seconds.

The design principle: **clarity of ownership at a glance.** In construction, the most critical concept in RFI management is "ball in court" — who is responsible for acting right now. If the architect hasn't responded in 14 days, everyone on the project needs to know that *immediately*. If there are 3 overdue RFIs blocking field work, the PM should feel that urgency the moment the page loads — not after reading 30 rows of a spreadsheet.

## What this page does today (the architecture)

The RFI system has three views that work together:

### View 1: RFI Register (the list page)

This is the primary landing page — a filterable, sortable register of all RFIs on the project.

**Top section: KPI Dashboard (5 metric cards in a 4-column grid)**

Each card has:
- Icon bubble (40×40, rounded, tinted background)
- Label (11px uppercase, tertiary)
- Big number (24px, bold, tabular-nums) with animated count-up
- Trend badge (inline, green/red arrow + percentage)
- Subtitle context line (11px, tertiary)
- Sparkline OR resolution ring (right-aligned, 56×22px)
- Alert state: overdue cards get a 3px red gradient top bar and tinted border

The five KPIs:
1. **Total Open** — count of non-closed RFIs. Sparkline shows 7-day trend. Subtitle: "X open · Y in review"
2. **Overdue** — count past due date. Red alert styling if >0. Subtitle: "Requires immediate attention" or "All on track"
3. **Avg Days to Close** — resolution velocity metric. Shows a resolution ring (% of total closed) instead of sparkline. Subtitle: "X closed this week"
4. **Closed This Week** — momentum metric. Green sparkline. Subtitle: "Resolution velocity"
5. **Cost Impact** — total dollar exposure from open RFIs. Red alert if >$50K. Subtitle: "Potential exposure"

**Section header**: "RFI Register" (16px, semibold) + count badge (pill) + keyboard hint ("↑/↓ navigate · Enter open")

**Tab bar (sliding indicator)**: Sits inside the table card. 6 filter tabs with icons, counts, and a smooth sliding background indicator:
- All (layers icon) | Open (circle-dot) | In Review (timer) | Answered (check-circle) | Overdue (alert-circle, red when count>0) | Closed (x-circle)

**Table**: Virtual-scrolled data table with these columns:
- Checkbox (select)
- # (RFI number — orange monospace, e.g. "RFI-003")
- Subject (title + optional drawing ref/spec section subtitles + overdue pulse dot + AI sparkle icon)
- Priority (tag: low/medium/high/critical)
- Status (tag: open/under_review/answered/closed)
- Ball In Court (party badge — small pill with colored dot + name)
- Age (days open — monospace, color-coded: >10d red, >5d amber, else tertiary)
- Due (short date — red + bold if overdue)
- $ (cost impact — compact currency, red if positive)

Row hover lifts slightly. Overdue rows have a faint red background tint. Clicking a row navigates to the detail page.

**View toggle**: List (table) / Board (kanban) — segmented control in the page header actions area.

**Kanban view**: 5 columns (Draft → Open → Under Review → Answered → Closed). Each card shows:
- RFI number + priority tag + AI sparkle (if applicable) + days-open count
- Title (2-line clamp)
- Ball-in-court badge (bottom-left)
- Due date with calendar icon (bottom-right, red if overdue)
- Cost impact micro-badge (if present, below a divider)
- Overdue cards get a 3px red left border

**Bulk actions bar**: Appears when checkboxes are selected. Actions: Reassign, Priority, Export (CSV), Close (red, with confirm).

**Action buttons** (top-right):
- View toggle (List/Board)
- Export button (XLSX/PDF)
- "AI Draft" button (indigo background, wand icon — opens modal to generate an RFI from natural language)
- "New RFI" primary button (orange, plus icon)

### View 2: RFI Detail (the conversation page)

This is the heart of the system — where a single RFI lives as a conversation thread. Centered layout, 720px max-width.

**Back navigation**: "← Back to RFIs" link (top-left, subtle, hover turns orange)

**Header block**:
- Top row: RFI number (orange, bold) + Status badge (colored pill with dot) + Days open (timer icon + "Xd open")
- Right side: Watch button (eye icon, toggles watching/unwatching with watcher count) + Status action button (primary orange "Submit" / "Answer" / etc. with dropdown for secondary actions)
- Title: 24px, weight 700, -0.02em tracking
- Ball-in-court badge (if active, shown below title — orange pill with flag icon)

**Workflow timeline**: Horizontal step indicator showing Draft → Open → Under Review → Answered → Closed. Current step highlighted, completed steps checkmarked.

**The Question card** (main content area — rounded 16px card):
- Author row: avatar (30px) + name + company tag + timestamp
- Priority tag (if not medium, shown right-aligned)
- Question body: 15px, 1.75 line-height, pre-wrap
- Metadata pills: inline badges for Assigned To, Due Date (with urgency coloring), Cost Impact, Schedule Impact, Spec Section, Drawing Reference. Expandable — shows first 3, "+N more" toggle for rest.

**Response thread**: Below the question, separated by a border. Each response is a chat-style bubble:
- Avatar (30px) + Author name + Company tag + Relative timestamp ("2h ago", "3d ago")
- Content bubble: left-aligned with rounded corners (4px top-left, 14px others — like iMessage for incoming)
- Attachment badges (if present): small orange pills with paperclip icon
- New responses since last visit get a small orange dot indicator and a "N new" divider banner

**Compose box**: Fixed at the card bottom.
- Auto-growing textarea (12px border-radius, focus: orange border + glow)
- Send button (42px circle, orange when text present, disabled otherwise)
- Keyboard shortcut: ⌘+Enter to send

### View 3: Detail Side Panel (from Kanban card click)

A 560px slide-in panel with a condensed version of the detail view:
- RFI number + status + priority badges
- Presence avatars + Edit/Done toggle
- Title (18px)
- Days-open indicator + overdue warning
- Editable metadata grid (2-column: Assigned To, Due Date, Ball in Court, Cost Impact, Spec, Drawing)
- Description (if present)
- Response list (first 3, with "View all N responses →" link)
- Quick response input with AI Suggest button
- Delete link (bottom)
- Related items

### AI Features

1. **AI Draft Modal**: Dialog overlay (480px, 16px rounded). User describes the issue in natural language → AI generates a structured RFI (title + description) → pre-fills the create wizard.

2. **AI Suggest Response**: In the detail side panel, a small "AI Suggest" button generates a draft response based on the RFI description. Shown inline in the response textarea.

3. **Predictive Alerts**: Banner at the top of the register showing AI-detected patterns (e.g., "3 RFIs from the same spec section may indicate a design issue").

## Brand system

(Same tokens as the login and dashboard briefs)

### Colors

Primary orange: `#F47820` (brand accent, used for RFI numbers, active states, primary buttons)
Full ramp: 50 `#FEF5ED` → 100 `#FDDCB8` → 200 `#FBBD84` → 300 `#F9974F` → 400 `#F47820` → 500 `#E06A10` → 600 `#C45A0C` → 700 `#A04808` → 800 `#7C3606` → 900 `#582604`

Indigo (AI accent): `#4F46E5` — used for AI draft/suggest features

Status colors:
- Active/Success: `#2D8A6E` (on-track, answered)
- Pending/Warning: `#C4850C` (in review, medium age)
- Critical/Error: `#C93B3B` (overdue, high priority, cost impact)
- Info: `#3A7BC8` (open, total counts)
- Review: `#7C5DC7` (under review)

Warm neutrals:
- Page: `#FAFAF8` | Sidebar: `#F6F3F0` | Card: `#FFFFFF`
- Inset/Recessed: `#F3EFEC` | Border subtle: `#F0EDE9` | Border: `#E5E1DC`
- Text primary: `#1A1613` | Secondary: `#5C5550` | Tertiary: `#767170` | Disabled: `#C5C0BB`

### Typography
- Font: Inter (400, 500, 600, 700)
- Display: 36px | Heading: 28px | Large: 24px | Subtitle: 18px | Title: 16px | Body: 14px | Small: 13px | Label: 12px | Caption: 11px
- Mono: 'SF Mono', 'Fira Code', 'Consolas', monospace (used for RFI numbers, ages, dates)
- Letter-spacing: body -0.011em, headings -0.02em to -0.03em
- Line-heights: tight 1.2, snug 1.35, normal 1.55

### Spatial system
- 4px grid
- Border radii: sm 4px, base 6px, md 8px, lg 10px, xl 12px, 2xl 16px
- Card radius: 12px (consistent across all cards), 16px for detail conversation card
- Shadows: card `0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.015)` | hover `0 3px 12px rgba(0,0,0,0.06)` | modal `0 24px 80px -12px rgba(0,0,0,0.2)`
- Transitions: 160ms quick, 300ms smooth `cubic-bezier(0.32, 0.72, 0, 1)`
- Max content width: 1000px for register, 720px for detail

## The design challenge

The current RFI page works well functionally — it has the data, the filters, the kanban, the AI features. But it doesn't have that "superintendent opens this at 5:45am and immediately knows what needs attention" quality.

Think about how Linear makes issue tracking feel elegant. Every row in their table tells you exactly three things in order: what it is, how urgent it is, who owns it. No noise. No clutter. The hierarchy is so clear that you can scan 50 issues in 10 seconds and know where to focus.

That's what this RFI register needs. Not more data. Better hierarchy. Better use of whitespace. Better rhythm between dense information and breathing room.

The detail page is even more important. An RFI conversation can span weeks, involve 5 different parties, have legal implications for the project. The conversation thread should feel as natural as reading an iMessage thread — but with the structure and formality that construction documentation requires. The question should be unmissable. The responses should flow. The "ball in court" should be visible from across the room.

## What to design

Two mockups:

### 1. RFI Register at 1440×900 (desktop)

Show the full register page with:
- 5 KPI cards (one with an overdue alert state)
- Tab bar with "Open" tab selected, showing 4 filter counts
- 8-10 rows of realistic construction RFI data for "Merritt Crossing" project
- At least one overdue row (red tint), one with AI sparkle, one with cost impact
- The action buttons (view toggle, export, AI Draft, New RFI)
- Mix of priorities: 1 critical, 2 high, 3 medium, 2 low

Sample RFI data to use:
| # | Subject | Priority | Status | Ball In Court | Age | Due | Cost |
|---|---------|----------|--------|---------------|-----|-----|------|
| RFI-001 | Structural steel connection detail at Grid C-7 conflicts with MEP routing | Critical | Open | Architect | 14d | Apr 15 | +$45K |
| RFI-002 | Confirm concrete mix design for elevated slab at Level 3 | High | Under Review | Engineer | 8d | Apr 22 | — |
| RFI-003 | Waterproofing membrane spec unclear at below-grade transition | High | Answered | GC | 12d | Apr 18 | +$12K |
| RFI-004 | Elevator pit depth discrepancy between structural and architectural drawings | Medium | Open | Architect | 6d | Apr 28 | — |
| RFI-005 | Fire-rated wall assembly at corridor B does not match code analysis | Critical | Open | Engineer | 11d | Apr 14 | +$28K |
| RFI-006 | HVAC duct routing through structural beam at Level 2 | Medium | Under Review | MEP Sub | 4d | May 2 | — |
| RFI-007 | Exterior curtain wall anchor spacing differs from shop drawings | Low | Answered | Subcontractor | 22d | Mar 30 | +$8K |
| RFI-008 | Site grading elevations conflict with civil plans at northeast corner | Medium | Open | Civil Engineer | 3d | May 5 | — |

### 2. RFI Detail at 1440×900 (desktop)

Show RFI-001 ("Structural steel connection detail at Grid C-7 conflicts with MEP routing") as a full detail page with:
- Back navigation
- Header with RFI-001, "Open" status, "14d open", Watch button, "Submit for Review" action
- Workflow timeline (currently at "Open")
- The question card with author (Sarah Chen, Merritt GC), priority Critical badge, full description
- 3 responses in the conversation thread:
  1. From the architect asking for clarification (5 days ago)
  2. From the GC providing photos and markup (3 days ago)
  3. From the structural engineer proposing a solution (1 day ago)
- Compose box at bottom
- Metadata pills: Assigned to Michael Torres (Architect), Due Apr 15, Cost Impact $45K, Drawing A-301

### 3. Mobile RFI Register at 390×844

How does the register translate to a phone? A superintendent checking overdue RFIs while standing on a slab at 6am. The KPIs should still be scannable, the overdue count should be prominent, the list should be swipeable.

## Design principles for this page

**The number is the anchor.** RFI-003 is how everyone on a job site refers to this document. "Did you see RFI-003?" "What's the status on 005?" The RFI number should be the most recognizable element in every row — monospace, orange, slightly heavier weight.

**Overdue is a drumbeat.** When RFIs go overdue, construction stops. The overdue state should be felt, not just seen. A subtle pulse, a color shift, a density change. Not screaming red — but undeniable.

**Ball in court is the decision point.** Every RFI row should answer "who needs to act?" without any cognitive effort. The ball-in-court badge should be the second thing your eye lands on after the number.

**The conversation should breathe.** In the detail page, responses should have generous spacing. Each response is a considered answer with potential legal weight — give each one room to be read carefully.

**AI should feel like a shortcut, not a takeover.** The AI Draft and AI Suggest features should feel like a smart colleague offering to help — not an AI writing your answers for you. Indigo accent color, subtle positioning, always editable.

## Deliverables

- Desktop register mockup (1440×900) — production-quality
- Desktop detail mockup (1440×900) — showing the conversation thread
- Mobile register mockup (390×844) — how density translates to field use
- 1-2 sentences on design rationale

Make the register so clean that a PM can scan 50 RFIs in 10 seconds and know exactly where to focus. Make the detail page so natural that responding to an RFI feels like continuing a conversation, not filling out a form.
