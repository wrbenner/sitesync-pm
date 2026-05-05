# Sales Deck v1 — Customer-Facing

**Date:** 2026-05-04
**Status:** v1 outline ready. Walker reviews; Claude builds the .pptx Day 78 of Lap 3 (~July 1).
**Target audience:** Mid-market commercial GC executives — typically Director of Operations, VP of PM, or CFO. Sometimes the founding GC partner. Almost never the field super (different conversation).
**Companion specs:** `BATTLECARDS_FRAMEWORK_2026-05-04.md` (vs Procore / Trunk Tools / etc.), `FIRST_CONTRACT_PLAYBOOK_2026-05-04.md` (the close motion), `PRICING_DECISION_DOC_2026-05-04.md` (the pricing slide), `MARKETING_SITE_REWRITE_SPEC_2026-05-04.md` (sister surface)
**Format reference:** Sales-deck classic. 10-12 slides for room. Leave-behind 1-pager + appendix for due diligence.

---

## TL;DR

This is the deck Walker (eventually GTM lead) presents to GC executives in the 30-45 minute "first call" stage of the sales cycle. It's calibrated for:

- **Buyer profile:** Director of PM at a $50M-$500M commercial GC. 35-50 years old. Skeptical of construction tech. Has been pitched by Procore, Trunk Tools, Buildots, Newforma. Burned by something Procore-like that didn't deliver.
- **What earns the next meeting:** the demo. The 12-second sequence + a quote about hours saved.
- **What earns the contract:** the audit chain story + the free sub portal + the embedded payments roadmap. (Roadmap because v1 launch is April 2027.)

The deck is **10 slides** for the room. **3-page leave-behind** + **appendix of 8 slides** for due diligence.

This is a **product-led story**, not a market-size pitch. Investors care about TAM; buyers care about "will my PMs use it Monday morning?"

---

## Storyline (60-second version)

> "Your 28-year-old PE spent 9 hours yesterday on data entry. Three RFI follow-ups, one daily log, two pay-app reviews. SiteSync drafts those before she gets to her desk. She approves them in 90 seconds. The audit chain on every action is mathematically tamper-proof — your CFO will love that. Your subs use SiteSync for free, which means after two projects they ask you to put their NEXT project on SiteSync too. Network effect in your favor for the first time. Embedded payments live April 2027 — money pushes the day you approve a pay app. Pricing is 0.15% of construction volume. Procore is $30K/year per seat plus a separate sub portal that costs subs $30K/year. We're cheaper, faster, easier, and the audit chain is the moat."

---

## The 10-Slide Deck

### Slide 1 — Cover

**Visual:** SiteSync logo, tagline. Clean.

> "The AI superintendent for construction. Drafts the work. Subs use it free. Money moves the day you approve."

### Slide 2 — The 12-second demo

**Visual:** Animated GIF or live demo:

1. Walker opens /iris on iPad. 3 pending drafts — overnight cards.
2. RFI follow-up to architect. Pre-written. Confidence 0.94. 3 citations.
3. Daily log. Already drafted. Manpower from check-ins, weather from feed, work performed from photos.
4. Pay-app review. Iris flagged a duplicate line item.
5. Walker approves all 3 in 90 seconds.
6. Audit chain captures everything.

**Speaker note:** "This is what your PM does. Saves her 8 hours a week." Pause. "Now — you'll see the demo run live in a moment. But first, why this matters."

### Slide 3 — The pain

**Visual:** Real photo of a PE on a job site, or the Field Manual screenshot of a PM tablet at end-of-day. (Not stock — credibility comes from real images.)

**Quote (from a real GC interview, attributable):**
> "I spent 2 hours yesterday writing a daily log I write every day. Then I spent another hour chasing 5 subs for their COIs. We're losing 1.5 PMs worth of capacity per project to data entry."
> — [Name], [Title], [GC Name]

**Speaker note:** "If you're like every other GC we've talked to, your PMs spend 30-40% of their week on tasks a tool should do. Iris does them."

### Slide 4 — How Iris works (the mental model)

**Visual:** Three boxes:

