# GTM.md — Go-To-Market: The Wedge to a Billion

*The code is excellent. This document answers the question Procore investors asked in 2012: "Who pays you first, and how do you turn that into $1B?"*

---

## The Honest Baseline

Procore's path to unicorn:
- Started in 2003 with founder Tooey Courtemanche's family construction business as first customer
- Stayed small ($10-20M ARR) for 8 years, building deeply for GCs
- Hit $50M ARR by 2016 → $1B valuation
- Hit $1B revenue by 2022
- The secret: unlimited users. GCs LOVE unlimited users because construction projects have dozens of stakeholders.

SiteSync's path must be faster because we have better technology and the market is more educated.

---

## The Wedge: Win Multifamily First

### Why Multifamily?
Walker is a GC managing multifamily tax credit projects. He knows this world. The people he knows, trust, and can call TODAY are in this world.

**Multifamily-specific pain points that Procore handles poorly:**
1. **Tax credit compliance** — LIHTC (Low Income Housing Tax Credit) projects have specific documentation requirements (Section 42, HUD requirements) that Procore doesn't handle natively
2. **Owner/investor reporting** — Limited Partners (investors) need specific reports. Procore's owner portal is clunky.
3. **Certified payroll** — Many multifamily projects are on government land and require Davis-Bacon. Nobody has this in PM software.
4. **AIA billing for draw requests** — Construction lenders (banks) need AIA G702/G703 in specific formats. SiteSync already has this built.

**The wedge:**
"SiteSync is the only construction PM platform built specifically for multifamily — with LIHTC compliance, tax credit reporting, and bank draw management built in, not bolted on."

This wedge is unassailable by Procore (too small for them to care about), and it's Walker's home turf.

### ICP (Ideal Customer Profile) — Year 1

**Primary ICP:** GC managing 2-5 active multifamily projects, $5M-$50M annual construction volume, currently using Procore or Excel, frustrated with Procore's pricing and complexity.

**Specifics:**
- Company size: 10-50 people
- Project size: $5M-$50M per project
- Geography: Dallas, Houston, Austin, Atlanta (Sun Belt multifamily boom)
- Tech stack: QuickBooks or Sage, Microsoft 365, maybe Procore or PlanGrid
- Decision maker: Owner/President or VP of Operations
- Pain: Procore costs $30K-$80K/year, requires dedicated admin, subs hate it

**Secondary ICP:** Owner/Developer doing 2-3 projects per year who manages GCs. Wants visibility without managing Procore licenses.

---

## Pricing Model

### The ACV Model (Procore-Inspired, Simpler)

**Base pricing:**
| Annual Construction Volume | Annual Price | Monthly |
|---|---|---|
| Under $10M | $4,800/yr | $400/mo |
| $10M - $25M | $9,600/yr | $800/mo |
| $25M - $50M | $18,000/yr | $1,500/mo |
| $50M - $100M | $30,000/yr | $2,500/mo |
| $100M - $250M | $54,000/yr | $4,500/mo |
| $250M+ | Custom | Custom |

**Included in base:** Unlimited users, unlimited projects, unlimited storage.

**Add-ons (upsell):**
- Embedded payments (Stripe): included in base, SiteSync earns 0.75% platform fee on transactions
- AI Copilot Pro: $500/mo additional (higher model tier, more AI calls)
- White Label: $2,000/mo additional
- Certified Payroll module: $300/mo additional

**Competitive positioning vs. Procore:**
- $50M GC pays Procore $50K-$100K/year
- SiteSync charges $30K/year — 40-70% cheaper
- AND SiteSync makes up the difference on transaction fees
- GC saves money AND SiteSync earns more per customer at scale

---

## The Sales Motion: Land and Expand

### Phase 1: Land (Months 1-6)
**Target:** 10 paying GCs in multifamily, Sun Belt

**How to get them:**
1. **Walker's network first** — He's a GC. He knows 50 GCs personally. Call them. "I built the tool I always wished existed. Try it free for 90 days."
2. **Trade association presence** — Texas Association of Builders, NAHB, NAIOP. These are Walker's conferences.
3. **The Procore migration play** — Target GCs who are Procore customers coming up for renewal. Offer: "We'll migrate all your data from Procore. Free. And charge you half of what Procore charges."
4. **LinkedIn outreach from Walker** — Founder-led sales. Personal story: "I built this for my own projects and it's transformed how we run them."

**Sales pitch (one sentence):** "SiteSync does everything Procore does for multifamily projects at half the price, with AI built in, and your subs love it because we give them free access."

### Phase 2: Expand (Months 6-18)
From each GC customer:
- Subs mandate → 15-50 subs now on the platform free → some become GC customers
- Add the financial module → payment processing → lock-in deepens
- Add the Owner Portal → owners recommend to their next GC
- Upsell to AI Copilot Pro → once they see the AI value, they pay for more

### Phase 3: Explode (Year 2+)
- Category leadership: "SiteSync is the multifamily PM platform"
- Expand to commercial GCs (same product, different wedge messaging)
- Series A: 50+ GCs, $1M+ ARR, 90%+ retention, clear financial services revenue
- The data: "SiteSync processes $X billion in construction payments and manages $Y billion in active projects"

---

## The Investor Narrative

### The Pitch in Three Sentences
"Construction is a $2T industry running on Procore, Excel, and text messages. Procore is a $8B company that charges $100K/year and was built before the iPhone. SiteSync is the AI-native replacement that's field-first, half the price, and builds an embedded financial services layer worth more than the SaaS."

### The Market Math
- $2T construction industry in the US
- Procore addresses maybe 5% of it ($19.8B software market)
- At 0.1% of construction spend, SiteSync capturing 10% of Procore's market = $100M ARR
- At 0.75% transaction fee on $50B in payments processed = $375M financial services revenue
- Total addressable at scale: $475M ARR → 10x revenue multiple = $4.75B valuation

### Why Now
1. Procore's architecture is 20 years old and cannot be rebuilt AI-native
2. Claude Opus 4.6 + GPT-5.4 make AI genuinely useful for construction workflows (not hype)
3. MCP ecosystem means SiteSync can be called by any AI agent
4. Construction AI market growing 31% CAGR
5. Q1 2026: $126M raised in construction tech → market validation at peak

### The Unfair Advantage
Walker Benner built this for his own multifamily projects. He IS the customer. He has 10+ years of domain expertise, relationships with the target customers, and a working product. This is the "founder-market fit" that investors pay for.

---

## The First 90 Days Checklist

- [ ] Deploy to production (Vercel + Supabase live instance) — not GitHub Pages
- [ ] Create demo project seeded with realistic multifamily data (Riverside Tower is already in seed.sql)
- [ ] Record 3-minute demo video (Dashboard → AI Copilot → RFI → Daily Log → Payment)
- [ ] Write the wedge landing page: "The PM platform built for multifamily GCs"
- [ ] Call 10 GCs Walker knows personally — offer free 90-day trial
- [ ] Get 3 GCs live — learn what they actually use
- [ ] Sign first paying customer
- [ ] Raise pre-seed: $1.5M at $8M pre-money (enough for 18 months runway)
