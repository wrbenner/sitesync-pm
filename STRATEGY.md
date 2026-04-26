# SiteSync PM — Strategy & Vision

> "Best thing to ever hit the construction PM market." This is the plan to make that true. Internal-facing, opinionated, rewritten as reality changes.

**Status:** Phase 1 (pilot-ready, see `docs/mintlify/`) is in flight. Phase 2 (procurement-ready) and beyond live below.

---

## 1. The opportunity

US construction puts $2.0T/year into the ground. ~70% of GCs still run projects on email, Excel, and a binder. The **digitization wave is happening now** but the incumbent — Procore (~$10B market cap, ~$1B ARR, 18,000 customers) — is large, slow, and increasingly hated by the field.

The market wants:

1. **Real AI**, not bolted-on chat. Procore's "AI" is a Q&A bot. Ours is a copilot that drafts RFIs, classifies drawings, extracts schedules from PDFs, narrates daily logs, and surfaces predictive risks.
2. **Mobile that works gloves-on, offline, in basements.** Procore mobile is a desktop port. PlanGrid (Autodesk) is closer but stagnant.
3. **Fast.** Procore takes 6 weeks to onboard. We do it in 1 day.
4. **Open.** Procore is closed-garden, surcharges integrations. We're API-first, with deep, free Procore + Sage + P6 + BIM360 sync.
5. **Per-project pricing**, not per-seat. A GC with rotating subs and 1099s should not pay more for using more humans.

That's the **wedge.**

---

## 2. The moat (uncopyable in 24 months)

A "feature-fight" with Procore is unwinnable. They have more eng, more capital, more sales reps. We win on a different vector. There are **four moats** we build deliberately:

### 2.1 AI moat — earn the data, then the data makes the AI better

- Every RFI drafted in SiteSync trains our RFI-drafter on construction-specific nuance.
- Every drawing uploaded gets title-block extracted, classified by discipline, indexed for AI Q&A.
- Every daily log narrated by AI improves the narration model.
- Once a customer's project history is in the AI's context, switching to Procore means losing the AI assistant. **The data is the moat.**

### 2.2 Field-experience moat — the gloved-thumb wedge

- 56px touch targets, voice capture for daily logs and RFIs, photo-with-GPS, drawing markup that works at 0.5 Mbps, offline queue that survives 8 hours of no-signal in a basement parking garage build.
- Procore can't catch up here without a ground-up rewrite, which they won't do because their 18k customers' habits are anchored to the desktop UX.

### 2.3 Speed moat — onboarding & iteration velocity

