# Working offline

The field doesn't always have signal. SiteSync queues your work locally and syncs when you're back online.

## What works offline

- Read everything that loaded before you went offline
- Create RFIs, daily logs, punch items
- Take photos and tag them
- Mark tasks complete

## What doesn't work offline

- Iris AI drafts (require provider connectivity)
- Approving drafts that depend on un-synced changes by others
- Real-time presence (cursors, online indicators)

## Sync conflicts

If you and a teammate edit the same record offline, the sync engine flags a conflict and shows a side-by-side diff. You pick which version wins (or merge manually).

## Banner

A persistent banner at the top of the screen shows when you're offline and how many actions are queued. Don't close the app while items are queued — they'll sync next time you open.
