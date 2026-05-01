# SiteSync Public API v1 — Contract reference for webhook + integration consumers

> Reference for Tab A's `webhook-dispatch`, the Tab C "external_ids" Procore-import handlers,
> and any future integration that needs to know what entity shapes look like over the wire.

This is the existing **inbound** REST API at `supabase/functions/api-v1/`. The webhook
dispatch system being built by Tab A should fire **outbound** webhook events whose
payloads mirror the same entity shapes — keeping inbound and outbound symmetric.

---

## Mounting + auth

- Deployed as `api-v1` edge function. Public URL: `https://<project>.supabase.co/functions/v1/api-v1/v1/...`
- Auth: bearer API key via `Authorization: Bearer sk_live_...` header. Keys live on
  the org-scoped `api_tokens` table (Tab A is shipping the management UI for this).
- Scopes: each token carries a list of permitted scopes; routes call `requireScope(ctx, 'rfis:read')`
  etc. Tab A's webhook config UI should let admins pick which event types fire per token.

## Versioning

- All paths prefixed with `/v1/`. Breaking changes get `/v2/`.
- Date-based API version pinning (à la Stripe) **not yet implemented** — flag for future.
- Backward-incompatible field changes within v1 require a deprecation window with
  `Deprecation:` response header announcing the sunset date.

## Conventions (matched from Stripe)

- **Cursor pagination.** `GET /v1/projects/<id>/rfis?starting_after=<id>&limit=50`. Response
  envelope is `{ data: [...], has_more: bool, next_cursor: string | null }`. No offset/page.
- **Idempotency.** Mutations accept `Idempotency-Key: <uuid>` header. Repeat requests with
  the same key return the cached response. TTL 24h. Implemented in `getCachedResponse` /
  `cacheResponse` helpers.
- **Expand.** `?expand[]=ball_in_court&expand[]=spec_section_lookup` to inline related
  resources. Implemented in `parseExpand`.
- **Errors.** RFC 7807 problem-details JSON: `{ type, title, status, detail, instance }`.
  Webhook dispatch should emit the same shape on failure for consumer parity.
- **Rate limit.** Per-token bucket via `checkRateLimit`. Exceeds → 429 with
  `Retry-After` header. **Outbound webhooks should respect the same envelope** so
  consumer integrations can throttle uniformly.

---

## Existing endpoints (entity surface area)

| Method | Path | Scope | What it does |
|---|---|---|---|
| `GET` | `/v1/projects` | `projects:read` | List projects accessible to the token |
| `GET` | `/v1/projects/{id}` | `projects:read` | Single project |
| `GET` | `/v1/projects/{id}/rfis` | `rfis:read` | List RFIs on project |
| `POST` | `/v1/projects/{id}/rfis` | `rfis:write` | Create RFI (idempotent) |
| `GET` | `/v1/projects/{id}/rfis/{rfi_id}` | `rfis:read` | Single RFI |
| `PATCH` | `/v1/projects/{id}/rfis/{rfi_id}` | `rfis:write` | Update RFI |
| `GET` | `/v1/projects/{id}/tasks` | `tasks:read` | List tasks |
| `POST` | `/v1/projects/{id}/tasks` | `tasks:write` | Create task |
| `GET` | `/v1/projects/{id}/tasks/{task_id}` | `tasks:read` | Single task |
| `PATCH` | `/v1/projects/{id}/tasks/{task_id}` | `tasks:write` | Update task |
| `GET` | `/v1/projects/{id}/submittals` | `submittals:read` | List submittals |
| `POST` | `/v1/projects/{id}/submittals` | `submittals:write` | Create submittal |
| `GET` | `/v1/projects/{id}/daily-logs` | `daily_logs:read` | List daily logs |
| `POST` | `/v1/projects/{id}/daily-logs` | `daily_logs:write` | Create daily log |
| `GET` | `/v1/projects/{id}/change-orders` | `change_orders:read` | List change orders |
| `POST` | `/v1/projects/{id}/change-orders` | `change_orders:write` | Create change order |
| `GET` | `/v1/projects/{id}/budget` | `budget:read` | Budget summary |
| `GET` | `/v1/projects/{id}/members` | `members:read` | Project members |
| `GET` | `/v1/projects/{id}/punch-items` | `punch_items:read` | List punch items |
| `POST` | `/v1/projects/{id}/punch-items` | `punch_items:write` | Create punch item |

**Missing surfaces** (Tab A's webhook system can fire events for these even though
no inbound API handler exists yet — a webhook fired on a state change doesn't require
a corresponding REST handler. Add the handlers later as customers ask for them.):

