# Page Card — `/rfis`

**Date:** 2026-05-08 · **Status:** Draft
**Entry file:** `src/pages/RFIs.tsx` (+ `src/pages/rfis/RFIDetail.tsx`, `RFIKPIs.tsx`, `RFITabBar.tsx`, `RFIReportsPage.tsx`, `RFISettingsPage.tsx`)

| Field | Value |
|---|---|
| **Persona(s)** | pm / office (primary — author and chase); super (responder when ball-in-court is on the field side); subcontractor uses the guest portal at `sub.sitesync.com/rfi/:token` (separate Page Card). |
| **Job-to-be-done** | Track open questions blocking work; route + chase responses until they land. |
| **Surfaces** | `/rfis` (table + KPIs + Kanban/Timeline/Map/Pin views) · `/rfis/:id` (detail side-panel + full-page) · `/rfis/new` (RFICreateWizard with Iris-on-Create wedge) · `/rfis/settings` · `/rfis/reports` · sub.sitesync.com/rfi/:token (guest portal — separate card). `[Deep dive →]` |
| **Entities** | `rfis`, `rfi_responses`, `profiles` (ball_in_court, assigned_to), `project_rfi_settings`. Indirect through Iris: `iris_drafts`, `iris_voice_diffs`. `[Deep dive →]` |
| **Stores** | `useCopilotStore`, `useRealtimeInvalidation` |
| **Permissions** | `rfis.create`, `rfis.edit`, `rfis.respond`, `rfis.delete`, `ai.use` (gates the Iris draft-preview button per RFI P0 receipt — two-layer guard). `[Deep dive →]` |
| **Workflows triggered** | `runRfiOverdueSweep` (cron — fires from a sweep, not user action) · `runDiscrepancyDetectedChain` (when an RFI flags a clash). |
| **Iris hooks** | `useIrisDrafts`, `<RFIIrisDraftPreview>`, `<RFICreateWizard>` (Iris-on-Create wedge per PR #354 — one-line question → 7-pass Iris fills the form). Voice linter post-process runs on every iris-call from this surface. |
| **Telemetry** | `rfi.opened`, `rfi.status_changed`, `rfi.deleted`, `rfi.ai_draft_requested` (via `track()` → `record_event` RPC; 12mo retention per ADR-008). `iris_voice_diffs` rows continue to be logged from the iris-call edge fn (~276 strings / 0 violations per RFI Bugatti Polish receipt). |
| **Acceptance** | RFI P0 receipt (11/11 PASS, hash `341ff9e`) + RFI Procore-parity wave receipt (5 stacked PRs #350–#355) + RFI Bugatti Polish receipt (PR #337 — audit-coverage gate, voice linter wired, j/k/Enter/c/e/f/g i shortcuts). Manual smoke: create an RFI as pm via `/rfis/new`, distribute, respond as super on `/rfis/:id`, close — all six stages must touch entity_history. `[Deep dive →]` |

**Open questions:**
- Should `rfis.list_view_changed`, `rfis.responded`, `rfis.escalated`, `rfis.closed` events fire to measure adoption of the kanban/timeline/map views and to feed the Lap 2 matview?
- Schema-blocked items remaining from the Procore-parity wave: `default_distribution` column on `project_rfi_settings`, `recipient_role` enum on `notification_prefs`. See `RFI_PROCORE_PARITY_FOLLOW_ON_RECEIPT_2026-05-07.md` for migration sketches.
- Sub-portal Page Card pending — guest-token flow + Spanish-locale rendering haven't been audited against this card's surface list.
