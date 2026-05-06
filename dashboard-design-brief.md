# The Command Center

## The philosophy

A dashboard is not a collection of charts. A dashboard is an answer to a single question: **"What do I need to know right now?"**

The greatest dashboards in history aren't dashboards at all. The cockpit of a 747 doesn't show you every sensor on the aircraft — it shows you what will kill you if you ignore it, and keeps everything else one glance away. An Apollo mission control screen showed 50 data points but your eye went to the ONE that mattered. Dieter Rams' clock radio had one dial. Not because there was only one thing to control — because there was only one thing that mattered at 6am.

SiteSync PM's dashboard should feel like a construction superintendent's brain, externalized. The moment they open the app at 5:45am, before the crews arrive, they should know: Is my project healthy? What needs my attention? What's the weather doing to my schedule? Not in 30 seconds of scanning — in 3 seconds. In a single breath.

The design principle: **information density without cognitive load.** Dense enough that a PM can glance and know everything. Clean enough that it never feels overwhelming. The data should feel like it's breathing, not screaming.

## What this page does today (the architecture)

The dashboard has a clear vertical hierarchy. From top to bottom:

### 1. Hero header
- Personalized greeting: "Good morning, Walker"
- Date: "Monday, April 28"
- Project name as h1: "Merritt Crossing" (28px, bold, -0.025em tracking)
- Live weather: emoji icon + high/low temps (pulled from OpenWeather via geocoded project address)
- Thin progress bar (3px) showing overall project completion with animated fill + percentage + "Day 147 / 312"

### 2. Four KPI metric tiles (grid)
Each tile is a clickable card with internal hierarchy: LABEL (uppercase, 11px, tertiary) → BIG NUMBER (28px, bold, tabular-nums) → context line (12px, tertiary). Each has a hover lift animation.

The four KPIs:
- **Schedule**: "+0 days" / "On Track" (green) or "-5 days" / "5d behind" (red)
- **Budget**: "$500" / "1% of $45.2K" with a thin progress bar inside the card
- **Open RFIs**: "3" / "1 overdue" (red if overdue, neutral if clear)
- **Safety**: "95/100" / "Excellent" (green/amber/red based on score)

### 3. Project Health card
A unified 0-100 health score computed from four sub-scores: Cost (CPI), Schedule (SPI), Safety, and Quality (punch resolution). Shows the composite score prominently with a circular progress ring and the four sub-scores as small horizontal bars beneath it. Each bar has a label, score value, and context text.

### 4. Focus items (attention list)
A card with 1-4 clickable rows showing what needs attention RIGHT NOW:
- "3 overdue RFIs — Blocking field work" (red icon)
- "Budget at 92% — Monitor closely" (amber icon)
- "2 missing lien waivers — Collect before release" (amber icon)
- "Rain on Thursday may impact Foundation Pour" (weather conflict)

Each row has: severity-colored icon bubble (30px circle) → label + detail → chevron right. Hover highlights the row.

### 5. AI Daily Briefing
An expandable card powered by an AI edge function. Shows a natural-language summary of the day: "3 RFIs need responses by Friday. Foundation pour is tracking 2 days ahead. The concrete sub's insurance expires next week." Collapsible with highlights (green) and concerns (amber/red) sections.

### 6. Command widgets (2x2 grid)
Four cards in a balanced grid:
- **My Tasks**: Cross-project task list assigned to current user. Shows title, project name, priority badge, due date. Has inline status update and detail modal.
- **Compliance**: Tracks certifications, insurance, and license expirations. Shows upcoming expirations with countdown.
- **Carbon**: Environmental tracking — CO2 equivalent, energy consumption, waste diverted.
- **Site Map Mini**: Embedded map showing project location pin via lat/lon.

### 7. Portfolio view (full width)
Multi-project overview for PMs managing several projects. Shows each project as a row with name, progress bar, budget %, and status indicators.

### 8. Lower deck (adaptive 2-column)
- **Left column**: 5-Day Weather Forecast strip (emoji + high/low for each day, rain probability highlighted) + Critical Path card (top 3 critical-path activities with progress rings and float status)
- **Right column**: Activity Feed (chronological list of recent actions across the project — RFI created, submittal approved, change order issued — each with type icon, timestamp, and actor)

### 9. Quick actions
- Floating QuickRFI button (lazy loaded)
- Onboarding checklist for empty/new projects

## What the current design looks like

