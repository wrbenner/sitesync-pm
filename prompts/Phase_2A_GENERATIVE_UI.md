# Phase 2A: Generative UI with json-render

## Pre-Requisite
Paste `00_SYSTEM_CONTEXT.md` before executing this prompt.

**Objective**: Enable Claude to generate construction-specific React UI components via JSON schemas, allowing real-time dynamic interface generation for reports, summaries, and interactive analysis.

**Status**: Phase 2 Core Feature | High Impact | Medium Complexity

---

## 1. Overview & Strategic Value

json-render (Vercel, Jan 2026) creates a bridge between AI-generated JSON and React components via Zod schemas. This enables:

- Claude generates structured JSON describing UI layout → json-render maps JSON to React components
- Construction teams see tailored dashboards, risk summaries, and analysis reports instantly
- No round-trip delays; streaming JSON updates in real-time
- User can edit AI suggestions inline (Prompt: "reduce budget for frames by 5%" → AI regenerates)

**Competitive Advantage**: Procore shows static dashboards. SiteSync AI shows dynamically generated, AI-optimized views tailored to each project's unique challenges.

**Industry Data**: 40% of PM time is report generation. Generative UI cuts this to 5 minutes.

---

## 2. Architecture

### 2.1 Tech Stack
```
json-render: ^1.2.0
zod: ^3.23.0
shadcn/ui: ^2.1.0 (pre-built components, json-render compatible)
react-hook-form: ^7.51.0 (for inline edits)
@tanstack/react-query: ^5.45.0 (for refetching after user edits)
```

### 2.2 Component Rendering Pipeline

```
User Action (e.g., "Show me the critical path")
    ↓
ai-chat edge function receives request
    ↓
Claude.messages() with system prompt that includes json-render component catalog
    ↓
Claude returns: { "type": "ScheduleCard", "props": { "tasks": [...], "dependencies": [...] } }
    ↓
GenerativeUIRenderer receives JSON
    ↓
Zod schema validates props
    ↓
json-render maps "ScheduleCard" → ScheduleCardComponent
    ↓
React renders live component
    ↓
User sees interactive card with buttons (Edit, Export, Approve, etc.)
```

### 2.3 Data Flow Diagram

```
┌─────────────────────┐
│  User Chat Input    │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────────────────────────┐
│ ai-chat edge function                   │
│ - Parse intent                          │
│ - Call Claude with json-render schemas  │
└──────────┬──────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────┐
│ Claude API                              │
│ - System prompt includes all schemas    │
│ - Returns JSON matching Zod definition  │
└──────────┬──────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────┐
│ GenerativeUIRenderer                    │
│ - Validate JSON against Zod schema      │
│ - Pass to json-render engine            │
└──────────┬──────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────┐
│ React Component Tree                    │
│ - ScheduleCard, CostBreakdownTable, etc │
│ - Live, interactive, editable           │
└─────────────────────────────────────────┘
```

---

## 3. Construction-Specific Components

### 3.1 ScheduleCard Component

**Purpose**: Render task details with progress, crew assignment, dependencies.

**Zod Schema**:
```typescript
// src/schemas/generativeUI.ts

import { z } from 'zod';

export const ScheduleCardSchema = z.object({
  type: z.literal('ScheduleCard'),
  props: z.object({
    taskId: z.string(),
    taskName: z.string(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    progress: z.number().min(0).max(100),
    crew: z.object({
      name: z.string(),
      count: z.number(),
      trades: z.array(z.string()),
    }),
    status: z.enum(['on-track', 'at-risk', 'late', 'complete']),
    dependencies: z.array(z.object({
      taskId: z.string(),
      taskName: z.string(),
      type: z.enum(['fs', 'ss', 'sf', 'ff']), // Finish-to-Start, etc.
    })),
    duration: z.number(), // days
    float: z.number(), // days of slack
    criticalPath: z.boolean(),
    notes: z.string().optional(),
    variance: z.object({
      schedule: z.number(), // days
      cost: z.number(), // dollars
    }).optional(),
  }),
});

export type ScheduleCard = z.infer<typeof ScheduleCardSchema>;
```

