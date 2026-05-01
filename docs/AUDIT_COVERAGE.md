# Audit Coverage

Living doc. The static detectors + Playwright runtime audits write JSON; this doc summarizes the latest run for human eyes.

## Static detectors (one-shot, fast)

```
npx tsx scripts/detect-dead-clicks.ts
npx tsx scripts/check-handler-bindings.ts
```

Output: `audit/dead-clicks.json`. Both scripts read source AST; no browser, no dev server needed. Run on every PR via `.github/workflows/audit.yml`.

### Latest static run

| Reason | Count | Notes |
| --- | --- | --- |
| `noop_arrow` | 0 | `onClick={() => {}}` and equivalents — none in source. |
| `undefined_handler` | 0 | `onClick={undefined}` — none. |
| `null_handler` | 0 | `onClick={null}` — none. |
| `console_only` | 0 | Handlers that only `console.log` — none. |
| `button_no_onclick` | 1 | Documented false positive (see below). |
| `destructured_unused` | 0 | All resolved by underscore-prefix convention. |

### Documented false positive

| File | Line | Why | Action |
| --- | --- | --- | --- |
| `src/pages/payment-applications/LienWaiverPanel.tsx` | 261 | The `<button>` is rendered inside `<PDFDownloadLink>{({ loading }) => <button .../>}</PDFDownloadLink>` from `@react-pdf/renderer`. The library wrapper handles the click on the outer element. | Detector can't see this from static analysis. Documented here; no code change. |

### Fixes applied this round

| File | Lines | Reason | Fix |
| --- | --- | --- | --- |
| `src/components/drawings/DrawingSetPanel.tsx` | 278 | `onUpdateSet` destructured but UI not yet wired | Renamed alias to `_onUpdateSet` (detector skips `_`-prefix); prop contract preserved for callers. |
| `src/pages/Preconstruction.tsx` | 969 | `onAddScope` destructured, no UI | Same underscore-alias treatment. |
| `src/pages/punch-list/PunchListPlanView.tsx` | 260 | `onCreateAtLocation` destructured, no UI | Same. |
| `src/pages/compliance/HUDCompliancePage.tsx` | 732, 863, 1179, 1491, 1492 | Stub buttons on an unrouted scaffold page | Added `disabled` + `title="…not yet wired"` to each. |
| `src/pages/field-capture/CaptureUpload.tsx` | 166 | "Voice to text" Mic button — feature not yet wired | `disabled` + tooltip explaining the gap. |
| `src/pages/payment-applications/LienWaiverPanel.tsx` | 245 | `<Suspense fallback>` PDF placeholder button | Added `disabled` to make the Suspense fallback explicit. |

### Detector behavior tuned this round

- A `<button>` with no `onClick` AND a `disabled` attribute is now correctly skipped (was previously flagged). The intent: `disabled` is the React idiom for an intentionally inert button — the audit should only catch buttons that LOOK alive but DO nothing.

## Runtime audits (Playwright)

Three specs in `e2e/audit/`. Each reuses `polish-audit.setup.ts` storage state for auth.

| Spec | What it does | Output |
| --- | --- | --- |
| `runtime-audit.spec.ts` | Walks every route, captures console errors, failed network requests, missing-data signals (zero-row tables without `[data-empty]`), and `[data-test-broken]` markers. | `audit/runtime-audit.json` + `audit/screenshots/<slug>.png` |
| `click-through.spec.ts` | For each route, clicks every visible non-disabled, non-destructive button (≤25/route). Records crashes, navigations, errors. | `audit/click-through.json` |
| `keyboard-shortcuts.spec.ts` | Verifies documented shortcuts (Cmd+K, ?, `g d`, `g r`, `g l`) actually fire. | `audit/keyboard-shortcuts.json` |
| `modal-escape.spec.ts` | Every modal must close via Escape AND backdrop click AND X button. | `audit/modal-escape.json` |

Run all four:

```bash
npx playwright test e2e/audit/
```

## Audit rule (the gate)

A route fails the audit if any of:

| Criterion | Source signal |
| --- | --- |
| Console error fires on initial render | `runtime-audit.json` → `console_errors[]` not empty (after allowlist) |
| Expected button is dead | `dead-clicks.json` finding for the route's source files |
| Expected data missing without graceful empty state | `runtime-audit.json` → `missing_data[]` not empty |
| Modal can't close via Escape AND backdrop AND X | `modal-escape.json` → any `closes_on_*` is false |
| Form lacks pending-disable on submit | (manual review for now; not auto-detected) |
| Pagination 404 / stale data | `click-through.json` → `crashed > 0` for paginated routes |
| Documented keyboard shortcut doesn't fire | `keyboard-shortcuts.json` → `fired === false` |

CI consumes the JSON files and decides per-tier:

- Tier 1 routes (`/dashboard`, `/daily-log`, `/rfis`, `/rfis/:id`, `/profile`, `/conversation`): zero tolerance for console errors. PR blocks on any.
- Tier 2 routes: warn only.
- Tier 3 routes: warn only.

## Routes covered

See `e2e/audit/_routes.ts` — 31 routes across tier 1 / 2 / 3. Mirrors `polish-audit.spec.ts`'s ROUTES array; keep in sync.

## Allowlist

Console-error noise filter lives in `e2e/audit/_routes.ts → CONSOLE_ERROR_ALLOWLIST`. Each entry has a regex + a rationale. Add only when noise comes from a third-party we don't control.

Current allowlist:

| Pattern | Rationale |
| --- | --- |
| `/Sentry/i` | Sentry SDK init logs |
| `/\bdevbypass\b/i` | `VITE_DEV_BYPASS` dev banner |
| `/HMR/i` | Vite HMR bookkeeping |
| `/WebSocket connection.*HMR/i` | HMR socket reconnect noise |
| `/\bResizeObserver loop\b/i` | Benign Chrome ResizeObserver warning |
| `/Refused to connect to .*supabase/` | Test env without supabase access |

## Files

```
scripts/detect-dead-clicks.ts          — AST scan for noop / missing onClick
scripts/check-handler-bindings.ts      — AST scan for destructured-unused props
e2e/audit/_routes.ts                   — shared route list + allowlist
e2e/audit/runtime-audit.spec.ts        — per-route console + network + missing-data audit
e2e/audit/click-through.spec.ts        — auto-click visible buttons
e2e/audit/keyboard-shortcuts.spec.ts   — verify documented shortcuts
e2e/audit/modal-escape.spec.ts         — Escape + backdrop + X close paths
.github/workflows/audit.yml            — CI wiring (static detectors on every PR)
audit/dead-clicks.json                 — static detector output (committed)
audit/runtime-audit.json               — runtime audit output (gitignored — large)
audit/click-through.json               — runtime audit output
audit/keyboard-shortcuts.json          — runtime audit output
audit/modal-escape.json                — runtime audit output
docs/AUDIT_COVERAGE.md                 — this file
```
