// ── PresenceLayer ──────────────────────────────────────────────────────────
// Wraps a page or section with a presence avatar bar. Subscribes to a
// per-room Supabase channel using the helpers in src/lib/realtime/
// presenceChannel; renders only the dedup'd, fresh members.
//
// Drop-in: `<PresenceLayer roomKey={roomKeyFor({ type: 'entity', entity_type: 'rfi', entity_id: rfi.id })}>{children}</PresenceLayer>`.
//
// We intentionally render the avatar bar in the topbar position (a sticky
// row at the top of the wrapped subtree) instead of inside the children
// so existing pages don't need to make space for it.

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ACTIVE_WINDOW_MS,
  HEARTBEAT_INTERVAL_MS,
  dedupByUser,
  getOrCreateDeviceId,
  isMemberActive,
  mergeHeartbeat,
  type PresenceMember,
} from '../../lib/realtime/presenceChannel';
import { colorForUser } from '../../lib/realtime/liveCursor';
import { colors, typography } from '../../styles/theme';

interface PresenceLayerProps {
  roomKey: string;
  /** The viewer's identity. PresenceLayer broadcasts this on heartbeat. */
  user: { user_id: string; user_name: string; avatar_url?: string };
  children: React.ReactNode;
}

export const PresenceLayer: React.FC<PresenceLayerProps> = ({ roomKey, user, children }) => {
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const deviceId = useRef(getOrCreateDeviceId());

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const channel = sb.channel(`presence:${roomKey}`, {
      config: { presence: { key: `${user.user_id}:${deviceId.current}` } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const flat: PresenceMember[] = [];
        for (const tag of Object.keys(state)) {
          const entries = state[tag] as Array<{ user_id: string; user_name: string; device_id: string; last_seen_at: number; avatar_url?: string }>;
          for (const e of entries) flat.push(e);
        }
        setMembers((cur) => {
          const merged = flat.reduce((acc, b) => mergeHeartbeat(acc, b), cur);
          return dedupByUser(merged.filter((m) => isMemberActive(m)));
        });
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.user_id,
            user_name: user.user_name,
            avatar_url: user.avatar_url,
            device_id: deviceId.current,
            last_seen_at: Date.now(),
          });
        }
      });

    const interval = setInterval(() => {
      channel.track({
        user_id: user.user_id,
        user_name: user.user_name,
        avatar_url: user.avatar_url,
        device_id: deviceId.current,
        last_seen_at: Date.now(),
      });
    }, HEARTBEAT_INTERVAL_MS);

    const stale = setInterval(() => {
      setMembers((cur) => dedupByUser(cur.filter((m) => isMemberActive(m))));
    }, ACTIVE_WINDOW_MS);

    return () => {
      clearInterval(interval);
      clearInterval(stale);
      try { sb.removeChannel(channel); } catch { /* idempotent */ }
    };
  }, [roomKey, user.user_id, user.user_name, user.avatar_url]);

  return (
    <div style={{ position: 'relative' }}>
      {members.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: -6,
            padding: '4px 12px',
          }}
        >
          {members.slice(0, 5).map((m) => (
            <Avatar key={`${m.user_id}:${m.device_id}`} member={m} roomKey={roomKey} />
          ))}
          {members.length > 5 && (
            <span style={{ fontSize: typography.fontSize.label, color: colors.textSecondary, alignSelf: 'center', marginLeft: 6 }}>
              +{members.length - 5}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

const Avatar: React.FC<{ member: PresenceMember; roomKey: string }> = ({ member, roomKey }) => {
  const color = colorForUser(member.user_id, roomKey);
  const initials = member.user_name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div
      title={member.user_name}
      style={{
        width: 24, height: 24, borderRadius: '50%',
        background: color, color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700,
        border: '2px solid white',
        marginLeft: -6,
      }}
    >
      {initials}
    </div>
  );
};

export default PresenceLayer;
