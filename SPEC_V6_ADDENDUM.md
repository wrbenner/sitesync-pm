# SPEC V6 Addendum — P5 Frontier Features

*These are the features that create an uncrossable moat. Procore cannot build these. Autodesk cannot build these at this speed. These are the $1B features.*

---

## P5-A: Foundation Hardening (V6 A-Track)

### P5-A1: Store Migration to Audited Mutations
**Status:** 0% complete
**Impact:** Security + data integrity
**Known gap:** 13/26 stores bypass the audited mutation framework (raw Supabase calls, no validation, no permissions, no audit trail)

**Acceptance Criteria:**
- [ ] All 24 Zustand stores migrated to React Query + createAuditedMutation
- [ ] Zero raw `supabase.from().insert/update/delete` calls outside of hooks/mutations
- [ ] Every mutation: permission → Zod validate → execute → invalidate → audit → toast
- [ ] 179 `as any` casts reduced to < 50

### P5-A2: Primitives.tsx Split
**Status:** 0% complete  
**Impact:** Bundle size + maintainability
**Known gap:** Primitives.tsx is 1,513 lines — one file for all shared components

**Acceptance Criteria:**
- [ ] Primitives.tsx split into individual files: Btn.tsx, Card.tsx, Tag.tsx, MetricBox.tsx, etc.
- [ ] Each component file < 200 lines
- [ ] No breaking changes to existing imports (barrel export from components/index.ts)
- [ ] Bundle size does not increase

### P5-A3: Full Type Safety
**Acceptance Criteria:**
- [ ] 179 `as any` casts eliminated — replaced with proper generics/discriminated unions
- [ ] Typed Supabase query builders using Database type from types/database.ts
- [ ] All 9 Zod schemas expanded to cover ALL entities (Project, Task, Safety, Daily Log, etc.)
- [ ] `npx tsc --strict --noImplicitAny` passes with zero errors

### P5-A4: Test Coverage to 70%
**Acceptance Criteria:**
- [ ] Coverage: statements 70%, branches 60%, functions 70%, lines 70%
- [ ] Every state machine transition tested
- [ ] Every mutation hook tested (mocked Supabase)
- [ ] Every permission check tested
- [ ] Every form validation tested

### P5-A5: Audit All Mutations
**Acceptance Criteria:**
- [ ] 13 remaining non-audited mutations migrated to createAuditedMutation
- [ ] Budget edits, schedule changes, safety log entries all audited
- [ ] AuditTrail page shows complete history for all entity types

---

## P5-B: AI Frontier (V6 B-Track)

### P5-B1: MCP Server — Construction AI Platform Integration Layer
**Status:** 0% complete
**Impact:** CRITICAL — Procore launched Agentic APIs + MCP in March 2026. We have nothing.
**Strategic value:** ANY AI agent (Claude, GPT-5.4, Gemini) can natively interact with SiteSync data. No custom integrations needed.

**Acceptance Criteria:**
- [ ] MCP server in `mcp-server/` with 30+ tools covering all entities
- [ ] Tools: list_projects, get_project, list_rfis, create_rfi, get_budget, list_tasks, get_schedule, etc.
- [ ] Authentication: JWT-based, maps to Supabase RLS
- [ ] Resources: project URIs, document retrieval, photo indexing
- [ ] Published to npm as `@sitesync/mcp-server`
- [ ] Claude Code can call SiteSync via MCP during autonomous build sessions
- [ ] README with 5-minute setup for enterprise customers

### P5-B2: Real-Time Video Safety AI
**Status:** 0% complete
**Impact:** HIGH — Fyld raised $41M for this vertical
**Strategic value:** Live camera analysis for PPE detection, hazard identification, near-miss logging

**Acceptance Criteria:**
- [ ] Real-time video stream analysis via Claude Vision or specialized model
- [ ] PPE detection: hard hat, vest, safety glasses, boots
- [ ] Hazard zone violation detection (restricted area breach)
- [ ] Near-miss event logging with timestamp + frame capture
- [ ] Integration with Safety page — safety score updates in real-time
- [ ] Push notification when violation detected (Capacitor push)
- [ ] Works on mobile (iPad camera on jobsite)

### P5-B3: Computer Use Integration
**Acceptance Criteria:**
- [ ] Claude computer use for document processing (plans, specs, reports)
- [ ] Navigate external systems (DOT portal, building department websites) on behalf of users
- [ ] Extract data from legacy PDFs and populate SiteSync fields
- [ ] Run in sandboxed environment

### P5-B4: Multi-Model AI Routing
**Acceptance Criteria:**
- [ ] Model router in edge functions: fast tasks → Claude Haiku/Sonnet, deep reasoning → Claude Opus
- [ ] Fallback chain: primary model → secondary → graceful degradation
- [ ] Cost tracking per AI operation (stored in ai_usage table from migration 00020)
- [ ] Latency-based routing: if P99 > 3s, route to faster model

---

## P5-C: 3D & Spatial Frontier (V6 C-Track)

### P5-C1: WebGPU BIM Viewer
**Status:** 0% complete — currently WebGL (Three.js r183)
**Impact:** HIGH — 15-30x rendering performance. Autodesk Forma uses geometry-based AI.

**Acceptance Criteria:**
- [ ] WebGPU renderer as primary (three.js r171+)
- [ ] WebGL2 fallback for unsupported browsers
- [ ] Compute shaders for mesh processing and clash detection
- [ ] GPU-driven instanced rendering for large models
- [ ] Handle 100M+ triangle models at 60fps on modern hardware
- [ ] Streaming geometry loading (progressive LOD)
- [ ] Benchmark: 5x performance improvement on test model vs. current WebGL

