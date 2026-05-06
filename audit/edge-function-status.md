# Edge Function Status

> Generated 2026-04-29T19:26:10Z against project `hypxrmcppjfbtlwuoafc` (ss pm).
> Re-run with: `bun scripts/audit-edge-functions.ts`

| Metric | Count |
| --- | --- |
| Deployed (cloud) |       54 |
| In repo |      101 |
| **Missing** (in repo, not deployed) | **      47** |
| Zombie (deployed, not in repo) | 0 |
| Version drift (sha mismatch) | _not yet computed — needs git-sha → ezbr_sha256 mapping_ |

## Missing — in repo but not deployed

These were built in recent sessions but never `supabase functions deploy`-ed.
Most are from this session (Apr 29 – May 3 streams).

- audit-posture-snapshot
- auto-link-media
- closeout-package-generator
- coi-expiration-watcher
- compliance-pack
- cross-project-search
- customer-s3-export
- digest-flusher
- draft-change-order
- draft-daily-log
- entity-magic-link
- extract-floor-outline
- extract-inspection-report
- extract-quote-pdf
- extract-spec-pdf
- inbound-email
- insurance-bond-watcher
- iris-rfi-response-draft
- iris-suggest
- lien-waiver-generator
- meeting-minutes-generator
- monthly-report-generator
- notification-queue-worker
- osha300-csv-export
- owner-payapp-preview
- owner-weekly-digest
- p6-export
- p6-import
- parse-walkthrough-capture
- payapp-audit
- payapp-reconciliation
- portfolio-summary-refresh
- preliminary-notice-watcher
- prevailing-wage-sync
- procore-import-extended
- refresh-materialized-views
- scim-v2
- sealed-entity-export
- sla-escalator
- sso-oidc-handler
- sso-saml-handler
- transcribe-walkthrough
- vision-verify-link
- walkthrough-pdf
- weather-multi-source
- webhook-dispatch
- wh347-generator

## Deploy commands

```bash
# Deploy a single function
supabase functions deploy <name> --project-ref hypxrmcppjfbtlwuoafc

# Deploy all missing in one batch (after reviewing the list above)
while read f; do
  supabase functions deploy "$f" --project-ref hypxrmcppjfbtlwuoafc
done < <(cat <<MISSING
audit-posture-snapshot
auto-link-media
closeout-package-generator
coi-expiration-watcher
compliance-pack
cross-project-search
customer-s3-export
digest-flusher
draft-change-order
draft-daily-log
entity-magic-link
extract-floor-outline
extract-inspection-report
extract-quote-pdf
extract-spec-pdf
inbound-email
insurance-bond-watcher
iris-rfi-response-draft
iris-suggest
lien-waiver-generator
meeting-minutes-generator
monthly-report-generator
notification-queue-worker
osha300-csv-export
owner-payapp-preview
owner-weekly-digest
p6-export
p6-import
parse-walkthrough-capture
payapp-audit
payapp-reconciliation
portfolio-summary-refresh
preliminary-notice-watcher
prevailing-wage-sync
procore-import-extended
refresh-materialized-views
scim-v2
sealed-entity-export
sla-escalator
sso-oidc-handler
sso-saml-handler
transcribe-walkthrough
vision-verify-link
walkthrough-pdf
weather-multi-source
webhook-dispatch
wh347-generator
MISSING
)
```

## Zombie functions

None on the current sweep. A zombie is a function deployed on the cloud
project whose source is no longer in the repo — it usually means a
function was deleted in code but never `supabase functions delete`-ed.

## Version drift detection

Each deployed function carries an `ezbr_sha256` — the hash of the
deployed bundle. To detect drift between source and deployed:

1. Build each repo function locally (`supabase functions deploy --dry-run`)
2. Compare the resulting bundle hash to `ezbr_sha256`
3. Flag mismatches

This is a TODO in `scripts/audit-edge-functions.ts` — the dry-run
bundle-hash command isn't a stable Supabase CLI feature today. When
it lands, drift detection becomes one query.

## Per-function findings (deployed surface)

The newest deployed function on the project (most recently `updated_at`)
is `classify-drawing` at version 24. Functions still on version 1 are
candidates to verify whether they're actively used or can be deleted.

| Function | Deployed version | Last update |
| --- | --- | --- |
| classify-drawing | 24 | 2026-04-22 |
| extract-schedule-pdf | 17 | 2026-04-19 |
| ai-rfi-draft | 10 | 2026-04-15 |
| ai-daily-summary, ai-schedule-risk | 9 | 2026-04-12 |
| (most others) | 8 | 2026-03-30 |
| (this session's audit-scales et al.) | 1 | 2026-04-27 |

## Action items

1. Review the **47 missing functions** above. Many are this session's
   work — confirm they're complete, then batch-deploy.
2. Run `bun scripts/audit-edge-functions.ts` weekly to catch new drift.
3. Wire `platform-health` (this stream) so the dashboard shows
   green/red without manual scripts.
