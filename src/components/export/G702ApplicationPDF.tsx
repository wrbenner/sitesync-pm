// AIA G702 — Application and Certificate for Payment
// Matches official AIA form layout.

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { G702Data } from '../../machines/paymentMachine'

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: 'Helvetica', color: '#1A1613' },
  header: { textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#5C5550', marginBottom: 8 },
  formNumber: { fontSize: 7, color: '#8C8580', marginBottom: 16 },
  // Two-column info section
  infoRow: { flexDirection: 'row', marginBottom: 4 },
  infoLabel: { width: '35%', fontSize: 8, color: '#5C5550' },
  infoValue: { width: '65%', fontSize: 8, fontFamily: 'Helvetica-Bold' },
  // Financial table
  section: { marginTop: 16, marginBottom: 8 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#0C0D0F', paddingBottom: 4 },
  row: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#E5E1DC' },
  rowLabel: { width: '60%', fontSize: 8 },
  rowNumber: { width: '10%', fontSize: 8, textAlign: 'center', color: '#5C5550' },
  rowValue: { width: '30%', fontSize: 8, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  totalRow: { flexDirection: 'row', paddingVertical: 6, borderTopWidth: 1.5, borderTopColor: '#0C0D0F', marginTop: 4 },
  totalLabel: { width: '60%', fontSize: 9, fontFamily: 'Helvetica-Bold' },
  totalValue: { width: '30%', fontSize: 9, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  // Signatures
  signatureSection: { flexDirection: 'row', marginTop: 24, gap: 24 },
  signatureBox: { flex: 1, borderTopWidth: 1, borderTopColor: '#0C0D0F', paddingTop: 8 },
  signatureLabel: { fontSize: 7, color: '#5C5550' },
  signatureImage: { width: 150, height: 40, objectFit: 'contain' },
  // Footer
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#E5E1DC', paddingTop: 6 },
  footerText: { fontSize: 6, color: '#9A9490' },
})

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface G702PDFProps {
  data: G702Data
}

export const G702ApplicationPDF: React.FC<G702PDFProps> = ({ data }) => (
  <Document>
    <Page size="LETTER" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>APPLICATION AND CERTIFICATE FOR PAYMENT</Text>
        <Text style={styles.subtitle}>AIA Document G702</Text>
        <Text style={styles.formNumber}>SiteSync PM generated document</Text>
      </View>

      {/* Project Info */}
      <View style={{ flexDirection: 'row', gap: 24, marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <InfoRow label="To Owner:" value="" />
          <InfoRow label="From Contractor:" value={data.contractorName} />
          <InfoRow label="Project:" value={data.projectName} />
        </View>
        <View style={{ flex: 1 }}>
          <InfoRow label="Application No:" value={String(data.applicationNumber)} />
          <InfoRow label="Period To:" value={data.periodTo} />
          <InfoRow label="Contract For:" value="General Construction" />
        </View>
      </View>

      {/* Financial Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contractor's Application for Payment</Text>

        <FinancialRow num="1" label="Original Contract Sum" value={data.originalContractSum} />
        <FinancialRow num="2" label="Net Change by Change Orders" value={data.netChangeOrders} />
        <FinancialRow num="3" label="Contract Sum to Date (Line 1 + 2)" value={data.contractSumToDate} bold />
        <FinancialRow num="4" label="Total Completed and Stored to Date (Column G on G703)" value={data.totalCompletedAndStored} />
        <FinancialRow num="5" label={`Retainage: ${data.retainagePercent}% of Completed Work`} value={data.retainageAmount} />
        <FinancialRow num="6" label="Total Earned Less Retainage (Line 4 Less Line 5)" value={data.totalEarnedLessRetainage} bold />
        <FinancialRow num="7" label="Less Previous Certificates for Payment" value={data.lessPreviousCertificates} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>8. CURRENT PAYMENT DUE</Text>
          <Text style={{ width: '10%' }} />
          <Text style={styles.totalValue}>{fmt(data.currentPaymentDue)}</Text>
        </View>

        <FinancialRow num="9" label="Balance to Finish, Including Retainage (Line 3 Less Line 4)" value={data.balanceToFinish} />
      </View>

      {/* Certifications */}
      <View style={styles.section}>
        <Text style={{ fontSize: 7, color: '#5C5550', lineHeight: 1.5, marginBottom: 12 }}>
          The undersigned Contractor certifies that to the best of the Contractor's knowledge, information, and belief,
          the Work covered by this Application for Payment has been completed in accordance with the Contract Documents,
          that all amounts have been paid by the Contractor for Work for which previous Certificates for Payment were issued,
          and that current payment shown herein is now due.
        </Text>
      </View>

      {/* Signatures */}
      <View style={styles.signatureSection}>
        <View style={styles.signatureBox}>
          {data.contractorSignature && <Image src={data.contractorSignature} style={styles.signatureImage} />}
          <Text style={styles.signatureLabel}>Contractor Signature / Date</Text>
        </View>
        <View style={styles.signatureBox}>
          {data.ownerSignature && <Image src={data.ownerSignature} style={styles.signatureImage} />}
          <Text style={styles.signatureLabel}>Owner Signature / Date</Text>
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

// Sub-components
const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
)

const FinancialRow: React.FC<{ num: string; label: string; value: number; bold?: boolean }> = ({ num, label, value, bold }) => (
  <View style={styles.row}>
    <Text style={[styles.rowLabel, bold ? { fontFamily: 'Helvetica-Bold' } : {}]}>{label}</Text>
    <Text style={styles.rowNumber}>{num}</Text>
    <Text style={[styles.rowValue, bold ? { fontFamily: 'Helvetica-Bold' } : {}]}>{fmt(value)}</Text>
  </View>
)
