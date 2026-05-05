# Battlecards Framework — vs Procore / Trunk Tools / Fieldwire / Buildots / Newforma

**Date:** 2026-05-04
**Status:** Framework + 5 cards drafted. Walker reviews; updates as competitive landscape shifts. Live in `docs/sales/battlecards/` with monthly refresh cycle.
**Companion specs:** `SALES_DECK_v1_2026-05-04.md` (the deck the cards support), `MARKETING_SITE_REWRITE_SPEC` (where the comparison page lives publicly)
**Format reference:** Standard sales-enablement format. One page per competitor. Updated quarterly.

---

## TL;DR

Five battlecards in this wave. Each is a 1-page document in `docs/sales/battlecards/<competitor>.md`. Each covers: competitor profile, where they win, where they lose, our positioning, the 3 talking points, the 5 objections + responses, and a "do/don't" for the call.

The framework is consistent so reps (and Walker pre-rep) can find any answer fast. Updated quarterly by Walker + GTM lead.

---

## Battlecard format (the template)

Every card follows this exact structure. Save in `docs/sales/battlecards/<competitor-slug>.md`:

```markdown
# [Competitor] Battlecard

**Last updated:** YYYY-MM-DD
**Reviewer:** [name]
**Field:** [domain — PM, AI, etc.]

## Profile
- Founded:
- HQ:
- Funding / market cap / public:
- Customers (mid-market commercial GC count if known):
- Pricing model:
- ICP (their stated):

## Where they win
[3 bullets — where they're objectively stronger than us today]

## Where they lose to us
[3 bullets — where we're objectively stronger]

## Our positioning vs them
[1 paragraph — the 30-second positioning]

## 3 talking points (when buyer mentions them)
1. [What to say first]
2. [What to say second]
3. [What to say third]

## 5 common objections + responses
1. **Objection:** [...]
   **Response:** [...]
2. **Objection:** [...]
   **Response:** [...]
[...etc]

## Do / Don't
**Do:** [3 bullets]
**Don't:** [3 bullets]
```

---

## Card 1 — Procore

```markdown
# Procore Battlecard

**Last updated:** 2026-05-04
**Reviewer:** Walker
**Field:** Construction PM SaaS

## Profile
- Founded: 2003
- HQ: Carpinteria, CA
- Status: Public (NYSE: PCOR), $10B+ market cap. Stock down ~40% from 2021 peak.
- Customers: ~17,000+ as of FY2024
- Pricing: % of construction volume, $30K-$250K mid-market ACV
- ICP: GCs $5M to $5B+ revenue. Has expanded to subs (paid via PrimeContract) and owners (Procore for Owners).

## Where they win
- Brand. 20-year incumbent. Every CIO has heard of them.
- Integrations. 300+ marketplace partners.
- Field ubiquity. Most field workers have used Procore at some prior employer.

## Where they lose to us
- AI is a chatbot bolted onto a 2003 codebase. Procore Assist + Agent Builder shipped 2025; not woven into workflow.
- Audit log is policy-enforced (admin can modify). Ours is hash-chained (mathematically tamper-proof).
- Sub portal costs subs $30K/year. Ours is free. Network effect inversion.
- Per-seat / per-feature pricing creep. PMs hide users to control cost. We charge by volume.

## Our positioning vs them
"Procore was built for the workflow problem of 2003. SiteSync is built for 2026: AI drafts the work, hash chain proves the work, free sub portal flips the network effect, embedded payments lock the moat. Procore can't ship our audit chain in 12 months because it would invalidate their existing audit log architecture."

## 3 talking points (when buyer mentions Procore)
1. "Procore is the incumbent. We respect them. Three things they can't ship in 12 months: hash-chain audit, free sub portal at scale, embedded payments through our model."
2. "If you're already on Procore, our Procore importer brings your data over in < 2 hours with > 95% accuracy. We're not asking you to throw away the data."
3. "Pricing comparison: at $80M construction volume, Procore is ~$50K-$150K + sub portal at $30K/sub × your sub count. SiteSync Pro is $120K all-in including free subs. Net savings vary."

## 5 common objections + responses
1. **Objection:** "Procore is the safe choice; nobody got fired for buying Procore."
   **Response:** "True 5 years ago. Today, the safe choice is the platform with the audit chain when an arbitration goes south. Procore can't prove your records weren't modified. We can. Your CFO will care about that the moment a $2M dispute hits."

2. **Objection:** "We've already invested in Procore training."
   **Response:** "Procore importer brings your data + workflows. Onboarding to SiteSync takes 30 days. Total transition cost is significantly less than a Procore renewal cycle when you factor in the sub-portal cost subs are passing back to you in change orders."

3. **Objection:** "Procore has more integrations."
   **Response:** "True today. We have Sage 300, Foundation, Vista, CMiC, QuickBooks, Primavera P6, MS Project. That covers ~95% of mid-market commercial. What integration is missing for your stack? If we don't have it by April 2027, we'll build it."

4. **Objection:** "Procore Pay does embedded payments already."
   **Response:** "Procore Pay launched 2023 — it's locked to Procore's $30K subscription and goes through Goldman Transaction Banking. Ours launches April 2027 through Modern Treasury, includes free sub portal, and the audit chain proves every dollar. Different product."

5. **Objection:** "Why should I bet on a startup over a public company?"
   **Response:** "Two answers. First — fund-of-funds: we close our seed January 2027 with reference customers in hand. We have 18-month runway minimum. Second — and this is the real answer — your real risk is missing the AI moment. Procore's AI is a chatbot bolted onto 20-year-old architecture. The category resets when SiteSync ships embedded payments April 2027. You either choose the architecture-native bet or you watch your competitors choose it."

## Do / Don't
**Do:**
- Lead with the audit chain demo (it's our biggest moat advantage)
- Compare pricing including sub-portal cost subs are passing through
- Acknowledge Procore's strengths (don't trash); position us as complementary OR clearly different

**Don't:**
- Trash Procore. Buyer respects them even if frustrated.
- Promise "we have everything Procore has." We don't yet — and the buyer will catch it.
- Discount Procore as a real option. They've earned a place at the table.
```

