# SiteSync Drawings Page — World-Class Redesign Plan

## Executive Vision

> "Design is not just what it looks like and feels like. Design is how it works." — Steve Jobs

The Drawings page is the nerve center of SiteSync. Every superintendent, PM, and subcontractor will spend more time here than anywhere else. This plan redesigns it from the ground up with one obsession: **make a superintendent's life effortless on a jobsite**.

---

## Part 1: Deep Research Findings

### What GCs Actually Need (Ranked by Impact)

Based on research across Procore, Bluebeam, PlanGrid, Fieldwire, Togal.AI, Articulate, and direct contractor feedback:

1. **Instant access to the right sheet** — The #1 pain point is finding the correct, current drawing fast. A super on site has dirty hands, bad connectivity, and 30 seconds of patience.
2. **Crystal-clear version control** — "Is this Rev C or Rev E?" kills trust. Every revision must be visually unmistakable.
3. **Buttery-smooth plan viewing** — Pinch-zoom, pan, and navigation must feel like Apple Maps — not a clunky PDF viewer.
4. **Markup that doesn't fight you** — Pen, text, shapes, measurements — all must be one-tap away. Bluebeam sets the bar.
5. **Sheet-to-sheet hyperlinking** — Detail callouts (e.g., "See A5.01") should be clickable links, not dead text.
6. **RFI/Punch/Photo integration** — Drawings are the spatial anchor for everything. Every issue, photo, and question should live on the plan.
7. **Offline-first** — Jobsites have terrible WiFi. Drawings must work without it.
8. **AI that actually helps** — Auto-classification, change detection between revisions, and natural language search ("show me the 3rd floor mechanical plans").

### What's Wrong with the Current UI

After reading every line of the current implementation (~1,000+ lines across 8 files):

| Problem | Severity | Details |
|---------|----------|---------|
| **Inline styles everywhere** | High | 600+ inline style objects. Impossible to maintain consistent design language. |
| **Metric cards take prime real estate** | High | 4 stats cards at the top push the actual drawings below the fold. A super doesn't care about "disciplines count." |
| **340px fixed detail sidebar** | High | Wastes 25% of screen width on metadata when the user wants to SEE THE PLAN. |
| **PDF viewer is basic** | Critical | react-pdf renders page-by-page. No smooth scrolling, no minimap, no semantic zoom. Feels like 2015. |
| **Table view is the default** | Medium | Construction people think spatially. Grid with large thumbnails should be default. |
| **No drawing sets grouping** | High | A 200-page plan set shows as 200 individual rows. No hierarchy. |
| **Duplicate constants** | Medium | `DISCIPLINE_COLORS` defined in 4 separate files. |
| **Upload modal is separate from context** | Medium | Should be drag-drop anywhere, not a modal that breaks flow. |
| **No keyboard shortcuts** | Medium | Only Cmd+K for search. Power users need arrow keys, space to preview, etc. |
| **No breadcrumb navigation** | High | Once you open a drawing, there's no spatial sense of where you are in the set. |

### Competitive Landscape Teardown

| Feature | Procore | Bluebeam | PlanGrid/ACC | Fieldwire | **SiteSync (Current)** | **SiteSync (Target)** |
|---------|---------|----------|-------------|-----------|----------------------|---------------------|
| Sheet hyperlinking | ✅ Auto | ❌ Manual | ✅ Auto | ✅ Auto | ❌ | ✅ AI-powered |
| Revision overlay | ✅ | ✅ Advanced | ✅ | ❌ | ✅ Basic | ✅ Pixel-diff + slider |
| Markup tools | ✅ Basic | ✅ Best-in-class | ✅ Good | ✅ Basic | ✅ Good (Fabric.js) | ✅ Best-in-class |
| Offline support | ✅ | ❌ Desktop only | ✅ | ✅ | ❌ | ✅ Service Worker |
| AI classification | ❌ | ❌ | ❌ | ❌ | ✅ Gemini | ✅ Enhanced |
| Drawing set hierarchy | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| Natural language search | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Mobile gesture support | ✅ | ❌ | ✅ | ✅ | ⚠️ Partial | ✅ Full |
| 3D viewing | ❌ | ✅ | ❌ | ✅ New | ❌ | Phase 2 |

---

## Part 2: Design Philosophy

### Lessons from the Masters of Minimalism

