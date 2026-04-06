# Phase 2B: AG-UI Protocol for Real-time Agent Streaming

## Pre-Requisite
Paste `00_SYSTEM_CONTEXT.md` before executing this prompt.

**Objective**: Enable real-time, streaming visualization of AI agent actions as they execute, showing users exactly what the agents are thinking, computing, and deciding in real-time.

**Status**: Phase 2 Core Feature | High Impact | High Complexity

**Competitive Advantage**: Procore has no visibility into AI reasoning. SiteSync users watch agents work in real-time, approve intermediate results, and course-correct instantly.

---

## 1. Overview & Strategic Value

The AG-UI protocol (CopilotKit) creates a real-time communication channel between agents and the UI, streaming:

1. **State snapshots**: Current agent state (analyzing, calculating, deciding)
2. **Tool calls**: Which tools are being invoked and why
3. **Intermediate results**: Progress toward final answer
4. **Human-in-the-loop**: User approves/rejects agent actions mid-stream
5. **Visual feedback**: Live progress bars, status cards, reasoning logs

**Example Flow**:
```
User: "Forecast our schedule risk"
  ↓
Agent starts: "Analyzing 247 tasks, 15 critical path dependencies"
  ↓
Agent calls tool: "Fetching historical delay patterns from past projects"
  ↓
UI shows: "Analyzing patterns from Q4 2024 (3 projects, 1.2M data points)"
  ↓
Agent calls tool: "Running Monte Carlo simulation with 10,000 iterations"
  ↓
UI shows: "Monte Carlo 34% complete... 67% complete... 100% complete"
  ↓
Agent proposes: "P50 delay: 18 days. Recommend resource increase on steel erection."
  ↓
User reviews proposal live, clicks "Approve" → Agent continues
  ↓
Agent generates report
  ↓
User sees final report with live action buttons
```

---

## 2. Architecture

### 2.1 Protocol Stack

```
UI Layer (React)
    ↓ (SSE + WebSocket)
Agent Stream Panel (AG-UI Events)
    ↓
Event Processor (parse, validate, dispatch)
    ↓
State Manager (XState + React Query)
    ↓
Component Rendering (real-time updates)
    ↓
Human-in-the-loop Gateway (approval/rejection)
    ↓ (HTTP + resume signal)
Agent Orchestrator (backend edge function)
    ↓
Multi-Agent Executor (6 specialist agents)
    ↓
Tools & APIs (database, ML, external services)
```

### 2.2 Event Types (Zod Schemas)

