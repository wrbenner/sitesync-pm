# Module Specifications

The engine reads this to know what "done" looks like for every module. Each spec describes the ideal state.

## Dashboard

The command center. A superintendent opens this at 6 AM and knows exactly what needs attention today.

Must have:
- Weather widget with 5-day forecast (from external API or mock) showing temperature, conditions, wind, precipitation probability
- Today's schedule: which trades are on site, what work is planned, any delivery windows
- Action items requiring attention: overdue RFIs, pending submittals, unsigned change orders, missing lien waivers
- Project health score: composite metric from schedule variance, budget variance, safety rate, RFI turnaround
- Recent activity feed: last 20 actions across the project (who did what, when)
- Quick capture button: one tap to start a daily log entry, take a photo, or create a punch item
- Portfolio summary (for multi-project users): cards for each active project showing health, next milestone, budget status
- AI insights panel: "3 RFIs are approaching deadline," "Concrete pour Thursday may be affected by rain," "Budget tracking 4% under on Division 09"

## RFIs

The daily workhorse. Must handle 500+ RFIs per project without friction.

List view:
- Sortable columns: Number, Subject, Status, Ball in Court, Priority, Due Date, Cost Impact, Days Open
- Status filter tabs: All, Open, Pending Response, Overdue, Closed
- Ball-in-court indicator showing who owns the next action
- Overdue highlight (red background on row)
- Bulk actions: reassign, change priority, export

Detail view:
- Full thread: question, response, back-and-forth, with timestamps and user avatars
- Reference drawings with markup (linked to specific drawing sheet and location)
- Linked submittals, change orders, and daily log entries
- Response deadline countdown
- Cost impact field (links to change order if applicable)
- Schedule impact field (links to affected activities)
- Distribution list: who was notified, who has viewed
- AI draft response button: generates a response based on specs, drawings, and similar past RFIs
- PDF export matching industry standard format

Creation:
- AI-assisted: describe the issue, AI generates the formal RFI text
- Drawing markup: circle the issue on the drawing, attach it to the RFI
- Voice to text: speak the issue on the job site, AI formats it
- Template library for common RFI types

## Submittals

Spec section tracking with full approval workflow.

List view:
- Spec section column (linked to CSI MasterFormat)
- Status: Not Started, In Preparation, Submitted, In Review, Approved, Approved as Noted, Revise and Resubmit, Rejected
- Ball-in-court: Sub, GC, Architect
- Revision number
- Lead time (days from approval to material delivery)
- Required date (when the material must be on site per schedule)

Detail view:
- Full revision history with diff between versions
- Reviewer comments and stamps
- Spec section reference with relevant spec text
- Lead time calculation: "If approved today, material arrives March 15. Required on site March 10. 5 DAYS LATE."
- Linked RFIs and change orders
- Attached files: shop drawings, product data, samples, calculations, MSDS

Submittal register:
- Master list of all required submittals derived from the spec sections
- Percent complete tracker
- Procurement schedule integration

## Change Orders

The money flow. Every dollar must be traceable from field condition to approved change.

Three-tier workflow:
1. Potential Change Order (PCO): Initial identification. Field condition, owner request, or design change. Rough cost estimate.
2. Change Order Request (COR): Formal request with subcontractor pricing, markup, schedule impact. Sent to owner for approval.
3. Change Order (CO): Approved by owner. Updates contract value, budget, and schedule.

List view:
- Number, Description, Status (Draft, Pending, Approved, Rejected), Amount, Initiated By, Date
- Filter by type: Owner-directed, Contractor-initiated, Design error, Unforeseen condition
- Running total: Approved CO value, Pending CO value, Impact on contract

Detail view:
- Originating document link (RFI, field observation, owner directive)
- Line-item cost breakdown by CSI division
- Subcontractor quotes attached
- GC markup calculation (typically 10-15% overhead + profit)
- Schedule impact (days added/removed)
- Approval signature workflow
- Full audit trail of every status change

## Budget and Financials

The CFO's dashboard. Every number must be trustworthy and traceable.

Budget overview:
- Original budget by CSI division
- Approved changes (from change orders)
- Revised budget
- Committed cost (subcontracts + POs)
- Invoiced to date
- Cost to complete (estimate)
- Projected final cost
- Variance (over/under budget per division)
- Percent complete

Financial reports:
- Job cost report by CSI division with drill-down to individual cost codes
- Cash flow chart: 13-week forecast showing inflows (billings) vs. outflows (sub payments)
- Work in Progress (WIP) report: earned revenue vs. billings, over/under-billed status
- Retainage report: held from subs, receivable from owner
- Committed cost detail: every subcontract and PO, percent invoiced

Pay Applications (AIA G702/G703):
- Schedule of values with line items matching the contract
- Percent complete per line item (editable, with validation against field progress)
- Stored materials tracking
- Retainage calculation (10% standard, adjustable)
- Previous application summary
- Current payment due calculation
- PDF export matching exact AIA G702/G703 format
- Sub pay app collection and roll-up

