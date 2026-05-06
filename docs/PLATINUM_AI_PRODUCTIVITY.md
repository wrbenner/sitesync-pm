# PLATINUM · AI Productivity

Iris-driven suggestions, document generators, and AI extraction with confidence gating. AI extraction is NEVER auto-applied without confidence support.

## Architecture

| Layer | Files | Responsibility |
| --- | --- | --- |
| Iris policy | `src/lib/iris/suggestPolicy.ts` | Pure: 0-3 suggestions per entity, frequency-throttled, 24h dedup. |
| AI extract | `src/lib/aiExtract/{specPdf,inspectionReport,quotePdf,confidenceGate}.ts` | Confidence-gated extractors. |
| Document gen | `src/lib/documentGen/*.ts` | Pure generators that take a snapshot, return a `GeneratedDocument`. |
| Edge functions | `supabase/functions/iris-suggest`, `iris-rfi-response-draft`, `extract-spec-pdf`, `extract-inspection-report`, `extract-quote-pdf`, `monthly-report-generator`, `owner-weekly-digest`, `meeting-minutes-generator`, `closeout-package-generator`, `digest-flusher` | The runtime side. |
| UI | `src/components/iris/IrisSuggests.tsx`, `IrisSuggestionCard.tsx` | Per-entity suggestion mount. |
| Persistence | `supabase/migrations/2026050312000{2,3,4}_*.sql` | suggestion history + doc gen runs + extraction results. |

## Confidence gating contract

Per the spec failure-mode table, AI extraction is NEVER auto-applied without confidence support:

| Confidence | Status | UI behavior |
| --- | --- | --- |
| `>= 0.85` | `auto_apply` | Applied automatically; review available. |
| `0.7 – 0.85` | `auto_apply_with_warning` | Applied, but a warning banner surfaces and flagged fields are highlighted. |
| `< 0.7` | `manual_review` | Held in a queue; user must accept/reject/modify before applying. |

Per-field confidence below `0.7` flags individual fields even when overall confidence is high.

Each extraction stores `pdf_page` + `bbox` so the UI can highlight the source region (hallucination verification).

## Iris suggestion policy

| Rule | Trigger | Confidence | Suggestion title |
| --- | --- | --- | --- |
| RFI awaiting response | `sent_at > 5d` and not answered | `0.6 + (days-5)*0.03` (cap 0.95) | "Iris drafted a response — review?" |
| Punch item open | `created_at > 7d` and not closed/verified | `0.65 + (days-7)*0.025` (cap 0.92) | "Iris drafted a follow-up to the sub" |
| Daily log empty | `entry_count == 0` and `local_hour >= 17` | 0.82 | "Iris drafted today's log from your captures" |
| Submittal pending | `submitted_at > 14d` and `status == 'pending_review'` | `0.7 + (days-14)*0.015` (cap 0.9) | "Iris drafted an architect nudge" |
| CO over $50k, no quote | `cost_impact > 50000 && !quote_attached` | 0.88 | "Iris suggested asking the sub for backup" |

Throttle:
- `'off'` → no suggestions.
- `'occasional'` → max 1 suggestion, only if confidence ≥ 0.8.
- `'always'` → up to 3 suggestions, confidence ≥ 0.5.

24h dedup driven by `iris_suggestion_history.suggested_at`.

## Wiring required (existing files)

Mount the orchestrator on each entity's detail page. Each is a single line:

| File | Line (approximate) | Mount |
| --- | --- | --- |
| `src/pages/rfis/[id].tsx` | After the header / inside the main column | `<IrisSuggests entityType="rfi" entityId={id} projectId={projectId} />` |
| `src/pages/submittals/[id].tsx` | Same pattern | `<IrisSuggests entityType="submittal" ... />` |
| `src/pages/change-orders/[id].tsx` | Same pattern | `<IrisSuggests entityType="change_order" ... />` |
| `src/pages/punch-list/[id].tsx` | Same pattern | `<IrisSuggests entityType="punch_item" ... />` |
| `src/pages/daily-log/index.tsx` | Today's log section | `<IrisSuggests entityType="daily_log" ... />` |

The component renders nothing when there are no suggestions (so it's safe to mount unconditionally). It calls the `iris-suggest` edge function on mount and renders 0-3 cards.

`src/App.tsx` registrations needed (route → page):
- `/admin/workflows` → `AdminWorkflowsPage` (Tab C)
- `/notifications/inbox` → `InboxPage`
- `/notifications/preferences` → `PreferencesPage`

## Failure modes addressed

| Mode | Mitigation |
| --- | --- |
| AI hallucination applied as truth | `confidenceGate` enforces `auto_apply` only at ≥ 0.85; per-field flags below 0.7. |
| Quote total mismatched line items | `extract-quote-pdf` demotes confidence to 0.65 (manual_review) on sum mismatch. |
| Same suggestion shown repeatedly | 24h dedup via `iris_suggestion_history`. |
| User overwhelmed by suggestions | `suggestion_frequency` user preference; default `'occasional'` (max 1). |
| Suggestion accepted but execution fails | `IrisSuggestionCard` reuses `IrisApprovalGate` which writes to `drafted_actions`; existing executor handles failure. |
| Document tampering | `document_gen_runs.content_hash` (SHA-256 of generated doc) + `snapshot_at` provenance. |
| Long-running generation invalidated mid-flight | Snapshot frozen at edge-function start; generators are pure. |

## Failure modes deferred

| Mode | Reason / how to address later |
| --- | --- |
| Cross-entity suggestions (e.g., "merge these duplicate RFIs") | Current matchers are per-entity. Add a project-level matcher in a future wave. |
| Streaming generators (incremental PDF rendering) | Pure batch generators are simpler; switch to streaming if user-perceived latency exceeds 8s. |
| Hallucination eval harness | Defer until a few weeks of prod extraction data. |

## Cron entries to add

```sql
-- Owner weekly digest, every Monday at 7 AM CT
SELECT cron.schedule(
  'owner-weekly-digest-monday',
  '0 12 * * 1',  -- 12:00 UTC = 07:00 CDT (adjust per project tz convention)
  $$ <invoke owner-weekly-digest with each project_id> $$
);

-- Monthly report on the 1st of each month at 6 AM
SELECT cron.schedule(
  'monthly-report-1st',
  '0 11 1 * *',
  $$ <invoke monthly-report-generator with month=YYYY-MM> $$
);
```

## Conventions adopted

- Edge functions use `claude-sonnet-4-6-20250930` with `cache_control: { type: 'ephemeral' }` on the system prompt for prompt-caching.
- Generators are PURE; snapshot loading is the edge function's job.
- Provenance: every doc-gen run records `snapshot_at`, `content_hash`, `triggered_by`.
- Iris draft → `drafted_actions` row (existing schema). Approval flows through the existing `IrisApprovalGate`.

## Known limitations

- The pure `loadSnapshot` in `src/lib/documentGen/snapshot.ts` returns an empty shell — the real snapshot building happens inline in each edge function. This avoids importing supabase from `lib/`. If multiple edge functions need the same query bundle, factor into `supabase/functions/shared/snapshotLoader.ts`.
- The `change_order.request_backup` suggestion currently maps to the `'rfi.draft'` action_type as a stand-in. A future migration should add a `change_order.request_backup` action_type to `drafted_actions`.
- The visual workflow builder uses native pointer events; multi-touch (mobile) is not optimized.
