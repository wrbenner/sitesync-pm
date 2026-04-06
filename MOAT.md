# MOAT.md — SiteSync's Billion-Dollar Moats

*Procore reached $8B valuation not from code quality but from moat architecture. This document defines the 5 moats SiteSync must build — and specifically how to build them before competitors can respond.*

---

## The Honest Truth About Moats

A16Z published "The Empty Promise of Data Moats" — data alone is not a moat. What actually creates billion-dollar defensibility in construction software:

1. **Network Effects** — each new user makes the platform more valuable for all users
2. **Switching Costs** — once embedded in workflows, leaving is painful and expensive
3. **Embedded Finance** — financial infrastructure creates the deepest lock-in of all
4. **Integration Depth** — 300+ integrations means you're the hub everything plugs into
5. **Proprietary Data** — not just more data, but data nobody else can get

---

## Moat 1: The GC → Sub → Owner Mandate

### How Procore Did It
Procore's primary moat: A GC subscribes → mandates that ALL their subcontractors use Procore → subs have no choice. Each GC customer brings 15-50 subs onto the platform for free. Those subs then become leads for GC relationships elsewhere.

**The flywheel:**
- 1 GC = 15-50 subs on the platform
- Subs who use it on one project ask for it on their next project
- Owners/developers demand Procore compatibility from their GCs
- Every new GC customer accelerates growth for all existing customers

