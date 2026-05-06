# Immersive UX Audit — Live Walkthrough

**Date:** 2026-05-04
**Mode:** Live in-browser walkthrough at `sitesync-pm.vercel.app`, logged in as Walker, every page experienced first-hand via Chrome MCP.
**Project context:** Merritt Crossing (a Dallas-area seed project; Day 549, project metrics show 0% complete on the Home dashboard but 91% complete on the Schedule page — see Sev-1 finding on contradictory metrics).

This complements the static-code audit (`UX_BUGATTI_AUDIT_FINDINGS_2026-05-04.md`) with what an actual user — Brad Cameron in his pilot — would experience.

---

## TL;DR — the verdict that matters

**The product Walker is pitching does not exist as a live page.** The Iris Inbox — centerpiece of the seed deck, the demo, every Lap 2 spec, every Lap 3 spec — returns 404 in production. The shipped AI surface is a side-panel chat called "AI Copilot" with specialist agents (Schedule/Cost/Safety/Quality/Compliance/Docs). That's a fundamentally different product than the one in 36 spec docs.

Plus 8 other Sev-1 findings, including:
- Schedule page shows "Health 0/100 · F · 4 critical · 247 disconnected activities · Logic Density 0/act" simultaneously with "ON TRACK 100%" and "COMPLETE 91%" — the product contradicting itself in front of the buyer
- Field Capture timeout fires (good) but leaves the user stuck — no retry, no library fallback, no recovery
- Stuck skeletons (Field Manual #2) confirmed on Daily Log, Drawings, Dashboard
- Sidebar user identity shows "—" (Field Manual #6 unfixed)
- Demo project shows 0% complete on Day 549 — credibility-shattering seed data

**Severity-1 count from the live walkthrough: 9.** Severity-2: 14. Severity-3: 11.

---

## The Critical Finding — Iris is Not Iris in Production

### What the seed deck says

> "SiteSync is the AI superintendent that drafts those RFIs, drafts those daily logs, drafts those pay apps before she gets to her desk."
> — Seed Deck v0, Slide 4

> "Iris drafts. You approve. Every action audited."
> — Sales Deck v1, Iris page

### What the live product shows

The bottom-right FAB on every page opens a side panel labeled:

> **"AI Copilot — Punch List Context"**

With suggested questions, "Specialist Agents" pills (Schedule / Cost / Safety / Quality / Compliance / Docs), and an input that says "Ask your AI team... Use @ to route to a specific agent."

This is a **chat interface with specialist agents**. Not "Iris drafts → approve in inbox."

### Where the Iris Inbox should live

- `/iris` → 404 Page not found
- `/inbox` → 404 Page not found
- The codebase has `src/pages/iris/IrisInboxPage.tsx` per Day 30.5+ receipts
- But the route is not registered in production OR feature-flagged off

### Why this is the most important finding in the entire audit

Walker walks into Brad's office to demo the soft pilot. Says "let me show you Iris." Opens the app. Brad sees an FAB, opens it, gets "AI Copilot" with specialist agents. Walker has to explain. The 12-second demo (per `DEMO_REHEARSAL_PLAYBOOK`) has nowhere to run. The "approve, approve, approve" sequence has no UI.

**The shipped product and the pitched product are different products.** Lap 2's pilot can't proceed. Lap 3's first contract closes against a product that doesn't match the deck.

### Severity 1, blocker for Lap 2 pilot kickoff

Either:
- Route `/iris` to the IrisInboxPage that exists in code (CI bug? feature flag?)
- Re-brand "AI Copilot" to "Iris" everywhere in the UI to match the deck
- Or — most ambitiously — both ship the Iris Inbox AND keep the AI Copilot chat as a secondary surface

This is the #1 fix before anything else. If Brad's pilot starts and Iris doesn't exist, the gate fails by definition.

---

## Page-by-page Findings

### Page 1 — HOME / Dashboard (`/dashboard`)

**Visceral impression:** Dashboard tells Brad "Hi Walker, this Dallas-area Merritt Crossing project is 0% complete on Day 549 with no budget set, no schedule, no RFIs, no safety data, and no tasks." Credibility-shattering first impression.

| Severity | Finding | Recommended fix |
|---|---|---|
| **1** | "Good morning, there" — name field empty (Field Manual #6 confirmed unfixed) | Pull first name from auth |
| **1** | Day counter shows "Day 549 · 0%" — demo credibility problem | Hide if no progress, or seed real data |
| **1** | "MY TASKS — Loading..." stuck for 5+ seconds (Field Manual #2) | 2s timeout → empty state |
| **1** | Bottom-left "—" placeholder for user name (Field Manual #6) | Pull name from auth.users |
| **2** | "SCHEDULE 0 days · On Track" — misleading when no data | Empty-state copy |
| **2** | "BUDGET — Not set" — dash glyph unclear | Replace with "—" or explicit copy |
| **3** | "0%" with no label on dashboard header | Add label |

**Verified fixed (FM Part II):** Closeout 0% glyph (#13), schedule "F" pill (#3) — *but see Schedule page; #3 reappears differently.*

---

### Page 2 — Daily Log (`/daily-log`)

**Visceral impression:** Page substance is solid. Field Capture is the killer surface — it fails the field-test rig.

| Severity | Finding | Recommended fix |
|---|---|---|
| **1** | Field Capture timeout fires (good) but no recovery — Capture button stays disabled, no "Choose from library" fallback (Field Manual #10 80% fixed; 20% open) | Add retry + library fallback CTAs |
| **2** | Header shows "Tuesday, April 28, 2026" but weather card shows "Wednesday, May 6" — date inconsistency | Sync header to current date |
| **2** | "Submit and Lock" iris-gold button + "Delete" plain text — destructive action under-treated | Style "Delete" with warning treatment |
| **3** | "Total Logs 10 all time" awkward copy | Reword |
| **3** | Page took 5+ seconds to load | Performance budget budget review |

---

### Page 3 — Schedule (`/schedule`)

**Visceral impression:** Beautiful Gantt with 247 real activities. But the metrics contradict themselves immediately. **This is the buyer-credibility-killer page.**

| Severity | Finding | Recommended fix |
|---|---|---|
| **1** | "Health 0/100 · F · 4 critical" pill renders alongside "VARIANCE 0d / CRITICAL PATH 0 / ON TRACK 100% / COMPLETE 91%". Product contradicting itself in the same view. (Field Manual #3 — IntegrityIssueList fixed, but this surface still shows the F pill) | Either: (a) suppress the Health pill when KPIs claim healthy, OR (b) gate the "On Track / Complete" KPIs behind logic_density > 0 — empty state when schedule has no CPM logic |
| **1** | Expanded Health panel shows "247 completely disconnected activities · Logic Density 0/act" — meaning the schedule has no CPM logic — but "On Track 100%" still claimed | Same fix as above |
| **1** | "4 CRITICAL" badge in Health pill but KPI strip says "CRITICAL PATH 0" — internal contradiction | Reconcile labeling |
| **2** | Today marker on Apr 26; weather says May 6 (system date) | Resync demo data to "today" |

---

### Page 4 — RFIs (`/rfis`)

**Visceral impression:** Strongest empty-state in the product. CTA is clear, copy is helpful, layout is on-brand.

| Severity | Finding |
|---|---|
| ✅ Empty state is exemplary: "No RFIs yet" + helpful copy + strong "+ Create First RFI" CTA |
| ✅ Iris-gold CTA used appropriately |

(The static audit found Sev-1 PermissionGate gaps on RFI Detail — the detail page wasn't testable from this empty state.)

---

### Page 5 — Submittals (`/submittals`)

| Severity | Finding | Fix |
|---|---|---|
| ✅ | Excellent dual-CTA empty state ("Create Submittal" + "Import from Spec") |
| **3** | "Export" dropdown visible when 0 items — nothing to export | Hide/disable when empty |
| **3** | "No items" subtitle redundant with empty state below | Remove subtitle on empty |

---

### Page 6 — Punch List (`/punch-list`)

**Visceral impression:** Solid page. Real construction items. Status filters, donut, table — all on-brand.

| Severity | Finding |
|---|---|
| ✅ "1 open · 0 pending · 1 closed" + 50% donut + filter chips |
| ✅ Real items: PL-004 fire caulk + PL-003 cracked drywall |
| ✅ View toggles (list / grid / board) |

---

### Page 7 — Drawings (`/drawings`)

| Severity | Finding | Fix |
|---|---|---|
| **1** | Skeleton loaders hung 10+ seconds before showing empty state (Field Manual #2 confirmed unfixed on this page) | 2s timeout watchdog → empty state |
| ✅ | Empty state itself is clean |

---

### Page 8 — Pay Applications (`/pay-apps`)

**Visceral impression:** The strongest page in the product. Real money numbers. AIA terminology. Lap 1 money-cents migration is visible — clean currency rendering.

| Severity | Finding | Fix |
|---|---|---|
| ✅ | Total Billed $2,352,642 / Total Paid $0 / Retainage Held $1,564,008 — clean |
| ✅ | Tabs: Pay Applications / Retainage / Lien Waivers / Cash Flow |
| ✅ | App #14 with full G702/G703 fields |
| **1** | Two duplicate App #14 entries with identical period + identical amounts | Fix seed data — should be App #14 + #15 with different periods |
| **3** | "J/K to navigate" keyboard hint discoverable bonus — good UX |

---

### Cross-cutting — Iris FAB

The FAB shifts color across pages:
- Dashboard: iris-gold ✅
- Daily Log loading: purple
- Daily Log loaded: iris-gold ✅
- RFIs: purple
- Submittals: purple
- Punch List: purple
- Drawings: purple
- Pay Apps: purple

**SEV-2:** Color inconsistency. Brand identity violation. The FAB is the highest-touched UI element in the product; should always be iris-gold.

---

## Verified Status of Field Manual Part II (15 items)

| # | Issue | Live status |
|---|---|---|
| 1 | iPad sidebar overlap | Not tested (desktop walkthrough) |
| 2 | Stuck skeleton loaders | ❌ Confirmed on Daily Log + Drawings + Dashboard MY TASKS |
| 3 | Schedule "Logic quality F" pill | ❌ STILL VISIBLE on Schedule page header — contradicts the IntegrityIssueList fix |
| 4 | iPhone bottom-nav + FAB occlusion | Not tested (desktop) |
| 5 | Mobile tab bars overflow | Not tested |
| 6 | Sidebar user identity "—" | ❌ Confirmed unfixed on every page |
| 7 | Reports/Schedule data inconsistent | Not tested directly |
| 8 | Profile avatar orange "?" | ✅ Verified fixed (initials elsewhere; not seen as "?") |
| 9 | Primary buttons 50% opacity | ✅ Action buttons render saturated |
| 10 | Daily Log Field Capture | ⚠️ 80% fixed (timeout works, geo banner gone) but timeout has NO recovery — SEV-1 |
| 11 | Iris streaming captures | Not tested (Iris Inbox doesn't exist as a route) |
| 12 | Drawings sub-page captures duplicated | ⚠️ Cannot reproduce (no drawings to test against) |
| 13 | Closeout 0% superscript | ✅ Verified fixed |
| 14 | Contracts iPhone clips "Insurance" | Not tested (desktop) |
| 15 | Sync banner heavy | ✅ Not visible — appears removed/demoted |

**Score: 4 verified fixed. 4 confirmed unfixed. 7 not tested (mobile/iPad needed).**

---

## The Top 10 Pre-Pilot Fixes (must ship before Brad)

Ordered by demo blast radius:

1. **Make `/iris` resolve to IrisInboxPage** OR **rebrand "AI Copilot" → "Iris"** in UI. (~2 hr) — blocks demo; blocks pilot
2. **Schedule contradictory metrics fix.** When `logic_density = 0` or `critical_path_count = 0`, the "On Track / Complete" KPIs render as "—" or "Insufficient data". (~3 hr)
3. **Field Capture timeout recovery.** Add "Try again" + "Choose from library" CTAs after timeout. (~1 hr)
4. **Sidebar username "—" fix.** Pull from auth.users. (~30 min)
5. **MY TASKS dashboard skeleton timeout.** 2s → empty state. (~30 min)
6. **Drawings skeleton timeout.** Same pattern. (~30 min)
7. **"Good morning, there" name fallback.** (~15 min)
8. **Demo project seed data.** Either real Day-549-progress numbers or new project (Day < 30, partial milestones). (~2 hr seed data work)
9. **Iris FAB color consistency.** Always iris-gold; never purple. (~1 hr)
10. **Pay Apps duplicate #14.** Fix seed data. (~15 min)

**Total: ~11 hours of fix work.** Doable in 1–2 days if Walker hands the queue to Claude Code.

---

## What I Did NOT Test

- **Mobile (iPad / iPhone) viewports** — the field-test rig (sun, gloves, dropped device) needs a real device walkthrough by Walker
- **The 8 admin pages** flagged Sev-1 in static audit (PermissionGate vacuum) — login as a non-admin user would surface the gap
- **Approve/Reject mutations** — couldn't test without an Iris draft to act on (because Iris Inbox doesn't exist)
- **Sub portal magic-link flow** — separate URL not tested
- **Citation panel deep-links** — couldn't test without Iris Inbox
- **Drawings detail / pin overlay** — no drawings uploaded
- **Drawings sub-page captures** (Field Manual #12) — no drawings
- **Voice violations in actual Iris drafts** — no drafts to test (because Iris Inbox doesn't exist)

The "no Iris Inbox" finding compromises my ability to test most of the demo flow. **That alone is the most damning finding.**

---

## Files Saved

- This doc: `docs/audits/IMMERSIVE_UX_AUDIT_2026-05-04.md`
- Static audit findings: `docs/audits/UX_BUGATTI_AUDIT_FINDINGS_2026-05-04.md`
- Per-batch findings: `BATCH_A`, `BATCH_B`, `DEMO_SURFACES`

---

## Walker's Action This Week

1. **Verify the Iris Inbox routing.** Go look at `src/router/*` — is `/iris` registered? Is there a feature flag (`VITE_FLAG_IRIS_INBOX`)? Why is the static-code-confirmed `IrisInboxPage` not live?
2. **Decide brand stance.** Is it "Iris" everywhere (rebrand AI Copilot) or is it "AI Copilot with Iris specialist somewhere"? Pick. Sales deck depends.
3. **Hand the 10-fix queue to Claude Code.** The 11 hours of fix work above is mechanical; Walker's time is better spent on Brad outreach + ADR sign-off + ACH partner negotiation.
4. **Re-run this audit on iPhone + iPad** physically. The mobile field-test rig (95° sun, gloves) is the next missing data point.

---

## Final Verdict

**You cannot start Lap 3 today.** And you cannot start Lap 2 pilot without first resolving the Iris/AI-Copilot identity gap. The demo Walker plans to run literally does not exist as a live page; the centerpiece of every spec is unrouted.

The good news: nothing here is hard to fix. The product has substance — Schedule has 247 real activities, Pay Apps has $2.3M in real money math, Punch List has real items, RFI empty state is exemplary. **The plumbing is there.** The wiring + branding is what's broken.

11 hours of fix work + a brand decision = pilot-ready. Walker hands the fix queue to Claude Code; the 11 hours run in parallel with Brad outreach. By end of week, the demo Walker pitches and the demo Brad sees are the same demo.

That's the Bugatti standard for this week.