```typescript
// src/schemas/agUI.ts

import { z } from 'zod';

// Base event schema
export const BaseEventSchema = z.object({
  agentId: z.string(),
  eventId: z.string().uuid(),
  timestamp: z.string().datetime(),
  sessionId: z.string(),
});

// 1. State Snapshot Event
export const StateSnapshotEventSchema = BaseEventSchema.extend({
  type: z.literal('state_snapshot'),
  data: z.object({
    state: z.enum([
      'initializing',
      'planning',
      'executing',
      'analyzing',
      'calculating',
      'generating',
      'awaiting_approval',
      'completed',
      'error',
    ]),
    description: z.string(), // "Analyzing 847 RFIs for patterns..."
    progress: z.number().min(0).max(100).optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

// 2. Tool Call Start Event
export const ToolCallStartEventSchema = BaseEventSchema.extend({
  type: z.literal('tool_call_start'),
  data: z.object({
    toolName: z.string(),
    toolDescription: z.string(),
    parameters: z.record(z.any()),
    estimatedDuration: z.number().optional(), // seconds
    rationale: z.string(), // "Fetching RFI data to identify blocking issues"
  }),
});

// 3. Tool Call Progress Event
export const ToolCallProgressEventSchema = BaseEventSchema.extend({
  type: z.literal('tool_call_progress'),
  data: z.object({
    toolName: z.string(),
    progress: z.number().min(0).max(100),
    message: z.string(), // "Processing 247 of 847 RFIs..."
    currentResult: z.any().optional(),
  }),
});

// 4. Tool Call End Event
export const ToolCallEndEventSchema = BaseEventSchema.extend({
  type: z.literal('tool_call_end'),
  data: z.object({
    toolName: z.string(),
    status: z.enum(['success', 'partial', 'error']),
    result: z.any(),
    duration: z.number(), // milliseconds
    errorMessage: z.string().optional(),
  }),
});

// 5. Text Message Event
export const TextMessageEventSchema = BaseEventSchema.extend({
  type: z.literal('text_message'),
  data: z.object({
    role: z.enum(['agent', 'user', 'system']),
    content: z.string(),
    streaming: z.boolean().optional(), // true if content is streaming
  }),
});

// 6. Approval Request Event
export const ApprovalRequestEventSchema = BaseEventSchema.extend({
  type: z.literal('approval_request'),
  data: z.object({
    actionId: z.string(),
    actionTitle: z.string(),
    actionDescription: z.string(),
    proposedData: z.any(), // What the agent proposes
    context: z.string().optional(),
    allowedResponses: z.array(z.enum(['approve', 'reject', 'modify'])).default(['approve', 'reject']),
    timeoutSeconds: z.number().optional(),
  }),
});

// 7. Error Event
export const ErrorEventSchema = BaseEventSchema.extend({
  type: z.literal('error'),
  data: z.object({
    severity: z.enum(['warning', 'error', 'critical']),
    message: z.string(),
    code: z.string().optional(),
    context: z.string().optional(),
    recoveryAction: z.string().optional(),
  }),
});

// 8. Summary Event (final result)
export const SummaryEventSchema = BaseEventSchema.extend({
  type: z.literal('summary'),
  data: z.object({
    title: z.string(),
    result: z.any(),
    actionsTaken: z.array(z.string()),
    recommendedNextSteps: z.array(z.string()),
  }),
});

// Union of all events
export const AgUIEventSchema = z.discriminatedUnion('type', [
  StateSnapshotEventSchema,
  ToolCallStartEventSchema,
  ToolCallProgressEventSchema,
  ToolCallEndEventSchema,
  TextMessageEventSchema,
  ApprovalRequestEventSchema,
  ErrorEventSchema,
  SummaryEventSchema,
]);

export type AgUIEvent = z.infer<typeof AgUIEventSchema>;
export type StateSnapshotEvent = z.infer<typeof StateSnapshotEventSchema>;
export type ToolCallStartEvent = z.infer<typeof ToolCallStartEventSchema>;
export type ToolCallProgressEvent = z.infer<typeof ToolCallProgressEventSchema>;
export type ToolCallEndEvent = z.infer<typeof ToolCallEndEventSchema>;
export type TextMessageEvent = z.infer<typeof TextMessageEventSchema>;
export type ApprovalRequestEvent = z.infer<typeof ApprovalRequestEventSchema>;
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;
export type SummaryEvent = z.infer<typeof SummaryEventSchema>;
```

---

## 3. React UI Components

### 3.1 AgentStreamPanel Component

**Purpose**: Main container showing real-time agent execution with streaming events.

