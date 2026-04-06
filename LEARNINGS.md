# LEARNINGS.md — SiteSync Compounding Intelligence Log
<!-- Auto-appended by verifier agent after each successful cycle -->
<!-- Never delete entries. Archive to LEARNINGS_ARCHIVE.md after 200 entries. -->
<!-- Format: each entry has a date, source (how many cycles confirmed it), and the learning. -->

## Architecture Patterns (High Confidence)

<!-- Added 2026-04-02 | Source: 8 implementation cycles -->
- Supabase migration MUST precede component implementation. Reverse order causes phantom type errors that waste 2+ cycles to diagnose.

<!-- Added 2026-04-02 | Source: observed in 3+ modules -->
- Zustand stores co-located with page (not in /stores) prevents circular import issues that arise with 5+ interdependent stores.

<!-- Added 2026-04-03 | Source: 6 cycles of file thrashing -->
- One well implemented fix that raises a score by 5 points is worth more than five "fixes" that each lower it by 2. Quality over quantity.

<!-- Added 2026-04-03 | Source: bundle analysis -->
- New files = new surface area = lower scores. Fix existing files before adding new ones.

<!-- Added 2026-04-05 | Source: ADR-003 -->
- Inline styles with theme tokens is the only styling approach. No CSS modules, no Tailwind, no styled-components. Complex hover/focus states use JS event handlers.

<!-- Added 2026-04-05 | Source: implementation pattern observed across all pages -->
- When creating a new page, always add the route to `App.tsx` AND the sidebar item in `Sidebar.tsx` — forgetting one is the #1 cause of "page exists but can't navigate to it."

<!-- Added 2026-04-05 | Source: CreateRFIModal.tsx is the gold standard -->
- When creating a form modal, copy the pattern from `CreateRFIModal.tsx` — it has Zod validation, error handling, loading states, and proper accessibility.

<!-- Added 2026-04-05 | Source: 5+ entity creation cycles -->
- When adding a new entity type, the order is: migration → `types/entities.ts` → API endpoint → React Query hook → store (if needed) → machine (if workflow) → page.

<!-- Added 2026-04-05 | Source: audited mutation pattern -->
- Use the `createAuditedMutation` hook for all write operations — it handles permission checks, optimistic updates, cache invalidation, and audit trail automatically.

## Testing Patterns

<!-- Added 2026-04-05 | Source: E2E flake investigation -->
- E2E tests are more reliable with `data-testid` attributes than CSS selectors.

<!-- Added 2026-04-05 | Source: XState testing pattern -->
- State machine tests should test transitions, not implementation: `expect(machine.transition('open', 'APPROVE')).toMatch('approved')`.

<!-- Added 2026-04-05 | Source: test factory pattern -->
- Mock Supabase with the factory pattern in `src/test/factories.ts` — don't create inline mocks.

## Anti-Patterns (Hard Learned)

<!-- Added 2026-04-02 | Source: 3 failed attempts -->
- Do NOT add Framer Motion animations during initial implementation pass. They mask render performance issues that must be solved first.

<!-- Added 2026-04-02 | Source: Schedule.tsx modified 18 times -->
- Large refactors across 10+ files in one commit cause the immune system to reject at Tier 2 (too many concurrent state changes to verify).

<!-- Added 2026-04-02 | Source: auth-rbac declining 41 to 17 -->
- Do NOT build auth UI before auth backend works. Fix Supabase Auth, RLS, and session persistence FIRST. Then add UI.

<!-- Added 2026-04-02 | Source: 4 modules in continuous freefall -->
- Empty functions with TODO comments score WORSE than no function at all. The auditor sees incomplete code. Never ship stubs.

<!-- Added 2026-04-03 | Source: Run 5 post-mortem -->
- "100% fix rate" is meaningless if scores are declining. Measuring completion of tasks is not measuring quality of outcomes.

<!-- Added 2026-04-05 | Source: Previous engine failure -->
- Do NOT use floating point for money. Use integer cents. Financial calculations formally specified in SPEC.md.

## Domain Knowledge (Construction Specific)

<!-- Added 2026-04-05 | Source: Industry standard -->
- RFIs have a 14 day response SLA in most GC contracts. The UI must surface due dates with this context, not generic "created date" sorting.

<!-- Added 2026-04-05 | Source: Most requested Procore feature -->
- Submittal logs must track "ball in court" — who currently has action (GC vs architect vs supplier). This is the single most requested feature by supers.

<!-- Added 2026-04-05 | Source: ADR-005 -->
- Superintendents want "what is late and who is responsible." A list view with status delivers this. A Gantt chart does not. Ship the answer, not the visualization.

<!-- Added 2026-04-05 | Source: Field interviews -->
- AIA G702/G703 format is the industry standard for payment applications. Not supporting this format is a deal breaker for GCs.

<!-- Added 2026-04-05 | Source: Competitive analysis -->
- Procore's mobile RFI creation takes 12 taps. Ours must take 3 or fewer. Every extra tap is a lost user in the field.

<!-- Added 2026-04-05 | Source: Supabase auth architecture -->
- The Supabase client in `src/lib/supabase.ts` uses the anon key. Edge functions that need elevated access must use `createClient` with the service role key — but ONLY in edge functions, never in frontend code.

<!-- Added 2026-04-05 | Source: Capacitor dev environment -->
- Capacitor camera plugin doesn't work in dev server — use a web fallback with `navigator.mediaDevices.getUserMedia()`.

## Performance Insights

<!-- Added 2026-04-05 | Source: bundle analysis -->
- Nivo charts are heavy — always lazy load them with `React.lazy()` and `Suspense`.

<!-- Added 2026-04-05 | Source: bundle analysis -->
- The three.js/react-three-fiber bundle is ~200KB — it must be code split behind the Drawings/BIM route.

<!-- Added 2026-04-05 | Source: list performance testing -->
- Virtualize any list over 100 items with `@tanstack/react-virtual` — the PunchList and Activity pages hit this threshold.

## Shadow Mode Predictions (AI vs Human Actions)
<!-- Auto-populated by shadow_mode_logger.ts -->
| Date | Context | AI Prediction | Human Action | Match | Sent for Retraining |
|------|---------|---------------|--------------|-------|---------------------|
| — | _Shadow mode initialized. First entries will appear after user interactions._ | — | — | — | — |

## Previous Engine Run History (Archived from v0 Engine, 2026-04-02 to 2026-04-03)

Summary: 9 cycles executed across Surgeon and Architect modes. Total spend: $32.40.
Key finding: The previous automation engine (non-organism) had a 98-100% fix rate but DECLINING quality scores across 7 of 11 modules.
Root cause: The engine measured task completion, not quality outcomes. Each cycle added code that created new surface area for failures.
Resolution: The organism architecture (ADR-008) replaces the previous engine with adversarial verification, quality ratchets, and spec driven development.
Final module scores (Cycle 9): All modules at 50/100 baseline after reset.
