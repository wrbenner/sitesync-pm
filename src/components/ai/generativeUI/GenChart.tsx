import React, { useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'
import type { ChartBlock } from './types'

const DEFAULT_COLORS = [
  colors.primaryOrange,
  colors.statusInfo,
  colors.statusActive,
  colors.statusPending,
  colors.statusReview,
  colors.statusCritical,
  colors.chartCyan,
  colors.chartGreen,
]

interface Props {
  block: ChartBlock
}

export const GenChart: React.FC<Props> = React.memo(({ block }) => {
  const chartColors = useMemo(() => block.colors || DEFAULT_COLORS, [block.colors])

  const commonAxisProps = {
    tick: { fontSize: 11, fill: colors.textTertiary, fontFamily: typography.fontFamily },
    axisLine: { stroke: colors.borderSubtle },
    tickLine: false,
  }

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: colors.surfaceRaised,
      border: `1px solid ${colors.borderDefault}`,
      borderRadius: borderRadius.md,
      fontSize: typography.fontSize.caption,
      fontFamily: typography.fontFamily,
    },
  }

  return (
    <div style={{
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.lg,
      border: `1px solid ${colors.borderSubtle}`,
      padding: spacing['4'],
      fontFamily: typography.fontFamily,
    }}>
      {block.title && (
        <div style={{
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
          marginBottom: spacing['3'],
        }}>
          {block.title}
        </div>
      )}

      <ResponsiveContainer width="100%" height={240}>
        {block.chart_type === 'bar' ? (
          <BarChart data={block.data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.borderSubtle} />
            <XAxis dataKey={block.x_key} {...commonAxisProps} />
            <YAxis {...commonAxisProps} />
            <Tooltip {...tooltipStyle} />
            {block.y_keys.length > 1 && <Legend />}
            {block.y_keys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                name={block.y_labels?.[i] || key}
                fill={chartColors[i % chartColors.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        ) : block.chart_type === 'line' ? (
          <LineChart data={block.data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.borderSubtle} />
            <XAxis dataKey={block.x_key} {...commonAxisProps} />
            <YAxis {...commonAxisProps} />
            <Tooltip {...tooltipStyle} />
            {block.y_keys.length > 1 && <Legend />}
            {block.y_keys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={block.y_labels?.[i] || key}
                stroke={chartColors[i % chartColors.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        ) : block.chart_type === 'area' ? (
          <AreaChart data={block.data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.borderSubtle} />
            <XAxis dataKey={block.x_key} {...commonAxisProps} />
            <YAxis {...commonAxisProps} />
            <Tooltip {...tooltipStyle} />
            {block.y_keys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={block.y_labels?.[i] || key}
                stroke={chartColors[i % chartColors.length]}
                fill={chartColors[i % chartColors.length]}
                fillOpacity={0.1}
              />
            ))}
          </AreaChart>
        ) : (
          <PieChart>
            <Tooltip {...tooltipStyle} />
            <Pie
              data={block.data}
              dataKey={block.y_keys[0]}
              nameKey={block.x_key}
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={50}
              paddingAngle={2}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {block.data.map((_, i) => (
                <Cell key={i} fill={chartColors[i % chartColors.length]} />
              ))}
            </Pie>
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  )
})
