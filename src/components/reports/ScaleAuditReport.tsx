// Scale Audit Report PDF
// Adapted from SiteSync PM:
//   sitesyncai-backend/src/discrepancy-export/report-pdf.service.ts
// Compares scales across paired drawings and highlights mismatches.
// Output: a per-pair table showing arch scale, struct scale, and whether they
// match, grouped by status (mismatches first).

import React from 'react'
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import { supabase } from '../../lib/supabase'

export interface ScaleAuditRow {
  pairId: string
  archSheet: string
  structSheet: string
  archScale: string | null
  structScale: string | null
  archScaleRatio: number | null
  structScaleRatio: number | null
  isMismatch: boolean
  note?: string | null
}

export interface ScaleAuditReportData {
  projectName: string
  projectAddress?: string
  generatedAt: string
  preparedBy?: string
  rows: ScaleAuditRow[]
}

const ORANGE = '#F47820'
const NAVY = '#0F1629'
const GRAY = '#6B7280'
const LGRAY = '#F3F4F6'
const BORDER = '#E5E7EB'
const SEV_HIGH = '#DC2626'
const SEV_OK = '#059669'

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: NAVY },
  brand: { backgroundColor: ORANGE, padding: 22, marginBottom: 20 },
  brandText: { color: '#FFFFFF', fontSize: 18, fontWeight: 700, letterSpacing: 2 },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 11, color: GRAY, marginBottom: 16 },
  metaBlock: { marginBottom: 16, borderTop: `1pt solid ${BORDER}`, paddingTop: 10 },
  metaRow: { flexDirection: 'row', marginBottom: 4 },
  metaLabel: { width: 110, color: GRAY, fontSize: 9 },
  metaValue: { fontSize: 9, color: NAVY },
  summaryGrid: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  summaryCell: {
    flex: 1,
    padding: 10,
    backgroundColor: LGRAY,
    borderRadius: 4,
  },
  summaryNum: { fontSize: 20, fontWeight: 700 },
  summaryNumBad: { fontSize: 20, fontWeight: 700, color: SEV_HIGH },
  summaryLabel: { fontSize: 8, color: GRAY, marginTop: 2, textTransform: 'uppercase' },
  sectionTitle: { fontSize: 14, fontWeight: 700, marginTop: 14, marginBottom: 8 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: NAVY,
    padding: 6,
  },
  tableHeaderCell: { color: '#FFFFFF', fontSize: 8, fontWeight: 700 },
  tableRow: {
    flexDirection: 'row',
    padding: 6,
    borderBottom: `0.5pt solid ${BORDER}`,
  },
  tableRowAlt: { backgroundColor: LGRAY },
  tableRowBad: { backgroundColor: '#FEF2F2' },
  cellArch: { width: '14%', fontSize: 8, fontWeight: 700 },
  cellStruct: { width: '14%', fontSize: 8, fontWeight: 700 },
  cellScale: { width: '18%', fontSize: 8, fontFamily: 'Courier' },
  cellRatio: { width: '12%', fontSize: 8, fontFamily: 'Courier' },
  cellStatus: { width: '12%', fontSize: 8, fontWeight: 700 },
  cellNote: { width: '30%', fontSize: 8, color: GRAY },
  statusOk: { color: SEV_OK },
  statusBad: { color: SEV_HIGH },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 8,
    color: GRAY,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})

export const ScaleAuditReport: React.FC<{ data: ScaleAuditReportData }> = ({ data }) => {
  const { projectName, projectAddress, generatedAt, preparedBy, rows } = data
  const mismatches = rows.filter((r) => r.isMismatch)
  const matches = rows.filter((r) => !r.isMismatch)
  const ordered = [...mismatches, ...matches]

  return (
    <Document title={`${projectName} — Scale Audit`}>
      <Page size="A4" style={styles.page}>
        {/* Brand bar */}
        <View style={styles.brand}>
          <Text style={styles.brandText}>SITESYNC · SCALE AUDIT</Text>
        </View>

        <Text style={styles.title}>{projectName}</Text>
        <Text style={styles.subtitle}>
          Scale consistency audit across paired drawings
        </Text>

        <View style={styles.metaBlock}>
          {projectAddress ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Project Address</Text>
              <Text style={styles.metaValue}>{projectAddress}</Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Generated</Text>
            <Text style={styles.metaValue}>{generatedAt}</Text>
          </View>
          {preparedBy ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Prepared By</Text>
              <Text style={styles.metaValue}>{preparedBy}</Text>
            </View>
          ) : null}
        </View>

        {/* Summary stats */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryNum}>{rows.length}</Text>
            <Text style={styles.summaryLabel}>Total pairs</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryNumBad}>{mismatches.length}</Text>
            <Text style={styles.summaryLabel}>Scale mismatches</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryNum}>{matches.length}</Text>
            <Text style={styles.summaryLabel}>Consistent</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Pair Details</Text>

        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.cellArch, styles.tableHeaderCell]}>ARCH</Text>
          <Text style={[styles.cellStruct, styles.tableHeaderCell]}>STRUCT</Text>
          <Text style={[styles.cellScale, styles.tableHeaderCell]}>ARCH SCALE</Text>
          <Text style={[styles.cellScale, styles.tableHeaderCell]}>STRUCT SCALE</Text>
          <Text style={[styles.cellStatus, styles.tableHeaderCell]}>STATUS</Text>
          <Text style={[styles.cellNote, styles.tableHeaderCell]}>NOTE</Text>
        </View>

        {ordered.map((row, i) => {
          const rowStyle = row.isMismatch
            ? [styles.tableRow, styles.tableRowBad]
            : i % 2 === 0
            ? [styles.tableRow, styles.tableRowAlt]
            : [styles.tableRow]
          const archScaleLabel = row.archScale
            ? row.archScaleRatio
              ? `${row.archScale} (${row.archScaleRatio.toFixed(1)})`
              : row.archScale
            : '—'
          const structScaleLabel = row.structScale
            ? row.structScaleRatio
              ? `${row.structScale} (${row.structScaleRatio.toFixed(1)})`
              : row.structScale
            : '—'
          return (
            <View key={row.pairId} style={rowStyle} wrap={false}>
              <Text style={styles.cellArch}>{row.archSheet}</Text>
              <Text style={styles.cellStruct}>{row.structSheet}</Text>
              <Text style={styles.cellScale}>{archScaleLabel}</Text>
              <Text style={styles.cellScale}>{structScaleLabel}</Text>
              <Text
                style={[
                  styles.cellStatus,
                  row.isMismatch ? styles.statusBad : styles.statusOk,
                ]}
              >
                {row.isMismatch ? 'MISMATCH' : 'OK'}
              </Text>
              <Text style={styles.cellNote}>{row.note ?? ''}</Text>
            </View>
          )
        })}

        <View style={styles.footer} fixed>
          <Text>{projectName} — SiteSync PM</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export default ScaleAuditReport

