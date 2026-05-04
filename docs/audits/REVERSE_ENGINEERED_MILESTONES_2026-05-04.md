# Reverse-Engineered Milestones — Game-Changer Release

**Date:** 2026-05-04
**Author:** Walker (with Claude as thinking partner)
**Purpose:** Working backwards from the public "game-changer" launch to today, identify the critical path, the long-lead items that must start this month, and the slip-killers that would push everything right.

---

## TL;DR

Every milestone in this doc is already in the North Star (Parts VIII–X). Reverse-engineering doesn't invent new milestones — it re-orders them by **dependency lead time** and surfaces three categories the linear plan hides:

1. **Critical-path items with multi-month cycle times** that have to start NOW even though they don't show up on the 90-day tracker. Today is May 4, 2026; some of these have already burned a week.
2. **Slip-killers** — single dependencies that, if they push 30 days right, push everything right.
3. **Parallelizable work** that can land any time and shouldn't crowd the critical path.

The "game changer" release is **not** Lap 3 (Aug 2026, first paid GC). That's the proof. The actual game-changer event is **Embedded Payments v0 + Audit Chain externally certified, ~Apr 30, 2027** — because that's the moment the moat closes structurally and Procore can no longer respond by feature-matching.

---

## Defining "Game Changer"

Four candidates from the North Star, with my read on each:

| Date | Event | Industry reaction | Verdict |
|---|---|---|---|
| ~Aug 1, 2026 | Lap 3 acceptance — first signed contract | "Who is SiteSync?" | **Proof point**, not game-changer |
| ~Nov 15, 2026 | Procore Groundbreak response | "There's a credible challenger" | **Awareness moment**, not game-changer |
| ~Apr 30, 2027 | Embedded Payments v0 + audit chain certified + 10+ paying GCs | "The rails just changed" | **Game-changer.** Subs lock in. GCs structurally migrate. |
| ~Jul 31, 2027 | Series A close on paid cohort | "This is the next Procore" | **Validation**, not the launch |

I'm reverse-engineering from **Apr 30, 2027**. That's T-0 in the table below.

If the answer to "what is the game-changer" is something different — bigger, smaller, named differently — say so and we'll re-thread the chain.

---

## The Reverse-Engineered Calendar

T-0 = Apr 30, 2027. T-N = N days before launch.

| When | Days from today | Milestone | Why it must land here | Critical path? |
|---|---|---|---|---|
| **T-0** Apr 30, 2027 | +361 | **Embedded Payments v0 LIVE.** ACH push the day GC approves pay app. Lien waiver auto-attach. Public press. | Game-changer event. | — |
| T-30 Mar 30, 2027 | +331 | ACH rails wired end-to-end. Beta with 3 GCs running for 30 days. | 30-day soak before public launch is non-negotiable for a money rail. | ✅ |
| T-60 Feb 28, 2027 | +301 | Public-sector compliance pack ships. First state-DOT or municipality customer signed. | Government deals = 90-day procurement; need lead time. | ⬜ Parallel |
| T-75 Feb 15, 2027 | +287 | Integrations marketplace launches with 5 partners (Sage, Foundation, etc.). Open API + outbound webhooks. | Partner integrations = 60-day average build time. | ⬜ Parallel |
| T-90 Jan 30, 2027 | +271 | **Seed round closed.** Target $4–6M. Team grows to 12. | Hiring takes 60 days from close. Need bodies before payments build. | ✅ |
| T-95 Jan 25, 2027 | +266 | SSO/SCIM live for first 3 enterprise pilots. Custom roles. API tokens issued to 1 integration partner. | Enterprise procurement won't sign without SSO. | ✅ |
| T-100 Jan 20, 2027 | +261 | **10 paying GCs in production.** | Need this revenue narrative for seed close + payments launch credibility. | ✅ |
| T-120 Dec 31, 2026 | +241 | Sub portal v1 with notifications, multi-GC view, signed waiver auto-attach. | Network-effect prerequisite. Subs need a reason to log in daily. | ✅ |
| T-130 Dec 21, 2026 | +231 | Portfolio rollup hardening. Risk-rank methodology white paper published. | This is the wedge into multi-project execs. | ⬜ Parallel |
| T-150 Dec 1, 2026 | +211 | Seed deck final v1. First 5 investor meetings booked. | Average seed close = 60 days from first meeting. | ✅ |
| **T-165** Nov 15, 2026 | +196 | **Procore Groundbreak response.** Within hours of Procore's announcements, SiteSync's website publishes a 90-second video response. | Industry tentpole moment. We either show up or we don't. | ✅ |
| T-180 Oct 31, 2026 | +181 | 3 reference customers. 1 case study with named GC, named PM, named numbers (hours saved, dollars caught). Mobile native iOS in App Store. Android beta. | Reference customers = 60-day lag from "started using" to "willing to be quoted." | ✅ |
| T-195 Oct 15, 2026 | +165 | **Audit chain externally certified** by a Big-4 or specialty auditor. Hash-chain integrity attestation document published. | This is the moat. Procore literally cannot replicate this in 12 months. Cert takes 90 days from engagement. | ✅ |
| T-210 Oct 1, 2026 | +151 | Procore importer end-to-end (UI → worker → verification). Sub portal v0 free tier live. | #1 enterprise switching blocker removed. | ✅ |
| T-240 Sep 1, 2026 | +121 | **Lap 3 closed. Iris graduates from drafter to actor.** 3 hardened executors live (probably: RFI auto-route, daily-log finalization, lien-waiver chase). | The "act" event. Validates the thesis. | ✅ |
| T-270 Aug 1, 2026 | +90 | **Lap 3 acceptance gate passed: first signed contract.** | The first logo. Without this, nothing downstream is real. | ✅ |
| T-300 Jul 2, 2026 | +60 | **Lap 2 acceptance gate passed.** Soft-pilot PM messages Walker unprompted: "I don't want to go back." 100+ approved Iris drafts, ≥70% acceptance, ≤90s avg time-to-approve. | The product-market-fit moment. Without this signal, don't sell. | ✅ |
| T-310 Jun 22, 2026 | +49 | Iris voice style guide finalized. First 150 production drafts hand-edited. | Iris must stop sounding like ChatGPT before pilot scales. | ✅ |
| T-320 Jun 12, 2026 | +39 | Soft pilot live with 1 GC, 2 PMs, 2 supers, 1 project. | The 14-day pilot window has to start by mid-June or Lap 2 gate slips. | ✅ |
| T-330 Jun 2, 2026 | +29 | Grounding upgrade: every Iris draft cites a clickable source. | Without citations, soft pilot will reject drafts on trust grounds. | ✅ |
| T-345 May 18, 2026 | +14 | scheduled-insights edge function fires every 15 min, writes to drafted_actions. | Iris-as-watcher prerequisite. | ✅ |
| **T-361** May 4, 2026 (today) | 0 | Lap 1 substantively closed (Day 30 receipt shipped 2026-05-03). | Foundation. | — |

