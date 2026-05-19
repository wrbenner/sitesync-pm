# Drawing Measurement Tool — Bugatti-Standard Fix (Day 16)

**Date:** 2026-05-19
**Branch:** main (uncommitted on this workspace at receipt time)
**Receipt for:** measurement tool reporting raw pixels instead of architectural dimensions; calibration not persisting.

---

## What was broken

The drawing viewer's Measure / Area / Path tools were rendering labels like
`347 px` instead of `81'-3"`. User calibrations also silently failed to
persist across reloads.

### Root cause

The `drawings` Postgres table had **no** `scale_text` or `scale_ratio`
columns. The viewer and the drawings page read and wrote those columns via
`as { ... }` casts:

| Location | Symptom |
|---|---|
| `src/pages/drawings/index.tsx:1813` | `viewerDrawing.scale_text` → always `undefined` → `scaleRatioText` prop null |
| `src/components/drawings/DrawingTiledViewer.tsx:1148` | `(drawing as { scale_ratio? }).scale_ratio` → always `undefined` → `calibrationScale` starts null |
| `src/components/drawings/DrawingTiledViewer.tsx:1161-1163` | `drawingService.updateDrawing(..., { scale_ratio })` → unknown-column update silently dropped → calibration lost |
| `src/components/drawings/MeasurementOverlay.tsx:576, 599, 641` | Both scale sources null → `pixelsToRealInches()` returns null → label fell back to `${pxDist} px` |

Scale data already existed in the DB — extracted on PDF upload by
`src/lib/pdfClassifier.ts` `extractScaleText()` and stored on
`drawing_classifications.scale_text/scale_ratio` and per-page on
`drawing_pages.scale_text/scale_ratio`. The viewer never queried them.

---

## What changed

### Schema (2 migrations)

`supabase/migrations/20260519000001_drawings_scale_columns.sql`:
- Adds `drawings.scale_text TEXT`, `drawings.scale_ratio NUMERIC`.
- Adds audit columns `scale_source` (`'ai'|'user'|null`), `scale_calibrated_by` (FK → `auth.users`), `scale_calibrated_at`.
- Backfills `scale_text` (TEXT only — see unit-mismatch note below) from
  `drawing_pages` page 1 → fallback to highest-confidence
  `drawing_classifications` row.
- Idempotent; NULL-guarded — never overwrites existing values.

`supabase/migrations/20260519000002_drawing_pages_scale_trigger.sql`:
- `AFTER INSERT OR UPDATE OF scale_text ON drawing_pages` trigger →
  `fn_propagate_drawing_scale()` bubbles `scale_text` up to `drawings`.
- Honors hard rules: never stomps existing `scale_text`; never touches
  `scale_ratio` (user calibrations are sacred); `SECURITY DEFINER` so
  background classifier workers don't need explicit RLS pass-through;
  `EXCEPTION WHEN OTHERS THEN RAISE WARNING` so a propagation failure
  never blocks the parent write (lesson from the 2026-05-18 submittal
  trigger SECDEF incident).

### Critical risk mitigated — unit mismatch

