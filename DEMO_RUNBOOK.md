# SiteSync PM — Investor Demo Runbook

**Target length: ~7 minutes, 8 moments.** Read once before the demo. Keep open on the second monitor. Do not improvise — the script is the script.

> **Persona decision (locked 2026-04-30, Session 3):** the demo seed account maps to a **Superintendent** (`supabase/seed/seed.sql:328`). Every captured `/day` screen is a super-view. We narrate the demo as **"the Super walks in,"** not "the PM walks in." Reseeding to PM was considered and deferred — it would force a Playwright re-capture and risk surfacing untested PM-only paths the day before the demo. Supers feel ownership of `/day` too; the loop, the audit chain, and the Owner Update all read the same way.

---

## Live Demo Checklist

| Setup | Value |
|-------|-------|
| Browser | Chrome (latest), no extensions, fresh profile |
| Window | 1440 × 900, browser chrome hidden via `Cmd+Shift+F` |
| Theme | Light (system → light, do **not** demo dark) |
| URL | `http://localhost:5173/sitesync-pm/` |
| Account | Demo Superintendent account (Walker Benner — `seed.sql:328` maps this user to `superintendent`) |
| Branch | `feat/vision-substrate-and-polish-push` |
| Commit | tagged `investor-demo-<date>` (verify with `git describe`) |
| Env | `VITE_ANTHROPIC_API_KEY` set, network solid |
| Pre-opened tabs | Tab 1: `/day` · Tab 2: `/conversation` (RFI inbox) · Tab 3: `/reports` |
| Pages to avoid | `/dashboard` (legacy), `/inspections`, `/reconciliation`, `/marketplace`, `/sustainability`, anything in `archive/` |

**30-minute pre-flight:**

1. `git log --oneline -1` → matches the demo commit, no `WIP`.
2. `npm run dev` → `localhost:5173/sitesync-pm/` renders the brand login.
3. Sign out, sign back in with the demo account → lands on `/day`.
4. `/admin/compliance` → click **Seed demo data** → toast `Demo data seeded`.
5. `/day` → metric strip non-zero, Iris lane shows ≥1 chip, inbox has rows.
6. Open one RFI, click **Audit trail** → drawer renders entries with hashes.
7. `/reports` → top card shows **Generate Owner Update** (Iris-branded).
8. Approve a submittal in a throwaway tab to confirm `runSubmittalApprovedChain` posts to the activity feed. **Do this before the demo, not during.**

If any step fails, fix before going live. Do not demo on broken state.

---

## The 8 Moments — click by click

> **Persona framing (Session 3 decision: Super walks in).** Open with: *"It's 6:45am. Walker is the Superintendent on a $42M commercial build in Dallas. He opens his laptop before coffee. This is what he sees."*

### 1 · The Cockpit Overview — 60s

**Click:** open Tab 1 (`/day`). Pause two seconds.

**Narrate (in this order, while their eyes track):**

> *"Four numbers tell him project posture: items needing him, critical items, dollars at risk, schedule activities behind."*
>
> *"The right rail is the project NOW — schedule, budget, crew, weather, today's lookahead, who owes him what, recent field photos. One glance."*
>
> *"And the inbox is dense, sortable, keyboard-driven. `j` moves down, `Enter` opens, `e` acts on the AI draft."*

