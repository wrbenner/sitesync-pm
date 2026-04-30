# Session 1 (Tab A): useActionStream() Hook + Role Filters

## Read First (in order)
1. `specs/homepage-redesign/PRODUCT-DIRECTION.md` — the full product vision
2. `specs/homepage-redesign/CONTRACT.md` — your ownership boundaries (do not violate)
3. `src/types/stream.ts` — **locked contract** (already committed; read it; do not modify)
4. `src/pages/conversation/index.tsx` — existing InboxItem aggregation pattern
5. `src/pages/day/index.tsx` — existing urgent item priority logic

## Objective
Replace the pre-flight stub at `src/hooks/useActionStream.ts` with a working hook that aggregates every actionable item across the project into one sorted, role-filtered array. This is the data backbone of the entire homepage redesign.

## Types — Already Locked
Do **not** create or modify `src/types/stream.ts`. It exists and is read-only during Wave 1. Import from it:

```typescript
import type {
  StreamRole, StreamItem, StreamItemType, Urgency, CardType,
  StreamAction, ActionHandler, SourceReference, IrisEnhancement,
  ActionStreamResult, SnoozeDuration, ActorContext,
} from '@/types/stream'
import { toStreamRole } from '@/types/stream'
```

The locked types include `permissionKey?: Permission` on every `StreamAction`. Populate it where applicable so Tab B's `PermissionGate` wrapping works.

## The Hook: `src/hooks/useActionStream.ts`

### Signature (must match the pre-flight stub it replaces)
```typescript
export function useActionStream(role?: StreamRole): ActionStreamResult
```

`role` is the optional `StreamRole` (UI persona). When omitted, the hook reads the user's `ProjectRole` via `useAuth()` / `usePermissions()` and converts with `toStreamRole(projectRole)`.

### Iris decoration
After items are assembled and before they are returned, decorate them via the iris service:
```typescript
import { detectIrisEnhancements } from '@/services/iris'
const decorated = detectIrisEnhancements(filteredAndSorted)
```
This works whether Tab D has finished or not — the pre-flight stub is an identity function. When Tab D lands, decoration becomes real automatically. **Do not duplicate this logic inside Tab A.**

### Data Sources (consume these existing hooks — do NOT duplicate them)
1. `useRFIs()` from `src/hooks/queries/rfis.ts`
2. `usePunchItems()` from `src/hooks/queries/punch-items.ts`
3. `useSubmittals()` from `src/hooks/queries/submittals.ts`
4. `useTasks()` from `src/hooks/queries/tasks.ts`
5. `useIncidents()` from `src/hooks/queries/incidents.ts`
6. `useDailyLogs()` from `src/hooks/queries/daily-logs.ts`
7. `useScheduleActivities()` from `src/hooks/useScheduleActivities.ts`

### Transformation Logic
For each data source, transform items into StreamItem format:

**RFIs → StreamItem:**
- Filter: status NOT IN ('closed', 'answered', 'void')
- id: `rfi-${rfi.id}`
- type: 'rfi'
- cardType: overdue ? 'risk' : 'action'
- title: `RFI #${rfi.number} — ${rfi.subject}`
- reason: overdue ? `${daysDiff} days overdue` : `Due ${formatDate(rfi.response_due_date || rfi.due_date)}`
- urgency: overdue ? 'critical' : dueSoon(2days) ? 'high' : 'medium'
- waitingOnYou: status IN ('open', 'under_review', 'draft')
- overdue: pastDue(rfi.response_due_date || rfi.due_date) AND status NOT terminal
- actions: [{ label: 'Respond', type: 'primary', handler: 'respond' }, { label: 'Reassign', type: 'secondary', handler: 'reassign' }, { label: 'Snooze', type: 'dismiss', handler: 'snooze' }]

**Punch Items → StreamItem:**
- Filter: status NOT IN ('verified', 'closed', 'completed')
- id: `punch-${item.id}`
- type: 'punch'
- cardType: 'action'
- title: `Punch #${item.number} — ${item.title}`
- urgency: overdue ? 'high' : status === 'open' ? 'medium' : 'low'
- actions: [{ label: 'Mark Complete', type: 'primary', handler: 'complete' }, { label: 'Reassign', type: 'secondary', handler: 'reassign' }]

**Submittals → StreamItem:**
- Filter: status IN ('pending_review', 'in_review', 'submitted', 'draft')
- id: `sub-${item.id}`
- type: 'submittal'
- cardType: overdue ? 'risk' : 'action'
- title: `Submittal #${item.number} — ${item.title}`
- urgency: overdue ? 'high' : 'medium'
- actions: [{ label: 'Review', type: 'primary', handler: 'review' }, { label: 'Reassign', type: 'secondary', handler: 'reassign' }]

**Tasks → StreamItem:**
- Filter: status NOT IN ('completed', 'cancelled')
- id: `task-${item.id}`
- type: 'task'
- cardType: 'action'
- title: item.title
- urgency: overdue ? 'high' : dueToday ? 'high' : dueThisWeek ? 'medium' : 'low'
- actions: [{ label: 'Complete', type: 'primary', handler: 'complete' }, { label: 'Reassign', type: 'secondary', handler: 'reassign' }]