**React Component**:
```typescript
// src/components/generative/ScheduleCard.tsx

import React from 'react';
import { Card } from '@/components/Primitives';
import { AlertCircle, Users, Clock, DollarSign, Link2 } from 'lucide-react';

interface ScheduleCardProps {
  taskId: string;
  taskName: string;
  startDate: string;
  endDate: string;
  progress: number;
  crew: {
    name: string;
    count: number;
    trades: string[];
  };
  status: 'on-track' | 'at-risk' | 'late' | 'complete';
  dependencies: Array<{
    taskId: string;
    taskName: string;
    type: string;
  }>;
  duration: number;
  float: number;
  criticalPath: boolean;
  notes?: string;
  variance?: {
    schedule: number;
    cost: number;
  };
  onEdit?: () => void;
  onApprove?: () => void;
}

const ScheduleCard: React.FC<ScheduleCardProps> = ({
  taskName,
  startDate,
  endDate,
  progress,
  crew,
  status,
  dependencies,
  duration,
  float,
  criticalPath,
  notes,
  variance,
  onEdit,
  onApprove,
}) => {
  const statusColors = {
    'on-track': { bg: '#E8F5E9', text: '#2E7D32', border: '#4EC896' },
    'at-risk': { bg: '#FFF3E0', text: '#E65100', border: '#FB8500' },
    'late': { bg: '#FFEBEE', text: '#C62828', border: '#EF5350' },
    'complete': { bg: '#F3E5F5', text: '#6A1B9A', border: '#9C27B0' },
  };

  const colors = statusColors[status];
  const startDt = new Date(startDate);
  const endDt = new Date(endDate);
  const todayDate = new Date();
  const elapsedDays = Math.max(0, Math.floor((todayDate.getTime() - startDt.getTime()) / (1000 * 60 * 60 * 24)));
  const totalDays = Math.floor((endDt.getTime() - startDt.getTime()) / (1000 * 60 * 60 * 24));
  const projectedComplete = startDt.getTime() + (totalDays * (progress / 100)) * (1000 * 60 * 60 * 24);
  const daysLate = Math.max(0, Math.floor((projectedComplete - endDt.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <Card
      style={{
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.bg,
        padding: '16px',
        marginBottom: '12px',
      }}
    >
      {/* Header: Task Name + Status Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', color: '#0F1629', fontSize: '16px', fontWeight: 600 }}>
            {taskName}
          </h3>
          {criticalPath && (
            <span style={{
              display: 'inline-block',
              backgroundColor: '#EF5350',
              color: '#FFFFFF',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              marginTop: '4px',
            }}>
              CRITICAL PATH
            </span>
          )}
        </div>
        <span style={{
          backgroundColor: colors.border,
          color: '#FFFFFF',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}>
          {status.replace('-', ' ')}
        </span>
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', color: '#555' }}>Progress</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F1629' }}>{progress}%</span>
        </div>
        <div style={{
          width: '100%',
          height: '6px',
          backgroundColor: '#E0E0E0',
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: '#4EC896',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        {/* Duration */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Clock size={16} style={{ color: '#666' }} />
          <div>
            <div style={{ fontSize: '11px', color: '#999' }}>Duration</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F1629' }}>{duration} days</div>
          </div>
        </div>

        {/* Float */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Clock size={16} style={{ color: float > 0 ? '#4EC896' : '#EF5350' }} />
          <div>
            <div style={{ fontSize: '11px', color: '#999' }}>Float Remaining</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: float > 0 ? '#4EC896' : '#EF5350' }}>
              {float} days
            </div>
          </div>
        </div>
      </div>

      {/* Crew Assignment */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '8px', borderRadius: '6px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
          <Users size={14} style={{ color: '#666' }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F1629' }}>Crew</span>
        </div>
        <div style={{ fontSize: '13px', color: '#0F1629', marginBottom: '4px' }}>
          <strong>{crew.name}</strong> ({crew.count} workers)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {crew.trades.map((trade) => (
            <span
              key={trade}
              style={{
                backgroundColor: '#F0F0F0',
                color: '#555',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
              }}
            >
              {trade}
            </span>
          ))}
        </div>
      </div>

      {/* Dependencies */}
      {dependencies.length > 0 && (
        <div style={{ backgroundColor: '#FFFFFF', padding: '8px', borderRadius: '6px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
            <Link2 size={14} style={{ color: '#666' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F1629' }}>Dependencies</span>
          </div>
          {dependencies.map((dep) => (
            <div key={dep.taskId} style={{ fontSize: '12px', color: '#555', marginBottom: '4px' }}>
              <span style={{ color: '#999' }}>{dep.type.toUpperCase()} from</span> {dep.taskName}
            </div>
          ))}
        </div>
      )}

      {/* Variance Alert */}
      {variance && (variance.schedule !== 0 || variance.cost !== 0) && (
        <div style={{
          backgroundColor: '#FFF3E0',
          border: '1px solid #FB8500',
          padding: '8px',
          borderRadius: '6px',
          marginBottom: '12px',
          display: 'flex',
          gap: '8px',
        }}>
          <AlertCircle size={16} style={{ color: '#FB8500', flexShrink: 0 }} />
          <div style={{ fontSize: '12px', color: '#E65100' }}>
            {variance.schedule !== 0 && (
              <div>Schedule variance: {variance.schedule > 0 ? '+' : ''}{variance.schedule} days</div>
            )}
            {variance.cost !== 0 && (
              <div>Cost variance: ${variance.cost.toLocaleString()}</div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {notes && (
        <div style={{ backgroundColor: '#FFFFFF', padding: '8px', borderRadius: '6px', marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F1629', marginBottom: '4px' }}>Notes</div>
          <div style={{ fontSize: '12px', color: '#555', lineHeight: '1.4' }}>{notes}</div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        {onEdit && (
          <button
            onClick={onEdit}
            style={{
              padding: '6px 12px',
              backgroundColor: '#F7F8FA',
              border: '1px solid #DDD',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#0F1629',
            }}
          >
            Edit
          </button>
        )}
        {onApprove && (
          <button
            onClick={onApprove}
            style={{
              padding: '6px 12px',
              backgroundColor: '#F47820',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#FFFFFF',
            }}
          >
            Approve
          </button>
        )}
      </div>
    </Card>
  );
};

export default ScheduleCard;
```

---

### 3.2 CostBreakdownTable Component

**Purpose**: Display line items, amounts, variance, and status in tabular format.

**Zod Schema**:
```typescript
export const CostBreakdownTableSchema = z.object({
  type: z.literal('CostBreakdownTable'),
  props: z.object({
    title: z.string(),
    costCode: z.string(),
    lineItems: z.array(z.object({
      id: z.string(),
      description: z.string(),
      quantity: z.number(),
      unit: z.string(),
      unitPrice: z.number(),
      totalBudget: z.number(),
      spent: z.number(),
      variance: z.number(), // negative = over budget
      percentSpent: z.number(),
      status: z.enum(['under-budget', 'on-budget', 'at-risk', 'over-budget']),
      trade: z.string().optional(),
      notes: z.string().optional(),
    })),
    totalBudget: z.number(),
    totalSpent: z.number(),
    totalVariance: z.number(),
    percentComplete: z.number(),
    lastUpdated: z.string().datetime(),
    onApprove?: z.function().optional(),
    onRequestChange?: z.function().optional(),
  }),
});
```