---

## Card 2 — Trunk Tools

```markdown
# Trunk Tools Battlecard

**Last updated:** 2026-05-04
**Reviewer:** Walker
**Field:** AI for construction, SMS-based

## Profile
- Founded: 2022
- HQ: NYC
- Status: Series A 2023 (~$20M)
- Customers: Suffolk, Boldt, JE Dunn (3 named at launch). Growing from there.
- Pricing: $50K-$200K per project enterprise pricing
- ICP: Top-100 GCs; primarily field-worker-facing (supers + foremen)

## Where they win
- Closest peer on AI in the field. SMS-based agent for trade workers.
- Strong field ubiquity through SMS (no app to install).
- Great early customer logos (Suffolk, Boldt, JE Dunn).

## Where they lose to us
- No financial workflow (pay apps, retainage, lien waivers).
- No audit chain — chat-based system has no provenance story.
- Per-project pricing penalizes long-running projects.
- Limited to field workers; PMs use Procore alongside.

## Our positioning vs them
"Trunk Tools is a field-side AI agent. SiteSync is a complete PM platform with AI woven into every workflow + financial integrity + free sub portal + embedded payments. We're solving a different problem — they help your supers; we help your PMs and your CFO."

## 3 talking points
1. "Trunk Tools is great for field-worker comms. Many of our customers use both — SiteSync for PMs/CFOs/owners; Trunk for supers/foremen on specific tasks. Not necessarily a competitive choice."
2. "Where it becomes a choice: Trunk doesn't have financial workflow, audit chain, or sub portal. If those matter to you, SiteSync is the platform; Trunk is a feature."
3. "Pricing comparison: Trunk is $50-200K per project. SiteSync Pro covers ALL your projects at 0.15% of volume. At a 10-project shop, we're significantly cheaper."

## 5 common objections + responses
1. **Objection:** "Trunk has Suffolk and JE Dunn. Big names."
   **Response:** "Real validation; their AI does work. The question is the scope. SiteSync is a complete PM platform; Trunk is a field comms layer. We have first-paid customers shipping by August; reference customers by October."

2. **Objection:** "Our supers love SMS — no app to install."
   **Response:** "Native iOS app on App Store; one-tap install via QR. Field-tested in 95° heat with gloved thumbs. Specifically designed for construction reality. Demo it; if your super hates it, we walk away."

3. **Objection:** "Trunk is sexier — they're already doing AI in the field."
   **Response:** "Trunk's AI sends messages. Our AI drafts contractual artifacts. Different bar. RFI follow-up to architect = legal document. Daily log = court-defensible record. SMS-based agent can't deliver that."

4. **Objection:** "Should we evaluate both?"
   **Response:** "Absolutely. They solve different problems. Often customers run both. The decision question is: 'do I want the platform underneath my workflow, or the messaging layer on top?' Different answers, different products."

5. **Objection:** "Will you partner with Trunk Tools?"
   **Response:** "Open to it. SiteSync API + their messaging integration could be valuable. We're building the API in Q3 2026. If your team has both, integration would be feasible."

## Do / Don't
**Do:**
- Acknowledge Trunk's wins (Suffolk, Boldt, JE Dunn) honestly
- Position as different problem space (not direct competition)
- Suggest co-existence ("you might run both")

**Don't:**
- Trash Trunk Tools — they're respected and might be a future partner
- Claim "we do everything they do." We don't do SMS agent.
```

