# V7-11: Page-by-Page Polish — Safety, DailyLog, FieldCapture, AI Copilot, Drawings, Directory, Meetings, Files, Crews

## Goal
Complete the page-by-page polish for every remaining page. Same standard as V7-10: every pixel, every hover state, every spacing value, every animation, every empty state. 10/10 on every page.

---

## Page 1: Safety (Currently 8.5/10 → Target 10/10)

### Fixes Required

**1. Safety Score Hero:**
- Large circular score gauge at top center (120px diameter)
- Score number inside: `display` size (36px), `bold`, color by score (green >90, amber 70-90, red <70)
- Ring: Animated fill on page load, `duration.slow` (500ms)
- Below ring: "Safety Score" label, trend indicator

**2. Tab Navigation:**
- Tabs: Overview, Observations, Incidents, Toolbox Talks, Training
- Apply V7-05 TabBar with sliding indicator
- Each tab shows a count badge

**3. Observations Table:**
- Columns: Date, Observer, Location, Type (Positive/Hazard), Category, Severity, Status
- Type column: Green pill for "Positive", Red pill for "Hazard"
- Severity column: Color-coded dot (critical=red, warning=amber, info=blue)
- Photo column: Thumbnail if photo attached

**4. Incident Timeline:**
- Vertical timeline on Overview tab
- Each incident: Date, severity dot, description, outcome
- No incidents: Celebratory empty state ("Zero incidents this month!" with shield-check icon, green tint)

**5. AI Photo Analysis:**
- When viewing a safety photo: AI overlay showing detected hazards
- Bounding boxes with labels (e.g., "Missing hard hat", "Unsecured ladder")
- Confidence percentage next to each detection
- Toggle on/off

---

## Page 2: Daily Log (Currently 9/10 → Target 10/10)

### Fixes Required

**1. Calendar Navigation:**
- Horizontal date strip at top
- Each day: Day name (Mon), date number (15), colored dot (green=submitted, gray=empty, orange=draft)
- Today: Orange border, slightly larger
- Selected: Filled orange background
- Scroll: Left/right arrows, horizontal scroll with snap
- Week/Month toggle

**2. Log Sections:**
- Sections: Weather, Workforce, Equipment, Work Performed, Photos, Notes
- Each section: Collapsible card with `SectionHeader` + count indicator
- Section card: `borderRadius.xl`, `shadows.card`, `surfaceRaised`
- Section spacing: `spacing[4]` between sections

**3. Weather Card:**
- Icon (large, 48px), temp, conditions
- High/low temps
- Wind speed, precipitation
- Impact note: "Clear skies, no weather delays"
- Background: Subtle gradient based on conditions (blue for clear, gray for overcast)

**4. Workforce Summary:**
- Trade breakdown: Row per trade with company name, headcount, hours
- Total bar at bottom: `fontWeight.semibold`, `surfaceInset` background
- Trade colors: Use `tradeColors` from theme.ts
- Small bar chart visualizing headcount distribution

**5. Photo Grid:**
- Photos in masonry grid (2-3 columns)
- Each photo: `borderRadius.md`, hover: slight zoom + overlay with time/location
- Click: Lightbox with full-size photo, next/prev navigation
- Upload button: Prominent, uses V7-07 file upload zone

**6. Auto-Narrative:**
- AI-generated daily summary at top
- Styled as a quote block: left border `3px solid ${colors.indigo}`, `surfaceInset` background
- Edit button to customize before sending

**7. Signature Section:**
- Digital signature pad at bottom
- "Sign and Submit" button (primary)
- After signing: Show signature, timestamp, and submitter name
- Lock all fields after submission (read-only with subtle overlay)

---

## Page 3: Field Capture (Target 10/10)

### Fixes Required

**1. Capture Mode Selector:**
- Three large cards: Photo, Voice Note, Progress Update
- Each card: Icon (48px), title, description
- Hover: Shadow lifts, border highlights
- Click: Opens respective capture flow
- Layout: 3-column on desktop, stack on mobile

