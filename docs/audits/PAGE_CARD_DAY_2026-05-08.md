# Page Card — `/day`

**Date:** 2026-05-08 · **Status:** Draft
**Entry file:** `src/pages/day/index.tsx`

| Field | Value |
|---|---|
| **Persona(s)** | pm / super / foreman / owner_rep — the **only** role-dynamic page (per "only the dashboard is role-dynamic" rule, 2026-04-30). The stream is filtered by role; the surface is shared. |
| **Job-to-be-done** | Open the day, see what needs you, route the next action. |
| **Surfaces** | `/day` Cockpit only — three lanes: IrisLane (top), NeedsYouTable (left), ProjectNow (right). Per-zone ZonePanel renders inside ProjectNow. No sub-routes; no drawers. `[Deep dive →]` |
| **Entities** | RFIs, Tasks, Incidents, Daily Logs, Schedule items — all read-only on this surface. Writes happen on the downstream pages. |
| **Stores** | `useCopilotStore`, `useActionStream`, `useIrisInsights` |
| **Permissions** | None on this surface — every action button on the stream re-mounts inside the destination page where its own PermissionGate enforces. `[Deep dive →]` |
| **Workflows triggered** | — (Day reads `useIrisDrafts` and surfaces drafted-action cards but does not trigger chains itself.) |
| **Iris hooks** | `useIrisInsights`, `<IrisLane>`, `<IrisInsightsLane>`, drafted-action cards via the Iris Inbox approval gate. |
| **Telemetry** | `day.opened`, `day.lane_clicked`, `day.item_navigated` (via `track()` → `record_event` RPC; see `supabase/migrations/20260509000000_iris_telemetry.sql`; 12mo retention per ADR-008) |
| **Acceptance** | Lap-1 acceptance gate (`DAY_30_LAP_1_ACCEPTANCE_RECEIPT_2026-05-04.md`): bundle 580 KB ≤ 600 KB, first paint 976ms ≤ 4000ms, drawer skips on empty seed. Manual smoke: open `/day` as each of pm/super/foreman/owner_rep → confirm distinct stream content per role. `[Deep dive →]` |

**Open questions:**
- Should `/day` emit `day.opened`, `day.action_taken`, `day.lane_clicked` telemetry to feed the Lap 2 acceptance matview's "I don't want to go back" capture?
- The "Homepage Redesign Initiative" (Wave 1 — 2026-04-30) explicitly paused the polish-only mandate for this surface; status of the four-tab parallel build is not reflected here. Confirm before locking.
- Sub-portal / owner-rep-portal versions of this dashboard — do they exist as separate routes, or is the role-filtered stream itself the surface for owner_rep? (If separate, they each get their own Page Card.)
