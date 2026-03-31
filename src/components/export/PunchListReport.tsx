import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { colors } from '../../styles/theme'
import { PDFReport, PDFTable, PDFSection } from './PDFTemplate'

interface PunchItem {
  itemNumber: string
  area: string
  description: string
  assigned: string
  priority: string
  status: string
}

interface PunchListReportProps {
  projectName: string
  items: PunchItem[]
}

export const PunchListReport: React.FC<PunchListReportProps> = ({ projectName, items }) => {
  const openCount = items.filter(i => i.status === 'open').length
  const inProgressCount = items.filter(i => i.status === 'in_progress').length
  const completeCount = items.filter(i => i.status === 'complete').length

  return (
    <PDFReport projectName={projectName} reportTitle="Punch List Report">
      <View style={{ flexDirection: 'row', gap: 20, marginBottom: 16 }}>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold' }}>{items.length}</Text>
          <Text style={{ fontSize: 8, color: colors.textSecondary }}>Total Items</Text>
        </View>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: colors.statusCritical }}>{openCount}</Text>
          <Text style={{ fontSize: 8, color: colors.textSecondary }}>Open</Text>
        </View>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: colors.statusPending }}>{inProgressCount}</Text>
          <Text style={{ fontSize: 8, color: colors.textSecondary }}>In Progress</Text>
        </View>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: colors.statusActive }}>{completeCount}</Text>
          <Text style={{ fontSize: 8, color: colors.textSecondary }}>Complete</Text>
        </View>
      </View>

      <PDFSection title="Punch List Items" />
      <PDFTable
        columns={[
          { header: 'Item #', width: '10%', key: 'itemNumber' },
          { header: 'Area', width: '20%', key: 'area' },
          { header: 'Description', width: '28%', key: 'description' },
          { header: 'Assigned', width: '15%', key: 'assigned' },
          { header: 'Priority', width: '12%', key: 'priority' },
          { header: 'Status', width: '15%', key: 'status' },
        ]}
        rows={items.map(item => ({
          itemNumber: item.itemNumber,
          area: item.area,
          description: item.description,
          assigned: item.assigned,
          priority: item.priority,
          status: item.status.replace('_', ' '),
        }))}
      />
    </PDFReport>
  )
}
