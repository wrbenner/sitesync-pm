// SHA-256 helper — shared between signing.ts and revisions.ts.
export async function sha256Hex(input: string): Promise<string> {
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle
  if (!subtle) throw new Error('crypto.subtle unavailable')
  const buf = new TextEncoder().encode(input)
  const hash = await subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}
