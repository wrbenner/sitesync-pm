// Discrepancy Report PDF
// Adapted from sitesyncai-backend-main/src/discrepancy-export/report-pdf.service.ts
// Generates a professional, brandable PDF listing every detected dimensional
// discrepancy across a drawing set with annotated images and severity grouping.

import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

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
          <Text>SiteSync AI</Text>
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
            <Text>SiteSync AI</Text>
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
              <Text>SiteSync AI — {data.projectName}</Text>
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
