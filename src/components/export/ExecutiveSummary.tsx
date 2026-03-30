import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { PDFReport, PDFTable, PDFSection } from './PDFTemplate'

interface ExecutiveSummaryProps {
  projectName: string
  overallStatus: 'on_track' | 'at_risk' | 'behind'
  progress: number
  budgetTotal: number
  budgetSpent: number
  budgetVariance: number
  milestones: Array<{ name: string; status: string; date: string }>
  risks: Array<{ title: string; severity: string; impact: string }>
  lookahead: Array<{ activity: string; start: string; end: string }>
  openRfis: number
  openSubmittals: number
  openPunchItems: number
  safetyIncidents: number
  daysWithoutIncident: number
}

const fmtCurrency = (n: number) => `$${(n / 1000000).toFixed(1)}M`
const statusColor = (s: string) => s === 'on_track' ? '#2D8A6E' : s === 'at_risk' ? '#C4850C' : '#C93B3B'

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = (props) => {
  return (
    <PDFReport projectName={props.projectName} reportTitle="Executive Summary">
      {/* Status Overview */}
      <View style={{ flexDirection: 'row', gap: 20, marginBottom: 20 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 8, color: '#5C5550', marginBottom: 4 }}>Overall Status</Text>
          <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: statusColor(props.overallStatus) }}>
            {props.overallStatus === 'on_track' ? 'On Track' : props.overallStatus === 'at_risk' ? 'At Risk' : 'Behind Schedule'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 8, color: '#5C5550', marginBottom: 4 }}>Completion</Text>
          <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold' }}>{props.progress}%</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 8, color: '#5C5550', marginBottom: 4 }}>Budget</Text>
          <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold' }}>{fmtCurrency(props.budgetSpent)} / {fmtCurrency(props.budgetTotal)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 8, color: '#5C5550', marginBottom: 4 }}>Safety</Text>
          <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#2D8A6E' }}>{props.daysWithoutIncident} days safe</Text>
        </View>
      </View>

      {/* Key Metrics */}
      <View style={{ flexDirection: 'row', gap: 20, marginBottom: 20, padding: 12, backgroundColor: '#F8F9FA', borderRadius: 4 }}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold' }}>{props.openRfis}</Text>
          <Text style={{ fontSize: 8, color: '#5C5550' }}>Open RFIs</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold' }}>{props.openSubmittals}</Text>
          <Text style={{ fontSize: 8, color: '#5C5550' }}>Open Submittals</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold' }}>{props.openPunchItems}</Text>
          <Text style={{ fontSize: 8, color: '#5C5550' }}>Open Punch Items</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: props.budgetVariance >= 0 ? '#2D8A6E' : '#C93B3B' }}>
            {props.budgetVariance >= 0 ? '+' : ''}{props.budgetVariance.toFixed(1)}%
          </Text>
          <Text style={{ fontSize: 8, color: '#5C5550' }}>Budget Variance</Text>
        </View>
      </View>

      {/* Milestones */}
      <PDFSection title="Key Milestones" />
      <PDFTable
        columns={[
          { header: 'Milestone', width: '50%', key: 'name' },
          { header: 'Status', width: '25%', key: 'status' },
          { header: 'Date', width: '25%', key: 'date' },
        ]}
        rows={props.milestones.map(m => ({ name: m.name, status: m.status, date: m.date }))}
      />

      {/* Risks */}
      {props.risks.length > 0 && (
        <>
          <PDFSection title="Key Risks and Issues" />
          <PDFTable
            columns={[
              { header: 'Risk', width: '50%', key: 'title' },
              { header: 'Severity', width: '20%', key: 'severity' },
              { header: 'Impact', width: '30%', key: 'impact' },
            ]}
            rows={props.risks}
          />
        </>
      )}

      {/* Lookahead */}
      {props.lookahead.length > 0 && (
        <>
          <PDFSection title="Next Period Lookahead" />
          <PDFTable
            columns={[
              { header: 'Activity', width: '50%', key: 'activity' },
              { header: 'Start', width: '25%', key: 'start' },
              { header: 'End', width: '25%', key: 'end' },
            ]}
            rows={props.lookahead}
          />
        </>
      )}
    </PDFReport>
  )
}
