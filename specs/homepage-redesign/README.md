# Homepage Redesign — Implementation Guide

## Read in This Order
1. `PRODUCT-DIRECTION.md` — the source of truth for the vision
2. `CONTRACT.md` — file-ownership boundaries for parallel work (read before you write a single line)
3. `SESSION-{N}-{name}.md` — your assigned tab's spec

## What We're Building
A role-native construction productivity operating system. Same data, same storage, different lens per role. The homepage is a Command stream — a single prioritized list of everything that needs the user's attention, filtered by their role, with inline actions and AI-prepared drafts.

## The Architecture
- **Command Layer** (homepage): role-filtered action stream answering "what needs me?"
- **Work Layer** (inline): act on items without leaving the stream
- **Record Layer** (deep pages): RFIs, Submittals, Schedule, Budget, Drawings, etc.

## Status

| Wave | Status | Notes |
|------|--------|-------|
| Wave 1 | ✅ Shipped (`0c3f561`) | 4-tab parallel landed clean. 13 tests passing. Polish-mandate paused for the duration of the redesign initiative. |
| Wave 2 | Ready to launch | 4 parallel tabs (Sessions 5–8). See `CONTRACT-WAVE-2.md`. |

## Wave 1 — 4 Parallel Tabs (shipped)

All four run **simultaneously** against the locked contract committed pre-flight on this branch. Zero file overlap (see `CONTRACT.md`).

| Tab | Session | Builds | Owned files |
|-----|---------|--------|-------------|
| A | [SESSION-1](SESSION-1-stream-data-layer.md) — Stream Data | `useActionStream`, role filters, snooze/dismiss store | `src/hooks/useActionStream.ts`, `src/stores/streamStore.ts`, `src/config/roleFilters.ts` |
| B | [SESSION-2](SESSION-2-stream-ui.md) — Stream UI | All stream components, homepage rewrite | `src/components/stream/*`, `src/pages/day/index.tsx` |
| C | [SESSION-3](SESSION-3-navigation-refactor.md) — Navigation | Sidebar, role-based nav, Cmd+K, mobile tab bar, magic-link sub route | `src/config/navigation.ts`, `src/components/Sidebar.tsx`, `src/components/CommandPalette.tsx`, `src/components/MobileTabBar.tsx`, `src/App.tsx` (route redirects only) |
| D | [SESSION-4](SESSION-4-iris-stream-integration.md) — Iris Service | Draft service, templates, draft store, enhancement detection | `src/services/iris/*`, `src/stores/irisDraftStore.ts` |

**Pre-flight (already committed on `feat/vision-substrate-and-polish-push`):**
- `src/types/stream.ts` — locked contract (do not modify mid-flight)
- `src/services/iris/index.ts` — stub (Tab D replaces)
- `src/stores/streamStore.ts` — stub (Tab A replaces)
- `src/hooks/useActionStream.ts` — stub (Tab A replaces)

### Merge Order
After all four tabs complete:
1. Tab A first (data layer)
2. Tab D second (Iris service)
3. Tab B third (UI consumes both)
4. Tab C last (navigation — independent, can merge anytime after A)

## Wave 2 — 4 Parallel Tabs (ready to launch)

Builds on the Wave 1 surface. `src/types/stream.ts` remains the locked contract. See `CONTRACT-WAVE-2.md` for ownership map.

| Tab | Session | Builds |
|-----|---------|--------|
| A | [SESSION-5](SESSION-5-commitment-tracker.md) — Commitment Tracker | `/commitments` page (currently broken — nav points there but page doesn't exist), derivation hook, table UI |
| B | [SESSION-6](SESSION-6-source-trail.md) — Universal Source Trail | Reusable `<SourceTrail>` component + integration into RFI / Submittal / Punch detail pages |
| C | [SESSION-7](SESSION-7-magic-link-backend.md) — Magic Link + Audit | Real `/sub/:token` validator (Edge Function), `actor_kind` audit attribution wired through hash-chain writes |
| D | [SESSION-8](SESSION-8-iris-wave2.md) — Iris Wave 2 | Verify draft flow end-to-end, build Owner Update generator on Reports page, full `owner_update` template |

Merge order: **C → A → B → D** (audit foundation first, then commitments, then additive source-trail integration, then Iris wire-up).

## Wave 3 (post-Wave-2)
| Session | Builds |
|---------|--------|
| 9 | Walk Mode (Super mobile guided field walk) |
| 10 | Cmd+K natural-language Iris queries |
| 11 | Architect Response Packet (AI-bundled RFI context) |
| 12 | Iris Phase 4: proactive risk detection + impact-chain text on Risk Cards |
| 13 | Executive Portfolio view (multi-project) |

## How to Run Each Tab in Claude Code

For each tab, open a fresh Claude Code session and use this prompt:

```
You are Tab {A|B|C|D} of the homepage redesign Wave 1.

Read these in order:
1. specs/homepage-redesign/PRODUCT-DIRECTION.md — the vision
2. specs/homepage-redesign/CONTRACT.md — file-ownership rules (DO NOT VIOLATE)
3. specs/homepage-redesign/SESSION-{N}-{name}.md — your assigned spec

The locked contract at src/types/stream.ts is committed and must not be modified.
The pre-flight stubs at src/services/iris/index.ts, src/stores/streamStore.ts,
and src/hooks/useActionStream.ts are committed; only the tab that owns each
stub may replace it.

Implement everything in your session spec. Do not edit files outside your
ownership list. Stack: React 19 + TypeScript + Vite, Zustand, React Query,
Framer Motion, Radix UI, Lucide. No Tailwind — use CSS custom properties from
src/styles/tokens.css and inline styles.

When done, run: pnpm typecheck && pnpm test (filtered to your owned paths).
Then write a short PR description summarizing the diff.
```

## Key Files Reference
| File | Pre-flight | Final owner |
|------|------------|-------------|
| `src/types/stream.ts` | **locked contract** | nobody (read-only) |
| `src/services/iris/index.ts` | identity stub | Tab D |
| `src/stores/streamStore.ts` | empty Zustand stub | Tab A |
| `src/hooks/useActionStream.ts` | empty result stub | Tab A |
| `src/config/roleFilters.ts` | n/a | Tab A creates |
| `src/components/stream/*.tsx` | n/a | Tab B creates |
| `src/pages/day/index.tsx` | exists (legacy) | Tab B rewrites |
| `src/config/navigation.ts` | n/a | Tab C creates |
| `src/components/Sidebar.tsx` | exists | Tab C rewrites |
| `src/components/CommandPalette.tsx` | check existing | Tab C creates/enhances |
| `src/components/MobileTabBar.tsx` | n/a | Tab C creates |
| `src/services/iris/drafts.ts` | n/a | Tab D creates |
| `src/services/iris/templates.ts` | n/a | Tab D creates |
| `src/stores/irisDraftStore.ts` | n/a | Tab D creates |
