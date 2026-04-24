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
  // The UUID returned by the ai-copilot edge function after the first
  // round trip. Used to maintain conversation continuity server-side.
  serverConversationId?: string;
  created_at: string;
  updated_at: string;
}

interface CopilotState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isTyping: boolean;
  isOpen: boolean;
  currentPageContext: string;
  currentProjectId: string | null;

  getActiveConversation: () => Conversation | null;
  createConversation: (title?: string) => string;
  setActiveConversation: (id: string) => void;
  sendMessage: (text: string) => Promise<void>;
  deleteConversation: (id: string) => void;
  openCopilot: () => void;
  closeCopilot: () => void;
  setPageContext: (context: string) => void;
  setProjectId: (projectId: string | null) => void;
}

export const useCopilotStore = create<CopilotState>()((set, get) => ({
  conversations: [],
  activeConversationId: null,
  isTyping: false,
  isOpen: false,
  currentPageContext: 'dashboard',
  currentProjectId: null,

  openCopilot: () => set({ isOpen: true }),
  closeCopilot: () => set({ isOpen: false }),
  setPageContext: (context) => set({ currentPageContext: context }),
  setProjectId: (projectId) => set({ currentProjectId: projectId }),

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
    const { activeConversationId, currentPageContext, currentProjectId } = get();
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

    const conversation = get().conversations.find((c) => c.id === activeConversationId);
    const serverConversationId = conversation?.serverConversationId;

    let responseText: string;
    let newServerConversationId: string | undefined;

    try {
      const { data, error } = await supabase.functions.invoke('ai-copilot', {
        body: {
          message: text,
          conversation_id: serverConversationId,
          project_id: currentProjectId,
          page_context: currentPageContext,
        },
      });

      if (error) throw error;
      const payload = data as { response?: string; conversation_id?: string } | null;
      responseText = payload?.response ?? 'I was unable to generate a response. Please try again.';
      newServerConversationId = payload?.conversation_id;
    } catch (err) {
      responseText = `I encountered an error connecting to the AI service: ${(err as Error).message}. Please ensure the ai-copilot edge function is deployed.`;
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
          ? {
              ...c,
              messages: [...c.messages, botMsg],
              serverConversationId: newServerConversationId ?? c.serverConversationId,
              updated_at: new Date().toISOString(),
            }
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
