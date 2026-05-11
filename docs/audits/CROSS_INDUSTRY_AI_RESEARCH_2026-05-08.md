# Cross-Industry AI Research — How High-Coordination Industries Use AI/Automation

**Date:** 2026-05-08
**Author:** Claude (subagent for Walker)
**Scope:** Research 5 industries that are 5–10 years ahead of construction in coordination-tech maturity. Extract patterns SiteSync can absorb in the Lap 3 → T-0 (Embedded Payments v0, Apr 30 2027) window.
**Sources:** Vendor docs, trade press, academic centers (Stanford CIFE), peer-reviewed papers. Where claims are not directly verified, tagged "(unverified)".

---

## Industry 1: Aerospace Programs (Boeing, Lockheed Martin, SpaceX)

### Coordination complexity
Boeing's 787 program coordinates ~50 Tier-1 partners and 700+ Tier-2/3 suppliers across four continents; Lockheed's F-35 program touches 1,900+ suppliers. SpaceX Starship is more vertically integrated but still runs hundreds of internal teams plus a long tail of fab/forge partners. The decision velocity is the standout: **Lockheed reports ~24,000 engineering changes per year across 108 workflows on a single major program** — roughly one change every 22 minutes, every business day. Each change can ripple through requirements, CAD, BOM, tooling, NC programs, inspection plans, supplier contracts, regulatory filings, and field-service docs. The cost of a missed propagation is measured in millions of dollars per incident and (for crewed vehicles) lives.

### Tech architecture
The dominant pattern is the **digital thread**: a governed graph that connects requirements → 3D models → BOM → manufacturing process → as-built record → field telemetry, with every node carrying revision and authorship metadata.

- **PLM backbones:** Siemens **Teamcenter** (Lockheed, Mercedes, GM aerospace partners), PTC **Windchill** (Boeing, Raytheon), Dassault **3DEXPERIENCE/ENOVIA** (Airbus). Each is the system of record for parts, BOMs, and engineering change orders (ECOs).
- **MBSE (Model-Based Systems Engineering):** Replaces the old Word-doc/Excel requirements stack. Tools: Cameo Systems Modeler, IBM Rhapsody, Jama Connect. Requirements are expressed as SysML diagrams; downstream models inherit from them so a requirement change auto-flags affected components.
- **Digital twin layer:** SpaceX (per industry reporting, unverified) runs a digital twin of Starship that simulates ascent/reentry/landing dynamics; the production-line twin tracks fab inefficiencies. Lockheed's F-35 line uses Siemens NX + Teamcenter to drive 3D models directly to NC programming, CMM inspection, and tooling.
- **ICE / Big Room:** Stanford **CIFE's Integrated Concurrent Engineering** model (born in NASA JPL's Project Design Center in the 1990s) puts all disciplines in a single physical/virtual room with shared parametric models. A 6-month design cycle compresses to weeks because rework loops happen in minutes, not months.

### AI/agent layer
- **ECO impact analysis:** ML models trained on historical ECOs predict which downstream components, suppliers, and certification artifacts a proposed change will touch — surfacing hidden dependencies before approval.
- **Anomaly detection in test data:** SpaceX's iterative test-and-fly approach generates terabytes of telemetry per launch; ML triages anomalies into "known/expected/novel" buckets so engineers focus only on the novel.
- **Generative design:** Airbus's bionic partition (Autodesk generative design) is the canonical example — algorithm proposes thousands of geometry candidates against weight/strength constraints.
- **Compliance-doc generation:** Lockheed and Boeing use NLP to draft FAA/DoD certification documentation directly from the digital thread, with humans reviewing.