---

## Critical Path (the things that, if they slip, slip everything)

In dependency order, today through Apr 2027:

```
[Lap 1 closed ✓]
   ↓
[scheduled-insights edge fn] → [grounding+citations] → [Iris voice]
   ↓
[Soft pilot GC recruited] → [14-day pilot] → [Lap 2 gate: "I don't want to go back"]
   ↓
[Iris-as-actor: 3 executors] → [Lap 3 gate: first signed contract]
   ↓
[Procore importer] → [Audit chain certified] → [3 reference customers]
   ↓
[Procore Groundbreak response (Nov)] → [Sub portal v1] → [10 paying GCs]
   ↓
[SSO/SCIM] → [Seed close] → [Hire 6 engineers] → [Embedded Payments v0]
   ↓
[T-0: Game changer launch, Apr 30, 2027]
```

Anything off this line is parallelizable. Anything on this line, if it slips 30 days, slips T-0 by 30 days.

---

## Must Start This Week (long-lead items the 90-day tracker doesn't show)

These are items where the cycle time is longer than the 90-day window, so if you wait until Day 60 to start them, they're already late:

| Item | Why now | Cycle time | Risk if delayed |
|---|---|---|---|
| **Identify and contact the soft-pilot GC** | Need pilot live by ~Jun 12. Recruiting + onboarding = 4 weeks. Calendar integration, project setup, training = 1 week. Pilot starts May 18 ideally. | 4–5 weeks | Lap 2 gate fails; no PMF signal; nothing downstream is real |
| **Engage external auditor for hash-chain cert** | Cert needs to ship by Oct 15. Auditor engagement → scoping → fieldwork → report = 90 days. | 90 days | No moat at Groundbreak. Procore demos a feature instead |
| **Initiate ACH partner negotiation** (Modern Treasury, Stripe Treasury, Increase, Dwolla) | Embedded Payments v0 needs rails wired by Mar 2027. Partner contracts + KYC + pilot account = 60–90 days. Build = 90 days. | 5–6 months | Payments slip = launch slips |
| **Open engineer #2 search** | Need bodies before payments build (Feb 2027). Sourcing → interview → notice → start = 60–90 days. | 60–90 days | Critical-path velocity collapses |
| **Build the Groundbreak response prep kit** | Watch Procore announcements live, ship 90-second video by midnight. Production = 4 weeks. Landing page + pricing comparison = 4 weeks. | 8 weeks | Worst case: Procore announces something credible and you're silent |
| **Start the seed deck v0** | Need v1 final by Dec 1. Average draft cycle = 8 weeks; investor feedback loops = 6 weeks. | 14 weeks | Seed slips → hiring slips → payments slip |
| **Reach out to first reference-customer candidate (probably the soft-pilot GC)** | Reference status = 60-day lag from "started using" to "willing to be quoted." Need 3 by Oct. | Sequential | Case study has no real names; loses credibility |