```
1. ┌──────────────┐  Iris watches.
   │  WATCH       │  Insights computed every 15 min from
   │              │  your project data — schedule, RFIs,
   └──────┬───────┘  daily logs, pay apps, photos, weather.
          │
          ▼
2. ┌──────────────┐  Iris drafts.
   │  DRAFT       │  When something needs action, Iris
   │              │  writes the action — RFI, daily log,
   └──────┬───────┘  pay app, punch item, follow-up email.
          │
          ▼
3. ┌──────────────┐  You approve.
   │  APPROVE     │  Click. The action fires. Audit chain
   │              │  records it. Done.
   └──────────────┘
```

**Speaker note:** "Three steps. Iris doesn't act without your approval. Every action is hash-chain audited — court-defensible. We'll come back to that."

### Slide 5 — The audit chain (the trust slide)

**Visual:** Simple architecture:

```
Every action                                Every audit row
in SiteSync                                  is hash-chained
─────────                                  ─────────────────
RFI sent ─────────►  Audit row N ─SHA256─►  Audit row N+1
PayApp approved ──►  Audit row N+2 ─────►  Audit row N+3
Daily log filed ──►  Audit row N+4 ─────►  ...

Tampering with any row breaks subsequent rows. 
Trail of Bits attests this October 2026.
Insurance carriers care.
```

**Speaker note:** "Every row's hash includes the previous row's hash. You can mathematically prove no one has modified history. Procore's audit log is policy-enforced — they promise not to modify. Ours is mathematically-enforced. Your CFO will see this and ask, 'who else has this?' Answer: nobody."

### Slide 6 — The wedge — Free for subs

**Visual:** Two columns:

```
PROCORE                            SITESYNC
─────                              ────────
Subs pay $30K/year for             Subs use SiteSync FREE.
"PrimeContract" upgrade.           Submit pay-app draws.
                                   Upload COIs. View status.
GCs pass that cost down            Multi-GC dashboard.
through change orders or           Magic-link onboarding.
exclude subs from workflow.        QR code on contract page.

Cost to GC: indirect.              Cost to GC: zero.
Cost to sub: $30K/yr.              Cost to sub: zero.
Network effect: top-down.          Network effect: bottom-up.
```

**Speaker note:** "Subs use SiteSync for free. They get a portal across all their GCs. After two projects, they ask their NEXT GC, 'can you put this on SiteSync?' For the first time, the network effect goes from sub to GC. That's the wedge."

### Slide 7 — Embedded Payments (the launch slide)

**Visual:** Timeline + value prop:

```
APRIL 30, 2027 — EMBEDDED PAYMENTS LIVE
────────────────────────────────────────

The day you approve a pay app:

   ┌──────────────────┐
   │  GC approves      │
   │  pay app          │
   │                   │
   └────────┬──────────┘
            │
            │  same business day
            ▼
   ┌──────────────────┐
   │  ACH push to     │
   │  sub's account    │
   │                   │
   └────────┬──────────┘
            │
            │  automatic
            ▼
   ┌──────────────────┐
   │  Lien waiver      │
   │  auto-attached    │
   │  Audit chain      │
   │  records it      │
   └──────────────────┘

Powered by Modern Treasury rails.
Hash chain attestation by Trail of Bits.
```

**Speaker note:** "Today, you approve a pay app on a Tuesday and the sub gets the check Friday — if the AP person has time. With SiteSync's embedded payments, sub gets paid same business day, lien waiver auto-attaches, audit chain records the money movement. Subs get paid faster — they ask you for SiteSync. Available April 2027 to all Pro and Enterprise customers."

### Slide 8 — Live demo (the moment)

**Visual:** "DEMO" placeholder. Walker actually runs the demo on the iPad.

**Speaker note:** "Now let me show you. This is a real demo project; nothing pre-loaded for you. Let's see what's in the inbox today."

[12-second demo. Approves 3 drafts. Audit chain shows the activity in real time.]

**Demo's 4 reactions to anticipate:**

1. **"Where does the AI get the data?"** — Citation panel. Click a draft → shows source. "From the photo I uploaded yesterday. From the daily log I signed Tuesday. From the schedule activity in your existing project tool."
2. **"What if Iris is wrong?"** — Approve → can be edited. Reject → can withdraw. 60-second cancel window for auto-execute. "Iris drafts; you decide."
3. **"What if my super doesn't use it?"** — Mobile-native iOS app. Photo/voice capture in 12 seconds. Field-tested in 95° heat with gloved thumbs. (Show the mobile native screen if possible.)
4. **"How does this fit with my existing tools?"** — Procore importer. Sage 300 + Foundation + Vista + CMiC integrations. SSO. Sandbox to evaluate.