## Schedule

Gantt chart with real intelligence.

Must have:
- Interactive Gantt with drag-to-adjust, dependency arrows, milestone markers
- Baseline vs. actual comparison (baseline shown as gray bars behind actual)
- Critical path highlighting (red for activities on the critical path)
- Float display (how many days each activity can slip)
- 3-week look-ahead generation (filtered view of upcoming activities)
- Weather overlay (flag outdoor activities on rain/extreme weather days)
- Resource loading (labor hours per trade per week)
- Percent complete per activity
- AI prediction: "Based on current progress, concrete will finish 3 days late. Here is a recovery plan."

## Daily Log

Legally defensible documentation of every day on site.

Entry form:
- Date (auto-filled, allow backdating for missed entries)
- Weather: conditions, temperature high/low, wind speed, precipitation (auto-populated from weather API)
- Manpower: by trade/company, headcount, hours worked (table format, totals calculated)
- Equipment: pieces on site by type, hours operated
- Materials received: delivery tickets, quantities, PO reference
- Visitors: name, company, purpose, time in/out
- Safety: toolbox talk topic, observations, incidents (with separate incident form)
- Narrative: free-text description of the day's work, delays, issues
- Photos: attached with captions, location tags, timestamps

Features:
- Voice to text for narrative section
- Copy from previous day (for recurring crews and equipment)
- Photo batch upload with AI auto-captioning
- Time-stamped, immutable after submission (edit creates a new version with audit trail)
- Export to PDF matching construction industry standard format
- AI summary: generates a one-paragraph summary of the day for the PM

## Field Capture

The mobile-first quick entry for supers.

One-tap flows:
- Photo capture: take photo, AI suggests caption and category, tag location on drawing, done
- Voice note: record, AI transcribes and categorizes, creates appropriate item (punch, RFI draft, daily log note)
- Progress capture: photo + percent complete, linked to schedule activity
- QR scan: scan a location QR code, all open items for that location appear
- Crew check-in: QR or NFC for time tracking

## Punch List

Closeout and quality control.

List view:
- Location, Description, Assigned To, Priority, Status, Due Date, Photo
- Filter by location, trade, status, priority
- Bulk assign, bulk status change
- Progress bar: X of Y items complete

Item detail:
- Before/after photos
- Location pinned on drawing
- Assigned subcontractor with notification
- Two-step verification: sub marks complete, super verifies
- History: created date, assigned date, completed date, verified date

## Crews and Directory

Who is on the project and who do they work for.

Directory:
- Companies: name, trade, contract value, contact info, insurance status, license status
- People: name, role, company, phone, email, certifications, emergency contact
- Subcontractor scorecard: on-time delivery rate, quality score, safety record, RFI response time

Crew management:
- Daily crew counts by trade
- Certification tracking (OSHA 10/30, crane operator, welding certs)
- Hours tracking for T&M work

## AI Copilot

The smartest project engineer on the team.

Must know:
- All project data (schedule, budget, RFIs, submittals, daily logs, change orders)
- Construction terminology and workflows
- Industry standards and best practices

Must do:
- Answer questions: "What is the status of the curtain wall submittal?" "How much float does the electrical rough-in have?"
- Draft documents: RFI responses, daily log narratives, meeting minutes, change order descriptions
- Predict issues: "Rain forecast Thursday will impact the slab pour. Recommend rescheduling to Monday. Here are the downstream impacts."
- Surface insights: "3 RFIs from the mechanical sub in the last week. Possible coordination issue with the structural drawings in the mechanical room."
- Generate reports: "Create a weekly status update for the owner" with real data

Interface:
- Chat panel (slide-in from right, not a separate page)
- Suggested prompts based on current page context
- Inline AI buttons throughout the app (draft, summarize, analyze)
- Command palette integration (Cmd+K to ask anything)

## Files and Documents

Organized project documentation.

Folder structure:
- Auto-generated folders per project phase: Preconstruction, Construction, Closeout
- Standard subfolders: Drawings, Specs, Contracts, Insurance, Photos, Reports, Correspondence
- Version control on all documents
- Full-text search across all files

Drawings:
- Sheet index with revision tracking
- Markup tools (redline, cloud, text, measurement)
- Version comparison (overlay old vs. new revision, highlight changes)
- Linked to RFIs, submittals, and punch items by location

## Meetings

Meeting management with AI.

Features:
- Agenda builder from action items and open issues
- Attendee tracking with RSVP
- AI meeting minutes from voice recording
- Action items extracted and assigned automatically
- Minutes distributed to attendees with follow-up reminders
- Linked to calendar integration

## Backend: Authentication & User Management

The foundation. Every user, every role, every permission flows through here.

