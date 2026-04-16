import React, { useEffect, useState} from 'react'
import { useLocation } from 'react-router-dom'

const pageNames: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/tasks': 'Tasks',
  '/rfis': 'RFIs',
  '/submittals': 'Submittals',
  '/schedule': 'Schedule',
  '/budget': 'Budget',
  '/drawings': 'Drawings',
  '/crews': 'Crews',
  '/daily-log': 'Daily Log',
  '/punch-list': 'Punch List',
  '/directory': 'Directory',
  '/meetings': 'Meetings',
  '/files': 'Files',
  '/activity': 'Activity',
  '/copilot': 'AI Copilot',
  '/field-capture': 'Field Capture',
  '/vision': 'Vision',
  '/time-machine': 'Time Machine',
  '/project-health': 'Project Health',
  '/change-orders': 'Change Orders',
  '/safety': 'Safety',
  '/estimating': 'Estimating',
  '/procurement': 'Procurement',
  '/equipment': 'Equipment',
  '/financials': 'Financials',
  '/insurance': 'Insurance',
  '/workforce': 'Workforce',
  '/permits': 'Permits',
  '/integrations': 'Integrations',
  '/reports': 'Reports',
  '/sustainability': 'Sustainability',
  '/warranties': 'Warranties',
  '/portfolio': 'Portfolio',
  '/ai-agents': 'AI Agents',
  '/audit-trail': 'Audit Trail',
  '/lookahead': 'Lookahead',
  '/onboarding': 'Onboarding',
  '/login': 'Sign In',
  '/signup': 'Create Account',
}

export const RouteAnnouncer: React.FC = () => {
  const location = useLocation()
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const name = pageNames[location.pathname] || 'Page'
    setTimeout(() => setAnnouncement(`Navigated to ${name}`), 0)
  }, [location.pathname])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {announcement}
    </div>
  )
}
