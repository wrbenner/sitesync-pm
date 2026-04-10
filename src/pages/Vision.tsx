import React from 'react';
import { PageContainer, Card, SectionHeader, Btn } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { useMediaQuery } from '../hooks/useMediaQuery';
const visionContent = {
  heading: 'The Construction Operating System',
  pillars: [
    {
      id: 1,
      title: 'AI Is the Product',
      description: 'Not a feature bolted on. Every decision powered by construction intelligence.',
    },
    {
      id: 2,
      title: 'Zero Friction',
      description: 'Capture data once, use it everywhere. Field first design meets desktop power.',
    },
    {
      id: 3,
      title: 'See Tomorrow',
      description: 'Predictive insights. Risk flagged before it becomes a problem.',
    },
  ],
  pricingDisruption: {
    industry: {
      title: 'Industry Standard',
      basePrice: 2500,
      perUser: 250,
      perProject: 1500,
    },
    sitesync: {
      title: 'SiteSync Platform',
      basePrice: 499,
    },
  },
  roadmap: [
    { phase: 1, name: 'Field Intelligence', quarter: 'Q2 2026', features: 'Mobile capture, Real time insights, Crew coordination' },
    { phase: 2, name: 'Predictive Analytics', quarter: 'Q3 2026', features: 'Schedule optimization, Risk forecasting, Budget trending' },
    { phase: 3, name: 'Autonomous Workflows', quarter: 'Q4 2026', features: 'Auto RFI routing, Change order automation, Safety alerts' },
    { phase: 4, name: 'Enterprise Integration', quarter: 'Q1 2027', features: 'ERP connectors, Custom APIs, Multi project dashboards' },
  ],
};

export const Vision: React.FC = () => {
  const pillarNumbers = ['01', '02', '03'];
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <PageContainer title="Vision">
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: spacing['3xl'], paddingTop: spacing.xl }}>
        <h1
          style={{
            fontSize: typography.fontSize['6xl'],
            fontWeight: typography.fontWeight.bold,
            color: colors.textPrimary,
            margin: 0,
            marginBottom: spacing.lg,
            lineHeight: typography.lineHeight.tight,
            letterSpacing: '-0.5px',
          }}
        >
          {visionContent.heading}
        </h1>
        <p
          style={{
            fontSize: typography.fontSize.xl,
            color: colors.textSecondary,
            margin: '0 auto',
            marginBottom: spacing.xl,
            maxWidth: '560px',
            lineHeight: typography.lineHeight.relaxed,
          }}
        >
          The platform where field teams and project managers see the same thing at the same time.
        </p>
        <Btn variant="primary" size="lg">
          Get Started
        </Btn>
      </div>

      {/* Three Pillars */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: spacing.xl,
          marginBottom: spacing['3xl'],
        }}
      >
        {visionContent.pillars.map((pillar, index) => (
          <Card key={pillar.id} padding={spacing.xl}>
            <p
              style={{
                fontSize: typography.fontSize['4xl'],
                fontWeight: typography.fontWeight.bold,
                color: colors.borderLight,
                margin: 0,
                marginBottom: spacing.xl,
                lineHeight: 1,
              }}
            >
              {pillarNumbers[index]}
            </p>
            <h3
              style={{
                fontSize: typography.fontSize.xl,
                fontWeight: typography.fontWeight.bold,
                color: colors.textPrimary,
                margin: 0,
                marginBottom: spacing.md,
              }}
            >
              {pillar.title}
            </h3>
            <p
              style={{
                fontSize: typography.fontSize.base,
                color: colors.textSecondary,
                margin: 0,
                lineHeight: typography.lineHeight.relaxed,
              }}
            >
              {pillar.description}
            </p>
          </Card>
        ))}
      </div>

      {/* Pricing */}
      <SectionHeader title="Pricing" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: spacing.xl,
          marginBottom: spacing['3xl'],
        }}
      >
        {/* Industry Standard */}
        <Card padding={spacing.xl}>
          <h3
            style={{
              fontSize: typography.fontSize.lg,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textSecondary,
              margin: 0,
              marginBottom: spacing.xl,
            }}
          >
            {visionContent.pricingDisruption.industry.title}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
            <div>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginBottom: spacing.xs }}>
                Base fee
              </p>
              <p style={{ fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary, margin: 0 }}>
                ${visionContent.pricingDisruption.industry.basePrice.toLocaleString()}
              </p>
            </div>
            <div>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginBottom: spacing.xs }}>
                Per user
              </p>
              <p style={{ fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary, margin: 0 }}>
                ${visionContent.pricingDisruption.industry.perUser}
              </p>
            </div>
            <div>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginBottom: spacing.xs }}>
                Per project
              </p>
              <p style={{ fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary, margin: 0 }}>
                ${visionContent.pricingDisruption.industry.perProject.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        {/* SiteSync */}
        <Card padding={spacing.xl}>
          <h3
            style={{
              fontSize: typography.fontSize.lg,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              margin: 0,
              marginBottom: spacing.xl,
            }}
          >
            {visionContent.pricingDisruption.sitesync.title}
          </h3>
          <div
            style={{
              backgroundColor: colors.primaryOrange,
              padding: spacing.xl,
              borderRadius: borderRadius.lg,
              color: colors.white,
              textAlign: 'center',
              marginBottom: spacing.lg,
            }}
          >
            <p style={{ fontSize: typography.fontSize.sm, margin: 0, marginBottom: spacing.sm, opacity: 0.85 }}>
              Everything included
            </p>
            <p
              style={{
                fontSize: typography.fontSize['4xl'],
                fontWeight: typography.fontWeight.bold,
                margin: 0,
                marginBottom: spacing.xs,
              }}
            >
              ${visionContent.pricingDisruption.sitesync.basePrice}
            </p>
            <p style={{ fontSize: typography.fontSize.sm, margin: 0, opacity: 0.85 }}>
              per project per month
            </p>
          </div>
          <p
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textTertiary,
              margin: 0,
              textAlign: 'center',
            }}
          >
            Unlimited users. All features. AI included.
          </p>
        </Card>
      </div>

      {/* Roadmap */}
      <SectionHeader title="Roadmap" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: spacing.lg,
        }}
      >
        {visionContent.roadmap.map((phase) => (
          <Card key={phase.phase} padding={spacing.xl}>
            <p
              style={{
                fontSize: typography.fontSize.xs,
                color: colors.textSecondary,
                margin: 0,
                marginBottom: spacing.sm,
                fontWeight: typography.fontWeight.semibold,
              }}
            >
              {phase.quarter}
            </p>
            <h3
              style={{
                fontSize: typography.fontSize.lg,
                fontWeight: typography.fontWeight.bold,
                color: colors.textPrimary,
                margin: 0,
                marginBottom: spacing.md,
              }}
            >
              {phase.name}
            </h3>
            <p
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.textSecondary,
                margin: 0,
                lineHeight: typography.lineHeight.relaxed,
              }}
            >
              {phase.features}
            </p>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
};
