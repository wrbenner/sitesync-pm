# Handoff: SiteSync Login (Direction 1 — "The Threshold")

## What's in this package

```
design_handoff_login/
├── README.md              ← this document
├── reference/
│   ├── 01-desktop.png     ← desktop reference (1440×900)
│   └── 02-mobile.png      ← mobile reference (390×844)
└── source/
    ├── Direction1Minimal.jsx   ← the design (React/JSX, mockup-only)
    ├── shared.jsx              ← Icon, LogoSymbol, frames, color tokens
    └── solo.html               ← the wrapper that renders the JSX
```

## How to read this package

The files in `source/` are **design references created in HTML/JSX** — a prototype, not production code to copy. Your task is to **recreate the design in your codebase's existing environment** (React/Vue/SwiftUI/native — whatever your stack is) using its established patterns and component libraries. Match the design pixel-perfectly using your existing tokens.

Fidelity: **High.** Final colors, typography, spacing, geometry. Recreate exactly.

## Overview

This is the SiteSync sign-in screen — the user's first contact with the product after the marketing site. The brief was "fresh breath of air" — passwordless, fast, no anxiety. The design uses a magic-link sign-in flow (no password to type, store, or forget).

**The metaphor.** A login as a *doorway*, not a form. The page is composed around two lines:
- A vertical **plumb line** (the form column, centered).
- A horizontal **level line** that runs across the page, the same y as the field's underline. The line is the *floor* the email rests on.

The black circle button sits with its center on this line — it is the period at the end of the field's sentence. The line + circle form one continuous piece of geometry.

**Personalization.** When the device has a recent successful sign-in (small first-name hint stored in `localStorage`), the greeting is `"Good morning, *Alex*."` (time-of-day + name, with the name italicized). Four greeting states, all using the same composition:

| State | Trigger | Text |
| --- | --- | --- |
| `hello` (default) | Recognized device, name in localStorage | `Good morning, *Alex*.` |
| `back` | Recognized client, no name | `Welcome back.` |
| `time` | No name, but want time-of-day warmth | `Good morning.` |
| `first` | First-time visitor, fresh device | `Welcome.` |

Time-of-day rule: `< 5h → Good evening`, `< 12h → Good morning`, `< 18h → Good afternoon`, `else → Good evening`.

## Layout

### Desktop (1440 × 900)

Background: `#FAFAF8` (page background — warm off-white).

**Composition:**
- One vertical column, **360px wide**, horizontally centered on the page.
- The column is positioned so that the **field's bottom edge** (the level line) lands exactly at the page's vertical 50%.
- The column's contents, from top to bottom, with exact spacing:

```
┌── (mark)               24px tall (LogoSymbol)
│   margin-bottom 56px
├── (greeting headline)  36px line-height-1, margin-bottom 40px
├── (field row)          56px tall — the line is at the bottom
│       margin-bottom 40px (clearance for the half-circle that hangs below)
└── (hint text)          13px / 1.6, color SS_FG3
```

Total column height from top to field-bottom: `24 + 56 + 36 + 40 + 56 = 212px`. Translate the column `(-50%, -212px)` from page center so the line lands at 50%.

**The level line** runs from the left edge of the page to `calc(50% - 240px)` (60px gap before the form), and from `calc(50% + 240px)` to the right edge. Each segment is a 1px horizontal hairline using a horizontal gradient that fades from `transparent` at the inner end to `rgba(26,22,19,0.07)` at the outer end. The gradient direction is *outward* on each side — so the line is faintest near the form and barely-visible at the page edges. The form is the center of attention; the line whispers.

