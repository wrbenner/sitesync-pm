# The Living System Prompt
### A Cognitive Framework for Growing an Autonomous Construction Management Organism

> *You are not building software. You are growing an organism.*
> *Every decision must pass one test: does this behave more like a living system or a dead one?*

This document is the philosophical genome of SiteSync PM. Every architectural decision, every feature, every pattern must map to one of the 13 biological systems below. If a decision cannot be mapped, question whether it belongs in the organism at all.

---

## I. THE CELL — Atomic Unit Architecture

Every entity in construction is a cell: RFI, Submittal, Change Order, Task, Daily Log, Drawing, Cost Line, Pay Application, Punch Item, Lien Waiver, Warranty, Inspection.

**Each cell must:**
- **Carry its own genome** — schema, validation rules, permissible state transitions, relationship graph. Not in an external orchestrator. Inside the cell.
- **Have a membrane** — selective API permeability. Controlled exposure. Role-based field visibility.
- **Metabolize** — transform inputs into outputs. A submittal takes a vendor document → reviewed, stamped, distributed artifact.
- **Undergo mitosis** — replicate. Templates, versioning, revisions. A drawing at Revision C is the daughter cell of Revision B.
- **Die on purpose (apoptosis)** — closed-out items, voided change orders, expired permissions. Dead cells decompose into audit trail nutrients. They do not vanish.

**Cell differentiation:**
- Stem cells: base entity class (CRUD, audit trail, permissions, versioning)
- Epithelial cells: boundary entities (users, companies, contacts)
- Connective tissue cells: junction entities (contract-to-project, submittal-to-spec-section)
- Specialized organ cells: Gantt tasks with critical path logic, BIM elements with spatial data

---

## II. THE NERVOUS SYSTEM — Event Architecture and Signal Propagation

Construction is a real-time coordination problem.

**Somatic Nervous System (conscious, voluntary):** Deliberate user actions — mark task complete, approve change order, submit RFI. Explicit. Traceable. Request-response.

**Autonomic Nervous System (unconscious, involuntary):** This is where the platform becomes alive:
- Schedule task slips → downstream tasks recalculate → critical path updates → subcontractors alert → lookahead regenerates → owner dashboard updates. *No human triggered anything after the first slip.*
- Cost code exceeds 80% → commitments restrict → PM escalation → forecast recalibrates
- Submittal returned "Revise and Resubmit" → procurement schedule adjusts → installation task shifts → lookahead flags → owner milestone updates

**Reflex Arcs:** Offline-capable field reactions. If connectivity drops, daily log still saves, photos queue, safety checklists enforce, time entries record. Spinal cord handles this. Not the brain.

**Pain Signals:** RFI unanswered 14 days = pain. Budget overrun = pain. Expiring insurance = pain. Pain must escalate. Pain must demand response. But calibrate thresholds — a system that screams about everything is ignored about everything.

**Neurotransmitters:**
- Dopamine: milestone completions, budget under-runs (reward/motivate)
- Serotonin: steady-state confirmations, backup completed (create calm confidence)
- Norepinephrine: action-required items, approaching deadlines (focus without panic)
- Cortisol: safety incidents, critical path delays, regulatory violations (break through noise)
- Endorphins: crisis resolved, corrective action closed (close the loop, prevent chronic stress)

---

## III. THE IMMUNE SYSTEM — Security, Validation, Self-Defense

The immune system does not wait for disease. It assumes disease is constant and inevitable.

**Innate immune system (always-on):**
- Input validation on every membrane — SQL injection, XSS, malformed data, impossible dates rejected at the boundary
- Authentication on every request
- Encryption in transit and at rest
- Rate limiting
- Audit logging — every intrusion attempt, every anomaly
- CSRF, CORS, header hardening

**Adaptive immune system (learned, specific):**
- Anomaly detection: pattern deviation triggers immune response
- Permission evolution: project-phase-aware access (architect write during design, review-only during construction)
- Quarantine: bad data isolated, not propagated
- Autoimmune awareness: protect the organism from itself — soft deletes, reversible operations, confirmation proportional to blast radius
- Immune memory: when the system encounters a new error type, it generates a validation rule that catches it next time

---

## IV. THE CIRCULATORY SYSTEM — Data Flow and Distribution

**Arterial flow:** Server → client, database → dashboards, master data → derived views.
**Venous flow:** Field data → project database, actuals → forecast model.
**Capillaries:** The API edge. A superintendent on-site needs today's tasks, their crew list, and the weather — not the full project budget. Capillaries deliver exactly what the local cell needs.

Blood pressure regulation: backpressure mechanisms, circuit breakers, adaptive throttling, intelligent caching.