- Submittals update / get-by-id
- Daily log update / get-by-id
- Change order update / get-by-id
- Punch item update / get-by-id
- Budget mutations
- Members create / update / delete
- Files (upload via signed URL, list, delete)
- Drawings + revisions
- Schedule (phases + activities)
- Pay applications
- Contracts + insurance certificates
- Crews + time tracking
- Audit log read (for the integration team's data warehouse)
- Compliance reports (WH-347 PDF download, OSHA 300 CSV)

---

## Webhook event contract (what Tab A is building)

Outbound webhook events fire when entity state changes. Each event body:

```jsonc
{
  "id": "evt_<uuid>",
  "type": "rfi.status_changed",                  // or rfi.created, etc.
  "created": "2026-05-02T10:34:21.483Z",         // ISO 8601, UTC
  "api_version": "v1",                           // matches REST API version
  "data": {
    "object": { /* the full entity, identical shape to GET /v1/projects/<id>/rfis/<id> */ },
    "previous_attributes": { /* for *.updated events: only changed fields */ }
  },
  "request": {
    "id": "req_<uuid>",                          // server-side request id
    "idempotency_key": "<key or null>"           // if mutation came via REST
  },
  "livemode": true                               // false for sandbox / test orgs
}
```

### Standard event types

- `<entity>.created`
- `<entity>.updated`
- `<entity>.deleted` (rare — most entities soft-delete; surfaces a status field change instead)
- `<entity>.status_changed` (for entities with discrete state machines: rfi/submittal/co/punch)
- `rfi.answered` (alias for `rfi.status_changed` to `answered` — convenience for
  the SLA-resolution use case Tab A's escalator already cares about)
- `submittal.approved`, `submittal.rejected`, `submittal.revise_resubmit` (same convenience)
- `change_order.approved`, `change_order.rejected`
- `pay_app.submitted`, `pay_app.approved`, `pay_app.rejected`

Per-event subscription is configured per-webhook in
`org_outbound_webhooks` (Tab A schema).

### Delivery guarantees

- At-least-once delivery (idempotency keys make this safe).
- Retry policy: 1m, 5m, 30m, 2h, 12h, 24h, 48h, 72h. After 8 failed deliveries, mark
  webhook `failing`; admin sees an alert in `/admin/webhooks`.
- Each delivery includes `Webhook-Signature: t=<unix>,v1=<sha256_hmac>` header.
  Signature key is per-webhook, rotatable. Same scheme Stripe uses.
- Receivers MUST respond with 2xx within 30 seconds. Slow responses → retry.

### Replay

- Admins can replay any past event from the `/admin/webhooks/<id>/events` view. Replays
  don't increment retry counters.

---

## Coordination notes for Tab A

**1. Reuse the entity-shape canonicalization.** The REST handlers
(`listRFIs`, `getRFI`, etc.) build the over-the-wire JSON from raw rows.
Webhook dispatch should call those same builders so a webhook payload's
`data.object` is identical to what `GET /v1/projects/<id>/rfis/<id>` returns.

Otherwise consumers will write code that breaks every time the REST shape
shifts. Single source of truth: extract the row-to-JSON mapper into
`supabase/functions/shared/entityShapes/` and call from both places.

**2. Use the existing scope system.** Don't build a parallel ACL for
webhook event subscriptions. If a token has `rfis:read`, it can subscribe
to `rfi.*` events. If it doesn't, it can't.

**3. Honor the SLA-resolution path that already exists.**
Tab A's prior round shipped `rfi_escalations` + the SLA escalator.
Outbound webhook for `rfi.answered` should NOT be a duplicate — it's the
same business event surfaced to external consumers. Wire it to fire from
the same DB trigger that already updates `rfi_escalations.resolved_at`.

**4. The signing-secret rotation flow.** Document that admins can mint a
new signing secret with both the old and new active for a 24h overlap
window. Receivers can verify with either during the window.

**5. Don't expose webhook-dispatch's internal queue.** Use a dedicated
`outbound_webhook_deliveries` table; service-role-only writes; admin-only
reads. The `notification_queue` table is for transactional emails and
should stay that way.

---

## Coordination notes for Tab C

**1. Procore migration's external_ids columns.** When importing entities from
Procore, write the original Procore ID into `<table>.external_ids->>'procore'`.
The REST API can then accept `?external_id[procore]=<id>` query params for round-trip
lookups. Useful for customers running a hybrid Procore + SiteSync setup during migration.

**2. P6 round-trip.** Schedule import/export should preserve P6's activity IDs the
same way — `schedule_phases.external_ids->>'p6'`. Then the round-trip is lossless.

---

## Open items (not in scope this turn)

- Per-version date pinning (`Stripe-Version: 2026-04-30` header)
- GraphQL surface (Procore has one; we can add later if a customer asks)
- WebSocket / Server-Sent Events stream for real-time consumers (alternative to webhooks)
- OpenAPI 3.1 spec generation from the route table — would unlock auto-generated SDKs
- Bulk endpoint variants (`POST /v1/projects/<id>/rfis/batch`) — useful for migration
- Custom field support — if/when we add per-org custom fields, the REST surface needs
  to expose them; document how

---

## Quick test

```sh
# List RFIs
curl -H "Authorization: Bearer sk_live_..." \
  "https://<project>.supabase.co/functions/v1/api-v1/v1/projects/<uuid>/rfis"

# Create RFI with idempotency
curl -X POST \
  -H "Authorization: Bearer sk_live_..." \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"title": "Slab elevation conflict", "priority": "high"}' \
  "https://<project>.supabase.co/functions/v1/api-v1/v1/projects/<uuid>/rfis"
```
