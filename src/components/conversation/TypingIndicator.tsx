// ── TypingIndicator ────────────────────────────────────────────────────────
// Renders "X is typing…" or "X and Y are typing…" pills under a comment
// thread. Subscribes to the `typing_indicators` table for the given
// (entity_type, entity_id) and shows rows whose last_seen_at is within
// the last 10 seconds.

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Edit3 } from 'lucide-react';
import { colors, typography } from '../../styles/theme';

interface TypingIndicatorProps {
  entityType: string;
  entityId: string;
  /** Hide ourselves — caller passes the logged-in user_id. */
  ignoreUserId?: string;
}

interface TypingRow {
  user_id: string;
  user_name: string;
  last_seen_at: string;
}

const ACTIVE_WINDOW_MS = 10_000;

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  entityType,
  entityId,
  ignoreUserId,
}) => {
  const [active, setActive] = useState<TypingRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const refresh = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
      const { data } = await sb
        .from('typing_indicators')
        .select('user_id, user_name, last_seen_at')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .gte('last_seen_at', cutoff)
        .order('last_seen_at', { ascending: false });
      if (cancelled) return;
      const rows = ((data as TypingRow[] | null) ?? []).filter(
        (r) => r.user_id !== ignoreUserId,
      );
      setActive(rows);
    };

    void refresh();
    timer = setInterval(refresh, 5_000);

    // Realtime for instant updates between polls.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const channel = sb
      .channel(`typing:${entityType}:${entityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `entity_id=eq.${entityId}`,
        },
        () => { void refresh(); },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      try { sb.removeChannel(channel); } catch { /* idempotent */ }
    };
  }, [entityType, entityId, ignoreUserId]);

  if (active.length === 0) return null;

  const names = active.slice(0, 3).map((r) => r.user_name);
  const overflow = active.length - names.length;
  const verb = active.length === 1 ? 'is' : 'are';
  const more = overflow > 0 ? ` and ${overflow} more` : '';
  const label = `${names.join(', ')}${more} ${verb} typing…`;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        fontSize: typography.fontSize.label,
        color: colors.textSecondary,
        fontStyle: 'italic',
      }}
    >
      <Edit3 size={11} />
      {label}
    </div>
  );
};

export default TypingIndicator;
