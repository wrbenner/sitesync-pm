# Phase 4 — Per-Page Insight Slots + Ambient/Proactive Layer

**Spec ID:** PHASE_4_PER_PAGE_INSIGHT_AMBIENT_SPEC_2026-05-08
**Status:** Draft (pre-implementation)
**Author:** IRIS native-experience working group
**Owner:** Walker
**Window:** Lap 5, T-180 → T-120 (Nov 2026 → Jan 2027)
**Pillar closed:** 8 — Ambient & Proactive Insights
**Depends on:** Phase 1 (Context Fabric), Phase 2 (Specialists), Phase 3 (pgvector KB), Day 31–35 detectors (cascade/aging/variance/staffing/weather), ADR-003 (hybrid cron), SCHEDULED_INSIGHTS_SPEC_2026-05-04
**Replaces:** ad-hoc dashboard if/else widgets, the deterministic /iris route insight panel, and the orphaned `useDashboardInsightsStore` calls scattered through 9 pages.

---

## TL;DR

Today, ~10–15% of SiteSync pages render an IRIS surface (RFIs, submittals, daily logs, drafts inbox, /iris). The remaining ~85% — schedule, budget, punch, crews, reports, settings, analytics, photos, foreman home, owner-rep home, PM home, closeout, pay-apps, COs, dailies-history, contacts, vendors, plans, RFP, bid-leveler, lien-waivers, prequal, certs, safety, training, time-tracking, time-approvals, mileage, expenses, equipment, deliveries, weather, integrations, audit-log, profile, billing, exports, search-results, and the empty-state landing pages — have no IRIS UI at all. Walker's mandate is "actionable insights across every page and piece of information." Phase 4 closes that gap.

We introduce one component (`InsightSlot`), one table (`iris_insights`), one ranking function (`rank_insights`), one fan-out worker (`morning-brief-worker`, an extension of the Day 31 scheduled-insights-worker), one generator registry (`src/iris/generators/registry.ts`), and 50 thin per-page generator wrappers. Most generators are deterministic SQL/TS that compute over already-cached context fabric data from Phase 1. A small subset (synthesis, anomaly explanation) call the LLM via Phase 2 specialists, but never on the cold path — synthesis runs in `morning-brief-worker` and is cached for 24h.

Every page renders the same `<InsightSlot pageKey="schedule" entityId={projectId} />` in the same location (page header right rail on desktop; collapsed accordion under page title on mobile). When there are 0 insights, the slot renders a 1-line "IRIS is watching this page — no flags right now" so users learn its presence is constant. When there are 1–3 insights, they are ranked by `signal_strength × persona_relevance × freshness × dismissal_decay`. Beyond 3, a "+N more" expansion holds the tail. Every impression, dismissal, and accept is logged to `iris_insight_events` and rolled up into the Day 31 telemetry MV.

The ambient layer extends this surface time-wise. Each morning at 06:00 in the user's timezone, a fan-out worker reads the union of insights for every page the user touched in the last 7 days, ranks them per-persona, and ships a "Morning Brief" via email + in-app inbox. Phase 5 adds push. The home pages of each persona (PM home, foreman home, owner-rep home) host a "Cards on Home" cross-entity rail: insights that span projects ("Across all 7 of your projects, the highest-risk thing this week is the Carleton MEP rough-in slip"). This is the Glean/Gong pattern, scaled to construction.

Exit gate is empirical: ≥80% of pages must show a non-empty Insight Slot at least once a week per active user; ≥50% of insight engagements must originate from a pushed insight rather than a user-typed query (measured via the `iris_sessions.origin` column added in Phase 1); and morning-brief open rate must hit ≥40% on the soft pilot cohort (Nexus + Carleton).

This spec is ~900 lines. Read it once, then go to section 5 (per-page generator examples) and section 4 (schema). Everything else is scaffolding.

---

## 1. Decision Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Per-page surface | One component, `InsightSlot`, rendered in standard page header slot | Consistency > per-page bespoke UI. Users learn one affordance. |
| Empty state | Render with "no flags" copy, never absent | Builds trust that IRIS is actually watching. Absence reads as broken. |
| Storage | New `iris_insights` table extending `drafted_actions` columns | Reuses provenance/citation/expiry plumbing. Row-level multi-tenant per ADR-006. |
| Generator default | Deterministic SQL/TS over Phase 1 context fabric | Cheap, fast, no LLM cost per page-load. |
| LLM use | Synthesis + anomaly explanation only, in worker, cached 24h | Avoid per-pageview cost. Avoid jitter in identical insights. |
| Ranking | `signal_strength × persona_relevance × freshness × dismissal_decay` | Composable, tunable, debuggable. No black-box ML in Phase 4. |
| Morning brief | Email + in-app inbox; push deferred to Phase 5 | Email is shippable in this lap. Push needs APNs/FCM infra. |
| Cross-entity rail | Home pages only, ≤5 cards | Avoids cognitive overload. Home is the right place. |
| Auto-disable | Generators with >70% 30-day dismissal rate auto-disable | Self-cleaning system; dismissal is the loudest signal. |
| Coverage target | All 50 pages by end of Phase 4 (T-120) | Pillar 8 closes only when coverage is universal. |

