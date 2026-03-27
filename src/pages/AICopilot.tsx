import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MessageSquare, Clock, Download, Clipboard, Share2, FileText } from 'lucide-react';
import { PageContainer, Skeleton, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';
import { getCostData } from '../api/endpoints/budget';
import { getProject, getMetrics } from '../api/endpoints/projects';
import { useQuery } from '../hooks/useQuery';
import { ChatMessageBubble, AITypingIndicator } from '../components/ai/ChatMessage';
import type { ChatMessageData } from '../components/ai/ChatMessage';
import { SuggestedPrompts, getPromptsForPage } from '../components/ai/SuggestedPrompts';
import { AIActionCard } from '../components/ai/AIActionCard';
import { MentionInput } from '../components/activity/MentionInput';

const DataRow: React.FC<{ label: string; value: string; valueColor?: string }> = ({
  label, value, valueColor = colors.textPrimary,
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${spacing['2']} 0` }}>
    <span style={{ fontSize: typography.fontSize.body, color: colors.textSecondary }}>{label}</span>
    <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: valueColor }}>{value}</span>
  </div>
);

const conversationHistory = [
  { id: 'c-1', title: 'Steel delivery delay analysis', time: 'Today', active: true, status: 'pending' as const },
  { id: 'c-2', title: 'Weekly OAC meeting prep', time: 'Yesterday', status: 'complete' as const },
  { id: 'c-3', title: 'Budget variance review', time: '2 days ago', status: 'complete' as const },
  { id: 'c-4', title: 'Safety audit checklist', time: '3 days ago', status: 'pending' as const },
  { id: 'c-5', title: 'MEP coordination issues', time: 'Last week', status: 'complete' as const },
  { id: 'c-6', title: 'Crew reallocation options', time: 'Last week', status: 'info' as const },
  { id: 'c-7', title: 'RFI response time analysis', time: '2 weeks ago', status: 'complete' as const },
  { id: 'c-8', title: 'Weather impact forecast', time: '2 weeks ago', status: 'info' as const },
];

const statusDotColor: Record<string, string> = {
  complete: colors.statusActive,
  pending: colors.primaryOrange,
  info: colors.textTertiary,
};

function buildInitialMessages(
  costData: { divisions: { name: string; budget: number; spent: number; committed: number }[] },
  metrics: { progress: number; budgetTotal: number; budgetSpent: number },
  projectData: { name: string; daysRemaining: number },
): ChatMessageData[] {
  const budgetVariance = costData.divisions.map((d) => {
    const variance = d.budget - d.spent - d.committed;
    const pct = ((variance / d.budget) * 100).toFixed(1);
    return { name: d.name, variance, pct };
  });

  return [
    {
      id: 1,
      role: 'bot',
      content: (
        <div>
          <p style={{ margin: 0, marginBottom: spacing['3'], lineHeight: typography.lineHeight.relaxed }}>
            Good morning. Here is your project pulse for <strong>{projectData.name}</strong>. You are at {metrics.progress}% completion with {projectData.daysRemaining} days remaining. Three items need your attention today.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'], padding: spacing['3'], backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: borderRadius.md }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'] }}>
              <span style={{ color: colors.statusCritical }}>1.</span>
              <span>Steel delivery from Phoenix supplier delayed 2 weeks. Recovery options available.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'] }}>
              <span style={{ color: colors.statusPending }}>2.</span>
              <span>RFI-004 awaiting structural engineer response. 3 days overdue.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'] }}>
              <span style={{ color: colors.statusInfo }}>3.</span>
              <span>HVAC shop drawings (SUB-002) due for review by Friday.</span>
            </div>
          </div>
          <AIActionCard
            title="Expedite steel delivery"
            description="Tulsa supplier available. $28K premium, net $19K savings vs delay costs."
            actionLabel="Approve Expediting"
            severity="critical"
            onAction={() => {}}
          />
        </div>
      ),
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
    },
    {
      id: 2,
      role: 'user',
      content: <span>What is the status on the steel delivery delay?</span>,
      timestamp: new Date(Date.now() - 12 * 60 * 1000),
    },
    {
      id: 3,
      role: 'bot',
      content: (
        <div>
          <p style={{ margin: 0, marginBottom: spacing['3'], lineHeight: typography.lineHeight.relaxed }}>
            The steel delivery delay is tied to <strong>RFI-004</strong>, submitted to Structural Systems Inc. The Phoenix supplier (Fabricator ABC Steel) is running 2 weeks behind due to mill capacity constraints.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', padding: spacing['3'], backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: borderRadius.md, marginBottom: spacing['3'] }}>
            <DataRow label="Linked RFI" value="RFI-004" />
            <DataRow label="Supplier" value="Fabricator ABC Steel (Phoenix)" />
            <DataRow label="Delay Impact" value="14 calendar days" valueColor={colors.statusCritical} />
            <DataRow label="Cost Impact" value="$28,000 expediting" valueColor={colors.statusPending} />
            <DataRow label="Recovery Savings" value="$47,000 avoided delay costs" valueColor={colors.statusActive} />
          </div>
          <p style={{ margin: 0, marginBottom: spacing['2'], lineHeight: typography.lineHeight.relaxed }}>Recommended recovery options:</p>
          <ul style={{ margin: 0, paddingLeft: spacing['5'] }}>
            <li style={{ lineHeight: typography.lineHeight.relaxed, marginBottom: spacing['1'] }}>Expedite with Tulsa secondary supplier. 10 day delivery, $28K freight premium, net $19K savings.</li>
            <li style={{ lineHeight: typography.lineHeight.relaxed, marginBottom: spacing['1'] }}>Accelerate parallel MEP rough in on floors 4 through 6 to absorb schedule float.</li>
            <li style={{ lineHeight: typography.lineHeight.relaxed }}>Redirect exterior crew to secondary facade while steel is in transit.</li>
          </ul>
        </div>
      ),
      timestamp: new Date(Date.now() - 10 * 60 * 1000),
    },
    {
      id: 4,
      role: 'user',
      content: <span>Show me budget variance by division</span>,
      timestamp: new Date(Date.now() - 8 * 60 * 1000),
    },
    {
      id: 5,
      role: 'bot',
      content: (
        <div>
          <p style={{ margin: 0, marginBottom: spacing['3'], lineHeight: typography.lineHeight.relaxed }}>
            Here is the budget variance breakdown across all five divisions. Total project budget is <strong>${(metrics.budgetTotal / 1000000).toFixed(1)}M</strong> with ${(metrics.budgetSpent / 1000000).toFixed(1)}M spent to date.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', padding: spacing['3'], backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: borderRadius.md, marginBottom: spacing['3'] }}>
            {budgetVariance.map((d) => (
              <DataRow
                key={d.name}
                label={d.name}
                value={`${d.variance >= 0 ? '+' : ''}$${(d.variance / 1000).toFixed(0)}K (${d.pct}%)`}
                valueColor={d.variance >= 0 ? colors.statusActive : colors.statusCritical}
              />
            ))}
          </div>
          <p style={{ margin: 0, lineHeight: typography.lineHeight.relaxed }}>
            Structural is nearly fully committed with minimal remaining contingency. Interior and Mechanical have the most uncommitted budget remaining.
          </p>
          <AIActionCard
            title="Flag Structural for monitoring"
            description="Any change orders will push Structural over budget. Recommend reallocating $200K from Interior contingency."
            actionLabel="Create Budget Alert"
            severity="warning"
            onAction={() => {}}
          />
        </div>
      ),
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
    },
  ];
}

export const AICopilot: React.FC = () => {
  const { addToast } = useToast();
  const { data: costData, loading: costLoading } = useQuery('costData', getCostData);
  const { data: metrics, loading: metricsLoading } = useQuery('metrics', getMetrics);
  const { data: projectData, loading: projectLoading } = useQuery('project', getProject);
  const loading = costLoading || metricsLoading || projectLoading;

  const initialMessages = useMemo<ChatMessageData[]>(() => {
    if (!costData || !metrics || !projectData) return [];
    return buildInitialMessages(costData, metrics, projectData);
  }, [costData, metrics, projectData]);

  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync initial messages
  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  const sendMessage = (text: string) => {
    const userMsg: ChatMessageData = {
      id: Date.now(),
      role: 'user',
      content: <span>{text}</span>,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      const botMsg: ChatMessageData = {
        id: Date.now() + 1,
        role: 'bot',
        content: (
          <div>
            <p style={{ margin: 0, lineHeight: typography.lineHeight.relaxed }}>
              I am analyzing your request. Based on the current project data for Meridian Tower, here is what I found:
            </p>
            <p style={{ margin: 0, marginTop: spacing['3'], lineHeight: typography.lineHeight.relaxed, color: colors.textSecondary }}>
              This is a simulated response. In production, this would connect to an AI model with full project context.
            </p>
          </div>
        ),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 1500 + Math.random() * 1000);
  };

  const prompts = getPromptsForPage('dashboard');

  return (
    <PageContainer>
      <div style={{ display: 'flex', gap: spacing['5'], height: 'calc(100vh - 160px)' }}>
        {/* Conversation history sidebar */}
        {showHistory && (
          <div style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${colors.borderSubtle}`, paddingRight: spacing['4'] }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
              <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>History</span>
              <button
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
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: spacing['5'], marginBottom: spacing['4'] }}>
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'], padding: spacing['3'] }}>
                <div style={{ display: 'flex', gap: spacing['3'] }}>
                  <Skeleton width="28px" height="28px" borderRadius={borderRadius.full} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                    <Skeleton height="16px" width="80%" />
                    <Skeleton height="16px" width="60%" />
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} />
            ))}

            {isTyping && <AITypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested prompts */}
          <div style={{ marginBottom: spacing['5'] }}>
            <SuggestedPrompts prompts={prompts} onSelect={(p) => {
              const userMsg: ChatMessageData = { id: Date.now(), role: 'user', content: <span>{p}</span>, timestamp: new Date() };
              setMessages((prev) => [...prev, userMsg]);
              setIsTyping(true);
              setTimeout(() => {
                setIsTyping(false);
                setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'bot', content: (<div><p style={{ margin: 0, lineHeight: typography.lineHeight.relaxed }}>Analyzing: "{p}"</p><p style={{ margin: 0, marginTop: spacing['3'], lineHeight: typography.lineHeight.relaxed, color: colors.textSecondary }}>This is a simulated response for the prototype.</p></div>), timestamp: new Date() }]);
              }, 1500);
            }} />
          </div>

          {/* Input */}
          <MentionInput
            onSend={(text) => sendMessage(text)}
            placeholder="Ask about your project... Use @ to mention someone"
          />
        </div>
      </div>
    </PageContainer>
  );
};
