// Subcontractor Performance Report PDF
// RFI response times, submittal rejection rates, punch closure rates by subcontractor
import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { PDFReport, PDFSection, PDFTable } from './PDFTemplate'

const s = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpiBox: { flex: 1, padding: 8, backgroundColor: '#FAFAF8', borderRadius: 4, borderWidth: 0.5, borderColor: '#E5E1DC' },
  kpiLabel: { fontSize: 7, color: '#5C5550', marginBottom: 2 },
  kpiValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1A1613' },
  kpiSub: { fontSize: 7, color: '#9A9490', marginTop: 1 },
  scorecard: { marginBottom: 16 },
  subName: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0C0D0F', marginBottom: 4, marginTop: 12 },
  metricsRow: { flexDirection: 'row', gap: 6 },
  metricCell: { flex: 1, padding: 6, backgroundColor: '#F3EFEC', borderRadius: 3 },
  metricLabel: { fontSize: 6, color: '#5C5550' },
  metricValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1A1613', marginTop: 1 },
})

interface SubcontractorReportProps {
  data: {
    projectName: string
    totalSubs: number
    avgRFIResponseDays: number
    avgSubmittalRejectionRate: number
    avgPunchClosureRate: number
    subcontractors: Array<{
      name: string
      rfiCount: number
      avgRFIResponseDays: number | null
      submittalCount: number
      submittalRejectionRate: number
      punchCount: number
      punchClosureRate: number
    }>
  }
}

export const SubcontractorReport: React.FC<SubcontractorReportProps> = ({ data }) => {
  return (
    <PDFReport projectName={data.projectName} reportTitle="Subcontractor Performance">
      {/* Summary KPIs */}
      <View style={s.kpiGrid}>
        <View style={s.kpiBox}>
          <Text style={s.kpiLabel}>Total Subcontractors</Text>
          <Text style={s.kpiValue}>{data.totalSubs}</Text>
        </View>
        <View style={s.kpiBox}>
          <Text style={s.kpiLabel}>Avg RFI Response</Text>
          <Text style={s.kpiValue}>{data.avgRFIResponseDays}d</Text>
          <Text style={s.kpiSub}>across all subs</Text>
        </View>
        <View style={s.kpiBox}>
          <Text style={s.kpiLabel}>Avg Submittal Rejection</Text>
          <Text style={[s.kpiValue, data.avgSubmittalRejectionRate > 25 ? { color: '#C93B3B' } : {}]}>
            {data.avgSubmittalRejectionRate}%
          </Text>
        </View>
        <View style={s.kpiBox}>
          <Text style={s.kpiLabel}>Avg Punch Closure</Text>
          <Text style={[s.kpiValue, data.avgPunchClosureRate < 70 ? { color: '#C4850C' } : { color: '#2D8A6E' }]}>
            {data.avgPunchClosureRate}%
          </Text>
        </View>
      </View>

      {/* Performance Table */}
      <PDFSection title="Performance by Subcontractor" />
      <PDFTable
        columns={[
          { header: 'Subcontractor', width: '22%', key: 'name' },
          { header: 'RFIs', width: '8%', key: 'rfis' },
          { header: 'Avg Response', width: '12%', key: 'rfiResponse' },
          { header: 'Submittals', width: '10%', key: 'submittals' },
          { header: 'Rejection Rate', width: '14%', key: 'rejectionRate' },
          { header: 'Punch Items', width: '12%', key: 'punch' },
          { header: 'Closure Rate', width: '12%', key: 'closureRate' },
          { header: 'Score', width: '10%', key: 'score' },
        ]}
        rows={data.subcontractors.map((sub) => {
          // Composite score: lower RFI response = better, lower rejection = better, higher closure = better
          const rfiScore = sub.avgRFIResponseDays !== null ? Math.max(0, 100 - sub.avgRFIResponseDays * 5) : 50
          const rejScore = Math.max(0, 100 - sub.submittalRejectionRate * 2)
          const closureScore = sub.punchClosureRate
          const composite = Math.round((rfiScore + rejScore + closureScore) / 3)

          return {
            name: sub.name,
            rfis: String(sub.rfiCount),
            rfiResponse: sub.avgRFIResponseDays !== null ? `${sub.avgRFIResponseDays}d` : 'N/A',
            submittals: String(sub.submittalCount),
            rejectionRate: `${sub.submittalRejectionRate}%`,
            punch: String(sub.punchCount),
            closureRate: `${sub.punchClosureRate}%`,
            score: `${composite}/100`,
          }
        })}
      />

      {/* Individual Scorecards (top 8) */}
      {data.subcontractors.slice(0, 8).map((sub) => (
        <View key={sub.name} style={s.scorecard} wrap={false}>
          <Text style={s.subName}>{sub.name}</Text>
          <View style={s.metricsRow}>
            <View style={s.metricCell}>
              <Text style={s.metricLabel}>RFI Count</Text>
              <Text style={s.metricValue}>{sub.rfiCount}</Text>
            </View>
            <View style={s.metricCell}>
              <Text style={s.metricLabel}>Avg RFI Response</Text>
              <Text style={s.metricValue}>{sub.avgRFIResponseDays !== null ? `${sub.avgRFIResponseDays} days` : 'N/A'}</Text>
            </View>
            <View style={s.metricCell}>
              <Text style={s.metricLabel}>Submittals</Text>
              <Text style={s.metricValue}>{sub.submittalCount}</Text>
            </View>
            <View style={s.metricCell}>
              <Text style={s.metricLabel}>Rejection Rate</Text>
              <Text style={[s.metricValue, sub.submittalRejectionRate > 25 ? { color: '#C93B3B' } : {}]}>
                {sub.submittalRejectionRate}%
              </Text>
            </View>
            <View style={s.metricCell}>
              <Text style={s.metricLabel}>Punch Items</Text>
              <Text style={s.metricValue}>{sub.punchCount}</Text>
            </View>
            <View style={s.metricCell}>
              <Text style={s.metricLabel}>Closure Rate</Text>
              <Text style={[s.metricValue, sub.punchClosureRate >= 80 ? { color: '#2D8A6E' } : sub.punchClosureRate >= 50 ? { color: '#C4850C' } : { color: '#C93B3B' }]}>
                {sub.punchClosureRate}%
              </Text>
            </View>
          </View>
        </View>
      ))}
    </PDFReport>
  )
}

export default SubcontractorReport
