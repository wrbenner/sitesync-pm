// _shared/sentryDeno.ts — BRT subsystem 7 §4.2
//
// Minimal Sentry sender for Deno edge functions. The official @sentry/deno
// package adds ~150 KB to each function's cold start; for our needs (just
// captureException with tags) a 80-line direct POST is enough.
//
// Usage in any edge function:
//
//   import { reportEdgeError } from '../_shared/sentryDeno.ts'
//
//   try {
//     ...
//   } catch (err) {
//     await reportEdgeError(err, {
//       function_name: 'iris-call',
//       org_id: orgId,
//       user_id: userId,
//     })
//     throw err
//   }
//
// Env: SENTRY_DSN_EDGE (separate from VITE_SENTRY_DSN; same Sentry project,
//      different DSN so frontend + edge events can be filtered apart).

interface ErrorContext {
  function_name?: string
  org_id?: string
  user_id?: string
  request_id?: string
  extra?: Record<string, unknown>
}

interface ParsedDsn {
  host: string
  projectId: string
  publicKey: string
}

function parseDsn(dsn: string): ParsedDsn | null {
  // DSN shape: https://<publicKey>@<host>/<projectId>
  try {
    const url = new URL(dsn)
    const publicKey = url.username
    const host = url.host
    const projectId = url.pathname.replace(/^\//, '')
    if (!publicKey || !host || !projectId) return null
    return { host, projectId, publicKey }
  } catch {
    return null
  }
}

const PII_KEYS = new Set([
  'password', 'token', 'secret', 'key', 'api_key',
  'draft_text', 'rfi_body', 'submittal_body', 'daily_log_body',
])

function scrub(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(scrub)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (PII_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]'
    } else {
      out[k] = scrub(v)
    }
  }
  return out
}

export async function reportEdgeError(err: unknown, context: ErrorContext = {}): Promise<void> {
  const dsn = Deno.env.get('SENTRY_DSN_EDGE')
  if (!dsn) return // No-op in dev / unconfigured environments
  const parsed = parseDsn(dsn)
  if (!parsed) {
    console.warn('[sentry] invalid SENTRY_DSN_EDGE; not sending')
    return
  }

  const errMessage = err instanceof Error ? err.message : String(err)
  const errStack = err instanceof Error ? err.stack : undefined
  const errName = err instanceof Error ? err.name : 'Error'

  const event = {
    event_id: crypto.randomUUID().replace(/-/g, ''),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level: 'error' as const,
    server_name: context.function_name ?? 'edge-fn',
    environment: Deno.env.get('SUPABASE_ENV') ?? 'production',
    tags: {
      function_name: context.function_name,
      org_id: context.org_id,
      user_id: context.user_id,
    },
    extra: scrub(context.extra ?? {}),
    request: context.request_id ? { headers: { 'X-Request-Id': context.request_id } } : undefined,
    exception: {
      values: [{
        type: errName,
        value: errMessage,
        stacktrace: errStack ? { frames: parseStack(errStack) } : undefined,
      }],
    },
  }

  const url = `https://${parsed.host}/api/${parsed.projectId}/store/?sentry_version=7&sentry_key=${parsed.publicKey}&sentry_client=sitesync-edge/0.1`

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    })
  } catch (sendErr) {
    // Sentry being down should never crash the calling function.
    console.warn('[sentry] send failed:', sendErr)
  }
}

function parseStack(stack: string): Array<{ filename: string; function: string; lineno?: number; colno?: number }> {
  // Deno stacks are reasonably standardized: "    at foo (file:line:col)"
  return stack.split('\n')
    .slice(0, 30)
    .map((line) => {
      const m = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/)
      if (m) {
        return { function: m[1], filename: m[2], lineno: parseInt(m[3], 10), colno: parseInt(m[4], 10) }
      }
      const m2 = line.match(/at\s+(.+?):(\d+):(\d+)/)
      if (m2) {
        return { function: '<anonymous>', filename: m2[1], lineno: parseInt(m2[2], 10), colno: parseInt(m2[3], 10) }
      }
      return { function: '<unknown>', filename: line.trim() }
    })
    .filter((f) => f.filename.length > 0)
    .reverse() // Sentry expects oldest-first
}