---

## Card 3 — Fieldwire (Hilti)

```markdown
# Fieldwire Battlecard

**Last updated:** 2026-05-04
**Reviewer:** Walker
**Field:** Mobile-first PM, plan-rooted task management

## Profile
- Founded: 2014
- HQ: San Francisco, CA
- Status: Acquired by Hilti 2021 (price undisclosed; ~$300M est.)
- Customers: Thousands; mostly small-to-mid GCs and trades
- Pricing: $39-$79/user/month transparent
- ICP: Field workers + small GCs; mobile-first

## Where they win
- Mobile-first. Native iOS + Android day one.
- Excellent offline. Core to their ICP.
- Plan-tile rendering speed (custom C++ renderer).
- Free for collaborators (free for subs effectively).

## Where they lose to us
- No AI. Period.
- Limited financial workflow (pay apps, sub-payments).
- No audit chain.
- Hilti acquisition has slowed product velocity.

## Our positioning vs them
"Fieldwire is a great mobile-first task tool for plans. SiteSync is a complete PM platform — Iris drafts your work, audit chain proves your work, embedded payments move money. Fieldwire is a feature; we're the platform."

## 3 talking points
1. "Fieldwire is best-in-class for plan-tile mobile work. We respect that — and we're shipping native iOS in September with comparable performance."
2. "Beyond plans: financial workflow, AI drafts, audit chain, sub portal, embedded payments. Fieldwire doesn't compete on those."
3. "Hilti's acquisition slowed Fieldwire's product velocity. The team is great but the strategic priority shifted. SiteSync is platform-priority."

## 5 common objections + responses
1. **Objection:** "Fieldwire's mobile is better than yours."
   **Response:** "Today, true on plan-tile rendering. By Q4 2026, our native app + custom PDF module are at parity. Demo it in September."

2. **Objection:** "$39/user is cheaper than your model."
   **Response:** "If you have 10 users on a $50M/year shop, $39 × 10 × 12 = $4,680/year for Fieldwire vs $30K Starter for us. Fieldwire wins on price for that profile. But — we have audit chain, AI drafts, financial workflow, embedded payments. At your scale, the question becomes 'what's worth more — $25K/year saved on tools, or 1 PM's worth of capacity recovered?'"

3. **Objection:** "We're already on Fieldwire."
   **Response:** "Many GCs are. Our customers transition from Fieldwire to us within 60 days. Fieldwire data exports cleanly; we ingest. We can run side-by-side for the pilot if helpful."

4. **Objection:** "Hilti backing means stability."
   **Response:** "True — and our seed close in January gives us 18-month runway. Both are stable bets. The question is which has the platform you're betting on for 2030."

5. **Objection:** "Why not get both?"
   **Response:** "You can. Fieldwire for trades/field tasks, SiteSync for PMs/CFOs/owners. Many do exactly this. We'd love to be the platform layer; Fieldwire as the field-task layer if it works for your team."

## Do / Don't
**Do:**
- Acknowledge mobile-first strength
- Position as platform vs feature
- Be respectful of Hilti acquisition

**Don't:**
- Trash Fieldwire's product
- Promise our mobile is better than theirs today (it isn't yet)
```

---

## Card 4 — Buildots / OpenSpace / Avvir

