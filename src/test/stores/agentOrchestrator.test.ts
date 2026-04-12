import { describe, it, expect, beforeEach } from 'vitest'
import { useAgentOrchestrator } from '../../stores/agentOrchestrator'
import { AGENT_DOMAINS } from '../../types/agents'
import type { AgentSuggestedAction, OrchestratorResponse, IntentClassification } from '../../types/agents'

// Build fresh initial agentStates for reset
function makeInitialAgentStates() {
  return Object.fromEntries(
    AGENT_DOMAINS.map((d) => [
      d,
      {
        domain: d,
        status: 'active' as const,
        totalActions: 0,
        approvedActions: 0,
        rejectedActions: 0,
        averageConfidence: 0,
        activeConversations: 0,
      },
    ]),
  ) as Record<(typeof AGENT_DOMAINS)[number], ReturnType<typeof makeInitialAgentStates>[string]>
}

beforeEach(() => {
  useAgentOrchestrator.setState({
    messages: [],
    isProcessing: false,
    activeAgents: [],
    lastIntent: null,
    error: null,
    pendingBatch: null,
    actionHistory: [],
    input: '',
    agentStates: makeInitialAgentStates() as never,
  })
})

describe('input management', () => {
  it('should update input value via setInput', () => {
    const { setInput } = useAgentOrchestrator.getState()
    setInput('@schedule check delay')
    expect(useAgentOrchestrator.getState().input).toBe('@schedule check delay')
  })

  it('should start with empty input', () => {
    expect(useAgentOrchestrator.getState().input).toBe('')
  })
})

describe('addUserMessage', () => {
  it('should add a user message to the messages array', () => {
    const { addUserMessage } = useAgentOrchestrator.getState()
    addUserMessage('What is the schedule status?')
    const { messages } = useAgentOrchestrator.getState()
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toBe('What is the schedule status?')
  })

  it('should return the created message', () => {
    const { addUserMessage } = useAgentOrchestrator.getState()
    const msg = addUserMessage('Hello agent')
    expect(msg.id).toBeTruthy()
    expect(msg.role).toBe('user')
    expect(msg.content).toBe('Hello agent')
    expect(msg.timestamp).toBeInstanceOf(Date)
  })

  it('should assign an id string to each message', () => {
    const { addUserMessage } = useAgentOrchestrator.getState()
    const msg1 = addUserMessage('First')
    const msg2 = addUserMessage('Second')
    expect(typeof msg1.id).toBe('string')
    expect(msg1.id.length).toBeGreaterThan(0)
    expect(typeof msg2.id).toBe('string')
    expect(msg2.id.length).toBeGreaterThan(0)
  })

  it('should append messages in order', () => {
    const { addUserMessage } = useAgentOrchestrator.getState()
    addUserMessage('First message')
    addUserMessage('Second message')
    const { messages } = useAgentOrchestrator.getState()
    expect(messages).toHaveLength(2)
    expect(messages[0].content).toBe('First message')
    expect(messages[1].content).toBe('Second message')
  })
})

describe('addCoordinatorMessage', () => {
  it('should add a coordinator message', () => {
    const { addCoordinatorMessage } = useAgentOrchestrator.getState()
    addCoordinatorMessage('Routing to Schedule Agent...')
    const { messages } = useAgentOrchestrator.getState()
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('coordinator')
    expect(messages[0].content).toBe('Routing to Schedule Agent...')
  })

  it('should attach routingInfo when provided', () => {
    const intent: IntentClassification = {
      intent: 'single_agent',
      targetAgents: ['schedule'],
      confidence: 0.92,
      reasoning: 'Schedule-related query',
    }
    const { addCoordinatorMessage } = useAgentOrchestrator.getState()
    addCoordinatorMessage('Routing to Schedule Agent...', intent)
    const { messages } = useAgentOrchestrator.getState()
    expect(messages[0].routingInfo).toBeDefined()
    expect(messages[0].routingInfo?.targetAgents).toContain('schedule')
    expect(messages[0].routingInfo?.reasoning).toBe('Schedule-related query')
  })

  it('should not attach routingInfo when not provided', () => {
    const { addCoordinatorMessage } = useAgentOrchestrator.getState()
    addCoordinatorMessage('Processing...')
    const { messages } = useAgentOrchestrator.getState()
    expect(messages[0].routingInfo).toBeUndefined()
  })
})

