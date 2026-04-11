# Tonight's Direction — April 12, 2026 (Night 7)

**URGENCY: DEMO-POLISH ONLY — 3 days until the April 15 demo.**

The app *must* feel alive on first load and survive the unexpected (empty data, slow network, missing keys). Anything that doesn't move the demo forward is out.

---

## What We Saw (Live App Reality)

Right now the live app is rendering as skeleton-only/blank content on both `/` and `/dashboard`.

That is demo-blocking. Even if the backend is healthy, a dashboard that never resolves into real content reads as "broken" in 2 seconds.

---

## Tonight’s Mission

### P0 (Ship Tonight)

1. **Fix the “skeleton-only” live experience.**
   - Reproduce locally with production env settings.
   - Identify whether this is:
     - auth redirect loop
     - Supabase env misconfig (URL/anon key)
     - query errors swallowed into permanent loading state
     - runtime error in a client component
   - Ensure the UI always resolves to one of:
     - real data
     - a clear empty state with seed CTA
     - a visible error state with “Retry”

2. **Dashboard must show intelligence above the fold (not just tiles).**
   - Top of `/dashboard` shows 2–3 insights referencing real entities (RFI numbers, schedule phase names, budget divisions).
   - Use `ai-insights` (rule-based, fast) as the default source.
   - If `ai-insights` fails, fall back to a deterministic “Attention Needed” summary based on existing queries.

3. **No page can white-screen in a demo.**
   - Ensure every demo-critical route has an error boundary + error fallback.
   - Ensure query failures render a state (not infinite skeleton).

### P1 (Only if P0 is complete)

4. **Copilot context everywhere (close the dead-zones).**
   - Confirm `setPageContext()` is called on *all* demo pages.
   - Add strong suggested prompts for Payment Apps, Change Orders, Punch List, Submittals.

5. **Remove demo-visible stubs.**
   - Any menu item that triggers “Feature pending configuration” must be removed or implemented.

---

## Explicit “Do Not Do” List

- No new infra.
- No new test suites.
- No CI-only platform work.
- No broad refactors.

---

## Success Criteria (Binary)

1. `/dashboard` loads into real content within 3 seconds on a cold load.
2. Above-the-fold section shows 2–3 actionable insights referencing real project entities.
3. Breaking a query (invalid `project_id`, network offline, etc.) never yields a blank screen.

---

## Notes for the Builder

- Prefer **visible, deterministic fallbacks** over cleverness.
- If a data dependency is missing, show **how to fix it** (seed button, choose project, reconnect).
- Demo audience cares about:
  - “what should I do today?”
  - “why does this matter?”
  - “will this fall apart when I click around?”
