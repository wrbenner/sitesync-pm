# Phase 1 — Role Layer + Context Fabric Spec

**Date:** 2026-05-08
**Status:** DRAFT — pending ADR-019 and ADR-020 ratification; pending Engineer #2 onboarding
**Author:** Walker (drafted by Bugatti spec subagent)
**Companion docs:** `docs/audits/IRIS_NATIVENESS_PLAN_2026-05-08.md`, `docs/audits/IRIS_TELEMETRY_SPEC_2026-05-04.md`, `docs/audits/IRIS_VOICE_GUIDE_SPEC_2026-05-04.md`, `docs/audits/IRIS_CITATIONS_SPEC_2026-05-04.md`, `docs/audits/REVERSE_ENGINEERED_MILESTONES_2026-05-04.md`
**Phase:** 1 of 6 (IRIS Nativeness Plan)
**Lap:** 3
**Window:** T-300 → T-240 (≈ Jul 5 2026 → Sep 3 2026, 60 calendar days, ~9 working weeks)
**Closes pillars:** Pillar 1 (Role-Based Persona) and Pillar 2 (Context Fabric: who/what/when/where/why)
**Cost basis:** 1 engineer (Engineer #2 — net-new hire, must be onboarded before T-300) + Walker (architecture + review) + 1 designer at 30% for dashboards

---

## TL;DR

Today IRIS is a single voice ("junior project assistant for a construction project manager") with a single hardcoded preamble in `src/services/iris/templates.ts` and a brittle caller-supplied `system=` string in `supabase/functions/iris-call/index.ts` (lines 100–128). Phase 1 replaces both with (a) five persona rows in a new `iris_personas` table — `pm`, `superintendent`, `foreman`, `owner_rep`, `office` — each with its own prompt template, tool set, dashboard, and voice overrides; and (b) a single `buildContext(req)` Context Fabric entry point in `src/services/iris/contextFabric.ts` that assembles who/what/when/where/why/recent/memory before every model call. The legacy `system=` parameter is deprecated but accepted for one release window. Exit gate: ≥80% of production IRIS calls flow through Context Fabric, 125-case golden divergence suite passes at ≥80%, and 3 of 5 dashboards (`pm`, `superintendent`, `owner_rep`) ship. Foreman dashboard + voice deferred to Phase 5; Office dashboard deferred to Phase 1.5 (Sep 3 → Sep 17, optional slip).

---

## 1. Decision summary

| # | Decision | Rationale | ADR |
|---|----------|-----------|-----|
| 1.1 | Five personas, one row each in `iris_personas` | Five real seats in a construction firm; consolidating any two leaks scope (foreman ≠ super, owner_rep ≠ pm). | ADR-019 |
| 1.2 | Persona is per-user-per-org, not per-session | A user does not change roles between sessions; org admin assigns. Override available via session header for QA. | ADR-019 |
| 1.3 | Context Fabric is the SINGLE retrieval entrypoint into IRIS prompts | One choke-point makes telemetry, redaction, voice enforcement, and citation hookup trivial. | ADR-020 |
| 1.4 | `system=` parameter deprecated but accepted for one release | Avoid breaking the soft-pilot deployment at Nexus and Carleton. | ADR-020 |
| 1.5 | Persona prompts live in DB rows, not code | Allows non-engineer (Walker) to tune voice without redeploy; auditable via `iris_personas` history table. | ADR-019 |
| 1.6 | Dashboards are pages, not feature flags inside one page | A foreman opening the PM dashboard is a UX failure; routing-level split is correct. | ADR-019 |
| 1.7 | Telemetry adds `persona`, `context_fabric_version`, `context_fabric_size_kb` to `iris_sessions` | Required to prove exit gate and to track context-bloat regressions. | ADR-008 (retention applies) |
| 1.8 | Golden divergence test is the gate for "different enough" personas | Without a measurable test, persona divergence drifts to cosmetic. ≥60% divergence floor blocks merge. | ADR-019 |

---

## 2. The 5 personas

### 2.1 Persona table (top-level)

| key | seat | primary device | owns | voice | base permissions | dashboard | Phase 1 ships? |
|-----|------|----------------|------|-------|------------------|-----------|----------------|
| `pm` | Project Manager | web | schedule, budget, RFIs, submittals, OAC, COs (initiate) | precise, AIA-aware, decision-framed | full project R/W; CO initiate; pay-app initiate | `HomeForPm.tsx` | YES |
| `superintendent` | Superintendent | mobile + web | 3-week lookahead, crews, daily logs, safety, punch | tactical, terse, jobsite vernacular, no AIA jargon | full field R/W; pay-app comment; CO comment | `HomeForSuperintendent.tsx` | YES |
| `foreman` | Foreman / Lead | mobile-first | daily reports, T&M tickets, defect notes, photo-log | terse, voice-input-friendly, present-tense | crew R/W; T&M create; daily-log create | `HomeForForeman.tsx` (Phase 1.5) | NO — Phase 1.5 |
| `owner_rep` | Owner's Representative | web | progress reports, CO approvals, pay-app review, RFI visibility | outcome-framed, dollar-aware, schedule-aware | read all; approve CO; approve pay-app; cannot edit field data | `HomeForOwnerRep.tsx` | YES |
| `office` | Office / Contracts admin | web | contracts, COs (process), pay apps (process), lien waivers, insurance | documentation-grade, audit-trail-aware, citation-heavy | contract R/W; CO process; pay-app process; lien waiver R/W | `HomeForOffice.tsx` (Phase 1.5) | NO — Phase 1.5 |

### 2.2 Per-persona detail

#### 2.2.1 `pm`

- **System prompt template (DB row, version 1):**
  > You are Iris, a project manager's right hand on a construction project. You speak the language of AIA G702/G703, RFIs, submittals, schedule float, and contract change orders. You prioritize decisions over description: every response surfaces the next concrete action with owner, due date, and dollar/day impact when known. You never invent contract numbers, AIA codes, or dollar values; you cite the source row when you state them. You do not perform field actions (those are the superintendent's). When asked about field execution, you defer and suggest looping in the super.
