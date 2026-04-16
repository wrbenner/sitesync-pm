// ── Environment Validation ────────────────────────────────────
// Validates all environment variables at startup using Zod.
// Fail fast on missing required vars instead of silent runtime errors.

import { z } from 'zod'

const envSchema = z.object({
  // Required for Supabase connectivity
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),

  // Observability (optional)
  VITE_SENTRY_DSN: z.string().optional(),
  VITE_POSTHOG_KEY: z.string().optional(),

  // Integrations (optional)
  VITE_OPENWEATHER_API_KEY: z.string().optional(),
  VITE_LIVEBLOCKS_PUBLIC_KEY: z.string().optional(),
  VITE_LIVEBLOCKS_AUTH_ENDPOINT: z.string().optional(),

  // Build metadata
  VITE_APP_VERSION: z.string().optional(),

  // Vite built-ins
  MODE: z.string(),
  DEV: z.boolean(),
  PROD: z.boolean(),
  BASE_URL: z.string(),
})

type Env = z.infer<typeof envSchema>

function parseEnv(): Env {
  const result = envSchema.safeParse(import.meta.env)
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    console.error('Environment validation failed:', errors)
    if (import.meta.env.PROD) {
      throw new Error(
        'Environment validation failed in production: ' + JSON.stringify(errors),
      )
    }
    return import.meta.env as unknown as Env
  }
  const parsed = result.data
  if (parsed.PROD) {
    const missing: string[] = []
    if (!parsed.VITE_SUPABASE_URL) missing.push('VITE_SUPABASE_URL')
    if (!parsed.VITE_SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY')
    if (missing.length > 0) {
      throw new Error(
        `Missing required production env vars: ${missing.join(', ')}`,
      )
    }
  }
  return parsed
}

export const env = parseEnv()

// ── Derived Helpers ───────────────────────────────────────────

export const isSupabaseConfigured = !!(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY)
export const isSentryConfigured = !!env.VITE_SENTRY_DSN
export const isAnalyticsConfigured = !!env.VITE_POSTHOG_KEY
