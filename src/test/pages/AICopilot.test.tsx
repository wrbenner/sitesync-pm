import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// ── Hoist all mocks before imports ───────────────────────────

vi.mock('../../hooks/useProjectId', () => ({
  useProjectId: vi.fn(() => 'test-project-id'),
}))

vi.mock('../../hooks/useMultiAgentChat', () => ({
  useMultiAgentChat: vi.fn(() => ({
    messages: [],
    input: '',
    setInput: vi.fn(),
    sendMessage: vi.fn(),
    isProcessing: false,
    activeAgents: [],
    lastIntent: null,
    pendingActions: [],
    approveAction: vi.fn(),
    rejectAction: vi.fn(),
    approveAllPending: vi.fn(),
    rejectAllPending: vi.fn(),
    clearMessages: vi.fn(),
    resetConversation: vi.fn(),
    error: null,
    conversationId: null,
  })),
}))

vi.mock('../../components/Primitives', () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-container">{children}</div>
  ),
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('../../components/ai/AgentMessage', () => ({
  AgentMessage: ({ message }: { message: { content: string } }) => (
    <div data-testid="agent-message">{message.content}</div>
  ),
  AgentTypingIndicator: () => <div data-testid="typing-indicator" />,
  AGENT_COLORS: {
    schedule: { fg: '#4A90D9', subtle: '#EBF4FB' },
    cost:     { fg: '#27AE60', subtle: '#EAFAF1' },
    safety:   { fg: '#E74C3C', subtle: '#FDEDEC' },
    quality:  { fg: '#F39C12', subtle: '#FEF9E7' },
    compliance: { fg: '#8E44AD', subtle: '#F5EEF8' },
    document: { fg: '#2980B9', subtle: '#EBF5FB' },
  },
}))

vi.mock('../../components/ai/BatchActionPreview', () => ({
  BatchActionPreview: ({
    actions,
  }: {
    actions: unknown[]
    onApprove: (id: string) => void
    onReject: (id: string) => void
    onApproveAll: () => void
    onRejectAll: () => void
  }) => <div data-testid="batch-action-preview" data-count={actions.length} />,
}))

vi.mock('../../components/ai/AgentMentionInput', () => ({
  AgentMentionInput: ({
    onSend,
    disabled,
    placeholder,
  }: {
    onSend: (text: string) => void
    disabled?: boolean
    placeholder?: string
  }) => (
    <input
      data-testid="mention-input"
      disabled={disabled}
      placeholder={placeholder}
      onChange={() => {}}
      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          onSend((e.target as HTMLInputElement).value)
        }
      }}
    />
  ),
}))

vi.mock('../../components/ai/generativeUI', () => ({
  GenerativeUIRenderer: () => <div data-testid="generative-ui" />,
}))

vi.mock('../../components/ai/ToolResultCard', () => ({
  ToolResultCard: () => <div data-testid="tool-result-card" />,
}))

// ── Import after mocks ────────────────────────────────────────

import { AICopilot } from '../../pages/AICopilot'
import { useMultiAgentChat } from '../../hooks/useMultiAgentChat'
import type { AgentConversationMessage, AgentSuggestedAction } from '../../types/agents'

// jsdom does not implement scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn()

// ── Mock reset helper ─────────────────────────────────────────

const defaultChatReturn = {
  messages: [] as AgentConversationMessage[],
  input: '',
  setInput: vi.fn(),
  sendMessage: vi.fn(),
  isProcessing: false,
  activeAgents: [] as string[],
  lastIntent: null,
  pendingActions: [] as AgentSuggestedAction[],
  approveAction: vi.fn(),
  rejectAction: vi.fn(),
  approveAllPending: vi.fn(),
  rejectAllPending: vi.fn(),
  clearMessages: vi.fn(),
  resetConversation: vi.fn(),
  error: null,
  conversationId: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(useMultiAgentChat as ReturnType<typeof vi.fn>).mockReturnValue({ ...defaultChatReturn })
})

// ── Tests ─────────────────────────────────────────────────────

