import React, { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Mail, Eye, Clock, CheckCircle, Plus, X, Bell, Copy, Check } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme'
import { Avatar } from '../Primitives'
import { useRealtimeDirectoryContacts } from '../../hooks/queries/realtime'
import type { DirectoryContact } from '../../types/database'

// ─── Types ───────────────────────────────────────────────

interface DistributionRecipient {
  contactId: string
  name: string
  company: string
  email: string
  method: 'in_app' | 'email' | 'both'
  status: 'pending' | 'sent' | 'viewed' | 'responded'
  sentAt?: string
  viewedAt?: string
}

interface RFIDistributionPanelProps {
  rfiId: string
  projectId: string
  rfiTitle: string
  rfiNumber: string
  recipients?: DistributionRecipient[]
  onDistribute?: (recipients: DistributionRecipient[]) => Promise<void>
}

// ─── Status Badge ─────────────────────────────────────────

const StatusBadge: React.FC<{ status: DistributionRecipient['status'] }> = ({ status }) => {
  const config = {
    pending: { label: 'Pending', color: colors.textTertiary, icon: Clock },
    sent: { label: 'Sent', color: colors.statusInfo, icon: Send },
    viewed: { label: 'Viewed', color: colors.statusPending, icon: Eye },
    responded: { label: 'Responded', color: colors.statusActive, icon: CheckCircle },
  }
  const { label, color, icon: Icon } = config[status]

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: borderRadius.full,
      backgroundColor: `${color}15`, fontSize: '11px',
      fontWeight: typography.fontWeight.medium, color,
    }}>
      <Icon size={10} />
      {label}
    </span>
  )
}

// ─── Recipient Row ────────────────────────────────────────

const RecipientRow: React.FC<{
  recipient: DistributionRecipient
  onRemove: () => void
  onMethodChange: (method: DistributionRecipient['method']) => void
}> = ({ recipient, onRemove, onMethodChange }) => (
  <motion.div
    initial={{ opacity: 0, height: 0 }}
    animate={{ opacity: 1, height: 'auto' }}
    exit={{ opacity: 0, height: 0 }}
    style={{
      display: 'flex', alignItems: 'center', gap: spacing.sm,
      padding: `${spacing.sm} ${spacing.md}`,
      borderRadius: borderRadius.md, backgroundColor: colors.surfaceRaised,
      border: `1px solid ${colors.borderSubtle}`,
    }}
  >
    <Avatar name={recipient.name} size={28} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
        color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {recipient.name}
      </div>
      <div style={{ fontSize: '11px', color: colors.textTertiary }}>
        {recipient.company}{recipient.email ? ` · ${recipient.email}` : ''}
      </div>
    </div>

    {/* Method selector */}
    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
      {(['in_app', 'email', 'both'] as const).map(m => (
        <button
          key={m}
          onClick={() => onMethodChange(m)}
          title={m === 'in_app' ? 'In-app only' : m === 'email' ? 'Email only' : 'Both'}
          style={{
            padding: '3px 6px', borderRadius: borderRadius.sm,
            border: `1px solid ${recipient.method === m ? colors.primaryOrange : colors.borderSubtle}`,
            backgroundColor: recipient.method === m ? colors.orangeSubtle : 'transparent',
            color: recipient.method === m ? colors.primaryOrange : colors.textTertiary,
            cursor: 'pointer', fontSize: '10px', fontWeight: typography.fontWeight.medium,
            transition: 'all 0.15s',
          }}
        >
          {m === 'in_app' ? <Bell size={10} /> : m === 'email' ? <Mail size={10} /> : <>
            <Bell size={8} /><Mail size={8} />
          </>}
        </button>
      ))}
    </div>

    <StatusBadge status={recipient.status} />

    <button onClick={onRemove} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: colors.textTertiary, padding: 2,
    }}>
      <X size={14} />
    </button>
  </motion.div>
)

// ─── Main Component ───────────────────────────────────────

