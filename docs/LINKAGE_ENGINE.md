# Linkage Engine

> "Six months later the sub claims they didn't install the defective flashing.
> Insurance asks for proof. The photo is there but the chain isn't."

The Linkage Engine eliminates the gap between a photo being captured and that
photo being legally useful. Every photo, on upload, is automatically linked to:

- The **drawing** the photo was taken on (with sheet-relative pin coords).
- The **crew** that was checked in on site at the photo's timestamp.
- **Today's daily log**.
- Any **open punch items** within 5 meters of the GPS pin.
- Any **open RFI** whose drawing reference matches the linked sheet.

Six months later the chain is already there — no super has to remember.

## Surfaces

```
photo upload  →  edge function (auto-link-media)
                  └─ runPhotoLinker (pure)
                       ├─ resolveDrawingLinks   GPS → sheet (x,y) when origin set
                       ├─ resolveSubLinks       checkin window + trade affinity
                       ├─ resolveDailyLogLinks  same-day project log
                       ├─ resolvePunchLinks     ≤5 m radius
                       └─ resolveRfiLinks       drawing_reference includes sheet#
                  └─ writeLinks (idempotent upsert into media_links)

entity detail page  →  <LinkageChain nodes={…} />
                       (Photo · Drawing M-401 · Lone Star Framers · Daily Log 4/29 · CO #014)

GPS unavailable  →  <PinDrop /> manual fallback (source='manual' on the row)
```

## Tables

`media_links` — one row per (media → entity) edge. Soft-delete only. The
`(media_id, media_type, entity_id, entity_type)` partial unique index on active
rows makes the linker naturally idempotent — re-running can never duplicate a
live edge, and an unlinked-then-relinked edge gets a fresh row with a new
audit trail.

`crew_checkins` — rolling check-in/out windows. The auto-linker uses these for
sub attribution. Disputed checkins (rejected by the crew lead) are excluded
from any legal-grade attribution but kept in the table for audit.

`drawing_scopes` — drawing × area × crew mapping for punch-item auto-assign.
Pre-populate from contracts where possible.

## What goes wrong + how it's bullet-proofed

| Failure mode | Fix |
| --- | --- |
| GPS unavailable (basement, signal jam) | `gps_status='unavailable'`. Inline UI: "Tap drawing to pin manually" — opens `<PinDrop>`. |
| GPS wrong (drift > 20 m) | `gps_status='low_confidence'`. Auto-link runs but every link is flagged `confidence='low'`. Visualizer renders with a quiet gray dot. |
| Multiple subs on site | `resolveSubLinks` returns top-N candidates ordered by trade-section affinity. UI shows top-1 with a chevron to pick another. |
| Sub mis-checked-in by GC's super | The sub's "approve check-in" rejection sets `disputed_at`. Linker ignores disputed checkins. |
| Drawing has no project-coordinate origin | `resolveDrawingLinks` skips the drawing pin step entirely. Banner on the drawing: "Set this sheet's origin to enable photo linkage". |
| Same point has 50 photos | Cluster on drawing pin tap; cap unfurled list at 20 with "show all". *(Visualizer-side; out of scope for this engine.)* |
| User wants to unlink a wrong link | Soft-delete the `media_links` row with a required reason. Never truly removed. The unique index on active rows means a future linker run won't re-create the deleted edge. |
| Photo was actually personal | "Mark as not-on-record" sets the photo to a hidden state. Linker honors this on the next run. |
| Linkage is wrong but no one noticed for a year | Every row carries `source` (auto vs manual) and `confidence`. Searchable: `select * from media_links where source='auto' and confidence='low' and created_at < '2026-04-01'`. |

## v1 scope vs later

**In v1 (this commit):**
- Pure-logic engine + tests
- Edge function (post-upload trigger)
- LinkageChain visualizer
- PinDrop manual fallback
- media_links + crew_checkins + drawing_scopes tables, photo gps fields, drawing origin fields

**Deferred to v2:**
- UI to *set* a drawing's origin (click-two-corners + type real-world coords)
- punch_items.geo_lat/geo_lng + the radius filter actually firing
- "Approve check-in" notification + dispute flow for crew leads
- Photo cluster expansion on drawing pin tap
- Cross-link to RFIs by spec-section match (currently only by sheet number)
- Inbound email→photo attachment routing

## Wiring the trigger

The edge function is invoked from the photo-upload mutation. The call is
fire-and-forget (best-effort linkage shouldn't block the upload's success
response):

```ts
// On successful photo_pins insert:
fetch('/functions/v1/auto-link-media', {
  method: 'POST',
  headers: { authorization: `Bearer ${session.access_token}` },
  body: JSON.stringify({ media_id: photo.id, media_type: 'photo_pin' }),
}).catch(() => { /* logged server-side; user-facing flow continues */ })
```

Re-trigger the function manually from a per-photo "Re-link" debug action —
since `writeLinks` is idempotent and respects soft-deletes, this is safe.

## Tests

Run `npx vitest run src/lib/linkage` — the resolution rules have unit coverage
for every behavior the field actually depends on (drawings without origin
skipped, disputed checkins ignored, spec-section trade affinity tie-breaking,
idempotency).

The shared/linkage/ folder is a copy because Deno edge functions can't reach
into `src/`. When the canonical lib changes, copy the file across and rerun
the test suite. There's a `DO NOT EDIT IN PLACE` banner on each duplicate.
