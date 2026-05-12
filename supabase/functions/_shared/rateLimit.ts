// _shared/rateLimit.ts — BRT subsystem 8 §4.1 helper for edge functions.
//
// Usage in any edge function:
//
//   import { enforceRateLimit, RATE_LIMIT_BUCKETS } from '../_shared/rateLimit.ts'
//
//   const ok = await enforceRateLimit(supabase, orgId, RATE_LIMIT_BUCKETS.AI_CALL)
//   if (!ok) {
//     return new Response('Too many requests', {
//       status: 429,
//       headers: { 'Retry-After': '60' },
//     })
//   }
//
// The defaults below match the bucket-key documentation in the
// 20261009000001_rate_limit_buckets.sql migration. Edit there first if you
// change a default — keep the SQL comment and this file in sync.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface BucketDef {
  key: string
  limit: number
  windowSec: number
  /** Suggested Retry-After header value in seconds when the bucket is full. */
  retryAfter: number
}

export const RATE_LIMIT_BUCKETS = {
  AI_CALL:         { key: 'ai_call',         limit: 200,  windowSec: 3600, retryAfter: 60  } as BucketDef,
  SIGNUP:          { key: 'signup',          limit: 5,    windowSec: 3600, retryAfter: 300 } as BucketDef,
  INVITE_SEND:     { key: 'invite_send',     limit: 50,   windowSec: 3600, retryAfter: 60  } as BucketDef,
  PASSWORD_RESET:  { key: 'password_reset',  limit: 3,    windowSec: 3600, retryAfter: 600 } as BucketDef,
  WEBHOOK_INBOUND: { key: 'webhook_inbound', limit: 1000, windowSec: 60,   retryAfter: 5   } as BucketDef,
  PDF_EXPORT:      { key: 'pdf_export',      limit: 20,   windowSec: 3600, retryAfter: 60  } as BucketDef,
  BULK_IMPORT:     { key: 'bulk_import',     limit: 5,    windowSec: 86400, retryAfter: 3600 } as BucketDef,
} as const

/**
 * Returns true if the call should proceed; false if the bucket is full.
 * Errors are logged and treated as "allow" — rate limiting failing closed
 * would take the entire app down on a Postgres outage.
 */
export async function enforceRateLimit(
  supabase: SupabaseClient,
  orgId: string,
  bucket: BucketDef,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_org_id: orgId,
      p_bucket_key: bucket.key,
      p_limit: bucket.limit,
      p_window_sec: bucket.windowSec,
    })
    if (error) {
      console.error(`[rate-limit] RPC failed for ${bucket.key}:`, error)
      return true // fail open
    }
    return data === true
  } catch (err) {
    console.error(`[rate-limit] unexpected error for ${bucket.key}:`, err)
    return true // fail open
  }
}

/** Build a 429 Response with Retry-After. Convenience for call sites. */
export function tooManyRequestsResponse(bucket: BucketDef, extraHeaders: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({
      error: {
        message: `Rate limit exceeded for ${bucket.key}. Try again later.`,
        type: 'rate_limit_exceeded',
        bucket: bucket.key,
      },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(bucket.retryAfter),
        ...extraHeaders,
      },
    },
  )
}
