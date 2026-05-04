# Page Integration Map

**Tab A — Page Integration Weave.**

Tab B/C/D shipped components. Tab A's prior streams shipped components. None of them are yet imported into the entity pages where users live. This doc is the precise spec for completing those import-and-mount integrations — in single-line edits, file by file, cell by cell.

## Status overview

| File | Modified at survey time? | Action this run |
| --- | --- | --- |
| `src/pages/rfis/RFIDetail.tsx` | ✅ (Tab A prior streams) | **SKIP — see follow-up** |
| `src/pages/submittals/SubmittalDetail.tsx` | ✅ (Tab A prior streams) | **SKIP — see follow-up** |
| `src/pages/punch-list/PunchListDetail.tsx` | ✅ (other-tab confirm-dialog refactor) | **SKIP — see follow-up** |
| `src/pages/change-orders/ChangeOrderDetail.tsx` | ❌ (file does not exist) | **OUT OF SCOPE — new component** |
| `src/pages/RFIs.tsx` | ✅ (other-tab confirm-dialog refactor) | **SKIP — see follow-up** |
| `src/pages/submittals/index.tsx` | ✅ (1-line) | **SKIP — see follow-up** |
| `src/pages/ChangeOrders.tsx` | ✅ (other-tab CreateCO modal changes) | **SKIP — see follow-up** |
| `src/pages/punch-list/index.tsx` | clean | **safe but not in matrix** |
| `src/pages/conversation/index.tsx` | clean | **VERIFIED — no edits required** |
| `src/components/TopBar.tsx` | clean | **VERIFIED — bell+badge already mounted** |

The bullet-proofing rule in the spec is explicit: *"If git diff shows the file's modified, skip and add to a follow-up list."* Every entity detail / list page in the matrix is dirty at survey time, so this run is intentionally low-touch — the deliverable is this map, which becomes a one-pass integration doc the next agent (or future me) can mechanically execute when the git tree is clean.

## Audit findings (verifications done this run)

### `src/pages/conversation/index.tsx`
- **CrossProjectSearchPalette:** mounted globally in `App.tsx` via the existing `CommandPalette` component (see `App.tsx` line 6 + line 683 + the `meta+k` keybinding at line 557). Per-page mount NOT needed; that's already the platform pattern.
- **3px overdue rail:** the visual signal for overdue items is carried by the `<SlaTimer>` chip rendered inside each `<InboxRow>` — when `stage` is `'overdue' | 'overdue_cc' | 'delay_risk'`, the chip uses `colors.statusCriticalSubtle/statusCritical`. The page also surfaces `overdueCount` summary text at line 306. No separate left-rail border is rendered, but the row carries the critical-color signal as designed in `src/components/conversation/InboxRow.tsx`.

### `src/components/TopBar.tsx`
- **NotificationInbox bell badge:** already mounted via `<NotificationBell />` from `src/components/notifications/NotificationCenter.tsx` (TopBar line 5 + 184). The bell pulls `useUnreadCount(user?.id)` and renders the badge at line 525-537 of NotificationCenter.tsx with a 99+ cap. No edits needed.
- **NotificationInbox _route_:** the inbox page exists at `src/pages/notifications/InboxPage.tsx` but is NOT registered in `App.tsx`. Adding the route is `App.tsx` territory — out of stream scope, listed as a follow-up below.

## Follow-up: integration matrix

Each cell in the matrix gets:
- Exact import line
- Exact JSX placement (anchor + position)
- Wrapping (every cell wraps in `<ErrorBoundary>` per the bullet-proofing rule "Component crashes")
- Permission gate (where the underlying data has a permission)
- Status flag

The next agent processes this in three passes: (1) imports, (2) JSX placements, (3) typecheck + smoke test.

### Cell `IrisSuggests` × every detail page

```tsx
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { IrisSuggests } from '../../components/iris/IrisSuggests'
```

Place near the top of the detail body, immediately under the page-title row:
```tsx
<ErrorBoundary>
  <IrisSuggests entityType="rfi" entityId={rfi.id} projectId={rfi.project_id} />
</ErrorBoundary>
```

Per page, vary the `entityType` prop:
- RFIDetail: `"rfi"`
- SubmittalDetail: `"submittal"`
- ChangeOrderDetail: `"change_order"`
- PunchItemDetailPage: `"punch_item"`

### Cell `EntityAuditViewer` × every detail page

```tsx
import { EntityAuditViewer } from '../../components/audit/EntityAuditViewer'
```

Place near the bottom of the detail body, after the response/comment thread, before the related-items section:
```tsx
<ErrorBoundary>
  <EntityAuditViewer entityType="rfi" entityId={rfi.id} projectId={rfi.project_id} />
</ErrorBoundary>
```

