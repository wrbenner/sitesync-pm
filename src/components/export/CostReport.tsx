// Cost Report PDF: Budget vs actual by cost code, earned value analysis, contingency burn
import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { vizColors } from '../../styles/theme'
import { PDFReport, PDFSection, PDFTable, pdfStyles } from './PDFTemplate'

const s = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  kpiBox: { width: '23%', padding: 8, backgroundColor: '#FAFAF8', borderRadius: 4, borderWidth: 0.5, borderColor: '#E5E1DC' },
  kpiLabel: { fontSize: 7, color: '#5C5550', marginBottom: 2 },
  kpiValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: vizColors.darkText },
  kpiSub: { fontSize: 7, color: '#9A9490', marginTop: 1 },
  evGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  evBox: { width: '15%', padding: 6, backgroundColor: '#F3EFEC', borderRadius: 3 },
  evLabel: { fontSize: 6, color: '#5C5550', marginBottom: 1 },
  evValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: vizColors.darkText },
  progressBar: { height: 6, backgroundColor: '#E5E1DC', borderRadius: 3, marginTop: 4, marginBottom: 8 },
  progressFill: { height: 6, borderRadius: 3 },
})

function fmtCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function fmtIndex(n: number): string {
  return n.toFixed(2)
}

interface CostReportProps {
  data: {
    projectName: string
    originalBudget: number
    approvedChanges: number
    currentBudget: number
    actualCost: number
    committedCost: number
    forecastCost: number
    bac: number; ev: number; pv: number; ac: number
    cpi: number; spi: number; eac: number; etc: number; vac: number; cv: number; sv: number
    costCodes: Array<{ code: string; description: string; budget: number; actual: number; committed: number; variance: number; percentSpent: number }>
    changeOrders: Array<{ number: string; description: string; amount: number; status: string; date: string }>
    contingencyBudget: number; contingencyUsed: number; contingencyRemaining: number; contingencyBurnRate: number
  }
}

