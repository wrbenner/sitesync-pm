// Daily Log PDF Export
// Industry-standard construction daily report format.
// Covers all 8 field groups: crew, equipment, materials, work, safety, visitors, incidents, notes.

import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { vizColors } from '../../styles/theme'

// ── Types ────────────────────────────────────────────────

export interface DailyLogPDFData {
  // Header
  projectName: string
  projectAddress?: string
  contractorName?: string
  logDate: string
  preparedBy?: string
  logNumber?: string

  // Metrics
  workers_onsite: number
  total_hours: number
  incidents: number
  weather: string
  weather_am?: string
  weather_pm?: string
  temperature_high?: number
  temperature_low?: number
  wind_speed?: string
  precipitation?: string

  // Submission
  is_submitted: boolean
  submitted_at: string | null
  status: string

  // Field groups
  crew_entries: Array<{ company: string; trade: string; headcount: number; hours: number }>
  equipment_entries: Array<{ type: string; count: number; hours_operated: number }>
  material_deliveries: Array<{ description: string; quantity: number; po_reference: string; delivery_ticket: string }>
  workPerformed?: string
  safety_observations?: string
  toolbox_talk_topic?: string
  visitors: Array<{ name: string; company: string; purpose: string; time_in: string; time_out: string }>
  incident_details: Array<{ description: string; type: string; corrective_action: string }>
  notes?: string

  // Signatures
  superintendent_signature_url?: string | null
  manager_signature_url?: string | null
}

// ── Styles ───────────────────────────────────────────────

const ORANGE = '#F47820'
const NAVY   = '#0F1629'
const GRAY   = '#6B7280'
const LGRAY  = '#F3F4F6'
const BORDER = '#E5E7EB'

