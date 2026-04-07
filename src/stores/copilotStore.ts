import { create } from 'zustand';
import { supabase } from '../lib/supabase';

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
  isOpen: boolean;
  currentPageContext: string;

  setApiKey: (key: string) => void;
  getActiveConversation: () => Conversation | null;
  createConversation: (title?: string) => string;
  setActiveConversation: (id: string) => void;
  sendMessage: (text: string) => Promise<void>;
  deleteConversation: (id: string) => void;
  openCopilot: () => void;
  closeCopilot: () => void;
  setPageContext: (context: string) => void;
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
  isOpen: false,
  currentPageContext: 'dashboard',

  setApiKey: (key) => set({ apiKey: key }),
  openCopilot: () => set({ isOpen: true }),
  closeCopilot: () => set({ isOpen: false }),
  setPageContext: (context) => set({ currentPageContext: context }),

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
      // Real Claude API call via direct browser access
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
          const errBody = errData as { error?: { message?: string } };
          throw new Error(errBody.error?.message || `API error: ${response.status}`);
        }

        const data = await response.json();
        const body = data as { content?: Array<{ text?: string }> };
        responseText = body.content?.[0]?.text ?? 'I was unable to generate a response.';
      } catch (err) {
        responseText = `I encountered an error connecting to the AI service: ${(err as Error).message}. Please check your API key and try again.`;
      }
    } else {
      // Call the Supabase edge function for AI chat
      try {
        const conversation = get().conversations.find((c) => c.id === activeConversationId);
        const messages = (conversation?.messages ?? []).map((m) => ({
          role: m.role,
          content: m.content,
        }));
        messages.push({ role: 'user', content: text });

        const { data, error } = await supabase.functions.invoke('ai-chat', {
          body: { messages },
        });

        if (error) throw error;
        responseText = data?.response ?? 'I was unable to generate a response. Please try again.';
      } catch (err) {
        responseText = `I encountered an error connecting to the AI service: ${(err as Error).message}. Please ensure the ai-chat edge function is deployed.`;
      }
    }

    // Auto set conversation title from first user message
    const conv = get().conversations.find((c) => c.id === activeConversationId);
    if (conv && conv.messages.length <= 2) {
      const title = text.length > 40 ? text.substring(0, 40) + '...' : text;
      set((s) => ({
        conversations: s.conversations.map((c) => c.id === activeConversationId ? { ...c, title } : c),
      }));
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
