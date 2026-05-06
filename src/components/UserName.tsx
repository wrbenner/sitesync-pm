// ── UserName ───────────────────────────────────────────────────────────────
// Resolves a user_id (UUID) to a human-readable name in JSX. Required by
// the RFI Module Build Spec Part 14 (Walker's "code in activity" complaint
// and the deep-dive findings: raw UUIDs were leaking into Detail pages).
//
// Display rules — these are load-bearing, do not relax:
//   • Loading: skeleton shimmer (NEVER show the raw UUID, NEVER show "Unknown")
//   • Resolved with full_name: render the name
//   • Resolved with no full_name: fall through to caller-provided fallback
//   • Truly unresolved (no profile row, no synthetic-seed match): fallback
//
// Performance: every site that uses <UserName /> calls the canonical
// useProfileNames hook with a single-element array. React-query dedupes by
// queryKey, so concurrent renders for the same user_id collapse to one
// network request. For high-fan-out lists (audit feeds, mention lists)
// callers SHOULD pre-warm with useProfileNames(allIds) at the page level so
// every <UserName /> hits the cache instead of issuing its own request.
//
// Banned: rendering ${user_id} or {user_id} directly in JSX. The custom
// ESLint rule `no-raw-user-id-in-jsx` (eslint-rules/no-raw-user-id-in-jsx.js)
// fails the build on regressions.

import React from 'react';

import { useProfileNames, displayName } from '../hooks/queries/profiles';

// Canonical UUID detector — used by UserName so callers can safely pass
// either a UUID (looked up) or an already-resolved display string
// (rendered as-is). Centralizing this regex defeats the 8+ duplicate
// definitions scattered across src/ that drifted in subtle ways
// (some require v4 nibbles, some don't). Keep one source of truth here.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when the input looks like any RFC-4122 UUID (case-insensitive). */
export function looksLikeUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

interface UserNameProps {
  /** The user UUID. Null/undefined renders the fallback immediately. */
  userId: string | null | undefined;
  /** Rendered when the user_id is null/undefined or unresolved. Default: "—" */
  fallback?: string;
  /** Inline-style override for the wrapper span (rare; prefer className). */
  style?: React.CSSProperties;
  /** className override; theme tokens stay in CSS. */
  className?: string;
  /** Render as a <strong> instead of <span> for emphasis contexts. */
  emphasize?: boolean;
}

/**
 * Resolves user_id → display name. Use anywhere a user_id would otherwise
 * appear in JSX. Never renders the raw UUID; never renders "Unknown".
 */
export const UserName: React.FC<UserNameProps> = ({
  userId,
  fallback = '—',
  style,
  className,
  emphasize,
}) => {
  // Defensive: if the caller passed a string that isn't a UUID, it's
  // already a resolved display name (AI-generated content, denormalized
  // string column, etc). Render it as-is rather than running it through
  // profile lookup (which would miss every time and flash the fallback).
  // We compute this *before* the hook call below to keep the hook on a
  // stable code path, but we also pass an empty array to useProfileNames
  // when this branch fires so we don't issue a useless network request.
  const isAlreadyName =
    typeof userId === 'string' && !!userId && !looksLikeUuid(userId);

  // Single-id lookup — react-query collapses to one request via queryKey.
  // For high-density lists, page-level useProfileNames(allIds) pre-warms
  // the cache so this component never issues a second request.
  const ids = userId && !isAlreadyName ? [userId] : [];
  const { data: profileMap, isPending } = useProfileNames(ids);

  if (isAlreadyName) {
    const Tag = emphasize ? 'strong' : 'span';
    return <Tag style={style} className={className}>{userId}</Tag>;
  }

  // No id at all → caller has nothing to resolve. Render fallback.
  if (!userId) {
    return <span style={style} className={className}>{fallback}</span>;
  }

  // Loading → skeleton. NEVER raw UUID, NEVER "Unknown".
  if (isPending) {
    return (
      <span
        aria-busy="true"
        aria-label="Loading user"
        className={className}
        style={{
          display: 'inline-block',
          width: '6em',
          height: '0.85em',
          verticalAlign: 'middle',
          borderRadius: 3,
          background: 'linear-gradient(90deg, var(--color-surfaceFlat) 0%, var(--color-surfaceHover) 50%, var(--color-surfaceFlat) 100%)',
          backgroundSize: '200% 100%',
          // Reuses the global shimmer keyframes from src/index.css. Don't
          // mint a per-component keyframe — keep one source of truth.
          animation: 'shimmer 1.2s ease-in-out infinite',
          ...style,
        }}
      />
    );
  }

  // Resolved (or synthetic-seed mapped) → render name.
  const name = displayName(profileMap, userId, fallback);
  const Tag = emphasize ? 'strong' : 'span';
  return (
    <Tag style={style} className={className} data-user-id={userId}>
      {name}
    </Tag>
  );
};

export default UserName;