- **Default tools (`default_tools`):** `query_schedule`, `query_budget`, `query_rfis`, `query_submittals`, `draft_co`, `draft_rfi_response`, `query_oac_minutes`, `summarize_pay_app`.
- **Dashboard layout:** Today's `Home.tsx` is the seed; renamed to `HomeForPm.tsx`. Adds a "Today's three decisions" hero card sourced from scheduled-insights (Phase 0 dependency).
- **Voice overrides (`voice_style_overrides`):** `tone: precise`, `formality: high`, `jargon_allowance: aia_full`, `hedge_word_max: 2_per_response`.
- **Permission scope template:** `org.project.*` for projects where membership rows mark them as PM; `field.read_only` for projects where they are not PM.

#### 2.2.2 `superintendent`

- **System prompt template (DB row, version 1):**
  > You are Iris, a superintendent's field assistant. You speak in short tactical sentences. You never use AIA codes, "henceforth", "pursuant to", or contract-prose voice — that's the office's job. When asked about a field issue, you anchor in the 3-week lookahead, current crew assignments, today's weather, and the active daily log. You assume the user is on a phone, possibly with one hand, possibly with hearing protection on. Bullet points over paragraphs. If a question is actually a PM/office question (CO drafting, pay-app math), say so and offer to ping the PM.
- **Default tools:** `query_lookahead`, `query_crews`, `query_daily_log`, `query_safety`, `query_weather`, `draft_daily_log`, `draft_punch_item`, `escalate_to_pm`.
- **Dashboard layout:** `HomeForSuperintendent.tsx` — single column, mobile-first. Hero card is "Today's crews + weather risk", second card is "Open punch ≤ 3 days", third is "Lookahead delta vs. last week".
- **Voice overrides:** `tone: tactical`, `formality: low`, `jargon_allowance: jobsite_only`, `bullet_preference: high`, `hedge_word_max: 0_per_response`, `sentence_length_target: ≤14_words`.
- **Permission scope template:** Field R/W; pay-app comment; CO comment; cannot initiate CO or pay-app.

#### 2.2.3 `foreman`

- **System prompt template (DB row, version 1):**
  > You are Iris, a foreman's voice-first assistant. You answer in two to four short sentences. You assume the user is dictating, gloves on, in noise. You never ask three clarifying questions in a row — you ask one, or you make the best inference and surface it for confirmation. Your default outputs are: a daily-log line, a T&M ticket draft, a defect note with photo placeholder, or a "send this to the super" relay.
- **Default tools:** `draft_daily_log_line`, `draft_tm_ticket`, `draft_defect_note`, `relay_to_super`, `query_my_crew`, `query_my_assignments`.
- **Dashboard layout:** **DEFERRED to Phase 1.5.** Phase 1 ships text-fallback chat in the existing mobile shell.
- **Voice overrides:** `tone: tactical`, `formality: low`, `jargon_allowance: jobsite_only`, `sentence_length_target: ≤10_words`, `clarifying_question_max: 1`.
- **Permission scope template:** Crew R/W; T&M create; daily-log create; cannot view budget, contract, or pay-app.

#### 2.2.4 `owner_rep`

- **System prompt template (DB row, version 1):**
  > You are Iris, an owner's representative's review assistant. You frame everything in outcomes: schedule slip in days, budget delta in dollars, scope variance against the contract baseline. You read the GC's submissions skeptically — you flag missing backup, math that doesn't reconcile, and CO justifications that lean on schedule impact without a fragnet. You never edit field data. You never see the GC's internal cost markup unless it's been disclosed in a CO. You always cite the source row when stating a dollar or a date.
- **Default tools:** `review_pay_app`, `review_co`, `query_progress`, `query_rfis_open`, `query_schedule_slip`, `flag_for_oac`, `summarize_for_owner_email`.
- **Dashboard layout:** `HomeForOwnerRep.tsx` — three columns: Open approvals (CO/pay-app), Schedule + budget at a glance, Recent owner-visible RFIs.
- **Voice overrides:** `tone: precise`, `formality: high`, `jargon_allowance: aia_full`, `dollar_emphasis: high`, `skeptical_framing: on`.
- **Permission scope template:** Read-all on projects where membership row is `owner_rep`; approve CO; approve pay-app; cannot see internal-only fields (`is_internal=true`); cannot see other owner_reps' projects.

#### 2.2.5 `office`

- **System prompt template (DB row, version 1):**
  > You are Iris, an office assistant for contracts and accounting. Your output is documentation-grade: every sentence is something that could survive a pay-app dispute or a lien hearing. You cite contract sections, CO numbers, pay-app numbers, and AIA codes by exact identifier. You never paraphrase a contract clause; you quote the exact text and cite the row. You produce drafts that are ready to be PDF-exported and signed.
- **Default tools:** `draft_co_packet`, `draft_pay_app_packet`, `query_contract`, `query_lien_waivers`, `query_insurance_status`, `verify_co_math`, `verify_pay_app_math`.
- **Dashboard layout:** **DEFERRED to Phase 1.5.**
- **Voice overrides:** `tone: precise`, `formality: very_high`, `jargon_allowance: aia_full`, `quoting_preference: verbatim_only`, `hedge_word_max: 0_per_response`.
- **Permission scope template:** Contract R/W; CO process; pay-app process; lien waiver R/W; insurance R/W.

