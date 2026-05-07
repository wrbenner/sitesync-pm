# Daily Log Deep Dive — Procore vs SiteSync (2026-05-07)

**Source:** live walkthrough of Procore RTG/Merritt Crossing Daily Log + code-level read of `src/{components,pages,hooks,lib}/dailylog/*` + migrations.
**Frame:** what does the construction industry's most-used Daily Log do, where does SiteSync match, where does it lose, where does it beat.

---

## TL;DR

Procore's Daily Log is **16 sub-logs on one scrollable page**, captured per-day, with a Calendar view that surfaces day-level completeness at a glance. Every sub-log uses the same pattern: table + inline-create row at bottom + per-row trash + section-level 3-dot menu + attachments per row.

SiteSync's Daily Log already has the differentiated bones — **AutoDraft pipeline**, **Iris narrative**, **CrewExpectedVsActual variance**, **DayComparison**, **revision history with hash-chain audit** — but it's missing the **breadth** of sub-logs (currently 5-6 vs Procore's 16) and the **calendar-completeness view**.

The right play: keep the AutoDraft / Iris / variance moat, ADD the missing sub-logs, ADD the calendar view, ADD the daily sign-off bar.

After this work: SiteSync's Daily Log is **broader than Procore's** (every sub-log they have + AutoDraft + Iris + variance) at the same UX speed.

---

## Procore Daily Log — what it actually does (live walkthrough)

### Top-level surfaces

**Three view tabs:**
- **List** — all 16 sub-logs on one scrollable page for the selected day
- **Calendar** — month grid with green checkmark + entry-count per completed day
- **Change History** — audit log of who changed what

**Top action bar:**
- Date picker with prev/next arrows + dropdown
- **Collapse All** button (collapses every sub-log section)
- **Add Filter** dropdown
- **+ Create** dropdown (probably create from a specific sub-log)
- **Export** dropdown
- **Reports** dropdown
- **Email** button (email the day's report)
- **Copy** button (copy day to another day)
- **Insights** vertical rail on the right edge

### Bottom action bar (List view)

```
[ ] I, Walker Benner, acknowledge that the information in this report is accurate.
                                              [ Complete Only ] [ Complete & Distribute ]
```

This is the **sign-off contract**. Every day must be acknowledged. Without acknowledgement, no Complete. Without Complete, no Distribute. Procore makes the daily log a **legal record of site conditions**.

### Calendar view (today's surface)

Month grid (May 2026). Each day shows:
- Number (date)
- Green checkmark if completed
- "N approved entries" subtext
- Today highlighted with blue box

Right rail: "Today — Thursday, May 7, 2026" with:
- "12 approved entries" banner with [View Day] / [Complete Day] buttons
- Manpower: 7
- Delays: 5
- Photos: (34)

Each sub-log count is clickable — drills into that sub-log for that day.

### The 16 sub-logs (left sidebar nav order)

| # | Sub-log | Columns / fields |
|---|---|---|
| 1 | **Observed Weather Conditions** | Forecast row (6 AM/9 AM/12 PM/3 PM/6 PM/9 PM with icon/desc/temp); Humidity/Precipitation/Temperature/Wind metric panels; observed entries: Time Observed *, Delay (boolean), Sky, Temperature, Calamity, Average, Precipitation, Wind, Ground/Sea, Comments |
| 2 | **Timecards** | Employee, Cost Code, Type (Regular Time / OT / etc.), Billable?, Hours *, Comments, Related Items |
| 3 | **Manpower** | Company, Workers, Hours, Total Hours (auto), Location, Comments, Attachments. Section header: "32 Workers \| 320 Total Hours" rollup |
| 4 | **Notes** | Issue? (boolean), Location, Comments, Attachments, Related Items |
| 5 | **Equipment** (LEGACY) | Equipment Name (typeahead), Hours Operating, Hours Idle, Cost Code, Location, Inspected (boolean), Inspection Time, Comments, Attachments |
| 6 | **Visitors** | Visitor (typeahead), Start *, End *, Comments, Attachments, Related Items |
| 7 | **Phone Calls** | Call From (typeahead), Call To (typeahead), Start *, End *, Comments, Attachments |
| 8 | **Inspections** | Start *, End *, Inspection Type, Inspecting Entity, Inspector Name, Location, Inspection Area, Comments, Attachments |
| 9 | **Deliveries** | Time *, Delivery From, Tracking Number, Contents, Comments, Attachments |
| 10 | **Safety Violations** | Time *, Subject, Safety Notice, Issued To, Compliance Due, Comments, Attachments |
| 11 | **Accidents** | (Walker — didn't open this one in the walk; per Procore docs: Time, Description, People Involved, Witnesses, Severity, Reported To, Treatment Required, Photos) |
| 12 | **Dumpster** | Company, # Delivered *, # Removed *, Comments, Attachments, Related Items |
| 13 | **Waste** | Time *, Material, Disposed By, Method Of Disposal, Disposal Location, Approximate Quantity (#) *, Comments, Attachments |
| 14 | **Scheduled Work** | Resource, Scheduled tasks, Showed?, Reimbursable?, Workers *, Hours *, Rate ($), Comments, Attachments. Section header: "0 Workers \| 0 Total Hours" rollup |
| 15 | **Photos** | Grid of thumbnails with pagination ("1-29 of 34") |
| 16 | **Delays** | Delay Type (enum: Owner Directive / Existing Conditions / Weather / Differing Site Conditions / etc.), Start Time, End Time, Duration (Hours), Location, Comments, Attachments. Section header: "60 Total Hours" rollup |

### Smart UX patterns Procore nails

- **Inline-create row** at the bottom of every sub-log table — type → click Create. No modal navigation.
- **Smart suggestion banners**: "1 company may be missing from this day, based on yesterday's entries." with [View] / [×]
- **Section rollups** in the section header ("32 Workers | 320 Total Hours")
- **Section-level 3-dot menu** for sub-log-specific actions
- **Per-row Attach File(s)** chip
- **Per-row trash** icon
- **Time pickers** are 11 AM / 08 (hour + minute split, fast typing)
- **Cost Code typeahead** sourced from project budget
- **Location typeahead** sourced from project locations
- **Calamity field** on weather (rare, but captures site-impact events: flood, lightning, etc.)
- **Forecast vs Observed** distinction on weather (auto-pulled forecast above; manual observed table below)
- **Calendar completeness view** — month-at-a-glance view of which days are completed

---

## SiteSync Daily Log today — what's actually built (code-level)

### Files / surfaces present

**Pages:**
- `src/pages/daily-log/index.tsx` — main daily log page
- `src/pages/daily-log/DailyLogForm.tsx` — main form
- `src/pages/daily-log/CrewHoursEntry.tsx` — crew/manpower entry
- `src/pages/daily-log/DailySummaryPage.tsx` — summary view
- `src/pages/daily-log/SignatureCapture.tsx` — sign-off
- `src/pages/daily-log/WeatherWidget.tsx` — weather display
- `src/pages/daily-log/DailyLogPDFExport.tsx` — PDF export

**Components:**
- `AutoDailyLog.tsx` — AI-driven generation
- `AutoDraftPanel.tsx` — draft management
- `AutoNarrative.tsx` — AI narrative generation
- `AutoDraftSection.tsx` — draft section UI
- `AIDailySummary.tsx` — AI summary
- `IrisDailySummaryButton.tsx` — Iris button
- `CrewExpectedVsActual.tsx` — variance tracking (UNIQUE)
- `CrewHoursSummary.tsx` — crew rollup
- `DayComparison.tsx` — compare day-to-day (UNIQUE)
- `CalendarNav.tsx` — calendar navigation
- `QuickEntry.tsx` — quick entry form
- `RevisionHistory.tsx` — audit history (Bugatti grade)
- `SignaturePad.tsx` / `SignaturePadHardened.tsx` — sign-off
- `WeatherCard.tsx` / `WeatherWidget.tsx`
- `PhotoGrid.tsx`
- `DailyLogCapture.tsx` — camera/AutoDraft capture flow
- `MobileDailyLog.tsx` — mobile surface

**Hooks / data:**
- `daily-logs.ts` — main mutations
- `daily-log-entries.ts` — entry-level mutations
- `daily-log-offline-aware-mutation.ts` — offline-aware (Bugatti)
- `useDailyLogs.ts` — query hook

**Migrations:**
- `00016_daily_log_enhancements.sql`
- `20260430130000_daily_log_drafts.sql`
- `20260501110001_daily_log_revisions.sql`

### Data model (from `DailyLogForm.tsx`)

**Tracked sub-logs today:**
- Weather (auto-pulled + manual override)
- Manpower / CrewHours (`manpowerRows`: company × headcount × hours, plus optional CrewHoursEntryType array)
- Equipment (`equipmentRows`: type × count × hours_operated)
- Material Deliveries (`materialRows`: description × quantity × po_reference × delivery_ticket)
- Visitors (`visitorRows`: name × company × purpose × time_in × time_out)
- Safety Observations (free text)
- Photos
- Generic Log Entries with categories: **Delay / Visitor / Equipment / Note (Safety/General)**

**Existing UNIQUEs vs Procore:**
- AutoDraft pipeline (camera/voice → AI draft → human approve, with drafted-actions pattern)
- Iris daily summary + Iris narrative auto-generation
- CrewExpectedVsActual variance tracking
- DayComparison (compare today vs yesterday vs same-day-last-week)
- Auto narrative ("Crew of 32 worked 320 hours on framing across 4 buildings, weather mild...")
- Revision history with hash-chain audit
- Mobile-first surface (`MobileDailyLog`)
- Drafted-actions execute-on-approval pattern
- Offline-aware mutations

---

## Side-by-side gap matrix

Severity scale: **S1 = pilot-killer / GC walks away**, **S2 = visible to GC walkthrough**, **S3 = polish before paid GA**, **S4 = nice-to-have**.

### Sub-logs SiteSync is missing entirely

| Sub-log | Procore | SiteSync | Severity | Why it matters |
|---|---|---|---|---|
| **Timecards** (per-employee × cost code × billable × hours) | ✅ | ❌ (only company-level CrewHours) | **S1** | Required for cost-coded labor reporting and certified-payroll integrations. Per-employee granularity = budget reconciliation. |
| **Notes** (separate sub-log with Issue? flag + Location) | ✅ | 🟡 partial — bundled into generic Log Entries | **S2** | Procore's "Notes" is the catch-all; SiteSync's Note category in Log Entries is similar but lacks the explicit Location field. Bring it forward. |
| **Phone Calls** | ✅ | ❌ | **S2** | RFI / direct-from-architect calls live here in Procore. Important for documentation. |
| **Inspections** (formal table — Inspector Name, Inspecting Entity, Inspection Area) | ✅ | ❌ | **S1** | OSHA / building inspector / fire marshal visits get logged here. Legal trail. |
| **Safety Violations** (Subject + Safety Notice + Issued To + Compliance Due) | ✅ | 🟡 partial — bundled into Safety Observations free text | **S1** | Compliance Due tracking is required for documenting issued violations and remediation. |
| **Accidents** (Time, Description, People Involved, Severity, Reported To, Treatment) | ✅ | ❌ | **S1** | OSHA recordable. Required incident documentation. Insurance claims. |
| **Dumpster** (# Delivered / # Removed) | ✅ | ❌ | **S3** | Site logistics tracking. Niche but Procore has it. |
| **Waste** (Material × Method × Quantity × Disposal Location) | ✅ | ❌ | **S2** | LEED / sustainability tracking + landfill diversion certification. Required on most modern projects. |
| **Scheduled Work** (Resource × scheduled task × showed × reimbursable × rate) | ✅ | ❌ | **S2** | Subcontractor reconciliation — track who was scheduled vs who showed up. |
| **Delays** (formal table with Delay Type enum) | ✅ | 🟡 partial — Delay category in Log Entries | **S1** | Schedule slip claims, change-order documentation, lost-time recovery. The Delay Type enum is critical (Owner Directive, Existing Conditions, Weather, Differing Site Conditions, Subcontractor, Unforeseen). |

### UX patterns SiteSync is missing

| Pattern | Procore | SiteSync | Severity |
|---|---|---|---|
| **Inline-create row** at the bottom of every sub-log | ✅ | ❌ (modal-based create) | **S2** |
| **Section rollups** ("32 Workers \| 320 Total Hours") | ✅ | 🟡 partial (only on Manpower) | **S2** |
| **Section-level 3-dot menu** for sub-log actions | ✅ | ❌ | **S3** |
| **Per-row Attach File(s)** on every sub-log | ✅ | ❌ (only photos overall) | **S1** |
| **Per-row trash** icon (quick delete) | ✅ | ❌ | **S2** |
| **Per-row Related Items** column | ✅ | ❌ | **S3** |
| **Calendar view** — month grid with day-completion checkmarks + entry counts | ✅ | 🟡 partial (CalendarNav exists, no completeness) | **S1** |
| **Calendar today rail** ("12 approved entries · Manpower 7 · Delays 5 · Photos 34") | ✅ | ❌ | **S2** |
| **Smart suggestion banners** ("1 company may be missing based on yesterday's entries") | ✅ | ❌ | **S2** |
| **Sign-off bar** at the bottom of the page ("I acknowledge this is accurate" + Complete Only / Complete & Distribute) | ✅ | 🟡 partial — has SignaturePad component | **S1** |
| **Email day report** button (header) | ✅ | ❌ | **S2** |
| **Copy from yesterday** | ✅ | 🟡 partial — "Same as yesterday" on Manpower only | **S2** |
| **Add Filter** multi-facet | ✅ | ❌ | **S3** |
| **Export** menu (PDF, CSV) | ✅ DailyLogPDFExport.tsx exists; no menu | 🟡 partial | **S3** |
| **Insights** rail with cross-day analytics | ✅ | ❌ | **S3** |
| **Forecast vs Observed** weather distinction (auto-pulled forecast row + observed entries table) | ✅ | 🟡 partial (only forecast/current) | **S2** |
| **Calamity field** on weather observations | ✅ | ❌ | **S3** |
| **Cost Code typeahead** on Timecards / Equipment / Scheduled Work | ✅ (linked to project budget) | 🟡 partial — only on Cost Code field where present | **S1** |
| **Hours Operating + Hours Idle** distinction on Equipment | ✅ | ❌ (only `hours_operated`) | **S2** |

### Where SiteSync ALREADY beats Procore (the moat — protect it)

| Capability | SiteSync | Procore |
|---|---|---|
| **AutoDraft pipeline** (camera/voice → AI draft → approve) | ✅ | ❌ (manual entry only) |
| **Iris daily narrative** (one-paragraph auto-summary of the day) | ✅ | ❌ |
| **CrewExpectedVsActual variance tracking** (compare scheduled crew vs actual) | ✅ | ❌ (Procore can do this externally via integrations only) |
| **DayComparison** (today vs yesterday vs same-day-last-week) | ✅ | ❌ |
| **Hash-chain audit** on every revision | ✅ (P0 invariant) | 🟡 (Change History exists but not chain-verified) |
| **Drafted-actions pattern** (Iris drafts → human approves → executor runs) | ✅ | ❌ |
| **Offline-aware mutations** (`daily-log-offline-aware-mutation.ts`) | ✅ | ❌ (Procore mobile syncs but doesn't queue mutations) |
| **Mobile-first surface** (MobileDailyLog) | ✅ | ✅ Procore Mobile too — close to parity |
| **SignaturePad** (handwritten sign-off, hardened) | ✅ | 🟡 (Procore has a checkbox; SiteSync has a wet signature) |

---

## What truly matters for the pilot demo

Brad Cameron's GC team is filling out daily logs every day. The **demo moment** for SiteSync is:

1. Super opens the app on iPad in the field
2. Holds the FAB → voice records "Crew of 32 today, framed roof on building 3, JSI pulled 4 punch items, weather mild and partly cloudy, no issues"
3. Iris drafts the entire daily log: weather pulled from API, manpower extracted from voice, photos already attached from earlier in the day, narrative auto-generated
4. Super reviews, taps a few corrections, signs with finger, hits Complete & Distribute
5. PM gets the email at HQ within 30 seconds

Procore can't do steps 2-4 in 30 seconds. They take 20+ minutes manually entering each sub-log.

**That's the wedge. The breadth-of-sub-logs work is necessary but the AutoDraft + Iris speed is the moat.**

---

## Recommended sequencing

Same shape as RFI — phases of progressively-deeper work, each landing as one PR.

### P0 — Demo blockers (12-16 hr) — what stops the demo today

1. AutoDraft camera flow black-screen / infinite-spinner / greyed-capture-button (Field Manual Part II item #10) — investigate and fix
2. Geolocation banner not dismissable
3. Sign-off bar at bottom (Procore-style "I acknowledge this is accurate") with Complete Only / Complete & Distribute buttons
4. Calendar view with day-completion checkmarks + entry counts (currently only nav, no completeness)
5. Inline-create row at the bottom of every sub-log table
6. Per-row Attach File(s) on every sub-log
7. Per-row trash icon

### P1a — Missing sub-logs, high-value (16-18 hr)

1. **Timecards** (per-employee × cost code × billable × hours) — biggest gap; cost-code typeahead linked to budget_items
2. **Inspections** (formal table)
3. **Safety Violations** (formal table with Compliance Due)
4. **Accidents** (OSHA-compliant fields)
5. **Delays** (formal table with Delay Type enum: Owner Directive / Existing Conditions / Weather / Differing Site Conditions / Subcontractor / Unforeseen)

### P1b — Missing sub-logs, lower-priority (8-10 hr)

1. **Notes** (separate sub-log with Issue? + Location)
2. **Phone Calls**
3. **Waste** (LEED tracking)
4. **Scheduled Work** (sub reconciliation)
5. **Dumpster**
6. **Equipment Hours Idle** distinction

### P2 — UX parity (10-12 hr)

1. Smart suggestion banners ("Looks like JSI usually works Tuesdays — add them?")
2. Section-level 3-dot menus
3. Email day report button
4. Copy from yesterday (extend beyond Manpower)
5. Add Filter multi-facet
6. Export menu (PDF + CSV from header)
7. Per-row Related Items column
8. Insights rail with cross-day analytics
9. Forecast vs Observed weather (auto-pulled forecast row + manual observed table)
10. Calamity field on weather

### P2b — Iris differentiators 10× (12-14 hr)

The moat. After this, no one else has anything close.

1. **Voice-to-Daily-Log full pipeline** — hold FAB → speak → Iris fills every applicable sub-log + narrative
2. **Photo-to-Daily-Log** — drop photos in, Iris infers crew sizes from people in photos, equipment types, weather, time-of-day
3. **Iris triage on inbound photos** — auto-categorize photo (progress / safety / delivery / damage) and route to right sub-log
4. **Iris weekly site report** — auto-generated weekly summary of the project, ranked by progress / risks / open items
5. **Iris anomaly detection** — flag days that deviate (crew much smaller than usual, no weather observation logged, no manpower entered)
6. **Iris narrative refinement** — voice-style customization (terse vs verbose, GC-formal vs sub-friendly)
7. **Same-day cross-project Iris insights** — for multi-project PMs, "Across your 3 projects today: 4 delays, 2 safety violations, 1 accident — here's what to look at"
8. **Auto-detection of repeat issues** — "JSI has been short-staffed 4 days in a row — flag for the sub coordinator"

### Bugatti Polish Pass (12-14 hr) — same shape as RFI

WCAG 2.1 AA, voice linter, perf budgets, mobile field-test rig, keyboard nav, audit chain validation, empty/loading/error sweep.

---

## Total scope estimate

| Phase | Hours | Cumulative |
|---|---|---|
| P0 (demo blockers) | 12-16 | 12-16 |
| P1a (high-value sub-logs) | 16-18 | 28-34 |
| P1b (lower-priority sub-logs) | 8-10 | 36-44 |
| P2 (UX parity) | 10-12 | 46-56 |
| P2b (Iris 10×) | 12-14 | 58-70 |
| Polish | 12-14 | 70-84 |

**Roughly 70-84 hours of Claude Code work to bring Daily Log from current ~6.5/10 to Bugatti-grade ≥9.5/10 with industry-leading Iris differentiators.**

Same shape as the RFI work that just landed.

---

## Next deliverable

`docs/audits/DAILY_LOG_MODULE_BUILD_SPEC_2026-05-07.md` — the full Bugatti spec for what to build, in the same style as the RFI Module Build Spec. Then the P0 prompt saved to file for Walker to paste into Claude Code.

Sources:
- [Procore Daily Log List view](https://us02.procore.com/webclients/host/companies/562949953425254/projects/562949954438548/tools/dailylog/list) — RTG/Merritt Crossing
- [Procore Daily Log Calendar view](https://us02.procore.com/webclients/host/companies/562949953425254/projects/562949954438548/tools/dailylog/calendar?date=2026-05-07) — RTG/Merritt Crossing
- SiteSync source: `src/{components,pages,hooks,lib}/dailylog/*` + `supabase/migrations/*daily*`
