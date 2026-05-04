// Discrepancy Report PDF
// Adapted from sitesyncai-backend-main/src/discrepancy-export/report-pdf.service.ts
// Generates a professional, brandable PDF listing every detected dimensional
// discrepancy across a drawing set with annotated images and severity grouping.

import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet, pdf } from '@react-pdf/renderer'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'

// ── Types ────────────────────────────────────────────────

export interface DiscrepancyItem {
  id: string
  description: string
  archSheet: string
  structSheet: string
  archDimension: string | null
  structDimension: string | null
  severity: 'high' | 'medium' | 'low'
  confidence: number
  archImageUrl?: string | null
  structImageUrl?: string | null
  overlapImageUrl?: string | null
  autoRfiNumber?: string | null
}

export interface DiscrepancyReportData {
  projectName: string
  projectAddress?: string
  generatedAt: string
  preparedBy?: string
  totalPairs: number
  discrepancies: DiscrepancyItem[]
}

// ── Style tokens (match SiteSync brand) ──────────────────

const ORANGE = '#F47820'
const NAVY = '#0F1629'
const GRAY = '#6B7280'
const LGRAY = '#F3F4F6'
const BORDER = '#E5E7EB'
const SEV_HIGH = '#DC2626'
const SEV_MED = '#D97706'
const SEV_LOW = '#2563EB'

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: NAVY,
  },
  // ── Cover ──
  coverBrand: {
    backgroundColor: ORANGE,
    padding: 28,
    marginBottom: 24,
  },
  coverBrandText: { color: '#FFFFFF', fontSize: 22, fontWeight: 700, letterSpacing: 2 },
  coverTitle: { fontSize: 28, fontWeight: 700, marginTop: 40 },
  coverSubtitle: { fontSize: 14, color: GRAY, marginTop: 8 },
  coverMetaBlock: { marginTop: 60, borderTop: `1pt solid ${BORDER}`, paddingTop: 20 },
  coverMetaRow: { flexDirection: 'row', marginBottom: 8 },
  coverMetaLabel: { width: 120, color: GRAY, fontSize: 10 },
  coverMetaValue: { fontSize: 10, color: NAVY },
  // ── TOC ──
  tocTitle: { fontSize: 18, fontWeight: 700, marginBottom: 16 },
  tocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottom: `0.5pt solid ${BORDER}`,
  },
  tocEntry: { fontSize: 10 },
  tocPageNum: { fontSize: 10, color: GRAY },
  // ── Stats ──
  statsHeader: { fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 10 },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statsCell: {
    flex: 1,
    padding: 12,
    backgroundColor: LGRAY,
    borderRadius: 4,
  },
  statsCellNum: { fontSize: 20, fontWeight: 700, color: NAVY },
  statsCellLabel: { fontSize: 9, color: GRAY, marginTop: 4 },
  // ── Discrepancy card ──
  card: {
    border: `1pt solid ${BORDER}`,
    borderRadius: 4,
    padding: 14,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: { fontSize: 12, fontWeight: 700, flex: 1, paddingRight: 8 },
  severityBadge: {
    fontSize: 8,
    color: '#FFFFFF',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    fontWeight: 700,
  },
  cardMeta: { flexDirection: 'row', gap: 18, marginBottom: 6 },
  cardMetaItem: { flexDirection: 'column' },
  cardMetaLabel: { fontSize: 8, color: GRAY },
  cardMetaValue: { fontSize: 10, fontWeight: 700 },
  cardDescription: { fontSize: 10, color: NAVY, marginBottom: 10, lineHeight: 1.4 },
  cardImages: { flexDirection: 'row', gap: 8 },
  cardImage: {
    flex: 1,
    height: 140,
    border: `0.5pt solid ${BORDER}`,
    borderRadius: 2,
  },
  imagePlaceholder: {
    flex: 1,
    height: 140,
    backgroundColor: LGRAY,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: { fontSize: 8, color: GRAY },
  pageFooter: {
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

// ── Helpers ───────────────────────────────────────────────

function severityColor(sev: DiscrepancyItem['severity']): string {
  if (sev === 'high') return SEV_HIGH
  if (sev === 'medium') return SEV_MED
  return SEV_LOW
}

function countBySeverity(items: DiscrepancyItem[]) {
  return {
    high: items.filter((d) => d.severity === 'high').length,
    medium: items.filter((d) => d.severity === 'medium').length,
    low: items.filter((d) => d.severity === 'low').length,
  }
}

// ── Subcomponents ─────────────────────────────────────────

const CoverPage: React.FC<{ data: DiscrepancyReportData }> = ({ data }) => (
  <Page size="LETTER" style={styles.page}>
    <View style={styles.coverBrand}>
      <Text style={styles.coverBrandText}>SITESYNC AI</Text>
    </View>
    <Text style={styles.coverTitle}>Drawing Discrepancy Report</Text>
    <Text style={styles.coverSubtitle}>
      Dimensional analysis of architectural versus structural drawings
    </Text>
    <View style={styles.coverMetaBlock}>
      <View style={styles.coverMetaRow}>
        <Text style={styles.coverMetaLabel}>Project</Text>
        <Text style={styles.coverMetaValue}>{data.projectName}</Text>
      </View>
      {data.projectAddress ? (
        <View style={styles.coverMetaRow}>
          <Text style={styles.coverMetaLabel}>Address</Text>
          <Text style={styles.coverMetaValue}>{data.projectAddress}</Text>
        </View>
      ) : null}
      <View style={styles.coverMetaRow}>
        <Text style={styles.coverMetaLabel}>Generated</Text>
        <Text style={styles.coverMetaValue}>{data.generatedAt}</Text>
      </View>
      {data.preparedBy ? (
        <View style={styles.coverMetaRow}>
          <Text style={styles.coverMetaLabel}>Prepared by</Text>
          <Text style={styles.coverMetaValue}>{data.preparedBy}</Text>
        </View>
      ) : null}
      <View style={styles.coverMetaRow}>
        <Text style={styles.coverMetaLabel}>Total pairs</Text>
        <Text style={styles.coverMetaValue}>{data.totalPairs}</Text>
      </View>
      <View style={styles.coverMetaRow}>
        <Text style={styles.coverMetaLabel}>Discrepancies</Text>
        <Text style={styles.coverMetaValue}>{data.discrepancies.length}</Text>
      </View>
    </View>
  </Page>
)

const TableOfContentsPage: React.FC<{ items: DiscrepancyItem[] }> = ({ items }) => (
  <Page size="LETTER" style={styles.page}>
    <Text style={styles.tocTitle}>Table of Contents</Text>
    <View style={styles.tocRow}>
      <Text style={styles.tocEntry}>Summary Statistics</Text>
      <Text style={styles.tocPageNum}>3</Text>
    </View>
    {items.map((item, idx) => (
      <View key={item.id} style={styles.tocRow}>
        <Text style={styles.tocEntry}>
          {idx + 1}. {item.archSheet} vs {item.structSheet}
        </Text>
        <Text style={styles.tocPageNum}>{4 + idx}</Text>
      </View>
    ))}
    <View
      fixed
      style={styles.pageFooter}
      render={({ pageNumber, totalPages }) => (
        <>
          <Text>SiteSync PM</Text>
          <Text>
            Page {pageNumber} of {totalPages}
          </Text>
        </>
      )}
    />
  </Page>
)

const SummaryStatsPage: React.FC<{ data: DiscrepancyReportData }> = ({ data }) => {
  const counts = countBySeverity(data.discrepancies)
  return (
    <Page size="LETTER" style={styles.page}>
      <Text style={styles.statsHeader}>Summary Statistics</Text>
      <View style={styles.statsGrid}>
        <View style={[styles.statsCell, { borderLeft: `3pt solid ${SEV_HIGH}` }]}>
          <Text style={styles.statsCellNum}>{counts.high}</Text>
          <Text style={styles.statsCellLabel}>HIGH severity</Text>
        </View>
        <View style={[styles.statsCell, { borderLeft: `3pt solid ${SEV_MED}` }]}>
          <Text style={styles.statsCellNum}>{counts.medium}</Text>
          <Text style={styles.statsCellLabel}>MEDIUM severity</Text>
        </View>
        <View style={[styles.statsCell, { borderLeft: `3pt solid ${SEV_LOW}` }]}>
          <Text style={styles.statsCellNum}>{counts.low}</Text>
          <Text style={styles.statsCellLabel}>LOW severity</Text>
        </View>
      </View>
      <View style={styles.statsGrid}>
        <View style={styles.statsCell}>
          <Text style={styles.statsCellNum}>{data.totalPairs}</Text>
          <Text style={styles.statsCellLabel}>Drawing pairs analyzed</Text>
        </View>
        <View style={styles.statsCell}>
          <Text style={styles.statsCellNum}>{data.discrepancies.length}</Text>
          <Text style={styles.statsCellLabel}>Total discrepancies</Text>
        </View>
      </View>
      <View
        fixed
        style={styles.pageFooter}
        render={({ pageNumber, totalPages }) => (
          <>
            <Text>SiteSync PM</Text>
            <Text>
              Page {pageNumber} of {totalPages}
            </Text>
          </>
        )}
      />
    </Page>
  )
}

const DiscrepancyCard: React.FC<{ item: DiscrepancyItem; index: number }> = ({ item, index }) => (
  <View style={styles.card} wrap={false}>
    <View style={styles.cardHeader}>
      <Text style={styles.cardTitle}>
        {index + 1}. {item.archSheet} versus {item.structSheet}
      </Text>
      <Text style={[styles.severityBadge, { backgroundColor: severityColor(item.severity) }]}>
        {item.severity.toUpperCase()}
      </Text>
    </View>
    <View style={styles.cardMeta}>
      <View style={styles.cardMetaItem}>
        <Text style={styles.cardMetaLabel}>Architectural</Text>
        <Text style={styles.cardMetaValue}>{item.archDimension || 'N/A'}</Text>
      </View>
      <View style={styles.cardMetaItem}>
        <Text style={styles.cardMetaLabel}>Structural</Text>
        <Text style={styles.cardMetaValue}>{item.structDimension || 'N/A'}</Text>
      </View>
      <View style={styles.cardMetaItem}>
        <Text style={styles.cardMetaLabel}>Confidence</Text>
        <Text style={styles.cardMetaValue}>{Math.round(item.confidence * 100)}%</Text>
      </View>
      {item.autoRfiNumber ? (
        <View style={styles.cardMetaItem}>
          <Text style={styles.cardMetaLabel}>Auto RFI</Text>
          <Text style={styles.cardMetaValue}>{item.autoRfiNumber}</Text>
        </View>
      ) : null}
    </View>
    <Text style={styles.cardDescription}>{item.description}</Text>
    <View style={styles.cardImages}>
      {item.archImageUrl ? (
        <Image style={styles.cardImage} src={item.archImageUrl} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderText}>Architectural page unavailable</Text>
        </View>
      )}
      {item.structImageUrl ? (
        <Image style={styles.cardImage} src={item.structImageUrl} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderText}>Structural page unavailable</Text>
        </View>
      )}
      {item.overlapImageUrl ? (
        <Image style={styles.cardImage} src={item.overlapImageUrl} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderText}>Overlay not generated</Text>
        </View>
      )}
    </View>
  </View>
)

