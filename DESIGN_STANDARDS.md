# Design Standards

The engine reads this to know exactly what "world-class" UI/UX means. Every design decision must meet these standards.

## The Standard: Linear, Stripe, Apple, Figma

These companies share specific patterns that make their products feel premium. SiteSync must match this feeling.

### Spacing and Layout

Use an 8px grid system. All spacing is a multiple of 8: 8, 16, 24, 32, 40, 48, 64, 80, 96.
Page padding: 32px on desktop, 16px on mobile.
Card padding: 24px.
Section spacing: 48px between major sections, 24px between related sections.
Table row height: 48px minimum (touch-friendly).
Sidebar width: 240px collapsed to 64px.

### Typography

Use a system font stack: Inter, SF Pro, or the system default. Never a custom font that adds load time.
Hierarchy: Page title (24px, 600 weight), Section header (18px, 600), Subsection (14px, 600), Body (14px, 400), Caption/meta (12px, 400, muted color).
Line height: 1.5 for body text, 1.2 for headings.
Letter spacing: Slight negative for headings (-0.01em), normal for body.

### Color Usage

Primary action: #F47820 (SiteSync orange). Only for primary CTAs, active states, and the most important numbers.
Do not overuse orange. A page should have 1-2 orange elements maximum.
Secondary actions: Outlined buttons with no fill, gray text.
Success: #4EC896 (teal green). For completed items, positive trends, on-budget indicators.
Warning: #F5A623 (amber). For approaching deadlines, budget warnings, items needing attention.
Danger: #E74C3C (red). For overdue items, over-budget, critical issues.
Info: #3B82F6 (blue). For in-progress items, informational badges.
Background: #F7F8FA for page backgrounds. #FFFFFF for cards. #0F1629 for sidebar.
Text: #1A1A2E for primary text. #6B7280 for secondary/muted text. #9CA3AF for disabled.
Borders: #E5E7EB (light gray), 1px solid. Never heavy borders. Subtle separation.

### Cards and Elevation

Cards: White background, 1px border (#E5E7EB), border-radius 12px.
Shadows: Use sparingly. Only on elevated elements (modals, dropdowns, tooltips).
Shadow values: 0 1px 3px rgba(0,0,0,0.08) for subtle, 0 4px 12px rgba(0,0,0,0.1) for elevated, 0 8px 24px rgba(0,0,0,0.12) for modals.
Hover states on cards: Slight border color change or 2px shadow increase. Never background color change.

### Metric Cards

Every page starts with 3-5 metric cards in a horizontal row.
Structure: Icon (24px, colored), Label (12px, muted), Value (28px, bold), Trend indicator (12px, green/red with arrow).
Card width: Equal width, distributed across the row.
The value must be a real calculated number, never a placeholder.

### Tables

Header: 12px uppercase, muted color, no bold. Sticky on scroll.
Rows: 48px height, 14px text, alternating background on hover only.
Every row must be clickable to a detail view.
Sort indicators: Small chevron in header.
Pagination or virtual scrolling for 50+ rows.
Bulk actions: Checkbox column, sticky action bar appears when items selected.
Empty state: Helpful illustration + specific message + primary action button.

### Forms and Inputs

Input height: 40px.
Border: 1px solid #E5E7EB, border-radius 8px.
Focus state: 2px ring in primary color (orange), no outline.
Label: 12px, muted, above the input, never inside.
Error state: Red border, red text below, never a tooltip.
Required indicator: Small red asterisk after label text.
Inline validation on blur, not on every keystroke.

### Buttons

Primary: Orange background (#F47820), white text, border-radius 8px, height 40px, padding 16px 24px.
Secondary: White background, 1px gray border, dark text.
Ghost/text: No background, no border, muted text, hover underline.
Destructive: Red background, white text.
Loading state: Spinner replaces text, button disabled, same width.
Icons in buttons: 16px, left of text, 8px gap.

### Animations and Transitions

All transitions: 150ms ease-out. Never longer than 200ms for UI feedback.
Page transitions: Fade in 200ms.
Modal: Fade + scale from 95% to 100% in 150ms.
Skeleton loaders: Pulse animation on gray rectangles matching the content shape.
Never use bouncy or spring animations. Keep it professional.

### Navigation

Sidebar: Dark navy (#0F1629), white text, orange highlight on active item.
Each section has a unique icon from Lucide. No duplicate icons anywhere.
Hover: Slight white background overlay (rgba(255,255,255,0.05)).
Active: Orange left border (3px), icon turns orange, text turns white.
Collapse: Icon-only mode at 64px width.

### Status Indicators

Use consistent color-coded dots (8px circles) across the entire app:
Green dot: Complete, approved, on track, paid
Amber dot: Pending, in review, approaching deadline
Red dot: Overdue, rejected, over budget, critical
Blue dot: In progress, draft, informational
Gray dot: Not started, inactive, archived

### Mobile and Field First

Touch targets: 44px minimum (Apple guideline).
Swipe gestures: Left to delete/archive, right to complete/approve.
Bottom navigation on mobile, not a hamburger menu.
Large, tappable metric cards.
Voice input on every text field.
Camera integration: One tap to capture, auto-tag with location.
Offline: Queue all actions, sync when connection returns, show sync status.

### Empty States

Never show "No data found." Always show:
1. A relevant illustration or icon (subtle, not cartoonish)
2. A specific message ("No RFIs have been created for this project yet")
3. A primary action button ("Create First RFI")
4. If applicable, a brief explanation of the feature

### Loading States

Use skeleton screens, not spinners.
Skeletons match the exact shape of the content they replace.
Pulse animation (opacity 0.3 to 0.7, 1.5s cycle).
Never show a blank page.

### Keyboard Shortcuts

Global: Cmd+K for command palette, Cmd+/ for shortcuts help, Escape to close modals.
Navigation: G then D for dashboard, G then R for RFIs, G then B for budget.
Actions: N for new item, E for edit, Delete for remove.
Tables: J/K for up/down, Enter to open, Space to select.
Show shortcut hints in tooltips and the command palette.

### Responsive Breakpoints

Desktop: 1280px+. Full sidebar, multi-column layouts, keyboard shortcuts.
Tablet: 768-1279px. Collapsible sidebar, stacked metric cards, touch-optimized.
Mobile: Under 768px. Bottom navigation, single column, swipe gestures, large touch targets.
