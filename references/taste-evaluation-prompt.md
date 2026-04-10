# Taste Evaluation Prompt

Use this prompt to evaluate the organism's UI work against world-class standards.
This is not a checklist — it is a calibration of aesthetic judgment.

---

## What Great Construction Software Feels Like

These are not rules. They are descriptions of **feeling** — the experiential
quality that separates software a GC *chooses* to use from software a GC is
*forced* to use.

### Dashboards

The best construction dashboards feel like a **control room**, not a spreadsheet.
Information is spatially organized. The eye is drawn to what matters. Numbers
that are fine are calm; numbers that need attention pulse with urgency. You
should be able to glance at a dashboard for two seconds and know if the project
is healthy. The color palette is restrained — red means danger, green means
safe, everything else is neutral. Excessive color is noise.

A great dashboard makes you feel **in command**. You are the pilot. The
instruments are calibrated. Nothing is surprising, but everything is visible.

A bad dashboard makes you feel **lost in data**. Numbers everywhere, all the
same weight, all the same color. You have to read every label to find the one
metric that matters. It feels like homework.

### Field Apps

Great field apps feel like **extensions of your hand**. You don't think about
the UI — you think about the work. The interface disappears. What remains is
the task being accomplished. Touch targets are generous. Actions are one tap
away. Text is legible in sunlight. The app assumes you're wearing gloves,
standing in mud, squinting at a screen.

A great field app makes you feel **fast**. I opened it, I did the thing, I
closed it. It took less time than writing it on paper.

A bad field app makes you feel **frustrated**. Tiny buttons, endless
scrolling, required fields that don't matter, a form designed by someone who
has never stood on a construction site.

### Data Tables

The best data tables are **scannable in 2 seconds**. Your eye can find the
row that matters without reading every row. Color, weight, and position do the
filtering before your conscious mind engages. Status columns use color badges,
not text. Numeric columns are right-aligned. The most important column is
first. Rows that need attention float to the top.

A great table makes you feel **efficient**. Scan, find, act. Three steps.

A bad table makes you feel like you're **using Excel on a website**. Every row
looks the same. Nothing stands out. You have to Ctrl+F to find what you need.

### Navigation

Great navigation is **invisible**. You always know where you are. You always
know how to get where you want. The sidebar shows context, not just links.
Breadcrumbs exist but you rarely need them because the spatial model is
intuitive. The back button always works.

A great nav makes you feel **oriented**. I am here. That is there. I know the
map.

A bad nav makes you feel **lost**. Which menu was that under? Why did the page
jump? Where did I just come from? This feels like a 2010 enterprise app.

### Forms and Creation Flows

Great forms are **conversational**. They ask one thing at a time, in the order
you'd naturally think about it. Required fields are minimal. Defaults are
intelligent. Validation is inline and immediate, not a red banner at the top
after you submit. Success feedback is instant.

A great form makes you feel **guided**. Someone thought about this. They
anticipated what I'd need.

A bad form makes you feel **interrogated**. Twelve required fields, half of
which don't apply. Error messages that say "required" without saying why. A
submit button that does nothing visually when clicked.

---

## Reference-Based Evaluation Criteria

When evaluating a page, compare it to the best-in-class reference for that
pattern type. This is not about copying — it is about knowing the standard.

### Dashboard

- **9-10:** Feels like **Notion's project view** meets **Datadog's monitoring**.
  Information density is high but organized. Every element earns its space.
  Intelligence surfaces without being asked.
- **7-8:** Feels like **Stripe's dashboard**. Clean, professional, data-rich.
  Would impress in a demo.
- **5-6:** Feels like **Salesforce lite**. Functional but forgettable. Cards
  exist but they all look the same.
- **3-4:** Feels like a **government form online**. Data is there but
  presentation is flat. A GC would think "this isn't ready."
- **1-2:** Feels like a **developer's debug page**. JSON on screen, or empty
  placeholder cards.

### Tables

- **9-10:** Feels like **Linear's issue list**. Scannable, filterable, every
  row has visual status indicators. Clicking a row opens a smooth detail panel.
