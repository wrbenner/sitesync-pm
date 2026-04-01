// Lien Waiver PDF Auto-Generation
// State-specific templates for California, Texas, Florida, New York, and generic.
// Generates both conditional and unconditional waivers from payment application data.

import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { colors, vizColors } from '../../styles/theme'

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: 'Helvetica', color: vizColors.darkText, lineHeight: 1.6 },
  title: { fontSize: 14, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 10, textAlign: 'center', color: colors.textSecondary, marginBottom: 20 },
  section: { marginBottom: 16 },
  label: { fontSize: 8, color: colors.textSecondary, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  value: { fontSize: 10, marginBottom: 8 },
  legalText: { fontSize: 9, lineHeight: 1.7, marginBottom: 12 },
  bold: { fontFamily: 'Helvetica-Bold' },
  fieldRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  field: { flex: 1 },
  underline: { borderBottomWidth: 1, borderBottomColor: vizColors.darkText, paddingBottom: 2, marginBottom: 4, minHeight: 16 },
  signatureBlock: { marginTop: 32, flexDirection: 'row', gap: 48 },
  signatureField: { flex: 1 },
  signatureLine: { borderBottomWidth: 1, borderBottomColor: vizColors.darkText, marginTop: 40, marginBottom: 4 },
  signatureLabel: { fontSize: 8, color: colors.textSecondary },
  notice: { marginTop: 20, padding: 12, backgroundColor: colors.surfaceSelected, borderRadius: 4, borderWidth: 0.5, borderColor: colors.primaryOrange },
  noticeText: { fontSize: 8, color: colors.textSecondary, lineHeight: 1.5 },
  footer: { position: 'absolute', bottom: 24, left: 48, right: 48, borderTopWidth: 0.5, borderTopColor: colors.borderDefault, paddingTop: 8 },
  footerText: { fontSize: 7, color: colors.textTertiary },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: colors.darkNavy },
  logo: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: colors.darkNavy },
  projectName: { fontSize: 8, color: colors.textSecondary, marginTop: 2 },
})

// ── Types ───────────────────────────────────────────────

export type WaiverType = 'conditional' | 'unconditional'
export type WaiverState = 'california' | 'texas' | 'florida' | 'new_york' | 'generic'

export interface LienWaiverData {
  waiverType: WaiverType
  waiverState: WaiverState
  projectName: string
  projectAddress: string
  ownerName: string
  contractorName: string
  claimantName: string // The party signing the waiver (usually subcontractor)
  throughDate: string
  amount: number
  checkDate?: string
  checkNumber?: string
  signedBy?: string
  signedDate?: string
}

// Build LienWaiverData from a database LienWaiverRow plus project context.
// Caller supplies the static project fields; the row fills in the sub-specific fields.
export interface LienWaiverRowContext {
  projectName: string
  projectAddress: string
  ownerName: string
  contractorName: string
  waiverState?: WaiverState
}

