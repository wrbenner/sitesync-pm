// ── LiveCursorOverlay ──────────────────────────────────────────────────────
// Renders remote-user cursors as colored pointers + a tiny name label.
// Anchors itself to a wrapper div the parent provides; coords are
// denormalized against that wrapper's bounding rect.
//
// We render only the most-recent device per user (multi-device dedup is
// the contract from src/lib/realtime/presenceChannel).

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  CURSOR_PALETTE,
  colorForUser,
  denormalizePoint,
  type CursorState,
} from '../../lib/realtime/liveCursor';
import { isMostRecentDeviceForUser, type PresenceMember } from '../../lib/realtime/presenceChannel';
import { typography } from '../../styles/theme';

interface Props {
  roomKey: string;
  /** The wrapper element ref; cursors are positioned absolutely within it. */
  surfaceRef: React.RefObject<HTMLElement | null>;
  /** Hide ourselves so the local user doesn't see their own ghost. */
  selfUserId?: string;
}

interface CursorEntry extends PresenceMember {
  cursor: CursorState;
}

export const LiveCursorOverlay: React.FC<Props> = ({ roomKey, surfaceRef, selfUserId }) => {
  const [cursors, setCursors] = useState<CursorEntry[]>([]);
  // Surface bounding rect is tracked in state via ResizeObserver so the
  // render-time denormalize calls don't read surfaceRef.current.
  const [surfaceRect, setSurfaceRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const update = () => setSurfaceRect(el.getBoundingClientRect());
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('scroll', update, { passive: true, capture: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update, { capture: true });
    };
  }, [surfaceRef]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const channel = sb.channel(`cursor:${roomKey}`);

    channel
      .on('broadcast', { event: 'cursor' }, ({ payload }: { payload: CursorEntry }) => {
        if (payload.user_id === selfUserId) return;
        setCursors((cur) => {
          const next = cur.filter(
            (c) => !(c.user_id === payload.user_id && c.device_id === payload.device_id),
          );
          next.push({ ...payload, last_seen_at: Date.now() });
          return next;
        });
      })
      .subscribe();

    return () => { try { sb.removeChannel(channel); } catch { /* idempotent */ } };
  }, [roomKey, selfUserId]);

  if (!surfaceRect) return null;

  return (
    <div
      style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        pointerEvents: 'none', overflow: 'hidden',
      }}
    >
      {cursors
        // cursors state is the canonical member list (each broadcast
        // upsert leaves a single entry per user_id/device_id), so we
        // can dedupe directly off it instead of via a render-time ref read.
        .filter((c) => isMostRecentDeviceForUser(cursors, c.user_id, c.device_id))
        .map((c) => {
          const px = denormalizePoint({ x: c.cursor.x, y: c.cursor.y }, surfaceRect);
          const color = c.cursor.color ?? colorForUser(c.user_id, roomKey);
          return (
            <CursorMarker key={`${c.user_id}:${c.device_id}`} x={px.x} y={px.y} name={c.user_name} color={color} />
          );
        })}
    </div>
  );
};

const CursorMarker: React.FC<{ x: number; y: number; name: string; color: string }> = ({ x, y, name, color }) => (
  <div
    style={{
      position: 'absolute',
      transform: `translate(${x}px, ${y}px)`,
      transition: 'transform 80ms ease-out',
      pointerEvents: 'none',
    }}
  >
    <svg width="14" height="14" viewBox="0 0 12 12" style={{ display: 'block' }}>
      <path d="M0 0 L0 10 L3 7 L5 11 L7 10 L5 6 L9 6 Z" fill={color} stroke="white" strokeWidth="0.6" />
    </svg>
    <span
      style={{
        marginLeft: 4,
        padding: '1px 6px',
        background: color,
        color: 'white',
        borderRadius: 4,
        fontSize: typography.fontSize.label,
        fontWeight: typography.fontWeight.semibold,
        whiteSpace: 'nowrap',
      }}
    >
      {name}
    </span>
  </div>
);

// Re-export the palette so callers can show a legend.
export { CURSOR_PALETTE };
export default LiveCursorOverlay;
