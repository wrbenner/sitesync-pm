# ADR-019 — Persona Model and Override Hierarchy

**Date:** 2026-05-08
**Status:** Accepted (in advance of Phase 1 open)
**Decider:** Walker
**Related:** `IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md`, `IRIS_NATIVENESS_PLAN_2026-05-08.md`, `ADR_020_CONTEXT_FABRIC_AS_RETRIEVAL_ENTRYPOINT_2026-05-08.md`

---

## Decision

A **persona** is a complete operating profile — not a label. It consists of:

1. Base prompt fragment (system prompt content)
2. Tool allow-list
3. Default home dashboard cards
4. Voice / tone modifier
5. Suggestion frequency default
6. Auto-action threshold (which actions can auto-execute, which require approval)

SiteSync ships **5 personas**: `pm`, `superintendent`, `foreman`, `owner_rep`, `office`.

Personas are **assigned by the org admin at user provisioning**, propagated through Supabase auth metadata, and read by the Context Fabric at every IRIS invocation. They are **never** user-overridable.

The override hierarchy is:

```
workflow > persona-override > org-default > system-default
```

Where:
- `workflow` = a specific UX flow can pin a persona for that flow (e.g., "draft owner update" pins `owner_rep` lens regardless of caller's persona). One direction only — workflows tighten, never loosen.
- `persona-override` = a project-scoped admin can pin a different persona for that project (rare; e.g., a PM acting as super on a specific job).
- `org-default` = the user's default persona at the org.
- `system-default` = `pm` (most-common starting point).

---

## Why personas are not user-overridable

Three options were considered:

| Option | What happens | Pros | Cons |
|---|---|---|---|
| User picks persona at chat | Chat dropdown: "Talk to Iris as: PM / Super / …" | UX flexibility | Personas become cosmetic. The user picks "Owner" lens to get summary, then misses the operational risk the PM lens would surface. Permission risk: user "previews as Owner" and sees what Owner shouldn't expose later. |
| Workflow-locked persona | Each workflow pins a persona | Unambiguous | Foreman flow always gets foreman lens — correct, but no user adaptation across pages. |
| **Org-assigned, workflow-tightening** ✅ | Admin assigns persona at provisioning; workflows can tighten (e.g., daily-log flow pins foreman); user never overrides | Persona is structurally meaningful. Permissions and dashboards aligned. Workflow can still tighten to a specific lens for a specific task. | One more admin step at user setup. |

Persona is a **property of the user's role at the org**, not a UI preference. Letting users pick personas would mean personas are advisory, which is what we ruled out — because the dashboards, suggestion sets, and auto-action thresholds derived from persona become incoherent if the persona is the user's whim.

---

## The 5 personas declared

| Persona | Tool allow-list | Default dashboard cards | Voice modifier | Suggestion freq | Auto-action threshold |
|---|---|---|---|---|---|
| **pm** | Drafter, Money (read), Schedule, Code, Historian | RFI inbox, CO ledger, schedule risk, weekly digest | "professional, structured, citation-led" | medium | confidence ≥ 0.8 + cancel-window |
| **superintendent** | Drafter, Schedule, Field (mobile), Code | Today's lookahead, weather, crew gaps, daily log queue | "direct, jobsite-tone, time-boxed" | high | confidence ≥ 0.85 + cancel-window |
| **foreman** | Field (voice + photo), Drafter (limited) | Voice capture entry, photo gallery, today's tasks | "extremely direct, short sentences" | high | confidence ≥ 0.9 + cancel-window |
| **owner_rep** | Drafter (summaries), Code, Historian (read) | Project dashboard, weekly summary, milestone tracker | "exec brief, no-jargon" | low | manual approval only (no auto-action) |
| **office** | Money, Drafter (billing), Schedule (read), Code | Pay app status, CO log delta vs ledger, sub COIs expiring | "precise, dollar-grounded, audit-trail-led" | medium | confidence ≥ 0.85 for billing; manual otherwise |

Each persona has a base prompt fragment in `src/services/iris/personas/<name>.ts`. The Context Fabric assembles the full system prompt from `(systemBase) + (persona.base) + (workflow.tightening ?? '')`.

---

## Mechanics

### Storage

```sql
ALTER TABLE auth.users
  ADD COLUMN persona_default text NOT NULL DEFAULT 'pm';

CREATE TABLE project_persona_overrides (
  user_id uuid REFERENCES auth.users(id),
  project_id uuid REFERENCES projects(id),
  persona_override text NOT NULL,
  set_by uuid REFERENCES auth.users(id),
  set_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);

-- RLS: only org admins (per existing project_members.role) can write to this table.
```

Persona is read at every Context Fabric build:

```ts
async function getEffectivePersona(userId, projectId, workflowId) {
  if (workflowId && WORKFLOW_PERSONA_PIN[workflowId]) return WORKFLOW_PERSONA_PIN[workflowId];
  const override = await selectProjectPersonaOverride(userId, projectId);
  if (override) return override;
  const user = await selectUser(userId);
  return user.persona_default ?? 'pm';
}
```

### Workflow tightening

```ts
const WORKFLOW_PERSONA_PIN: Record<WorkflowId, Persona> = {
  'daily-log-foreman-voice': 'foreman',
  'owner-weekly-summary': 'owner_rep',
  'co-pricing-attach': 'office',  // even if invoked from PM context
  // … per workflow as added
};
```

### Suggestion frequency

```ts
type SuggestionFrequency = 'low' | 'medium' | 'high';
// Translates to: max insights per page, brief frequency, push notification cadence
```

User can adjust frequency one step (low ↔ medium ↔ high) without changing persona. Frequency is the **only** persona-derived field user-tunable.

---

## Telemetry

`iris_invocations.persona`, `iris_invocations.persona_source` (org_default | project_override | workflow_pin | system_default), `iris_invocations.frequency_pref` recorded on every call.

Dashboards: per-persona acceptance rate, divergence rate (Phase 1 eval), workflow-pin override rate.

---

## Test plan

- 50 paired prompts × 5 personas = 250 outputs; persona-divergence metric requires ≥80% meaningful divergence.
- 30-case RLS test: each persona sees only their tool allow-list output (e.g., owner_rep cannot trigger schedule executor).
- Workflow-pin override tests: 10 cases verifying pin overrides org/project default correctly.

---

## Consequences

**Positive:** persona becomes structurally load-bearing, not cosmetic. Dashboards align with role. Auto-action thresholds align with role-appropriate trust. Permissions match expectations. Workflow tightening preserves UX flexibility without persona chaos.

**Negative:** admin must assign persona at user provisioning. Onboarding doc updated. Persona drift (a user's role at the org changes) requires admin update — acceptable; should match HR change process anyway.

**Reversibility:** the persona schema is additive. Removing personas (consolidating 5 → 4) is non-destructive — just unused values.

---

## Status timeline

- **2026-05-08** — Accepted, pre-Phase-1 open.
- **Phase 1 open (~Jul 2026)** — 5 personas declared in `src/services/iris/personas/`.
- **Phase 1 close (~Sep 2026)** — 3 dashboards live (PM, Super, Office); Foreman + Owner Rep dashboards Phase 1.5.
- **Quarterly review** for persona drift.
