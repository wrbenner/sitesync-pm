import { create } from 'zustand';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: CopilotMessage[];
  created_at: string;
  updated_at: string;
}

interface CopilotState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isTyping: boolean;
  apiKey: string | null;

  setApiKey: (key: string) => void;
  getActiveConversation: () => Conversation | null;
  createConversation: (title?: string) => string;
  setActiveConversation: (id: string) => void;
  sendMessage: (text: string) => Promise<void>;
  deleteConversation: (id: string) => void;
}

// Smart construction-aware responses when no API key is configured
const MOCK_RESPONSES: Record<string, string> = {
  'default': 'Based on the current project data for Meridian Tower, I can help you analyze schedules, budgets, RFIs, submittals, and field conditions. What specific area would you like to explore?',
  'budget': 'Looking at the budget data: Total project value is $47.5M with $28M spent to date (59%). Structural division is at 78% of budget with $2.1M committed, which puts it at risk of overrun. I recommend monitoring the Structural division closely and considering a contingency reallocation from Interior which has 42% remaining budget.',
  'rfi': 'There are currently 12 RFIs tracked on this project. 5 are in submitted status, 3 are under review, 3 have been responded to, and 1 is closed. RFI-004 (Structural connection at curtain wall) and RFI-012 (Concrete mix design for Level 10) are both critical priority and should be prioritized.',
  'schedule': 'The project is currently at 62% completion with the scheduled end date approaching. Key milestones to watch: Level 10 slab pour is dependent on RFI-012 response, and the curtain wall installation is blocked by RFI-004. I recommend expediting these two items to maintain schedule.',
  'submittal': 'There are 10 submittals tracked. 3 are approved, 2 are under review, 3 are submitted and awaiting review, and 2 require revisions (Door Hardware Schedule and Waterproofing Membrane). The Curtain Wall System (SUB-006) is critical priority and under review, so that should be your top focus.',
  'safety': 'Based on the daily logs and field reports, there are no open safety incidents. The last safety audit was completed on schedule. Recommended focus areas: fall protection on upper floors as structural steel work progresses, and confined space monitoring in the elevator pits.',
  'weather': 'Current conditions are favorable for construction. No significant weather events forecasted in the next 7 days. The next potential impact could be from seasonal rain patterns in approximately 3 weeks, which could affect exterior waterproofing and concrete pours.',
  'crew': 'Current crew deployment: 6 active crews with 142 total workers on site. Structural crew is at full capacity (28 workers), MEP crew could use 4 additional workers for the floor 8 HVAC rough-in to maintain schedule. I recommend pulling from the Site Work crew which is winding down.',
};

function getMockResponse(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('budget') || lower.includes('cost') || lower.includes('spend') || lower.includes('variance')) return MOCK_RESPONSES['budget'];
  if (lower.includes('rfi') || lower.includes('request for information')) return MOCK_RESPONSES['rfi'];
  if (lower.includes('schedule') || lower.includes('timeline') || lower.includes('milestone') || lower.includes('delay')) return MOCK_RESPONSES['schedule'];
  if (lower.includes('submittal') || lower.includes('shop drawing') || lower.includes('approval')) return MOCK_RESPONSES['submittal'];
  if (lower.includes('safety') || lower.includes('incident') || lower.includes('osha')) return MOCK_RESPONSES['safety'];
  if (lower.includes('weather') || lower.includes('rain') || lower.includes('forecast')) return MOCK_RESPONSES['weather'];
  if (lower.includes('crew') || lower.includes('manpower') || lower.includes('worker') || lower.includes('labor')) return MOCK_RESPONSES['crew'];
  return MOCK_RESPONSES['default'];
}

export const useCopilotStore = create<CopilotState>()((set, get) => ({
  conversations: [{
    id: 'conv-default',
    title: 'Project Briefing',
    messages: [
      {
        id: 'msg-welcome',
        role: 'assistant',
        content: 'Good morning. I am your SiteSync AI Copilot for the Meridian Tower project. I have full context on your RFIs, submittals, budget, schedule, and field data. What would you like to know?',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  }],
  activeConversationId: 'conv-default',
  isTyping: false,
  apiKey: null,

  setApiKey: (key) => set({ apiKey: key }),

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get();
    return conversations.find((c) => c.id === activeConversationId) ?? null;
  },

  createConversation: (title) => {
    const id = `conv-${Date.now()}`;
    const newConv: Conversation = {
      id,
      title: title ?? 'New Conversation',
      messages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    set((s) => ({
      conversations: [newConv, ...s.conversations],
      activeConversationId: id,
    }));
    return id;
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  sendMessage: async (text) => {
    const { activeConversationId, apiKey } = get();
    if (!activeConversationId) return;

    const userMsg: CopilotMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === activeConversationId
          ? { ...c, messages: [...c.messages, userMsg], updated_at: new Date().toISOString() }
          : c
      ),
      isTyping: true,
    }));

    let responseText: string;

    if (apiKey) {
      // Real Claude API call
      try {
        const conversation = get().conversations.find((c) => c.id === activeConversationId);
        const apiMessages = (conversation?.messages ?? []).map((m) => ({
          role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: m.content,
        }));
        apiMessages.push({ role: 'user', content: text });

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: 'You are SiteSync AI Copilot, an AI assistant for construction project management. You help with RFIs, submittals, budgets, schedules, and field operations for the Meridian Tower project (12 story mixed use, $47.5M budget, 62% complete). Be concise, practical, and speak like a construction professional. Never use hyphens in text. Use commas, periods, or restructure sentences instead.',
            messages: apiMessages,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error((errData as any).error?.message || `API error: ${response.status}`);
        }

        const data = await response.json();
        responseText = (data as any).content?.[0]?.text ?? 'I was unable to generate a response.';
      } catch (err) {
        responseText = `I encountered an error connecting to the AI service: ${(err as Error).message}. Please check your API key and try again.`;
      }
    } else {
      // Mock response with simulated delay
      await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1200));
      responseText = getMockResponse(text);

      // Auto-set conversation title from first user message
      const conv = get().conversations.find((c) => c.id === activeConversationId);
      if (conv && conv.messages.length <= 2) {
        const title = text.length > 40 ? text.substring(0, 40) + '...' : text;
        set((s) => ({
          conversations: s.conversations.map((c) => c.id === activeConversationId ? { ...c, title } : c),
        }));
      }
    }

    const botMsg: CopilotMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString(),
    };

    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === activeConversationId
          ? { ...c, messages: [...c.messages, botMsg], updated_at: new Date().toISOString() }
          : c
      ),
      isTyping: false,
    }));
  },

  deleteConversation: (id) => {
    set((s) => {
      const remaining = s.conversations.filter((c) => c.id !== id);
      return {
        conversations: remaining,
        activeConversationId: s.activeConversationId === id
          ? remaining[0]?.id ?? null
          : s.activeConversationId,
      };
    });
  },
}));
