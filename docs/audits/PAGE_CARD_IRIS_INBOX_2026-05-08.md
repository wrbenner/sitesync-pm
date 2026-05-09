# Page Card — `/iris/inbox`

**Date:** 2026-05-08 · **Status:** Draft
**Entry file:** `src/pages/iris/IrisInboxPage.tsx`

| Field | Value |
|---|---|
| **Persona(s)** | pm / super / office — any persona that authored a draft, was @-mentioned in one, or is the routed reviewer for the entity_type the draft targets. |
| **Job-to-be-done** | Review every Iris-drafted action in one queue; accept, dismiss, or open the citation panel. |
| **Surfaces** | `/iris/inbox` (3 tabs — Drafts, Suggestions, History; grouped by `entity_type`) · `<CitationPanel>` side-panel (right edge per ADR-004; opens when `?cite=<kind>:<id>` is in the URL). `[Deep dive →]` |
| **Entities** | `drafted_actions` (parent table) with subkinds for RFI / daily-log / submittal / pay-app / punch / schedule / change-order. Reads via `useDraftedActionsForProject`. Citation resolution reads the source entity per IRIS_CITATIONS_SPEC. `[Deep dive →]` |
| **Stores** | None. Pure React-Query / hook composition (`useDraftedActionsForProject`, `useApproveDraftedAction`, `useRejectDraftedAction`, `useIrisInsights`). |
| **Permissions** | ⚠️ **No PermissionGate on accept / reject** — `useApproveDraftedAction` and `useRejectDraftedAction` fire without a gate; any authenticated user can accept any draft on this surface. Open question below. `[Deep dive →]` |
| **Workflows triggered** | — (Drafts originate from chains, scheduled-insights detectors, or direct Iris drafting; this page only consumes them.) |
| **Iris hooks** | `useIrisInsights`, `<IrisApprovalGate>`, `<CitationPanel>`, `<IrisInsightsCard>`. |
| **Telemetry** | `iris.opened`, `iris.tab_switched`, `iris.suggestion_filtered` (via `track()` → `record_event` RPC; 12mo retention per ADR-008). Per-draft view + decision telemetry already wired via `<IrisApprovalGate>` → `record_draft_view` / `record_draft_decision` RPCs (per IRIS_TELEMETRY_SPEC; feeds `lap_2_gate_metrics_daily` matview). |
| **Acceptance** | IRIS_CITATIONS_SPEC Day 38 receipt (`DAY_38_CITATIONS_RECEIPT_2026-05-04.md`) — server backbone + side panel + auto-reject + 28 tests. Manual smoke: open `/iris/inbox` → click a draft with `[1]` citation chip → confirm CitationPanel opens with verified snippet → accept → confirm the source entity now shows the drafted action applied + `entity_history` row written. `[Deep dive →]` |

**Open questions:**
- **PermissionGate on accept / reject** — today any auth'd user can approve any draft. At minimum: gate accept on the persona allowed to write the target entity (e.g., `daily_log.approve` for daily-log drafts). Likely earns its own PR.
- **Inbox-level telemetry** — `iris_inbox.draft_accepted`, `iris_inbox.draft_dismissed`, `iris_inbox.citation_opened`, `iris_inbox.tab_changed` are the events the Lap 2 matview most needs (acceptance rate is the single most predictive engagement signal). Listed in the Lap 2 spec but not wired here.
- The History tab is the audit surface: should it acquire deposition-grade hash-chain verification (per `project_tab_a_audit_pack.md`) inline, or stay a simple list with the verifier living elsewhere?
