# Brand Visual Identity Spec

**Date:** 2026-05-04
**Status:** Spec ready. Designer (contractor → FT by Q2 2027) executes against this. Locked by Q4 2026.
**Companion specs:** `MARKETING_SITE_REWRITE_SPEC` (where the brand is most visible), `SALES_DECK_v1` (what the deck looks like), `SEED_DECK_v0` (investor version), `IOS_APP_SPEC` (mobile applications)
**Format reference:** Brand guideline doc. Inspired by Stripe Brand, Linear Brand, Figma Brand.

---

## TL;DR

**The aesthetic: Lethal Calm.**

Apple-grade craft + Lockheed-Martin precision + construction-trade authenticity. Not "modern SaaS startup" (Notion-y). Not "earnest social" (Slack-y). Not "tough guy construction" (cliché). It's the visual language of a precision tool — not a chatbot, not a marketing platform.

This spec covers: the typography choices (and rejections), color palette, photography direction, iconography, motion + animation, brand voice, illustration style, the logo, and the do/don't list for every surface.

---

## The Mood Board (qualitative)

### Reference brands we admire

- **Linear** — clean typography, monochrome aesthetic, deliberate spacing, low-saturation accents
- **Stripe** — warm humanism within disciplined craft, subtle gradients, expressive details
- **Figma** — confident geometric shapes, custom illustrations
- **Anthropic** — restrained intellectual aesthetic, beige + black + white minimalism

### Reference brands we reject

- **HubSpot** — cluttered, gradient-heavy
- **Salesforce** — corporate, soft, blue-purple soup
- **Slack** — emoji-heavy, casual
- **Procore** — early-2000s SaaS, blue + white + gradients
- **Stock construction sites** — generic, low-resolution, soulless

### Reference moments outside SaaS

- **Aesop product packaging** — restraint, white space, warm tones
- **Bauhaus poster design** — geometric, confident, intentional
- **Nike running shoe technical drawings** — precision, no decoration
- **Fighter jet HUDs** — information density without noise

---

## Typography

### Body — Inter (workhorse)

**Why:** open-source, comprehensive, optimized for screens, works on every platform, designed by Rasmus Andersson (open-source).

**Weight scale:**
- Regular (400) — body text
- Medium (500) — emphasis
- Semibold (600) — headlines, navigation
- Bold (700) — major headlines (rare)

**Italics:** Only for: scientific/technical names, foreign words, paper citations. Not for emphasis.

**Tracking:** -0.01em on body; 0 on headlines; +0.05em on small caps (used sparingly).

### Display — Söhne (premium, optional)

**Why:** for the moments that need premium feeling. Rich character vs Inter's neutrality.

**Use cases:**
- Hero headlines on landing pages
- Pull quotes
- Section titles in long-form content (rarely)

**Source:** klim.co.nz, $750/year for web + apps. Worth it; brand differentiator.

**Alternative if budget tight:** stay with Inter Display variant. Acceptable; less distinctive.

### What we reject