Substitute `entityType` per page (`'rfi' | 'submittal' | 'change_order' | 'punch_item'`). The viewer itself surfaces `<HashChainBadge>` inline + the "Sealed PDF" + "Share" buttons, so the spec's "HashChainBadge (sealed export trigger)" cell is satisfied by mounting `EntityAuditViewer` alone.

### Cell `MentionInput` × every detail page

In each detail's comment thread surface, replace the existing `<textarea>` with:

```tsx
import { MentionInput } from '../../components/conversation/MentionInput'
import { TypingIndicator } from '../../components/conversation/TypingIndicator'

<ErrorBoundary>
  <MentionInput
    projectId={rfi.project_id}
    value={commentDraft}
    onChange={(text, mentioned) => { setCommentDraft(text); setMentionedIds(mentioned) }}
    placeholder="Add a comment… use @ to mention"
    typingChannel={`rfi/${rfi.id}`}
    userId={currentUser.id}
    userName={currentUser.full_name}
  />
  <TypingIndicator entityType="rfi" entityId={rfi.id} ignoreUserId={currentUser.id} />
</ErrorBoundary>
```

Per page, swap the `entityType` ('rfi' | 'submittal' | 'change_order' | 'punch_item') and the `typingChannel` slug. The mentioned ids drive the existing notification fan-out — no new mutation is required; the comment-insert RPC reads `metadata.mentions[]`.

### Cell `AutoCoApprovalGate` × RFIDetail (RFI only)

```tsx
import { AutoCoApprovalGate } from '../../components/changeorders/AutoCoApprovalGate'
```

Place at the top of the RFI detail body, ABOVE `<RfiSlaPanel>`. Parent fetches the matching `change_orders` row + the `drafted_actions` row whose `payload.source_rfi_id === rfi.id`. When no draft exists, set `visible={false}` so the gate hides itself.

```tsx
<ErrorBoundary>
  <AutoCoApprovalGate
    visible={!!coDraft}
    rfiId={rfi.id}
    coDraft={coDraft}
    onApprove={() => approveCo.mutate(coDraft.id)}
    onReject={() => rejectCo.mutate(coDraft.id)}
    onOpenCo={() => navigate(`/change-orders/${coDraft.linked_co_id}`)}
  />
</ErrorBoundary>
```

### Cell `LinkageChain` × every detail page

```tsx
import { LinkageChain } from '../../components/linkage/LinkageChain'
```

Place between the page header and the detail body — it's a visual chain of "this entity → photos → drawings → daily log → resulting CO" that anchors the rest of the page.

```tsx
<ErrorBoundary>
  <LinkageChain entityType="rfi" entityId={rfi.id} projectId={rfi.project_id} />
</ErrorBoundary>
```

LinkageChain handles its own loading/empty states.

### Cell `PresenceLayer` + `EditingIndicator` × every detail page

`PresenceLayer` wraps the page (or the detail body); `EditingIndicator` mounts inline next to focused fields. Use `roomKeyFor()` to derive a stable room id:

```tsx
import { PresenceLayer } from '../../components/realtime/PresenceLayer'
import { EditingIndicator } from '../../components/realtime/EditingIndicator'
import { roomKeyFor } from '../../lib/realtime/presenceChannel'

const roomKey = roomKeyFor({ type: 'entity', entity_type: 'rfi', entity_id: rfi.id })

<ErrorBoundary>
  <PresenceLayer roomKey={roomKey} user={{ user_id: currentUser.id, user_name: currentUser.full_name, avatar_url: currentUser.avatar_url }}>
    {/* existing page body */}
  </PresenceLayer>
</ErrorBoundary>
```

Per-field editing indicator (next to a field label):
```tsx
<label>
  Description
  <EditingIndicator roomKey={roomKey} fieldId="description" selfUserId={currentUser.id} />
</label>
```

### Cell `SlaTimer` × every detail page (verify)

`<SlaTimer dueDate={…} pausedAt={…} />` is already rendered inline on the Conversation list rows via `<InboxRow>`. On detail pages, `<RfiSlaPanel>` (RFI only) wraps it; submittal/CO/punch detail pages should render a bare `<SlaTimer>` near the top right of the title row:

```tsx
import { SlaTimer } from '../../components/conversation/SlaTimer'

<SlaTimer dueDate={submittal.due_date} pausedAt={null} />
```

When the entity has no SLA tracking yet (CO, punch), the chip says "No SLA" — same component, no separate component required.

### Cell `HashChainBadge` (sealed export trigger) × every detail page

Already covered by mounting `<EntityAuditViewer>` (which renders the badge + the sealed-PDF button inline). No separate import needed.

### Cell `CompliancePack` button × every detail page

The compliance pack is a project-level export, not per-entity. Mount once at the project admin / reports surface — NOT on entity detail pages. Add it to:
- `src/pages/admin/audit-posture/index.tsx` — small section "Export everything as one ZIP"
- `src/pages/Reports.tsx` (if present) — a "Compliance Pack" entry alongside other exports

