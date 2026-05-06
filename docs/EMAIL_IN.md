# Email-In — Architect/Sub replies thread automatically

> The wedge against Procore: **architects refuse to log into a portal**.
> They hit Reply on the email. We have to make Reply work.

This document describes the inbound email pipeline: how a reply from a
non-app-user lands as a threaded comment on the right RFI / Submittal /
Change Order with the right confidence band and the right side effects.

---

## The scenario this prevents

GC sends RFI #047 to architect's CA. The CA's inbox is hostile to "click
here to view in app" links — they're busy on three other jobs. They hit
Reply, type "Per attached sketch, use 4-inch setdown," and send. In
Procore, that reply lands in the GC's personal inbox; the GC has to
manually open Procore, find the RFI, paste the reply, mark it answered.
Half the time the GC forgets and the RFI shows "no response" while the
work is already done from the email.

We close that loop by treating inbound email as a first-class
event source.

---

## How threading works (priority order)

### 1. Plus-tag in Reply-To (high confidence)

When we send an outbound email about RFI `<uuid>`, we set:

```
Reply-To: reply+rfi-<uuid>@reply.sitesync.app
```

`buildReplyToAddress(entity_type, entity_id)` in
`src/lib/emailThreading.ts` builds this. The inbound webhook regex-parses
the recipient and routes with high confidence.

Aliases: `rfi`, `sub` (submittal), `co` (change_order).

### 2. In-Reply-To header (medium confidence)

We stamp every outbound email with a deterministic Message-ID and log it
in `outbound_email_log`. When the architect's client preserves
`In-Reply-To: <our-message-id>`, the threader looks the message up in
the log and recovers the entity reference.

Useful when an enterprise mail server strips plus-tags but preserves
RFC threading headers (most do).

### 3. Subject regex (low confidence)

Last resort: `RFI #047`, `Submittal #045`, `CO #14`. Built by
`buildSubjectWithThreadHint` so the entity reference is always at the
front of the subject. Combined with the sender's email matching a
`directory_contacts` row, we resolve to a project + entity number → entity ID.

### 4. None of the above

Reply lands in `inbound_email_unmatched`. PM gets a daily digest. One-tap
"This is a reply to RFI #X" → manual thread.

---

## Side effects when a reply threads

| Detected | Action |
|---|---|
| OOO auto-reply (subject/body matches OOO regex) | Pause SLA clock via `rfi_clock_pauses`. No comment inserted. |
| High-confidence threading + clear approval keyword | Insert reply as comment + draft status transition into `drafted_actions` for GC approval (Iris draft). NOT auto-applied. |
| High-confidence threading, no clear keyword | Insert reply as comment. Resolve any open escalation in `rfi_escalations`. |
| Medium/low-confidence threading | Insert reply as comment, marked `threading_confidence = 'low'`. UI shows "auto-threaded" badge. |
| Status transition keyword detected | Always create as Iris draft (`drafted_actions`), never auto-apply, regardless of confidence. The architect saying "approved" should never silently change a contractually significant status. |

---

## Why we don't auto-transition status

A judge will read these emails. Auto-transitioning a submittal to
"approved" because the architect's body matched `/approved/` is a
liability. The Iris draft pattern keeps a human in the loop:

1. Reply lands.
2. Comment inserted. Escalation cleared.
3. Iris drafts: "Architect's reply suggests approval. Apply?"
4. GC reviews the reply text + the draft status change. One tap.
5. Status changes; audit log records who approved the auto-suggestion.

This matches the existing `IrisApprovalGate` pattern in the codebase.
Reuse the component, don't build a new approval surface.

---

## Bullet-proofing — failures we explicitly handle