**React Component**:
```typescript
// src/components/generative/CostBreakdownTable.tsx

import React from 'react';
import { Card } from '@/components/Primitives';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalBudget: number;
  spent: number;
  variance: number;
  percentSpent: number;
  status: 'under-budget' | 'on-budget' | 'at-risk' | 'over-budget';
  trade?: string;
  notes?: string;
}

interface CostBreakdownTableProps {
  title: string;
  costCode: string;
  lineItems: LineItem[];
  totalBudget: number;
  totalSpent: number;
  totalVariance: number;
  percentComplete: number;
  lastUpdated: string;
  onApprove?: () => void;
  onRequestChange?: () => void;
}

const CostBreakdownTable: React.FC<CostBreakdownTableProps> = ({
  title,
  costCode,
  lineItems,
  totalBudget,
  totalSpent,
  totalVariance,
  percentComplete,
  lastUpdated,
  onApprove,
  onRequestChange,
}) => {
  const statusColors = {
    'under-budget': { bg: '#E8F5E9', text: '#2E7D32', badge: '#4EC896' },
    'on-budget': { bg: '#E3F2FD', text: '#1565C0', badge: '#2196F3' },
    'at-risk': { bg: '#FFF3E0', text: '#E65100', badge: '#FB8500' },
    'over-budget': { bg: '#FFEBEE', text: '#C62828', badge: '#EF5350' },
  };

  const formattedDate = new Date(lastUpdated).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const getStatusIcon = (status: LineItem['status']) => {
    if (status === 'under-budget') return <TrendingDown size={14} style={{ color: '#4EC896' }} />;
    if (status === 'over-budget') return <TrendingUp size={14} style={{ color: '#EF5350' }} />;
    return <AlertTriangle size={14} style={{ color: '#FB8500' }} />;
  };

  const overBudgetItems = lineItems.filter((item) => item.status === 'over-budget').length;

  return (
    <Card style={{ padding: '0' }}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid #E0E0E0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', color: '#0F1629', fontSize: '16px', fontWeight: 600 }}>
              {title}
            </h3>
            <span style={{ color: '#999', fontSize: '12px' }}>Cost Code: {costCode}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Last Updated</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F1629' }}>{formattedDate}</div>
          </div>
        </div>

        {/* Summary Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#999', marginBottom: '2px' }}>Budget</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F1629' }}>
              ${totalBudget.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#999', marginBottom: '2px' }}>Spent</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F1629' }}>
              ${totalSpent.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#999', marginBottom: '2px' }}>Variance</div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: totalVariance > 0 ? '#4EC896' : '#EF5350',
              }}
            >
              ${totalVariance.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#999', marginBottom: '2px' }}>% Spent</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F1629' }}>
              {percentComplete}%
            </div>
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      {overBudgetItems > 0 && (
        <div
          style={{
            backgroundColor: '#FFEBEE',
            borderLeft: '4px solid #EF5350',
            padding: '12px 16px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <AlertTriangle size={16} style={{ color: '#EF5350', flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: '#C62828' }}>
            {overBudgetItems} line item{overBudgetItems !== 1 ? 's' : ''} over budget
          </span>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#F7F8FA', borderBottom: '2px solid #DDD' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#666' }}>Description</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#666' }}>Qty</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#666' }}>Unit Price</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#666' }}>Budget</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#666' }}>Spent</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#666' }}>Variance</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#666' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, idx) => {
              const colors = statusColors[item.status];
              return (
                <tr
                  key={item.id}
                  style={{
                    backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F9F9F9',
                    borderBottom: '1px solid #E0E0E0',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                      idx % 2 === 0 ? '#F0F0F0' : '#E8E8E8';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                      idx % 2 === 0 ? '#FFFFFF' : '#F9F9F9';
                  }}
                >
                  <td style={{ padding: '12px 16px', color: '#0F1629', fontWeight: 500 }}>
                    {item.description}
                    {item.trade && (
                      <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>{item.trade}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#555' }}>
                    {item.quantity} {item.unit}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#555' }}>
                    ${item.unitPrice.toFixed(2)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#0F1629', fontWeight: 600 }}>
                    ${item.totalBudget.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#0F1629', fontWeight: 600 }}>
                    ${item.spent.toLocaleString()}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      color: item.variance > 0 ? '#4EC896' : '#EF5350',
                      fontWeight: 600,
                    }}
                  >
                    {item.variance > 0 ? '+' : ''}${item.variance.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: colors.bg,
                        color: colors.text,
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      {getStatusIcon(item.status)}
                      {item.status.replace('-', ' ')}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #E0E0E0',
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
        }}
      >
        {onRequestChange && (
          <button
            onClick={onRequestChange}
            style={{
              padding: '6px 12px',
              backgroundColor: '#F7F8FA',
              border: '1px solid #DDD',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#0F1629',
            }}
          >
            Request Change
          </button>
        )}
        {onApprove && (
          <button
            onClick={onApprove}
            style={{
              padding: '6px 12px',
              backgroundColor: '#F47820',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#FFFFFF',
            }}
          >
            Approve
          </button>
        )}
      </div>
    </Card>
  );
};

export default CostBreakdownTable;
```

---

### 3.3 SafetyAlertBanner Component

**Purpose**: High-visibility safety alerts with severity, description, and corrective actions.

