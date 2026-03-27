import React, { useState } from 'react';
import { Sparkles, ThumbsUp, ThumbsDown, Copy, Check } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';

export interface ChatMessageData {
  id: number;
  role: 'bot' | 'user';
  content: React.ReactNode;
  timestamp?: Date;
}

interface ChatMessageProps {
  message: ChatMessageData;
}

export const ChatMessageBubble: React.FC<ChatMessageProps> = ({ message }) => {
  const [reaction, setReaction] = useState<'up' | 'down' | null>(null);
  const [copied, setCopied] = useState(false);
  const isBot = message.role === 'bot';

  const handleCopy = () => {
    const el = document.getElementById(`msg-${message.id}`);
    if (el) {
      navigator.clipboard.writeText(el.innerText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: isBot ? 'flex-start' : 'flex-end', gap: spacing['3'] }}>
      {isBot && (
        <div
          style={{
            width: 28, height: 28, borderRadius: borderRadius.full,
            background: `linear-gradient(135deg, ${colors.statusReview} 0%, #9B8ADB 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: spacing['1'], flexShrink: 0,
          }}
        >
          <Sparkles size={13} color="white" />
        </div>
      )}
      <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
        <div
          id={`msg-${message.id}`}
          style={{
            padding: spacing['5'],
            borderRadius: isBot ? `${borderRadius.sm} ${borderRadius.lg} ${borderRadius.lg} ${borderRadius.lg}` : `${borderRadius.lg} ${borderRadius.sm} ${borderRadius.lg} ${borderRadius.lg}`,
            backgroundColor: isBot ? colors.surfaceInset : colors.primaryOrange,
            color: isBot ? colors.textPrimary : colors.white,
            fontSize: typography.fontSize.body,
            lineHeight: typography.lineHeight.relaxed,
          }}
        >
          {message.content}
        </div>

        {/* Bot message actions */}
        {isBot && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], paddingLeft: spacing['2'] }}>
            <button
              onClick={() => setReaction(reaction === 'up' ? null : 'up')}
              title="Helpful"
              style={{
                width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: reaction === 'up' ? colors.orangeSubtle : 'transparent',
                border: 'none', borderRadius: borderRadius.sm, cursor: 'pointer',
                color: reaction === 'up' ? colors.primaryOrange : colors.textTertiary,
                transition: `all ${transitions.instant}`,
              }}
            >
              <ThumbsUp size={12} />
            </button>
            <button
              onClick={() => setReaction(reaction === 'down' ? null : 'down')}
              title="Not helpful"
              style={{
                width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: reaction === 'down' ? 'rgba(201,59,59,0.08)' : 'transparent',
                border: 'none', borderRadius: borderRadius.sm, cursor: 'pointer',
                color: reaction === 'down' ? colors.statusCritical : colors.textTertiary,
                transition: `all ${transitions.instant}`,
              }}
            >
              <ThumbsDown size={12} />
            </button>
            <button
              onClick={handleCopy}
              title="Copy response"
              style={{
                width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.sm,
                cursor: 'pointer', color: copied ? colors.statusActive : colors.textTertiary,
                transition: `all ${transitions.instant}`,
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Typing indicator
export const AITypingIndicator: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
    <div
      style={{
        width: 28, height: 28, borderRadius: borderRadius.full,
        background: `linear-gradient(135deg, ${colors.statusReview} 0%, #9B8ADB 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}
    >
      <Sparkles size={13} color="white" />
    </div>
    <div
      style={{
        padding: `${spacing['3']} ${spacing['4']}`,
        backgroundColor: colors.surfaceInset,
        borderRadius: `${borderRadius.sm} ${borderRadius.lg} ${borderRadius.lg} ${borderRadius.lg}`,
        display: 'flex', alignItems: 'center', gap: spacing['1'],
      }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            backgroundColor: colors.statusReview,
            opacity: 0.4,
            animation: `pulse 1.4s infinite ${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  </div>
);
