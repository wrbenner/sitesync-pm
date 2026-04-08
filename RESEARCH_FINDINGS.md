# RESEARCH SYNTHESIS — 30 Critical Findings
*Distilled from 25,000+ words of deep research across 28 topics (April 8, 2026)*
*The Product Mind and organism read this. Every finding is actionable.*

---

## CATEGORY A: Things We Must Change Immediately

### A1. Touch targets must be 56px, not 44px
Research: 44px is the WCAG minimum for general touchscreens. For industrial gloved use (construction field workers), the minimum is **56px**. SiteSync targets superintendents with dirty gloves on iPads. Every interactive element must be 56px minimum.
**Action:** Update CLAUDE.md, V7 prompts, AGENTS.md from 44px to 56px.

### A2. Supabase RLS is a 1,500x performance trap
Research: Default Supabase RLS with `auth.uid()` causes 11-second queries. Wrapping in `(select auth.uid())` drops to **7ms**. A 1,571x improvement. Every RLS policy in the 48 migrations must use the `(select ...)` pattern.
**Action:** Add to LEARNINGS.md immediately. The organism must audit ALL RLS policies on the next security night and apply the `(select auth.uid())` optimization.

### A3. Multi-agent degrades sequential tasks by 39-70%
Research (Google/MIT "Rule of 4"): Multi-agent improves parallel tasks by +80.9% but DEGRADES sequential tasks by 39-70%. The swarm agents should ONLY do independent parallel work (testing different pages, polishing different components). They should NEVER work on sequential dependencies.
**Action:** Verify MODULE_ASSIGNMENTS.md ensures zero overlap. The swarm is correctly designed for parallel-only work.

### A4. Context quality creates 3x cost difference
Research: On identical models, well-structured context (CLAUDE.md, .claudeignore, session briefs) produces 3x better results per dollar spent. Optimizing what the organism reads is MORE important than optimizing the model.
**Action:** .claudeignore is deployed ✅. SESSION_BRIEF.md is deployed ✅. CLAUDE.md is optimized ✅. Continue refining.

---

## CATEGORY B: Competitive Intelligence That Changes Strategy

### B1. Procore achieved FedRAMP Moderate (January 2026)
They are the first major commercial construction SaaS with FedRAMP. This unlocks DOD, GSA, and all federal construction. SiteSync cannot compete for federal work without it.
**Timeline:** Not worth pursuing before $20M ARR. SOC2 Type II first (Year 1), FedRAMP consideration (Year 3+).

### B2. Procore has 17,850 customers, 106% NRR, $74K implied ARPU
Their customers spend 6% more each year (106% net revenue retention). To compete, SiteSync needs expansion revenue (embedded fintech, upsell to AI Copilot Pro, add-on modules). The ACV pricing model + transaction fees achieves this.

### B3. Procore Agent Builder cannot modify or delete existing items
The Agent Builder is open beta but limited: it can CREATE items (RFIs, daily logs, submittals) but cannot modify or delete them. SiteSync's AI Copilot has no such limitation — full CRUD + predictive analytics + schedule risk.
**Positioning:** "Our AI doesn't just create items. It manages them."

### B4. Subcontractor payment crisis: 56-day average wait, $280B annual cost
43% of subs lack working capital due to slow payments. This is the embedded fintech opportunity. If SiteSync processes payments faster (7-day payment via Stripe Connect), subs will demand that GCs use SiteSync.
**Action:** The sub payment portal + early pay program = the network effect trigger.

### B5. Davis-Bacon compliance: 55 min/form × 143 hours/year per company
Manual certified payroll is the #1 compliance time sink on government projects. NOBODY has this automated in PM software. First to market wins the government construction vertical.

### B6. Embedding financial products adds 40-45% ARR, reduces churn 15-20%
Research confirms: embedded fintech is the business model multiplier. SiteSync's Stripe Connect integration is the foundation. The retainage tracker, early pay program, and AIA billing automation are the products.

---

## CATEGORY C: Product Design Standards

### C1. Animation timing research (specific values)
| Action | Duration | Easing |
|--------|----------|--------|
| Button press feedback | 100ms | ease-out |
| Panel slide in/out | 200-300ms | spring(1, 0.9, 0) |
| Page transition | 300-400ms | spring(1, 0.85, 0) |
| Toast notification appear | 200ms | ease-out |
| Toast notification dismiss | 150ms | ease-in |
| Modal open | 250ms | spring(1, 0.9, 0) |
| Modal close | 200ms | ease-in |
| Loading skeleton pulse | 1.5s | ease-in-out (infinite) |
| Hover state | 150ms | ease-out |
**Rule:** Springs for interactive elements. Easing curves for system animations. Mobile: 1.1x duration. Tablet: 1.0x. Desktop: 0.9x.

### C2. Loading state decision matrix
| Wait time | Pattern | Example |
|-----------|---------|---------|
| 0-200ms | No indicator | Instant feel |
| 200ms-1s | Skeleton screen | Dashboard widgets loading |
| 1-3s | Skeleton + progress hint | "Loading 24 RFIs..." |
| 3-10s | Progress bar with estimate | File upload, report generation |
| 10s+ | Background job with notification | PDF export, AI analysis |
**Never:** Spinner for waits under 3 seconds. Skeletons always.

