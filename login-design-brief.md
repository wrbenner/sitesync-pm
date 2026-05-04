# The First Impression

## The philosophy

There's a moment — exactly one — when someone decides if software is for them. Not after they use it. Before. The login page is that moment.

Leonardo understood that negative space isn't empty — it's charged. The space around the Mona Lisa's hands tells you as much as the hands themselves. Jobs understood that the unboxing experience of a product IS the product. The first touch, the first breath of air when the lid lifts — that's where trust is built.

This login page needs to do one thing: make a construction professional — someone who's been burned by ugly, clunky, half-broken software their entire career — feel something they've never felt opening a construction tool. The feeling should be: "Finally."

Not "wow, look at all these features." Not "this looks expensive." Just — finally, someone built this right.

## What you're designing for

SiteSync PM is a construction project management platform. 26 modules. Budgets, schedules, daily logs, safety, crews, 3D BIM models, an AI assistant named Iris that sees everything happening on your project. It's the operating system for building buildings.

But the login page doesn't need to say any of that. A Porsche dealership doesn't have a spec sheet on the front door. The door itself tells you everything.

The users: superintendents on job sites (calloused hands, iPads with cracked screen protectors, 5:45am starts), project managers juggling 14 subcontractors, owners checking progress from airport lounges. They all share one thing — they've used Procore, PlanGrid, Buildertrend, or some combination of tools that felt like they were designed by committee in 2011. They're tired.

## The emotional target

Close your eyes. Imagine the very first time you opened an iPhone in 2007. The screen was off. And it was still the most beautiful piece of technology you'd ever held. That's the bar.

The login page should feel:
- **Inevitable** — like this is obviously how it should look, and everything before was a rough draft
- **Calm authority** — not trying to impress you, just quietly confident
- **Warm** — not cold tech-minimalism, not sterile — there's a warmth here, like well-lit oak in a modern building
- **Alive** — something subtle should breathe, shift, exist — not a dead poster

## What needs to be on the page

Only what earns its place:
- The SiteSync PM mark
- A way to sign in (email, password, Google SSO, Apple SSO)
- A way to create an account
- A "forgot password" escape hatch

That's it. If you want to hint at what's inside — do it with craft, not content. A subtle animation. A material. A gradient that feels like sunrise on a construction site. Not a feature list. Not a screenshot carousel.

## Four directions to explore

**Direction 1: "The Quiet Page"**
What if the page was almost empty? A vast, warm canvas. The logo. A sign-in form. Nothing else. The confidence to say nothing. Like a Dieter Rams product — so reduced that what remains feels essential and perfect. The design IS the whitespace.

**Direction 2: "The Living Blueprint"**
What if the background subtly breathed? Not a video — something generative. Abstract construction geometry that slowly evolves. Thin lines forming and dissolving like a blueprint being drawn in real-time. The sign-in form floating above it like a clean card on a drafting table. The intersection of engineering precision and digital craft.

**Direction 3: "Iris Sees You"**
Lead with the AI. The indigo Iris eye as a gravitational center. Not a chatbot — an intelligence. "Your project, understood." The sign-in form below or beside it. This positions SiteSync as the first AI-native construction platform. The eye could have a subtle parallax or ambient glow — alive, watching, ready.

**Direction 4: "Dawn"**
A warm gradient that feels like 5:45am on a job site — the golden hour before the crews arrive. Deep warm tones at the bottom fading to light at the top. The SiteSync mark in white. The sign-in form as a clean, frosted-glass card. This says: "A new day for construction management." It's emotional without being sentimental.

For each: show desktop (1440x900) and mobile (390x844).

## Brand system

### Colors

Primary orange (the signature — warm, not neon):
```
50:  #FEF5ED    (lightest whisper)
100: #FDDCB8
200: #FBBD84
300: #F9974F
400: #F47820    ← THE orange. The heartbeat.
500: #E06A10    (hover state)
600: #C45A0C
700: #A04808
800: #7C3606
900: #582604    (deepest ember)
```

Indigo / AI accent (Iris):
```
Primary: #4F46E5
Subtle:  rgba(79, 70, 229, 0.06)
```

Warm neutrals (not cold grays — these have soul):
```
Page bg:       #FAFAF8
Sidebar bg:    #F6F3F0
Card surface:  #FFFFFF
Inset:         #F3EFEC
Border subtle: #F0EDE9
Border:        #E5E1DC
Text primary:  #1A1613
Text secondary:#5C5550
Text tertiary: #767170
Text disabled: #C5C0BB
```

Dark mode (if exploring dark variants):
```
Page:          #0C0D0F
Surface:       #1A1B1E
Text primary:  rgba(255, 255, 255, 0.92)
Text secondary:rgba(255, 255, 255, 0.6)
```

### Typography

Font: **Inter** (from Google Fonts — weights 400, 500, 600, 700)
Mono: **JetBrains Mono**

The letter-spacing is slightly tight: `-0.011em` for body, `-0.02em` for headings. This is intentional — it gives everything a modern, premium compression. Like the kerning on an Apple product page.

Sizes: Display 36px, Heading 28px, Large 24px, Subtitle 18px, Body 14px, Small 13px, Label 12px

### Spatial DNA

4px base grid. Border radii: 6px (base), 8px (inputs), 12px (cards), 16px (large panels).

Shadows are barely there — flat design with just enough depth to separate layers:
- Cards: `0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.015)`
- Hover: `0 3px 12px rgba(0,0,0,0.06)`
- Brand glow: `0 4px 24px rgba(244, 120, 32, 0.25)`

Transitions: 160ms quick, 300ms smooth with `cubic-bezier(0.32, 0.72, 0, 1)` — Apple-style deceleration curves.

### Logo assets available

- `sitesync-symbol.png` — helmet icon mark (orange on transparent)
- `sitesync-symbol-white.png` — white mark (for dark backgrounds)
- `sitesync-horizontal.png` — mark + "SiteSync PM" wordmark
- `sitesync-horizontal-white.png` — white horizontal lockup
- `sitesync-stacked.png` — mark above wordmark
- `sitesync-stacked-white.png` — white stacked lockup
- The "PM" appears as a small orange badge/pill next to "SiteSync"

### What the app looks like inside

Once logged in, users see a warm off-white sidebar (252px) with navigation, a content area with metric cards and data tables, generous whitespace, and flat surfaces. It feels like Notion crossed with Linear — dense enough for power users, polished enough for executives. The Iris AI page is a ChatGPT-style conversation interface with an indigo accent. The BIM page has a full WebGL 3D model viewer.

The login page is the foyer to this world. It should promise what's inside through craft, not through showing it.

## Technical notes

- React + TypeScript + Vite
- Auth: Supabase (email/password, Google OAuth, Apple OAuth)
- Must be responsive (desktop, tablet, mobile)
- Support dark mode
- Prefer SVG/CSS for visuals over raster images
- The sign-in form needs: email input, password input, "Sign in" primary button, "Forgot password?" link, "Create account" link, Google SSO button, Apple SSO button
- Use an "or" divider between the password form and SSO buttons

## What to deliver

For each of the 4 directions:
- Desktop mockup (1440x900) — production-quality fidelity, not a wireframe
- Mobile mockup (390x844)
- 1–2 sentences on why this direction works

Make it so beautiful that a superintendent stares at it for three seconds before signing in — and those three seconds change what they expect from construction software forever.
