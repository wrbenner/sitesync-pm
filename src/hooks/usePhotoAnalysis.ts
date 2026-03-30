// Photo intelligence: Claude Vision analysis for construction site photos.
// Identifies safety violations, progress, materials, equipment.

import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── Types ────────────────────────────────────────────────

export interface PhotoAnalysisResult {
  summary: string
  safetyViolations: Array<{
    type: string
    severity: 'critical' | 'warning' | 'info'
    description: string
    location: string
  }>
  progressObservations: Array<{
    trade: string
    description: string
    estimatedProgress: number
  }>
  materials: string[]
  equipment: string[]
  suggestedTags: string[]
  weatherConditions?: string
  workersVisible: number
  ppeCompliance: {
    compliant: boolean
    violations: string[]
  }
}

export type PhotoAnalysisState = 'idle' | 'uploading' | 'analyzing' | 'ready' | 'error'

// ── Hook ─────────────────────────────────────────────────

export function usePhotoAnalysis() {
  const [state, setState] = useState<PhotoAnalysisState>('idle')
  const [result, setResult] = useState<PhotoAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const analyzePhoto = useCallback(async (imageDataUrl: string) => {
    setState('analyzing')
    setError(null)
    setResult(null)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) {
        // Fallback for dev mode
        setResult(fallbackAnalysis())
        setState('ready')
        return
      }

      const { data: { session } } = await supabase.auth.getSession()

      // Send the image to our AI chat endpoint with a photo analysis prompt
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this construction site photo. Identify:
1. Safety violations (missing PPE, fall hazards, electrical hazards)
2. Work progress and trade activities
3. Materials and equipment visible
4. Weather conditions
5. Number of workers visible
6. PPE compliance status

Respond with ONLY valid JSON matching this schema:
{
  "summary": "one sentence description",
  "safetyViolations": [{ "type": "string", "severity": "critical|warning|info", "description": "string", "location": "string" }],
  "progressObservations": [{ "trade": "string", "description": "string", "estimatedProgress": number }],
  "materials": ["string"],
  "equipment": ["string"],
  "suggestedTags": ["string"],
  "weatherConditions": "string or null",
  "workersVisible": number,
  "ppeCompliance": { "compliant": boolean, "violations": ["string"] }
}`,
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: imageDataUrl.replace(/^data:image\/\w+;base64,/, ''),
                },
              },
            ],
          }],
          projectContext: { page: 'photo-analysis' },
        }),
      })

      if (!response.ok) {
        throw new Error('Photo analysis failed')
      }

      const data = await response.json()
      const content = data.content || ''
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        setResult(parsed as PhotoAnalysisResult)
        setState('ready')
      } else {
        setResult(fallbackAnalysis())
        setState('ready')
      }
    } catch (err) {
      setError((err as Error).message)
      setState('error')
    }
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setResult(null)
    setError(null)
  }, [])

  return { state, result, error, analyzePhoto, reset }
}

function fallbackAnalysis(): PhotoAnalysisResult {
  return {
    summary: 'Photo analysis requires Claude Vision API connection.',
    safetyViolations: [],
    progressObservations: [],
    materials: [],
    equipment: [],
    suggestedTags: ['construction', 'site'],
    workersVisible: 0,
    ppeCompliance: { compliant: true, violations: [] },
  }
}
