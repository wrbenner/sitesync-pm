import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Clock, Download, Clipboard, Share2, FileText, Send, Plus, Trash2, Key } from 'lucide-react';
import { PageContainer, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';
import { useCopilotStore } from '../stores/copilotStore';
import { SuggestedPrompts, getPromptsForPage } from '../components/ai/SuggestedPrompts';

export const AICopilot: React.FC = () => {
  const { addToast } = useToast();
  const {
    conversations,
    activeConversationId,
    isTyping,
    apiKey,
    setApiKey,
    getActiveConversation,
    createConversation,
    setActiveConversation,
    sendMessage,
    deleteConversation,
  } = useCopilotStore();

  const [showHistory, setShowHistory] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeConversation = getActiveConversation();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [activeConversation?.messages, isTyping]);

  const handleSend = (text?: string) => {
    const msg = text || inputText.trim();
    if (!msg) return;
    setInputText('');
    sendMessage(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveApiKey = () => {
    if (keyInput.trim()) {
      setApiKey(keyInput.trim());
      addToast('success', 'API key saved. Copilot will now use Claude for responses.');
    }
    setShowApiKeyModal(false);
    setKeyInput('');
  };

  const prompts = getPromptsForPage('dashboard');

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <PageContainer>
      <div style={{ display: 'flex', gap: spacing['5'], height: 'calc(100vh - 160px)' }}>
        {/* Conversation history sidebar */}
        {showHistory && (
          <div style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${colors.borderSubtle}`, paddingRight: spacing['4'] }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
              <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>History</span>
              <button
                onClick={() => createConversation()}
                style={{ padding: `${spacing['1']} ${spacing['2']}`, backgroundColor: colors.primaryOrange, color: 'white', border: 'none', borderRadius: borderRadius.base, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: spacing['1'] }}
              >
                <Plus size={10} /> New
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
              {conversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                return (
                  <div
                    key={conv.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: spacing['2'],
                      padding: `${spacing['2']} ${spacing['3']}`,
                      backgroundColor: isActive ? colors.orangeSubtle : 'transparent',
                      borderRadius: borderRadius.base,
                      cursor: 'pointer',
                      transition: `background-color ${transitions.instant}`,
                    }}
                    onClick={() => setActiveConversation(conv.id)}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceHover; }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
                  >
                    <MessageSquare size={13} color={isActive ? colors.primaryOrange : colors.textTertiary} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: typography.fontSize.sm, color: isActive ? colors.primaryOrange : colors.textPrimary, fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal, margin: 0, lineHeight: typography.lineHeight.snug, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.title}</p>
                      <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 1 }}>{formatTime(conv.updated_at)}</p>
                    </div>
                    {conversations.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.base, cursor: 'pointer', color: colors.textTertiary, opacity: 0.5, flexShrink: 0 }}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {/* API Key config */}
            <button
              onClick={() => setShowApiKeyModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: 'transparent', border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base, cursor: 'pointer', color: colors.textTertiary, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily, marginTop: spacing['3'] }}
            >
              <Key size={12} />
              {apiKey ? 'API Key Set' : 'Set API Key'}
            </button>
          </div>
        )}

        {/* Main chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Toggle history button and export */}
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
            {!apiKey && (
              <span style={{ fontSize: typography.fontSize.caption, color: colors.statusPending, fontWeight: typography.fontWeight.medium }}>
                Demo mode (set API key for live Claude responses)
              </span>
            )}
            <div style={{ marginLeft: 'auto', position: 'relative' }}>
              <button onClick={() => setExportOpen(!exportOpen)} title="Export conversation" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.base, cursor: 'pointer', color: colors.textTertiary }}>
                <Download size={14} />
              </button>
              {exportOpen && (
                <>
                  <div onClick={() => setExportOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: spacing['1'], backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.md, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 999, overflow: 'hidden', minWidth: '180px' }}>
                    {[
                      { icon: <Clipboard size={14} />, label: 'Copy to Clipboard' },
                      { icon: <Share2 size={14} />, label: 'Share to Activity Feed' },
                      { icon: <FileText size={14} />, label: 'Export as PDF' },
                    ].map((item) => (
                      <button key={item.label} onClick={() => { addToast('success', `${item.label}: Coming soon`); setExportOpen(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['2']} ${spacing['3']}`, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary, textAlign: 'left' }}>
                        <span style={{ color: colors.textTertiary, display: 'flex' }}>{item.icon}</span>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: spacing['4'], marginBottom: spacing['4'], paddingRight: spacing['2'] }}>
            {activeConversation?.messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: spacing['3'], color: colors.textTertiary }}>
                <MessageSquare size={32} />
                <p style={{ fontSize: typography.fontSize.body, margin: 0 }}>Start a conversation with SiteSync AI Copilot</p>
              </div>
            )}

            {activeConversation?.messages.map((msg) => (
              <div key={msg.id} style={{ display: 'flex', gap: spacing['3'], flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                {/* Avatar */}
                <div style={{
                  width: 28, height: 28, borderRadius: borderRadius.full, flexShrink: 0,
                  backgroundColor: msg.role === 'assistant' ? colors.primaryOrange : colors.surfaceInset,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                  color: msg.role === 'assistant' ? 'white' : colors.textSecondary,
                }}>
                  {msg.role === 'assistant' ? 'AI' : 'You'}
                </div>

                {/* Message bubble */}
                <div style={{
                  maxWidth: '70%',
                  padding: `${spacing['3']} ${spacing['4']}`,
                  borderRadius: borderRadius.lg,
                  backgroundColor: msg.role === 'user' ? colors.primaryOrange : colors.surfaceRaised,
                  color: msg.role === 'user' ? 'white' : colors.textPrimary,
                  fontSize: typography.fontSize.body,
                  lineHeight: typography.lineHeight.relaxed,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                  <div style={{
                    fontSize: typography.fontSize.caption,
                    color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : colors.textTertiary,
                    marginTop: spacing['2'],
                  }}>
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div style={{ display: 'flex', gap: spacing['3'] }}>
                <div style={{ width: 28, height: 28, borderRadius: borderRadius.full, flexShrink: 0, backgroundColor: colors.primaryOrange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: 'white' }}>AI</div>
                <div style={{ padding: `${spacing['3']} ${spacing['4']}`, borderRadius: borderRadius.lg, backgroundColor: colors.surfaceRaised, display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.textTertiary, animation: 'pulse 1.4s infinite', animationDelay: '0s' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.textTertiary, animation: 'pulse 1.4s infinite', animationDelay: '0.2s' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.textTertiary, animation: 'pulse 1.4s infinite', animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested prompts */}
          {activeConversation && activeConversation.messages.length <= 1 && (
            <div style={{ marginBottom: spacing['3'] }}>
              <SuggestedPrompts prompts={prompts} onSelect={(p) => handleSend(p)} />
            </div>
          )}

          {/* Input */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: spacing['2'],
            padding: spacing['3'],
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.lg,
            border: `1px solid ${colors.borderSubtle}`,
          }}>
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your project..."
              rows={1}
              style={{
                flex: 1, resize: 'none', border: 'none', outline: 'none',
                backgroundColor: 'transparent', fontFamily: typography.fontFamily,
                fontSize: typography.fontSize.body, color: colors.textPrimary,
                lineHeight: typography.lineHeight.relaxed,
                maxHeight: '120px',
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputText.trim() || isTyping}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: borderRadius.full,
                backgroundColor: inputText.trim() && !isTyping ? colors.primaryOrange : colors.surfaceInset,
                border: 'none', cursor: inputText.trim() && !isTyping ? 'pointer' : 'default',
                color: inputText.trim() && !isTyping ? 'white' : colors.textTertiary,
                flexShrink: 0,
                transition: `all ${transitions.instant}`,
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <>
          <div onClick={() => setShowApiKeyModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg,
            padding: spacing['5'], zIndex: 1001, width: '420px', maxWidth: '90vw',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <h3 style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>
              Configure AI Copilot
            </h3>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, marginBottom: spacing['4'], lineHeight: typography.lineHeight.relaxed }}>
              Enter your Anthropic API key to enable live Claude responses. Without a key, the copilot uses intelligent demo responses.
            </p>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-ant-..."
              style={{
                width: '100%', padding: `${spacing['2']} ${spacing['3']}`,
                border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base,
                fontSize: typography.fontSize.body, fontFamily: typography.fontFamily,
                color: colors.textPrimary, backgroundColor: colors.surfacePage,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: spacing['2'], marginTop: spacing['4'], justifyContent: 'flex-end' }}>
              {apiKey && (
                <button
                  onClick={() => { setApiKey(''); setShowApiKeyModal(false); addToast('info', 'API key removed. Using demo mode.'); }}
                  style={{ padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: 'transparent', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.statusCritical, cursor: 'pointer' }}
                >
                  Remove Key
                </button>
              )}
              <button
                onClick={() => setShowApiKeyModal(false)}
                style={{ padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: 'transparent', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textSecondary, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApiKey}
                style={{ padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.primaryOrange, border: 'none', borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: 'white', cursor: 'pointer', fontWeight: typography.fontWeight.semibold }}
              >
                Save Key
              </button>
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
};
