import React, { useState, useRef, useCallback, useEffect, memo } from 'react'
import {
  QrCode, Users, Clock, Building2, ArrowRight, Check,
  X, MapPin, AlertTriangle, UserCheck, Scan,
} from 'lucide-react'
import { colors, spacing, typography, borderRadius, transitions, shadows, zIndex } from '../../styles/theme'
import { Btn, Card, MetricBox, SectionHeader } from '../Primitives'
import {
  useHeadcount,
  useCheckInMutation,
  useCheckOutMutation,
  useHeadcountRealtime,
  generateQRPayload,
} from '../../hooks/useCheckIn'
import type { CheckInRecord, HeadcountSummary } from '../../hooks/useCheckIn'
import { useProjectId } from '../../hooks/useProjectId'
import { toast } from 'sonner'

// ── QR Code Display (for gate/entrance) ───────────────────────

const QRCodeDisplay = memo<{ projectId: string }>(({ projectId }) => {
  const payload = generateQRPayload(projectId)

  // Simple SVG QR-like pattern (in production, use a real QR library)
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: spacing['6'], backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.xl, boxShadow: shadows.card,
    }}>
      <div style={{
        width: 200, height: 200, backgroundColor: colors.white,
        borderRadius: borderRadius.lg, padding: spacing['4'],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `2px solid ${colors.borderDefault}`,
      }}>
        {/* QR code placeholder — in production, use qrcode.react or similar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2, width: 160, height: 160 }}>
          {Array.from({ length: 64 }).map((_, i) => {
            // Deterministic pattern based on project ID hash
            const hash = projectId.charCodeAt(i % projectId.length) + i
            const filled = hash % 3 !== 0
            return (
              <div
                key={i}
                style={{
                  backgroundColor: filled ? colors.textPrimary : 'transparent',
                  borderRadius: 1,
                }}
              />
            )
          })}
        </div>
      </div>
      <p style={{
        margin: `${spacing['3']} 0 0`, fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textAlign: 'center',
      }}>
        Scan to Check In
      </p>
      <p style={{
        margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption,
        color: colors.textTertiary, textAlign: 'center',
      }}>
        Point your phone camera at this code
      </p>
    </div>
  )
})
QRCodeDisplay.displayName = 'QRCodeDisplay'

// ── Headcount Dashboard ───────────────────────────────────────

const HeadcountDashboard = memo<{ data: HeadcountSummary }>(({ data }) => (
  <div>
    {/* KPIs */}
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: spacing['3'], marginBottom: spacing['5'],
    }}>
      <div style={{
        padding: spacing['4'], backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg, boxShadow: shadows.card, textAlign: 'center',
      }}>
        <p style={{ margin: 0, fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.bold, color: colors.primaryOrange }}>
          {data.totalOnSite}
        </p>
        <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
          On Site Now
        </p>
      </div>
      <div style={{
        padding: spacing['4'], backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg, boxShadow: shadows.card, textAlign: 'center',
      }}>
        <p style={{ margin: 0, fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.bold, color: colors.statusInfo }}>
          {data.byCompany.length}
        </p>
        <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
          Companies
        </p>
      </div>
      <div style={{
        padding: spacing['4'], backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg, boxShadow: shadows.card, textAlign: 'center',
      }}>
        <p style={{ margin: 0, fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.bold, color: colors.statusPending }}>
          {data.lateArrivals.length}
        </p>
        <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
          Late Arrivals
        </p>
      </div>
      <div style={{
        padding: spacing['4'], backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg, boxShadow: shadows.card, textAlign: 'center',
      }}>
        <p style={{ margin: 0, fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.bold, color: colors.statusActive }}>
          {data.byTrade.length}
        </p>
        <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
          Active Trades
        </p>
      </div>
    </div>

    {/* Breakdown by company and trade */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['4'] }}>
      {/* By Company */}
      <Card padding={spacing['4']}>
        <SectionHeader title="By Company" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginTop: spacing['3'] }}>
          {data.byCompany.map((item) => (
            <div key={item.company} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <Building2 size={12} color={colors.textTertiary} />
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{item.company || 'Unknown'}</span>
              </div>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                {item.count}
              </span>
            </div>
          ))}
          {data.byCompany.length === 0 && (
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>No workers on site</span>
          )}
        </div>
      </Card>

      {/* By Trade */}
      <Card padding={spacing['4']}>
        <SectionHeader title="By Trade" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginTop: spacing['3'] }}>
          {data.byTrade.map((item) => (
            <div key={item.trade} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{item.trade || 'General'}</span>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                {item.count}
              </span>
            </div>
          ))}
          {data.byTrade.length === 0 && (
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>No trades active</span>
          )}
        </div>
      </Card>
    </div>

    {/* Recent Check-ins */}
    {data.recentCheckIns.length > 0 && (
      <Card padding={spacing['4']} style={{ marginTop: spacing['4'] }}>
        <SectionHeader title="Recent Check-ins" />
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: spacing['2'] }}>
          {data.recentCheckIns.map((record) => (
            <div
              key={record.id}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['3'],
                padding: `${spacing['2']} 0`,
                borderBottom: `1px solid ${colors.borderSubtle}`,
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: borderRadius.full,
                backgroundColor: record.checkOutAt ? colors.statusActiveSubtle : colors.statusInfoSubtle,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {record.checkOutAt
                  ? <Check size={12} color={colors.statusActive} />
                  : <UserCheck size={12} color={colors.statusInfo} />}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                  {record.workerName}
                </span>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: spacing['2'] }}>
                  {record.company} · {record.trade}
                </span>
              </div>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                {new Date(record.checkInAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
              <span style={{
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                color: record.checkOutAt ? colors.statusActive : colors.statusInfo,
              }}>
                {record.checkOutAt ? `${record.hoursOnSite}h` : 'On site'}
              </span>
            </div>
          ))}
        </div>
      </Card>
    )}

    {/* Late arrivals alert */}
    {data.lateArrivals.length > 0 && (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
        padding: spacing['4'], marginTop: spacing['4'],
        backgroundColor: colors.statusPendingSubtle, borderRadius: borderRadius.base,
        borderLeft: `3px solid ${colors.statusPending}`,
      }}>
        <AlertTriangle size={16} color={colors.statusPending} style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            {data.lateArrivals.length} Late Arrival{data.lateArrivals.length !== 1 ? 's' : ''} Today
          </p>
          <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
            {data.lateArrivals.map((r) => r.workerName).join(', ')}
          </p>
        </div>
      </div>
    )}
  </div>
))
HeadcountDashboard.displayName = 'HeadcountDashboard'

// ── Main QR Check-In Component ────────────────────────────────

interface QRCheckInProps {
  showQRCode?: boolean // Show the QR code for gate display mode
}

export const QRCheckIn: React.FC<QRCheckInProps> = ({ showQRCode }) => {
  const projectId = useProjectId()
  const { data: headcount, isLoading } = useHeadcount()
  useHeadcountRealtime()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['3'] }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 80, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.lg }} />
          ))}
        </div>
      </div>
    )
  }

  const data = headcount ?? {
    totalOnSite: 0,
    byCompany: [],
    byTrade: [],
    recentCheckIns: [],
    lateArrivals: [],
  }

  return (
    <div>
      {showQRCode && projectId && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: spacing['6'] }}>
          <QRCodeDisplay projectId={projectId} />
        </div>
      )}
      <HeadcountDashboard data={data} />
    </div>
  )
}
