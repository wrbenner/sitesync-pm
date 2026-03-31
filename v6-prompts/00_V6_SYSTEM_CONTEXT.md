# V6 SYSTEM CONTEXT: SiteSync AI (Construction PM Platform)

**Status:** Post-V5 Cleanup & Frontier AI Integration
**Last Updated:** March 31, 2026
**This file MUST be pasted before every V6 prompt**

---

## Platform State

**Codebase:**
- 86,072 lines TypeScript/TSX across 638 files
- React 19.2.4 + Vite 8.0.1 + TypeScript 5.9.3 + Supabase 2.100.1
- 40 pages, 180+ components, 38 hooks, 24 Zustand stores, 9 XState machines
- 20 edge functions, 48 migrations, REST API v1 (23+ endpoints)

**Key Directories:**
- `/src/pages` — 40 page routes (onboarding, projects, budgets, safety, etc.)
- `/src/components` — 180+ components (Primitives.tsx is STILL 1,513 lines)
- `/src/hooks` — 38 custom hooks (query builders, mutations, auth)
- `/src/stores` — 24 Zustand stores (26 files) — **CRITICAL GAP: bypass audited mutation framework**
- `/src/mutations` — createAuditedMutation pattern (only 13/26 stores use it)
- `/src/edge-functions` — 20 Supabase edge functions (auth, AI, webhooks, export)
- `/src/types` — TypeScript interfaces (spread across 12 files)
- `/src/validators` — Zod schemas (9 total — ONLY 7 form + 2 AI)
- `/tests` — Vitest + Playwright (21 test files — 8% coverage of components)

**AI & Generative UI:**
- Claude Sonnet 4 integration via Anthropic SDK
- 6 specialist agents: estimating, safety, payroll, bim, safety-video, equipment
- 13 generative UI components (AG-UI streaming from /src/components/ai)
- 4 mutation agents leveraging tool_use for real-time updates

**3D & Visualization:**
- Three.js WebGL (current — NOT WebGPU yet)
- web-ifc library for IFC model loading
- BIM viewer in `/src/pages/bim-viewer.tsx` (12KB)
- Drone/LiDAR point cloud placeholder (not yet implemented)

**Fintech & Compliance:**
- Stripe Connect for subcontractor payments
- AIA G702/G703 forms + lien waivers (5 states: CA, TX, FL, NY, IL)
- Certified payroll framework (forms only — UI not built)
- COI tracking with automated insurance verification

**Enterprise & Collaboration:**
- SSO/SAML: Okta, Azure AD, OneLogin, Google via `/src/edge-functions/auth`
- Liveblocks real-time collaboration (comments, cursors, document sync)
- Cross-project benchmarking in `/src/pages/benchmarks.tsx`
- Subcontractor reputation scoring (network effects)

**Mobile & PWA:**
- Capacitor 8 (iOS + Android) via `/capacitor-config.json`
- PWA with Workbox service worker
- Offline-first sync queue for mobile

**Testing:**
- Vitest + Playwright
- 21 test files (vitest.config.ts in root)
- CI/CD: GitHub Actions via `.github/workflows`

---

## Critical Gaps from V5

1. **Zustand Stores Bypass Auditing** — All 24 stores in `/src/stores` use raw Supabase calls, NO validation, NO permissions, NO audit trail. Must migrate to React Query + createAuditedMutation.

2. **Primitives.tsx Is Bloated** — 1,513 lines in `/src/components/primitives.tsx`. Phase 1E was supposed to split into individual files. Still not done.

3. **13 Mutations Not Audited** — Non-createAuditedMutation mutations still exist. Examples: budget edits, schedule changes, safety log entries.

4. **Minimal Zod Coverage** — Only 9 Zod schemas total (7 forms + 2 AI). Most entities (Project, Task, Safety, etc.) are unvalidated.

5. **179 `as any` Casts Remain** — 41 in stores alone. Blocks TypeScript safety. Must build typed Supabase query builders.

6. **BIM Viewer Is WebGL** — Competitive disadvantage vs. Autodesk (now Forma) with WebGPU-native geometry AI. Estimated 15-30x perf gain available.

7. **No Real-Time Video Safety** — Only static photo analysis (3 unsafe labor practices detected). Live camera PPE/hazard detection not implemented.

8. **Certified Payroll UI Missing** — Only data models in `/src/edge-functions/payroll-engine.ts`. No UI for Davis-Bacon compliance entry.

9. **Test Coverage ~8%** — 21 test files across 180+ components. No integration tests for mutations or workflows.

10. **No MCP Server** — SiteSync APIs not exposed to Claude/GPT ecosystem. Competitive disadvantage as MCP adoption hits 97M/month.

---

## Competitive Intelligence (March 2026)

- **Procore:** Agent Builder in open beta for ALL customers, Agentic APIs going GA, photo intelligence
- **Autodesk Forma:** Geometry-based AI assistants, quality defect detection via LiDAR
- **Oracle:** Safety AI predicting 50% incident reduction (trained on 10,000+ project-years)
- **Startups:** $126M raised Q1 2026 (Fyld $41M video analysis, XBuild $19M AI estimating, Payra $15M fintech)
- **LLM Models:** Claude Opus 4.6 + computer use (Feb 5), GPT-5.4 + computer use + 1M context (Mar 5)
- **MCP Ecosystem:** 10,000+ servers, 97M monthly SDK downloads, v1.0 production-ready
- **WebGPU:** Production-ready in ALL browsers, 15-30x perf vs. WebGL
- **Digital Twins:** 42% of builders now use them (was 18% in Jan 2026)

---

## 18 Architecture Laws (V6)

