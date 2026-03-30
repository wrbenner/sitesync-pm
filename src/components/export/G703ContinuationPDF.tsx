// AIA G703 — Continuation Sheet (Schedule of Values)
// Line-item breakdown matching official AIA form layout.

import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { G702Data, G703LineItem } from '../../machines/paymentMachine'

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 7, fontFamily: 'Helvetica', color: '#1A1613' },
  header: { marginBottom: 12 },
  title: { fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 2 },
  subtitle: { fontSize: 8, textAlign: 'center', color: '#5C5550', marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2, fontSize: 7 },
  // Table
  table: { marginTop: 8 },
  headerRow: { flexDirection: 'row', backgroundColor: '#0C0D0F', padding: 4 },
  headerCell: { fontFamily: 'Helvetica-Bold', fontSize: 6, color: '#FFFFFF', textAlign: 'center' },
  row: { flexDirection: 'row', padding: 3, borderBottomWidth: 0.5, borderBottomColor: '#E5E1DC' },
  rowAlt: { flexDirection: 'row', padding: 3, borderBottomWidth: 0.5, borderBottomColor: '#E5E1DC', backgroundColor: '#FAFAF8' },
  cell: { fontSize: 7, textAlign: 'right' },
  cellLeft: { fontSize: 7, textAlign: 'left' },
  totalRow: { flexDirection: 'row', padding: 4, borderTopWidth: 1.5, borderTopColor: '#0C0D0F', marginTop: 2 },
  totalCell: { fontSize: 7, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  // Footer
  footer: { position: 'absolute', bottom: 16, left: 24, right: 24, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#E5E1DC', paddingTop: 4 },
  footerText: { fontSize: 6, color: '#9A9490' },
})

// Column widths (percentage)
const COL = {
  item: '6%',
  desc: '22%',
  scheduled: '11%',
  prevCompleted: '11%',
  thisPeriod: '11%',
  materials: '10%',
  totalCompleted: '10%',
  percent: '6%',
  balance: '8%',
  retainage: '5%',
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPct = (n: number) => `${n.toFixed(1)}%`

interface G703PDFProps {
  projectName: string
  applicationNumber: number
  periodTo: string
  lineItems: G703LineItem[]
  summary: G702Data
}

export const G703ContinuationPDF: React.FC<G703PDFProps> = ({
  projectName, applicationNumber, periodTo, lineItems, summary,
}) => {
  // Calculate totals
  const totals = {
    scheduledValue: lineItems.reduce((s, i) => s + i.scheduledValue, 0),
    previousCompleted: lineItems.reduce((s, i) => s + i.previousCompleted, 0),
    thisPeriod: lineItems.reduce((s, i) => s + i.thisPeroid, 0),
    materialsStored: lineItems.reduce((s, i) => s + i.materialsStored, 0),
    totalCompleted: lineItems.reduce((s, i) => s + i.totalCompletedAndStored, 0),
    balanceToFinish: lineItems.reduce((s, i) => s + i.balanceToFinish, 0),
    retainage: lineItems.reduce((s, i) => s + i.retainage, 0),
  }
  const totalPercent = totals.scheduledValue > 0
    ? (totals.totalCompleted / totals.scheduledValue) * 100 : 0

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>CONTINUATION SHEET</Text>
          <Text style={styles.subtitle}>AIA Document G703</Text>
          <View style={styles.infoRow}>
            <Text>Project: {projectName}</Text>
            <Text>Application No: {applicationNumber}</Text>
            <Text>Period To: {periodTo}</Text>
          </View>
        </View>

        {/* Column Headers */}
        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, { width: COL.item }]}>A{'\n'}Item No.</Text>
            <Text style={[styles.headerCell, { width: COL.desc, textAlign: 'left' }]}>B{'\n'}Description of Work</Text>
            <Text style={[styles.headerCell, { width: COL.scheduled }]}>C{'\n'}Scheduled{'\n'}Value</Text>
            <Text style={[styles.headerCell, { width: COL.prevCompleted }]}>D{'\n'}Work Completed{'\n'}From Previous</Text>
            <Text style={[styles.headerCell, { width: COL.thisPeriod }]}>E{'\n'}Work Completed{'\n'}This Period</Text>
            <Text style={[styles.headerCell, { width: COL.materials }]}>F{'\n'}Materials{'\n'}Presently Stored</Text>
            <Text style={[styles.headerCell, { width: COL.totalCompleted }]}>G{'\n'}Total Completed{'\n'}and Stored (D+E+F)</Text>
            <Text style={[styles.headerCell, { width: COL.percent }]}>H{'\n'}%{'\n'}(G÷C)</Text>
            <Text style={[styles.headerCell, { width: COL.balance }]}>I{'\n'}Balance to{'\n'}Finish (C−G)</Text>
            <Text style={[styles.headerCell, { width: COL.retainage }]}>J{'\n'}Retainage</Text>
          </View>

          {/* Line Items */}
          {lineItems.map((item, i) => (
            <View key={item.itemNumber} style={i % 2 === 0 ? styles.row : styles.rowAlt}>
              <Text style={[styles.cell, { width: COL.item, textAlign: 'center' }]}>{item.itemNumber}</Text>
              <Text style={[styles.cellLeft, { width: COL.desc }]} numberOfLines={2}>{item.description}</Text>
              <Text style={[styles.cell, { width: COL.scheduled }]}>{fmt(item.scheduledValue)}</Text>
              <Text style={[styles.cell, { width: COL.prevCompleted }]}>{fmt(item.previousCompleted)}</Text>
              <Text style={[styles.cell, { width: COL.thisPeriod }]}>{fmt(item.thisPeroid)}</Text>
              <Text style={[styles.cell, { width: COL.materials }]}>{fmt(item.materialsStored)}</Text>
              <Text style={[styles.cell, { width: COL.totalCompleted }]}>{fmt(item.totalCompletedAndStored)}</Text>
              <Text style={[styles.cell, { width: COL.percent }]}>{fmtPct(item.percentComplete)}</Text>
              <Text style={[styles.cell, { width: COL.balance }]}>{fmt(item.balanceToFinish)}</Text>
              <Text style={[styles.cell, { width: COL.retainage }]}>{fmt(item.retainage)}</Text>
            </View>
          ))}

          {/* Totals Row */}
          <View style={styles.totalRow}>
            <Text style={[styles.totalCell, { width: COL.item, textAlign: 'center' }]} />
            <Text style={[styles.totalCell, { width: COL.desc, textAlign: 'left' }]}>TOTALS</Text>
            <Text style={[styles.totalCell, { width: COL.scheduled }]}>{fmt(totals.scheduledValue)}</Text>
            <Text style={[styles.totalCell, { width: COL.prevCompleted }]}>{fmt(totals.previousCompleted)}</Text>
            <Text style={[styles.totalCell, { width: COL.thisPeriod }]}>{fmt(totals.thisPeriod)}</Text>
            <Text style={[styles.totalCell, { width: COL.materials }]}>{fmt(totals.materialsStored)}</Text>
            <Text style={[styles.totalCell, { width: COL.totalCompleted }]}>{fmt(totals.totalCompleted)}</Text>
            <Text style={[styles.totalCell, { width: COL.percent }]}>{fmtPct(totalPercent)}</Text>
            <Text style={[styles.totalCell, { width: COL.balance }]}>{fmt(totals.balanceToFinish)}</Text>
            <Text style={[styles.totalCell, { width: COL.retainage }]}>{fmt(totals.retainage)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated by SiteSync PM</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
