# Phase 0E: Edge Function Security Hardening

## Pre-Requisite
Paste `00_SYSTEM_CONTEXT.md` before executing this prompt.

## Audit Findings Summary

### Security Violations by Function

All five functions have critical security gaps that violate LAW 12: EDGE FUNCTIONS ARE SECURE BY DEFAULT.

| Function | Lines | Critical Issues | Severity |
|----------|-------|-----------------|----------|
| send-notification | 62 | No JWT auth, no validation, no membership check, service role abuse | **CRITICAL** |
| webhook-receiver | 86 | No HMAC verification, no rate limiting | **CRITICAL** |
| liveblocks-auth | 58 | No room access control (cross-project vulnerability) | **HIGH** |
| voice-extract | 258 | No project membership check, no rate limiting on expensive API | **HIGH** |
| agent-orchestrator | 722 | No membership verification, missing input validation | **CRITICAL** |

---

## Security Patterns to Implement

### Pattern 1: JWT Extraction and Verification

Used in: send-notification, webhook-receiver, voice-extract, liveblocks-auth, agent-orchestrator

```typescript
// Helper function for all functions
function extractUserFromAuth(authHeader?: string | null) {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }

  const token = authHeader.slice(7)
  // Supabase client automatically verifies JWT
  // verifyJWT done by supabase.auth.getUser()
  return token
}
```

### Pattern 2: Project Membership Verification

Used in: send-notification, voice-extract, liveblocks-auth, agent-orchestrator

```typescript
// Helper function for all functions
async function verifyProjectMembership(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('project_members')
    .select('id, role')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
    throw new Error('User is not a member of this project')
  }
}
```

### Pattern 3: HMAC Signature Verification

Used in: webhook-receiver (required but missing)

```typescript
async function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => p.trim().split('='))
  )

  const timestamp = parts.t
  const version = parts.v1

  if (!timestamp || !version) {
    return false
  }

  // Prevent replay attacks: signature must be < 5 minutes old
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp)
  if (age > 300) {
    return false
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(version),
  )
}
```

### Pattern 4: Rate Limiting

Used in: send-notification, webhook-receiver, voice-extract, agent-orchestrator

```typescript
// Use Supabase RPC for rate limiting
async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  functionName: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    user_id: userId,
    function_name: functionName,
    limit,
    window_seconds: windowSeconds,
  })

  if (error || !data?.allowed) {
    throw new Error(`Rate limit exceeded: ${limit} requests per ${windowSeconds}s`)
  }
}
```

### Pattern 5: Input Validation with Zod

Used in: voice-extract (partial), agent-orchestrator (missing)

```typescript
import { z } from 'https://deno.land/x/zod@v3.20.0/mod.ts'

const CreateNotificationSchema = z.object({
  user_id: z.string().uuid('user_id must be valid UUID'),
  project_id: z.string().uuid('project_id must be valid UUID'),
  type: z.enum(['rfi_response', 'task_assigned', 'submittal_approved', 'general']),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  email: z.string().email().optional(),
  html: z.string().max(10000).optional(),
  link: z.string().url().optional(),
})
```

---

## Function 1: send-notification (CRITICAL)

**Current File**: `supabase/functions/send-notification/index.ts` (62 lines)

**Current Issues**:
1. **NO JWT VERIFICATION** (line 10-18): Just parses JSON, no auth check
2. **NO INPUT VALIDATION** (line 20): Accepts arbitrary fields
3. **SERVICE ROLE KEY ABUSE** (line 17): Uses SUPABASE_SERVICE_ROLE_KEY instead of anon key + JWT
4. **NO MEMBERSHIP VERIFICATION** (line 23-33): Trusts user_id and project_id from request
5. **NO RATE LIMITING**: Could be called 1000x/second per user
6. **NOTIFICATION SPOOFING**: Any authenticated user can send notifications to any other user

**Rewritten Function**:

