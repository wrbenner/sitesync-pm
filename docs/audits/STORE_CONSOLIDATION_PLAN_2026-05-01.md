# Zustand Store Consolidation Plan — 2026-05-01

**Author:** Walker Benner  
**Goal:** 33 stores → 5 stores  
**Status:** Design complete. Implementation starts Day 7.

---

## Current Inventory (33 stores)

### Group A — Dead Stores: Zero External Consumers (15 stores, ~3,400 LOC)

These stores have no importers outside `src/stores/` itself.  
The pages that would have used them now query Supabase directly via React Query hooks.  
**Action: Delete immediately** (Day 6 — run `scripts/delete-orphan-pages.sh` equivalent for stores).

| Store | LOC | State it held | Why unused |
|---|---|---|---|
| `activityStore` | 70 | Activity feed items | Page removed |
| `changeOrderStore` | 89 | Change order list | Migrated to `entityStore` + RQ |
| `dailyLogStore` | 154 | Daily log entries | Migrated to React Query directly |
| `directoryStore` | 107 | Team directory | Migrated to `entityStore` |
| `documentStore` | 164 | Document metadata | Migrated to React Query |
| `drawingStore` | 271 | Drawing sheets/revisions | Migrated to React Query |
| `fieldCaptureStore` | 78 | Field capture sessions | Migrated to React Query |
| `fileStore` | 242 | File/folder tree | Migrated to React Query |
| `lienWaiverStore` | 94 | Lien waiver records | Migrated to React Query |
| `projectStore` | 163 | Project list (old) | Replaced by `projectContextStore` |
| `punchItemStore` | 170 | Individual punch items | Migrated to `entityStore` |
| `rfiStore` | 160 | RFI list | Migrated to `entityStore` |
| `sovStore` | 87 | Schedule of values | Migrated to React Query |
| `teamStore` | 126 | Team membership | Migrated to `projectContextStore` |
| `userStore` | 140 | User profile | Migrated to `authStore` |

---

### Group B — Live Stores Being Consolidated (10 stores)

These have active consumers but are candidates for merging into the 5-store target.

| Store | Consumers | Target | Day |
|---|---|---|---|
| `authStore` | 19 files | Keep as `authStore` — absorb `organizationStore` | 7 |
| `organizationStore` | 6 files | Merge → `authStore.organization` | 7 |
| `projectContextStore` | 22 files | Rename → `projectStore` (absorb old dead `projectStore`) | 7 |
| `uiStore` | ~15 files | Keep as `uiStore` — absorb `notificationStore` | 8 |
| `notificationStore` | 2 files | Merge → `uiStore.notifications` | 8 |
| `entityStore` | 15 files | Keep as `entityStore` — receive migrated domain stores | 7–9 |
| `punchListStore` | 2 files | Migrate → `entityStore('punch-list')` | 8 |
| `submittalStore` | 1 file | Migrate → `entityStore('submittals')` | 8 |
| `crewStore` | 1 file | Migrate → `entityStore('crews')` | 8 |
| `equipmentStore` | 1 file | Migrate → `entityStore('equipment')` | 8 |

---

### Group C — Live Stores Staying As-Is (8 stores)

These are too specialized or architecturally distinct to merge.

| Store | Consumers | Why keep separate |
|---|---|---|
| `copilotStore` | 19 files | Will be absorbed into `aiStore` (Day 9) |
| `agentOrchestrator` | 3 files | Will be absorbed into `aiStore` (Day 9) |
| `irisDraftStore` | 2 files | Will be absorbed into `aiStore` (Day 9) |
| `streamStore` | 2 files | Will be absorbed into `aiStore` (Day 9) |
| `aiAnnotationStore` | ~10 files | Will be absorbed into `aiStore` (Day 9) |
| `presenceStore` | 7 files | Real-time only; keep standalone (pure derived state) |
| `scheduleStore` | 13 files | Actually a React Query wrapper, not a true Zustand store |
| `digitalTwinStore` | 1 file | Behind `VITE_FLAG_BIM_VIEWER`; keep isolated |

---

## Target Architecture: 5 Stores

