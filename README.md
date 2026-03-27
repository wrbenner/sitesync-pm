# SiteSync AI — Construction Operating System

> The Google of Construction Project Management. AI native, field first, beautifully simple.

## Live Demo

**[https://wrbenner.github.io/sitesync-pm/](https://wrbenner.github.io/sitesync-pm/)**

## What This Is

SiteSync AI is a frontend prototype for an AI powered construction project management platform. Built as a fully interactive React + TypeScript application, it demonstrates what the future of construction PM software looks like when AI is woven into every surface.

**21 pages** | **58+ components** | **20,000+ lines of TypeScript** | **284ms build time**

## Key Features

**Command Center** — Drag and drop widget dashboard with 8 interactive widgets including weather impact analysis, live site map, AI insights feed, cash flow chart, risk heatmap, productivity sparklines, milestone timeline, and photo feed.

**AI Native** — 20+ AI annotation data points across 8 pages. Predictive alerts on 6 pages. Full conversational AI copilot with rich content rendering. AI context panel with per page analysis.

**Field First Mobile** — Responsive layout with mobile bottom tabs. Photo annotator with 4 markup tools. Voice recorder with animated waveform and AI transcription. Auto narrative daily log with digital signature pad.

**Document Intelligence** — Drawing viewer with pan, zoom, 4 markup tools, version comparison with opacity slider, discipline layer toggles, and issue pin overlays. Smart file hub with drag and drop upload and AI categorization.

**Schedule and Budget Intelligence** — Interactive Gantt chart with dependency arrows, what if mode, and resource histogram. Clickable treemap with drill down. Animated S curve. Earned value dashboard (CPI, SPI, EAC, ETC, VAC, CV). Lookahead board with swimlanes and constraint management.

**Collaboration** — Activity feed with mentions and following. Live meeting mode with timer and AI summary. Crew management with site map and performance charts. Notification center with time grouped alerts.

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build**: Vite 8
- **State**: Zustand
- **Routing**: react-router-dom (HashRouter)
- **Animation**: Framer Motion
- **Layout**: react-grid-layout
- **Icons**: lucide-react
- **Styling**: Inline styles with design tokens

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173/sitesync-pm/](http://localhost:5173/sitesync-pm/)

## Building

```bash
npm run build
```

## Deploying to GitHub Pages

```bash
npm run deploy
```

This runs `npm run build` then publishes the `dist/` folder to the `gh-pages` branch.

## Project Structure

```
src/
  styles/theme.ts              # Design tokens
  data/mockData.ts             # Mock data for prototype
  data/aiAnnotations.ts        # AI annotation data
  stores/                      # Zustand state management
  hooks/                       # Custom hooks (useQuery, useAnimatedNumber, etc.)
  api/                         # Mock API layer
  services/                    # Offline queue service
  components/
    Primitives.tsx             # 30+ shared UI components
    Sidebar.tsx                # Navigation sidebar
    ai/                        # AI components (annotations, copilot, context panel)
    dashboard/                 # Dashboard widgets and grid
    drawings/                  # Drawing viewer and markup tools
    field/                     # Photo annotator, voice recorder
    dailylog/                  # Auto narrative, signature pad
    schedule/                  # Gantt chart, lookahead board
    budget/                    # Treemap, S curve, earned value
    shared/                    # Kanban board, conversation thread, approval chain
    layout/                    # Mobile responsive layout
    notifications/             # Notification center
    files/                     # Upload zone, document search, file preview
    export/                    # Export center
    onboarding/                # Onboarding flow
    ui/                        # Offline banner, shortcut overlay
  pages/
    Dashboard.tsx              # Command center with widget grid
    ProjectHealth.tsx          # Health score with AI analysis
    AICopilot.tsx              # Conversational AI interface
    TimeMachine.tsx            # Project history timeline scrubber
    Lookahead.tsx              # Pull planning board
    Tasks.tsx                  # Kanban task board
    Schedule.tsx               # Interactive Gantt chart
    Budget.tsx                 # Treemap, S curve, earned value
    Drawings.tsx               # Drawing sets with viewer
    RFIs.tsx                   # Request for information tracking
    Submittals.tsx             # Submittal tracking with approval chain
    FieldCapture.tsx           # Photo, voice, and text capture
    DailyLog.tsx               # Auto generated daily reports
    PunchList.tsx              # Punch list with 20+ items
    Crews.tsx                  # Crew management with site map
    Activity.tsx               # Activity feed with mentions
    Meetings.tsx               # Meeting management with live mode
    Directory.tsx              # Project directory with company profiles
    Files.tsx                  # Smart document hub
    Vision.tsx                 # Product vision page
    Onboarding.tsx             # Project setup wizard
```
