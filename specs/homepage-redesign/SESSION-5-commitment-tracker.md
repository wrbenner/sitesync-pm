# Session 5 (Wave 2 Tab A): Commitment Tracker Page

## Read First (in order)
1. `specs/homepage-redesign/PRODUCT-DIRECTION.md` — Commitment Tracker section
2. `specs/homepage-redesign/CONTRACT-WAVE-2.md` — your ownership boundaries
3. `src/types/stream.ts` — `Commitment`, `CommitmentSource` types (locked, do not modify)
4. `src/types/database.ts` — search for `weekly_commitments` to see the existing table
5. `src/hooks/queries/rfis.ts`, `src/hooks/queries/submittals.ts` — patterns to follow

## Objective
The Wave 1 nav points to `/commitments` but no page exists. Build it. Show every open commitment grouped by party, sortable and filterable, with deep-link to the source record.

## Files You Own (write only these)
- `src/pages/commitments/index.tsx` (new)
- `src/pages/commitments/CommitmentsTable.tsx` (new)
- `src/hooks/queries/commitments.ts` (new)
- `src/hooks/__tests__/commitments.test.ts` (new)
- A route registration in `src/App.tsx` — **only** the `/commitments` route line; do not modify anything else in App.tsx

## Data Model (already in `src/types/stream.ts`, do not redefine)
```ts
interface Commitment {
  id: string
  party: string
  commitment: string
  source: CommitmentSource
  dueDate: string
  status: 'on_track' | 'at_risk' | 'overdue' | 'received'
  relatedItems: string[]
}
```

## `useCommitments()` derivation
Wave 2 derives commitments from existing project data — no new schema beyond the existing `weekly_commitments` table. Aggregate from:

| Source | Party | Commitment | Source ref |
|--------|-------|-----------|------------|
| Open RFI assigned to a company | the assigned company | `RFI #${n} response` | the RFI |
| Submittal in review | reviewer company | `Submittal #${n} review` | the submittal |
| `weekly_commitments` table rows that are still open | row.party | row.text | the meeting note |

Status math:
- `received` if the underlying record is closed/answered
- `overdue` if `dueDate < now`
- `at_risk` if due within 2 days
- `on_track` otherwise

## Page UI
- Group by `party`, alphabetically. Each group is a section with the party name as a heading.
- Within a group: a table with columns: Commitment, Due, Source (linked pill), Status badge.
- Filter chips at top: All / Overdue / At Risk / On Track / Received.
- Sort within a group: overdue first, then by due date ascending.
- Empty state: "No open commitments." in serif (same atom as the stream empty state).
- Use the existing design tokens (parchment surfaces, ink type, hairline separators). No card shadows.

## Tests
- Returns empty for project with no RFIs/submittals/weekly_commitments
- RFI in 'open' state with assigned company → produces a commitment
- RFI in 'closed' state → status is 'received'
- Past due date → status is 'overdue'

## Do NOT
- Modify `src/types/stream.ts`
- Add new Supabase queries beyond `weekly_commitments` (the existing query hooks already pull RFIs, submittals)
- Touch any file outside the ownership list above
- Redesign RFI / Submittal pages
- Add an extraction service (Iris commitment extraction is post-Wave-2)
