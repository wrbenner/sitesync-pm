// emailThreading — pure helpers for building outbound emails that thread
// correctly when the recipient hits Reply.
//
// Two pieces:
//   1. buildReplyToAddress(entity_type, entity_id) — produces
//      `reply+rfi-<id>@reply.sitesync.app`, the plus-tag the inbound
//      handler uses to route replies with high confidence.
//   2. buildMessageId(entity_type, entity_id) — produces a deterministic
//      Message-ID we stamp on the outgoing email AND log into
//      outbound_email_log. When the architect's client preserves the
//      In-Reply-To header (most do), the inbound handler can match by
//      Message-ID even if the plus-tag was stripped.
//
// Why both? Some corporate exchange servers strip plus-tags. Some webmail
// clients drop In-Reply-To. With both in play, the bad case where neither
// works is rare. Subject regex is the last-resort fallback in the inbound
// handler.

const REPLY_DOMAIN =
  // Set in Vercel env / supabase secrets. Defaults to a sane shape so dev
  // builds don't crash. Production must set this to the inbound domain
  // configured at the email provider.
  (typeof process !== 'undefined' && process.env?.REPLY_DOMAIN) ||
  'reply.sitesync.app'

const MESSAGE_ID_DOMAIN =
  (typeof process !== 'undefined' && process.env?.MESSAGE_ID_DOMAIN) ||
  'mail.sitesync.app'

export type ThreadableEntityType = 'rfi' | 'submittal' | 'change_order'

const ALIAS: Record<ThreadableEntityType, string> = {
  rfi: 'rfi',
  submittal: 'sub',
  change_order: 'co',
}

export function buildReplyToAddress(
  entityType: ThreadableEntityType,
  entityId: string,
): string {
  const alias = ALIAS[entityType]
  return `reply+${alias}-${entityId}@${REPLY_DOMAIN}`
}

export function buildMessageId(
  entityType: ThreadableEntityType,
  entityId: string,
): string {
  // RFC 5322: angle-bracketed unique identifier. Include entity ref in the
  // local part so it's debuggable in logs. Append a 6-byte random suffix
  // so multiple sends on the same entity get unique message IDs.
  const random = randomHex(12)
  const alias = ALIAS[entityType]
  return `<${alias}-${entityId}-${random}@${MESSAGE_ID_DOMAIN}>`
}

export function buildSubjectWithThreadHint(
  entityType: ThreadableEntityType,
  number: number | string,
  base: string,
): string {
  const label = entityType === 'change_order' ? 'CO' : entityType === 'submittal' ? 'Submittal' : 'RFI'
  const numStr = typeof number === 'number' ? `#${number}` : `#${number}`
  // Lead with the entity ref so subject-regex fallback hits every time.
  // Some clients drop the "Re: " prefix on long threads — don't bury the
  // identifier behind it.
  return `${label} ${numStr} — ${base}`
}

// Tab A's outbound-email path should call this so we have a record of
// every message we sent and can match In-Reply-To headers later.
export interface OutboundEmailLogEntry {
  message_id: string         // un-bracketed form for DB indexing
  entity_type: ThreadableEntityType
  entity_id: string
  to_emails: string[]
  subject: string
  sent_at: string
}

export function stripAngleBrackets(messageId: string): string {
  return messageId.replace(/^<|>$/g, '').trim()
}

// ── Helpers ───────────────────────────────────────────────────────────────

function randomHex(bytes: number): string {
  // Works in Deno, browsers, and modern Node.
  const buf = new Uint8Array(bytes)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf)
  } else {
    for (let i = 0; i < bytes; i++) buf[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}
