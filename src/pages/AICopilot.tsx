import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MessageSquare, Clock, Download, Clipboard, Share2, FileText, Sparkles, ExternalLink } from 'lucide-react';
import { PageContainer, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../styles/theme';
import { useProjectId } from '../hooks/useProjectId';
import { ChatMessageBubble, AITypingIndicator } from '../components/ai/ChatMessage';
import type { ChatMessageData } from '../components/ai/ChatMessage';
import { SuggestedPrompts, getPromptsForPage } from '../components/ai/SuggestedPrompts';
import { ToolResultCard } from '../components/ai/ToolResultCard';
import { ActionConfirmCard } from '../components/ai/ActionConfirmCard';
import { MentionInput } from '../components/activity/MentionInput';
import { useProjectAI } from '../hooks/useProjectAI';
import type { ChatMessage, EntityRef } from '../hooks/useProjectAI';
import { useNavigate } from 'react-router-dom';

// ── Preset prompts ─────────────────────────────────────────

const PRESET_PROMPTS = [
  { label: 'What needs my attention today?', icon: '🎯', description: 'Overdue items, pending approvals, risks' },
  { label: 'Weekly status summary', icon: '📊', description: 'Metrics across all modules' },
  { label: 'RFI bottleneck analysis', icon: '🔍', description: 'Longest open RFIs, common blockers' },
  { label: 'Budget risk assessment', icon: '💰', description: 'Pending COs, burn rate, contingency' },
];

// ── Entity link component ──────────────────────────────────

const EntityLink: React.FC<{ ref_: EntityRef }> = ({ ref_ }) => {
  const navigate = useNavigate();
  const routeMap: Record<string, string> = {
    rfi: '/rfis', task: '/tasks', submittal: '/submittals',
    change_order: '/change-orders', daily_log: '/daily-log',
  };
  const route = routeMap[ref_.type] || '/';

  return (
    <button
      onClick={() => navigate(route)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
        padding: `0 ${spacing['1']}`,
        fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
        fontWeight: typography.fontWeight.medium,
        color: colors.statusInfo, backgroundColor: colors.statusInfoSubtle,
        border: 'none', borderRadius: borderRadius.sm, cursor: 'pointer',
        textDecoration: 'none',
      }}
    >
      {ref_.label} <ExternalLink size={10} />
    </button>
  );
};

// ── Conversation history sidebar ───────────────────────────

const conversationHistory = [
  { id: 'c-1', title: 'Current conversation', time: 'Now', active: true, status: 'pending' as const },
];

const statusDotColor: Record<string, string> = {
  complete: colors.statusActive,
  pending: colors.primaryOrange,
  info: colors.textTertiary,
};

// ── Main Page ──────────────────────────────────────────────