- Max width: 1000px, centered
- Background: page surface (#FAFAF8)
- Cards: white (#FFFFFF) with 1px subtle border, 12px border-radius
- All sections use motion.div with staggered fade-up animations (0.7s duration, Apple-style overshoot easing)
- Metric tiles: min-height 120px, 20px horizontal padding, hover lifts 2px with a subtle shadow
- Typography: Inter throughout, -0.011em body tracking, -0.025em heading tracking
- Colors: warm neutral grays, orange for progress/brand, status colors for severity (green/amber/red)
- The overall feel is: calm, authoritative, information-dense but not cluttered

## Brand system

(Same tokens as the login brief — include for completeness)

### Colors

Primary orange: `#F47820` (the 400 stop)
Full ramp: 50 `#FEF5ED` → 100 `#FDDCB8` → 200 `#FBBD84` → 300 `#F9974F` → 400 `#F47820` → 500 `#E06A10` → 600 `#C45A0C` → 700 `#A04808` → 800 `#7C3606` → 900 `#582604`

Indigo (AI accent): `#4F46E5`

Status colors:
- Active/Success: `#2D8A6E`
- Pending/Warning: `#C4850C`
- Critical/Error: `#C93B3B`
- Info: `#3A7BC8`
- Review: `#7C5DC7`

Warm neutrals:
- Page: `#FAFAF8` | Sidebar: `#F6F3F0` | Card: `#FFFFFF`
- Inset/Recessed: `#F3EFEC` | Border subtle: `#F0EDE9` | Border: `#E5E1DC`
- Text primary: `#1A1613` | Secondary: `#5C5550` | Tertiary: `#767170` | Disabled: `#C5C0BB`

### Typography
- Font: Inter (400, 500, 600, 700)
- Display: 36px | Heading: 28px | Large: 24px | Subtitle: 18px | Title: 16px | Body: 14px | Small: 13px | Label: 12px | Caption: 11px
- Letter-spacing: body -0.011em, headings -0.02em to -0.03em
- Line-heights: tight 1.2, snug 1.35, normal 1.55

### Spatial system
- 4px grid
- Border radii: sm 4px, base 6px, md 8px, lg 10px, xl 12px, 2xl 16px
- Shadows: card `0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.015)` | hover `0 3px 12px rgba(0,0,0,0.06)` | glow `0 4px 24px rgba(244,120,32,0.25)`
- Transitions: 160ms quick, 300ms smooth `cubic-bezier(0.32, 0.72, 0, 1)`
- Max content width: 1000px centered

## The design challenge

The current dashboard works — it's functional, data-driven, and well-structured. But it doesn't take your breath away. It doesn't feel like the command center of a $50M construction project.

Think about what makes the Apple Watch activity rings transcendent. It's not that they show exercise data — every fitness tracker does that. It's that they made health data feel ALIVE. The rings breathe. They pulse. They celebrate. The data has emotion.

That's what this dashboard needs. Not more data. Not more widgets. Better CRAFT. Every pixel should feel considered. Every transition should feel intentional. The hierarchy should be so clear that your eye moves through the page like reading a poem — emphasis, pause, emphasis, pause.

## What to design

A single, complete dashboard mockup at 1440x900. Show it with real-looking data for a $42M commercial building project called "Merritt Crossing" in Dallas, TX.

Design it thinking about these principles:

**Hierarchy is everything.** The greeting and project name should feel like a headline. The KPI tiles should feel like the subheadline. The focus items should feel like the lead paragraph. Everything below is supporting detail.

**Let data breathe.** The metric tiles should have enough internal whitespace that each number feels like it owns its space. Don't pack them tight — let each KPI tile feel like a little monument to its metric.

**The health score should be a moment.** This is the single most important number on the page — a synthesized 0-100 score for the entire project. It should be designed so that a PM can glance at this from across the room on a monitor and know instantly: green = we're good, amber = pay attention, red = we have a problem.

**Weather should feel integrated, not bolted on.** Weather is life-or-death in construction — rain stops concrete pours, wind stops crane lifts, heat indexes trigger OSHA shutdowns. The weather shouldn't feel like a widget — it should feel like it belongs in the project's vital signs.

**The AI briefing should feel intelligent, not gimmicky.** This is Iris speaking — the AI that sees the whole project. When it surfaces a concern, it should feel like a trusted advisor whispering in your ear, not a chatbot spitting alerts.

**Motion should be felt, not seen.** The staggered fade-up entrance should feel like the dashboard is waking up — assembling itself calmly, confidently. Not bouncing. Not sliding from weird angles. Just... appearing, with grace.

## Deliverables

- One desktop mockup at 1440x900 — production-quality, not a wireframe
- One mobile mockup at 390x844 — how does this density translate to a phone? A superintendent checking this on their iPhone at 5:45am on a job site
- Show real-looking data: project at 47% complete, Day 147 of 312, budget $19.8M of $42M (47% spent), 3 open RFIs (1 overdue), Safety score 92/100, Project Health 78/100, weather 72°F sunny with rain forecast Thursday
- 1-2 sentences on your design rationale

Make it so good that a PM opens this at dawn and feels, for the first time, that their software actually understands what their day looks like.
