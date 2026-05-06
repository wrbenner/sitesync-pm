# Bugatti Launch Roadmap — Weapon-Grade Edition

**Date:** 2026-05-04
**Author:** Claude (under Walker, asked for "best work — Lockheed Martin standard, not just a tool, a weapon")
**Companion research:** `SOFT_PILOT_GC_RESEARCH_2026-05-04.md` (subagent), embedded ACH partner deep-dive (this doc § 11), construction tech compliance survey (this doc § 4-5), competitive launch playbook synthesis (this doc § 2)
**Supersedes:** the prior 14-program version of this doc (extended to 20 programs + weapon-discipline overlay)

---

## TL;DR (read this first)

Lap 2 close = soft-pilot validation. Lap 3 close = first paid GC. **Neither is a launch.** The actual Bugatti / Lockheed-Martin-grade industry-defining launch is **Embedded Payments v0 + audit chain externally certified, April 30, 2027.**

Between today and that launch are **20 distinct programs across 8 categories**, plus a **weapon-discipline overlay** that changes what "done" means for every one of them. The overlay raises every quality bar — reliability from 3-nines to 4-nines, latency budgets cut by 50%, adversarial red-team built into CI, every screen tested in 95° heat with gloved thumbs, every workflow instrumented with measurable "average user becomes 10x" proof.

**The cumulative pre-flight spec work is ~150 author-days** (vs. ~10 for Lap 2). It does not all happen at once — it happens in 4 quarterly pre-flight blocks (Q3 2026, Q4 2026, Q1 2027, Q2 2027) of ~38 days each, each kicking off the work for that quarter.

