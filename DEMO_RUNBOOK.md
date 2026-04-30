# Investor Demo Runbook

**For the demo on the day after 2026-04-30.** Click-by-click flow, fallback plans, quick-recovery moves. Read once before the demo, keep open in a second monitor.

---

## Pre-flight — 30 minutes before

| Check | How | Pass condition |
|-------|-----|----------------|
| Branch is on `feat/vision-substrate-and-polish-push` | `git branch --show-current` | matches |
| HEAD is the demo commit | `git log --oneline -1` | clean message, no WIP |
| Dev server is alive | open `http://localhost:5173/sitesync-pm/` | renders the login page |
| Auth refresh works | log out, log back in with the demo account | lands on /day |
| Demo data is seeded | `/admin/compliance` → "Seed demo data" button (Tab T-Polish) | toast: "Demo data seeded" |
| Cockpit dashboard renders | navigate to `/day` | metrics strip shows non-zero counts, Iris lane shows ≥1 chip, Needs You table has rows |
| Anthropic API key set | `echo $VITE_ANTHROPIC_API_KEY \| head -c 5` (or whatever your env var is) | non-empty |
| Production build clean | `NODE_OPTIONS="--max-old-space-size=8192" npx vite build` | exits 0, no errors in stderr |

If any check fails, stop and fix before the demo. **Do not demo on broken state.**

---

## Demo flow — click by click

### 1. The walk-in (90 seconds)

1. **Open `localhost:5173/sitesync-pm/`** — investor sees the brand login (Welcome. in serif, magic-link first)
2. **Sign in with the demo account** — magic link or password, whichever is faster
3. **Land on `/day` cockpit** — pause for two seconds and let them read it
4. **Talking points (in order, while they look):**
   - "This is the dashboard a PM sees the moment they walk in. Four numbers tell project posture: items needing them, critical items, dollars at risk, schedule activities behind."
   - "Here's the Iris lane — the AI flags one thing to start with, with explicit reasoning. Three days overdue, $42K at risk, fourteen-day schedule impact. Specific. Sourced."
   - "The right rail is the project NOW — schedule, budget, crew, weather, today's lookahead, who owes the PM what, and recent field photos. All in one glance."
   - "And the inbox is dense, sortable, keyboard-driven. j to move down, Enter to open, e to act on the AI draft."

### 2. The Iris draft moment (45 seconds — the wow)

1. **Click the "Draft" pill** on any row that has one (or click the primary chip in the Iris lane)
2. **Drawer slides in from the right** with the actual Iris-drafted text + confidence indicator + source pills
3. **Talking point:** "The AI doesn't just detect — it drafts the actual reply. The PM reviews, edits if needed, sends. AI prepares; humans approve. This is the loop."
4. **Click [Send]** — drawer closes, row vanishes from the inbox (item is dismissed)
5. **DO NOT click any other Draft pill in the same demo run** — once Send fires, that path is done. Pick a fresh row if you want to demo it again.

### 3. The deep page (60 seconds — show the depth)

1. **Click any RFI row** in the table → lands on `/rfis/[id]` detail
2. **Talking points:**
   - "This is the RFI detail. Source trail at the top — drawing reference, spec section, prior RFIs. PMs trust this for litigation."
   - "Iris draft is right here too — same loop on the deep page. Reply, send."
3. **Click "Drawings" in the sidebar** → drawing set page
4. **Talking point:** "The AI classified every sheet on import — Iris analyzed badge appears on each thumbnail. Markups + linked RFIs visible per sheet."

### 4. Owner Update — the demo finale (90 seconds)

1. **Click "Reports" in the sidebar**
2. **Click "Generate Owner Update" on the top card** — Iris-branded
3. **Modal opens** with the actual draft pre-filled — schedule status, budget, top risks, decisions needed, lookahead
4. **Talking points (slow down here):**
   - "PM clicks one button. Iris reads the project — schedule activities, budget lines, action stream — and writes the actual deliverable. Four hundred words, every section sourced."
   - "PM reviews. Edits if needed. One click, sends to the owner."
