// ── AI Copilot Page ───────────────────────────────────────────
// Thin wrapper around AICommandCenter — the enhanced port of
// sitesyncai-web ChatBot with context awareness, quick actions,
// voice input, dockable layout, and streaming tool-call cards.

import React from 'react'
import { PageContainer } from '../components/Primitives'
import { AICommandCenter } from '../components/ai/AICommandCenter'
import { AI_COPILOT_DRAWING_TOOLS } from '../lib/aiPrompts'

// Re-export drawing tool specs consumed elsewhere.
export const DRAWING_TOOL_SPECS = AI_COPILOT_DRAWING_TOOLS

export const AICopilot: React.FC = () => {
  return (
    <PageContainer title="AI Copilot">
      <AICommandCenter />
    </PageContainer>
  )
}

export default AICopilot