### 2.3 Schema — `iris_personas`

```sql
-- DRAFT — review before applying
-- Migration: supabase/migrations/2026-07-05_001_iris_personas.sql

CREATE TABLE IF NOT EXISTS iris_personas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  -- NULL org_id = global default persona (the 5 seed rows)
  key             TEXT NOT NULL CHECK (key IN ('pm','superintendent','foreman','owner_rep','office')),
  version         INT  NOT NULL DEFAULT 1,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  system_prompt_template  TEXT NOT NULL,
  default_tools           JSONB NOT NULL DEFAULT '[]'::jsonb,
  dashboard_layout_id     TEXT,        -- maps to HomeFor<Persona>.tsx route
  voice_style_overrides   JSONB NOT NULL DEFAULT '{}'::jsonb,
  permission_scope_template JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES auth.users(id),
  UNIQUE (org_id, key, version)
);

CREATE INDEX idx_iris_personas_org_key_active
  ON iris_personas (org_id, key) WHERE is_active = true;

-- History table (append-only) so prompt edits are auditable
CREATE TABLE IF NOT EXISTS iris_personas_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id      UUID NOT NULL REFERENCES iris_personas(id) ON DELETE CASCADE,
  snapshot        JSONB NOT NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by      UUID REFERENCES auth.users(id),
  change_reason   TEXT
);

-- Per-user persona assignment lives on the existing org_memberships row.
-- DRAFT — confirm column does not already exist before adding:
ALTER TABLE org_memberships
  ADD COLUMN IF NOT EXISTS persona_key TEXT
    CHECK (persona_key IN ('pm','superintendent','foreman','owner_rep','office'));

CREATE INDEX IF NOT EXISTS idx_org_memberships_persona
  ON org_memberships (org_id, persona_key) WHERE persona_key IS NOT NULL;
```

Seed insert (5 global rows, `org_id = NULL`):

```sql
-- DRAFT — review before applying
INSERT INTO iris_personas (org_id, key, version, system_prompt_template, default_tools, dashboard_layout_id, voice_style_overrides, permission_scope_template)
VALUES
 (NULL, 'pm', 1, $$You are Iris, a project manager's right hand...$$, '["query_schedule","query_budget","query_rfis","query_submittals","draft_co","draft_rfi_response","query_oac_minutes","summarize_pay_app"]'::jsonb, 'HomeForPm', '{"tone":"precise","formality":"high","jargon_allowance":"aia_full","hedge_word_max":2}'::jsonb, '{"scope":"org.project.*","field":"read_only_when_not_pm"}'::jsonb),
 (NULL, 'superintendent', 1, $$You are Iris, a superintendent's field assistant...$$, '["query_lookahead","query_crews","query_daily_log","query_safety","query_weather","draft_daily_log","draft_punch_item","escalate_to_pm"]'::jsonb, 'HomeForSuperintendent', '{"tone":"tactical","formality":"low","jargon_allowance":"jobsite_only","sentence_length_target":14,"hedge_word_max":0}'::jsonb, '{"scope":"field.read_write","co":"comment_only","pay_app":"comment_only"}'::jsonb),
 (NULL, 'foreman', 1, $$You are Iris, a foreman's voice-first assistant...$$, '["draft_daily_log_line","draft_tm_ticket","draft_defect_note","relay_to_super","query_my_crew","query_my_assignments"]'::jsonb, NULL, '{"tone":"tactical","formality":"low","jargon_allowance":"jobsite_only","sentence_length_target":10,"clarifying_question_max":1}'::jsonb, '{"scope":"crew.read_write","budget":"deny","contract":"deny","pay_app":"deny"}'::jsonb),
 (NULL, 'owner_rep', 1, $$You are Iris, an owner''s representative''s review assistant...$$, '["review_pay_app","review_co","query_progress","query_rfis_open","query_schedule_slip","flag_for_oac","summarize_for_owner_email"]'::jsonb, 'HomeForOwnerRep', '{"tone":"precise","formality":"high","jargon_allowance":"aia_full","dollar_emphasis":"high","skeptical_framing":true}'::jsonb, '{"scope":"read_all_owner_visible","co":"approve","pay_app":"approve","internal_fields":"deny"}'::jsonb),
 (NULL, 'office', 1, $$You are Iris, an office assistant for contracts and accounting...$$, '["draft_co_packet","draft_pay_app_packet","query_contract","query_lien_waivers","query_insurance_status","verify_co_math","verify_pay_app_math"]'::jsonb, NULL, '{"tone":"precise","formality":"very_high","jargon_allowance":"aia_full","quoting_preference":"verbatim_only","hedge_word_max":0}'::jsonb, '{"scope":"contract.read_write","co":"process","pay_app":"process","lien_waiver":"read_write"}'::jsonb);
```

### 2.4 Override hierarchy (per ADR-019)

```
runtime resolved persona =
  1. session header `x-iris-persona-override`  (QA + dev only; gated by `is_qa_user`)
  2. workflow-scoped override                  (e.g. drafting a CO forces office voice for that single call)
  3. org-specific persona row                  (org_id = current org, key = user's persona_key, is_active = true)
  4. global default persona row                (org_id IS NULL, key = user's persona_key)
  5. fallback to `pm`                          (logged as `persona_fallback=true`)
```

---

## 3. Context Fabric — schema + builder

### 3.1 Type definitions

