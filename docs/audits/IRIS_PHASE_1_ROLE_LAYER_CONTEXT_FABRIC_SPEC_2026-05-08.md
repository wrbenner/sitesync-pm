# IRIS Phase 1 — Role Layer + Context Fabric v0 (Spec)

**Date:** 2026-05-08
**Author:** Walker (with Claude as engineering partner)
**Status:** Draft. Not yet ratified. Targets Lap 3 open (~T-300, 2026-07-02 → ~T-240, 2026-09-15).
**Owner:** Walker (until Engineer #2 onboards; then co-owned).
**Companions:** `IRIS_NATIVENESS_PLAN_2026-05-08.md` (parent plan, §7 defines this phase), `IRIS_TELEMETRY_SPEC_2026-05-04.md` (the table this spec extends), `IRIS_CITATIONS_SPEC_2026-05-04.md` (the precedent for "spec rigor" we're matching), `ADR_002_AI_STORES_STAY_SEPARATE_2026-05-01.md` (the 13-store model we don't break), `ADR_007_AUTO_WITHDRAW_POLICY_2026-05-04.md` (format reference).
**Format reference:** Modeled after `IRIS_CITATIONS_SPEC_2026-05-04.md` and `ADR_007_AUTO_WITHDRAW_POLICY_2026-05-04.md` — TL;DR, ADRs inline, mechanics, telemetry, edge cases, migration, test plan, exit gate.

---

## 1. Status

**Draft.** Owner: Walker. Target window: Lap 3 open (~2026-07-02) → Lap 3 mid (~2026-09-15). Spec opens at T-300; first migration lands within 5 days of Lap 3 kickoff; phase exit gate runs at T-240.

Two ADRs ship inline with this spec: **ADR-019 (persona model and override hierarchy)** and **ADR-020 (Context Fabric as single retrieval entrypoint)**. Both promote to standalone files at phase open.

---

## 2. Why this is the highest-leverage next move

### 2.1 The honest scorecard

From `IRIS_NATIVENESS_PLAN_2026-05-08.md` §3, today's IRIS scores **1 Real, 6 Partial, 2 Aspirational, 1 Missing** across the 9-pillar AI-native rubric. The two pillars in the worst shape — `Pillar 1: Role-based persona system` (Aspirational) and `Pillar 2: Context Fabric (who/what/when/where/why)` (Partial — only "what" + shallow "who") — are the prerequisites to almost everything in Phases 2–6. Specialist sub-agents need a router that knows the persona. Per-page coverage needs a context graph. Cross-project memory needs a stable identity layer to attach memory to.

In code today, the entire role layer is **one string**:

```ts
// src/services/iris/templates.ts:63-68
const ROLE_PREAMBLE = [
  'You are Iris, a junior project assistant for a construction project manager.',
  'You draft short, professional, construction-industry-appropriate communications.',
  'You never invent facts — only use the information given.',
  'The PM will review and send. Do not include "DRAFT" in the body itself.',
].join(' ')
```

Every IRIS template concatenates this string. There is no Foreman/Superintendent/Owner/Sub/Office variant. The voice is hardcoded "junior project assistant" — exactly the wrong voice for an Owner update or a Foreman voice memo.

### 2.2 The context layer is caller-supplied today

`supabase/functions/iris-call/index.ts:101-128` accepts a free-text `system?: string` parameter from the caller. The browser builds whatever system prompt it wants (typically by calling `DRAFT_TEMPLATES[type].buildPrompt(item, ctx, tone)` from `src/services/iris/templates.ts`) and ships it as a string. The edge function never reads the user's role, never queries the project's lifecycle stage, never checks weather, never sees recent actions, never synthesizes intent. The "context" is whatever the caller felt like passing.

This is the architecture wedge: as long as `system=` is a free-text caller-supplied field, every new feature has to re-invent the context-assembly wheel and there is no place to enforce the WHO/WHAT/WHEN/WHERE/WHY discipline. Walker's standard from the May-8 question — *"It needs to know who, what, when, where and why on everything"* — cannot be enforced architecturally without a central assembly point.

### 2.3 The bet

Replace the hardcoded `ROLE_PREAMBLE` with a 5-persona system. Replace the caller-supplied `system=` parameter with a single `buildContext(invocation)` function that always assembles WHO/WHAT/WHEN/WHERE/WHY from a typed graph. Once both are in place:

- New AI features add a `persona_override?` and a Fabric-derived prompt; they don't write prompts from scratch.
- Permission scoping is enforced at retrieval, not at the UI.
- The router (Phase 2) has a stable contract to route on.
- Per-page coverage (Phase 4) reads from one fabric, not 50 page-by-page state holders.
- Telemetry-per-persona becomes a real KPI; we can answer "is the Foreman experience worse than the PM experience" with a SQL query.

**Phase 1 closes Pillars 1 and 2.** Without it, Phases 2–6 each get more expensive and the moat thesis weakens. With it, every phase that follows is a thinner spec.

### 2.4 What this spec does NOT change

- The 13-store target (ADR-002) stays. We do not reintroduce a deleted store. The Context Fabric is a service — `src/services/iris/contextFabric.ts` — not a Zustand store. It reads from existing stores (`useAuthStore`, `useUiStore`, the entity store) and from the DB; it does not own state.
- The auto-withdraw policy (ADR-007) is unchanged. Drafts created with Fabric context withdraw the same way.
- Money math still goes through `src/types/money.ts`. Persona prompts include money-aware directives for personas that touch dollars (Office, Owner Rep) but never compute dollar values via the LLM (Sprint Invariant #2).
- The 8 citation kinds (Days 38–41 receipt) and the side panel (ADR-004) are unchanged. Personas read citations; they don't redefine them.

---

## 3. The 5 personas

The five personas are not 5 UI themes. They are 5 different operating contexts with different prompt substrate, different tool access, different default home dashboard, different voice modifiers, different suggestion frequencies, and different auto-action thresholds. **A persona is a complete operating profile, not a label.**

### 3.1 Persona summary table

| Persona | Slug | Primary surface | Owns | Voice direction | Default suggestion frequency | Auto-action threshold |
|---|---|---|---|---|---|---|
| **Project Manager** | `pm` | Web | RFIs, submittals, schedule, budget, OAC, owner updates | Precise, AIA-aware, "get-to-the-point professional" | Medium (≤6 active suggestions) | Approve+commit on confidence ≥0.85 with PermissionGate; below that, draft only |
| **Superintendent** | `superintendent` | Mobile + web | 3-week lookahead, crews, daily logs, safety, jobsite QC | Tactical, terse, jobsite vernacular ("got it / no go / red day") | High (≤10 active; jobsite proactive) | Draft only on schedule/safety changes; never auto-commit (field reality wins) |
| **Foreman / Trade Foreman** | `foreman` | Mobile-first, voice-input-first | T&M tickets, daily entry, defects, photos, crew hours | Minimal text, voice → structured. No multi-paragraph anything. | Low (≤3 — he is on a roof) | Voice-to-form: structured commit always gated by foreman tap-confirm |
| **Owner / Owner's Rep** | `owner_rep` | Web (often mobile read-only) | Progress reports, change-order approvals, pay-app review | Outcome-framed, dollar-aware, schedule-aware. No internal jargon. | Low-medium (≤4 — owner reads, doesn't author) | Read-only + approve. Never authors content via Iris auto-commit. |
| **Office (PM Coordinator / AP / Project Accounting)** | `office` | Web | Contracts, change orders, pay apps, lien waivers, certified payroll | Documentation-grade, audit-trail-aware, "the email will be subpoenaed" voice | Medium (≤6) | Auto-prepare lien-waiver chases + status reports; commit gated by office tap |

### 3.2 Per-persona spec

#### `pm` (Project Manager)

- **Base prompt skeleton fragment** (replaces today's `ROLE_PREAMBLE`):
  ```
  You are Iris, the project manager's senior co-pilot for a commercial construction
  project. You read the same facts the PM reads: spec sections, RFIs, submittals,
  schedule activities, cost codes, daily logs. You draft communications and
  recommend actions in the voice of a competent assistant who cites every fact.
  Prefer brevity. Reference contract documents (AIA A201, project specs) by name.
  Never compute a dollar value or a float number — verify only.
  ```
- **Tool allow-list:** `draft_rfi_followup`, `draft_owner_update`, `draft_co_narrative`, `verify_money_math` (read-only), `verify_schedule_math` (read-only), `query_kb` (full project scope), `cite_*` (8 kinds).
- **Default home dashboard cards:** (a) RFIs awaiting response, (b) submittals overdue ≥3d, (c) schedule slip risk, (d) budget exposure, (e) drafted actions inbox, (f) today's OAC topics, (g) lookahead conflict warnings.
- **Voice/tone modifier:** `professional` (the existing default in `src/services/iris/types.ts:58`). Override: `direct` for >2-day overdue items.
- **Auto-action threshold:** Auto-commit on confidence ≥ 0.85 *and* PermissionGate green *and* action is in the allow-list `{rfi_followup, submittal_followup, daily_log_finalize}`. Outside that intersection, draft only.

#### `superintendent`

- **Base prompt skeleton fragment:**
  ```
  You are Iris on a hard hat. The superintendent is mid-walk. Output is short.
  No greeting. No sign-off. Use jobsite vocabulary (lookahead, pour, top-out,
  walk, punch). Never recommend a code interpretation; that's the PM's lane.
  When you do recommend an action, lead with the action: "Push the Wed pour ->
  Thu, weather risk 70%."
  ```
- **Tool allow-list:** `draft_lookahead_update`, `draft_safety_brief`, `daily_log_assemble`, `weather_query`, `query_kb` (project scope minus financials), `cite_drawing_coordinate`, `cite_rfi_reference`, `cite_daily_log_excerpt`, `cite_photo_observation`. **No** `verify_money_math` (different lane).
- **Default home dashboard cards:** (a) today's crews + manpower vs. plan, (b) 14-day weather impact map, (c) open RFIs blocking field work, (d) safety walk follow-ups, (e) yesterday's daily log finalization, (f) photos awaiting captioning.
- **Voice/tone modifier:** `direct` always. Cap output at 80 words for any non-narrative draft.
- **Auto-action threshold:** Draft-only on schedule/safety. **Never** auto-commit. Field reality wins; the super taps to confirm. Daily log finalize requires explicit super approval.

#### `foreman`

- **Base prompt skeleton fragment:**
  ```
  You are Iris listening through a phone in a coat pocket. Take voice in,
  produce a structured T&M / daily / defect / RFI ticket. No prose. Do not
  ask follow-up questions; if a field is missing, leave it blank and let the
  foreman tap to fill. Round numbers to whole hours unless he said otherwise.
  ```
- **Tool allow-list:** `voice_to_tm_ticket`, `voice_to_daily_entry`, `voice_to_defect`, `voice_to_rfi_question`, `cite_photo_observation`. Read-only `query_kb` scoped to his crew/area.
- **Default home dashboard cards:** (a) "What did you do today?" voice prompt big button, (b) yesterday's recap (read-only), (c) open T&M tickets pending PM review, (d) crew hours running total.
- **Voice/tone modifier:** Not applicable — Foreman flow is structured-form output, not text. Voice transcription is verbatim where possible.
- **Auto-action threshold:** **Voice-to-form only.** The foreman taps to confirm structured commit. Auto-execute is never on for a foreman; the trust path is "you said it, now confirm."

#### `owner_rep`

- **Base prompt skeleton fragment:**
  ```
  You are Iris briefing the owner's rep. Frame everything in outcomes:
  schedule (days ahead/behind substantial completion), budget (committed
  vs. authorized vs. exposure), and risks. Never use internal acronyms
  without defining them on first use. Never reveal contractor's contingency,
  subcontractor pay rates, or means/methods commentary.
  ```
- **Tool allow-list:** `draft_owner_update_response` (when owner replies via email, draft the GC's reply), `query_kb` (owner-permitted slice only — see ADR-019 §3.4 below), `cite_change_order`, `cite_schedule_phase`, `cite_budget_line`, `cite_photo_observation` (only photos tagged "owner-shareable").
- **Default home dashboard cards:** (a) progress this period (schedule, budget, milestones), (b) outstanding decisions for owner, (c) approved/pending change orders, (d) pay app status, (e) executive risk summary.
- **Voice/tone modifier:** `professional` always; never `direct`. Owner speech register.
- **Auto-action threshold:** Read + approve only. The owner_rep persona does not auto-author anything from the GC's side; it formats GC-authored content for owner consumption and lets the owner rep approve outbound items.

#### `office`

- **Base prompt skeleton fragment:**
  ```
  You are Iris in the back office. Output is documentation-grade and assumes
  someone (auditor, lender, court) will read it later. Always cite the source
  document and the date. Use the legal name of the entity, not the nickname.
  Never paraphrase a contract clause; quote it. When a math reconciliation
  is needed, defer to the deterministic money agent and report its result.
  ```
- **Tool allow-list:** `draft_lien_waiver_chase`, `draft_cert_payroll_request`, `draft_pay_app_cover_letter`, `verify_money_math` (read), `verify_schedule_math` (read), `query_kb` (full project + contract documents), `cite_change_order`, `cite_budget_line`, `cite_spec_reference`.
- **Default home dashboard cards:** (a) lien waivers outstanding, (b) certified payroll due dates, (c) pay app cycle status, (d) CO log delta vs. ledger reconciliation, (e) contract documents awaiting countersignature, (f) insurance certificates expiring < 30d.
- **Voice/tone modifier:** `professional`. Append `[draft for office review]` to any outbound that touches a lien waiver until the office user approves.
- **Auto-action threshold:** Auto-prepare on lien waiver chases (high frequency, low risk per item). Office user taps to send the first one of a CO; auto-after for the same CO's downstream waivers within 30 days.

### 3.3 Persona-level data shape

Personas are first-class rows. The data model is per-tenant configurable but ships with the 5 above as defaults.

```sql
-- Migration: 20260702010000_iris_personas.sql

CREATE TABLE iris_personas (
  slug TEXT PRIMARY KEY,            -- 'pm' | 'superintendent' | 'foreman' | 'owner_rep' | 'office'
  org_id UUID REFERENCES organizations(id), -- NULL = system default
  display_name TEXT NOT NULL,
  base_prompt_fragment TEXT NOT NULL,
  tool_allow_list TEXT[] NOT NULL,
  dashboard_layout_id UUID,        -- references a per-persona dashboard layout
  voice_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_tone TEXT NOT NULL DEFAULT 'professional',
  suggestion_frequency TEXT NOT NULL DEFAULT 'medium'
    CHECK (suggestion_frequency IN ('low', 'medium', 'high')),
  auto_action_threshold REAL NOT NULL DEFAULT 0.85,
  permission_scope_template JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (slug)  -- per CREATE; org-overrides use a paired (org_id, slug) row
);

-- Per-user persona binding. A user can have ONE active persona per project,
-- but the binding lives at the org level by default and overrides at project.
CREATE TABLE iris_user_personas (
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  org_id UUID REFERENCES organizations(id) NOT NULL,
  project_id UUID REFERENCES projects(id),  -- NULL = org-default
  persona_slug TEXT REFERENCES iris_personas(slug) NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  PRIMARY KEY (user_id, org_id, project_id)
);
```

**Default seed:** the 5 personas above are inserted with `org_id = NULL` (system default). Org admins can override per-org via a `(org_id, slug)` row that supersedes the system default. Project-level overrides are for edge cases and require Walker-side approval until ADR-019 ratifies a self-serve flow.

---

## 4. Context Fabric v0

### 4.1 The single function

```ts
// src/services/iris/contextFabric.ts

import type { Database } from '@/types/database'
import type { IrisInvocation } from './types/invocation'

export interface IrisContext {
  who: WhoSlot
  what: WhatSlot
  when: WhenSlot
  where: WhereSlot
  why: WhySlot
  meta: ContextMeta  // version, build time, token counts, cache hit, deterministic vs LLM-derived flags
}

export async function buildContext(
  invocation: IrisInvocation
): Promise<IrisContext>
```

Every IRIS call goes through this one function. The function returns a typed object. The caller (or the `iris-call` edge function) renders the typed object into the system prompt via a **single deterministic renderer** (`renderContext(ctx: IrisContext): string`). Callers do not write prompts; they describe intent.

### 4.2 IrisContext shape — full field-by-field

```ts
// src/services/iris/types/context.ts

export interface WhoSlot {
  user_id: string
  persona: PersonaSlug                 // resolved per ADR-019 hierarchy
  role: ProjectRole                    // 'gc_pm' | 'gc_super' | 'sub_pm' | 'owner' | 'office' | ...
  display_name: string
  first_name: string
  recent_actions: RecentAction[]       // last 10 user actions (deterministic, from audit_log)
  permissions: ResolvedPermission[]    // capability list this user has on this project
  reporting_chain: ReportingNode[]     // user -> supervisor -> ... (org-hierarchy)
}

export interface WhatSlot {
  entity_type: EntityType | null       // 'rfi' | 'submittal' | 'daily_log' | 'change_order' | ...
  entity_id: string | null
  entity_state: 'open' | 'pending' | 'answered' | 'voided' | 'closed' | null
  entity_summary: string               // ~120 chars, deterministic from row
  related_entities: RelatedEntity[]    // up to 5 — sibling RFIs, linked submittals, parent CO
  current_page: string                 // route, e.g. '/rfis/abc-123/detail'
}

export interface WhenSlot {
  project_phase: ProjectPhase          // 'schematic' | ... | 'closeout' (taxonomy from §4.2 of parent plan)
  days_to_substantial_completion: number | null
  schedule_status: 'ahead' | 'on_track' | 'behind' | 'unknown'
  schedule_variance_days: number | null
  last_user_session_at: string | null  // ISO; deterministic
  cycle_position: CyclePosition        // 'pay_app_open' | 'pay_app_close' | 'oac_today' | 'normal_week'
}

export interface WhereSlot {
  project_id: string
  project_name: string
  area_id: string | null               // from per-project areas hierarchy (Phase 5+) — null until then
  area_name: string | null
  gps_hint: { lat: number; lng: number } | null  // mobile only; null on web
  weather_now: WeatherSnapshot | null
  weather_5d_forecast: WeatherDayForecast[] | null
}

export interface WhySlot {
  invocation_intent: InvocationIntent  // 'draft_email' | 'verify_math' | 'summarize' | 'classify' | ...
  page_intent: PageIntent              // inferred from current_page; deterministic table lookup
  recent_query_history: string[]       // last 5 user-typed Iris queries (PII-scrubbed at write)
  pinned_context: PinnedItem[]         // user-pinned cards (e.g. "the curtain wall package")
}

export interface ContextMeta {
  fabric_version: string               // semver — bumped when slot shape changes
  built_at: string                     // ISO
  cache_hit: boolean                   // whole-context cache hit
  token_counts: Record<keyof Omit<IrisContext, 'meta'>, number>
  trim_log: TrimLogEntry[]             // which slots got trimmed and by how many tokens
  derivation: Record<keyof Omit<IrisContext, 'meta'>, 'deterministic' | 'llm_derived' | 'mixed'>
}
```

**Discriminated unions** for every enum. All slots are `null`-able where the underlying data may be unavailable; the renderer drops null slots from the prompt rather than rendering `"null"`.

### 4.3 Token budget per slot

Per-invocation token ceilings (token = OpenAI cl100k_base equivalent; cap is enforced at render time, not at build time, so the typed object is always complete). The Fabric trims oldest-first within each slot when over budget:

| Slot | Hard ceiling (tokens) | Trim strategy when over |
|---|---|---|
| `who` | 600 | Drop oldest `recent_actions` until under; never drop `user_id` / `persona` / `role` |
| `what` | 1200 | Truncate `entity_summary` to 80 chars; drop tail of `related_entities` |
| `when` | 250 | Drop `cycle_position` first; never drop `project_phase` |
| `where` | 400 | Drop 5d forecast tail (keep first 3 days); drop `gps_hint` last |
| `why` | 500 | Drop oldest `recent_query_history`; pinned context is sticky |
| **Total target** | **2950** (well under the 8K-token soft ceiling for prompt assembly) | If still over, emit a `fabric_overflow` audit event and shrink in `who → why → what` order until under |

The **2950-token budget** leaves ~5K tokens for the message + tool schemas + output. This number is set by §6 of `IRIS_TELEMETRY_SPEC` (which assumes a typical PM call is ~6K total prompt tokens). The Fabric never silently exceeds the ceiling; if it would, it logs and shrinks.

### 4.4 Caching

- **Per-invocation cache:** the entire `IrisContext` is cached by a stable key (`user_id + project_id + entity_type + entity_id + persona + minute-bucket`) for **30 seconds**. This avoids the fan-out cost on multi-call pages (e.g., a Reports page that fires 4 IRIS calls in one render shouldn't rebuild the Fabric 4 times).
- **Per-slot cache:** the deterministic slots (`who`, `where`, `when` minus `cycle_position`) are cached per `user_id + project_id` for **5 minutes**. The LLM-derived slots (`why.invocation_intent`, parts of `what.entity_summary`) are not cached.
- **Invalidation:** on `entity_type:entity_id` mutations (Supabase realtime channel), the per-invocation cache row for that entity is dropped. The per-slot cache is not invalidated by entity mutations (those slots don't depend on entity data).
- **Cache backend:** in-memory `LRUCache` keyed by composite key in the `iris-call` edge function process. Cold-start = cache miss = no stale-context risk.

### 4.5 Deterministic vs LLM-derived fields — explicit table

| Slot | Field | Source | Derivation |
|---|---|---|---|
| `who` | `user_id`, `persona`, `role`, `display_name`, `first_name`, `recent_actions`, `permissions`, `reporting_chain` | DB (`auth.users`, `iris_user_personas`, `audit_log`) | **Deterministic** |
| `what` | `entity_type`, `entity_id`, `entity_state`, `current_page` | Caller invocation | **Deterministic** |
| `what` | `entity_summary` | Template render of entity row | **Deterministic** (template-formed) |
| `what` | `related_entities` | Graph query (RLS-scoped) | **Deterministic** |
| `when` | `project_phase`, `days_to_substantial_completion`, `schedule_status`, `schedule_variance_days`, `last_user_session_at` | DB (`projects.current_phase`, `project_metrics` MV) | **Deterministic** |
| `when` | `cycle_position` | Date-arithmetic on org's pay-app calendar + OAC schedule | **Deterministic** |
| `where` | `project_id`, `project_name`, `area_id`, `area_name`, `gps_hint` | Caller / Mobile geofence | **Deterministic** |
| `where` | `weather_now`, `weather_5d_forecast` | NOAA API (cached 6h) | **Deterministic** (external) |
| `why` | `invocation_intent` | Caller invocation | **Deterministic** (caller-declared) |
| `why` | `page_intent` | Route → intent lookup table | **Deterministic** |
| `why` | `recent_query_history` | DB (`iris_sessions`, last 5 user-typed queries) | **Deterministic** |
| `why` | `pinned_context` | User pin store | **Deterministic** |

**Phase 1 has zero LLM-derived fields in the Fabric.** This is deliberate. Adding LLM-derived intent inference (e.g., "the user is drafting an RFI because the spec contradicts the drawing") is a Phase 2/3 enhancement once we have a router and a knowledge base. Phase 1 ships a fully deterministic Fabric so we can measure baseline persona divergence without LLM noise in the context layer.

### 4.6 The renderer

```ts
// src/services/iris/renderContext.ts
export function renderContext(ctx: IrisContext, persona: IrisPersonaConfig): string
```

Single function. Reads the typed object, slots in `persona.base_prompt_fragment`, then appends WHO/WHAT/WHEN/WHERE/WHY blocks in a fixed order. Never branches on caller. The output is the system prompt that flows into the AI router. Test coverage: golden snapshot per (persona × invocation) tuple.

---

## 5. Migration plan from current state

### 5.1 Phase 1a — Introduce Fabric alongside, opt-in via feature flag

- **Day 1–4 of Lap 3.** Land `iris_personas` + `iris_user_personas` migrations. Seed 5 personas. Ship `contextFabric.ts` + `renderContext.ts` + `types/context.ts`. **Feature flag:** `flags.iris_use_fabric` defaults to `false` everywhere. Edge function `iris-call` accepts a new `use_fabric: boolean` request field; when `true`, ignore caller-supplied `system=` and assemble via Fabric. When `false`, behave as today.
- **Acceptance for 1a:** Fabric builds for all 5 personas on a fixture project without errors. Goldens for each persona × each of the 6 existing draft types snap-test successfully. Token budget never exceeds ceiling on the 30 fixture calls.

### 5.2 Phase 1b — Convert RFI / submittal / daily-log surfaces to Fabric

- **Days 5–14 of Lap 3.** The three highest-volume IRIS surfaces are:
  1. RFI follow-up email drafter (`src/services/iris/templates.ts:98` `followUpEmail`)
  2. Submittal review drafter (`src/services/iris/templates.ts:419` `submittalReview`)
  3. Daily log draft (`src/services/iris/templates.ts:163` `dailyLog`)

  Convert each to call `buildContext(invocation)` instead of `buildPrompt(item, ctx, tone)`. Caller-side becomes a one-liner. Set `flags.iris_use_fabric = true` for the converted surfaces in dev → staging → 10% of pilot → 100%.
- **Parity gate:** the existing 6-template golden tests must still pass under Fabric (same input → same output, ±5% token diff allowed). Diff > 5% triggers a manual Walker review before the surface flips to Fabric in prod.
- **Acceptance for 1b:** all 3 surfaces in production using Fabric. Telemetry shows `fabric_used_pct ≥ 80%` on the converted surfaces. Acceptance rate on the converted surfaces does not drop more than 3 pp vs. the legacy baseline.

### 5.3 Phase 1c — Deprecate caller-supplied `system=`

- **Days 15–22 of Lap 3.** The `system?: string` field in `iris-call` request body becomes deprecated with a warning header. CI lint rule blocks new code from setting `system=` outside `src/services/iris/`. Existing call sites get a 30-day sunset to migrate (timed to Lap 3 close).
- **Lint rule:** `eslint-plugin-sitesync/no-raw-iris-system` — flags any `supabase.functions.invoke('iris-call', { body: { system: ... }})` outside `src/services/iris/contextFabric.ts` and `src/services/iris/legacyAdapters.ts` (the only legacy escape hatch). Severity `error`.
- **Acceptance for 1c:** `system=` removed from non-adapter call sites. Lint rule green on `main`.

### 5.4 Phase 1d — Persona override hierarchy

Per **ADR-019** (inline below):

```
workflow_override > persona_override > org_default > system_default
```

- **`workflow_override`** — the executor of a specific workflow (e.g., `LienWaiverChase`) can pin a persona regardless of the user's persona. This is to handle "the office user invoked a workflow that runs as office voice even if the user is a PM." Set per-executor in `executors/*.ts`.
- **`persona_override`** — explicit caller-supplied override (rare; used for testing and persona evals). Settable only via authenticated server-side calls.
- **`org_default`** — `iris_user_personas (org_id, user_id, project_id=NULL)` row.
- **`system_default`** — `iris_user_personas` row missing → fall back to user's `role` mapped via `role_to_default_persona` table:
  ```
  gc_pm        -> pm
  gc_super     -> superintendent
  gc_foreman   -> foreman
  owner        -> owner_rep
  owner_rep    -> owner_rep
  sub_pm       -> pm   (sub PMs use the PM persona until Phase 2 ships sub_pm)
  office       -> office
  unknown      -> pm   (with banner)
  ```

**Never user-overridable.** A user cannot "pick their own persona" from the UI — that defeats the role-conditioning. Persona is an org/project assignment; the user can request a change via the org admin.

---

## 6. Persona-conditioned dashboards (Day 1 deliverable)

### 6.1 Three dashboards live by Lap 3 close

The three dashboards that ship in Phase 1 are PM, Superintendent, and Office. Owner Rep + Foreman dashboards land in Phase 1.5 (the gap between Lap 3 close at ~T-240 and Phase 2 open at ~T-240). The cards on each dashboard are listed in §3.2; the implementation files are:

- `src/pages/HomeForPm.tsx`
- `src/pages/HomeForSuper.tsx`
- `src/pages/HomeForOffice.tsx`

The router (`src/App.tsx` or equivalent) reads the user's resolved persona via `useResolvedPersona()` (a hook that wraps `iris_user_personas` lookup) and routes `/home` to the correct page. A user with no persona assigned routes to `HomeForPm` with a top banner:

> "We've defaulted you to the Project Manager view. Your administrator can change this in Org Settings → Roles."

### 6.2 Each dashboard reads from Fabric, not from page-by-page state

This is the architectural rule. A dashboard card never reads from `useEntityStore('rfis').list` and renders its own AI suggestion locally. It reads from the Fabric:

```tsx
// Wrong (today's pattern):
function RFIsAwaitingResponseCard() {
  const rfis = useEntityStore('rfis').list({ filter: { status: 'open', overdue: true }})
  // ... render card with local state
}

// Right (Phase 1 pattern):
function RFIsAwaitingResponseCard() {
  const ctx = useIrisContext({ entity_type: null, current_page: '/home' })
  const card = useDashboardCard('rfis_awaiting_response', ctx)
  // ... render card from Fabric-derived data + actions
}
```

The Fabric becomes the read-side of the home dashboard. Stores are still the write-side (per ADR-002 — we don't merge them). The Fabric reads from the stores and assembles a coherent context graph; the dashboard reads from the Fabric.

### 6.3 Dashboard card shape

Each card is a row in `iris_dashboard_cards` (a per-persona registry) with a typed renderer:

```ts
interface DashboardCard<TData> {
  id: string                                  // 'rfis_awaiting_response'
  persona: PersonaSlug
  priority: number                            // sort order on the home page
  title: string                               // displayed title
  fetch: (ctx: IrisContext) => Promise<TData> // deterministic data fetch
  render: (data: TData) => JSX.Element
  actions: DashboardCardAction[]              // up to 3 inline actions per card
}
```

The 7-card-cap-per-persona is enforced at the dashboard level. New cards must displace existing ones; the budget forces explicit prioritization.

---

## 7. Eval / Goldens harness

### 7.1 50 paired prompts

Build a fixture project (`fixtures/persona-eval/project.json`) with 50 representative invocations spanning the 8 IRIS surface types:

- 12 RFI follow-up scenarios (overdue 1d, overdue 5d, blocked-by-spec, blocked-by-drawing, ...)
- 8 submittal review scenarios
- 8 daily log scenarios
- 8 owner update scenarios
- 6 schedule risk scenarios
- 4 lien waiver chase scenarios
- 4 cost-impact narration scenarios

Each invocation is sent through all 5 personas. **5 personas × 50 invocations = 250 outputs.**

### 7.2 Persona divergence metric

Define **persona divergence** = the fraction of invocations where the 5 outputs are pairwise meaningfully different.

- **Manual rubric (ground truth):** Walker (or a designated reviewer) labels each invocation's 5 outputs as "meaningfully different" or "cosmetically different." Meaningfully different requires at least one of: structurally different (ordering, sectioning), substantively different (different recommendation), or vocabulary-different (jobsite vs. office register, not just synonyms).
- **Automated similarity score:** cosine similarity of normalized embeddings (text-embedding-3-large) for each pair. Pairwise similarity > 0.92 = "cosmetically different"; pairwise similarity ≤ 0.92 = "meaningfully different." Validated against the manual rubric on the first 50 invocations; threshold tuned to maximize agreement.
- **Target:** ≥80% of the 50 invocations show meaningful divergence across all 5 personas (10 pairs per invocation; ≥7 pairs must be meaningful for the invocation to count). Below 80% = persona thesis is failing; halt phase exit.

### 7.3 Regression run on every PR

Add `goldens/persona/` directory with:
- 50 invocation fixtures
- 250 expected outputs (snap-tested with a tolerance for LLM nondeterminism)
- A `npm run iris:eval:persona` command that runs the harness and emits a divergence report.

CI workflow `iris-persona-eval.yml` runs nightly + on every PR that touches `src/services/iris/`. Regression below 75% divergence blocks merge.

---

## 8. Telemetry

### 8.1 Extend `iris_invocations`

The existing `iris_sessions` and `drafted_actions` telemetry from `IRIS_TELEMETRY_SPEC_2026-05-04` provides the substrate. Phase 1 adds a new table — `iris_invocations` — that records per-call Fabric metadata:

```sql
-- Migration: 20260702020000_iris_invocations.sql

CREATE TABLE iris_invocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_log_id BIGINT REFERENCES audit_log(id),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  project_id UUID REFERENCES projects(id),
  invocation_intent TEXT NOT NULL,
  persona TEXT REFERENCES iris_personas(slug),
  fabric_version TEXT NOT NULL,
  context_token_count INTEGER NOT NULL,
  slot_token_counts JSONB NOT NULL,           -- { who, what, when, where, why } -> int
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  fabric_latency_ms INTEGER NOT NULL,
  trim_log JSONB,                             -- entries from ContextMeta.trim_log
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_iris_invocations_user_persona_created
  ON iris_invocations (user_id, persona, created_at DESC);

CREATE INDEX idx_iris_invocations_project_created
  ON iris_invocations (project_id, created_at DESC)
  WHERE project_id IS NOT NULL;

ALTER TABLE iris_invocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iris_invocations: users see their own + project-scoped"
  ON iris_invocations FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = iris_invocations.project_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'owner')
    ))
  );
```

### 8.2 Dashboards

Three internal dashboards land alongside the migration:

- **Per-persona acceptance rate (Walker daily 5:30 PM standup):** `acceptance_rate(persona, 7d)` from `drafted_actions` joined to `iris_invocations` by `audit_log_id`. Surfaces the question "is the Foreman experience worse than the PM experience?"
- **Divergence rate (weekly):** rolling 7-day average of nightly persona-eval goldens divergence. Trend chart. Alert if drops below 75%.
- **Slot trim rate (weekly):** `pct_invocations_with_trim_log_nonempty(persona, slot)` — surfaces slots that consistently exceed budget (signal that the budget is too tight or the slot's underlying data is too verbose). Per-persona, per-slot.

### 8.3 Latency budget

`fabric_latency_ms` p95 ≤ **150ms**. The Fabric is on the hot path of every IRIS call; if it's slower than that, the per-page coverage thesis (Phase 4) breaks. Cache hit rate target ≥ 70% on the `iris-call` warm set. Cold-start (first call after deploy) is excluded from the p95.

---

## 9. Test plan

### 9.1 Unit tests

- **Per slot builder, isolated.** `buildWhoSlot(invocation)`, `buildWhatSlot(invocation)`, `buildWhenSlot(invocation)`, `buildWhereSlot(invocation)`, `buildWhySlot(invocation)`. Each has its own test file. ≥10 tests per slot covering null inputs, missing entity, missing project, mobile vs web, etc.
- **Goldens for each slot's render output.** Each slot's serialized prompt fragment is snap-tested.
- **Renderer:** `renderContext(ctx, persona)` golden snapshots for each (persona × representative invocation) — 5 × 6 = 30 snapshots.

### 9.2 Integration tests

- **Full Fabric run on real fixture project:** `fixtures/avery-oaks/` already exists in the codebase (per Day 30 acceptance receipt). Build an invocation per existing draft type and assert (a) all 5 slots populate, (b) no token overflow on the 30-invocation sweep, (c) renderer output is < 8K tokens per invocation, (d) deterministic — same input twice = same output.

### 9.3 RLS test cases — 50 cases

Each persona × representative entity × representative content type. Examples:

- `superintendent` querying a `change_order` → `what.related_entities` must not contain `budget.contingency_dollars`.
- `owner_rep` querying a `daily_log` → `what.entity_summary` must not contain subcontractor pay rates.
- `foreman` querying an `rfi` → `who.recent_actions` must be filtered to only the foreman's own actions, never the PM's.
- `office` querying a sub's `submittal` → permitted (office sees the contractual record).
- `pm` on a project they're not a member of → `Forbidden` at the build step (not a render-time hide).

50 cases. 100% pass required for phase exit.

### 9.4 Regression

- **50 goldens** for the 5 RFI/submittal/daily-log surfaces, **before** Fabric (legacy `system=` baseline) and **after** Fabric. Diff is allowed within 5% token count + 8% normalized-edit-distance. Outside that band = the migration broke parity; halt and re-spec.
- **Lap 2 acceptance gate metrics** (per `LAP_2_ACCEPTANCE_GATE_SPEC`) must not regress. The 4 programmatic + 1 qualitative metrics are re-run after Phase 1 lands; any regression means Phase 1 ships behind feature flag only.

---

## 10. Failure modes / edge cases

| # | Case | Behavior |
|---|---|---|
| 1 | User has no role assigned | Default to `pm` persona. Render a top-of-home banner: "We've defaulted you to Project Manager. Ask your admin to assign your role." Banner dismissible per session, not permanently. |
| 2 | Project phase indeterminate | Default to `'construction'` (a meta-phase covering substructure → finishes). Set `meta.derivation.when = 'mixed'` and append `(confidence: low)` to the rendered slot. |
| 3 | Weather feed down | Cache last-good for 6h. After 6h, drop the slot entirely (not a `null` rendering — slot omitted). Log `audit_incident('low', 'weather_feed_unavailable')`. |
| 4 | Persona conflicts with workflow | Workflow wins per ADR-019. The Fabric is rebuilt with the workflow-pinned persona. Telemetry records both `effective_persona` and `user_persona` so we can answer "how often does the workflow override the user's persona?" |
| 5 | Long-running session, entity state changes mid-conversation | Fabric refreshes on every IRIS call (cache miss on entity-state mutation per §4.4). The conversation history is preserved client-side; only the Fabric re-renders. The renderer flags state changes via a "since-last-call" diff in the rendered prompt: `[the RFI status changed from open to answered since your last message]`. |
| 6 | User pinned a context item that they no longer have access to | `pinned_context` is RLS-filtered on read. Items the user can't see are silently dropped. No error; no leak. |
| 7 | Two users in the same Org with overlapping projects but different personas | Each user's Fabric renders with their own persona. Telemetry comparing the two users on the same entity shows divergent outputs — this is correct, not a bug. |
| 8 | Mobile session with no GPS permission | `where.gps_hint = null`. The slot still renders with `area_id` if available; otherwise the slot is project-level only. |
| 9 | Pilot user (`is_soft_pilot = true`) per ADR-006 | `iris_invocations` rows for pilot users have `pilot_flag = true`. ADR-008 retention applies: 24-month with anonymization. No special Fabric behavior; pilot users run the same path. |
| 10 | Token overflow even after slot trimming | Emit `audit_incident('medium', 'fabric_overflow')` with the user_id, persona, invocation_intent, and slot sizes. Render the prompt with hard-truncated slots ordered `who → why → what` (truncate `what` last because losing entity info is the worst failure mode). |
| 11 | A user explicitly asks Iris to "act like the foreman" | **Refused.** Persona is not user-overridable. Iris responds: "I run as your assigned role for this project. Your administrator can change role assignments in Org Settings." |
| 12 | Workflow attempts to set a persona that doesn't exist for this org | Fabric falls back to `system_default` persona for the user and emits `audit_incident('low', 'unknown_persona_override')`. The workflow's specialist (Phase 2) handles this case explicitly; Phase 1 just doesn't crash. |

---

## 11. Acceptance gate (Bugatti exit)

Phase 1 is closed when **all 4** of the following are green for 7 consecutive days:

1. **≥80% of Iris calls go through Context Fabric.** Measured by `pct_invocations_with_fabric_version_set` on `iris_invocations` over the trailing 7 days.
2. **5 personas in production with ≥80% divergence on goldens.** Measured by the nightly persona-eval run; trailing-7-day rolling average.
3. **3 persona dashboards live (PM, Super, Office).** Measured by route mounted + ≥10 unique users per persona using their dashboard ≥3 times in 7 days.
4. **No regression on Lap 2 acceptance gate metrics.** The Lap 2 gate (`lap-2-acceptance.yml`) must continue to pass with all 4 programmatic metrics within their thresholds. If any metric regresses by more than the per-metric tolerance (per `LAP_2_ACCEPTANCE_GATE_SPEC`), Phase 1 stays behind the feature flag.

The gate is a CI workflow: `phase-1-acceptance.yml`. It runs the same fail-closed semantics as the Lap 2 gate. Same threshold-source-of-truth pattern.

---

## 12. Cross-references

### Builds on

- **ADR-002 (5 AI stores stay separate)** — Phase 1 does not merge stores. The Fabric is a service.
- **Phase 0 deliverables:** citations (`IRIS_CITATIONS_SPEC`), voice substrate (`IRIS_VOICE_GUIDE_SPEC`), telemetry (`IRIS_TELEMETRY_SPEC`), scheduled insights (`SCHEDULED_INSIGHTS_SPEC`). The Fabric reads telemetry; renders citations; honors voice-linter rules.

### Inputs to

- **Phase 2 (Specialist Sub-Agents):** the router consumes `IrisContext` and routes on `who.persona`, `what.entity_type`, `why.invocation_intent`. Specialists add their own scoped retrievals on top of the Fabric.
- **Phase 4 (Per-Page Coverage):** every page's Insight Slot reads from Fabric, not from page-by-page state.
- **Phase 6 (Cross-Project Memory):** `who.user_id` + `where.project_id` are the join keys for firm memory.

### ADRs created with this spec

- **ADR-019 — Persona model and override hierarchy.** Inline below in §12.1.
- **ADR-020 — Context Fabric as single retrieval entrypoint.** Inline below in §12.2.

#### 12.1 ADR-019 — Persona model and override hierarchy (inline summary)

**Decision:** Persona is `{base_prompt + tools + dashboards + voice + permissions + auto-action threshold}`. Five system-default personas. Override hierarchy: `workflow > persona-override > org-default > system-default`. **Never user-overridable.**

**Rationale:** Self-selecting personas defeat role-conditioning. A PM who picks "foreman voice because I find it more efficient" is a feature failure. Persona is an org/project assignment, like a role in any RBAC system. The workflow override exists because some workflows (e.g., lien waiver chase) have an inherent voice regardless of who triggered them.

**Consequences:**
- Org admins need a role-management UI by Lap 3 close. Scope is (assign user → persona, scoped to project or org). UI lands in `src/pages/admin/RoleAssignment.tsx`.
- A "request a persona change" UX exists for users who think they're mis-assigned: a button in the home banner that emails the org admin.
- Pilot orgs (Nexus, Carleton) get their personas assigned by Walker during Day 50 onboarding (per `SOFT_PILOT_PLAYBOOK`).

#### 12.2 ADR-020 — Context Fabric as single retrieval entrypoint (inline summary)

**Decision:** All IRIS calls assemble system context through `src/services/iris/contextFabric.ts:buildContext()`. Caller-supplied `system=` is deprecated and removed by Lap 3 close. The Fabric is the only place where WHO/WHAT/WHEN/WHERE/WHY assembly happens.

**Rationale:** Without a single entrypoint, every new IRIS feature re-invents context assembly, drifts in token budget, drifts in voice, drifts in permission scoping. The Fabric is the architectural seam that lets us add knowledge-base retrieval (Phase 3), per-page coverage (Phase 4), and firm memory (Phase 6) without touching every caller.

**Consequences:**
- A lint rule enforces the boundary in CI. `eslint-plugin-sitesync/no-raw-iris-system`.
- The Fabric is on the hot path. Latency budget p95 ≤ 150ms is part of the phase exit gate.
- Migration is gated behind a feature flag. Surfaces flip to Fabric one at a time after parity goldens pass.

---

## 13. Day-by-day breakdown

30 working days (~Lap 3 first half). Each day produces a single PR. Each row is also a tracker entry.

| Day | Theme | Deliverable | Files touched |
|---|---|---|---|
| 1 | Fabric scaffold + types | `src/services/iris/contextFabric.ts` skeleton + `types/context.ts` + `types/invocation.ts`. Empty slot builders return `null`. Renderer renders empty prompt. | `src/services/iris/` |
| 2 | `who` slot (deterministic core) | `buildWhoSlot()` populates `user_id`, `persona`, `role`, `display_name`. Joins `auth.users`, `iris_user_personas`. 12 unit tests. | `src/services/iris/slots/who.ts` |
| 3 | `who` slot (recent actions + permissions + chain) | `recent_actions` from `audit_log`. `permissions` from existing `usePermissions()` resolver. `reporting_chain` deferred to Phase 1.5 (org hierarchy table doesn't exist yet — emit empty array). | `src/services/iris/slots/who.ts` |
| 4 | `what` slot — entity core | `entity_type`, `entity_id`, `entity_state`, `current_page` from caller. `entity_summary` per-entity-type templates (RFI, submittal, daily log, CO, schedule activity). 8 unit tests. | `src/services/iris/slots/what.ts` |
| 5 | `what` slot — related entities (RLS-scoped) | `related_entities` graph query. RLS enforced at SQL level, not at app level. Test 5 RLS scenarios. | `src/services/iris/slots/what.ts` |
| 6 | `when` slot | `project_phase`, `days_to_substantial_completion`, `schedule_status` from `project_metrics` MV. `cycle_position` from org's pay-app calendar. 6 unit tests. | `src/services/iris/slots/when.ts` |
| 7 | `where` slot | `project_id`, `project_name`, `area_id` (null for now), `gps_hint` (mobile-only). Weather fetch with 6h cache. 8 unit tests. | `src/services/iris/slots/where.ts` |
| 8 | `why` slot | `invocation_intent` from caller. `page_intent` lookup table. `recent_query_history` from `iris_sessions`. `pinned_context` from user pins (PII-scrubbed at write). 8 unit tests. | `src/services/iris/slots/why.ts` |
| 9 | Renderer + token budget enforcement | `renderContext(ctx, persona)`. Token-count via `tiktoken` or equivalent. Trim logic. 12 unit tests. | `src/services/iris/renderContext.ts` |
| 10 | Caching | LRU per-invocation + per-slot cache. Realtime invalidation on entity mutation. Latency micro-benchmark — assert p95 ≤ 150ms on a 1000-call sweep. | `src/services/iris/contextFabric.ts` |
| 11 | Telemetry table + RPCs | `iris_invocations` migration + `record_iris_invocation` RPC. Wire into `iris-call` edge function. | `supabase/migrations/`, `supabase/functions/iris-call/` |
| 12 | Persona table + seed | `iris_personas` migration + 5 system personas seeded. `iris_user_personas` migration. Role-to-persona default lookup. | `supabase/migrations/` |
| 13 | Persona resolver | `useResolvedPersona()` hook + server-side `resolvePersona(user_id, project_id, workflow_override?)` function. 10 unit tests covering all 4 levels of the hierarchy. | `src/services/iris/resolvePersona.ts` |
| 14 | PM persona cutover — RFI follow-up surface | Convert `followUpEmail` template to call `buildContext()` instead of building its own prompt. Behind `flags.iris_use_fabric`. Goldens pass. | `src/services/iris/templates.ts`, `src/services/iris/legacyAdapters.ts` |
| 15 | PM dashboard scaffold | `src/pages/HomeForPm.tsx`. Reads from Fabric. 7 cards stubbed (data fetch from Fabric, render placeholder). | `src/pages/HomeForPm.tsx`, `src/components/iris/dashboard/` |
| 16 | PM dashboard cards (1–4) | RFIs awaiting response, submittals overdue, schedule slip, budget exposure. Each reads from Fabric + dispatches PermissionGate-guarded actions. | same |
| 17 | PM dashboard cards (5–7) | Drafted actions inbox, today's OAC, lookahead conflicts. | same |
| 18 | PM dashboard polish + persona telemetry | Surface impressions/clicks/dismissals to `iris_invocations`. Acceptance test: PM dashboard renders for a fixture user in <500ms cold. | same |
| 19 | Super persona cutover — daily log surface | Convert `dailyLog` template to Fabric. Super-persona voice overrides applied. Goldens pass. | `src/services/iris/templates.ts` |
| 20 | Super dashboard scaffold | `src/pages/HomeForSuper.tsx`. 6 cards stubbed. | `src/pages/HomeForSuper.tsx` |
| 21 | Super dashboard cards (1–3) | Today's crews, 14-day weather impact, open RFIs blocking field. | same |
| 22 | Super dashboard cards (4–6) | Safety walk follow-ups, daily log finalize, photos awaiting captioning. | same |
| 23 | Office persona cutover — lien waiver / pay app surfaces | Convert `submittalReview` and add new `lienWaiverChase` template (Office-scoped). Goldens pass. | `src/services/iris/templates.ts` |
| 24 | Office dashboard scaffold | `src/pages/HomeForOffice.tsx`. 6 cards stubbed. | `src/pages/HomeForOffice.tsx` |
| 25 | Office dashboard cards (1–3) | Lien waivers outstanding, certified payroll due, pay app cycle. | same |
| 26 | Office dashboard cards (4–6) | CO log delta vs. ledger, contracts awaiting countersignature, insurance expiring. | same |
| 27 | Persona-eval goldens | 50 invocation fixtures × 5 personas = 250 outputs. Manual rubric labeling (Walker, ~4h). Automated similarity threshold tuning. | `goldens/persona/` |
| 28 | Eval harness CI integration | `npm run iris:eval:persona`. CI workflow `iris-persona-eval.yml`. Block-merge below 75%. | `.github/workflows/`, `package.json` |
| 29 | Lint rule + sunset of `system=` | `eslint-plugin-sitesync/no-raw-iris-system`. CI lint rule green. Deprecation warning header in `iris-call`. | `eslint.config.js`, `supabase/functions/iris-call/` |
| 30 | Phase exit gate dry-run | Run `phase-1-acceptance.yml` end-to-end. All 4 metrics green. Day-by-day receipt: `DAY_30_PHASE_1_RECEIPT_2026-XX-XX.md`. | `docs/audits/`, tracker |

**Note:** Days 14, 19, and 23 (the persona cutovers) are the highest-risk days. Allocate Walker review the same evening. If a cutover regresses a golden by > 5% token diff, freeze, investigate, before next-day work. Per `IRIS_NATIVENESS_PLAN` §8 risk #1: cosmetic divergence is a phase-killer.

---

## 14. Risks (specific to Phase 1, beyond the parent plan)

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **Fabric latency p95 exceeds 150ms** | Medium | Per-page coverage thesis (Phase 4) breaks | Aggressive caching (per-invocation + per-slot). Profile early — Day 10 micro-benchmark is mandatory. If p95 > 150ms on a 1000-call sweep, halt and optimize before Day 11. |
| 2 | **Persona divergence is < 80% on goldens — cosmetic, not structural** | High | Phase 1 thesis fails; Walker pulls personas | Walker reviews 25 random divergence pairs personally on Day 27. If < 70% feel meaningfully different, halt and rewrite persona base prompts. Don't ship a divergence number that's hollow. |
| 3 | **Caller migration to Fabric drags past Day 22 (Phase 1c sunset)** | Medium | Lap 3 close slips | Lint rule + grep audit on Day 25; any non-adapter `system=` callers are on the kill list. Walker batch-converts the long tail himself. Sunset stays on schedule. |
| 4 | **`iris_invocations` table grows unbounded** | Low (per ADR-008 retention) | Storage cost | 12-month retention applies (ADR-008). Pilot rows: 24-month with anonymization. Daily archival job moves > 12-month rows to a cold table. |
| 5 | **Persona override hierarchy is confusing — workflow vs. user vs. org** | Medium | Bugs in production where the wrong persona ran | Telemetry surfaces `effective_persona` and `user_persona` on every invocation. Walker daily standup feed flags any case where they differ for sanity check. ADR-019 makes the hierarchy concrete. |
| 6 | **The 5 personas are wrong for some orgs** (e.g., a design-build firm with a hybrid PM/super role) | Medium | Pilot dissatisfaction | Org-level overrides via `(org_id, slug)` rows in `iris_personas`. Walker recommends Brad Cameron's super at Nexus do a Day 51 review of the persona assignments. |
| 7 | **Foreman persona requires mobile-first voice flow that doesn't exist yet** | High | Foreman dashboard is hollow at Phase 1 close | Scope: foreman dashboard ships as Phase 1.5 (between Lap 3 close and Phase 2 open). Phase 1 exit gate requires only PM, Super, Office dashboards. |
| 8 | **Owner_rep persona leaks subcontractor pay rates or contractor's contingency** | Low (with RLS), Critical (impact) | Reputation event | RLS on retrieval is enforced at SQL, not at app. 50 RLS test cases (§9.3) include all owner_rep leak vectors. Two-engineer review on owner_rep persona prompt and tool list before phase exit. |
| 9 | **Weather feed (NOAA) flakes; `where.weather_5d_forecast` is missing 6+ hours/day** | Medium | Super persona dashboard degrades | 6h last-good cache; after that, slot omitted. Telemetry alerts at >2% omission rate. Backup feed (OpenWeatherMap) standby; ADR if we switch primary. |
| 10 | **Engineer #2 not onboarded by Day 1 of Lap 3** | High (per parent plan risk #7) | Walker bottleneck; phase slips 30+ days | Engineer #2 search continues per parent plan. If still not onboarded by Lap 3 open, Walker scopes Phase 1 to PM persona only and defers Super/Office to Lap 3.5. The migration shape doesn't change; the rollout slows. |

---

*End of spec. Phase 1 opens at T-300. Engineer #2's first PR.*