Before defining our principles, we studied what works across the best document viewers and product interfaces — not just construction tools, but the products that nail the "content-first, zero-noise" experience:

**SumatraPDF — Extreme Minimalism**
Under 10MB. No ribbons, no sidebars, no popup menus. Everything subordinated to content. The lesson: *eliminate every pixel that isn't serving the user's current task*. Our viewer should feel this fast and this focused when a super opens a drawing on site.

**Apple Preview — Sane Defaults**
A masterclass in what NOT to show. Zero onboarding needed. Annotation tools hidden until you need them. Content fills the window. "Good design is as little design as possible" (Dieter Rams). Our toolbar should follow this: invisible until summoned.

**PDF Expert (Readdle) — The iPad Gold Standard**
Architects and contractors specifically call this out for speed, smoothness, and Apple Pencil experience. The UI feels "balanced and premium." Key insight: *the pen experience must feel like writing on paper, not fighting software*. Every Fabric.js interaction needs this level of fluidity.

**PDFgear — Visual Quiet**
Three themes, five background colors, zero clutter. Fulfills exactly what's needed without complications. The lesson: *don't add features, add calm*. Our viewer needs a dark mode that feels like a professional light table.

**Linear — Ruthless Information Hierarchy**
Linear's redesign reduced 98 theme variables to just 3 (base color, accent color, contrast). They cut back color dramatically — monochrome black/white with few bold accents. Not every element carries equal visual weight. Parts central to the user's task stay in focus; navigation recedes. The lesson: *discipline with color, obsession with alignment, density without noise*.

**The "Linear Design" Trend**
Clean, clutter-free, high-contrast interfaces that reduce cognitive load. Single directional eye movement. Bold typography for clarity. Glassmorphism used sparingly. Dark mode as default. The lesson: *straightforward and sequential beats clever and decorative every time*.

### The Jobs Test

Every design decision passes through these filters:

1. **Would a superintendent understand this in 5 seconds?** If not, simplify.
2. **Does this feel like it was designed for ONE person?** Not a committee.
3. **Is there anything we can remove?** The best feature is the one you don't need to explain.
4. **Does it respect the user's time?** Every click, every second of load time, every modal that breaks flow — justify it or kill it.
5. **Is this insanely great?** Not "good enough." Not "industry standard." Insanely great.

### Core Design Principles

1. **The Drawing IS the Interface** — The plan itself is the primary UI element, not a sidebar or table. Everything revolves around the plan.
2. **Progressive Disclosure** — Show the minimum. Reveal complexity on demand. A super sees sheets. A PM sees metadata. Both are served.
3. **Spatial > Tabular** — Construction people think in space, not spreadsheets. Grid view default. Thumbnails are the navigation.
4. **Zero-Friction Transitions** — Opening a drawing shouldn't feel like opening a new app. It should feel like zooming into a map.
5. **AI as Invisible Infrastructure** — AI should work silently (auto-classify, auto-link sheets, detect changes) not be a feature you "use."

### The Minimalist Manifesto (Derived from Research)

These are the specific, actionable design rules derived from studying SumatraPDF, Preview, PDF Expert, Linear, and the "linear design" trend:

1. **Color Budget:** Maximum 3 colors visible at any time — black/white/gray base + orange accent + one status color. Eliminate the rainbow of discipline colors in the current UI. Use subtle tinted backgrounds instead.
2. **Button Audit:** If a button isn't used by 80%+ of users on 80%+ of visits, it's hidden behind an overflow menu. Period.
3. **Zero Chrome in Viewer:** When viewing a drawing, the toolbar auto-hides after 3 seconds of inactivity (like video players). Tap/move mouse to reveal. The DRAWING is the UI.
4. **Typography Hierarchy:** Only 3 font sizes: 13px body, 16px emphasis, 11px caption. Sheet numbers in JetBrains Mono. Everything else in Inter. No more than 2 weights per view (regular + semibold).
5. **Spacing Grid:** 8px base unit. Everything is a multiple of 8. 8, 16, 24, 32, 48. No exceptions. This creates the "calm alignment" that Linear achieves.
6. **Transition Budget:** Maximum 200ms for any animation. Ease-out curves only. No bounce, no spring, no playful effects. Professional, precise, confident.
7. **Dark Viewer, Light List:** The drawing set browser is light mode (familiar, approachable). The viewer is dark mode (professional, reduces eye strain, makes drawings pop). This creates a clear psychological boundary between "browsing" and "working."
8. **One Action Per State:** At any given moment, there's ONE primary action. Upload button when the set is empty. View button when browsing. Markup button when viewing. Never compete for attention.

