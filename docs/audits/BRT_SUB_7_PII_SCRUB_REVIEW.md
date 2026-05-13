# BRT Sub-7 PII Scrub Review

Owner: Walker. Audience: SiteSync security review, BRT Phase 1 Sub-7 sign-off.

This document is the authoritative register of every analytics event emitted by SiteSync (per `src/lib/observability/events.ts`), the fields each event carries, what the centralized scrubber strips (per `src/lib/observability/scrubbers.ts`), and a PII-risk assessment for each event.

The I4 invariant of Sub-7 states: **no event payload reaching Sentry, PostHog, or Slack contains any key in `SENSITIVE_KEYS`.** This document is the per-event proof.

## The `SENSITIVE_KEYS` set

Defined in `src/lib/observability/scrubbers.ts`. Any object key whose lowercase name is in this set is **dropped entirely** (not masked) before the payload crosses an observability boundary.

### Auth + secrets

- `password`
- `passwordhash`
- `token`
- `access_token`
- `refresh_token`
- `secret`
- `api_key`
- `apikey`
- `session`
- `jwt`
- `authorization`
- `cookie`

### Customer content (PII or trade secrets)

- `draft_text`
- `rfi_body`
- `rfi_question`
- `submittal_body`
- `daily_log_body`
- `daily_log_summary`
- `meeting_notes`

### Billing

- `card_number`
- `cardnumber`
- `cvc`
- `cvv`
- `stripe_secret`
- `webhook_secret`

The scrubber is recursive — nested objects and arrays are walked. Cycles produce `'[Circular]'`. Matching is case-insensitive on key names (the SENSITIVE_KEYS set itself is lowercase, and lookup applies `.toLowerCase()`).

Strategy is **drop-not-mask**. A redacted `"[REDACTED]"` value still leaks shape ("we saw a token here"). Dropping the key entirely yields zero shape leakage at the cost of harder debugging when a field is intermittently missing.

## Per-event register

### Auth / signup funnel

#### `signup_started`

- **Props shape:** `{ source?: string }`
- **Keys stripped if present:** none — `source` is a UTM-style identifier, not PII.
- **PII risk:** none.

#### `signup_email_submitted`

- **Props shape:** `Record<string, never>` (empty object).
- **Keys stripped if present:** N/A — no props.
- **PII risk:** none. The email itself is not in the props; PostHog associates the event with the anonymous user ID until `signup_completed`.

#### `signup_email_verified`

- **Props shape:** `Record<string, never>`.
- **Keys stripped if present:** N/A.
- **PII risk:** none.

#### `signup_oauth_started`

- **Props shape:** `{ provider: 'google' | 'microsoft' | 'apple' }`
- **Keys stripped if present:** none — provider is a fixed enum.
- **PII risk:** none.

#### `signup_oauth_callback`

- **Props shape:** `{ provider: string; success: boolean }`
- **Keys stripped if present:** none.
- **PII risk:** none. If the OAuth provider's response is ever attached as a sub-object (it should not be), `token`, `access_token`, `id_token`, and `authorization` would be stripped.

#### `signup_org_provisioned`

- **Props shape:** `{ org_id: string }`
- **Keys stripped if present:** none — `org_id` is a UUID and treated as a join key, not PII in isolation.
- **PII risk:** low. UUIDs do not identify natural persons by themselves; risk is incremental in joins with other data sources.

#### `signup_completed`

- **Props shape:** `{ org_id: string; total_seconds: number }`
- **Keys stripped if present:** none.
- **PII risk:** low (same as `signup_org_provisioned`).

### Onboarding funnel

#### `onboarding_step_viewed`

- **Props shape:** `{ step: number; role: string }`
- **Keys stripped if present:** none.
- **PII risk:** none. `role` is a fixed enum from the role set (owner, admin, project_manager, etc.).

#### `onboarding_step_completed`

- **Props shape:** `{ step: number; role: string; duration_ms: number }`
- **Keys stripped if present:** none.
- **PII risk:** none.

#### `onboarding_step_skipped`

- **Props shape:** `{ step: number }`
- **Keys stripped if present:** none.
- **PII risk:** none.

#### `onboarding_completed`

- **Props shape:** `{ total_duration_ms: number; role: string; sample_data_seeded: boolean }`
- **Keys stripped if present:** none.
- **PII risk:** none.

#### `onboarding_iris_demo_run`

- **Props shape:** `Record<string, never>`.
- **Keys stripped if present:** N/A.
- **PII risk:** none. If draft text were ever attached as a `draft_text` key, it would be stripped — but the schema explicitly forbids props on this event.

### Activation

#### `first_rfi_created`

- **Props shape:** `{ org_id: string; project_id: string }`
- **Keys stripped if present:** none. RFI body, question, and subject are **not** attached to this event. If a future change ever attaches `rfi_body` or `rfi_question`, the scrubber would strip them.
- **PII risk:** low.

#### `first_iris_draft_generated`