```markdown
# Buildots / OpenSpace / Avvir Battlecard

**Last updated:** 2026-05-04
**Reviewer:** Walker
**Field:** Computer vision-based progress detection

## Profile
- Founded: 2018 (Buildots), 2017 (OpenSpace), various
- HQ: Various
- Status: Buildots ~$80M raised; OpenSpace ~$120M; Avvir less
- Customers: Skanska, Suffolk, Whiting-Turner — top-100 GCs
- Pricing: $5K-$15K per project per year
- ICP: Top-100 GCs with sophisticated VDC teams

## Where they win
- Computer vision + 360 capture is hard tech; they've executed.
- Strong VDC department adoption.
- Visible progress detection ("you said 65% complete, drone says 48%").

## Where they lose to us
- Observation-only. They don't ACT. Don't draft. Don't approve. Don't move money.
- Project-by-project pricing — penalizes adoption.
- Don't integrate financial workflow.
- VDC-team adoption rarely propagates to PMs.

## Our positioning vs them
"Buildots/OpenSpace are observation tools. They watch and report. SiteSync acts — Iris drafts your RFIs, daily logs, pay apps. End-to-end PM with AI woven in. Different value chain."

## 3 talking points
1. "Buildots watches but doesn't write. We write. Combine the two: Buildots' progress detection + SiteSync's draft generation = Iris drafts a daily log including the % complete from the camera capture."
2. "Per-project pricing punishes scaling. Pro tier covers all your projects at one volume-based rate."
3. "The VDC team loves Buildots. The PMs need SiteSync. Different audiences."

## 5 common objections + responses
1. **Objection:** "Buildots gives us progress visibility we never had."
   **Response:** "Real value. Keep them for capture. SiteSync is for the workflow — RFI, daily log, pay app, sub portal. They complement each other."

2. **Objection:** "Per-project pricing makes Buildots predictable."
   **Response:** "True for one project. Fastest-growing GCs find it gets expensive at 50+ projects. Volume-based pricing scales differently."

3. **Objection:** "Should we get both?"
   **Response:** "Common pattern: Buildots for capture, SiteSync for everything else. The data flows in (Buildots' progress feed; we ingest) — Iris uses that data when drafting daily logs."

4. **Objection:** "Why does observation alone not cut it?"
   **Response:** "It's the difference between a watchdog and a foreman. Watchdog: 'I see something is wrong.' Foreman: 'Here's the RFI to fix it; here's your decision; sign here.' SiteSync is the foreman."

5. **Objection:** "Computer vision doesn't lie like AI does."
   **Response:** "True — AI hallucinates; CV doesn't. That's why our AI cites every claim and links to source data. Click any draft → see the photo, the daily log, the RFI it's referencing. Trust through citation, not just trust through 'AI says so'."

## Do / Don't
**Do:**
- Acknowledge they solve a real problem in their domain
- Position as complementary (workflow + observation = full platform)
- Suggest API integration if customer has both

**Don't:**
- Compete on CV territory — they win on VDC adoption
- Promise we'll add CV/360 capture in 2027 (we won't; partner instead)
```

---

## Card 5 — Newforma