- **7-8:** Feels like **Airtable**. Clean grid, sortable columns, good density.
- **5-6:** Feels like **a styled HTML table**. Zebra stripes, basic sorting.
  Works but doesn't delight.
- **3-4:** Feels like **an Excel export**. Raw data dumped into rows. No
  status colors, no visual hierarchy.
- **1-2:** Feels like **console.log output**. Or an empty table with just headers.

### Navigation

- **9-10:** Feels like **Figma's sidebar**. Contextual, spatial, always
  relevant. You never feel lost.
- **7-8:** Feels like **Notion's sidebar**. Clean hierarchy, collapsible
  sections, clear active state.
- **5-6:** Feels like **a Bootstrap template nav**. Works but generic.
- **3-4:** Feels like **SharePoint**. Too many levels, unclear hierarchy,
  "where am I?"
- **1-2:** Feels like **no navigation at all**. Or a hamburger menu that
  doesn't open.

### Mobile Responsiveness

- **9-10:** Feels like **a native iOS app**. Gestures work. Spacing is
  perfect. It was designed for this screen.
- **7-8:** Feels like **a good responsive webapp**. Everything fits, nothing
  is truncated, touch targets are adequate.
- **5-6:** Feels like **a desktop site that doesn't break on mobile**. It
  works but it wasn't designed for this.
- **3-4:** Feels like **a desktop site on a phone**. Horizontal scrolling,
  tiny text, elements overlapping.
- **1-2:** Unusable on mobile.

---

## Scoring Rubric

Use this rubric when evaluating any UI artifact produced by the build system.

| Score | Description | Gut Check |
|-------|-------------|-----------|
| **9-10** | Someone would screenshot this and post it as design inspiration. You'd show this to investors and they'd nod approvingly. | "Wow, this looks real." |
| **7-8** | Professional, clean, would impress in a demo. A GC would lean forward. Not award-winning but clearly competent. | "This is solid." |
| **5-6** | Functional but forgettable. Looks like every other SaaS app. A GC wouldn't be offended but wouldn't be impressed either. | "It works, I guess." |
| **3-4** | Dated or rough. A GC would think "this isn't ready" or "this is a prototype." Missing polish, empty states, or visual bugs. | "This needs more time." |
| **1-2** | Broken, empty, or confusing. Immediate loss of confidence. A GC would close the tab and never return. | "What am I looking at?" |

---

## How to Use This in Evaluation

When the Evolution Engine reviews tonight's build:

1. **Look at each page's screenshot** (from perception or demo rehearsal).
2. **Compare to the reference standard** for its pattern type.
3. **Score 1-10** using the rubric above.
4. **Write one sentence** explaining the score: "Dashboard scores 4/10 because
   it feels like a government form — all cards are the same size, no visual
   hierarchy, no color coding for status."
5. **Identify the single change** that would improve the score most: "Adding
   status-colored badges to the metric cards would move this from 4 to 6."

The goal is not perfection on night one. The goal is **measurable progress
toward taste**. A page that goes from 3 to 5 in one night is an excellent
outcome. A page that stays at 3 for three nights is a failure of aesthetic
judgment.

---

## Anti-Patterns to Flag Immediately

These are instant tells that the system has no taste. Flag them as P0:

- **All cards the same size and color** — the dashboard is a grid of identical
  rectangles. Nothing is prioritized.
- **Text-only status** — writing "Approved" in plain text instead of a green
  badge. Status should be visible before you read it.
- **Gray everything** — a monochrome page with no color coding. Color carries
  meaning. Absence of color means absence of information design.
- **No empty states** — a blank white area where data should be. Every list,
  table, and container needs a designed empty state with a call-to-action.
- **Walls of text** — paragraphs where bullet points belong. Construction
  professionals scan, they don't read.
- **Developer-facing labels** — "created_at" instead of "Created." Snake_case
  in the UI is an instant credibility loss.
- **No loading states** — content that appears suddenly after a delay.
  Skeleton screens signal that the app knows what's coming.