describe('addAgentMessage', () => {
  it('should add an agent message with domain info', () => {
    const { addAgentMessage } = useAgentOrchestrator.getState()
    addAgentMessage('schedule', 'Project is 4 days ahead')
    const { messages } = useAgentOrchestrator.getState()
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('agent')
    expect(messages[0].agentDomain).toBe('schedule')
    expect(messages[0].content).toBe('Project is 4 days ahead')
  })

  it('should populate agentName from SPECIALIST_AGENTS', () => {
    const { addAgentMessage } = useAgentOrchestrator.getState()
    addAgentMessage('cost', 'Budget is healthy')
    const { messages } = useAgentOrchestrator.getState()
    expect(messages[0].agentName).toBe('Cost Agent')
  })

  it('should attach toolCalls when provided in extras', () => {
    const { addAgentMessage } = useAgentOrchestrator.getState()
    const toolCalls = [
      {
        id: 'tc-1',
        tool: 'query_schedule',
        input: { projectId: 'p1' },
        result: { tasks: [] },
        domain: 'schedule' as const,
      },
    ]
    addAgentMessage('schedule', 'Found schedule data', { toolCalls })
    const { messages } = useAgentOrchestrator.getState()
    expect(messages[0].toolCalls).toHaveLength(1)
    expect(messages[0].toolCalls![0].tool).toBe('query_schedule')
  })

  it('should attach generativeBlocks when provided', () => {
    const { addAgentMessage } = useAgentOrchestrator.getState()
    const generativeBlocks = [
      { type: 'metric_cards' as const, data: { cards: [] } },
    ]
    addAgentMessage('cost', 'Budget summary', { generativeBlocks })
    const { messages } = useAgentOrchestrator.getState()
    expect(messages[0].generativeBlocks).toHaveLength(1)
    expect(messages[0].generativeBlocks![0].type).toBe('metric_cards')
  })

  it('should support all agent domains', () => {
    const { addAgentMessage } = useAgentOrchestrator.getState()
    for (const domain of AGENT_DOMAINS) {
      addAgentMessage(domain, `Response from ${domain}`)
    }
    const { messages } = useAgentOrchestrator.getState()
    expect(messages).toHaveLength(AGENT_DOMAINS.length)
  })
})

describe('setActiveAgents / setProcessing / setError', () => {
  it('should set active agents', () => {
    useAgentOrchestrator.getState().setActiveAgents(['schedule', 'cost'])
    expect(useAgentOrchestrator.getState().activeAgents).toEqual(['schedule', 'cost'])
  })

  it('should set processing state', () => {
    useAgentOrchestrator.getState().setProcessing(true)
    expect(useAgentOrchestrator.getState().isProcessing).toBe(true)
    useAgentOrchestrator.getState().setProcessing(false)
    expect(useAgentOrchestrator.getState().isProcessing).toBe(false)
  })

  it('should set error message', () => {
    useAgentOrchestrator.getState().setError('Network timeout')
    expect(useAgentOrchestrator.getState().error).toBe('Network timeout')
  })

  it('should clear error when set to null', () => {
    useAgentOrchestrator.getState().setError('Something went wrong')
    useAgentOrchestrator.getState().setError(null)
    expect(useAgentOrchestrator.getState().error).toBeNull()
  })

  it('should set lastIntent', () => {
    const intent: IntentClassification = {
      intent: 'multi_agent',
      targetAgents: ['schedule', 'cost'],
      confidence: 0.9,
      reasoning: 'Budget and schedule query',
    }
    useAgentOrchestrator.getState().setLastIntent(intent)
    expect(useAgentOrchestrator.getState().lastIntent).toEqual(intent)
  })
})

