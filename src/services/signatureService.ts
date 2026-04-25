/**
 * Signature Service — helper functions for e-signature workflows.
 */

/**
 * Builds the URL a signer uses to access and sign a document.
 */
export function generateSigningUrl(requestId: string, signerId: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://app.sitesyncpm.com'
  return `${base}/sign/${requestId}/${signerId}`
}

/**
 * Checks whether every required signature field on a request has a response_value.
 * Returns true only when all required fields are complete.
 */
export async function validateSignatureCompletion(requestId: string): Promise<boolean> {
  // Dynamic import to avoid circular dependency with supabase client
  const { supabase } = await import('../lib/supabase')

  const { data, error } = await (supabase as ReturnType<typeof Object>)
    .from('signature_fields')
    .select('is_required, response_value')
    .eq('request_id', requestId)

  if (error) throw error

  const fields = data as Array<{ is_required: boolean | null; response_value: string | null }>
  return fields
    .filter((f) => f.is_required !== false)
    .every((f) => f.response_value !== null && f.response_value !== '')
}

/**
 * Returns a SHA-256 placeholder hash for a given file URL.
 * In production this would fetch the file bytes and compute a real digest.
 */
export function computeDocumentHash(fileUrl: string): string {
  // Deterministic placeholder: prefix + simple hash derived from the URL
  let hash = 0
  for (let i = 0; i < fileUrl.length; i++) {
    const char = fileUrl.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  return `sha256:${hex}${'0'.repeat(56 - hex.length)}`
}

/**
 * Returns an array of 8 visually-distinct colors for multi-signer field coloring.
 */
export function getSignerColorPalette(): string[] {
  return [
    '#FF6B00', // orange
    '#2563EB', // blue
    '#16A34A', // green
    '#DC2626', // red
    '#9333EA', // purple
    '#CA8A04', // amber
    '#0891B2', // cyan
    '#DB2777', // pink
  ]
}
