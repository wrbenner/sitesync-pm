import React, { useState } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { Avatar, Btn } from '../Primitives';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

export interface ThreadMessage {
  id: number;
  initials: string;
  name: string;
  role: string;
  date: string;
  message: string;
  type: 'submitted' | 'comment' | 'response' | 'approved' | 'rejected';
  attachments?: number;
}

interface ConversationThreadProps {
  messages: ThreadMessage[];
  onSend?: (text: string) => void;
  showInput?: boolean;
}

const typeConfig: Record<string, { label: string; color: string }> = {
  submitted: { label: 'Submitted', color: colors.statusInfo },
  comment: { label: 'Comment', color: colors.textSecondary },
  response: { label: 'Response', color: colors.statusActive },
  approved: { label: 'Approved', color: colors.statusActive },
  rejected: { label: 'Rejected', color: colors.statusCritical },
};

export const ConversationThread: React.FC<ConversationThreadProps> = ({ messages, onSend, showInput = true }) => {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim() && onSend) {
      onSend(input.trim());
      setInput('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
      {messages.map((msg, i) => {
        const cfg = typeConfig[msg.type] || typeConfig.comment;
        return (
          <div key={msg.id} style={{ position: 'relative', paddingLeft: '36px', paddingBottom: spacing['4'] }}>
            {/* Timeline line */}
            {i < messages.length - 1 && (
              <div style={{ position: 'absolute', left: 13, top: 28, bottom: 0, width: 2, backgroundColor: colors.borderSubtle }} />
            )}

            {/* Avatar */}
            <div style={{ position: 'absolute', left: 0, top: 0 }}>
              <Avatar initials={msg.initials} size={28} />
            </div>

            {/* Content */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{msg.name}</span>
                <span style={{
                  fontSize: '10px', fontWeight: typography.fontWeight.semibold,
                  color: cfg.color, backgroundColor: `${cfg.color}12`,
                  padding: `0 ${spacing['1']}`, borderRadius: borderRadius.sm,
                  textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider,
                }}>
                  {cfg.label}
                </span>
              </div>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginBottom: spacing['2'] }}>
                {msg.role} · {msg.date}
              </p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, lineHeight: typography.lineHeight.relaxed }}>
                {msg.message}
              </p>
              {msg.attachments && msg.attachments > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginTop: spacing['2'] }}>
                  <Paperclip size={12} color={colors.textTertiary} />
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{msg.attachments} attachment{msg.attachments > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Reply input */}
      {showInput && (
        <div style={{
          display: 'flex', gap: spacing['2'], alignItems: 'center',
          padding: `${spacing['2']} ${spacing['3']}`,
          backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full,
          marginTop: spacing['2'],
        }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Add a comment..."
            style={{
              flex: 1, border: 'none', backgroundColor: 'transparent', outline: 'none',
              fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary,
            }}
          />
          <Btn variant="primary" size="sm" icon={<Send size={12} />} onClick={handleSend} disabled={!input.trim()}>Send</Btn>
        </div>
      )}
    </div>
  );
};