### How SiteSync Does It Better
SiteSync's mandate mechanism must be stronger because:
1. GC mandates SiteSync for all subs → but subs get a FREE read-only tier (vs. Procore's paid sub access)
2. Subs can see their payment status, lien waiver requests, submittal approvals WITHOUT paying
3. Owners get a FREE portal to view project progress, budget, schedule
4. Banks/lenders get API access to project financials for construction loans

**The SiteSync mandate chain:**
```
GC (pays $) → mandates → Subs (free tier) → get paid faster via embedded fintech → evangelize SiteSync to their next GC → GC becomes a customer
```

**Implementation in the product:**
- Owner Portal page (already exists in src/pages/OwnerPortal.tsx) — FREE to owners
- Sub portal within the app — FREE read-only access for subs
- `supabase/migrations/00025_portal_access.sql` — already in the schema
- Network effect tracking: PostHog events when a sub accesses the portal

### Why This Beats Procore
Procore charges subs for platform access. We give it away. This accelerates the mandate effect 3x.

---

## Moat 2: Embedded Financial Lock-In

### The Deepest Moat in Software

When you become the financial infrastructure, you cannot be replaced. QuickBooks has survived 30 years because "your accountant uses it and all your data is in there." Once a GC processes $50M through SiteSync's payment rails, switching means:
- Re-onboarding 30 subs to new payment accounts
- Losing 3 years of payment history
- Breaking the lien waiver management workflow
- Losing the retainage tracking across all subs

**The SiteSync financial lock-in sequence:**
1. **Month 1:** GC uses SiteSync for PM. No financial connection yet.
2. **Month 3:** GC connects QuickBooks. Now SiteSync syncs job cost data. Switching would mean re-importing all historical data.
3. **Month 6:** GC starts paying subs through SiteSync (Stripe Connect). 30 subs now have verified accounts.
4. **Month 12:** GC processes $5M through SiteSync. Payment history, lien waivers, retainage all live in SiteSync. Switching is now a multi-month project.
5. **Year 2:** GC's bank uses SiteSync's financial data for construction loan draws. SiteSync is now part of the financing infrastructure.

**Revenue model from financial lock-in:**
- Platform fee: 0.5-1.5% on payments processed through SiteSync
- For a GC doing $50M/year in subs: $250K-$750K revenue to SiteSync from one customer
- Plus the SaaS fee: $50K-$150K/year based on ACV
- **Total from one $50M GC: $300K-$900K/year**

---

## Moat 3: Workflow Habituation

### The Switching Cost Nobody Talks About

The hardest part of switching software isn't the data migration — it's the people. When a superintendent spends 6 months learning how SiteSync's daily log works, the keyboard shortcuts, the voice capture, the photo annotation workflow — every one of those hours is a switching cost. 50 supers × 500 hours each = 25,000 hours of embedded knowledge.

**How to maximize workflow lock-in:**
1. **Custom workflows** — let GCs define their own RFI templates, approval chains, daily log formats. Custom workflows cannot be exported to Procore.
2. **Proprietary keyboard shortcuts** — the Command Palette (`src/components/shared/CommandPalette.tsx`) creates muscle memory unique to SiteSync.
3. **AI training on their patterns** — the shadow mode logger trains on each company's specific patterns. The AI gets smarter FOR THEM, not generically.
4. **The "SiteSync Way"** — written procedures for how GCs should run projects using SiteSync. The procedure is the product.

---

## Moat 4: Integration Hub

### The 300-Integration Problem

Procore has 300+ integrations. Once a GC integrates Procore with QuickBooks, Procore with Sage, Procore with Viewpoint, Procore with their CRM — they're not integrating it with a competitor. Integration moats compound.

**SiteSync's integration strategy:**
1. **Build the critical 10 integrations deeply** (not 300 integrations shallowly):
   - QuickBooks (every small GC uses it)
   - Sage 100/300 (mid-size GC standard)
   - Procore import (migration moat)
   - Microsoft Project / Primavera P6 (schedule import)
   - Autodesk BIM360 (drawing management)
   - Stripe (already built)
   - DocuSign (contract signing)
   - Procore migration (see below)
2. **Make Procore migration the #1 feature** — a one-click import from Procore is how you break Procore's switching cost moat. Every GC who switches from Procore needs their 10 years of project history imported. If SiteSync makes this painless, Procore's data lock-in disappears.

**The Procore migration tool is one of the highest-ROI features in the entire roadmap.** Build it before anything else in the GTM phase.

---

## Moat 5: Proprietary Construction Intelligence

### The Data Asset That Compounds

A16Z is right that generic data moats erode. But SPECIFIC data assets don't. The specific data assets SiteSync can build:

1. **Project performance benchmarks** — what's the average RFI response time for multifamily projects in Texas? What's the typical cost overrun on Type V wood-frame construction? Nobody has this at scale. The Benchmarks page exists (`src/pages/Benchmarks.tsx`) — this is the seed.

2. **Sub reputation database** — which subs consistently deliver on time? Which ones have safety violations? Once 1,000 GCs are rating their subs, this database becomes worth millions. It's a Yelp for subcontractors that nobody has built.

3. **Cost intelligence** — actual material and labor costs from thousands of projects. Not RSMeans (which is based on surveys), but actual invoices processed through the platform. This is more valuable than RSMeans.

4. **Schedule pattern intelligence** — which schedule assumptions consistently fail? Which trade sequences cause delays? With data from 10,000 projects, SiteSync can predict schedule risk better than any human estimator.

**The sequencing:** These data assets cannot be rushed. Build them deliberately by:
- Encouraging data sharing (users opt-in to contribute anonymized data in exchange for benchmark access)
- Designing the data model with analytics in mind from day 1
- Using PostHog to track engagement patterns that reveal construction industry insights

---

## The Moat Building Sequence

| Quarter | Moat | What to Build |
|---------|------|--------------|
| Q1 2026 | Switching Cost | Procore migration tool, deep QuickBooks integration |
| Q2 2026 | Network Effect | Sub portal (free), Owner portal (free), mandate mechanism |
| Q3 2026 | Financial Lock-In | Embedded payments fully live, retainage tracking, payment history |
| Q4 2026 | Integration Hub | 10 deep integrations with migration paths from each |
| 2027 | Data Asset | Benchmark database public, sub reputation scores, cost intelligence |

---

## What Procore Cannot Do

The moats above replicate and extend Procore's. But SiteSync's structural advantage is that Procore CANNOT respond in time:

1. **Their monolith can't go AI-native** — Procore's architecture was designed in 2008. Adding AI is bolted on (Helix). SiteSync's AI is woven in.
2. **Their ACV pricing is a trap** — Procore grows revenue when GC revenue grows. But during downturns, GC revenue drops and Procore's revenue drops with it. SiteSync's embedded fintech revenue (% of transactions) is counter-cyclical — more payments happen when projects are active regardless of revenue.
3. **They can't open their data** — Procore's moat IS the data lock. If they make migration easy, their existing customers can leave. SiteSync can offer the best migration tool because we WANT people to leave Procore.
4. **Their per-project pricing alienates subs** — They charge subs to access projects. SiteSync gives sub access away. This is a $500M revenue moat Procore has built for us to dismantle.
