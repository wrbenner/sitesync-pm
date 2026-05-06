# MISSION CONTROL — investor demo · 2026‑05‑01 · v3 8‑moment runbook

One page. Open on phone during the meeting. Don't scroll while talking.

---

## Persona

**Sarah / Walker the Superintendent** walks in at 6:45am. **NOT the PM.**

Open with: *"It's 6:45am. Walker is the Super on a $42M build in Dallas. He opens his laptop before coffee. This is what he sees."*

---

## Pre-flight (‑30 min)

- ☐ `git describe` → `investor-demo-2026-05-01`
- ☐ `npm run dev` → `/day` renders → KPI strip non-zero, Iris ≥ 1 chip
- ☐ Sign out + sign in → lands on `/day`
- ☐ `/admin/compliance` → **Seed demo data** → toast appears
- ☐ Open one RFI → **Audit trail** → green **"Audit chain intact (N)"**
- ☐ Approve a submittal in a throwaway tab → activity-feed entry < 5s
- ☐ **`/admin/iris-ground-cache` shows ≥ 2 cached rows for the demo project (RFI #15 + #17). If empty, click `Warm cache`** and wait for both rows to populate before continuing.
- ☐ **RFI #15 → click ⊕ Ground in the world** → all three lanes (Claude / Perplexity / GPT-4o) populate within 5s; latency badge reads `3 providers · X.Xs`. If a lane is empty, re-warm the cache.
- ☐ Anthropic key set → `echo $VITE_ANTHROPIC_API_KEY`
- ☐ Backup video on USB → plays end-to-end (full clip + the standalone `iris-ground.webm` 2.5 cutout)
- ☐ Phone has Mission Control + cheat sheet

If any check fails: fix before live. Do not demo on broken state.

---

## The 8 Moments — time + key beat

| # | Moment | Time | Key beat |
|---|--------|------|----------|
| 1 | Cockpit overview (`/day`) | 60s | "DETERMINISTIC. No AI." |
| 2 | Iris draft drawer | 60s | "Fallback would catch it." |
| **2.5** | **⊕ Ground in the world (RFI #15)** | **45s** | **"Three minds. Four seconds. Grounded in code, not data."** |
| 3 | Audit drawer + verify + Sealed PDF | 50s | "Procore doesn't have this." |
| 4 | Owner Update generator | 65s | "Every section sourced." |
| 5 | Submittal approved → procurement | 60s | **[5-SEC PAUSE after click]** |
| 6 | Mobile lens | 20s | "Designed for glove on gravel." |
| 7 | Closing snapshot | 20s | "200 unread → 8 ranked, grounded, signed." |

**Total: ~6m 40s clicks (~6m 55s narration).** Leave ~2 min for Q&A. **Moment 2.5 is the headline** — if you have to drop a moment, drop 6, not 2.5.

---

## Hard rules during the demo

- Don't improvise click-paths. The script is the script.
- Don't open `/dashboard`, `/inspections`, `/reconciliation`, `/marketplace`, anything in `archive/`.
- Don't tease Cmd+K natural-language Iris (Phase 4).
- If a moment fails: skip it, don't fight it. Fallbacks live in `DEMO_RUNBOOK.md`.
- For Moment 2.5: if only 1–2 lanes populate, **acknowledge once and continue** — *"Two minds answered, the third hit a rate limit; the drawer is built so partial answers still ship."* Do NOT re-click the button mid-demo.

---

## Tagging (run at the end of the last successful rehearsal)

```bash
git tag investor-demo-2026-05-01
git push origin investor-demo-2026-05-01
```

Do **not** run these during the live demo. Tag the clean rehearsal commit so we can roll back to it instantly if a hotfix breaks the demo state.

---

## Fragile-rehearsal jot box (fill in during dress rehearsal)

> _Use this space to jot what almost broke during the last rehearsal — a slow Iris draft, an empty audit drawer, a misclick path. Anything you'd want to remember if the same thing surfaces live._

| What happened | Where | Mitigation |
|---------------|-------|------------|
| | | |
| | | |
| | | |
| | | |

---

## After the meeting

- Stop talking. Let them ask.
- Capture every question verbatim in a Linear ticket within 30 minutes.
- Send the post-meeting email (template in `DEMO_RUNBOOK.md`) within 4 hours.
- Resume the polish-only mandate per `feedback_no_new_features.md`.

You've got this.
