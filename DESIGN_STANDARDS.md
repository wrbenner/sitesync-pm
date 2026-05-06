# Design Standards — The Nine

The engine reads this to know exactly what "world-class" UI/UX means. Every design decision must meet these standards. The standard is not Linear or Stripe — it is a construction instrument. Calm when the project is calm, urgent only when it must be.

## The Philosophy

SiteSync has nine pages, plus a settings drawer and a command palette. Every workflow that exists today survives inside the nine with the structure compliance and contracts demand — but only the nine are destinations. AI is never a page. Read-modes are never pages. Nine doors, but some rooms have furniture.

## The Seven Principles

01. Every page is a question, not a destination. If a page cannot finish the sentence "this page exists to answer ____," it is not a page.
02. A workflow is not a navigation item. Lien Waivers belongs inside Pay Apps. RFIs and Submittals belong inside one inbox, not two destinations.
03. AI is a capability, never a destination. Iris lives in the inbox. The copilot lives at the bottom of every page. The agents live inside the workflows they automate.
04. Read-modes of a page are not separate pages. Reports, Activity, Audit Trail, Project Health — these are views, not destinations.
05. If a page has no orange dot, it is not earned. Orange appears at most once per page, on the one thing that needs attention now.
06. Field beats office. Phone beats laptop. The Day, The Field, and The Set must work in a glove on gravel before they work in a chair.
07. Nine doors, but some rooms have furniture. Navigation collapses to nine. The workflows inside them do not. Punch items need assignees and due dates. Safety logs need OSHA-structured forms. Simplicity of navigation is not simplicity of capability.

## The Four Shapes

Every page is one of four shapes. This is the design system in one sentence.

**Sundial** — one question, one horizon. The Day. Calm by default, urgent only when it must be. The orange dot is Now.

**Stream** — a river of entries, time as the spine. The Field, The Conversation, The Plan, The Ledger. Each entry is a row. The page reads top to bottom. The orange dot is on the row that is waiting on you. Streams can contain structured views — a punch list is still a checklist with assignees; a change order is still an approval workflow.

**Book** — spatial, navigated by index. The Set, The Crew, The File. A library. You enter through an index and turn to the page you need.

**Place** — spatial, navigated by walking. The Site. You navigate by moving through it. Every other page deposits entries here as pins on real geometry.

## The Four Visual Marks

1. **The orange dot** — the surveyor's mark. Once per page. 9px circle, 4px halo at 12% opacity. `#F47820` always. Use the `<OrangeDot>` atom.
2. **The hairline** — the only divider. Never a box. 1px solid at `rgba(26, 22, 19, 0.10)`. Use the `<Hairline>` atom. Three weights: `--hairline`, `--hairline-2`, `--hairline-3`.
3. **Italic Garamond** — the verbs. Italics carry the words a decision turns on. EB Garamond 400 italic. Use for questions, emphasis, the moment of choice.
4. **Eyebrow caps** — Inter caps. Stamps, slivers, time. Quiet. 11px, 500 weight, 0.18em letter-spacing, uppercase. Use the `<Eyebrow>` atom.

## Color Palette

The palette is parchment and ink, not gray and white. Construction sites are warm. The product reflects the material world, not the software world.

### Surfaces
- Page background: `#FAF7F0` (parchment) — `var(--color-parchment)`
- Inset/card alt: `#F5F0E5` (parchment-2) — `var(--color-parchment-2)`
- Deeper inset: `#EFE9DD` (parchment-3) — `var(--color-parchment-3)`
- Raised cards: `#FFFFFF`

### Ink Hierarchy
- Primary text: `#1A1613` (ink) — headings, questions, primary actions
- Secondary text: `#5C5550` (ink-2) — body, descriptions
- Tertiary text: `#8C857E` (ink-3) — eyebrows, kickers, captions
- Quaternary: `#C4BDB4` (ink-4) — timestamps, disabled, subtle
- Quinary: `#E5DFD4` (ink-5) — barely visible, placeholder

### Accent
- Primary action: `#F47820` (orange) — the surveyor's mark. Only for: the dot, primary CTAs, active states, the Now indicator. A page should have 1-2 orange elements maximum.
- Orange halo: `rgba(244, 120, 32, 0.12)` — the glow around the dot
- Rust: `#B8472E` — overdue, critical (earthier than pure red)
- Moss: `#4A5D3A` — complete, shipped, approved (earthier than pure green)

### Status Colors (unchanged)
- Active/Success: `#2D8A6E` — on track, approved, paid
- Pending/Warning: `#C4850C` — in review, approaching deadline
- Critical/Danger: `#C93B3B` — overdue, rejected, over budget
- Info: `#3A7BC8` — in progress, draft
- Review: `#7C5DC7` — under review, awaiting approval

## Typography

Two fonts. Never more.