- Any rounded sans (Comic Sans, Quicksand, Nunito) — too friendly
- Any high-contrast serif (Playfair, Cormorant) — wrong feeling
- Fancy ligatures, swashes, italics with extra flourishes — distract from craft
- Multiple display fonts (we don't need more than 2 typefaces total)

---

## Color Palette

### Primary

```
Deep Slate          #0E1115         (almost-black; foundational)
                                     (Use: page backgrounds, body text on white)

Slate              #1A1F2E          (slightly warmer; UI surfaces)
                                     (Use: cards, panels, navigation)

Iris Gold          #FFB347          (the brand callback to Iris the agent)
                                     (Use: primary CTAs, key brand moments)
                                     
Construction        #FF6B35          (safety orange — WARNINGS ONLY)
Safety Orange                        (Use: error states, critical alerts; not navigation)
```

### Neutrals

```
White               #FFFFFF
Cream              #FAF8F5          (warm white; subtle reverb of Aesop influence)
Slate Gray         #6C757D          (secondary text, muted text)
Slate 200          #CED4DA          (borders, dividers)
Slate 100          #F1F3F5          (light backgrounds, surface tones)
```

### Semantic

```
Success Green      #2EBC4F          (rare; used for "approved" badges)
Warning Amber       #F59E0B         (rare; used for "needs review")
Info Blue          #3B82F6          (rare; used only when the design system requires it)
```

### What we explicitly avoid

- ❌ Bright pink, magenta, neon colors
- ❌ Pastel colors (baby blue, pastel green) — too startup-cute
- ❌ Heavy gradients (Stripe-light radials are OK; HubSpot-style not)
- ❌ Dark mode that's just "invert all colors" — designed dark mode separately
- ❌ Color-only conveying meaning (WCAG AA — color must pair with text/icon)

---

## Color Application Rules

### Backgrounds

- Default body: `#FFFFFF` (white)
- Sectioned breaks: `#FAF8F5` (cream) for subtle separation
- Code / technical sections: `#0E1115` (deep slate) with `#FFFFFF` text

### Text

- Primary text on white: `#0E1115`
- Secondary text on white: `#6C757D`
- Tertiary / muted: `#CED4DA`
- On dark backgrounds: invert; use `#FFFFFF` and `#A0A0A0`

### Brand accents

- Iris Gold: 1-2 instances per page maximum. The CTA button. The Iris logo wing. Not background; not heavy use. **Iris Gold is the spice; not the dish.**

### Warnings + errors

- Construction Safety Orange: NEVER for primary navigation. ONLY for: error states, critical alerts, safety warnings. When users see this color, attention is mandatory.

---

## Photography Direction

### Real construction sites — never stock

The Field Manual is explicit ("real construction sites, real PMs (with permission), no stock photos"). Stock construction photos are the death of credibility.

### Photo style

- **Documentary, not editorial.** Construction crews working, not posing. Hard hats askew. Concrete dust. Real moments.
- **Mid-distance, not close-up.** Show the context. The slab, the trades, the equipment.
- **Natural light.** Golden hour, overcast — both fine. No heavy retouching.
- **Real diversity.** US construction is racially + ethnically diverse — show it.
- **Ages.** Real PMs are 28-50. Not 22-year-old models.

### What to avoid

- ❌ Stock photos of "businesspeople in hard hats"
- ❌ Smiling-at-camera shots
- ❌ Aerial drone shots (overused)
- ❌ "Inspirational" sunset shots
- ❌ Heavy filters (Instagram-y)
- ❌ Anything that looks like a construction-magazine ad

### Sourcing strategy

- Brad Cameron's Nexus pilot — capture during pilot (with consent). 5 photos, real PMs, real action.
- Carleton (if backup activated) — same.
- Through Q3-Q4 2026: build a library of 50+ real photos from real customers.
- Photographer (1-day shoot, ~$3K) for the early shots when we don't have real customers yet.

---

## Iconography

### System: Heroicons (free) or Phosphor (more characters)

**Choose Heroicons.** Open-source, MIT-licensed, used by Tailwind UI. Wide cross-platform support.

### Usage rules

- Solid icons for active state; outline for inactive
- 24x24 in body content; 16x16 in dense UI; 32x32 for emphasis
- Stroke width 1.5px (Heroicons default) — not too thin, not too thick
- Color: matches surrounding text; only Iris Gold on key brand surfaces

### Custom icons we'll need (built by designer)

- SiteSync logo (the wordmark + the bird/wing motif representing Iris)
- Hash chain icon (for audit-chain features)
- Construction-specific (safety vest, hard hat, blueprint, slab) — only when essential

---

## Motion + Animation

### Principles

- **Sub-200ms transitions.** No long animation. Construction PMs are busy.
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` — sharp ease-out, decelerates at end
- **No bouncy interactions** — unprofessional
- **Respect Reduce Motion** OS setting

### Use cases for motion

✅ Page transitions (subtle fade)
✅ Modal open/close (fade + slight scale)
✅ Side panel slide (per `IRIS_CITATIONS_SPEC` — slide from right)
✅ Button press feedback (subtle press)
✅ Loading spinner (when network is slow)
✅ Demo timer countdown (visible progress)

### What we avoid

- ❌ Carousel auto-play
- ❌ Parallax scrolling
- ❌ Lottie animations on landing pages (too SaaS)
- ❌ Cursor trails or follower animations
- ❌ "Swoosh" sound effects

---

## Voice + Tone

### The voice

**Lethal calm.** Authority without arrogance. Specific without jargon. Direct without curt.

### Word-choice rules

- "We built this" not "Our team designed"
- "Here's what changed" not "Stay updated"
- "Approve" not "Take action"
- "Sign in" not "Get started" (when about access; "Get started" only when about evaluation)
- "Sub" not "Subcontractor" (industry vernacular)
- "PM" not "Project Manager" (industry vernacular; trust the audience)

### Banned phrases

❌ "Certainly," "I hope this helps," "Reach out," "Touch base"
❌ "Game-changer," "best-in-class," "world-class," "leverage" (as a verb)
❌ "Empower," "transform," "revolution," "disrupt"
❌ "We believe..." (everyone says this; we don't)
❌ "AI-powered" (everyone says this too)

### Tone rules

- **Read it aloud.** If it sounds like a SaaS landing page, rewrite.
- **No exclamation points.** Period.
- **No emojis** in any official communication. None. Zero.
- **8th grade reading level** in marketing copy; technical depth in product copy.
- **Specific over general:** "10 hours/week" beats "save time."
- **Lead with proof:** "[Customer] saved 14 hours/week" beats "saves time."

---

## Illustration Style

### Hand-drawn, geometric, restrained

Custom illustrations only when:
- Concept that's hard to show with photography
- Process diagrams (architecture flows, lifecycle states)
- Marketing-specific moments (e.g., the wedge concept)

Not for:
- Empty states (use real screenshots + minimal text)
- Hero images (use real photos)
- Decoration (don't decorate; communicate)

### Style guidelines

- Geometric shapes, low complexity
- Single outline weight (1.5px)
- Single color OR Iris Gold accent (1 use per illustration)
- No 3D, no isometric, no skeuomorphism

---

## The Logo

### The wordmark

```
SiteSync
─────────
```

- Inter Bold, kerning slightly tightened
- Lowercase 's' beats uppercase (more humanist)
- Optional: italic descender on final 'c' as quiet uniqueness

### The mark (for app icon, social, favicon)

A small bird-wing / iris flower glyph that's:
- Recognizable at 16x16 (favicon)
- Clear at 1024x1024 (App Store)
- Works as silhouette
- Iris Gold or pure black

### What we don't use

- ❌ The full wordmark in app icons (too narrow)
- ❌ The mark only in branded materials (uses wordmark)
- ❌ A tagline embedded in the logo (clutters)

---

## Tablet + Mobile Considerations

The brand carries to mobile:

- Logo at smallest 32x32 readable
- Color palette identical (Mobile Dark Mode = inverted with adjusted contrast)
- Typography: Inter loaded as variable font; saves ~80KB
- Iconography: same Heroicons; sized appropriately (24x24 standard; 44x44 tap targets)

The brand on iOS Live Activity countdown timer (per `AUTO_EXECUTE_CANCEL_WINDOW_SPEC`) uses the wordmark + minimal Iris Gold accent.

---

## Brand Application Rules

### Marketing site (per `MARKETING_SITE_REWRITE_SPEC`)

- White space generous (60%+ of viewport on hero)
- Limited photo coverage (no edge-to-edge unless intentional)
- Iris Gold sparing — 1-2 places per page
- Construction Safety Orange forbidden in navigation

### Sales deck (per `SALES_DECK_v1`)

- White slides; deep slate text
- Iris Gold for callout statistics
- Real photos full-bleed; no stock
- Limited typography variation per slide (1-2 fonts max per slide)

### Mobile app (per `IOS_APP_SPEC` / `ANDROID_APP_SPEC`)

- System fonts (Inter loaded; falls back to system if needed)
- Brand colors with Mobile Dark Mode adjustments
- Iconography: Heroicons solid for active states
- No animation > 250ms

### Documentation site

- Code blocks: dark slate (#0E1115) with monospace (JetBrains Mono or Fira Code)
- Long-form content: max-width 700px; line-height 1.7; serif optional for body (override Inter for readability)
- Diagrams: same Iris Gold + black + white; nothing else

### Investor materials (`SEED_DECK_v0`)

- Same as marketing site but with concession to common investor expectations:
- Slightly more dense
- Standard Inter; no need for Söhne
- Numbers prominent (financial model, traction)
- Less photography; more diagrams

---

## What Walker Does With This Spec

1. Read the qualitative direction; flag if "lethal calm" doesn't match his vision
2. Identify designer who can execute (contractor first; FT after Q2 2027)
3. Confirm Söhne budget ($750/year) — defer if budget tight
4. Identify photographer for the early shoot
5. Sign off; designer takes from here

---

## What Designer Does

- Build full design system in Figma
- Build component library that matches the brand
- Build photography brief + shoot direction
- Maintain brand consistency across web + mobile + decks + docs
- Brand audit at launch + quarterly thereafter

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| BVI-1 | Designer hire slips → site visual ad-hoc | Medium | High | Engage contract designer immediately; FT by Q2 2027 |
| BVI-2 | "Lethal calm" interpreted incorrectly (too cold) | Medium | Medium | Iterate with Walker; show real examples vs aspirational |
| BVI-3 | Söhne licensing costs unfeasible | Low | Low | Inter Display variant is acceptable substitute |
| BVI-4 | Brand drifts as more people contribute | High | Medium | Brand book locked; quarterly audit; designer reviews everything |
| BVI-5 | Real-customer photography unavailable pre-launch | Medium | Medium | Photographer 1-day shoot fills gap; replace with real photos as customers come |
| BVI-6 | Investor reaction: "looks too minimal" | Low | Low | "Lethal calm" is the brand; differentiates from generic SaaS aesthetic |

---

## What this spec deliberately does NOT cover

- Specific marketing site design (covered by `MARKETING_SITE_REWRITE_SPEC`)
- Specific sales deck design (covered by `SALES_DECK_v1`)
- Specific app design (covered by `IOS_APP_SPEC` + `ANDROID_APP_SPEC`)
- Demo video aesthetic (covered by `DEMO_VIDEO_SCRIPT_SPEC` forthcoming)
- Component library implementation (Tailwind + shadcn or custom; designer + engineer #2 decide)
- Print materials (year 2+)
