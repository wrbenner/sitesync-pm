import React, { useState, useMemo, useCallback, memo } from 'react'
import {
  Store, Search, Star, Download, ExternalLink, Shield, Zap,
  DollarSign, Calendar, ShieldCheck, Truck, Calculator, Box,
  CheckCircle, Clock, ChevronRight, Globe, Code, X, Users,
} from 'lucide-react'
import { PageContainer, Card, SectionHeader, Btn, Skeleton, EmptyState } from '../components/Primitives'
import { colors, spacing, typography, borderRadius, transitions, shadows, zIndex } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useIntegrations } from '../hooks/queries'
import { PermissionGate } from '../components/auth/PermissionGate'
import { toast } from 'sonner'

// ── App Categories ────────────────────────────────────────────

type AppCategory = 'all' | 'accounting' | 'scheduling' | 'safety' | 'equipment' | 'estimating' | 'bim' | 'documents' | 'communication'

const CATEGORIES: Array<{ key: AppCategory; label: string; icon: React.ElementType }> = [
  { key: 'all', label: 'All Apps', icon: Store },
  { key: 'accounting', label: 'Accounting', icon: DollarSign },
  { key: 'scheduling', label: 'Scheduling', icon: Calendar },
  { key: 'safety', label: 'Safety', icon: ShieldCheck },
  { key: 'documents', label: 'Documents', icon: Box },
  { key: 'bim', label: 'BIM', icon: Box },
  { key: 'estimating', label: 'Estimating', icon: Calculator },
  { key: 'equipment', label: 'Equipment', icon: Truck },
  { key: 'communication', label: 'Communication', icon: Users },
]

// ── App Data ──────────────────────────────────────────────────

interface MarketplaceApp {
  id: string
  name: string
  developer: string
  description: string
  longDescription: string
  category: AppCategory
  icon: React.ElementType
  accentColor: string
  rating: number
  reviewCount: number
  installs: string
  pricing: 'free' | 'freemium' | 'paid'
  priceLabel: string
  featured: boolean
  verified: boolean
  capabilities: string[]
  status: 'available' | 'installed' | 'coming_soon'
}