**Incidents → StreamItem:**
- Filter: active/open incidents
- id: `incident-${item.id}`
- type: 'incident'
- cardType: 'risk'
- title: `Safety Incident — ${item.type || 'Reported'}`
- urgency: 'critical' (always)
- actions: [{ label: 'Review', type: 'primary', handler: 'review' }, { label: 'Assign', type: 'secondary', handler: 'assign' }]

**Daily Logs → StreamItem:**
- Condition: no log submitted for yesterday (check after 6am), or today after 2pm with no log started
- id: `log-${dateString}`
- type: 'daily_log'
- cardType: 'action'
- title: `Daily Log — ${formatDate(date)}`
- reason: yesterday ? "Yesterday's log not submitted" : "Today's log not started"
- urgency: yesterday ? 'high' : 'medium'
- actions: [{ label: 'Start Log', type: 'primary', handler: 'create_log' }]

**Schedule Activities → StreamItem:**
- Filter: activities behind schedule (percent_complete < expected based on dates) or on critical path with conflicts
- id: `schedule-${item.id}`
- type: 'schedule'
- cardType: 'risk'
- title: `Schedule — ${item.name}`
- reason: `${delayDays} days behind` or 'Critical path at risk'
- urgency: is_critical_path && behind ? 'critical' : behind ? 'high' : 'medium'
- actions: [{ label: 'View Schedule', type: 'primary', handler: 'view_schedule' }, { label: 'Add to Report', type: 'secondary', handler: 'add_to_report' }]

### Role Filtering

Create `src/config/roleFilters.ts`:
```typescript
import type { StreamRole, StreamItem } from '@/types/stream'

export const ROLE_FILTERS: Record<StreamRole, (item: StreamItem, ctx: { companyId?: string }) => boolean> = {
  pm: () => true,
  superintendent: (item) => ['daily_log', 'punch', 'incident', 'schedule', 'task'].includes(item.type),
  owner: (item) => item.cardType === 'decision' || item.type === 'schedule' || item.costImpact != null,
  subcontractor: (item, ctx) => {
    // Items must be assigned to the sub's company.
    // Both authenticated subs (companyId from membership) and magic-link
    // subs (companyId from token) flow through here.
    if (!ctx.companyId) return false
    return (item.sourceData as { assigned_company_id?: string })?.assigned_company_id === ctx.companyId
  },
  architect: (item) => ['rfi', 'submittal'].includes(item.type),
  executive: (item) => item.urgency === 'critical' || item.cardType === 'risk',
}
```

For magic-link subs, the hook accepts an optional `ActorContext` and passes `companyId` into the filter. Tab C's `/sub/[token]` route hydrates this context.

### Sorting Logic (apply after role filter)
```typescript
function sortStream(items: StreamItem[]): StreamItem[] {
  return items.sort((a, b) => {
    // 1. Urgency tier
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    }
    // 2. Overdue above non-overdue
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
    // 3. Waiting on you above not-waiting
    if (a.waitingOnYou !== b.waitingOnYou) return a.waitingOnYou ? -1 : 1
    // 4. Soonest due date
    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    // 5. Created date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}
```

### Snooze & Dismiss State (replaces the pre-flight stub)

Replace the empty stub at `src/stores/streamStore.ts`. The signatures are already in the stub — match them. Wave 1 persistence rules:

- **Snooze:** `localStorage` key `stream:snoozed:{userId}` → JSON of `{ [id]: ISODateTime }`. Auto-prune entries past their resurface time on every read.
- **Dismiss:** in-memory Zustand only; cleared on reload.
- **Mark Resolved / Mark Complete:** these are **not** in the stream store. They mutate the source record via the existing mutation hooks (e.g., `usePunchItemMutations`). React Query invalidation removes the item from the next stream pull.

`snooze(id, duration: SnoozeDuration)` resolves the duration to an ISO datetime:
- `'1h'` → now + 1 hour
- `'tomorrow'` → tomorrow 8:00 AM local
- `'next_week'` → next Monday 8:00 AM local

## Tests
Write tests in `src/hooks/__tests__/useActionStream.test.ts`:
- Returns empty array for project with no actionable items
- Includes overdue RFIs with correct urgency
- Excludes closed/answered/void RFIs
- Sorts critical above high above medium
- Sorts overdue above non-overdue at same urgency
- PM role returns all items
- Superintendent role filters to field items only
- Owner role filters to decisions and budget items
- Dismiss removes item from returned array
- Snooze hides item until specified time

### Action `permissionKey` mapping (populate when transforming)
Tab B wraps action buttons with `<PermissionGate>`. Set these on each `StreamAction`:

| Item type / action | permissionKey |
|--------------------|---------------|
| RFI Respond | `rfis.respond` |
| RFI Reassign | `rfis.edit` |
| Submittal Review/Approve | `submittals.approve` |
| Submittal Reassign | `submittals.edit` |
| Punch Mark Complete | `punch_list.edit` |
| Punch Verify | `punch_list.verify` |
| Task Complete | `tasks.edit` |
| Daily Log Start/Submit | `daily_log.create` / `daily_log.submit` |
| Schedule View | `schedule.view` |
| Add to Report | `reports.view` |
| Snooze / Dismiss | (no permission — always allowed for the item owner) |

## Do NOT
- Modify `src/types/stream.ts` (locked contract)
- Create any UI components
- Modify existing query hooks
- Add new Supabase queries
- Over-engineer Iris integration — just call `detectIrisEnhancements(items)` from `@/services/iris`
- Modify any file outside the ownership list in `CONTRACT.md`
