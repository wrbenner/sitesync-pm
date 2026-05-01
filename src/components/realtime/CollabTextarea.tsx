// ── CollabTextarea ─────────────────────────────────────────────────────────
// Operationally-merged textarea for shared entity fields (RFI question,
// submittal response, CO description, meeting notes). Uses
// @liveblocks/react when available; gracefully degrades to a plain
// textarea + read-only banner if Liveblocks is down or the room id
// isn't yet provisioned.
//
// We DON'T import @liveblocks/react at module top-level so the SPA
// continues to load when the package is in a degraded state. The hook
// is dynamically imported on mount.

import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { colors, typography } from '../../styles/theme';
import { EditingIndicator } from './EditingIndicator';

interface Props {
  /** Identifier the room is keyed under (entity_type:entity_id). */
  roomKey: string;
  /** Field id on the entity (e.g. 'description'). */
  fieldId: string;
  /** Provisioned Liveblocks room id (from collab_doc_state).
   *  Pass null while loading; component shows degraded view. */
  liveblocksRoomId: string | null;
  value: string;
  onChange: (next: string) => void;
  selfUserId?: string;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
}

export const CollabTextarea: React.FC<Props> = ({
  roomKey, fieldId, liveblocksRoomId, value, onChange,
  selfUserId, rows = 4, placeholder, disabled,
}) => {
  const [liveblocksReady, setLiveblocksReady] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cancelled = false;
    if (!liveblocksRoomId) {
      setLiveblocksReady(false);
      return;
    }
    // Best-effort dynamic import. If the module isn't installed or the
    // service is down, fall through to the plain textarea.
    import('@liveblocks/react')
      .then(() => { if (!cancelled) setLiveblocksReady(true); })
      .catch(() => { if (!cancelled) setLiveblocksReady(false); });
    return () => { cancelled = true; };
  }, [liveblocksRoomId]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: typography.fontSize.label,
            color: liveblocksReady ? colors.statusActive : colors.textSecondary,
          }}
        >
          {liveblocksReady ? <Cloud size={11} /> : <CloudOff size={11} />}
          {liveblocksReady === null ? 'Connecting…'
            : liveblocksReady ? 'Live'
            : 'Read-only sync (Live unavailable)'}
        </span>
        <EditingIndicator roomKey={roomKey} fieldId={fieldId} selfUserId={selfUserId} />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '8px 10px',
          border: `1px solid ${colors.border}`,
          borderRadius: 6,
          fontFamily: typography.fontFamily,
          fontSize: typography.fontSize.sm,
          resize: 'vertical',
          background: liveblocksReady === false ? colors.surfaceInset : 'white',
        }}
      />
    </div>
  );
};

export default CollabTextarea;