export function lienWaiverDataFromRow(
  row: {
    type: string
    sub_name: string | null
    amount: number | null
    through_date: string | null
    signed_by: string | null
    signed_date: string | null
  },
  ctx: LienWaiverRowContext,
): LienWaiverData {
  const isConditional = row.type === 'conditional_progress' || row.type === 'conditional_final'
  return {
    waiverType: isConditional ? 'conditional' : 'unconditional',
    waiverState: ctx.waiverState ?? 'generic',
    projectName: ctx.projectName,
    projectAddress: ctx.projectAddress,
    ownerName: ctx.ownerName,
    contractorName: ctx.contractorName,
    claimantName: row.sub_name ?? '',
    throughDate: row.through_date ?? '',
    amount: row.amount ?? 0,
    signedBy: row.signed_by ?? undefined,
    signedDate: row.signed_date ?? undefined,
  }
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function fmtDate(d: string): string {
  if (!d) return '_______________'
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// ── State-Specific Legal Text ───────────────────────────

function getStatutoryReference(state: WaiverState, type: WaiverType): string {
  const refs: Record<WaiverState, Record<WaiverType, string>> = {
    california: {
      conditional: 'California Civil Code § 8132',
      unconditional: 'California Civil Code § 8134',
    },
    texas: {
      conditional: 'Texas Property Code § 53.284',
      unconditional: 'Texas Property Code § 53.284',
    },
    florida: {
      conditional: 'Florida Statute § 713.20',
      unconditional: 'Florida Statute § 713.20',
    },
    new_york: {
      conditional: 'New York Lien Law Article 2',
      unconditional: 'New York Lien Law Article 2',
    },
    generic: {
      conditional: 'Applicable State Lien Law',
      unconditional: 'Applicable State Lien Law',
    },
  }
  return refs[state][type]
}

function getConditionalText(data: LienWaiverData): string {
  const base = `Upon receipt of a check from ${data.ownerName || '(Owner)'} in the sum of ${fmtCurrency(data.amount)} payable to ${data.claimantName} and when the check has been properly endorsed and has been paid by the bank upon which it is drawn, this document shall become effective to release any mechanic's lien, stop payment notice, or bond right the undersigned has on the job of ${data.ownerName || '(Owner)'} located at ${data.projectAddress || '(Project Address)'} to the following extent:`

  switch (data.waiverState) {
    case 'california':
      return `${base}\n\nThis document covers a progress payment for labor, services, equipment, or material furnished to ${data.projectName} through ${fmtDate(data.throughDate)} only and does not cover any retentions retained before or after the release date; extras or change orders above the stated amount; or items furnished after the date specified.\n\nThis release is given in accordance with ${getStatutoryReference(data.waiverState, 'conditional')}.`
    case 'texas':
      return `${base}\n\nThis waiver and release covers all labor, services, equipment, or materials furnished through ${fmtDate(data.throughDate)} and does not cover any retentions retained before or after the release date; extras, change orders, or amounts in addition to the stated sum; or items furnished after the date specified.\n\nThis release is given pursuant to ${getStatutoryReference(data.waiverState, 'conditional')}.`
    default:
      return `${base}\n\nThis waiver and release is conditioned upon receipt of payment in the amount stated above. This document covers all labor, services, equipment, and materials furnished through ${fmtDate(data.throughDate)} only and does not cover retentions, extras, or change orders beyond the stated amount.`
  }
}

function getUnconditionalText(data: LienWaiverData): string {
  const base = `The undersigned has been paid and has received a progress payment in the sum of ${fmtCurrency(data.amount)} for labor, services, equipment, or material furnished to ${data.projectName} located at ${data.projectAddress || '(Project Address)'} and does hereby release any mechanic's lien, stop payment notice, or bond right the undersigned has on the above referenced job to the following extent:`

  switch (data.waiverState) {
    case 'california':
      return `${base}\n\nThis document covers a progress payment for all labor, services, equipment, or material furnished to the jobsite through ${fmtDate(data.throughDate)} only and does not cover any retentions retained before or after the release date; extras or change orders above the stated amount; or items furnished after the date specified.\n\nThis release is given in accordance with ${getStatutoryReference(data.waiverState, 'unconditional')}.`
    case 'texas':
      return `${base}\n\nThis waiver and release covers all labor, services, equipment, or materials furnished through ${fmtDate(data.throughDate)} and does not cover any retentions retained before or after the release date; extras, change orders, or amounts in addition to the stated sum.\n\nThis release is given pursuant to ${getStatutoryReference(data.waiverState, 'unconditional')}.`
    default:
      return `${base}\n\nThis document covers all labor, services, equipment, and materials furnished through ${fmtDate(data.throughDate)} only. Payment has been received and this waiver is unconditional and irrevocable.`
  }
}

// ── PDF Component ───────────────────────────────────────

export const LienWaiverPDF: React.FC<{ data: LienWaiverData }> = ({ data }) => {
  const isConditional = data.waiverType === 'conditional'
  const title = isConditional
    ? 'CONDITIONAL WAIVER AND RELEASE ON PROGRESS PAYMENT'
    : 'UNCONDITIONAL WAIVER AND RELEASE ON PROGRESS PAYMENT'
  const statutoryRef = getStatutoryReference(data.waiverState, data.waiverType)
  const legalText = isConditional ? getConditionalText(data) : getUnconditionalText(data)

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.logo}>SiteSync PM</Text>
            <Text style={s.projectName}>{data.projectName}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 8, color: colors.textSecondary }}>{statutoryRef}</Text>
            <Text style={{ fontSize: 8, color: colors.textSecondary, marginTop: 2 }}>
              {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>{statutoryRef}</Text>

        {/* Project Information */}
        <View style={s.section}>
          <View style={s.fieldRow}>
            <View style={s.field}>
              <Text style={s.label}>PROJECT</Text>
              <View style={s.underline}><Text style={s.value}>{data.projectName}</Text></View>
            </View>
            <View style={s.field}>
              <Text style={s.label}>PROJECT LOCATION</Text>
              <View style={s.underline}><Text style={s.value}>{data.projectAddress || ''}</Text></View>
            </View>
          </View>
          <View style={s.fieldRow}>
            <View style={s.field}>
              <Text style={s.label}>OWNER</Text>
              <View style={s.underline}><Text style={s.value}>{data.ownerName || ''}</Text></View>
            </View>
            <View style={s.field}>
              <Text style={s.label}>GENERAL CONTRACTOR</Text>
              <View style={s.underline}><Text style={s.value}>{data.contractorName}</Text></View>
            </View>
          </View>
          <View style={s.fieldRow}>
            <View style={s.field}>
              <Text style={s.label}>CLAIMANT (SUBCONTRACTOR)</Text>
              <View style={s.underline}><Text style={s.value}>{data.claimantName}</Text></View>
            </View>
            <View style={s.field}>
              <Text style={s.label}>THROUGH DATE</Text>
              <View style={s.underline}><Text style={s.value}>{fmtDate(data.throughDate)}</Text></View>
            </View>
          </View>
          <View style={s.fieldRow}>
            <View style={s.field}>
              <Text style={s.label}>PAYMENT AMOUNT</Text>
              <View style={s.underline}><Text style={[s.value, s.bold]}>{fmtCurrency(data.amount)}</Text></View>
            </View>
            {!isConditional && data.checkNumber && (
              <View style={s.field}>
                <Text style={s.label}>CHECK / REFERENCE NUMBER</Text>
                <View style={s.underline}><Text style={s.value}>{data.checkNumber}</Text></View>
              </View>
            )}
          </View>
        </View>

        {/* Legal Text */}
        <View style={s.section}>
          <Text style={s.legalText}>{legalText}</Text>
        </View>

        {/* Conditional Notice */}
        {isConditional && (
          <View style={s.notice}>
            <Text style={[s.noticeText, s.bold]}>NOTICE:</Text>
            <Text style={s.noticeText}>
              This document is a CONDITIONAL waiver and release. It is only effective upon receipt and clearance of actual payment. Until payment is received, the claimant retains all lien rights.
            </Text>
          </View>
        )}

        {/* Signature Block */}
        <View style={s.signatureBlock}>
          <View style={s.signatureField}>
            <View style={s.signatureLine} />
            <Text style={s.signatureLabel}>Signature of Claimant</Text>
            <Text style={{ fontSize: 9, marginTop: 4 }}>{data.claimantName}</Text>
          </View>
          <View style={s.signatureField}>
            <View style={s.signatureLine} />
            <Text style={s.signatureLabel}>Date</Text>
            <Text style={{ fontSize: 9, marginTop: 4 }}>{data.signedDate ? fmtDate(data.signedDate) : ''}</Text>
          </View>
        </View>

        <View style={{ marginTop: 24 }}>
          <View style={s.fieldRow}>
            <View style={s.field}>
              <Text style={s.label}>PRINTED NAME</Text>
              <View style={s.underline}><Text style={s.value}>{data.signedBy || ''}</Text></View>
            </View>
            <View style={s.field}>
              <Text style={s.label}>TITLE</Text>
              <View style={s.underline}><Text style={s.value} /></View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generated by SiteSync PM. This document must be signed to be valid.</Text>
        </View>
      </Page>
    </Document>
  )
}

export default LienWaiverPDF