```typescript
// supabase/functions/send-notification/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.20.0/mod.ts'

// ── Types & Schemas ────────────────────────────────────────────────

const CreateNotificationSchema = z.object({
  user_id: z.string().uuid('Invalid user_id'),
  project_id: z.string().uuid('Invalid project_id'),
  type: z.enum(['rfi_response', 'task_assigned', 'submittal_approved', 'general']),
  title: z.string().min(1, 'title required').max(200, 'title max 200 chars'),
  body: z.string().min(1, 'body required').max(2000, 'body max 2000 chars'),
  email: z.string().email('Invalid email').optional(),
  html: z.string().max(10000, 'html max 10000 chars').optional(),
  link: z.string().url('Invalid URL').optional(),
})

type CreateNotificationPayload = z.infer<typeof CreateNotificationSchema>

// ── Helpers ────────────────────────────────────────────────────────

function getAuthToken(req: Request): string {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }
  return authHeader.slice(7)
}

async function verifyProjectMembership(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('project_members')
    .select('id, role')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
    throw new Error('User is not a member of this project')
  }
}

async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 100,
  windowSeconds: number = 60,
): Promise<void> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    user_id: userId,
    function_name: 'send_notification',
    limit,
    window_seconds: windowSeconds,
  })

  if (error || !data?.allowed) {
    throw new Error('Rate limit exceeded: 100 notifications per 60 seconds')
  }
}

// ── Main Handler ───────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Extract and verify JWT ──────────────────────────────────
    const token = getAuthToken(req)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 2. Rate limit check ────────────────────────────────────────
    await checkRateLimit(supabase, user.id, 100, 60)

    // ── 3. Validate request body ───────────────────────────────────
    let payload: CreateNotificationPayload
    try {
      const body = await req.json()
      payload = CreateNotificationSchema.parse(body)
    } catch (err) {
      const message = err instanceof z.ZodError
        ? err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
        : 'Invalid request body'
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 4. Verify user is member of project ────────────────────────
    await verifyProjectMembership(supabase, user.id, payload.project_id)

    // ── 5. Verify target user is also member of project ────────────
    await verifyProjectMembership(supabase, payload.user_id, payload.project_id)

    // ── 6. Insert notification ─────────────────────────────────────
    const { error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: payload.user_id,
        project_id: payload.project_id,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        link: payload.link,
        created_by: user.id,
        created_at: new Date().toISOString(),
      })

    if (insertError) {
      throw new Error(`Failed to insert notification: ${insertError.message}`)
    }

    // ── 7. Send email if configured ────────────────────────────────
    if (payload.email) {
      const resendKey = Deno.env.get('RESEND_API_KEY')
      if (resendKey) {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'SiteSync <notifications@sitesync.pm>',
            to: [payload.email],
            subject: payload.title,
            html: payload.html || `<p>${payload.body}</p>`,
          }),
        })

        if (!emailResponse.ok) {
          console.error('Email send failed:', await emailResponse.text())
          // Don't fail the whole request if email fails
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, notification_id: 'auto_generated' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('send-notification error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
```

---

## Function 2: webhook-receiver (CRITICAL)

**Current File**: `supabase/functions/webhook-receiver/index.ts` (86 lines)

**Current Issues**:
1. **NO WEBHOOK SIGNATURE VERIFICATION** (lines 28-43): Validates integration exists but comment mentions signature verification that's NOT IMPLEMENTED
2. **NO RATE LIMITING**: Could be called 1000x/second per integration
3. **NO PAYLOAD SIZE LIMITS**: Could accept massive payloads
4. **REPLAY ATTACK VULNERABILITY**: No timestamp verification

**Rewritten Function**:

```typescript
// supabase/functions/webhook-receiver/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.20.0/mod.ts'

// ── Types & Schemas ────────────────────────────────────────────────

const WebhookPayloadSchema = z.object({
  event: z.string().min(1),
  timestamp: z.number().positive().optional(),
  data: z.record(z.unknown()).optional(),
})

type WebhookPayload = z.infer<typeof WebhookPayloadSchema>

// ── Helpers ────────────────────────────────────────────────────────

async function verifyWebhookSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
): Promise<void> {
  if (!signatureHeader) {
    throw new Error('Missing webhook signature header')
  }

  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => p.trim().split('='))
  )

  const timestamp = parts.t
  const version = parts.v1

  if (!timestamp || !version) {
    throw new Error('Invalid signature format')
  }

  // Prevent replay attacks: signature must be < 5 minutes old
  const signedTimestamp = parseInt(timestamp)
  const age = Math.floor(Date.now() / 1000) - signedTimestamp
  if (age < 0 || age > 300) {
    throw new Error('Webhook timestamp outside acceptable window')
  }

  const crypto = await import('node:crypto')
  const expected = crypto.default
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')

  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(version)

  if (!crypto.default.timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new Error('Invalid webhook signature')
  }
}

async function checkRateLimit(
  supabase: SupabaseClient,
  integrationId: string,
  limit: number = 1000,
  windowSeconds: number = 60,
): Promise<void> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    resource_id: integrationId,
    function_name: 'webhook_receiver',
    limit,
    window_seconds: windowSeconds,
  })

  if (error || !data?.allowed) {
    throw new Error('Webhook rate limit exceeded')
  }
}

// ── Main Handler ───────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // ── 1. Extract integration_id parameter ────────────────────────
    const url = new URL(req.url)
    const integrationId = url.searchParams.get('integration_id')

    if (!integrationId) {
      return new Response(
        JSON.stringify({ error: 'Missing integration_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 2. Verify integration exists and is active ─────────────────
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('id, type, status, config, webhook_secret')
      .eq('id', integrationId)
      .single()

    if (intError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (integration.status !== 'connected') {
      return new Response(
        JSON.stringify({ error: 'Integration is not active' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 3. Check rate limit ────────────────────────────────────────
    await checkRateLimit(supabase, integrationId, 1000, 60)

    // ── 4. Read raw body for signature verification ────────────────
    const rawBody = await req.text()

    // Validate payload size (max 1MB)
    if (rawBody.length > 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'Payload too large (max 1MB)' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 5. Verify webhook signature ────────────────────────────────
    const signatureHeader = req.headers.get('x-webhook-signature')
    const webhookSecret = integration.webhook_secret as string

    if (!webhookSecret) {
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    try {
      await verifyWebhookSignature(rawBody, signatureHeader, webhookSecret)
    } catch (sigError) {
      return new Response(
        JSON.stringify({ error: (sigError as Error).message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 6. Parse and validate payload ──────────────────────────────
    let payload: WebhookPayload
    try {
      const json = JSON.parse(rawBody)
      payload = WebhookPayloadSchema.parse(json)
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 7. Log webhook delivery ────────────────────────────────────
    const { error: logError } = await supabase
      .from('webhook_deliveries')
      .insert({
        integration_id: integrationId,
        event: payload.event,
        payload,
        response_status: 200,
        verified: true,
        received_at: new Date().toISOString(),
      })

    if (logError) {
      console.error('Webhook logging failed:', logError)
      // Don't fail the response, just log the error
    }

    // ── 8. Process webhook based on integration type ────────────────
    switch (integration.type) {
      case 'procore_import':
        // Enqueue async job to process Procore webhook
        // Don't block the webhook response
        await supabase
          .from('async_jobs')
          .insert({
            type: 'process_procore_webhook',
            integration_id: integrationId,
            payload,
            status: 'pending',
          })
        break

      case 'autodesk_bim360':
        // Enqueue async job to process Autodesk webhook
        await supabase
          .from('async_jobs')
          .insert({
            type: 'process_autodesk_webhook',
            integration_id: integrationId,
            payload,
            status: 'pending',
          })
        break

      case 'zapier_webhook':
        // Store for manual processing or automation rules
        await supabase
          .from('async_jobs')
          .insert({
            type: 'process_zapier_webhook',
            integration_id: integrationId,
            payload,
            status: 'pending',
          })
        break

      default:
        // Unknown integration type
        break
    }

    // ── 9. Update integration last sync ────────────────────────────
    await supabase
      .from('integrations')
      .update({ last_webhook_at: new Date().toISOString() })
      .eq('id', integrationId)

    return new Response(
      JSON.stringify({ received: true, event: payload.event, verified: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('webhook-receiver error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
```

---

## Function 3: liveblocks-auth (HIGH)

**Current File**: `supabase/functions/liveblocks-auth/index.ts` (58 lines)

**Current Issues**:
1. **NO ROOM-LEVEL ACCESS CONTROL** (lines 26-46): Verifies user is authenticated, but doesn't verify user has access to the specific room
2. **CROSS-PROJECT VULNERABILITY**: User authenticated in Project A could access Liveblocks rooms for Project B
3. **NO RATE LIMITING**: Could generate unlimited Liveblocks tokens

**Rewritten Function**:

