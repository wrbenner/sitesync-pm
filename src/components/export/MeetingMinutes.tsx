import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { PDFReport, PDFTable, PDFSection } from './PDFTemplate'

interface MeetingData {
  title: string
  type: string
  date: string
  location: string
  attendees: string[]
  notes: string
  actionItems: Array<{ description: string; assignedTo: string; dueDate: string; status: string }>
}

interface MeetingMinutesProps {
  projectName: string
  meeting: MeetingData
}

export const MeetingMinutes: React.FC<MeetingMinutesProps> = ({ projectName, meeting }) => {
  return (
    <PDFReport projectName={projectName} reportTitle="Meeting Minutes">
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>{meeting.title}</Text>
        <View style={{ flexDirection: 'row', gap: 24, marginBottom: 4 }}>
          <View>
            <Text style={{ fontSize: 8, color: '#5C5550' }}>Type</Text>
            <Text style={{ fontSize: 10 }}>{meeting.type}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 8, color: '#5C5550' }}>Date</Text>
            <Text style={{ fontSize: 10 }}>{meeting.date}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 8, color: '#5C5550' }}>Location</Text>
            <Text style={{ fontSize: 10 }}>{meeting.location}</Text>
          </View>
        </View>
      </View>

      <PDFSection title="Attendees" />
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 9, color: '#1A1613' }}>{meeting.attendees.join(', ')}</Text>
      </View>

      <PDFSection title="Notes" />
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 9, color: '#1A1613', lineHeight: 1.5 }}>{meeting.notes}</Text>
      </View>

      <PDFSection title="Action Items" />
      <PDFTable
        columns={[
          { header: 'Description', width: '40%', key: 'description' },
          { header: 'Assigned To', width: '20%', key: 'assignedTo' },
          { header: 'Due Date', width: '20%', key: 'dueDate' },
          { header: 'Status', width: '20%', key: 'status' },
        ]}
        rows={meeting.actionItems.map(item => ({
          description: item.description,
          assignedTo: item.assignedTo,
          dueDate: item.dueDate,
          status: item.status,
        }))}
      />
    </PDFReport>
  )
}