### C3. The 8 patterns every best-designed enterprise app shares
1. Command palette (Cmd+K) for power users
2. Keyboard shortcuts for every common action
3. Instant search across all entities
4. Contextual actions on hover (not buried in menus)
5. Optimistic UI updates (action feels instant, server confirms later)
6. Progressive disclosure (simple first, details on demand)
7. Consistent motion language (same spring for all panels)
8. Zero-state design that teaches (empty states guide, not just inform)

### C4. AI UX: streaming responses, never spinners
Research: AI responses should stream word-by-word (200-400ms latency acceptable). Never show a spinner and then dump the full response. The streaming creates the "thinking" feel that builds trust.
**Confidence display:** For GCs (non-technical), use qualitative language: "High confidence" / "Moderate confidence" / "Low confidence — verify with engineer." Never show numerical percentages.

### C5. Dark mode: the correct implementation pattern
Use CSS custom properties with `prefers-color-scheme` media query. Never invert colors. Design dark mode as a separate palette: surfaces get darker, text gets lighter, but primary brand colors STAY the same. The orange (#F47820) remains orange in both modes.

---

## CATEGORY D: Technical Architecture

### D1. Offline-first: Dexie.js for MVP, CRDTs for future
Dexie (IndexedDB wrapper) is correct for the current architecture. Last-write-wins for single-user entities (daily logs, task updates). CRDTs (via Yjs) for collaborative documents that multiple users edit simultaneously (specs, meeting minutes). Full CRDT implementation is a Phase 3 feature.

### D2. Supabase real-time: 10,000 concurrent connections on Team plan
Free: 200. Pro: 500. Team ($599/month): 10,000. Enterprise: unlimited. For SiteSync with 100 GC customers × 50 users each = 5,000 peak concurrent. Team plan is sufficient until 200+ customers.

### D3. React 19 concurrent features to use NOW
- `useTransition` for non-blocking list filtering and search
- `use()` hook for simplified data fetching in Suspense boundaries
- Server Components (if migrating to Next.js/Remix — not applicable for current Vite setup)
- Automatic batching (already active in React 18+, even better in 19)

### D4. Bundle splitting: route-level + component-level
- Every page in `src/pages/` should be `React.lazy()` with `Suspense`
- Heavy components (BIM viewer, charts, rich text editor) lazy-loaded independently
- Target: no initial chunk > 200KB. Total budget: < 2MB for all chunks.
- Vite 8 automatic code splitting handles most of this — but verify with `npm run build:analyze`

### D5. Service Worker for offline: Workbox is the standard
Workbox (by Google) is the production standard for Service Worker management in React apps. Cache-first for static assets, network-first for API calls, stale-while-revalidate for non-critical data. Add to the V7 prompts as a Night 3 (offline) enhancement.

---

## CATEGORY E: Organism Self-Improvement

### E1. AlphaEvolve ran for 1+ year, recovered 0.7% of Google's global compute
Proof that evolutionary optimization loops produce real value at scale over long timeframes. The SiteSync organism is architecturally similar. Time horizon matters — the organism should run for years, not weeks.

### E2. Darwin Gödel Machine: 20% → 50% SWE-bench over 80 iterations
Self-improving agent that modifies its own code over 80 iterations. Cost: $22K per run. Proof that recursive self-improvement works for coding agents. The organism's evolution engine (LEARNINGS.md + EVOLUTION_LEDGER.json) is the lightweight version of this.

### E3. Three rules to prevent model collapse
1. **Never replace real data with synthetic data** — always ground in real user behavior (PostHog)
2. **Use verified synthetic data only** — the organism's tests must pass, not just compile
3. **Active curation** — the Product Mind reviews what the organism builds and corrects drift

### E4. Voyager Skill Library: 3.3x more items, 15.3x faster milestones
NVIDIA's Voyager stores successful programs in an expanding skill library. EVOLUTION_LEDGER.json should evolve into this: each successful approach becomes a reusable skill that future sessions can compose into larger capabilities.

### E5. The "+10.87% from prompt tuning alone" finding
Research on Claude Code showed that well-structured CLAUDE.md with clear rules produces 10.87% better benchmark scores with the SAME model. Our CLAUDE.md optimization directly improves organism output quality.

---

## CATEGORY F: Business Model Validation

### F1. Vertical SaaS: 18-32% growth vs 12-15% horizontal
SiteSync IS vertical SaaS. The market is growing 2x faster. 35% of all SaaS revenue is now vertical. The construction vertical specifically is projected to reach $50.4B by 2036.

### F2. Enterprise sales cycle: 134 days average, 270 days for >$500K ACV
This means SiteSync's first enterprise deals (starting sales in Q2 2026) would close in Q4 2026. The product-led approach (free sub portal, 5-minute onboarding, transparent pricing) can compress this for mid-market.

### F3. SOC2 timeline: 4-12 weeks Type I, 6-12 months Type II total
With Secureframe (~$5K/year) + auditor (~$15K), Type I is achievable by Q3 2026. This unblocks mid-market enterprise deals. Supabase and Vercel already cover infrastructure controls.

### F4. Decision makers by company size
- < 50 employees: Owner/President decides
- 50-250: VP of Operations or Director of IT
- 250-1000: CTO/CIO with committee
- 1000+: Procurement committee (6-12 month cycle)
SiteSync's sweet spot (10-250 employees) has Owner or VP as decision maker — 1-2 person decision.

---

*This synthesis is read by the Product Mind nightly. Each finding should influence prioritization.*
*Full research reports: research/track1_autonomous_systems.md through track4_enterprise_infra.md*
