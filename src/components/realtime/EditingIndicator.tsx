// ── EditingIndicator ───────────────────────────────────────────────────────
// Inline pill that says "Mike is editing" next to a focused field. Fed
// from the same presence channel as PresenceLayer; filters to members
// whose cursor.field matches the local field id.

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Edit3 } from 'lucide-react';
import {
  ACTIVE_WINDOW_MS,
  isMemberActive,
  type PresenceMember,
} from '../../lib/realtime/presenceChannel';
import { colors, typography } from '../../styles/theme';

interface Props {
  roomKey: string;
  fieldId: string;
  /** Hide ourselves so the local user isn't in the list. */
  selfUserId?: string;
}

export const EditingIndicator: React.FC<Props> = ({ roomKey, fieldId, selfUserId }) => {
  const [editors, setEditors] = useState<PresenceMember[]>([]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const channel = sb.channel(`presence:${roomKey}:editors`);

    channel
      .on('broadcast', { event: 'editing' }, ({ payload }: { payload: PresenceMember & { field?: string } }) => {
        if (payload.user_id === selfUserId) return;
        if ((payload.cursor?.field ?? (payload as any).field) !== fieldId) return;
        setEditors((cur) => {
          const next = cur.filter(
            (e) => isMemberActive(e) && !(e.user_id === payload.user_id && e.device_id === payload.device_id),
          );
          next.push({ ...payload, last_seen_at: Date.now() });
          return next;
        });
      })
      .subscribe();

    const stale = setInterval(() => {
      setEditors((cur) => cur.filter((m) => isMemberActive(m)));
    }, ACTIVE_WINDOW_MS / 2);

    return () => {
      clearInterval(stale);
      try { sb.removeChannel(channel); } catch { /* idempotent */ }
    };
  }, [roomKey, fieldId, selfUserId]);

  if (editors.length === 0) return null;
  const names = editors.slice(0, 2).map((e) => e.user_name);
  const verb = editors.length === 1 ? 'is' : 'are';
  const more = editors.length > 2 ? ` +${editors.length - 2}` : '';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        marginLeft: 8,
        fontSize: typography.fontSize.label,
        color: colors.textSecondary,
        fontStyle: 'italic',
      }}
    >
      <Edit3 size={11} />
      {names.join(', ')}{more} {verb} editing
    </span>
  );
};

export default EditingIndicator;