**Zod Schema**:
```typescript
export const SafetyAlertBannerSchema = z.object({
  type: z.literal('SafetyAlertBanner'),
  props: z.object({
    id: z.string(),
    severity: z.enum(['critical', 'major', 'minor']),
    title: z.string(),
    description: z.string(),
    location: z.string(),
    reportedBy: z.string(),
    timestamp: z.string().datetime(),
    recommendedActions: z.array(z.string()),
    OSHAReference: z.string().optional(),
    photoUrl: z.string().optional(),
    status: z.enum(['open', 'in-progress', 'resolved']),
    assignedTo: z.string().optional(),
    onAcknowledge?: z.function().optional(),
    onResolve?: z.function().optional(),
  }),
});
```

**React Component**:
```typescript
// src/components/generative/SafetyAlertBanner.tsx

import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle, Clock, MapPin, User } from 'lucide-react';

interface SafetyAlertBannerProps {
  id: string;
  severity: 'critical' | 'major' | 'minor';
  title: string;
  description: string;
  location: string;
  reportedBy: string;
  timestamp: string;
  recommendedActions: string[];
  OSHAReference?: string;
  photoUrl?: string;
  status: 'open' | 'in-progress' | 'resolved';
  assignedTo?: string;
  onAcknowledge?: () => void;
  onResolve?: () => void;
}

const SafetyAlertBanner: React.FC<SafetyAlertBannerProps> = ({
  severity,
  title,
  description,
  location,
  reportedBy,
  timestamp,
  recommendedActions,
  OSHAReference,
  photoUrl,
  status,
  assignedTo,
  onAcknowledge,
  onResolve,
}) => {
  const severityConfig = {
    critical: {
      bg: '#FFEBEE',
      border: '#EF5350',
      text: '#C62828',
      icon: <AlertTriangle size={20} style={{ color: '#EF5350' }} />,
      badge: 'CRITICAL',
    },
    major: {
      bg: '#FFF3E0',
      border: '#FB8500',
      text: '#E65100',
      icon: <AlertCircle size={20} style={{ color: '#FB8500' }} />,
      badge: 'MAJOR',
    },
    minor: {
      bg: '#F3E5F5',
      border: '#9C27B0',
      text: '#6A1B9A',
      icon: <AlertCircle size={20} style={{ color: '#9C27B0' }} />,
      badge: 'MINOR',
    },
  };

  const config = severityConfig[severity];
  const formattedTime = new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const statusIcon = {
    open: <AlertCircle size={14} style={{ color: '#EF5350' }} />,
    'in-progress': <Clock size={14} style={{ color: '#FB8500' }} />,
    resolved: <CheckCircle size={14} style={{ color: '#4EC896' }} />,
  };

  return (
    <div
      style={{
        backgroundColor: config.bg,
        border: `3px solid ${config.border}`,
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '12px',
      }}
    >
      {/* Header: Icon + Title + Badge */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
        {config.icon}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
            <h3 style={{ margin: 0, color: '#0F1629', fontSize: '16px', fontWeight: 700 }}>
              {title}
            </h3>
            <span
              style={{
                backgroundColor: config.border,
                color: '#FFFFFF',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              {config.badge}
            </span>
          </div>
          <p style={{ margin: '0 0 8px 0', color: '#333', fontSize: '13px', lineHeight: '1.5' }}>
            {description}
          </p>
        </div>
      </div>

      {/* Photo (if available) */}
      {photoUrl && (
        <div style={{ marginBottom: '12px' }}>
          <img
            src={photoUrl}
            alt="Safety issue photo"
            style={{
              maxWidth: '100%',
              maxHeight: '200px',
              borderRadius: '6px',
              border: `1px solid ${config.border}`,
            }}
          />
        </div>
      )}

      {/* Location, Reporter, Time */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px' }}>
          <MapPin size={14} style={{ color: '#666' }} />
          <div>
            <div style={{ color: '#999' }}>Location</div>
            <div style={{ fontWeight: 600, color: '#0F1629' }}>{location}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px' }}>
          <User size={14} style={{ color: '#666' }} />
          <div>
            <div style={{ color: '#999' }}>Reported By</div>
            <div style={{ fontWeight: 600, color: '#0F1629' }}>{reportedBy}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px' }}>
          <Clock size={14} style={{ color: '#666' }} />
          <div>
            <div style={{ color: '#999' }}>Time</div>
            <div style={{ fontWeight: 600, color: '#0F1629' }}>{formattedTime}</div>
          </div>
        </div>
      </div>

      {/* Status */}
      <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: `1px solid ${config.border}` }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px' }}>
          {statusIcon[status]}
          <span style={{ color: '#555' }}>
            Status: <strong>{status.toUpperCase()}</strong>
          </span>
          {assignedTo && <span style={{ color: '#999' }}>Assigned to {assignedTo}</span>}
        </div>
      </div>

      {/* Recommended Actions */}
      <div style={{ marginBottom: '12px' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#0F1629', fontSize: '13px', fontWeight: 600 }}>
          Recommended Actions
        </h4>
        <ol style={{ margin: 0, paddingLeft: '18px', color: '#555', fontSize: '12px' }}>
          {recommendedActions.map((action, idx) => (
            <li key={idx} style={{ marginBottom: '4px', lineHeight: '1.4' }}>
              {action}
            </li>
          ))}
        </ol>
      </div>

      {/* OSHA Reference */}
      {OSHAReference && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '8px',
            borderRadius: '4px',
            marginBottom: '12px',
            fontSize: '11px',
            color: '#666',
          }}
        >
          <strong>OSHA Reference:</strong> {OSHAReference}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        {onAcknowledge && status === 'open' && (
          <button
            onClick={onAcknowledge}
            style={{
              padding: '6px 12px',
              backgroundColor: '#FFF3E0',
              border: `1px solid ${config.border}`,
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              color: config.text,
            }}
          >
            Acknowledge
          </button>
        )}
        {onResolve && (
          <button
            onClick={onResolve}
            style={{
              padding: '6px 12px',
              backgroundColor: '#4EC896',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#FFFFFF',
            }}
          >
            Mark Resolved
          </button>
        )}
      </div>
    </div>
  );
};

export default SafetyAlertBanner;
```

