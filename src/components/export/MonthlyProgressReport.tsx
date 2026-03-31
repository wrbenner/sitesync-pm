import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { colors } from '../../styles/theme'
import { PDFReport, PDFTable, PDFSection } from './PDFTemplate'

interface MonthlyProgressProps {
  projectName: string
  periodStart: string
  periodEnd: string
  // Schedule
  scheduledProgress: number
  actualProgress: number
  milestonesAchieved: Array<{ name: string; date: string }>
  milestonesUpcoming: Array<{ name: string; date: string }>
  // Budget
  originalContract: number
  changeOrdersNet: number
  currentContract: number
  billedToDate: number
  costToDate: number
  // Manpower
  manpowerByTrade: Array<{ trade: string; headcount: number; hours: number }>
  totalManHours: number
  avgDailyWorkers: number
  // Safety
  incidentsThisPeriod: number
  nearMissesThisPeriod: number
  safetyInspections: number
  trir: number
  // RFIs and Submittals
  rfisOpened: number
  rfisClosed: number
  rfisOverdue: number
  submittalsSubmitted: number
  submittalsApproved: number
  submittalsRejected: number
  // Change Orders
  changeOrders: Array<{ number: string; description: string; amount: number; status: string }>
  // Work performed
  workPerformed: Array<{ area: string; description: string; percentComplete: number }>
}

const fmtCurrency = (n: number) => `$${(n / 1000000).toFixed(2)}M`
const fmtPct = (n: number) => `${n.toFixed(1)}%`

