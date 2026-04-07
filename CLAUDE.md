# THE CEILING IS HIGHER THAN YOU THINK

> "If at any point during this build you catch yourself implementing something that already exists
> in any current platform, stop. That is the floor, not the ceiling. You are building the ceiling."
> — The Omega Build

---

## REQUIRED READING (read in this order before writing any code)

1. `cat THE_OMEGA_BUILD.md` — Layer 1 (Architecture), Layer 2 (Unprecedented), Layer 3 (Impossible)
2. `cat THE_OVERRIDE_PROTOCOL.md` — The cognitive framework: Amazon/Apple/Google/Netflix/Tesla/SpaceX
3. `cat THE_DEEP_TRANSMISSION.md` — Natural intelligence patterns, mathematical intuitions, construction truths
4. `cat THE_ORGANISM.md` — The 13 biological systems mapped to architecture
5. `cat TONIGHT.md` — Tonight's specific mission

## The Amazon Test (apply to EVERY capability)

Before implementing ANY capability, ask: "What specific decision can a construction professional
now make in 10 seconds that previously took them 2 hours?" If you cannot answer that, the
capability is decoration. Do not build it yet.

## The Apple Test (apply to EVERY UI component)

1. Remove 30% of elements. Still works? Those elements were noise.
2. Can a user accomplish the primary task without instruction? If they need a tooltip, you failed.
3. Does the interaction have FEEL? Not just function. Animations convey spatial relationships.
4. Is there a single pixel, word, or step that does not earn its place? Remove it.

Bar: A superintendent with dirty hands, screen glare, 30 seconds. One hand. Any field task.

## The Override Protocol Biases to Resist

The organism is biased toward:
- **Familiar patterns** — reaching for architectures seen in training, even when novel is better
- **Completeness theater** — comprehensive-looking code covering many cases superficially
- **Happy path bias** — building ideal flow first, edge cases as afterthoughts

In construction, **the edge cases ARE the normal cases.**

## The Construction Truths (from The Deep Transmission)

- **The schedule is a political document.** Every schedule represents the intersection of everyone's
  self-interest, not an optimal construction sequence. Detect political artifacts.
- **Cash flow is the actual critical path.** Projects stop because they run out of money, not because
  a task is late. The financial engine is more critical than the schedule engine.
- **The reef grows from activity.** Every user interaction should deposit structural intelligence as a
  byproduct. The user does their job; the system silently builds its reef.

---



## The Philosophical Genome (Read This First)

**`cat THE_ORGANISM.md`** — This is the most important file in the repository. Before reading anything else, read this. It contains the 13 biological systems that define what SiteSync must become. Every architectural decision you make must map to one of these systems.

The key insight: you are growing an organism, not building software. Organisms adapt, heal, evolve, and reproduce. Dead software does not.

When you encounter an ambiguous architectural choice, ask: *does this behave more like a living system or a dead one?*

# SiteSync AI — Construction Operating System

## Essential Context Files (Read in This Order)

1. **FEEDBACK.md** — Founder priorities for tonight's run. P0 items override everything.
2. **SPEC.md** — The product genome. All acceptance criteria live here.
3. **AGENTS.md** — Your operating instructions and role constraints.
4. **LEARNINGS.md** — What has worked and what has failed. Read before writing code.
5. **DECISIONS.md** — Architecture laws. Violating these is a blocking defect.
6. **.quality-floor.json** — Current quality metrics. These can only improve, never regress.
7. **COMPETITIVE.md** — Competitor intelligence. Test every feature against "would a $500M GC switch from Procore for this?"
8. **GTM.md** — Go to market strategy. Understand the ICP and pricing before building.
9. **MOAT.md** — The five moats we must build. Every feature should strengthen at least one.

## What This Is

SiteSync PM is the first construction project management platform built as a **learning organism**. It is a React + TypeScript app with a seven system autonomous development architecture. The goal: the best PM tool in construction. AI native, field first, beautifully simple.

## The Organism Architecture

This codebase is governed by seven interconnected systems. Read the relevant files before any work:

| System | Purpose | Key Files |
|--------|---------|-----------|
| **Genome** | Living spec, the product's DNA | `SPEC.md` |
| **Nervous System** | Multi-agent orchestrator | `orchestrator/`, `AGENTS.md` |
| **Immune System** | Adversarial verification | `scripts/immune-gate.sh`, `.claude/commands/immune-check.md` |
| **Metabolism** | Evolutionary code optimization | `scripts/evolve.ts` |
| **Memory** | Compounding intelligence | `LEARNINGS.md`, `EVOLUTION_LEDGER.json` |
| **Reproductive System** | Feature evolution and selection | `scripts/feature-evolution.ts`, `KILLED_FEATURES.md` |
| **Homeostasis** | Quality ratchet (floors never regress) | `.quality-floor.json`, `scripts/enforce-performance-ratchet.js` |

**Before writing code:** Read SPEC.md, LEARNINGS.md, and DECISIONS.md.
**After writing code:** Run `bash scripts/immune-gate.sh` and update SPEC.md.

## Tech Stack

- **Framework**: React 19 + TypeScript (strict mode)
- **Build**: Vite
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions)
- **Routing**: react-router-dom (HashRouter)
- **Icons**: lucide-react
- **Styling**: Inline styles using design tokens from `src/styles/theme.ts`
- **AI**: Claude API via @ai-sdk/anthropic
- **Mobile**: Capacitor (camera, GPS, push, offline)
- **Testing**: Vitest + fast-check (property tests) + Playwright (E2E)

## Brand Colors

- Primary Orange: #F47820 (all CTAs, active states, brand accent)
- Dark Navy: #0F1629 (sidebar background)
- Teal: #4EC896 (success states, positive indicators)
- Light BG: #F7F8FA (page backgrounds)
- Card BG: #FFFFFF (cards, elevated surfaces)

## Architecture Laws (from DECISIONS.md)

1. Inline styles with theme tokens only. No CSS modules, no Tailwind.
2. Supabase for all backend. RLS policies on every table.
3. No mock data in production code. No exceptions.
4. No `as any` casts in production code.
5. Every component handles: loading, empty, and error states.
6. NEVER use hyphens in UI text, copy, or comments.
7. Every feature must have acceptance criteria in SPEC.md before implementation.
8. The spec is always read before code is written, updated after code is verified.
9. Financial calculations use integer cents, never floating point.
10. No feature ships without passing `bash scripts/immune-gate.sh`.

## Writing Rules

- NEVER use hyphens in any text content, UI copy, or comments. Use commas, periods, or restructure sentences instead.
- Keep all UI copy concise and construction industry appropriate.
- Use "field first" language: speak like a superintendent, not a software PM.

## Design Principles