### Slide 9 — Pricing

**Visual:** Three-tier pricing (per `PRICING_DECISION_DOC`):

```
   Starter      Pro              Enterprise
   ───────     ────────         ──────────
   $30K/yr     0.15% of vol.    0.20% of vol.
   flat        min $50K         + custom
   
   Up to       Unlimited        Unlimited +
   5 active    projects         custom workflows
   projects                     
   
   Web app     Mobile native    Public sector
                                compliance
   Iris       SSO + API        
   
   Audit      ERP integ.       Dedicated CSM
   chain                       + 24/7 SLA
   
   Free sub   Free sub          Free sub
   portal     portal            portal
   
   $30K/yr    Embedded ACH      Embedded ACH +
              when launched     custom rails
```

**Speaker note:** "Procore charges your subs $30K/year for a sub portal that's worse than ours. We charge nothing. Pro tier is what you'd be on — 0.15% of your annual construction volume. If you do $80M in construction, that's $120K/year. Compared to your current Procore + sub portal + AP labor stack, this is cheaper end-to-end."

### Slide 10 — Why now / what's next

**Visual:** What we're shipping when:

```
TODAY (mid-2026):     Pilot with one of your projects
                       30-day evaluation window
                       Side-by-side with current tools
                       
+30 days:              Decision time
                       Mid-pilot review → continue or stop
                       
+60 days:              Sign + onboard
                       Procore data import (if applicable)
                       Sub portal magic links sent
                       Mobile app deployed to PMs/supers
                       
+180 days (April 2027): Embedded payments live (your sub-payment
                        flow pushes ACH same-day with auto lien
                        waiver — no extra contract needed; included
                        in Pro/Enterprise)

+365 days:             SOC 2 Type II report shareable
                       Hash chain Trail of Bits attestation public
                       Three reference customers on call
```

**Speaker note:** "Here's what happens if we go forward. 30-day pilot lets us prove value without a long contract. By next April, you have embedded payments — your subs are getting paid same-day. By next September, you have the full compliance posture for any prospect's CIO due diligence. We earn your trust month by month."

---

## Optional Slide 11 — Reference customers (when we have them)

