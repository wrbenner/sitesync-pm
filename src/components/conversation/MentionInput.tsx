// ── MentionInput ───────────────────────────────────────────────────────────
// Textarea + @-mention popover. Detects "@" trigger after a space, opens
// MentionAutocomplete with project-scoped directory_contacts results,
// supports arrow-key navigation + Tab/Enter to insert.
//
// Mentions emit `onChange` with the rendered text + an array of mentioned
// contact ids. The owner persists both — text into the comment column,
// ids into a `mentions` jsonb field on the comment row (or as a separate
// link table). The notification fan-out reads the ids and enqueues
// notification_queue rows for each.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { colors, typography } from '../../styles/theme';
import {
  detectMentionQuery,
  rankMentions,
  type MentionContact,
  type MentionCandidate,
} from '../../lib/mentions/autocomplete';
import { MentionAutocomplete } from './MentionAutocomplete';

interface MentionInputProps {
  projectId: string;
  value: string;
  onChange: (text: string, mentionedIds: ReadonlyArray<string>) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  /** Stable identifier for the typing-indicator broadcast (entity url etc.). */
  typingChannel?: string;
  /** Logged-in user's id for typing-indicator emit. */
  userId?: string;
  /** Logged-in user's display name. */
  userName?: string;
}

export const MentionInput: React.FC<MentionInputProps> = ({
  projectId,
  value,
  onChange,
  placeholder = 'Add a comment… use @ to mention',
  rows = 3,
  disabled,
  typingChannel,
  userId,
  userName,
}) => {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);

  const { data: contacts = [] } = useQuery({
    queryKey: ['mention-contacts', projectId],
    queryFn: async (): Promise<MentionContact[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data } = await sb
        .from('directory_contacts')
        .select('id, name, email, role, trade, company, project_id')
        .eq('project_id', projectId);
      return ((data as any[] | null) ?? []).map((c) => ({
        id: c.id as string,
        name: c.name as string,
        email: c.email as string | null,
        role: c.role as string | null,
        trade: c.trade as string | null,
        company: c.company as string | null,
      }));
    },
    enabled: !!projectId,
  });

  const candidates = useMemo<MentionCandidate[]>(
    () => rankMentions(query, contacts, { limit: 6 }),
    [query, contacts],
  );

  // Reset highlight when candidate list changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Emit typing heartbeat. Throttled to once per 4 seconds.
  const lastHeartbeat = useRef(0);
  const emitTyping = () => {
    if (!typingChannel || !userId) return;
    const now = Date.now();
    if (now - lastHeartbeat.current < 4000) return;
    lastHeartbeat.current = now;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    sb.from('typing_indicators').upsert(
      {
        project_id: projectId,
        entity_type: typingChannel.split('/')[0] ?? 'rfi',
        entity_id: typingChannel.split('/')[1] ?? '',
        user_id: userId,
        user_name: userName ?? 'someone',
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'entity_type,entity_id,user_id' },
    ).then(() => undefined, () => undefined);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    const caret = e.target.selectionStart ?? next.length;
    const detected = detectMentionQuery(next, caret);

    if (detected) {
      setQuery(detected.query);
      setOpen(true);
      // Position the popover roughly under the caret. textarea -> we use
      // its bounding rect + a fixed offset; the popover is `position:
      // absolute` so it'll lay below the textarea.
      const rect = e.target.getBoundingClientRect();
      const parent = e.target.offsetParent as HTMLElement | null;
      const pRect = parent?.getBoundingClientRect() ?? { top: 0, left: 0 };
      setPosition({
        top: rect.bottom - pRect.top + 4,
        left: rect.left - pRect.left,
      });
    } else {
      setOpen(false);
    }

    // Recompute mentioned ids by scanning the new text for @<name> patterns
    // that exactly match a known contact.
    const ids: string[] = [];
    for (const c of contacts) {
      const re = new RegExp(`@${c.name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(next)) ids.push(c.id);
    }
    setMentionedIds(ids);
    onChange(next, ids);
    emitTyping();
  };

  const insertCandidate = (cand: MentionCandidate) => {
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? value.length;
    const detected = detectMentionQuery(value, caret);
    if (!detected) return;
    const before = value.slice(0, detected.start);
    const after = value.slice(detected.end);
    const insertion = `@${cand.contact.name} `;
    const next = `${before}${insertion}${after}`;
    onChange(next, mentionedIds);
    // Restore caret after the insertion.
    requestAnimationFrame(() => {
      ta.focus();
      const newCaret = (before + insertion).length;
      ta.setSelectionRange(newCaret, newCaret);
    });
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, candidates.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const cand = candidates[activeIndex];
      if (cand) {
        e.preventDefault();
        insertCandidate(cand);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={taRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setOpen(false)}
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
        }}
      />
      <MentionAutocomplete
        open={open}
        position={position}
        candidates={candidates}
        activeIndex={activeIndex}
        onSelect={insertCandidate}
        onHover={(i) => setActiveIndex(i)}
      />
    </div>
  );
};

export default MentionInput;