**2. Voice Capture:**
- Full-screen modal (already rated near-premium)
- Polish: Ensure waveform visualization uses theme colors
- Recording indicator: Pulsing red dot
- Transcription: Appears below waveform in real-time
- AI processing: Shows "Converting to field note..." with spinner

**3. Photo Capture:**
- Camera integration or file upload
- After capture: Annotation tools (circles, arrows, text)
- Annotation toolbar: Bottom of image, icon buttons with tooltips
- Category selector: Type of photo (progress, safety, quality, issue)
- Location auto-tag from metadata

**4. Progress Update:**
- Select area/activity from dropdown
- Percentage slider: Large, easy to use, `primaryOrange` fill
- Notes textarea
- Photo attachment optional
- Submit creates a progress entry linked to schedule

**5. Capture Timeline:**
- All captures from today in a timeline
- Each entry: Thumbnail + type icon + time + description
- Filterable by type
- Click: Expand to full detail

---

## Page 4: AI Copilot (Target 10/10)

### Fixes Required

**1. Chat Interface:**
- Clean, centered chat with max-width 720px
- Messages: Left-aligned for AI (indigo accent), right-aligned for user (orange accent)
- AI messages: `surfaceRaised` background, `borderRadius.xl`, `shadows.sm`
- User messages: `orangeSubtle` background, `borderRadius.xl`
- Spacing between messages: `spacing[4]`
- Message text: `fontSize.body`, `lineHeight.normal`
- Timestamps: Below each message cluster, `caption`, `textTertiary`

**2. Generative UI Cards:**
- AI can respond with rich cards (charts, tables, checklists, cost breakdowns)
- Each card type: Use `Card` with `borderRadius.xl`, `shadows.card`
- Cards should have a subtle left border in `colors.indigo` (3px)
- Interactive elements in cards: Standard hover/click behavior

**3. Input Area:**
- Fixed at bottom of chat
- Textarea: Auto-growing, max 4 lines before scroll
- Send button: Orange circle with arrow icon
- Suggested prompts: Row of ghost buttons above input
- "Ask about your project" placeholder in `textTertiary`
- File attachment button: Paperclip icon, left of textarea

**4. Typing Indicator:**
- When AI is thinking: Three dots that animate in sequence
- Better: Animated indigo gradient bar that pulses (more sophisticated than dots)
- Show "SiteSync AI is thinking..." in `caption`, `textTertiary`

**5. Message Actions:**
- On hover over AI message: Copy, Thumbs up, Thumbs down, Regenerate
- Small icon buttons, appear on hover
- Copy: Copies message text to clipboard, shows brief "Copied!" toast

**6. Empty Chat:**
- When no messages yet:
- Large AI icon (sparkle) centered
- "How can I help with your project?"
- 4-6 suggested prompt cards below: "What RFIs are overdue?", "Summarize today's daily log", "Show budget variance", etc.
- Cards: Outlined style, hover fills with `surfaceHover`

---

## Page 5: Drawings (Target 10/10)

### Fixes Required

**1. Drawing List:**
- Grid of drawing sets with thumbnails
- Each set: Thumbnail image, set name, sheet count, last updated
- Hover: Shadow lifts, slight zoom on thumbnail

**2. Drawing Viewer:**
- Full-width viewer with toolbar
- Toolbar: Zoom in/out, fit to screen, rotate, markup tools
- Toolbar: `surfaceRaised`, `shadows.sm`, `borderRadius.lg`, floating at top
- Pan: Click and drag, cursor changes to grab/grabbing
- Zoom: Scroll wheel or pinch, smooth animation

**3. Markup Toolbar:**
- Tools: Arrow, Rectangle, Circle, Text, Pin, Measure
- Active tool: Orange background
- Color picker: Row of 6 color circles
- Undo/Redo buttons

**4. Version Compare:**
- Side-by-side or overlay toggle
- Overlay: Slider to blend between versions
- Changed areas highlighted with red tint

---

## Page 6: Directory (Target 10/10)

### Fixes Required

