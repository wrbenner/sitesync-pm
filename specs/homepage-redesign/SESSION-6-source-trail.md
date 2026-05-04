# Session 6 (Wave 2 Tab B): Universal Source Trail

## Read First (in order)
1. `specs/homepage-redesign/PRODUCT-DIRECTION.md` — Source Trail System section
2. `specs/homepage-redesign/CONTRACT-WAVE-2.md` — your ownership boundaries
3. `src/types/stream.ts` — `SourceReference` type (locked)
4. `src/components/stream/StreamItemExpanded.tsx` — see how Wave 1 renders source trails inline; extract the pattern into a reusable component without changing this file

## Objective
Wave 1 surfaces source trails inside the Command stream. Wave 2 makes them visible everywhere a record is shown — RFI detail, Submittal detail, Punch detail. Trust travels with the record.

## Files You Own (write only these)
- `src/components/source/SourceTrail.tsx` (new — reusable pill-row component)
- `src/components/source/SourceTrailPill.tsx` (new — single pill, reused by SourceTrail)
- `src/components/source/__tests__/SourceTrail.test.tsx` (new)
- Additive insertions into:
  - `src/pages/rfis/RFIDetail.tsx` (or wherever the RFI detail panel lives — add a `<SourceTrail items={...}>` block; do not refactor surrounding code)
  - `src/pages/submittals/SubmittalDetail.tsx` (same)
  - `src/pages/punch-list/PunchItemDetail.tsx` (same)

## Component Spec
```tsx
<SourceTrail items={SourceReference[]} />
```
- Horizontal scrollable row of pills
- Each pill: Inter 11px weight 500, ink3 color, padding 4px 8px, surfaceInset background, border-radius 4px
- Tappable → navigate to `item.url`
- Separator: `→` arrow (ink4) between pills
- Empty array → render nothing (component returns null)
- On mobile: horizontal scroll, no scrollbar

## Record-Page Integration
For each record-detail page, build the `SourceReference[]` from existing record fields:

**RFI detail:**
- Drawing reference (if present)
- Spec section (if present)
- The RFI itself
- Photos linked to the RFI (if any)

**Submittal detail:**
- Spec section
- Drawing references (if any)
- The submittal itself

**Punch detail:**
- Drawing reference (if present)
- Photo(s) (if any)
- The punch item itself

Insert the `<SourceTrail>` near the top of each detail panel, beneath the title block. Do not refactor the existing layout.

## Tests
- Renders nothing for empty array
- Renders correct count of pills
- Each pill has correct href
- Renders separator arrows between pills (count = N-1)

## Do NOT
- Modify `src/types/stream.ts`
- Modify `src/components/stream/*` (Tab D may touch StreamItemExpanded; you do not)
- Refactor the surrounding code in record-detail pages — additive insertion only
- Build a separate "expanded source trail" view (just the pill row)
- Add new icons or design tokens
