// Drawing Analysis Report PDF
// Classification summary of every sheet in a drawing set: detected discipline,
// plan type, scale, pairing status, and AI confidence.

import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export interface ClassificationRow {
  sheetNumber: string
  drawingTitle: string
  discipline: string
  planType: string | null
  floorLevel: string | null
  scaleText: string | null
  confidence: number
  paired: boolean
  pairedWith?: string | null
}

export interface DrawingAnalysisReportData {
  projectName: string
  generatedAt: string
  rows: ClassificationRow[]
}

const ORANGE = '#F47820'
const NAVY = '#0F1629'
const GRAY = '#6B7280'
const LGRAY = '#F3F4F6'
const BORDER = '#E5E7EB'

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: 'Helvetica', color: NAVY },
  brand: { backgroundColor: ORANGE, padding: 22, marginBottom: 20 },
  brandText: { color: '#FFFFFF', fontSize: 18, fontWeight: 700, letterSpacing: 2 },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 6 },
  subtitle: { fontSize: 11, color: GRAY, marginBottom: 16 },
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
  cellSheet: { width: '12%', fontSize: 8, fontWeight: 700 },
  cellTitle: { width: '28%', fontSize: 8 },
  cellDiscipline: { width: '14%', fontSize: 8 },
  cellPlanType: { width: '12%', fontSize: 8 },
  cellScale: { width: '12%', fontSize: 8 },
  cellConfidence: { width: '10%', fontSize: 8 },
  cellPaired: { width: '12%', fontSize: 8 },
  summary: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  summaryCell: {
    flex: 1,
    padding: 10,
    backgroundColor: LGRAY,
    borderRadius: 4,
  },
  summaryNum: { fontSize: 18, fontWeight: 700 },
  summaryLabel: { fontSize: 8, color: GRAY, marginTop: 2 },
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

function percentByDiscipline(rows: ClassificationRow[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const r of rows) counts[r.discipline] = (counts[r.discipline] || 0) + 1
  return counts
}

export const DrawingAnalysisReport: React.FC<{ data: DrawingAnalysisReportData }> = ({ data }) => {
  const byDiscipline = percentByDiscipline(data.rows)
  const paired = data.rows.filter((r) => r.paired).length
  const avgConfidence = data.rows.length
    ? data.rows.reduce((sum, r) => sum + r.confidence, 0) / data.rows.length
    : 0

  return (
    <Document title={`Drawing Analysis — ${data.projectName}`}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.brand}>
          <Text style={styles.brandText}>SITESYNC AI</Text>
        </View>
        <Text style={styles.title}>Drawing Analysis Summary</Text>
        <Text style={styles.subtitle}>
          {data.projectName} — generated {data.generatedAt}
        </Text>

        <View style={styles.summary}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryNum}>{data.rows.length}</Text>
            <Text style={styles.summaryLabel}>Sheets classified</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryNum}>{paired}</Text>
            <Text style={styles.summaryLabel}>Sheets paired</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryNum}>{Math.round(avgConfidence * 100)}%</Text>
            <Text style={styles.summaryLabel}>Avg confidence</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryNum}>{Object.keys(byDiscipline).length}</Text>
            <Text style={styles.summaryLabel}>Disciplines</Text>
          </View>
        </View>

        <View style={styles.tableHeader} fixed>
          <Text style={[styles.tableHeaderCell, { width: '12%' }]}>SHEET</Text>
          <Text style={[styles.tableHeaderCell, { width: '28%' }]}>TITLE</Text>
          <Text style={[styles.tableHeaderCell, { width: '14%' }]}>DISCIPLINE</Text>
          <Text style={[styles.tableHeaderCell, { width: '12%' }]}>PLAN TYPE</Text>
          <Text style={[styles.tableHeaderCell, { width: '12%' }]}>SCALE</Text>
          <Text style={[styles.tableHeaderCell, { width: '10%' }]}>CONF</Text>
          <Text style={[styles.tableHeaderCell, { width: '12%' }]}>PAIRED</Text>
        </View>

        {data.rows.length === 0 ? (
          <View style={styles.tableRow}>
            <Text style={{ fontSize: 9, color: GRAY }}>
              No classification data yet. Run the classification pipeline to populate this report.
            </Text>
          </View>
        ) : (
          data.rows.map((r, i) => (
            <View key={`${r.sheetNumber}-${i}`} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={styles.cellSheet}>{r.sheetNumber}</Text>
              <Text style={styles.cellTitle}>{r.drawingTitle}</Text>
              <Text style={styles.cellDiscipline}>{r.discipline}</Text>
              <Text style={styles.cellPlanType}>{r.planType || '—'}</Text>
              <Text style={styles.cellScale}>{r.scaleText || '—'}</Text>
              <Text style={styles.cellConfidence}>{Math.round(r.confidence * 100)}%</Text>
              <Text style={styles.cellPaired}>{r.paired ? r.pairedWith || 'Yes' : 'No'}</Text>
            </View>
          ))
        )}

        <View
          fixed
          style={styles.footer}
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
    </Document>
  )
}

export default DrawingAnalysisReport