**The field block** (`width: 360px, height: 56px`):
- The email `<input>` sits at `top:0, left:0, right:76px, bottom:1px` (so it doesn't overlap the underline).
  - No border, no background. Single-line, no label, no placeholder when empty (the typed value is the only content).
  - Font: Inter 400 17px / 1.0, letter-spacing -0.011em, color `#1A1613`.
- The **underline** is a 1px div at `bottom:0, left:0, right:0`, color `#1A1613`. This is the level line where the form sits.
- The **circle button** is `56×56px`, positioned at `right:0, bottom:-28px` (so the line passes through its diameter). `border-radius: 50%`, `background: #1A1613`, white arrow icon centered.
  - Hover: `transform: translateX(3px)`, `transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1)`.
  - Icon: arrow-right, 18px, 1.5px stroke, `#FFFFFF`.
  - `z-index: 2` — the button stacks above the underline so the line appears to terminate *into* the circle.

**Hint** ("We'll send a sign-in link."): 13px / 1.6, color `#767170`, letter-spacing `-0.005em`, centered.

**Bottom-of-page elements:**
- `Use single sign-on` text link, centered, `bottom: 56px`, font 400 12px Inter, color `#767170`. The quiet alternative for the 5% who need it.
- The **surveyor's dot**: a `4×4px` circle, `background: #F47820`, positioned `bottom: 60px, right: 56px`. The page's signature. The only color on the entire page besides the brand mark.

### Mobile (390 × 844)

Same composition, scaled. Status bar (9:41 / signal+battery) at top.

- Form column: full width minus 32px margins on each side.
- Mark: 22px.
- Greeting: 28px / 1.0.
- Field: 52px tall, font 16px (mobile-safe to avoid iOS auto-zoom).
- Circle button: 52×52, positioned `bottom: -26px`.
- Column from top: `22 + 44 + 28 + 36 + 52 = 182px`. Translate `(0, -182px)` from page center.
- Level line segments: from `left: 0` to `width: 24px`, and `right: 0` to `width: 24px` — i.e. only the page margins outside the form, since the form fills the visible width.
- SSO link: `bottom: 64px`. Surveyor's dot: `bottom: 68px, right: 32px`.

## Design tokens

These are the only values used. Lift them as-is.

```css
/* Color */
--ss-bg-page:       #FAFAF8;   /* page background, warm off-white */
--ss-fg-1:          #1A1613;   /* primary text, line, button bg */
--ss-fg-3:          #767170;   /* tertiary text (hint, SSO link) */
--ss-orange:        #F47820;   /* brand accent — used ONLY on the dot here */

/* Type */
font-family: Inter, sans-serif;

/* Greeting (desktop / mobile) */
font: 500 36px/1 Inter; letter-spacing: -0.035em;       /* desktop */
font: 500 28px/1 Inter; letter-spacing: -0.030em;       /* mobile  */
/* The italicized name uses font-weight: 400, font-style: italic */

/* Email input */
font: 400 17px/1 Inter; letter-spacing: -0.011em;       /* desktop */
font: 400 16px/1 Inter; letter-spacing: -0.011em;       /* mobile  */

/* Hint */
font: 400 13px/1.6 Inter; letter-spacing: -0.005em;

/* SSO link */
font: 400 12px/1 Inter; letter-spacing: 0.01em;

/* Geometry */
form-column-width:      360px (desktop) / fluid (mobile)
field-height:           56px (desktop) / 52px (mobile)
button-size:            56px (desktop) / 52px (mobile)
button-shape:           circle (border-radius: 50%)
underline-thickness:    1px (solid #1A1613)
level-line-thickness:   1px (gradient, fades outward)
level-line-opacity:     rgba(26,22,19,0.07) at outer end → transparent at inner end
form-gap-on-line:       60px (each side of form column on desktop)

/* Animations */
button-hover:           transform: translateX(3px); 220ms cubic-bezier(0.32,0.72,0,1)
field-focus:            (no visual treatment — keep it clean. The field is always "active")
```

No shadows. No gradients except the level-line fade. No rounded corners except the circle. No borders except the field's underline. No color except the orange dot and the ~10% color in the brand mark.

## Components

### LogoSymbol
The SiteSync brand mark. Use your existing component or asset. Sized 24px on desktop, 22px on mobile. The reference renders `assets/logos/sitesync-symbol.png` — use whatever your codebase has.

### Icon (arrow-right)
A 24×24 lucide-style arrow drawn in stroke. Use your existing icon library if available — otherwise the SVG path is in `source/shared.jsx`:
```jsx
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M5 12h14"/>
  <path d="m12 5 7 7-7 7"/>
</svg>
```

## Behavior

### Initial state
- Greeting computed from time-of-day + `localStorage.getItem('ss:last-name')` (if present).
  - If `last-name` exists → `"Good morning, *<name>*."`
  - If `last-name` absent and a `ss:returning=1` flag exists → `"Welcome back."`
  - First-time visit (no flags) → `"Welcome."`
- Email input is empty by default. (The mock prefills `alex@horizonbuilders.co` for visual purposes only — ship it empty.)
- Submit button is always visually enabled (the design's posture is "ready"). The actual submit handler validates and rejects empty/malformed addresses without changing the UI's appearance.

### Submitting
- User types email → presses Enter or clicks the circle button.
- POST to your magic-link endpoint with the email.
- On success: navigate to a confirmation screen ("Check your inbox").
- On error (network / unknown email / rate limit): display a quiet inline error in the hint slot. **No red, no shake, no anxiety language.** Examples:
  - `"We couldn't find that address."` (replaces "We'll send a sign-in link.")
  - `"Try again in a moment."` (rate limit)
  - `"Check your spelling and try again."` (malformed)
- Error styling: keep the same color (`#767170`) and font as the hint. Optionally a `1px` color shift on the underline to a slightly darker ink (`#5C5550`) — **not red**.

### After successful sign-in
- Persist the user's first name to `localStorage.setItem('ss:last-name', firstName)`.
- Persist the returning flag: `localStorage.setItem('ss:returning', '1')`.
- These power the personalized greeting on the next visit. They are first-name only — privacy-safe, on-device only.

### Use single sign-on
- The text link at the bottom opens an SSO flow (Google/Microsoft/Okta — whatever your IdP supports). For the design, it's just a quiet exit hatch.

## State management

Minimal. The page only needs:
- `email` (string, controlled input)
- `submitting` (boolean, disables button during request — UI doesn't change visually, just prevents double-submit)
- `errorMessage` (string | null, shown in hint slot when present)

No global state required.

## Responsive behavior

- Above `768px`: desktop layout (1440 reference).
- Below `768px`: mobile layout (390 reference).
- The form column is always horizontally centered.
- The form is always vertically positioned so the field's underline lands at page 50%. Use `position: absolute; top: 50%; transform: translateY(-<column-bottom-to-field-bottom>px)` (see numbers above).

## Assets

- **Logo**: `LogoSymbol` — use your existing brand mark. The reference uses a small isometric "stacked" symbol, ~24px tall.
- **Icon**: `arrow-right` from lucide (or equivalent in your icon library).

No images, no illustrations, no patterns. The page is intentionally type, line, and one dot.

## What to *not* add

The following were considered and deliberately rejected:

- ❌ "Sign in" / "Log in" page heading (the time-aware greeting replaces it)
- ❌ Email/password fields (passwordless only)
- ❌ "Remember me" checkbox (every device is remembered for the magic link)
- ❌ "Forgot password?" link (no password to forget)
- ❌ Social login buttons as primary affordances (SSO is a quiet text link at the bottom)
- ❌ Marketing copy, tagline, value prop on the login page
- ❌ Footer links (privacy, terms, cookies — those belong on the marketing site)
- ❌ Any decorative graphics, gradients, or illustrations
- ❌ Loading spinners on the button (use a subtle progress treatment instead — TBD)

The empty lower 60% of the page is **deliberate**. That's the breath of fresh air.

## Files in `source/`

- **`Direction1Minimal.jsx`** — the React component (`MinimalDesktop` and `MinimalMobile`). Read this for the exact JSX structure and inline-style values.
- **`shared.jsx`** — color tokens, `LogoSymbol`, `Icon`, `DesktopFrame`, `MobileFrame` helpers used by the mock.
- **`solo.html`** — the wrapper that loads React, Babel, and renders the components. Useful only as a runnable preview; **do not ship the inline-Babel pattern to production.**

To preview the source in a browser: serve the `source/` directory with any static server (e.g. `npx serve source/`) and open `solo.html?d=1d` (desktop) or `solo.html?d=1m` (mobile). Append `&g=hello|back|time|first` to flip greeting states.

## Implementation checklist

- [ ] Recreate the layout in your framework — semantic `<form>` with one `<input type="email" required>` and one submit button.
- [ ] Apply the design tokens to your existing token system (or inline if no system).
- [ ] Wire the magic-link POST to your auth endpoint.
- [ ] Implement greeting logic with `localStorage` (first-name + returning flag).
- [ ] Implement error states in the hint slot (no red, no shake, no anxiety copy).
- [ ] Implement the success transition to the "Check your inbox" screen (designs for that screen are not in this package — ask the designer or design something that holds this same composition).
- [ ] Test on a real iOS device — the 16px input font is critical to prevent zoom-on-focus.
- [ ] A11y: the email input should have an `aria-label="Email"` since there's no visible label. The circle button needs `aria-label="Continue"`. The level line and surveyor's dot are decorative — `aria-hidden="true"`.
- [ ] Keyboard: Enter submits, Tab moves to the SSO link, Escape clears the field.
