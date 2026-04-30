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

## Wave 1 — 4 Parallel Tabs (tonight)

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

## Wave 2 (post-Wave-1)
| Session | Builds |
|---------|--------|
| 5 | Commitment Tracker dedicated page |
| 6 | Source Trail integration across record-layer pages |
| 7 | Walk Mode (Super mobile) |
| 8 | Owner Update generator |
| 9 | Cmd+K natural-language Iris queries |
| 10 | Architect Response Packet |

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
