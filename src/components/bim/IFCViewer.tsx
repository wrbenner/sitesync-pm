import React, { useState } from 'react'
import { Box, Layers, ChevronRight, ChevronDown, Upload, Sparkles } from 'lucide-react'
import { Card, Btn, SectionHeader, MetricBox } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

export type IFCParseResult = {
  building: string | null
  stories: number
  spaces: number
  walls: number
  doors: number
  windows: number
  slabs: number
  columns: number
  beams: number
  mep: number
  total_elements: number
  summary: string
  sampled_entities?: Array<{ ifc_guid: string; ifc_type: string; name: string | null; floor: string | null; trade: string | null }>
}

interface IFCViewerProps {
  result?: IFCParseResult | null
  onParse?: (result: IFCParseResult) => void
  modelId?: string
}

export const IFCViewer: React.FC<IFCViewerProps> = ({ result, onParse, modelId }) => {
  const [parsing, setParsing] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['building']))

  const toggle = (key: string) => {
    const next = new Set(expanded)
    if (next.has(key)) next.delete(key); else next.add(key)
    setExpanded(next)
  }

  const handleUpload = async (file: File) => {
    setParsing(true)
    try {
      const text = await file.text()
      const { data, error } = await supabase.functions.invoke('parse-ifc', {
        body: { ifc_text: text.slice(0, 5 * 1024 * 1024), model_id: modelId },
      })
      if (error) throw error
      toast.success(`Parsed: ${data.summary}`)
      onParse?.(data as IFCParseResult)
    } catch (e) {
      toast.error('Failed to parse IFC file')
      console.error(e)
    } finally {
      setParsing(false)
    }
  }

  const byTrade = (result?.sampled_entities ?? []).reduce((acc, e) => {
    const key = e.trade ?? 'other'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <Card padding={spacing['5']}>
      <SectionHeader
        title="BIM / IFC Viewer"
        action={
          <label style={{ display: 'inline-flex' }}>
            <input
              type="file"
              accept=".ifc,.IFC"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleUpload(f)
              }}
              style={{ display: 'none' }}
            />
            <span>
              <Btn variant="primary" onClick={() => { /* triggered by input click via label */ }} disabled={parsing}>
                <Upload size={14} /> {parsing ? 'Parsing…' : 'Upload IFC'}
              </Btn>
            </span>
          </label>
        }
      />

      {!result ? (
        <div style={{ textAlign: 'center', padding: spacing['8'], color: colors.textTertiary }}>
          <Box size={48} color={colors.textTertiary} style={{ marginBottom: spacing['3'] }} />
          <div>Upload an IFC file to extract building structure.</div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: spacing['4'], padding: spacing['3'], background: colors.surfaceInset, borderRadius: borderRadius.md, color: colors.textSecondary, fontSize: typography.fontSize.sm, display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <Sparkles size={14} color={colors.primaryOrange} />
            <span>{result.summary}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['3'], marginBottom: spacing['4'] }}>
            <MetricBox label="Stories" value={String(result.stories)} />
            <MetricBox label="Spaces" value={String(result.spaces)} />
            <MetricBox label="Walls" value={String(result.walls)} />
            <MetricBox label="Doors" value={String(result.doors)} />
            <MetricBox label="Windows" value={String(result.windows)} />
            <MetricBox label="Slabs" value={String(result.slabs)} />
            <MetricBox label="Columns" value={String(result.columns)} />
            <MetricBox label="MEP" value={String(result.mep)} />
          </div>

          <SectionHeader title="Hierarchy" />
          <div style={{ fontSize: typography.fontSize.sm }}>
            <div
              onClick={() => toggle('building')}
              style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: spacing['2'], cursor: 'pointer', color: colors.textPrimary, fontWeight: typography.fontWeight.semibold }}
            >
              {expanded.has('building') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Layers size={14} color={colors.primaryOrange} />
              Building: {result.building ?? 'unnamed'}
            </div>
            {expanded.has('building') && (
              <div style={{ paddingLeft: 24 }}>
                <div style={{ padding: spacing['2'], color: colors.textSecondary }}>
                  {result.stories} stories · {result.spaces} spaces · {result.total_elements} captured elements
                </div>
                <div style={{ padding: spacing['2'] }}>
                  <div style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing['1'] }}>By Trade</div>
                  {Object.entries(byTrade).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: `${spacing['1']} 0`, color: colors.textSecondary }}>
                      <span style={{ textTransform: 'capitalize' }}>{k}</span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  )
}

export default IFCViewer