export const MonthlyProgressReport: React.FC<MonthlyProgressProps> = (props) => {

  return (
    <PDFReport projectName={props.projectName} reportTitle={`Monthly Progress Report: ${props.periodStart} to ${props.periodEnd}`}>
      {/* Executive Summary */}
      <PDFSection title="Executive Summary" />
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
        <View style={{ flex: 1, padding: 10, backgroundColor: colors.surfacePage, borderRadius: 4 }}>
          <Text style={{ fontSize: 7, color: colors.textSecondary, marginBottom: 2 }}>Schedule Progress</Text>
          <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold' }}>{fmtPct(props.actualProgress)}</Text>
          <Text style={{ fontSize: 7, color: props.actualProgress >= props.scheduledProgress ? colors.statusActive : colors.statusCritical }}>
            {props.actualProgress >= props.scheduledProgress ? 'Ahead' : 'Behind'} (planned: {fmtPct(props.scheduledProgress)})
          </Text>
        </View>
        <View style={{ flex: 1, padding: 10, backgroundColor: colors.surfacePage, borderRadius: 4 }}>
          <Text style={{ fontSize: 7, color: colors.textSecondary, marginBottom: 2 }}>Contract Value</Text>
          <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold' }}>{fmtCurrency(props.currentContract)}</Text>
          <Text style={{ fontSize: 7, color: colors.textSecondary }}>Original: {fmtCurrency(props.originalContract)}</Text>
        </View>
        <View style={{ flex: 1, padding: 10, backgroundColor: colors.surfacePage, borderRadius: 4 }}>
          <Text style={{ fontSize: 7, color: colors.textSecondary, marginBottom: 2 }}>Cost to Date</Text>
          <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold' }}>{fmtCurrency(props.costToDate)}</Text>
          <Text style={{ fontSize: 7, color: colors.textSecondary }}>Billed: {fmtCurrency(props.billedToDate)}</Text>
        </View>
        <View style={{ flex: 1, padding: 10, backgroundColor: colors.surfacePage, borderRadius: 4 }}>
          <Text style={{ fontSize: 7, color: colors.textSecondary, marginBottom: 2 }}>Safety (TRIR)</Text>
          <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: props.trir <= 2 ? colors.statusActive : colors.statusCritical }}>{props.trir.toFixed(2)}</Text>
          <Text style={{ fontSize: 7, color: colors.textSecondary }}>{props.incidentsThisPeriod} incidents this period</Text>
        </View>
      </View>

      {/* Work Performed */}
      <PDFSection title="Work Performed This Period" />
      <PDFTable
        columns={[
          { header: 'Area / Trade', width: '40%', key: 'area' },
          { header: 'Description', width: '45%', key: 'description' },
          { header: '% Complete', width: '15%', key: 'percent' },
        ]}
        rows={props.workPerformed.map(w => ({ area: w.area, description: w.description, percent: `${w.percentComplete}%` }))}
      />

      {/* Manpower */}
      <PDFSection title="Manpower Summary" />
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 12 }}>
        <View>
          <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold' }}>{props.totalManHours.toLocaleString()}</Text>
          <Text style={{ fontSize: 7, color: colors.textSecondary }}>Total Man Hours</Text>
        </View>
        <View>
          <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold' }}>{props.avgDailyWorkers}</Text>
          <Text style={{ fontSize: 7, color: colors.textSecondary }}>Avg Daily Workers</Text>
        </View>
      </View>
      <PDFTable
        columns={[
          { header: 'Trade', width: '50%', key: 'trade' },
          { header: 'Headcount', width: '25%', key: 'headcount' },
          { header: 'Hours', width: '25%', key: 'hours' },
        ]}
        rows={props.manpowerByTrade.map(m => ({ trade: m.trade, headcount: String(m.headcount), hours: String(m.hours) }))}
      />

      {/* Schedule */}
      <PDFSection title="Schedule Status" />
      <Text style={{ fontSize: 8, marginBottom: 8 }}>Milestones achieved this period:</Text>
      {props.milestonesAchieved.map((m, i) => (
        <Text key={i} style={{ fontSize: 8, color: colors.statusActive, marginBottom: 2 }}>✓ {m.name} ({m.date})</Text>
      ))}
      {props.milestonesUpcoming.length > 0 && (
        <>
          <Text style={{ fontSize: 8, marginTop: 8, marginBottom: 4 }}>Upcoming milestones:</Text>
          {props.milestonesUpcoming.map((m, i) => (
            <Text key={i} style={{ fontSize: 8, color: colors.statusInfo, marginBottom: 2 }}>→ {m.name} ({m.date})</Text>
          ))}
        </>
      )}

      {/* RFI / Submittal Summary */}
      <PDFSection title="RFI and Submittal Status" />
      <View style={{ flexDirection: 'row', gap: 20, marginBottom: 12 }}>
        <View>
          <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>RFIs</Text>
          <Text style={{ fontSize: 7 }}>Opened: {props.rfisOpened} | Closed: {props.rfisClosed} | Overdue: {props.rfisOverdue}</Text>
        </View>
        <View>
          <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>Submittals</Text>
          <Text style={{ fontSize: 7 }}>Submitted: {props.submittalsSubmitted} | Approved: {props.submittalsApproved} | Rejected: {props.submittalsRejected}</Text>
        </View>
      </View>

      {/* Change Orders */}
      {props.changeOrders.length > 0 && (
        <>
          <PDFSection title="Change Order Log" />
          <PDFTable
            columns={[
              { header: 'CO #', width: '10%', key: 'number' },
              { header: 'Description', width: '45%', key: 'description' },
              { header: 'Amount', width: '20%', key: 'amount' },
              { header: 'Status', width: '25%', key: 'status' },
            ]}
            rows={props.changeOrders.map(co => ({ number: co.number, description: co.description, amount: `$${co.amount.toLocaleString()}`, status: co.status }))}
          />
        </>
      )}

      {/* Safety */}
      <PDFSection title="Safety Summary" />
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <View>
          <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold' }}>{props.incidentsThisPeriod}</Text>
          <Text style={{ fontSize: 7, color: colors.textSecondary }}>Recordable Incidents</Text>
        </View>
        <View>
          <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold' }}>{props.nearMissesThisPeriod}</Text>
          <Text style={{ fontSize: 7, color: colors.textSecondary }}>Near Misses</Text>
        </View>
        <View>
          <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold' }}>{props.safetyInspections}</Text>
          <Text style={{ fontSize: 7, color: colors.textSecondary }}>Inspections Completed</Text>
        </View>
        <View>
          <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: props.trir <= 2 ? colors.statusActive : colors.statusCritical }}>{props.trir.toFixed(2)}</Text>
          <Text style={{ fontSize: 7, color: colors.textSecondary }}>TRIR</Text>
        </View>
      </View>
    </PDFReport>
  )
}