// Marketplace apps sourced from integration registry + third-party
const MARKETPLACE_APPS: MarketplaceApp[] = [
  {
    id: 'quickbooks', name: 'QuickBooks Online', developer: 'Intuit', category: 'accounting',
    description: 'Bidirectional sync of invoices, payments, cost codes, and journal entries',
    longDescription: 'Automatically sync approved change orders as journal entries, import payment status from invoices, and keep cost codes aligned between SiteSync and QuickBooks. Eliminates double entry and ensures your books are always current.',
    icon: DollarSign, accentColor: colors.statusActive, rating: 4.8, reviewCount: 342,
    installs: '2,400+', pricing: 'free', priceLabel: 'Free', featured: true, verified: true,
    capabilities: ['Cost code sync', 'Invoice export', 'Journal entries', 'Payment tracking'],
    status: 'available',
  },
  {
    id: 'procore', name: 'Procore Import', developer: 'SiteSync', category: 'documents',
    description: 'Import projects, RFIs, and submittals from Procore for seamless migration',
    longDescription: 'Moving from Procore to SiteSync? This integration imports your project data including RFIs, submittals, and project details. Status mapping is automatic. Your team can be up and running on SiteSync within hours.',
    icon: Box, accentColor: colors.primaryOrange, rating: 4.6, reviewCount: 128,
    installs: '890+', pricing: 'free', priceLabel: 'Free', featured: true, verified: true,
    capabilities: ['Project import', 'RFI migration', 'Submittal migration', 'Status mapping'],
    status: 'available',
  },
  {
    id: 'slack', name: 'Slack', developer: 'Salesforce', category: 'communication',
    description: 'Real time project notifications in your Slack channels',
    longDescription: 'Get instant notifications in Slack when RFIs are created, submittals need review, daily logs are submitted, or schedule changes occur. Rich formatted messages with direct links back to SiteSync.',
    icon: Users, accentColor: colors.statusReview, rating: 4.9, reviewCount: 567,
    installs: '3,200+', pricing: 'free', priceLabel: 'Free', featured: true, verified: true,
    capabilities: ['RFI notifications', 'Submittal alerts', 'Daily log summaries', 'Schedule changes'],
    status: 'available',
  },
  {
    id: 'autodesk_bim360', name: 'Autodesk Build', developer: 'Autodesk', category: 'bim',
    description: 'Sync BIM models, drawings, and issues with Autodesk Construction Cloud',
    longDescription: 'Connect your Autodesk Construction Cloud account to sync Revit models, 2D drawings, and project issues. Changes in either platform are automatically reflected in the other.',
    icon: Box, accentColor: colors.statusInfo, rating: 4.5, reviewCount: 89,
    installs: '420+', pricing: 'free', priceLabel: 'Free', featured: false, verified: true,
    capabilities: ['Model sync', 'Drawing sync', 'Issue tracking', 'Markup sharing'],
    status: 'available',
  },
  {
    id: 'ms_project', name: 'Microsoft Project', developer: 'Microsoft', category: 'scheduling',
    description: 'Import and export schedules in .mpp format with full dependency mapping',
    longDescription: 'Keep your Microsoft Project schedules in sync with SiteSync. Import .mpp files with task dependencies, milestones, and resource assignments. Export updated schedules back to MS Project for team members who prefer that tool.',
    icon: Calendar, accentColor: colors.statusInfo, rating: 4.4, reviewCount: 156,
    installs: '1,100+', pricing: 'free', priceLabel: 'Free', featured: false, verified: true,
    capabilities: ['Schedule import', 'Schedule export', 'Dependency mapping', 'Resource sync'],
    status: 'available',
  },
  {
    id: 'sage', name: 'Sage 300 CRE', developer: 'Sage Group', category: 'accounting',
    description: 'Accounting data sync with Sage 300 Construction and Real Estate',
    longDescription: 'Sync job cost data, pay applications, and vendor payments between SiteSync and Sage 300 CRE. Supports bidirectional cost code mapping and automated journal entries.',
    icon: DollarSign, accentColor: colors.statusPending, rating: 4.2, reviewCount: 45,
    installs: '280+', pricing: 'paid', priceLabel: '$49/mo', featured: false, verified: true,
    capabilities: ['Cost import', 'Pay app export', 'Vendor sync', 'Journal entries'],
    status: 'available',
  },
  {
    id: 'primavera_p6', name: 'Primavera P6', developer: 'Oracle', category: 'scheduling',
    description: 'Import schedules from Oracle Primavera P6 .xer files',
    longDescription: 'Import complex construction schedules from Primavera P6 including activities, relationships, resources, and calendars. Supports .xer file format for enterprise scheduling workflows.',
    icon: Calendar, accentColor: colors.statusCritical, rating: 4.3, reviewCount: 67,
    installs: '340+', pricing: 'free', priceLabel: 'Free', featured: false, verified: true,
    capabilities: ['XER import', 'Activity mapping', 'Resource import', 'Calendar sync'],
    status: 'available',
  },
  {
    id: 'bluebeam', name: 'Bluebeam Revu', developer: 'Bluebeam (Nemetschek)', category: 'documents',
    description: 'Sync markups and review sessions between Bluebeam and SiteSync',
    longDescription: 'Bridge your Bluebeam review workflow with SiteSync. Sync markups, stamps, and review status bidirectionally. Drawing markups in Bluebeam appear as annotations in the SiteSync drawing viewer.',
    icon: Box, accentColor: colors.statusInfo, rating: 4.1, reviewCount: 34,
    installs: '180+', pricing: 'free', priceLabel: 'Free', featured: false, verified: true,
    capabilities: ['Markup sync', 'Review sessions', 'Stamp library', 'Status tracking'],
    status: 'available',
  },
  {
    id: 'hcss_heavyjob', name: 'HCSS HeavyJob', developer: 'HCSS', category: 'equipment',
    description: 'Sync time cards, equipment, and production data from heavy civil projects',
    longDescription: 'Connect HCSS HeavyJob for automatic daily production tracking on heavy civil projects. Import time cards, equipment hours, and production quantities into SiteSync daily logs.',
    icon: Truck, accentColor: colors.statusPending, rating: 0, reviewCount: 0,
    installs: '0', pricing: 'paid', priceLabel: '$29/mo', featured: false, verified: false,
    capabilities: ['Time card import', 'Equipment tracking', 'Production data', 'Cost code mapping'],
    status: 'coming_soon',
  },
  {
    id: 'sitesafety_pro', name: 'SiteSafety Pro', developer: 'SafeTech Inc', category: 'safety',
    description: 'Advanced safety analytics with predictive incident modeling',
    longDescription: 'Enterprise safety analytics that layers on top of SiteSync safety data. Machine learning models predict high risk activities. Automated OSHA form generation and submission.',
    icon: ShieldCheck, accentColor: colors.statusCritical, rating: 0, reviewCount: 0,
    installs: '0', pricing: 'paid', priceLabel: '$99/mo', featured: false, verified: false,
    capabilities: ['Predictive analytics', 'OSHA forms', 'Training tracking', 'Risk modeling'],
    status: 'coming_soon',
  },
]

