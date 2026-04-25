# SiteSync AI — Drawings Page Implementation Plan

**The definitive construction document intelligence platform.**
Not a general-purpose drawing editor. Not a Figma clone. The best system ever built for GCs, architects, and trades to manage, review, mark up, and extract intelligence from construction documents.

---

## 1. Product Vision

### Who this is for

Every person on a construction project who touches drawings — and the decisions those drawings drive.

**General Contractors** need to track the latest revision of every sheet, catch conflicts between disciplines before they become $200K change orders, and distribute approved sets to the field in seconds. They live in the gap between what the architect drew and what the trades are actually building.

**Architects and Engineers** need to issue revisions with confidence that the right people see the right changes, respond to RFIs with markup precision, and maintain document control across a project that might have 2,000 sheets. They care about fidelity — their drawings are legal documents.

**Trades (MEP, Structural, Civil)** need to find their sheets fast, see what changed since last week, mark up conflicts with other disciplines, and reference details from the field on a tablet. They don't have time to learn a new tool — it needs to work like looking at paper, but better.

**Owners** need to trust that the drawings they're paying for are current, that conflicts are being caught early, and that the project record is bulletproof for closeout and litigation.

### What "best in class" means for construction

The bar is not Figma or Illustrator. The bar is: *a superintendent standing in 100°F heat on an iPad can find the right sheet, see what changed, drop a pin on a conflict, and generate an RFI — in under 30 seconds.* Everything in this plan serves that moment.

The competitive landscape for construction document management (Procore, PlanGrid/Autodesk Build, Bluebeam, Fieldwire, Plangrid) has stagnated. They solved "upload and view PDFs" a decade ago. None of them have solved: real-time AI-powered cross-discipline conflict detection, semantic understanding of what's actually on a drawing, or intelligent document workflows that close the loop between drawing → RFI → change order → revised drawing. That is the gap SiteSync fills.

---

## 2. Current State Assessment

### What you've already built (and it's substantial)

SiteSync's Drawings page is not starting from zero. The current implementation (~10,200 lines across 10 files) already has:

**Document Management (strong foundation)**
- PDF upload with client-side page splitting (pdfjs-dist → PNG at 150 DPI)
- Resumable chunked upload for large files
- Grid view with discipline-grouped columns (A, S, M, E, P, C, L, I, FP)
- List view with sortable columns and inline status badges
- Full-text search, discipline filter, date range filter
- Revision linking with "supersede" workflow
- Drawing detail panel with metadata, revision history, linked issues

**Markup and Annotation (functional, needs evolution)**
- Fabric.js canvas overlay with 8 annotation tools (pen, highlighter, measure, pin, count, area, text, calibrate)
- Markup persistence to `drawing_markups` table (JSONB coordinates)
- Scale ratio extraction and real-world measurement (parseScaleRatio, formatFeetInches)
- Markup ↔ RFI/punch item linking

**AI Intelligence (genuine differentiator)**
- Gemini 2.5 Pro classification: extracts sheet number, title, building, floor, discipline, plan type, scale
- Automated drawing pairing (architectural ↔ structural by floor/section/area)
- Cross-discipline discrepancy detection (highlight-conflicts edge function)
- Revision diff generation (visual overlay comparison)
- Auto-RFI creation from detected discrepancies
- Entity extraction (walls, columns, equipment recognition)

**Infrastructure**
- Supabase: PostgreSQL tables (drawings, drawing_markups, drawing_classifications, drawing_pairs, drawing_discrepancies), Edge Functions, Storage buckets (drawings, drawing-pages, drawing-thumbnails)
- XState state machine for drawing lifecycle (draft → under_review → approved/rejected → published/archived)
- React 19 + TypeScript + Zustand + React Query
- react-pdf for viewing, pdfjs-dist for processing, Fabric.js for annotations

### Where the gaps are

| Area | Current state | Gap to world-class | Severity |
|---|---|---|---|
| **Viewing performance** | react-pdf renders full pages; no tiling | Large sheets (D-size, 36"×48") at high DPI are slow to render, pan, zoom | Critical |
| **Markup architecture** | Fabric.js canvas overlay per page | No multi-page markup sessions, no real-time collaborative markup, markup data model is flat | High |
| **Offline / field use** | No offline support | Superintendent in a basement with no signal can't access drawings | Critical |
| **Sheet set management** | Flat list with discipline grouping | No transmittal workflow, no "current set" vs "issued set" distinction, no ASI/bulletin tracking | High |
| **Comparison tools** | Basic revision diff via edge function | No overlay toggle, no slider comparison, no change-cloud highlighting | Medium |
| **Mobile / tablet** | Responsive web only | Pinch-zoom is janky, annotation tools need touch-optimized UX, no Apple Pencil support | High |
| **Search within drawings** | Text search on metadata only | Can't search for "detail 4/A3.2" and jump to that callout on the sheet | High |
| **Permissions / distribution** | Basic role gating | No per-set distribution, no "issued for construction" workflow, no controlled print | Medium |
| **Integration** | Internal RFI/punch linking | No Procore/ACC/Revit/Navisworks import, no email distribution, no BIM coordination link | Medium |
| **Annotation depth** | 8 tools, basic shapes | No cloud markup, no revision delta markup, no smart-snap to drawing elements, no stamp library | Medium |

---

## 3. Architecture Decisions

### Decision 1: Rendering Engine — Move to tiled deep-zoom

**Current:** react-pdf renders entire PDF pages as canvas elements. This works for letter-size documents but chokes on D-size construction drawings (36"×48" at 300 DPI = 10,800×14,400 pixels = 156 megapixels).

**Recommendation:** Hybrid tiled renderer.

**Server-side pipeline:**
- On upload, generate a Deep Zoom Image (DZI) pyramid for each page using `libvips` (LGPL, extremely fast, low memory)
- Tiles: 512×512 px, JPEG quality 85, 4–6 zoom levels
- Store tiles in Supabase Storage (`drawing-tiles/{drawing_id}/{page}/{level}/{col}_{row}.jpg`)
- Keep the existing PNG page export for thumbnails and AI classification