**EB Garamond** (serif) — headings, questions, body prose, emphasis. The voice of the product. Warm, literate, authoritative. Available via `typography.fontFamilySerif` or `var(--font-family-serif)`.
- Page questions: 36–48px, weight 400, italic
- Section headings: 28–32px, weight 400
- Body prose: 17px, line-height 1.6
- Italic for verbs and emphasis

**Inter** (sans-serif) — UI chrome, eyebrows, kickers, buttons, form labels, status badges, navigation. The structure. Available via `typography.fontFamily` or `var(--font-family)`.
- Eyebrow caps: 11px, weight 500, letter-spacing 0.18em, uppercase
- Kickers: 11px, weight 500, letter-spacing 0.22em, uppercase
- Body UI: 14px, weight 400
- Buttons/labels: 13–14px, weight 500

### Hierarchy
- Display: 48px Garamond, page question
- Heading: 32px Garamond, section heads
- Subheading: 24px Garamond italic, subsections
- Body: 14px Inter for UI, 17px Garamond for prose
- Caption/meta: 11–12px Inter, muted color

## Spacing and Layout

8px grid. All spacing is a multiple of 4: 4, 8, 12, 16, 24, 32, 48, 64, 80, 96.
- Page padding: 36px desktop, 16px mobile
- Section spacing: 56px between major sections, 24px between related
- Card padding: 24px
- Table row height: 48px minimum (touch-friendly)
- Sidebar width: 252px, collapsed 72px

## Borders and Dividers

Never use solid color borders (no more `#E5E7EB`). Use hairlines: `1px solid var(--hairline)`.
- Primary divider: `var(--hairline)` — 10% opacity
- Subtle divider: `var(--hairline-2)` — 5% opacity
- Ghost divider: `var(--hairline-3)` — 2.5% opacity
- Focus ring: 2px solid orange (`var(--color-borderFocus)`)
- No boxes. No heavy borders. Hairlines only.

## Cards and Elevation

- Cards: White background, `1px solid var(--hairline)`, border-radius 10px
- Shadows: Use sparingly. Only on elevated elements (modals, dropdowns)
- Hover: Hairline darkens to `var(--hairline-2)` weight. Never background color change.
- Selected: `var(--color-surfaceSelected)` — warm orange tint at 8%

## Buttons

- Primary: Orange background (`#F47820`), white text, radius 8px, height 40px
- Secondary: White background, `1px solid var(--hairline)`, ink text
- Ghost: No background, no border, ink-3 text, hover underline
- Destructive: Rust background (`#B8472E`), white text
- Loading: Spinner replaces text, button disabled, same width

## Tables

- Header: 12px Inter uppercase, ink-3 color, no bold. Sticky on scroll.
- Rows: 48px height, 14px text, hover with parchment-2 background
- Hairline between rows, not borders
- Sort: Small chevron in header

## Forms

- Input height: 40px
- Border: `1px solid var(--hairline)`, radius 8px
- Focus: 2px ring in orange
- Label: 12px Inter, ink-3, above input
- Error: Rust border, rust text below

## Mobile and Field First

The platform's center of gravity is the boots, not the brogues.

- Touch targets: 48px minimum (larger than Apple's 44px — gloved hands)
- Swipe: Left to archive, right to approve
- Bottom navigation on mobile, not hamburger
- Camera: One tap to capture, auto-tag with GPS
- Offline: Queue all actions, sync on reconnect, show sync status
- Voice input on every text field

## Animations

- All transitions: 150ms ease-out. Never longer than 200ms.
- Page transitions: Fade in 200ms
- Modal: Fade + scale from 95% in 150ms
- Skeleton loaders: Pulse on parchment-colored rectangles
- Never bouncy or spring animations. Professional.

## Keyboard Shortcuts

- Global: Cmd+K command palette, Cmd+/ shortcuts help, Escape close modals
- Navigation: G then D for Day, G then F for Field, G then S for Set
- Actions: N for new, E for edit, Delete for remove
- Tables: J/K up/down, Enter to open, Space to select

## Atom Components

Import from `@/components/atoms`:

```tsx
import {
  OrangeDot,    // The surveyor's mark — once per page
  Hairline,     // The only divider — never a box
  Eyebrow,      // Inter caps chrome — quiet metadata
  Kicker,       // Section label — "II · The Field"
  Sliver,       // Top bar — project name + context
  PageQuestion,  // The one question — italic Garamond
  ProseBlock,   // Body text — Garamond prose
  Horizon,      // Timeline bar — start/end with Now dot
  SectionHeading, // Garamond heading
} from '@/components/atoms';
```

## Responsive Breakpoints

- Desktop: 1280px+. Full sidebar, multi-column, keyboard shortcuts.
- Tablet: 768–1279px. Collapsible sidebar, stacked cards, touch-optimized.
- Mobile: Under 768px. Bottom navigation, single column, swipe gestures, large touch targets.

## The Test

Before shipping any page, ask: "Does this page answer one question? Does it have one orange dot? Could a superintendent use it in a glove on gravel at 5:45am? Could the same superintendent use it at 2pm to file an OSHA report?" If yes to all four, ship it.