describe('clearMessages', () => {
  it('should remove all messages', () => {
    const store = useAgentOrchestrator.getState()
    store.addUserMessage('hello')
    store.addCoordinatorMessage('routing...')
    store.clearMessages()
    expect(useAgentOrchestrator.getState().messages).toHaveLength(0)
  })

  it('should clear active agents', () => {
    useAgentOrchestrator.getState().setActiveAgents(['schedule', 'cost'])
    useAgentOrchestrator.getState().clearMessages()
    expect(useAgentOrchestrator.getState().activeAgents).toHaveLength(0)
  })

  it('should clear lastIntent', () => {
    const intent: IntentClassification = {
      intent: 'single_agent',
      targetAgents: ['safety'],
      confidence: 0.95,
      reasoning: 'Safety query',
    }
    useAgentOrchestrator.getState().setLastIntent(intent)
    useAgentOrchestrator.getState().clearMessages()
    expect(useAgentOrchestrator.getState().lastIntent).toBeNull()
  })

  it('should clear pendingBatch', () => {
    useAgentOrchestrator.getState().setPendingBatch({
      id: 'batch-1',
      actions: [],
      status: 'pending',
      createdAt: new Date(),
    })
    useAgentOrchestrator.getState().clearMessages()
    expect(useAgentOrchestrator.getState().pendingBatch).toBeNull()
  })

  it('should clear error', () => {
    useAgentOrchestrator.getState().setError('some error')
    useAgentOrchestrator.getState().clearMessages()
    expect(useAgentOrchestrator.getState().error).toBeNull()
  })
})

describe('handleOrchestratorResponse', () => {
  it('should append messages from the response', () => {
    const store = useAgentOrchestrator.getState()
    store.addUserMessage('How is the project?')

    const intent: IntentClassification = {
      intent: 'multi_agent',
      targetAgents: ['schedule', 'cost'],
      confidence: 0.9,
      reasoning: 'General status query',
    }
    const response: OrchestratorResponse = {
      messages: [
        {
          id: 'agent-msg-1',
          role: 'agent',
          content: 'Schedule looks good',
          timestamp: new Date(),
          agentDomain: 'schedule',
        },
      ],
      pendingActions: [],
      metadata: {
        totalAgentsInvoked: 1,
        totalProcessingTimeMs: 500,
        intent,
      },
    }
    useAgentOrchestrator.getState().handleOrchestratorResponse(response)
    const { messages } = useAgentOrchestrator.getState()
    expect(messages).toHaveLength(2) // user message + agent response
    expect(messages[1].content).toBe('Schedule looks good')
  })

  it('should set isProcessing to false after response', () => {
    useAgentOrchestrator.getState().setProcessing(true)
    const intent: IntentClassification = {
      intent: 'single_agent',
      targetAgents: ['schedule'],
      confidence: 0.9,
      reasoning: 'test',
    }
    useAgentOrchestrator.getState().handleOrchestratorResponse({
      messages: [],
      pendingActions: [],
      metadata: { totalAgentsInvoked: 1, totalProcessingTimeMs: 100, intent },
    })
    expect(useAgentOrchestrator.getState().isProcessing).toBe(false)
  })

  it('should clear activeAgents after response', () => {
    useAgentOrchestrator.getState().setActiveAgents(['schedule', 'cost'])
    const intent: IntentClassification = {
      intent: 'multi_agent',
      targetAgents: ['schedule', 'cost'],
      confidence: 0.9,
      reasoning: 'test',
    }
    useAgentOrchestrator.getState().handleOrchestratorResponse({
      messages: [],
      pendingActions: [],
      metadata: { totalAgentsInvoked: 2, totalProcessingTimeMs: 800, intent },
    })
    expect(useAgentOrchestrator.getState().activeAgents).toHaveLength(0)
  })

  it('should create pendingBatch when response has pending actions', () => {
    const action: AgentSuggestedAction = {
      id: 'action-1',
      domain: 'schedule',
      description: 'Update MEP start date',
      tool: 'suggest_reordering',
      input: { task_id: 'mep-1', delay_days: 3 },
      confidence: 88,
      impact: 'high',
      requiresApproval: true,
    }
    const intent: IntentClassification = {
      intent: 'single_agent',
      targetAgents: ['schedule'],
      confidence: 0.88,
      reasoning: 'test',
    }
    useAgentOrchestrator.getState().handleOrchestratorResponse({
      messages: [],
      pendingActions: [action],
      metadata: { totalAgentsInvoked: 1, totalProcessingTimeMs: 300, intent },
    })
    const { pendingBatch } = useAgentOrchestrator.getState()
    expect(pendingBatch).not.toBeNull()
    expect(pendingBatch!.actions).toHaveLength(1)
    expect(pendingBatch!.status).toBe('pending')
  })

  it('should update lastIntent from response metadata', () => {
    const intent: IntentClassification = {
      intent: 'single_agent',
      targetAgents: ['safety'],
      confidence: 0.95,
      reasoning: 'Safety PPE query',
    }
    useAgentOrchestrator.getState().handleOrchestratorResponse({
      messages: [],
      pendingActions: [],
      metadata: { totalAgentsInvoked: 1, totalProcessingTimeMs: 200, intent },
    })
    expect(useAgentOrchestrator.getState().lastIntent).toEqual(intent)
  })
})