### P5-C2: Point Cloud / LiDAR Integration
**Acceptance Criteria:**
- [ ] LAS/LAZ file format support
- [ ] Drone capture integration (DJI SDK or API)
- [ ] Point cloud overlay on BIM model for as-built vs. as-designed comparison
- [ ] Deviation heatmap (red = deviation > threshold)

### P5-C3: 4D Schedule Simulation
**Acceptance Criteria:**
- [ ] Link Gantt schedule tasks to BIM model elements
- [ ] Animate construction sequence in 3D
- [ ] Scrub timeline to see model state at any date
- [ ] Export as video for owner presentations

### P5-C4: Spatial Computing (AR)
**Acceptance Criteria:**
- [ ] WebXR API integration for mobile AR
- [ ] Overlay BIM model on camera view
- [ ] Point to wall → see what's inside (MEP, structure)
- [ ] Works on iPhone 15 Pro and iPad Pro via RealityKit bridge

---

## P5-D: Embedded Fintech (V6 D-Track)

### P5-D1: Certified Payroll (Davis-Bacon Compliance)
**Status:** Data model exists, UI missing
**Impact:** HIGH — required for all government-funded projects
**Strategic value:** $5B+ market, zero competitors have this in PM software

**Acceptance Criteria:**
- [ ] Weekly payroll entry form with trade classification + hours + fringe benefits
- [ ] WH-347 form generation (PDF export)
- [ ] Multi-state prevailing wage rates database
- [ ] Automated compliance checking (flags violations before submission)
- [ ] Submit to DOL via API or eSubs platform
- [ ] Contractor certification workflow (GC verifies subs are compliant)

### P5-D2: Full Embedded Fintech Platform
**Status:** Stripe Connect exists
**Impact:** VERY HIGH — 0.5-2% platform fee on $300-800M processed = $3-8M ARR at scale

**Acceptance Criteria:**
- [ ] Subcontractor payment portal (subs view their payment status)
- [ ] Vendor invoice matching (PO → invoice reconciliation)
- [ ] Retainage tracking across all subs with release dashboard
- [ ] Early payment discount program (SiteSync earns 0.5-2% fee)
- [ ] Cash flow forecasting (ML-powered, 90-day projection)
- [ ] SiteSync earns a platform fee on every transaction — embedded in SOV workflow

### P5-D3: AI Estimating
**Status:** Estimating page is a placeholder
**Impact:** HIGH — XBuild raised $19M for this
**Strategic value:** First GC to get an AI estimate from plans wins the job

**Acceptance Criteria:**
- [ ] Upload construction plans → AI extracts quantities
- [ ] Historical cost database (RSMeans integration or proprietary)
- [ ] Trade-by-trade breakdown (concrete, framing, MEP, finishes)
- [ ] Bid comparison matrix (multiple subs, weighted scoring)
- [ ] Owner budget vs. estimate reconciliation

### P5-D4: Equipment Telematics
**Acceptance Criteria:**
- [ ] GPS tracking integration (Trimble, JD Link, Volvo Connect)
- [ ] Equipment utilization reporting (hours run vs. idle)
- [ ] Maintenance alert triggers (based on hours or fault codes)
- [ ] Cost allocation: equipment hours → cost codes
- [ ] Theft alert (equipment moved off jobsite after hours)

---

## P5-E: Platform Ecosystem (V6 E-Track)

### P5-E1: TypeScript + Python SDK
**Status:** REST API v1 exists (23+ endpoints), SDKs missing
**Impact:** HIGH — developer ecosystem lock-in

**Acceptance Criteria:**
- [ ] TypeScript SDK published to npm as `@sitesync/sdk`
- [ ] Python SDK published to PyPI as `sitesync-sdk`
- [ ] Full CRUD for all entities
- [ ] Built-in auth, pagination, webhook handling, retry logic
- [ ] OpenAPI spec auto-generated from REST API
- [ ] Interactive documentation at developers.sitesync.ai
- [ ] 5-minute quickstart that actually works

### P5-E2: App Marketplace
**Acceptance Criteria:**
- [ ] Marketplace page lists vetted third-party apps
- [ ] Developer portal: register app, get client credentials, submit for review
- [ ] OAuth 2.0 for marketplace app authentication
- [ ] Revenue sharing: 70/30 split (developer/SiteSync) for paid apps
- [ ] Featured apps: Procore migration tool, QuickBooks sync, Autodesk BIM360 import

### P5-E3: White Label
**Acceptance Criteria:**
- [ ] Custom domain support (their domain, our infrastructure)
- [ ] Custom color theme override (replaces brand orange/navy)
- [ ] Custom logo and favicon
- [ ] Email templates with their branding
- [ ] Remove all SiteSync branding
- [ ] Pricing: $X,000/month minimum for white label tier

### P5-E4: FedRAMP Authorization
**Acceptance Criteria:**
- [ ] Gap analysis against FedRAMP Moderate controls (325 controls)
- [ ] System Security Plan (SSP) documentation
- [ ] FIPS 140-2 encryption at rest and in transit
- [ ] Multi-factor authentication for all users
- [ ] Continuous monitoring: automated vulnerability scanning
- [ ] Audit log retention: 3 years minimum
- [ ] Estimated timeline: 12-18 months with dedicated compliance team