// ── App Card Component ────────────────────────────────────────

const AppCard = memo<{
  app: MarketplaceApp
  onSelect: (app: MarketplaceApp) => void
}>(({ app, onSelect }) => {
  const Icon = app.icon

  return (
    <button
      onClick={() => onSelect(app)}
      style={{
        display: 'flex', flexDirection: 'column',
        padding: spacing['5'], textAlign: 'left',
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.lg, cursor: 'pointer',
        transition: `all ${transitions.quick}`,
        fontFamily: typography.fontFamily,
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = colors.borderFocus
        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = shadows.cardHover
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = colors.borderSubtle
        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
      }}
      aria-label={`View ${app.name} details`}
    >
      {/* Featured badge */}
      {app.featured && (
        <div style={{
          position: 'absolute', top: spacing['3'], right: spacing['3'],
          padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
          backgroundColor: colors.orangeSubtle, color: colors.orangeText,
          fontSize: '9px', fontWeight: typography.fontWeight.semibold,
        }}>
          Featured
        </div>
      )}

      {/* Icon + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['3'] }}>
        <div style={{
          width: 40, height: 40, borderRadius: borderRadius.lg,
          backgroundColor: app.accentColor, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} color={colors.white} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              {app.name}
            </span>
            {app.verified && <Shield size={12} color={colors.statusActive} />}
          </div>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{app.developer}</span>
        </div>
      </div>

      {/* Description */}
      <p style={{
        margin: 0, marginBottom: spacing['3'], fontSize: typography.fontSize.sm,
        color: colors.textSecondary, lineHeight: typography.lineHeight.normal,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {app.description}
      </p>

      {/* Footer: rating + pricing + installs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginTop: 'auto' }}>
        {app.rating > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            <Star size={11} color={colors.primaryOrange} fill={colors.primaryOrange} />
            <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{app.rating}</span>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>({app.reviewCount})</span>
          </div>
        )}
        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{app.installs} installs</span>
        <span style={{
          marginLeft: 'auto', padding: `1px ${spacing['2']}`,
          borderRadius: borderRadius.full, fontSize: typography.fontSize.caption,
          fontWeight: typography.fontWeight.semibold,
          backgroundColor: app.pricing === 'free' ? colors.statusActiveSubtle : colors.statusPendingSubtle,
          color: app.pricing === 'free' ? colors.statusActive : colors.statusPending,
        }}>
          {app.priceLabel}
        </span>
      </div>

      {/* Coming soon overlay */}
      {app.status === 'coming_soon' && (
        <div style={{
          position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: borderRadius.lg,
        }}>
          <span style={{
            padding: `${spacing['2']} ${spacing['4']}`, borderRadius: borderRadius.full,
            backgroundColor: colors.surfaceInset, color: colors.textSecondary,
            fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
          }}>
            Coming Soon
          </span>
        </div>
      )}
    </button>
  )
})
AppCard.displayName = 'AppCard'

// ── App Detail Panel ──────────────────────────────────────────

const AppDetailPanel = memo<{
  app: MarketplaceApp
  onClose: () => void
}>(({ app, onClose }) => {
  const Icon = app.icon

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: zIndex.modal,
      backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div
        style={{
          width: 480, height: '100%', backgroundColor: colors.surfaceRaised,
          boxShadow: shadows.panel, overflow: 'auto',
          animation: 'slideInRight 200ms ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`${app.name} details`}
      >
        {/* Header */}
        <div style={{ padding: spacing['5'], borderBottom: `1px solid ${colors.borderSubtle}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['4'] }}>
            <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: spacing['1'] }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'] }}>
            <div style={{
              width: 56, height: 56, borderRadius: borderRadius.xl,
              backgroundColor: app.accentColor, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={28} color={colors.white} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <h2 style={{ margin: 0, fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{app.name}</h2>
                {app.verified && <Shield size={14} color={colors.statusActive} />}
              </div>
              <p style={{ margin: `${spacing['0.5']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>by {app.developer}</p>
            </div>
          </div>

          {/* Metrics row */}
          <div style={{ display: 'flex', gap: spacing['4'], marginTop: spacing['4'] }}>
            {app.rating > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                <Star size={13} color={colors.primaryOrange} fill={colors.primaryOrange} />
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>{app.rating}</span>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>({app.reviewCount} reviews)</span>
              </div>
            )}
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>{app.installs} installs</span>
            <span style={{
              padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
              backgroundColor: app.pricing === 'free' ? colors.statusActiveSubtle : colors.statusPendingSubtle,
              color: app.pricing === 'free' ? colors.statusActive : colors.statusPending,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
            }}>
              {app.priceLabel}
            </span>
          </div>

          {/* Install button */}
          <div style={{ marginTop: spacing['4'] }}>
            <PermissionGate permission="project.settings">
              <Btn
                variant={app.status === 'installed' ? 'secondary' : 'primary'}
                onClick={() => {
                  if (app.status === 'coming_soon') {
                    toast.info('This app is not yet available. We will notify you when it launches.')
                  } else {
                    toast.success(`${app.name} installation initiated`)
                  }
                }}
                disabled={app.status === 'coming_soon'}
              >
                {app.status === 'installed' ? (
                  <><CheckCircle size={14} /> Installed</>
                ) : app.status === 'coming_soon' ? (
                  <><Clock size={14} /> Coming Soon</>
                ) : (
                  <><Download size={14} /> Install App</>
                )}
              </Btn>
            </PermissionGate>
          </div>
        </div>

        {/* Description */}
        <div style={{ padding: spacing['5'] }}>
          <SectionHeader title="About" />
          <p style={{
            margin: `${spacing['3']} 0`, fontSize: typography.fontSize.sm,
            color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed,
          }}>
            {app.longDescription}
          </p>

          {/* Capabilities */}
          <SectionHeader title="Capabilities" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginTop: spacing['3'] }}>
            {app.capabilities.map((cap) => (
              <div key={cap} style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <CheckCircle size={13} color={colors.statusActive} />
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{cap}</span>
              </div>
            ))}
          </div>

          {/* Pricing details for paid apps */}
          {app.pricing === 'paid' && (
            <div style={{ marginTop: spacing['5'] }}>
              <SectionHeader title="Pricing" />
              <div style={{
                padding: spacing['4'], marginTop: spacing['3'],
                backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
              }}>
                <p style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>
                  {app.priceLabel}
                </p>
                <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  Per project. Billed monthly. Cancel anytime.
                </p>
              </div>
            </div>
          )}

          {/* Developer info */}
          <div style={{ marginTop: spacing['5'], paddingTop: spacing['4'], borderTop: `1px solid ${colors.borderSubtle}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Developer</p>
                <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{app.developer}</p>
              </div>
              {app.verified && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                  padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.full,
                  backgroundColor: colors.statusActiveSubtle, color: colors.statusActive,
                  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                }}>
                  <Shield size={10} /> Verified Partner
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </div>
  )
})
AppDetailPanel.displayName = 'AppDetailPanel'

// ── Main Page ─────────────────────────────────────────────────

export const Marketplace: React.FC = () => {
  const [category, setCategory] = useState<AppCategory>('all')
  const [search, setSearch] = useState('')
  const [selectedApp, setSelectedApp] = useState<MarketplaceApp | null>(null)

  const filteredApps = useMemo(() => {
    let apps = MARKETPLACE_APPS
    if (category !== 'all') {
      apps = apps.filter((a) => a.category === category)
    }
    if (search.trim()) {
      const lower = search.toLowerCase()
      apps = apps.filter(
        (a) =>
          a.name.toLowerCase().includes(lower) ||
          a.developer.toLowerCase().includes(lower) ||
          a.description.toLowerCase().includes(lower),
      )
    }
    return apps
  }, [category, search])

  const featuredApps = useMemo(
    () => MARKETPLACE_APPS.filter((a) => a.featured),
    [],
  )

  return (
    <PageContainer
      title="App Marketplace"
      subtitle="Connect your favorite tools to SiteSync. Build custom integrations with our API."
    >
      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing['3'],
        padding: spacing['3'], backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg, border: `1px solid ${colors.borderDefault}`,
        marginBottom: spacing['5'],
      }}>
        <Search size={16} color={colors.textTertiary} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search apps and integrations..."
          aria-label="Search marketplace"
          style={{
            flex: 1, border: 'none', outline: 'none',
            backgroundColor: 'transparent', fontSize: typography.fontSize.body,
            fontFamily: typography.fontFamily, color: colors.textPrimary,
          }}
        />
      </div>

      {/* Category filter */}
      <div style={{
        display: 'flex', gap: spacing['2'], marginBottom: spacing['5'],
        overflowX: 'auto', paddingBottom: spacing['1'],
      }}>
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon
          const isActive = category === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['3']}`,
                backgroundColor: isActive ? colors.primaryOrange : 'transparent',
                color: isActive ? colors.white : colors.textSecondary,
                border: `1px solid ${isActive ? colors.primaryOrange : colors.borderDefault}`,
                borderRadius: borderRadius.full, cursor: 'pointer',
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                fontFamily: typography.fontFamily, whiteSpace: 'nowrap',
                transition: `all ${transitions.quick}`,
              }}
            >
              <Icon size={12} />
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* Developer CTA */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing['4'],
        padding: spacing['4'], marginBottom: spacing['5'],
        backgroundColor: colors.statusReviewSubtle, borderRadius: borderRadius.lg,
        borderLeft: `3px solid ${colors.statusReview}`,
      }}>
        <Code size={20} color={colors.statusReview} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            Build on SiteSync
          </p>
          <p style={{ margin: `${spacing['0.5']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
            Create apps for 10,000+ construction companies. Earn 80% revenue share on paid apps.
          </p>
        </div>
        <Btn variant="ghost" size="sm" onClick={() => toast.info('Opening developer registration...')}>
          <Code size={13} /> Start Building
        </Btn>
      </div>

      {/* Featured section (when showing all) */}
      {category === 'all' && !search && (
        <div style={{ marginBottom: spacing['6'] }}>
          <SectionHeader title="Featured Apps" />
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: spacing['4'], marginTop: spacing['3'],
          }}>
            {featuredApps.map((app) => (
              <AppCard key={app.id} app={app} onSelect={setSelectedApp} />
            ))}
          </div>
        </div>
      )}

      {/* All apps grid */}
      <SectionHeader title={category === 'all' && !search ? 'All Apps' : `${filteredApps.length} Results`} />
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: spacing['4'], marginTop: spacing['3'],
      }}>
        {filteredApps.map((app) => (
          <AppCard key={app.id} app={app} onSelect={setSelectedApp} />
        ))}
      </div>

      {filteredApps.length === 0 && (
        <EmptyState
          icon={<Search size={28} color={colors.textTertiary} />}
          title="No apps found"
          description={search ? `No apps match "${search}". Try a different search.` : 'No apps in this category yet.'}
        />
      )}

      {/* App detail panel */}
      {selectedApp && (
        <AppDetailPanel app={selectedApp} onClose={() => setSelectedApp(null)} />
      )}
    </PageContainer>
  )
}

export default Marketplace