Out of scope for Phase 4 (call out so we don't drift):

- Per-user insight personalization beyond persona (deferred to Phase 6 cross-project memory).
- Push notifications (deferred to Phase 5 — needs platform tokens + APNs/FCM).
- Slack/Teams insight delivery (deferred to Phase 7 integrations).
- Generator A/B testing framework (deferred — manual disable via dismissal rate is enough for Phase 4).
- Insight "explain why" deep-dive modal (Phase 5; for now, the citation chips link out).
- Mobile-native push and lock-screen widgets (Phase 5+).

---

## 2. Insight Slot Component

Location: `src/components/iris/InsightSlot.tsx`

### 2.1 Public API

```tsx
type InsightSlotProps = {
  /** Stable key for the page (e.g. "schedule", "budget", "rfi-list"). Used to pick generators. */
  pageKey: PageKey;
  /** Primary entity in view, if any (project_id, rfi_id, etc.). */
  entityId?: string;
  /** Optional secondary scope (e.g. user_id for "your" pages). */
  scope?: 'project' | 'user' | 'global';
  /** Slot placement variant. */
  placement?: 'header-rail' | 'sidebar' | 'floating' | 'inline';
  /** Max insights to show before "+N more". Default 3. */
  maxVisible?: number;
  /** Disable for E2E tests. */
  disabled?: boolean;
};
```

### 2.2 TSX Sketch

```tsx
import { useEffect, useMemo } from 'react';
import { useEntityStore } from '@/stores/useEntityStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useIrisInsights } from '@/hooks/useIrisInsights';
import { InsightCard } from './InsightCard';
import { InsightEmptyState } from './InsightEmptyState';
import { telemetry } from '@/lib/telemetry';
import { PageKey } from '@/iris/generators/registry';

export function InsightSlot({
  pageKey,
  entityId,
  scope = 'project',
  placement = 'header-rail',
  maxVisible = 3,
  disabled,
}: InsightSlotProps) {
  const userId = useAuthStore((s) => s.user?.id);
  const persona = useAuthStore((s) => s.user?.persona);

  const { insights, isLoading, dismissInsight, acceptInsight } = useIrisInsights({
    pageKey,
    entityId,
    scope,
    userId,
    persona,
    enabled: !disabled,
  });

  const visible = useMemo(() => insights.slice(0, maxVisible), [insights, maxVisible]);
  const overflow = insights.length - visible.length;

  // Impression telemetry — fire once per render of a non-empty slot.
  useEffect(() => {
    if (!visible.length) return;
    visible.forEach((i) =>
      telemetry.track('iris_insight_impression', {
        insight_id: i.id,
        generator: i.generator,
        page_key: pageKey,
        rank: i.rank,
        persona,
      }),
    );
  }, [visible, pageKey, persona]);

  if (disabled) return null;
  if (isLoading) return <InsightSlotSkeleton placement={placement} />;
  if (!visible.length) return <InsightEmptyState pageKey={pageKey} placement={placement} />;

  return (
    <section
      data-iris-slot={pageKey}
      data-placement={placement}
      aria-label="IRIS insights for this page"
    >
      <header className="iris-slot__header">
        <span className="iris-slot__title">IRIS</span>
        <span className="iris-slot__count">
          {visible.length}
          {overflow > 0 ? ` of ${insights.length}` : ''}
        </span>
      </header>
      <ul className="iris-slot__list">
        {visible.map((insight) => (
          <li key={insight.id}>
            <InsightCard
              insight={insight}
              onDismiss={() => dismissInsight(insight.id)}
              onAccept={() => acceptInsight(insight.id)}
            />
          </li>
        ))}
      </ul>
      {overflow > 0 && (
        <details className="iris-slot__overflow">
          <summary>+{overflow} more</summary>
          <ul>
            {insights.slice(maxVisible).map((insight) => (
              <li key={insight.id}>
                <InsightCard
                  insight={insight}
                  compact
                  onDismiss={() => dismissInsight(insight.id)}
                  onAccept={() => acceptInsight(insight.id)}
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
```

### 2.3 InsightCard sketch

```tsx
export function InsightCard({ insight, onDismiss, onAccept, compact }: InsightCardProps) {
  const Icon = INSIGHT_TYPE_ICONS[insight.type];
  return (
    <article className={`insight-card insight-card--${insight.type}`} data-compact={compact}>
      <header>
        <Icon aria-hidden />
        <h4>{insight.title}</h4>
        <FreshnessChip ts={insight.created_at} />
      </header>
      <p>{insight.body}</p>
      {insight.citations?.length > 0 && (
        <CitationChipRow citations={insight.citations} />
      )}
      <footer className="insight-card__actions">
        {insight.actions?.map((a) => (
          <PermissionGate key={a.id} permission={a.permission}>
            <button
              className="insight-card__cta"
              onClick={() => onAccept(a)}
              data-action-id={a.id}
            >
              {a.label}
            </button>
          </PermissionGate>
        ))}
        <button
          className="insight-card__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss insight"
        >
          Dismiss
        </button>
      </footer>
    </article>
  );
}
```

`PermissionGate` wraps every action CTA per the Lap 1 invariant. `CitationChipRow` opens the side panel from ADR-004 on click.

### 2.4 useIrisInsights hook

```ts
export function useIrisInsights({ pageKey, entityId, scope, userId, persona, enabled }: Args) {
  const queryKey = ['iris_insights', pageKey, entityId, userId];

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!enabled && !!userId,
    staleTime: 60_000, // 1 min — generators write through worker; refresh covers WS push.
    queryFn: async () => {
      const { data, error } = await supabase.rpc('iris_get_insights', {
        p_page_key: pageKey,
        p_entity_id: entityId,
        p_scope: scope,
        p_persona: persona,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const dismiss = useMutation({
    mutationFn: (id: string) =>
      supabase.rpc('iris_dismiss_insight', { p_insight_id: id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const accept = useMutation({
    mutationFn: (id: string) =>
      supabase.rpc('iris_accept_insight', { p_insight_id: id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    insights: data ?? [],
    isLoading,
    dismissInsight: dismiss.mutate,
    acceptInsight: accept.mutate,
  };
}
```

### 2.5 Empty-state copy

Per `pageKey`, but defaults to:

> IRIS is watching this page — no flags right now.

Schedule-page override: "IRIS is watching the schedule — no slip risks today."
Budget-page override: "IRIS is watching the ledger — no variance flags today."
… one tailored line per page (50 lines total in `INSIGHT_EMPTY_COPY`).

---

## 3. Coverage Map — 50 Pages × Generators

| # | Page (route / file) | pageKey | Primary generator(s) | Persona bias |
|---|---------------------|---------|----------------------|--------------|
| 1 | /dashboard (PM home) | `pm-home` | `cross_project_top3`, `morning_brief_inline` | PM |
| 2 | /dashboard/foreman | `foreman-home` | `tomorrow_safety_risks`, `today_crew_gaps` | Foreman |
| 3 | /dashboard/owner-rep | `owner-rep-home` | `executive_summary`, `cross_project_top3` | Owner-rep |
| 4 | /dashboard/super | `super-home` | `tomorrow_safety_risks`, `crew_gaps_lookahead` | Super |
| 5 | /projects | `project-list` | `portfolio_health_anomalies` | PM, Owner-rep |
| 6 | /projects/:id | `project-detail` | `project_top3` (delegates to detectors) | All |
| 7 | /projects/:id/schedule | `schedule` | `weather_outdoor_risk`, `cascade_detector`, `lookahead_drift` | Super, PM |
| 8 | /projects/:id/budget | `budget` | `co_log_ledger_delta`, `variance_detector`, `forecast_burn` | PM, Owner |
| 9 | /projects/:id/punch | `punch` | `aging_open_items`, `owner_blocked_count` | PM, Super |
| 10 | /projects/:id/crews | `crews` | `staffing_lookahead`, `certification_expiry` | Super, Foreman |
| 11 | /projects/:id/reports | `reports` | `report_freshness`, `missing_metrics` | PM, Owner-rep |
| 12 | /projects/:id/analytics | `analytics` | `anomaly_detector`, `trend_synthesis` | PM, Owner |
| 13 | /projects/:id/rfis | `rfi-list` | `rfi_slip_risk`, `aging_open_rfis` | PM, Super |
| 14 | /projects/:id/rfis/:rfi | `rfi-detail` | `rfi_response_drafted`, `related_rfis` | PM |
| 15 | /projects/:id/submittals | `submittal-list` | `lead_time_at_risk`, `aging_resubmits` | PM |
| 16 | /projects/:id/submittals/:s | `submittal-detail` | `spec_section_lead_time`, `cycle_time_anomaly` | PM |
| 17 | /projects/:id/daily-log | `daily-log` | `missing_fields_pattern`, `weather_carryover` | Super, Foreman |
| 18 | /projects/:id/daily-log/history | `daily-log-history` | `quality_score_trend`, `missing_log_days` | PM |
| 19 | /projects/:id/photos | `photos` | `progress_vs_schedule_photo`, `geo_gap_coverage` | PM, Owner |
| 20 | /projects/:id/plans | `plans` | `outdated_sheet_in_use`, `addenda_unread` | Super, PM |
| 21 | /projects/:id/cos | `co-list` | `co_log_ledger_delta`, `aging_open_cos` | PM, Owner |
| 22 | /projects/:id/cos/:co | `co-detail` | `pricing_outlier`, `time_impact_unset` | PM |
| 23 | /projects/:id/pay-apps | `pay-app-list` | `pay_app_math_check`, `aging_unbilled_work` | PM, Owner |
| 24 | /projects/:id/pay-apps/:p | `pay-app-detail` | `pay_app_ledger_mismatch`, `retainage_anomaly` | PM |
| 25 | /projects/:id/closeout | `closeout` | `missing_closeout_docs`, `warranty_expiry_inbound` | PM |
| 26 | /projects/:id/safety | `safety` | `safety_risk_lookahead`, `incident_anomaly` | Super, Foreman |
| 27 | /projects/:id/training | `training` | `cert_expiry_lookahead` | Super |
| 28 | /projects/:id/time-tracking | `time-tracking` | `time_anomaly`, `missing_punch` | Foreman |
| 29 | /projects/:id/time-approvals | `time-approvals` | `aging_unapproved_time`, `outlier_hours` | Super, PM |
| 30 | /projects/:id/mileage | `mileage` | `mileage_anomaly` | Office |
| 31 | /projects/:id/expenses | `expenses` | `expense_outlier`, `missing_receipts` | Office, PM |
| 32 | /projects/:id/equipment | `equipment` | `equipment_idle`, `service_due` | Super |
| 33 | /projects/:id/deliveries | `deliveries` | `delivery_at_risk`, `lead_time_warning` | Super |
| 34 | /projects/:id/weather | `weather` | `weather_outdoor_risk`, `weather_carryover` | Super |
| 35 | /projects/:id/contacts | `contacts` | `stale_contact`, `missing_role` | PM |
| 36 | /projects/:id/vendors | `vendors` | `vendor_perf_anomaly`, `prequal_expiring` | PM |
| 37 | /projects/:id/lien-waivers | `lien-waivers` | `aging_unsigned_waivers`, `pay_app_blocked_by_waiver` | Office, PM |
| 38 | /projects/:id/prequal | `prequal` | `prequal_expiring`, `missing_certs` | PM |
| 39 | /projects/:id/bid-leveler | `bid-leveler` | `bid_outlier`, `scope_gap` | PM |
| 40 | /projects/:id/rfp | `rfp` | `rfp_response_due`, `addenda_unread` | PM |
| 41 | /drafts | `drafts-inbox` | `drafts_aging`, `auto_withdraw_imminent` | All |
| 42 | /iris | `iris-route` | `recent_threads`, `unanswered_questions` | All |
| 43 | /search | `search-results` | `synthesis_of_top_results` | All |
| 44 | /audit-log | `audit-log` | `auth_anomaly`, `bulk_change_detected` | Owner |
| 45 | /settings | `settings` | `integration_health`, `unverified_email` | Owner |
| 46 | /integrations | `integrations` | `integration_health`, `oauth_expiring` | Owner |
| 47 | /billing | `billing` | `seat_overage`, `renewal_inbound` | Owner |
| 48 | /profile | `profile` | `profile_completeness`, `avatar_missing` | All |
| 49 | /exports | `exports` | `failed_export_retry`, `aging_pending_export` | Office, PM |
| 50 | /404 + empty-state pages | `landing-empty` | `getting_started_next_action` | All |

If a page doesn't exist yet, the InsightSlot is added when the page is built — `pageKey` reservation in `registry.ts` is the gate.

---

## 4. `iris_insights` Schema (Migration Draft)

Migration file: `supabase/migrations/20261101000000_iris_insights.sql`. Order: after Day 31 (`scheduled_insights_*`) tables, after Phase 1 context-fabric tables, after Phase 3 `pgvector` extension.

```sql
-- iris_insights: per-page actionable insights, generated by deterministic or LLM-backed generators.
-- Extends drafted_actions provenance/citation pattern.

create extension if not exists "pgcrypto";

create type iris_insight_type as enum ('alert', 'reminder', 'opportunity', 'anomaly', 'synthesis');
create type iris_insight_origin as enum ('deterministic', 'llm', 'hybrid');
create type iris_insight_state as enum ('active', 'dismissed', 'accepted', 'expired', 'auto_withdrawn');

create table public.iris_insights (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,         -- target user; null = visible to anyone with access to entity
  page_key text not null,                                       -- e.g. 'schedule', 'budget'. Validated against registry on insert via trigger.
  entity_id uuid,                                               -- primary entity (rfi_id, project_id, etc.)
  generator text not null,                                       -- e.g. 'weather_outdoor_risk' — must exist in iris_generator_registry
  type iris_insight_type not null,
  origin iris_insight_origin not null default 'deterministic',
  title text not null check (length(title) <= 140),
  body text not null check (length(body) <= 1200),
  signal_strength numeric(4, 3) not null check (signal_strength between 0 and 1),
  persona_relevance jsonb not null default '{}'::jsonb,         -- { pm: 0.9, foreman: 0.4, owner: 0.7, super: 0.6 }
  citations jsonb not null default '[]'::jsonb,                  -- [{ kind, ref, snippet }] per ADR-004
  actions jsonb not null default '[]'::jsonb,                    -- [{ id, label, permission, payload }]
  context_hash text,                                             -- hash of inputs — used to dedupe
  state iris_insight_state not null default 'active',
  is_soft_pilot boolean not null default false,                 -- ADR-006
  created_at timestamptz not null default now(),
  expires_at timestamptz,                                        -- generator-defined; null = no expiry
  dismissed_at timestamptz,
  accepted_at timestamptz,
  worker_run_id uuid                                             -- which morning-brief or per-page run produced this
);

create index iris_insights_lookup
  on public.iris_insights (org_id, page_key, entity_id, state)
  where state = 'active';

create index iris_insights_user_active
  on public.iris_insights (user_id, state, created_at desc)
  where state = 'active';

create unique index iris_insights_dedupe
  on public.iris_insights (org_id, page_key, entity_id, generator, context_hash)
  where state = 'active';

-- Telemetry per ADR-008 (12-month retention, 24-month for soft pilot).
create table public.iris_insight_events (
  id bigserial primary key,
  insight_id uuid not null references iris_insights(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  event_type text not null check (event_type in (
    'impression', 'click', 'dismiss', 'accept', 'expand', 'cite_open', 'action_fire'
  )),
  page_key text not null,
  rank smallint,
  persona text,
  occurred_at timestamptz not null default now()
);

create index iris_insight_events_lookup
  on public.iris_insight_events (insight_id, event_type, occurred_at desc);

-- Generator registry — used by trigger to validate generator name and store metadata.
create table public.iris_generator_registry (
  generator text primary key,
  page_keys text[] not null,
  type iris_insight_type not null,
  origin iris_insight_origin not null,
  default_signal_strength numeric(4, 3) not null default 0.5,
  default_persona_relevance jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,                       -- auto-flipped to false if dismissal_rate > 0.7
  auto_disabled_at timestamptz,
  description text
);

-- Validation trigger.
create or replace function public.iris_validate_insight_generator()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from public.iris_generator_registry r where r.generator = new.generator and r.is_enabled) then
    raise exception 'Unknown or disabled generator: %', new.generator;
  end if;
  if not (new.page_key = any (
    select unnest(page_keys) from public.iris_generator_registry where generator = new.generator
  )) then
    raise exception 'Generator % not registered for page_key %', new.generator, new.page_key;
  end if;
  return new;
end;
$$;

create trigger iris_validate_insight_generator
  before insert on public.iris_insights
  for each row execute function public.iris_validate_insight_generator();

-- Ranked-fetch RPC.
create or replace function public.iris_get_insights(
  p_page_key text,
  p_entity_id uuid,
  p_scope text,
  p_persona text
)
returns table (
  id uuid,
  type iris_insight_type,
  title text,
  body text,
  citations jsonb,
  actions jsonb,
  generator text,
  rank integer,
  score numeric,
  created_at timestamptz
)
language sql
stable
as $$
  with scored as (
    select
      i.id,
      i.type,
      i.title,
      i.body,
      i.citations,
      i.actions,
      i.generator,
      i.created_at,
      (
        i.signal_strength
        * coalesce((i.persona_relevance ->> p_persona)::numeric, 0.5)
        * (1.0 / (1.0 + extract(epoch from now() - i.created_at) / 86400.0))   -- freshness decay over days
        * (
            select coalesce(1.0 - 0.2 * count(*), 0.1)
            from public.iris_insight_events e
            where e.insight_id = i.id and e.event_type = 'dismiss'
          )
      ) as score
    from public.iris_insights i
    where i.state = 'active'
      and i.page_key = p_page_key
      and (p_entity_id is null or i.entity_id = p_entity_id)
      and (i.expires_at is null or i.expires_at > now())
      and i.org_id = (select current_setting('request.jwt.claims', true)::jsonb ->> 'org_id')::uuid
  )
  select id, type, title, body, citations, actions, generator,
         row_number() over (order by score desc)::integer as rank,
         score,
         created_at
  from scored
  order by score desc
  limit 25;
$$;

-- Dismiss / accept RPCs (omitted for brevity — they update state and write iris_insight_events).
```

RLS policy mirrors `drafted_actions`: users see only their org; insights bound to a `user_id` are private to that user; org-wide insights respect role.

---

## 5. Per-Page Generator Examples

Generators live in `src/iris/generators/<page-key>/<generator-name>.ts`. Each exports:

```ts
export type GeneratorContext = {
  orgId: string;
  userId: string;
  persona: Persona;
  entityId?: string;
  fabric: ContextFabric;       // from Phase 1
  specialists: Specialists;    // from Phase 2
  knowledge: KnowledgeBase;    // from Phase 3
};

export type GeneratorResult = {
  insights: NewInsight[];
  context_hash: string;
};

export type Generator = (ctx: GeneratorContext) => Promise<GeneratorResult>;
```

The registry is a typed map: `Record<string, GeneratorMeta>`, with build-time enforcement that every `pageKey` has ≥1 generator.

### 5.1 `weather_outdoor_risk` (Schedule)

Deterministic. Inputs: 5-day weather forecast (cached in fabric.weather), schedule activities tagged `is_outdoor`.

```ts
export const weather_outdoor_risk: Generator = async ({ fabric, entityId }) => {
  const projectId = entityId!;
  const forecast = await fabric.weather.getForecast(projectId, 5);
  const activities = await fabric.schedule.getActivitiesInWindow(projectId, 5, { outdoorOnly: true });

  const atRisk = activities.filter((a) =>
    forecast.some((d) => d.date === a.start && d.precipProb > 0.5),
  );
  if (!atRisk.length) return { insights: [], context_hash: 'empty' };

  return {
    insights: [
      {
        type: 'alert',
        title: `Weather risks ${atRisk.length} outdoor activities in next 5 days`,
        body: `${atRisk.slice(0, 3).map((a) => a.name).join(', ')}${atRisk.length > 3 ? `, +${atRisk.length - 3} more` : ''}. Precipitation probability >50% on scheduled days.`,
        signal_strength: Math.min(1, atRisk.length / 5),
        persona_relevance: { pm: 0.8, super: 0.95, foreman: 0.7, owner: 0.4 },
        citations: atRisk.slice(0, 3).map((a) => ({
          kind: 'schedule_activity',
          ref: a.id,
          snippet: `${a.name} — ${a.start}`,
        })),
        actions: [
          { id: 'reschedule', label: 'Open scheduler', permission: 'schedule.write' },
          { id: 'notify-foremen', label: 'Notify foremen', permission: 'notify.send' },
        ],
        expires_at: addDays(new Date(), 1),
      },
    ],
    context_hash: hash([projectId, atRisk.map((a) => a.id), forecast.map((d) => d.date)]),
  };
};
```

### 5.2 `co_log_ledger_delta` (Budget / CO list)

Deterministic. Inputs: CO log totals, accounting ledger CO totals (synced via integrations.cost_ledger), money math via `src/types/money.ts`.

```ts
export const co_log_ledger_delta: Generator = async ({ fabric, entityId }) => {
  const projectId = entityId!;
  const coLog = await fabric.budget.getCOLogTotal(projectId);    // Cents
  const ledger = await fabric.budget.getLedgerCOTotal(projectId); // Cents
  const delta = subtractCents(coLog, ledger);
  if (Math.abs(delta) < 1_000_00) return { insights: [], context_hash: 'within-tolerance' };

  return {
    insights: [
      {
        type: 'anomaly',
        title: `CO log vs ledger delta = ${formatCents(delta)}`,
        body: `Change-order log shows ${formatCents(coLog)}; accounting ledger shows ${formatCents(ledger)}. Investigate which side is stale.`,
        signal_strength: Math.min(1, Math.abs(delta) / 100_000_00),
        persona_relevance: { pm: 0.95, owner: 0.95, foreman: 0.1, super: 0.3 },
        citations: [
          { kind: 'co_log', ref: projectId, snippet: 'CO log totals' },
          { kind: 'ledger', ref: projectId, snippet: 'Accounting ledger CO bucket' },
        ],
        actions: [
          { id: 'open-co-log', label: 'Open CO log', permission: 'budget.read' },
          { id: 'open-ledger', label: 'Open ledger', permission: 'budget.read' },
        ],
      },
    ],
    context_hash: hash([projectId, coLog, ledger]),
  };
};
```

### 5.3 `aging_open_items` (Punch)

Deterministic.

```ts
export const aging_open_items: Generator = async ({ fabric, entityId }) => {
  const projectId = entityId!;
  const items = await fabric.punch.getOpenItems(projectId);
  const stale = items.filter((i) => daysSince(i.created_at) > 30);
  const ownerBlocked = stale.filter((i) => i.blocker === 'owner');
  if (!stale.length) return { insights: [], context_hash: 'none' };

  return {
    insights: [
      {
        type: 'reminder',
        title: `${stale.length} open punch items >30 days; ${ownerBlocked.length} owner-blocked`,
        body: `Aging punch items hurt closeout. Owner-blocked items need escalation, not nags.`,
        signal_strength: Math.min(1, stale.length / 50),
        persona_relevance: { pm: 0.9, super: 0.7, owner: 0.5, foreman: 0.4 },
        citations: stale.slice(0, 3).map((i) => ({
          kind: 'punch_item', ref: i.id, snippet: i.description.slice(0, 80),
        })),
        actions: [
          { id: 'filter-aging', label: 'Filter aging', permission: 'punch.read' },
          { id: 'escalate-owner', label: 'Draft owner email', permission: 'iris.draft' },
        ],
      },
    ],
    context_hash: hash([projectId, stale.map((i) => i.id)]),
  };
};
```

### 5.4 `staffing_lookahead` (Crews)

Deterministic, reads Phase 1 fabric.

```ts
export const staffing_lookahead: Generator = async ({ fabric, entityId }) => {
  const projectId = entityId!;
  const need = await fabric.crews.getLookaheadNeed(projectId, 7);  // by trade
  const confirmed = await fabric.crews.getConfirmedHeadcount(projectId, 7);

  const gaps = Object.keys(need)
    .map((trade) => ({ trade, gap: need[trade] - (confirmed[trade] ?? 0) }))
    .filter((g) => g.gap > 0)
    .sort((a, b) => b.gap - a.gap);
  if (!gaps.length) return { insights: [], context_hash: 'fully-staffed' };

  const top = gaps[0];
  return {
    insights: [
      {
        type: 'alert',
        title: `${top.trade} short ${top.gap} for next-week lookahead`,
        body: `Need ${need[top.trade]} ${top.trade}; ${confirmed[top.trade] ?? 0} confirmed. ${gaps.length > 1 ? `Other gaps: ${gaps.slice(1, 3).map((g) => `${g.trade} -${g.gap}`).join(', ')}.` : ''}`,
        signal_strength: Math.min(1, top.gap / 10),
        persona_relevance: { super: 0.95, foreman: 0.8, pm: 0.7, owner: 0.3 },
        citations: [{ kind: 'lookahead', ref: projectId, snippet: 'Next-week lookahead' }],
        actions: [
          { id: 'open-lookahead', label: 'Open lookahead', permission: 'crew.read' },
          { id: 'request-trade', label: 'Request trade partner crew', permission: 'crew.request' },
        ],
      },
    ],
    context_hash: hash([projectId, gaps]),
  };
};
```

### 5.5 `progress_vs_schedule_photo` (Photos)

Hybrid (LLM-assisted, runs in worker).

```ts
export const progress_vs_schedule_photo: Generator = async ({ fabric, entityId, specialists }) => {
  const projectId = entityId!;
  const recent = await fabric.photos.getRecent(projectId, 7);
  if (!recent.length) return { insights: [], context_hash: 'no-photos' };

  // Use Phase 2 schedule specialist to compare tagged trades vs schedule plan.
  const synthesis = await specialists.schedule.compareTaggedPhotosToPlan({
    projectId,
    photos: recent,
  });
  if (synthesis.daysAheadOrBehind === 0 && !synthesis.notable) {
    return { insights: [], context_hash: 'on-track' };
  }

  return {
    insights: [
      {
        type: synthesis.daysAheadOrBehind > 0 ? 'opportunity' : 'alert',
        title: `${recent.length} photos suggest ${synthesis.tradeOrPhase} is ${Math.abs(synthesis.daysAheadOrBehind)} days ${synthesis.daysAheadOrBehind > 0 ? 'ahead' : 'behind'}`,
        body: synthesis.summary,
        signal_strength: Math.min(1, Math.abs(synthesis.daysAheadOrBehind) / 7),
        persona_relevance: { pm: 0.85, owner: 0.85, super: 0.5, foreman: 0.3 },
        citations: synthesis.cited_photo_ids.map((id) => ({
          kind: 'photo', ref: id, snippet: 'See photo',
        })),
        actions: [
          { id: 'open-gallery', label: 'Open gallery', permission: 'photos.read' },
          { id: 'update-schedule', label: 'Adjust schedule', permission: 'schedule.write' },
        ],
        origin: 'hybrid',
      },
    ],
    context_hash: hash([projectId, recent.map((r) => r.id), synthesis.daysAheadOrBehind]),
  };
};
```

### 5.6 `rfi_slip_risk` (RFI list)

Deterministic.

```ts
export const rfi_slip_risk: Generator = async ({ fabric, entityId }) => {
  const projectId = entityId!;
  const open = await fabric.rfis.getOpen(projectId);
  const wallCloseup = await fabric.schedule.getMilestone(projectId, 'wall-closeup');
  if (!wallCloseup) return { insights: [], context_hash: 'no-milestone' };

  const risky = open.filter((r) => {
    const slack = daysBetween(new Date(), r.due_date) - daysBetween(new Date(), wallCloseup.date);
    return slack < 3;
  });
  if (!risky.length) return { insights: [], context_hash: 'safe' };

  return {
    insights: [
      {
        type: 'alert',
        title: `${risky.length} RFI${risky.length > 1 ? 's' : ''} likely to slip the wall closeup`,
        body: `${risky.slice(0, 3).map((r) => `RFI #${r.number}`).join(', ')} — turnaround needed before ${formatDate(wallCloseup.date)}.`,
        signal_strength: Math.min(1, risky.length / 5),
        persona_relevance: { pm: 0.95, super: 0.7, foreman: 0.3, owner: 0.5 },
        citations: risky.slice(0, 3).map((r) => ({
          kind: 'rfi', ref: r.id, snippet: `RFI #${r.number} — ${r.subject.slice(0, 60)}`,
        })),
        actions: [{ id: 'escalate-rfi', label: 'Escalate to A/E', permission: 'rfi.write' }],
      },
    ],
    context_hash: hash([projectId, risky.map((r) => r.id), wallCloseup.date]),
  };
};
```

### 5.7 `spec_section_lead_time` (Submittals)

Deterministic + KB lookup.

```ts
export const spec_section_lead_time: Generator = async ({ fabric, entityId, knowledge }) => {
  const submittalId = entityId!;
  const submittal = await fabric.submittals.get(submittalId);
  const required = await knowledge.specSections.getLeadTime(submittal.spec_section);
  const current = daysBetween(submittal.created_at, new Date());
  if (current >= required.days) return { insights: [], context_hash: 'safe' };

  return {
    insights: [
      {
        type: 'reminder',
        title: `Spec ${submittal.spec_section} requires ${required.days}-day lead time; you're at ${current}`,
        body: `Per ${required.source}, this section needs ${required.days} days ahead of installation. Push approval or accept the schedule risk.`,
        signal_strength: Math.min(1, (required.days - current) / required.days),
        persona_relevance: { pm: 0.9, super: 0.5, foreman: 0.2, owner: 0.4 },
        citations: [{ kind: 'spec_section', ref: submittal.spec_section, snippet: required.source }],
        actions: [{ id: 'expedite', label: 'Mark expedite', permission: 'submittal.write' }],
      },
    ],
    context_hash: hash([submittalId, current, required.days]),
  };
};
```

### 5.8 `missing_fields_pattern` (Daily Log)

Deterministic.

```ts
export const missing_fields_pattern: Generator = async ({ fabric, entityId }) => {
  const projectId = entityId!;
  const today = await fabric.dailyLogs.getDraftForToday(projectId);
  if (!today) return { insights: [], context_hash: 'no-draft' };
  const yesterdayPattern = await fabric.dailyLogs.getYesterdayFilledFields(projectId);
  const missing = yesterdayPattern.filter((f) => !today[f]?.length);
  if (missing.length < 3) return { insights: [], context_hash: 'mostly-filled' };

  return {
    insights: [
      {
        type: 'reminder',
        title: `${missing.length} fields missing based on yesterday's log`,
        body: `Yesterday filled: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? `, +${missing.length - 3} more` : ''}.`,
        signal_strength: Math.min(1, missing.length / yesterdayPattern.length),
        persona_relevance: { super: 0.9, foreman: 0.95, pm: 0.4, owner: 0.2 },
        citations: [{ kind: 'daily_log', ref: today.id, snippet: 'Today\'s draft' }],
        actions: [{ id: 'jump-missing', label: 'Jump to missing', permission: 'daily.write' }],
      },
    ],
    context_hash: hash([projectId, missing]),
  };
};
```

### 5.9 `pay_app_math_check` (Pay app detail)

Deterministic. Uses `src/types/money.ts` — every operation in cents.

```ts
export const pay_app_math_check: Generator = async ({ fabric, entityId }) => {
  const payAppId = entityId!;
  const pa = await fabric.payApps.get(payAppId);
  const computed = subtractCents(
    addCents(pa.line_total_cents, pa.stored_materials_cents),
    addCents(pa.retainage_cents, pa.previous_billed_cents),
  );
  const stated = pa.this_period_cents;
  const delta = subtractCents(computed, stated);
  const ledgerDelta = subtractCents(pa.ledger_period_cents, stated);

  const issues: string[] = [];
  if (Math.abs(delta) > 100) issues.push(`Math delta ${formatCents(delta)}`);
  if (Math.abs(ledgerDelta) > 100) issues.push(`Ledger mismatch ${formatCents(ledgerDelta)}`);
  if (!issues.length) return { insights: [], context_hash: 'clean' };

  return {
    insights: [
      {
        type: 'anomaly',
        title: `Pay app math check found ${issues.length} issue${issues.length > 1 ? 's' : ''}`,
        body: issues.join('. ') + '.',
        signal_strength: 0.95,
        persona_relevance: { pm: 0.95, owner: 0.9, super: 0.3, foreman: 0.1 },
        citations: [
          { kind: 'pay_app', ref: payAppId, snippet: `Pay App ${pa.number}` },
          { kind: 'ledger', ref: pa.ledger_ref, snippet: 'Accounting ledger' },
        ],
        actions: [
          { id: 'review-math', label: 'Review math', permission: 'pay-app.read' },
          { id: 'reject-pay-app', label: 'Reject for revision', permission: 'pay-app.approve' },
        ],
      },
    ],
    context_hash: hash([payAppId, computed, stated, pa.ledger_period_cents]),
  };
};
```

### 5.10 `missing_closeout_docs` (Closeout)

Deterministic + cross-project KB (Phase 3).

```ts
export const missing_closeout_docs: Generator = async ({ fabric, entityId, knowledge }) => {
  const projectId = entityId!;
  const present = await fabric.closeout.getPresentDocs(projectId);
  const expected = await knowledge.closeout.getExpectedDocsFromLast3Projects({ orgId: fabric.orgId });
  const missing = expected.filter((e) => !present.includes(e.kind));
  if (!missing.length) return { insights: [], context_hash: 'complete' };

  return {
    insights: [
      {
        type: 'reminder',
        title: `${missing.length} likely closeout docs missing`,
        body: `Based on your last 3 projects: ${missing.slice(0, 4).map((m) => m.kind).join(', ')}${missing.length > 4 ? `, +${missing.length - 4} more` : ''}.`,
        signal_strength: Math.min(1, missing.length / expected.length),
        persona_relevance: { pm: 0.9, owner: 0.7, super: 0.4, foreman: 0.2 },
        citations: missing.slice(0, 4).map((m) => ({
          kind: 'closeout_template', ref: m.kind, snippet: m.exampleSource,
        })),
        actions: [{ id: 'open-checklist', label: 'Open closeout checklist', permission: 'closeout.read' }],
      },
    ],
    context_hash: hash([projectId, missing.map((m) => m.kind)]),
  };
};
```

### 5.11 — 5.50 (summary)

The remaining 40 generators follow the same shape and are documented per-page in `src/iris/generators/<page-key>/README.md` at implementation time. Coverage is enforced by `scripts/audit-insight-coverage.mjs` (CI job, see section 15).

---

## 6. Insight Ranking Algorithm

### 6.1 Inputs

- `signal_strength ∈ [0, 1]` — set by generator. Examples: `min(1, count/threshold)`.
- `persona_relevance[persona] ∈ [0, 1]` — set by generator default, overridable per insight.
- `freshness = 1 / (1 + age_days)` — exponential-ish decay, tuned at SQL level.
- `dismissal_decay = max(0.1, 1 - 0.2 × dismissals)` — drops 20% per dismiss event, floor 0.1.

### 6.2 Score

```
score = signal_strength × persona_relevance × freshness × dismissal_decay
```

Computed in `iris_get_insights` SQL (see section 4) so it stays out of TS.

### 6.3 Top-3 selection

`row_number() over (order by score desc) ≤ 3` for default visible. The next 22 (limit 25 total) populate "+N more". Beyond rank 25 are not shown (they will surface in the next morning brief if still relevant).

### 6.4 Tie-break

Ties resolve by:
1. `type` priority: `alert` > `anomaly` > `reminder` > `synthesis` > `opportunity`.
2. `created_at` desc.

### 6.5 Ranking validation

Unit test in `src/iris/generators/ranking.test.ts` runs ~12 fixtures asserting top-3 stays stable under perturbations (fresher insight should beat staler equal-score; dismissed should drop, etc.).

---

## 7. Insight Type Taxonomy

| Type | Color (var) | Icon | Use when | Example |
|------|-------------|------|----------|---------|
| `alert` | `--color-alert-fg` (red-tinged) | AlertTriangle | Time-sensitive, action-needed-now | "4 outdoor activities at risk in 5 days" |
| `reminder` | `--color-reminder-fg` (amber) | Bell | Deadline-driven, scheduled action | "Spec lead time at 9 of 14 days" |
| `opportunity` | `--color-positive-fg` (green) | TrendingUp | Positive signal worth noting | "MEP rough-in 4 days ahead of schedule" |
| `anomaly` | `--color-anomaly-fg` (purple) | Activity | Pattern departure, investigate | "CO log vs ledger delta = $42K" |
| `synthesis` | `--color-synthesis-fg` (blue) | Network | Multi-signal combined | "Top 3 risks across all projects this week" |

UI affordance differences:
- **alert** sticks to top of slot; cannot be reordered by ranking unless dismissed.
- **opportunity** rendered with subdued chrome — no animation.
- **anomaly** must include 2+ citations.
- **synthesis** must include `origin = 'hybrid'` or `'llm'`.

---

## 8. Morning Brief — Fan-Out + Per-Persona Content

### 8.1 Wiring

Extends Day 31 `scheduled-insights-worker` per ADR-003 (pg_cron heartbeat → pgmq queue → edge fn worker).

- New cron entry: `morning_brief_fanout` runs every 10 minutes; checks the `users` table for users whose local time is 06:00 (5-min window), enqueues per-user jobs.
- New worker: `morning-brief-worker` (edge function) consumes `morning_brief_jobs` queue. For each user:
  1. Read `iris_insights` rows where `user_id = u.id OR (entity_id ∈ touched_in_last_7d AND user_id IS NULL)`.
  2. Rank per the algorithm in section 6, scoped by user's persona.
  3. Take top 5.
  4. Render two outputs: HTML email (via `email-sender` edge fn) and in-app inbox row (table `iris_inbox_messages`).
  5. Stamp `last_brief_sent_at` on user.
- Failure handling: pgmq retry up to 3 times; on final failure write to `iris_brief_failures` for ops visibility.

### 8.2 Per-persona templates

Templates live in `src/iris/morning-brief/templates/<persona>.tsx` and render server-side.

- **PM**: subject "Top 3 risks across your projects today". Body = 3 cross-project synthesis insights + a "your day" sub-section with project-scoped top 1 each.
- **Foreman**: subject "Your crews + tomorrow". Body = today's safety risks + tomorrow's lookahead gaps + outstanding daily-log fields.
- **Owner-rep**: subject "Executive summary across portfolio". Body = portfolio variance + active anomalies + upcoming pay app/CO milestones.
- **Super**: subject "Your project — today + 5 days". Body = weather risks + crew gaps + cascade-detector top 3.
- **Office**: subject "Approvals + receivables today". Body = aging unsigned waivers + missing receipts + outlier expenses.

### 8.3 In-app inbox

`iris_inbox_messages` (org-scoped, user-targeted) is rendered at `/inbox` and as a bell icon header count. Same data as the email; opening from inbox marks read.

### 8.4 Quiet hours / opt-out

User profile flag `morning_brief_enabled` (default true). Quiet on Saturday/Sunday for foreman persona unless `weekend_briefs = true`. Unsubscribe link in email triggers RPC `iris_set_brief_pref(false)`.

---

## 9. Cross-Entity "Cards on Home"

### 9.1 Scope

Only on home pages: `pm-home`, `foreman-home`, `owner-rep-home`, `super-home`. Renders **above** the project grid as a horizontal scroll rail of ≤5 cards.

### 9.2 Generators

- `cross_project_top3` — for PM, owner-rep. Pulls top-scored insights across all projects in scope, weighted by `signal_strength × persona_relevance`. One card per project max.
- `tomorrow_safety_risks` — for foreman, super. Single card synthesizing tomorrow's weather + scheduled outdoor activities + safety incidents in last 30 days at this jobsite.
- `executive_summary` — for owner-rep. LLM-backed (synthesis), generated nightly in worker.
- `portfolio_health_anomalies` — for owner-rep. Variance flags by project.

### 9.3 Rendering

Same `InsightCard` chrome. Each card shows project name as a chip in the header for cross-project context.

### 9.4 Cross-entity vs Phase 6

Phase 4 cross-entity is rule-based aggregation. Phase 6 cross-project memory adds vector-similarity search and remembers user behavior across projects ("you usually escalate punch items by week 4 — this project is at week 5"). For Phase 4 we do NOT do that.

---

## 10. Telemetry — Generator-Level Metrics

### 10.1 Events captured (in `iris_insight_events`)

- `impression` — emitted from `InsightSlot` once per render of a non-empty list.
- `click` — emitted from `InsightCard` body click.
- `expand` — emitted when user opens the "+N more" details.
- `cite_open` — emitted when a citation chip is clicked.
- `action_fire` — emitted when an action CTA fires.
- `accept` — emitted by `iris_accept_insight` RPC.
- `dismiss` — emitted by `iris_dismiss_insight` RPC.

### 10.2 Materialized view: `mv_iris_generator_health`

```sql
create materialized view public.mv_iris_generator_health as
select
  i.generator,
  i.org_id,
  count(*) filter (where e.event_type = 'impression') as impressions_30d,
  count(*) filter (where e.event_type = 'dismiss')    as dismissals_30d,
  count(*) filter (where e.event_type = 'accept')     as accepts_30d,
  case when count(*) filter (where e.event_type = 'impression') > 0
       then (count(*) filter (where e.event_type = 'dismiss'))::numeric
            / count(*) filter (where e.event_type = 'impression')
       else 0 end as dismissal_rate_30d,
  case when count(*) filter (where e.event_type = 'impression') > 0
       then (count(*) filter (where e.event_type = 'accept'))::numeric
            / count(*) filter (where e.event_type = 'impression')
       else 0 end as accept_rate_30d