---

## Part 3: The Redesign — Component by Component

### 3.1 Page Layout: The "Plan Room" Concept

**Current:** Header → Metric Cards → Toolbar → Table/Grid + 340px Sidebar
**New:** Full-width immersive plan room with contextual panels

```
┌──────────────────────────────────────────────────────────────┐
│ ◀ Project    Drawings    [Search ⌘K]    [Filters]   [Upload] │  ← Slim top bar (48px)
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
│  │ A101│ │ A102│ │ A103│ │ A201│ │ A202│ │ S101│ │ S102│  │  ← Drawing set groups
│  │     │ │     │ │     │ │     │ │     │ │     │ │     │  │    with large thumbnails
│  │     │ │     │ │     │ │     │ │     │ │     │ │     │  │    (200px+ tall)
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘  │
│  Architectural — Floor Plans                                  │
│                                                               │
│  ┌─────┐ ┌─────┐ ┌─────┐                                    │
│  │ M101│ │ M102│ │ E101│                                     │
│  │     │ │     │ │     │     [+ Upload more drawings]        │
│  │     │ │     │ │     │                                     │
│  └─────┘ └─────┘ └─────┘                                    │
│  MEP — Mechanical & Electrical                                │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Key changes:**
- Kill the metric cards entirely. Those stats belong in a project dashboard, not the drawing room.
- Kill the fixed 340px sidebar. Detail info appears as a slide-over panel (480px) that pushes content, or a bottom sheet on mobile.
- Group drawings by discipline + plan type automatically (from AI classification).
- Large thumbnails (minimum 200px tall) so you can actually SEE the drawing before opening it.
- "Table view" becomes a secondary option via toggle, not the default.

### 3.2 The Drawing Viewer: "Infinite Canvas" Experience

This is the crown jewel. When a user opens a drawing, the experience should feel like Apple Maps meets Figma.

**Current:** Fixed modal with react-pdf page-by-page rendering.
**New:** Infinite canvas with smooth zoom from set overview → single sheet → detail level.

#### Architecture: Replace react-pdf with OpenSeadragon + DZI tiles

**Why:** react-pdf renders entire pages at a single resolution. At high zoom, it's blurry. At low zoom, it wastes memory. OpenSeadragon (used by the Smithsonian, Library of Congress, and top mapping apps) uses Deep Zoom Image (DZI) tiled rendering — the same tech behind Google Maps.

**How it works:**
1. When a PDF page is uploaded, the processing pipeline already renders it to PNG (150 DPI).
2. Add a step: render at 300 DPI and generate DZI tiles (256px squares at multiple zoom levels).
3. OpenSeadragon loads only the visible tiles at the current zoom level.
4. Result: Infinite smooth zoom from overview to reading 1/16" dimension text, with instant load.

**Implementation:**
- Use `openseadragon` (MIT license, 6K+ GitHub stars, battle-tested in museum/library/medical imaging)
- Tile generation: `sharp` or `libvips` in a Supabase Edge Function or at upload time
- Storage: tiles go to same Supabase Storage bucket under `{projectId}/drawings/tiles/{drawingId}/`
- Fallback: for drawings not yet tiled, fall back to current PNG rendering (graceful degradation)

#### Viewer Features:

| Feature | Implementation |
|---------|---------------|
| **Smooth infinite zoom** | OpenSeadragon with spring animations |
| **Minimap** | OpenSeadragon navigator plugin (shows full sheet with viewport rectangle) |
| **Sheet navigation strip** | Horizontal thumbnail strip at bottom — click to jump between sheets |
| **Semantic zoom** | At low zoom: sheet overview with title block highlighted. At medium: structural details. At high: dimensions readable. |
| **Callout hyperlinking** | AI detects "SEE DETAIL A5.01" text → renders as clickable hotspot → navigates to A5.01 |
| **Split view** | Side-by-side two sheets (e.g., arch + structural for coordination) |
| **Revision diff slider** | Juxtapose two revisions with a draggable slider (like GitHub image diff) |
| **Measurement tool** | Click two points → shows dimension with scale awareness (reads scale from title block) |
| **Pin drop** | Tap anywhere → create pin → links to RFI, punch item, or photo |
| **Quick markup** | Floating toolbar (like Figma) that appears near cursor — pen, highlight, text, cloud, arrow |
| **Keyboard shortcuts** | Space: pan mode, Z: zoom tool, M: measure, P: pin, Esc: close, ←→: prev/next sheet |
| **Dark mode** | Inverted drawing rendering for low-light fieldwork |

#### Gesture Support:
- **Pinch zoom** — Smooth, spring-animated (OpenSeadragon handles this natively)
- **Two-finger pan** — Free-form panning
- **Double-tap** — Zoom to 2x centered on tap point (or zoom to fit if already zoomed)
- **Swipe left/right** — Navigate to next/previous sheet in set
- **Long press** — Create pin at location

### 3.3 Drawing Set Organization

**Current:** Flat list of individual sheets.
**New:** Hierarchical grouping with smart organization.

```
📐 Architectural (12 sheets)
  ├─ Floor Plans
  │   A101 — 1st Floor Plan (Rev 3) ✅ Current
  │   A102 — 2nd Floor Plan (Rev 2) ✅ Current
  │   A103 — 3rd Floor Plan (Rev 2) ⚠️ For Review
  ├─ Elevations
  │   A201 — North Elevation (Rev 1)
  │   A202 — South Elevation (Rev 1)
  └─ Details
      A501 — Wall Section Details (Rev 2)

