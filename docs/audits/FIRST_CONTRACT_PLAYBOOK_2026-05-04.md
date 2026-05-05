# First Contract Playbook — Lap 3 Days 82-87

**Date:** 2026-05-04
**Status:** Spec ready. Walker executes against this from Day 82 (~July 4) to first contract closure target Day 87 (~July 9).
**Companion specs:** `SALES_DECK_v1` (the deck), `BATTLECARDS_FRAMEWORK` (the comparisons), `PRICING_DECISION_DOC` (pricing slide), `MSA_TEMPLATE_NOTES` (the contract), `SOFT_PILOT_PLAYBOOK` (where Brad's pilot evolves into this contract)
**Format reference:** Standard sales playbook + the Lap 2 SOFT_PILOT_PLAYBOOK rhythm.

---

## TL;DR

The first contract is **Brad Cameron's Nexus Companies** post-pilot conversion. Days 82-87 of Lap 3 (~July 4-9, 2026 tight calendar). The path:

1. **Day 82** — Pilot debrief with Brad (post-Lap-2 gate). Discuss continuation. Walker presents pilot data + value math.
2. **Day 83** — MSA + Order Form sent to Brad's counsel. NET-30 redline cycle begins.
3. **Day 84-86** — Pitches to prospects 2 + 3 + 4 in parallel (per `SALES_DECK_v1`).
4. **Day 87** — Brad's contract signed; first invoice issued.

Plus: 2 more contracts in legal review by Day 90 (per Lap 3 Gate 2).

This is the first money-in-bank moment. Bugatti standard: **the close motion is documented, repeatable, and produces the audit trail Series-A investors will want.**

---

## The Close-Motion Architecture

Every prospect goes through a defined funnel:

```
Stage 1 — INTRO        ─►   "Demo gets booked"
                            (warm intro or cold outbound; 30-min call locked)

Stage 2 — DEMO         ─►   "Live demo + 30 min Q&A"
                            (Walker does this himself for first 5; GTM lead from #6+)
                            
Stage 3 — PILOT        ─►   "30-day evaluation"
                            (Reduced from Brad's 14-day soft pilot; first paid customers
                             get 30 days because they're paying $30K-$200K, not free)
                            
Stage 4 — DECISION     ─►   "Stay or go conversation"
                            (Walker + Brad's PM; honest read; mutual)
                            
Stage 5 — MSA SENT     ─►   "Contract redline cycle begins"
                            (Outside counsel involved; default 14-day cycle)
                            
Stage 6 — CONTRACT     ─►   "Signed + invoiced + first payment"
                            (Stripe + bank confirmed; gates 1-3 hit)
                            
Stage 7 — ONBOARDING   ─►   "Active production use begins"
                            (Different from pilot; full org provisioned, real data)

Stage 8 — REFERENCE    ─►   "Customer agrees to be referenceable"
                            (60-day lag after start; Reverse-Engineered T-180 milestone)
```

Each stage has: entry criteria, exit criteria, owner, time budget, materials, and what counts as a fail.

---

## Stage 1 — INTRO (warm or cold)

### Entry: a name + a reason to talk

Either Walker has a personal connection (Brad), a network introduction (referrer warm-emails), or it's outbound (Walker's email + LinkedIn + targeted phone).

### Materials
- **Warm intro template:** 3 sentences. "Walker — thanks for the intro. [Prospect Name], you and I share interest in construction tech innovation. I'd love to spend 30 minutes showing you SiteSync — it's an AI superintendent that drafts contractual artifacts (RFIs, daily logs, pay apps) before your PMs see them, with hash-chain audit on every action. Open Tuesday at 2 PM Central or Thursday at 10 AM?"
- **Cold outbound template:** Different. Lead with a specific named person + their specific context. "[Prospect Name], saw [your project at X]. SiteSync would have saved your PMs ~10 hours/week on that project's RFI/daily-log volume. 30-min call?"
- **LinkedIn template:** "Hi [name], I'm Walker — building SiteSync (AI-driven PM platform with hash-chain audit). 30-min demo in next 2 weeks if it's relevant for [specific GC]?"

### Exit: 30-min demo call booked on Walker's calendar

### Time budget
- Warm intro: 1-3 days from intro email → call booked
- Cold outbound: 5-15 days through Walker's pipeline; conversion rate ~5%

### Fail
- 30 days post-outreach without a response → close as "no engagement"
- Explicit "not interested" → polite acknowledgment + ask for a future re-engagement window

---