Must have:
- Supabase Auth integration with email/password, magic link, and Google OAuth
- Profile management: extends auth.users table with role, avatar, phone, company
- Role-based access control (RBAC) via project_members table with role enum (owner, admin, lead, team_member, viewer)
- RLS (Row Level Security) policies on all tables (only your projects, only accessible to your role)
- Protected route wrapper component in React (redirects to login, handles loading state)
- Auth context/store using Zustand in src/stores/authStore.ts with user, session, loading, error
- Login page with email/password tab and magic link tab, brand colors
- Signup flow: enter email, set password, create organization, invite team
- Invite flow: admin enters email, user gets magic link, completes profile, auto-joins project
- Session persistence with localStorage and automatic token refresh
- Logout clears all user state, tokens, and redirects to login
- Password reset via email link
- Multi-project support: user sees all projects they are member of, switcher in header

## Backend: Database & API Layer

The nervous system. Every query must return in milliseconds.

Must have:
- Supabase client initialized in src/lib/supabase.ts with typed Database interface (auto-generated from schema)
- Custom React hooks in src/hooks/useSupabase.ts for every entity: useRFIs, useSubmittals, useChangeOrders, usePunchList, useDailyLogs, useBudget, useSchedule, useCrew, useFiles, useNotifications, useActivityFeed
- Real-time subscriptions on tables: rfis, daily_logs, punch_list_items, notifications, activity_feed (auto-update UI when other users change data)
- Optimistic updates: instant UI feedback on mutations, rollback on error
- Cursor-based pagination on all list views (RFI list, submittal register, punch list, crew, etc.)
- Full-text search across RFIs (subject + description), submittals (spec section), punch list (description), files (filename)
- Error handling: user-friendly messages, retry logic, circuit breaker pattern on API calls
- Loading states: skeleton screens on all data-fetching components, not spinners
- Type safety: all database queries and mutations are fully typed

## Backend: AI Features (Edge Functions)

The intelligence layer. All AI calls go through Supabase Edge Functions.

Must have:
- AI Copilot: conversational assistant in chat panel, knows project context (RFIs, schedule, budget, weather, daily logs), answers questions, drafts documents
- AI RFI Drafter: takes informal description (from voice or text), generates formal RFI with spec references, linked drawings, cost/schedule impact
- AI Daily Summary: generates one-paragraph narrative of the day's activity (crew, weather, deliveries, work completed, issues)
- AI Schedule Risk: analyzes schedule activities for risk, calculates probability of delay based on weather, resource constraints, prior performance
- AI Conflict Detection: cross-references schedule vs. submittals vs. RFIs vs. weather to surface conflicts (slab pour 3 days before waterproofing, supplier out of stock on critical item, etc.)
- All AI calls routed through Supabase Edge Functions (never direct from frontend)
- Conversation memory stored in ai_conversations + ai_messages tables
- Cost tracking per conversation (for monitoring spend)
- Rate limiting: max 10 requests per minute per user per function
- Fallback responses if AI is unavailable

## Backend: File Storage & Drawings

Document management and markup.

Must have:
- Supabase Storage buckets: project-files, field-photos, avatars, exports
- Direct browser upload with progress tracking and abort capability
- Image compression on client before upload for field photos (max 1024x1024 or 500KB)
- Drawing viewer using PDF.js for PDF files with zoom, pan, navigation
- Markup/annotation layer on drawings: draw freehand, add text, draw boxes, measure tool
- Markup history: undo/redo, version history per drawing
- Save markups to drawing_markups table, linkable to RFIs and punch list items
- Version history on all uploaded files: timestamp, uploader, ability to download previous version
- File search: full-text on filename, ability to filter by type (drawing, photo, spec, contract)
- Share links: generate temporary public links to files/drawings (7-day expiry)

## Backend: Notifications & Activity Feed

Stay in the loop.

Must have:
- In-app notifications with unread count badge in header
- Real-time notification delivery via Supabase Realtime (new RFI assigned, change order approved, punch item verified, etc.)
- Activity feed showing all project actions: "John opened RFI-23," "Sarah approved Submittal 15," "Weather logged for 2026-03-15"
- Notification preferences per user: toggles for email, push, in-app for each notification type (RFI responses, submittals, change orders, daily updates, team mentions)
- Email notifications via SendGrid or Resend for critical items only (overdue RFIs, rejected submittals, approved change orders, urgent messages)
- Mention system: tag users with @name in comments, creates notification

## Backend: Integrations

Connect to the real world.

Must have:
- Weather API integration (OpenWeather or similar): auto-populate daily log with weather, surface to schedule risk, display on dashboard
- Calendar sync: Google Calendar and Outlook calendar integration to sync meetings, display on dashboard
- PDF export: RFI log report, submittal register, daily log reports, pay applications (AIA G702/G703 format)
- CSV/Excel export: budget by CSI division, schedule (for Excel Gantt), crew hours, activity feed
- Procore integration (stretch goal): sync users, pull actual cost, sync RFIs, push daily logs
- Email integration: ability to forward emails into app (create RFI or attach to existing RFI), send email summaries