const s = StyleSheet.create({
  page:        { padding: 40, fontSize: 9, fontFamily: 'Helvetica', color: vizColors.darkText, lineHeight: 1.5 },

  // Header
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: NAVY },
  logo:        { fontSize: 13, fontFamily: 'Helvetica-Bold', color: NAVY },
  logoSub:     { fontSize: 8, color: GRAY, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  docTitle:    { fontSize: 14, fontFamily: 'Helvetica-Bold', color: NAVY },
  docMeta:     { fontSize: 8, color: GRAY, marginTop: 2 },

  // Section
  section:     { marginBottom: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: BORDER },
  sectionTitle:{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionBadge:{ marginLeft: 8, fontSize: 8, color: GRAY },

  // Metrics row
  metricsRow:  { flexDirection: 'row', gap: 8, marginBottom: 14 },
  metricBox:   { flex: 1, padding: 10, backgroundColor: LGRAY, borderRadius: 4 },
  metricLabel: { fontSize: 7, color: GRAY, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  metricValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: NAVY },

  // Tables
  tableHeader: { flexDirection: 'row', backgroundColor: NAVY, padding: '5 8', borderRadius: '2 2 0 0' },
  tableRow:    { flexDirection: 'row', padding: '5 8', borderBottomWidth: 0.5, borderBottomColor: BORDER },
  tableRowAlt: { flexDirection: 'row', padding: '5 8', backgroundColor: LGRAY, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  thCell:      { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.4 },
  tdCell:      { fontSize: 8, color: vizColors.darkText },
  tdCellLight: { fontSize: 8, color: GRAY },

  // Text blocks
  textBlock:   { padding: 10, backgroundColor: LGRAY, borderRadius: 4, fontSize: 9, lineHeight: 1.6, color: vizColors.darkText },
  label:       { fontSize: 7, color: GRAY, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },

  // Incident
  incidentBox: { padding: 10, backgroundColor: '#FEF2F2', borderRadius: 4, borderLeftWidth: 3, borderLeftColor: '#DC2626', marginBottom: 6 },
  incidentType:{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#DC2626', textTransform: 'uppercase', marginBottom: 3 },
  incidentText:{ fontSize: 8, color: vizColors.darkText, lineHeight: 1.5 },

  // Status banner
  statusBanner:{ flexDirection: 'row', alignItems: 'center', padding: '6 10', borderRadius: 4, marginBottom: 14 },
  statusText:  { fontSize: 8, fontFamily: 'Helvetica-Bold' },
  statusSub:   { fontSize: 7, marginLeft: 8 },

  // Signature
  sigRow:      { flexDirection: 'row', gap: 32, marginTop: 32 },
  sigBlock:    { flex: 1 },
  sigLine:     { borderBottomWidth: 1, borderBottomColor: NAVY, marginTop: 36, marginBottom: 4 },
  sigLabel:    { fontSize: 7, color: GRAY },

  // Footer
  footer:      { position: 'absolute', bottom: 24, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  footerText:  { fontSize: 7, color: GRAY },
})

// ── Helpers ──────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso
  }
}

function formatTime(iso: string): string {
  if (!iso) return ''
  try {
    if (iso.includes('T')) return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    return iso
  } catch {
    return iso
  }
}

const INCIDENT_LABELS: Record<string, string> = {
  near_miss: 'Near Miss',
  first_aid: 'First Aid',
  recordable: 'Recordable Injury',
  property_damage: 'Property Damage',
  environmental: 'Environmental',
}

// ── Component ────────────────────────────────────────────

export const DailyLogPDF: React.FC<{ data: DailyLogPDFData }> = ({ data }) => {
  const totalCrewHeadcount = data.crew_entries.reduce((s, e) => s + e.headcount, 0)
  const totalCrewHours     = data.crew_entries.reduce((s, e) => s + e.hours, 0)

  const submittedStr = data.submitted_at
    ? `Submitted ${new Date(data.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : ''

  const isApproved = data.status === 'approved'
  const isSubmitted = data.is_submitted || data.status === 'submitted'

  return (
    <Document>
      <Page size="LETTER" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.logo}>SiteSync PM</Text>
            <Text style={s.logoSub}>{data.contractorName ?? 'General Contractor'}</Text>
            {data.projectAddress && <Text style={s.logoSub}>{data.projectAddress}</Text>}
          </View>
          <View style={s.headerRight}>
            <Text style={s.docTitle}>Daily Construction Report</Text>
            <Text style={s.docMeta}>{formatDate(data.logDate)}</Text>
            {data.logNumber && <Text style={s.docMeta}>Log No. {data.logNumber}</Text>}
            {data.preparedBy && <Text style={s.docMeta}>Prepared by: {data.preparedBy}</Text>}
          </View>
        </View>

        {/* ── Project Info ── */}
        <View style={s.section}>
          <View style={s.sectionHead}><Text style={s.sectionTitle}>Project</Text></View>
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 2 }}>{data.projectName}</Text>
          {data.projectAddress && <Text style={{ fontSize: 8, color: GRAY }}>{data.projectAddress}</Text>}
        </View>

        {/* ── Status Banner ── */}
        {(isSubmitted || isApproved) && (
          <View style={[s.statusBanner, { backgroundColor: isApproved ? '#F0FDF4' : '#EFF6FF', borderLeftWidth: 3, borderLeftColor: isApproved ? '#16A34A' : '#2563EB' }]}>
            <Text style={[s.statusText, { color: isApproved ? '#16A34A' : '#2563EB' }]}>
              {isApproved ? 'APPROVED' : 'SUBMITTED'}
            </Text>
            {submittedStr && <Text style={[s.statusSub, { color: GRAY }]}>{submittedStr}</Text>}
          </View>
        )}

        {/* ── Key Metrics ── */}
        <View style={s.metricsRow}>
          <View style={s.metricBox}>
            <Text style={s.metricLabel}>Workers Onsite</Text>
            <Text style={s.metricValue}>{data.workers_onsite}</Text>
          </View>
          <View style={s.metricBox}>
            <Text style={s.metricLabel}>Total Man Hours</Text>
            <Text style={s.metricValue}>{data.total_hours.toLocaleString()}</Text>
          </View>
          <View style={s.metricBox}>
            <Text style={s.metricLabel}>Incidents</Text>
            <Text style={[s.metricValue, { color: data.incidents > 0 ? '#DC2626' : '#16A34A' }]}>{data.incidents}</Text>
          </View>
          <View style={s.metricBox}>
            <Text style={s.metricLabel}>Weather</Text>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY, marginTop: 2 }}>{data.weather}</Text>
            {(data.temperature_high != null || data.temperature_low != null) && (
              <Text style={{ fontSize: 8, color: GRAY, marginTop: 1 }}>
                {data.temperature_high != null ? `${data.temperature_high}F` : ''}{data.temperature_low != null ? ` / ${data.temperature_low}F` : ''}
                {data.wind_speed ? `  Wind ${data.wind_speed}` : ''}
              </Text>
            )}
          </View>
        </View>

        {/* ── Crew Entries ── */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Crew Entries</Text>
            <Text style={s.sectionBadge}>{totalCrewHeadcount} workers · {totalCrewHours} hours</Text>
          </View>
          {data.crew_entries.length > 0 ? (
            <View>
              <View style={s.tableHeader}>
                <Text style={[s.thCell, { flex: 2 }]}>Company</Text>
                <Text style={[s.thCell, { flex: 2 }]}>Trade</Text>
                <Text style={[s.thCell, { flex: 1, textAlign: 'right' }]}>Headcount</Text>
                <Text style={[s.thCell, { flex: 1, textAlign: 'right' }]}>Hours</Text>
                <Text style={[s.thCell, { flex: 1, textAlign: 'right' }]}>Man Hours</Text>
              </View>
              {data.crew_entries.map((e, i) => (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.tdCell, { flex: 2 }]}>{e.company || '—'}</Text>
                  <Text style={[s.tdCell, { flex: 2 }]}>{e.trade}</Text>
                  <Text style={[s.tdCellLight, { flex: 1, textAlign: 'right' }]}>{e.headcount}</Text>
                  <Text style={[s.tdCellLight, { flex: 1, textAlign: 'right' }]}>{e.hours}</Text>
                  <Text style={[s.tdCell, { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{e.headcount * e.hours}</Text>
                </View>
              ))}
              <View style={[s.tableRow, { backgroundColor: '#EFF6FF' }]}>
                <Text style={[s.thCell, { flex: 4, color: NAVY }]}>TOTAL</Text>
                <Text style={[s.thCell, { flex: 1, textAlign: 'right', color: NAVY }]}>{totalCrewHeadcount}</Text>
                <Text style={[s.thCell, { flex: 1, textAlign: 'right', color: NAVY }]}>{totalCrewHours}</Text>
                <Text style={[s.thCell, { flex: 1, textAlign: 'right', color: ORANGE }]}>{data.crew_entries.reduce((s, e) => s + e.headcount * e.hours, 0)}</Text>
              </View>
            </View>
          ) : (
            <Text style={s.textBlock}>No crew entries recorded.</Text>
          )}
        </View>

        {/* ── Equipment ── */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Equipment on Site</Text>
            <Text style={s.sectionBadge}>{data.equipment_entries.length} items</Text>
          </View>
          {data.equipment_entries.length > 0 ? (
            <View>
              <View style={s.tableHeader}>
                <Text style={[s.thCell, { flex: 3 }]}>Equipment Type</Text>
                <Text style={[s.thCell, { flex: 1, textAlign: 'right' }]}>Quantity</Text>
                <Text style={[s.thCell, { flex: 1, textAlign: 'right' }]}>Hours Operated</Text>
              </View>
              {data.equipment_entries.map((e, i) => (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.tdCell, { flex: 3 }]}>{e.type}</Text>
                  <Text style={[s.tdCellLight, { flex: 1, textAlign: 'right' }]}>{e.count}</Text>
                  <Text style={[s.tdCellLight, { flex: 1, textAlign: 'right' }]}>{e.hours_operated}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={s.textBlock}>No equipment logged.</Text>
          )}
        </View>

        {/* ── Material Deliveries ── */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Material Deliveries</Text>
            <Text style={s.sectionBadge}>{data.material_deliveries.length} deliveries</Text>
          </View>
          {data.material_deliveries.length > 0 ? (
            <View>
              <View style={s.tableHeader}>
                <Text style={[s.thCell, { flex: 3 }]}>Description</Text>
                <Text style={[s.thCell, { flex: 1, textAlign: 'right' }]}>Qty</Text>
                <Text style={[s.thCell, { flex: 1.5 }]}>PO Reference</Text>
                <Text style={[s.thCell, { flex: 1.5 }]}>Delivery Ticket</Text>
              </View>
              {data.material_deliveries.map((d, i) => (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.tdCell, { flex: 3 }]}>{d.description}</Text>
                  <Text style={[s.tdCellLight, { flex: 1, textAlign: 'right' }]}>{d.quantity || '—'}</Text>
                  <Text style={[s.tdCellLight, { flex: 1.5 }]}>{d.po_reference || '—'}</Text>
                  <Text style={[s.tdCellLight, { flex: 1.5 }]}>{d.delivery_ticket || '—'}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={s.textBlock}>No material deliveries recorded.</Text>
          )}
        </View>

        {/* ── Work Performed ── */}
        {data.workPerformed && (
          <View style={s.section}>
            <View style={s.sectionHead}><Text style={s.sectionTitle}>Work Performed</Text></View>
            <Text style={s.textBlock}>{data.workPerformed}</Text>
          </View>
        )}

        {/* ── Safety ── */}
        <View style={s.section}>
          <View style={s.sectionHead}><Text style={s.sectionTitle}>Safety</Text></View>
          {data.toolbox_talk_topic ? (
            <View style={{ marginBottom: 6 }}>
              <Text style={s.label}>Toolbox Talk Topic</Text>
              <Text style={[s.textBlock, { marginBottom: 8 }]}>{data.toolbox_talk_topic}</Text>
            </View>
          ) : null}
          <Text style={s.label}>Safety Observations</Text>
          <Text style={s.textBlock}>{data.safety_observations || 'No safety observations recorded.'}</Text>
        </View>

        {/* ── Visitors ── */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Site Visitors</Text>
            <Text style={s.sectionBadge}>{data.visitors.length} visitors</Text>
          </View>
          {data.visitors.length > 0 ? (
            <View>
              <View style={s.tableHeader}>
                <Text style={[s.thCell, { flex: 2 }]}>Name</Text>
                <Text style={[s.thCell, { flex: 2 }]}>Company</Text>
                <Text style={[s.thCell, { flex: 2 }]}>Purpose</Text>
                <Text style={[s.thCell, { flex: 1 }]}>Time In</Text>
                <Text style={[s.thCell, { flex: 1 }]}>Time Out</Text>
              </View>
              {data.visitors.map((v, i) => (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.tdCell, { flex: 2 }]}>{v.name}</Text>
                  <Text style={[s.tdCellLight, { flex: 2 }]}>{v.company || '—'}</Text>
                  <Text style={[s.tdCellLight, { flex: 2 }]}>{v.purpose || '—'}</Text>
                  <Text style={[s.tdCellLight, { flex: 1 }]}>{formatTime(v.time_in) || '—'}</Text>
                  <Text style={[s.tdCellLight, { flex: 1 }]}>{formatTime(v.time_out) || '—'}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={s.textBlock}>No visitors recorded.</Text>
          )}
        </View>

        {/* ── Incidents ── */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Incident Log</Text>
            <Text style={s.sectionBadge}>{data.incidents} incident{data.incidents !== 1 ? 's' : ''}</Text>
          </View>
          {data.incident_details.length > 0 ? (
            data.incident_details.map((inc, i) => (
              <View key={i} style={s.incidentBox}>
                <Text style={s.incidentType}>{INCIDENT_LABELS[inc.type] ?? inc.type}</Text>
                <Text style={s.incidentText}>{inc.description}</Text>
                {inc.corrective_action ? (
                  <Text style={[s.incidentText, { marginTop: 4, color: GRAY }]}>
                    Corrective action: {inc.corrective_action}
                  </Text>
                ) : null}
              </View>
            ))
          ) : (
            <View style={[s.textBlock, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
              <Text style={{ color: '#16A34A', fontFamily: 'Helvetica-Bold', fontSize: 9 }}>No incidents recorded.</Text>
              <Text style={{ color: GRAY, fontSize: 8 }}>Zero incident day.</Text>
            </View>
          )}
        </View>

        {/* ── Notes ── */}
        {data.notes && (
          <View style={s.section}>
            <View style={s.sectionHead}><Text style={s.sectionTitle}>Additional Notes</Text></View>
            <Text style={s.textBlock}>{data.notes}</Text>
          </View>
        )}

        {/* ── Signatures ── */}
        <View style={s.sigRow}>
          <View style={s.sigBlock}>
            <View style={s.sigLine} />
            <Text style={s.sigLabel}>Superintendent Signature</Text>
            <Text style={[s.sigLabel, { marginTop: 2 }]}>Date: _______________</Text>
          </View>
          <View style={s.sigBlock}>
            <View style={s.sigLine} />
            <Text style={s.sigLabel}>Project Manager Signature</Text>
            <Text style={[s.sigLabel, { marginTop: 2 }]}>Date: _______________</Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>SiteSync PM  |  {data.projectName}  |  Daily Report {formatDate(data.logDate)}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