---

### 3.4 RFIResponseCard Component

**Purpose**: Display RFI question, response, attachments, and approval workflow.

**Zod Schema**:
```typescript
export const RFIResponseCardSchema = z.object({
  type: z.literal('RFIResponseCard'),
  props: z.object({
    id: z.string(),
    rfiNumber: z.string(),
    question: z.string(),
    askedBy: z.string(),
    askedDate: z.string().datetime(),
    response: z.string().optional(),
    respondedBy: z.string().optional(),
    respondedDate: z.string().datetime().optional(),
    attachments: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      url: z.string(),
      uploadedBy: z.string(),
      uploadedDate: z.string().datetime(),
    })).optional(),
    status: z.enum(['open', 'answered', 'approved', 'rejected', 'on-hold']),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    trade: z.string().optional(),
    daysOpen: z.number(),
    onApprove?: z.function().optional(),
    onReject?: z.function().optional(),
    onAddAttachment?: z.function().optional(),
  }),
});
```

**React Component**:
```typescript
// src/components/generative/RFIResponseCard.tsx

import React from 'react';
import { Card } from '@/components/Primitives';
import { FileText, CheckCircle, XCircle, Clock, AlertCircle, User, Download } from 'lucide-react';

interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedBy: string;
  uploadedDate: string;
}

interface RFIResponseCardProps {
  id: string;
  rfiNumber: string;
  question: string;
  askedBy: string;
  askedDate: string;
  response?: string;
  respondedBy?: string;
  respondedDate?: string;
  attachments?: Attachment[];
  status: 'open' | 'answered' | 'approved' | 'rejected' | 'on-hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  trade?: string;
  daysOpen: number;
  onApprove?: () => void;
  onReject?: () => void;
  onAddAttachment?: () => void;
}

const RFIResponseCard: React.FC<RFIResponseCardProps> = ({
  rfiNumber,
  question,
  askedBy,
  askedDate,
  response,
  respondedBy,
  respondedDate,
  attachments,
  status,
  priority,
  trade,
  daysOpen,
  onApprove,
  onReject,
  onAddAttachment,
}) => {
  const statusConfig = {
    open: { bg: '#E3F2FD', border: '#2196F3', text: '#1565C0', icon: <AlertCircle size={16} /> },
    answered: { bg: '#FFF3E0', border: '#FB8500', text: '#E65100', icon: <Clock size={16} /> },
    approved: { bg: '#E8F5E9', border: '#4EC896', text: '#2E7D32', icon: <CheckCircle size={16} /> },
    rejected: { bg: '#FFEBEE', border: '#EF5350', text: '#C62828', icon: <XCircle size={16} /> },
    'on-hold': { bg: '#F3E5F5', border: '#9C27B0', text: '#6A1B9A', icon: <Clock size={16} /> },
  };

  const priorityConfig = {
    low: { badge: 'LOW', color: '#4EC896' },
    medium: { badge: 'MEDIUM', color: '#FB8500' },
    high: { badge: 'HIGH', color: '#FF9800' },
    urgent: { badge: 'URGENT', color: '#EF5350' },
  };

  const config = statusConfig[status];
  const priorityBadge = priorityConfig[priority];
  const formattedAskedDate = new Date(askedDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return 'PDF';
    if (type.includes('image')) return 'IMG';
    if (type.includes('word')) return 'DOC';
    return 'FILE';
  };

  return (
    <Card
      style={{
        border: `2px solid ${config.border}`,
        backgroundColor: config.bg,
        padding: '16px',
        marginBottom: '12px',
      }}
    >
      {/* Header: RFI Number + Status + Priority */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', color: '#0F1629', fontSize: '15px', fontWeight: 700 }}>
            RFI {rfiNumber}
          </h3>
          {trade && (
            <span style={{ color: '#999', fontSize: '11px' }}>{trade}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span
            style={{
              backgroundColor: priorityBadge.color,
              color: '#FFFFFF',
              padding: '3px 10px',
              borderRadius: '3px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {priorityBadge.badge}
          </span>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: config.bg,
              color: config.text,
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              border: `1px solid ${config.border}`,
            }}
          >
            {config.icon}
            {status.replace('-', ' ')}
          </span>
        </div>
      </div>

      {/* Question */}
      <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #DDD' }}>
        <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px', fontWeight: 600 }}>QUESTION</div>
        <p style={{ margin: 0, color: '#0F1629', fontSize: '13px', lineHeight: '1.5' }}>
          {question}
        </p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '12px', color: '#666' }}>
          <span>Asked by {askedBy}</span>
          <span>{formattedAskedDate}</span>
          <span style={{ color: '#FB8500', fontWeight: 600 }}>{daysOpen} days open</span>
        </div>
      </div>

      {/* Response */}
      {response && (
        <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #DDD' }}>
          <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px', fontWeight: 600 }}>RESPONSE</div>
          <p style={{ margin: 0, color: '#0F1629', fontSize: '13px', lineHeight: '1.5' }}>
            {response}
          </p>
          {respondedBy && respondedDate && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
              <span>Responded by {respondedBy}</span>
              <span style={{ margin: '0 8px', color: '#DDD' }}>|</span>
              <span>
                {new Date(respondedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Attachments */}
      {attachments && attachments.length > 0 && (
        <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #DDD' }}>
          <div style={{ fontSize: '11px', color: '#999', marginBottom: '8px', fontWeight: 600 }}>ATTACHMENTS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
            {attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.url}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #DDD',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = '#F47820';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = '#DDD';
                }}
              >
                <FileText size={20} style={{ color: '#F47820' }} />
                <div style={{ fontSize: '10px', color: '#0F1629', fontWeight: 600, textAlign: 'center' }}>
                  {getFileIcon(attachment.type)}
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: '#666',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%',
                  }}
                  title={attachment.name}
                >
                  {attachment.name.length > 15 ? attachment.name.substring(0, 12) + '...' : attachment.name}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        {onAddAttachment && (
          <button
            onClick={onAddAttachment}
            style={{
              padding: '6px 12px',
              backgroundColor: '#F7F8FA',
              border: '1px solid #DDD',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#0F1629',
            }}
          >
            Add Attachment
          </button>
        )}
        {onReject && status === 'answered' && (
          <button
            onClick={onReject}
            style={{
              padding: '6px 12px',
              backgroundColor: '#FFEBEE',
              border: '1px solid #EF5350',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#C62828',
            }}
          >
            Reject
          </button>
        )}
        {onApprove && status === 'answered' && (
          <button
            onClick={onApprove}
            style={{
              padding: '6px 12px',
              backgroundColor: '#F47820',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#FFFFFF',
            }}
          >
            Approve
          </button>
        )}
      </div>
    </Card>
  );
};

export default RFIResponseCard;
```