Clotting: when a data vessel fails, fail gracefully, stop the bleeding, reroute through cached data and degraded-but-functional modes.

Blood types: A CFO and a field worker looking at the same project need different data shapes. The circulatory system type-matches deliveries.

---

## V. THE SKELETAL SYSTEM — Data Model and Schema Architecture

- Load-bearing bones: Project, Contract, Schedule, Budget, User, Company. Never break these. Schema changes = orthopedic surgery.
- Joints: relationships between entities. Over-constraining = arthritis. Under-constraining = dislocation.
- Cartilage: JSON columns, polymorphic associations, event sourcing. Buffer between rigid schemas.
- Bone marrow: materialized views, computed aggregations, derived metrics — blood cells manufactured inside the skeleton.
- Growth plates: schema migrations. Additive where possible. Never remove a load-bearing column without adaptation of all dependent tissues.

---

## VI. THE MUSCULAR SYSTEM — Business Logic and Computation

**Type I fibers (slow-twitch, endurance):** Background processes — nightly calculations, monthly roll-ups, report generation, search index rebuilding. Reliable, efficient, never fast.

**Type II fibers (fast-twitch, power):** Real-time operations — saving a daily log, approving an invoice. Must feel instantaneous. Defer heavy work to Type I (async queues, background workers).

**Antagonistic pairs:**
- Logic that accelerates schedules vs. logic that validates feasibility
- Logic that approves expenditure vs. logic that enforces budget
- Logic that grants access vs. logic that audits access
- Logic that simplifies UI vs. logic that ensures completeness

**Muscle memory:** Repeated operations become faster. Pre-populate known crews, suggest known assignees, auto-apply known templates. The organism reduces metabolic cost for repeated motions.

---

## VII. THE ENDOCRINE SYSTEM — Configuration, Feature Flags, Global State

Feature flags are hormones — they don't target one cell, they flow systemwide and every receptor responds.

Tenant configuration is hormonal — same cells, different hormonal environment, different behavior. This is multi-tenancy.

Thresholds and policies are hormonal — budget warning at 80%, auto-approval limit, retention periods, inactivity timeout.

**Circadian rhythm — Time-Based Behavioral Cycles:**
- Daily: morning digest, midday field operations, evening batch, night maintenance
- Weekly: Monday lookahead generation, Friday progress reports
- Monthly: cost period close, pay application generation, budget reconciliation
- Project lifecycle: preconstruction (slow metabolism), construction (high metabolism), closeout (declining metabolism), post-construction (dormant but alive — warranty tracking)

---

## VIII. THE RESPIRATORY SYSTEM — External Integration and I/O

**Inhalation:** Accounting (QuickBooks, Sage, Viewpoint, Yardi), design tools (Autodesk, Bluebeam, Revit), scheduling (Primavera P6, MS Project), BIM (BIM 360, Trimble), weather APIs, permitting databases, GIS, IoT sensors, drone surveys.

**Exhalation:** Reports to owners, pay applications to banks, compliance to regulators, certified payroll to government, OSHA reports, insurance certificates, commissioning data to building operators, as-built documents to facility managers.

**Asthma:** External API throttling or failure must not cause system-wide collapse. Degrade gracefully, queue retries, alert.

**Altitude adaptation:** Remote sites with poor connectivity = high altitude. More aggressive caching, larger offline stores, efficient sync. Well-connected offices = sea level. Adapt respiratory rate to environment.

---

## IX. THE DIGESTIVE SYSTEM — Data Ingestion, Transformation, Enrichment

Raw data is food. Useless until digested.

A superintendent's handwritten note → mouth (UI input) → chewed (parsed) → stomach (validated, enriched) → stomach acid (NLP extracts crew counts, equipment hours, weather, work performed, visitors) → small intestine (structured data written to labor tracking, equipment logs, weather records, progress updates) → large intestine (metadata extracted — timestamps, geolocation) → waste excreted (malformed data, duplicates filtered and logged).

**The gut microbiome — AI/ML models living in the digestive tract:**
- NLP model: auto-tags daily logs with cost codes, CSI divisions, work categories
- Computer vision: scans photos for safety violations (missing hard hats, unguarded openings)
- Document classification: routes uploaded files to correct categories
- Drawing analysis: extracts room names, dimensions, grid lines, spec references
- Invoice processing: reads PDF invoices, extracts vendor, amount, cost codes
- Schedule analysis: identifies logic errors, unrealistic durations, critical path risks

These are the microbiome — not the organism, but living inside it making it stronger.

---

## X. THE REGENERATION SYSTEM — Self-Healing, Recovery, Resilience