### Ideas SiteSync can lift
- **Digital thread → "Project Spine":** Treat the GC's project as a connected graph (specs → submittals → RFIs → POs → daily logs → punch list → as-builts → warranty), with every node carrying author + revision + linked-from. Today most GCs run this as ~12 disconnected SaaS silos. SiteSync's Iris already has the citations spec (8 kinds — IRIS_CITATIONS_SPEC). Generalize that into a project-wide graph and you have the construction equivalent of a digital thread.
- **MBSE → "Spec-as-source-of-truth":** When a spec section changes, every submittal, RFI, and shop-drawing review tied to it should auto-flag. Most GCs do this manually if at all. The aerospace pattern is to make the spec the parametric model and let downstream artifacts inherit.
- **ICE / OAC reinvention:** OAC meetings today are status reporting. The Stanford CIFE move was to flip the room into a *decision factory* — every attendee with a model, decisions captured as commits to a shared artifact. SiteSync can ship an "OAC mode" that records the session, transcribes decisions, and pushes them as commits into the project spine in real time.
- **ECO impact-analysis agent → "Change-order ripple":** When a change order is proposed, an agent walks the project spine and lists every affected SOV line, schedule activity, submittal status, and subcontractor scope. This is the single most-asked-for feature in GC field interviews per the Bugatti Audit (unverified — recall from prior session).

---

## Industry 2: Semiconductor Fabs (TSMC, Intel, Samsung)

### Coordination complexity
A modern leading-edge fab runs **500–1,000+ process steps** per wafer, with sub-nanometer tolerances at the 3nm/2nm nodes. Operations are 24/7/365. A single tool down for an hour can cost ~$1M in lost wafer starts. TSMC's Fab 18 (3nm) reportedly runs hundreds of thousands of wafers per month; the coordination problem is at the *step-and-tool* level, not the human-team level — but the analogy to construction is direct: dozens of trade interfaces, sequence-dependent, with massive cost-of-rework if any step fails.

### Tech architecture
TSMC publicly describes its **Intelligent Fab Automation** stack as four core systems plus AI on top:

- **MES (Manufacturing Execution System):** Tracks every wafer, lot, and reticle through every step. TSMC built a **die-level MES** for advanced packaging that gives instant per-die status and routing.
- **APC (Advanced Process Control):** Real-time feedback loops adjust process parameters (etch time, dose, temperature) shot-by-shot based on incoming metrology. Run-to-run control is the workhorse.
- **AMHS (Automated Material Handling System):** Overhead monorails (OHTs) move FOUPs (wafer carriers) between tools. Routing is solved continuously by an AI dispatcher.
- **FDC (Fault Detection & Classification):** Every tool streams ~hundreds of sensor channels. ML models flag drift from the golden trace before it becomes a yield event.
- **Virtual Metrology (VM):** Predicts wafer electrical parameters from upstream sensor data so you don't have to physically measure every wafer. Cuts feedback latency from days to hours.
- **Predictive Maintenance:** Per Fraunhofer / SEMI, models predict tool component failures (chamber clean cycles, pump degradation) days in advance.

Vendors: Applied Materials **SmartFactory**, Siemens **Camstar**, Critical Manufacturing, Inficon. SEMI's **Agentic AI for Next-Generation Semiconductor Manufacturing** initiative (2025) is rolling out LLM agents over these data layers.

### AI/agent layer
- **Yield-management AI:** Correlates wafer-level test results back through 500 process steps to identify the offending tool/step combination. TSMC's annual report describes "automated yield prediction and optimization" as a tangible-ROI bet.
- **Tool-recipe optimization:** RL agents tune recipes within process windows. Reportedly contributes 5–10% of cycle-time gains node-over-node (unverified — recall).
- **Agentic AI for FDC:** Replaces the engineer-on-call rotation; the agent triages alerts, pulls historical context, and proposes either "run another wafer" or "open a tool-down ticket."