## Stage 2 — DEMO

### Entry: 30-min call booked

### Materials
- **Sales Deck v1** (per `SALES_DECK_v1`) — 10 slides + leave-behind
- **Demo environment** — pre-rehearsed (per `DEMO_REHEARSAL_PLAYBOOK`)
- **Customer-specific page in deck** — Walker pre-fills slide 9 (pricing) with the prospect's volume math

### Mechanics
- 5 min: Walker introduction + their context (1 min Walker, 4 min listening)
- 15 min: Deck + live demo
- 8 min: Q&A
- 2 min: Define next step explicitly ("If interested, here's what would happen next")

### Exit: a clear next step

Three possible outcomes:
1. **Yes, pilot:** schedule pilot kickoff within 14 days
2. **Maybe, more info:** schedule technical deep-dive within 7 days; share appendix slides
3. **No, not now:** ask explicitly for "future re-engagement window — when should we talk again?"

### Time budget
- Day-of: 30 min
- Decision turnaround: 7 days max (otherwise drop to Stage 1's "no engagement" close)

### Fail
- "Yes, pilot" but no scheduled kickoff after 14 days → re-engage; if still no, treat as no
- "No, not now" without time horizon → "Maybe Q4?" → respect; close as "future"

---

## Stage 3 — PILOT (30 days, paid)

### Entry: Pilot Agreement signed

This is different from `SOFT_PILOT_PLAYBOOK`'s 14-day free pilot. First-paid-customer pilots are:

- **30 days** (vs Brad's 14)
- **Paid** ($X per pilot day, or 30-day prorated of annual rate, or pilot-fee-credited-toward-annual)
- **Production data only** (vs Brad's optional pilot org)

### Materials
- Pilot Agreement (1-pager — based on `SOFT_PILOT_PLAYBOOK` agreement, modified for paid status)
- Pilot Onboarding Day 1 (Walker on-site)
- Daily 5:30 PM standup format (same as Brad's pilot)
- Pilot success criteria document (signed by both parties)

### Mechanics
- Days 1-30: customer uses SiteSync as primary PM tool on pilot project
- Walker (or GTM lead from customer #6+) on Slack-Connect 24/7 during business hours
- Daily 5:30 PM standup (15 min, same format as `SOFT_PILOT_PLAYBOOK`)
- Mid-pilot retro Day 15
- End-of-pilot debrief Day 30

### Exit: pilot success or fail

**Pilot success criteria** (set with customer at start):
- ≥ 50 approved Iris drafts
- ≥ 60% acceptance rate
- ≤ 120s avg time-to-approve
- Zero security/audit incidents
- Customer's named PM says "we're going forward" unprompted

**If success:** move to Stage 4 (Decision)
**If fail:** acknowledge; debrief; refund pilot fee if customer requests; preserve relationship

### Time budget
- Days 1-30: pilot
- Day 30 → Stage 4: same day or within 7 days

### Fail
- Pilot users disengage mid-pilot (< 75% standup attendance for 3 days) → end pilot Day 7
- Critical failure (audit chain breaks, security incident, data loss) → END pilot; offer to make customer whole; preserve relationship

---

## Stage 4 — DECISION

### Entry: pilot complete

### Mechanics
- 60-min meeting: Walker + customer's named PM + customer's exec sponsor (CFO or VP)
- Walker presents pilot data: drafts approved count, acceptance rate, time saved, dollars caught
- Customer presents internal sentiment + business-case math + objections
- Decide: yes / no / "we need to think"

### Exit: a decision

**If yes:** Stage 5 (MSA)
**If no:** debrief; offer continued read-only access for 30 days; preserve relationship; ask for testimonial or future-engagement window
**If "thinking":** specific time horizon (max 14 days); Walker stays available; if no decision in 14 days, treat as no

### Time budget
- Day-of: 60 min
- Decision turnaround: 14 days max (after Day 30 of pilot)

### Fail
- "We need to think" → "thinking" → 30 days no decision → close as no
- "Yes" → no commitment to MSA-send within 7 days → re-engage; if still no, close as cooling

---

## Stage 5 — MSA SENT

### Entry: customer says yes

### Materials
- MSA template (per `MSA_TEMPLATE_NOTES`)
- DPA template
- Order Form pre-filled with: tier, ACV, payment terms, primary contact, authorized users
- Cover email to customer's counsel + procurement

### Mechanics
- Walker emails customer's counsel + cc procurement
- Default: 14-day redline cycle
- Walker uses outside counsel for redline review on first 5 contracts
- Status report to Walker every 3 days during redline

### Exit: signed agreements + first invoice issued

### Time budget
- 14-30 days for first 3 contracts (longer redline cycles as we learn)
- 7-14 days from contract #6+ (template-fluent)

### Fail
- 30 days redline without progress → escalate to customer's exec sponsor
- 60 days redline without progress → call it; either accept their template (with our non-negotiables intact) or walk

---

## Stage 6 — CONTRACT

### Entry: signed + invoiced

### Mechanics
- Stripe (or our billing system) issues first invoice on Day 1 of subscription
- Customer has 30 days NET-30 to pay
- First payment received → contract gates 1-3 fully passed (per `LAP_3_ACCEPTANCE_GATE_SPEC`)
- Audit chain row recorded for the contract execution
- Customer's onboarding scheduled

### Exit: first payment in our bank account; customer acknowledges receipt

### Time budget
- Sign → invoice: same day
- Invoice → first payment: 14-30 days
- Total Stage 5 + 6: 30-60 days from "yes"

### Fail
- Invoice issued, customer disputes → resolve; resolve in 7 days max
- Payment past 30 days → late fee; reach out via Walker direct
- 90 days no payment → consider terminating (rare; sales education needed if happens)

---

## Stage 7 — ONBOARDING

### Entry: First payment received

### Mechanics
- Customer success (Walker initially; CSM #1 hired Feb 2027) leads
- Day 1: Production org provisioned, magic-link emails sent to authorized users
- Day 2-5: Customer's data import (Procore importer, Sage, Foundation, etc.)
- Day 6-30: First-30-days success program (daily check-ins, weekly retros, fixes)
- Day 31+: Quarterly business reviews

### Exit: customer is in active production use; QBR scheduled

### Time budget
- Days 1-30: onboarding window
- Day 31: QBR + active-use confirmation

### Fail
- Customer doesn't onboard users within 30 days of signing → urgent re-engagement; we paid for the relationship, they need to use it
- Customer's data import fails → priority engineering response; Walker on it

---

## Stage 8 — REFERENCE

### Entry: 60+ days of active use

### Mechanics
- Walker (or CSM) asks for: (a) reference call willingness, (b) named case study, (c) logo + testimonial
- Customer says yes/no/conditional
- If yes: case study draft → review → publish
- If conditional: respect; revisit in 90 days

### Exit: customer is referenceable

### Time budget
- 60-90 days from contract sign to reference

### Fail
- Customer not interested in being referenceable → respect; preserve relationship; no churn risk
- Customer agrees but never has time for the call → light persistence; eventually accept

---

## Days 82-87 specifically

### Day 82 (~July 4) — Pilot debrief with Brad

Walker meets Brad (Technical Director at Nexus). Goal:
- Present pilot data: 100+ approved drafts, 70%+ acceptance, 90s avg time-to-approve, "I don't want to go back" quote captured
- Walk through value math: hours saved per PM per week (10 typical); dollars at risk caught (1-2 disputes per quarter avoided)
- Define commercial path: Pro tier, ~$120K ACV based on Nexus's volume

Brad's likely response: yes, with conditions. Walker captures conditions in notes.

### Day 83 — MSA sent to Brad's counsel

Walker sends MSA + DPA + pre-filled Order Form to Brad's counsel + cc procurement. Cover email:

> "Brad — as discussed, attached is our standard MSA, DPA, and the Order Form for Nexus Companies (Pro tier, $120K annual based on volume estimate). Your counsel may want a 14-day redline cycle. Let me know any timing concerns. — Walker"

### Day 84 — Outreach to prospects 2, 3, 4

Walker uses Brad's progress as social proof in outreach to other prospects:

- Prospect 2: a multifamily LIHTC GC similar to Carleton (or Carleton itself if backup activated)
- Prospect 3: a commercial GC in Walker's network
- Prospect 4: a regional GC champion candidate

Each: warm intro or cold outbound; 30-min demo call within 7 days.

### Day 85-86 — Demos for prospects 2/3/4

Three demo calls back-to-back. Sales Deck v1. Live demo. Q&A. Define next step.

### Day 87 — Brad's contract signed

Best case: Brad's counsel returned redline within 7 days; Walker incorporated; Brad signed. First invoice issued.

If redline cycle is slower (10-14 days), Brad signs Day 90-92. Still within Lap 3's ±3-day gate window.

---

## What success looks like Day 90

- ✅ Brad's contract signed (Gate 1: 1 paid contract)
- ✅ Prospect 2 in legal review (Gate 2: at least 1 in legal)
- ✅ Prospect 3 or 4 in legal review (Gate 2: at least 2 in legal)
- ✅ Demo runs flawlessly 4+ times in row at the prospect demos (Gate 3)
- ✅ Auto-execute opt-in active at Brad with zero cancels in 7 days (Gate 4)
- ✅ Walker takes a weekend off Day 89-90 (Gate 5)

All 5 gates green. Lap 3 passes. Money in the bank.

---

## What if Brad doesn't convert

Risk: Brad's pilot signaled love but procurement / legal held the contract for 30+ days. We hit Day 90 with Brad in legal review but no signed contract.

**Mitigation:**
1. Carleton (backup) escalated to "primary" in Lap 2 outreach; pilot kicks off by Day 60
2. Carleton's contract closes at Day 90 instead
3. Brad still in legal review; Carleton signed; Lap 3 gate hits

**Worst case:** neither Brad nor Carleton converts. Lap 3 gate fails. Extend by 14-30 days. Sales motion accelerated; Walker on every call.

The playbook stays the same regardless of which customer is "first."

---

## CRM / Pipeline Tracking

Walker tracks the funnel in `docs/sales/pipeline.md` (text-based; Notion-friendly):

```markdown
# Sales Pipeline — Updated [date]

## Stage 1 — INTRO (calls scheduled)
- [Customer Name] — call [date] — [warm/cold] — context: [...]

## Stage 2 — DEMO (post-call)
- [Customer Name] — demo [date] — outcome: [yes/maybe/no] — next: [...]

## Stage 3 — PILOT
- [Customer Name] — pilot Days [N-M] — success criteria: [...] — current status: [...]

## Stage 4 — DECISION
- [Customer Name] — decision call [date] — outcome: [...]

## Stage 5 — MSA SENT
- [Customer Name] — MSA sent [date] — counsel: [name] — redline status: [...]

## Stage 6 — CONTRACT (signed)
- [Customer Name] — signed [date] — first payment: [date] — onboarded [date]

## Stage 7 — ONBOARDING
- [Customer Name] — onboarded [date] — QBR scheduled [date]

## Stage 8 — REFERENCE
- [Customer Name] — referenceable since [date] — case study: [link]
```

Updated weekly. Powers the seed deck Slide 14 (numbers).

---

## What Walker Does With This Spec This Week

1. Read the playbook end-to-end; align on stage definitions
2. Identify prospects 2, 3, 4 (warm intros first)
3. Schedule outreach for Day 84
4. Confirm outside counsel availability for redline review (per `MSA_TEMPLATE_NOTES`)
5. Set up `docs/sales/pipeline.md` with current state

---

## What Claude Code Does With This Spec

- Maintain the pipeline.md doc as Walker updates it
- Build CRM-lite tooling if needed (`docs/sales/` directory, simple text-based)
- Extract metrics for the seed deck Slide 14 (pipeline stages, conversion rates, average ACV)
- Generate weekly pipeline summary for Walker's standup feed

Total Claude Code work: ~2 days through Lap 3.

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| FCB-1 | Brad pilot signals love but Nexus procurement holds 30+ days | Medium | High | Backup Carleton in pilot pipeline by Day 60; both contracts in flight by Day 87 |
| FCB-2 | Prospect 2/3/4 demos don't convert | Medium | Medium | Funnel expectations: 5% close rate at top; need 20+ qualified leads to close 1 |
| FCB-3 | First contract redline cycle is 30+ days | Medium | Medium | Outside counsel pre-engaged; templates designed for 1-round redline |
| FCB-4 | Brad's PM disengages between pilot end and contract sign | Low | High | Daily Slack-Connect during MSA cycle; Walker on it |
| FCB-5 | Walker doesn't have prospects 2/3/4 lined up by Day 84 | Medium | Critical | Long-lead outreach: start prospect-list NOW (May 2026) for Day-84 calls |
| FCB-6 | Pricing is too high for prospect → walks | Medium | Medium | Customer-pay pilot covers if smaller; or move to Starter; price floor is published |

---

## What this spec deliberately does NOT cover

- The sales motion at scale (post first 5 contracts; covered by future GTM lead)
- The investor seed deck close motion (different audience, different document — `SEED_DECK_v0`)
- Channel partner / reseller close (year 2)
- International contracts (US-only Q4 2027+)
- Win/loss analysis tooling (year 2)