- 1-day onboarding (vs Procore's 6 weeks) is a moat because the smaller GC's switch decision is "can I be running my next bid on this?" If yes today, they switch. If 6 weeks, they don't bother.
- Our release cadence is daily. Procore's is quarterly.

### 2.4 Open-platform moat — be the daily driver, sync to Procore

- For the GC that already pays Procore $200k/year and can't switch: we run *on top* of Procore. RFIs/submittals sync bidirectionally. Field crews use our PWA. Procore stays the system of record for owner reporting.
- This neutralizes the switching-cost objection. We get the daily-driver use case (high-frequency UI value) and slowly siphon more workflows.

---

## 3. Competitive map

| Player | What they're best at | Where they're vulnerable |
|---|---|---|
| **Procore** | Brand, scale, owner-side workflows | Mobile, AI, onboarding speed, openness, pricing |
| **Autodesk Construction Cloud (Plangrid + BIM360)** | BIM, drawings, design-side integration | Field workflows, breadth of GC features |
| **Buildertrend** | Residential / smaller GC, sales-funnel features | Commercial scale, AI, integrations |
| **Sage 300 / Viewpoint** | Accounting | UI is from 2008; field UX nonexistent |
| **Microsoft Project / Primavera P6** | Scheduling | Not a PM platform; just a tool |
| **Smartsheet / Airtable + custom** | Flexibility | Not construction-aware; builds itself |
| **Bluebeam Revu** | Drawing markup | Single-purpose; no project lifecycle |

**Our positioning:** "Procore replacement for mid-size GCs who haven't bought yet, daily-driver layer for those who have, and the first AI-native PM platform for everyone else."

---

## 4. Product strategy by horizon

### 4.1 Now → 3 months: prove the wedge with one mid-size GC

Already covered in `docs/mintlify/` and Phase 1 plan. Goal: signed paid pilot with one ENR Top 400 GC, all CI green, MFA + tamper-evident audit + idle timeout, demo project flow live.

**One thing to add to Phase 1 closeout:** a **"Procore connector demo video"** — 90 seconds showing: connect Procore in 30 seconds, RFI created in SiteSync auto-syncs to Procore, response in Procore appears in SiteSync. This single asset opens 10x more doors than any other.

### 4.2 3 → 9 months: become the obvious choice for new ENR Top 400 deals

Distribution + trust + product depth in parallel.

**Trust artifacts (long-pole, calendar-bound):**
- SOC 2 Type I report (months 3–5; auditor + Vanta/Drata).
- Penetration test (month 4–5; CREST or OSCP firm).
- DPA / MSA / Privacy Policy / Terms / SLA via SaaS lawyer.
- Status page at `status.sitesync.app`.
- Public security page / trust center.
- SOC 2 Type II observation window starts in month 5.

**Identity & enterprise readiness:**
- SAML SSO (Okta, Azure AD, OneLogin tested).
- SCIM 2.0 user/group provisioning.
- Per-org tenant settings (idle timeout, MFA enforcement level, audit retention).
- Account lockout already shipped Phase 1; add geographic anomaly detection.
- Org-level tenant-customizable theme/whitelabel (logo, primary color, custom subdomain `acme.sitesync.app`).

**Product depth:**
- Procore integration goes from import-only to **bidirectional, certified** in Procore's marketplace.
- Sage 300 integration certified in Sage's marketplace.
- One additional deep integration — pick from {Autodesk Construction Cloud, Microsoft Project online, QuickBooks Online} based on which 3 customers ask for first.
- Open API v1 — public REST, OpenAPI spec, webhooks for: RFI events, submittal events, change-order events, daily-log events, file events.
- Whitelabel email templates per org.

**AI depth:**
- AI Copilot's project-aware context grows: it can answer "what's the average RFI close time on this project" or "show me all overdue submittals impacting next week's schedule."
- Predictive risk surfacing — schedule slip alerts, budget overrun warnings, RFI ball-in-court ageing alerts.
- AI-drafted weekly owner reports.
- AI daily-log narration that's actually used by 70%+ of supers.

**Quality:**
- Test coverage 43% → 70%, critical money paths 90%+.
- Bundle initial chunk ≤ 1MB.
- ESLint errors → 0 (yes, all 480; this is a focused 3-week effort).
- All E2E specs green & gating merges; expand from 12 to 30 specs covering full critical paths.
- a11y WCAG 2.1 AA compliance verified by external audit.
- Accessibility-AAA on safety-critical screens (daily log, punch list).

**Operational:**
- Per-region data residency: at minimum US-East. EU later when an EU GC asks.
- Connection pooler enabled (one-line change).
- Edge-function rate limiting via Upstash Redis.
- Read replica for reporting queries.
- DR runbook + quarterly drill.
- Sentry + PostHog dashboards on every business-critical event.
- Customer-facing audit log export (give them their data back, they ask less).

**Outcome at month 9:** 3–5 paid mid-size GCs, $200–500k ARR, SOC 2 Type I, pen test cleared, repeatable 4–6 week sales cycle.

### 4.3 9 → 18 months: own the ENR Top 400 segment + start Fortune 500 conversations

**Distribution:**
- 2 sales reps (one US East, one US West).
- 1 customer-success manager.
- Reference customer program: 3 logo'd case studies. Speaking slots at AGC/CMAA events.
- Procore competitive battle card. Win/loss tracking.
- Channel partnership program with construction tech consultants.

**Product depth:**
- SOC 2 Type II report.
- HIPAA BAA on request (not full HIPAA scope, but for healthcare GCs that ask).
- Stripe Connect rollout for GC→sub payments (the wiring is already in `src/services/payments/stripe.ts`).
- Field financials: pay app submission via PWA, retainage tracking, lien-waiver e-sign on the phone.
- Owner portal: read-only project dashboard for the owner, branded to the GC.
- Subcontractor portal: prequal, COI tracking, schedule of values, subcontract execution via DocuSign.
- AI copilot expansions: estimating-assist (parse historical bid data), preconstruction-assist (constructibility review), schedule-assist (dependency suggestions).

**Verticalization:**
- "SiteSync for Multifamily" vertical pack: LIHTC compliance, Davis-Bacon WH-347 already shipped, energy-credit tracking.
- "SiteSync for Healthcare" vertical pack: ICRA, ILSM forms, HIPAA-adjacent data handling.
- "SiteSync for Education": prevailing wage, certified payroll, public-bid procurement.

**International:**
- UK / Australia / Canada: similar regulatory environments. Localize date formats, tax codes, and compliance frameworks.
- Per-region Supabase project for data residency.

**Outcome at month 18:** 30–50 paying customers, $3–8M ARR, SOC 2 Type II, first Fortune 500 LOI signed.

### 4.4 18 → 36 months: regional dominance + Fortune 500 expansion

- Land first 3 Fortune 500 GCs on multi-year contracts.
- Open NYC / Dallas / Toronto offices.
- ISO 27001 certification.
- FedRAMP Moderate path (year 3 only if a government-adjacent customer signs an LOI contingent on it).
- Vertical packs for industrial / data center / infrastructure.
- White-label resale to specialty subcontractor associations.
- AI agent that can autonomously draft RFI responses (subject to human approval) and resolve up to 30% of inbound RFIs without human routing.
- Autodesk-grade BIM viewer integrated end-to-end with the daily-log voice capture so a super can say "the duct on level 3 north quad needs to come down 4 inches" and SiteSync knows what `IfcDuctSegment` they mean.

**Outcome at month 36:** 200+ paying customers, $30–80M ARR, in active negotiation with the major GC owner-platforms (Trimble, Autodesk) about either acquisition or strategic partnership.

---

## 5. The "perfection on every front" operating principles

This is what we hold ourselves to internally. None of these are aspirational. They are pass-fail gates.

### 5.1 Performance

- **First contentful paint ≤ 1.0s** on a mid-tier 4G connection.
- **Time to interactive ≤ 2.0s** on the same.
- **Initial JS chunk ≤ 250KB gzipped.** Currently 130KB; floor stays.
- **Every interaction ≤ 100ms** to visible feedback. Long ops show optimistic UI.

### 5.2 Reliability

- **99.9% uptime** for paying customers. Public status page.
- **Zero unhandled errors in production.** Sentry alerts on the first one in any 24h window, not the 100th.
- **Every database read returns within 200ms p95.** Worst-case logged.

### 5.3 Quality

- **Test coverage ≥ 70%** statements/lines/functions. Critical money paths ≥ 90%.
- **All E2E specs green** before merge.
- **ESLint errors = 0.** Warnings ≤ current floor and only ratchets down.
- **TypeScript no-`as any`** on the writing path. Reading-side casts allowed only with `// type-safe-ok` rationale.
- **Accessibility WCAG 2.1 AA** on every shipped surface; AAA on safety-critical (daily log, safety incident).

### 5.4 Security

- **Tamper-evident audit log** verified nightly. Already shipped.
- **MFA TOTP** mandatory for owner/admin/PM. Already shipped (soft-force).
- **SAML SSO** available on every paid org by month 6.
- **Pen test** cleared by month 5 with no high-severity open findings.
- **SOC 2 Type II** by month 12.

### 5.5 UX

- **Pixel-perfect on iPhone 12+ and iPad.** Tested by hand monthly.
- **Field-tested by a real super on a real job** before any major release. Quarterly site visits.
- **Empty states, loading states, error states** at retail quality on every screen.
- **First-run delight**: every new org lands in a populated demo project with the Maple Ridge sample. Already shipped.

### 5.6 Trust

- **Public trust center** at `sitesync.app/security`.
- **Public SOC 2 / pen test reports** behind NDA.
- **Customer-facing audit log export** so they own their compliance evidence.
- **Vulnerability disclosure** at `security@sitesync.app`, 24h ack, 14d high-severity SLA. Already shipped (`SECURITY.md`).

---

## 6. Distribution

### 6.1 Top of funnel

- **Targeted content for the search terms ENR-Top-400 PMs Google.** "Procore alternative," "construction RFI software," "AIA G702 PDF generator," "WH-347 certified payroll software." 50 articles in the docs site by month 6.
- **YouTube channel** with one 5-minute walkthrough per major workflow. 20 videos by month 9.
- **Conference presence:** AGC, ABC, CFMA, CMAA, ENR FutureTech.
- **Direct outreach** to 100 ENR Top 400 GCs that have signaled dissatisfaction with Procore (quitting Glassdoor reviews, LinkedIn complaints, etc.).
- **Partnership with construction-tech consultants** (Avitru, Sundt Construction Tech).

### 6.2 Mid-funnel

- **Free 30-day pilot** on a real project. Self-serve signup → demo project (already shipped) → 1-click upgrade to a real project.
- **Procore-import migration tool** (build it month 6): we suck in their existing project, RFIs, submittals, COs, drawings via the Procore API. Customer is up and running on real data within an hour.
- **White-glove onboarding** for $25k+/year deals: weekly check-in calls for first 60 days, dedicated CSM after.

### 6.3 Pricing & monetization (locked-in shape)

- **Per-project flat fee, $5–25k/year.**
   - Small project (<$5M, fewer than 10 users): $5k/yr.
   - Mid project ($5–50M): $15k/yr.
   - Large project ($50M+): $25k/yr.
- **Annual upfront, NET 30, ACH preferred.**
- **Stripe Connect transaction fee** for GC→sub payments enabled at month 12: 0.5–1.5%.
- **No free tier.** Free demo project, paid as soon as you start a real one. (Resists Procore-style enterprise discount-grinding.)
- **Multi-project enterprise tier** at $250k+ ACV: unlimited projects, SAML SSO, dedicated CSM, premium SLA.

---

## 7. Org plan

| Quarter | Headcount | Key hires | Burn (rough) |
|---|---|---|---|
| Now | 1 founder + AI copilot | — | $5k/mo |
| +3 mo | 3 (founder + 2 eng) | 2 senior fullstack engineers | $50k/mo |
| +6 mo | 5 | + 1 design, 1 sales | $90k/mo |
| +12 mo | 10 | + 3 eng, 1 CSM, 1 ops | $180k/mo |
| +18 mo | 18 | + sales reps, marketer, designer, eng | $320k/mo |
| +36 mo | 35–45 | scale all functions, 2 EM hires | $700k/mo |

### 7.1 Hiring filters that actually matter

- **For engineers:** has shipped a B2B SaaS to paying customers AS A FOUNDER OR EARLY EMPLOYEE, not just at a megacorp. Construction industry experience a plus, not a requirement.
- **For sales:** sold software to construction-industry buyers. Knows the difference between PM and superintendent and uses both correctly.
- **For design:** has done field-tested mobile UX. Will go to a job site.
- **For ops:** has scaled SOC 2 / SCIM / SAML programs at a 50→500-person company.

---

## 8. Capital plan

### 8.1 Stages

- **Bootstrap to first paying customer** ($25k ARR signed). No outside money. Tightest phase.
- **Pre-seed $500k–1.5M** at first signed pilot ($25k–100k ARR). Use of funds: 2 engineering hires, SOC 2 + pen test ($60–90k all-in), 6 months of runway.
- **Seed $3–5M** at $750k–1.5M ARR with repeatable sales motion. Use of funds: 3–4 more engineers, 1–2 sales, 1 CSM, 12 months of runway, fund Phase 3 product depth.
- **Series A $15–25M** at $5M+ ARR with 3:1 LTV:CAC and net retention >120%. Use of funds: scale sales, second region, vertical packs, FedRAMP path optionally.

### 8.2 What we DON'T raise on

- **Don't raise pre-seed before signed pilot.** Investor leverage is much higher post-traction; pre-traction every fundraise dilutes 30%+.
- **Don't raise on a feature ad-hoc.** Raise only when the next stage is clearly bottlenecked by capital, not strategy or talent.
- **Don't take strategic money from Procore / Autodesk competitors-of-customers.** Anchors expectations and limits future moves.

---

## 9. North-star metrics

Track weekly. Optimize for these in this order.

1. **Daily active GC superintendents** — the field-user-engagement metric. If supers don't log into the PWA daily on a job, the platform isn't doing its job.
2. **Hours saved per project per week** — measured by surveying customers (what was your old workflow, what is it now). Goal: 8+ hours per project per week saved by month 9.
3. **Net revenue retention** — measure at month 12 onward. Target: >120% by month 18 (= existing customers add seats / projects faster than they churn).
4. **Onboarding time-to-value** — signup to "1 RFI submitted on a real project." Target: < 2 hours.
5. **AI copilot weekly active rate** — % of users who interact with the AI at least once per week. Target: >60%.
6. **NPS** — measured quarterly. Target: 50+. (Procore's is around 25.)

Resist the temptation to optimize for vanity metrics: signups, page views, marketing-qualified leads. Real metric is paid usage on real projects.

---

## 10. The next sprint (from today)

Concrete, in priority order. Most can be parallelized once a 2nd engineer is hired.

### 10.1 Week 1–2 (founder solo, before any hire)

1. **Procore-import migration tool MVP.** A button in Settings → Integrations → "Import from Procore" that reads RFIs/submittals/COs from their API and writes into a new SiteSync project. This is the single highest-leverage sales asset.
2. **Procore-connector demo video** (90 seconds, single take, shipped raw).
3. **Public security page** at `/security` route, wired to `SECURITY.md`.
4. **Status page** at `status.sitesync.app` (Better Stack free tier).
5. **One signed paid pilot at an ENR Top 400 GC.** This is the unblock for everything else.

### 10.2 Week 3–6 (first eng hire ramps)

1. **MFA hard-force tier** (after 7-day grace) — completes Phase 1 Track A.
2. **Polish 5 daily-driver screens** (Dashboard, RFI list, Submittals list, Daily Log, Punch List Plan View) to retail-pixel quality. Empty / loading / error states. WCAG AA verified.
3. **E2E: 12 specs to green, +4 critical-path money flows.**
4. **Coverage 43% → 60%.** Focus services + mutation hooks.
5. **Bundle: per-route splits for vendor-three / vendor-ifc / vendor-openseadragon / vendor-fabric.** Target initial ≤ 2MB raw / ≤ 500KB gzip.
6. **First Mintlify articles deployed** at `docs.sitesync.app`.

### 10.3 Week 7–12 (begin Phase 2)

1. SAML SSO + SCIM endpoints.
2. Vanta / Drata / Secureframe contract signed; SOC 2 Type I evidence collection begins.
3. Pen test scheduled.
4. Org-level whitelabel (logo + primary color + custom subdomain).
5. Open API v1 (REST + OpenAPI spec).
6. Procore bidirectional certified.

---

## 11. Things to never do

These are the strategic mistakes that would kill the company. They are tempting and we will resist them.

1. **Don't try to feature-match Procore.** They have 18,000 customers anchoring their roadmap. Following them = always one step behind. Differentiate.
2. **Don't take a Procore-lookalike round.** A copycat investor narrative narrows our defensible vector.
3. **Don't go upmarket before proving repeatable mid-market.** Fortune 500 sales cycles eat 12 months. Burning runway on three Turner conversations before $1M ARR is malpractice.
4. **Don't ship features faster than we can support.** A bad first impression at a GC with 50 supers is unrecoverable. Quality > velocity past a point.
5. **Don't ignore the field.** Every release is field-tested. Every monthly all-hands has a video clip from a real super using the product.
6. **Don't promise SOC 2 / SSO / SLA before they're real.** Customers' lawyers will check.
7. **Don't fight the AI race head-on against OpenAI/Anthropic/Google.** Wrap the best models, don't train them. Construction-domain prompting and project-context retrieval are the moat, not the model.
8. **Don't hire a VP of Sales before $2M ARR.** Founder-led sales until repeatable.
9. **Don't take meetings with Procore or Autodesk strategic.** Tempting; corrosive. They want to learn how to copy you, or buy you cheap.
10. **Don't lose the wedge.** Mobile-field-AI-open-fast is the wedge. Every feature must defend or extend it.

---

## 12. Why this works

Construction is a $2T market, the dominant incumbent has 5% market share, and the field workforce has been waiting for software that respects their time. We have:

- **A real product** (1,500+ tests, real Claude AI, real Procore + Sage integrations, real PWA + Capacitor, AIA G702/G703 PDFs, WH-347 cert payroll, multi-tenant RLS, tamper-evident audit, MFA, idle timeout, account lockout, demo project flow).
- **A defensible wedge** (AI x mobile x speed x openness) that Procore can't copy in 24 months without breaking their existing customers.
- **A market that's actively shopping** because Procore's $1B ARR is built on contracts that mostly renew out of habit, not love.
- **The right entry point** (ENR Top 400 mid-size GC) where the trust bar is lower and the cycle is faster.
- **Per-project pricing** that GCs can authorize without C-suite sign-off.

The platform that wins this market over the next decade will be **the one that the supers actually use, not the one the COO bought.** That's us. Let's build it.

---

*This doc gets updated when reality changes. If you're reading and something looks wrong, fix it in a PR. Don't wait for permission.*