```typescript
// src/components/agUI/AgentStreamPanel.tsx

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Card } from '@/components/Primitives';
import {
  Loader,
  CheckCircle,
  AlertCircle,
  Zap,
  MessageCircle,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AgUIEvent, ApprovalRequestEvent } from '@/schemas/agUI';

interface AgentStreamPanelProps {
  sessionId: string;
  projectId: string;
  initialPrompt: string;
  onComplete?: (summary: any) => void;
  onError?: (error: Error) => void;
  maxHeight?: string;
  showTimestamps?: boolean;
}

interface StreamEvent {
  event: AgUIEvent;
  displayedAt: Date;
}

const AgentStreamPanel: React.FC<AgentStreamPanelProps> = ({
  sessionId,
  projectId,
  initialPrompt,
  onComplete,
  onError,
  maxHeight = '600px',
  showTimestamps = true,
}) => {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [currentState, setCurrentState] = useState<string>('initializing');
  const [isStreamActive, setIsStreamActive] = useState(true);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequestEvent | null>(null);
  const [approvalInProgress, setApprovalInProgress] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  // Connect to SSE stream
  useEffect(() => {
    const url = new URL('/api/agents/stream', window.location.origin);
    url.searchParams.set('sessionId', sessionId);
    url.searchParams.set('projectId', projectId);
    url.searchParams.set('initialPrompt', initialPrompt);

    const eventSource = new EventSource(url.toString());
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('state_snapshot', (ev) => {
      const data = JSON.parse(ev.data);
      setCurrentState(data.data.state);
      setEvents((prev) => [...prev, { event: data, displayedAt: new Date() }]);
    });

    eventSource.addEventListener('tool_call_start', (ev) => {
      const data = JSON.parse(ev.data);
      setEvents((prev) => [...prev, { event: data, displayedAt: new Date() }]);
    });

    eventSource.addEventListener('tool_call_progress', (ev) => {
      const data = JSON.parse(ev.data);
      setEvents((prev) => [...prev, { event: data, displayedAt: new Date() }]);
    });

    eventSource.addEventListener('tool_call_end', (ev) => {
      const data = JSON.parse(ev.data);
      setEvents((prev) => [...prev, { event: data, displayedAt: new Date() }]);
    });

    eventSource.addEventListener('text_message', (ev) => {
      const data = JSON.parse(ev.data);
      setEvents((prev) => [...prev, { event: data, displayedAt: new Date() }]);
    });

    eventSource.addEventListener('approval_request', (ev) => {
      const data = JSON.parse(ev.data);
      setApprovalRequest(data);
      setEvents((prev) => [...prev, { event: data, displayedAt: new Date() }]);
    });

    eventSource.addEventListener('error', (ev) => {
      const data = JSON.parse(ev.data);
      setEvents((prev) => [...prev, { event: data, displayedAt: new Date() }]);
      onError?.(new Error(data.data.message));
    });

    eventSource.addEventListener('summary', (ev) => {
      const data = JSON.parse(ev.data);
      setEvents((prev) => [...prev, { event: data, displayedAt: new Date() }]);
      setIsStreamActive(false);
      onComplete?.(data.data);
    });

    eventSource.addEventListener('error', (error) => {
      console.error('EventSource error:', error);
      eventSource.close();
      setIsStreamActive(false);
      onError?.(new Error('Stream connection lost'));
    });

    return () => {
      eventSource.close();
    };
  }, [sessionId, projectId, initialPrompt, onComplete, onError]);

  const handleApproval = useCallback(
    async (approved: boolean, feedback?: string) => {
      if (!approvalRequest) return;

      setApprovalInProgress(true);
      try {
        const response = await fetch('/api/agents/approval', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            actionId: approvalRequest.data.actionId,
            approved,
            feedback,
          }),
        });

        if (!response.ok) {
          throw new Error('Approval submission failed');
        }

        setApprovalRequest(null);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
      } finally {
        setApprovalInProgress(false);
      }
    },
    [approvalRequest, sessionId, onError]
  );

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStateIcon = (state: string) => {
    if (state === 'completed') return <CheckCircle size={16} style={{ color: '#4EC896' }} />;
    if (state === 'error') return <AlertCircle size={16} style={{ color: '#EF5350' }} />;
    return <Loader size={16} style={{ color: '#2196F3', animation: 'spin 1s linear infinite' }} />;
  };

  const getEventIcon = (event: AgUIEvent) => {
    switch (event.type) {
      case 'state_snapshot':
        return <TrendingUp size={14} style={{ color: '#FB8500' }} />;
      case 'tool_call_start':
      case 'tool_call_progress':
      case 'tool_call_end':
        return <Zap size={14} style={{ color: '#2196F3' }} />;
      case 'text_message':
        return <MessageCircle size={14} style={{ color: '#666' }} />;
      case 'approval_request':
        return <AlertCircle size={14} style={{ color: '#FB8500' }} />;
      case 'error':
        return <AlertCircle size={14} style={{ color: '#EF5350' }} />;
      case 'summary':
        return <CheckCircle size={14} style={{ color: '#4EC896' }} />;
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: '#F7F8FA',
          borderBottom: '1px solid #E0E0E0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {getStateIcon(currentState)}
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F1629' }}>
            Agent Execution Stream
          </span>
        </div>
        {isStreamActive && (
          <span style={{ fontSize: '11px', color: '#4EC896' }}>Live</span>
        )}
      </div>

      {/* Event Stream */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          maxHeight,
          backgroundColor: '#FFFFFF',
        }}
      >
        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: '#999' }}>
            <Loader size={24} style={{ margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: '12px' }}>Initializing agent stream...</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {events.map((eventItem, idx) => {
              const event = eventItem.event;
              const isExpanded = expandedEvent === event.eventId;

              return (
                <div
                  key={event.eventId}
                  style={{
                    backgroundColor: '#F9F9F9',
                    border: '1px solid #E0E0E0',
                    borderRadius: '6px',
                    padding: '10px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'flex-start',
                      cursor: event.type !== 'state_snapshot' ? 'pointer' : 'default',
                    }}
                    onClick={() =>
                      event.type !== 'state_snapshot' &&
                      setExpandedEvent(isExpanded ? null : event.eventId)
                    }
                  >
                    {getEventIcon(event)}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* State Snapshot */}
                      {event.type === 'state_snapshot' && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F1629' }}>
                            {event.data.description}
                          </div>
                          {event.data.progress !== undefined && (
                            <div style={{ marginTop: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '11px', color: '#666' }}>Progress</span>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#0F1629' }}>
                                  {event.data.progress}%
                                </span>
                              </div>
                              <div
                                style={{
                                  width: '100%',
                                  height: '4px',
                                  backgroundColor: '#E0E0E0',
                                  borderRadius: '2px',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${event.data.progress}%`,
                                    height: '100%',
                                    backgroundColor: '#4EC896',
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tool Call Start */}
                      {event.type === 'tool_call_start' && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F1629' }}>
                            Calling: {event.data.toolName}
                          </div>
                          <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                            {event.data.rationale}
                          </div>
                          {isExpanded && (
                            <pre
                              style={{
                                backgroundColor: '#FFFFFF',
                                padding: '6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                color: '#555',
                                marginTop: '6px',
                                overflow: 'auto',
                                maxHeight: '150px',
                              }}
                            >
                              {JSON.stringify(event.data.parameters, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}

                      {/* Tool Call Progress */}
                      {event.type === 'tool_call_progress' && (
                        <div>
                          <div style={{ fontSize: '12px', color: '#0F1629' }}>
                            {event.data.message}
                          </div>
                          <div
                            style={{
                              width: '100%',
                              height: '4px',
                              backgroundColor: '#E0E0E0',
                              borderRadius: '2px',
                              overflow: 'hidden',
                              marginTop: '4px',
                            }}
                          >
                            <div
                              style={{
                                width: `${event.data.progress}%`,
                                height: '100%',
                                backgroundColor: '#2196F3',
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Tool Call End */}
                      {event.type === 'tool_call_end' && (
                        <div>
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: event.data.status === 'success' ? '#2E7D32' : '#E65100',
                            }}
                          >
                            {event.data.toolName} {event.data.status === 'success' ? 'completed' : 'failed'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                            {(event.data.duration / 1000).toFixed(1)}s
                          </div>
                          {isExpanded && (
                            <pre
                              style={{
                                backgroundColor: '#FFFFFF',
                                padding: '6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                color: '#555',
                                marginTop: '6px',
                                overflow: 'auto',
                                maxHeight: '150px',
                              }}
                            >
                              {JSON.stringify(event.data.result, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}

                      {/* Text Message */}
                      {event.type === 'text_message' && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#0F1629',
                            lineHeight: '1.4',
                          }}
                        >
                          {event.data.content}
                        </div>
                      )}

                      {/* Error */}
                      {event.type === 'error' && (
                        <div
                          style={{
                            backgroundColor: '#FFEBEE',
                            border: '1px solid #EF5350',
                            padding: '6px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#C62828',
                          }}
                        >
                          {event.data.message}
                        </div>
                      )}

                      {/* Summary */}
                      {event.type === 'summary' && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#2E7D32', marginBottom: '6px' }}>
                            {event.data.title}
                          </div>
                          {event.data.actionsTaken.length > 0 && (
                            <div style={{ fontSize: '11px', color: '#555', marginBottom: '6px' }}>
                              <strong>Actions Taken:</strong>
                              <ul style={{ margin: '4px 0 0 16px', paddingLeft: 0 }}>
                                {event.data.actionsTaken.map((action, i) => (
                                  <li key={i} style={{ marginBottom: '2px' }}>
                                    {action}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expand/Collapse Icon */}
                    {(event.type === 'tool_call_start' ||
                      event.type === 'tool_call_end' ||
                      event.type === 'approval_request') && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          color: '#999',
                        }}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  {showTimestamps && (
                    <div style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>
                      {formatTime(eventItem.displayedAt)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Approval Panel */}
      {approvalRequest && (
        <Card
          style={{
            backgroundColor: '#FFF3E0',
            border: '2px solid #FB8500',
            borderRadius: 0,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ fontWeight: 600, color: '#E65100', fontSize: '13px' }}>
            Agent Approval Required
          </div>
          <div style={{ fontSize: '12px', color: '#555', lineHeight: '1.4' }}>
            {approvalRequest.data.actionDescription}
          </div>
          {approvalRequest.data.context && (
            <div
              style={{
                backgroundColor: '#FFFFFF',
                padding: '8px',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#666',
              }}
            >
              {approvalRequest.data.context}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleApproval(true)}
              disabled={approvalInProgress}
              style={{
                padding: '6px 12px',
                backgroundColor: '#4EC896',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: approvalInProgress ? 'not-allowed' : 'pointer',
                color: '#FFFFFF',
                opacity: approvalInProgress ? 0.6 : 1,
              }}
            >
              Approve
            </button>
            <button
              onClick={() => handleApproval(false)}
              disabled={approvalInProgress}
              style={{
                padding: '6px 12px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #FB8500',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: approvalInProgress ? 'not-allowed' : 'pointer',
                color: '#E65100',
                opacity: approvalInProgress ? 0.6 : 1,
              }}
            >
              Reject
            </button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AgentStreamPanel;
```

### 3.2 AgentStatusBadge Component

**Purpose**: Small indicator showing active agents on sidebar.

```typescript
// src/components/agUI/AgentStatusBadge.tsx

import React from 'react';
import { Zap } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  status: 'idle' | 'executing' | 'awaiting_approval' | 'error';
  currentTask?: string;
}

interface AgentStatusBadgeProps {
  agents: Agent[];
  compact?: boolean;
}

const AgentStatusBadge: React.FC<AgentStatusBadgeProps> = ({ agents, compact = false }) => {
  const activeAgents = agents.filter((a) => a.status !== 'idle');

  if (activeAgents.length === 0) return null;

  const statusColors = {
    idle: '#999',
    executing: '#2196F3',
    awaiting_approval: '#FB8500',
    error: '#EF5350',
  };

  if (compact) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: '#E3F2FD',
          color: '#1565C0',
          padding: '2px 6px',
          borderRadius: '12px',
          fontSize: '10px',
          fontWeight: 600,
        }}
      >
        <Zap size={10} style={{ animation: 'pulse 1s ease-in-out infinite' }} />
        {activeAgents.length} Agent{activeAgents.length !== 1 ? 's' : ''} Active
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {activeAgents.map((agent) => (
        <div
          key={agent.id}
          style={{
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            padding: '6px 8px',
            backgroundColor: '#F9F9F9',
            borderRadius: '4px',
            marginBottom: '4px',
            fontSize: '11px',
          }}
        >
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: statusColors[agent.status],
              animation: agent.status === 'executing' ? 'pulse 1s ease-in-out infinite' : 'none',
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#0F1629', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {agent.name}
            </div>
            {agent.currentTask && (
              <div style={{ color: '#999', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {agent.currentTask}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AgentStatusBadge;
```

---

## 4. Backend Implementation

### 4.1 Agent Orchestrator with SSE

```typescript
// api/agents/stream.ts (Supabase Edge Function)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

interface AgentMessage {
  type: string;
  agentId: string;
  data: any;
}

const encoder = new TextEncoder();

serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId")!;
  const projectId = searchParams.get("projectId")!;
  const initialPrompt = searchParams.get("initialPrompt")!;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Helper to send SSE event
        const sendEvent = (type: string, data: any) => {
          const event = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(event));
        };

        // Log initial state
        sendEvent("state_snapshot", {
          agentId: "orchestrator",
          eventId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          sessionId,
          type: "state_snapshot",
          data: {
            state: "initializing",
            description: "Starting agent orchestration...",
          },
        });

        // Call orchestrator agent
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 4096,
            system: `You are an AI agent coordinator for SiteSync construction PM. You orchestrate 6 specialist agents:
              1. ScheduleAgent - analyzes schedule risk, critical path, delays
              2. BudgetAgent - tracks costs, forecasts overruns, analyzes variance
              3. SafetyAgent - identifies hazards, tracks compliance, generates safety insights
              4. RFIAgent - tracks RFIs, finds blocking items, prioritizes responses
              5. ResourceAgent - optimizes crew allocation, skill matching
              6. QualityAgent - tracks defects, punch lists, quality metrics

              For each request, emit AG-UI protocol events as you work:
              1. Emit state_snapshot with current thinking
              2. Emit tool_call_start before calling each tool
              3. Emit tool_call_progress with updates
              4. Emit tool_call_end with results
              5. Emit approval_request if user decision needed
              6. Emit summary when complete

              Use this format for events:
              EVENT_TYPE: state_snapshot | tool_call_start | tool_call_progress | tool_call_end | text_message | approval_request | error | summary
              {JSON_DATA}
              ---END_EVENT---
              `,
            messages: [
              {
                role: "user",
                content: initialPrompt,
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`Anthropic API error: ${response.statusText}`);
        }

        // Stream response and parse events
        const reader = response.body!.getReader();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += new TextDecoder().decode(value);

          // Parse events from buffer
          const lines = buffer.split("\n");
          buffer = lines[lines.length - 1]; // Keep incomplete line

          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();
            if (line.startsWith("data: ")) {
              const data = JSON.parse(line.slice(6));
              if (data.type === "content_block_delta") {
                const text = data.delta?.text || "";
                // Parse custom event format
                if (text.includes("EVENT_TYPE:")) {
                  const eventMatch = text.match(/EVENT_TYPE:\s*(\w+)/);
                  const dataMatch = text.match(/(\{[\s\S]*?\})\s*---END_EVENT---/);

                  if (eventMatch && dataMatch) {
                    const eventType = eventMatch[1];
                    const eventData = JSON.parse(dataMatch[1]);
                    sendEvent(eventType, eventData);
                  }
                }
              }
            }
          }
        }

        // Send completion
        sendEvent("summary", {
          agentId: "orchestrator",
          eventId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          sessionId,
          type: "summary",
          data: {
            title: "Analysis Complete",
            result: "Agent execution finished successfully",
            actionsTaken: ["Analyzed project data", "Generated recommendations"],
            recommendedNextSteps: ["Review findings", "Approve recommendations"],
          },
        });

        controller.close();
      } catch (error) {
        sendEvent("error", {
          type: "error",
          data: {
            severity: "critical",
            message: error instanceof Error ? error.message : "Unknown error",
          },
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
```

### 4.2 Approval Handler

```typescript
// api/agents/approval.ts (Supabase Edge Function)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok");
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  try {
    const body = await req.json();
    const { sessionId, actionId, approved, feedback } = body;

    // Store approval in database
    const { error } = await supabase
      .from("agent_approvals")
      .insert({
        session_id: sessionId,
        action_id: actionId,
        approved,
        feedback,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;

    // Send resume signal to agent orchestrator via Redis/Queue
    // Agent polls for approval status and continues execution

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

---

## 5. XState Integration

### 5.1 Agent Stream State Machine

```typescript
// src/machines/agentStreamMachine.ts

import { createMachine, assign } from 'xstate';
import { AgUIEvent } from '@/schemas/agUI';

export type AgentStreamContext = {
  sessionId: string;
  projectId: string;
  initialPrompt: string;
  events: AgUIEvent[];
  currentState: string;
  activeApprovalId: string | null;
  error: Error | null;
};

export const agentStreamMachine = createMachine(
  {
    id: 'agentStream',
    initial: 'idle',
    context: {
      sessionId: '',
      projectId: '',
      initialPrompt: '',
      events: [],
      currentState: 'initializing',
      activeApprovalId: null,
      error: null,
    } as AgentStreamContext,
    states: {
      idle: {
        on: {
          START_STREAM: {
            target: 'streaming',
            actions: assign({
              sessionId: (_, event: any) => event.sessionId,
              projectId: (_, event: any) => event.projectId,
              initialPrompt: (_, event: any) => event.initialPrompt,
              events: [],
            }),
          },
        },
      },
      streaming: {
        on: {
          EVENT_RECEIVED: {
            actions: assign({
              events: (context, event: any) => [...context.events, event.event],
              currentState: (_, event: any) => event.event.data?.state || context.currentState,
            }),
          },
          APPROVAL_REQUIRED: {
            target: 'awaiting_approval',
            actions: assign({
              activeApprovalId: (_, event: any) => event.actionId,
            }),
          },
          ERROR_RECEIVED: {
            target: 'error',
            actions: assign({
              error: (_, event: any) => new Error(event.message),
            }),
          },
          COMPLETE: {
            target: 'complete',
          },
        },
      },
      awaiting_approval: {
        on: {
          APPROVAL_SUBMITTED: {
            target: 'streaming',
            actions: assign({
              activeApprovalId: null,
            }),
          },
        },
      },
      complete: {
        type: 'final',
      },
      error: {
        on: {
          RETRY: 'idle',
        },
      },
    },
  },
  {}
);
```

---

## 6. Integration with Sidebar

### 6.1 Update Sidebar.tsx

```typescript
// src/components/Sidebar.tsx (excerpt - add to existing file)

import AgentStatusBadge from './agUI/AgentStatusBadge';
import { useQuery } from '@tanstack/react-query';

export const Sidebar: React.FC = () => {
  // Fetch active agents
  const { data: activeAgents } = useQuery({
    queryKey: ['activeAgents'],
    queryFn: async () => {
      const res = await fetch('/api/agents/active');
      return res.json();
    },
    refetchInterval: 2000,
  });

  return (
    <div style={{ backgroundColor: '#0F1629', color: '#FFFFFF', padding: '16px', height: '100vh', overflow: 'auto' }}>
      {/* Existing sidebar content */}
      {/* ... */}

      {/* Agent Status Section */}
      {activeAgents && activeAgents.length > 0 && (
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #333' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: 600, color: '#999', textTransform: 'uppercase' }}>
            Active Agents
          </h4>
          <AgentStatusBadge agents={activeAgents} compact={false} />
        </div>
      )}
    </div>
  );
};
```

---

## 7. Example: Schedule Risk Analysis Flow

```typescript
// Example conversation showing AG-UI protocol in action

User: "What's our schedule risk? Check critical path."

Events streamed:
1. STATE_SNAPSHOT: "Analyzing 247 tasks with 15 critical dependencies..."
2. TOOL_CALL_START: "schedule.fetch" - "Fetching schedule data from Supabase"
3. TOOL_CALL_PROGRESS: "Processing 247 tasks... 50%"
4. TOOL_CALL_PROGRESS: "Processing 247 tasks... 100%"
5. TOOL_CALL_END: "schedule.fetch" - "Retrieved 247 tasks successfully (45ms)"
6. STATE_SNAPSHOT: "Analyzing historical delay patterns from Q4 2024..."
7. TOOL_CALL_START: "schedule.historicalPatterns" - "Fetching past project delays"
8. TOOL_CALL_END: "schedule.historicalPatterns" - "Avg delay: 8.3 days, volatility: 4.2 days"
9. STATE_SNAPSHOT: "Running Monte Carlo simulation with 10,000 iterations..."
10. TOOL_CALL_START: "schedule.monteCarlo" - "Simulating 10,000 delay scenarios"
11. TOOL_CALL_PROGRESS: "Monte Carlo 25%"
12. TOOL_CALL_PROGRESS: "Monte Carlo 50%"
13. TOOL_CALL_PROGRESS: "Monte Carlo 75%"
14. TOOL_CALL_PROGRESS: "Monte Carlo 100%"
15. TOOL_CALL_END: "schedule.monteCarlo" - "P10: 5 days, P50: 18 days, P90: 42 days"
16. TEXT_MESSAGE: "Based on analysis, steel erection has 2-day critical float."
17. APPROVAL_REQUEST: "Increase structural crew by 3 workers to add 4-day buffer?"
18. [User clicks Approve]
19. SUMMARY: "Analysis complete. Recommended crew increase submitted for approval."
```

---

## 8. Implementation Checklist & Acceptance Criteria

### 8.1 Development Tasks

- [ ] Define all AG-UI event Zod schemas
- [ ] Implement AgentStreamPanel component with SSE connection
- [ ] Implement AgentStatusBadge for sidebar
- [ ] Build event parser and validator
- [ ] Create approval request UI and handler
- [ ] Implement agent orchestrator edge function with streaming
- [ ] Add approval persistence and resume logic
- [ ] Connect XState machine to stream events
- [ ] Integrate with existing agent-runner
- [ ] Add CSS animations (pulse, spin)
- [ ] Test with 5+ realistic agent scenarios
- [ ] Performance testing: handle 100+ events/stream without lag
- [ ] Error handling and recovery flow

### 8.2 Acceptance Criteria

1. Real-time event streaming at <100ms latency
2. All 8 event types render correctly and provide actionable info
3. Approval requests block agent execution and resume on user action
4. UI stays responsive during heavy event flow (100+ events/min)
5. Tool call details expandable/collapsible for readability
6. Agent status indicators on sidebar update in real-time
7. Error events logged and don't crash UI
8. SSE reconnection on network interruption
9. Timestamps formatted consistently
10. Accessibility: Full keyboard navigation, ARIA labels, color contrast

---

## 9. Future Enhancements

- Agent reasoning visualization (show decision trees)
- Performance profiling (which agents are slowest?)
- Agent learning (feedback on quality of recommendations)
- Multi-agent collaboration view (agents helping each other)
- Replay mode (rewind/fast-forward through stream)
- Export stream as conversation transcript
- Integration with Slack notifications for long-running agents