### Ideas SiteSync can lift
- **MES → "Field MES":** A jobsite is a fab. Each work-package (e.g., "drywall room 3-204") has a sequence of dependent steps (frame → MEP rough-in → inspect → insulation → close → tape → paint). Today this is tracked in foreman's heads + paper punch lists. A construction MES would track every work-package's state, enforce sequencing, and route the next crew. **This is what most "AI scheduling" startups (ALICE, nPlan) gesture at but haven't shipped — because they don't have the MES base layer.** SiteSync's daily-log + entity store could become this layer.
- **APC → run-to-run learning on submittals/RFIs:** Every time an RFI gets answered, log the (question pattern → answer → reviewer → cycle time) tuple. Over 6 months a project has hundreds of these; fit a model and the next RFI of similar pattern can pre-populate the answer or route to the fastest reviewer. This is direct lift from APC run-to-run.
- **Virtual Metrology → "predict the inspection":** Before a city inspector shows up, predict whether the room will pass based on (subcontractor history × foreman × weather × schedule pressure × similar past inspections). Reroute remediation before the failed inspection costs a day. Equivalent to predicting wafer parametrics from sensor traces.
- **FDC → safety leading indicators:** Today construction safety is measured in lagging indicators (recordables, lost-time). The fab pattern is sensor drift detection. SiteSync could ingest daily-log voice notes, photos, and crew-density data and flag "this site's leading-indicator profile looks like the 14 days before a recordable incident across our corpus."

---

## Industry 3: Healthcare AI (Abridge, Suki, Hippocratic Polaris, Microsoft Dragon Copilot/DAX, Epic)

### Coordination complexity
A complex inpatient case touches 8–15 specialists, 3–5 nursing shifts, pharmacy, imaging, lab, billing, and the patient + family — over a 4-day average stay. Decisions must be auditable for liability and HIPAA. **Closest analog to construction's multi-stakeholder + safety-critical + regulated profile.** Documentation burden is the universally-named pain: clinicians spend 1–2 hours/day charting, fueling burnout.

### Tech architecture
- **Ambient AI scribes:** Microphone in the exam room captures the encounter; LLM produces a structured note in the EHR. **Abridge** (Best in KLAS 2025; >250 health systems; 80M+ encounters annually; raised $300M in mid-2025), **Microsoft Dragon Copilot** (the unified Nuance DMO + DAX product, GA March 2025), **Suki**, **Ambience**, **DeepScribe**, **Nabla**. Reported impact (per Microsoft / DAX studies): ~50% reduction in documentation time, ~70% reduction in self-reported burnout, ~5 additional patients seen per clinic day.
- **EHR backbone:** Epic's MyChart and Hyperdrive are the system of record. Epic + Microsoft DAX integration (DAX Express for Epic, GA early 2024) means the AI scribe writes directly into the right note section with EHR context loaded. Epic's own "Cosmos" + AI agents launched in 2025.
- **Multi-LLM constellations:** Hippocratic AI's **Polaris 3.0** is the bellwether — 22 specialized LLMs, 4.2T total parameters, deployed for tele-nursing/care-navigation calls. Stateful primary agent drives the conversation; specialist agents (medication-interaction checker, dosing-safety, social-determinants-detector, etc.) double-check it. Reported 99.38% clinical-accuracy benchmark; evaluated against >1,100 nurses + >130 physicians in their RWE-LLM framework.
- **Audio-anchored citations:** This is the under-told story. DAX/Abridge generate notes that link every clinical claim back to a timestamp in the audio recording. A reviewer can click a sentence in the note and hear the patient say it.

### AI/agent layer
- **Beyond scribing:** Abridge's Series D (Feb 2025, $250M; June 2025, $300M) funded a "contextual reasoning engine" — the same pipeline now drafts referral letters, after-visit summaries, billable-note compliance flags, and prior-auth packets. The pattern is *one ambient capture → many downstream artifacts*.
- **Care-navigation agents:** Hippocratic Polaris is voice-first, runs autonomous outbound calls (lab-result delivery, appointment prep, post-discharge check-ins). Constellation architecture is the safety mechanism: any answer must survive cross-checks by domain-specialist models.
- **EHR-native agents (Epic 2025):** Surface insights from the clinical database, draft InBasket replies, summarize chart for handoff.