**Client-side viewer:**
- Replace react-pdf with OpenSeadragon (BSD license) for tile-based deep zoom
- OpenSeadragon handles: smooth pan/zoom, tile loading/caching, viewport culling, touch gestures, keyboard navigation
- Overlay system for annotations (OpenSeadragon supports SVG/HTML overlays natively)
- Fallback to react-pdf for single-page documents or when tiles aren't generated yet

**Why this wins:**
- D-size sheets render instantly at any zoom level (only visible tiles load)
- Memory stays flat regardless of sheet size
- Pinch-zoom on iPad becomes buttery smooth
- Annotation overlays align precisely at any zoom level
- OpenSeadragon is battle-tested (used by Library of Congress, British Museum, Stanford Libraries)

**Migration path:** Non-breaking. New uploads get tiles; existing drawings fall back to react-pdf until re-processed. A background job can backfill tiles for existing drawings.

```
Upload PDF
  → pdfjs-dist: split pages → PNG (existing)
  → libvips: generate DZI tile pyramid (new)
  → Gemini 2.5 Pro: classify page (existing)
  → Store: tiles in drawing-tiles bucket, metadata in drawings table
```

### Decision 2: Annotation Engine — Evolve Fabric.js, don't replace it

**Current:** Fabric.js canvas overlay works but is tightly coupled to individual pages and has no collaborative awareness.