// ── Main component ────────────────────────────────────────

export const DiscrepancyReport: React.FC<{ data: DiscrepancyReportData }> = ({ data }) => (
  <Document title={`Discrepancy Report — ${data.projectName}`}>
    <CoverPage data={data} />
    <TableOfContentsPage items={data.discrepancies} />
    <SummaryStatsPage data={data} />
    {data.discrepancies.length === 0 ? (
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.statsHeader}>No discrepancies detected</Text>
        <Text style={{ fontSize: 10, color: GRAY }}>
          The drawing intelligence pipeline completed with zero dimensional mismatches above the
          configured tolerance threshold.
        </Text>
      </Page>
    ) : (
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.statsHeader}>Detected Discrepancies</Text>
        {data.discrepancies.map((d, i) => (
          <DiscrepancyCard key={d.id} item={d} index={i} />
        ))}
        <View
          fixed
          style={styles.pageFooter}
          render={({ pageNumber, totalPages }) => (
            <>
              <Text>SiteSync PM — {data.projectName}</Text>
              <Text>
                Page {pageNumber} of {totalPages}
              </Text>
            </>
          )}
        />
      </Page>
    )}
  </Document>
)

export default DiscrepancyReport

// ── Data fetch + generator ────────────────────────────────
// Pulls real project data from Supabase, assembles the
// DiscrepancyReportData shape, and returns a downloadable PDF blob
// along with a sensible filename.