🔩 Structural (8 sheets)
  ├─ Foundation
  │   S101 — Foundation Plan (Rev 1)
  └─ Framing
      S201 — 2nd Floor Framing (Rev 1) 🔴 2 clashes detected

⚡ Electrical (6 sheets)
  ...
```

**Implementation:**
- Leverage existing AI classification data (`discipline`, `plan_type`, `floor_level`)
- Auto-group by discipline → plan_type → sheet_number
- Allow manual drag-drop reordering within groups
- Collapse/expand groups
- Show revision status badge inline
- Show discrepancy count badges

### 3.4 Search: Natural Language + Instant

**Current:** Basic text filter on title/sheet number/discipline.
**New:** AI-powered semantic search + instant fuzzy matching.

**Examples of queries that should work:**
- "3rd floor mechanical" → finds M-301, M-302
- "foundation plan" → finds S-101
- "where are the fire sprinkler details?" → finds FP-501
- "what changed in revision 3?" → shows diff of all Rev 3 sheets

**Implementation:**
- Phase 1 (Now): Enhanced fuzzy search using existing classification metadata (building_name, floor_level, plan_type, discipline). No API calls needed — pure client-side.
- Phase 2 (Next): Embed drawing descriptions with OpenAI/Gemini embeddings, store in Supabase pgvector, enable semantic search.

### 3.5 Toolbar Redesign

**Current:** Dense toolbar with search, filters, view toggle, bulk actions all in one row.
**New:** Contextual, minimal toolbar that adapts.

**Default state (nothing selected):**
```
[🔍 Search drawings... ⌘K]  [Discipline ▾]  [Status ▾]  [≡ ⊞]  [↑ Upload]
```

**With selection:**
```
[3 selected]  [✓ Approve]  [📥 Download]  [🗑 Archive]  [✕ Clear]
```

**In viewer:**
```
[← Back to Set]  [A101: 1st Floor Plan]  [Rev 3 ▾]  [🔍] [📐] [✏️] [📌] [⋯]
```

Key: only show what's relevant to the current context. Everything else is hidden.

### 3.6 Detail Panel Redesign

**Current:** Fixed 340px right sidebar with 4 tabs (Overview, Revisions, Linked, AI).
**New:** Slide-over panel (480px) that opens on demand, with a smarter layout.

**Changes:**
- Remove "AI" as a separate tab. AI data (discipline, building, floor) should be part of Overview, displayed naturally.
- "Linked" tab should show actual linked items with previews, not stubs.
- Revision timeline should be visual (vertical timeline with dots), not a table.
- Add "Activity" section showing who viewed/marked up the drawing recently.
- Quick actions at top: Open, Markup, Compare, Download, Share.

### 3.7 Upload Experience

**Current:** Modal with file picker + progress text.
**New:** Inline drag-drop with intelligent processing feedback.

**Flow:**
1. Drag files anywhere on the page → drop zone appears with spring animation
2. Files are accepted → processing begins inline (no modal)
3. A compact progress bar appears at the bottom of the page (like Gmail upload)
4. Each sheet appears in the grid AS IT'S PROCESSED (not after all are done)
5. AI classification happens in background → sheet moves to correct discipline group automatically
6. Toast notification when complete: "12 sheets uploaded and classified. 2 need review."

### 3.8 Revision Comparison: The "Wow" Feature

**Current:** Basic overlay with opacity slider.
**New:** Three comparison modes, all stunning.

1. **Slider comparison** — Drag a vertical line left/right to reveal old vs new (like GitHub image diff). The most intuitive way to see what changed.

2. **Overlay with opacity** — Keep existing but add:
   - Color-coded diff: additions in green, deletions in red
   - "Changed areas only" mode that highlights regions with differences
   - AI-generated summary: "3 walls moved, 2 doors added, dimensions updated in grid C-4"

3. **Side-by-side synchronized** — Two sheets side by side, zoom/pan is linked. Pan one, both pan. Zoom one, both zoom.

### 3.9 Real-Time Collaboration Enhancement

**Current:** Liveblocks cursor presence.
**New:** Full collaboration experience.

- Show who's viewing which sheet (avatars on thumbnails)
- Shared markup sessions with live drawing
- "@mention in markup" — tag a team member on a specific location
- Comment threads anchored to coordinates on the drawing
- "Follow mode" — one person navigates, team follows (great for coordination meetings)

### 3.10 Performance Architecture

**Target:** <100ms to open a cached drawing. <2s for first meaningful paint of a new drawing.

| Optimization | Implementation |
|-------------|---------------|
| **DZI tiling** | Only load visible tiles at current zoom level |
| **Service Worker caching** | Cache drawing tiles for offline access |
| **Virtual scrolling** | For drawing lists with 500+ sheets |
| **Thumbnail lazy loading** | IntersectionObserver, load thumbnails as they scroll into view |
| **Skeleton screens** | Show drawing card skeletons during load, not spinners |
| **Optimistic UI** | Markups appear instantly, sync in background |
| **WebGL rendering** | Use PixiJS or Three.js for markup rendering at high zoom levels |

---

## Part 4: Implementation Phases

### Phase 1: Foundation (Week 1-2) — "Make it Beautiful"
**Goal: Transform the visual experience without breaking functionality**

1. **Rip out inline styles** → Move to CSS modules or Tailwind utility classes
2. **Remove metric cards** → Move stats to a collapsible summary
3. **Default to grid view** with large thumbnails (240px)
4. **Drawing set grouping** by discipline (using existing classification data)
5. **Redesign toolbar** — contextual, minimal
6. **Redesign detail panel** — slide-over instead of fixed sidebar
7. **Add skeleton loading states** instead of spinners
8. **Add keyboard shortcuts** (arrow keys, space preview, Cmd+K search)
9. **Consolidate DISCIPLINE_COLORS** into single shared constant

### Phase 2: The Viewer (Week 2-3) — "Make it Magical"
**Goal: Best-in-class drawing viewing experience**

1. **Integrate OpenSeadragon** as the primary viewer
2. **Build DZI tile generation** in upload pipeline (Sharp/libvips)
3. **Add minimap navigator**
4. **Add sheet navigation strip** (horizontal thumbnails at bottom)
5. **Implement revision diff slider** (juxtapose mode)
6. **Redesign markup toolbar** — floating near cursor, Figma-style
7. **Improve touch gestures** — smooth pinch-zoom with momentum
8. **Add measurement tool** with scale awareness

### Phase 3: Intelligence (Week 3-4) — "Make it Smart"
**Goal: AI features that GCs have never seen**

1. **Callout hyperlinking** — AI detects "SEE A5.01" references, makes them clickable
2. **Enhanced search** — fuzzy + metadata-aware
3. **Revision change summary** — AI generates "what changed" description
4. **Auto-organization** — new uploads automatically group correctly
5. **Clash detection UI** — show clashes as pins ON the drawing, not in a sidebar

### Phase 4: Polish (Week 4) — "Make it Insanely Great"
**Goal: The details that make people say "wow"**

1. **Transition animations** — smooth zoom from grid thumbnail into full viewer
2. **Progressive loading** — low-res thumbnail → full-res tiles (like Apple Photos)
3. **Dark mode** for the viewer
4. **Offline support** via Service Worker tile caching
5. **Follow mode** for real-time collaboration
6. **Activity feed** on drawings (who viewed, who marked up)
7. **Share link** — generate a link that opens directly to a specific sheet + location

---

## Part 5: Technology Decisions

### Open Source Libraries to Adopt

| Library | Purpose | License | Why |
|---------|---------|---------|-----|
| **OpenSeadragon** | Tiled image viewer | BSD-3 | Used by Smithsonian, LOC. Battle-tested for huge images. |
| **sharp** | Server-side DZI tile generation | Apache-2.0 | Fastest Node.js image processor. |
| **Fabric.js** (keep) | Markup/annotation | MIT | Already integrated. Excellent for drawing tools. |
| **Liveblocks** (keep) | Real-time collaboration | Proprietary | Already integrated. Handles presence + cursors. |
| **Fuse.js** | Fuzzy search | Apache-2.0 | Lightweight, client-side fuzzy search for instant results. |
| **react-virtual** | Virtual scrolling | MIT | For large drawing sets (500+ sheets). |
| **framer-motion** (keep) | Animations | MIT | Already in stack. Smooth transitions. |

### Libraries to Remove

| Library | Replacement | Why |
|---------|------------|-----|
| **react-pdf** | OpenSeadragon | react-pdf renders full pages. OpenSeadragon does tiled zoom. |
| **pdfjs-dist** | Keep for PDF splitting only | Still needed for upload pipeline, not viewing. |

### API/Service Costs

| Service | Purpose | Cost | Worth It? |
|---------|---------|------|-----------|
| **Gemini 2.5 Pro** (existing) | Drawing classification | ~$0.002/page | ✅ Already using |
| **OpenAI Embeddings** (optional Phase 2) | Semantic search | ~$0.0001/query | ✅ For NL search |
| **Supabase Storage** (existing) | Tile storage | ~$0.021/GB | ✅ Already using |
| **Liveblocks** (existing) | Real-time | $0.15/MAU | ✅ Already using |

---

## Part 6: Success Metrics

How we know this redesign worked:

1. **Time to find a drawing** — Target: <5 seconds (from current ~15-20s)
2. **Drawing load time** — Target: <2s first paint, <100ms cached
3. **Markup adoption** — Target: 3x increase in markups created per user
4. **Revision confusion incidents** — Target: Zero "wrong revision" reports
5. **User satisfaction** — Target: NPS > 70 for the drawings page specifically
6. **Field adoption** — Target: 80%+ of field crew using digital vs. paper

---

## Part 7: Design Mockup Specifications

### Color Palette for Drawings Page

Use the existing SiteSync design tokens but with these specific applications:

- **Background:** `surfacePage` (not white — slight warmth)
- **Drawing cards:** `surfaceRaised` with `borderSubtle` — 12px radius, subtle shadow on hover
- **Discipline badges:** Saturated colors on light tinted backgrounds
- **Viewer background:** `#1a1a2e` (dark navy) — makes drawings pop, reduces eye strain
- **Toolbar:** Glassmorphism effect — semi-transparent with blur backdrop
- **Active states:** `primaryOrange` for selection, focus rings
- **Revision indicators:** Green (current), amber (for review), gray (superseded)

### Typography

- **Sheet numbers:** Monospace (JetBrains Mono or SF Mono) for technical clarity
- **Drawing titles:** System font, 14px medium weight
- **Discipline headers:** 12px, uppercase, letter-spacing 0.5px, tertiary color
- **Viewer toolbar:** 13px, medium weight

### Spacing & Layout

- **Grid gap:** 16px between cards
- **Card padding:** 0 (thumbnail bleeds to edges, info below)
- **Thumbnail aspect ratio:** ~1.4:1 (matches standard D-size drawing proportions)
- **Maximum content width:** None — full-width layout for maximum drawing visibility
- **Detail panel:** 480px slide-over from right, with 24px internal padding

---

This plan doesn't just match what Procore, Bluebeam, or PlanGrid offer. It leapfrogs them with AI-powered classification, semantic search, tiled infinite zoom, and a design philosophy that respects the superintendent standing on a jobsite in the sun with dirty hands and 30 seconds of patience.

The best software feels inevitable — like it couldn't have been designed any other way. That's the target.
