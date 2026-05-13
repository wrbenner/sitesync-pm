# `src/components/ui/` — shared UI primitives

These are the canonical primitives every product page should use. Anything that
ships outside this folder and reinvents one of these patterns counts as a
DESIGN-RESET violation.

The single source of truth for visual rules is
`specs/homepage-redesign/DESIGN-RESET.md`.

## What's here today

| Primitive | File | Status | Replaces |
|---|---|---|---|
| `StatusPill` | `StatusPill.tsx` | ✅ canonical | the dot+label pill that lives inline in `src/pages/RFIs.tsx`, `src/pages/punch-list/*`, `src/pages/schedule/*`, `src/pages/daily-log/*`, plus the tinted submittals one at `src/components/submittals/StatusPill.tsx` |

## Planned (DO NOT reinvent — wait for or contribute these)

| Primitive | Owner | What it replaces |
|---|---|---|
| `PageHeader` | unowned | the bespoke title/count/action rows inside every page file |
| `KpiTile` | unowned | `CockpitMetrics`, the per-page RFI/Budget/Files/Reports KPI cards, `KpiTile` in portfolio |
| `PageSkeleton` | unowned | `TableSkeleton`, `DailyLogSkeleton`, `PunchListSkeleton`, `FieldCaptureSkeleton`, `Skeletons.tsx`, `SkeletonLoaders.tsx` |
| `EmptyState` | unowned | the ad-hoc "No commitments yet" / "No reports generated yet" / "Loading X..." blocks |

If you're tempted to write a new pill, header, KPI tile, skeleton, or empty
state inside a page file: stop. Create the missing primitive here, get it
through review, then use it.

## StatusPill — usage

```tsx
import { StatusPill } from '@/components/ui/StatusPill'
import { toneForStatus } from '@/components/ui/statusTone'

// Inside a table row — subtle (no fill)
<StatusPill label="Open" tone="info" />
<StatusPill label="Overdue" tone="danger" />
<StatusPill label="Closed" tone="neutral" />

// Inside a page header — tinted (soft fill)
<StatusPill label="No activities" tone="success" variant="tinted" />
<StatusPill label="Not started" tone="neutral" variant="tinted" />

// When the status string comes from the DB and you want auto-tone:
<StatusPill label={row.status} tone={toneForStatus(row.status)} />
```

### Tones (DESIGN-RESET palette)

| Tone | Hex | Use for |
|---|---|---|
| `success` | `#2D8A6E` | on-track, resolved, approved, complete, paid, answered |
| `warning` | `#C4850C` | pending, in review, submitted, returned, medium |
| `danger` | `#C93B3B` | overdue, rejected, critical, blocked, failed |
| `high` | `#B8472E` | high severity, at-risk, slip-risk |
| `info` | `#3A7BC8` | in-progress, open, active, started |
| `iris` | `#4F46E5` | AI-related: Iris drafted, sent to reviewer, architect review |
| `neutral` | `#5C5550` | closed, void, archived, draft of a removed type |

### Migration order (high impact first)

1. `src/pages/RFIs.tsx` — status column already uses dot+label; swap to import
2. `src/pages/punch-list/*` — same
3. `src/pages/submittals/*` — remove the tinted local pill; use `variant="tinted"`
4. `src/pages/schedule/*` — header status pill
5. `src/pages/daily-log/*` — header status pill
6. Everything else
