# Verification Punch List

Findings from end-to-end app verification. Status legend:
- 🔴 CRITICAL — runtime crash, blank page, broken core flow
- 🟠 MAJOR — feature partially broken, network failures on read paths
- 🟡 MINOR — a11y violations, console warnings, layout polish
- 🟢 FIXED — addressed in this run

---

## From console snapshot on /day or /dashboard (2026-04-28)

### 🟠 MAJOR-001 — `project_members` join to `profiles` returns 400
- **Symptom**: `GET /rest/v1/project_members?select=*,profile:profiles(*)&project_id=eq.<UUID>` → HTTP 400
- **Likely cause**: RLS policy on `profiles` doesn't allow the embedded select via FK, or the FK reference is misnamed. Supabase PostgREST 400 on a `?select=...` join is almost always RLS or schema.
- **Impact**: Anywhere that lists project members with profile data (Workforce, Crews, Directory, Settings/Team) likely shows missing names/avatars.
- **Action**: Inspect `useProjectMembers` (or similar hook) — either flatten the query or fix the RLS policy on `profiles` to allow FK-joined SELECT.

### 🟠 MAJOR-002 — `field_session_events` returns 404
- **Symptom**: `GET /rest/v1/field_session_events?select=id` → HTTP 404
- **Likely cause**: Table doesn't exist or migration wasn't applied. PostgREST 404 = "no such relation".
- **Impact**: Anything that reads field-session telemetry — likely `/field` or a polling hook.
- **Action**: Check `supabase/migrations/` for a `field_session_events` create migration. Either run it or guard the hook that queries it.

### 🟡 MINOR-001 — A11y: 4 color-contrast violations on /day or /dashboard
- **Severity**: serious (per axe-core)
- **Action**: Run axe in dev, identify the 4 elements, bump foreground/background to meet WCAG AA (4.5:1 for body, 3:1 for large text).

### 🟡 MINOR-002 — A11y: 1 scrollable-region-focusable violation
- **Severity**: serious (per axe-core)
- **Action**: Add `tabindex="0"` to the scrollable container so keyboard users can scroll it.

---

## TBD — Pending full crawl

The full verification harness lives at `e2e/full-verification.spec.ts`. It walks every authenticated route, probes safe buttons, captures broken images / 4xx / page errors / layout overflow, and writes a structured JSON report to `/tmp/verification-report.json`.

Run with stored auth state:
```
npx playwright test e2e/full-verification.spec.ts --project=chromium --reporter=list
```
(requires `e2e/.auth/state.json` from the browser's localStorage, or `POLISH_USER` + `POLISH_PASS`).
