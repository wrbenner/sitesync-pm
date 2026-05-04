# Daily Log Auto-Draft

The 5pm super shouldn't stare at a blank form. Tab A turns 45 minutes of typing into 5 minutes of review.

## The five sections

Match the AIA G701 daily-report format 1:1:

1. **Weather & Conditions** — one sentence, observed values from `weather_observations` (never forecast unless we explicitly say so).
2. **Manpower** — table by (trade, sub_company), pulled from `crew_attendance` check-ins, falling back to roster when subs didn't use the app.
3. **Work Performed** — 3–8 bullets drawn from photo captions + voice/text captures + schedule progress + material deliveries. Each bullet carries source provenance and a CSI cost code (when confidence ≥ 0.6).
4. **Issues / Delays** — RFIs filed today + meeting action items + any explicit incident logs.
5. **Visitors / Inspections** — inspection records with pass/fail + inspector names. Falls back to "(none recorded)" honestly.

## Architecture

```
                                                ┌──────────────────────────────┐
                                                │   src/types/dailyLogDraft.ts │
                                                └──────────────┬───────────────┘
                                                               │ types
              ┌────────────────────────────────────────────────┴────────────────────────────┐
              ▼                                                                             ▼
  ┌─────────────────────────────────┐                              ┌──────────────────────────────────┐
  │  src/lib/dailyLogDrafting/      │                              │  supabase/functions/             │
  │    sections.ts                  │   ←── kept in sync ──→       │    draft-daily-log/sections.ts   │
  │    costCodeInferer.ts           │                              │    (deterministic mirror)        │
  │    photoCaption.ts              │                              │                                  │
  │    index.ts                     │                              │  + promptBuilder.ts              │
  │                                 │                              │  + index.ts (Deno.serve entry)   │
  │  __tests__/sections.test.ts     │                              └──────────────────────────────────┘
  └─────────────────┬───────────────┘                                              │
                    │                                                              │
                    ▼                                                              ▼
  ┌─────────────────────────────────┐                              ┌──────────────────────────────────┐
  │  src/components/dailylog/       │                              │      drafted_actions row         │
  │    AutoDraftPanel.tsx           │ ←── reads payload via ──     │      action_type='daily_log.     │
  │    AutoDraftSection.tsx         │      drafted_actions         │      draft', UNIQUE per          │
  │    __demo__/                    │      query                   │      (project_id, date)          │
  └─────────────────────────────────┘                              └──────────────────────────────────┘
```

## Edge function flow

1. **Auth** — try `authenticateRequest` first (user-initiated path); fall back to service role check (cron).
2. **Idempotency check** — `SELECT id FROM drafted_actions WHERE project_id = ? AND action_type = 'daily_log.draft' AND payload->>'date' = ? AND status IN ('pending','approved')`. Hits the partial unique index from `20260430130000_daily_log_drafts.sql`.
3. **Aggregate `DayContext`** — best-effort queries against weather, crew_attendance, daily_log_entries, RFIs, meetings + action items, schedule events, inspections, procurement deliveries. Missing tables silently no-op.
4. **Deterministic assemble** — `assembleDailyLogDraft(ctx)` produces a fully-structured `DraftedDailyLog`. This step always succeeds.
5. **Polish with Claude** (optional) — `claude-sonnet-4-6` rewrites bullet `text` fields only. System prompt is `cache_control: ephemeral` for cross-project cache hits across the daily fan-out. Up to 3 retries on 5xx/429; falls back to deterministic output on persistent failure.
6. **Persist** — UPDATE if a pending row exists for this date, else INSERT. Status `'pending'`, ready for the IrisApprovalGate.

## Provenance contract

Every bullet stores its sources by `kind` + `ref`. The polish step is **forbidden** from changing source ids — only `.text` and `.weather_summary` fields are merged. The legal record stays intact.

```ts
{
  text: 'Rebar mat installed in pier 7 footing',
  sources: [{ kind: 'photo_caption', ref: 'p001' }],
  cost_code: '03 30 00',
  cost_code_confidence: 0.85
}
```

## PII handling

`stripPii(text)` runs on every user-generated string before it's stored:

- Emails → `[email redacted]`
- Phone numbers (separated or 10-digit) → `[phone redacted]`
- Title-Case full names (≥ 2 words, each ≥ 3 letters) → `[name redacted]`

The vision caption prompt also forbids identifying individuals; captions are post-processed with the same regex set.

## Cost codes

Deterministic keyword-rule system in `costCodeInferer.ts`. Codes only attach when confidence ≥ 0.6:

- 1 keyword match → 0.45 (dropped)
- 2 keyword matches → 0.7
- 3+ keyword matches → 0.85
- Drawing-pin zone hint match → +0.1 boost (capped at 0.95)

CSI MasterFormat 2018 codes for ~17 common trades. Add rules; never rename codes — the productivity rollups in Reports key off them.

## Failure modes — covered

| Failure | Fix |
| --- | --- |
| Super already wrote the log | Function checks `daily_logs.status`; existing approved-or-submitted log → no-op |
| Day had zero captures | Section reason: "No photos captured today — generated from schedule activity only." |
| Vision caption fails mid-batch | Captions are best-effort; missing ones don't appear; function still returns 200 |
| Claude 5xx / 429 | 3 retries with exponential backoff; then deterministic-only draft |
| DST transition | All math in UTC; display formats use `projects.timezone` |
| Two supers race | UNIQUE partial index; whoever inserts first wins; concurrent caller updates the same row |
| Forecast vs observed weather | `weather.weather_source` is `'observed'` whenever the historical weather row was present; `'forecast'` is explicit in the summary text |
| Missing inspector record | Visitors section: "(none recorded)" — super edits before signing |
| Sparse crew check-ins | Roster fallback rows show "(scheduled — attendance unconfirmed)" |
| Wrong cost code | Confidence floor 0.6; lower → no code attached, super tags manually |
| Hallucinated photo caption | Sonnet (not Haiku) for accuracy; 12-word max; PII filter; "no construction activity visible" sentinel |
| PII in voice transcript | `stripPii()` regex set runs before persistence |
| Owner contests log | Full provenance stored in `drafted_actions.citations`; audit-exportable |

## Cron setup (admin-apply)

`pg_cron` schedule in your Supabase dashboard or in a follow-up migration:

```sql
-- Daily 5pm draft fan-out across active projects.
-- Each project's "5pm" is computed in projects.timezone server-side.
SELECT cron.schedule(
  'draft-daily-log-5pm',
  '0 * * * *',  -- every hour; the function picks projects whose local time is 17:00
  $$
    SELECT net.http_post(
      url := 'https://<your-project>.functions.supabase.co/draft-daily-log',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('project_id', p.id, 'date', to_char(now() AT TIME ZONE p.timezone, 'YYYY-MM-DD'))
    )
    FROM projects p
    WHERE p.status = 'active'
      AND extract(hour from now() AT TIME ZONE p.timezone) = 17;
  $$
);
```

The function is also safe to invoke directly:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/draft-daily-log" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"<uuid>","date":"2026-04-30"}'
```

Response:

```json
{ "ok": true, "draft_id": "<uuid>", "status": "pending", "payload": <DraftedDailyLog> }
```

## Files

```
src/types/dailyLogDraft.ts                                 — wire types
src/lib/dailyLogDrafting/index.ts                          — public surface
src/lib/dailyLogDrafting/sections.ts                       — assembler (pure)
src/lib/dailyLogDrafting/costCodeInferer.ts                — CSI rules (pure)
src/lib/dailyLogDrafting/photoCaption.ts                   — Anthropic vision batch
src/lib/dailyLogDrafting/__tests__/sections.test.ts        — 23 vitest cases
src/components/dailylog/AutoDraftPanel.tsx                 — main UI
src/components/dailylog/AutoDraftSection.tsx               — reusable section
src/components/dailylog/__demo__/AutoDraftPanel.demo.tsx   — fixture render
supabase/functions/draft-daily-log/index.ts                — edge fn entry
supabase/functions/draft-daily-log/sections.ts             — server mirror
supabase/functions/draft-daily-log/promptBuilder.ts        — system prompt + parse
supabase/migrations/20260430130000_daily_log_drafts.sql    — uniqueness + tz
```

## Wiring required (deferred to user)

1. `src/pages/daily-log/index.tsx` — fetch the latest pending `drafted_actions` row for today, render `<AutoDraftPanel draft={…} onApprove onReject onRegenerateSection />` above the existing `DailyLogForm`. On approve, invoke the existing `services/iris/executors/dailyLog.ts` executor.
2. `supabase/config.toml` (or pg_cron migration) — schedule the 5pm fan-out per the snippet above.
3. `ANTHROPIC_API_KEY` env var — set in Supabase function secrets.
4. (Optional) Wire the photo-upload handler to call `photoCaption.captionPhotos()` so captions are populated before the daily fan-out fires.