---

### 3.5 ProgressPhotoGrid Component

**Purpose**: Display construction progress photos with annotations, before/after comparison.

**Zod Schema**:
```typescript
export const ProgressPhotoGridSchema = z.object({
  type: z.literal('ProgressPhotoGrid'),
  props: z.object({
    title: z.string(),
    location: z.string(),
    photos: z.array(z.object({
      id: z.string(),
      url: z.string(),
      capturedDate: z.string().datetime(),
      capturedBy: z.string(),
      caption: z.string().optional(),
      annotation: z.string().optional(),
      beforeAfterPair: z.string().optional(), // ID of before photo
      tags: z.array(z.string()).optional(),
    })),
    projectPhase: z.string().optional(),
    progressPercent: z.number().optional(),
    onDeletePhoto?: z.function().optional(),
    onAddAnnotation?: z.function().optional(),
  }),
});
```

**React Component**:
```typescript
// src/components/generative/ProgressPhotoGrid.tsx

import React, { useState } from 'react';
import { Card } from '@/components/Primitives';
import { MapPin, User, Plus, Trash2, Edit2, ZoomIn } from 'lucide-react';

interface Photo {
  id: string;
  url: string;
  capturedDate: string;
  capturedBy: string;
  caption?: string;
  annotation?: string;
  beforeAfterPair?: string;
  tags?: string[];
}

interface ProgressPhotoGridProps {
  title: string;
  location: string;
  photos: Photo[];
  projectPhase?: string;
  progressPercent?: number;
  onDeletePhoto?: (photoId: string) => void;
  onAddAnnotation?: (photoId: string) => void;
}

const ProgressPhotoGrid: React.FC<ProgressPhotoGridProps> = ({
  title,
  location,
  photos,
  projectPhase,
  progressPercent,
  onDeletePhoto,
  onAddAnnotation,
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [zoomIn, setZoomIn] = useState(false);

  const formattedDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    });

  // Group photos by before/after pairs
  const pairedPhotos = new Map<string, Photo[]>();
  const singlePhotos: Photo[] = [];

  photos.forEach((photo) => {
    if (photo.beforeAfterPair) {
      const pairId = [photo.id, photo.beforeAfterPair].sort().join('-');
      if (!pairedPhotos.has(pairId)) {
        pairedPhotos.set(pairId, []);
      }
      pairedPhotos.get(pairId)!.push(photo);
    } else {
      singlePhotos.push(photo);
    }
  });

  return (
    <Card style={{ padding: '16px' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #E0E0E0' }}>
        <h3 style={{ margin: '0 0 8px 0', color: '#0F1629', fontSize: '16px', fontWeight: 600 }}>
          {title}
        </h3>
        <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <MapPin size={14} style={{ color: '#666' }} />
            <span>{location}</span>
          </div>
          {projectPhase && (
            <span style={{ color: '#999' }}>
              Phase: <strong>{projectPhase}</strong>
            </span>
          )}
          {progressPercent !== undefined && (
            <span style={{ color: '#999' }}>
              Progress: <strong>{progressPercent}%</strong>
            </span>
          )}
        </div>
      </div>

      {/* Before/After Pairs */}
      {pairedPhotos.size > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600, color: '#0F1629' }}>
            Before/After Comparisons
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {Array.from(pairedPhotos.values()).map((pair, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {pair.map((photo, photoIdx) => (
                  <div
                    key={photo.id}
                    style={{
                      position: 'relative',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      border: '1px solid #DDD',
                      cursor: 'pointer',
                      transition: 'box-shadow 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                    }}
                  >
                    <img
                      src={photo.url}
                      alt={photo.caption || `Progress photo ${photoIdx + 1}`}
                      style={{
                        width: '100%',
                        height: '180px',
                        objectFit: 'cover',
                      }}
                      onClick={() => setSelectedPhoto(photo)}
                    />
                    {/* Label overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '6px',
                        left: '6px',
                        backgroundColor: photoIdx === 0 ? '#4EC896' : '#2196F3',
                        color: '#FFFFFF',
                        padding: '3px 8px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        fontWeight: 700,
                        zIndex: 1,
                      }}
                    >
                      {photoIdx === 0 ? 'BEFORE' : 'AFTER'}
                    </div>

                    {/* Hover actions */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '0',
                        left: '0',
                        right: '0',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        gap: '4px',
                        padding: '6px',
                        justifyContent: 'center',
                        opacity: '0',
                        transition: 'opacity 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.opacity = '0';
                      }}
                    >
                      <button
                        onClick={() => setSelectedPhoto(photo)}
                        style={{
                          backgroundColor: '#2196F3',
                          border: 'none',
                          color: '#FFFFFF',
                          padding: '4px 8px',
                          borderRadius: '3px',
                          fontSize: '10px',
                          cursor: 'pointer',
                          display: 'flex',
                          gap: '4px',
                          alignItems: 'center',
                        }}
                      >
                        <ZoomIn size={12} />
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Single Photos Grid */}
      {singlePhotos.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600, color: '#0F1629' }}>
            Progress Photos
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
            {singlePhotos.map((photo) => (
              <div
                key={photo.id}
                style={{
                  position: 'relative',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  border: '1px solid #DDD',
                  cursor: 'pointer',
                }}
              >
                <img
                  src={photo.url}
                  alt={photo.caption}
                  style={{
                    width: '100%',
                    height: '120px',
                    objectFit: 'cover',
                  }}
                  onClick={() => setSelectedPhoto(photo)}
                />
                {/* Hover actions */}
                <div
                  style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    right: '0',
                    bottom: '0',
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    opacity: '0',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.opacity = '0';
                  }}
                >
                  <button
                    onClick={() => setSelectedPhoto(photo)}
                    style={{
                      backgroundColor: '#2196F3',
                      border: 'none',
                      color: '#FFFFFF',
                      padding: '6px 10px',
                      borderRadius: '3px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: '4px',
                      alignItems: 'center',
                    }}
                  >
                    <ZoomIn size={12} />
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Detail View */}
      {selectedPhoto && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.caption}
              style={{
                width: '100%',
                marginBottom: '16px',
                borderRadius: '6px',
              }}
            />
            {selectedPhoto.caption && (
              <p style={{ margin: '0 0 8px 0', color: '#0F1629', fontSize: '13px' }}>
                {selectedPhoto.caption}
              </p>
            )}
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
              <div>Captured by {selectedPhoto.capturedBy}</div>
              <div>{formattedDate(selectedPhoto.capturedDate)}</div>
            </div>
            {selectedPhoto.tags && selectedPhoto.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {selectedPhoto.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      backgroundColor: '#F0F0F0',
                      color: '#555',
                      padding: '3px 8px',
                      borderRadius: '3px',
                      fontSize: '11px',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              {onAddAnnotation && (
                <button
                  onClick={() => onAddAnnotation(selectedPhoto.id)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#F47820',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#FFFFFF',
                  }}
                >
                  Add Annotation
                </button>
              )}
              {onDeletePhoto && (
                <button
                  onClick={() => {
                    onDeletePhoto(selectedPhoto.id);
                    setSelectedPhoto(null);
                  }}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#FFEBEE',
                    border: '1px solid #EF5350',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#C62828',
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default ProgressPhotoGrid;
```

