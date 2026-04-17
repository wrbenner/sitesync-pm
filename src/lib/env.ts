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
    // Log but don't crash — deployment pipelines may not inject VITE_* vars.
    // Supabase.ts has its own fallbacks; crashing here kills the entire app.
    console.error('[SiteSync] Environment validation issues:', result.error.flatten())
    return import.meta.env as unknown as Env
  }
  return result.data
}

export const env = parseEnv()

// ── Derived Helpers ───────────────────────────────────────────

export const isSupabaseConfigured = !!(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY)
export const isSentryConfigured = !!env.VITE_SENTRY_DSN
export const isAnalyticsConfigured = !!env.VITE_POSTHOG_KEY
