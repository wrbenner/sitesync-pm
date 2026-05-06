// ─────────────────────────────────────────────────────────────────────────────
// Owner-portal magic-link generator (Tab S, Wave 2)
// ─────────────────────────────────────────────────────────────────────────────
// Calls the existing `entity-magic-link` Edge Function (extended in this PR
// to accept `entity_type: 'owner_portal'`) to mint a project-scoped signed
// link. Returns the share URL + expiry; the caller renders a Copy button.
//
// No server work is duplicated: the Edge Function still handles signing,
// hashing, persisting to magic_link_tokens, and access logging. This module
// is a thin typed client over the auth-required POST.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

const FUNCTION_BASE =
  (typeof window !== 'undefined' && (window as unknown as { VITE_SUPABASE_URL?: string }).VITE_SUPABASE_URL) ||
  (import.meta as unknown as { env?: { VITE_SUPABASE_URL?: string } }).env?.VITE_SUPABASE_URL ||
  ''

export interface OwnerLinkRequest {
  projectId: string
  /** TTL in hours; default 14 days. */
  ttlHours?: number
}

export interface OwnerLinkResult {
  shareUrl: string
  expiresAt: string
}

export type OwnerLinkError =
  | { kind: 'unauthenticated' }
  | { kind: 'unconfigured' }
  | { kind: 'http'; status: number; message: string }
  | { kind: 'network'; message: string }

export async function generateOwnerShareLink(
  req: OwnerLinkRequest,
): Promise<{ ok: true; data: OwnerLinkResult } | { ok: false; error: OwnerLinkError }> {
  if (!FUNCTION_BASE) {
    return { ok: false, error: { kind: 'unconfigured' } }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) {
    return { ok: false, error: { kind: 'unauthenticated' } }
  }

  try {
    const res = await fetch(`${FUNCTION_BASE}/functions/v1/entity-magic-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        entity_type: 'owner_portal',
        project_id: req.projectId,
        scope: 'view',
        ttl_hours: req.ttlHours ?? 14 * 24,
      }),
    })

    if (!res.ok) {
      const detail = (await res.json().catch(() => ({}))) as {
        error?: { message?: string }
      }
      return {
        ok: false,
        error: {
          kind: 'http',
          status: res.status,
          message: detail.error?.message ?? `HTTP ${res.status}`,
        },
      }
    }

    const json = (await res.json()) as {
      ok?: boolean
      share_url?: string
      expires_at?: string
    }
    if (!json.ok || !json.share_url || !json.expires_at) {
      return {
        ok: false,
        error: { kind: 'http', status: 502, message: 'Malformed response from entity-magic-link' },
      }
    }
    return {
      ok: true,
      data: { shareUrl: json.share_url, expiresAt: json.expires_at },
    }
  } catch (err) {
    return {
      ok: false,
      error: { kind: 'network', message: err instanceof Error ? err.message : 'Network error' },
    }
  }
}

/**
 * Validate an owner-portal token — used by `MagicLinkOwnerRoute`.
 * Hits the GET branch of the Edge Function. Owner-portal tokens are
 * project-scoped; `entity_type` and `entity_id` are NOT required as
 * query params (the function recovers them from the row).
 */
export interface OwnerLinkValidation {
  status: 'pending' | 'ok' | 'expired' | 'invalid' | 'error'
  magicLinkTokenId?: string
  projectId?: string
  projectName?: string | null
  projectAddress?: string | null
  companyId?: string | null
  expiresAt?: string
  errorMessage?: string
}

export async function validateOwnerMagicLink(token: string): Promise<OwnerLinkValidation> {
  if (!token) return { status: 'invalid', errorMessage: 'Missing token.' }
  if (!FUNCTION_BASE) {
    return { status: 'error', errorMessage: 'Validation service unavailable.' }
  }
  try {
    const res = await fetch(
      `${FUNCTION_BASE}/functions/v1/entity-magic-link?token=${encodeURIComponent(token)}`,
    )
    if (!res.ok) {
      const detail = (await res.json().catch(() => ({}))) as {
        error?: { message?: string }
      }
      const status: OwnerLinkValidation['status'] =
        res.status === 410 || res.status === 401 ? 'expired' : 'invalid'
      return {
        status,
        errorMessage: detail.error?.message ?? `HTTP ${res.status}`,
      }
    }
    const data = (await res.json()) as {
      ok?: boolean
      project_id?: string
      project_name?: string | null
      project_address?: string | null
      company_id?: string | null
      magic_link_token_id?: string
      expires_at?: string
      entity_type?: string
      error?: { message?: string }
    }
    if (!data.ok || data.entity_type !== 'owner_portal' || !data.project_id || !data.magic_link_token_id) {
      return { status: 'invalid', errorMessage: data.error?.message ?? 'Token rejected.' }
    }
    return {
      status: 'ok',
      magicLinkTokenId: data.magic_link_token_id,
      projectId: data.project_id,
      projectName: data.project_name ?? null,
      projectAddress: data.project_address ?? null,
      companyId: data.company_id ?? null,
      expiresAt: data.expires_at,
    }
  } catch (err) {
    return { status: 'error', errorMessage: (err as Error).message }
  }
}