---

## 4. json-render Integration

### 4.1 Component Map Registration

```typescript
// src/lib/generativeUI/componentMap.ts

import ScheduleCard from '@/components/generative/ScheduleCard';
import CostBreakdownTable from '@/components/generative/CostBreakdownTable';
import SafetyAlertBanner from '@/components/generative/SafetyAlertBanner';
import RFIResponseCard from '@/components/generative/RFIResponseCard';
import ProgressPhotoGrid from '@/components/generative/ProgressPhotoGrid';

export const componentMap = {
  ScheduleCard,
  CostBreakdownTable,
  SafetyAlertBanner,
  RFIResponseCard,
  ProgressPhotoGrid,
};

export type ComponentMapType = typeof componentMap;
```

### 4.2 Renderer Implementation

```typescript
// src/lib/generativeUI/GenerativeUIRenderer.tsx

import React from 'react';
import { ZodSchema } from 'zod';
import { componentMap, ComponentMapType } from './componentMap';
import {
  ScheduleCardSchema,
  CostBreakdownTableSchema,
  SafetyAlertBannerSchema,
  RFIResponseCardSchema,
  ProgressPhotoGridSchema,
} from '@/schemas/generativeUI';

const schemas = {
  ScheduleCard: ScheduleCardSchema,
  CostBreakdownTable: CostBreakdownTableSchema,
  SafetyAlertBanner: SafetyAlertBannerSchema,
  RFIResponseCard: RFIResponseCardSchema,
  ProgressPhotoGrid: ProgressPhotoGridSchema,
};

interface GenerativeUIProps {
  componentJSON: any;
  onError?: (error: Error) => void;
  onComponentRender?: (componentType: string) => void;
}

export const GenerativeUIRenderer: React.FC<GenerativeUIProps> = ({
  componentJSON,
  onError,
  onComponentRender,
}) => {
  try {
    const { type, props } = componentJSON;

    // Validate type exists
    if (!schemas[type as keyof typeof schemas]) {
      throw new Error(`Unknown component type: ${type}`);
    }

    // Validate props against Zod schema
    const schema = schemas[type as keyof typeof schemas];
    const validatedProps = schema.parse(componentJSON);

    // Get component class
    const Component = componentMap[type as keyof ComponentMapType];
    if (!Component) {
      throw new Error(`Component not registered: ${type}`);
    }

    onComponentRender?.(type);

    return <Component {...props} />;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);

    return (
      <div
        style={{
          backgroundColor: '#FFEBEE',
          border: '2px solid #EF5350',
          borderRadius: '8px',
          padding: '16px',
          margin: '16px 0',
        }}
      >
        <h4 style={{ margin: '0 0 8px 0', color: '#C62828' }}>UI Rendering Error</h4>
        <pre
          style={{
            margin: 0,
            padding: '8px',
            backgroundColor: '#FFFFFF',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#555',
            overflow: 'auto',
            maxHeight: '200px',
          }}
        >
          {err.message}
        </pre>
      </div>
    );
  }
};

export default GenerativeUIRenderer;
```