- **Props shape:** `{ org_id: string; entity_type: string }`
- **Keys stripped if present:** none. `draft_text` is explicitly never attached. If a future change attaches it, scrubber strips.
- **PII risk:** low.

#### `first_iris_draft_approved`

- **Props shape:** `{ org_id: string; entity_type: string }`
- **Keys stripped if present:** none.
- **PII risk:** low.

### Billing

#### `trial_started`

- **Props shape:** `{ org_id: string; price_id: string }`
- **Keys stripped if present:** none. `price_id` is the Stripe Price ID (e.g. `price_1Abc...`), a public identifier safe to log.
- **PII risk:** none.

#### `trial_will_end`

- **Props shape:** `{ org_id: string; days_remaining: number }`
- **Keys stripped if present:** none.
- **PII risk:** none.

#### `subscription_created`

- **Props shape:** `{ org_id: string; cycle: 'monthly' | 'annual' }`
- **Keys stripped if present:** none.
- **PII risk:** none.

#### `subscription_canceled`

- **Props shape:** `{ org_id: string; reason: string }`
- **Keys stripped if present:** none. `reason` is constrained to a fixed enum at the call site (e.g. `voluntary`, `payment_failed`, `admin_revoked`). Free-text customer feedback flows through a separate channel and never enters the event payload.
- **PII risk:** low.

#### `invoice_payment_succeeded`

- **Props shape:** `{ org_id: string; amount_cents: number }`
- **Keys stripped if present:** none. Card details, CVC, and Stripe secrets are explicitly stripped if ever attached.
- **PII risk:** none.

#### `invoice_payment_failed`

- **Props shape:** `{ org_id: string; reason: string }`
- **Keys stripped if present:** none. `reason` is a Stripe failure code enum (e.g. `card_declined`, `insufficient_funds`).
- **PII risk:** none.

### Marketing site

#### `marketing_cta_click`

- **Props shape:** `{ cta_id: string; page: string }`
- **Keys stripped if present:** none.
- **PII risk:** none.

#### `marketing_page_view`

- **Props shape:** `{ page: string }`
- **Keys stripped if present:** none.
- **PII risk:** none.

### Help

#### `help_article_viewed`

- **Props shape:** `{ article_id: string }`
- **Keys stripped if present:** none.
- **PII risk:** none.

## Summary

| Event | PII risk |
| --- | --- |
| signup_started | none |
| signup_email_submitted | none |
| signup_email_verified | none |
| signup_oauth_started | none |
| signup_oauth_callback | none |
| signup_org_provisioned | low |
| signup_completed | low |
| onboarding_step_viewed | none |
| onboarding_step_completed | none |
| onboarding_step_skipped | none |
| onboarding_completed | none |
| onboarding_iris_demo_run | none |
| first_rfi_created | low |
| first_iris_draft_generated | low |
| first_iris_draft_approved | low |
| trial_started | none |
| trial_will_end | none |
| subscription_created | none |
| subscription_canceled | low |
| invoice_payment_succeeded | none |
| invoice_payment_failed | none |
| marketing_cta_click | none |
| marketing_page_view | none |
| help_article_viewed | none |

**No event in the current registry carries medium or high PII risk.** Every `org_id` and `project_id` carries low risk on the basis of join-attack potential, not direct identifiability.

## Verification procedure

To verify the scrubber strips every key in `SENSITIVE_KEYS`:

```bash
npm test -- scrubbers
```

The test suite at `src/lib/observability/scrubbers.test.ts` asserts:

1. For each key in `SENSITIVE_KEYS`, a payload `{ [key]: 'leak-canary' }` produces an output without that key.
2. Case-insensitivity holds: `{ Password: 'x' }` is stripped just like `{ password: 'x' }`.
3. Nested objects: `{ user: { password: 'x' } }` → `{ user: {} }`.
4. Arrays: `[{ token: 'x' }]` → `[{}]`.
5. Cycles do not crash: `const a = { token: 'x' }; a.self = a` → terminates with `[Circular]` substituting at the cycle point.
6. Primitives are passed through unchanged.
7. Empty input handling: `null`, `undefined`, `{}`, `[]` all return their input shape.

This test runs in CI on every PR and blocks merge if any assertion fails. The I4 invariant is enforced at the test level, not just by code review.

## Change procedure

To add a new event:

1. Add the `AppEvent` discriminator in `src/lib/observability/events.ts`.
2. Add the volume label in `EVENT_VOLUME`.
3. Update this register with the new event's props and PII assessment.
4. If the event introduces a new sensitive field name, add it to `SENSITIVE_KEYS` in `src/lib/observability/scrubbers.ts`.
5. Add a corresponding test in `scrubbers.test.ts`.
6. Run `npm test -- scrubbers` and `npm run typecheck`.

To add a sensitive key without a new event: add to `SENSITIVE_KEYS`, add a test, ship. The scrubber will strip it everywhere automatically.
