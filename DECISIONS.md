# DECISIONS.md — Architecture Decision Records
<!-- Every architectural decision that constrains future implementation. -->
<!-- New decisions require justification and trade-off analysis. -->
<!-- Decisions are immutable once recorded. To change, add a new ADR that supersedes. -->

## ADR-001: React 19 + TypeScript + Vite
**Date:** 2026-03-01
**Status:** Active
**Context:** Needed a modern, fast frontend framework for construction PM SaaS.
**Decision:** React 19 with TypeScript strict mode, Vite for build tooling.
**Trade-offs:** React ecosystem is mature but heavy. Vite provides fast HMR. TypeScript strict mode catches bugs early but increases development friction.
**Consequences:** All components must be typed. No `any` casts in production code.

## ADR-002: HashRouter for Client Side Routing
**Date:** 2026-03-01
**Status:** Active
**Context:** GitHub Pages deployment requires hash based routing.
**Decision:** react-router-dom with HashRouter.
**Trade-offs:** Hash URLs are less clean than path URLs but work on static hosts without server config.
**Consequences:** All route definitions in App.tsx. Deep links work without server side routing.

## ADR-003: Inline Styles with Design Tokens
**Date:** 2026-03-01
**Status:** Active
**Context:** Need consistent styling without CSS build complexity.
**Decision:** Inline styles using design tokens from `src/styles/theme.ts`. No CSS modules, no Tailwind.
**Trade-offs:** Inline styles lack pseudo selectors and media queries. Theme tokens provide consistency.
**Consequences:** Complex hover/focus states require JavaScript event handlers. All colors reference theme tokens.

## ADR-004: Supabase as Backend
**Date:** 2026-03-15
**Status:** Active
**Context:** Need a backend with auth, database, storage, and real time that a solo founder can manage.
**Decision:** Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions).
**Trade-offs:** Vendor lock in risk. PostgreSQL is standard enough to migrate if needed.
**Consequences:** All data access through Supabase client. RLS policies mandatory on every table. Migrations in `supabase/migrations/`.

## ADR-005: No Gantt Chart (Killed Feature)
**Date:** 2026-03-15
**Status:** Active
**Context:** Visual schedule display was requested. Gantt chart implementation explored.
**Decision:** Kill Gantt chart. Ship Critical Path Summary card instead.
**Trade-offs:** Gantt requires separate graph computation layer adding 45KB to bundle. Superintendents primarily need "what is late and who is responsible" which a list view delivers.
**Consequences:** Schedule page uses list/card views. Critical Path Summary provides 90% of value at 5% of implementation cost. See KILLED_FEATURES.md KF-001.

## ADR-006: Capacitor for Mobile
**Date:** 2026-03-20
**Status:** Active
**Context:** Field workers need native mobile capabilities (camera, GPS, push notifications, offline).
**Decision:** Capacitor wrapping the React app for iOS and Android.
**Trade-offs:** Not truly native. Performance acceptable for our use case. Single codebase advantage.
**Consequences:** Native plugins via @capacitor/* packages. Offline queue must handle sync conflicts.

## ADR-007: Claude API for AI Features
**Date:** 2026-03-25
**Status:** Active
**Context:** AI copilot needs a powerful LLM with construction domain understanding.
**Decision:** Anthropic Claude API via @ai-sdk/anthropic.
**Trade-offs:** API cost per request. Claude's context window is large enough for project context injection.
**Consequences:** All AI features call Claude through Supabase Edge Functions (server side, key not exposed). Shadow mode predictions use claude-sonnet-4-5 for cost efficiency.

## ADR-008: Organism Architecture
**Date:** 2026-04-05
**Status:** Active
**Context:** Traditional development loops produce technical debt. SiteSync needs compounding intelligence.
**Decision:** Implement seven system organism architecture: Genome (SPEC.md), Nervous System (orchestrator), Immune System (adversarial verification), Metabolism (evolutionary optimization), Memory (LEARNINGS.md + shadow mode), Reproductive System (feature evolution), Homeostasis (quality ratchet).
**Trade-offs:** Significant infrastructure investment upfront. Pays compound returns over time.
**Consequences:** All autonomous development must flow through the organism systems. Quality floors are enforced by CI. Features evolve through spec mutation and selection.

## ADR-009: Multi Agent Orchestration with Claude Code
**Date:** 2026-04-05
**Status:** Active
**Context:** Need parallel autonomous development with quality guarantees.
**Decision:** Five specialist agent roles (Investigator, Implementer, Tester, Critic, Verifier) running in isolated git worktrees, orchestrated by `orchestrator/index.ts`.
**Trade-offs:** API cost for multi agent runs. Worktree management complexity. Parallelism speed advantage outweighs cost.
**Consequences:** Each agent gets its own worktree. No two agents modify the same file simultaneously. Verifier has final authority on merge readiness.

## ADR-010: Quality Ratchet (Floors Never Regress)
**Date:** 2026-04-05
**Status:** Active
**Context:** Quality metrics tend to degrade over time in growing codebases.
**Decision:** `.quality-floor.json` records metric floors. CI enforces that no metric gets worse. When a metric improves, the floor is updated to the new level.
**Trade-offs:** Strict enforcement may block legitimate PRs that temporarily increase bundle size. Fix the code, never lower the floor.
**Consequences:** Bundle size, test coverage, TypeScript errors, accessibility violations, `as any` casts, and mock data counts are all ratcheted.

## ADR-011: Dexie (IndexedDB) for Offline Support
**Date:** 2026-03-20
**Status:** Active
**Context:** Construction sites often have poor/no connectivity. Data must be accessible and editable offline.
**Decision:** Dexie wraps IndexedDB for local storage. Offline mutations queued and synced when connection returns.
**Trade-offs:** Complex sync logic required. Conflict resolution needed when offline edits conflict with server changes.
**Consequences:** All field critical features must work offline. Sync queue processes when connectivity returns.

## ADR-012: Liveblocks for Real-time Presence
**Date:** 2026-03-25
**Status:** Active
**Context:** Need to show who is currently viewing/editing an entity (presence indicators, cursor awareness).
**Decision:** Liveblocks for presence and collaborative features. Supabase Realtime for data subscriptions.
**Trade-offs:** Two real-time systems. Liveblocks handles presence (who is where). Supabase Realtime handles data changes (what changed).
**Consequences:** Presence shown on entity detail pages. No conflicting edits without awareness.