const RFIDistributionPanel: React.FC<RFIDistributionPanelProps> = ({
  rfiId, projectId, _rfiTitle, _rfiNumber, recipients: initialRecipients = [], onDistribute,
}) => {
  const { data: contacts = [] } = useRealtimeDirectoryContacts(projectId)
  const [recipients, setRecipients] = useState<DistributionRecipient[]>(initialRecipients)
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const addRecipient = useCallback((contact: DirectoryContact) => {
    if (recipients.some(r => r.contactId === contact.id)) return
    setRecipients(prev => [...prev, {
      contactId: contact.id,
      name: contact.name || 'Unknown',
      company: contact.company || '',
      email: contact.email || '',
      method: contact.email ? 'both' : 'in_app',
      status: 'pending',
    }])
    setSearch('')
    setShowSearch(false)
  }, [recipients])

  const removeRecipient = useCallback((contactId: string) => {
    setRecipients(prev => prev.filter(r => r.contactId !== contactId))
  }, [])

  const updateMethod = useCallback((contactId: string, method: DistributionRecipient['method']) => {
    setRecipients(prev => prev.map(r => r.contactId === contactId ? { ...r, method } : r))
  }, [])

  const handleDistribute = useCallback(async () => {
    if (recipients.length === 0) return
    setSending(true)
    try {
      if (onDistribute) {
        await onDistribute(recipients)
      }
      setRecipients(prev => prev.map(r => ({
        ...r, status: 'sent' as const, sentAt: new Date().toISOString(),
      })))
    } catch {
      // Error handled upstream
    } finally {
      setSending(false)
    }
  }, [recipients, onDistribute])

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/#/rfis/${rfiId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [rfiId])

  const filtered = contacts.filter(c => {
    const term = search.toLowerCase()
    return (
      !recipients.some(r => r.contactId === c.id) &&
      ((c.name || '').toLowerCase().includes(term) ||
       (c.company || '').toLowerCase().includes(term) ||
       (c.email || '').toLowerCase().includes(term))
    )
  })

  const pendingCount = recipients.filter(r => r.status === 'pending').length
  const sentCount = recipients.filter(r => r.status !== 'pending').length

  return (
    <div style={{
      borderRadius: borderRadius.lg, border: `1px solid ${colors.borderSubtle}`,
      backgroundColor: colors.surfaceRaised, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: `${spacing.md} ${spacing.lg}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <Send size={16} style={{ color: colors.primaryOrange }} />
          <h3 style={{
            margin: 0, fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.semibold, color: colors.textPrimary,
          }}>
            Distribution
          </h3>
          {recipients.length > 0 && (
            <span style={{
              fontSize: '11px', padding: '1px 6px', borderRadius: borderRadius.full,
              backgroundColor: colors.orangeSubtle, color: colors.primaryOrange,
              fontWeight: typography.fontWeight.semibold,
            }}>
              {recipients.length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: spacing.sm }}>
          <button
            onClick={handleCopyLink}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: borderRadius.md,
              border: `1px solid ${colors.borderDefault}`,
              backgroundColor: 'transparent', cursor: 'pointer',
              fontSize: '11px', color: colors.textSecondary,
              fontWeight: typography.fontWeight.medium,
              transition: 'all 0.15s',
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* Recipients */}
      <div style={{ padding: spacing.md, display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
        <AnimatePresence>
          {recipients.map(r => (
            <RecipientRow
              key={r.contactId}
              recipient={r}
              onRemove={() => removeRecipient(r.contactId)}
              onMethodChange={(method) => updateMethod(r.contactId, method)}
            />
          ))}
        </AnimatePresence>

        {/* Add People */}
        <div ref={searchRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setShowSearch(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing.sm,
              padding: `${spacing.sm} ${spacing.md}`,
              borderRadius: borderRadius.md,
              border: `1px dashed ${colors.borderDefault}`,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <Plus size={14} style={{ color: colors.textTertiary }} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowSearch(true) }}
              onFocus={() => setShowSearch(true)}
              placeholder="Add person from directory..."
              style={{
                flex: 1, border: 'none', outline: 'none',
                fontSize: typography.fontSize.caption, color: colors.textPrimary,
                backgroundColor: 'transparent',
              }}
            />
          </div>

          <AnimatePresence>
            {showSearch && filtered.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  marginTop: 4, maxHeight: 180, overflowY: 'auto',
                  backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.md, boxShadow: shadows.lg,
                }}
              >
                {filtered.slice(0, 8).map(c => (
                  <div key={c.id}
                    onClick={() => addRecipient(c)}
                    style={{
                      padding: '8px 12px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: spacing.sm,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.surfaceHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Avatar name={c.name || 'U'} size={24} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: typography.fontSize.caption, color: colors.textPrimary }}>
                        {c.name || 'Unknown'}
                      </div>
                      <div style={{ fontSize: '10px', color: colors.textTertiary }}>
                        {[c.role, c.company].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {c.email && <Mail size={10} style={{ color: colors.textTertiary }} />}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer / Send */}
      {pendingCount > 0 && (
        <div style={{
          padding: `${spacing.sm} ${spacing.md}`,
          borderTop: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.surfaceInset,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '11px', color: colors.textTertiary }}>
            {pendingCount} pending · {sentCount} sent
          </span>
          <button
            onClick={handleDistribute}
            disabled={sending}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 16px', borderRadius: borderRadius.md,
              border: 'none',
              backgroundColor: sending ? colors.surfaceDisabled : colors.primaryOrange,
              color: sending ? colors.textDisabled : colors.white,
              fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.semibold,
              cursor: sending ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <Send size={12} />
            {sending ? 'Sending...' : 'Send to All'}
          </button>
        </div>
      )}
    </div>
  )
}

export default RFIDistributionPanel