```typescript
// supabase/functions/liveblocks-auth/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.20.0/mod.ts'

// ── Types & Schemas ────────────────────────────────────────────────

const LiveblocksAuthSchema = z.object({
  room: z.string().min(1, 'room required'),
  project_id: z.string().uuid('Invalid project_id'),
})

type LiveblocksAuthPayload = z.infer<typeof LiveblocksAuthSchema>

// ── Helpers ────────────────────────────────────────────────────────

function getAuthToken(req: Request): string {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }
  return authHeader.slice(7)
}

async function verifyRoomAccess(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  roomId: string,
): Promise<void> {
  // Room format: typically "project_{id}_document_{id}"
  const expectedPrefix = `project_${projectId}`
  if (!roomId.startsWith(expectedPrefix)) {
    throw new Error('Room does not belong to this project')
  }

  // Verify user is member of project (implicit access to all project rooms)
  const { data, error } = await supabase
    .from('project_members')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
    throw new Error('User does not have access to this room')
  }
}

async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 100,
  windowSeconds: number = 60,
): Promise<void> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    user_id: userId,
    function_name: 'liveblocks_auth',
    limit,
    window_seconds: windowSeconds,
  })

  if (error || !data?.allowed) {
    throw new Error('Rate limit exceeded: 100 tokens per 60 seconds')
  }
}

// ── Main Handler ───────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Extract and verify JWT ──────────────────────────────────
    const token = getAuthToken(req)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 2. Validate request body ───────────────────────────────────
    let payload: LiveblocksAuthPayload
    try {
      const body = await req.json()
      payload = LiveblocksAuthSchema.parse(body)
    } catch (err) {
      const message = err instanceof z.ZodError
        ? err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
        : 'Invalid request body'
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 3. Check rate limit ────────────────────────────────────────
    await checkRateLimit(supabase, user.id, 100, 60)

    // ── 4. Verify room access ─────────────────────────────────────
    await verifyRoomAccess(supabase, user.id, payload.project_id, payload.room)

    // ── 5. Check Liveblocks config ─────────────────────────────────
    const liveblocksSecret = Deno.env.get('LIVEBLOCKS_SECRET_KEY')
    if (!liveblocksSecret) {
      return new Response(
        JSON.stringify({ error: 'Liveblocks not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 6. Get Liveblocks token ────────────────────────────────────
    const liveblocksResponse = await fetch(
      `https://api.liveblocks.io/v2/rooms/${encodeURIComponent(payload.room)}/authorize`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${liveblocksSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          userInfo: {
            name: user.user_metadata?.full_name || user.email || 'Anonymous',
            avatar: user.user_metadata?.avatar_url || null,
            color: '#' + user.id.slice(0, 6),
          },
        }),
      },
    )

    if (!liveblocksResponse.ok) {
      throw new Error(
        `Liveblocks auth failed: ${liveblocksResponse.status} ${liveblocksResponse.statusText}`,
      )
    }

    const data = await liveblocksResponse.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('liveblocks-auth error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
```

---

## Function 4: voice-extract (HIGH)

**Current File**: `supabase/functions/voice-extract/index.ts` (258 lines)

**Current Issues**:
1. **NO PROJECT MEMBERSHIP VERIFICATION** (lines 114-120): Checks user is authenticated, but doesn't verify they own the project
2. **NO RATE LIMITING ON EXPENSIVE API** (Claude calls cost $$$): Could call Claude 1000x/second
3. **MISSING INPUT VALIDATION**: transcript length check is present (good), but other fields not validated

**Rewritten Function (partial, adding security)**:

```typescript
// Add to voice-extract/index.ts after line 120

async function verifyProjectMembership(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('project_members')
    .select('id, role')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
    throw new Error('User is not a member of this project')
  }
}

async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 20,
  windowSeconds: number = 3600,
): Promise<void> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    user_id: userId,
    function_name: 'voice_extract',
    limit,
    window_seconds: windowSeconds,
  })

  if (error || !data?.allowed) {
    throw new Error('Rate limit exceeded: 20 extractions per hour')
  }
}

