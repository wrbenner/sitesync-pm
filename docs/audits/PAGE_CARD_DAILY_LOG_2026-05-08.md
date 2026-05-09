# Page Card — `/daily-log`

**Date:** 2026-05-08 · **Status:** Draft
**Entry file:** `src/pages/daily-log/index.tsx` (+ `DailyLogForm.tsx`, `DailyLogPDFExport.tsx`, `CrewHoursEntry.tsx`, `SignatureCapture.tsx`, `WeatherWidget.tsx`, `DailySummaryPage.tsx`, plus `<AutoDailyLog>` and `<AutoDraftPanel>` from the Iris auto-draft surface)

| Field | Value |
|---|---|
| **Persona(s)** | super / foreman (primary author — captures site state); pm (approves or rejects the log). |
| **Job-to-be-done** | Capture today's site state in 5 minutes; submit for PM approval. |
| **Surfaces** | `/daily-log` (date-stepper header → status pill → six ZonePanels: Conditions, Manpower, Equipment, Field entries, Photos, Visitors) · `<DailyLogForm>` (entry-level edit) · `<DailyLogPDFExport>` (sealed PDF for the audit pack) · `<AutoDraftPanel>` (Iris auto-draft surface). `[Deep dive →]` |
| **Entities** | `daily_logs` (create / submit / approve / reject), `daily_log_entries` (six zones — edit in place), `weather` (cached fetch from the WeatherWidget), `photos` and `visitors` (referenced in the Photos/Visitors zones). Cross-feature: incidents created via chains below. `[Deep dive →]` |
| **Stores** | `useCopilotStore`, `useAuthStore` |
| **Permissions** | `daily_log.create`, `daily_log.submit`, `daily_log.approve`, `daily_log.reject`, `daily_log.edit`. All five gates are wired (per `DAY_26_GATE_SWEEP_RECEIPT_2026-05-03.md`). `[Deep dive →]` |
| **Workflows triggered** | `runDailyLogIncidentChain` (hazard / injury entry → incident) · `runDailyLogDelayChain` (weather + crew no-show entry → delay incident) · `runCrewNoShowChain` (crew no-show entry → delay incident + follow-up task). |
| **Iris hooks** | `useIrisDrafts`, `<IrisDailySummaryButton>`, `<AutoDraftPanel>` (Tab A — 5-section AIA G701 draft from photos + RFIs + schedule + check-ins; deterministic assembler + Claude polish; provenance-locked per `project_tab_a_daily_log_draft.md`). |
| **Telemetry** | `dailylog.opened`, `dailylog.date_changed`, `dailylog.log_submitted` (via `track()` → `record_event` RPC; 12mo retention per ADR-008). `<AutoDraftPanel>` continues to log via the iris-call edge fn (the panel writes a draft; the iris-call boundary owns the `iris_voice_diffs` write). |
| **Acceptance** | Tab A Daily-Log Auto-Draft receipt (`project_tab_a_daily_log_draft.md`) — deterministic + Claude polish; provenance-locked. Manual smoke: foreman authors entries in all six zones → submit → pm reviews via `<AutoDraftPanel>` → approve → confirm a sealed PDF + entity_history rows for every state transition. `[Deep dive →]` |

**Open questions:**
- Should `daily_log.submitted`, `daily_log.approved`, `daily_log.rejected`, `daily_log.auto_drafted_accepted` fire telemetry to feed the Lap 2 matview's "I don't want to go back" capture (the soft pilot's most predictive engagement signal)?
- The `<AutoDraftPanel>` is the most Iris-dense surface in the app outside `/iris/inbox`; should the auto-draft action acquire its own Iris Spec card (probably yes — `iris.daily_log.auto_draft_summary`)?
- Bilingual EN/ES: the WeatherWidget + zone labels render in EN only; field-crew Spanish-locale support is a Lap 3 punch-list candidate.