| Law | Description | Status |
|-----|-------------|--------|
| 1 | ZERO MOCK DATA | Unchanged |
| 2 | EVERY MUTATION IS AUDITED | **Expanded:** Zustand stores MUST use createAuditedMutation, not raw supabase |
| 3 | EVERY PAGE HAS 5 STATES | Unchanged |
| 4 | EVERY BUTTON IS GATED | Unchanged |
| 5 | EVERY LIST IS PRODUCTION-SCALE | Unchanged |
| 6 | EVERY FORM IS BULLETPROOF | Unchanged |
| 7 | ZERO RAW VALUES | Unchanged |
| 8 | ZERO `as any` | **Upgraded:** Build typed Supabase query builders |
| 9 | STATE MACHINES OWN WORKFLOWS | Unchanged |
| 10 | MOBILE IS NOT AN AFTERTHOUGHT | Unchanged |
| 11 | ACCESSIBILITY IS NOT OPTIONAL | Unchanged |
| 12 | EDGE FUNCTIONS ARE SECURE BY DEFAULT | Unchanged |
| 13 | PERFORMANCE BUDGETS ARE ENFORCED | Unchanged |
| 14 | AI IS WOVEN IN, NOT BOLTED ON | Unchanged |
| 15 | NETWORK EFFECTS IN EVERY DECISION | Unchanged |
| 16 | EVERY PROMPT HAS A VERIFICATION SCRIPT | **NEW:** End every prompt with bash script validating work completed |
| 17 | MCP-FIRST INTEGRATION | **NEW:** All features expose MCP tool interfaces for external AI agents |
| 18 | STORES ARE NOT DATA LAYERS | **NEW:** Zustand stores hold UI state ONLY. Mutations → React Query + createAuditedMutation |

---

## V6 Phase Execution Order

### Track A: Fix What V5 Missed (Days 1-14)
- **A1:** Migrate Zustand stores to React Query + audit framework (THE BIGGEST GAP)
- **A2:** Split `/src/components/primitives.tsx` into individual module files
- **A3:** Eliminate all `as any` with typed Supabase query builders
- **A4:** Expand test coverage from 21 → 80+ test files (focus on mutations/workflows)
- **A5:** Upgrade 13 non-audited mutations to createAuditedMutation pattern

### Track B: Frontier AI (Days 7-30)
- **B1:** Build SiteSync MCP Server (expose all 23+ REST API endpoints as MCP tools)
- **B2:** Real-time video safety analysis (live camera feeds → PPE detection, hazard flagging, near-miss log)
- **B3:** AI computer use workflows (Claude computer use orchestrating desktop apps for contract extraction, cost estimation)
- **B4:** Multi-model routing agent (Claude vs. GPT-5.4 selection based on task type)

### Track C: Next-Gen 3D (Days 14-35)
- **C1:** Upgrade `/src/pages/bim-viewer.tsx` from WebGL to WebGPU (15-30x perf)
- **C2:** Drone/LiDAR point cloud integration (real site scan → digital twin matching)
- **C3:** 4D construction simulation (time-lapse Gantt timeline against 3D model)
- **C4:** Spatial computing ready (Apple Vision Pro visionOS layout patterns)

### Track D: Revenue Engine (Days 21-42)
- **D1:** Certified payroll UI + Davis-Bacon wage engine (tied to `/src/edge-functions/payroll-engine.ts`)
- **D2:** Embedded subcontractor payment platform (not just Stripe — full fintech workflows)
- **D3:** AI-powered estimating engine (RSMeans integration + historical project cost ML model)
- **D4:** Equipment telematics integration (United Rentals, Caterpillar, John Deere APIs)

### Track E: Ecosystem Moat (Days 28-50)
- **E1:** SiteSync SDK (TypeScript + Python) for API consumers
- **E2:** Integration app marketplace with 30/70 revenue share
- **E3:** White-label / OEM licensing infrastructure
- **E4:** FedRAMP readiness (matching Procore's government certification)

---

## Prompt Template for V6

Every V6 prompt MUST include:

1. **VERIFICATION SCRIPT** — Bash/grep at end validating work completed
2. **INLINE DIFFS** — Exact before→after showing changes
3. **ANTI-PATTERNS** — What NOT to do (common V5 mistakes)
4. **FILE REFERENCES** — Exact paths from codebase structure above

Example verification script format:
```bash
#!/bin/bash
# Verify [TASK NAME] completed
grep -r "SEARCH_PATTERN" /src --include="*.ts" --include="*.tsx"
find /src -name "*.test.ts" | wc -l  # Should be ≥ 80
grep -c "as any" /src --include="*.tsx" 2>/dev/null | xargs echo "Remaining: "
```

---

## Key File Locations

- Mutations: `/src/mutations/create-audited-mutation.ts`
- Stores: `/src/stores/*.ts` (24 files, ALL need migration)
- Validators: `/src/validators/schemas.ts`
- Tests: `/tests/**/*.test.ts`
- Edge Functions: `/src/edge-functions/*.ts`
- Components: `/src/components/**/*.tsx`
- Pages: `/src/pages/*.tsx`
- BIM Viewer: `/src/pages/bim-viewer.tsx`
- Payroll Engine: `/src/edge-functions/payroll-engine.ts`
- REST API: `/src/edge-functions/api/*.ts`

---

## Critical Success Factors for V6

1. **All mutations must flow through createAuditedMutation** — non-negotiable
2. **Every component must have 5-state handling** — loading, error, empty, data, permissions
3. **No raw Supabase calls in components** — all via React Query hooks
4. **Every form must validate with Zod** — no loose strings
5. **MCP first** — design tools as MCP interfaces for external agents
6. **Verification scripts prove work** — not human inspection

**Do not proceed with implementation until this context is pasted in the prompt.**
