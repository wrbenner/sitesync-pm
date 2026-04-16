import React, { useState, useRef, useCallback, memo } from 'react'
import {
  QrCode, Users, Building2, ArrowRight, Check,
  X, AlertTriangle, UserCheck, Scan, LogOut,
} from 'lucide-react'
import { Scanner } from '@yudiel/react-qr-scanner'
import type { IDetectedBarcode } from '@yudiel/react-qr-scanner'
import { colors, spacing, typography, borderRadius, transitions, shadows, zIndex } from '../../styles/theme'
import { Btn, Card, SectionHeader, useToast } from '../Primitives'
import {
  useHeadcount,
  useCheckInMutation,
  useCheckOutMutation,
  useHeadcountRealtime,
  useWorkerLookup,
  useDailyLogCrewUpsert,
  generateQRPayload,
  parseQRPayload,
  useCheckIn,
} from '../../hooks/useCheckIn'
import type { CheckInRecord, HeadcountSummary } from '../../hooks/useCheckIn'
import { useProjectId } from '../../hooks/useProjectId'
import { useHaptics } from '../../hooks/useHaptics'
import { useAuth } from '../../hooks/useAuth'

// ── QRScannerSheet ────────────────────────────────────────────
// Full-screen bottom sheet with live camera QR scanning.

interface QRScannerSheetProps {
  onClose: () => void
}

export const QRScannerSheet: React.FC<QRScannerSheetProps> = ({ onClose }) => {
  const { user } = useAuth()
  const { checkIn, isPending } = useCheckIn()
  const haptics = useHaptics()
  const [scanStatus, setScanStatus] = useState<'scanning' | 'success' | 'error'>('scanning')
  const [checkedInLocation, setCheckedInLocation] = useState('')
  const processingRef = useRef(false)

  const handleScan = useCallback(async (result: IDetectedBarcode[]) => {
    if (processingRef.current || scanStatus !== 'scanning') return
    const raw = result[0]?.rawValue
    if (!raw) return
    const payload = parseQRPayload(raw)
    if (!payload) return

    processingRef.current = true
    try {
      await checkIn(user?.id ?? 'anonymous', payload.projectId, payload.locationId ?? '')
      haptics.notification('success')
      setCheckedInLocation(payload.locationId ?? 'this location')
      setScanStatus('success')
      setTimeout(() => onClose(), 2000)
    } catch {
      haptics.notification('error')
      processingRef.current = false
      setScanStatus('error')
      setTimeout(() => setScanStatus('scanning'), 1500)
    }
  }, [scanStatus, checkIn, user, haptics, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          zIndex: (zIndex.modal as number) - 1,
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: '92dvh',
        backgroundColor: '#000',
        borderTopLeftRadius: borderRadius['2xl'],
        borderTopRightRadius: borderRadius['2xl'],
        zIndex: zIndex.modal as number,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideInUp 250ms ease-out',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing['4']} ${spacing['4']} ${spacing['3']}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <QrCode size={20} color={colors.white} />
            <span style={{
              fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold,
              color: colors.white,
            }}>
              Scan to Check In
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close scanner"
            style={{
              width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.12)', border: 'none',
              borderRadius: '50%', cursor: 'pointer',
            }}
          >
            <X size={20} color={colors.white} />
          </button>
        </div>

        {/* Scanner / Success */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {scanStatus !== 'success' ? (
            <>
              <Scanner
                onScan={handleScan}
                onError={() => {}}
                constraints={{ facingMode: 'environment' }}
                formats={['qr_code']}
                styles={{
                  container: { width: '100%', height: '100%' },
                  video: { width: '100%', height: '100%', objectFit: 'cover' },
                }}
              />

              {/* Aim guide */}
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 220, height: 220,
                  border: `3px solid ${scanStatus === 'error' ? colors.statusCritical : colors.primaryOrange}`,
                  borderRadius: borderRadius.xl,
                  transition: `border-color ${transitions.quick}`,
                }} />
              </div>

              {/* Hint label */}
              <div style={{
                position: 'absolute', bottom: spacing['8'], left: 0, right: 0,
                display: 'flex', justifyContent: 'center', pointerEvents: 'none',
              }}>
                <div style={{
                  padding: `${spacing['2']} ${spacing['4']}`,
                  backgroundColor: 'rgba(0,0,0,0.65)',
                  borderRadius: borderRadius.full,
                }}>
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.white }}>
                    {scanStatus === 'error' ? 'Invalid QR code, try again' : 'Point camera at the site QR code'}
                  </span>
                </div>
              </div>

              {/* Processing overlay */}
              {isPending && (
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: colors.white, fontSize: typography.fontSize.body }}>
                    Recording check-in...
                  </span>
                </div>
              )}
            </>
          ) : (
            /* Success state */
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: '100%', gap: spacing['4'],
            }}>
              <div style={{
                width: 88, height: 88, borderRadius: '50%',
                backgroundColor: colors.statusActive,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'fadeIn 200ms ease-out',
              }}>
                <Check size={44} color={colors.white} />
              </div>
              <p style={{
                fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.bold,
                color: colors.white, margin: 0,
              }}>
                Checked in
              </p>
              <p style={{
                fontSize: typography.fontSize.body, color: 'rgba(255,255,255,0.65)',
                margin: 0,
              }}>
                at {checkedInLocation}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── QR Code Display (for gate/entrance) ───────────────────────