**1. Company Cards:**
- Grid of company cards (2-3 per row)
- Each card: Company logo (or initials avatar), name, trade, contact count
- Hover: Card lifts per V7-01
- Click: Expand to company detail

**2. Contact List:**
- Within each company: Table of contacts
- Columns: Name (with avatar), Role, Email, Phone, Last Active
- Email/Phone: Clickable (mailto/tel links), icon on hover
- Search: Filter contacts across all companies

**3. Add Company Flow:**
- Modal form per V7-07
- Fields: Company name, trade, address, primary contact, license number
- After creation: New card appears with slide-in animation

---

## Page 7: Meetings (Target 10/10)

### Fixes Required

**1. Calendar View:**
- Monthly calendar grid
- Meeting blocks on relevant days
- Color-coded by type: OAC (orange), Safety (green), Subcontractor (blue)
- Hover: Tooltip with meeting name, time, attendees

**2. Meeting List:**
- Upcoming meetings sorted by date
- Each item: Date/time, title, attendee count, location
- Past meetings: Show "Minutes available" badge if minutes were recorded

**3. Meeting Detail:**
- Agenda items as a checklist
- Attendees list with RSVP status
- Notes/Minutes section with rich text
- Action items extracted into a task list
- "Generate Minutes" button: AI creates meeting minutes from notes

---

## Page 8: Files (Target 10/10)

### Fixes Required

**1. Folder Navigation:**
- Breadcrumb path at top
- Folder grid: Folder icons with name, item count
- File grid: File icons by type (PDF=red, DWG=blue, XLSX=green, Photo=thumbnail)

**2. File Preview:**
- Click file: Preview panel on right (or overlay)
- PDF preview: First page thumbnail
- Image preview: Full image
- Document info: Name, size, uploaded by, date, version

**3. Upload Zone:**
- Drag-and-drop zone per V7-07
- Upload progress: File list with individual progress bars
- After upload: Files appear in grid with subtle highlight animation

---

## Page 9: Crews (Target 10/10)

### Fixes Required

**1. Crew Cards:**
- Grid of crew cards
- Each card: Crew name, foreman avatar + name, trade color dot, headcount, today's assignment
- Active indicator: Green dot if crew is on-site today
- Hover: Card lifts

**2. Crew Detail:**
- Crew header: Name, foreman, trade
- Members list: Avatar + name + role + hours this week
- Assignment calendar: Week view showing daily tasks
- Production metrics: Hours logged, progress photos, efficiency

**3. Workforce Overview:**
- Top of page: Total workers on site, by trade breakdown
- Bar chart: Headcount by trade using `tradeColors`
- Trend: Week-over-week comparison

---

## Verification Checklist

- [ ] Safety: Score gauge animates on load
- [ ] Safety: Tab navigation with sliding indicator and count badges
- [ ] Safety: "Zero incidents" celebratory empty state
- [ ] DailyLog: Calendar strip with day dots and snap scrolling
- [ ] DailyLog: Weather card with condition-based gradient
- [ ] DailyLog: Photo grid with lightbox
- [ ] DailyLog: Signature pad with lock-after-submit
- [ ] FieldCapture: Three capture mode cards with hover effects
- [ ] FieldCapture: Voice waveform uses theme colors
- [ ] AI Copilot: Messages left/right aligned with accent backgrounds
- [ ] AI Copilot: Generative UI cards with indigo left border
- [ ] AI Copilot: Empty state with suggested prompts
- [ ] AI Copilot: Typing indicator animated bar
- [ ] Drawings: Viewer toolbar floating with shadow
- [ ] Drawings: Smooth pan/zoom
- [ ] Directory: Company cards with logo/initials and hover lift
- [ ] Meetings: Calendar color-coded by meeting type
- [ ] Files: File type icons color-coded
- [ ] Files: Upload zone with progress bars
- [ ] Crews: Active crew green dot indicator
- [ ] Crews: Trade colors from theme
- [ ] All pages: Skeletons, empty states, hover states, theme tokens only
