import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { colors } from '../../styles/theme'
import { PDFReport, PDFTable, PDFSection } from './PDFTemplate'

interface RFIData {
  number: string
  title: string
  priority: string
  status: string
  from: string
  assignedTo: string
  dueDate: string
  createdAt: string
}

interface RFIReportProps {
  projectName: string
  rfis: RFIData[]
}

export const RFIReport: React.FC<RFIReportProps> = ({ projectName, rfis }) => {
  const openCount = rfis.filter(r => r.status === 'open' || r.status === 'under_review' || r.status === 'pending').length
  const closedCount = rfis.filter(r => r.status === 'closed' || r.status === 'answered' || r.status === 'approved').length

  return (
    <PDFReport projectName={projectName} reportTitle="RFI Log">
      <View style={{ flexDirection: 'row', gap: 20, marginBottom: 16 }}>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold' }}>{rfis.length}</Text>
          <Text style={{ fontSize: 8, color: colors.textSecondary }}>Total RFIs</Text>
        </View>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: colors.statusPending }}>{openCount}</Text>
          <Text style={{ fontSize: 8, color: colors.textSecondary }}>Open</Text>
        </View>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: colors.statusActive }}>{closedCount}</Text>
          <Text style={{ fontSize: 8, color: colors.textSecondary }}>Closed</Text>
        </View>
      </View>

      <PDFSection title="RFI Register" />
      <PDFTable
        columns={[
          { header: 'RFI #', width: '10%', key: 'number' },
          { header: 'Title', width: '30%', key: 'title' },
          { header: 'Priority', width: '10%', key: 'priority' },
          { header: 'Status', width: '12%', key: 'status' },
          { header: 'From', width: '15%', key: 'from' },
          { header: 'Due', width: '12%', key: 'dueDate' },
        ]}
        rows={rfis.map(r => ({
          number: r.number,
          title: r.title,
          priority: r.priority,
          status: r.status,
          from: r.from,
          dueDate: r.dueDate,
        }))}
      />
    </PDFReport>
  )
}