export interface DiscrepancyReportOptions {
  preparedBy?: string
  drawingIds?: string[] | 'all'
}

type DiscrepancyRow = {
  id: string
  description: string | null
  severity: string | null
  confidence: number | null
  arch_dimension: string | null
  struct_dimension: string | null
  drawing_id: string | null
  drawing_pair_id: string | null
  auto_rfi_id: string | null
}

type PairRow = {
  id: string
  drawing_a_id: string | null
  drawing_b_id: string | null
  overlap_image_url: string | null
}

type DrawingRow = {
  id: string
  sheet_number: string | null
  thumbnail_url: string | null
}

type RfiRow = { id: string; number: number | null }

export async function generateDiscrepancyReport(
  projectId: string,
  opts: DiscrepancyReportOptions = {},
): Promise<{ blob: Blob; filename: string; data: DiscrepancyReportData }> {
  const [projectRes, pairsRes, discRes, drawingsRes] = await Promise.all([
    fromTable('projects').select('name, location').eq('id' as never, projectId).maybeSingle(),
    fromTable('drawing_pairs').select('id, drawing_a_id, drawing_b_id, overlap_image_url').eq('project_id' as never, projectId),
    fromTable('drawing_discrepancies').select('id, description, severity, confidence, arch_dimension, struct_dimension, drawing_id, drawing_pair_id, auto_rfi_id').eq('project_id' as never, projectId).eq('is_false_positive' as never, false),
    fromTable('drawings').select('id, sheet_number, thumbnail_url').eq('project_id' as never, projectId),
  ])

  const projectName = (projectRes.data?.name as string | undefined) ?? 'Project'
  const projectAddress = (projectRes.data?.location as string | undefined) ?? undefined

  const pairs: PairRow[] = (pairsRes.data ?? []) as PairRow[]
  const drawings: DrawingRow[] = (drawingsRes.data ?? []) as DrawingRow[]
  const rawDiscrepancies: DiscrepancyRow[] = (discRes.data ?? []) as DiscrepancyRow[]

  const drawingById = new Map(drawings.map((d) => [d.id, d]))
  const pairById = new Map(pairs.map((p) => [p.id, p]))

  // Optional RFI lookup for linked auto-RFI numbers
  const rfiIds = Array.from(new Set(rawDiscrepancies.map((d) => d.auto_rfi_id).filter(Boolean))) as string[]
  let rfiById = new Map<string, RfiRow>()
  if (rfiIds.length > 0) {
    const { data: rfis } = await fromTable('rfis').select('id, number').in('id' as never, rfiIds)
    rfiById = new Map(((rfis ?? []) as RfiRow[]).map((r) => [r.id, r]))
  }

  const selected = opts.drawingIds && opts.drawingIds !== 'all' ? new Set(opts.drawingIds) : null

  const items: DiscrepancyItem[] = rawDiscrepancies
    .map((d) => {
      const pair = d.drawing_pair_id ? pairById.get(d.drawing_pair_id) : undefined
      const archDraw = pair?.drawing_a_id ? drawingById.get(pair.drawing_a_id) : undefined
      const structDraw = pair?.drawing_b_id ? drawingById.get(pair.drawing_b_id) : undefined
      const rfi = d.auto_rfi_id ? rfiById.get(d.auto_rfi_id) : undefined
      return {
        id: d.id,
        description: d.description ?? 'Dimensional mismatch detected',
        archSheet: archDraw?.sheet_number ?? '—',
        structSheet: structDraw?.sheet_number ?? '—',
        archDimension: d.arch_dimension,
        structDimension: d.struct_dimension,
        severity: (d.severity === 'high' || d.severity === 'medium' || d.severity === 'low' ? d.severity : 'medium') as DiscrepancyItem['severity'],
        confidence: d.confidence ?? 0,
        archImageUrl: archDraw?.thumbnail_url ?? null,
        structImageUrl: structDraw?.thumbnail_url ?? null,
        overlapImageUrl: pair?.overlap_image_url ?? null,
        autoRfiNumber: rfi?.number != null ? `RFI-${String(rfi.number).padStart(3, '0')}` : null,
        _archDrawingId: archDraw?.id,
        _structDrawingId: structDraw?.id,
      } as DiscrepancyItem & { _archDrawingId?: string; _structDrawingId?: string }
    })
    .filter((item) => {
      if (!selected) return true
      return (item._archDrawingId && selected.has(item._archDrawingId)) ||
             (item._structDrawingId && selected.has(item._structDrawingId))
    })
    .map(({ _archDrawingId: _a, _structDrawingId: _b, ...rest }) => {
      void _a; void _b
      return rest
    })

  const reportData: DiscrepancyReportData = {
    projectName,
    projectAddress,
    generatedAt: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
    preparedBy: opts.preparedBy,
    totalPairs: pairs.length,
    discrepancies: items,
  }

  const blob = await pdf(<DiscrepancyReport data={reportData} />).toBlob()
  const safeName = projectName.replace(/[^\w-]+/g, '_').slice(0, 40) || 'Project'
  const filename = `Discrepancy_Report_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`
  return { blob, filename, data: reportData }
}