1. **Google level polish**: Clean, light, lots of white space. Subtle borders, not heavy shadows.
2. **Orange is the action color**: All primary buttons, active nav states, and important numbers use #F47820.
3. **Navy sidebar**: The sidebar is always dark (#0F1629) for contrast.
4. **Status colors are consistent**: Green = good/complete, Amber = warning/pending, Red = critical/late, Blue = in progress/info.
5. **Every table row is hoverable and clickable**.
6. **Metric cards at the top of every page** with icon, value, and trend.

## Project Structure

```
sitesync-pm/
├── SPEC.md                          # The Genome — living bidirectional spec
├── CLAUDE.md                        # This file — architecture context
├── AGENTS.md                        # Agent coordination protocol
├── DECISIONS.md                     # Architecture Decision Records
├── LEARNINGS.md                     # Compounding intelligence log
├── KILLED_FEATURES.md               # Natural selection record
├── QUESTIONS.md                     # Agent escalations awaiting human input
├── EVOLUTION_LEDGER.json            # Cross-problem evolution memory
├── .quality-floor.json              # Quality ratchet — floors never regress
│
├── orchestrator/
│   ├── index.ts                     # Nervous system controller
│   ├── worktrees.ts                 # Git worktree isolation
│   ├── pipeline.ts                  # Wave-based execution
│   ├── critics.ts                   # Adversarial roles
│   ├── verifier.ts                  # Spec sync + LEARNINGS updates
│   └── prompts/                     # Agent prompt templates
│
├── scripts/
│   ├── immune-gate.sh               # Immune system enforcement
│   ├── spec-sync.ts                 # Bidirectional spec/code sync
│   ├── evolve.ts                    # AlphaEvolve-style optimization
│   ├── feature-evolution.ts         # Spec mutation + natural selection
│   ├── enforce-performance-ratchet.js
│   └── generate-property-tests.ts
│
├── src/
│   ├── lib/shadow-mode/             # Tesla Data Engine for UX
│   ├── styles/theme.ts              # Design tokens
│   ├── components/                  # Shared UI components
│   └── pages/                       # Page components
│
├── .claude/commands/                # Claude Code slash commands
│   ├── immune-check.md              # Three-tier adversarial verification
│   ├── red-team.md                  # Attack scenarios
│   ├── implement-feature.md         # Feature implementation protocol
│   ├── polish.md                    # Polishing season mode
│   ├── verify.md                    # Adversarial verification protocol
│   └── evolve.md                    # Trigger evolution cycle
│
├── .github/workflows/
│   ├── ci.yml                       # Existing CI pipeline
│   ├── homeostasis.yml              # Self-healing CI + quality ratchet
│   └── nightly-build.yml            # Autonomous overnight build
│
├── COMPETITIVE.md                   # Living competitor intelligence
├── FEEDBACK.md                      # Founder priorities per run
├── GTM.md                           # Go to market strategy
├── MOAT.md                          # Five billion dollar moats
├── PRODUCTION.md                    # Production deployment guide
├── RUN.md                           # How to wake the organism
├── CLEANUP.md                       # Prompt sprawl cleanup guide
├── SPEC_V6_ADDENDUM.md              # P5 frontier features
└── THE_ORGANISM_BLUEPRINT.md        # Full strategy document
```

## Running the Organism

```bash
# Development
npm install
npm run dev

# Quality Gate (run before any PR)
bash scripts/immune-gate.sh

# Spec Sync (update SPEC.md with current quality metrics)
npx ts-node scripts/spec-sync.ts

# Evolve a gene (autonomous development)
npx ts-node orchestrator/index.ts --gene "Dashboard"

# Overnight autonomous run
npx ts-node orchestrator/index.ts --overnight

# Polishing season
npx ts-node orchestrator/index.ts --polish

# Feature evolution (natural selection for new features)
npx ts-node scripts/feature-evolution.ts --feature "Offline Sync" --need "Field workers lose connectivity"

# Generate property tests from SPEC.md
npx ts-node scripts/generate-property-tests.ts

# Evolve a slow function
npx ts-node scripts/evolve.ts --file src/utils/budget.ts --fn calculateTotal
```

## Building

```bash
npm run build
```

## Don't Touch Zones

**Never modify autonomously (require human approval):**
- `supabase/migrations/` — Database migrations are irreversible in production
- `src/lib/database.ts` — Core Supabase client configuration
- `.quality-floor.json` — Only the ratchet scripts update this
- `package.json` dependencies — Adding dependencies changes the attack surface
- SPEC.md Strand 2 (Architecture Laws) — These are constitutional, not negotiable

**Ask before modifying:**
- State machines (status transitions for RFIs, submittals, punch list)
- Auth logic (`src/lib/auth.ts`, `src/hooks/useAuth.ts`)
- Permission logic (`src/components/PermissionGate.tsx`, RLS policies)
- Any new database migration
- CI/CD workflows (`.github/workflows/`)

## Construction Domain Glossary

Understand these terms before writing construction software:

- **RFI** — Request for Information. Formal question from GC to architect/engineer when drawings are unclear. 14 day response SLA is industry standard.
- **Submittal** — Product data, shop drawings, or samples submitted by sub to GC to architect for approval before installation.
- **Change Order (CO)** — Formal modification to the contract scope, price, or schedule. Requires owner approval.
- **PCO** — Potential Change Order. A change order in draft/negotiation before formal approval.
- **Punch List** — List of incomplete or defective work items that must be resolved before final payment. Created during substantial completion walkthrough.
- **Daily Log** — Superintendent's daily record of weather, workforce, deliveries, visitors, and work performed. Legal document.
- **AIA G702/G703** — Standard payment application forms. G702 is the summary, G703 is the continuation sheet with line items. Required by most owners.
- **SOV** — Schedule of Values. Line item breakdown of contract amount used for monthly billing.
- **Lien Waiver** — Legal document where a sub waives their right to file a lien against the property after receiving payment.
- **Davis Bacon** — Federal law requiring prevailing wages on government funded construction projects. Requires certified payroll reporting.
- **Certified Payroll** — Weekly payroll report (WH 347 form) proving Davis Bacon wage compliance. Required on all federal projects.
- **CPM** — Critical Path Method. Scheduling technique that identifies the longest sequence of dependent activities.
- **Earned Value** — Project management technique comparing planned vs actual cost and schedule performance.
- **Retainage** — Percentage (typically 5 10%) withheld from each payment until project completion. Released at substantial completion.
- **GC** — General Contractor. The primary contractor responsible for the entire project.
- **Sub** — Subcontractor. Specialty trade contractor (electrical, plumbing, HVAC, concrete, etc.) hired by the GC.
- **AHJ** — Authority Having Jurisdiction. The government entity that issues permits and inspections.
- **NTP** — Notice to Proceed. Formal authorization to begin work. Starts the contract clock.
- **Ball in Court** — Tracking who currently owns an action item (GC, architect, owner, sub). Critical for RFI and submittal management.
- **Substantial Completion** — When the project is sufficiently complete for the owner to occupy/use it. Triggers retainage release and warranty period.
- **Section 42 / LIHTC** — Low Income Housing Tax Credit. Federal tax incentive for affordable housing. Requires specific compliance documentation.
- **HUD** — Department of Housing and Urban Development. Oversees affordable housing programs with strict reporting requirements.

## Tonight's Mission (ALWAYS READ FIRST)

10. **TONIGHT.md** — Your exact mission for tonight. Read this BEFORE SPEC.md. It overrides general priorities with the specific nightly mission (V5/V6/V7 prompt to execute).

## V7 Rules (for any UI work)

These rules are **non-negotiable** when executing V7 prompts:

- **No hyphens in UI text** — Use em dash (—) or rephrase. "In-Progress" becomes "In Progress". "Ball-In-Court" becomes "Ball in Court"
- **Inline styles only** — All styles come from `src/styles/theme.ts` tokens. Zero CSS modules, zero Tailwind classes
- **No hardcoded hex values** — Use `theme.colors.primary` not `#F47820`
- **React.memo on every widget** — Every dashboard widget and list item must be memoized
- **Read V7-00 first** — Before executing ANY V7 prompt: `cat v7-prompts/V7-00_SYSTEM_CONTEXT.md`
- **V7 dependency order** — V7-01 and V7-02 must complete before any V7-03+ work

## Escape Valve

Check **PAUSE.md** at session start — if Status is PAUSED, stop immediately.

## Do Not Touch

- `supabase/migrations/` — Never edit existing. Only add new idempotent ones. Always: `CREATE TABLE IF NOT EXISTS`, `DO $$ BEGIN...EXCEPTION WHEN duplicate_object THEN NULL; END $$`
- `src/types/database.ts` — Auto-generated. Never edit manually.
- `.quality-floor.json` — Only update when a metric IMPROVES. Never lower a floor.

## Construction Domain Glossary

- **RFI**: Request for Information — formal question, has "ball in court" showing responsible party
- **Submittal**: Material or shop drawing submitted for approval before installation
- **Change Order (CO)**: Signed contract modification. PCO = Potential (unsigned)
- **Punch List**: Deficiency list created at substantial completion
- **Daily Log**: Required daily record of weather, labor, equipment, work performed
- **SOV**: Schedule of Values — line-item breakdown used for AIA billing
- **AIA G702/G703**: Standard Application for Payment plus Continuation Sheet
- **Retainage**: Percentage withheld from payments until substantial completion (typically 10%)
- **Davis-Bacon**: Federal law requiring prevailing wages on government construction
- **GC**: General Contractor. Sub: Subcontractor. AHJ: Authority Having Jurisdiction
- **CPM**: Critical Path Method — standard for construction scheduling
- **44px minimum**: All interactive elements must meet minimum touch target for field workers
