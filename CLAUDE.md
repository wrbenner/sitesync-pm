# SiteSync AI - Construction Operating System

## What This Is
This is the frontend prototype for SiteSync AI's construction project management platform. It is a React + TypeScript app built with Vite. The goal is to build the best PM tool in construction: AI native, field first, beautifully simple.

## Tech Stack
- **Framework**: React 19 + TypeScript
- **Build**: Vite
- **Routing**: react-router-dom (HashRouter)
- **Icons**: lucide-react
- **Styling**: Inline styles using design tokens from `src/styles/theme.ts`

## Brand Colors
- Primary Orange: #F47820 (all CTAs, active states, brand accent)
- Dark Navy: #0F1629 (sidebar background)
- Teal: #4EC896 (success states, positive indicators)
- Light BG: #F7F8FA (page backgrounds)
- Card BG: #FFFFFF (cards, elevated surfaces)

## Project Structure
```
src/
  styles/theme.ts          # Design tokens (colors, spacing)
  data/mockData.ts         # All mock data for the prototype
  components/
    Primitives.tsx          # Shared UI components (Dot, Tag, Btn, Card, MetricBox, etc.)
    Sidebar.tsx             # Navigation sidebar
    TopBar.tsx              # Top bar with search, weather, notifications
  pages/
    Dashboard.tsx           # Command center / home
    Drawings.tsx            # Drawing sets and plan viewer
    RFIs.tsx                # Request for Information tracking
    Submittals.tsx          # Submittal tracking
    Schedule.tsx            # Gantt chart and schedule
    Budget.tsx              # Budget and cost tracking
    DailyLog.tsx            # Daily log entries
    FieldCapture.tsx        # Mobile field capture (photo, voice, progress)
    PunchList.tsx           # Punch list items
    Crews.tsx               # Crew and personnel management
    Directory.tsx           # Project directory (companies and contacts)
    Meetings.tsx            # Meeting management
    Files.tsx               # File and document management
    AICopilot.tsx           # AI assistant chat interface
    Vision.tsx              # Product vision and strategy page
  App.tsx                   # Main app shell with routing
  main.tsx                  # Entry point
```

## Writing Rules
- NEVER use hyphens in any text content, UI copy, or comments. Use commas, periods, or restructure sentences instead.
- Keep all UI copy concise and construction industry appropriate.
- Use "field first" language: speak like a superintendent, not a software PM.

## Design Principles
1. **Google level polish**: Clean, light, lots of white space. Subtle borders, not heavy shadows.
2. **Orange is the action color**: All primary buttons, active nav states, and important numbers use #F47820.
3. **Navy sidebar**: The sidebar is always dark (#0F1629) for contrast.
4. **Status colors are consistent**: Green = good/complete, Amber = warning/pending, Red = critical/late, Blue = in progress/info.
5. **Every table row is hoverable and clickable**.
6. **Metric cards at the top of every page** with icon, value, and trend.

## Next Steps for Development
1. Replace mock data with real API calls (backend TBD)
2. Add proper state management (Zustand or React Context)
3. Implement drawing viewer with markup capabilities
4. Build real AI copilot integration (OpenAI/Anthropic API)
5. Add authentication and role based access
6. Mobile responsive design (field capture is priority)
7. Offline support with service workers
8. Real time updates with WebSockets
9. File upload and photo management
10. Calendar/scheduling integration

## Running Locally
```bash
npm install
npm run dev
```

## Building
```bash
npm run build
```