export const AICopilot: React.FC = () => {
  const { addToast } = useToast();
  useProjectId(); // ensure project context is available

  // Get previous page for context
  const previousPage = window.location.hash.replace('#/', '').split('/')[0] || 'dashboard';
  const contextPage = previousPage === 'copilot' ? 'dashboard' : previousPage;

  const {
    messages, input, setInput, sendMessage, confirmAction, cancelAction,
    isLoading, clearMessages,
  } = useProjectAI(contextPage);

  const [showHistory, setShowHistory] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [showPresets, setShowPresets] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pendingSendRef = useRef(false);

  const prompts = getPromptsForPage(contextPage);

  // Convert hook messages to ChatMessageData
  const allMessages = useMemo<ChatMessageData[]>(() => {
    return messages.map((m, i) => ({
      id: i,
      role: m.role === 'assistant' ? 'bot' as const : 'user' as const,
      content: <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>,
      timestamp: m.timestamp,
      _raw: m, // Carry the raw message for tool results and actions
    }));
  }, [messages]);

  // Hide presets once user sends first message
  useEffect(() => {
    if (messages.length > 0) setShowPresets(false);
  }, [messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [allMessages, isLoading]);

  // Trigger send after input state has been flushed
  useEffect(() => {
    if (pendingSendRef.current && input.trim()) {
      pendingSendRef.current = false;
      sendMessage();
    }
  }, [input, sendMessage]);

  const handleSendMessage = (text: string) => {
    setInput(text);
    pendingSendRef.current = true;
  };

  // Render a single message with tool results, entity refs, and action cards
  const renderMessage = (msg: ChatMessageData, rawMsg?: ChatMessage) => {
    return (
      <div key={msg.id}>
        <ChatMessageBubble message={msg} />

        {/* Tool result cards */}
        {rawMsg?.toolResults && rawMsg.toolResults.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'], marginTop: spacing['1'], marginLeft: '40px' }}>
            {rawMsg.toolResults.map((tr, i) => (
              <ToolResultCard key={i} result={tr} />
            ))}
          </div>
        )}

        {/* Entity reference links */}
        {rawMsg?.entityRefs && rawMsg.entityRefs.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'], marginTop: spacing['2'], marginLeft: '40px' }}>
            {rawMsg.entityRefs.map((ref, i) => (
              <EntityLink key={i} ref_={ref} />
            ))}
          </div>
        )}

        {/* Action confirmation card */}
        {rawMsg?.pendingAction && (
          <div style={{ marginLeft: '40px' }}>
            <ActionConfirmCard
              action={rawMsg.pendingAction}
              onConfirm={() => confirmAction(rawMsg.pendingAction!.id)}
              onCancel={() => cancelAction(rawMsg.pendingAction!.id)}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* Suggested follow-up prompts */}
        {rawMsg?.suggestedPrompts && rawMsg.suggestedPrompts.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'], marginTop: spacing['3'], marginLeft: '40px' }}>
            {rawMsg.suggestedPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(prompt)}
                style={{
                  padding: `${spacing['1']} ${spacing['3']}`,
                  fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.statusReview, backgroundColor: 'rgba(124, 93, 199, 0.06)',
                  border: `1px solid rgba(124, 93, 199, 0.15)`, borderRadius: borderRadius.full,
                  cursor: 'pointer', transition: `all ${transitions.quick}`,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(124, 93, 199, 0.12)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(124, 93, 199, 0.06)'; }}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <PageContainer>
      <div style={{ display: 'flex', gap: spacing['5'], height: 'calc(100vh - 160px)' }}>
        {/* History sidebar */}
        {showHistory && (
          <div style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${colors.borderSubtle}`, paddingRight: spacing['4'] }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
              <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>History</span>
              <button
                onClick={() => { clearMessages(); setShowPresets(true); }}
                style={{ padding: `${spacing['1']} ${spacing['2']}`, backgroundColor: colors.primaryOrange, color: 'white', border: 'none', borderRadius: borderRadius.base, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily, cursor: 'pointer' }}
              >
                + New
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
              {conversationHistory.map((conv) => (
                <button
                  key={conv.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: spacing['2'],
                    padding: `${spacing['2']} ${spacing['3']}`,
                    backgroundColor: conv.active ? colors.orangeSubtle : 'transparent',
                    border: 'none', borderRadius: borderRadius.base,
                    cursor: 'pointer', textAlign: 'left', fontFamily: typography.fontFamily,
                    transition: `background-color ${transitions.instant}`,
                  }}
                  onMouseEnter={(e) => { if (!conv.active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceHover; }}
                  onMouseLeave={(e) => { if (!conv.active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusDotColor[conv.status] || colors.textTertiary, flexShrink: 0, marginTop: 5 }} />
                  <MessageSquare size={13} color={conv.active ? colors.primaryOrange : colors.textTertiary} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: typography.fontSize.sm, color: conv.active ? colors.primaryOrange : colors.textPrimary, fontWeight: conv.active ? typography.fontWeight.medium : typography.fontWeight.normal, margin: 0, lineHeight: typography.lineHeight.snug }}>{conv.title}</p>
                    <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 1 }}>{conv.time}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['1'],
                padding: `${spacing['1']} ${spacing['2']}`,
                backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.base,
                cursor: 'pointer', color: colors.textTertiary, fontSize: typography.fontSize.caption,
                fontFamily: typography.fontFamily,
              }}
            >
              <Clock size={12} />
              {showHistory ? 'Hide' : 'Show'} history
            </button>
            <div style={{ marginLeft: 'auto', position: 'relative' }}>
              <button onClick={() => setExportOpen(!exportOpen)} title="Export conversation" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.base, cursor: 'pointer', color: colors.textTertiary }}>
                <Download size={14} />
              </button>
              {exportOpen && (
                <>
                  <div onClick={() => setExportOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: spacing['1'], backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.md, boxShadow: shadows.dropdown, zIndex: 999, overflow: 'hidden', minWidth: '180px' }}>
                    {[
                      { icon: <Clipboard size={14} />, label: 'Copy to Clipboard' },
                      { icon: <Share2 size={14} />, label: 'Share to Activity Feed' },
                      { icon: <FileText size={14} />, label: 'Export as PDF' },
                    ].map((item) => (
                      <button key={item.label} onClick={() => { addToast('success', `${item.label}: Feature pending configuration`); setExportOpen(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['2']} ${spacing['3']}`, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary, textAlign: 'left' }}>
                        <span style={{ color: colors.textTertiary, display: 'flex' }}>{item.icon}</span>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Messages area */}
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: spacing['5'], marginBottom: spacing['4'] }}>

            {/* Preset prompts (shown when no messages) */}
            {showPresets && messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: spacing['6'] }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: borderRadius.full,
                    background: `linear-gradient(135deg, ${colors.statusReview} 0%, #9B8ADB 100%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto', marginBottom: spacing['3'],
                  }}>
                    <Sparkles size={22} color="white" />
                  </div>
                  <h2 style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['1'] }}>SiteSync AI</h2>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>Your construction project intelligence assistant</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing['3'], maxWidth: 560, width: '100%' }}>
                  {PRESET_PROMPTS.map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => handleSendMessage(preset.label)}
                      style={{
                        padding: spacing['4'], textAlign: 'left',
                        backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.borderSubtle}`,
                        borderRadius: borderRadius.lg, cursor: 'pointer',
                        transition: `all ${transitions.quick}`,
                        fontFamily: typography.fontFamily,
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = colors.borderFocus;
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = shadows.cardHover;
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = colors.borderSubtle;
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                      }}
                    >
                      <span style={{ fontSize: '20px', display: 'block', marginBottom: spacing['2'] }}>{preset.icon}</span>
                      <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, marginBottom: spacing['1'] }}>{preset.label}</p>
                      <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>{preset.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat messages */}
            {allMessages.map((msg) => {
              const rawMsg = messages[allMessages.indexOf(msg)] as ChatMessage | undefined;
              return renderMessage(msg, rawMsg);
            })}

            {isLoading && <AITypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Contextual suggested prompts (after messages exist) */}
          {messages.length > 0 && !isLoading && (
            <div style={{ marginBottom: spacing['3'] }}>
              <SuggestedPrompts prompts={prompts} onSelect={(p) => handleSendMessage(p)} />
            </div>
          )}

          {/* Input */}
          <MentionInput
            onSend={(text) => handleSendMessage(text)}
            placeholder="Ask about your project... Use @ to mention someone"
          />
        </div>
      </div>
    </PageContainer>
  );
};
