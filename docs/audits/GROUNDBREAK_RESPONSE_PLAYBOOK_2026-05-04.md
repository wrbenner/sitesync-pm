# Procore Groundbreak Response Playbook

**Date:** 2026-05-04
**Status:** Spec ready. Drafted Sept 1, 2026. Activated within 6 hours of Procore's keynote at Groundbreak Oct 6-8, 2026.
**Companion:** `MARKETING_SITE_REWRITE_SPEC` (where the response page lives), `BATTLECARDS_FRAMEWORK` (Procore card refreshed within 24 hours), `BUGATTI_LAUNCH_ROADMAP` Risk Register #7 (Procore announces embedded payments)
**Format reference:** Tactical playbook + crisis-comms template.

---

## TL;DR

**Procore Groundbreak runs October 6-8, 2026.** Their CEO will announce 2-3 major product moves. Industry-watching media + customers + investors will judge SiteSync's response.

**The playbook:** Pre-draft a response landing page Sept 1 with fill-in-the-blank for whatever Procore announces. Within 6 hours of their keynote, ship the customized version + LinkedIn post + email to prospect pipeline. Calmly, with proof.

**The bar:** "We had a credible counter-positioned response within 6 hours of their announcement." That's industry-watching credibility.

This spec covers: pre-draft template, what to watch for, the 6-hour playbook, the 24-hour follow-up, and the strategic frame.

---

## What's at Stake

Procore Groundbreak is the construction-tech industry's tentpole event. ~10,000 attendees including:
- Procore customers (current + prospective)
- Industry press (Construction Dive, ENR, ConTech Report)
- Investors with construction-tech portfolios
- Competitors (us included, watching)

Procore typically announces:
- 2-3 major product launches or roadmap items
- Customer logos (often a top GC or two)
- Strategic partnerships (banking, AI, design tools)
- Investment / hiring priorities

**The thing we fear most:** Procore announces "Procore AI Daily Logs" with auto-fire and a deposition-grade audit trail. That's our positioning verbatim.

**Why we should plan for this:** Procore has 80+ mobile engineers + a VP of AI hired Q1 2026. They're not asleep. Building toward our positioning is rational.

---

## The Response Strategy

### Three positioning frames available — pick one based on Procore's actual move

#### Frame A: "We've had this since Day 1"

**If Procore announces a hash-chain audit log:**
- Lead with: "SiteSync has had hash-chain audit on every action since 2024."
- Show: migration `20260426000001_audit_log_hash_chain.sql` (2-year-old code)
- Position: Procore is now playing catch-up. We have 2 years of operational data.
- Credibility: Trail of Bits attestation underway; report by October 15 (one week after Groundbreak)

#### Frame B: "We have something they can't copy"

**If Procore announces AI drafts:**
- Lead with: "SiteSync ships embedded ACH payments April 30, 2027. Procore Pay went live 2023; it's locked to their $30K subscription. Ours is part of every Pro+ tier and goes through Modern Treasury rails."
- Show: roadmap timeline + Modern Treasury press release
- Position: AI drafts are the table-stakes future. Embedded payments + free sub portal is the moat.

#### Frame C: "We're the alternative for what Procore doesn't address"

**If Procore announces something orthogonal (e.g., new BIM viewer, new compliance pack):**
- Lead with: "SiteSync is the AI-native challenger Procore can't be. Free sub portal. Hash-chain audit. Embedded payments."
- Show: the wedge math — sub portal cost savings + audit chain trust differentiator
- Position: Procore continues optimizing their 20-year codebase. We're the architecture-native alternative.

### Frame Selection Rules

- **Always lead with our strength**, not their weakness
- **Always cite specific evidence**, not opinion (commits, dates, attestation)
- **Never trash Procore directly** — buyers respect them; trashing reads as insecure
- **Always include a CTA** — "schedule a demo" or "see what makes SiteSync different"

---

## The Pre-Draft (Sept 1, 2026)

By September 1, 2026, the response landing page lives at **`sitesync.com/groundbreak-2026`** with:

```html
<!-- TEMPLATE — fill in Section [X] within 6 hours of Procore announcement -->

<header>
  <h1>[Procore announces X at Groundbreak.] What it means.</h1>
  <p>By Walker, founder, SiteSync — [date of announcement]</p>
</header>

<section>
  <h2>What Procore announced</h2>
  
  [HERE: 200-300 words summarizing what Procore announced.
   Specific. Quote their CEO if attribution helps.
   Acknowledge their strengths + what they got right.
   Don't trash.]
</section>

<section>
  <h2>What we already do</h2>
  
  [HERE: 200-300 words on SiteSync's positioning.
   Lead with specific evidence (commit dates, screenshots, customer quotes).
   Pick one of Frames A/B/C above based on what Procore announced.]
</section>

<section>
  <h2>The wedge: why we win for what matters most</h2>
  
  [HERE: 100-200 words on our actual moat.
   Hash-chain audit attested by Trail of Bits.
   Free sub portal — network-effect math.
   Embedded payments — April 30, 2027 launch.]
</section>

<section>
  <h2>What this means for you</h2>
  
  [HERE: 100-200 words specific to construction PMs reading this.
   "If you're already a Procore customer..." → import path.
   "If you're evaluating..." → 30-day pilot offer.
   "If you've waited..." → here's the moment.]
</section>

<cta>
  <h2>30-day pilot. No commitment.</h2>
  <button>Schedule a Demo</button>
</cta>

<footer>
  <p>Posted [date] within [X hours] of Procore's keynote.</p>
  <p>Walker, SiteSync founder | [LinkedIn] | [Email]</p>
</footer>
```