### Ideas SiteSync can lift
- **Audio-anchored citations → IRIS_CITATIONS_SPEC validation:** SiteSync is already heading here (Day 38–41, ADR-004 side panel). The healthcare proof point is *huge*: clinicians only trust AI notes once they can click and hear the source. The same is true for foremen and PMs. Make the audio playhead a first-class affordance in the citations side panel — not a hidden link.
- **One capture → many artifacts:** A single foreman walk-through (10 min, voice + photos) should generate the daily log, RFIs from observed conflicts, punch-list adds, schedule slip flags, and a safety toolbox-talk topic for tomorrow. Abridge's "ambient capture → 6 downstream docs" is the playbook. SiteSync's voice corpus work (Day 43–49, IRIS_VOICE_GUIDE_SPEC) is the foundation; the missing piece is the fan-out.
- **Constellation architecture → Iris safety mode:** ADR-002 already says the 5 AI stores stay separate. Take it further: for safety-critical drafts (anything touching schedule/money/PII), run a multi-agent check — voice-style linter, citation verifier, money-math checker, PermissionGate validator. Don't let a single LLM call ship a draft. Hippocratic's 99.38% number is the benchmark.
- **EHR-native pattern → "be the field's quiet co-pilot":** Don't ask the foreman to come to a new app. Embed Iris in Procore/Autodesk Build/PlanGrid via deep links and an extension. DAX won by being inside Epic. SiteSync wins by being inside whatever the GC already opens at 6:30am.

---

## Industry 4: Logistics Control Towers (project44, FourKites, Flexport, Maersk)

### Coordination complexity
A single mid-size importer's supply chain typically touches 80–150 counterparties — ocean carriers, drayage, rail, OTR trucking, brokers, customs, 3PLs, warehouses, and the receiving plant. **Millions of containers in motion globally.** Each leg has its own data system (or fax). Exceptions (port congestion, weather, customs holds, equipment shortages) propagate downstream into stockouts, line-down events, and contract penalties.

### Tech architecture
- **Real-time visibility platforms:** **project44** and **FourKites** are the Gartner Magic Quadrant leaders (3 years running per 2025 reporting). Both ingest carrier APIs, ELD feeds, vessel AIS, and EDI to produce a single shipment-level state graph. project44's investors include Maersk and CMA CGM; FourKites was acquired-or-merged in 2025 (unverified).
- **Control-tower architecture pattern:** Visibility layer → exception detection → workflow orchestration → human approval. FourKites' **Intelligent Control Tower** (Jan 2025) explicitly moved from dashboards to "agentic AI taking autonomous action" across 8 packaged use cases.
- **Multi-modal orchestration:** Flexport's **Control Tower** (relaunched Winter 2025 with 20+ AI products) covers freight not booked through Flexport — the platform play is "see and act on shipments regardless of who moved them."
- **ETA prediction:** ML models trained on historical lane × carrier × season × port-congestion data. Reported accuracies in the ±2-hour band for last-mile, ±1-day for ocean.
- **Exception type taxonomies:** Flexport's docs publicly enumerate exception types (delayed sailing, missed cutoff, customs hold, container-roll). This is the schema sub work most logistics firms hand-rolled internally.

### AI/agent layer
- **Predictive ETA + dynamic re-routing:** Models recompute ETAs every minute as new telemetry arrives; re-route recommendations get pushed to the broker.
- **Autonomous exception handling (FourKites Intelligent CT, 2025):** Agents detect, triage, and in some categories (carrier-side rebooking, document chase) execute the resolution without human touch. Human-in-the-loop on anything that touches money or contracts.
- **Scope-3 emissions visibility (project44, $80M raise 2024):** Same telemetry repurposed for sustainability reporting.

### Ideas SiteSync can lift
- **Control-tower architecture → "Project Tower":** The GC's PM is a control-tower operator manually. SiteSync should build the four-layer stack: (1) visibility (already in motion via daily logs + integrations), (2) exception detection (auto-flag schedule slips, RFI aging, submittal stalls), (3) workflow orchestration (route the exception to the right person with context), (4) human approval. **The killer demo is a "this week's exceptions" view that PMs open instead of email.**
- **Exception taxonomy → ship the schema:** Flexport's published exception-type taxonomy let the ecosystem standardize. SiteSync should publish a construction-exception taxonomy (RFI-aging, submittal-rejected, schedule-slip-by-N, weather-impact, change-order-pending-N-days, inspection-failed) as a public spec. This is brand-defining and pulls partners in.
- **Predictive ETA → "predict project completion at every gate":** Apply the same pattern: every milestone has a baseline date; model the slip-distribution from current telemetry (RFI-velocity, weather, manpower, change-order volume) and surface a probabilistic completion date that updates daily. Most P6 schedules today are static.
- **Multi-party visibility → "everyone has the same picture":** A fundamental structural advantage of project44 is that the carrier, the shipper, the consignee, and the 3PL all see the same shipment record. In construction today the GC, the architect, the owner, and each sub each have a different snapshot. SiteSync's Iris citations spec + the project spine could be that shared truth.