```
src/stores/
  authStore.ts          ← identity: session, user, profile, organization (absorbs organizationStore)
  projectStore.ts       ← project context: activeProject, projects[], members[] (renames projectContextStore)
  uiStore.ts            ← app state: sidebar, theme, palette, toasts, notifications, a11y
  entityStore.ts        ← domain data: generic CRUD keyed by entity type (rfis, submittals, etc.)
  aiStore.ts            ← AI state: copilot conversations, agent orchestration, iris drafts, stream snooze

  ── Standalone (not merged, not dead) ──
  presenceStore.ts      ← real-time online users (too specific to Liveblocks channel lifecycle)
  scheduleStore.ts      ← React Query wrapper, not true Zustand (rename to useSchedule hook in Day 10)
  digitalTwinStore.ts   ← BIM state; gated by VITE_FLAG_BIM_VIEWER
  index.ts              ← barrel: re-export the 5 primary hooks only
```

### State shape of each target store

#### `authStore` (keeps existing API + absorbs org state)

```ts
interface AuthState {
  // existing
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  initialized: boolean
  error: Error | null

  // absorbed from organizationStore
  organization: Organization | null       // was authStore.organization (already here)
  organizations: Organization[]           // was organizationStore.organizations
  currentOrgRole: OrgRole | null          // was organizationStore.currentOrgRole

  // actions: all existing authStore actions + org setters
}
```

#### `projectStore` (rename of projectContextStore)

```ts
interface ProjectState {
  projects: Project[]
  activeProjectId: string | null
  activeProject: Project | null
  members: ProjectMemberWithProfile[]
  loading: boolean
  error: string | null

  // actions unchanged — just re-export useProjectContext as useProjectStore
}
```

#### `uiStore` (keeps existing + absorbs notifications)

```ts
interface UiState {
  // existing
  sidebarCollapsed: boolean
  themeMode: 'light' | 'dark' | 'system'
  commandPaletteOpen: boolean
  searchQuery: string
  a11yStatusMessage: string
  a11yAlertMessage: string
  toasts: Toast[]

  // absorbed from notificationStore
  notifications: Notification[]
  unreadCount: number
  markRead: (id: string) => void
  markAllRead: () => void
}
```

#### `entityStore` (already exists, receives migrations)

```ts
// Already in place. Consumer API:
const rfis = useEntityStore('rfis')
const { items, loading, error } = rfis
const { loadItems, createItem, updateItem, deleteItem } = useEntityActions('rfis')

// Migration: punchListStore → entityStore('punch-list')
//            submittalStore → entityStore('submittals')
//            crewStore      → entityStore('crews')
//            equipmentStore → entityStore('equipment')
```

#### `aiStore` (new — merges copilot + agents + iris + stream + annotations)

```ts
interface AiState {
  // from copilotStore
  conversations: Conversation[]
  activeConversationId: string | null
  isTyping: boolean
  isOpen: boolean
  currentPageContext: string

  // from agentOrchestrator
  messages: AgentConversationMessage[]
  isProcessing: boolean
  activeAgents: AgentDomain[]
  pendingBatch: BatchAction | null

  // from irisDraftStore
  drafts: Map<string, IrisDraft>
  draftLoading: Set<string>

  // from streamStore
  dismissedStreamIds: Set<string>
  snoozedStreamItems: Map<string, string>

  // from aiAnnotationStore
  annotations: Annotation[]
  selectedAnnotation: Annotation | null
}
```

---

## Migration Sequence (Days 7–10)

| Day | Task | Risk |
|---|---|---|
| 6 | Delete 15 dead stores | Low — 0 consumers |
| 7 | `organizationStore` → `authStore` | Low — 6 consumers, simple state setters |
| 7 | `projectContextStore` → rename `projectStore`, add barrel alias | Low — 22 consumers, hook rename only |
| 8 | `notificationStore` → `uiStore.notifications` | Low — 2 consumers |
| 8 | `punchListStore` + `submittalStore` + `crewStore` + `equipmentStore` → `entityStore` | Med — 5 consumers total |
| 9 | Merge `copilotStore` + `agentOrchestrator` + `irisDraftStore` + `streamStore` + `aiAnnotationStore` → `aiStore` | High — 19 + 3 + 2 + 2 + 10 consumers |
| 10 | Update barrel `index.ts` → 5 primary hooks only | Low |
| 10 | `scheduleStore` → convert to `useSchedule` custom hook (no Zustand) | Med |

---

## Acceptance Criteria

- [ ] `src/stores/` contains exactly 5 primary stores + 3 standalone files + `index.ts`
- [ ] `index.ts` exports exactly 5 hooks: `useAuthStore`, `useProjectStore`, `useUiStore`, `useEntityStore`, `useAiStore`
- [ ] `tsc --noEmit` passes
- [ ] No dead store files remain
- [ ] Bundle size ≤ current (consolidation should reduce it via tree-shaking of dead exports)
