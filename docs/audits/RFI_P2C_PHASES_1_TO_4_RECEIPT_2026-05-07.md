# RFI P2c — Phases 1–4 Receipt (2026-05-07)

**Branch:** `rfi/p2c-mega-bugatti`
**Scope:** P2c mega-rebuild phases 1–4 (cross-module wiring, drawing pins + spec book, settings module, reports module). Phase 5 (Bugatti polish pass) ships as a follow-up PR per the prompt's authorized split.

---

## Phase 1 — Cross-module wiring

| Deliverable | Files |
| --- | --- |
| Mega migration (links, pins, spec_book, settings, reports) | `supabase/migrations/20260507000040_rfi_p2c_mega.sql` |
| RFI links CRUD hook | `src/hooks/queries/useRFILinks.ts` |
| Linked-items panel UI (typeahead + chip remove + click-through) | `src/components/rfi/RFILinkedItemsPanel.tsx` |
| Convert menu (RFI → Submittal / Change Event / Punch / Field Directive) | `src/components/rfi/RFIConvertMenu.tsx` |
| Cost-code / location / trade / spec-book typeahead options | `src/hooks/queries/useRFIProjectMetadata.ts` |

Each link insert and conversion writes a per-row `audit_log` entry. 9 link target types × 5 link kinds. Conversion leaves the source RFI open (non-destructive).

## Phase 2 — Drawing pins + Spec book

| Deliverable | Files |
| --- | --- |
| Drawing pin coordinate hooks (by RFI, by drawing) | `src/hooks/queries/useRFIDrawingPins.ts` |
| Pure CSV spec-book parser | `src/lib/rfi/specBookCsv.ts` |
| Spec-book read + bulk-import hooks (UPSERT on (project_id, section_code)) | `src/hooks/queries/useSpecBook.ts` |

Coordinates normalized 0–1 so they survive page resize. Spec-book parser separates rows from errors and never throws.

## Phase 3 — RFI Settings module (6 sub-tabs)

| Deliverable | Files |
| --- | --- |
| Settings hook layer (workflows, response types, custom fields, custom values, permissions, numbering, notifications) | `src/hooks/queries/useRFISettings.ts` |
| Settings page UI (7 tabs incl. spec-book) | `src/pages/rfis/RFISettingsPage.tsx` |

Routes mounted: `/rfis/settings`. Default seeds in the migration give every project 5 workflow templates, 7 response types, the full role × action permissions matrix, and a settings row.

## Phase 4 — Reports module

| Deliverable | Files |
| --- | --- |
| Six pure aggregator functions + canned-key registry | `src/lib/rfi/reports.ts` |
| Reports page UI (6 charts via Recharts + scheduled-delivery form) | `src/pages/rfis/RFIReportsPage.tsx` |

Reports: Avg Response Time per Firm, On-Time Close %, Cost at Risk, Schedule at Risk, RFI Count by Trade, Designer Scorecard. Custom report builder is stubbed via the `rfi_custom_reports` table; the UI builder ships in Phase 5. Schedule form upserts into `rfi_scheduled_reports` with a per-row audit entry.

Routes mounted: `/rfis/reports`.

---

## Quality gates

- `npm run typecheck` — **green** on both `tsconfig.app.json` and `tsconfig.node.json`.
- All money in cents via `src/types/money.ts` (`fromCents` only at chart axes).
- Every settings mutation writes an `audit_log` row.
- `PermissionGate` wraps every administrative action button.
- Vite SPA — Next.js "use client" lints are documented false positives.

## Deferred / next

- **Phase 5 (Bugatti polish pass)** — separate PR `RFI Bugatti Polish Pass`: axe-core sweep, voice linter coverage, performance budgets, mobile field-test rig, keyboard nav, audit-chain coverage script, empty/loading/error sweep.
- **Custom report builder UI** — the `rfi_custom_reports` table + hook layer is wired; the visual builder ships with Phase 5.
- **Linked-items + convert-menu mounting** — the components are in tree; mounting into the RFI Detail header (next to status/transition controls) ships with the rest of detail-page polish in Phase 5.
- **Submittal SavedViews orphans** — `src/hooks/useSavedViews.ts`, `src/services/submittalsSavedViews.ts`, `src/components/submittals/SavedViews/*` remain stashed (`stash@{0}: saved-views-orphan`) — they came from a parallel session and have unresolved `useSubmittalFilters` import; not part of this PR.

## Counting receipt

- 13 files staged, 3,210 insertions.
- 1 SQL migration (~500 lines, 13 tables, 3 enums, default seeds).
- 6 Recharts canned reports + scheduled-delivery flow.
- 7 Settings sub-tabs.