---

## 5. AI Chat Integration

### 5.1 System Prompt Addition

```typescript
// src/lib/aiChat/systemPrompts.ts

export const GENERATIVE_UI_SYSTEM_PROMPT = `You are an expert construction project manager AI. When appropriate, generate interactive UI components that display construction data visually.

Available component types:

1. ScheduleCard
   - Use when showing task details, progress, and dependencies
   - Required: taskName, startDate, endDate, progress, crew, status, dependencies, duration, float
   - Optional: notes, variance, criticalPath

2. CostBreakdownTable
   - Use when showing budget analysis by cost code or line items
   - Required: title, costCode, lineItems array, totalBudget, totalSpent, totalVariance, percentComplete
   - Each lineItem: id, description, quantity, unit, unitPrice, totalBudget, spent, variance, percentSpent, status

3. SafetyAlertBanner
   - Use when reporting safety observations or hazards
   - Required: id, severity, title, description, location, reportedBy, timestamp, recommendedActions, status
   - Optional: photoUrl, OSHAReference, assignedTo

4. RFIResponseCard
   - Use when discussing RFIs or displaying RFI responses
   - Required: id, rfiNumber, question, askedBy, askedDate, status, priority, daysOpen
   - Optional: response, respondedBy, respondedDate, attachments, trade

5. ProgressPhotoGrid
   - Use when showing construction progress photos or site conditions
   - Required: title, location, photos array
   - Optional: projectPhase, progressPercent

When you decide to generate a component, respond with ONLY valid JSON matching the exact schema. Do not include markdown code blocks or explanatory text.

Example valid response:
{"type": "ScheduleCard", "props": {"taskId": "T001", "taskName": "Structural Steel", ...}}

Always ensure:
- Dates are ISO 8601 formatted (YYYY-MM-DDTHH:MM:SSZ)
- Numbers are valid (0-100 for percentages, positive for currency)
- Enums match exactly (lowercase, hyphenated if multi-word)
- All required fields are present
`;
```

### 5.2 Edge Function Handler

```typescript
// src/lib/aiChat/generateUIComponent.ts

import Anthropic from '@anthropic-ai/sdk';
import { GENERATIVE_UI_SYSTEM_PROMPT } from './systemPrompts';

interface GenerateUIRequest {
  userMessage: string;
  context?: Record<string, any>;
  projectId: string;
}

export async function generateUIComponent(request: GenerateUIRequest) {
  const client = new Anthropic();

  const contextStr = request.context
    ? `\n\nProject Context:\n${JSON.stringify(request.context, null, 2)}`
    : '';

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2048,
    system: GENERATIVE_UI_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `${request.userMessage}${contextStr}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  try {
    // Attempt to parse as JSON
    const componentJSON = JSON.parse(content.text);
    return {
      success: true,
      component: componentJSON,
      rawText: content.text,
    };
  } catch {
    // If not JSON, return raw text for rendering as markdown
    return {
      success: false,
      component: null,
      rawText: content.text,
      message: 'Claude generated text response instead of UI component',
    };
  }
}
```

---

## 6. Implementation Checklist & Acceptance Criteria

### 6.1 Development Tasks

- [ ] Install json-render, Zod, and required dependencies
- [ ] Create Zod schemas for all 5 component types
- [ ] Build ScheduleCard component with full styling and interactivity
- [ ] Build CostBreakdownTable component with table rendering and actions
- [ ] Build SafetyAlertBanner component with severity handling
- [ ] Build RFIResponseCard component with attachment display
- [ ] Build ProgressPhotoGrid component with modal detail view
- [ ] Register components in componentMap
- [ ] Implement GenerativeUIRenderer with error handling
- [ ] Add system prompt to ai-chat edge function
- [ ] Test with 10+ example prompts: "Show critical path", "What\'s over budget?", "New safety issue on floor 7"
- [ ] Implement edit feedback loop (user modifies AI suggestion → regen with constraints)
- [ ] Add loading skeleton during generation
- [ ] Add analytics tracking for component renders

### 6.2 Acceptance Criteria

1. Claude can generate valid JSON for all 5 component types
2. GenerativeUIRenderer correctly validates and renders components
3. All components display properly on desktop (1920x1080) and tablet (768px)
4. User can approve/edit/dismiss AI suggestions
5. Components integrate with existing data (actual schedule, cost, safety data)
6. Performance: Component renders in <500ms, JSON generation in <3s
7. Error handling: Graceful degradation if generation fails
8. Accessibility: ARIA labels, keyboard navigation, 4.5:1 contrast ratios

---

## 7. Future Enhancements

- Real-time component updates via WebSockets
- Export generated components as PDF reports
- Template library for common analyses (EVM, risk, schedule)
- Component chaining (link ScheduleCard to related CostBreakdownTable)
- Voice-activated component generation
- Component collaboration (multiple users editing same generated view)

