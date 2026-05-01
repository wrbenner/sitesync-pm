# Live Collaboration

Two PMs working the same RFI no longer eat each other's edits. Live presence everywhere; OT-merged textareas; a real conflict-resolution diff for offline-first.

## Pillars

| Pillar | What ships |
| --- | --- |
| **Live presence** | `<PresenceLayer roomKey={…}>` wraps any page; avatars in the topbar; multi-device dedup; 30s heartbeat with stale-cleanup. |
| **Live cursors** | `<LiveCursorOverlay>` renders other users' cursors over a shared surface. Per-user color hashed from `(user_id, room_key)`. |
| **Editing indicators** | `<EditingIndicator>` shows "Mike is editing" next to a focused field. |
| **OT textareas** | `<CollabTextarea>` wraps Liveblocks for the rich-text comment field on RFIs / submittals / COs / meeting notes. Degrades to a read-only banner if Liveblocks is down. |
| **Conflict diff** | `<ConflictDiffView>` is the per-field side-by-side resolver. Default pick is "theirs" (don't overwrite the server) but every field is overridable. |

## Architecture

```
                         ┌───────────────────────────────────────┐
                         │ src/lib/realtime/presenceChannel.ts   │
                         │   roomKeyFor / dedupByUser /          │
                         │   mergeHeartbeat / multi-device       │
                         └───────────────────────────────────────┘
                                            │ used by
                ┌───────────────────────────┼───────────────────────────┐
                ▼                           ▼                           ▼
   ┌────────────────────┐   ┌────────────────────────┐   ┌────────────────────────┐
   │ PresenceLayer      │   │ EditingIndicator       │   │ LiveCursorOverlay      │
   │ avatar bar         │   │ "Mike is editing"      │   │ remote cursor markers  │
   └────────────────────┘   └────────────────────────┘   └────────────────────────┘

                         ┌───────────────────────────────────────┐
                         │ src/lib/realtime/liveCursor.ts        │
                         │   normalize/denormalize / colorForUser│
                         │   throttle / isMeaningfulMove         │
                         └───────────────────────────────────────┘

                         ┌───────────────────────────────────────┐
                         │ <CollabTextarea/>                     │
                         │   dynamic-import @liveblocks/react;   │
                         │   EditingIndicator overlay;           │
                         │   read-only fallback when LB is down. │
                         └───────────────────────────────────────┘

                         ┌───────────────────────────────────────┐
                         │ <ConflictDiffView/>                   │
                         │   per-field mine/theirs/manual        │
                         │   audit-trail surface                 │
                         └───────────────────────────────────────┘

       supabase/migrations/20260503100000_presence_room_keys.sql
       supabase/migrations/20260503100001_collab_doc_state.sql
```

## Failure-mode coverage

| Failure | Handling |
| --- | --- |
| Two users edit different fields | OT merges per-field; presence + EditingIndicator make the activity visible |
| Network drops mid-edit | Liveblocks queues; reconnect resolves via OT; ConflictDiffView covers the rare server-vs-local divergence |
| Liveblocks service down | `<CollabTextarea>` flips to a `CloudOff` badge; the textarea stays editable; submit-on-reconnect |
| Stale presence | 30s heartbeat window; stale rows pruned every cycle |
| Multi-device same user | dedup-by-user (most recent device wins on cursor render); avatar shown once |
| Rate-limited rooms | The dispatcher gracefully degrades to broadcast-only via the same surface; no schema change required |
| Two PMs answer the same RFI | ConflictDiffView surfaces every divergent field; per-field "use mine / theirs / manual" |

## Wiring required (deferred to user)

1. Mount `<PresenceLayer>` in each entity detail page (RFIDetail, SubmittalDetail, etc.).
2. Replace plain comment `<textarea>` on RFIs with `<CollabTextarea>` once `collab_doc_state.liveblocks_room_id` is provisioned for the entity (lazy-create on first edit).
3. Wire `<ConflictDiffView>` to the existing `ConflictResolutionModal` flow: when an offline-queued mutation collides, render the diff view inside the modal; the legacy "save anyway" CTA becomes the manual-merge lane.
4. Configure Liveblocks API keys in env (`LIVEBLOCKS_PUBLIC_API_KEY` for client, `LIVEBLOCKS_SECRET_API_KEY` for the server-side auth endpoint).

## Test coverage

`npm run test:run -- src/lib/realtime` → **26 tests** covering room-key derivation, dedup-by-user, heartbeat merge, isMostRecentDeviceForUser, normalize/denormalize, throttle, isMeaningfulMove, color hash determinism.
