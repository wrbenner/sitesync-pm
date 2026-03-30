import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { PDFReport, PDFTable, PDFSection } from './PDFTemplate'

interface BudgetDivision {
  name: string
  budget: number
  spent: number
  committed: number
  progress: number
}

interface ChangeOrder {
  coNumber: string
  title: string
  amount: number
  status: string
}

interface BudgetReportProps {
  projectName: string
  divisions: BudgetDivision[]
  changeOrders: ChangeOrder[]
  totalBudget: number
  totalSpent: number
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
  return `$${value.toLocaleString()}`
}

export const BudgetReport: React.FC<BudgetReportProps> = ({ projectName, divisions, changeOrders, totalBudget, totalSpent }) => {
  const totalCommitted = divisions.reduce((sum, d) => sum + d.committed, 0)
  const remaining = totalBudget - totalSpent - totalCommitted

  return (
    <PDFReport projectName={projectName} reportTitle="Budget Report">
      <View style={{ flexDirection: 'row', gap: 20, marginBottom: 16 }}>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold' }}>{formatCurrency(totalBudget)}</Text>
          <Text style={{ fontSize: 8, color: '#5C5550' }}>Total Budget</Text>
        </View>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#3A7BC8' }}>{formatCurrency(totalSpent)}</Text>
          <Text style={{ fontSize: 8, color: '#5C5550' }}>Spent</Text>
        </View>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#C4850C' }}>{formatCurrency(totalCommitted)}</Text>
          <Text style={{ fontSize: 8, color: '#5C5550' }}>Committed</Text>
        </View>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#2D8A6E' }}>{formatCurrency(remaining)}</Text>
          <Text style={{ fontSize: 8, color: '#5C5550' }}>Remaining</Text>
        </View>
      </View>

      <PDFSection title="Cost Breakdown by Division" />
      <PDFTable
        columns={[
          { header: 'Division', width: '25%', key: 'name' },
          { header: 'Budget', width: '18%', key: 'budget' },
          { header: 'Spent', width: '18%', key: 'spent' },
          { header: 'Committed', width: '18%', key: 'committed' },
          { header: 'Progress', width: '12%', key: 'progress' },
        ]}
        rows={divisions.map(d => ({
          name: d.name,
          budget: formatCurrency(d.budget),
          spent: formatCurrency(d.spent),
          committed: formatCurrency(d.committed),
          progress: `${d.progress}%`,
        }))}
      />

      <PDFSection title="Change Orders" />
      <PDFTable
        columns={[
          { header: 'CO #', width: '15%', key: 'coNumber' },
          { header: 'Description', width: '45%', key: 'title' },
          { header: 'Amount', width: '20%', key: 'amount' },
          { header: 'Status', width: '20%', key: 'status' },
        ]}
        rows={changeOrders.map(co => ({
          coNumber: co.coNumber,
          title: co.title,
          amount: formatCurrency(co.amount),
          status: co.status.replace('_', ' '),
        }))}
      />
    </PDFReport>
  )
}
