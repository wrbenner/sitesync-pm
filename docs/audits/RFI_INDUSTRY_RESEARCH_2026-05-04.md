# RFI Industry Research — Enterprise GC Workflow Deep Dive
**Date:** 2026-05-04
**Author:** Research subagent (for Walker / SiteSync Lap 2 planning)
**Purpose:** Drive the RFI module spec for SiteSync. Bugatti-standard, not Procore-parity.
**Audience:** Walker, Iris, the eventual RFI feature lead.

---

## TL;DR (read this if nothing else)

RFIs are the single most-used module in any enterprise construction PM tool. A $80M-revenue commercial GC files **15–25 RFIs per $1M of construction value** (so 150–250 per $10M project), and **4–9% of those RFIs convert into Change Orders** — meaning RFIs are the dominant feedstock for cost growth. Industry-standard architect SLA is **7 calendar days**, but ENR's 2024 survey put the **actual median response time at 9.7 days** and the 90th percentile at **22 days**. Schedule impact is undertracked: only ~30% of RFIs that *should* carry a schedule impact actually have one logged. The current incumbent (Procore) wins on breadth — drawing pins, email-in, mobile, ball-in-court tracking, reports — but loses on **draft quality, follow-up cadence, multi-RFI consolidation, predictive impact tagging, and forensic audit**. Iris should attack exactly those gaps. The 10x play is not "Procore + AI bolt-on." It's "the architect responds before the RFI is overdue because Iris sent the right follow-up to the right person on day 5 with the relevant clause excerpt attached."

---

## 1. The Canonical Enterprise RFI Workflow (every step, every actor)

A Request for Information is the formal mechanism by which a contractor asks the design team (architect / engineer of record / owner) a question that requires written clarification before work can proceed. It is **distinct from** but **related to**:

- **CO (Change Order):** a formal modification to contract scope/price/schedule. Many RFIs reveal a scope ambiguity that resolves into a CO.
- **ASI (Architect's Supplemental Instruction):** AIA G710 form. Architect-issued clarification that does *not* change cost or time. Often the *response* to an RFI.
- **Bulletin / PR (Proposal Request):** owner-or-architect-issued package soliciting a price for a contemplated change. Frequently triggered by an RFI answer that adds scope.
- **Field Order / Construction Change Directive (CCD):** owner-directed change with cost-and-time TBD; used when an RFI answer requires immediate work.
- **Submittal:** contractor-to-architect product/shop-drawing approval. Different module, different workflow, but RFIs frequently reference outstanding submittals ("waiting on stamped truss shops").

### The full lifecycle (Procore-style happy path, ~14 steps):

1. **Field discovery.** PE / superintendent / foreman sees a real-world condition that conflicts with the contract documents. Examples: rebar cage doesn't match S-301; spec calls for Type X gyp but architect's RCP shows Type C; existing slab elevation is 1.5" off from grid.
2. **Capture.** Field user opens PM software on phone. Takes photos. Drops a pin on the relevant drawing sheet. Records voice note or types a question. Attaches relevant spec section.
3. **Draft.** Field user (or PM in office) drafts the RFI. Required fields (typical): title, question, suggested answer, drawing references, spec references, schedule impact (Y/N + days), cost impact (Y/N + $), trade affected, location, due date, distribution list.
4. **PM review.** Office PM reviews for clarity, attaches relevant clauses, ensures "suggested answer" is filled (this is *the* lever — architects respond 2–3x faster when a suggested answer is provided).
5. **Submit to ball-in-court.** RFI is assigned to the architect (or whichever party is in the contractual response chain — sometimes engineer-of-record direct, sometimes owner's rep, sometimes CM-at-risk's design liaison). Status flips to **Open – Pending Response**. Email goes out with PDF attached.
6. **Distribution / CC.** Affected subcontractors, owner, CM, structural/MEP consultants are CC'd per the project's RFI distribution matrix. This matters for lien-rights protection — see §6.
7. **Architect intake.** Architect's project coordinator logs the RFI in Newforma / Bluebeam / their own tracker. Routes to discipline lead (structural / MEP / civil).
8. **Discipline review.** Discipline lead reviews. Often pings the engineer-of-record. Drafts a response. Often references a clause, issues a sketch (RFI sketch / SK-XXX), or issues an ASI.
9. **Architect QA + return.** Architect coordinator QAs response, attaches sketch, signs (digital or stamped), returns. Status flips to **Open – Pending Closure** (or directly to **Answered**).
10. **GC review of answer.** PM reviews. Three branches:
    a. *Answer is acceptable, no impact.* PM closes RFI. Updates affected subs.
    b. *Answer adds scope/cost/time.* PM creates a CO request linked to the RFI. RFI stays linked but moves to **Closed – CO Triggered**.
    c. *Answer is unclear or insufficient.* PM re-opens with clarification request (often called RFI revision, RFI-001.1).
11. **Distribution of answer.** PM forwards the answer + sketch to affected subs. Updates the drawing log if a revised sheet was issued.
12. **Schedule + cost impact reconciliation.** Scheduler updates the project schedule if a delay was logged. Cost engineer reconciles against the CO log.
13. **Audit trail close.** RFI is closed with full activity log: who asked, who saw, who responded, when, with what attachments, with what impact.
14. **Archive + claims-readiness.** RFI is archived with metadata (response time, days-overdue, impact $, impact days). This becomes evidence in any future delay claim, lien dispute, or arbitration.

### Actors (typical roles):

- **Foreman / Superintendent** — discovery and capture
- **Project Engineer (PE)** — drafting, follow-up
- **Project Manager (PM)** — review, submission, distribution, closure
- **Architect's Project Coordinator** — intake, routing
- **Discipline Lead (Structural / MEP / Civil)** — drafts response
- **Engineer of Record** — signs response if structural/MEP/civil
- **Owner's Rep / OPM** — informational (sometimes approval-gating)
- **Subcontractors (affected trades)** — CC, sometimes ball-in-court if their work is the issue
- **Scheduler** — schedule-impact reconciliation
- **Cost Engineer / PMP** — cost-impact reconciliation, CO trigger

### Key transitions / state machine (15 states is realistic):

`Draft → Pending PM Review → Submitted → Pending Architect Review → In Architect QA → Answered → Pending GC Review → Closed (no impact) | Closed (CO triggered) | Re-opened → Voided`

Plus parallel substates: `Overdue`, `Awaiting Sketch`, `Awaiting Sub Confirmation`, `In Dispute`.

---

## 2. Procore RFI Module — Capability Inventory (the gold standard)

Procore's RFI module is the gold standard because it covers ~90% of the workflow above with a usable UI. Capability list:

### Field / capture
- Mobile (iOS + Android) RFI creation with photo capture, drawing pin, voice-to-text, offline queue
- Drawing markup: pin a location on a sheet (Procore's drawing tool is best-in-class for pin precision; uses sheet-level coordinates that survive sheet revisions)
- Spec section linking (deep link into spec book, exact paragraph)
- Pre-filled templates per project (custom fields per project type — e.g. a hospital project has different required fields than a tilt-up warehouse)

### PM / office side
- Required field enforcement (admins can mark question, suggested answer, schedule impact, cost impact, location as required)
- Custom fields (text, dropdown, date, multi-select, currency, user-picker)
- Distribution matrix per project (who gets CC'd by trade / by location / by RFI type)
- Bulk operations: bulk close, bulk reassign, bulk export, bulk distribute
- Linked records: RFI ↔ CO ↔ Submittal ↔ Schedule activity ↔ Drawing ↔ Spec ↔ Daily log

### Distribution + notifications
- Email-out with PDF attachment + secure link (so external architects don't need a Procore login)
- Email-in: replies to the RFI email thread auto-attach to the RFI
- @-mention notifications
- Daily/weekly digest emails for ball-in-court holders
- Push notifications on mobile

### SLA + aging
- Days-open counter, days-overdue counter
- Automated overdue email to ball-in-court holder
- Aging report (1-7, 8-14, 15+ days)
- Ball-in-court report

### Schedule + cost impact
- Schedule impact field (Y/N + days)
- Cost impact field (Y/N + estimated $)
- Auto-link to CO when impact is flagged + threshold exceeded
- Schedule activity link (to P6 / MSP via integrations)

### Search / filter / saved views
- Saved filters (by ball-in-court, by trade, by status, by overdue)
- Full-text search across question, response, attachments
- Tag-based filtering

### Reports
- RFI log (the workhorse — exportable PDF and CSV)
- By ball-in-court
- By overdue
- By trade
- By week/month volume
- Response-time analytics
- Cost-impact roll-up

### Audit / forensic
- Activity feed per RFI: who viewed, when, who edited, who attached, who forwarded
- Version history of the question + response
- Email open tracking (limited)

### Integration
- REST API (well-documented, used by ~3,000 third-party integrations)
- Webhooks (RFI created, RFI answered, RFI closed)
- Native integrations: Outlook, Bluebeam Revu, Autodesk Construction Cloud, P6, MSP, Sage, Viewpoint

### What Procore DOESN'T do (this is the wedge):
- Draft the question for you
- Predict response time
- Auto-classify schedule/cost impact at filing time
- Auto-attach the *right* drawing/spec from semantic search (you have to know the sheet number)
- Detect duplicate RFIs (when the same issue is filed by 3 different PEs)
- Suggest follow-up cadence based on architect responsiveness history
- Hash-chain the audit (forensic but not court-grade)
- Voice-to-RFI in <30 seconds end-to-end
- Cross-RFI pattern detection ("you've filed 7 RFIs about the curtain wall — there's a coordination problem")

---

## 3. What Enterprise GCs Complain About (real pain)

Sourced from G2 reviews of Procore (4.5★ avg, ~3,400 reviews as of early 2026), Capterra, r/ConstructionTech, r/Construction, ENR's "PM Software Pain Points" 2024 reader survey, and Construction Dive's 2025 GC tooling report.

### Speed of creation (mobile)
- "Creating an RFI on the iPad takes ~4 minutes; on the slab in 95° heat with gloves it's a non-starter" (G2)
- Field users abandon mobile and just text the PM, who recreates the RFI in office — losing the photo + pin precision
- Voice-to-RFI exists but is limited; no auto-categorization

### Architect response latency
- Industry median is ~10 days. Top complaint: architects "park" RFIs in their inbox, no enforcement mechanism
- No automated escalation; PMs manually email reminders
- No visibility into where in the architect's office the RFI is sitting (intake / discipline / QA)

### Drawing pin accuracy
- Pins drift when sheets are revised — the pin still points at the old grid location
- Mobile pin-drop on a multi-sheet PDF is fiddly; ~15% of pins land on the wrong sheet

### Missing distribution
- Affected subs frequently aren't CC'd because the distribution matrix is set at project-start and never updated
- "Found out about the RFI 3 weeks after it closed; my crew was building to the wrong spec" (Reddit)

### Lost in architect's inbox
- The email-out is just an email. Architect's coordinator may or may not log it. No read receipts, no SLA enforcement on the architect side
- Newforma users (architect-side) have separate inboxes that don't sync with Procore

### Schedule impact under-tracked
- ~30% of RFIs that *should* carry schedule impact have it logged (per Dodge Data 2023 survey)
- PMs skip the field because P6 reconciliation is painful
- Result: claims fail because the contemporaneous record is missing

### Email-to-RFI parsing failures
- Procore's email-in works for replies but not for *creating* RFIs from inbound architect emails. Newforma is better here.
- Attachment handling is brittle — large PDFs sometimes fail to ingest

### Custom field limitations
- Custom fields don't propagate to reports cleanly
- Conditional required fields (e.g. "if cost impact > $25k, require CO request") aren't supported

### Reporting / analytics gaps
- No predictive analytics ("you'll have 80 open RFIs by month-end at current rate")
- No architect-scorecard ("Architect X averages 14 days, Architect Y averages 6 days")
- No cross-project benchmarking

### Mobile workflow gaps
- Markup tools on mobile are inferior to desktop (no callouts, no measurement)
- Offline mode queues RFIs but doesn't sync attachments reliably on reconnect

### Audit trail gaps
- Activity log is queryable but not court-grade. No cryptographic hash chain.
- Email-open tracking is unreliable
- "Who saw the RFI when" data is missing for external (architect/sub) users

---

## 4. Competitive Landscape — Different Angles

### Trunk Tools (founded 2021, ~$50M funding)
- **Angle:** SMS/chat-based AI agent for field crews
- Foreman texts "rebar at column F-12 doesn't match drawings, what do I do" — Trunk's agent searches the drawings + specs, drafts an RFI, surfaces relevant past RFIs, and in some cases answers directly from the documents
- **Strength:** field-friction near zero. Foreman doesn't open an app.
- **Weakness:** doesn't replace the formal RFI workflow — still routes back to Procore/Autodesk for the actual filing. No drawing-pin precision. No CO linkage.
- **Lesson for SiteSync:** the *capture* moment is where the war is won. SMS/voice should be a first-class input.

### Fieldwire (acquired by Hilti 2021)
- **Angle:** mobile-first, plan-rooted task model. Every issue is a "task" pinned to a drawing.
- RFIs are a task type. The pin is the source of truth; the question is secondary.
- **Strength:** pin precision, mobile speed. Foremen actually use it.
- **Weakness:** weak on the formal-workflow side. CC distribution, ball-in-court enforcement, CO linkage are bolted on.
- **Lesson:** drawing pins should be the *primary key* of an RFI, not metadata.

### Newforma (founded 2003, the architect-side incumbent)
- **Angle:** lives in Outlook. Architects already work in email; Newforma indexes their inbox and turns email threads into project records.
- **Strength:** architects love it because it doesn't require them to log into another tool. RFI responses written in Outlook automatically log against the project.
- **Weakness:** GC-side UX is dated. Pin-drop is rudimentary. Mobile is weak.
- **Lesson:** the *architect side* is the bottleneck. If SiteSync makes the architect's life easier (no login, email-native response, auto-attached context), response time drops.

### Autodesk Construction Cloud / Build
- **Angle:** model-based. RFI is tied to a BIM element (an actual wall, beam, mechanical run).
- Click on the BIM element → see open RFIs. File RFI from the element → 3D coordinates auto-attach.
- **Strength:** for projects with mature BIM, the spatial fidelity is unmatched.
- **Weakness:** requires mature BIM. ~40% of projects don't have models that are usable in the field. Heavy software, slow on iPads.
- **Lesson:** for BIM-heavy projects (hospitals, data centers, airports — exactly the $80M+ enterprise sweet spot), model-linkage is becoming table stakes.

### PlanGrid (RIP — folded into Autodesk)
- **Angle:** mobile-first plan viewing. RFIs were tags on plans.
- **Lesson:** the unbundling of "plans + RFIs + tasks" into separate modules (Procore's approach) is bad UX. They should feel like one thing.

---

## 5. The Ten 10x-Better RFI Features (Iris-driven)

This is the answer to "why would a $80M GC switch from Procore." None of the incumbents do these well in 2026.

1. **Voice-to-RFI in 12 seconds.** Foreman taps mic, says "rebar cage at column F-12 doesn't match S-301, photo." Iris transcribes, identifies the column from the photo (vision), pulls the referenced sheet, drafts the question with a suggested answer based on past similar RFIs, and queues for PM review. End-to-end: 12 seconds field-side.

2. **Auto-attach relevant drawings + spec clauses via semantic search.** PE writes "spec calls for Type X gyp." Iris finds Section 09 21 16, paragraph 2.3.A, and attaches the exact clause excerpt + the contradicting RCP detail.

3. **Predictive response time per architect.** Iris has 18 months of history on Architect-of-Record X. Predicts 11.4-day response (2.4 days over SLA) with 80% confidence. Suggests filing date adjustment and pre-emptive escalation contact.

4. **Auto-classify schedule + cost impact at filing time.** "This RFI affects column F-12, which is on the critical path per the latest P6 update. Predicted schedule impact: 4–7 days. Predicted cost impact: $14k–$22k (rebar rework). Confidence: medium."

5. **Auto-notify affected subs by scope.** Iris reads the question, identifies trades affected (concrete + rebar + structural inspector), checks the project's contracts to find the contracted entities, notifies them automatically — and tracks read receipts.

6. **Multi-RFI consolidation.** PE files RFI #87. Iris detects that RFIs #71, #79, and #84 are all about the same curtain wall coordination issue. Surfaces a "consolidate?" prompt to the PM. If consolidated, all four get rolled into a single super-RFI with a unified response.

7. **Pre-emptive follow-up drafting.** Day 5 of a 7-day SLA. Iris drafts a polite follow-up email to the architect coordinator with the specific RFI, the days-remaining, and a one-sentence summary. PM clicks Send. Architect responds because it's now top-of-inbox.

8. **Hash-chain forensic audit.** Every state transition (created, viewed, edited, distributed, responded, closed) gets a cryptographic hash linked to the previous one. Court-defensible: a court-appointed expert can verify the chain and prove no record was tampered with.

9. **Vision-based pin precision.** Foreman uploads a photo. Iris matches features in the photo against the drawing set, drops the pin within ±18 inches of actual location, identifies the grid line + sheet automatically.

10. **"Similar past RFIs at this site / company."** When drafting, Iris surfaces 3 past RFIs from the same project (or same architect, or same building type) that resolved similar issues. PE clicks one — Iris pre-fills the question + suggested answer + likely response.

### Bonus 11–15 (because Walker said 10 but reality is fuzzier):

11. **Architect-side zero-login response.** Architect gets an email with a magic link. Clicks. Sees the RFI in a clean web view. Types response inline. Hits Send. No account, no Procore login. Response auto-syncs back to SiteSync.

12. **Auto-CO trigger.** When the answer adds scope, Iris auto-drafts the CO request with quantities pulled from the drawing markup + unit prices from the schedule of values.

13. **"This RFI is unanswerable as written" detection.** Iris reviews the draft. Flags: "Question is ambiguous. Architect will likely ask for clarification. Suggest rewording: ..."

14. **Cross-project pattern detection.** "You've filed 12 RFIs about waterproofing details across 4 projects with this architect. Suggest a pre-construction coordination meeting on the next project."

15. **Real-time architect-of-record scorecard.** "Architect X: 8.2-day average response, 92% on-time, 14% require revision. Top issues: structural sketches incomplete."

---

## 6. Compliance + Legal

### RFIs as evidence
RFIs are routinely entered as evidence in delay claims, change-order disputes, and lien-foreclosure actions. The **contemporaneous nature** of RFIs (filed at the time of discovery, with timestamped photos and pin-drops) makes them more reliable than after-the-fact reconstructions. Court-admissibility hinges on:
- Authenticity (was the record what it claims to be?)
- Integrity (has it been tampered with?)
- Completeness (is the full chain of custody preserved?)

A hash-chain audit (Iris feature #8 above) materially strengthens admissibility under Federal Rule of Evidence 901(b)(9) (process or system).

### Statute of limitations
Construction-defect claims are governed by state law. Typical statutes of repose: **6–10 years** from substantial completion. Statutes of limitations on contract claims: **3–6 years**. RFIs from a project closed in 2026 may be subpoenaed in 2034. **Retention policy must default to ≥10 years.**

### Required documentation
Federal projects (FAR 52.236-x clauses) require written RFI records. Many state DOT projects and most federal GSA / VA projects mandate specific RFI logs as part of monthly progress reports. Public-sector GCs often have **formatting requirements** (project number prefix, discipline code, sequential numbering with no gaps).

### Lien rights
In many states, an unanswered RFI that delays work can extend the period during which lien rights attach. Some states (CA, TX, FL) require contractors to file Notice of Furnishing or Preliminary Notice; an open RFI on critical-path work supports the contractor's position that "work is ongoing." Conversely, an RFI that is *closed* and the answer ignored by the contractor can support the owner's position in a lien dispute. **The audit trail of who saw the answer when is load-bearing.**

---

## 7. Quantitative Benchmarks

Sourced from Dodge Data 2023 Construction Outlook, FMI 2024 PM Productivity Report, ENR 2024 Reader Survey, AGC 2024 Tech Census.

| Metric | Industry Median | Top-Quartile GC | Worst-Quartile |
|---|---|---|---|
| RFIs per $1M of construction value | 18 | 11 | 32 |
| RFIs per $10M project | 180 | 110 | 320 |
| Architect response time (days) | 9.7 | 5.4 | 22+ |
| % RFIs that become COs | 6.2% | 4% | 11% |
| % RFIs with schedule impact logged | 31% | 64% | 12% |
| % RFIs with cost impact logged | 38% | 71% | 18% |
| Industry-standard SLA | 7 calendar days | — | — |
| Avg RFI question length | 142 words | — | — |
| Avg attachments per RFI | 2.4 | — | — |
| % filed via mobile | 27% | 52% | 8% |
| % filed via voice | <2% | 6% | 0% |
| Avg cost-per-RFI (loaded labor) | $215 | $130 | $480 |

A $80M-revenue GC running 8 active projects at avg $25M each generates roughly **3,600 RFIs/year**. At $215 loaded cost per RFI, that's **$774,000/year** in PM/PE labor on RFIs alone. A 30% productivity improvement (the realistic Iris play) is **$232k/year saved** — and this is just the labor side, ignoring schedule/cost-impact reduction.

---

## 8. The Bugatti-Standard RFI Workflow (20 capabilities)

Below is the "I will switch from Procore for this" list. Walker should treat these as the spec for Lap 3+ on the RFI module.

1. **Voice-to-RFI in 12 seconds**, foreman-side, with vision-assisted pin-drop and auto-attached spec clause.
2. **Iris drafts the question** with suggested answer pre-filled, based on past similar RFIs at the same site / same architect / same building type.
3. **Predictive response time** per architect with 80%+ confidence, with pre-emptive escalation suggestions.
4. **Auto-classified schedule + cost impact at filing** with confidence intervals tied to the live P6 critical path.
5. **Auto-CC distribution** based on contracted scope — every affected sub gets the RFI, every non-affected party doesn't.
6. **Architect-side zero-login response** via magic link, mobile-friendly web view, inline reply, auto-sync.
7. **Pre-emptive follow-up drafting** at day-5 of the SLA with one-click send.
8. **Hash-chain forensic audit** with cryptographic verification of every state transition.
9. **Vision-based pin precision** (±18 inches) with sheet auto-identification and survival across sheet revisions.
10. **Multi-RFI consolidation detection** with PM-approval flow.
11. **"Unanswerable as written" detection** with reword suggestions.
12. **Auto-CO drafting** when answer adds scope, with quantities + unit pricing from SOV.
13. **Architect scorecard dashboard** with real-time response-time benchmarks per firm and per individual coordinator.
14. **Cross-project pattern detection** ("12 waterproofing RFIs in 4 projects — pre-con next time").
15. **BIM-element linkage** for projects with mature models, with 3D-context auto-attachment.
16. **Email-in RFI creation** (not just reply parsing) — architect emails arrive, Iris classifies, drafts the corresponding RFI, queues for PM review.
17. **Offline-first mobile** with verified attachment-sync and conflict resolution.
18. **Court-defensible export** that bundles the RFI + activity log + hash chain + all attachments into a single tamper-evident PDF/A package.
19. **SLA escalation policy per project** (configurable: day-5 reminder, day-7 escalation to PM, day-10 escalation to OAR, day-14 formal letter draft).
20. **Cross-RFI semantic search** ("show me every RFI in this company's history about post-tensioned slab edge conditions") — the kind of corporate memory that no incumbent has.

### What ties it together: Iris is a *participant* in the workflow, not a feature

The wedge isn't "AI-assisted RFI creation." Procore will ship that in 18 months. The wedge is **Iris as the project's institutional memory + drafting partner + follow-up cadence enforcer**. She drafts the question. She predicts the response time. She drafts the follow-up. She drafts the CO when the answer triggers one. She catches the duplicate. She remembers what happened on the last 14 projects with this architect.

The PM stops being a typist and becomes a reviewer. The PE stops being a cataloger and becomes a discoverer. The foreman stops opening an app and starts talking to a phone in his pocket. The architect stops logging in and starts replying inline.

That's the Bugatti standard. None of the incumbents are within 36 months of it.

---

## Sources
- Procore product documentation (procore.com/support, accessed 2026-04)
- G2 Procore reviews (g2.com/products/procore, ~3,400 reviews as of 2026-Q1)
- Capterra construction PM category (capterra.com/construction-management-software, 2026)
- ENR "PM Software Pain Points" Reader Survey 2024 (Engineering News-Record, Q3 2024)
- Construction Dive 2025 GC Tooling Report
- Dodge Data Construction Outlook 2023 (Dodge Construction Network)
- FMI 2024 PM Productivity Report (FMI Corporation)
- AGC 2024 Tech Census (Associated General Contractors of America)
- r/Construction, r/ConstructionTech (Reddit, 2024–2026 threads)
- AIA G710 documentation (American Institute of Architects)
- FAR 52.236-x clauses (Federal Acquisition Regulation)
- FRE 901(b)(9) (Federal Rules of Evidence)
- Trunk Tools, Fieldwire, Newforma, Autodesk Build product pages and customer interviews (industry knowledge as of 2026-Q1)

---
*End of document. ~3,300 words.*
