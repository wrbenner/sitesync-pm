// src/lib/help/articles.ts — BRT subsystem 6 §4.2
//
// Static registry of help articles. Article bodies live as raw markdown
// strings imported via Vite's ?raw query so the source-of-truth stays in
// .md files (Founder-editable in any markdown editor) without runtime fetch.
//
// Adding an article = create the .md, add a row to ARTICLES, done.
// Founder writes the body. Engineering scaffolds the slot.

import gettingStarted from '../../content/help/01-getting-started.md?raw'
import firstProject from '../../content/help/02-first-project.md?raw'
import inviteTeam from '../../content/help/03-invite-team.md?raw'
import rolesPermissions from '../../content/help/04-roles-permissions.md?raw'
import creatingRfi from '../../content/help/05-creating-rfi.md?raw'
import routingRfi from '../../content/help/06-routing-rfi.md?raw'
import dailyLog from '../../content/help/07-daily-log.md?raw'
import createSubmittal from '../../content/help/08-create-submittal.md?raw'
import budgetCO from '../../content/help/09-budget-change-orders.md?raw'
import schedule from '../../content/help/10-schedule.md?raw'
import irisCopilot from '../../content/help/11-iris-copilot.md?raw'
import auditChain from '../../content/help/12-audit-chain.md?raw'
import approveDrafts from '../../content/help/13-approve-drafts.md?raw'
import manageSubscription from '../../content/help/14-manage-subscription.md?raw'
import paymentMethod from '../../content/help/15-payment-method.md?raw'
import cancelSubscription from '../../content/help/16-cancel-subscription.md?raw'
import mobilePwa from '../../content/help/17-mobile-pwa.md?raw'
import workingOffline from '../../content/help/18-working-offline.md?raw'
import exportData from '../../content/help/19-export-data.md?raw'
import securityPrivacy from '../../content/help/20-security-privacy.md?raw'

export type HelpSection = 'onboarding' | 'workflows' | 'ai' | 'billing' | 'mobile' | 'account'

export interface HelpArticle {
  id: string
  title: string
  section: HelpSection
  body: string
  /** Pages from which this article should be deep-linked via the "?" icon. */
  contextRoutes?: string[]
}

export const ARTICLES: HelpArticle[] = [
  { id: 'getting-started', title: 'Getting started in 5 minutes', section: 'onboarding', body: gettingStarted, contextRoutes: ['/onboarding', '/dashboard'] },
  { id: 'first-project',   title: 'Setting up your first project', section: 'onboarding', body: firstProject,   contextRoutes: ['/onboarding', '/projects/new'] },
  { id: 'invite-team',     title: 'Inviting your team', section: 'onboarding', body: inviteTeam, contextRoutes: ['/settings/team'] },
  { id: 'roles-permissions', title: 'Understanding roles and permissions', section: 'onboarding', body: rolesPermissions, contextRoutes: ['/settings/team'] },
  { id: 'creating-rfi',    title: 'Creating an RFI', section: 'workflows', body: creatingRfi, contextRoutes: ['/rfis', '/rfis/new'] },
  { id: 'routing-rfi',     title: 'Routing an RFI for response', section: 'workflows', body: routingRfi, contextRoutes: ['/rfis'] },
  { id: 'daily-log',       title: 'Logging a daily report', section: 'workflows', body: dailyLog, contextRoutes: ['/daily-logs'] },
  { id: 'create-submittal', title: 'Creating a submittal', section: 'workflows', body: createSubmittal, contextRoutes: ['/submittals', '/submittals/new'] },
  { id: 'budget-change-orders', title: 'Tracking budget and change orders', section: 'workflows', body: budgetCO, contextRoutes: ['/budget', '/change-orders'] },
  { id: 'schedule',        title: 'Working with the schedule', section: 'workflows', body: schedule, contextRoutes: ['/schedule'] },
  { id: 'iris-copilot',    title: 'What is the AI Copilot?', section: 'ai', body: irisCopilot, contextRoutes: [] },
  { id: 'audit-chain',     title: 'How does the audit chain work?', section: 'ai', body: auditChain, contextRoutes: [] },
  { id: 'approve-drafts',  title: 'Approving and rejecting AI drafts', section: 'ai', body: approveDrafts, contextRoutes: ['/rfis', '/submittals'] },
  { id: 'manage-subscription', title: 'Managing your subscription', section: 'billing', body: manageSubscription, contextRoutes: ['/settings/billing'] },
  { id: 'payment-method',  title: 'Updating payment method', section: 'billing', body: paymentMethod, contextRoutes: ['/settings/billing'] },
  { id: 'cancel-subscription', title: 'Canceling your subscription', section: 'billing', body: cancelSubscription, contextRoutes: ['/settings/billing'] },
  { id: 'mobile-pwa',      title: 'Using SiteSync on your phone (PWA install)', section: 'mobile', body: mobilePwa, contextRoutes: [] },
  { id: 'working-offline', title: 'Working offline', section: 'mobile', body: workingOffline, contextRoutes: [] },
  { id: 'export-data',     title: 'Exporting your data', section: 'account', body: exportData, contextRoutes: ['/settings'] },
  { id: 'security-privacy', title: 'Security and privacy', section: 'account', body: securityPrivacy, contextRoutes: ['/settings/security'] },
]

export const SECTIONS: Array<{ id: HelpSection; label: string }> = [
  { id: 'onboarding', label: 'Getting started' },
  { id: 'workflows', label: 'Workflows' },
  { id: 'ai', label: 'AI Copilot' },
  { id: 'billing', label: 'Billing' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'account', label: 'Account' },
]

export function articleById(id: string): HelpArticle | undefined {
  return ARTICLES.find((a) => a.id === id)
}

/** Find the most-relevant article for the current route, or undefined. */
export function articleForRoute(pathname: string): HelpArticle | undefined {
  // Longest contextRoute prefix wins (so /rfis/new beats /rfis).
  let best: { article: HelpArticle; score: number } | undefined
  for (const a of ARTICLES) {
    for (const r of a.contextRoutes ?? []) {
      if (pathname === r || pathname.startsWith(r + '/')) {
        const score = r.length
        if (!best || score > best.score) best = { article: a, score }
      }
    }
  }
  return best?.article
}
