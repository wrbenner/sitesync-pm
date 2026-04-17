// Shared dev-bypass check. Must be identical in all auth/permission gates.
// Dev bypass requires ALL conditions to be explicitly true; never activates in production.
export function isDevBypassActive(): boolean {
  if (import.meta.env.PROD !== false) return false
  if (import.meta.env.DEV !== true) return false
  if (import.meta.env.VITE_DEV_BYPASS !== 'true') return false
  if (import.meta.env.VITE_SUPABASE_URL) return false
  if (import.meta.env.VITE_SUPABASE_ANON_KEY) return false
  return true
}