from public.iris_insights i
left join public.iris_insight_events e
  on e.insight_id = i.id
  and e.occurred_at > now() - interval '30 days'
group by i.generator, i.org_id;
```

### 10.3 Auto-disable

A pg_cron job runs nightly:

```sql
update public.iris_generator_registry
set is_enabled = false, auto_disabled_at = now()
where generator in (
  select generator from public.mv_iris_generator_health
  where impressions_30d > 200 and dismissal_rate_30d > 0.7
);
```

A receipt is written to `iris_generator_disabled_log` and a slack alert fires (`generator-health-alerts` channel, integration TBD).

### 10.4 Wired into Lap 4 acceptance

Lap 4 acceptance gate adds: "no critical generator (signal_strength default ≥ 0.8) auto-disabled in last 14 days." This catches regressions early.

---

## 11. Test Plan

### 11.1 Unit tests (vitest)

- `src/iris/generators/<each>/<generator>.test.ts` — fixture-driven; ≥4 cases each: empty, threshold-just-below, threshold-just-above, big-signal.
- `src/iris/ranking.test.ts` — top-3 stability under perturbation.
- `src/components/iris/InsightSlot.test.tsx` — RTL: empty state renders, list renders, dismiss fires RPC, accept fires RPC, "+N more" expands.

### 11.2 Integration (Supabase test harness)

- Insert seed insights for 3 personas; call `iris_get_insights`; assert ranks correct per persona.
- Trigger validation: insert with unregistered generator → expect throw.
- Dedupe index: insert two with same `(org_id, page_key, entity_id, generator, context_hash)` while active → expect unique violation.

### 11.3 E2E (Playwright)

- Soft pilot user (Brad Cameron @ Nexus) logs in → schedule page renders ≥1 weather insight when fixture forecast has rain.
- Dismiss reduces visible count and writes telemetry.
- Morning-brief worker fixture run produces email artifact and inbox row.

### 11.4 Coverage audit script

`scripts/audit-insight-coverage.mjs`:
- Parse `src/pages/**/*.tsx`.
- For each page, assert presence of `<InsightSlot pageKey=`.
- Cross-check `pageKey` against `iris_generator_registry` seed.
- Fail CI on missing slot or unregistered key.

### 11.5 Visual regression

Storybook stories for each insight type + empty + overflow + skeleton. Chromatic baseline.

---

## 12. Migration Order

1. **(prereq)** Phase 1 context fabric tables landed.
2. **(prereq)** Phase 2 specialist edge functions deployed.
3. **(prereq)** Phase 3 pgvector + KB tables landed.
4. **(prereq)** Day 31 `scheduled_insights_*` infra deployed (queue, cron, worker).
5. `20261101000000_iris_insights.sql` — types, tables, RLS, RPCs, MV.
6. `20261101000100_iris_generator_registry_seed.sql` — seed all 50 generators with metadata.
7. `20261102000000_iris_inbox.sql` — inbox table + RPC.
8. `20261103000000_iris_brief_cron.sql` — pg_cron entries for `morning_brief_fanout` and the auto-disable job.
9. App PR: ship `InsightSlot`, registry, hooks, first 5 generators (schedule, budget, punch, crews, RFI).
10. App PR: backfill 45 remaining generators across 6 PRs (~7 generators each).
11. App PR: home-page cross-entity rail.
12. Final PR: enable coverage audit script in CI, flip exit-gate workflow on.

Each app PR ships its own Storybook stories and tests.

---

## 13. Risks + Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Insight fatigue | High | Trust loss | Cap at 3 visible; dismissal_decay; auto-disable >70% dismissal generators |
| LLM cost from per-page generators | Medium | Margin hit | Default deterministic; LLM only in worker; 24h cache via `context_hash` |
| Generator regression unnoticed | Medium | Quality drift | Generator-health MV; Lap 4 acceptance gate references it |
| Coverage missing | Medium | Pillar 8 not closed | CI audit script blocks PR if any of 50 pages lacks slot |
| Spammy morning brief | Medium | Unsubscribe spike | Quiet hours, top-5 cap, unsubscribe one click, weekend default-off for foreman |
| Stale insight survival | Medium | Data drift | `expires_at` per generator; cron sweeps to `expired` |
| Persona misclassification | Low | Wrong recipient | Persona pulled from auth claims; user can override on profile |
| RLS bypass via cross-project rail | Low | Security | Cross-project queries scoped by `org_id` and project membership |
| Telemetry table balloons | Medium | DB cost | 12-month retention per ADR-008; partition by month if rows >100M |
| Worker thrash on cron drift | Low | Duplicate emails | `last_brief_sent_at` 18h dedupe in worker |
| Auto-disable false positive | Low | Useful generator killed | Min 200 impressions before eligibility; manual re-enable RPC; receipt log |

---

## 14. Edge Cases

1. **User with 0 projects**: home-page cross-entity rail renders empty-state copy ("Connect a project to see IRIS insights"). InsightSlot hidden from project-scoped pages they can't reach.
2. **User across multiple orgs**: insights filtered by `org_id` in JWT. Switching org invalidates all `iris_insights` queries (handled by react-query `queryClient.invalidateQueries`).
3. **Soft-pilot vs production data**: ADR-006 row-level. `is_soft_pilot` flag on inserts; cross-tenant leak impossible.
4. **Insight expires while user is reading**: client uses 60s `staleTime`. Expired insight stays on screen until next refetch (acceptable).
5. **User dismisses then reaccepts via undo**: 5s undo toast; if accepted, `iris_insight_events` retains the dismiss event but `state` reverts to `active`.
6. **Two generators produce overlapping insights** (e.g. `cascade_detector` and `lookahead_drift` both flag same activity): dedupe by `context_hash` collision path is per-generator. Cross-generator near-duplicates handled by ranking (the higher-scored one wins; the other still exists, just shows in "+more").
7. **Generator throws in worker**: catch, write to `iris_generator_errors`, decrement that generator's `health_score`, do not block other generators.
8. **Migration race with active insights**: drop trigger temporarily, run migration, restore. Coordinated by deploy script.
9. **Page doesn't exist yet but route added later**: `pageKey` registered before page ships. CI audit will fail if a page exists without slot, but won't fail on a registered key with no page.
10. **Inbox grows unbounded**: per-user retention 90 days; `iris_inbox_cleanup` cron runs daily.
11. **Mobile narrow viewport**: `placement = 'header-rail'` collapses to accordion under page title; tested at 375px.
12. **Accessibility**: `aria-live="polite"` on slot when new insight arrives; icons all `aria-hidden`; CTAs have `aria-label` for icon-only states.
13. **Weather forecast unavailable**: `weather_outdoor_risk` returns empty insights with `context_hash = 'forecast-unavailable'`. No insight better than wrong insight.
14. **Money math edge**: any generator that adds dollars must use `src/types/money.ts`. CI lint forbids raw `+` on `*_cents` variables (lint rule landed Lap 1).
15. **Permission gate fails on action click**: `PermissionGate` renders disabled CTA with tooltip "Requires X role." Insight still shows.
16. **Generator returns >25 insights**: insert all but rank limits visible to 25; flag in metrics if a generator regularly emits >10.
17. **Citation reference deleted after insight created**: side panel renders "Source no longer available"; insight not auto-withdrawn (still has analytical value).
18. **Soft-pilot user runs generator that depends on integration not configured**: generator returns empty + records `context_hash = 'integration-missing'`; no error noise.

---

## 15. Exit Gate (CI Workflow Stub)

`.github/workflows/iris_phase4_gate.yml`:

```yaml
name: IRIS Phase 4 Acceptance Gate