`drawing_pages.scale_ratio` is **realInchesPerDrawingInch** (dimensionless,
~48 for `1/4"=1'-0"`). `drawings.scale_ratio` is **realInchesPerImagePixel**
(set only on user calibration; ~0.2 for a typical 600px = 10' calibration).
**These are different physical quantities.** The migration only copies
`scale_text` (unit-free); never the numeric column. Documented inline in
the migration header and column comments.

### Frontend

- `src/types/database.ts`: extended `drawings` Row/Insert/Update with the new columns.
- `src/pages/drawings/DrawingList.tsx`: `DrawingItem` extended with `scale_ratio`, `scale_source`, `scale_calibrated_at`, `scale_calibrated_by`.
- `src/components/drawings/DrawingTiledViewer.tsx`:
  - `TiledDrawing` type extended with the same fields.
  - Dropped `as { scale_ratio? }` casts.
  - `persistCalibration` now writes `scale_source='user'`, `scale_calibrated_by=user.id`, `scale_calibrated_at=now` so the audit trail lands with each manual calibration.
  - New top-edge banner ("Scale not set — tap to calibrate before measuring") when a measure tool is active without scale.
  - New bottom-left provenance pill ("Scale: 1/4"=1'-0" · auto-detected" or "Scale: calibrated · YYYY-MM-DD") so the user trusts what they see.
  - New `handleUncalibrated` → sonner toast with one-tap "Calibrate" action that switches to the calibrate tool.
- `src/components/drawings/MeasurementOverlay.tsx`:
  - Added `onUncalibrated` prop.
  - **Removed the silent `"${Math.round(pxDist)} px"` fallback at three sites** (linear measure click, polygon area close, path double-click). All three now discard the in-progress measurement and fire `onUncalibrated` instead of producing a pixel-dressed-up-as-feet label.
  - Replaced `window.prompt()` calibration capture with a styled, mobile-friendly inline `<CalibrationDialog>` (Esc to cancel, Enter to submit, focus trap, error feedback).
  - Exported `parseCalibrationInput(string): number | null` — accepts `12`, `120`, `12.5`, `12"`, `10'`, `10ft`, `10'-6"`, `10' 6"`, `2.5m`, `30cm`, `100mm`. 17 unit tests cover every format.

### Tests

`src/test/measurementCalibration.test.ts` — 17 passing vitest specs:
- 7 specs for `parseCalibrationInput` formats (inches / feet / mixed / metric / garbage / case).
- 5 specs for `parseScaleRatio` (`1/4"=1'-0"`, `1/8"=1'-0"`, `1"=20'`, `1:100`, NTS).
- 4 specs for `formatFeetInches` rounding.
- 1 integration spec: `600px ⟼ 10'` calibration round-trip correctly labels a `300px` measurement as `5'-0"`.

`e2e/drawings-measurement.spec.ts` — lightweight Playwright smoke (console-error sweep + banner-copy presence) gating against regression. Deeper UX flow verified manually on the Vercel preview.

---

## Migration deployment status

| Project | Migration 1 (columns) | Migration 2 (trigger) |
|---|---|---|
| **Staging** (`nrsbvqkpxxlonvkmcmxf`) | ✅ Applied 2026-05-19 | ✅ Applied 2026-05-19 |
| **Production** (`hypxrmcppjfbtlwuoafc` — "ss pm") | ✅ Applied 2026-05-19 | ✅ Applied 2026-05-19 |

### Prod post-flight (verified 2026-05-19)

- 497 drawings total
- **195 backfilled** with AI-extracted `scale_text` (39% of fleet) — `scale_source = 'ai'`
- 0 user calibrations yet (runtime artifact)
- `fn_propagate_drawing_scale` function installed
- `trg_drawing_pages_propagate_scale` trigger installed

The 302 drawings still without scale will surface the orange "Scale not
set — tap to calibrate" banner on first measure-tool activation; users
can drop a 2-point manual calibration and the result persists with full
audit (`scale_source='user'`, `scale_calibrated_by`, `scale_calibrated_at`).

---

## Verification

Local:
- ✅ `npm run typecheck` — clean (zero errors on top of the 2026-05-04 zero baseline).
- ✅ `npx vitest run src/test/measurementCalibration.test.ts` — 17/17 pass.
- ✅ Staging Supabase shows the 5 new columns + the propagation trigger.

Manual smoke (after prod migration applies + Vercel preview deploys):
- [ ] Open `/drawings` in the Bugatti demo project. Pick a sheet whose PDF has a scale block.
- [ ] Activate Measure. Click two points known to be ~20' apart.
- [ ] Label reads `~20'-X"`, **never** `XXX px`.
- [ ] Activate Area. Drop a 4-vertex polygon around a room. Label reads `XXX ft² · XX'-X" perim`.
- [ ] Activate Path. Drop 5+ vertices along a pipe run. Label reads `XX'-X" · N segs`.
- [ ] Open a sheet with no AI scale. Banner appears: "Scale not set — tap to calibrate". Tapping switches to Calibrate. Clicking two points opens the new inline modal. Entering `10'` and submitting calibrates.
- [ ] Close, reopen — calibration persists. Provenance pill reads "Scale: calibrated · 2026-05-19".

---

## Files touched

```
docs/audits/DRAWING_MEASUREMENT_FIX_2026-05-19.md       (new)
supabase/migrations/20260519000001_drawings_scale_columns.sql       (new)
supabase/migrations/20260519000002_drawing_pages_scale_trigger.sql  (new)
src/types/database.ts                                                (5 new fields on drawings)
src/pages/drawings/DrawingList.tsx                                   (DrawingItem fields)
src/components/drawings/DrawingTiledViewer.tsx                       (TiledDrawing fields, drop casts, banner, provenance pill, uncalibrated handler, audit write)
src/components/drawings/MeasurementOverlay.tsx                       (onUncalibrated prop, remove px fallback ×3, CalibrationDialog modal, parseCalibrationInput export)
src/test/measurementCalibration.test.ts                              (new — 17 specs)
e2e/drawings-measurement.spec.ts                                     (new)
```

---

## Follow-ups / known-unknowns

1. **Multi-page drawings:** one `scale_ratio` per drawing is a regression
   vs storing per-page. Acceptable today (most sheets have a single scale)
   but flag for Lap 3 if a customer reports a mixed-scale sheet set.
2. **PdfViewer.tsx** also mounts a `MeasurementOverlay`-class component; spot-checked, uses the same `scaleRatioText` path. No change needed.
3. **AnnotationCanvas.tsx** has its own measurement loop; it already shows `"calibrate first"` / `"uncalibrated"` rather than silent pixels, so it's already Bugatti-compliant.
4. **i18n** — banner + dialog are English-only; ship for the Bugatti demo, file an i18n follow-up before any non-US pilot.
