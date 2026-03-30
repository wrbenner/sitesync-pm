import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { PDFReport, PDFTable, PDFSection } from './PDFTemplate'

interface SubmittalData {
  number: string
  title: string
  specSection: string
  subcontractor: string
  status: string
  revision: number
  leadTime: string
  dueDate: string
}

interface SubmittalLogProps {
  projectName: string
  submittals: SubmittalData[]
}

export const SubmittalLog: React.FC<SubmittalLogProps> = ({ projectName, submittals }) => {
  const pendingCount = submittals.filter(s => s.status === 'pending' || s.status === 'under_review' || s.status === 'submitted').length
  const approvedCount = submittals.filter(s => s.status === 'approved' || s.status === 'approved_as_noted').length
  const rejectedCount = submittals.filter(s => s.status === 'rejected' || s.status === 'revise_resubmit').length

  return (
    <PDFReport projectName={projectName} reportTitle="Submittal Log">
      <View style={{ flexDirection: 'row', gap: 20, marginBottom: 16 }}>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold' }}>{submittals.length}</Text>
          <Text style={{ fontSize: 8, color: '#5C5550' }}>Total Submittals</Text>
        </View>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#C4850C' }}>{pendingCount}</Text>
          <Text style={{ fontSize: 8, color: '#5C5550' }}>Pending</Text>
        </View>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#2D8A6E' }}>{approvedCount}</Text>
          <Text style={{ fontSize: 8, color: '#5C5550' }}>Approved</Text>
        </View>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#C93B3B' }}>{rejectedCount}</Text>
          <Text style={{ fontSize: 8, color: '#5C5550' }}>Rejected</Text>
        </View>
      </View>

      <PDFSection title="Submittal Register" />
      <PDFTable
        columns={[
          { header: 'Sub #', width: '8%', key: 'number' },
          { header: 'Title', width: '22%', key: 'title' },
          { header: 'Spec Section', width: '12%', key: 'specSection' },
          { header: 'Subcontractor', width: '16%', key: 'subcontractor' },
          { header: 'Status', width: '12%', key: 'status' },
          { header: 'Rev', width: '6%', key: 'revision' },
          { header: 'Lead Time', width: '12%', key: 'leadTime' },
          { header: 'Due', width: '12%', key: 'dueDate' },
        ]}
        rows={submittals.map(s => ({
          number: s.number,
          title: s.title,
          specSection: s.specSection,
          subcontractor: s.subcontractor,
          status: s.status,
          revision: String(s.revision),
          leadTime: s.leadTime,
          dueDate: s.dueDate,
        }))}
      />
    </PDFReport>
  )
}
