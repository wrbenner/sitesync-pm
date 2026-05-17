// ── share ─────────────────────────────────────────────────────────────────
// Native share sheet wrapper. On iOS/Android we hand bytes to the native
// share sheet (Capacitor Share plugin); on web we fall back to the Web
// Share API; if neither is available we show a copy-link toast.
//
// Inputs are intentionally small (a URL + optional file). Callers don't
// need to know which path will be taken.

export interface ShareInput {
  title: string
  /** A direct link OR a sealed-PDF URL for the entity. */
  url?: string
  /** Optional file to attach (data URL or Blob). When set, native uses
   *  the file path; web falls back to navigator.share files when
   *  available. */
  file?: { name: string; type: string; blob: Blob }
  /** Free-form body text that prefixes the URL in the share sheet. */
  text?: string
}

export interface ShareResult {
  ok: boolean
  /** 'native' | 'web' | 'fallback_copy' | 'unsupported'. */
  channel: 'native' | 'web' | 'fallback_copy' | 'unsupported'
  error?: string
}

/** Web Share API is not in TypeScript's strict DOM lib yet. */
type NavigatorWithShare = Navigator & {
  share?: (data: ShareData) => Promise<void>
  canShare?: (data: ShareData) => boolean
}

/** Detect the active share channel without firing the share. The UI
 *  uses this to render the correct icon (native sheet vs web). */
export async function detectShareChannel(): Promise<ShareResult['channel']> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) return 'native'
  } catch {
    /* not capacitor */
  }
  const nav = navigator as NavigatorWithShare
  if (typeof nav !== 'undefined' && typeof nav.share === 'function') {
    return 'web'
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard != null) {
    return 'fallback_copy'
  }
  return 'unsupported'
}

/** Fire the share. Best-effort: returns a result object instead of
 *  throwing so the caller can pick a fallback toast. */
export async function shareEntity(input: ShareInput): Promise<ShareResult> {
  // 1. Native (Capacitor)
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) {
      const mod = await import('@capacitor/share' as string).catch(() => null) as { Share?: { share: (d: unknown) => Promise<void> } } | null
      if (mod?.Share) {
        await mod.Share.share({
          title: input.title,
          text: input.text,
          url: input.url,
          dialogTitle: input.title,
        })
        return { ok: true, channel: 'native' }
      }
    }
  } catch {
    // fall through to web/copy
  }

  // 2. Web Share API
  try {
    const nav = navigator as NavigatorWithShare
    if (typeof nav !== 'undefined' && typeof nav.share === 'function') {
      const payload: ShareData & { files?: File[] } = {
        title: input.title,
        text: input.text,
        url: input.url,
      }
      if (input.file) {
        const f = new File([input.file.blob], input.file.name, { type: input.file.type })
        if (nav.canShare?.({ files: [f] })) {
          payload.files = [f]
        }
      }
      await nav.share(payload)
      return { ok: true, channel: 'web' }
    }
  } catch (err) {
    // user cancelled or unsupported
    if ((err as Error)?.name === 'AbortError') {
      return { ok: false, channel: 'web', error: 'cancelled' }
    }
  }

  // 3. Copy-link fallback
  if (input.url && typeof navigator !== 'undefined' && navigator.clipboard != null) {
    try {
      await navigator.clipboard.writeText(input.url)
      return { ok: true, channel: 'fallback_copy' }
    } catch {
      /* clipboard blocked */
    }
  }

  return { ok: false, channel: 'unsupported', error: 'No share channel available' }
}