export const CostReport: React.FC<CostReportProps> = ({ data }) => {
  const spent = data.currentBudget > 0 ? (data.actualCost / data.currentBudget) * 100 : 0

  return (
    <PDFReport projectName={data.projectName} reportTitle="Cost Report">
      {/* Budget Summary */}
      <PDFSection title="Budget Summary" />
      <View style={s.kpiGrid}>
        <View style={s.kpiBox}>
          <Text style={s.kpiLabel}>Original Budget</Text>
          <Text style={s.kpiValue}>{fmtCurrency(data.originalBudget)}</Text>
        </View>
        <View style={s.kpiBox}>
          <Text style={s.kpiLabel}>Approved Changes</Text>
          <Text style={s.kpiValue}>{fmtCurrency(data.approvedChanges)}</Text>
        </View>
        <View style={s.kpiBox}>
          <Text style={s.kpiLabel}>Current Budget</Text>
          <Text style={s.kpiValue}>{fmtCurrency(data.currentBudget)}</Text>
        </View>
        <View style={s.kpiBox}>
          <Text style={s.kpiLabel}>Forecast at Completion</Text>
          <Text style={s.kpiValue}>{fmtCurrency(data.forecastCost)}</Text>
          <Text style={s.kpiSub}>{data.vac >= 0 ? 'Under budget' : 'Over budget'}</Text>
        </View>
      </View>

      <View style={s.kpiGrid}>
        <View style={[s.kpiBox, { width: '48%' }]}>
          <Text style={s.kpiLabel}>Actual Cost to Date</Text>
          <Text style={s.kpiValue}>{fmtCurrency(data.actualCost)}</Text>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${Math.min(spent, 100)}%`, backgroundColor: spent > 90 ? '#C93B3B' : spent > 75 ? '#C4850C' : '#2D8A6E' }]} />
          </View>
          <Text style={s.kpiSub}>{spent.toFixed(1)}% of budget spent</Text>
        </View>
        <View style={[s.kpiBox, { width: '48%' }]}>
          <Text style={s.kpiLabel}>Committed Cost</Text>
          <Text style={s.kpiValue}>{fmtCurrency(data.committedCost)}</Text>
          <Text style={s.kpiSub}>Remaining: {fmtCurrency(data.currentBudget - data.actualCost - data.committedCost)}</Text>
        </View>
      </View>

      {/* Earned Value Analysis */}
      <PDFSection title="Earned Value Analysis" />
      <View style={s.evGrid}>
        <View style={s.evBox}><Text style={s.evLabel}>BAC</Text><Text style={s.evValue}>{fmtCurrency(data.bac)}</Text></View>
        <View style={s.evBox}><Text style={s.evLabel}>EV</Text><Text style={s.evValue}>{fmtCurrency(data.ev)}</Text></View>
        <View style={s.evBox}><Text style={s.evLabel}>PV</Text><Text style={s.evValue}>{fmtCurrency(data.pv)}</Text></View>
        <View style={s.evBox}><Text style={s.evLabel}>AC</Text><Text style={s.evValue}>{fmtCurrency(data.ac)}</Text></View>
        <View style={[s.evBox, { backgroundColor: data.cpi >= 1 ? '#E8F5E9' : '#FEF2F2' }]}>
          <Text style={s.evLabel}>CPI</Text><Text style={s.evValue}>{fmtIndex(data.cpi)}</Text>
        </View>
        <View style={[s.evBox, { backgroundColor: data.spi >= 1 ? '#E8F5E9' : '#FEF2F2' }]}>
          <Text style={s.evLabel}>SPI</Text><Text style={s.evValue}>{fmtIndex(data.spi)}</Text>
        </View>
      </View>
      <View style={s.evGrid}>
        <View style={s.evBox}><Text style={s.evLabel}>EAC</Text><Text style={s.evValue}>{fmtCurrency(data.eac)}</Text></View>
        <View style={s.evBox}><Text style={s.evLabel}>ETC</Text><Text style={s.evValue}>{fmtCurrency(data.etc)}</Text></View>
        <View style={[s.evBox, { backgroundColor: data.vac >= 0 ? '#E8F5E9' : '#FEF2F2' }]}>
          <Text style={s.evLabel}>VAC</Text><Text style={s.evValue}>{fmtCurrency(data.vac)}</Text>
        </View>
        <View style={[s.evBox, { backgroundColor: data.cv >= 0 ? '#E8F5E9' : '#FEF2F2' }]}>
          <Text style={s.evLabel}>CV</Text><Text style={s.evValue}>{fmtCurrency(data.cv)}</Text>
        </View>
        <View style={[s.evBox, { backgroundColor: data.sv >= 0 ? '#E8F5E9' : '#FEF2F2' }]}>
          <Text style={s.evLabel}>SV</Text><Text style={s.evValue}>{fmtCurrency(data.sv)}</Text>
        </View>
      </View>

      {/* Budget vs Actual by Cost Code */}
      <PDFSection title="Budget vs Actual by Cost Code" />
      <PDFTable
        columns={[
          { header: 'Code', width: '12%', key: 'code' },
          { header: 'Description', width: '24%', key: 'description' },
          { header: 'Budget', width: '14%', key: 'budget' },
          { header: 'Actual', width: '14%', key: 'actual' },
          { header: 'Committed', width: '14%', key: 'committed' },
          { header: 'Variance', width: '12%', key: 'variance' },
          { header: '% Spent', width: '10%', key: 'pct' },
        ]}
        rows={data.costCodes.map((c) => ({
          code: c.code,
          description: c.description,
          budget: fmtCurrency(c.budget),
          actual: fmtCurrency(c.actual),
          committed: fmtCurrency(c.committed),
          variance: fmtCurrency(c.variance),
          pct: `${c.percentSpent.toFixed(0)}%`,
        }))}
      />

      {/* Change Order Log */}
      {data.changeOrders.length > 0 && (
        <>
          <PDFSection title="Change Order Log" />
          <PDFTable
            columns={[
              { header: 'CO #', width: '12%', key: 'number' },
              { header: 'Description', width: '38%', key: 'description' },
              { header: 'Amount', width: '18%', key: 'amount' },
              { header: 'Status', width: '16%', key: 'status' },
              { header: 'Date', width: '16%', key: 'date' },
            ]}
            rows={data.changeOrders.map((co) => ({
              number: co.number,
              description: co.description,
              amount: fmtCurrency(co.amount),
              status: co.status.replace(/_/g, ' ').toUpperCase(),
              date: co.date,
            }))}
          />
        </>
      )}

      {/* Contingency Burn */}
      {data.contingencyBudget > 0 && (
        <>
          <PDFSection title="Contingency Burn Rate" />
          <View style={s.kpiGrid}>
            <View style={s.kpiBox}><Text style={s.kpiLabel}>Contingency Budget</Text><Text style={s.kpiValue}>{fmtCurrency(data.contingencyBudget)}</Text></View>
            <View style={s.kpiBox}><Text style={s.kpiLabel}>Used</Text><Text style={s.kpiValue}>{fmtCurrency(data.contingencyUsed)}</Text></View>
            <View style={s.kpiBox}><Text style={s.kpiLabel}>Remaining</Text><Text style={s.kpiValue}>{fmtCurrency(data.contingencyRemaining)}</Text></View>
            <View style={[s.kpiBox, { backgroundColor: data.contingencyBurnRate > 75 ? '#FEF2F2' : '#FAFAF8' }]}>
              <Text style={s.kpiLabel}>Burn Rate</Text><Text style={s.kpiValue}>{data.contingencyBurnRate.toFixed(0)}%</Text>
            </View>
          </View>
        </>
      )}
    </PDFReport>
  )
}

export default CostReport