**The biggest constraints are not specs and not code.** They are: capital (seed close by Jan 2027), team (engineer #2 by Aug + GTM lead by Oct), and the truth that running money is qualitatively different from running drafts (PCI, MTL, KYB, lien-waiver legal risk, NACHA — every misstep is a Brad-Cameron-walks moment).

This doc is the integrated view. It is also the longest doc in the audit folder. Skim Part 1 and the table at the end of Part 4. Read in depth as work approaches.

---

## Part 1 — The framing change: weapon, not tool

A SaaS-product mindset says: "ship features users want."

A weapon-system mindset says: "build a tool that, when wielded by an average operator, produces output a senior operator could not match without it."

This changes the standard for every decision:

| Dimension | SaaS standard | Weapon-system standard | What changes for SiteSync |
|---|---|---|---|
| Reliability | 99.9% uptime (3 nines) | 99.99% (4 nines) | DR < 1 hr RTO; multi-region active-active by Q1 2027; chaos engineering in CI |
| Performance | "feels fast" | Sub-second on critical surfaces | Capture 1.0s (was 2.0s); Iris draft first token 2.0s (was 4.0s); audit-chain row 100ms (was 250ms) |
| Trust | Don't lose data | Court-defensible artifact for every action | Hash chain on every mutation, externally certified by Oct 2026, signature provenance on every draft |
| Force multiplication | Save time | Make average user out-perform expert without it | Instrumented proof: hours saved per user per week; dollars caught per project; disputes prevented per quarter |
| Field hardening | Mobile-responsive | Battle-tested under adversarial conditions | Tested 95°F, gloved thumbs, direct sunlight, cellular dead zone, dropped device, 12-hr shifts, port-a-potty |
| AI safety | "Best effort" | Calibrated, audited, voice-locked, hallucination-bounded | 0.85 confidence = 85% correct empirically; hallucination rate < 0.5%; voice linter blocks drift; every draft cites or auto-rejects |
| Aesthetic | "Modern" | Lethal calm — every pixel has a job | Visual brand pass: Apple-grade plus military precision; remove every decorative element |
| Operator readiness | "User can figure it out" | Operator certification program | Onboarding is a 14-day training arc; certified-operator badge for PMs; module-by-module proficiency check |
| Cohesion | Modules sit next to each other | Single weapon, kill chain across modules | When Iris drafts a pay app, it pulls daily log + schedule + budget + waivers; when RFI is filed, schedule auto-updates; cross-module is the default, not the exception |
| Adversarial robustness | "Try not to break" | Red-team the platform like a defense contractor | Internal red team Q1 2027: try to break the chain, inject fake citations, cross-tenant data extraction, voice exfiltration, prompt injection |

This is the standard. Every program below is read through this lens.

The narrative that frames the launch:

> "SiteSync isn't a project-management tool. It's the difference between one PM doing two jobs and that same PM doing four. The audit chain means the work is court-defensible. The AI means the boring half of the job is done before the PM gets to her desk. The free sub portal means subs ask their next GC for SiteSync. The embedded payments mean money moves the day the GC approves the pay app. None of that exists anywhere else."

That narrative is the brief for every spec. If a feature doesn't ladder up to it, cut.

---

## Part 2 — What "Bugatti / Lockheed-Martin grade" means in this industry (research-informed)

The competitive landscape research (subagent A807e168) returned the comparator analysis below. Synthesized:

### How the comparators launched

| Company | GA year | At-GA scope | Compliance at GA | Mobile at GA | Sub portal at GA | Reference customers at GA |
|---|---|---|---|---|---|---|
| **Procore** | 2003 (web) → 2014 native iOS → IPO 2021 | Project + financial + quality modules over time. Single web product 2003-2010. | SOC 2 Type II by 2014 era; ISO 27001 added later. | Native iOS 2014. Android 2015. | Acquired Levelset 2021 — sub portal as paid add-on still | 5 GCs at first commercial release; 50+ at Series A |
| **Trunk Tools** | 2022 | Narrow: SMS-agent for specific subcontractor workflows. Then expanded. | SOC 2 Type II within first year. | Web + SMS first; native came later. | No (sub-side comms via SMS to existing phones) | Suffolk, Boldt, JE Dunn at launch (3 named) |
| **Fieldwire** | 2014 | Mobile-first task management on plans. Single sharp wedge. | SOC 2 Type II by ~2018. | iOS + Android native day one (mobile was the wedge). | Free sub access (collaboration default) | 5+ GCs at GA; thousands of small contractors. |
| **PlanGrid** (acquired Autodesk 2018) | 2012 | Drawings on iPads. Single sharp wedge. | SOC 2 Type II within 2 years. | iOS native day one. | Free for collaborators. | A handful of GCs at GA. |
| **Buildots** | 2018 | 360 helmet camera + CV progress detection. Narrow vertical. | SOC 2 Type II by ~2021. | Hardware + iOS app for capture. | No (their model is GC-only insight). | 5-10 GCs in pilot at GA. |
| **OpenSpace** | 2017 | 360 capture + CV. Narrow. | SOC 2 Type II. | iOS app. | No. | Handful in early days. |
| **Newforma** | 1999 (legacy) | A/E document management. Email-driven. | FedRAMP authorization for federal customers (rare in space). | Limited mobile. | No. | Strong A/E firm references; later GC. |

**Universal patterns at GA across credible peers:**

1. SOC 2 Type II at or within 12 months of GA. Non-negotiable.
2. 5–15 deeply-integrated partner integrations at GA, with ERP coverage (Sage 300 / Foundation / Vista / CMiC) being the buyer-required minimum.
3. Native iOS at GA (Android often beta). Web alone = enterprise dealbreaker.
4. **Free sub access** — every credible peer offers this. Charging subs = known anti-pattern that kills network effects.
5. 5–10 named mid-market GC reference logos with case studies. Trunk Tools shipped with 3 (Suffolk, Boldt, JE Dunn).
6. SSO/SAML (Okta, Azure AD), $5M+ cyber insurance, transparent tier-level pricing.
7. **Strategic launch-narrowness.** Every credible peer launched with a deliberately narrow wedge — Fieldwire (mobile tasks on plans), PlanGrid (drawings on iPads), Trunk Tools (SMS agent), OpenSpace (360 capture). They expanded only after the wedge was sticky.

**SiteSync's GA scope is already broader than any peer's at GA** (Iris + hash-chain + free sub portal + embedded ACH). The highest-leverage pre-launch decision is **disciplined narrowing of the non-Iris surface area** — figure out what to NOT ship at GA.

### Industry tentpole calendar 2026-2027

| Event | When | Audience | SiteSync presence |
|---|---|---|---|
| World of Concrete | Jan 19-22, 2027 | 60K+ attendees, conservative concrete trades | Awareness only. Booth too expensive for pre-revenue |
| AGC Annual Convention | March 17-19, 2027 | 2K GC executives | First buyer-presence opportunity. Bring demo + reference customers |
| ENR FutureTech | June 2027 | Tech-forward buyer audience | Post-launch validation. Stage demo. |
| Procore Groundbreak | Oct 6-8, 2026 | Procore's customers + ecosystem | **Don't attend (we're competing). Do publish a Groundbreak-response page Nov 8.** |
| ABC National Convention | Mar 2027 | Open-shop GCs | Skip year 1; revisit year 2 |

### Pricing benchmarks (all rates approximate)

- **Procore:** ~0.3-1% of construction volume per year. Mid-market ACV $50K-$250K. Sub portal as paid add-on (Levelset).
- **Fieldwire:** $39-$79/user/month, transparent published pricing.
- **Trunk Tools:** $50K-$200K per project enterprise pricing.
- **OpenSpace / Buildots:** $5K-$15K per project per year for capture-based services.
- **Procore Pay** (the embedded payments competitor that landed 2023): % of pay-app volume, undisclosed.

**Pricing implication for SiteSync:** "% of construction volume" is the proven mid-market construction pricing model. "Per-seat" caps usability (PMs hide users). "Per-project" works for capture-based tools but not for a workflow-deep PM platform. **Recommend % of construction volume + free sub seats** — competitive with Procore on procurement-friendliness, undercuts Procore's sub-portal monetization. ADR-010 territory.

---

## Part 3 — Where we actually stand

### What's shipped (Lap 1, May 2026)

- 13 stores (down from 33). Subtraction discipline real.
- Money in integer cents end-to-end. Round-half-to-even reconciles.
- Typecheck zero (was 4339 errors). CI gate green.
- Bundle 580 KB cold-path (was 1,468 KB). 102 files.
- First paint 976 ms on CPUx4 mobile. (Below Lockheed-Martin target of 800ms but inside the 1s budget.)
- Hash-chain audit migration shipped + verifier function exists.
- 5 Iris insight detectors (cascade, aging, variance, staffing, weather).
- 5 typed executors (RFI, daily log, pay app, punch item, submittal transmittal).
- Iris approval gate UI exists. Citations render but not yet clickable.
- Single AI chokepoint via `iris-call`. No LLM keys in browser bundle.
- PermissionGate enforced on all action buttons. CI gate.

### What's specced for Lap 2 (just delivered today)

- 8 specs covering scheduled-insights, citations, voice, soft pilot, telemetry, gate, carryover, ADRs.
- 7 new ADRs ratified (003 through 009).
- Migration plan for 10 SQL migrations.
- CI workflow for the Lap 2 acceptance gate.
- Pilot recruit script for Brad Cameron at Nexus + Carleton backup.

### What does NOT exist (the gap)

- SOC 2 readiness: **NONE.** No controls inventory, no policies written, no auditor engaged. Six-month observation window means engagement must start by Sept 2026 to have Type II opinion by April 2027.
- External chain certification: **NONE.** 90-day cycle. Engagement by July 2026 for October report.
- Mobile native iOS: **NONE.** Web-responsive only. App Store cycle is 12-16 weeks minimum.
- Sub portal v0: **NONE.** Field Manual Part IV calls it the wedge. Not built.
- SSO/SCIM: **NONE.** First enterprise prospect dealbreaker.
- Public API + webhooks: **NONE.** Procore has 300+ integrations. We have 0.
- Procore importer: **NONE.** #1 enterprise switching blocker.
- Lien waiver auto-attach: **NONE.** Only Procore Pay does this today.
- COI ingestion + AM Best validation: **NONE.** Differentiator opportunity ("we do this free vs. Procore's $10K/yr add-on").
- OSHA 300/300A/301 logs: **NONE.** Every GC needs this.
- Certified payroll export to LCPtracker: **NONE.** Public-work projects need this.
- Lien waiver state-template library: **NONE.** Top-5 states (CA, TX, NY, FL, IL) cover ~70% of mid-market commercial volume.
- WCAG 2.1 AA + VPAT 2.4: **NONE.** Required for any state/municipal customer.
- CCPA/CPRA + DPA: **NONE.** Required for California users.
- Embedded ACH: **NONE.** This is the launch feature.
- Bilingual UI (Spanish): **NONE.** Crews speak Spanish on most commercial jobs.
- Operator certification program: **NONE.**
- Adversarial red team: **NONE.**
- Marketing site rewrite: **partial.**
- Sales deck / battlecards / MSA / DPA / PR kit: **NONE.**
- Seed deck: **NONE.**

That's the gap. Below: the 20 programs that close it, with weapon-grade requirements applied to each.

---

## Part 4 — The 20 programs (Lockheed-Martin-grade)

### Category A — Compliance & Trust (the "court-defensible" layer)

#### Program 1 — SOC 2 Type II + ISO 27001 (year 2)

**Standard SaaS scope.** Engage Vanta or Drata for evidence collection. Engage CPA firm (PwC, Deloitte, Schellman, A-LIGN — A-LIGN dominates SaaS) for the Type II audit. 6-12 month observation window. ~$30-80K audit fee + $50-150K compliance tooling.

**Weapon-grade additions:**

- **Continuous control monitoring**, not just observation-window. Every SOC 2 control monitored 24/7 with alerting if it drifts. (Most SaaS treats SOC 2 as an annual cosplay; we treat it as continuous discipline.)
- **Public trust report** at trust.sitesync.com. Real-time control status. (Vanta TrustHub style. Procore doesn't have this; we differentiate.)
- **Customer-facing audit log of changes to controls.** When we change a control, customers see it.
- **ISO 27001 by Aug 2027** (year 2). Selling internationally requires it. EU buyers request.
- **NIST CSF mapping** documented alongside SOC 2 (state/municipal RFP often asks for NIST mapping).

**Lead time.** 9 months from engagement to clean Type II opinion (3 mo readiness + 6 mo observation). **Engage by Aug 1, 2026** to have report by April 2027.

**Slip-killer.** Auditor finds gaps in evidence collection late in observation window — restart. Mitigation: complete readiness phase BEFORE observation window starts.

**Acceptance gate (weapon-grade).** Type II opinion in hand by April 1, 2027. Trust report public. Continuous monitoring alerting on every control. ISO 27001 readiness review complete (target audit by Aug 2027).

**Specs needed.** `SOC2_READINESS_SPEC.md` (5 days — control inventory, evidence sources, automation), `TRUST_REPORT_PUBLIC_SITE_SPEC.md` (2 days). 7 author-days.

---

#### Program 2 — Hash chain external certification + cyber insurance + insurance carrier partnership

**Scope.** External cryptographer or Big-4 attestation of the audit chain construction. Cyber insurance + E&O + fidelity bond. Long-game partnership with Travelers/Zurich/Liberty Mutual for builder's-risk discount on SiteSync-documented projects (per Field Manual Part V — the "single most credible accelerator").

**Weapon-grade additions:**

- **Public security white paper** describing chain construction (Merkle structure, ed25519-signed roots, tamper-detection algorithm). Posted at security.sitesync.com. (Defense contractors do this; SaaS rarely does.)
- **Chain integrity bug bounty.** $5K base / $25K for chain-break / $100K for cross-tenant data leak. HackerOne-managed by Q4 2026. (Demonstrates confidence; surfaces real bugs.)
- **Quarterly external chain re-verification** by the auditor (not just annual).
- **Cyber insurance to $10M minimum** (not $5M as I said earlier — weapon-grade).
- **Insurance carrier conversation starts month-1** even though deal isn't possible until 3+ paying GCs exist.

**Lead time.** Chain cert: 90 days. Cyber insurance: 30 days. Carrier partnership: 12+ months from first conversation.

**Slip-killer.** Chain auditor finds a real flaw. Mitigation: Walker walks the chain end-to-end NOW with our own audit; do not surprise the external auditor.

**Acceptance gate.** Chain cert published Oct 15, 2026. Public security white paper live. $10M cyber insurance bound. Bug bounty live by Dec 31, 2026. Carrier MOU by July 2027 (post-launch).

**Specs needed.** `CHAIN_AUDIT_PREP.md` (2 days), `SECURITY_WHITE_PAPER.md` (3 days — Walker reviews, Claude drafts), `BUG_BOUNTY_SCOPE_SPEC.md` (1 day), `CARRIER_OUTREACH_DECK.md` (1 day). 7 author-days.

---

#### Program 3 — Industry-specific compliance (lien waivers, OSHA, certified payroll, WCAG, CCPA)

This is one program with five sub-tracks because they all serve the same goal (regulated-industry table-stakes) and all need to ship by GA.

##### 3.1 — Lien waiver state-template library + auto-attach on payment

**Standard scope.** Generate state-correct conditional/unconditional + progress/final waivers. Top-5 states (CA, TX, NY, FL, IL) cover ~70% of mid-market commercial volume. Levelset (Procore-acquired) is the reference; replicate the auto-attach pattern.

**Weapon-grade additions:**

- **Statutory text exact-match validation** (CA, TX, FL, AZ, MS, WY, UT, NV, GA, MO have statutory forms — wrong text = void waiver = lien rights preserved against GC = lawsuit).
- **Conditional-on-payment waiver attached at payment initiation; converted to unconditional ONLY after ACH settlement webhook.** Never store unconditional waiver until settlement.
- **Chain-of-custody audit on every waiver** — who signed, when, what version of statutory text was current at the time.
- **Auto-rotate when statute changes.** State legislatures amend periodically; library auto-updates from a curated source.

**Acceptance gate.** All 5 top-state forms render exact-statutory-match. Auto-attach mechanic tested with all 4 ACH outcome paths (success, returned, frozen, fraud-flagged). Chain logs every state-version transition.

**Specs.** `LIEN_WAIVER_LIBRARY_SPEC.md` (4 days). `LIEN_WAIVER_AUTO_ATTACH_FAILURE_MODES.md` (2 days — adversarial). 6 days.

##### 3.2 — OSHA 300/300A/301

**Standard scope.** Incident form, 300 log, 300A summary, 301 (privacy fields). Annual e-submission to OSHA ITA (March 2 deadline).

**Weapon-grade additions:**

- **Field-app first.** Super on the slab files an incident in 60 seconds while it's fresh, including auto-captured GPS + photo + crew on-shift.
- **Privacy-field handling reviewed by employment counsel.** 301 has fields that touch PII; mishandling = OSHA fine + employee lawsuit.
- **Auto-generate annual 300A poster** (legally required to post Feb 1).
- **Predictive flag** — Iris notices "your incident rate this quarter is 2.5x your baseline" and surfaces a leading indicator before OSHA does.

**Specs.** `OSHA_LOGGING_SPEC.md` (3 days). 3 days.

##### 3.3 — Certified payroll (LCPtracker export, year 1)

**Standard scope.** Export to LCPtracker CSV. Year 2: native WH-347 federal + state variants.

**Weapon-grade addition:**

- **CSV export validates round-trip with LCPtracker.** Post-import errors flagged in SiteSync, not just by LCPtracker.

**Specs.** `CERTIFIED_PAYROLL_EXPORT_SPEC.md` (2 days). 2 days.

##### 3.4 — WCAG 2.1 AA + VPAT 2.4 + Section 508

**Standard scope.** axe-core in CI. Manual screen reader testing (NVDA + VoiceOver). VPAT 2.4 published. (DOJ's April 2024 NPRM on Title II makes this mandatory for state/local agencies April 2026; their vendors by 2027 = us.)

**Weapon-grade additions:**

- **WCAG 2.1 AAA on color-critical surfaces** (status pills, error states, FAB buttons). Sub workers may be color-blind; trade work is high-stakes.
- **Voice-over operator certification.** Walker navigates the entire app with VoiceOver before GA. If he can't, blind PMs can't.
- **Public accessibility statement** signed by Walker.

**Specs.** `ACCESSIBILITY_AUDIT_SPEC.md` (2 days), `VPAT_2.4_TEMPLATE.md` (1 day). 3 days.

##### 3.5 — CCPA/CPRA + DPA + privacy program

**Standard scope.** Privacy policy, DSAR workflow ("Do Not Sell" trivially N/A but state it), 45-day SLA, DPA template for enterprise customers, GDPR readiness for European subs (yes — even US-only GCs have European equipment vendors uploading submittals).

**Weapon-grade additions:**

- **Privacy controls dashboard** at /admin/privacy showing data inventory, retention, access requests in flight.
- **Customer-controlled data residency** at Q4 2026 (US-east default; US-west option for federal-adjacent).
- **Right-to-erasure preserves chain integrity** by anonymizing PII references, not deleting audit rows. (Already specced in IRIS_TELEMETRY_SPEC ADR-008.)

**Specs.** `PRIVACY_PROGRAM_SPEC.md` (3 days). 3 days.

##### 3.6 — DBE/MBE/WBE + E-Verify + Buy America (year 2 except capture fields)

Field-only capture in year 1; B2GNow integration year 2 if ICP includes public-work GCs.

**Specs.** `PUBLIC_WORK_FIELDS_SPEC.md` (1 day, capture fields only). 1 day.

##### 3.7 — Bilingual UI (Spanish)

**Standard scope.** Spanish translation of every field-facing screen. Crews on most commercial jobs in TX, CA, FL, AZ speak Spanish primarily. **This is table-stakes for any commercial GC south of the Mason-Dixon line.**

**Weapon-grade addition:**

- **Construction-Spanish vernacular review** by a bilingual super in the network (not Google Translate). Trade vocabulary differs by region (Mexican Spanish vs. Cuban Spanish vs. Salvadoran Spanish in different markets).
- **Per-user language preference** with auto-detection from device locale.

**Specs.** `I18N_ARCHITECTURE_ADR.md` (1 day — react-intl vs i18next vs hand-rolled), `SPANISH_TRANSLATION_SPEC.md` (2 days — string inventory + reviewer commitment). 3 days.

**Total Program 3 spec work:** 21 author-days. Spread across 4 quarters; lien waivers + OSHA + WCAG + CCPA + bilingual must land by GA.

---

### Category B — Scale & Reliability (the "Lockheed Martin uptime" layer)

#### Program 4 — Multi-region active-active + DR + chaos engineering

**Standard SaaS scope.** Single-region, daily backups, "we'll figure it out if we go down."

**Weapon-grade scope:**

- **Multi-region active-active** by Q1 2027. us-east + us-west AWS (or Supabase equivalent). Sub-second failover.
- **RTO < 1 hour, RPO < 5 minutes** (Lockheed Martin defense-grade, not consumer SaaS 4-hour RTO).
- **Chaos engineering in CI.** Synthetic kill of every component once per week; assert recovery.
- **Quarterly DR drills** with the entire team. Walker leads first one in Sept 2026.
- **Status page** at status.sitesync.com with public uptime history. Procore doesn't have a public uptime page; we do.
- **SLA 99.99% (4 nines).** Most enterprise SaaS does 99.9% (3 nines). Our customers' projects can't have 8 hours of downtime per year.

**Lead time.** 4 weeks for first DR drill scaffold; 12 weeks for active-active.

**Slip-killer.** A real outage during pilot reveals we have no playbook. Mitigation: write the playbook BEFORE pilot.

**Acceptance gate.** Synthetic regional outage simulated successfully. Chaos-CI catches and recovers from 10 different failure types. Status page live + auto-updating from monitoring. SLA committed in customer agreements.

**Specs.** `RELIABILITY_ARCHITECTURE_ADR.md` (2 days), `MULTI_REGION_FAILOVER_SPEC.md` (4 days), `CHAOS_ENGINEERING_SPEC.md` (3 days), `INCIDENT_RESPONSE_RUNBOOK.md` (2 days), `STATUS_PAGE_SPEC.md` (1 day). 12 author-days.

---

#### Program 5 — Performance budgets (Lockheed-grade tightening)

**Standard SaaS scope.** "Feels fast." Budgets the Field Manual already names: capture 2.0s, inbox 1.2s, Iris 4.0s, PDF 6.0s.

**Weapon-grade scope:**

- **Tighten every budget by 50%.** Capture 1.0s, inbox 0.6s, Iris first token 2.0s, PDF 3.0s.
- **p99 latency budget** in addition to p95. (p99 is what loud customers feel.)
- **Per-tenant budget** — a noisy tenant can't degrade quiet tenants.
- **PR-level budget enforcement** via CI. PRs that regress > 100ms on any budget require explicit owner override + rationale in PR body.
- **Edge function cold-start budget** — < 500ms p95 cold. (Today: untested. Could be 2s+.)
- **Real-user monitoring** by Sentry / Datadog. Not just synthetic.

**Acceptance gate.** All budgets met at p95 AND p99 across 1 week of production traffic. CI fails any PR that regresses.

**Specs.** `PERFORMANCE_BUDGETS_HARDENING_SPEC.md` (3 days). 3 days.

---

#### Program 6 — Multi-tenant scale + unit economics

**Standard SaaS scope.** RLS isolation, "trust the database."

**Weapon-grade scope:**

- **Synthetic load: 1,000 GCs × 5 projects × 100 users concurrent.** (Not 100×3×50 as I said earlier.)
- **Tenant-blast-radius testing.** Run a noisy-neighbor scenario; assert no other tenant is affected.
- **Cost-per-user / per-project unit economics** with a real model. AI cost, infra cost, support cost. Per-tenant gross margin reportable.
- **Anti-abuse rate limits** per tenant. A runaway script can't drain our LLM budget.

**Acceptance gate.** 1000×5×100 load test passes p95 budget. Noisy-neighbor test shows zero cross-tenant impact. Unit economics pager generates per-tenant gross margin in < 30s. Rate limits enforced and tested.

**Specs.** `LOAD_TEST_SPEC.md` (3 days), `UNIT_ECONOMICS_SPEC.md` (2 days), `RATE_LIMITS_SPEC.md` (2 days). 7 days.

---

### Category C — Enterprise Readiness (the "GC IT will sign off" layer)

#### Program 7 — SSO/SCIM + custom roles + sandbox

**Standard SaaS scope.** SAML SSO (Okta, Azure AD, Google Workspace), SCIM provisioning, basic custom roles.

**Weapon-grade scope:**

- **SSO + SCIM tested with three IdP integrations** (Okta, Azure AD, Google Workspace) before GA.
- **Custom role designer** with visual permission matrix. Procore charges enterprise extra for this.
- **Just-in-time provisioning** via SCIM (user shows up in IdP → has the right role in SiteSync within 60 sec).
- **Sandbox environments** with one-click spin-up + fresh seed data for every prospect.
- **Audit log of every permission change.** Required for SOC 2; we do it cleaner.

**Acceptance gate.** Three Okta integrations end-to-end tested. SCIM round-trip verified with real customer IdP. Custom role designer is usable without docs. Sandbox spin-up < 10 min.

**Specs.** `SSO_SAML_SPEC.md` (3 days), `SCIM_PROVISIONING_SPEC.md` (2 days), `CUSTOM_ROLES_DESIGNER_SPEC.md` (3 days), `SANDBOX_ENVIRONMENT_SPEC.md` (2 days). 10 days.

---

#### Program 8 — Public REST API + GraphQL + outbound webhooks + SDK

**Standard SaaS scope.** REST API on top of Supabase RPCs, OAuth, basic webhooks.

**Weapon-grade scope:**

- **REST + GraphQL parity.** GraphQL for complex queries (every PM team's CTO will ask).
- **OAuth 2.0 + API tokens + signed webhooks.**
- **Outbound webhooks for every entity lifecycle event.**
- **Versioning policy** — semver + deprecation calendar, not "we'll figure it out."
- **TypeScript SDK + Python SDK** at GA. (Procore took years to ship official SDKs.)
- **API Explorer** at developers.sitesync.com with live test environment.
- **Rate limit headers + clear errors.** Not 429-with-no-info.
- **Dedicated documentation site** at developers.sitesync.com (Mintlify or hand-rolled).

**Acceptance gate.** API documentation generates from code (OpenAPI spec). SDK published to npm + PyPI. Three reference integrations built end-to-end on the SDK before GA. Versioning policy documented. Developer registration + key issuance < 5 min self-serve.

**Specs.** `API_VERSIONING_ADR.md` (1 day), `REST_API_SPEC.md` (4 days — endpoint inventory + auth + rate limits), `GRAPHQL_SCHEMA_SPEC.md` (3 days), `WEBHOOK_DELIVERY_SPEC.md` (2 days), `SDK_RELEASE_SPEC.md` (2 days), `API_DOCS_PLATFORM_ADR.md` (1 day). 13 days.

---

#### Program 9 — Procore importer end-to-end

**Standard scope.** UI + worker + verification per Reverse-Engineered Milestones.

**Weapon-grade scope:**

- **Field-by-field mapping table** documented + version-controlled. New Procore field appears → mapping row added → tested.
- **Idempotent re-import.** Same Procore project re-imported = same SiteSync state (no duplicates).
- **Incremental sync.** Procore project keeps updating; SiteSync mirrors.
- **Verification report** that shows: imported clean / needed mapping / unmapped (manual review). Customer can read before approving the import.
- **Customer-facing test mode.** Import to a sandbox first; review; promote to production.
- **5K-RFI Procore project imports in < 2 hours with > 95% mapping accuracy.**

**Acceptance gate.** Three real Procore-customer projects imported end-to-end with > 95% accuracy and < 2 hour wall clock. Customer-facing report named every unmapped field. Re-import showed only changed records updated.

**Specs.** `PROCORE_IMPORTER_ARCHITECTURE_SPEC.md` (5 days), `PROCORE_FIELD_MAPPING_TABLE_SPEC.md` (3 days), `PROCORE_API_INTEGRATION_ADR.md` (1 day). 9 days.

---

#### Program 10 — Other ERP / accounting / schedule integrations (year 1: minimum 3)

**Standard scope.** Build integrations one-by-one as customers ask.

**Weapon-grade scope:**

- **Integration framework** — every integration is a typed connector with the same shape (auth, sync, error handling, observability). New connector = filling in interface, not building from scratch.
- **At GA: 3 ERP** (Sage 300/Foundation/Vista). Buyer-required minimum per peer benchmark.
- **At GA: 1 schedule tool** (Primavera P6 XER export/import — XER is the lingua franca).
- **At GA: QuickBooks** for the smaller end of mid-market.
- **At GA: Outlook + Gmail calendar** for meeting capture.
- **By Q3 2027: marketplace** with 10+ partner integrations (per Reverse-Engineered Milestones).

**Acceptance gate.** Integration framework supports any new connector in < 1 engineer-week. 5 integrations live at GA. Each integration has a customer reference confirming production use.

**Specs.** `INTEGRATION_FRAMEWORK_SPEC.md` (4 days), `SAGE_300_INTEGRATION_SPEC.md` (3 days), `PRIMAVERA_P6_XER_SPEC.md` (3 days), `QUICKBOOKS_INTEGRATION_SPEC.md` (2 days), `MARKETPLACE_LAUNCH_SPEC.md` (2 days, Q3 2027). 14 days.

---

### Category D — Field UX & Mobile (the "battle-tested in 95° heat" layer)

#### Program 11 — Mobile native iOS + Android

**Standard scope.** Native iOS via React Native or Swift; Android via RN or Kotlin. App Store review.

**Weapon-grade scope:**

- **ADR-010 — RN vs native.** Recommend RN for shared codebase + native modules where needed (camera, GPS, push). Faster ship, less talent constraint.
- **Native iOS in App Store at GA.** Android beta acceptable at GA, GA in Play Store by Q3 2027.
- **Push notifications** for: new draft in inbox, draft auto-withdrawn, daily standup reminder, payment settled, citation became stale.
- **Offline-first.** This is where the Lap 1 Dexie-defer carryover lands. Field workers in cellular dead zones queue 50+ pending edits + sync on reconnect without conflict.
- **Field-test rig.** Walker + a real super test every screen in: 95°F sun, gloved thumbs, dropped device, dirty screen, 12-hr shift battery, port-a-potty (one-handed). Every screen has a "field-tested" sign-off.
- **App Store Optimization** — listing, screenshots, video preview, keywords. Don't underestimate; affects free downloads.
- **TestFlight beta of 50+ pilot users** before App Store submission.

**Acceptance gate.** App in App Store. Field-test rig sign-off on every screen. TestFlight beta running. Push notifications tested for all 5 trigger types. Offline queue tested with synthetic network kill.

**Specs.** `MOBILE_NATIVE_ARCHITECTURE_ADR.md` (1 day), `IOS_APP_SPEC.md` (4 days), `ANDROID_APP_SPEC.md` (3 days), `PUSH_NOTIFICATIONS_SPEC.md` (1 day), `OFFLINE_FIRST_REWRITE_SPEC.md` (4 days — absorbs Dexie carryover), `FIELD_TEST_RIG_SPEC.md` (2 days). 15 days.

---

#### Program 12 — Sub portal v0 → v1 + COI ingestion (the network-effect wedge)

**Standard scope.** Per Field Manual Part IV.

**Weapon-grade scope:**

- **v0 (Q3 2026):** Magic link, three tabs (Projects + Pay Apps + Documents), read-only on GC side. **10 days build per Field Manual; let's plan 3 weeks to add the COI workflow.**
- **v1 (Q4 2026):** Notifications, multi-GC view, signed-waiver auto-attach.
- **COI ingestion** — sub uploads ACORD 25; AWS Textract or Anthropic vision parses; AM Best API validates carrier rating; expiration tracking; auto re-request 30 days out. **Free for subs (vs. Procore's $10K/yr Insurance Tracking add-on). This is a wedge feature.**
- **Endorsement detection** — additional-insured, waiver-of-subrogation, primary-and-non-contributory. These are the GC's compliance landmines.
- **Magic link + QR onboarding.** Sub gets a card from the GC; scans QR; in-app in 60 seconds; first pay-app submitted in another 60.
- **Spanish UI for sub portal at GA.** Subs are disproportionately Spanish-speaking.

**Acceptance gate.** 5 subs onboarded via magic link in < 2 min each. Each completes one pay-app submit + one COI upload + one waiver download. v1 multi-GC view shows unified My Pay Apps. AM Best validation on 100 test COIs has < 1% false positive (rating valid when it isn't).

**Specs.** `SUB_PORTAL_V0_SPEC.md` (3 days), `SUB_PORTAL_V1_SPEC.md` (4 days), `MAGIC_LINK_AUTH_ADR.md` (1 day), `COI_INGESTION_SPEC.md` (4 days — Textract + AM Best + endorsement detection), `SUB_ONBOARDING_FLOW_SPEC.md` (2 days). 14 days.

---

### Category E — Iris Maturity (the "calibrated AI weapon" layer)

#### Program 13 — Iris extended (cross-project, fine-tune, more executors)

**Standard scope.** Cross-project insights, voice fine-tune Q2 2027, additional executors beyond Lap 3's three.

**Weapon-grade scope:**

- **Cross-project insights live by Q1 2027** (need ≥3 paying GCs to have meaningful learning).
- **Voice fine-tune by Q2 2027** with hold-out eval set + blind A/B (10 PMs pick fine-tuned over base 70%+).
- **Executor catalog by GA**: ~10 executors covering RFI / daily log / pay app / punch item / submittal transmittal (Lap 2-3) + change order draft / schedule re-sequence / safety incident response / weather adjustment / sub follow-up (post-Lap-3).
- **Calibrated confidence.** Every confidence score (0.0 – 1.0) is empirically calibrated weekly against actual outcome. 0.85 means 85% correct, not 70%, not 95%.
- **Executor hardening framework** — every new executor follows the same shape (transactional rollback + 60-sec cancel + 90-day shadow mode + audit row + voice-linted output + citation requirement).

**Acceptance gate.** Cross-project insights demonstrate one real-world signal at the third paying GC. Voice fine-tune passes blind A/B. Executor catalog has 10 executors all in production. Confidence calibration drift report runs weekly + alerts if any kind drifts > 5pp.

**Specs.** `CROSS_PROJECT_INSIGHTS_SPEC.md` (3 days), `EXECUTOR_HARDENING_FRAMEWORK_SPEC.md` (2 days), `VOICE_FINE_TUNE_SPEC.md` (3 days), `CONFIDENCE_CALIBRATION_SPEC.md` (2 days). 10 days.

---

#### Program 14 — Iris cost + latency + fallbacks + adversarial robustness

**Standard scope.** Cost optimization, multi-model fallback.

**Weapon-grade scope:**

- **Per-tenant cost budget** with hard caps + alerts (already in scheduled-insights spec).
- **Multi-model fallback** — Claude → GPT → Gemini if Claude rate-limited. Failover < 500ms.
- **Caching** of expensive operations (grounding context, drawing classification).
- **Prompt injection adversarial testing.** A red team tries to make Iris draft something inappropriate. Failure modes documented; defenses tested in CI.
- **Hallucination bounds.** Iris citations must substring-match source (already in citations spec). Iris draft prose must not assert facts outside the citation set.
- **Voice exfiltration test.** A red team tries to make Iris reveal another tenant's data via prompt manipulation.
- **Cost regression CI** — a PR that increases per-draft cost by > 10% requires explicit override.

**Acceptance gate.** Adversarial test suite green. Cost-per-draft p95 < $0.05 at production scale. Failover tested. Hallucination rate < 0.5% on 1K-draft eval set.

**Specs.** `IRIS_COST_BUDGET_SPEC.md` (2 days), `MULTI_MODEL_FALLBACK_ADR.md` (1 day), `ADVERSARIAL_RED_TEAM_SPEC.md` (3 days — defines the attack surface + the test suite + the cadence). 6 days.

---

### Category F — Money Movement (the actual launch)

#### Program 15 — Embedded Payments v0 (T-0)

**Standard scope.** ACH partner + KYC/KYB + reconciliation. The April 30 launch.

**Weapon-grade scope (informed by ACH partner deep-dive research):**

- **ADR-011 — ACH partner.** Recommend **Modern Treasury + Alloy for KYB + First-Citizens or Cross River as bank partner.** Construction GC-to-sub is high-value, low-volume, reconciliation-heavy, audit-sensitive — exactly MT's sweet spot. Adaptive precedent de-risks. Multi-bank optionality covers SVB scenario. Cost premium ($5-10K/month over Increase) is rounding error against engineering time saved on reconciliation.
- **Multi-rail abstraction** — payment interface allows future swap of partner without app code changes.
- **Wire fallback** for $10K-$500K pay-app sizes (some GCs prefer wire for this range).
- **Same-day ACH default** (NACHA same-day allows $1M per-transaction since 2022).
- **PCI SAQ-A** by tokenizing through MT — never store bank credentials. Drops PCI burden to ~$5K/yr self-attestation.
- **MTL shielding** via partner — written legal opinion before launch (CA DFPI + NY DFS aggressive).
- **Reconciliation engine** — match every bank transaction back to its pay-app. Penny-perfect first 30 days post-launch.
- **Triple-tap confirmation** UX — in-app + email + SMS at send + at settle.
- **Receipt as trust artifact** — names GC, project, pay-app, links to lien waiver PDF (Toast pattern).
- **Pre-onboard subs** before first payment — 3-step KYB with progress saving; never block payment-day on paperwork.
- **One-tap human escalation** for first 3 payments per sub.
- **Lien waiver auto-attach** — conditional at payment initiation; converted to unconditional ONLY after settlement webhook. Chain-of-custody log every state transition. (Per the lien waiver spec in Program 3.1.)
- **Insurance** — fintech E&O rider ($15-40K/yr), cyber to $10M, fidelity bond $1M (often bank-required), crime policy.

**Lead time.** Modern Treasury contracting July 2026 → first push April 2027. Bank partner onboarding is the long pole (60-90 days).

**Slip-killers.** (1) ACH partner declines or asks for $250K balance — start two parallel negotiations from Day 1 (MT + Increase as backup). (2) Hash-chain auditor finds payments-event flaw — walk the chain end-to-end NOW. (3) MTL state regulator (CA, NY) raises issue late — get written legal opinion July 2026.

**Acceptance gate.** A real GC approves a real pay app on April 30, 2027. ACH push fires same business day. Sub receives funds within 1 business day. Lien waiver attached + statutory text validated. Audit chain row covers money movement end-to-end. Reconciliation matches bank statement penny-perfect first 30 days. Multi-bank optionality demonstrated (synthetic failover to backup bank tested in staging).

**Specs.** `ACH_PARTNER_RFP_AND_RECOMMENDATION.md` (3 days — comparison framework + scoring), `EMBEDDED_PAYMENTS_V0_ARCHITECTURE_SPEC.md` (10 days — the largest single spec), `PAYMENT_RECONCILIATION_SPEC.md` (3 days), `KYC_KYB_INTEGRATION_SPEC.md` (3 days), `LIEN_WAIVER_PAYMENT_INTEGRATION_SPEC.md` (2 days), `MTL_LEGAL_OPINION_SCOPE.md` (1 day, then engage outside counsel), `MULTI_RAIL_ABSTRACTION_SPEC.md` (2 days). 24 days.

---

### Category G — GTM Machine (the "narrative + sales infrastructure" layer)

#### Program 16 — Pricing model + commercial framework

**Decision (ADR-012 territory):** **% of construction volume** (proven mid-market construction model — Procore's pattern), with **free sub seats** (network-effect wedge), tiered (Starter / Pro / Enterprise), annual contract default, monthly available with surcharge.

**Standard scope.** Pricing page, tier-gating logic, billing.

**Weapon-grade scope:**

- **% of construction volume** — annualized; tier breakpoints. ICP $50M-$500M revenue → ACV ~$30K-$150K. (Below Procore's $50K-$250K because we're hungrier; differentiates on price for the exact segment.)
- **Free sub seats** — undercuts Procore's sub portal monetization. Lead with this in every sales conversation.
- **Procurement-friendly billing** — NET-30, PO-based, multi-year discounts, renewal calendar, COI request automation (we collect ours from carriers automatically).
- **In-product upgrade flow** — when a customer hits tier-gated feature, friction-less upgrade.
- **Pricing page reads at the 8th-grade level.** No SaaS-jargon. ("$60 for every million dollars of construction you do per year. Subs use it free.")
- **Pricing experimentation framework** — A/B test pricing pages from Day 1. Don't lock in.

**Acceptance gate.** Pricing page live by Day 80 of Lap 3. First contract closes against published pricing without protracted negotiation. Unit economics from Program 6 confirm gross margin > 70% at the Pro tier.

**Specs.** `PRICING_MODEL_DECISION_DOC_AND_ADR.md` (3 days, mostly Walker's call), `PRICING_PAGE_SPEC.md` (2 days), `BILLING_AND_TIER_GATING_SPEC.md` (3 days), `PROCUREMENT_PROCESS_SPEC.md` (2 days). 10 days.

---

#### Program 17 — Marketing + launch infrastructure (the narrative engine)

**Standard scope.** Marketing site + docs + demo + support + onboarding + press kit.

**Weapon-grade scope:**

- **Marketing site rewrite** — category-defining landing page + product pages (Iris, audit chain, sub portal, payments) + "why SiteSync over Procore" comparison page + case study page + customer logo wall + pricing + careers. Built in Next.js or Astro; statically deployed; ≤ 200 KB initial load.
- **Brand visual identity** — "lethal calm" aesthetic. Colors: deep slate, iris gold (the obvious Iris callback), construction safety orange for warnings only. Typography: workhorse — Inter or Söhne, no novelty. Photography: real construction sites, real PMs, no stock photos. Logo: simple, sharp, memorable.
- **Demo video — 90-second + 5-minute + 12-second viral cut** (the Field Manual's 12-second demo).
- **Documentation site** at docs.sitesync.com — Mintlify recommended. User docs + admin docs + API docs + integration guides + security white paper + accessibility statement + status page link.
- **Customer support tooling** — Intercom or Pylon (newer; better for B2B SaaS) for in-app support + helpdesk.
- **Onboarding flow** — in-product tour + sample data + first-week milestones + Slack-Connect channel for first 30 days of every paid customer.
- **Press kit** — logos (PNG + SVG + favicon), product screenshots, exec headshots + bios, founder story, product fact sheet, fundraising history.
- **Procore Groundbreak response landing page** — drafted Sept 1; fill-in-the-blank for whatever Procore announces; finalized within 6 hours of Procore's keynote (Oct 6-8, 2026).
- **AGC Annual Convention booth + content** (March 2027) — first major buyer presence.

**Acceptance gate.** Marketing site live with all core pages by Day 78 of Lap 3. Demo video shipped same day. Press kit downloadable by Oct 31, 2026. Procore Groundbreak response page draft Sept 15. AGC booth assets ready Feb 2027.

**Specs.** `MARKETING_SITE_REWRITE_SPEC.md` (3 days), `BRAND_VISUAL_IDENTITY_SPEC.md` (3 days), `DEMO_VIDEO_SCRIPT_SPEC.md` (1 day), `DOCUMENTATION_PLATFORM_ADR.md` (1 day — Mintlify), `CUSTOMER_SUPPORT_TOOLING_ADR.md` (1 day — Pylon), `ONBOARDING_FLOW_SPEC.md` (3 days), `PRESS_KIT_SPEC.md` (1 day), `GROUNDBREAK_RESPONSE_PLAYBOOK.md` (2 days), `AGC_CONVENTION_PLAN.md` (2 days). 17 days.

---

#### Program 18 — Sales motion + reference customers + funding

**Standard scope.** Deck, battlecards, MSA, references, seed.

**Weapon-grade scope:**

- **Sales deck (customer)** — 12 slides max. Story arc: pain → demo → proof → ask. Built for the 28-year-old PE who'll champion internally.
- **Sales deck (investor)** — 18 slides. Different story: market → wedge → traction → moat → use of funds.
- **Battlecards** — vs Procore, Trunk Tools, Fieldwire, Buildots, Newforma, Autodesk Build. 1-pager each. Lives in `docs/sales/battlecards/`.
- **MSA + DPA + Order Form templates** — lawyer-reviewed. Default 14-day red-line cycle.
- **Reference customer program** — 3 paid GCs willing to do reference calls + named case studies + logo permissions by Oct 31, 2026 (60-day lag from "started using" applies).
- **PR firm engagement** — boutique construction-tech-focused, not big-PR. Engaged by Sept 2026 for pre-launch + launch + Series A.
- **Seed deck** — drafted by Dec 2026 (per Reverse-Engineered Milestones T-150). Investor target list: 30 names, ranked. Meeting cadence: 5 per week starting Dec 1.
- **Series A motion** starts Q3 2027 post-launch traction.
- **Founder operator brand** — Walker writes 1 blog post / week starting Aug 2026. Builds personal narrative + SEO + LinkedIn following. Not optional; this is the recruiting + sales + investor flywheel.

**Acceptance gate.** Sales deck v1 by Day 78. Battlecards live by Day 80. MSA template lawyer-approved by Day 82. 3 reference customers by Oct 31, 2026. Seed close by Jan 30, 2027. Walker's blog has 25+ posts by April 2027.

**Specs.** `SALES_DECK_CUSTOMER_v1.md` + `SALES_DECK_INVESTOR_v1.md` (3 days each = 6), `BATTLECARDS_FRAMEWORK_AND_5_CARDS.md` (3 days), `MSA_DPA_TEMPLATE_REVIEW_NOTES.md` (1 day, mostly lawyer-driven), `REFERENCE_CUSTOMER_PROGRAM_SPEC.md` (2 days), `SEED_DECK_OUTLINE_AND_DRAFT.md` (5 days), `FOUNDER_BLOG_EDITORIAL_CALENDAR.md` (1 day). 18 days.

---

### Category H — Weapon-Discipline Overlay (programs that exist BECAUSE of the framing)

These are 2 additional programs that come from the weapon framing — they don't exist in standard SaaS roadmaps.

#### Program 19 — Operator certification program + onboarding as training arc

**Why this exists.** Lockheed-Martin standard says: average operator becomes 10x version of themselves. The way you achieve that is **deliberate training**, not "the UI is intuitive." We build SiteSync Academy.

**Scope:**

- **14-day onboarding arc** with daily milestones for new PM users. Days 1-3: capture basics. Days 4-7: Iris inbox + first approvals. Days 8-10: citations + voice patterns. Days 11-14: pay-app + sub-portal workflows.
- **Operator certification badge** — PM completes the 14-day arc + a practical exam. Earns a certified-operator badge. Visible to GC leadership; recruitable.
- **Module-by-module proficiency check** — each major surface (Iris Inbox, RFI Detail, Daily Log AutoDraft, Pay App, Sub Portal) has a 3-question "you've used this enough" check that gates feature unlocks (gentle, optional).
- **Video training library** at academy.sitesync.com — 5-min videos per module, narrated by Walker (founder voice = trust).
- **Live training cohort** — once a month, 90-min Zoom with Walker + 20 new PMs + Q&A. Recorded.
- **Certified-operator alumni network** — Slack community for users who've completed the program. Becomes a recruiting + reference pipeline.

**Acceptance gate.** 50 PMs certified by Q1 2027. Live training cohort runs monthly by Sept 2026. Academy site live by Q4 2026.

**Specs.** `SITESYNC_ACADEMY_SPEC.md` (3 days), `ONBOARDING_ARC_14_DAY_SPEC.md` (4 days), `OPERATOR_CERTIFICATION_FRAMEWORK_SPEC.md` (2 days), `LIVE_TRAINING_COHORT_PLAYBOOK.md` (1 day). 10 days.

---

#### Program 20 — Cohesion layer (the "kill chain" — modules as one weapon)

**Why this exists.** Lockheed-Martin standard says: it's a single weapon, not a collection of parts. Every module pulls from every other when relevant. Today the modules sit next to each other (RFI is its own thing, Daily Log is its own thing). Tomorrow, they're one machine.

**Scope:**

- **Kill chain map** — for every workflow, document which modules participate.
   - Pay app: pulls from Daily Log (manpower) + Schedule (% complete) + Budget (line items) + Lien Waivers (state-specific) + Sub Portal (sub's data) + Iris (draft generation) + Audit Chain (provenance) + Embedded Payments (money out)
   - Daily Log AutoDraft: pulls from Photos (timestamps + GPS + AI classifier) + Crew Check-ins (manpower) + Weather API (conditions) + Schedule (work performed mapping) + Iris (narrative)
   - RFI Follow-up: pulls from RFI (history + ball-in-court) + Drawings (referenced sheets + pin location) + Iris (draft) + Citations (provenance)
- **Cross-module instrumentation** — every kill-chain trigger is logged. Walker can answer "when did Iris drafting an RFI follow-up actually update the schedule" with SQL.
- **End-to-end E2E tests** — for each kill chain, one Playwright test covering the entire workflow.
- **Provenance drawer** in the UI — tap any sentence in any draft, see the underlying data sources visualized as a graph.

**Acceptance gate.** Kill chain map documented for all 10 GA-critical workflows. Cross-module instrumentation logging in production. E2E test suite covers 10 kill chains, runs on every PR.

**Specs.** `KILL_CHAIN_MAP_SPEC.md` (3 days), `CROSS_MODULE_INSTRUMENTATION_SPEC.md` (2 days), `PROVENANCE_DRAWER_SPEC.md` (3 days), `E2E_KILL_CHAIN_TEST_SUITE_SPEC.md` (2 days). 10 days.

---

## Part 5 — The 20-program summary

| # | Program | Category | Spec days | Build months | Owner | Slip-killer |
|---|---|---|---|---|---|---|
| 1 | SOC 2 Type II + ISO + trust report | Compliance | 7 | 9 | Walker + outside firm | Auditor finds gaps late |
| 2 | Chain cert + cyber insurance + carrier partner | Compliance | 7 | 12+ | Walker | Auditor finds chain flaw |
| 3 | Industry compliance (lien waivers + OSHA + cert payroll + WCAG + CCPA + bilingual) | Compliance | 21 | 6 | Eng + Walker | First state contract dies on accessibility |
| 4 | Multi-region + DR + chaos | Scale | 12 | 3 | Eng | Real outage during pilot |
| 5 | Performance budget tightening | Scale | 3 | 2 | Eng | Customers feel it before we measure |
| 6 | Multi-tenant scale + unit econ | Scale | 7 | 2 | Eng | Real customer hits wall |
| 7 | SSO/SCIM + custom roles + sandbox | Enterprise | 10 | 2-3 | Eng | First enterprise pilot needs SSO |
| 8 | API + GraphQL + SDK + docs | Enterprise | 13 | 3 | Eng | First integration partner blocked |
| 9 | Procore importer | Enterprise | 9 | 2 | Eng | Procore API rate limits |
| 10 | ERP / accounting / schedule integrations | Enterprise | 14 | 4 | Eng | Buyer requires Sage 300 we don't have |
| 11 | Mobile native iOS + Android | Field UX | 15 | 4 | Eng | App Store rejection |
| 12 | Sub portal v0/v1 + COI ingestion | Field UX | 14 | 3 | Eng | Subs don't onboard |
| 13 | Iris extended (cross-project + fine-tune + executors) | Iris | 10 | 4 | Eng | Fine-tune degrades quality |
| 14 | Iris cost + adversarial | Iris | 6 | 2 | Eng | Prompt injection succeeds publicly |
| 15 | Embedded Payments v0 (Modern Treasury) | Money | 24 | 6 | Eng + Walker | ACH partner declines / chain flaw / MTL surprise |
| 16 | Pricing + billing + procurement | GTM | 10 | 2 | Walker + Eng | Wrong price kills enterprise deals |
| 17 | Marketing + brand + docs + onboarding + support | GTM | 17 | 4 | Walker + Eng + designer | Procore Groundbreak with no response |
| 18 | Sales + references + seed + founder brand | GTM | 18 | 9 | Walker | Seed slips Q4 2026 |
| 19 | Operator certification + Academy | Weapon-discipline | 10 | 3 | Walker + Eng | Customers bounce in week 2 |
| 20 | Kill chain cohesion + provenance | Weapon-discipline | 10 | 3 | Eng | Modules feel like separate apps |
| | **TOTAL** | | **237** | **~10 months elapsed** | | |

237 spec days ≈ 12 months of solo Walker spec writing OR ~12 weeks if Claude Code writes them at this session's pace. Build months overlap heavily; ~10 months elapsed wall clock.

**Critical-path programs (any slip slips everything):** 1, 2, 9, 11, 15, 16, 18.

**Parallelizable (slip absorbed elsewhere):** 3, 4, 5, 6, 7, 8, 10, 12, 13, 14, 17, 19, 20.

---

## Part 6 — Pre-flight calendar

Same pattern as Lap 2: write specs before each quarter, then execute. Four quarterly pre-flights:

### Q3 2026 pre-flight (~Aug 1, 2026 — when Lap 3 closes)

Programs whose build starts Q3: 1 (SOC 2 readiness), 2 (chain cert engagement), 4 (DR), 9 (Procore importer), 11 (mobile native), 12 (sub portal v0), 17 (marketing site), 18 (PR + sales deck v1).

Spec work needed: ~70 author-days. ~7 weeks of Claude Code in parallel sessions, OR ~3.5 weeks if 2x parallel. Walker is bandwidth-constrained because Brad pilot is closing + first-contract closes.

### Q4 2026 pre-flight (~Nov 1, 2026)

Programs Q4: 3 (industry compliance — most of it), 5 (performance), 6 (load), 7 (SSO/SCIM), 12 (sub portal v1), 17 (Groundbreak response — already drafted), 18 (seed deck final).

Spec work needed: ~50 author-days. ~5 weeks Claude Code.

### Q1 2027 pre-flight (~Feb 1, 2027)

Programs Q1: 8 (API + SDK), 10 (ERP integrations), 13 (Iris extended), 14 (adversarial), 15 (Embedded Payments — bulk of build), 16 (pricing live), 19 (Academy launch), 20 (cohesion layer).

Spec work needed: ~80 author-days. ~8 weeks Claude Code.

### Q2 2027 pre-flight (~Apr 1, 2027 — final stretch)

Programs Q2: final hardening on 15 (Embedded Payments), launch readiness verification across all 20.

Spec work needed: ~40 author-days. ~4 weeks Claude Code. Mostly verification + launch checklist + launch playbook.

**Total pre-flight: ~24 weeks of Claude Code spec work over 10 months.** Realistic if Claude Code is engaged consistently.

---

## Part 7 — Capital + team requirements (the brutally honest part)

### Hiring sequence

| When | Hire | Why this date |
|---|---|---|
| **Aug 2026** | Engineer #2 (full-stack, AI-fluent) | Need bodies for Embedded Payments build (Q1 2027). 60-day recruit + 30-day ramp = ready Oct |
| **Oct 2026** | GTM lead (sales-ops + marketing-ops hybrid) | Per North Star Part XIV. Owns marketing site rewrite, demo video, deck iteration, customer pipeline |
| **Dec 2026** | Designer (contract → FT by Q2 2027) | Marketing site rewrite + brand visual identity + product polish + onboarding UX |
| **Jan 2027** | Engineer #3 (post-seed close) | Mobile native iOS + Android + integration framework |
| **Feb 2027** | Customer Success #1 | Soft pilot + first 5 paid GCs need someone other than Walker on Slack |
| **Mar 2027** | Engineer #4 (post-seed) | Embedded Payments hardening + reliability |
| **Apr 2027** | PR contractor / fractional CMO | Launch motion |

### Funding sequence

| When | Event |
|---|---|
| Oct 2026 | First investor meetings (informal advisor conversations) |
| Dec 2026 | Seed deck v1 final |
| Dec 2026 - Jan 2027 | 25-30 investor meetings |
| Jan 2027 | Term sheet target |
| Jan 30, 2027 | Seed closed (target $4-6M, per Reverse-Engineered Milestones) |
| Q3 2027 | Series A conversations begin (post-launch traction) |

### What happens if the hires + funding slip

- **Engineer #2 by Oct slip**: Embedded Payments slips to Q3-Q4 2027. T-0 launch slips. Game-changer narrative slips.
- **Seed by Jan slip**: hiring stalls; engineer #3-4 don't start; Embedded Payments under-resourced; launch slips OR ships under-quality.
- **GTM lead by Oct slip**: marketing site rewrite slips; Procore Groundbreak response is hand-rolled by Walker at midnight; sales motion lacks discipline.
- **Designer slip**: brand visual identity ad-hoc; demo video looks amateur; public narrative weakened.

**Walker is the bottleneck on the human work.** Brad pilot + ADR sign-offs + investor meetings + recruiting + product strategy + spec review = 80+ hr/week. Engineer #2 by August is the single most-important de-risk for the entire 10-month plan.

---

## Part 8 — Risk register (with adversarial scenarios)

| # | Risk | Likelihood | Impact | Owner | Mitigation |
|---|---|---|---|---|---|
| 1 | Soft pilot Day 60 gate fails (acceptance < 70% or PM never says "I don't want to go back") | Medium | Critical (cascades to everything) | Walker | Have backup GC; voice + grounding + citations are the levers; budget 2 weeks extra polish if needed |
| 2 | Engineer #2 hire slips past Oct 2026 | High | Critical (Embedded Payments under-resourced) | Walker | Start sourcing Aug 2026 with concrete role spec; offer equity heavy |
| 3 | Seed round delays past Jan 2027 | Medium | High (hiring stalls; launch slips) | Walker | Two reference customers + 3 paying GCs make seed close in 6 weeks; deck final by Dec 1 |
| 4 | Modern Treasury declines / asks for $250K balance | Medium | High (payments slip) | Walker | Negotiate with Increase in parallel from Day 1 |
| 5 | Hash-chain external auditor finds a real flaw | Medium | High (60-day rework) | Walker | Walk chain end-to-end ourselves NOW |
| 6 | MTL surprise from CA or NY late in build | Low-Medium | High (legal rework + delay) | Walker | Get written legal opinion July 2026 before bank-partner contracts sign |
| 7 | Procore announces embedded payments at Groundbreak (Oct 2026) | Low-Medium | Strategic blow | Walker | Have "what's different" page ready: hash chain + free sub portal + drafts-not-actions |
| 8 | App Store rejects iOS app (privacy / IDFA / IAP rules) | Low | Medium | Eng | Read App Store guidelines week 1 of mobile build; submit for early review |
| 9 | Adversarial test reveals real prompt-injection vector pre-launch | Medium | Medium-High (rework + delay) | Eng | Red-team Q1 2027; multiple prompt-defense layers in scheduled-insights worker |
| 10 | First paid GC churns mid-Q3 2026 | Medium | High (reference customer count drops) | Walker | Have 3+ pilots in flight by Oct, not just 1 |
| 11 | Founder burnout (highly likely given 80+ hr/week through Apr 2027) | High | Critical (diffuse 30+ day slip) | Walker | Engineer #2 must start before Aug; full weekend off after each lap close; outside accountability partner |
| 12 | Lien waiver auto-attach fails legally (waiver attached to payment that didn't clear) | Low | High (sub loses lien rights = lawsuit) | Eng | Conditional-only-until-settlement-webhook pattern; chain-of-custody log; legal review of mechanic before launch |
| 13 | Bug bounty surfaces real cross-tenant data leak in production | Medium | Critical (trust + SOC 2 implications) | Eng | Bug bounty live by Dec 2026 (before scale); RLS audit before bounty opens; bounty payouts pre-approved |
| 14 | AI cost blowup in a single month (runaway script or detector) | Medium | Medium | Eng | Per-tenant daily caps already specced; alerting; cost-regression CI |
| 15 | Voice fine-tune degrades quality on edge cases | Medium | Medium | Eng | Hold-out eval set + blind A/B; rollback button |
| 16 | Mobile native build slips past Q3 2026 | Medium | High (web-only at GA = enterprise dealbreaker) | Eng | RN over native (faster); start build Aug 2026 with engineer #2 |
| 17 | Marketing site rewrite slips past Day 78 of Lap 3 | Medium | Medium | GTM lead + Walker | Hire designer Dec 2026; site has skeleton ready by Sept 2026 |
| 18 | Insurance carrier conversation produces no MOU by July 2027 | High | Medium | Walker | Carrier partnership is post-launch upside, not launch dependency; treat as bonus |
| 19 | Procore acquires us pre-launch with low-ball offer | Low | Strategic | Walker | Don't take meetings with Procore until post-launch; founder integrity > exit |
| 20 | Adversarial use of Iris by a customer to draft something illegal/harmful | Low | High (reputation + liability) | Walker + Eng | Prompt-time + post-process linter blocks; adversarial-content classifier on output; Terms of Service explicit |

---

## Part 9 — What Claude Code starts NOW (this week, parallel with Lap 2 execution)

Per the same pattern as Lap 2 pre-flight: things that must start Q3 2026 have lead time so long that pre-flight specs need to be ready 3+ months ahead. The longest-lead programs — SOC 2, chain cert, ACH partner, mobile native, seed deck, founder brand — all have specs that should land in May-June 2026 even though the build doesn't start until Aug-Oct.

### Immediate (this week, 5 specs in parallel)

| Priority | Spec | Why this week | Effort |
|---|---|---|---|
| 1 | `ACH_PARTNER_RFP_AND_RECOMMENDATION.md` | Modern Treasury contracting in July; need RFP framework + decision criteria + outreach script ready | 3 days |
| 2 | `SOC2_READINESS_SPEC.md` + `SECURITY_WHITE_PAPER.md` v0 | SOC 2 readiness is 3 months before observation window; observation window is 6 months; April 2027 launch means observation starts ~Oct 2026 means readiness starts ~July 2026 means specs needed NOW | 5 + 3 days |
| 3 | `CHAIN_AUDIT_PREP.md` | Walk the chain ourselves before external auditor by July 2026; spec what we look for | 2 days |
| 4 | `SEED_DECK_OUTLINE_AND_DRAFT.md` | 14-week cycle to seed close; deck v0 by June 1 means draft starts now | 5 days |
| 5 | `MOBILE_NATIVE_ARCHITECTURE_ADR.md` | Decision (RN vs native) before any mobile work; build starts Aug; spec/decision needed by July | 1 day |

**Total: 19 author-days of immediate Claude Code work** that runs in parallel with Lap 2 execution. Walker provides decisions (ACH partner top-of-mind, SOC 2 firm preference, seed deck story arc), I write the specs.

### Decisions Walker needs to make this week (top-of-mind answers)

1. **ACH partner gut call** — Modern Treasury (recommended), Increase (cheaper), Stripe Treasury, Dwolla, or do you want me to research other options?
2. **SOC 2 firm gut call** — A-LIGN (SaaS-focused, dominant), Schellman, PwC, Deloitte, KPMG?
3. **Mobile architecture gut call** — React Native shared codebase (recommended for talent + speed) or native Swift+Kotlin (better UX, more code + talent constraint)?
4. **Documentation platform gut call** — Mintlify (modern, recommended), GitBook, Notion, hand-rolled?
5. **Customer support gut call** — Pylon (B2B SaaS native, recommended), Intercom, Crisp, Zendesk, hand-rolled?
6. **Pricing model gut call** — % of construction volume (recommended, Procore-pattern), per-seat, per-project, hybrid?
7. **Bilingual launch — yes for GA, or punt to Q3 2027** (recommendation: yes for GA — Texas/CA/FL/AZ deals require it)?
8. **Seed target** — $4M, $6M, $8M+? Affects deck framing and dilution math.
9. **Series A timing** — Q3 2027 post-launch traction (recommended) or earlier on traction signal?
10. **Walker's blog cadence** — once a week (recommended), twice a month, monthly?

Send me top-of-mind answers like the ADR-003 cron answer; I research + write up + you review.

---

## Part 10 — The honest summary

**Lap 2 close = soft-pilot validation. Not a launch.**

**Lap 3 close = first paid GC. Still not a launch.**

**Q4 2026 = enterprise basics + sub portal + mobile native + Procore importer ship. Closer.**

**April 30, 2027 = Embedded Payments v0 + audit chain certified + 10 paying GCs + reference customers + sub portal v1 + SSO + ERP integrations + SOC 2 Type II + bilingual + WCAG + lien waiver auto-attach + multi-region + sales motion + seed-funded team. THIS IS THE BUGATTI / LOCKHEED MARTIN-GRADE LAUNCH.**

**Beyond launch (Q3-Q4 2027):** Series A on the launch traction. Insurance carrier MOU. Public-sector compliance pack. Integrations marketplace. Voice fine-tune live. Then the real growth motion: 10 → 30 → 100 paying GCs.

**The 90-day plan as written gets us to "first paid GC."** It does not get us to launch readiness.

**The 20 programs in this doc are what's missing.** The pre-flight is ~150 author-days of Claude Code spec work over 4 quarterly pre-flights. The build is ~10 months wall-clock. The capital is the seed close + the team is engineer-2-by-August + founder-discipline-not-burnout.

**The biggest risk is not the software. It is capital, team, and the founder's calendar.** Start Brad outreach. Start the 5 immediate specs. Start engineer-2 sourcing. Start the seed-deck-v0 draft. Start the founder blog cadence. Every week that passes without movement on these four is a week the launch slips.

**This is the plan.** It is achievable. It requires every category to ship. None of the 20 programs is optional for a Bugatti / Lockheed Martin-grade industry launch in construction tech.

April 30, 2027. T-minus 361 days.

The category resets the day this ships.

---

## Appendix A — How this doc was researched

This roadmap integrates findings from three parallel research subagents commissioned May 4, 2026:

1. **Construction tech compliance + regulatory deep-dive.** Sources: AICPA TSC, Vanta/Drata public benchmarks, ADA.gov 2024 NPRM, Section508.gov, ACORD form library, AM Best Business Connect API, AGC AI Resource Center, AIA E207–2024, NIST AI 100-1, CCPA full text, EDPB SCCs, NACHA same-day ACH rules.

2. **Construction tech competitive launch playbooks.** Sources: Procore S-1 (2021), public comms from Trunk Tools / Buildots / OpenSpace / Fieldwire / PlanGrid / Newforma. Synthesized comparator analysis at GA scope, compliance, mobile, sub portal, reference customers.

3. **Embedded ACH partner deep-dive.** Sources: Modern Treasury / Stripe Treasury / Increase / Dwolla pricing pages + ToS, Adaptive (construction back-office) precedent, Procore Pay (Goldman Sachs Transaction Banking) public materials, NACHA same-day ACH 2022 rule changes, MTL state landscape (CA DFPI, NY DFS), Toast / ServiceTitan / Squire / Mindbody / Shopify embedded payments launch case studies.

Plus my own knowledge of: enterprise SaaS readiness, B2B GTM patterns, SOC 2 audit mechanics, mobile native development, industry tentpole calendars, fundraising sequence patterns.

---

## Appendix B — What this doc does NOT cover (deferred / aspirational)

- BIM viewer with WebGPU (Q2 2027+ — Three.js fine until then)
- Cross-tenant Iris insights (Q3 2027+ — needs corpus that doesn't exist yet)
- Native Android (Q3 2027 — beta at GA acceptable)
- AI fine-tuning compute infrastructure (Q2 2027 — addressed in Program 13)
- International expansion (Q4 2027+)
- Schedule engine deep work (parallel 52-week roadmap exists separately at `SiteSync-Schedule-Engine-Strategic-Plan.docx`)
- Drawings rescue plan (parallel 18-day plan exists at `SiteSync_Drawing_Upload_Plan.docx`)
- Insurance carrier MOU (Program 2 — post-launch, year 2 deal)
- Public-sector compliance pack (Q1 2027 per North Star — addressed but not deep-dived here)
- Owner reporting view (Q3 2027 — Procore charges extra; we should bundle but year 2)
- Bid management (use Building Connected by Autodesk; we don't compete here)
- Estimating integrations (use Sage Estimating / ProEst / On-Screen Takeoff via API)
- Drone / 360 capture (year 2; Buildots / OpenSpace own this; partner not compete)
- Job-site IoT (year 3+)
- Iris voice in additional languages beyond Spanish (year 2+)
- White-label / OEM motion (year 3+)