**What to click during narration:** nothing. Let the page breathe. Hover (don't click) one Iris chip in the lane.

**Narrate (deterministic moat — say this verbatim, point at the indigo lane label "DETERMINISTIC / no AI · sourced · real-time"):**

> *"This indigo strip up here — Iris insights — is not the AI talking. These are deterministic detectors over the project data: cascade risks, aging RFIs, variance acceleration, staffing gaps, weather collisions. Pure functions. Sourced. No hallucination. The AI loop happens elsewhere — when Iris drafts an RFI response, that's a model call. When Iris flags risk, that's a rules engine. We separate them on purpose."*

---

### 2 · Iris Draft Drawer — 60s (the wow)

**Click:** the **Draft** pill on the topmost RFI row that has one. (If the top row's pill is missing, pick the next — never click a pill twice in one demo.)

**What happens:** drawer slides in from the right with the actual Iris-drafted reply, confidence indicator (high/medium/low), source pills (drawing reference, spec section, prior RFIs).

**Narrate:**

> *"Iris doesn't just detect — it drafts. The Super reviews. Edits if needed. Sends. AI prepares; humans approve. That's the loop."*

**Click:** **Send**. Drawer closes, row vanishes.

> *"Three days of email triage compressed into a glance and a click."*

---

### 2.5 · Ground in the World — 45s (the multi-mind moment)

**Click sequence:**

1. From `/rfis/<RFI #15 id>` (the **Fire-rated assembly at electrical room — code** RFI; open it from the inbox row).
2. In the header, click the **⊕ Ground in the world** pill (indigo, sits next to **Audit trail**).
3. The right drawer slides in with three vertical lanes — `PROJECT · CLAUDE-SONNET-4.6`, `WORLD · PERPLEXITY-SONAR-PRO`, `STRUCTURE · GPT-4o`. **Pause 4 seconds** while all three stream simultaneously.
4. Hover the latency badge in the footer: it reads *"3 providers · 4.2s."*
5. Click a Perplexity source pill in the **WORLD** lane — a new tab opens with the IBC 706.2 excerpt.
6. Click **Use this in my response** in the drawer footer. The drawer closes; the RFI response textarea is filled with the synthesized draft, citations attached. The audit chain has a new `iris_ground` entry recording all three provider/model IDs and per-call latencies.

**Narrate (verbatim — this is the headline thesis, slow down):**

> *"Watch this. The same RFI. One click — but three intelligences answer in parallel. Claude reads the project — three prior RFIs touched this assembly. Perplexity reads the live web — here's the actual IBC text, here's last January's Dallas amendment. GPT-4o reads the structure — citations, dollar exposure, confidence. Four seconds. Three minds. One answer the PM can edit and send. We are the first construction PM tool grounded in code, not just data."*

**Why this moment matters:** moments 1–2 prove Iris is sourced and deterministic. Moment 3 proves the audit chain is real. **2.5 proves the AI moat itself** — three asymmetric LLMs running in parallel, each grounded in a different layer of truth (your project, the live world, the typed schema). Procore doesn't have this. The competitive moat sits in the four-second lane race, not in any one model.

---

### 3 · Audit Trail Drawer — 50s (the trust moment)

**Click sequence:**

1. Click the row to open the RFI detail page.
2. In the header, click the **Audit trail** button.
3. The drawer slides in. Pause 2 seconds — the green pill at the top reads **"Audit chain intact (N)"**. That ran live: SHA-256 over every entry, mirrored from the Postgres trigger.
4. Point at the timeline. Three entries down, click the row to expand it — show the `prev_hash` and `entry_hash` columns.
5. Click **Sealed PDF** in the drawer header. A new tab opens with the signed PDF.
6. Say: *"This goes to insurance and counsel. Procore can't produce this. Their audit log is a CSV."*

**Narrate (the trust thesis, while step 4 is on screen):**

> *"Every action — RFI created, response sent, magic link viewed — is hash-chained. SHA-256 over a canonical payload, computed in the Postgres trigger and verified again here in the browser. Tamper anywhere and the chain breaks. Sealed PDF here exports the deposition pack — entry hashes plus the full event timeline, signed. This is what insurance and counsel ask for."*

Close the drawer. Return to `/day`.

---

### 4 · Owner Update Generator — 65s (the finale)

**Click:** Tab 3 (`/reports`). Click **Generate Update** on the indigo Iris card at the top.

**What happens:** modal opens, Claude streams a 7-section narrative populated from real project context — schedule status, budget, top risks, decisions needed, lookahead. Confidence chip on each section. Source pills inline.

**Narrate (slow down here — this is the "you-can't-do-this-in-Procore" moment):**

> *"Iris reads the project — schedule activities, budget lines, RFIs, the action stream — and writes the actual deliverable. Four hundred words, every section sourced."*
>
> *"Walker reviews. Edits. One click sends to the owner. Same loop whether the sender is a Super, a PM, or a project executive."*

**Click:** **Generate share link** → modal shows a magic-link URL.

> *"Or the owner clicks the magic link, sees a clean branded portal scoped to their project. Every view is captured in the audit chain — the actor_kind we just looked at."*

Close the modal.

---

### 5 · Submittal Approved → Cross-Feature Chain — 60s (the depth)

**Click:** sidebar → **Conversation** → filter to **Submittals** → open the topmost submittal in `under_review`.

**Click:** **Approve**.

**What happens behind the scenes:** `runSubmittalApprovedChain` fires — idempotent, fire-and-forget. The activity feed gets a new entry within ~1s with **lead-time math** (e.g., "Long-lead glass procurement window starts now; on-site by Aug 12 hits the install milestone with 4 days float").

**Narrate:**

> *"One approval. Six things just happened. The schedule got a procurement marker. The activity feed shows the lead-time math. The audit chain has six new linked entries — all hash-verified, all attributable to me."*
>
> *"This is the difference between a record-of-action tool and a project intelligence tool."*

Click **Activity** (right rail) → confirm the new chain entry appears.

---

### 6 · Mobile Lens — 20s (the breadth)

**Resize:** drag browser to ~390px wide, OR open `polish-review/iphone-light/02-dashboard.png` on the second monitor.

**Narrate:**

> *"Same data, different lens. The dashboard adapts: bottom tab bar, dense list instead of table, swipe gestures for snooze and done. Field-grade. Designed for a glove on gravel."*

Don't click — phone width is brittle. Let the screenshot or live resize tell the story.

Resize back to 1440px before the next moment.

---

### 7 · Closing State Snapshot — 20s

**Click:** sidebar → **The Day** → land back on `/day`.

**Narrate:**

> *"Seven minutes ago, Walker had two hundred unread items across four tools. Now he has eight things that need the Super — ranked, sourced, pre-drafted, **grounded in code, market, and audit chain**. The PM beside him sees the same surface tuned to PM priorities. Three intelligences. One drawer. One signed deliverable. That's the thesis."*

Pause. Let them ask the first question.

---

## Total: ~6m 55s narration (8 moments). Leave ~2 minutes for Q&A.

---

## Fallback Plans

### Iris draft fails to generate
Anthropic key unset, rate-limited, or network blip. Close the drawer, click a *different* Iris pill (the failed draft is cached as rejected). If both fail, skip moment 2 and go straight to moment 4 (Owner Update — different code path, deterministic local fallback).

### "Ground in the world" lanes don't all stream
The grounding cache (Session C) ships a pre-baked response for RFI #15 + #17. If any provider stalls or 429s, the drawer falls back to the cache automatically and shows a tiny degraded-mode toast: *"Showing cached grounding — live providers slow."* You acknowledge it once: *"That's the cache catching a hiccup — every grounding is cached so the audit chain stays continuous."* If only ONE lane is empty (e.g., Perplexity rate-limited), say: *"The other two lanes still answered. The drawer is built so partial answers still ship — we're not gated on any one provider."* If NO lanes populate within 6s, skip moment 2.5 and continue to moment 3 — do not fight it.

### Owner Update streaming stalls
The `OwnerUpdateGenerator` has a deterministic local fallback — let it run, narrate over the slight pause: *"This is real Claude streaming a 400-word narrative — about 8 seconds."* If it actually stalls > 15s, refresh and use the cached prior generation.

### Audit drawer is empty
The seed didn't populate `audit_trail_entries`. Re-run **Seed demo data** in `/admin/compliance`. Backup: skip moment 3, narrate the trust thesis verbally.

### `runSubmittalApprovedChain` doesn't post to activity feed
Wait 5 seconds — fire-and-forget. If still nothing, hard-refresh `/conversation` (the chain is idempotent; metadata containment prevents duplicates). Backup: skip moment 5, extend moment 4.

### Cockpit panel renders empty
Per-zone ErrorBoundary catches it; you'll see *"Inbox / Project status unavailable"* in one panel. The other panels keep working. **Acknowledge it as a feature:** *"We're hardened against partial failures — one bad panel never kills the dashboard."*

### Browser crashes / page won't load
Open the second monitor. Hit `localhost:5173/sitesync-pm/#/day` directly. Last resort: switch to the recorded screen capture (record one before the demo and keep it ready).

---

## Recovery Commands

```bash
# Roll back to last known-good demo commit
git reset --hard 8b95407

# Restart dev server cleanly
pkill -f "vite" || true
npm run dev

# Force-clear React Query cache (if data feels stale)
# In browser console:
window.location.reload(true)
```

---

## Pages NOT to Open Live

- `/dashboard` — legacy route, the new homepage is `/day`.
- `/inspections`, `/reconciliation`, `/cost-code-library` — editorial residue.
- `/estimating`, `/procurement`, `/vendors`, `/contracts` — partially rebuilt.
- `/marketplace`, `/sustainability`, `/timemachine`, `/vision` — stub pages, no logic.
- Cmd+K natural-language Iris queries — Phase 4, don't tease.

---

## After the Demo

- Save the screen recording locally.
- Capture investor questions in a Linear ticket.
- Tag the commit: `git tag investor-demo-$(date +%Y%m%d) HEAD`.
- Resume the polish-only mandate per `feedback_no_new_features.md`.

You've got this. Eight moments. Just under seven minutes. The platform is enterprise-grade, the audit chain is real, and the multi-mind moment is the first one investors will lean forward for. Now go close it.

---

## Post-Meeting Compound Email Template

Send within 4 hours of the meeting. Three artifacts only — keeps the email shareable inside the firm and memorializes the specific question they asked. The metrics list anchors the conversation to numbers we can defend.

<!--
Why this works:
  • Three concrete artifacts, no fluff. Forwardable inside the firm without editing.
  • Memorializes the specific question they asked → shows you listened.
  • Five metrics give them an evaluation framework, set the bar, and let us self-grade.
  • Q2 paid-pilot timeline creates a reason to follow up that isn't a chase.
Do NOT include this comment block in the outgoing email.
-->

```
Subject: SiteSync — three things from today

Hi [Name],

Thanks for the time. Three artifacts:

1. The two-minute clip of today's demo, with timestamps:
   [link to backup video, with timestamps for moments 1, 3, 4 in the description]

2. Direct answer to [the specific question they asked]:
   [2–3 sentence answer with one specific data point]

3. The five things I'm tracking weekly that will tell us whether the wedge is working:
   - DAU/WAU among onboarded supers (target 60%+)
   - Onboarding time-to-value (target ≤2 hours)
   - Iris draft accept-rate (target 30%+)
   - Net revenue retention (target 120%+ by month 18)
   - Hours saved per project per week (target 8+)

We're targeting first paid pilot in Q2 (next 60 days). I'll ping you the day it signs.

—Walker
[phone]
[sitesync.app/security]
```

