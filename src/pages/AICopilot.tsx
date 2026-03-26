import React, { useState } from 'react';
import { Send, Zap } from 'lucide-react';
import { Card, SectionHeader, Btn } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/theme';
import { aiCopilotConversation } from '../data/mockData';

export const AICopilot: React.FC = () => {
  const [messages, setMessages] = useState(aiCopilotConversation);
  const [inputValue, setInputValue] = useState('');

  const suggestedPrompts = [
    'How is schedule performance trending?',
    'What are the top safety risks right now?',
    'Show me budget variance by division',
    'When will we hit next milestone?',
  ];

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      setMessages([
        ...messages,
        {
          id: messages.length + 1,
          type: 'user',
          message: inputValue,
          timestamp: new Date(),
        },
        {
          id: messages.length + 2,
          type: 'bot',
          message: 'I am analyzing your request and gathering the latest data. Give me a moment to provide comprehensive insights.',
          timestamp: new Date(),
          suggestions: [],
        },
      ]);
      setInputValue('');
    }
  };

  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: colors.lightBackground,
        padding: spacing.xl,
        marginLeft: '260px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <SectionHeader title="AI Copilot" subtitle="Construction intelligence at your fingertips" />

        {/* Chat Container */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            marginBottom: spacing.xl,
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.lg,
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: borderRadius.full,
                  backgroundColor: colors.primaryOrange,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.white,
                  marginBottom: spacing.lg,
                }}
              >
                <Zap size={32} />
              </div>
              <h2
                style={{
                  fontSize: typography.fontSize['2xl'],
                  fontWeight: typography.fontWeight.bold,
                  color: colors.textPrimary,
                  margin: 0,
                  marginBottom: spacing.sm,
                }}
              >
                SiteSync AI
              </h2>
              <p
                style={{
                  fontSize: typography.fontSize.base,
                  color: colors.textSecondary,
                  margin: 0,
                  marginBottom: spacing.xl,
                }}
              >
                Ask me anything about your project
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: msg.type === 'bot' && msg.suggestions && msg.suggestions.length > 0 ? spacing.md : 0,
                }}
              >
                <div
                  style={{
                    maxWidth: '70%',
                    padding: spacing.lg,
                    borderRadius: borderRadius.lg,
                    backgroundColor: msg.type === 'user' ? colors.primaryOrange : colors.cardBackground,
                    color: msg.type === 'user' ? colors.white : colors.textPrimary,
                    boxShadow: msg.type === 'user' ? 'none' : shadows.sm,
                    border: msg.type === 'bot' ? `1px solid ${colors.border}` : 'none',
                  }}
                >
                  <p
                    style={{
                      fontSize: typography.fontSize.base,
                      lineHeight: typography.lineHeight.relaxed,
                      margin: 0,
                    }}
                  >
                    {msg.message}
                  </p>

                  {msg.type === 'bot' && msg.suggestions && msg.suggestions.length > 0 && (
                    <div style={{ marginTop: spacing.md, display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                      {msg.suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => setInputValue(suggestion)}
                          style={{
                            padding: `${spacing.sm} ${spacing.md}`,
                            backgroundColor: colors.lightBackground,
                            border: `1px solid ${colors.border}`,
                            borderRadius: borderRadius.md,
                            cursor: 'pointer',
                            fontSize: typography.fontSize.sm,
                            color: colors.textSecondary,
                            fontFamily: typography.fontFamily,
                            textAlign: 'left',
                            transition: 'all 150ms',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.border;
                            (e.currentTarget as HTMLButtonElement).style.color = colors.textPrimary;
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.lightBackground;
                            (e.currentTarget as HTMLButtonElement).style.color = colors.textSecondary;
                          }}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Suggested Prompts (when empty) */}
        {messages.length === 0 && (
          <div style={{ marginBottom: spacing.xl }}>
            <p
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.textSecondary,
                margin: 0,
                marginBottom: spacing.md,
              }}
            >
              Try asking about:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
              {suggestedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => setInputValue(prompt)}
                  style={{
                    padding: spacing.md,
                    backgroundColor: colors.cardBackground,
                    border: `1px solid ${colors.border}`,
                    borderRadius: borderRadius.md,
                    cursor: 'pointer',
                    fontSize: typography.fontSize.sm,
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamily,
                    textAlign: 'left',
                    transition: 'all 150ms',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.lightBackground;
                    (e.currentTarget as HTMLButtonElement).style.borderColor = colors.primaryOrange;
                    (e.currentTarget as HTMLButtonElement).style.color = colors.primaryOrange;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.cardBackground;
                    (e.currentTarget as HTMLButtonElement).style.borderColor = colors.border;
                    (e.currentTarget as HTMLButtonElement).style.color = colors.textSecondary;
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <Card padding={spacing.lg}>
          <div style={{ display: 'flex', gap: spacing.md }}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask about your project..."
              style={{
                flex: 1,
                border: `1px solid ${colors.border}`,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                fontSize: typography.fontSize.base,
                fontFamily: typography.fontFamily,
                outline: 'none',
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = colors.primaryOrange;
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = colors.border;
              }}
            />
            <Btn
              variant="primary"
              size="md"
              onClick={handleSendMessage}
              icon={<Send size={16} />}
              disabled={!inputValue.trim()}
            >
              Send
            </Btn>
          </div>
        </Card>
      </div>
    </main>
  );
};