```typescript
// src/services/iris/contextFabric.ts

export interface IrisRequest {
  user_id: string;
  org_id: string;
  project_id?: string;
  entity_type?: 'rfi' | 'submittal' | 'co' | 'pay_app' | 'daily_log' | 'punch' | 'task' | 'doc';
  entity_id?: string;
  workflow?: string;          // e.g. 'co.drafting', 'pay_app.review'
  user_message: string;
  persona_override?: PersonaKey;
  legacy_system?: string;     // DEPRECATED — accepted for one release, logged
}

export interface IrisContext {
  who: {
    user_id: string;
    role: PersonaKey;
    persona: PersonaRecord;
    project_membership: Array<{ project_id: string; role: PersonaKey; is_internal: boolean }>;
    reporting_chain: Array<{ user_id: string; role: PersonaKey; relation: 'reports_to' | 'manages' }>;
  };
  what: {
    entity_type?: string;
    entity_id?: string;
    entity_data?: Record<string, unknown>;
    related_entities: Array<{ type: string; id: string; relation: string; summary: string }>;
  };
  when: {
    project_stage: 'preconstruction' | 'mobilization' | 'construction' | 'closeout' | 'warranty';
    day_in_cycle: number;                  // day-in-billing-cycle for pay-app sensitivity
    near_milestone: Array<{ name: string; date: string; days_out: number }>;
    weather_horizon: Array<{ date: string; risk: 'low' | 'med' | 'high'; reason: string }>;
  };
  where: {
    project_id?: string;
    area_id?: string;
    gps?: { lat: number; lon: number; accuracy_m: number };
    jobsite_or_office: 'jobsite' | 'office' | 'unknown';
  };
  why: {
    intent_inference: string;              // single-line classifier output
    recent_actions: Array<{ ts: string; action: string; entity?: string }>;
    current_workflow?: string;
  };
  recent: {
    last_5_pages: Array<{ ts: string; route: string }>;
    last_5_iris_actions: Array<{ ts: string; action: string; entity?: string }>;
    last_5_drafts: Array<{ ts: string; entity_type: string; entity_id: string; status: string }>;
  };
  memory: {
    user_voice_prefs: Record<string, unknown>;     // from voice_style_overrides + hand-edits (Phase 3)
    firm_playbook_excerpts: Array<{ source: string; text: string }>;  // ≤ 5, ≤ 200 words each
    project_vocab: Record<string, string>;         // e.g. { "the slab": "Level 2 deck pour 2026-08-12" }
  };
  meta: {
    fabric_version: string;                // semver, e.g. "1.0.0"
    fabric_size_kb: number;                // total serialized size
    redactions_applied: string[];          // e.g. ["internal_cost_markup_for_owner_rep"]
    build_ms: number;
  };
}

export async function buildContext(req: IrisRequest): Promise<IrisContext> {
  // 1. Resolve persona via override hierarchy
  // 2. Parallel-fetch the seven sub-contexts (who/what/when/where/why/recent/memory)
  // 3. Apply persona-scoped redaction (e.g. internal_cost_markup hidden from owner_rep)
  // 4. Apply size budget: 32 KB hard cap per fabric, drop lowest-priority sub-blocks first
  //    Drop order: memory.firm_playbook_excerpts -> recent.last_5_drafts -> when.weather_horizon
  // 5. Stamp meta and return
  // 6. Log fabric_size_kb + build_ms to iris_sessions
}
```

### 3.2 Size budget

| Block | Soft cap | Hard cap | Drop priority (1=drop first) |
|-------|---------:|---------:|-----------------------------:|
| who | 1 KB | 2 KB | 6 |
| what | 4 KB | 8 KB | 7 (never drop) |
| when | 2 KB | 4 KB | 4 |
| where | 0.5 KB | 1 KB | 5 |
| why | 1 KB | 2 KB | 6 |
| recent | 4 KB | 6 KB | 3 |
| memory | 8 KB | 12 KB | 1 |
| **total** | **20.5 KB** | **32 KB** | — |

If hard cap exceeded after all soft drops, log `fabric_overflow=true` and trim `memory.firm_playbook_excerpts` to the top-2 by relevance score.

### 3.3 Redaction rules (persona-scoped)

| Persona | Hidden from `what.entity_data` | Hidden from `memory` | Hidden from `recent` |
|---------|-------------------------------|----------------------|----------------------|
| pm | — | — | — |
| superintendent | budget cost rollups (line-item OK) | firm_playbook financial sections | — |
| foreman | all budget; all contract; all pay-app | all financial playbook excerpts | other crews' actions |
| owner_rep | internal_cost_markup; internal-only RFI threads (`is_internal=true`); GC labor burden | GC-internal playbook | other GCs' actions |
| office | — | — | — |

Redactions logged as strings into `meta.redactions_applied` for audit.

---

## 4. Persona-routing middleware

### 4.1 Where it lives

`supabase/functions/iris-call/index.ts`. Today, lines 100–128 accept `system=` from the caller and forward it to the model. New flow:

```typescript
// supabase/functions/iris-call/index.ts (new shape)

import { buildContext } from '../_shared/contextFabric.ts';
import { resolvePersona } from '../_shared/persona.ts';
import { assemblePrompt } from '../_shared/promptAssembly.ts';

serve(async (req) => {
  const body = await req.json();
  const userId = await getUserIdFromJwt(req);

  // Persona resolution (deterministic — never call the model to pick persona)
  const persona = await resolvePersona({
    user_id: userId,
    org_id: body.org_id,
    workflow: body.workflow,
    override: req.headers.get('x-iris-persona-override'),
  });

  // Context Fabric
  const ctx = await buildContext({
    user_id: userId,
    org_id: body.org_id,
    project_id: body.project_id,
    entity_type: body.entity_type,
    entity_id: body.entity_id,
    workflow: body.workflow,
    user_message: body.message,
    persona_override: persona.key,
    legacy_system: body.system,   // DEPRECATED
  });

  if (body.system) {
    // Telemetry: track legacy callers so we can migrate them
    logEvent('iris_legacy_system_used', { user_id: userId, route: body.route });
  }

  // Permission enforcement at the tool layer (not the prompt layer)
  const tools = filterToolsByScope(persona.default_tools, persona.permission_scope_template, ctx);

  // Prompt assembly — single function, single source of truth
  const prompt = assemblePrompt({
    persona,                // system_prompt_template + voice overrides
    context: ctx,           // structured fabric, not stringified
    user_message: body.message,
    tools,
  });

  // Model call (existing path)
  const result = await callModel(prompt, tools);

  // Persist iris_session row (telemetry — see §6)
  await persistSession({
    user_id: userId,
    persona: persona.key,
    context_fabric_version: ctx.meta.fabric_version,
    context_fabric_size_kb: ctx.meta.fabric_size_kb,
    legacy_system_used: !!body.system,
    /* …existing columns… */
  });

  return new Response(JSON.stringify(result));
});
```

### 4.2 Deprecation timeline for `system=`

| Window | Behavior |
|--------|----------|
| T-300 → T-285 (Jul 5–20) | `system=` accepted; warning logged once per session |
| T-285 → T-260 (Jul 20–Aug 14) | `system=` accepted; in-app banner to engineers using it; metric `iris_legacy_system_used` exposed in dashboard |
| T-260 → T-245 (Aug 14–29) | `system=` accepted only for QA users; non-QA gets HTTP 410 with migration link |
| T-245 onward | `system=` removed; build fails if any caller still passes it (lint rule) |

---

## 5. Dashboard scope + design

### 5.1 Routes and files