describe('approveAction', () => {
  function setupBatch() {
    const action: AgentSuggestedAction = {
      id: 'action-test-1',
      domain: 'schedule',
      description: 'Reschedule MEP start',
      tool: 'suggest_reordering',
      input: {},
      confidence: 88,
      impact: 'high',
      requiresApproval: true,
    }
    useAgentOrchestrator.getState().setPendingBatch({
      id: 'batch-test',
      actions: [action],
      status: 'pending',
      createdAt: new Date(),
    })
    return action
  }

  it('should remove approved action from pendingBatch', () => {
    const action = setupBatch()
    useAgentOrchestrator.getState().approveAction(action.id)
    expect(useAgentOrchestrator.getState().pendingBatch).toBeNull()
  })

  it('should add approved action to actionHistory', () => {
    const action = setupBatch()
    useAgentOrchestrator.getState().approveAction(action.id)
    const { actionHistory } = useAgentOrchestrator.getState()
    expect(actionHistory).toHaveLength(1)
    expect(actionHistory[0].status).toBe('approved')
  })

  it('should increment approvedActions counter for the agent', () => {
    const action = setupBatch()
    const before = useAgentOrchestrator.getState().agentStates.schedule.approvedActions
    useAgentOrchestrator.getState().approveAction(action.id)
    const after = useAgentOrchestrator.getState().agentStates.schedule.approvedActions
    expect(after).toBe(before + 1)
  })

  it('should leave batch intact when multiple actions and one is approved', () => {
    const action1: AgentSuggestedAction = {
      id: 'a1',
      domain: 'schedule',
      description: 'Action 1',
      tool: 'suggest_reordering',
      input: {},
      confidence: 80,
      impact: 'medium',
      requiresApproval: true,
    }
    const action2: AgentSuggestedAction = {
      id: 'a2',
      domain: 'cost',
      description: 'Action 2',
      tool: 'draft_change_order',
      input: {},
      confidence: 90,
      impact: 'high',
      requiresApproval: true,
    }
    useAgentOrchestrator.getState().setPendingBatch({
      id: 'batch-multi',
      actions: [action1, action2],
      status: 'pending',
      createdAt: new Date(),
    })
    useAgentOrchestrator.getState().approveAction('a1')
    const { pendingBatch } = useAgentOrchestrator.getState()
    expect(pendingBatch).not.toBeNull()
    expect(pendingBatch!.actions).toHaveLength(1)
    expect(pendingBatch!.actions[0].id).toBe('a2')
  })

  it('should do nothing when no pendingBatch', () => {
    expect(() => useAgentOrchestrator.getState().approveAction('nonexistent')).not.toThrow()
    expect(useAgentOrchestrator.getState().pendingBatch).toBeNull()
  })
})

describe('rejectAction', () => {
  it('should remove rejected action from pendingBatch', () => {
    const action: AgentSuggestedAction = {
      id: 'action-rej-1',
      domain: 'cost',
      description: 'Draft change order',
      tool: 'draft_change_order',
      input: {},
      confidence: 90,
      impact: 'high',
      requiresApproval: true,
    }
    useAgentOrchestrator.getState().setPendingBatch({
      id: 'batch-rej',
      actions: [action],
      status: 'pending',
      createdAt: new Date(),
    })
    useAgentOrchestrator.getState().rejectAction(action.id)
    expect(useAgentOrchestrator.getState().pendingBatch).toBeNull()
  })

  it('should increment rejectedActions counter for the agent', () => {
    const action: AgentSuggestedAction = {
      id: 'action-rej-2',
      domain: 'safety',
      description: 'Generate JHA',
      tool: 'generate_jha',
      input: {},
      confidence: 95,
      impact: 'critical',
      requiresApproval: true,
    }
    useAgentOrchestrator.getState().setPendingBatch({
      id: 'batch-safety',
      actions: [action],
      status: 'pending',
      createdAt: new Date(),
    })
    const before = useAgentOrchestrator.getState().agentStates.safety.rejectedActions
    useAgentOrchestrator.getState().rejectAction(action.id)
    const after = useAgentOrchestrator.getState().agentStates.safety.rejectedActions
    expect(after).toBe(before + 1)
  })
})

