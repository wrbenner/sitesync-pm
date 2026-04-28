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

### 🟠 MAJOR-002 — `field_session_events` returns 404 (migrations out of sync)
- **Symptom**: `GET /rest/v1/field_session_events?select=id` → HTTP 404
- **Cause confirmed**: Migration `20260427000012_field_session_events.sql` exists in the repo but hasn't been applied to the hosted Supabase project. The most recent migration in the repo is `20260428000000_extend_disciplines.sql`, so several may be missing in production too.
- **Impact**: Console noise on any route that mounts `useFieldSession` or `useFieldSuperPMF`. The hooks already try-catch and degrade gracefully (PMF returns zeros, telemetry inserts swallow), so user-visible breakage is minimal — but the noise will mask real errors during the verification crawl.
- **Action**: Run `supabase db push` from the repo root (after `supabase login` + `supabase link --project-ref hypxrmcppjfbtlwuoafc`) OR apply the missing migrations via the Supabase dashboard SQL editor.
- **Status**: 🟢 Hooks already handle the missing table. Migration sync is the user's call.

### 🟡 MINOR-001 — A11y: 4 color-contrast violations on /day or /dashboard
- **Severity**: serious (per axe-core)
- **Action**: Run axe in dev, identify the 4 elements, bump foreground/background to meet WCAG AA (4.5:1 for body, 3:1 for large text).

### 🟡 MINOR-002 — A11y: 1 scrollable-region-focusable violation
- **Severity**: serious (per axe-core)
- **Action**: Add `tabindex="0"` to the scrollable container so keyboard users can scroll it.

---

## From comprehensive crawl (2026-04-28)

### `/dashboard` — ⚠️ WARN
- **Load time**: 43.9s (heavy initial Vite compile + 22 button probes)
- **Console errors**: 3 (all `field_session_events` 404 — see MAJOR-002)
- **Network 4xx**: 3 (same root cause)
- **Layout / images**: clean
- **Buttons probed**: 22 — none crashed

[Full crawl is in progress. Additional routes will be appended here as they complete.]

---

## Verified Fixes Shipped This Run

- 🟢 **MAJOR-001 fixed in ce5b6ff** — `project_members → profiles` join split into two indexed queries in `projectService.loadMembers`, `userService.listOrganizationMembers`, `teamService.listTeamMembers`
- 🟢 **a11y reporter now logs target selectors** (main.tsx) — future runs will tell us *which* element is failing color-contrast, not just the count

---

## How to Run Verification

```bash
# With stored auth state (one-time setup, then re-run any time)
BASE_URL=http://localhost:5173/sitesync-pm/ \
  npx playwright test e2e/full-verification.spec.ts --project=chromium --reporter=list

# Outputs:
#   /tmp/verification-report.json   (structured punch list)
#   /tmp/verification-shots/        (screenshot per WARN/FAIL route)
```

Auth state lives at `e2e/.auth/state.json` (gitignored). Refresh by pasting fresh localStorage from the browser console.
