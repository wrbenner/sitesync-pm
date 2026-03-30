import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { PDFReport, PDFSection } from './PDFTemplate'

interface HealthData {
  overallScore: number
  scheduleScore: number
  budgetScore: number
  qualityScore: number
  safetyScore: number
  rfiResponseDays: number
  punchItemsOpen: number
  crewProductivity: number
}

interface ProjectHealthReportProps {
  projectName: string
  health: HealthData
}

const getScoreColor = (score: number): string => {
  if (score >= 80) return '#2D8A6E'
  if (score >= 60) return '#C4850C'
  return '#C93B3B'
}

const ScoreCard: React.FC<{ label: string; score: number }> = ({ label, score }) => (
  <View style={{ alignItems: 'center', width: '20%' }}>
    <Text style={{ fontSize: 24, fontFamily: 'Helvetica-Bold', color: getScoreColor(score) }}>{score}</Text>
    <Text style={{ fontSize: 8, color: '#5C5550', marginTop: 2 }}>{label}</Text>
  </View>
)

export const ProjectHealthReport: React.FC<ProjectHealthReportProps> = ({ projectName, health }) => {
  const getOverallLabel = (score: number): string => {
    if (score >= 80) return 'Project is on track and performing well across all dimensions.'
    if (score >= 60) return 'Project requires attention in some areas. Review flagged scores below.'
    return 'Project health is critical. Immediate corrective action is recommended.'
  }

  return (
    <PDFReport projectName={projectName} reportTitle="Project Health Report">
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ fontSize: 36, fontFamily: 'Helvetica-Bold', color: getScoreColor(health.overallScore) }}>
          {health.overallScore}
        </Text>
        <Text style={{ fontSize: 10, color: '#5C5550' }}>Overall Health Score</Text>
      </View>

      <PDFSection title="Score Breakdown" />
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20, paddingVertical: 12, backgroundColor: '#FAFAF8', borderRadius: 4 }}>
        <ScoreCard label="Schedule" score={health.scheduleScore} />
        <ScoreCard label="Budget" score={health.budgetScore} />
        <ScoreCard label="Quality" score={health.qualityScore} />
        <ScoreCard label="Safety" score={health.safetyScore} />
      </View>

      <PDFSection title="Key Metrics" />
      <View style={{ flexDirection: 'row', gap: 20, marginBottom: 20 }}>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold' }}>{health.rfiResponseDays}</Text>
          <Text style={{ fontSize: 8, color: '#5C5550' }}>Avg RFI Response (days)</Text>
        </View>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: health.punchItemsOpen > 20 ? '#C93B3B' : '#1A1613' }}>{health.punchItemsOpen}</Text>
          <Text style={{ fontSize: 8, color: '#5C5550' }}>Open Punch Items</Text>
        </View>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold' }}>{health.crewProductivity}%</Text>
          <Text style={{ fontSize: 8, color: '#5C5550' }}>Crew Productivity</Text>
        </View>
      </View>

      <PDFSection title="Summary" />
      <View>
        <Text style={{ fontSize: 9, color: '#1A1613', lineHeight: 1.5 }}>
          {getOverallLabel(health.overallScore)} The schedule dimension scored {health.scheduleScore}, budget scored {health.budgetScore}, quality scored {health.qualityScore}, and safety scored {health.safetyScore}. Average RFI response time is {health.rfiResponseDays} days with {health.punchItemsOpen} open punch items remaining. Crew productivity is currently at {health.crewProductivity}%.
        </Text>
      </View>
    </PDFReport>
  )
}