5. **Click "Generate share link"** (Tab S-OwnerPortal) — modal shows a copy-able URL
6. **Talking point:** "Or send a magic link — the owner clicks it, sees a clean branded portal scoped to their project. Audit chain captures every action with magic-link attribution."

### 5. Mobile + Super persona (45 seconds — show the breadth)

1. **Resize browser to ~390px wide** OR open on phone
2. **Talking point:** "Same data, different lens. The dashboard adapts: bottom tab bar, dense list instead of table, swipe gestures for snooze/done."
3. **(Optional) Switch demo account to a Super-role user** — Project Now panel emphasizes weather/crew/safety instead of commitments. Same skeleton, different content.

---

## Fallback plans

### "The dashboard is empty / metrics show zeros"

- The seed script didn't run, or the active project has no data
- Quick fix: navigate to `/admin/compliance`, click "Seed demo data," reload `/day`
- Backup: switch to a different demo project that's known-populated

### "Iris draft fails to generate"

- Anthropic API key not set, or rate-limited, or network blip
- Quick fix: close the drawer, click a DIFFERENT Iris pill — the failed draft is cached as "rejected"; a fresh item will retry
- Backup: skip the inline draft moment; demo Owner Update on Reports page instead (different code path)

### "Drawings page shows 403 / cross-org error"

- The projectScope regression is back. Should not happen post-`0f80121` but if it does:
- Quick fix: hard-refresh (the activeOrg context hydrates after first nav)
- Backup: skip drawings, demo Schedule instead

### "Schedule realtime crash / 'cannot add postgres_changes' error"

- Should not happen post-`f7e06ea` but if it does:
- Quick fix: the error is non-fatal; reload the page
- Backup: navigate to a different page and back

### "Cockpit a panel renders empty"

- Per-zone ErrorBoundary (commit `043ebb8`) catches it; you'll see a small "Inbox / Project status unavailable" message
- The OTHER panels keep working. Carry on with the demo and acknowledge: "we're hardened against partial failures — one panel won't kill the dashboard."

### "Browser crashes / page won't load"

- Open the second monitor
- Hit `localhost:5173/sitesync-pm/#/day` directly
- If still broken: switch to a recorded screen capture (record one before the demo, keep it as a backup video)

---

## What to NOT show

- Inspections / Reconciliation / cost-code-library pages — still have editorial residue, deprioritized
- Settings / Notifications — boring, no demo value
- Estimating / Procurement / Vendors / Contracts — not on the demo path; some are unrebuilt
- Old `/dashboard` route — the new homepage is `/day`. Do NOT show `/dashboard`.
- Cmd+K natural-language Iris queries — Phase 4, not built yet. Don't tease.

---

## Recovery commands (if something goes truly wrong)

```bash
# Roll back to last known-good demo commit (replace with your demo tag)
git reset --hard 8b95407

# Or revert just the last commit (preserves work in reflog)
git revert HEAD --no-edit

# Restart the dev server cleanly
pkill -f "vite" || true
npm run dev

# Force-clear the React Query cache (if data feels stale)
# In browser console:
window.location.reload(true)
```

---

## Order of operations during the demo

1. PM walk-in moment (cockpit overview)
2. Iris draft moment (the wow)
3. Deep page tour (RFI detail + Drawings)
4. Owner Update finale + magic link
5. Mobile / Super persona switch

**Total: 5–6 minutes of dense narrative.** Leave the last 4 minutes for Q&A — that's where investors decide.

---

## After the demo

- Save the screen recording locally
- Capture investor questions in a Linear ticket / doc
- Hard-tag the demo commit: `git tag investor-demo-$(date +%Y%m%d) HEAD`
- Resume normal development — the polish-only mandate resumes after Wave 2 merges to main per `feedback_no_new_features.md`.

You've got this. The platform is enterprise-grade and the AI moments are real. Now go close it.
