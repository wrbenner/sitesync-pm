# Pricing Decision Doc + ADR-012

**Date:** 2026-05-04
**Status:** Spec ready. Walker confirms ADR-012 by Day 80 of Lap 3 (~July 2, 2026 tight; Aug 1 baseline). Pricing page live by Day 80; first contract closes against published pricing.
**Includes ADR-012 inline:** % of construction volume + free sub seats, three-tier (Starter / Pro / Enterprise).
**Companion specs:** `SALES_DECK_v1`, `MSA_TEMPLATE_NOTES`, `MARKETING_SITE_REWRITE_SPEC` — all reference this pricing model.
**Format reference:** `LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md`. Decision + rationale + mechanics + edge cases.

---

## TL;DR — ADR-012

**Decision:** **% of construction volume + free sub seats. Three tiers. Annual contract default.**

| Tier | Price | Construction volume covered | Best for |
|---|---|---|---|
| **Starter** | $30K/year flat | Up to $20M/year | Small mid-market commercial GCs ($20-50M revenue) |
| **Pro** | 0.15% of construction volume (annualized), min $50K | $20M-$200M/year | Core mid-market ($50-300M revenue) |
| **Enterprise** | 0.20% of construction volume + custom | $200M+ | Top-100 GCs |

**Free for subs.** Always. Network effect wedge.

**ACV expectation:**
- Mid-market GCs $50-150M revenue → $30K-$50K ACV (Starter or low-Pro)
- Mid-market GCs $150-500M revenue → $75K-$200K ACV (Pro)
- Enterprise > $500M → $250K-$1M+ ACV

**This sits BELOW Procore at every tier** ($50-250K mid-market) and matches Procore's volume-based model that procurement teams already know how to evaluate.

---

## The Decision

### Why % of construction volume (not per-seat, not per-project)

| Model | Pros | Cons | Verdict |
|---|---|---|---|
| **% of construction volume** | Procurement-friendly. Procore-comp. Scales with customer success. Doesn't penalize wide adoption. Easy to communicate. | Requires customer to disclose volume. | **Chosen** |
| Per-seat | Simple. Predictable. | PMs hide users to control cost; users left out = bad UX. Procore-perception is the dominant force here. | Rejected |
| Per-project | Aligns with one-off GC use. | Penalizes long-running projects (a 4-year stadium pays 4x). Deterrent to expansion. | Rejected |
| Per-pay-app processed | Aligns with workflow value. | Variable; procurement can't budget. | Rejected as primary; usage-based on payments OK as add-on |
| % of pay-app volume | Aligns with money-movement value. | Requires customer to share AR data; some won't. | Rejected as primary; OK as Embedded Payments transaction-fee model |
| Hybrid | Optimal in theory. | Sales conversations get tangled. Procurement teams hate ambiguity. | Rejected |