// ── Data fetch + generator ────────────────────────────────
// Loads paired drawings with their arch/struct classifications and
// compares detected scales. Flags mismatches by comparing the
// `scale_ratio` numeric field (falling back to string equality on
// `scale_text` when ratios are missing).

export interface ScaleAuditReportOptions {
  preparedBy?: string
  drawingIds?: string[] | 'all'
}

type PairWithClassifications = {
  id: string
  drawing_a_id: string | null
  drawing_b_id: string | null
}

type ClassificationForScale = {
  drawing_id: string | null
  scale_text: string | null
  scale_ratio: number | null
}

type DrawingForScale = {
  id: string
  sheet_number: string | null
}

function scalesDisagree(
  archRatio: number | null,
  structRatio: number | null,
  archText: string | null,
  structText: string | null,
): boolean {
  if (archRatio != null && structRatio != null && archRatio > 0 && structRatio > 0) {
    const larger = Math.max(archRatio, structRatio)
    const smaller = Math.min(archRatio, structRatio)
    return larger / smaller > 1.02
  }
  if (archText && structText) {
    return archText.trim() !== structText.trim()
  }
  return false
}

export async function generateScaleAuditReport(
  projectId: string,
  opts: ScaleAuditReportOptions = {},
): Promise<{ blob: Blob; filename: string; data: ScaleAuditReportData }> {
  const [projectRes, pairsRes, drawingsRes, classificationsRes] = await Promise.all([
    supabase.from('projects').select('name, location').eq('id', projectId).maybeSingle(),
    supabase.from('drawing_pairs').select('id, drawing_a_id, drawing_b_id').eq('project_id', projectId),
    supabase.from('drawings').select('id, sheet_number').eq('project_id', projectId),
    supabase.from('drawing_classifications').select('drawing_id, scale_text, scale_ratio').eq('project_id', projectId),
  ])

  const projectName = (projectRes.data?.name as string | undefined) ?? 'Project'
  const projectAddress = (projectRes.data?.location as string | undefined) ?? undefined

  const pairs: PairWithClassifications[] = (pairsRes.data ?? []) as PairWithClassifications[]
  const drawings: DrawingForScale[] = (drawingsRes.data ?? []) as DrawingForScale[]
  const classifications: ClassificationForScale[] = (classificationsRes.data ?? []) as ClassificationForScale[]

  const drawingById = new Map(drawings.map((d) => [d.id, d]))
  const classByDrawing = new Map<string, ClassificationForScale>()
  for (const c of classifications) {
    if (c.drawing_id) classByDrawing.set(c.drawing_id, c)
  }

  const selected = opts.drawingIds && opts.drawingIds !== 'all' ? new Set(opts.drawingIds) : null

  const rows: ScaleAuditRow[] = pairs
    .filter((p) => {
      if (!selected) return true
      return (p.drawing_a_id && selected.has(p.drawing_a_id)) ||
             (p.drawing_b_id && selected.has(p.drawing_b_id))
    })
    .map((p) => {
      const arch = p.drawing_a_id ? drawingById.get(p.drawing_a_id) : undefined
      const struct = p.drawing_b_id ? drawingById.get(p.drawing_b_id) : undefined
      const archClass = p.drawing_a_id ? classByDrawing.get(p.drawing_a_id) : undefined
      const structClass = p.drawing_b_id ? classByDrawing.get(p.drawing_b_id) : undefined
      const mismatch = scalesDisagree(
        archClass?.scale_ratio ?? null,
        structClass?.scale_ratio ?? null,
        archClass?.scale_text ?? null,
        structClass?.scale_text ?? null,
      )
      return {
        pairId: p.id,
        archSheet: arch?.sheet_number ?? '—',
        structSheet: struct?.sheet_number ?? '—',
        archScale: archClass?.scale_text ?? null,
        structScale: structClass?.scale_text ?? null,
        archScaleRatio: archClass?.scale_ratio ?? null,
        structScaleRatio: structClass?.scale_ratio ?? null,
        isMismatch: mismatch,
        note: mismatch
          ? 'Detected scales disagree beyond tolerance — confirm before issuing for construction.'
          : null,
      }
    })

  const reportData: ScaleAuditReportData = {
    projectName,
    projectAddress,
    generatedAt: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
    preparedBy: opts.preparedBy,
    rows,
  }

  const blob = await pdf(<ScaleAuditReport data={reportData} />).toBlob()
  const safeName = projectName.replace(/[^\w-]+/g, '_').slice(0, 40) || 'Project'
  const filename = `Scale_Audit_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`
  return { blob, filename, data: reportData }
}