---

## The Slip-Killers (single failures that push T-0 right)

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| 1 | The soft-pilot GC says "this is interesting but our PM is too busy" | High | 30-day slip + need to recruit again | Have 2 GCs lined up; offer to do the data import yourself for free |
| 2 | Typecheck campaign (4339 errors) drains engineering time meant for Lap 2 features | High | 30–60 day slip | Cap typecheck work at 1 day/week; Lap 2 features take priority |
| 3 | Hash-chain auditor finds a real flaw in the chain implementation | Medium | 60+ day slip | Walk the chain end-to-end NOW with your own audit; don't surprise the auditor |
| 4 | ACH partner declines or asks for $250K minimum balance | Medium | 30-day slip + re-quote | Negotiate with 2 partners in parallel from Day 1 |
| 5 | Procore announces embedded payments at Groundbreak | Low–Medium | Strategic blow, not date slip | Have the "what's different" page ready: hash-chain, free sub portal, drafts-not-actions |
| 6 | Walker hits founder fatigue; can't context-switch between strategy and code | High | Diffuse 30+ day slip | Engineer #2 must start before Aug; the second pair of hands is the de-risk |
| 7 | Soft pilot reveals Iris draft acceptance is 40%, not 70% | Medium | 30–60 day slip on Lap 2 gate | Voice + grounding + citations are the three levers; budget 2 weeks of extra polish |
| 8 | First paid GC signs but cancels at month 2 (no churn protection yet) | Medium | Reference customer count drops | Have 3+ pilots in flight by Oct, not just 1 |

---

## What Goes Off the Critical Path (parallelizable, do not let it crowd the rest)

| Item | Where it is in the North Star | Notes |
|---|---|---|
| BIM viewer with WebGPU | Q2 2027 | Cosmetic. Three.js is fine until 2027. |
| Cross-project Iris insights | Q1 2027 | Sexy, but not a launch dependency. Ship after Embedded Payments lands. |
| Public-sector compliance pack | Q1 2027 | Real revenue, but not on the launch path. Run as a parallel sales motion. |
| AI fine-tuning run | Q2 2027 | Post-launch. The corpus has to exist first. |
| Native Android | Q4 2026 | iOS is the path. Android is parallel and can lag 60 days without harm. |

---

## What This Doc Doesn't Cover (and probably should, in a follow-up)

1. **Pricing.** $X/seat/month vs. $Y/project/month vs. % of pay-app volume. The pricing decision affects the seed narrative.
2. **The "first 50 GCs" target list.** The 10 paying by Jan + 30 by Apr means the funnel needs ~150 qualified GCs by Sep. Where do they come from?
3. **Iris's failure-mode policy.** When Iris drafts something wrong, what happens? Liability disclaimer + redaction policy + insurance carrier.
4. **The marketing org.** A game-changer launch on Apr 30, 2027 needs PR, content, and demand-gen running by Feb 2027. That's a hire, not a vendor.
5. **The brand moment of the launch itself.** Press tour? Industry event? Procore Groundbreak counter-event? The "release as game-changer" framing implies a deliberate launch, not a feature drop.

---

## What to Do With This Doc

1. **Walker decides** whether T-0 = Apr 30, 2027 (Embedded Payments) is the right "game-changer" definition. If it's something different, the chain re-threads.
2. **Add the long-lead items** (soft-pilot GC, auditor, ACH partner, engineer #2, seed deck) to `SiteSync_90_Day_Tracker.xlsx` as "milestones beyond Lap 1" — they don't fit the daily-row format, so probably a new sheet called `Critical Path Long Leads`.
3. **Quarterly review** of this doc. The North Star says "Re-write [the roadmap] every quarter; lie to no one about how confident you are." This is that re-write, applied to the 12-month plane.
4. **Pin this to the receipt for the next session.** Future Claude needs to know the game-changer date so daily decisions ladder up.

---

## One Number to Watch

**T-minus 361 days.** That's how many days exist between today and Apr 30, 2027. Of those, the critical-path chain consumes ~340 of them with no slack. The 21 days of slack are spent in the soft-pilot recruit window and the Groundbreak prep buffer.

**Velocity is the company.** If a week passes with no movement on the critical-path item-of-the-week, that week was a slip.
