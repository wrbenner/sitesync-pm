import React from 'react'
import { Link } from 'react-router-dom'
import { colors, spacing, typography } from '../../styles/theme'

// BRT sub-0 day-4 P0-I: placeholder Privacy Policy page. Final legal
// copy is a separate sub-slice pending legal review.

export const Privacy: React.FC = () => (
  <div
    style={{
      maxWidth: '720px',
      margin: '0 auto',
      padding: `${spacing['10']} ${spacing['6']}`,
      fontFamily: typography.fontFamily,
      color: colors.textPrimary,
      letterSpacing: typography.letterSpacing.normal,
    }}
  >
    <h1 style={{ fontSize: typography.fontSize.large, marginBottom: spacing['4'] }}>
      Privacy Policy
    </h1>
    <p style={{ color: colors.textSecondary, marginBottom: spacing['6'], lineHeight: 1.6 }}>
      Final Privacy Policy copy is pending legal review. For questions
      about data handling, contact{' '}
      <a href="mailto:legal@sitesyncai.com" style={{ color: colors.primaryOrange }}>
        legal@sitesyncai.com
      </a>
      .
    </p>
    <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
      <Link to="/signup" style={{ color: colors.primaryOrange }}>← Back to sign up</Link>
    </p>
  </div>
)

export default Privacy
