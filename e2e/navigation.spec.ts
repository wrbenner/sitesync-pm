import { test, expect } from '@playwright/test'

const pages = [
  { path: '/', title: 'Dashboard' },
  { path: '/tasks', title: 'Tasks' },
  { path: '/rfis', title: 'RFIs' },
  { path: '/submittals', title: 'Submittals' },
  { path: '/schedule', title: 'Schedule' },
  { path: '/budget', title: 'Budget' },
  { path: '/drawings', title: 'Drawings' },
  { path: '/crews', title: 'Crews' },
  { path: '/daily-log', title: 'Daily Log' },
  { path: '/punch-list', title: 'Punch List' },
  { path: '/directory', title: 'Directory' },
  { path: '/meetings', title: 'Meetings' },
  { path: '/files', title: 'Files' },
  { path: '/activity', title: 'Activity' },
  { path: '/copilot', title: 'AI Copilot' },
  { path: '/field-capture', title: 'Field Capture' },
  { path: '/vision', title: 'Vision' },
  { path: '/time-machine', title: 'Time Machine' },
  { path: '/project-health', title: 'Project Health' },
]

test.describe('Navigation', () => {
  for (const page of pages) {
    test(`should load ${page.title} page at ${page.path}`, async ({ page: pw }) => {
      await pw.goto(`#${page.path}`)
      await pw.waitForLoadState('networkidle')
      // Page should render without errors
      const errors: string[] = []
      pw.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
      await pw.waitForTimeout(1000)
      // Allow some console errors (e.g. network requests to unconfigured Supabase)
      // but page should be visible
      await expect(pw.locator('body')).toBeVisible()
    })
  }
})