| Failure | Behavior |
|---|---|
| Webhook auth fails (provider misconfigured) | Function returns 401. Provider's retry policy handles transient. We don't fake-accept. |
| Reply targets a recipient we don't recognize | Lands in `inbound_email_unmatched`. Never silently dropped. |
| Plus-tag stripped by enterprise mailserver | Falls back to In-Reply-To. Still high or medium confidence. |
| In-Reply-To header missing | Falls back to subject regex. Marked low confidence. |
| Subject regex matches but entity number doesn't exist on this project | `inbound_email_unmatched` row with `triage_notes='subject pointed at #X but no such entity in project'`. |
| Sender's email isn't in `directory_contacts` | Subject-regex still works without it; we just don't have a project hint, so we search all projects. If the number is ambiguous across projects, lands in unmatched. |
| Same reply delivered twice (provider retry) | Index on `(message_id)` prevents duplicate comments. The second insert fails silently and we return 200. |
| Architect's reply contains an attachment | We accept the body for now; attachments are dropped to v1. v2: store in same project's storage bucket and link as `media_links`. |
| Architect replies in HTML only, no text part | We extract a plain-text fallback by stripping tags. Logged with a warning. |
| Reply is an OOO + a real answer combined | OOO regex wins; SLA pauses. The "real answer" never gets recorded. *Tradeoff accepted* — the alternative is parsing every OOO for a buried answer, which is unreliable. The architect can re-reply when they're back. |

---

## Provider configuration (Resend)

Steps to wire this up in production (admin task — NOT done by code):

1. In Resend dashboard, add an **inbound parsing** route for
   `*@reply.sitesync.app` pointing at
   `https://<supabase-ref>.supabase.co/functions/v1/inbound-email`.
2. Configure DNS for `reply.sitesync.app`:
   - MX → Resend's inbound MX
   - TXT → SPF + DKIM
3. Set Supabase secrets:
   - `REPLY_DOMAIN=reply.sitesync.app`
   - `MESSAGE_ID_DOMAIN=mail.sitesync.app`
   - `RESEND_INBOUND_SECRET=<from Resend>` (used to verify webhook signature)

Until these are configured, the function deploys fine but never receives
input. No production impact.

---

## Files in this stream

```
supabase/functions/inbound-email/index.ts                          NEW
supabase/functions/notification-queue-worker/index.ts              NEW (the actual sender)
src/lib/emailThreading.ts                                          NEW
supabase/migrations/20260430120000_inbound_email_threading.sql     NEW
supabase/migrations/20260430160000_notification_queue_worker_cron.sql NEW
docs/EMAIL_IN.md                                                   NEW
```

## How outbound + inbound chain together

`sla-escalator` (Tab A) decides *what* to send and enqueues into
`notification_queue`. It does **not** call Resend directly.
`notification-queue-worker` is the actual sender — it pulls pending rows
on a 1-minute cron, builds the email with the threading helpers
(`buildReplyToAddress` / `buildMessageId` / `buildSubjectWithThreadHint`),
calls Resend, then writes to `outbound_email_log` so `inbound-email` can
later match `In-Reply-To` headers.

The threading helpers live in `src/lib/emailThreading.ts` (SSR/Browser
side) and are duplicated inline in
`supabase/functions/notification-queue-worker/index.ts` (Deno can't
import from `src/`). Keep them in sync — both are pure functions with
no dependencies, so divergence is unlikely but should be checked when
either side changes.

If a future caller wants to send mail **directly** (bypassing the
queue), they should also use these helpers and write to
`outbound_email_log`:

```ts
import {
  buildReplyToAddress,
  buildMessageId,
  buildSubjectWithThreadHint,
  stripAngleBrackets,
} from '@/lib/emailThreading'

// when sending:
const messageId = buildMessageId('rfi', rfi.id)
const replyTo = buildReplyToAddress('rfi', rfi.id)
const subject = buildSubjectWithThreadHint('rfi', rfi.number, rfi.title)

// after Resend send returns success:
await sb.from('outbound_email_log').insert({
  message_id: stripAngleBrackets(messageId),
  entity_type: 'rfi',
  entity_id: rfi.id,
  to_emails: recipients,
  subject,
})
```

Without this, In-Reply-To lookup fails and threading drops to subject-regex.
Plus-tag still works regardless because Tab A reads the helper for
Reply-To.

---

## What's left (out of scope for this stream)

- HTML→text body cleanup (currently raw `text` field used, HTML stripped naively).
- Attachment ingestion + linkage (v2).
- DKIM verification (currently relies on provider-side filtering).
- "Reply digest" daily email of unmatched items to project admins.
- UI surface to render `inbound_email_replies` as comments on the entity
  detail view (Tab A's `InboxRow` does the inbox; the entity *detail*
  view picks up the comment thread separately).
