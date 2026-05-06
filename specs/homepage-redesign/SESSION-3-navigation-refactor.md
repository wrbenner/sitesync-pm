# Session 3 (Tab C): Navigation Refactor

## Read First (in order)
1. `specs/homepage-redesign/PRODUCT-DIRECTION.md` — full vision, especially Navigation section and Role table
2. `specs/homepage-redesign/CONTRACT.md` — your ownership boundaries (do not violate)
3. `src/types/stream.ts` — locked contract; import `StreamRole` and `toStreamRole` from here
4. `src/components/Sidebar.tsx` — current sidebar implementation (you will rewrite this)
5. `src/App.tsx` — current routing (you will only ADD redirects, not modify existing routes)
6. `src/components/CommandPalette.tsx` — existing command palette (enhance if present, create if not)
7. `src/hooks/usePermissions.ts` — `Permission` and `ProjectRole` types

## New: Magic-Link Sub Route
Add a route `/sub/:token` that hydrates an `ActorContext` (kind: `'magic_link'`, plus `magic_link_token_id` and `companyId` from token validation) and renders the same `<DayPage>` component (Tab B owns the component; you only register the route). Token validation should reuse any existing magic-link validator in the codebase. If none exists, scaffold a minimal validator that calls `/api/magic-link/validate` (Edge Function) — leave the Edge Function for Wave 2 if not present and route to a "link expired" placeholder.

## Objective
Refactor navigation to support role-based filtering, simplify the sidebar, rename pages from poetic ("The Ledger") to functional ("Budget"), and enhance the command palette.

## Navigation Items (New)

Replace the current Nine + categories with this flat list:

| Nav Item | Icon (Lucide) | Route | Visible to Roles |
|----------|--------------|-------|-----------------|
| Command | Zap | /day | all |
| RFIs | MessageCircle | /rfis | pm, sub, architect |
| Submittals | FileCheck | /submittals | pm, sub, architect |
| Schedule | Calendar | /schedule | pm, super, owner, sub |
| Budget | DollarSign | /budget | pm, owner |
| Drawings | Layers | /drawings | pm, super, architect |
| Daily Log | BookOpen | /daily-log | pm, super |
| Punch | CheckCircle | /punch-list | pm, super, sub |
| Photos | Camera | /photos | super, owner, sub |
| Inspections | ClipboardCheck | /inspections | super |
| Reports | FileText | /reports | pm, owner, executive |
| Documents | FolderOpen | /files | pm, sub |
| Commitments | Handshake | /commitments | pm, owner, architect, subcontractor |
| Portfolio | BarChart3 | /portfolio | executive |

### Config
```typescript
// src/config/navigation.ts
import type { StreamRole } from '@/types/stream'

interface NavItem {
  id: string
  label: string
  icon: string          // Lucide icon component name
  route: string
  roles: StreamRole[]   // which stream personas see this item
  description?: string  // shown in command palette
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'command', label: 'Command', icon: 'Zap', route: '/day', roles: ['pm', 'superintendent', 'owner', 'subcontractor', 'architect', 'executive'], description: 'Your daily priorities and actions' },
  { id: 'rfis', label: 'RFIs', icon: 'MessageCircle', route: '/rfis', roles: ['pm', 'subcontractor', 'architect'], description: 'Requests for information' },
  { id: 'submittals', label: 'Submittals', icon: 'FileCheck', route: '/submittals', roles: ['pm', 'subcontractor', 'architect'], description: 'Submittal tracking and approvals' },
  { id: 'schedule', label: 'Schedule', icon: 'Calendar', route: '/schedule', roles: ['pm', 'superintendent', 'owner', 'subcontractor'], description: 'Project schedule and critical path' },
  { id: 'budget', label: 'Budget', icon: 'DollarSign', route: '/budget', roles: ['pm', 'owner'], description: 'Budget, cost exposure, and change orders' },
  { id: 'drawings', label: 'Drawings', icon: 'Layers', route: '/drawings', roles: ['pm', 'superintendent', 'architect'], description: 'Drawing sets and markup' },
  { id: 'daily-log', label: 'Daily Log', icon: 'BookOpen', route: '/daily-log', roles: ['pm', 'superintendent'], description: 'Daily field reports' },
  { id: 'punch', label: 'Punch', icon: 'CheckCircle', route: '/punch-list', roles: ['pm', 'superintendent', 'subcontractor'], description: 'Punch list items' },
  { id: 'photos', label: 'Photos', icon: 'Camera', route: '/photos', roles: ['superintendent', 'owner', 'subcontractor'], description: 'Field photos and documentation' },
  { id: 'inspections', label: 'Inspections', icon: 'ClipboardCheck', route: '/inspections', roles: ['superintendent'], description: 'Inspection checklists and status' },
  { id: 'reports', label: 'Reports', icon: 'FileText', route: '/reports', roles: ['pm', 'owner', 'executive'], description: 'Generate and view reports' },
  { id: 'documents', label: 'Documents', icon: 'FolderOpen', route: '/files', roles: ['pm', 'subcontractor'], description: 'Project documents and files' },
  { id: 'commitments', label: 'Commitments', icon: 'Handshake', route: '/commitments', roles: ['pm', 'owner', 'architect', 'subcontractor'], description: 'Track who owes what' },
  // Portfolio is post-Wave-1 (multi-project) — keep config but role is empty until then
  { id: 'portfolio', label: 'Portfolio', icon: 'BarChart3', route: '/portfolio', roles: [], description: 'Multi-project overview (post-Wave-1)' },
]

export function getNavForRole(role: StreamRole): NavItem[] {
  return NAV_ITEMS.filter(item => item.roles.includes(role))
}
```

