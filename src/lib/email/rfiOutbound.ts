// ── rfiOutbound ─────────────────────────────────────────────────────────
// Single-source-of-truth helper for sending an RFI to an external recipient
// via the existing send-email edge function.
//
// Why this is its own module:
//   • Three distinct callers need to send the same email:
//       - RFIDistributeDialog (single recipient, ad-hoc)
//       - RFIBulkEditPanel    (N recipients across N RFIs)
//       - RFIEditPanel        (chip-editor "Distribution" save path)
//   • Threading must be identical across all three so inbound replies
//     hit the same plus-tag matcher and the same In-Reply-To lookup.
//   • The Bugatti contract for outbound: `from` carries a deterministic
//     plus-tag, the `Message-ID` is stamped client-side and persisted
//     onto rfi_distributions BEFORE the network call so a flake in the
//     send doesn't lose the tracking ID.
//
// Behavior:
//   1. Validate recipient.
//   2. Generate a Message-ID of the form
//      <rfi-{distributionId}.{timestamp}@reply.sitesync.app>.
//   3. Insert the rfi_distributions row first (durable record).
//   4. Patch the row with message_id (so the inbound function can
//      thread via the In-Reply-To header even if step 5 partially
//      fails).
//   5. Insert into outbound_email_log (the inbound function's lookup
//      table for In-Reply-To threading).
//   6. Call send-email with reply-to + headers.
//   7. On Resend success, set delivery_status='sent' (the bounce
//      webhook flips it to delivered/bounced/complained later).
//   8. On send-email failure, mark delivery_status='unknown' with
//      bounce_reason capturing the error.
//
// Per CLAUDE.md, money math doesn't apply here, but the same audit
// principle does: one row per recipient per RFI, never a batch row.

import { supabase, fromTable } from '../supabase'
import { logAuditEntry } from '../auditLogger'

const REPLY_DOMAIN = 'reply.sitesync.app'

export interface RFIOutboundContext {
  rfiId: string
  rfiNumber: number | null
  rfiTitle: string
  rfiQuestion: string | null
  projectId: string
  projectName: string | null
  detailUrl: string
  /** Sender id for sent_by + audit. */
  senderUserId: string | null
  /** Optional note from the GC PM, included verbatim in the body. */
  message?: string | null
}

export interface RFIOutboundRecipient {
  email: string
  name?: string | null
}

export interface RFIOutboundResult {
  distributionId: string
  messageId: string
  recipientEmail: string
  ok: boolean
  error?: string
}

/** RFC-style Message-ID for a given distribution row. */
function buildMessageId(distributionId: string): string {
  // Use the distribution UUID as the local part so the inbound
  // function can do an O(1) lookup on the indexed column.
  return `<rfi-${distributionId}.${Date.now()}@${REPLY_DOMAIN}>`
}

/** The plus-tagged reply-to address that the inbound function parses. */
function buildReplyTo(rfiId: string, fromName: string): string {
  // Format: "RFI Reply <reply+rfi-<uuid>@reply.sitesync.app>"
  return `${fromName} <reply+rfi-${rfiId}@${REPLY_DOMAIN}>`
}

/** Compose the HTML body. Kept conservative — TipTap question may
    contain rich HTML; we render it inside a styled wrapper but never
    inject untrusted user HTML at the outer layer. */