// REPLACE body validation section (line 130-145) WITH:

    const body = await req.json()
    const { transcript, messages, hasPhoto, projectId, language } = body

    // Validate projectId
    if (!projectId || typeof projectId !== 'string') {
      return new Response(JSON.stringify({ error: 'projectId is required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    try {
      new URL('about:blank', `urn:${projectId}`) // UUID validation trick
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid projectId format' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Validate transcript
    if (!transcript || typeof transcript !== 'string' || transcript.length < 3) {
      return new Response(JSON.stringify({ error: 'Transcript required (min 3 characters)' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    if (transcript.length > 10000) {
      return new Response(JSON.stringify({ error: 'Transcript too long (max 10000 characters)' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Verify project membership (ADDED SECURITY)
    await verifyProjectMembership(supabaseClient, user.id, projectId)

    // Check rate limit on expensive API (ADDED SECURITY)
    await checkRateLimit(supabaseClient, user.id, 20, 3600)
```

---

## Function 5: agent-orchestrator (CRITICAL)

**Current File**: `supabase/functions/agent-orchestrator/index.ts` (722 lines)

**Current Issues**:
1. **NO PROJECT MEMBERSHIP VERIFICATION**: Uses authenticated user but doesn't verify project access
2. **NO INPUT VALIDATION**: Accepts arbitrary agent parameters without validation
3. **NO RATE LIMITING**: Could spawn unlimited agents costing $$$ per invocation

**Add to agent-orchestrator/index.ts (at start of main handler)**:

```typescript
// Add schemas
const AgentOrchestrationSchema = z.object({
  projectId: z.string().uuid('Invalid projectId'),
  agentType: z.enum(['research', 'execution', 'analysis', 'coordination']),
  task: z.string().min(10, 'task must be at least 10 characters').max(5000),
  context: z.record(z.unknown()).optional(),
  humanApprovalRequired: z.boolean().optional().default(true),
})

// Add helpers at start of file
async function verifyProjectMembership(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('project_members')
    .select('id, role')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
    throw new Error('User is not a member of this project')
  }
}

async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 50,
  windowSeconds: number = 3600,
): Promise<void> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    user_id: userId,
    function_name: 'agent_orchestrator',
    limit,
    window_seconds: windowSeconds,
  })

  if (error || !data?.allowed) {
    throw new Error('Rate limit exceeded: 50 agent runs per hour')
  }
}

// THEN in main handler, AFTER user verification (add):

    // Validate request body (ADDED SECURITY)
    let payload: z.infer<typeof AgentOrchestrationSchema>
    try {
      const body = await req.json()
      payload = AgentOrchestrationSchema.parse(body)
    } catch (err) {
      const message = err instanceof z.ZodError
        ? err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
        : 'Invalid request body'
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: corsHeaders },
      )
    }

    // Verify project membership (ADDED SECURITY)
    await verifyProjectMembership(supabase, user.id, payload.projectId)

    // Check rate limit on expensive operation (ADDED SECURITY)
    await checkRateLimit(supabase, user.id, 50, 3600)
```

---

## Security Validation Checklist

After implementing all rewrites:

### send-notification
- [ ] JWT verified via supabase.auth.getUser()
- [ ] Request body validated with Zod
- [ ] User membership in project verified
- [ ] Target user membership in project verified
- [ ] Rate limited to 100/min per user
- [ ] Service role key removed (uses anon key + JWT)
- [ ] No ability to spoof notifications to unauthorized users

### webhook-receiver
- [ ] Integration exists and is active
- [ ] Webhook signature verified with HMAC-SHA256
- [ ] Replay attack prevention (timestamp < 5 min old)
- [ ] Rate limited to 1000/min per integration
- [ ] Payload size limited to 1MB
- [ ] Signature verification happens BEFORE payload processing

### liveblocks-auth
- [ ] JWT verified via supabase.auth.getUser()
- [ ] User verified as project member
- [ ] Room verified to belong to specified project
- [ ] Rate limited to 100/min per user
- [ ] No cross-project room access possible

### voice-extract
- [ ] JWT verified
- [ ] Project membership verified
- [ ] Rate limited to 20/hour (expensive API)
- [ ] Transcript length validated (3-10000 chars)
- [ ] ProjectId format validated

### agent-orchestrator
- [ ] JWT verified
- [ ] Project membership verified
- [ ] Request body validated with Zod
- [ ] Rate limited to 50/hour (expensive API)
- [ ] Agent parameters validated

### Deployment
- [ ] All environment variables set (RESEND_API_KEY, LIVEBLOCKS_SECRET_KEY, ANTHROPIC_API_KEY)
- [ ] Rate limiting RPC function exists in database
- [ ] webhook_secret column exists in integrations table
- [ ] webhook_deliveries table exists with verified column
- [ ] async_jobs table created for queueing work
- [ ] No hardcoded secrets in code
- [ ] All functions tested with invalid auth (should return 401)
- [ ] All functions tested with valid auth but no membership (should return 403)
- [ ] All functions tested with rate limit exceeded (should return 429)

