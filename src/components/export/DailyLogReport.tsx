import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { PDFReport, PDFTable, PDFSection } from './PDFTemplate'

interface DailyLogEntry {
  date: string
  workers: number
  manHours: number
  incidents: number
  weather: string
  summary: string
}

interface DailyLogReportProps {
  projectName: string
  logs: DailyLogEntry[]
}

export const DailyLogReport: React.FC<DailyLogReportProps> = ({ projectName, logs }) => {
  const totalManHours = logs.reduce((sum, l) => sum + l.manHours, 0)
  const totalIncidents = logs.reduce((sum, l) => sum + l.incidents, 0)
  const avgWorkers = logs.length > 0 ? Math.round(logs.reduce((sum, l) => sum + l.workers, 0) / logs.length) : 0

  return (
    <PDFReport projectName={projectName} reportTitle="Daily Log Report">
      <View style={{ flexDirection: 'row', gap: 20, marginBottom: 16 }}>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold' }}>{logs.length}</Text>
          <Text style={{ fontSize: 8, color: '#5C5550' }}>Log Entries</Text>
        </View>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold' }}>{totalManHours.toLocaleString()}</Text>
          <Text style={{ fontSize: 8, color: '#5C5550' }}>Total Man Hours</Text>
        </View>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold' }}>{avgWorkers}</Text>
          <Text style={{ fontSize: 8, color: '#5C5550' }}>Avg Workers</Text>
        </View>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: totalIncidents > 0 ? '#C93B3B' : '#2D8A6E' }}>{totalIncidents}</Text>
          <Text style={{ fontSize: 8, color: '#5C5550' }}>Incidents</Text>
        </View>
      </View>

      <PDFSection title="Daily Entries" />
      <PDFTable
        columns={[
          { header: 'Date', width: '14%', key: 'date' },
          { header: 'Workers', width: '10%', key: 'workers' },
          { header: 'Man Hours', width: '12%', key: 'manHours' },
          { header: 'Incidents', width: '10%', key: 'incidents' },
          { header: 'Weather', width: '14%', key: 'weather' },
          { header: 'Summary', width: '40%', key: 'summary' },
        ]}
        rows={logs.map(l => ({
          date: l.date,
          workers: String(l.workers),
          manHours: String(l.manHours),
          incidents: String(l.incidents),
          weather: l.weather,
          summary: l.summary,
        }))}
      />
    </PDFReport>
  )
}
