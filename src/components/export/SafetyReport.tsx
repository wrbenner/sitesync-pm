import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { PDFReport, PDFTable, PDFSection } from './PDFTemplate'

interface SafetyReportProps {
  projectName: string
  periodStart: string
  periodEnd: string
  trir: number
  emr: number
  daysSinceIncident: number
  totalManHours: number
  incidents: Array<{ date: string; type: string; severity: string; description: string; status: string }>
  inspections: Array<{ date: string; type: string; area: string; score: number; status: string }>
  openCorrectiveActions: number
  expiringCertifications: Array<{ worker: string; certType: string; expiresDate: string }>
  toolboxTalks: Array<{ date: string; topic: string; attendees: number }>
}

export const SafetyReport: React.FC<SafetyReportProps> = (props) => {
  return (
    <PDFReport projectName={props.projectName} reportTitle={`Safety Report: ${props.periodStart} to ${props.periodEnd}`}>
      {/* KPIs */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 20 }}>
        <View style={{ flex: 1, padding: 10, backgroundColor: '#F8F9FA', borderRadius: 4, alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: props.daysSinceIncident > 30 ? '#2D8A6E' : '#C4850C' }}>{props.daysSinceIncident}</Text>
          <Text style={{ fontSize: 7, color: '#5C5550' }}>Days Without Incident</Text>
        </View>
        <View style={{ flex: 1, padding: 10, backgroundColor: '#F8F9FA', borderRadius: 4, alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: props.trir <= 2 ? '#2D8A6E' : '#C93B3B' }}>{props.trir.toFixed(2)}</Text>
          <Text style={{ fontSize: 7, color: '#5C5550' }}>TRIR</Text>
        </View>
        <View style={{ flex: 1, padding: 10, backgroundColor: '#F8F9FA', borderRadius: 4, alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold' }}>{props.emr.toFixed(2)}</Text>
          <Text style={{ fontSize: 7, color: '#5C5550' }}>EMR</Text>
        </View>
        <View style={{ flex: 1, padding: 10, backgroundColor: '#F8F9FA', borderRadius: 4, alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold' }}>{props.openCorrectiveActions}</Text>
          <Text style={{ fontSize: 7, color: '#5C5550' }}>Open Corrective Actions</Text>
        </View>
      </View>

      {/* Incidents */}
      <PDFSection title="Incident Log" />
      {props.incidents.length === 0 ? (
        <Text style={{ fontSize: 8, color: '#2D8A6E', marginBottom: 12 }}>No recordable incidents this period.</Text>
      ) : (
        <PDFTable
          columns={[
            { header: 'Date', width: '15%', key: 'date' },
            { header: 'Type', width: '15%', key: 'type' },
            { header: 'Severity', width: '15%', key: 'severity' },
            { header: 'Description', width: '40%', key: 'description' },
            { header: 'Status', width: '15%', key: 'status' },
          ]}
          rows={props.incidents}
        />
      )}

      {/* Inspections */}
      <PDFSection title="Inspections Conducted" />
      <PDFTable
        columns={[
          { header: 'Date', width: '15%', key: 'date' },
          { header: 'Type', width: '25%', key: 'type' },
          { header: 'Area', width: '25%', key: 'area' },
          { header: 'Score', width: '15%', key: 'score' },
          { header: 'Result', width: '20%', key: 'status' },
        ]}
        rows={props.inspections.map(i => ({ ...i, score: `${i.score}%` }))}
      />

      {/* Toolbox Talks */}
      {props.toolboxTalks.length > 0 && (
        <>
          <PDFSection title="Toolbox Talks" />
          <PDFTable
            columns={[
              { header: 'Date', width: '20%', key: 'date' },
              { header: 'Topic', width: '55%', key: 'topic' },
              { header: 'Attendees', width: '25%', key: 'attendees' },
            ]}
            rows={props.toolboxTalks.map(t => ({ ...t, attendees: String(t.attendees) }))}
          />
        </>
      )}

      {/* Expiring Certifications */}
      {props.expiringCertifications.length > 0 && (
        <>
          <PDFSection title="Certifications Expiring Within 60 Days" />
          <PDFTable
            columns={[
              { header: 'Worker', width: '35%', key: 'worker' },
              { header: 'Certification', width: '35%', key: 'certType' },
              { header: 'Expires', width: '30%', key: 'expiresDate' },
            ]}
            rows={props.expiringCertifications}
          />
        </>
      )}
    </PDFReport>
  )
}