describe('approveAllPending / rejectAllPending', () => {
  function setupMultiActionBatch() {
    const actions: AgentSuggestedAction[] = [
      { id: 'bulk-a1', domain: 'schedule', description: 'A1', tool: 'suggest_reordering', input: {}, confidence: 80, impact: 'medium', requiresApproval: true },
      { id: 'bulk-a2', domain: 'cost', description: 'A2', tool: 'draft_change_order', input: {}, confidence: 90, impact: 'high', requiresApproval: true },
      { id: 'bulk-a3', domain: 'safety', description: 'A3', tool: 'generate_jha', input: {}, confidence: 95, impact: 'critical', requiresApproval: true },
    ]
    useAgentOrchestrator.getState().setPendingBatch({
      id: 'batch-bulk',
      actions,
      status: 'pending',
      createdAt: new Date(),
    })
    return actions
  }

  it('approveAllPending should clear the pendingBatch', () => {
    setupMultiActionBatch()
    useAgentOrchestrator.getState().approveAllPending()
    expect(useAgentOrchestrator.getState().pendingBatch).toBeNull()
  })

  it('approveAllPending should add all actions to actionHistory', () => {
    setupMultiActionBatch()
    useAgentOrchestrator.getState().approveAllPending()
    const { actionHistory } = useAgentOrchestrator.getState()
    expect(actionHistory.length).toBeGreaterThanOrEqual(3)
  })

  it('rejectAllPending should clear the pendingBatch', () => {
    setupMultiActionBatch()
    useAgentOrchestrator.getState().rejectAllPending()
    expect(useAgentOrchestrator.getState().pendingBatch).toBeNull()
  })

  it('approveAllPending does nothing when no pendingBatch', () => {
    expect(() => useAgentOrchestrator.getState().approveAllPending()).not.toThrow()
  })

  it('rejectAllPending does nothing when no pendingBatch', () => {
    expect(() => useAgentOrchestrator.getState().rejectAllPending()).not.toThrow()
  })
})

describe('setAgentStatus', () => {
  it('should update agent status', () => {
    useAgentOrchestrator.getState().setAgentStatus('schedule', 'paused')
    expect(useAgentOrchestrator.getState().agentStates.schedule.status).toBe('paused')
  })

  it('should not affect other agents when updating one', () => {
    useAgentOrchestrator.getState().setAgentStatus('schedule', 'error')
    expect(useAgentOrchestrator.getState().agentStates.cost.status).toBe('active')
    expect(useAgentOrchestrator.getState().agentStates.safety.status).toBe('active')
  })
})

describe('incrementAgentActions', () => {
  it('should increment totalActions when approved', () => {
    const before = useAgentOrchestrator.getState().agentStates.quality.totalActions
    useAgentOrchestrator.getState().incrementAgentActions('quality', true)
    const after = useAgentOrchestrator.getState().agentStates.quality.totalActions
    expect(after).toBe(before + 1)
  })

  it('should increment approvedActions when approved is true', () => {
    const before = useAgentOrchestrator.getState().agentStates.compliance.approvedActions
    useAgentOrchestrator.getState().incrementAgentActions('compliance', true)
    const after = useAgentOrchestrator.getState().agentStates.compliance.approvedActions
    expect(after).toBe(before + 1)
  })

  it('should increment rejectedActions when approved is false', () => {
    const before = useAgentOrchestrator.getState().agentStates.document.rejectedActions
    useAgentOrchestrator.getState().incrementAgentActions('document', false)
    const after = useAgentOrchestrator.getState().agentStates.document.rejectedActions
    expect(after).toBe(before + 1)
  })

  it('should not increment rejectedActions when approved is true', () => {
    const before = useAgentOrchestrator.getState().agentStates.schedule.rejectedActions
    useAgentOrchestrator.getState().incrementAgentActions('schedule', true)
    expect(useAgentOrchestrator.getState().agentStates.schedule.rejectedActions).toBe(before)
  })
})