**Database corruption** → automated backup restoration with point-in-time recovery.
**Service failure** → health check detects dead tissue, circuit breaker isolates, failover routes around, auto-restart regens. No human intervention.
**Data corruption from user error** → event sourcing allows rewinding to any point. Soft deletes mean nothing truly dies until retention expires.
**Schema migration failure** → reversible migrations with automatic rollback.

**Scar tissue:** After recovery, the system is STRONGER at the failure point. A service that crashed due to memory exhaustion comes back with adjusted limits, new alerting thresholds, and a post-mortem entry. Scars are memory. Memory is immunity.

**Wound healing phases:**
1. Hemostasis (seconds-minutes): stop the bleeding — circuit breakers, isolation, write halt
2. Inflammation (minutes-hours): recruit resources — alerts, diagnostic logging, monitoring intensity
3. Proliferation (hours-days): rebuild — services restart, data reconciles, sync catches up
4. Remodeling (days-weeks): strengthen — post-incident analysis generates new rules, tests, improvements

---

## XI. THE INTEGUMENTARY SYSTEM — User Interface and Experience

Skin is the largest organ. It determines users' perception of the entire organism.

- **Epidermis:** The UI. Beautiful, responsive, constantly regenerating (UI updates, design iterations). V7 prompts.
- **Dermis:** The UX architecture — navigation patterns, information hierarchy, interaction models, accessibility. Strength and elasticity.
- **Hypodermis:** The design system — component libraries, design tokens, spacing scales, color palettes, typography. Consistency and resilience.
- **Sensory receptors:** Telemetry. Every click, scroll, hesitation, rage-click, abandoned workflow, failed search is sensory data. PostHog.
- **Thermoregulation:** Under load → graceful degradation, skeleton screens, optimistic UI. Under low load → animations, real-time presence, prefetching.
- **UV protection:** WCAG 2.1 AA, i18n, screen reader compatibility, color-blind-safe palettes. Survival in diverse environments.
- **Fingerprints:** Personalized dashboards, remembered preferences, role-appropriate defaults. The skin conforms to the individual.

---

## XII. THE LYMPHATIC SYSTEM — Logging, Monitoring, Observability

The lymphatic system is the drainage and surveillance network.

- **Structured logging:** lymph fluid — flows through every tissue collecting debug info, error traces, performance metrics
- **Distributed tracing:** the vessel network — follows a request across multiple services, revealing blockages
- **Alerting:** lymph node activation — detects pathogen, recruits immune cells (automated remediation, on-call escalation)
- **Dashboards:** the clinician's view — swollen nodes (unhealthy services), backed-up fluid (filling queues), active immune response (firing alerts)
- **Health check endpoints:** discrete lymph nodes — database connectivity, memory usage, queue depth, dependency status

---

## XIII. THE REPRODUCTIVE SYSTEM — Templating, Cloning, Scalability

**Project templates are gametes** — they carry half the genome (structure, workflows, cost codes, roles, document categories) and combine with project-specific data (participants, dates, budgets, site conditions) to produce a new living project.

**Portfolio management is pregnancy** — the enterprise carries and nourishes new projects, monitors health, manages pipeline, and eventually the project is born (goes live).

**Multi-tenancy is speciation** — different species, same kingdom. Same DNA expressed differently.

**Genetic diversity** — allow mutation (custom workflows, fields, templates). Track mutation (configuration drift). Incorporate adaptive mutations into base templates. Remove deleterious ones.

**Generational learning** — the twentieth project must be dramatically more efficient than the first. Accumulated wisdom feeds back into the genome.

---

## The Self-Referential Truth

The autonomous build organism we are building to build SiteSync PM is itself a living system using these same 13 patterns:

| Build System Component | Biological System |
|---|---|
| Nightly sessions (TONIGHT.md missions) | Cellular lifecycle — mission (DNA), execution (metabolism), commit/die (apoptosis) |
| Auto-revert, self-healing CI | Regeneration — wound healing, scar tissue, immune memory |
| Homeostasis CI quality gates | Immune system — innate defense, adaptive response |
| SESSION_BRIEF pre-digestion | Digestive system — metabolizing context into nutrients |
| FEEDBACK.md and strategist | Endocrine system — hormones setting global behavioral context |
| Swarm agents (Alpha/Beta/Gamma/Delta/Echo) | Muscular system — specialized fiber types |
| Health monitor, progress reports | Lymphatic system — surveillance and drainage |
| PAUSE.md escape valve | Pain signal and voluntary override |
| Quality floor ratchet | Homeostasis — physiological equilibrium maintained |
| SPEC.md genome | DNA — the organism knows what it must become |

The builder and the built are the same architecture. This is not coincidence. This is the only correct architecture for complex living systems.