const QRCodeDisplay = memo<{ projectId: string }>(({ projectId }) => {
  const _payload = generateQRPayload(projectId)

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

// ── SwipeToCheckOutRow ────────────────────────────────────────

const SWIPE_THRESHOLD = 80

const SwipeToCheckOutRow = memo<{
  record: CheckInRecord
  onCheckOut: (id: string, trade: string, company: string, hours: number) => void
}>(({ record, onCheckOut }) => {
  const [translateX, setTranslateX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)

  const checkInTime = new Date(record.checkInAt).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  })
  const elapsedMin = Math.round((Date.now() - new Date(record.checkInAt).getTime()) / 60000)
  const elapsedLabel = record.checkOutAt
    ? `${record.hoursOnSite}h total`
    : elapsedMin < 60
    ? `${elapsedMin}m on site`
    : `${(elapsedMin / 60).toFixed(1)}h on site`

  const handlePointerDown = (e: React.PointerEvent) => {
    if (record.checkOutAt) return
    startXRef.current = e.clientX
    setIsDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    const delta = e.clientX - startXRef.current
    setTranslateX(Math.min(0, delta))
  }

  const handlePointerUp = () => {
    setIsDragging(false)
    if (Math.abs(translateX) >= SWIPE_THRESHOLD) {
      const hours = Math.round((Date.now() - new Date(record.checkInAt).getTime()) / 360000) / 10
      onCheckOut(record.id, record.trade, record.company, hours)
    }
    setTranslateX(0)
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Checkout reveal */}
      <div style={{
        position: 'absolute', inset: 0, backgroundColor: colors.statusCritical,
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        paddingRight: spacing['5'],
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <LogOut size={14} color={colors.white} />
          <span style={{ color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>
            Check Out
          </span>
        </div>
      </div>

      {/* Swipeable row */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          display: 'flex', alignItems: 'center', gap: spacing['3'],
          padding: `${spacing['3']} ${spacing['4']}`,
          backgroundColor: colors.surfaceRaised,
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 200ms ease',
          cursor: record.checkOutAt ? 'default' : 'grab',
          userSelect: 'none', touchAction: 'pan-y',
          borderBottom: `1px solid ${colors.borderSubtle}`,
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          backgroundColor: record.checkOutAt ? colors.statusActiveSubtle : colors.statusInfoSubtle,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {record.checkOutAt
            ? <Check size={14} color={colors.statusActive} />
            : <UserCheck size={14} color={colors.statusInfo} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {record.workerName}
          </p>
          <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            {record.trade || 'General'} · {record.company || 'Unknown'}
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
            In: {checkInTime}
          </p>
          <p style={{ margin: 0, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: record.checkOutAt ? colors.statusActive : colors.statusInfo }}>
            {elapsedLabel}
          </p>
        </div>
        {!record.checkOutAt && (
          <ArrowRight size={14} color={`${colors.textTertiary}80`} style={{ flexShrink: 0 }} />
        )}
      </div>
    </div>
  )
})
SwipeToCheckOutRow.displayName = 'SwipeToCheckOutRow'

// ── LiveCheckInBoard ──────────────────────────────────────────

const LiveCheckInBoard = memo<{
  records: CheckInRecord[]
  onCheckOut: (id: string, trade: string, company: string, hours: number) => void
  onSimulateScan: () => void
  isScanning: boolean
}>(({ records, onCheckOut, onSimulateScan, isScanning }) => {
  const onSite = records.filter((r) => !r.checkOutAt)
  const checkedOut = records.filter((r) => r.checkOutAt)

  // Aggregate on-site by trade+company for the summary table
  const byTrade = Array.from(
    onSite.reduce((map, r) => {
      const key = `${r.trade}__${r.company}`
      const existing = map.get(key)
      if (existing) {
        existing.headcount++
        if (r.checkInAt < existing.timeIn) existing.timeIn = r.checkInAt
      } else {
        map.set(key, { trade: r.trade || 'General', company: r.company || 'Unknown', headcount: 1, timeIn: r.checkInAt })
      }
      return map
    }, new Map<string, { trade: string; company: string; headcount: number; timeIn: string }>()),
  ).map(([, v]) => v).sort((a, b) => b.headcount - a.headcount)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
          {onSite.length} worker{onSite.length !== 1 ? 's' : ''} on site. Swipe left to check out.
        </p>
        <Btn size="sm" onClick={onSimulateScan} disabled={isScanning}>
          <Scan size={14} style={{ marginRight: spacing['1'] }} />
          {isScanning ? 'Scanning...' : 'Scan Worker QR'}
        </Btn>
      </div>

      {/* Trade summary table */}
      {byTrade.length > 0 && (
        <Card padding="0">
          <div style={{ padding: `${spacing['3']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, display: 'grid', gridTemplateColumns: '1fr 1fr 80px 100px', gap: spacing['3'] }}>
            {['Trade', 'Company', 'Count', 'First In'].map((h) => (
              <span key={h} style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>
          {byTrade.map((row) => (
            <div key={`${row.trade}-${row.company}`} style={{ padding: `${spacing['3']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, display: 'grid', gridTemplateColumns: '1fr 1fr 80px 100px', gap: spacing['3'], alignItems: 'center' }}>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{row.trade}</span>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{row.company}</span>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange }}>{row.headcount}</span>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                {new Date(row.timeIn).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </Card>
      )}

      {/* Individual swipeable rows */}
      <div>
        <SectionHeader title="On Site Now" />
        <Card padding="0" style={{ marginTop: spacing['2'] }}>
          {onSite.length === 0 ? (
            <div style={{ padding: spacing['6'], textAlign: 'center' }}>
              <Users size={24} color={colors.textTertiary} style={{ margin: '0 auto 8px' }} />
              <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>No workers checked in yet</p>
              <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Scan a worker QR code to check them in</p>
            </div>
          ) : (
            onSite.map((record) => (
              <SwipeToCheckOutRow key={record.id} record={record} onCheckOut={onCheckOut} />
            ))
          )}
        </Card>
      </div>

      {checkedOut.length > 0 && (
        <div>
          <SectionHeader title="Checked Out Today" />
          <Card padding="0" style={{ marginTop: spacing['2'] }}>
            {checkedOut.map((record) => (
              <SwipeToCheckOutRow key={record.id} record={record} onCheckOut={onCheckOut} />
            ))}
          </Card>
        </div>
      )}
    </div>
  )
})
LiveCheckInBoard.displayName = 'LiveCheckInBoard'

// ── Main QR Check-In Component ────────────────────────────────

interface QRCheckInProps {
  showQRCode?: boolean // Show the QR code for gate display mode
  showLiveBoard?: boolean // Show swipeable individual check-in rows
}

export const QRCheckIn: React.FC<QRCheckInProps> = ({ showQRCode, showLiveBoard }) => {
  const projectId = useProjectId()
  const { data: headcount, isLoading } = useHeadcount()
  useHeadcountRealtime()
  const { addToast } = useToast()
  const checkInMutation = useCheckInMutation()
  const checkOutMutation = useCheckOutMutation()
  const crewUpsert = useDailyLogCrewUpsert()
  const lookupWorker = useWorkerLookup()
  const [isScanning, setIsScanning] = useState(false)

  // Simulate a QR scan: resolves first matching worker from directory not already on site
  const handleSimulateScan = useCallback(async () => {
    if (!projectId || isScanning) return
    setIsScanning(true)
    try {
      // In production, this would open a camera scanner; here we use the first directory contact
      const identity = await lookupWorker('a') // broad partial match to get any worker
      if (!identity) {
        addToast('info', 'No workers found in directory. Add contacts in the Directory page.')
        return
      }
      const now = new Date().toISOString()
      await checkInMutation.mutateAsync({
        workerId: identity.workerId,
        workerName: identity.workerName,
        company: identity.company,
        trade: identity.trade,
        method: 'qr_scan',
      })
      await crewUpsert.mutateAsync({
        trade: identity.trade,
        company: identity.company,
        headcountDelta: 1,
        timeIn: now,
      })
      addToast('success', `${identity.workerName} (${identity.trade}) checked in`)
    } catch {
      addToast('error', 'Check-in failed. Will retry when back online.')
    } finally {
      setIsScanning(false)
    }
  }, [projectId, isScanning, lookupWorker, checkInMutation, crewUpsert, addToast])

  const handleCheckOut = useCallback(async (
    checkInId: string, trade: string, company: string, hours: number,
  ) => {
    try {
      await checkOutMutation.mutateAsync(checkInId)
      await crewUpsert.mutateAsync({
        trade,
        company,
        headcountDelta: -1,
        timeOut: new Date().toISOString(),
        hoursDelta: hours,
      })
      addToast('success', `Checked out. ${hours}h logged to daily report.`)
    } catch {
      addToast('error', 'Check-out failed')
    }
  }, [checkOutMutation, crewUpsert, addToast])

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
      {showLiveBoard ? (
        <LiveCheckInBoard
          records={data.recentCheckIns}
          onCheckOut={handleCheckOut}
          onSimulateScan={handleSimulateScan}
          isScanning={isScanning}
        />
      ) : (
        <HeadcountDashboard data={data} />
      )}
    </div>
  )
}
