# Design Reset — Investor-Ready Enterprise PM (read this first)

## North Star
**A control tower for the construction PM. Not a meditation app.** Every screen earns its pixels in data, not whitespace. AI is woven in as a second pair of eyes — never decorative.

If Steve Jobs were a construction PM: ruthless reduction to what matters, but for a PM, not an art director. Industrial-grade clarity. Real names, real dates, real dollars, real risks — surfaced before the PM has to hunt. One-tap to act. No fluff. No sparkles. Hardware-grade alignment.

## What we kill across the platform

These have been creeping in for weeks. They're why the product reads as "artsy" instead of "enterprise."

| Kill | Why |
|------|-----|
| `maxWidth: 720` on dashboards / data pages | reading-blog width on a 1440 viewport throws away half the screen a PM expects |
| Italic Garamond as a primary type role (`PageQuestion`) | belongs to brand/marketing only — never on data pages |
| Parchment (`#FAF7F0`) as the default data surface | warm-toned literary surface; data needs neutral |
| The "Sundial / Stream / Book / Place" four-shape vocabulary in atom comments | poetic abstraction with no functional value |
| Empty states like "Nothing waiting on you." in 28px serif | empty doesn't mean blank — show the project pulse, lookahead, status |
| Decorative motion (sparkle pulses, drift, bloom) | enterprise software does not breathe |
| Per-row sparkles or ✦ glyphs as standalone decoration | use only when paired with a labeled "Iris drafted this" |
| Soft drop-shadows on data cards | data lives in flat tables, not floating cards |
| Casual lowercase microcopy ("today's vibe", "what now?") | sentence case, professional, factual |

## What we add across the platform

| Add | How |
|-----|-----|
| Full viewport on desktop (≥ 1024px) | sidebar + main content + optional context rail; no centered max-width on data pages |
| Dense data tables on every record page | sticky header, sortable columns, fixed-height rows, 13px Inter |
| Real numbers visible at a glance | $ impact, schedule-days impact, age in days, status pill, assignee — never just a title and a date |
| Status pills | colored dot + label, consistent palette across pages |
| Keyboard nav | `j`/`k` to move, `Enter` to open, `e` to act, `/` to focus search |
| Sticky page headers with action button on the right | "+ New RFI", "+ New Submittal", etc. — no hunting for create |
| Permissions gating per-action only | every authenticated user sees every page (locked vision); admin gates *what they can do* |
| Iris woven into the dense view | a single-row "Iris detected" lane on the dashboard; per-row "Iris draft ready" badge inside tables — never a separate "AI mode" |

## Type rules (enterprise)
- Primary: **Inter**. Sans-serif. Weight 400 for body, 500 for emphasis, 600 for headers. No italic in product UI.
- Page title: Inter 18px weight 600, ink (not Garamond, not italic, not 28px).
- Section header: Inter 13px weight 600, uppercase, 0.04em letter-spacing.
- Table cell: Inter 13px weight 400, ink2 for primary text, ink3 for secondary.
- Numbers: tabular figures (`font-variant-numeric: tabular-nums`). Always.
- Garamond/serif: **brand surfaces only** (login, marketing, share-link covers). Never inside the app.

## Color rules
- Data surface: `#FCFCFA` (true off-white, near-neutral). Sidebars, tables, modals, dashboard background.
- Parchment (`#FAF7F0`): brand surface only — login, marketing, share-link covers.
- Ink scale: `#1A1613` ink → `#5C5550` ink2 → `#8C857E` ink3 → `#C4BDB4` ink4. Existing scale, keep as-is.
- Status palette (use these, only these):
  - Critical / overdue: `#C93B3B`
  - High / at risk: `#B8472E`
  - Medium / pending: `#C4850C`
  - On track / resolved: `#2D8A6E`
  - Brand action: `#F47820` (orange — primary CTAs only, not status)
- Iris/AI accent: `#4F46E5` indigo. Tiny doses. Never a wash.

## Layout rules
- ≥ 1024px (desktop): full viewport. Sidebar (252 expanded / 72 collapsed) + main + optional 320px right-rail. **No centered max-width on data pages.**
- < 1024px (tablet): sidebar collapses, no right-rail; main content fills remaining width.
- < 768px (mobile): bottom tab bar, full-bleed content, swipe gestures preserved.

## Iris rules
- Iris **prepares**, never **decides**. Every Iris output is labeled "Iris drafted this — review before sending" or equivalent.
- On the dashboard: Iris gets one **lane** at the top of the stream — a single horizontal strip showing detected risks/drafts. Not per-card sparkles.
- On record pages: a small "Iris draft ready" pill on rows where one is available. Click → inline preview → approve/edit/dismiss.
- Iris language is **specific to the user's role** (PM hears different summaries than Super). Tone and emphasis change; the underlying data does not.

## What does NOT change in this push
- The locked stream contract at `src/types/stream.ts`
- Routes
- Authentication
- Permissions matrix
- Database schema
- The fact that every page is reachable by every authenticated user (locked vision)

## Out-of-scope per tab
Each parallel tab owns ONE page. Do not touch:
- `src/types/stream.ts`
- `src/pages/day/index.tsx` or `src/components/stream/*` (the dashboard — owned by the lead session)
- `src/components/Sidebar.tsx`, `src/components/CommandPalette.tsx`, `src/config/navigation.ts`
- Any other tab's assigned page
- Any other tab's owned components

Stay on YOUR page. Make it perfect.
