# Page Card — `/submittals`

**Date:** 2026-05-08 · **Status:** Draft
**Entry file:** `src/pages/submittals/index.tsx` (+ `SubmittalsTable.tsx`, `SubmittalsKanban.tsx`, `GroupedSubmittalsView.tsx`, `SubmittalDetail.tsx`, `SubmittalDetailPage.tsx`, `SubmittalDetailV2/`, `SubmittalSettingsPage.tsx`, `SubmittalKPIs.tsx`, `SubmittalTabBar.tsx`)

| Field | Value |
|---|---|
| **Persona(s)** | pm / office (primary — author transmittals, chase ball-in-court); subcontractor responds via the response surface (separate Page Card). |
| **Job-to-be-done** | Move submittals through Items → Spec → Package grouping → ball-in-court → approval. |
| **Surfaces** | `/submittals` (8-tab view; Items live, others are stubs as of 2026-05-06) · `<SubmittalDetail>` (drawer) + `<SubmittalDetailPage>` (full page) + `<SubmittalDetailV2>` (refactor in progress) · `<UnifiedCreateModal>` / `<SubmittalCreateWizard>` · grouping views (`SubmittalsTable`, `SubmittalsKanban`, `GroupedSubmittalsView` — Spec / Package / BallInCourt). `[Deep dive →]` |
| **Entities** | `submittals`, `submittal_items`, `submittal_packages`. Reads via `useSubmittals`; writes via `useCreateSubmittal`, `useUpdateSubmittal`. XLSX export reads from the same query. `[Deep dive →]` |
| **Stores** | `useCopilotStore`, `useAuthStore`, `useSubmittalFilters`, `useSubmittalSettings` |
| **Permissions** | `submittals.view`, `submittals.create`. ⚠️ No PermissionGate on edit/approve/reject/distribute today — open question below. `[Deep dive →]` |
| **Workflows triggered** | `runSubmittalRejectedChain` (rejection → incident + task) · `runSubmittalApprovedChain` (transmittal approved → close linked RFI). |
| **Iris hooks** | ⚠️ **none today** — the Iris-on-Create wedge from RFI (PR #354) has not been ported to Submittals; AutoDraftPanel-equivalent for transmittal cover sheets does not exist. |
| **Telemetry** | `submittal.opened`, `submittal.tab_switched`, `submittal.created` (via `track()` → `record_event` RPC; 12mo retention per ADR-008) |
| **Acceptance** | `SUBMITTALS_MODULE_BUILD_SPEC_2026-05-06.md` P0-D35 cleanup shipped via PR #324; D38+ refactor (SubmittalDetailV2 promotion + 8-tab hydration) queued. Manual smoke: create a submittal package, attach 3 items, transmit, and confirm `runSubmittalApprovedChain` fires the linked-RFI close on a positive disposition. `[Deep dive →]` |

**Open questions:**
- Iris-on-Create wedge port — match RFI PR #354 pattern? Spec-section auto-link + drawing reference would be the equivalent surface.
- Telemetry instrumentation — `submittals.created`, `submittals.transmitted`, `submittals.approved`, `submittals.rejected` events feed the Lap 2 matview.
- Per-action permission gates: `submittals.edit`, `submittals.transmit`, `submittals.approve`, `submittals.reject`, `submittals.delete`, `submittals.distribute`. Today the only guards are view + create.
- 7 of the 8 tabs are stubs; this card describes the live Items tab. As the others land, decide whether each gets its own Page Card or a deep-dive section under this card.