The component reading the user's role calls `toStreamRole(projectRole)` from `@/types/stream` to map the canonical `ProjectRole` (from `usePermissions`) into a `StreamRole` for nav filtering.

## Sidebar Changes (`src/components/Sidebar.tsx`)

### Rewrite the sidebar to:
1. Use the new NAV_ITEMS config
2. Filter by user's role using `getNavForRole(role)`
3. Show functional names (Budget, not The Ledger)
4. Support collapsed mode (72px, icons only) and expanded mode (252px, icons + labels)

### Collapsed Mode
- Icon column: 24px icons, 48px touch targets, centered
- Active page: icon color = primary (#F47820)
- Inactive: icon color = ink4 (#C4BDB4)
- Hover: icon color = ink2 (#5C5550)
- OrangeDot on icons where stream has items of that type (same logic as StreamNav)
- Tooltip on hover showing label

### Expanded Mode
- Icon + label per item
- Label: Inter 14px, weight 400, ink2
- Active: Inter 14px, weight 500, ink, background surfaceSelected (#FEF7F2), primary left border (3px)
- Hover: background surfaceHover (#EFE9DD)
- OrangeDot next to label for items with stream activity

### Default State
- On /day (Command page): collapsed by default
- On all other pages: user's last preference (stored in localStorage)
- Toggle: hamburger icon or `[` keyboard shortcut

### Top of Sidebar
- Project avatar/logo
- Project name (collapsed: hidden, expanded: shown)
- Project selector dropdown (if multi-project)

### Bottom of Sidebar
- User avatar
- Settings icon
- Role indicator (small, subtle: "PM" or "Super" etc.)

## Routing Changes (`src/App.tsx`)

### Redirects
- `/` → `/day` (keep existing)
- `/conversation` → `/day` (The Conversation merges into Command stream)
- `/site` → `/day` (The Site overview becomes the Command stream)

### Preserve All Existing Routes
Do not remove any existing page routes. Only add the redirects above. All deep pages (/rfis, /submittals, /schedule, etc.) remain as-is.

### Back Navigation
When navigating from Command stream item → detail page, store scroll position in React Router state. Back button restores scroll position in the stream.

## Command Palette

### If CommandPalette component exists, enhance it:
1. Empty state (no query): show role-filtered nav items as top results
2. Search: fuzzy match across nav items, recent items (RFIs by number, submittals by title)
3. Keyboard: Cmd+K (Mac) / Ctrl+K (Windows) to open
4. On Command page: show a subtle "Search or jump to..." text at the top of the stream that opens the palette on focus

### If CommandPalette doesn't exist, create a basic one:
- `src/components/CommandPalette.tsx`
- Overlay modal with search input
- Results: nav items + recent items
- Keyboard navigation within results
- Enter to navigate to selected result
- Escape to close

## Mobile Navigation

### Bottom Tab Bar
Show role-filtered subset (max 5 items) + "More" tab:

**PM tabs:** Command, RFIs, Schedule, Budget, More
**Super tabs:** Command, Daily Log, Punch, Photos, More
**Owner tabs:** Command, Budget, Schedule, Reports, More
**Sub tabs:** Command, My Items, Photos, Documents, More

"More" opens a sheet with remaining nav items for that role.

### Config
```typescript
// src/config/navigation.ts (add to existing)
export const MOBILE_TABS: Record<StreamRole, string[]> = {
  pm: ['command', 'rfis', 'schedule', 'budget'],
  superintendent: ['command', 'daily-log', 'punch', 'photos'],
  owner: ['command', 'budget', 'schedule', 'reports'],
  subcontractor: ['command', 'punch', 'photos', 'documents'],
  architect: ['command', 'rfis', 'submittals', 'drawings'],
  executive: ['command', 'reports'],
}
```

### Tab Bar Specs
- Height: 56px + safe area inset (iOS)
- Background: surfaceRaised (#FFFFFF) with hairline top border
- Icons: 24px, ink4 inactive, primary active
- Labels: 10px, Inter, weight 500
- Badge dots: OrangeDot on tabs with stream items

## Command Palette — Wave 1 scope

**In scope:**
- Empty state shows role-filtered nav items as top results
- Search: fuzzy match across nav items + recent items (last 20 RFIs by number, submittals by spec, punch by title)
- Cmd+K / Ctrl+K to open
- Keyboard nav within results, Enter to navigate, Escape to close

**Out of scope (post-Wave-1):**
- "Ask this project anything..." natural-language Iris queries
- Cross-page deep search (e.g., search inside RFI bodies)

## Do NOT
- Modify `src/types/stream.ts` (locked contract)
- Modify `src/hooks/useActionStream.ts` or `src/stores/streamStore.ts` (Tab A)
- Modify `src/pages/day/index.tsx` or anything in `src/components/stream/` (Tab B)
- Modify `src/services/iris/*` (Tab D)
- Redesign any source/record pages (RFI page, Budget page, etc.)
- Remove any existing routes (only add redirects + the new `/sub/:token` route)
- Change sidebar behavior on non-Command pages beyond role filtering
- Build a complex animation system for sidebar
- Add sidebar sections/categories/collapsible groups — it's a flat list now
