import React from 'react';
import { PageContainer, Card, SectionHeader, Btn, Skeleton } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { getVisionContent } from '../api/endpoints/ai';
import { useQuery } from '../hooks/useQuery';

export const Vision: React.FC = () => {
  const { data: visionContent, loading } = useQuery('visionContent', getVisionContent);
  const pillarNumbers = ['01', '02', '03'];

  if (loading || !visionContent) {
    return (
      <PageContainer title="Vision">
        <div style={{ textAlign: 'center', marginBottom: spacing['3xl'], paddingTop: spacing.xl }}>
          <Skeleton width="400px" height="48px" />
          <div style={{ marginTop: spacing.lg }}>
            <Skeleton width="560px" height="24px" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing.xl, marginBottom: spacing['3xl'] }}>
          {[1, 2, 3].map((i) => (
            <Card key={i} padding={spacing.xl}>
              <Skeleton width="40px" height="40px" />
              <div style={{ marginTop: spacing.xl }}><Skeleton width="80%" height="24px" /></div>
              <div style={{ marginTop: spacing.md }}><Skeleton width="100%" height="48px" /></div>
            </Card>
          ))}
        </div>
        <Skeleton width="120px" height="24px" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.xl, marginTop: spacing.lg, marginBottom: spacing['3xl'] }}>
          {[1, 2].map((i) => (
            <Card key={i} padding={spacing.xl}>
              <Skeleton width="60%" height="24px" />
              <div style={{ marginTop: spacing.lg }}><Skeleton width="100%" height="80px" /></div>
            </Card>
          ))}
        </div>
      </PageContainer>
    );
  }

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
          gridTemplateColumns: 'repeat(3, 1fr)',
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
          gridTemplateColumns: '1fr 1fr',
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
          gridTemplateColumns: 'repeat(4, 1fr)',
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