describe('AICopilot', () => {
  describe('initial render', () => {
    it('should render without crashing', () => {
      render(<AICopilot />)
      expect(screen.getByTestId('page-container')).toBeDefined()
    })

    it('should render the message input', () => {
      render(<AICopilot />)
      expect(screen.getByTestId('mention-input')).toBeDefined()
    })

    it('should render the agent panel by default', () => {
      render(<AICopilot />)
      expect(screen.getByText('AI Team')).toBeDefined()
    })

    it('should show the hide-agents toggle button', () => {
      render(<AICopilot />)
      expect(screen.getByLabelText('Hide agent panel')).toBeDefined()
    })

    it('should show the export button', () => {
      render(<AICopilot />)
      expect(screen.getByLabelText('Export conversation')).toBeDefined()
    })
  })

  describe('empty state', () => {
    it('should show the SiteSync AI Team heading', () => {
      render(<AICopilot />)
      expect(screen.getByText('SiteSync AI Team')).toBeDefined()
    })

    it('should show the agent count tagline', () => {
      render(<AICopilot />)
      expect(screen.getByText(/6 specialist agents/)).toBeDefined()
    })

    it('should render all 4 preset prompts', () => {
      render(<AICopilot />)
      expect(screen.getByText("How's the project doing?")).toBeDefined()
      expect(screen.getByText('@safety any PPE violations this week?')).toBeDefined()
      expect(screen.getByText('@cost what is the EAC for this project?')).toBeDefined()
      expect(screen.getByText('What needs my attention today?')).toBeDefined()
    })

    it('should show agent buttons in the sidebar panel', () => {
      render(<AICopilot />)
      // Each specialist agent should be listed
      expect(screen.getByLabelText(/Route to Schedule Agent/)).toBeDefined()
      expect(screen.getByLabelText(/Route to Cost Agent/)).toBeDefined()
      expect(screen.getByLabelText(/Route to Safety Agent/)).toBeDefined()
    })

    it('should not show typing indicator when not processing', () => {
      render(<AICopilot />)
      expect(screen.queryByTestId('typing-indicator')).toBeNull()
    })

    it('should not show batch action preview when no pending actions', () => {
      render(<AICopilot />)
      expect(screen.queryByTestId('batch-action-preview')).toBeNull()
    })
  })

  describe('agent panel toggle', () => {
    it('should hide the agent panel when toggle is clicked', () => {
      render(<AICopilot />)
      const toggleBtn = screen.getByLabelText('Hide agent panel')
      fireEvent.click(toggleBtn)
      expect(screen.queryByText('AI Team')).toBeNull()
    })

    it('should show the panel again after toggling twice', () => {
      render(<AICopilot />)
      const toggleBtn = screen.getByLabelText('Hide agent panel')
      fireEvent.click(toggleBtn)
      const showBtn = screen.getByLabelText('Show agent panel')
      fireEvent.click(showBtn)
      expect(screen.getByText('AI Team')).toBeDefined()
    })

    it('should update toggle button label after hiding', () => {
      render(<AICopilot />)
      const toggleBtn = screen.getByLabelText('Hide agent panel')
      fireEvent.click(toggleBtn)
      expect(screen.getByLabelText('Show agent panel')).toBeDefined()
    })
  })

  describe('export menu', () => {
    it('should open export menu when export button is clicked', () => {
      render(<AICopilot />)
      const exportBtn = screen.getByLabelText('Export conversation')
      fireEvent.click(exportBtn)
      expect(screen.getByRole('menu', { name: 'Export options' })).toBeDefined()
    })

    it('should show all export options', () => {
      render(<AICopilot />)
      fireEvent.click(screen.getByLabelText('Export conversation'))
      expect(screen.getByText('Copy to Clipboard')).toBeDefined()
      expect(screen.getByText('Share to Activity Feed')).toBeDefined()
      expect(screen.getByText('Export as PDF')).toBeDefined()
    })

    it('should close export menu when clicking outside', () => {
      render(<AICopilot />)
      fireEvent.click(screen.getByLabelText('Export conversation'))
      expect(screen.getByRole('menu', { name: 'Export options' })).toBeDefined()
      const backdrop = screen.getByRole('presentation')
      fireEvent.click(backdrop)
      expect(screen.queryByRole('menu', { name: 'Export options' })).toBeNull()
    })
  })

  describe('with messages', () => {
    it('should render user messages', () => {
      ;(useMultiAgentChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultChatReturn,
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'What is the schedule status?',
            timestamp: new Date(),
          },
        ] as AgentConversationMessage[],
      })
      render(<AICopilot />)
      expect(screen.getByText('What is the schedule status?')).toBeDefined()
    })

    it('should not show empty state when messages are present', () => {
      ;(useMultiAgentChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultChatReturn,
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            timestamp: new Date(),
          },
        ] as AgentConversationMessage[],
      })
      render(<AICopilot />)
      expect(screen.queryByText('SiteSync AI Team')).toBeNull()
    })

    it('should render multiple messages in order', () => {
      ;(useMultiAgentChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultChatReturn,
        messages: [
          { id: 'msg-1', role: 'user', content: 'First message', timestamp: new Date() },
          { id: 'msg-2', role: 'agent', content: 'Agent response', timestamp: new Date(), agentDomain: 'schedule' },
        ] as AgentConversationMessage[],
      })
      render(<AICopilot />)
      expect(screen.getByText('First message')).toBeDefined()
      expect(screen.getByText('Agent response')).toBeDefined()
    })
  })

  describe('processing state', () => {
    it('should show typing indicator when isProcessing is true', () => {
      ;(useMultiAgentChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultChatReturn,
        isProcessing: true,
        activeAgents: ['schedule'],
      })
      render(<AICopilot />)
      expect(screen.getByTestId('typing-indicator')).toBeDefined()
    })

    it('should show active agent badges when agents are running', () => {
      ;(useMultiAgentChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultChatReturn,
        isProcessing: true,
        activeAgents: ['schedule', 'cost'],
      })
      render(<AICopilot />)
      // Active agents show in toolbar
      expect(screen.getByText('analyzing...')).toBeDefined()
    })

    it('should disable input while processing', () => {
      ;(useMultiAgentChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultChatReturn,
        isProcessing: true,
      })
      render(<AICopilot />)
      const input = screen.getByTestId('mention-input') as HTMLInputElement
      expect(input.disabled).toBe(true)
    })
  })

  describe('pending actions', () => {
    it('should render BatchActionPreview when pending actions exist', () => {
      const pendingAction: AgentSuggestedAction = {
        id: 'action-1',
        domain: 'schedule',
        description: 'Update MEP start date',
        tool: 'suggest_reordering',
        input: {},
        confidence: 88,
        impact: 'high',
        requiresApproval: true,
      }
      ;(useMultiAgentChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultChatReturn,
        pendingActions: [pendingAction],
        messages: [
          { id: 'msg-1', role: 'user', content: 'Check delays', timestamp: new Date() },
        ] as AgentConversationMessage[],
      })
      render(<AICopilot />)
      expect(screen.getByTestId('batch-action-preview')).toBeDefined()
    })
  })

  describe('new conversation button', () => {
    it('should call clearMessages when New button is clicked', () => {
      const clearMessages = vi.fn()
      ;(useMultiAgentChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultChatReturn,
        clearMessages,
      })
      render(<AICopilot />)
      const newBtn = screen.getByText('+ New')
      fireEvent.click(newBtn)
      expect(clearMessages).toHaveBeenCalledOnce()
    })
  })

  describe('last routing info', () => {
    it('should display last routing info when lastIntent has target agents', () => {
      ;(useMultiAgentChat as ReturnType<typeof vi.fn>).mockReturnValue({
        ...defaultChatReturn,
        lastIntent: {
          intent: 'single_agent' as const,
          targetAgents: ['schedule' as const],
          confidence: 0.92,
          reasoning: 'Schedule analysis requested',
        },
      })
      render(<AICopilot />)
      expect(screen.getByText('Last Routing')).toBeDefined()
      expect(screen.getByText('Schedule analysis requested')).toBeDefined()
    })

    it('should not show last routing info when lastIntent is null', () => {
      render(<AICopilot />)
      expect(screen.queryByText('Last Routing')).toBeNull()
    })
  })
})
