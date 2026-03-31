import React, { lazy, Suspense } from 'react'
import { Skeleton } from '../../Primitives'
import type { GenerativeUIBlock } from './types'
import { isGenerativeUI } from './types'
import { GenDataTable } from './GenDataTable'
import { GenMetricCards } from './GenMetricCards'
import { GenApprovalCard } from './GenApprovalCard'
import { GenTimeline } from './GenTimeline'
import { GenChecklist } from './GenChecklist'
import { GenComparison } from './GenComparison'
import { GenForm } from './GenForm'
import { GenScheduleCard } from './GenScheduleCard'
import { GenCostBreakdown } from './GenCostBreakdown'
import { GenSafetyAlert } from './GenSafetyAlert'
import { GenRFIResponse } from './GenRFIResponse'
import { GenPhotoGrid } from './GenPhotoGrid'

// Lazy load heavy chart component
const GenChart = lazy(() => import('./GenChart').then(m => ({ default: m.GenChart })))

// ── GenerativeUIRenderer ────────────────────────────────
// Maps AI tool result to the appropriate interactive React component.

interface GenerativeUIRendererProps {
  block: GenerativeUIBlock
  onAction?: (action: string, data: Record<string, unknown>) => void
}

export const GenerativeUIRenderer: React.FC<GenerativeUIRendererProps> = React.memo(({ block, onAction }) => {
  switch (block.ui_type) {
    case 'data_table':
      return <GenDataTable block={block} onAction={onAction} />
    case 'metric_cards':
      return <GenMetricCards block={block} />
    case 'form':
      return <GenForm block={block} onAction={onAction} />
    case 'chart':
      return (
        <Suspense fallback={<Skeleton height="200px" />}>
          <GenChart block={block} />
        </Suspense>
      )
    case 'approval_card':
      return <GenApprovalCard block={block} onAction={onAction} />
    case 'timeline':
      return <GenTimeline block={block} />
    case 'checklist':
      return <GenChecklist block={block} onAction={onAction} />
    case 'comparison':
      return <GenComparison block={block} />
    case 'schedule_card':
      return <GenScheduleCard block={block} onAction={onAction} />
    case 'cost_breakdown':
      return <GenCostBreakdown block={block} onAction={onAction} />
    case 'safety_alert':
      return <GenSafetyAlert block={block} onAction={onAction} />
    case 'rfi_response':
      return <GenRFIResponse block={block} onAction={onAction} />
    case 'photo_grid':
      return <GenPhotoGrid block={block} onAction={onAction} />
    default:
      return null
  }
})

// ── Helper: Extract generative UI blocks from tool results ──

export function extractGenerativeBlocks(
  toolResults: Array<{ tool: string; input: Record<string, unknown>; result: Record<string, unknown> }>
): GenerativeUIBlock[] {
  const blocks: GenerativeUIBlock[] = []
  for (const tr of toolResults) {
    if (isGenerativeUI(tr.result)) {
      blocks.push(tr.result as GenerativeUIBlock)
    }
  }
  return blocks
}