**Recommendation:** Keep Fabric.js as the annotation rendering engine (it's already integrated, MIT licensed, handles the tool complexity well), but restructure the architecture around it:

**New annotation data model:**
```typescript
interface Annotation {
  id: string;
  drawing_id: string;
  page_number: number;
  // Normalized coordinates (0-1 range relative to page dimensions)
  // This makes annotations resolution-independent
  geometry: {
    type: 'point' | 'line' | 'rect' | 'polygon' | 'polyline' | 'path' | 'text' | 'cloud' | 'stamp';
    // All coordinates in normalized [0,1] space
    points: Array<{ x: number; y: number }>;
    // For freehand paths, store control points
    pathData?: string;
  };
  style: {
    strokeColor: string;
    fillColor?: string;
    strokeWidth: number; // in normalized units
    opacity: number;
    fontSize?: number;
    fontFamily?: string;
  };
  // Metadata
  author_id: string;
  author_name: string;
  created_at: string;
  updated_at: string;
  // Links
  linked_rfi_id?: string;
  linked_punch_item_id?: string;
  linked_submittal_id?: string;
  // Content
  text?: string;
  stamp_type?: 'approved' | 'rejected' | 'revise_resubmit' | 'reviewed' | 'void' | 'not_for_construction' | 'preliminary';
  // Measurement (for measure/calibrate tools)
  measurement?: {
    value: number;
    unit: 'ft' | 'in' | 'ft-in' | 'm' | 'mm';
    scale_ratio: number;
  };
  // Collaboration
  layer: 'default' | 'review' | 'field' | 'coordination';
  visibility: 'private' | 'team' | 'all';
  status: 'active' | 'resolved' | 'archived';
}
```

**Key changes from current:**
- Normalized coordinates (0–1) instead of pixel coordinates → annotations survive re-renders at any resolution
- Typed geometry instead of raw Fabric.js JSON → portable, queryable, version-safe
- Layer system → separate markup contexts (review markup vs field markup vs coordination markup)
- Visibility controls → private sketches vs team-shared vs published
- Stamp tool → construction-specific approval stamps (APPROVED, REVISE & RESUBMIT, NOT FOR CONSTRUCTION, etc.)

**New annotation tools to add (Phase 2):**
- **Cloud markup** — the universally recognized "revision cloud" that every architect and GC expects
- **Stamp library** — approval/rejection/review stamps with user signature and date
- **Smart dimension** — snap to drawing elements for measurement (uses AI-detected geometry)
- **Photo pin** — drop a pin linked to a site photo from the daily log
- **Comparison overlay** — toggle between current and previous revision with opacity slider

### Decision 3: Offline Architecture — Service Worker + IndexedDB

**Current:** No offline support. Drawings page requires network for everything.

**Recommendation:** Progressive offline with selective sync.

**What gets cached offline:**
- The "current set" — the latest revision of every sheet the user has viewed in the last 7 days
- All markup data for cached sheets
- The user's pending markups (created offline, synced when back online)
- Drawing metadata and classification data for the full project

**What stays online-only:**
- AI classification and discrepancy detection (requires server-side inference)
- Revision diff generation
- Full-resolution tile pyramids for sheets not in the current set
- Upload and processing of new drawings

**Technical approach:**
```
Service Worker (Workbox)
  → Cache Strategy: StaleWhileRevalidate for tiles and metadata
  → Precache: current set tiles (up to configurable limit, default 500MB)
  → Background sync: queue offline markups for upload on reconnect

IndexedDB (Dexie.js wrapper)
  → drawings table: metadata + classification for all project drawings
  → annotations table: all markups for cached drawings
  → pending_sync table: offline-created markups awaiting upload
  → tile_cache table: blob references for cached tile images

Sync Protocol:
  → On app load: fetch drawing list delta (last_modified > last_sync)
  → On sheet view: prefetch adjacent tiles and next 2 sheets in set
  → On reconnect: push pending_sync queue, pull remote changes, merge
  → Conflict resolution: last-write-wins for annotation edits,
    append-only for new annotations (no silent overwrite)
```

### Decision 4: Real-Time Collaboration — Supabase Realtime (not Yjs)

**Current:** No real-time collaboration on drawings.

**Recommendation:** Use Supabase Realtime (already in your stack) for presence and lightweight sync. Do NOT introduce Yjs/CRDT for drawings.

**Why not Yjs:** Construction drawing markup is not a collaborative text document. Users don't simultaneously edit the same annotation. They drop pins, draw clouds, and add stamps independently. The collaboration model is "I can see what you're doing" (presence), not "we're co-editing the same object" (CRDT). Yjs would be massive overkill and add complexity with no user benefit.

**What to build:**
- **Presence:** Show who's viewing which sheet (avatar dots on the sheet grid, cursor positions on the viewer)
- **Live markup feed:** When someone adds a markup, it appears for other viewers within 2 seconds via Supabase Realtime subscription on `drawing_markups`
- **Typing indicators:** Show when someone is writing a comment on a markup
- **Follow mode:** Click a collaborator's avatar to follow their viewport (useful during OAC meetings when architect is walking through drawings)

### Decision 5: Search — Semantic drawing search via embeddings

**Current:** Text search on drawing metadata (title, sheet number, discipline).

**Recommendation:** Two-tier search.

**Tier 1 — Structured search (immediate):**
- Full-text search on: title, sheet_number, discipline, plan_type, building_name, floor_level
- Filter by: status, discipline, date range, revision number, has_markups, has_discrepancies
- This already mostly exists — just needs polish

**Tier 2 — Semantic search (Phase 3):**
- When a drawing is classified, generate a text embedding (OpenAI text-embedding-3-small or similar) from the combined classification metadata + OCR text
- Store in `pgvector` column on `drawing_classifications`
- Enable queries like: "show me the detail for the steel connection at grid line J-4" → vector similarity search → returns the relevant detail sheet
- This is a genuine differentiator — no construction platform does this today

---

## 4. Implementation Roadmap

### Phase 1: Foundation (Weeks 1–6) — "Make the viewer world-class"

The single most important thing: the experience of looking at a drawing sheet must be flawless. Fast, smooth, precise. Everything else builds on this.

#### Sprint 1–2: Tiled Deep-Zoom Viewer

**Goal:** Replace react-pdf viewer with OpenSeadragon tiled viewer for new uploads; react-pdf fallback for existing.

| Task | File(s) | Effort | Notes |
|---|---|---|---|
| Add libvips to Supabase Edge Function for DZI generation | `supabase/functions/process-drawing-tiles/` | 3 days | New edge function; triggered after page split |
| Create `drawing-tiles` storage bucket with public CDN | Supabase dashboard + `supabase/migrations/` | 0.5 days | Bucket policy: public read, authenticated write |
| Build `DrawingViewer.tsx` component wrapping OpenSeadragon | `src/components/drawings/DrawingViewer.tsx` | 4 days | Props: drawing_id, page, annotations[], onAnnotationCreate |
| Integrate annotation overlay layer into OpenSeadragon | `src/components/drawings/AnnotationOverlay.tsx` | 3 days | SVG overlay that scales with viewport; Fabric.js for edit mode |
| Wire viewer into drawings/index.tsx replacing current PDF viewer | `src/pages/drawings/index.tsx` | 2 days | Feature flag: `use_tiled_viewer` in project settings |
| Background job: backfill tiles for existing drawings | `supabase/functions/backfill-tiles/` | 1 day | Iterates drawings without tiles, invokes process-drawing-tiles |
| Add tile generation status to drawing metadata | `supabase/migrations/`, `src/types/database.ts` | 0.5 days | `tile_status: 'pending' \| 'processing' \| 'ready' \| 'failed'` |

**Acceptance criteria:**
- D-size drawing sheet (36"×48") loads in < 2 seconds on 4G connection
- Pinch-zoom on iPad is 60fps smooth from full-sheet to 1:1 pixel view
- Annotations render correctly at all zoom levels
- Existing drawings without tiles fall back to react-pdf seamlessly

#### Sprint 3–4: Annotation Architecture Upgrade

**Goal:** Migrate annotation data model to normalized coordinates with typed geometry; add cloud markup and stamps.

| Task | File(s) | Effort | Notes |
|---|---|---|---|
| Design and migrate annotation schema | `supabase/migrations/` | 1 day | New columns on drawing_markups; preserve existing JSONB data |
| Build coordinate normalization utilities | `src/lib/annotationGeometry.ts` | 1.5 days | toNormalized(), fromNormalized(), scaleToViewport() |
| Migrate existing Fabric.js tools to new data model | `src/components/drawings/AnnotationCanvas.tsx` | 3 days | Each tool serializes to typed geometry instead of raw Fabric JSON |
| Cloud markup tool | `src/components/drawings/tools/CloudTool.ts` | 2 days | Industry-standard revision cloud (arc segments along rectangle) |
| Stamp tool with construction stamps | `src/components/drawings/tools/StampTool.ts` | 2 days | APPROVED, REJECTED, REVISE & RESUBMIT, REVIEWED, VOID, NOT FOR CONSTRUCTION, PRELIMINARY; includes user name + date |
| Annotation layer system (review/field/coordination) | `src/components/drawings/AnnotationLayerPicker.tsx` | 1 day | Toggle visibility per layer; default layer based on user role |
| Annotation visibility controls (private/team/all) | Schema + UI in DrawingDetail.tsx | 1 day | Private markups only visible to creator until shared |

**Acceptance criteria:**
- All 10 annotation tools work correctly on tiled viewer at any zoom level
- Cloud markup renders as proper arc-segment revision cloud (not a wavy rectangle)
- Stamps include signer name, date, and are positioned/scaled correctly
- Existing markups migrate to new schema without data loss

#### Sprint 5–6: Sheet Set Management and Distribution

**Goal:** Add "current set" concept, transmittal workflow, and issued-for-construction tracking.

| Task | File(s) | Effort | Notes |
|---|---|---|---|
| Drawing sets data model | `supabase/migrations/` | 1 day | `drawing_sets` table: id, project_id, name, type (working/issued/record), created_at, created_by, drawings[] |
| "Current Set" view — latest revision of each sheet number | `src/pages/drawings/CurrentSetView.tsx` | 2 days | Grouped by discipline, shows only latest approved revision per sheet |
| Transmittal creation workflow | `src/pages/drawings/TransmittalCreate.tsx` | 3 days | Select sheets → add cover letter → generate PDF transmittal → email distribution list |
| ASI/Bulletin tracking | Schema + `src/pages/drawings/BulletinLog.tsx` | 2 days | Link bulletins to affected sheets; show "affected by ASI #3" badge on sheet |
| Drawing log export (PDF/Excel) | `src/lib/drawingLogExport.ts` | 1.5 days | Standard AIA G702-format drawing log with revision history |
| Issued for Construction (IFC) workflow | State machine update + UI | 1.5 days | IFC stamp on sheet set → locks revisions → creates record set |
| Per-drawing distribution tracking | Schema + `DrawingDistribution.tsx` | 1 day | Track who received which revision; "not yet distributed" warnings |

**Acceptance criteria:**
- "Current Set" shows exactly one entry per sheet number (latest approved revision)
- Transmittals generate professional PDF cover sheets with drawing list
- ASI/Bulletin badges appear on affected sheets in both grid and list views
- IFC workflow locks the set and prevents accidental revision

---

### Phase 2: Field Power (Weeks 7–12) — "Make it indispensable on the jobsite"

#### Sprint 7–8: Offline Support

**Goal:** GCs and supers can access drawings and create markups with no network connection.

| Task | File(s) | Effort | Notes |
|---|---|---|---|
| Service worker setup (Workbox) | `src/sw.ts`, `vite.config.ts` | 1.5 days | VitePWA plugin; cache shell assets + API routes |
| IndexedDB drawing cache (Dexie.js) | `src/lib/offlineDb.ts` | 2 days | Tables: drawings, annotations, tiles_meta, pending_sync |
| "Download for offline" per drawing set | `src/components/drawings/OfflineSync.tsx` | 2 days | Downloads tile pyramid + metadata + markups for selected set |
| Offline annotation creation | `src/lib/offlineAnnotations.ts` | 2 days | Create markups locally → queue in pending_sync → upload on reconnect |
| Sync engine: conflict resolution on reconnect | `src/lib/syncEngine.ts` | 3 days | Push pending, pull remote deltas, append-only merge for annotations |
| Offline indicator UI | `src/components/OfflineBanner.tsx` | 0.5 days | "Working offline — 142 sheets cached" banner; sync status |
| Storage management | `src/pages/settings/OfflineSettings.tsx` | 1 day | Cache size display, clear cache, auto-download preferences |

**Acceptance criteria:**
- With airplane mode on, user can browse cached drawings and create markups
- On reconnect, all offline markups sync within 30 seconds
- Cache size stays under configurable limit (default 500MB)
- Clear visual indication of online/offline state and sync progress

#### Sprint 9–10: Tablet-Optimized Experience

**Goal:** iPad and Android tablet experience that feels native, not "mobile web."

| Task | File(s) | Effort | Notes |
|---|---|---|---|
| Touch-optimized toolbar | `src/components/drawings/TouchToolbar.tsx` | 2 days | Floating radial menu; large touch targets (44px min); haptic feedback |
| Gesture system | `src/hooks/useDrawingGestures.ts` | 2 days | Two-finger pan, pinch zoom, three-finger undo, long-press context menu |
| Apple Pencil / stylus pressure support | `src/components/drawings/PenInputHandler.ts` | 2 days | Pointer Events with coalesced samples; pressure → stroke width; palm rejection |
| Split-view: drawing + detail panel | `src/pages/drawings/SplitView.tsx` | 1.5 days | iPad multitasking: drawing viewer left, detail/comments right |
| Quick actions on sheet | `src/components/drawings/QuickActions.tsx` | 1 day | Swipe actions on sheet cards: mark reviewed, create RFI, share |
| Performance optimization for tablet GPUs | Various | 1.5 days | Reduce tile quality on low-memory devices; throttle annotation rendering |

**Acceptance criteria:**
- On iPad Pro with Apple Pencil: pen strokes appear within 16ms (one frame)
- All annotation tools usable with finger (not just stylus)
- Two-finger navigation is indistinguishable from native app feel
- No "desktop UI crammed into mobile" — every element is touch-first when viewport < 1024px

#### Sprint 11–12: Real-Time Collaboration and Comparison Tools

**Goal:** Multiple users can view and mark up the same drawing simultaneously; revision comparison becomes visual and intuitive.

| Task | File(s) | Effort | Notes |
|---|---|---|---|
| Realtime presence on drawings | `src/hooks/useDrawingPresence.ts` | 1.5 days | Supabase Realtime channel per drawing; cursor + viewport broadcast |
| Live markup feed | `src/hooks/useRealtimeMarkups.ts` | 1 day | Subscribe to drawing_markups inserts; render new annotations in real-time |
| Collaborator avatars on viewer | `src/components/drawings/PresenceAvatars.tsx` | 1 day | Colored dots showing who's viewing; click to follow their viewport |
| Follow mode | `src/hooks/useFollowMode.ts` | 1 day | Sync viewport to another user's position (for OAC meeting walkthroughs) |
| Revision comparison: overlay slider | `src/components/drawings/RevisionSlider.tsx` | 2 days | Side-by-side or overlay with opacity slider between two revisions |
| Revision comparison: change clouds | `src/components/drawings/ChangeDetection.tsx` | 2 days | AI-detected change regions highlighted with revision clouds |
| Comparison: linked navigation | `src/components/drawings/LinkedViewers.tsx` | 1 day | Pan/zoom one revision → other follows; synchronized at same coordinates |

**Acceptance criteria:**
- When User A drops a pin, User B sees it within 2 seconds
- Follow mode accurately mirrors viewport position and zoom level
- Overlay slider smoothly transitions between revisions at any zoom level
- Change clouds correctly identify modified regions (>80% precision)

---

### Phase 3: Intelligence (Weeks 13–18) — "Make it smarter than any human reviewer"

#### Sprint 13–14: Semantic Drawing Search

**Goal:** Find any detail, note, or element across thousands of sheets by describing what you're looking for.

| Task | File(s) | Effort | Notes |
|---|---|---|---|
| OCR text extraction per drawing page | `supabase/functions/extract-drawing-text/` | 2 days | Google Cloud Vision or Tesseract on page PNGs; store in drawing_text_content table |
| Text embedding generation | `supabase/functions/embed-drawing-content/` | 1.5 days | Combine classification + OCR text → text-embedding-3-small → pgvector |
| Enable pgvector extension in Supabase | `supabase/migrations/` | 0.5 days | `CREATE EXTENSION IF NOT EXISTS vector;` |
| Semantic search API | `supabase/functions/search-drawings/` | 1.5 days | Embed query → cosine similarity on drawing_classifications.embedding → return ranked results |
| Search UI upgrade | `src/pages/drawings/DrawingToolbar.tsx` | 2 days | "Search drawings..." → shows structured results grouped by relevance with preview thumbnails |
| Jump-to-location on search result | `src/components/drawings/SearchResult.tsx` | 1.5 days | Click result → opens viewer at the specific region where the match was found |
| Detail/callout reference linking | `src/lib/drawingReferences.ts` | 2 days | Parse "SEE DETAIL 4/A3.2" → link to that specific detail on that sheet |

**Acceptance criteria:**
- "steel connection at grid J-4" returns the correct structural detail sheet
- "what changed in the kitchen layout" returns sheets with recent revisions in that area
- Detail callout references (e.g., "4/A3.2") are clickable links that navigate to the referenced sheet and detail
- Search returns results in < 1 second for projects with up to 5,000 sheets

#### Sprint 15–16: Advanced AI Analysis

**Goal:** AI catches conflicts that humans miss, before they become expensive field problems.

| Task | File(s) | Effort | Notes |
|---|---|---|---|
| Multi-discipline overlay analysis | `supabase/functions/analyze-overlay/` | 3 days | Layer arch + struct + MEP pages for same area → detect spatial conflicts |
| Code compliance checking | `supabase/functions/check-compliance/` | 3 days | Verify dimensions, clearances, accessibility requirements against extracted geometry |
| Specification cross-reference | `supabase/functions/spec-drawing-xref/` | 2 days | Link drawing callout materials to project specifications; flag mismatches |
| Automated QA checklist | `src/pages/drawings/QAChecklist.tsx` | 2 days | Auto-populated checklist: are all sections covered? missing sheets? scale consistent? |
| AI-generated drawing summary | `supabase/functions/summarize-drawing-set/` | 1.5 days | "This set includes 47 architectural sheets covering 3 buildings..." for owner reports |
| Confidence scoring and human review workflow | `src/components/drawings/AiReviewQueue.tsx` | 1.5 days | AI findings ranked by confidence; one-click approve/dismiss/create-RFI |

**Acceptance criteria:**
- MEP/structural overlay detects clashes with > 75% precision
- Code compliance flags are specific and actionable (not generic warnings)
- AI review queue surfaces top 10 findings per discipline with clear severity
- False positive rate < 25% (users trust the system, don't ignore it)

#### Sprint 17–18: Integrations and Export

**Goal:** SiteSync drawings work with the rest of the construction ecosystem, not as an island.

| Task | File(s) | Effort | Notes |
|---|---|---|---|
| Procore drawing sync | `src/lib/integrations/procore.ts` | 3 days | Two-way sync: import drawings from Procore, push markups back |
| Autodesk Build (ACC) import | `src/lib/integrations/autodesk.ts` | 3 days | Import drawing sets from ACC; map disciplines and revisions |
| BIM coordination link | `src/components/drawings/BimLink.tsx` | 2 days | Link 2D sheet regions to 3D model views (Navisworks/Revit coordination) |
| Email distribution with tracked delivery | `supabase/functions/distribute-drawings/` | 2 days | Send drawing sets via email with download tracking; receipt confirmation |
| Bluebeam Studio integration | `src/lib/integrations/bluebeam.ts` | 1.5 days | Import Bluebeam markups (.bfx); export annotations as Bluebeam-compatible |
| Print-ready PDF export | `supabase/functions/export-drawing-set/` | 1.5 days | Generate print-ready PDF with markups baked in; correct scale for plotting |

**Acceptance criteria:**
- Procore sync runs bidirectionally without duplicate drawings
- Imported Bluebeam markups render correctly in SiteSync viewer
- Print-ready PDF exports at correct scale (1/4" = 1'-0" plots correctly on 36×48 paper)
- Email distribution tracks opens and downloads per recipient

---

## 5. Technical Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT APPLICATIONS                          │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Web App      │  │  iPad App    │  │  Android Tablet App      │  │
│  │  (React 19)   │  │  (Capacitor  │  │  (Capacitor or future    │  │
│  │               │  │   or future  │  │   native)                │  │
│  │  OpenSeadragon │  │   native)   │  │                          │  │
│  │  Fabric.js    │  │              │  │                          │  │
│  │  Dexie.js     │  │              │  │                          │  │
│  │  Workbox SW   │  │              │  │                          │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                        │                 │
└─────────┼─────────────────┼────────────────────────┼─────────────────┘
          │                 │                        │
          ▼                 ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPABASE PLATFORM                           │
│                                                                     │
│  ┌─────────────────┐  ┌────────────────┐  ┌──────────────────────┐ │
│  │  Auth (GoTrue)   │  │  Realtime      │  │  Edge Functions      │ │
│  │  JWT + RLS       │  │  Presence      │  │                      │ │
│  │                  │  │  Broadcast     │  │  process-drawing-    │ │
│  │                  │  │  Postgres      │  │    tiles             │ │
│  │                  │  │  Changes       │  │  classify-drawing    │ │
│  └─────────────────┘  └────────────────┘  │  extract-drawing-    │ │
│                                            │    pairs             │ │
│  ┌─────────────────┐  ┌────────────────┐  │  highlight-conflicts │ │
│  │  PostgreSQL      │  │  Storage       │  │  generate-revision-  │ │
│  │                  │  │                │  │    diff              │ │
│  │  drawings        │  │  drawings/     │  │  extract-drawing-    │ │
│  │  drawing_markups │  │  drawing-pages/│  │    text              │ │
│  │  drawing_classif │  │  drawing-tiles/│  │  embed-drawing-      │ │
│  │  drawing_pairs   │  │  drawing-      │  │    content           │ │
│  │  drawing_discrep │  │    thumbnails/ │  │  search-drawings     │ │
│  │  drawing_sets    │  │                │  │  distribute-drawings │ │
│  │  drawing_text    │  │                │  │  export-drawing-set  │ │
│  │  transmittals    │  │                │  │                      │ │
│  │                  │  │                │  │                      │ │
│  │  pgvector ext    │  │                │  │                      │ │
│  └─────────────────┘  └────────────────┘  └──────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                              │
│                                                                     │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  Google Gemini  │  │  OpenAI      │  │  Google Cloud Vision    │ │
│  │  2.5 Pro        │  │  Embeddings  │  │  (OCR)                  │ │
│  │  (Classify,     │  │  (Semantic   │  │                         │ │
│  │   Analyze)      │  │   Search)   │  │                         │ │
│  └───────────────┘  └──────────────┘  └──────────────────────────┘ │
│                                                                     │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  Procore API   │  │  Autodesk    │  │  Email Service           │ │
│  │  (sync)        │  │  ACC API     │  │  (SendGrid/Resend)       │ │
│  └───────────────┘  └──────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### File Structure (New and Modified)

```
src/
├── components/drawings/
│   ├── DrawingViewer.tsx          # NEW — OpenSeadragon wrapper
│   ├── AnnotationOverlay.tsx      # NEW — SVG overlay for annotations
│   ├── AnnotationCanvas.tsx       # MODIFY — refactor to new data model
│   ├── TouchToolbar.tsx           # NEW — tablet-optimized floating toolbar
│   ├── PenInputHandler.ts         # NEW — stylus pressure/prediction
│   ├── PresenceAvatars.tsx        # NEW — collaborator indicators
│   ├── RevisionSlider.tsx         # NEW — overlay comparison
│   ├── ChangeDetection.tsx        # NEW — AI change cloud highlighting
│   ├── LinkedViewers.tsx          # NEW — synchronized dual viewers
│   ├── OfflineSync.tsx            # NEW — download for offline UI
│   ├── SearchResult.tsx           # NEW — semantic search result card
│   ├── QuickActions.tsx           # NEW — swipe actions for tablet
│   ├── AiReviewQueue.tsx          # NEW — AI findings review workflow
│   ├── BimLink.tsx                # NEW — 3D model coordination link
│   └── tools/
│       ├── CloudTool.ts           # NEW — revision cloud markup
│       ├── StampTool.ts           # NEW — construction approval stamps
│       ├── SmartDimension.ts      # NEW — AI-assisted measurement
│       └── PhotoPin.ts            # NEW — site photo annotation
├── pages/drawings/
│   ├── index.tsx                  # MODIFY — integrate new viewer, offline, presence
│   ├── CurrentSetView.tsx         # NEW — latest revision per sheet number
│   ├── TransmittalCreate.tsx      # NEW — transmittal generation workflow
│   ├── BulletinLog.tsx            # NEW — ASI/bulletin tracking
│   ├── SplitView.tsx              # NEW — tablet split-view layout
│   ├── QAChecklist.tsx            # NEW — AI-populated quality checklist
│   └── [existing files]           # MODIFY as needed
├── hooks/
│   ├── useDrawingGestures.ts      # NEW — touch gesture recognition
│   ├── useDrawingPresence.ts      # NEW — realtime presence
│   ├── useRealtimeMarkups.ts      # NEW — live annotation subscription
│   ├── useFollowMode.ts           # NEW — viewport sync
│   └── [existing hooks]           # MODIFY as needed
├── lib/
│   ├── annotationGeometry.ts      # NEW — coordinate normalization
│   ├── offlineDb.ts               # NEW — IndexedDB via Dexie.js
│   ├── offlineAnnotations.ts      # NEW — offline markup queue
│   ├── syncEngine.ts              # NEW — reconnect sync protocol
│   ├── drawingLogExport.ts        # NEW — PDF/Excel drawing log
│   ├── drawingReferences.ts       # NEW — detail/callout cross-linking
│   └── integrations/
│       ├── procore.ts             # NEW — Procore sync
│       ├── autodesk.ts            # NEW — ACC import
│       └── bluebeam.ts            # NEW — Bluebeam markup exchange
├── sw.ts                          # NEW — Service worker (Workbox)
└── stores/
    └── drawingStore.ts            # MODIFY — add offline state, presence state

supabase/
├── functions/
│   ├── process-drawing-tiles/     # NEW — libvips DZI generation
│   ├── backfill-tiles/            # NEW — retroactive tile generation
│   ├── extract-drawing-text/      # NEW — OCR text extraction
│   ├── embed-drawing-content/     # NEW — pgvector embedding
│   ├── search-drawings/           # NEW — semantic search
│   ├── analyze-overlay/           # NEW — multi-discipline clash detection
│   ├── check-compliance/          # NEW — code compliance verification
│   ├── spec-drawing-xref/         # NEW — spec cross-reference
│   ├── summarize-drawing-set/     # NEW — AI set summary
│   ├── distribute-drawings/       # NEW — email distribution
│   ├── export-drawing-set/        # NEW — print-ready PDF
│   └── [existing functions]
└── migrations/
    ├── YYYYMMDD_drawing_tiles.sql
    ├── YYYYMMDD_annotation_schema.sql
    ├── YYYYMMDD_drawing_sets.sql
    ├── YYYYMMDD_drawing_text.sql
    ├── YYYYMMDD_pgvector.sql
    ├── YYYYMMDD_transmittals.sql
    └── YYYYMMDD_offline_sync.sql
```

---

## 6. New Dependencies

| Package | Purpose | License | Size impact | Notes |
|---|---|---|---|---|
| `openseadragon` | Tiled deep-zoom viewer | BSD-3 | ~180KB min | Replaces react-pdf for primary viewing |
| `dexie` | IndexedDB wrapper | Apache 2.0 | ~25KB min | For offline drawing cache |
| `workbox-webpack-plugin` | Service worker tooling | MIT | Build-time only | Via vite-plugin-pwa |
| `vite-plugin-pwa` | PWA integration for Vite | MIT | Build-time only | Generates SW from config |
| `@anthropic-ai/sdk` or OpenAI SDK | Embeddings for semantic search | MIT | ~15KB min | Only if not using Supabase AI |
| `perfect-freehand` | Pressure-sensitive stroke geometry | MIT | ~8KB min | Better pen feel for stylus tools |

**Dependencies NOT recommended:**
- ~~Yjs~~ — Overkill for construction annotation collaboration
- ~~PixiJS~~ — OpenSeadragon + SVG overlays handle the rendering needs
- ~~Konva~~ — Fabric.js already integrated and working
- ~~tldraw~~ — Commercial license, wrong abstraction for document markup
- ~~Capacitor~~ — Defer native wrapper until web PWA proves insufficient

---

## 7. Database Schema Additions

```sql
-- Drawing tile metadata
ALTER TABLE drawings ADD COLUMN tile_status TEXT DEFAULT 'pending'
  CHECK (tile_status IN ('pending', 'processing', 'ready', 'failed'));
ALTER TABLE drawings ADD COLUMN tile_levels INTEGER;
ALTER TABLE drawings ADD COLUMN tile_format TEXT DEFAULT 'jpeg';

-- Drawing sets (current set, issued sets, record sets)
CREATE TABLE drawing_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  set_type TEXT NOT NULL CHECK (set_type IN ('working', 'issued', 'record', 'ifc')),
  description TEXT,
  drawing_ids UUID[] NOT NULL DEFAULT '{}',
  issued_date DATE,
  issued_by UUID REFERENCES auth.users(id),
  cover_letter TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Transmittals
CREATE TABLE transmittals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  drawing_set_id UUID REFERENCES drawing_sets(id),
  transmittal_number TEXT NOT NULL,
  subject TEXT NOT NULL,
  recipients JSONB NOT NULL DEFAULT '[]',
  cover_letter TEXT,
  drawing_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'acknowledged')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Bulletins / ASIs
CREATE TABLE drawing_bulletins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bulletin_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  affected_drawing_ids UUID[] NOT NULL DEFAULT '{}',
  issued_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- OCR text content
CREATE TABLE drawing_text_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id UUID NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  text_content TEXT NOT NULL,
  text_blocks JSONB, -- [{text, bbox: {x,y,w,h}, confidence}]
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (drawing_id, page_number)
);

-- Semantic search embeddings (pgvector)
ALTER TABLE drawing_classifications
  ADD COLUMN embedding vector(1536);

CREATE INDEX ON drawing_classifications
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enhanced annotation schema
ALTER TABLE drawing_markups ADD COLUMN geometry_type TEXT;
ALTER TABLE drawing_markups ADD COLUMN normalized_coords JSONB;
ALTER TABLE drawing_markups ADD COLUMN layer TEXT DEFAULT 'default'
  CHECK (layer IN ('default', 'review', 'field', 'coordination'));
ALTER TABLE drawing_markups ADD COLUMN visibility TEXT DEFAULT 'team'
  CHECK (visibility IN ('private', 'team', 'all'));
ALTER TABLE drawing_markups ADD COLUMN markup_status TEXT DEFAULT 'active'
  CHECK (markup_status IN ('active', 'resolved', 'archived'));
ALTER TABLE drawing_markups ADD COLUMN stamp_type TEXT;
ALTER TABLE drawing_markups ADD COLUMN linked_submittal_id UUID;
ALTER TABLE drawing_markups ADD COLUMN linked_photo_id UUID;
ALTER TABLE drawing_markups ADD COLUMN measurement_value NUMERIC;
ALTER TABLE drawing_markups ADD COLUMN measurement_unit TEXT;
ALTER TABLE drawing_markups ADD COLUMN measurement_scale NUMERIC;

-- Distribution tracking
CREATE TABLE drawing_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transmittal_id UUID REFERENCES transmittals(id),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  drawing_set_id UUID REFERENCES drawing_sets(id),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ
);
```

---

## 8. Success Metrics

### Phase 1 (Foundation) — Week 6 checkpoint

| Metric | Target | How to measure |
|---|---|---|
| Large sheet load time | < 2s on 4G (D-size drawing) | Lighthouse + field testing |
| Zoom/pan FPS on iPad | > 55 FPS sustained | Chrome DevTools Performance |
| Annotation precision | Markups align at all zoom levels (< 1px drift) | Visual regression tests |
| Cloud markup adoption | > 30% of new markups use cloud tool within 2 weeks | Analytics event tracking |

### Phase 2 (Field Power) — Week 12 checkpoint

| Metric | Target | How to measure |
|---|---|---|
| Offline cache reliability | 0 data loss across 100 offline→online cycles | Automated sync testing |
| Stylus latency (iPad) | < 16ms pointer → visible stroke | High-speed camera measurement |
| Real-time markup propagation | p95 < 2s between users | Supabase Realtime metrics |
| Tablet task completion | Field markup created in < 30 seconds | User session recording |

### Phase 3 (Intelligence) — Week 18 checkpoint

| Metric | Target | How to measure |
|---|---|---|
| Semantic search relevance | Top-3 result contains correct sheet > 80% of queries | Precision@3 evaluation set |
| Clash detection precision | > 75% true positive rate | Expert review of AI findings |
| False positive rate | < 25% | User dismiss rate on AI review queue |
| Time to find a detail | < 15s (down from ~2 min manual browsing) | User session analysis |

---

## 9. Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| libvips tile generation is too slow for large sheets | Medium | High | Profile early; fall back to server-side ImageMagick or sharp; implement async queue with status tracking |
| OpenSeadragon annotation overlay doesn't scale | Low | High | Spike in Sprint 1; if overlay perf is insufficient, use WebGL overlay with custom hit-testing |
| Offline sync conflicts cause data loss | Medium | Critical | Append-only annotation model (never overwrite); conflict queue for human resolution; automated sync tests |
| Gemini 2.5 Pro classification accuracy degrades on unusual sheet formats | Medium | Medium | Build confidence scoring; route low-confidence classifications to human review; maintain fallback rules |
| pgvector search quality is poor for construction terminology | Medium | Medium | Fine-tune embeddings with construction-specific training data; supplement with keyword search |
| iPad performance with large tile pyramids | Low | High | Progressive tile loading; limit max zoom level on low-memory devices; monitor via Web Vitals |
| Procore/ACC API rate limits block sync | Medium | Medium | Implement exponential backoff; delta sync (only changed drawings); webhook-based push where available |
| Scope creep into general-purpose drawing editor | High | High | Every feature request passes the "superintendent in 100°F heat" test — does it help them right now? |

---

## 10. Team and Hiring

### Minimum viable team for this plan

| Role | Current? | Phase needed | Responsibility |
|---|---|---|---|
| **Full-stack engineer (canvas/viewer)** | Hire | Phase 1 | OpenSeadragon integration, annotation architecture, tile pipeline |
| **Full-stack engineer (platform)** | Hire | Phase 1 | Offline/sync, drawing sets, transmittals, distribution |
| **AI/ML engineer** | Hire or contract | Phase 2–3 | Semantic search, clash detection, compliance checking |
| **Mobile/tablet engineer** | Hire | Phase 2 | Touch UX, stylus support, gesture system, tablet optimization |
| **Product designer** | Hire or contract | Phase 1 | Interaction design, annotation tool UX, tablet layouts |
| **You (founder/PM)** | Yes | All | Vision, prioritization, user testing, field validation |

### Hiring priorities

The most critical hire is the **canvas/viewer engineer.** This person needs: deep browser rendering knowledge (Canvas, WebGL, SVG trade-offs), experience with image tile systems (OpenSeadragon, Leaflet, or similar), and ideally construction tech or geospatial experience. They set the technical ceiling for the entire viewer experience.

The second hire is the **platform engineer** for offline/sync. Offline-first is genuinely hard — service workers, IndexedDB, conflict resolution, and background sync require someone who's built this before.

---

## 11. Cost Estimates

### Infrastructure (monthly, at scale milestones)

| Scale | Users | Drawings | Storage | Compute | AI Inference | Total |
|---|---|---|---|---|---|---|
| **Launch** | 50 DAU | 5K sheets | ~$50 (250GB tiles) | ~$100 (Supabase Pro) | ~$200 (classification) | **~$350/mo** |
| **Growth** | 500 DAU | 50K sheets | ~$400 (2.5TB tiles) | ~$400 (Supabase Team) | ~$1,500 (classification + search + clash) | **~$2,300/mo** |
| **Scale** | 5,000 DAU | 500K sheets | ~$3,000 (25TB tiles) | ~$2,000 (Supabase Enterprise) | ~$8,000 (full AI pipeline) | **~$13,000/mo** |

### People (annual, fully loaded)

| Phase | Headcount | Estimated annual cost |
|---|---|---|
| Phase 1 (Foundation) | 2 engineers + 0.5 designer | ~$500K |
| Phase 2 (Field Power) | 3 engineers + 0.5 designer | ~$700K |
| Phase 3 (Intelligence) | 4 engineers + 0.5 designer + 0.5 AI/ML | ~$900K |

---

## 12. What Not to Build

This is as important as what to build. The research report recommended several capabilities that are wrong for SiteSync:

| Capability from research | Why NOT to build it | What to do instead |
|---|---|---|
| **Component/symbol system** (Figma-style) | GCs don't create reusable design components — they mark up existing drawings | Focus on construction-specific stamp library |
| **Vector authoring tools** (pen tool, boolean ops) | Nobody on a construction site is creating vector art | Perfect the markup tools (cloud, measure, pin, text) |
| **Auto-layout / constraints** | This is a product design concept, not a construction need | Build sheet set management and transmittal workflows |
| **Plugin/extension API** | Too early — build the core experience first | Expose integration APIs for Procore/ACC only |
| **Native iPad app** | Capacitor/native adds massive complexity | PWA with touch-optimized UI first; native only if PWA proves insufficient |
| **Brush engine / illustration tools** | This is Procreate territory, not construction PM | Stylus support for pen markup only (not illustration) |
| **WebGPU rendering** | Premature optimization | OpenSeadragon + WebGL handles construction drawing scale |
| **Branch/merge for drawings** | Version control metaphor doesn't map to construction document control | Revision supersede workflow (which you already have) |

---

## 13. The 30-Second Test

Every feature, every sprint, every hire must pass this test:

> **A superintendent is standing on a concrete slab in July. It's 102°F. He has an iPad with one bar of signal. An architect just issued a revised foundation plan. The super needs to: (1) see what changed, (2) confirm the steel embedment depths match the structural, and (3) flag a conflict to the GC before the concrete pour tomorrow morning.**

> **Can he do that in 30 seconds with SiteSync?**

If a feature doesn't help that person in that moment, it doesn't ship in these 18 weeks.

---

*This plan was built on the foundation of SiteSync's existing 10,200-line Drawings implementation, the deep research competitive analysis, and the specific needs of GCs, architects, and trades managing construction documents. It is designed to be executed on the current React/Supabase/TypeScript stack with minimal new dependencies and maximum impact for construction professionals.*