on:
  schedule:
    - cron: '0 14 * * 1'  # Mon 09:00 ET
  workflow_dispatch:

jobs:
  coverage-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: node scripts/audit-insight-coverage.mjs --strict

  empirical-gate:
    runs-on: ubuntu-latest
    needs: coverage-audit
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Compute weekly metrics
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: node scripts/iris-phase4-gate.mjs
      # The script calls iris_phase4_gate_metrics() RPC and asserts:
      # - pages_with_nonempty_slot_pct >= 0.80 (over rolling 7d, per active user)
      # - pushed_vs_query_ratio          >= 0.50
      # - morning_brief_open_rate_pilot  >= 0.40
      # On failure, writes to docs/audits/PHASE_4_GATE_FAILURE_<date>.md and opens a tracking issue.
```

`scripts/iris-phase4-gate.mjs` exits non-zero when any threshold misses, and prints a concrete table.

The gate is informational until T-130; advisory-blocking after that. It blocks Phase 5 from starting if any threshold misses by >5%.

---

## 16. Dependencies + Sequencing

### 16.1 Hard prerequisites

| Phase / Spec | What we need from it | Why |
|--------------|---------------------|-----|
| Phase 1 (Context Fabric) | `fabric.*` accessor APIs, cached entity views | Generators read pre-shaped data; without fabric they'd N+1 the UI |
| Phase 2 (Specialists) | Money / Schedule / Code edge fn endpoints | Synthesis generators delegate; LLM cost contained |
| Phase 3 (pgvector KB) | Spec-section lead-time KB; closeout doc patterns; cross-project examples | Generators 5.7, 5.10 cite knowledge |
| Day 31 SCHEDULED_INSIGHTS_SPEC | pg_cron, pgmq, scheduled-insights-worker scaffold | Morning brief is a fan-out fork of this worker |
| Day 32–35 detectors | cascade/aging/variance/staffing/weather signals | Multiple generators consume detector outputs as inputs |
| ADR-003 | Hybrid cron architecture | We extend, not replace |
| ADR-004 | Citation side panel | InsightCard citations open here |
| ADR-006 | Pilot data isolation | `is_soft_pilot` on iris_insights |
| ADR-007 | Auto-withdraw policy | `expires_at` + state transition |
| ADR-008 | Telemetry retention | `iris_insight_events` 12mo / 24mo soft pilot |

### 16.2 Sequencing inside Phase 4 (Lap 5, T-180 → T-120)

- **Week 1** (T-180): land schema migration + RPCs + registry seed.
- **Week 2**: ship `InsightSlot` + 5 generators (schedule, budget, punch, crews, RFI). Add Storybook + tests. Wire telemetry.
- **Week 3**: 12 more generators (submittals, daily log, photos, plans, COs, pay-apps, closeout, safety, training, time-tracking, time-approvals, weather).
- **Week 4**: 12 more generators (deliveries, contacts, vendors, lien-waivers, prequal, bid-leveler, RFP, dailies-history, equipment, mileage, expenses, analytics).
- **Week 5**: 16 remaining (audit-log, settings, integrations, billing, profile, exports, search, drafts-inbox, /iris, project-list, project-detail, all home pages × 4, landing-empty).
- **Week 6**: morning-brief-worker + email rendering + inbox.
- **Week 7**: cross-entity rail on home pages.
- **Week 8**: telemetry MV + auto-disable cron + coverage audit script.
- **Week 9**: visual regression + accessibility audit.
- **Week 10–12** (T-130 → T-120): pilot dial-in. Empirical gate runs weekly. Tune thresholds. Disable noisy generators. Receipt: `PHASE_4_RECEIPT_<date>.md` with concrete numbers.

### 16.3 Downstream unblocks

- Phase 5 (push notifications) consumes `iris_inbox_messages` rows.
- Phase 6 (cross-project memory) replaces hard-coded cross-entity generators with vector-search-driven ones.
- Phase 7 (Slack/Teams) routes morning brief to those channels.

---

## 17. Footer

- **Spec ID:** PHASE_4_PER_PAGE_INSIGHT_AMBIENT_SPEC_2026-05-08
- **Author:** IRIS native-experience working group
- **Owner:** Walker
- **Status:** Draft (pre-implementation)
- **Window:** Lap 5, T-180 → T-120 (Nov 2026 → Jan 2027)
- **Closes pillar:** 8 — Ambient & Proactive Insights
- **Companion specs:** PHASE_1_CONTEXT_FABRIC_SPEC, PHASE_2_SPECIALISTS_SPEC, PHASE_3_PGVECTOR_KB_SPEC, PHASE_5_PUSH_AND_AGENT_SPEC, PHASE_6_CROSS_PROJECT_MEMORY_SPEC
- **Companion ADRs:** ADR-003 (hybrid cron), ADR-004 (citation side panel), ADR-006 (pilot isolation), ADR-007 (auto-withdraw), ADR-008 (telemetry retention)
- **Companion receipts:** SCHEDULED_INSIGHTS_SPEC_2026-05-04, DAY_31_SCHEDULED_INSIGHTS_RECEIPT_2026-05-04, DAY_32_CASCADE_DETECTOR_RECEIPT_2026-05-04, DAY_33_AGING_DETECTOR_RECEIPT, DAY_34_VARIANCE_DETECTOR_RECEIPT, DAY_35_STAFFING_DETECTOR_RECEIPT
- **Reverse-engineered milestone:** RE-MILE-T-150 ("Per-page IRIS coverage ≥80%") and RE-MILE-T-130 ("Morning brief open rate ≥40% on pilot")
- **Tracker row:** Lap 5 Phase 4 — leave Status blank until exit gate green.
- **One-line review:** "Make the IRIS surface universal so every page feels watched, ranked so it doesn't feel noisy, and ambient so the most important thing reaches the right person before they ask."
- **Remember:** typecheck stays green, money math goes through `src/types/money.ts`, no resurrected dead stores, every action CTA wrapped in `PermissionGate`, every generator costs the LLM nothing on the cold path, and the empty state always renders.
