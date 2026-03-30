// Schedule Report PDF: Critical path, 3-week lookahead, milestones, delay analysis
import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { PDFReport, PDFSection, PDFTable } from './PDFTemplate'

const s = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpiBox: { flex: 1, padding: 8, backgroundColor: '#FAFAF8', borderRadius: 4, borderWidth: 0.5, borderColor: '#E5E1DC' },
  kpiLabel: { fontSize: 7, color: '#5C5550', marginBottom: 2 },
  kpiValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1A1613' },
  kpiSub: { fontSize: 7, color: '#9A9490', marginTop: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  legend: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendText: { fontSize: 7, color: '#5C5550' },
})

const STATUS_COLORS: Record<string, string> = {
  achieved: '#2D8A6E', complete: '#2D8A6E',
  in_progress: '#3A7BC8',
  late: '#C93B3B', behind: '#C93B3B',
  upcoming: '#C4850C', not_started: '#9A9490',
  Critical: '#C93B3B', Major: '#C4850C', Minor: '#3A7BC8',
}

interface ScheduleReportProps {
  data: {
    projectName: string
    overallProgress: number
    totalActivities: number
    completedActivities: number
    behindSchedule: number
    criticalPath: Array<{ name: string; startDate: string; endDate: string; status: string; percentComplete: number; isCritical: boolean }>
    lookahead: Array<{ name: string; startDate: string; endDate: string; status: string; assignedTo: string }>
    milestones: Array<{ name: string; plannedDate: string; actualDate: string; status: string; varianceDays: number }>
    delays: Array<{ activity: string; plannedFinish: string; daysLate: number; causeCode: string; responsibleParty: string; impact: string }>
  }
}

export const ScheduleReport: React.FC<ScheduleReportProps> = ({ data }) => {
  return (
    <PDFReport projectName={data.projectName} reportTitle="Schedule Report">
      {/* Summary KPIs */}
      <View style={s.kpiGrid}>
        <View style={s.kpiBox}>
          <Text style={s.kpiLabel}>Overall Progress</Text>
          <Text style={s.kpiValue}>{data.overallProgress}%</Text>
        </View>
        <View style={s.kpiBox}>
          <Text style={s.kpiLabel}>Total Activities</Text>
          <Text style={s.kpiValue}>{data.totalActivities}</Text>
          <Text style={s.kpiSub}>{data.completedActivities} completed</Text>
        </View>
        <View style={s.kpiBox}>
          <Text style={s.kpiLabel}>Behind Schedule</Text>
          <Text style={[s.kpiValue, data.behindSchedule > 0 ? { color: '#C93B3B' } : {}]}>{data.behindSchedule}</Text>
          <Text style={s.kpiSub}>activities delayed</Text>
        </View>
        <View style={s.kpiBox}>
          <Text style={s.kpiLabel}>Critical Path Items</Text>
          <Text style={s.kpiValue}>{data.criticalPath.length}</Text>
        </View>
      </View>

      {/* Critical Path */}
      <PDFSection title="Critical Path Activities" />
      <PDFTable
        columns={[
          { header: 'Activity', width: '32%', key: 'name' },
          { header: 'Start', width: '14%', key: 'start' },
          { header: 'Finish', width: '14%', key: 'finish' },
          { header: 'Status', width: '16%', key: 'status' },
          { header: '% Complete', width: '12%', key: 'pct' },
          { header: 'Float', width: '12%', key: 'float' },
        ]}
        rows={data.criticalPath.map((cp) => ({
          name: cp.name,
          start: cp.startDate,
          finish: cp.endDate,
          status: cp.status.replace(/_/g, ' ').toUpperCase(),
          pct: `${cp.percentComplete}%`,
          float: '0d',
        }))}
      />

      {/* 3-Week Lookahead */}
      {data.lookahead.length > 0 && (
        <>
          <PDFSection title="3 Week Lookahead" />
          <PDFTable
            columns={[
              { header: 'Activity', width: '30%', key: 'name' },
              { header: 'Start', width: '15%', key: 'start' },
              { header: 'Finish', width: '15%', key: 'finish' },
              { header: 'Status', width: '18%', key: 'status' },
              { header: 'Assigned To', width: '22%', key: 'assigned' },
            ]}
            rows={data.lookahead.map((l) => ({
              name: l.name,
              start: l.startDate,
              finish: l.endDate,
              status: l.status.replace(/_/g, ' ').toUpperCase(),
              assigned: l.assignedTo,
            }))}
          />
        </>
      )}

      {/* Milestone Tracker */}
      {data.milestones.length > 0 && (
        <>
          <PDFSection title="Milestone Tracker" />
          <PDFTable
            columns={[
              { header: 'Milestone', width: '30%', key: 'name' },
              { header: 'Planned', width: '16%', key: 'planned' },
              { header: 'Actual', width: '16%', key: 'actual' },
              { header: 'Status', width: '16%', key: 'status' },
              { header: 'Variance', width: '22%', key: 'variance' },
            ]}
            rows={data.milestones.map((m) => ({
              name: m.name,
              planned: m.plannedDate,
              actual: m.actualDate || '',
              status: m.status.toUpperCase(),
              variance: m.varianceDays === 0 ? 'On time' : m.varianceDays > 0 ? `${m.varianceDays}d late` : `${Math.abs(m.varianceDays)}d early`,
            }))}
          />
        </>
      )}

      {/* Delay Analysis */}
      {data.delays.length > 0 && (
        <>
          <PDFSection title="Delay Analysis" />
          <PDFTable
            columns={[
              { header: 'Activity', width: '24%', key: 'activity' },
              { header: 'Planned Finish', width: '14%', key: 'planned' },
              { header: 'Days Late', width: '10%', key: 'days' },
              { header: 'Cause', width: '16%', key: 'cause' },
              { header: 'Responsible', width: '18%', key: 'responsible' },
              { header: 'Impact', width: '18%', key: 'impact' },
            ]}
            rows={data.delays.map((d) => ({
              activity: d.activity,
              planned: d.plannedFinish,
              days: String(d.daysLate),
              cause: d.causeCode,
              responsible: d.responsibleParty,
              impact: d.impact,
            }))}
          />
        </>
      )}
    </PDFReport>
  )
}

export default ScheduleReport