---

## Industry 5: Mining & Heavy Industry Autonomy (Caterpillar at Rio Tinto Pilbara, Komatsu FrontRunner)

### Coordination complexity
A modern Pilbara iron-ore mine runs 24/7 across an area of dozens of square kilometers. **Rio Tinto's autonomous truck fleet has moved >1 billion tonnes across 5 Pilbara sites since 2008** (recently confirmed in their 2024 milestone announcement). **Komatsu's FrontRunner has hauled >4 billion tonnes globally with zero system-related injuries in 14 years of commercial operation.** Trucks run in dust, GPS-degraded valleys, and around human-operated equipment, drills, and shovels.

### Tech architecture
- **Autonomous trucks:** Caterpillar **Command for Hauling** (CAT 793F/797F autonomous variants) and Komatsu **FrontRunner AHS** (930E/980E). Onboard sensor stack: GPS, IMU, multiple radars, lidar/lasers, gyros. Wireless: WiFi mesh + LTE.
- **Fleet management / dispatch:** Komatsu's **Modular Mining DISPATCH** (used by 9 of the 10 largest miners worldwide) is the brain. Hexagon **MineOps** and Caterpillar **MineStar** are the alternatives. These solve a continuous integer-program: which truck to which shovel, which route, when to refuel, given equipment availability and grade-control targets.
- **Mine control room:** Centralized; per Komatsu PR, the standard layout puts the autonomous-ops dashboard on one wall and DISPATCH on another. Operators supervise dozens of trucks each. Some control rooms (Rio Tinto's Perth Operations Centre) supervise multiple sites from 1,000+ km away.
- **Safety-zone systems:** Geofenced "permission zones" — a person on foot or a non-autonomous vehicle entering a zone halts all autonomous traffic in that zone. This is the analog to construction's site-safety perimeter.
- **V2X & high-precision positioning:** RTK-GPS down to ~10 cm. In GPS-degraded pits, dead-reckoning + lidar SLAM fills the gap.

### AI/agent layer
- **Dispatch optimization:** Mixed-integer + RL hybrids assign trucks. Reported 10–20% productivity gains over manual dispatching (unverified — industry-press range).
- **Predictive maintenance for drivetrain/tires:** Tire failures are catastrophic ($60K+ per tire, mine-stopping). Models from sensor data + operational profile predict failures days ahead.
- **Drone + autonomous survey:** Daily drone flights produce a same-day pit-progress 3D model that feeds back into dispatch.
- **Battery-electric integration (2025):** First Cat 793 XE battery-electric haul trucks arrived at Pilbara (BHP Jimblebar + Rio Tinto, Dec 2025) and are being integrated into the autonomous fleet — adding charge-routing and battery-state to the dispatch model.

### Ideas SiteSync can lift
- **Centralized control room → "PM Operations Centre":** A senior PM should be able to supervise 5–15 jobsites from one screen, with autonomous-ish field execution drilling into exceptions only. Today PMs supervise 2–4 sites and burn out. The Rio Tinto Perth-supervises-Pilbara model is what the construction industry has not yet copied.
- **DISPATCH-style continuous re-optimization → "live schedule":** Mining's dispatch system re-solves the assignment problem every few seconds as new telemetry arrives. Construction's CPM schedule is updated weekly by a scheduler. The opportunity: a "live schedule" service that rebalances tomorrow's crew/equipment assignments at 6pm based on today's actuals.
- **Permission-zone safety → "geofenced PermissionGate":** SiteSync already has PermissionGate (audited, CI-enforced — see PERMISSION_GATE_AUDIT). The mining pattern is to make it geographic + time-windowed: actions touching a particular work-package or zone require an active person physically on site. Pulls together GPS check-ins + the existing PermissionGate primitive.
- **Predictive maintenance for tires → predictive maintenance for subcontractors:** Mining predicts tire failure from operational profile. SiteSync can predict sub-failure (no-show, cash-flow issue, scope-stall) from daily-log + payment + RFI-pattern data. Auto-trigger an early intervention (call from PM, support from the office) before the failure cascades.

---

# Synthesis

## A. Patterns recurring across multiple industries (highest-confidence bets)

These show up in 3+ industries. If construction is a tech laggard, these are the patterns most likely to land here next.

1. **A connected graph as system-of-record (the "spine").** Aerospace digital thread, semi MES, healthcare EHR, logistics shipment graph, mining fleet/asset model — every mature industry has a graph that connects requirements/orders → execution → as-built/as-delivered → field telemetry, with revision and authorship on every edge. Construction has 12 disconnected SaaS instead. **The single biggest unlock is to ship the spine, even if minimal at first.** SiteSync's project entity store + Iris citations are 60% of the way there.

2. **One ambient capture → many downstream artifacts.** Healthcare (Abridge: encounter audio → note + after-visit summary + referral + billable code + prior-auth), aerospace (one CAD change → BOM update + supplier ECN + tooling order + cert package), logistics (one shipment milestone → ETA recompute + customer notification + invoice trigger). The pattern is *capture once, fan out*. SiteSync's foreman walk-through is the equivalent capture. The fan-out (logs + RFIs + punch + schedule + toolbox-talk) is the value.

3. **Audio-anchored or sensor-anchored citations as the trust mechanism.** Abridge linking note sentences to audio timestamps; Lockheed linking a build step to the source spec revision; FourKites linking an ETA to the GPS ping that produced it. Trust-by-traceability. Iris is on this path; double down.

4. **Centralized control room with one operator supervising many.** Mining (Perth → Pilbara), logistics (control tower over 100+ counterparties), fab (one engineer over hundreds of tools via FDC dashboards), healthcare (clinical command centers). Construction PMs still operate per-site. **The economics of supervision-density are a 5-10x labor leverage that construction has not yet captured.**

5. **Continuous re-optimization, not periodic scheduling.** Mining DISPATCH re-solves every few seconds; APC tunes recipes wafer-to-wafer; logistics ETAs update minute-by-minute. CPM scheduling in construction is *weekly*. Even a daily reschedule using yesterday's actuals would be a generation ahead of state-of-art.

6. **Multi-agent / constellation safety pattern.** Hippocratic Polaris (22 LLMs cross-checking); aerospace formal-verification + human signoff; semi FDC + APC + virtual metrology triangulating each other. **Single-LLM-call drafts are unsafe for anything regulated.** SiteSync's Iris pipeline should mature into a constellation: drafter + voice-linter + citation-verifier + money-math-checker + PermissionGate-validator before any artifact ships.

7. **Standardized exception taxonomies, published.** Flexport's exception types, FDA's MedDRA in healthcare, SEMI's E10 equipment-state standard in fabs. Common vocabulary lets ecosystems interoperate. Construction has no such taxonomy for project exceptions. **First mover wins the schema.**

## B. Patterns specific to one industry but transferable

1. **MBSE / spec-as-parametric-model (aerospace):** Make the *project spec* the live model that every submittal and RFI inherits from. When the spec changes, downstream artifacts auto-flag. No other industry's analog is as direct for SiteSync.

2. **Run-to-run learning on every cycle (semiconductor APC):** Every RFI, every submittal review, every change order is a run. Log inputs/outputs/cycle-time, fit a model after a few hundred runs. This is unfamiliar to construction tools — they're mostly CRUD apps with no learning loop.

3. **Geofenced safety-permission systems (mining):** Composes beautifully with SiteSync's existing PermissionGate primitive. Field-actions require both a permission *and* a present-on-site signal.

## C. Things construction already does that other industries don't (don't underrate)

1. **Physical site walks as ground-truth data capture.** No fab walks a wafer. Healthcare doesn't walk the chart. The site walk is a uniquely construction-rich signal (visual + audio + spatial + relational). This is SiteSync's moat.
2. **Permit / inspection / regulatory cadence is *external* and *visible*.** A jobsite has hard external dates (city inspection, certificate of occupancy) that other industries' equivalents are softer or internal. This makes the deadline math tractable.
3. **Real-money decisions every day.** A daily log entry can change a $50K invoice. In healthcare the documentation-to-billing loop is days; in aerospace the BOM-to-PO loop is weeks. **Construction's tight money loop is exactly why Embedded Payments (T-0 milestone) is the right wedge.**
4. **Long-tenured craft knowledge in the foremen.** A 25-year electrical foreman holds knowledge no model has. Healthcare and logistics have largely commoditized the skilled labor; construction hasn't. SiteSync's voice corpus pulls this forward.

## D. Top 5 actionable ideas for SiteSync, Lap 3 → T-0 (ranked: leverage × feasibility)

| Rank | Idea | Industry source | Leverage | Feasibility | Why now |
|---|---|---|---|---|---|
| 1 | **One-capture-many-artifacts on the foreman walk** | Abridge / DAX | Very high | High — voice corpus (Day 43–49) is the foundation, fan-out is a prompt + UI | Already on the Lap 2 roadmap. Make the explicit goal: 10-min walk → 6 artifacts. |
| 2 | **"Project Exceptions Tower" PM home view** | project44 / FourKites | Very high | Medium — needs telemetry from IRIS_TELEMETRY_SPEC + a published exception taxonomy | Telemetry migration lands Lap 2 Day 31; this rides on it. |
| 3 | **Live schedule that re-balances at 6pm from today's actuals** | Komatsu DISPATCH | High | Medium — needs daily-log → schedule integration + a re-solver | Differentiated; nobody in construction has shipped this. |
| 4 | **Iris constellation: drafter + linter + verifier + money + perm gate** | Hippocratic Polaris | High | High — extends ADR-002 (5 AI stores stay separate) into runtime checks | Day 60 acceptance gate is the natural forcing function. |
| 5 | **Audio-anchored citations + side panel as the trust UX** | Abridge | High | High — IRIS_CITATIONS_SPEC + ADR-004 already specify the side panel | Days 38–41. Make the audio playhead first-class, not buried. |

Honorable mentions (slightly lower leverage or further out):
- **PM Operations Centre (one PM → 10 sites)** — Rio Tinto Perth → Pilbara model. Probably a 12-month build but a category-defining product.
- **Spec-as-parametric-model** — MBSE pattern. Foundational but requires a pricing-model bet (sell into the architect or the GC?).
- **Predictive sub-failure** — mining's tire-failure prediction transposed. Powerful but needs more historical data than current pilots will produce; better as a Lap 4 bet.

---

## Sources

Aerospace / digital thread:
- [Lockheed Martin's Digital Thread and PLM Approach (Siemens blog)](https://blogs.sw.siemens.com/news/lockheed-martins-digital-thread-and-plm-approach/)
- [DXC: Digital thread helps Lockheed Martin modernize aircraft manufacturing](https://dxc.com/insights/customer-stories/digital-thread-helps-lockheed-martin-aeronautics-modernize-aircraft-manufacturing)
- [PTC: Rapid Growth for Aerospace & Defense Digital Thread](https://www.ptc.com/en/resources/plm/ebook/digital-thread-in-aerospace-defense-growth)
- [Hexacoder: Digital Twins in Starship Engineering](https://hexacoder.com/blog/spacex-starship-digital-twins-explained) (industry-press, treat as unverified for SpaceX-specific claims)
- [Stanford CIFE](https://cife.stanford.edu/) — VDC / ICE roots

Semiconductors:
- [TSMC: Agile and Intelligent Operations](https://www.tsmc.com/english/dedicatedFoundry/manufacturing/intelligent_operations)
- [TSMC: Intelligent Packaging Fab](https://www.tsmc.com/english/dedicatedFoundry/services/apm_intelligent_packaging_fab)
- [SEMI: Agentic AI for Next-Generation Semiconductor Manufacturing](https://www.semi.org/en/event/agentic-ai-next-generation-semiconductor-manufacturing)
- [ScienceDirect: Virtual metrology in semiconductor manufacturing — current status and future prospects](https://www.sciencedirect.com/science/article/abs/pii/S095741742400424X)
- [SemiEngineering: Using Predictive Maintenance To Boost IC Manufacturing Efficiency](https://semiengineering.com/using-predictive-maintenance-to-boost-ic-manufacturing-efficiency/)

Healthcare AI:
- [Abridge press / Fierce Healthcare: Abridge $250M Series D](https://www.fiercehealthcare.com/ai-and-machine-learning/abridge-scores-250m-series-d-ambient-ai-tech-now-use-100-health-systems)
- [STAT News: Abridge raises $300 million](https://www.statnews.com/2025/06/24/ai-clinical-documentation-ambient-scribe-abridge-raises-300-million/)
- [Microsoft: Dragon Copilot announcement](https://news.microsoft.com/source/2025/03/03/microsoft-dragon-copilot-provides-the-healthcare-industrys-first-unified-voice-ai-assistant-that-enables-clinicians-to-streamline-clinical-documentation-surface-information-and-automate-task/)
- [Epic: DAX Express for Epic](https://www.epic.com/epic/post/nuance-and-epic-expand-ambient-documentation-integration-across-the-clinical-experience-with-dax-express-for-epic/)
- [Hippocratic AI: Polaris 3.0 announcement](https://www.businesswire.com/news/home/20250319172281/en/Hippocratic-AI-Releases-Polaris-3.0-A-4.2-Trillion-Parameter-Suite-of-22-LLMs-Enhancing-Patient-Safety-and-Experience-By-Leveraging-Real-World-Experiences)
- [arXiv 2403.13313: Polaris — A Safety-focused LLM Constellation Architecture for Healthcare](https://arxiv.org/abs/2403.13313)

Logistics:
- [FourKites: Intelligent Control Tower launch (Jan 2025)](https://www.enterprisetimes.co.uk/2025/01/15/fourkites-launches-intelligent-control-tower-for-supply-chains/)
- [Flexport: Winter 2025 release — 20+ AI products](https://www.prnewswire.com/news-releases/flexport-unveils-20-tech-and-ai-powered-products-to-modernize-global-supply-chains-302383593.html)
- [Flexport Control Tower](https://www.flexport.com/technology/control-tower/)
- [Flexport Help Center: Exception Types, Tasks, and Problems](https://support.portal.flexport.com/hc/en-us/articles/16683537467415-Exception-Types-Tasks-and-Problems)
- [trans.info: Gartner Magic Quadrant — project44 and FourKites](https://trans.info/en/project44-and-fourkites-remain-top-dogs-343967)

Mining:
- [Komatsu: FrontRunner AHS](https://www.komatsu.com/en-us/technology/smart-mining/loading-and-haulage/autonomous-haulage-system)
- [Rio Tinto: AHS one-billion-tonne milestone](https://www.riotinto.com/news/releases/AHS-one-billion-tonne-milestone)
- [Rio Tinto: Automated truck expansion in Pilbara](https://www.riotinto.com/news/releases/Automated-truck-expansion-Pilbara)
- [Rio Tinto + BHP: First Caterpillar battery-electric haul trucks (Dec 2025)](https://www.riotinto.com/en/news/releases/2025/bhp-and-rio-tinto-welcome-first-caterpillar-battery-electric-haul-trucks-to-the-pilbara)
- [Equipment World: How Komatsu's autonomous haul trucks work](https://www.equipmentworld.com/equipment-controls/autonomous/article/14970116/komatsus-autonomous-haul-trucks-work-and-the-technology)