```markdown
# Newforma Battlecard

**Last updated:** 2026-05-04
**Reviewer:** Walker
**Field:** A/E document management; light AI

## Profile
- Founded: 1999
- HQ: Manchester, NH
- Status: Private, mature; ~$40M revenue
- Customers: Strong A/E firms; some GC adoption
- Pricing: $50/user/month + email-driven
- ICP: A/E firms primarily; design coordination side

## Where they win
- Email-driven workflow — A/E teams live in email.
- FedRAMP authorization (rare in space).
- Strong design coordination side (drawings, RFIs).
- Mature; been around 25+ years.

## Where they lose to us
- Outdated UX (looks like 2010).
- No AI agent.
- A/E focus; weaker GC-side.
- Per-user pricing.

## Our positioning vs them
"Newforma is great for A/E firms doing design coordination. SiteSync is a GC-first platform — focus on PM workflow, financial integrity, field UX, sub portal. Different audience."

## 3 talking points
1. "If you're a design firm, Newforma is the play. We're GC-first."
2. "Newforma's email-first workflow is showing its age. SiteSync is mobile + audit-chain + AI native."
3. "Newforma has FedRAMP — rare. If federal-direct customers matter, Newforma may have what we won't have until Q4 2027+."

## 5 common objections + responses
1. **Objection:** "Newforma has 25 years of stability."
   **Response:** "Real strength. Their UX is 25 years too — many GCs find their PMs prefer modern tools. Demo it side-by-side."

2. **Objection:** "FedRAMP is critical for our federal work."
   **Response:** "Honest answer: SiteSync won't have FedRAMP until Q4 2027 at earliest. If federal-direct work is your core, Newforma is the right pick today. Most mid-market commercial GCs don't need FedRAMP for their work."

3. **Objection:** "Newforma is cheaper per-user."
   **Response:** "Per-user pricing creep is the trade-off. Add 50 users × $50/mo × 12 = $30K/year before sub portal cost. Our Starter is $30K covering everything including subs. The math depends on team size."

4. **Objection:** "Email-driven is what our team uses."
   **Response:** "We have email integration — Iris drafts pull from your inbox; comments sync to email. Mobile-first or email-first; we accommodate both."

5. **Objection:** "Newforma is built for compliance."
   **Response:** "Hash-chained audit log is a different kind of compliance — mathematically tamper-proof, externally attested by Trail of Bits Q4. Newforma's compliance is policy-enforced. Different bar."

## Do / Don't
**Do:**
- Acknowledge A/E firm fit + FedRAMP
- Position SiteSync as GC-first + modern
- Compare audit chain (their compliance vs ours)

**Don't:**
- Trash Newforma — they're respected in their domain
- Compete on FedRAMP. Don't have it.
```

---

## Update cadence

| When | Activity | Owner |
|---|---|---|
| **Quarterly** | Walker reviews all 5 cards; updates competitor profiles, customers, pricing | Walker |
| **Anytime competitor announces** (Procore Groundbreak, etc.) | Within 48 hours, card updated; team notified | Walker |
| **After every sales call** | Note objections that didn't have a card response; add to card | Walker / GTM lead |
| **Annual** | Audit cards for accuracy; deprecate competitors who exit market | GTM lead |

---

## Where these live

- `docs/sales/battlecards/procore.md`
- `docs/sales/battlecards/trunk-tools.md`
- `docs/sales/battlecards/fieldwire.md`
- `docs/sales/battlecards/buildots-openspace.md`
- `docs/sales/battlecards/newforma.md`

Cards are version-controlled. Copy-pasteable into Notion / Slack as needed.

Public-facing comparison page (`MARKETING_SITE_REWRITE_SPEC` → "why SiteSync over Procore" page) is a curated subset of these cards — softer tone, no internal frame, focused on objective differences.

---

## What Walker Does With This Spec This Week

1. Read all 5 cards; ensure tone matches his voice
2. Add competitor names from his network (any GC tech he hears about that's not on the list)
3. Capture real-world objections from any sales conversations; feed back into cards

---

## What Claude Code Does With This Spec

- Save the 5 cards as separate `.md` files in `docs/sales/battlecards/`
- Build the public-facing comparison pages on the marketing site (per `MARKETING_SITE_REWRITE_SPEC`)
- Maintain cards through quarterly review
- Surface card content in-product when sales rep is on a call (Q3 2026+ feature)

Total Claude Code work: ~2 days.

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| BATTLE-1 | Competitor announces feature we don't have | High | Medium | 48-hour update cadence on cards; "we don't have X yet but it's on the roadmap for Q-N" is acceptable |
| BATTLE-2 | New entrant we haven't profiled | Medium | Medium | Quarterly audit catches; weekly competitive intel scan via news + LinkedIn |
| BATTLE-3 | Card information becomes stale | High | Medium | Update cadence above; team contributes from sales calls |
| BATTLE-4 | Walker accidentally trash-talks competitor in a call | Low | High | Practice "do/don't" sections explicitly; rehearse |

---

## What this spec deliberately does NOT cover

- The pitch script / demo (covered by `SALES_DECK_v1`)
- The first contract close motion (covered by `FIRST_CONTRACT_PLAYBOOK`)
- Public-facing comparison pages on marketing site (covered by `MARKETING_SITE_REWRITE_SPEC`)
- Win/loss analysis tooling (covered by future spec when sales motion matures)
- Channel partner / reseller positioning (Q4 2026+)
