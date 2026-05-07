# Daily Log P0 — Demo Blockers (2026-05-07)

You are running unattended. Complete the task fully and create a PR.

Read first, in this order:
- docs/audits/DAILY_LOG_DEEP_DIVE_2026-05-07.md (Procore baseline + gap matrix
  + recommended sequencing)
- src/pages/daily-log/* (current SiteSync surfaces)
- src/components/dailylog/* (current sub-components)
- src/hooks/queries/daily-logs.ts + daily-log-entries.ts (data layer)

Goal: Daily Log P0 — fix the 7 demo blockers that stop Brad Cameron from
demoing the AutoDraft pipeline cleanly. ~12-16 hr. Bugatti standard.

Branch off main: dailylog/p0-demo-blockers.

P0 SCOPE — seven deliverables.

1. AutoDraft camera flow repairs (~3-4 hr)
   - Per Field Manual Part II item #10: black camera surface, geolocation
     banner, infinite spinner, capture button greyed.
   - Investigate src/components/dailylog/DailyLogCapture.tsx and the camera
     pipeline. Likely fixes:
     - Camera permission flow uses navigator.mediaDevices.getUserMedia
       correctly with explicit constraints + error UI on denial
     - Geolocation banner becomes dismissable + persists dismissal via
       localStorage
     - Capture button enabled state reflects actual stream readiness
       (not a stale loading flag)
     - Infinite spinner times out after 8s with retry CTA
   - Acceptance: Walker holds the FAB on iPad outdoors, camera surface
     renders within 2s, geolocation banner can be dismissed, capture
     button activates as soon as stream starts, capture commits to draft
     within 1s.

2. Sign-off bar (Procore-style) (~2 hr)
   - New <DailyLogSignOffBar /> component pinned to bottom of the daily
     log page (sticky footer).
   - Renders: "I, [Walker Benner], acknowledge that the information in
     this report is accurate." with a checkbox.
   - Buttons: [Complete Only] / [Complete & Distribute].
   - PermissionGate: only PM/admin can Complete & Distribute; field staff
     can Complete Only.
   - Without the checkbox checked, both buttons are disabled.
   - On Complete: writes daily_log.completed_at + completed_by + audit row.
   - On Complete & Distribute: also fires send-email to project distribution
     list (reuse the email infra from RFI P1c).
   - Acceptance: Walker fills the day, checks the acknowledgment, clicks
     Complete & Distribute; project distribution list gets an email with
     the day's report; daily_log row marked completed.

3. Calendar view with day-completion checkmarks (~3 hr)
   - Extend src/components/dailylog/CalendarNav.tsx (or create a new
     <DailyLogCalendarView />).
   - Month grid (mirror Procore exactly — see screenshot in DEEP_DIVE doc).
   - Each day shows:
     - Date number (green if completed, gray if not)
     - Green checkmark if daily_log.completed_at IS NOT NULL
     - "N approved entries" subtext (count of distinct sub-log entries
       on that day)
     - Today highlighted with subtle blue ring
   - Right rail (320px sticky):
     - "Today — [Day], [Month] [Date], [Year]"
     - "N approved entries" banner with [View Day] / [Complete Day] buttons
     - Sub-log counts per type (Manpower 7 / Delays 5 / Photos 34) — each
       clickable, drills into that sub-log for that day
   - Click a day in the grid → navigates to /daily-log?date=YYYY-MM-DD
   - Acceptance: Walker opens Calendar view; sees green checkmarks on the
     last 30 days he's completed; clicks May 5 → daily log page loads for
     May 5.

4. Inline-create row at the bottom of every sub-log table (~2 hr)
   - Replace any "+ Add" buttons that open modals with inline-create rows
     (mirror Procore exactly).
   - Each sub-log table gets a permanent extra row at the bottom with
     editable cells matching the table columns + a [Create] button on the
     right. Type → click Create → row commits.
   - Apply to: Manpower, Equipment, Material Deliveries, Visitors, Log
     Entries (Delay/Visitor/Equipment/Note categories).
   - Reuse the InlineEditField primitive from the RFI work
     (src/components/rfi/InlineEditField.tsx) where applicable.
   - Acceptance: Walker types a new manpower entry without opening a modal:
     picks company in typeahead, types 8 workers and 10 hours, clicks
     Create — row appears in the Manpower table.

5. Per-row Attach File(s) on every sub-log (~1.5 hr)
   - Add an "Attach File(s)" chip column to every sub-log row.
   - Click → opens drag-drop attachment manager (reuse
     src/components/rfi/RFIAttachmentManager.tsx — generalize to any
     entity_type).
   - Persist to a new daily_log_attachments table:
     id UUID PK,
     daily_log_id UUID REFERENCES daily_logs ON DELETE CASCADE,
     parent_kind ENUM('manpower','equipment','visitor','delivery','log_entry',
                      'inspection','accident','safety_violation','note',
                      'phone_call','dumpster','waste','scheduled_work',
                      'photo','delay'),
     parent_id UUID,
     file_url TEXT,
     filename TEXT,
     mime_type TEXT,
     size_bytes BIGINT,
     uploaded_by UUID REFERENCES auth.users,
     uploaded_at TIMESTAMPTZ DEFAULT now()
   - RLS: project members read; uploader or admin/owner can delete.
   - Acceptance: Walker attaches a delivery ticket photo to a Material
     Delivery row, attaches a safety violation photo to a Note entry; both
     persist; both visible to other project members.

6. Per-row trash icon (quick delete) (~1 hr)
   - Add a trash icon column to every sub-log row.
   - Click → confirm modal with row preview → soft-delete with audit row.
   - Reuse the soft-delete pattern from RFI Recycle Bin work.
   - PermissionGate: row creator + admin/owner can delete.
   - Acceptance: Walker creates a manpower entry by mistake, clicks trash,
     confirms, row disappears; audit log shows the deletion.

7. Geolocation banner dismissable + smart suggestion (~0.5 hr)
   - The current geolocation banner blocks the capture button. Make it:
     - Dismissable (X button, persists dismissal in localStorage per user)
     - Suggest enabling permissions inline rather than blocking the UI
     - Replace with a small icon + tooltip if dismissed
   - Acceptance: Walker dismisses the geolocation banner once; it doesn't
     reappear for 30 days; capture button is no longer blocked.

CONSTRAINTS (CLAUDE.md, hard):
- Typecheck stays at 0 errors on both tsconfig.app.json and tsconfig.node.json
- Money math via src/types/money.ts (cost code rates in Timecards / Scheduled Work)
- PermissionGate every action button
- Per-entity audit_log on every state change (per Chain Audit Prep Check 5)
- entityLabel() for entity_type renders
- <UserName /> for user_id renders
- Reduce Motion respected on all animations
- Voice linter clean on all new copy
- Tests: add or update for every new component / hook / function

ACCEPTANCE for the entire P0:
Brad Cameron's super opens the SiteSync app on his iPad outdoors, in
direct sun, wearing gloves. He:
1. Hits the FAB → camera surface renders within 2s
2. Taps capture → photo commits to draft
3. Iris auto-fills the day's narrative + manpower (already wired)
4. He inline-types two manpower additions (no modal navigation)
5. He attaches a delivery ticket photo to one of the deliveries (per-row
   attachment)
6. He deletes a manpower row he typed by mistake (trash icon)
7. He dismisses the geolocation banner (no longer blocks UI)
8. He hits Complete & Distribute at the bottom; checks the acknowledgment;
   clicks the button; project distribution list gets an email
9. He switches to Calendar view; sees today's green checkmark + 12 entries
10. He clicks May 5 from the calendar → daily log for May 5 opens

End-to-end no broken pages.

Progress receipt every ~4 hr. Final receipt:
docs/audits/DAY_X_DAILYLOG_P0_RECEIPT_<date>.md.

PR title: "Daily Log P0 — demo blockers (Bugatti)". Do NOT approve the
PR yourself.