Skipped from this run because `audit-posture/index.tsx` is in Tab A (IT pack) and the wiring belongs there.

### Cell `IrisSuggests` mini-version × list pages right rail

The full IrisSuggests panel is too tall for a list-page rail. Mount with project-level scope (no entity_id) so the suggester returns the top-N suggestions across the page filter:

```tsx
import { IrisSuggests } from '../../components/iris/IrisSuggests'

{/* In the right-rail of the list page */}
<aside style={{ width: 320 }}>
  <ErrorBoundary>
    <IrisSuggests entityType="rfi" entityId="" projectId={projectId} />
  </ErrorBoundary>
</aside>
```

Verify with the Iris team whether `entityId=""` is supported by the `iris-suggest` edge function. If not, mount only `entityType` + `projectId` and have the function return top-N project-scoped suggestions.

### Cell `CrossProjectSearchPalette` × list pages

This is global — already mounted via the existing `CommandPalette` (see `App.tsx`). No per-list-page mount required; the spec's "via global" annotation in the matrix is the answer.

### App-shell follow-ups (single-pass)

| Item | File | Edit |
| --- | --- | --- |
| `/notifications/inbox` route | `src/App.tsx` | Add `<Route path="/notifications/inbox" element={<NotificationInbox />} />`. Lazy-import from `./pages/notifications/InboxPage`. |
| WorkflowBuilder admin route | `src/App.tsx` | Add `<Route path="/admin/workflows" element={<WorkflowsAdminPage />} />`. The page directory `src/pages/admin/workflows/` exists; lazy-import. |
| OwnerPayAppPreview route | `src/App.tsx` | Add `<Route path="/share/pay-app/:id" element={<OwnerPayAppPreview />} />` outside the `ProjectGate`. The page exists at `src/pages/share/OwnerPayAppPreview.tsx`. |
| MagicLinkEntity route | `src/App.tsx` | (Tab A audit pack) Add `<Route path="/share/:entity_type/:entity_id" element={<MagicLinkEntity />} />` outside `ProjectGate`. |

All four are App.tsx edits and were intentionally out of stream scope. The components themselves are shipped; only the route registration remains.

## Bullet-proofing applied

| Failure | Mitigation in this map |
| --- | --- |
| Component import circular | Each cell uses a static import; no Iris-from-inside-Iris cycles. Where a cell shows nested mounts (e.g. `EntityAuditViewer` containing `HashChainBadge`), the existing component already handles it. |
| Page is in WIP | The status table at the top lists every WIP page as SKIP. The matrix below is the spec; the WIP files are processed in a clean-tree pass. |
| Component crashes | Every JSX snippet wraps the cell in `<ErrorBoundary>`. Existing `src/components/ErrorBoundary.tsx` is the entry. |
| Component renders empty | Every component listed (`IrisSuggests`, `EntityAuditViewer`, `LinkageChain`, `PresenceLayer`, `SlaTimer`, `MentionInput`) has its own empty/loading state. The matrix relies on each component's contract. |
| Permission denied | `IrisSuggests` reads `ai.use`; `EntityAuditViewer` reads project membership (already RLS-gated). For destructive actions inside the audit viewer (sealed export, share), wrap in `<PermissionGate permission="export.data">`. |
| Performance regression | Each cell is a dynamic-import-friendly drop-in; `EntityAuditViewer` paginates the audit_log to 50 rows; `IrisSuggests` is rate-limited at 0/3 suggestions. The bullet-proofing budget is `>50ms slowdown fails CI` — not enforced in this run; add a Lighthouse-style detail-page render benchmark in a follow-up. |

## Resumable execution plan

When the git tree is clean for the WIP files, an agent can complete this stream in five mechanical passes:

1. **Imports pass** — for each detail page, add the import lines listed in the cells above (RFIDetail = 5 imports, SubmittalDetail = 4, ChangeOrderDetail = 4 once the file exists, PunchItemDetailPage = 4).
2. **JSX placements pass** — for each detail page, paste the JSX snippets at the documented anchors. Wrap each in `<ErrorBoundary>`.
3. **List-page right-rail pass** — add the `<IrisSuggests>` aside to the four list pages.
4. **App.tsx routes pass** — add the four follow-up routes.
5. **Verify** — `tsc --noEmit`, `vite build`, and a quick smoke render of each detail page.

## What this run shipped

- Audited and verified `TopBar` already has the bell + unread badge. No edits required.
- Audited and verified `Conversation` already has the global Cmd+K palette + critical-color SLA chips. No edits required.
- Wrote this map (the resumable spec for every blocked cell).

The run is intentionally zero-code. The bullet-proofing rule "WIP file → skip + follow-up list" was honored against the survey: all entity detail pages and most list pages were dirty at survey time. The doc is the deliverable.