**Visual:** Logos of 3 reference customers (Brad's Nexus + 2 more by Oct 31, 2026).

**Quote from named customer:**
> "We replaced 14 hours/week of PM data entry with SiteSync. We're not going back."
> — [Name], [Title], [GC Name]

**Speaker note:** "Don't take my word. Three GCs are using SiteSync today. Here are their phone numbers."

(Slide 11 is the closing slide once we have references. Pre-Day 90 of Lap 3, leave it as a forward-looking placeholder.)

---

## The leave-behind (3-page PDF)

After the meeting, Walker leaves a 3-page PDF:

**Page 1 — One-pager.** Logo + tagline + 5-bullet "what SiteSync does" + 3 reference customers (or pilot sponsors) + Walker's contact info.

**Page 2 — The pricing math for THIS GC.** Walker pre-fills based on conversation:
- "[GC Name] does ~$XXM/year in construction volume."
- "Pro tier = $XX,XXX/year."
- "vs Procore at $XX,XXX/year + $30K/year sub portal × N subs."
- "Net savings: $XXX,XXX/year."

**Page 3 — Compliance posture & roadmap.**
- SOC 2 Type II — observation window underway, report Feb 2027
- Hash chain Trail of Bits attestation — Q4 2026
- WCAG 2.1 AA — VPAT 2.4 published
- CCPA + GDPR ready
- Bug bounty live
- Insurance: $10M cyber + E&O + fidelity bond

---

## The appendix (8 slides for due diligence)

When the GC's CIO/IT/CFO comes back with detailed questions, Walker has these:

- **A1.** Architecture deep-dive (hash chain construction, RLS, multi-tenant isolation, scaling story)
- **A2.** Iris confidence calibration methodology (how we ensure 0.85 confidence = 85% correct empirically)
- **A3.** Procore importer details + field mapping table coverage
- **A4.** Mobile native architecture (RN + Expo + custom PDF native module)
- **A5.** Compliance roadmap (SOC 2 + chain attestation + WCAG + CCPA + insurance)
- **A6.** Sub portal mechanics + free-sub network effect math
- **A7.** Embedded Payments architecture (Modern Treasury + Alloy + bank partner + lien waiver auto-attach)
- **A8.** Sample MSA + DPA + Order Form

These aren't presented; they're shared on request after the room.

---

## Speaker notes — what Walker doesn't say

Things that hurt the pitch (don't say):

- ❌ "AI is the future of construction" — buyer rolls eyes; everyone says this
- ❌ "Procore is bad" — buyer respects Procore even if frustrated; don't trash; let the comparison speak
- ❌ "We're better than [competitor]" without specifics — speak to specific differences
- ❌ "Our team is incredible" — buyer doesn't care; show, don't tell
- ❌ "We have venture backing" — buyer cares about whether you'll be around in 5 years; reference customers + your funding stage tell that story implicitly
- ❌ Apologizing for the product ("we know the mobile app needs work...") — speak to it as a strength + roadmap

Things that build trust (do say):

- ✅ "I'm a 28-year-old former PE; I built this because I lived this." (Walker's bio)
- ✅ "Here's a number — [name] of [GC] saved 14 hours/week."
- ✅ "Here's the audit chain proof. [Name] of Trail of Bits attests this."
- ✅ "Here's our compliance posture. Type II report Feb."
- ✅ "Here's pricing. Same for everyone. No backroom deals."
- ✅ "Here's the pilot offer. 30 days. Decide at the end."
- ✅ "If at any point in the pilot you say no, we walk away. No hard feelings."

---

## Brand + visual language

Same as the seed deck (`SEED_DECK_v0`):

- Typography: Inter or Söhne
- Color: deep slate (#1a1f2e), iris gold (#FFB347), construction safety orange (#FF6B35) for warnings only
- Photography: real construction sites, real PMs (with permission)
- No emojis. No exclamation points. No SaaS jargon.
- Logo small, footer; "SiteSync — confidential — [date]" + page number

---

## Iteration schedule

| Date | Activity | Output |
|---|---|---|
| **May 11** | Walker reads outline; gives feedback | v0.1 with Walker's tone |
| **May 25** | Brad's pilot underway; capture quote (with consent) | v0.2 with quote |
| **June 9 (Lap 3 Day 61)** | Walker uses v0.2 in any sales conversations | v0.3 with feedback |
| **June 30 (Lap 3 Day 80)** | Pricing finalized; pricing slide updated | v0.4 |
| **July 1** | Claude builds v1.0 .pptx | v1.0 |
| **July 1+** | Used in production sales calls; iterate per call feedback | v1.x |

---

## What Walker Does With This Spec This Week

1. Read the outline; tone-check
2. If Brad's pilot is going well by mid-May, get a one-line quote (consent: "I might use this in our sales materials")
3. Note any slide that doesn't ring true — we revise

---

## What Claude Code Does With This Spec

- Build v1.0 .pptx by July 1 (~2 days work)
- Build the 3-page leave-behind PDF (~1 day work)
- Build the 8-slide appendix .pptx (~1 day work)
- Maintain version history in `docs/decks/sales-deck-v1/`

Total Claude Code work: ~4 days.

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| DECK-1 | Demo crashes mid-call | Medium | High | Demo rehearsal × 200 (per `DEMO_REHEARSAL_PLAYBOOK`); demo environment reliability |
| DECK-2 | Buyer asks question outside the deck (e.g., specific integration) | High | Low | Walker gives honest "we'll have that by [date]"; doesn't fake |
| DECK-3 | Pricing slide produces sticker shock | Low-Medium | Medium | Show comparison math; emphasize free sub portal value |
| DECK-4 | Compliance slide produces "we'll wait until you have SOC 2" objection | Medium | Medium | Counter with: "30-day pilot is at no risk to you; if SOC 2 isn't done by your purchase decision, we walk away" |
| DECK-5 | Buyer wants to talk to a current customer; we don't have references yet | Medium (pre-Oct 2026) | High | Pre-Oct 31, lean on Brad pilot story + investor advisor introductions; post-Oct, reference list grows |

---

## What this spec deliberately does NOT cover

- Battlecards (covered by `BATTLECARDS_FRAMEWORK`)
- The actual sales motion / outreach scripts (covered by `FIRST_CONTRACT_PLAYBOOK`)
- Technical demo environment (covered by `DEMO_REHEARSAL_PLAYBOOK`)
- The seed deck (separate, investor-facing — `SEED_DECK_v0`)
- ABM / outbound campaigns — Q3 2026+
- Channel partner / reseller deck — Q4 2026+