function buildHtml(ctx: RFIOutboundContext, sanitizedQuestion: string, replyHint: string, deepLink: string): string {
  const numLabel = ctx.rfiNumber != null ? `RFI-${String(ctx.rfiNumber).padStart(3, '0')}` : 'RFI'
  const projectLabel = ctx.projectName ?? 'SiteSync project'
  return `<!doctype html>
<html><body style="font-family:Helvetica,Arial,sans-serif;color:#1A1613;max-width:640px;margin:0 auto;">
  <div style="background:#F47820;padding:16px;color:#fff;font-weight:700;font-size:14px;letter-spacing:1px;">SITESYNC PM</div>
  <div style="padding:24px 24px 8px 24px;">
    <div style="font-size:11px;color:#8C857E;text-transform:uppercase;letter-spacing:0.04em;font-weight:600;">${escapeHtml(projectLabel)}</div>
    <h1 style="font-size:18px;margin:6px 0 6px 0;color:#1A1613;font-weight:700;">${escapeHtml(numLabel)}: ${escapeHtml(ctx.rfiTitle)}</h1>
  </div>
  <div style="padding:0 24px 24px 24px;">
    <div style="background:#F5F4F1;border-radius:8px;padding:16px;font-size:14px;line-height:1.6;color:#1A1613;">
      ${sanitizedQuestion}
    </div>
    ${ctx.message ? `<div style="margin-top:12px;font-size:13px;color:#5C5550;border-left:3px solid #F47820;padding:6px 0 6px 12px;">${escapeHtml(ctx.message)}</div>` : ''}
    <p style="margin:18px 0 6px 0;font-size:13px;color:#5C5550;">${escapeHtml(replyHint)}</p>
    <p style="margin:6px 0 18px 0;">
      <a href="${escapeAttr(deepLink)}" style="color:#F47820;text-decoration:underline;font-weight:600;">Open in SiteSync →</a>
    </p>
  </div>
  <div style="padding:14px 24px;color:#8C857E;font-size:11px;border-top:1px solid #E8E5DF;">
    Reply directly to this email — your reply will appear in the ${escapeHtml(numLabel)} thread automatically.
  </div>
</body></html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s)
}

/** Strip script/style tags from rich-text Question content. The
    composer is TipTap-controlled so the surface area is small, but we
    still defend at the boundary. */
function sanitizeQuestion(html: string | null): string {
  if (!html) return '<em style="color:#8C857E">No question text on this RFI.</em>'
  return html
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}

interface SendOneParams {
  ctx: RFIOutboundContext
  recipient: RFIOutboundRecipient
}

/**
 * Persist + send a single recipient. Caller fans out across recipients
 * with Promise.allSettled.
 */
export async function sendRFIOutboundEmail({
  ctx,
  recipient,
}: SendOneParams): Promise<RFIOutboundResult> {
  const recipientEmail = recipient.email.trim()
  if (!recipientEmail) {
    return {
      distributionId: '',
      messageId: '',
      recipientEmail,
      ok: false,
      error: 'empty recipient',
    }
  }

  // Step 1 — insert the durable record FIRST. Failures from here on
  // out leave a row that can be retried; failures before this leave
  // nothing in the audit chain.
  const { data: inserted, error: insertErr } = await fromTable('rfi_distributions')
    .insert({
      rfi_id: ctx.rfiId,
      recipient_email: recipientEmail,
      recipient_name: recipient.name?.trim() || null,
      message: ctx.message?.trim() || null,
      sent_by: ctx.senderUserId,
      delivery_status: 'sent',
      delivery_status_at: new Date().toISOString(),
    } as never)
    .select('id')
    .single()
  if (insertErr || !inserted) {
    return {
      distributionId: '',
      messageId: '',
      recipientEmail,
      ok: false,
      error: insertErr?.message ?? 'failed to insert rfi_distributions row',
    }
  }
  const distributionId = (inserted as { id: string }).id

  // Step 2 — stamp the Message-ID derived from the row id.
  const messageIdAngled = buildMessageId(distributionId)
  const messageIdBare = messageIdAngled.replace(/^<|>$/g, '')

  await fromTable('rfi_distributions')
    .update({ message_id: messageIdBare } as never)
    .eq('id' as never, distributionId)

  // Step 3 — log to outbound_email_log so inbound function's
  // In-Reply-To lookup hits.
  await fromTable('outbound_email_log')
    .insert({
      message_id: messageIdBare,
      entity_type: 'rfi',
      entity_id: ctx.rfiId,
      to_emails: [recipientEmail],
      subject: buildSubject(ctx),
      sent_by_user: ctx.senderUserId,
    } as never)

  // Step 4 — call send-email.
  const subject = buildSubject(ctx)
  const sanitizedQuestion = sanitizeQuestion(ctx.rfiQuestion)
  const replyHint = 'Reply directly to this email — your reply will appear in the RFI thread.'
  const html = buildHtml(ctx, sanitizedQuestion, replyHint, ctx.detailUrl)

  const fromName = ctx.rfiNumber != null
    ? `RFI #${ctx.rfiNumber} via SiteSync`
    : 'SiteSync'
  const fromAddress = `${fromName} <reply+rfi-${ctx.rfiId}@${REPLY_DOMAIN}>`
  const replyTo = buildReplyTo(ctx.rfiId, fromName)

  try {
    const { error: sendErr } = await supabase.functions.invoke('send-email', {
      body: {
        to: recipientEmail,
        from: fromAddress,
        subject,
        html,
        // Resend honors `reply_to` and `headers` per their API docs.
        reply_to: replyTo,
        headers: {
          'Message-ID': messageIdAngled,
          'X-SiteSync-RFI-Id': ctx.rfiId,
          'X-SiteSync-Distribution-Id': distributionId,
        },
        template: 'custom',
      },
    })
    if (sendErr) {
      // Mark the row so the UI surfaces the failure without blocking
      // other recipients. The chip will render an unknown state.
      await fromTable('rfi_distributions')
        .update({
          delivery_status: 'unknown',
          delivery_status_at: new Date().toISOString(),
          bounce_reason: sendErr.message ?? 'send-email invoke failed',
        } as never)
        .eq('id' as never, distributionId)
      return { distributionId, messageId: messageIdBare, recipientEmail, ok: false, error: sendErr.message }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'send-email invoke threw'
    await fromTable('rfi_distributions')
      .update({
        delivery_status: 'unknown',
        delivery_status_at: new Date().toISOString(),
        bounce_reason: msg,
      } as never)
      .eq('id' as never, distributionId)
    return { distributionId, messageId: messageIdBare, recipientEmail, ok: false, error: msg }
  }

  // Step 5 — per-row audit (Chain Audit Prep Check 5). One row per
  // recipient. Never a batch row.
  await logAuditEntry({
    projectId: ctx.projectId,
    entityType: 'rfi',
    entityId: ctx.rfiId,
    action: 'update',
    afterState: {
      distribution_id: distributionId,
      recipient: recipientEmail,
      message_id: messageIdBare,
    },
    metadata: { kind: 'rfi_distribute_email' },
  })

  return { distributionId, messageId: messageIdBare, recipientEmail, ok: true }
}

function buildSubject(ctx: RFIOutboundContext): string {
  const numLabel = ctx.rfiNumber != null ? `RFI-${String(ctx.rfiNumber).padStart(3, '0')}` : 'RFI'
  const projectLabel = ctx.projectName ? `[${ctx.projectName}] ` : ''
  return `${projectLabel}${numLabel}: ${ctx.rfiTitle}`.slice(0, 200)
}

/**
 * Convenience wrapper: fan out to N recipients, returning a count
 * summary suitable for warn-toast surfacing.
 */
export async function sendRFIOutboundEmailFanout(
  ctx: RFIOutboundContext,
  recipients: RFIOutboundRecipient[],
): Promise<{ ok: number; failed: number; results: RFIOutboundResult[] }> {
  const results = await Promise.all(
    recipients.map((r) => sendRFIOutboundEmail({ ctx, recipient: r })),
  )
  const ok = results.filter((r) => r.ok).length
  const failed = results.length - ok
  return { ok, failed, results }
}