**% of construction volume is what Procore does** ($30K-$250K mid-market = approximately 0.05-0.5% of typical customer's annual volume). Construction CFOs know how to evaluate this. We meet them where they are.

### Why three tiers (not two, not four)

- **Starter** lets us close small GCs without negotiating. Below $20M volume, the % math gets thin and the fixed-fee covers our ops.
- **Pro** is the volume-priced workhorse. Most ARR comes here.
- **Enterprise** is the negotiation tier. Custom because every Top-100 has unique requirements.

Two tiers (Pro + Enterprise) leaves out small GCs who could be lifelong customers. Four tiers adds choice paralysis. Three is the discipline.

### Why free for subs (not paid, not freemium-with-paid-upgrade)

Per Field Manual Part IV — sub portal is the network-effect wedge. The math:

- **Procore charges subs** ~$30K/year for "PrimeContract" sub portal access (or excludes them from full workflow)
- **Subs already use 5+ disconnected portals** for their multiple GC clients (NetVendor, TrackingApp, Procore, Fieldwire, etc.)
- **A free SiteSync sub experience that works across all their GCs** is the moment subs start asking GCs to use SiteSync
- **Each GC who switches because subs requested** = hundreds of free distributed marketing reps

Charging subs would generate $X in sub ARR but cost $10X in GC distribution. The math is asymmetric.

**Free always. No "Pro Sub" tier later. No tiered sub features. Subs get everything.**

### Annual contract default

- Annual contracts: lower churn, predictable revenue, procurement-friendly, sets expectations
- Monthly contracts: high friction (recurring procurement), high churn signal
- Multi-year (2-3 yr): only at Enterprise; meaningful discount (10-15%); locks in customer at growth phase

Default annual; monthly available with 20% surcharge ("flexibility tax"); multi-year at Enterprise only.

---

## What Each Tier Includes

### Starter — $30K/year (or $3.5K/month)

For: small GCs ($20-50M revenue), simple operations, < 50 active projects/year.

**Included:**
- Unlimited GC users
- Iris draft + approval gate
- Hash-chain audit log
- 8 citation kinds (full)
- Voice-locked drafts
- Free sub portal (unlimited subs)
- Up to 5 active projects at any time
- Web app
- Email support, business hours
- 30-day data retention beyond standard 7 years (compliance)

**NOT included:**
- Mobile native iOS/Android (Pro+)
- API access (Pro+)
- SSO / SCIM (Pro+)
- Custom roles (Pro+)
- ERP integrations (Pro+)
- Embedded ACH payments (Pro+)
- Custom workflows (Enterprise)
- Sandbox environments (Pro+)

**Pitch:** "Try the audit chain + Iris on your next 3-5 projects. Upgrade when you outgrow it."

### Pro — 0.15% of construction volume per year (min $50K)

For: core mid-market ($50M-$300M revenue), 10-100 active projects/year.

**Included:**
- Everything in Starter
- Unlimited active projects
- Mobile native iOS + Android
- API access + outbound webhooks
- SSO/SAML (Okta, Azure AD, Google Workspace)
- SCIM provisioning
- Custom roles (visual designer)
- ERP integrations (Sage 300, Foundation, Vista, CMiC, QuickBooks)
- Schedule integrations (Primavera P6 XER, MS Project)
- Sandbox environments
- Embedded ACH payments (Pro+ feature; pay-app processing fees apply — see below)
- Email + chat support, business hours; on-call escalation for critical
- 90-day data retention beyond standard 7 years
- Quarterly business reviews with customer success

**Pricing examples:**
- $100M annual construction volume → $150K ARR
- $200M → $300K ARR
- $500M (just barely Pro) → $750K ARR

### Enterprise — 0.20% of construction volume + custom

For: Top-100 GCs ($500M+ revenue), 100+ active projects/year, regulated requirements.

**Included:**
- Everything in Pro
- Custom workflow builder
- Public-sector compliance pack (Davis-Bacon, certified payroll, DBE/MBE/WBE, Buy America capture)
- Custom data residency (US-east + US-west failover; private cloud option for top-50)
- Dedicated customer success manager + technical account manager
- 24/7 phone + chat support; SLA 99.99% with $$ credits
- Quarterly product roadmap input
- 7-year data retention + extended forensics (chain replay tooling)
- Custom integrations (we build to specification)
- Multi-year contracts with 10-15% discount

**Pricing:** 0.20% of construction volume + negotiated minimums. Floor: $250K. Ceiling: depends on requirements.

**Pricing examples:**
- $500M GC → $1M+ ARR (with Enterprise overhead negotiated)
- $1B GC → $2M+ ARR
- Top-10 GC ($5B+) → $5M+ ARR custom

### Embedded Payments add-on (Pro + Enterprise only, post-launch April 2027)

When GC approves a sub pay app via SiteSync, we push ACH same-day. Sub gets paid faster; GC gets float reduced.

**Pricing:**
- $5 per ACH transaction (flat) + percentage of pay-app value
- Tier 1 ($0-$10K pay-app): 0.25%
- Tier 2 ($10K-$100K): 0.20%
- Tier 3 ($100K-$1M): 0.15%
- Tier 4 ($1M+): 0.10% + custom

These rates are below typical wire fees ($25-50) and competitive with Procore Pay (~0.30% across the board). The competitive advantage isn't price — it's free sub portal + SiteSync's audit chain.

---

## Pricing Page Design

The pricing page reads at the **8th-grade level**:

```
SiteSync pricing.
─────────────────

How it works: pay a small percentage of your annual construction
volume. Subs use it free. No per-seat charges. No surprises.

┌────────────┐  ┌────────────┐  ┌────────────┐
│  Starter   │  │    Pro     │  │ Enterprise │
│            │  │            │  │            │
│  $30K/yr   │  │  0.15% of  │  │  0.20% of  │
│   flat     │  │ construct- │  │ construct- │
│            │  │  ion vol., │  │ ion vol.   │
│            │  │  min $50K  │  │  + custom  │
│            │  │            │  │            │
│  Up to     │  │  Unlimited │  │  Unlimited │
│  5 active  │  │  projects  │  │  + custom  │
│  projects  │  │            │  │  workflows │
│            │  │  Mobile    │  │  Public    │
│            │  │  app       │  │  sector    │
│            │  │            │  │  compliance│
│            │  │  SSO + API │  │            │
│            │  │            │  │  Dedicated │
│            │  │  ERP +     │  │  CSM + TAM │
│            │  │  embedded  │  │            │
│            │  │  payments  │  │  24/7 SLA  │
│            │  │            │  │            │
│  [Start]   │  │  [Talk to  │  │  [Talk to  │
│            │  │   sales]   │  │   sales]   │
└────────────┘  └────────────┘  └────────────┘

       Subs use SiteSync for free, always.

Construction volume = your annual contract revenue. We trust you to
report it accurately; quarterly reconciliation against your audited
financials. Pay annually upfront.
```

**Below the tiers:**

A simple FAQ:
- Why charge by volume not per-user? (because punishing teams for wider adoption is dumb)
- What counts as "construction volume"? (your audited annual contract revenue)
- What if my volume changes? (upgrade or downgrade tier at renewal; mid-cycle pro-rate)
- Are there setup fees? (no)
- Do we share data with subs? (no — subs see only their own slice; RLS enforced at the database)
- Can we self-host? (Enterprise only — private cloud option)

---

## Procurement-friendly mechanisms

- **NET-30** standard
- **PO-based billing** for orgs that require POs
- **Multi-year discount** (5-10% for 2-yr; 10-15% for 3-yr; Enterprise only)
- **Annual auto-pay or invoice** flexible
- **W-9 + COI shareable from Day 1** (we send before they ask)
- **Pricing transparency** — every customer pays the same published rates at their tier; no "discount in exchange for ___" backroom deals
- **Renewal calendar** in their portal: when does their contract renew? what's the price?
- **MSA template** is short (8 pages) and fair; we redline minimally

These reduce procurement friction from "this requires a 3-month negotiation" to "this can be a 30-day cycle."

---

## Anti-patterns we explicitly avoid

- ❌ **Hidden fees** — anything that costs money is on the pricing page
- ❌ **Per-user pricing pretending to be enterprise** — we don't tier by users
- ❌ **Free trial that auto-converts to paid** — we have a 30-day pilot, but it explicitly ends; opt-in to convert
- ❌ **Pricing-page-locked-behind-contact-sales** for Pro tier (Enterprise only)
- ❌ **Percent-of-AI-cost markup** that sneaks into the bill — AI cost bundled
- ❌ **"Standard" sub-portal pricing that gets removed when negotiating Enterprise** — sub portal is always free
- ❌ **Complicated tier matrix with 30 features and 4 tiers** — three tiers, clear differentiation
- ❌ **Annual price increases without warning** — always 30-day notice for any change

---

## Customer-by-customer pricing math

### Brad's pilot → first paid contract (target: Aug 2026, Lap 3 close)

Nexus Companies — likely ~$50M-$150M revenue (Brad is Technical Director, Dallas-based).

- If $80M revenue: $30K-$120K ACV potential
- Starter or Pro? Pro likely (need mobile + API + SSO for an actual workflow customer)
- Targeted ACV: **$120K** (0.15% × $80M = $120K)

That's the first paid contract. Nice and clean.

### Three reference customers (target: Oct 31, 2026, Reverse-Engineered T-180)

- Brad pilot conversion (above): $120K ACV
- Carleton Companies (multifamily LIHTC): ~$50M-$100M revenue × 0.15% = $75K-$150K ACV
- Third reference: TBD; aim for similar Pro tier customer

Three reference customers = $300K-$450K ARR. Real revenue.

### 10 paying GCs by Jan 2027 (Reverse-Engineered T-100)

Mix of Starter + Pro:
- 3 Starter ($30K each) = $90K
- 6 Pro (avg $100K each) = $600K
- 1 Enterprise (negotiated $250K) = $250K
- **Total: ~$940K ARR by Jan 2027**

This anchors the seed close conversation. **$940K ARR + Embedded Payments launch April 30** is a strong signal.

### Year 2 targets (post-Series A, post-launch April 2027)

- 30 paying GCs by July 2027 (3x growth in 6 months)
- 100 paying GCs by April 2028 (anchor for Series A)
- Average ACV grows to ~$150K (mix shifts toward Pro/Enterprise)
- **Year 2 ARR: $15M+**

Series A target: $25M raise at ~10x ARR multiple = $250M post-money valuation. (Vertical SaaS with Embedded Payments + audit-chain moat → 10x is achievable.)

---

## Pricing Experimentation Framework

Don't lock in pricing forever. Test:

- **A/B pricing pages** from Day 1. Half visitors see version A, half version B. Track conversion to "talk to sales."
- **Discount experiments** in sales calls. Track close rate by discount %. Find the elasticity.
- **Tier-up experiments**. Some customers will start on Starter and naturally need Pro. Track upgrade rate by month.
- **Multi-year discount experiments**. Are 10% and 15% the right cliffs? Maybe 7% and 12%.

Keep an experimentation log: `docs/audits/pricing-experiments/<date>.md`. Shipping pricing changes always has a written rationale.

---

## Free Pilot vs Paid Pilot Decision

For Brad / Carleton / first paid customers we currently run **free 14-day pilots** (per Soft Pilot Playbook).

Post-Lap-3, the pilot model evolves:
- **First 5 paid customers**: structured 30-day pilot with payment due at end (60-day NET-30 invoice from contract signing)
- **Customers 6+**: 14-day free pilot OR direct paid signup; customer choice
- **By Q1 2027**: free pilot tier is removed; everyone pays from Day 1 (with 30-day money-back if they're unhappy)

This protects sales-cycle ARR conversion as we scale.

---

## Pricing for the Sub Portal (always free, but tracking)

Subs use SiteSync free. We track sub usage as a leading indicator:
- Sub onboards to SiteSync via magic-link from a paying GC → +1 to "sub adoption"
- Sub uses the portal across 2+ GCs → +1 to "network effect"
- Sub asks a non-paying GC to put them on SiteSync → conversion event

These metrics inform Series A narrative ("our product has X subs across Y states asking GCs to switch").

---

## What Walker Does With This Spec This Week

1. Read the ADR-012 decision; confirm or push back
2. Stress-test the pricing model by walking through Brad's hypothetical contract:
   - Brad's revenue range
   - Volume-based pricing math
   - What pushback might Brad have? What's the response?
3. Validate the "free for subs" decision against the seed deck story (this is the wedge — must be airtight)
4. Decide whether to publish full pricing transparency (Starter + Pro published; Enterprise "talk to sales") or keep all behind contact-sales until Day 80

---

## What Claude Code Does With This Spec

- Build the pricing page UI (Day 78-80 of Lap 3 — `MARKETING_SITE_REWRITE_SPEC` covers)
- Build tier-gating logic in the app (Pro features check `is_pro_tier(org_id)` at runtime)
- Build billing integration with Stripe (subscription model + per-volume true-up)
- Build self-serve "Start with Starter" flow (Pro and Enterprise still talk-to-sales)

Total Claude Code work: ~5 author-days for pricing-page + tier-gating + billing.

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| PRICE-1 | "% of volume" feels like Procore-clone; loses differentiation | Low-Medium | Medium | Lead with "free for subs" + "pay only what you grow" — different framing |
| PRICE-2 | Enterprise customers ask for per-seat (familiar Procore model) | Medium | Low | Educational sales — show the math; if needed, offer per-seat as Enterprise customization |
| PRICE-3 | Free sub portal cannibalizes Pro upgrade pressure | Low | Low | Pro features (mobile native, API, ERP) are GC-side; sub usage is orthogonal |
| PRICE-4 | Volume reporting fraud (customers underreport) | Low | Medium | Quarterly reconciliation against audited financials; trust-but-verify |
| PRICE-5 | Pro min $50K too high for some mid-market | Medium | Low | Starter tier covers; Pro is correct floor for a workflow customer |
| PRICE-6 | Embedded Payments transaction fees feel high | Low | Low | Below Procore Pay; well-marketed against wire fees |
| PRICE-7 | Customers churn at renewal because price grew with their volume | Low-Medium | Medium | Renewal-conversation playbook; show the value-per-dollar math |
| PRICE-8 | Discount slippage in sales calls | Medium | Medium | Walker holds the line; published rates the same for everyone; no backroom deals |

---

## What this spec deliberately does NOT cover

- Pricing page implementation (covered by `MARKETING_SITE_REWRITE_SPEC`)
- Billing system implementation (Stripe configuration; covered by separate `BILLING_AND_TIER_GATING_SPEC` if needed)
- Sales motion (covered by `SALES_DECK_v1` + `FIRST_CONTRACT_PLAYBOOK`)
- Embedded Payments transaction fee details (covered by `EMBEDDED_PAYMENTS_V0_ARCHITECTURE_SPEC`)
- Year-3+ pricing evolution (revisited Q1 2027 + Series A close)
- Channel partner / reseller pricing (deferred year 2)
