// Subcontractor Performance Report PDF
// RFI response times, submittal rejection rates, punch closure rates by subcontractor
import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { colors, vizColors } from '../../styles/theme'
import { PDFReport, PDFSection, PDFTable } from './PDFTemplate'

const s = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpiBox: { flex: 1, padding: 8, backgroundColor: colors.surfacePage, borderRadius: 4, borderWidth: 0.5, borderColor: colors.borderDefault },
  kpiLabel: { fontSize: 7, color: colors.textSecondary, marginBottom: 2 },
  kpiValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: vizColors.darkText },
  kpiSub: { fontSize: 7, color: colors.textTertiary, marginTop: 1 },
  scorecard: { marginBottom: 16 },
  subName: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: colors.darkNavy, marginBottom: 4, marginTop: 12 },
  metricsRow: { flexDirection: 'row', gap: 6 },
  metricCell: { flex: 1, padding: 6, backgroundColor: colors.surfaceInset, borderRadius: 3 },
  metricLabel: { fontSize: 6, color: colors.textSecondary },
  metricValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: vizColors.darkText, marginTop: 1 },
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
          <Text style={[s.kpiValue, data.avgSubmittalRejectionRate > 25 ? { color: colors.statusCritical } : {}]}>
            {data.avgSubmittalRejectionRate}%
          </Text>
        </View>
        <View style={s.kpiBox}>
          <Text style={s.kpiLabel}>Avg Punch Closure</Text>
          <Text style={[s.kpiValue, data.avgPunchClosureRate < 70 ? { color: colors.statusPending } : { color: colors.statusActive }]}>
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
              <Text style={[s.metricValue, sub.submittalRejectionRate > 25 ? { color: colors.statusCritical } : {}]}>
                {sub.submittalRejectionRate}%
              </Text>
            </View>
            <View style={s.metricCell}>
              <Text style={s.metricLabel}>Punch Items</Text>
              <Text style={s.metricValue}>{sub.punchCount}</Text>
            </View>
            <View style={s.metricCell}>
              <Text style={s.metricLabel}>Closure Rate</Text>
              <Text style={[s.metricValue, sub.punchClosureRate >= 80 ? { color: colors.statusActive } : sub.punchClosureRate >= 50 ? { color: colors.statusPending } : { color: colors.statusCritical }]}>
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