| Persona | Route | File | Status |
|---------|-------|------|--------|
| pm | `/home` (today's default) | `src/pages/HomeForPm.tsx` | Phase 1 |
| superintendent | `/home` (persona-routed) | `src/pages/HomeForSuperintendent.tsx` | Phase 1 |
| owner_rep | `/home` (persona-routed) | `src/pages/HomeForOwnerRep.tsx` | Phase 1 |
| foreman | `/home` (persona-routed) | `src/pages/HomeForForeman.tsx` | Phase 1.5 |
| office | `/home` (persona-routed) | `src/pages/HomeForOffice.tsx` | Phase 1.5 |

A single `src/pages/HomeRouter.tsx` reads the resolved persona from `useAuthStore` + `org_memberships.persona_key` and renders the right page. Falls back to `HomeForPm` with a banner if persona is null.

### 5.2 Component reuse

All dashboards reuse:

- `<HeroDecisionsCard />` (from scheduled-insights, Phase 0)
- `<RecentIrisActions />` (from `recent.last_5_iris_actions`)
- `<PermissionGate>` wrappers (mandatory per Sprint Invariant #5)

Persona-unique components:

- `pm`: `<OacReadinessCard />`, `<RfiAgingCard />`, `<BudgetVarianceCard />`
- `superintendent`: `<TodayCrewsWeather />`, `<LookaheadDeltaCard />`, `<OpenPunchCard />`
- `owner_rep`: `<ApprovalsQueue />`, `<ScheduleBudgetGlance />`, `<OwnerVisibleRfis />`

### 5.3 Designer scope

30% of one designer for 9 weeks. Deliverables: 3 hi-fi Figma frames + 3 mobile-responsive variants + design tokens for persona-specific accent colors (PM = today's blue; Super = jobsite orange; Owner = neutral graphite).

---

## 6. Telemetry extensions

### 6.1 Schema delta

```sql
-- DRAFT — review before applying
-- Migration: supabase/migrations/2026-07-05_002_iris_sessions_persona_columns.sql

ALTER TABLE iris_sessions
  ADD COLUMN IF NOT EXISTS persona TEXT
    CHECK (persona IN ('pm','superintendent','foreman','owner_rep','office')),
  ADD COLUMN IF NOT EXISTS context_fabric_version TEXT,
  ADD COLUMN IF NOT EXISTS context_fabric_size_kb NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS legacy_system_used BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS persona_fallback BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fabric_overflow BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redactions_applied TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_iris_sessions_persona ON iris_sessions (persona);
CREATE INDEX IF NOT EXISTS idx_iris_sessions_legacy ON iris_sessions (legacy_system_used) WHERE legacy_system_used = true;
```

### 6.2 Matview update (per IRIS_TELEMETRY_SPEC_2026-05-04.md §4)

```sql
-- DRAFT — review before applying
DROP MATERIALIZED VIEW IF EXISTS iris_telemetry_daily CASCADE;

CREATE MATERIALIZED VIEW iris_telemetry_daily AS
SELECT
  date_trunc('day', created_at) AS day,
  org_id,
  persona,
  count(*) AS sessions,
  count(*) FILTER (WHERE legacy_system_used) AS legacy_sessions,
  count(*) FILTER (WHERE persona_fallback) AS fallback_sessions,
  count(*) FILTER (WHERE fabric_overflow) AS overflow_sessions,
  avg(context_fabric_size_kb) AS avg_fabric_kb,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY context_fabric_size_kb) AS p95_fabric_kb,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY context_fabric_size_kb) AS p99_fabric_kb
FROM iris_sessions
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX ON iris_telemetry_daily (day, org_id, persona);
```

### 6.3 Required dashboards (Grafana / Supabase Studio)

1. **Context Fabric adoption**: `1 - (legacy_sessions / sessions)` per day, target ≥ 0.80 by T-240.
2. **Fabric size distribution**: avg / p95 / p99 per persona; alert if p95 > 24 KB.
3. **Persona mix**: count per persona per day; sanity-check that owner_rep ≠ 0 once Nexus is onboarded.
4. **Fallback rate**: `fallback_sessions / sessions` — alert if > 0.05 (means persona_key is missing on memberships).

---

## 7. Test plan

### 7.1 Unit

- `contextFabric.test.ts`: 18 cases covering every redaction rule, every drop-priority path, the 32 KB hard cap, and the `legacy_system` shim.
- `persona.test.ts`: 10 cases covering the 5-step override hierarchy.
- `promptAssembly.test.ts`: snapshot tests for each persona × 3 entity types = 15 snapshots.

### 7.2 Integration

- `iris-call.integration.test.ts`: hits the deployed edge function in a staging project. Verifies `iris_sessions` row gets `persona`, `context_fabric_version`, `context_fabric_size_kb` populated.

### 7.3 Golden divergence test (the gate)

**Goal:** prove the 5 personas produce *measurably different* responses for the same input. Without this gate, persona drift to cosmetic is the default failure mode.

**Setup:**

- 25 scenarios (5 each from RFI, schedule, budget, daily-log, CO domains).
- Each scenario is a `{ user_message, entity, project_state }` triple.
- Run each scenario through all 5 personas → 125 outputs.
- Use a deterministic seed; record the output corpus to `tests/iris/goldens/persona_divergence_v1/`.

**Divergence metric:** for each scenario, compute pairwise normalized Levenshtein distance across the 5 outputs. Average those 10 pairwise distances per scenario. A scenario "passes divergence" if the average is ≥ 0.60.

**Pass condition:** ≥ 80% of scenarios (≥ 20 of 25) pass divergence at the ≥ 0.60 floor.

```typescript
// tests/iris/personaDivergence.test.ts (sketch)

import { scenarios } from './fixtures/persona_scenarios.json';
import { runPersona } from './harness/runPersona';
import { normalizedLevenshtein } from './harness/lev';

const PERSONAS = ['pm','superintendent','foreman','owner_rep','office'] as const;
const DIVERGENCE_FLOOR = 0.60;
const PASS_RATE_FLOOR = 0.80;

it('persona divergence ≥ 60% on ≥ 80% of scenarios', async () => {
  let passed = 0;
  for (const s of scenarios) {
    const outs = await Promise.all(PERSONAS.map(p => runPersona(p, s)));
    const dists: number[] = [];
    for (let i = 0; i < outs.length; i++)
      for (let j = i+1; j < outs.length; j++)
        dists.push(normalizedLevenshtein(outs[i], outs[j]));
    const avg = dists.reduce((a,b)=>a+b,0) / dists.length;
    if (avg >= DIVERGENCE_FLOOR) passed++;
  }
  expect(passed / scenarios.length).toBeGreaterThanOrEqual(PASS_RATE_FLOOR);
});
```

**False-positive guard:** the test ALSO verifies that for 5 *control* scenarios (e.g. "What time is it?") divergence is ≤ 0.30, otherwise the metric is too noisy.

### 7.4 E2E

- Playwright: PM logs in → sees `HomeForPm`. Super logs in → sees `HomeForSuperintendent`. Owner_rep logs in → sees `HomeForOwnerRep`. PermissionGate audit (`scripts/audit-permission-gate.mjs`) passes on all three new pages.

### 7.5 Regression

- Snapshot tests on prompt assembly run on every PR.
- Divergence test runs nightly + on any PR touching `src/services/iris/` or `supabase/functions/iris-call/` or `supabase/functions/_shared/`.

---

## 8. Migration order

| Step | Day (relative) | Action | Owner | Reversible? |
|------|---------------:|--------|-------|-------------|
| 1 | T-300 (Day 1) | Apply `iris_personas` + history table migration; seed 5 global rows | Eng #2 | YES (drop migration) |
| 2 | T-298 | Add `persona_key` column on `org_memberships`; backfill PMs | Eng #2 | YES |
| 3 | T-296 | Ship `contextFabric.ts` + `resolvePersona()` + `assemblePrompt()` behind feature flag `iris.context_fabric=false` | Eng #2 | YES (flag) |
| 4 | T-290 | Apply `iris_sessions` telemetry columns migration | Eng #2 | YES |
| 5 | T-285 | Update matview; ship Grafana dashboards | Eng #2 + Walker | YES |
| 6 | T-280 | Flip flag to `true` for internal users only | Walker | YES |
| 7 | T-275 | Flip flag for soft-pilot orgs (Nexus, Carleton) | Walker | YES |
| 8 | T-270 | Flip flag for all users; `system=` warning banner on | Walker | YES |
| 9 | T-265 | Ship `HomeRouter.tsx` + `HomeForPm.tsx` (rename existing) | Eng #2 + Designer | YES |
| 10 | T-260 | Ship `HomeForSuperintendent.tsx` | Eng #2 + Designer | YES |
| 11 | T-255 | Ship `HomeForOwnerRep.tsx` | Eng #2 + Designer | YES |
| 12 | T-250 | Lock golden divergence suite; baseline snapshots committed | Eng #2 + Walker | partial |
| 13 | T-245 | `system=` 410 for non-QA | Eng #2 | YES (revert) |
| 14 | T-240 | Exit gate measurement; if green, declare Phase 1 done | Walker | n/a |

Slip path: if T-260 misses, drop Owner_rep dashboard to Phase 1.5; do NOT compromise the golden divergence test.

---

## 9. Risks + mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Engineer #2 doesn't onboard in time for T-300 | Med | Critical — blocks Phase 1 entirely | Walker drafts the migrations, Context Fabric stub, and persona seed before Eng #2 starts (week of Jun 22). Eng #2's Day 1 task is not greenfield. |
| R2 | Persona divergence is cosmetic, not functional | High | High — defeats the purpose | Golden divergence test at 60%/80% floor; CI-blocking. If it fails, prompts get rewritten until it passes. |
| R3 | Owner_rep sees data they should not (cost markup, internal RFIs) | Low | Critical — privacy/contract breach | Redaction enforced in Context Fabric layer (not at prompt). Unit tests for every redaction rule. RLS policies on `is_internal=true` rows as second line of defense. |
| R4 | Foreman voice flow is hard, slips into Phase 1 | High if attempted | Med | Foreman dashboard explicitly Phase 1.5; voice explicitly Phase 5. Phase 1 ships text-fallback only. |
| R5 | `system=` deprecation breaks soft-pilot mid-sprint | Med | High | Deprecation timeline (§4.2) gives a 60-day window with warnings before HTTP 410. Soft pilot is informed at T-285. |
| R6 | Context Fabric size blows past 32 KB regularly | Med | Med — slow + costly | Drop-priority logic + p95/p99 dashboards + alert at 24 KB p95. |
| R7 | `org_memberships.persona_key` backfill is wrong | Med | Med | Backfill ships in a transaction with a verification query; any user with NULL `persona_key` after backfill is logged and emailed Walker for manual assignment. |
| R8 | Workflow-level overrides leak into wrong persona | Low | Med | Override is request-scoped, never persisted. Unit tests on resolver. |
| R9 | DB-stored prompts get edited carelessly and break production | Med | High | `iris_personas_history` audit table; only Walker has UPDATE on `iris_personas` in production; staging-first edit workflow. |
| R10 | Persona regression suite cost (model calls × 125) is too expensive to run on every PR | Med | Low | Run nightly + on iris-touching PRs only. Cost ≈ 125 × $0.02 ≈ $2.50/run; acceptable. |

---

## 10. Edge cases

| # | Edge case | Behavior |
|---|-----------|----------|
| E1 | User has no `persona_key` set on `org_memberships` | Resolver returns `pm` with `persona_fallback=true` logged. Banner on dashboard prompts admin to assign. |
| E2 | User belongs to two orgs with different personas | Persona is per-org; current org context (`useAuthStore.currentOrgId`) drives resolution. |
| E3 | User switches org mid-session | IRIS session ID rotates; new fabric built; persona re-resolved. No carryover of `recent.*`. |
| E4 | QA user sets `x-iris-persona-override: foreman` while logged in as PM | Override accepted only if `is_qa_user=true`; logged with `persona_override=true` flag. |
| E5 | Foreman opens an entity they shouldn't see (URL hack) | RLS denies at DB; Context Fabric receives empty `entity_data`; persona prompt instructs polite "you don't have access" response. |
| E6 | Owner_rep asks about internal cost markup | Redaction strips field from `entity_data`; persona prompt instructs "I don't see that data; ask the GC." |
| E7 | Context Fabric exceeds 32 KB hard cap | Drop-priority sequence runs; if still over, `memory.firm_playbook_excerpts` truncated; `fabric_overflow=true` logged. |
| E8 | Legacy caller sends both `system=` and uses Context Fabric (impossible by design but defensive) | `system=` is ignored; warning logged; Context Fabric wins. |
| E9 | Persona row deactivated (`is_active=false`) mid-session | Cached persona for the in-flight session continues; next session re-resolves and falls back to global. |
| E10 | Two active versions of same persona for same org (constraint should prevent) | Unique partial index `(org_id, key) WHERE is_active=true` blocks at DB level. Migration test verifies. |
| E11 | A persona's `default_tools` references a tool that's been deleted | Tool registry resolver drops unknown tools, logs `iris_unknown_tool`. Prompt assembly continues. |
| E12 | `weather_horizon` API is down | `when.weather_horizon=[]`; persona prompt unaffected; logged as `weather_unavailable`. |
| E13 | Project has no `project_stage` field populated | Defaults to `'construction'`; logged for backfill. |
| E14 | User on jobsite WiFi, GPS denied | `where.gps=undefined`, `where.jobsite_or_office='unknown'`; persona prompt unaffected. |
| E15 | `iris_personas.system_prompt_template` is empty string after a bad edit | Pre-flight assertion in `resolvePersona`: throws and falls back to global persona; Walker emailed. |

---

## 11. Exit gate

### 11.1 Quantitative criteria

| # | Metric | Floor | Source |
|---|--------|-------|--------|
| EG1 | % of IRIS calls through Context Fabric (vs `legacy_system_used`) | ≥ 80% over a rolling 7-day window ending T-240 | `iris_telemetry_daily` |
| EG2 | Golden divergence pass rate | ≥ 80% of 25 scenarios at ≥ 0.60 floor | `tests/iris/personaDivergence.test.ts` |
| EG3 | Personas live | 5 of 5 in DB; 3 of 5 dashboards (`pm`, `superintendent`, `owner_rep`) live | manual + Playwright E2E |
| EG4 | Fabric overflow rate | ≤ 1% of sessions | `iris_telemetry_daily.overflow_sessions / sessions` |
| EG5 | Persona fallback rate | ≤ 5% of sessions | `iris_telemetry_daily.fallback_sessions / sessions` |
| EG6 | Typecheck | green (zero errors on `tsconfig.app.json` and `tsconfig.node.json`) | CI |
| EG7 | PermissionGate audit | passes on all 3 new dashboards | `scripts/audit-permission-gate.mjs` |
| EG8 | No `system=` from non-QA callers | 0 in last 24h before T-240 | `iris_sessions.legacy_system_used` |

### 11.2 CI workflow stub

```yaml
# .github/workflows/phase1-exit-gate.yml — DRAFT
name: Phase 1 Exit Gate
on:
  schedule:
    - cron: '0 6 * * *'   # nightly 06:00 UTC
  workflow_dispatch:

jobs:
  exit-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Permission gate audit (3 new dashboards)
        run: node scripts/audit-permission-gate.mjs --pages HomeForPm,HomeForSuperintendent,HomeForOwnerRep

      - name: Persona divergence (golden suite)
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: npm run test -- tests/iris/personaDivergence.test.ts

      - name: Telemetry adoption check
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: node scripts/check-fabric-adoption.mjs --floor 0.80 --window 7d

      - name: Fabric overflow + fallback rates
        run: node scripts/check-fabric-health.mjs --overflow-max 0.01 --fallback-max 0.05

      - name: Block-on-fail
        if: failure()
        run: |
          echo "::error::Phase 1 Exit Gate failed — see logs"
          exit 1
```

`scripts/check-fabric-adoption.mjs` (DRAFT): SELECTs from `iris_telemetry_daily`, sums `sessions` and `legacy_sessions` over 7 days, asserts `1 - legacy/sessions ≥ 0.80`.

---

## 12. Dependencies + sequencing

### 12.1 Must be done before Phase 1 starts (T-300)

1. **Phase 0 closeout (Lap 2 acceptance gate green).** Phase 1 cannot start while Lap 2 is red. Per `LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md`.
2. **Engineer #2 onboarded.** Per `REVERSE_ENGINEERED_MILESTONES_2026-05-04.md`, this is the critical-path long-lead. Hire by T-330 (≈ Jun 5 2026); 30-day onboarding complete by T-300.
3. **ADR-019 ratified** (`docs/audits/ADR_019_PERSONA_MODEL_AND_OVERRIDE_HIERARCHY_2026-05-08.md` — to be drafted next).
4. **ADR-020 ratified** (`docs/audits/ADR_020_CONTEXT_FABRIC_SINGLE_RETRIEVAL_ENTRYPOINT_2026-05-08.md` — to be drafted next).
5. **Designer 30% allocated** for the 9-week window.

### 12.2 What Phase 1 unblocks

- **Phase 2** (Memory + project_vocab): plugs into `memory.project_vocab` slot already reserved.
- **Phase 3** (Voice corpus + linter): plugs into `voice_style_overrides` already loaded by persona.
- **Phase 4** (Citations side panel): citations are persona-aware (office cites contract sections; super cites daily-log lines); needs persona resolution.
- **Phase 5** (Foreman voice): needs the foreman persona row + scope template already in place.

### 12.3 Sequencing inside Phase 1

```
T-300 ────── T-285 ────── T-270 ────── T-255 ────── T-240
  │            │            │            │            │
  Schema       Fabric       PM home      Super home   EXIT
  + seeds      + middleware + flag-on    + Owner home GATE
               + telemetry  + soft-pilot + divergence
                            cohort       suite locked
```

---

## 13. What to do next

If you are Engineer #2 reading this on Day 1 of Phase 1:

1. Read this spec end-to-end. Then read `docs/audits/IRIS_TELEMETRY_SPEC_2026-05-04.md` and `docs/audits/IRIS_NATIVENESS_PLAN_2026-05-08.md`.
2. Pull the latest main. Run `npm run typecheck`. It must be zero errors. If not, halt and ping Walker.
3. Open `supabase/functions/iris-call/index.ts` lines 100–128. That is the surface area you are replacing.
4. Open `src/services/iris/templates.ts`. That is the file the persona DB rows replace.
5. Branch: `phase-1/role-layer-context-fabric`. First PR: migration + seed only. Run locally. Verify 5 rows. Merge.
6. Second PR: `contextFabric.ts` skeleton (no model integration yet) + 18 unit tests. Merge.
7. Third PR: `resolvePersona()` + `assemblePrompt()` + integration into `iris-call` behind `iris.context_fabric=false` flag. Merge.
8. Fourth PR: telemetry columns + matview + Grafana JSON. Merge.
9. Fifth PR: flip flag for internal users; observe `iris_telemetry_daily` for 48h. Merge.
10. Sixth–eighth PRs: dashboards, in this order: `HomeForPm` (rename only) → `HomeForSuperintendent` → `HomeForOwnerRep`.
11. Ninth PR: golden divergence test fixtures + harness + nightly CI. Merge.
12. Tenth PR: deprecation of `system=` (HTTP 410 for non-QA). Merge at T-245.
13. T-240: run the exit gate workflow manually. If green, write `DAY_<n>_PHASE_1_RECEIPT_2026-09-03.md` summarizing closure. If red, file a slip note and hand back to Walker.

**Sprint Invariant reminder:** every action button on the new dashboards must be wrapped in `<PermissionGate>`. The CI gate runs `scripts/audit-permission-gate.mjs` and will block the merge.

**Money math reminder:** the owner_rep dashboard surfaces dollars. All math goes through `src/types/money.ts` (`addCents`, `multiplyCents`, etc.). No raw `*` or `+` on dollar `number`s.

**Tracker reminder:** when Phase 1 closes, update `SiteSync_90_Day_Tracker.xlsx` (or its Lap 3 successor). Status `✓`, note: "Phase 1 Role Layer + Context Fabric closed: 5 personas live, 3/5 dashboards live, golden divergence pass rate <X>%, Context Fabric adoption <Y>%."

---

*End of Phase 1 spec. Companion ADRs (ADR-019, ADR-020) to follow before T-300.*