The template lives at `docs/marketing/groundbreak-template.html`. Engineer + designer review Sept 1; designer mocks up the visual. (planned)

### What's Pre-Built by Sept 1

- Landing page URL: `sitesync.com/groundbreak-2026` (deployed; password-protected until activation)
- Landing page mocked up with placeholder content
- Email template ready in Klaviyo (per existing connector)
- LinkedIn post template ready
- Twitter/X post template ready (more compressed)
- Walker's calendar blocked Oct 6-8 (he's at home/office, NOT traveling, watching the keynote live)
- Backup plan if Walker is unable to respond Oct 6-8 (engineer #2 + GTM lead authorized to ship)

---

## The 6-Hour Window (Oct 6-8, 2026)

Procore's CEO usually announces day 1 (Oct 6) at the keynote (typically 9-10 AM local time).

### T+0 (keynote ends, ~10 AM PST)

- Walker watches keynote LIVE
- Notes specific announcements + quotes + visuals
- Picks Frame A/B/C based on what was announced

### T+1 hour

- Walker drafts the section content (4 sections × 200-300 words = ~1000 words)
- Posts in `#groundbreak-response` Slack for review
- Engineer / designer reviews + makes copy edits

### T+2 hours

- Designer adjusts hero visual if Procore's announcement requires (e.g., new graphic)
- Engineer pushes to staging
- Walker reviews on staging

### T+3 hours

- Final review
- Ship to production
- Activate password-protect off

### T+4 hours

- LinkedIn post by Walker (2-3 paragraphs + link to landing page)
- Twitter/X post by Walker
- Email to prospect pipeline (Klaviyo)
- Email to existing customers (separate cadence — "FYI on industry context")

### T+5 hours

- Battlecard updated (per `BATTLECARDS_FRAMEWORK` quarterly cycle, but accelerated for this)
- Sales team Slack-Connect briefing for prospect pipeline calls

### T+6 hours

- Done. Landing page live. Industry-watching credibility achieved.

---

## The 24-Hour Window (Oct 7)

After the initial response, the next 18 hours:

### Hour 6-12

- Monitor industry press response (Construction Dive, ENR, ConTech Report)
- Track Twitter/X discourse on the announcement
- Identify thought-leader quotes (Procore alumni, industry analysts, customers)

### Hour 12-18

- Walker engages on Twitter/LinkedIn — comments on industry threads
- Battlecard refreshed with specific quotes from Procore customers reacting
- Sales team Slack-Connect: real-time prospect feedback

### Hour 18-24

- Walker + GTM lead review what's resonating
- Refine landing page if needed (subtle changes only — don't pivot)
- Plan Day 2 content (if needed — depends on industry traction)

---

## The 7-Day Window (Oct 6-13)

After the immediate response:

### Days 1-3

- Procore's announcement still echoing
- SiteSync's response landing page accumulating traffic
- Walker monitoring for sales-pipeline impact

### Days 4-7

- Industry analysts publishing follow-up pieces
- SiteSync's positioning solidified (hopefully) as "the AI-native challenger"
- Refresh the response page once more if any new evidence emerges

By Day 7: response is in the rearview. Continue with normal Lap 3 + Q4 work.

---

## What to Watch For (the 5 most-likely Procore announcements)

### Most likely: Procore announces "Procore Agent for Daily Logs"

This is the announcement Walker's been worried about all year. The Field Manual specifically called this out as the "single most credible threat."

**Frame A response:** "We've had Iris Drafted Actions for 18 months." Show the screenshot of our Iris Inbox from 2025. Show Brad's pilot quote. Show the audit chain proof.

### Likely: Procore expands AI features more broadly (Procore Assistant 2.0)

**Frame B response:** "Procore Assist is conversational. SiteSync's Iris drafts contractual artifacts (RFI follow-ups, daily logs, pay apps) with hash-chain provenance and embedded payments. Different bar."

### Likely: Procore announces sub portal upgrades

**Frame C response:** "SiteSync's sub portal is free. Procore charges subs $30K/year for PrimeContract. The math is asymmetric. After 2 projects, your subs ask their next GC for SiteSync."

### Possible: Procore announces hash-chain audit log

**Frame A response:** Direct hit on our positioning. We respond with: "Welcome, Procore. We've had this since 2024." Show evidence. Show Trail of Bits attestation due Oct 15.

### Less likely: Procore announces embedded payments expansion

**Frame B response:** "Procore Pay launched 2023; it's locked to Procore subscriptions and goes through Goldman. SiteSync's Embedded Payments launches April 30, 2027 through Modern Treasury, rails are partner-agnostic, audit-chain proves every dollar. Different model."

### Wildcard: Procore announces something we hadn't anticipated

**Frame C response:** "Procore continues optimizing their 20-year codebase. SiteSync is the AI-native challenger building the architecture you'd build today if you started over."

---

## What If Procore Announces Nothing Major

If Groundbreak is a dud (just incremental updates), we might post a **smaller response** on Day 2-3:

> "Watched Procore Groundbreak. Three incremental updates. None challenges where SiteSync wins: 
> 1. Hash-chain audit (Trail of Bits attesting Oct 15)
> 2. Free sub portal (network effect inversion)
> 3. Embedded payments (April 30 launch)
> 
> If you're a GC waiting on AI-native PM software with court-defensible audit and sub-friendly distribution: 30-day pilot, no commitment."

Smaller post; smaller landing page; same strategy.

---

## Communication Channels

### Inbound

- Walker's email + Slack-Connect with prospects
- Sales team Slack-Connect channel
- Customer support inbox

### Outbound

- LinkedIn (Walker's profile + company page)
- Twitter/X (Walker's account)
- Email to prospect pipeline (Klaviyo)
- Email to existing customers
- Public blog post on `sitesync.com/blog`
- Direct call (not email) to top 3 prospect candidates

### Press

- Industry press (Construction Dive, ENR) — Walker emails the journalist contact directly
- Local press (LA Times, Houston Chronicle if regional angle)
- ConTech Report (specifically follows construction tech)
- Walker's own newsletter / blog

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| GB-1 | Walker is unavailable Oct 6-8 (illness, family emergency) | Low | Critical | Engineer #2 + GTM lead pre-authorized; pre-drafts ready |
| GB-2 | Procore's announcement is so impactful we can't credibly counter | Low-Medium | High | Frame C ("AI-native alternative") works for orthogonal moves |
| GB-3 | Industry rejects our framing as "marketing only" | Low | Medium | Lead with evidence (commits, customer quotes); not opinion |
| GB-4 | Sales pipeline pauses to "wait and see" what Procore ships | Medium | Medium | Direct prospect outreach within 24 hours: "this doesn't change why I built SiteSync; here's the demo" |
| GB-5 | Procore announces something legally similar (e.g., audit chain via different mechanism) | Low | Medium | Trail of Bits attestation + 2 years of production data is our defense |
| GB-6 | Walker overreacts; ships defensive response | Medium | Medium | Pre-drafted templates + cool-headed review by team before publish |
| GB-7 | We need to ship a v0.5 of something faster than expected (e.g., sub portal v1) | Low | Medium | Prioritize per signal; don't panic-ship; document trade-offs |

---

## What Walker Does Pre-Sept 1

1. Block Oct 6-8 on calendar (no travel, no demos)
2. Subscribe to Procore's media list + Groundbreak announcements
3. Identify Procore alumni in network — pre-warn them; ask for thoughts
4. Identify industry analysts (Construction Dive, ENR, ConTech) — pre-build relationship
5. Have engineer #2 + GTM lead briefed on the playbook by Aug 1

---

## What Walker Does Sept 1

1. Activate the response template
2. Test deployment of the pre-built page (in private)
3. Confirm Klaviyo template + LinkedIn template + Twitter/X template are loaded
4. Confirm `sitesync.com/groundbreak-2026` URL is reserved
5. Designer reviews pre-draft for visual polish

---

## What Walker Does Oct 6-8

1. Watch Procore keynote LIVE (don't read others' summaries first; he's the one judging)
2. Pick Frame A/B/C based on what Procore announced
3. Draft section content (1000 words; ~30 min)
4. Push through team review (1-2 hours)
5. Ship the response within 6 hours of Procore's keynote
6. Engage on social channels for the next 12-24 hours
7. Don't panic; don't pivot strategy; don't trash; lead with evidence

---

## What Claude Code Does With This Spec

- Build the landing page template Aug 2026 (~3 days)
- Build the Klaviyo email template (~1 day)
- Build the LinkedIn / Twitter post templates (~0.5 days)
- Build the staging-to-production deployment script (~0.5 days)
- Maintain template freshness through Sept

Total: ~5 days through Aug-Sept 2026.

---

## What this spec deliberately does NOT cover

- Marketing site rewrite (covered by `MARKETING_SITE_REWRITE_SPEC`)
- Battlecard updates beyond the immediate post-Groundbreak refresh (covered by `BATTLECARDS_FRAMEWORK`)
- Long-term competitive intelligence monitoring (year 2 — competitive intel team)
- Press relations strategy (covered by future spec when PR firm engaged)
- Crisis comms beyond Procore Groundbreak (e.g., Procore acquires us; covered separately)
